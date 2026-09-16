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
   *   texture_quality?: 'standard' | 'detailed' | 'extreme',
   *   geometry_quality?: 'standard' | 'detailed',
   *   face_limit?: number,
   *   auto_size?: boolean,
   *   // `quad` forces the output format to FBX rather than GLB, and within
   *   // the P series only `ModelVersion.P2` accepts it.
   *   quad?: boolean,
   *   smart_low_poly?: boolean,
   *   generate_parts?: boolean,
   *   compress?: string,
   *   export_uv?: boolean,
   *   export_orientation?: '+x' | '-x' | '+y' | '-y',
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
   *   input: string | { file_token?: string, url?: string, object?: { bucket: string, key: string } },
   *   model?: string,
   *   enable_image_autofix?: boolean,
   *   model_seed?: number,
   *   texture_seed?: number,
   *   texture?: boolean,
   *   pbr?: boolean,
   *   texture_quality?: 'standard' | 'detailed' | 'extreme',
   *   texture_alignment?: 'original_image' | 'geometry',
   *   geometry_quality?: 'standard' | 'detailed',
   *   face_limit?: number,
   *   auto_size?: boolean,
   *   orientation?: 'default' | 'align_image',
   *   // `quad` forces the output format to FBX rather than GLB, and within
   *   // the P series only `ModelVersion.P2` accepts it.
   *   quad?: boolean,
   *   smart_low_poly?: boolean,
   *   generate_parts?: boolean,
   *   compress?: string,
   *   export_uv?: boolean,
   *   export_orientation?: '+x' | '-x' | '+y' | '-y',
   *   style?: string,
   *   [key: string]: any,
   * }} params
   * @returns {Promise<string>} task_id
   */
  async imageToModel(params = {}) {
    const { input, file, image, file_token, url, ...rest } = params;
    const descriptor = input ?? file ?? image ?? file_token ?? url;
    if (!descriptor) {
      throw new TypeError('imageToModel: `input` is required (url, file_token, or task_id).');
    }
    const payload = { input: toFileDescriptor(descriptor), ...rest };
    const { task_id } = await this.#createTask('/generation/image-to-model', payload);
    return task_id;
  }

  /**
   * POST /v3/generation/multiview-to-model
   *
   * `inputs` must contain exactly 4 items in [front, left, back, right]
   * order. The front view is mandatory and at least 2 views are required;
   * pass `null` for the ones you want to skip.
   *
   * To reuse the 4-view output of an earlier `imageToMultiview` or
   * `editMultiview` task, pass its id as `input_task_id` instead.
   *
   * @param {{
   *   inputs?: Array<string | { file_token?: string, url?: string, object?: object } | null>,
   *   input_task_id?: string,
   *   model?: string,
   *   [key: string]: any,
   * }} params
   * @returns {Promise<string>} task_id
   */
  async multiviewToModel(params = {}) {
    const { inputs, input_task_id, ...rest } = params;
    if (!inputs && !input_task_id) {
      throw new TypeError('multiviewToModel: provide `inputs` (length 4) or `input_task_id`.');
    }
    if (inputs && input_task_id) {
      throw new TypeError('multiviewToModel: `inputs` and `input_task_id` are mutually exclusive.');
    }

    const payload = { ...rest };
    if (inputs) {
      if (inputs.length !== 4) {
        throw new RangeError('multiviewToModel: `inputs` must contain exactly 4 items [front, left, back, right].');
      }
      if (!inputs[0]) {
        throw new TypeError('multiviewToModel: the front view (`inputs[0]`) is required.');
      }
      if (inputs.filter(Boolean).length < 2) {
        throw new RangeError('multiviewToModel: at least 2 views are required.');
      }
      payload.inputs = inputs.map((f) => (f ? toFileDescriptor(f) : ''));
    } else {
      payload.inputs = [{ task_id: input_task_id }];
    }

    const { task_id } = await this.#createTask('/generation/multiview-to-model', payload);
    return task_id;
  }

  // ───────────────────────── Image generation ───────────────────────────────

  /**
   * POST /v3/generation/text-to-image
   *
   * Several fields are only honoured by a subset of the `ImageModel`
   * values: `quality` by `chat_image_2` and the 2.5 models (others reject
   * the request), `background` by the 2.5 models, and `aspect_ratio` by
   * the banana models — seedream and chat_image use `size` instead.
   *
   * @param {{
   *   prompt?: string,
   *   model?: string,
   *   size?: string,
   *   quality?: string,
   *   background?: string,
   *   aspect_ratio?: string,
   *   output_format?: 'png' | 'jpeg',
   *   watermark?: boolean,
   *   template?: string,
   *   [k: string]: any,
   * }} params
   * @returns {Promise<string>} task_id
   */
  async textToImage(params) {
    if (!params?.prompt && !params?.template) {
      throw new TypeError('textToImage: `prompt` is required unless `template` is set.');
    }
    const { task_id } = await this.#createTask('/generation/text-to-image', params);
    return task_id;
  }

  /**
   * POST /v3/generation/image-to-image — edit, style transfer, or
   * multi-image fusion.
   *
   * Pass one reference image as `input`, or several as `inputs` and refer
   * to them from the prompt as `image[1]`, `image[2]` and so on. The
   * ceiling depends on the model: 4 for seedream, 10 for banana, 16 for
   * chat_image.
   *
   * Note that `seedream_v5` is the only seedream model this endpoint
   * accepts — `seedream_v4` is text-to-image only.
   *
   * @param {{
   *   input?: any,
   *   inputs?: any[],
   *   prompt?: string,
   *   model?: string,
   *   size?: string,
   *   quality?: string,
   *   background?: string,
   *   aspect_ratio?: string,
   *   output_format?: 'png' | 'jpeg',
   *   template?: string,
   *   [k: string]: any,
   * }} params
   * @returns {Promise<string>} task_id
   */
  async imageToImage(params = {}) {
    const { input, inputs, file, ...rest } = params;
    const single = input ?? file;
    if (!single && !inputs?.length) {
      throw new TypeError('imageToImage: `input` or `inputs` is required.');
    }
    if (single && inputs?.length) {
      throw new TypeError('imageToImage: `input` and `inputs` are mutually exclusive.');
    }
    if (!rest.prompt && !rest.template) {
      throw new TypeError('imageToImage: `prompt` is required unless `template` is set.');
    }

    const payload = single
      ? { input: toFileDescriptor(single), ...rest }
      : { inputs: inputs.map(toFileDescriptor), ...rest };
    const { task_id } = await this.#createTask('/generation/image-to-image', payload);
    return task_id;
  }

  /**
   * POST /v3/generation/image-to-multiview
   * @param {{ input?: any, [k: string]: any }} params
   * @returns {Promise<string>} task_id
   */
  async imageToMultiview(params = {}) {
    const { input, file, ...rest } = params;
    const descriptor = input ?? file;
    if (!descriptor) {
      throw new TypeError('imageToMultiview: `input` is required (url, file_token, or task_id).');
    }
    const payload = { input: toFileDescriptor(descriptor), ...rest };
    const { task_id } = await this.#createTask('/generation/image-to-multiview', payload);
    return task_id;
  }

  /**
   * POST /v3/generation/edit-multiview — apply per-view edits to a
   * previously generated multiview set.
   *
   * `input` must be the task_id of an earlier successful `imageToMultiview`
   * or `editMultiview` task. The API documents file_token and URL inputs
   * too, but the service currently rejects anything that is not a task_id.
   *
   * @param {{
   *   input: string,
   *   prompts: Array<{ prompt: string, view: 'front' | 'left' | 'back' | 'right' }>,
   *   [k: string]: any,
   * }} params
   * @returns {Promise<string>} task_id
   */
  async editMultiview(params = {}) {
    const { input, original_task_id, prompts, ...rest } = params;
    const descriptor = input ?? original_task_id;
    if (!descriptor) {
      throw new TypeError('editMultiview: `input` is required (the task_id of a multiview task).');
    }
    if (!prompts?.length || prompts.length > 4) {
      throw new RangeError('editMultiview: `prompts` must contain 1 to 4 items.');
    }
    const payload = { input: toFileDescriptor(descriptor), prompts, ...rest };
    const { task_id } = await this.#createTask('/generation/edit-multiview', payload);
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
