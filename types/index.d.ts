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
  readonly P1: 'P1-20260311';
  readonly P2: 'P2-20260801';
};

export const ImageModel: {
  readonly SEEDREAM_V5: 'seedream_v5';
  readonly BANANA: 'banana';
  readonly BANANA_PRO: 'banana_pro';
  readonly BANANA2: 'banana2';
  readonly CHAT_IMAGE_2: 'chat_image_2';
  readonly CHAT_IMAGE_2_5_FLARE: 'chat_image_2.5_flare';
  readonly CHAT_IMAGE_2_5_SUNBURST: 'chat_image_2.5_sunburst';
};

export const ImageQuality: {
  readonly LOW: 'low';
  readonly MEDIUM: 'medium';
  readonly HIGH: 'high';
  readonly XHIGH: 'xhigh';
  readonly MAX: 'max';
};

export const ImageBackground: {
  readonly AUTO: 'auto';
  readonly OPAQUE: 'opaque';
  readonly TRANSPARENT: 'transparent';
};

export const ImageFormat: {
  readonly PNG: 'png';
  readonly JPEG: 'jpeg';
};

export const AspectRatio: {
  readonly '1:1': '1:1';
  readonly '2:3': '2:3';
  readonly '3:2': '3:2';
  readonly '3:4': '3:4';
  readonly '4:3': '4:3';
  readonly '4:5': '4:5';
  readonly '5:4': '5:4';
  readonly '9:16': '9:16';
  readonly '16:9': '16:9';
  readonly '21:9': '21:9';
  readonly '1:8': '1:8';
  readonly '1:4': '1:4';
  readonly '4:1': '4:1';
  readonly '8:1': '8:1';
};

export const ImageTemplate: {
  readonly ASSET_EXTRACTION: 'asset_extraction';
  readonly CHARACTER_COMPLETION: 'character_completion';
  readonly T_POSE: 't_pose';
  readonly VARIANTS: 'variants';
  readonly FIGURE: 'figure';
  readonly ENHANCE_3D: '3d_enhance';
};

export const ExportOrientation: {
  readonly PLUS_X: '+x';
  readonly MINUS_X: '-x';
  readonly PLUS_Y: '+y';
  readonly MINUS_Y: '-y';
};

export const TextureQuality: {
  readonly STANDARD: 'standard';
  readonly DETAILED: 'detailed';
  readonly EXTREME: 'extreme';
};

export const GeometryQuality: {
  readonly STANDARD: 'standard';
  readonly DETAILED: 'detailed';
};

export const TextureAlignment: {
  readonly ORIGINAL_IMAGE: 'original_image';
  readonly GEOMETRY: 'geometry';
};

export const Orientation: {
  readonly DEFAULT: 'default';
  readonly ALIGN_IMAGE: 'align_image';
};

export const View: {
  readonly FRONT: 'front';
  readonly LEFT: 'left';
  readonly BACK: 'back';
  readonly RIGHT: 'right';
};

export type ImageModelValue = (typeof ImageModel)[keyof typeof ImageModel];
export type ImageQualityValue = (typeof ImageQuality)[keyof typeof ImageQuality];
export type ImageBackgroundValue = (typeof ImageBackground)[keyof typeof ImageBackground];
export type ImageFormatValue = (typeof ImageFormat)[keyof typeof ImageFormat];
export type AspectRatioValue = (typeof AspectRatio)[keyof typeof AspectRatio];
export type ImageTemplateValue = (typeof ImageTemplate)[keyof typeof ImageTemplate];
export type ExportOrientationValue = (typeof ExportOrientation)[keyof typeof ExportOrientation];
export type ViewValue = (typeof View)[keyof typeof View];

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

/**
 * Anything that can be passed as an image or model reference. A bare
 * string is forwarded untouched so the server can infer whether it is a
 * public URL, a `file_token`, or the `task_id` of an earlier task whose
 * output should be reused.
 */
export type FileInput = string | FileDescriptor;

/** A single per-view edit instruction for `editMultiview`. */
export interface MultiviewPrompt {
  prompt: string;
  view: ViewValue;
}

export interface TaskOutput {
  model?: string;
  model_url?: string;
  model_urls?: string[];
  base_model?: string;
  pbr_model?: string;
  rendered_image?: string;
  rendered_image_url?: string;
  /**
   * Output of the text-to-image and image-to-image endpoints. The 3D
   * generation endpoints also populate it with the reference image they
   * synthesised internally.
   */
  generated_image_url?: string;
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
  /**
   * Credits consumed, a decimal with up to two places (e.g. 48.00). Parse
   * it as a float — integer parsing truncates fractional credits.
   */
  credits_consumed?: number;
  /** ISO 8601 creation time. */
  created_at?: string;
  /** ISO 8601 completion time; absent until the task reaches a terminal status. */
  completed_at?: string;
  running_left_time?: number;
  queuing_num?: number;
  error_code?: number;
  error_message?: string;
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
  export_orientation?: ExportOrientationValue;
  style?: string;
  [key: string]: any;
}

export interface ImageToModelParams {
  /** A public URL, a `file_token`, or the `task_id` of an earlier image task. */
  input: FileInput;
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
  export_orientation?: ExportOrientationValue;
  style?: string;
  [key: string]: any;
}

export interface MultiviewToModelParams {
  /**
   * Exactly 4 views in [front, left, back, right] order. The front view is
   * mandatory and at least 2 views are required; pass `null` to skip one.
   */
  inputs?: Array<FileInput | null | undefined>;
  /** Reuse the 4-view output of an `imageToMultiview` or `editMultiview` task. */
  input_task_id?: string;
  model?: string;
  texture_alignment?: 'original_image' | 'geometry';
  orientation?: 'default' | 'align_image';
  model_seed?: number;
  texture_seed?: number;
  texture?: boolean;
  pbr?: boolean;
  texture_quality?: 'standard' | 'detailed' | 'extreme';
  geometry_quality?: 'standard' | 'detailed';
  face_limit?: number;
  auto_size?: boolean;
  quad?: boolean;
  smart_low_poly?: boolean;
  generate_parts?: boolean;
  compress?: string;
  export_uv?: boolean;
  export_orientation?: ExportOrientationValue;
  [key: string]: any;
}

export interface TextToImageParams {
  /** Required unless `template` is set. */
  prompt?: string;
  model?: ImageModelValue | (string & {});
  /** A resolution tier such as `'2K'`, or exact pixels such as `'2048x2048'`. */
  size?: string;
  /** Only `chat_image_2` and the 2.5 models accept this; others reject the request. */
  quality?: ImageQualityValue;
  /** Only the 2.5 models honour this; others ignore it. */
  background?: ImageBackgroundValue;
  /** Only the banana models accept this; use `size` for seedream and chat_image. */
  aspect_ratio?: AspectRatioValue;
  output_format?: ImageFormatValue;
  /** Only the seedream models honour this. */
  watermark?: boolean;
  template?: ImageTemplateValue;
  [key: string]: any;
}

export interface ImageToImageParams {
  /** A single reference image. Mutually exclusive with `inputs`. */
  input?: FileInput;
  /**
   * Multiple reference images, referenced from `prompt` as `image[1]`,
   * `image[2]` and so on. Max 4 for seedream, 10 for banana, 16 for
   * chat_image. Mutually exclusive with `input`.
   */
  inputs?: FileInput[];
  /** Required unless `template` is set. */
  prompt?: string;
  /** Note that `seedream_v4` is text-to-image only. */
  model?: ImageModelValue | (string & {});
  size?: string;
  quality?: ImageQualityValue;
  background?: ImageBackgroundValue;
  aspect_ratio?: AspectRatioValue;
  output_format?: ImageFormatValue;
  template?: ImageTemplateValue;
  [key: string]: any;
}

export interface EditMultiviewParams {
  /**
   * The `task_id` of an earlier successful multiview task. The API
   * documents file_token and URL inputs too, but the service currently
   * rejects anything that is not a task_id.
   */
  input: string;
  /** 1 to 4 per-view edit instructions. */
  prompts: MultiviewPrompt[];
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

  textToImage(params: TextToImageParams): Promise<string>;
  imageToImage(params: ImageToImageParams): Promise<string>;
  imageToMultiview(params: { input: FileInput; [key: string]: any }): Promise<string>;
  editMultiview(params: EditMultiviewParams): Promise<string>;

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

export function toFileDescriptor(input: FileInput): string | FileDescriptor;

export default TripoClient;
