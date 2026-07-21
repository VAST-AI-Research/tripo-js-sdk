/**
 * Small fetch-based HTTP layer used by the SDK.
 *
 * Responsibilities:
 *   - Attach `Authorization: Bearer …` header.
 *   - Serialize JSON bodies (or pass through FormData / streams).
 *   - Retry idempotent requests on transient errors with exponential back-off.
 *   - Parse the standard `{ code, data, message, suggestion }` envelope and
 *     raise `TripoAPIError` / `TripoRequestError` as appropriate.
 */

import { TripoAPIError, TripoRequestError } from './errors.js';

const DEFAULT_RETRY_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

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
      'User-Agent': config.userAgent ?? '@vastai/tripo-sdk/0.1.1',
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
        lastError = new TripoRequestError(
          err?.name === 'AbortError' ? `Request aborted after ${timeoutMs}ms` : `Network error: ${err?.message ?? err}`,
          { cause: err }
        );
        if (!isRetryableError(err) || attempt === totalAttempts) throw lastError;
        await sleep(backoffMs(attempt));
        continue;
      }

      clearTimeout(timer);
      options.signal?.removeEventListener('abort', abortForward);

      if (options.raw) return response;

      if (!response.ok) {
        const parsed = await safeReadJson(response);
        if (isRetryableStatus(response.status) && attempt < totalAttempts) {
          lastError = new TripoRequestError(
            `HTTP ${response.status} ${response.statusText}`,
            { status: response.status, statusText: response.statusText, body: parsed }
          );
          await sleep(backoffMs(attempt, response.headers.get('Retry-After')));
          continue;
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

function isRetryableStatus(status) {
  return DEFAULT_RETRY_STATUS.has(status);
}

function isRetryableError(err) {
  if (!err) return false;
  const code = err.code ?? err.cause?.code;
  return (
    err.name === 'FetchError' ||
    code === 'ECONNRESET' ||
    code === 'ETIMEDOUT' ||
    code === 'ECONNREFUSED' ||
    code === 'EAI_AGAIN' ||
    code === 'ENOTFOUND' ||
    code === 'UND_ERR_SOCKET'
  );
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
