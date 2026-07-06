/**
 * Small helpers used across resource modules.
 */

/**
 * Drop keys whose values are `undefined` (but keep `null` / `false` / `0`).
 * Useful when forwarding option bags to the API without polluting the payload
 * with default `undefined`s.
 *
 * @template {Record<string, any>} T
 * @param {T} obj
 * @returns {Partial<T>}
 */
export function compact(obj) {
  /** @type {Record<string, any>} */
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return /** @type {Partial<T>} */ (out);
}

/**
 * Build the file descriptor the API expects.
 *
 *   - a plain string is treated as an already-uploaded file_token,
 *     or a URL if it starts with `http`
 *   - a `{ file_token }` / `{ url }` / `{ object }` object is returned as-is
 *
 * @param {string | { file_token?: string, url?: string, object?: { bucket: string, key: string }, type?: string }} input
 * @returns {{ file_token?: string, url?: string, object?: { bucket: string, key: string }, type?: string }}
 */
export function toFileDescriptor(input) {
  if (!input) throw new TypeError('File input is required.');
  if (typeof input === 'string') {
    if (input.startsWith('http://') || input.startsWith('https://')) {
      return { url: input };
    }
    return { file_token: input };
  }
  if (typeof input === 'object') {
    if (input.file_token || input.url || input.object) return input;
  }
  throw new TypeError('Unsupported file input. Provide a URL, file_token, or a descriptor object.');
}

/**
 * Sleep helper — used by the task poller.
 * @param {number} ms
 * @param {AbortSignal} [signal]
 */
export function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(abortReason(signal));
    const t = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(abortReason(signal));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function abortReason(signal) {
  return signal?.reason ?? new DOMException('Aborted', 'AbortError');
}
