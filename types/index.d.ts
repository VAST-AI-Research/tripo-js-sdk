/**
 * Type definitions for `@vastai/tripo-sdk`.
 *
 * These types mirror the JSDoc annotations in `src/` and expose them to
 * TypeScript / IDEs. They are intentionally permissive (`[key: string]: any`
 * on option bags) so new API parameters can be passed through without an SDK
 * upgrade.
 */

// ─── Enums / constants ──────────────────────────────────────────────────────

export const DEFAULT_BASE_URL: string;

export type TaskStatusValue =
  | 'queued'
  | 'running'
  | 'success'
  | 'failed'
  | 'cancelled'
  | 'unknown'
  | 'banned'
  | 'expired';

export const TaskStatus: {
  readonly QUEUED: 'queued';
  readonly RUNNING: 'running';
  readonly SUCCESS: 'success';
  readonly FAILED: 'failed';
  readonly CANCELLED: 'cancelled';
  readonly UNKNOWN: 'unknown';
  readonly BANNED: 'banned';
  readonly EXPIRED: 'expired';
};

export const TERMINAL_STATUSES: ReadonlyArray<TaskStatusValue>;

export const Animation: {
  readonly IDLE: 'preset:idle';
  readonly WALK: 'preset:walk';
  readonly RUN: 'preset:run';
  readonly DIVE: 'preset:dive';
  readonly CLIMB: 'preset:climb';
  readonly JUMP: 'preset:jump';
  readonly SLASH: 'preset:slash';
  readonly SHOOT: 'preset:shoot';
  readonly HURT: 'preset:hurt';
  readonly FALL: 'preset:fall';
  readonly TURN: 'preset:turn';
  readonly QUADRUPED_WALK: 'preset:quadruped:walk';
  readonly HEXAPOD_WALK: 'preset:hexapod:walk';
  readonly OCTOPOD_WALK: 'preset:octopod:walk';
  readonly SERPENTINE_MARCH: 'preset:serpentine:march';
  readonly AQUATIC_MARCH: 'preset:aquatic:march';
};

export const RigType: {
  readonly BIPED: 'biped';
  readonly QUADRUPED: 'quadruped';
  readonly HEXAPOD: 'hexapod';
  readonly OCTOPOD: 'octopod';
  readonly AVIAN: 'avian';
  readonly SERPENTINE: 'serpentine';
  readonly AQUATIC: 'aquatic';
  readonly OTHERS: 'others';
};

export const RigSpec: {
  readonly MIXAMO: 'mixamo';
  readonly TRIPO: 'tripo';
};

export const ModelVersion: {
  readonly H3_1: 'v3.1-20260211';
  readonly H3_0: 'v3.0-20250812';
  readonly H2_5: 'v2.5-20250123';
  readonly H2_0: 'v2.0-20240919';
  readonly P1: 'P1-20260311';
  readonly TURBO_V1: 'Turbo-v1.0-20250506';
};

export const OutputFormat: {
  readonly GLTF: 'GLTF';
  readonly GLB: 'GLB';
  readonly USDZ: 'USDZ';
  readonly FBX: 'FBX';
  readonly OBJ: 'OBJ';
  readonly STL: 'STL';
  readonly THREEMF: '3MF';
};

export const TextureFormat: {
  readonly BMP: 'BMP';
  readonly DPX: 'DPX';
  readonly HDR: 'HDR';
  readonly JPEG: 'JPEG';
  readonly OPEN_EXR: 'OPEN_EXR';
  readonly PNG: 'PNG';
  readonly TARGA: 'TARGA';
  readonly TIFF: 'TIFF';
  readonly WEBP: 'WEBP';
};

// ─── Common types ───────────────────────────────────────────────────────────

export interface FileDescriptor {
  file_token?: string;
  url?: string;
  object?: { bucket: string; key: string };
  type?: string;
}

/** Anything that can be passed as an image input in the SDK. */
export type FileInput = string | FileDescriptor;

export interface TaskOutput {
  model?: string;
  model_url?: string;
  model_urls?: string[];
  base_model?: string;
  pbr_model?: string;
  rendered_image?: string;
  rendered_image_url?: string;
  riggable?: boolean;
  rig_type?: string;
  [key: string]: any;
}

export interface Task {
  task_id: string;
  type: string;
  status: TaskStatusValue;
  progress?: number;
  input?: Record<string, any>;
  output?: TaskOutput;
  create_time?: number;
  running_left_time?: number;
  queuing_num?: number;
  error_code?: number;
  error_msg?: string;
  [key: string]: any;
}

export interface Balance {
  balance: number;
  frozen?: number;
  [key: string]: any;
}

// ─── Errors ─────────────────────────────────────────────────────────────────

export class TripoError extends Error {}

export class TripoRequestError extends TripoError {
  status?: number;
  statusText?: string;
  body?: unknown;
}

export class TripoAPIError extends TripoError {
  code: number;
  suggestion?: string;
  status?: number;
}

export class TripoTaskError extends TripoError {
  task: Task;
  status: TaskStatusValue;
  errorCode?: number;
  errorMessage?: string;
}

export class TripoTimeoutError extends TripoError {
  taskId: string;
  timeoutMs: number;
}

// ─── Client options ─────────────────────────────────────────────────────────

export interface TripoClientOptions {
  apiKey?: string;
  baseUrl?: string;
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
  retries?: number;
  userAgent?: string;
  defaultHeaders?: Record<string, string>;
}

export interface WaitForTaskOptions {
  pollingIntervalMs?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
  onProgress?: (task: Task) => void;
  throwOnFailure?: boolean;
}

// ─── Generation param bags ──────────────────────────────────────────────────

export interface TextToModelParams {
  prompt: string;
  model?: string;
  negative_prompt?: string;
  image_seed?: number;
  model_seed?: number;
  texture_seed?: number;
  texture?: boolean;
  pbr?: boolean;
  texture_quality?: 'standard' | 'detailed';
  geometry_quality?: 'standard' | 'detailed';
  face_limit?: number;
  auto_size?: boolean;
  quad?: boolean;
  smart_low_poly?: boolean;
  generate_parts?: boolean;
  compress?: string;
  export_uv?: boolean;
  style?: string;
  [key: string]: any;
}

export interface ImageToModelParams {
  file?: FileInput;
  image?: string;
  file_token?: string;
  url?: string;
  model?: string;
  enable_image_autofix?: boolean;
  model_seed?: number;
  texture_seed?: number;
  texture?: boolean;
  pbr?: boolean;
  texture_quality?: 'standard' | 'detailed';
  texture_alignment?: 'original_image' | 'geometry';
  geometry_quality?: 'standard' | 'detailed';
  face_limit?: number;
  auto_size?: boolean;
  orientation?: 'default' | 'align_image';
  quad?: boolean;
  smart_low_poly?: boolean;
  generate_parts?: boolean;
  compress?: string;
  export_uv?: boolean;
  style?: string;
  [key: string]: any;
}

export interface MultiviewToModelParams {
  files?: Array<FileInput | null | undefined>;
  original_task_id?: string;
  model?: string;
  [key: string]: any;
}

export interface ConvertModelParams {
  input: string;
  format: 'GLTF' | 'GLB' | 'USDZ' | 'FBX' | 'OBJ' | 'STL' | '3MF';
  quad?: boolean;
  face_limit?: number;
  texture_size?: number;
  texture_format?: string;
  flatten_bottom?: boolean;
  flatten_bottom_threshold?: number;
  pivot_to_center_bottom?: boolean;
  with_animation?: boolean;
  pack_uv?: boolean;
  force_symmetry?: boolean;
  bake?: boolean;
  part_names?: string[];
  [key: string]: any;
}

export interface TextureModelParams {
  input: string;
  texture?: boolean;
  pbr?: boolean;
  model_seed?: number;
  texture_seed?: number;
  texture_quality?: 'standard' | 'detailed';
  texture_alignment?: 'original_image' | 'geometry';
  text_prompt?: string;
  image_prompt?: FileInput;
  style_image?: FileInput;
  compress?: string;
  bake?: boolean;
  part_names?: string[];
  [key: string]: any;
}

export interface RigModelParams {
  input: string;
  rig_type?: string;
  spec?: 'mixamo' | 'tripo';
  out_format?: 'glb' | 'fbx';
  [key: string]: any;
}

export interface RetargetAnimationParams {
  input: string;
  animation?: string;
  animations?: string[];
  out_format?: 'glb' | 'fbx';
  bake_animation?: boolean;
  export_with_geometry?: boolean;
  animate_in_place?: boolean;
  [key: string]: any;
}

// ─── Client ─────────────────────────────────────────────────────────────────

export class TripoClient {
  constructor(options?: TripoClientOptions);

  getBalance(): Promise<Balance>;
  uploadFile(
    file: Blob | ArrayBuffer | Uint8Array | AsyncIterable<Uint8Array>,
    options?: { filename?: string; contentType?: string }
  ): Promise<{ file_token: string; [key: string]: any }>;

  getTask(taskId: string): Promise<Task>;
  listTasks(taskIds: string[]): Promise<{ tasks: Task[] }>;
  waitForTask(taskId: string, options?: WaitForTaskOptions): Promise<Task>;

  textToModel(params: TextToModelParams): Promise<string>;
  imageToModel(params: ImageToModelParams): Promise<string>;
  multiviewToModel(params: MultiviewToModelParams): Promise<string>;

  textToImage(params: { prompt: string; model?: string; [key: string]: any }): Promise<string>;
  imageToImage(params: { file?: FileInput; prompt?: string; [key: string]: any }): Promise<string>;
  imageToMultiview(params: { file?: FileInput; [key: string]: any }): Promise<string>;
  editMultiview(params: { original_task_id?: string; [key: string]: any }): Promise<string>;

  textureModel(params: TextureModelParams): Promise<string>;
  convertModel(params: ConvertModelParams): Promise<string>;

  segmentMesh(params: { input: string; model?: string; [key: string]: any }): Promise<string>;
  completeMesh(params: { input: string; model?: string; part_names?: string[]; [key: string]: any }): Promise<string>;
  decimateMesh(params: {
    input: string;
    model?: string;
    face_limit?: number;
    quad?: boolean;
    bake?: boolean;
    part_names?: string[];
    [key: string]: any;
  }): Promise<string>;

  rigCheck(params: { input: string; [key: string]: any }): Promise<string>;
  rigModel(params: RigModelParams): Promise<string>;
  retargetAnimation(params: RetargetAnimationParams): Promise<string>;

  run<P>(
    createFn: (params: P) => Promise<string>,
    params: P,
    waitOptions?: WaitForTaskOptions
  ): Promise<Task>;

  downloadModel(
    task: Task
  ): Promise<{ url: string; contentType: string | null; data: ArrayBuffer } | null>;
}

export function toFileDescriptor(input: FileInput): FileDescriptor;

export default TripoClient;
