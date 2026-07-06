/**
 * TripoClient — high-level facade for the Tripo3D v3 API.
 *
 * All generation-style methods return a `task_id` string. Use `waitForTask()`
 * to poll until the task settles, or `getTask()` for a single snapshot.
 *
 *   const client = new TripoClient({ apiKey: process.env.TRIPO_API_KEY });
 *   const taskId = await client.textToModel({ prompt: 'a cute cat' });
 *   const task = await client.waitForTask(taskId);
 *   console.log(task.output.model_url);
 */

import { HttpClient } from './http.js';
import { DEFAULT_BASE_URL, TaskStatus, TERMINAL_STATUSES } from './constants.js';
import { TripoTaskError, TripoTimeoutError } from './errors.js';
import { compact, sleep, toFileDescriptor } from './utils.js';

export class TripoClient {
  /**
   * @param {{
   *   apiKey?: string,
   *   baseUrl?: string,
   *   fetch?: typeof globalThis.fetch,
   *   timeoutMs?: number,
   *   retries?: number,
   *   userAgent?: string,
   *   defaultHeaders?: Record<string, string>,
   * }} [options]
   */
  constructor(options = {}) {
    const apiKey = options.apiKey ?? readEnv('TRIPO_API_KEY');
    if (!apiKey) {
      throw new TypeError(
        'TripoClient: an API key is required. Pass `apiKey` or set the TRIPO_API_KEY environment variable.'
      );
    }
    this.http = new HttpClient({
      apiKey,
      baseUrl: options.baseUrl ?? DEFAULT_BASE_URL,
      fetch: options.fetch,
      timeoutMs: options.timeoutMs,
      retries: options.retries,
      userAgent: options.userAgent,
      defaultHeaders: options.defaultHeaders,
    });
  }

  // ─────────────────────────────── Account ──────────────────────────────────

  /**
   * GET /v3/account/balance
   * @returns {Promise<{ balance: number, frozen?: number, [k: string]: any }>}
   */
  getBalance() {
    return this.http.request('/account/balance');
  }

  // ─────────────────────────────── Files ────────────────────────────────────

  /**
   * POST /v3/files — upload a raw file blob and receive a `file_token`.
   *
   * Accepts anything a browser/Node FormData can handle:
   *   - a `Blob` / `File`
   *   - a Node `Buffer` (wrapped in a Blob)
   *   - a Node `Readable` stream (Node 18+)
   *
   * @param {Blob | ArrayBuffer | Uint8Array | NodeJS.ReadableStream} file
   * @param {{ filename?: string, contentType?: string }} [options]
   * @returns {Promise<{ file_token: string, [k: string]: any }>}
   */
  async uploadFile(file, options = {}) {
    const form = new FormData();
    const blob = await coerceToBlob(file, options.contentType);
    form.append('file', blob, options.filename ?? 'upload.bin');
    return this.http.request('/files', { method: 'POST', body: form });
  }

  // ────────────────────────── Task management ───────────────────────────────

  /**
   * GET /v3/tasks/{task_id}
   * @param {string} taskId
   * @returns {Promise<import('./types.js').Task>}
   */
  getTask(taskId) {
    if (!taskId) throw new TypeError('getTask: `taskId` is required.');
    return this.http.request(`/tasks/${encodeURIComponent(taskId)}`);
  }

  /**
   * POST /v3/tasks/list — batch query multiple tasks in one round trip.
   * @param {string[]} taskIds
   * @returns {Promise<{ tasks: import('./types.js').Task[] }>}
   */
  listTasks(taskIds) {
    if (!Array.isArray(taskIds) || taskIds.length === 0) {
      throw new TypeError('listTasks: `taskIds` must be a non-empty array.');
    }
    return this.http.request('/tasks/list', {
      method: 'POST',
      json: { task_ids: taskIds },
    });
  }

  /**
   * Poll a task until it reaches a terminal state.
   *
   * @param {string} taskId
   * @param {{
   *   pollingIntervalMs?: number,
   *   timeoutMs?: number,
   *   signal?: AbortSignal,
   *   onProgress?: (task: import('./types.js').Task) => void,
   *   throwOnFailure?: boolean,
   * }} [options]
   * @returns {Promise<import('./types.js').Task>}
   */
  async waitForTask(taskId, options = {}) {
    const {
      pollingIntervalMs = 2000,
      timeoutMs,
      signal,
      onProgress,
      throwOnFailure = true,
    } = options;
    const started = Date.now();

    for (;;) {
      const task = await this.getTask(taskId);
      onProgress?.(task);

      if (TERMINAL_STATUSES.includes(task.status)) {
        if (throwOnFailure && task.status !== TaskStatus.SUCCESS) {
          throw new TripoTaskError(task);
        }
        return task;
      }

      if (timeoutMs !== undefined && Date.now() - started >= timeoutMs) {
        throw new TripoTimeoutError(taskId, timeoutMs);
      }

      await sleep(pollingIntervalMs, signal);
    }
  }

  // ─────────────────────────── 3D Generation ────────────────────────────────

  /**
   * POST /v3/generation/text-to-model
   *
   * @param {{
   *   prompt: string,
   *   model?: string,
   *   negative_prompt?: string,
   *   image_seed?: number,
   *   model_seed?: number,
   *   texture_seed?: number,
   *   texture?: boolean,
   *   pbr?: boolean,
   *   texture_quality?: 'standard' | 'detailed',
   *   geometry_quality?: 'standard' | 'detailed',
   *   face_limit?: number,
   *   auto_size?: boolean,
   *   quad?: boolean,
   *   smart_low_poly?: boolean,
   *   generate_parts?: boolean,
   *   compress?: string,
   *   export_uv?: boolean,
   *   style?: string,
   *   [key: string]: any,
   * }} params
   * @returns {Promise<string>} task_id
   */
  async textToModel(params) {
    if (!params?.prompt) throw new TypeError('textToModel: `prompt` is required.');
    const { data, task_id } = await this.#createTask('/generation/text-to-model', params);
    return task_id ?? data?.task_id;
  }

  /**
   * POST /v3/generation/image-to-model
   *
   * @param {{
   *   file?: string | { file_token?: string, url?: string, object?: { bucket: string, key: string } },
   *   image?: string,
   *   file_token?: string,
   *   url?: string,
   *   model?: string,
   *   enable_image_autofix?: boolean,
   *   model_seed?: number,
   *   texture_seed?: number,
   *   texture?: boolean,
   *   pbr?: boolean,
   *   texture_quality?: 'standard' | 'detailed',
   *   texture_alignment?: 'original_image' | 'geometry',
   *   geometry_quality?: 'standard' | 'detailed',
   *   face_limit?: number,
   *   auto_size?: boolean,
   *   orientation?: 'default' | 'align_image',
   *   quad?: boolean,
   *   smart_low_poly?: boolean,
   *   generate_parts?: boolean,
   *   compress?: string,
   *   export_uv?: boolean,
   *   style?: string,
   *   [key: string]: any,
   * }} params
   * @returns {Promise<string>} task_id
   */
  async imageToModel(params = {}) {
    const { file, image, file_token, url, ...rest } = params;
    const descriptor = file ?? image ?? file_token ?? url;
    if (!descriptor) {
      throw new TypeError('imageToModel: provide `file`, `file_token`, or `url`.');
    }
    const payload = { file: toFileDescriptor(descriptor), ...rest };
    const { task_id } = await this.#createTask('/generation/image-to-model', payload);
    return task_id;
  }

  /**
   * POST /v3/generation/multiview-to-model
   *
   * `files` must contain exactly 4 items in [front, left, back, right] order.
   * Individual items can be omitted (empty object) except the front view.
   *
   * @param {{
   *   files?: Array<string | { file_token?: string, url?: string, object?: object } | null>,
   *   original_task_id?: string,
   *   model?: string,
   *   [key: string]: any,
   * }} params
   * @returns {Promise<string>} task_id
   */
  async multiviewToModel(params = {}) {
    if (!params.files && !params.original_task_id) {
      throw new TypeError('multiviewToModel: provide `files` (length 4) or `original_task_id`.');
    }
    const payload = { ...params };
    if (params.files) {
      if (params.files.length !== 4) {
        throw new RangeError('multiviewToModel: `files` must contain exactly 4 items [front, left, back, right].');
      }
      payload.files = params.files.map((f) => (f ? toFileDescriptor(f) : {}));
    }
    const { task_id } = await this.#createTask('/generation/multiview-to-model', payload);
    return task_id;
  }

  // ───────────────────────── Image generation ───────────────────────────────

  /**
   * POST /v3/generation/text-to-image
   * @param {{ prompt: string, model?: string, [k: string]: any }} params
   * @returns {Promise<string>} task_id
   */
  async textToImage(params) {
    if (!params?.prompt) throw new TypeError('textToImage: `prompt` is required.');
    const { task_id } = await this.#createTask('/generation/text-to-image', params);
    return task_id;
  }

  /**
   * POST /v3/generation/image-to-image — image style/edit transformation.
   * @param {{ file?: any, prompt?: string, [k: string]: any }} params
   * @returns {Promise<string>} task_id
   */
  async imageToImage(params = {}) {
    const { file, ...rest } = params;
    const payload = file ? { file: toFileDescriptor(file), ...rest } : rest;
    const { task_id } = await this.#createTask('/generation/image-to-image', payload);
    return task_id;
  }

  /**
   * POST /v3/generation/image-to-multiview
   * @param {{ file?: any, [k: string]: any }} params
   * @returns {Promise<string>} task_id
   */
  async imageToMultiview(params = {}) {
    const { file, ...rest } = params;
    const payload = file ? { file: toFileDescriptor(file), ...rest } : rest;
    const { task_id } = await this.#createTask('/generation/image-to-multiview', payload);
    return task_id;
  }

  /**
   * POST /v3/generation/edit-multiview — edit a previously generated multiview set.
   * @param {{ original_task_id?: string, [k: string]: any }} params
   * @returns {Promise<string>} task_id
   */
  async editMultiview(params) {
    const { task_id } = await this.#createTask('/generation/edit-multiview', params ?? {});
    return task_id;
  }

  // ───────────────────────── Model post-processing ──────────────────────────

  /**
   * POST /v3/models/texture — re-texture an existing model.
   *
   * @param {{
   *   input: string,
   *   texture?: boolean,
   *   pbr?: boolean,
   *   model_seed?: number,
   *   texture_seed?: number,
   *   texture_quality?: 'standard' | 'detailed',
   *   texture_alignment?: 'original_image' | 'geometry',
   *   text_prompt?: string,
   *   image_prompt?: any,
   *   style_image?: any,
   *   compress?: string,
   *   bake?: boolean,
   *   part_names?: string[],
   *   [k: string]: any,
   * }} params
   */
  async textureModel(params) {
    if (!params?.input) throw new TypeError('textureModel: `input` (source task_id) is required.');
    const payload = { ...params };
    if (params.image_prompt) payload.image_prompt = toFileDescriptor(params.image_prompt);
    if (params.style_image) payload.style_image = toFileDescriptor(params.style_image);
    const { task_id } = await this.#createTask('/models/texture', payload);
    return task_id;
  }

  /**
   * POST /v3/models/convert — convert a completed model to another format.
   *
   * @param {{
   *   input: string,
   *   format: 'GLTF' | 'GLB' | 'USDZ' | 'FBX' | 'OBJ' | 'STL' | '3MF',
   *   quad?: boolean,
   *   face_limit?: number,
   *   texture_size?: number,
   *   texture_format?: string,
   *   flatten_bottom?: boolean,
   *   flatten_bottom_threshold?: number,
   *   pivot_to_center_bottom?: boolean,
   *   with_animation?: boolean,
   *   pack_uv?: boolean,
   *   force_symmetry?: boolean,
   *   bake?: boolean,
   *   part_names?: string[],
   *   [k: string]: any,
   * }} params
   */
  async convertModel(params) {
    if (!params?.input) throw new TypeError('convertModel: `input` is required.');
    if (!params?.format) throw new TypeError('convertModel: `format` is required.');
    const { task_id } = await this.#createTask('/models/convert', params);
    return task_id;
  }

  /**
   * POST /v3/mesh/segment — semantic segmentation of a mesh.
   * @param {{ input: string, model?: string, [k: string]: any }} params
   */
  async segmentMesh(params) {
    if (!params?.input) throw new TypeError('segmentMesh: `input` is required.');
    const { task_id } = await this.#createTask('/mesh/segment', params);
    return task_id;
  }

  /**
   * POST /v3/mesh/complete — mesh completion / repair.
   * @param {{ input: string, model?: string, part_names?: string[], [k: string]: any }} params
   */
  async completeMesh(params) {
    if (!params?.input) throw new TypeError('completeMesh: `input` is required.');
    const { task_id } = await this.#createTask('/mesh/complete', params);
    return task_id;
  }

  /**
   * POST /v3/mesh/decimate — retopology / face-count reduction.
   * @param {{ input: string, model?: string, face_limit?: number, quad?: boolean, bake?: boolean, part_names?: string[], [k: string]: any }} params
   */
  async decimateMesh(params) {
    if (!params?.input) throw new TypeError('decimateMesh: `input` is required.');
    const { task_id } = await this.#createTask('/mesh/decimate', params);
    return task_id;
  }

  // ─────────────────────────── Animation ────────────────────────────────────

  /**
   * POST /v3/animations/rig-check
   * Determines if a generated model can be rigged, and (if so) the recommended
   * skeleton type.
   *
   * @param {{ input: string, [k: string]: any }} params
   */
  async rigCheck(params) {
    if (!params?.input) throw new TypeError('rigCheck: `input` (source task_id) is required.');
    const { task_id } = await this.#createTask('/animations/rig-check', params);
    return task_id;
  }

  /**
   * POST /v3/animations/rig — attach a skeleton to a model.
   *
   * @param {{
   *   input: string,
   *   rig_type?: string,
   *   spec?: 'mixamo' | 'tripo',
   *   out_format?: 'glb' | 'fbx',
   *   [k: string]: any,
   * }} params
   */
  async rigModel(params) {
    if (!params?.input) throw new TypeError('rigModel: `input` (source task_id) is required.');
    const { task_id } = await this.#createTask('/animations/rig', params);
    return task_id;
  }

  /**
   * POST /v3/animations/retarget — apply preset animations to a rigged model.
   *
   * Accepts either `animation` (single preset) or `animations` (up to 5).
   *
   * @param {{
   *   input: string,
   *   animation?: string,
   *   animations?: string[],
   *   out_format?: 'glb' | 'fbx',
   *   bake_animation?: boolean,
   *   export_with_geometry?: boolean,
   *   animate_in_place?: boolean,
   *   [k: string]: any,
   * }} params
   */
  async retargetAnimation(params) {
    if (!params?.input) throw new TypeError('retargetAnimation: `input` (rigged task_id) is required.');
    if (!params.animation && (!params.animations || params.animations.length === 0)) {
      throw new TypeError('retargetAnimation: provide `animation` or a non-empty `animations` array.');
    }
    if (params.animations && params.animations.length > 5) {
      throw new RangeError('retargetAnimation: at most 5 animations per call.');
    }
    const { task_id } = await this.#createTask('/animations/retarget', params);
    return task_id;
  }

  // ─────────────────────── Convenience workflows ────────────────────────────

  /**
   * Convenience: create a task via any of the above endpoints, then wait
   * for its terminal state.
   *
   * @param {(params: any) => Promise<string>} createFn  — bound method (e.g. `client.textToModel`)
   * @param {any} params
   * @param {Parameters<TripoClient['waitForTask']>[1]} [waitOptions]
   * @returns {Promise<import('./types.js').Task>}
   */
  async run(createFn, params, waitOptions) {
    const taskId = await createFn.call(this, params);
    return this.waitForTask(taskId, waitOptions);
  }

  /**
   * Download the primary model URL of a completed task to a Buffer/Blob.
   * Returns `null` when the task has no model output.
   *
   * @param {import('./types.js').Task} task
   * @returns {Promise<{ url: string, contentType: string | null, data: ArrayBuffer } | null>}
   */
  async downloadModel(task) {
    const url = extractModelUrl(task);
    if (!url) return null;
    const res = await this.http.request(url, { raw: true, retries: 1 });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Download failed: HTTP ${res.status} ${res.statusText}${body ? ` — ${body}` : ''}`);
    }
    const buf = await res.arrayBuffer();
    return { url, contentType: res.headers.get('Content-Type'), data: buf };
  }

  // ────────────────────────────── Internals ─────────────────────────────────

  async #createTask(path, params) {
    const payload = compact(params ?? {});
    return this.http.request(path, { method: 'POST', json: payload });
  }
}

function extractModelUrl(task) {
  const out = task?.output ?? {};
  return (
    out.model_url ??
    out.model ??
    out.pbr_model ??
    out.base_model ??
    (Array.isArray(out.model_urls) ? out.model_urls[0] : undefined) ??
    null
  );
}

function readEnv(name) {
  if (typeof process !== 'undefined' && process?.env) return process.env[name];
  return undefined;
}

async function coerceToBlob(file, contentType) {
  const type = contentType ?? 'application/octet-stream';
  if (typeof Blob !== 'undefined' && file instanceof Blob) return file;
  if (file instanceof ArrayBuffer) return new Blob([file], { type });
  if (file && typeof file === 'object' && ArrayBuffer.isView(file)) {
    return new Blob([file], { type });
  }
  if (file && typeof file[Symbol.asyncIterator] === 'function') {
    const chunks = [];
    for await (const chunk of /** @type {AsyncIterable<any>} */ (file)) {
      chunks.push(chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk));
    }
    return new Blob(chunks, { type });
  }
  throw new TypeError('uploadFile: unsupported file input. Expected Blob, ArrayBuffer, Uint8Array, or async iterable.');
}
