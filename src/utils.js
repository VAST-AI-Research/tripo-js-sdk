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
 * Normalise an image/model reference into the shape the API expects.
 *
 *   - a plain string is passed through untouched, so the server can infer
 *     whether it is a public URL, a `file_token`, or the `task_id` of an
 *     earlier task whose output should be reused
 *   - a `{ file_token }` / `{ url }` / `{ object }` object is returned as-is
 *
 * @param {string | { file_token?: string, url?: string, object?: { bucket: string, key: string }, type?: string }} input
 * @returns {string | { file_token?: string, url?: string, object?: { bucket: string, key: string }, type?: string }}
 */
export function toFileDescriptor(input) {
  if (!input) throw new TypeError('File input is required.');
  if (typeof input === 'string') return input;
  if (typeof input === 'object') {
    if (input.file_token || input.url || input.object) return input;
  }
  throw new TypeError('Unsupported file input. Provide a URL, file_token, task_id, or a descriptor object.');
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

/**
 * Extract the lower-case file extension of a model URL, without the leading
 * dot (e.g. `'glb'`, `'fbx'`), or `''` if the URL carries none.
 *
 * Do not assume GLB: setting `quad` on a generation task forces FBX output,
 * and `convertModel` emits whichever format was requested.
 *
 * @param {string} url
 * @returns {string}
 */
export function modelExtension(url) {
  if (!url) return '';
  const name = url.split(/[?#]/, 1)[0].split('/').pop() ?? '';
  const i = name.lastIndexOf('.');
  return i < 0 ? '' : name.slice(i + 1).toLowerCase();
}

/**
 * Build a download-ready `<name>.<ext>` for a downloaded model, falling back
 * to `glb` when the URL carries no extension.
 *
 * @param {{ url: string }} downloaded
 * @param {string} name
 * @returns {string}
 */
export function modelFilename(downloaded, name) {
  return `${name}.${modelExtension(downloaded?.url) || 'glb'}`;
}
