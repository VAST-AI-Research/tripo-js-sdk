/**
 * Small fetch-based HTTP layer used by the SDK.
 *
 * Responsibilities:
 *   - Attach `Authorization: Bearer …` header.
 *   - Serialize JSON bodies (or pass through FormData / streams).
 *   - Retry on transient errors with exponential back-off, but only when the
 *     server cannot have processed the request: non-idempotent calls (every
 *     task-creation POST) are never replayed once they may have landed, since
 *     those are billed per submission.
 *   - Parse the standard `{ code, data, message, suggestion }` envelope and
 *     raise `TripoAPIError` / `TripoRequestError` as appropriate.
 */

import { TripoAPIError, TripoRequestError } from './errors.js';

/**
 * Retry safety classification.
 *
 * A retry is only safe when the server cannot have acted on the request.
 * Task-creation endpoints are billed per submission, so retrying a request
 * that may already have been processed can charge the caller twice.
 *
 * `'clean'`   — the request provably never reached the handler; safe to
 *               retry regardless of method.
 * `'unknown'` — the request may or may not have been processed; only safe to
 *               retry when the method is idempotent.
 * `'fatal'`   — not a transient failure; never retry.
 */

// Connection never established, so the request was never sent.
const CLEAN_ERROR_CODES = new Set([
  'ECONNREFUSED',
  'ENOTFOUND',
  'EAI_AGAIN',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'UND_ERR_CONNECT_TIMEOUT',
]);

// The request was (or may have been) sent before the failure surfaced.
const UNKNOWN_ERROR_CODES = new Set([
  'ECONNRESET',
  'ETIMEDOUT',
  'EPIPE',
  'UND_ERR_SOCKET',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_BODY_TIMEOUT',
]);

// The server answered and told us it declined to process the request.
const CLEAN_RETRY_STATUS = new Set([429, 503]);

// The server answered, but whether it processed the request is unknowable
// from the status alone (a 504 in particular is often emitted by a proxy
// after the origin already accepted the work).
const UNKNOWN_RETRY_STATUS = new Set([408, 425, 500, 502, 504]);

const INDETERMINATE_HINT =
  'The server may already have accepted this request, so it was not retried automatically. ' +
  'Check your task list before resubmitting to avoid being billed twice.';

/**
 * @typedef {Object} RequestOptions
 * @property {'GET'|'POST'|'PUT'|'DELETE'|'PATCH'} [method]
 * @property {Record<string, string>} [headers]
 * @property {unknown} [json]              JSON body — serialized automatically.
 * @property {BodyInit} [body]             Raw body (e.g. FormData). Takes precedence over `json`.
 * @property {Record<string, string|number|boolean|undefined|null>} [query]
 * @property {AbortSignal} [signal]
 * @property {number} [timeoutMs]          Per-request timeout (default: client default).
 * @property {number} [retries]            Extra attempts on transient failures.
 * @property {boolean} [idempotent]        Overrides the method-derived default.
 *   Non-idempotent requests are not retried once the server may have seen
 *   them; set this to `true` only if the endpoint deduplicates submissions.
 * @property {boolean} [raw]               When true, resolve with the raw Response.
 */

export class HttpClient {
  /**
   * @param {{
   *   baseUrl: string,
   *   apiKey: string,
   *   fetch?: typeof globalThis.fetch,
   *   timeoutMs?: number,
   *   retries?: number,
   *   userAgent?: string,
   *   defaultHeaders?: Record<string, string>,
   * }} config
   */
  constructor(config) {
    if (!config?.apiKey) {
      throw new TypeError('TripoClient: `apiKey` is required.');
    }
    this.baseUrl = (config.baseUrl ?? '').replace(/\/+$/, '');
    this.apiKey = config.apiKey;
    this.fetchImpl = config.fetch ?? globalThis.fetch;
    if (typeof this.fetchImpl !== 'function') {
      throw new TypeError(
        'TripoClient: global `fetch` is unavailable. Pass `fetch` explicitly (Node < 18 users can install `undici`).'
      );
    }
    this.timeoutMs = config.timeoutMs ?? 60_000;
    this.retries = config.retries ?? 2;
    this.defaultHeaders = {
      'User-Agent': config.userAgent ?? '@vastai/tripo-sdk/0.2.0',
      ...config.defaultHeaders,
    };
  }

  /**
   * Perform an authenticated request and return the parsed `data` payload
   * (or the raw Response when `options.raw` is truthy).
   *
   * @param {string} path
   * @param {RequestOptions} [options]
   * @returns {Promise<any>}
   */
  async request(path, options = {}) {
    const url = this.#buildUrl(path, options.query);
    const method = options.method ?? 'GET';
    const headers = new Headers(this.defaultHeaders);
    headers.set('Authorization', `Bearer ${this.apiKey}`);
    if (options.headers) {
      for (const [k, v] of Object.entries(options.headers)) headers.set(k, v);
    }

    let body = options.body;
    if (body === undefined && options.json !== undefined) {
      body = JSON.stringify(options.json);
      if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    }

    const totalAttempts = Math.max(1, (options.retries ?? this.retries) + 1);
    const idempotent = options.idempotent ?? isIdempotentMethod(method);
    let lastError;

    for (let attempt = 1; attempt <= totalAttempts; attempt++) {
      const controller = new AbortController();
      const timeoutMs = options.timeoutMs ?? this.timeoutMs;
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const abortForward = () => controller.abort(options.signal?.reason);
      options.signal?.addEventListener('abort', abortForward);

      let response;
      try {
        response = await this.fetchImpl(url, {
          method,
          headers,
          body,
          signal: controller.signal,
        });
      } catch (err) {
        clearTimeout(timer);
        options.signal?.removeEventListener('abort', abortForward);

        const cancelled = options.signal?.aborted === true;
        const safety = cancelled ? 'fatal' : classifyError(err);
        const willRetry = canRetry(safety, idempotent) && attempt < totalAttempts;
        const indeterminate = !willRetry && safety === 'unknown' && !idempotent;

        let message;
        if (cancelled) message = 'Request cancelled by caller';
        else if (err?.name === 'AbortError') message = `Request timed out after ${timeoutMs}ms`;
        else message = `Network error: ${err?.message ?? err}`;

        lastError = new TripoRequestError(indeterminate ? `${message}. ${INDETERMINATE_HINT}` : message, {
          cause: err,
          indeterminate,
        });
        if (!willRetry) throw lastError;
        await sleep(backoffMs(attempt));
        continue;
      }

      clearTimeout(timer);
      options.signal?.removeEventListener('abort', abortForward);

      if (options.raw) return response;

      if (!response.ok) {
        const parsed = await safeReadJson(response);
        const safety = classifyStatus(response.status);
        if (canRetry(safety, idempotent) && attempt < totalAttempts) {
          lastError = new TripoRequestError(
            `HTTP ${response.status} ${response.statusText}`,
            { status: response.status, statusText: response.statusText, body: parsed }
          );
          await sleep(backoffMs(attempt, response.headers.get('Retry-After')));
          continue;
        }
        if (safety === 'unknown' && !idempotent) {
          throw new TripoRequestError(
            `HTTP ${response.status} ${response.statusText}. ${INDETERMINATE_HINT}`,
            {
              status: response.status,
              statusText: response.statusText,
              body: parsed,
              indeterminate: true,
            }
          );
        }
        if (parsed && typeof parsed === 'object' && 'code' in parsed) {
          throw new TripoAPIError({
            code: /** @type {number} */ (parsed.code),
            message: parsed.message,
            suggestion: parsed.suggestion,
            status: response.status,
          });
        }
        throw new TripoRequestError(`HTTP ${response.status} ${response.statusText}`, {
          status: response.status,
          statusText: response.statusText,
          body: parsed,
        });
      }

      const payload = await safeReadJson(response);
      if (payload == null || typeof payload !== 'object') {
        throw new TripoRequestError('Malformed response: expected JSON object.', { body: payload });
      }
      if ('code' in payload && payload.code !== 0) {
        throw new TripoAPIError({
          code: /** @type {number} */ (payload.code),
          message: payload.message,
          suggestion: payload.suggestion,
          status: response.status,
        });
      }
      return 'data' in payload ? payload.data : payload;
    }

    throw lastError ?? new TripoRequestError('Request failed with no response.');
  }

  #buildUrl(path, query) {
    const url = new URL(path.startsWith('http') ? path : this.baseUrl + ensureLeadingSlash(path));
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v === undefined || v === null) continue;
        url.searchParams.set(k, String(v));
      }
    }
    return url.toString();
  }
}

function ensureLeadingSlash(p) {
  return p.startsWith('/') ? p : '/' + p;
}

async function safeReadJson(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function isIdempotentMethod(method) {
  return method === 'GET' || method === 'HEAD' || method === 'OPTIONS';
}

/** @returns {'clean'|'unknown'|'fatal'} */
function classifyStatus(status) {
  if (CLEAN_RETRY_STATUS.has(status)) return 'clean';
  if (UNKNOWN_RETRY_STATUS.has(status)) return 'unknown';
  return 'fatal';
}

/** @returns {'clean'|'unknown'|'fatal'} */
function classifyError(err) {
  if (!err) return 'fatal';
  // A timeout fired by our own AbortController: the request was already on
  // the wire, so the server may well have processed it.
  if (err.name === 'AbortError') return 'unknown';
  const code = err.code ?? err.cause?.code;
  if (CLEAN_ERROR_CODES.has(code)) return 'clean';
  if (UNKNOWN_ERROR_CODES.has(code)) return 'unknown';
  // Undici surfaces a bare `TypeError: fetch failed` for socket teardown
  // without always tagging a code; treat the unrecognised transport failure
  // as unknown rather than assuming it never landed.
  if (err.name === 'TypeError' || err.name === 'FetchError') return 'unknown';
  return 'fatal';
}

function canRetry(safety, idempotent) {
  if (safety === 'clean') return true;
  if (safety === 'unknown') return idempotent;
  return false;
}

function backoffMs(attempt, retryAfterHeader) {
  if (retryAfterHeader) {
    const secs = Number(retryAfterHeader);
    if (Number.isFinite(secs) && secs >= 0) return Math.min(secs * 1000, 30_000);
  }
  const base = Math.min(1000 * 2 ** (attempt - 1), 8000);
  return base + Math.floor(Math.random() * 250);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
