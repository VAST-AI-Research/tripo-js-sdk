/**
 * Enumerations and public constants for the Tripo3D v3 API.
 *
 * Kept as frozen plain objects (not TS enums) so the module works in
 * pure JavaScript environments — Node.js, browsers, edge runtimes, etc.
 */

/** Default REST endpoint (China). Overseas: `https://openapi.tripo3d.ai/v3`. */
export const DEFAULT_BASE_URL = 'https://openapi.tripo3d.com/v3';

/** Task lifecycle statuses returned by `GET /v3/tasks/{task_id}`. */
export const TaskStatus = Object.freeze({
  QUEUED: 'queued',
  RUNNING: 'running',
  SUCCESS: 'success',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  UNKNOWN: 'unknown',
  BANNED: 'banned',
  EXPIRED: 'expired',
});

/** Terminal statuses — a task will not change once it enters one of these. */
export const TERMINAL_STATUSES = Object.freeze([
  TaskStatus.SUCCESS,
  TaskStatus.FAILED,
  TaskStatus.CANCELLED,
  TaskStatus.BANNED,
  TaskStatus.EXPIRED,
]);

/**
 * Preset animation identifiers accepted by `POST /v3/animations/retarget`.
 * Combine at most 5 in a single retarget call.
 */
export const Animation = Object.freeze({
  IDLE: 'preset:idle',
  WALK: 'preset:walk',
  RUN: 'preset:run',
  DIVE: 'preset:dive',
  CLIMB: 'preset:climb',
  JUMP: 'preset:jump',
  SLASH: 'preset:slash',
  SHOOT: 'preset:shoot',
  HURT: 'preset:hurt',
  FALL: 'preset:fall',
  TURN: 'preset:turn',
  QUADRUPED_WALK: 'preset:quadruped:walk',
  HEXAPOD_WALK: 'preset:hexapod:walk',
  OCTOPOD_WALK: 'preset:octopod:walk',
  SERPENTINE_MARCH: 'preset:serpentine:march',
  AQUATIC_MARCH: 'preset:aquatic:march',
});

/** Skeleton topology types for `POST /v3/animations/rig`. */
export const RigType = Object.freeze({
  BIPED: 'biped',
  QUADRUPED: 'quadruped',
  HEXAPOD: 'hexapod',
  OCTOPOD: 'octopod',
  AVIAN: 'avian',
  SERPENTINE: 'serpentine',
  AQUATIC: 'aquatic',
  OTHERS: 'others',
});

/** Rig specifications — controls bone naming/hierarchy conventions. */
export const RigSpec = Object.freeze({
  MIXAMO: 'mixamo',
  TRIPO: 'tripo',
});

/** `model` values accepted by the 3D generation endpoints. */
export const ModelVersion = Object.freeze({
  H3_1: 'v3.1-20260211',
  H3_0: 'v3.0-20250812',
  H2_5: 'v2.5-20250123',
  P1: 'P1-20260311',
  /**
   * Next-generation P series. The only model that accepts `quad`, and
   * unlike P1 it supports face limits up to 50,000 triangles (25,000 with
   * `quad`). Preview.
   */
  P2: 'P2-20260801',
});

/**
 * `model` values accepted by `POST /v3/generation/text-to-image` and
 * `POST /v3/generation/image-to-image`.
 *
 * `chat_image_1` and `chat_image_1.5` are omitted deliberately — they
 * retire on 2026-10-23 and 2026-12-01 respectively. Pass them as a raw
 * string during migration if you still need them.
 */
export const ImageModel = Object.freeze({
  SEEDREAM_V5: 'seedream_v5',
  BANANA: 'banana',
  BANANA_PRO: 'banana_pro',
  BANANA2: 'banana2',
  CHAT_IMAGE_2: 'chat_image_2',
  CHAT_IMAGE_2_5_FLARE: 'chat_image_2.5_flare',
  CHAT_IMAGE_2_5_SUNBURST: 'chat_image_2.5_sunburst',
});

/**
 * `quality` render tiers for image generation. Only `chat_image_2` and the
 * 2.5 models accept this parameter; any other model rejects the request
 * outright. Omitting it is equivalent to `low` — note this differs from
 * OpenAI's own `auto` default, which is not supported here.
 *
 * `XHIGH` and `MAX` are exclusive to the 2.5 models. `HIGH` and above cost
 * extra credits and take noticeably longer.
 */
export const ImageQuality = Object.freeze({
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  XHIGH: 'xhigh',
  MAX: 'max',
});

/**
 * `background` handling modes, supported only by the 2.5 models. Other
 * models ignore the field rather than rejecting the request.
 * `TRANSPARENT` requires `output_format: 'png'`.
 */
export const ImageBackground = Object.freeze({
  AUTO: 'auto',
  OPAQUE: 'opaque',
  TRANSPARENT: 'transparent',
});

/** `output_format` of a generated image. */
export const ImageFormat = Object.freeze({
  PNG: 'png',
  JPEG: 'jpeg',
});

/**
 * `aspect_ratio` of a generated image. Only the banana models accept it;
 * seedream and chat_image size their output via `size` instead.
 *
 * The 1:8, 1:4, 4:1 and 8:1 ratios are exclusive to `banana2`.
 */
export const AspectRatio = Object.freeze({
  '1:1': '1:1',
  '2:3': '2:3',
  '3:2': '3:2',
  '3:4': '3:4',
  '4:3': '4:3',
  '4:5': '4:5',
  '5:4': '5:4',
  '9:16': '9:16',
  '16:9': '16:9',
  '21:9': '21:9',
  '1:8': '1:8',
  '1:4': '1:4',
  '4:1': '4:1',
  '8:1': '8:1',
});

/**
 * `template` presets for image generation. Setting one makes `prompt`
 * optional.
 *
 * `ASSET_EXTRACTION` is accepted only by text-to-image and `ENHANCE_3D`
 * only by image-to-image; the rest work on both.
 */
export const ImageTemplate = Object.freeze({
  ASSET_EXTRACTION: 'asset_extraction',
  CHARACTER_COMPLETION: 'character_completion',
  T_POSE: 't_pose',
  VARIANTS: 'variants',
  FIGURE: 'figure',
  ENHANCE_3D: '3d_enhance',
});

/**
 * `export_orientation` (forward axis) of a generated model.
 *
 * It applies to that generation only. If the model will be fed into
 * post-processing (texture, rig, retarget, convert), leave this unset and
 * reorient in the last step via `convertModel` instead — a wrongly
 * oriented post-processing result still reports success rather than
 * raising an error.
 */
export const ExportOrientation = Object.freeze({
  PLUS_X: '+x',
  MINUS_X: '-x',
  PLUS_Y: '+y',
  MINUS_Y: '-y',
});

/** `texture_quality` levels for 3D generation. */
export const TextureQuality = Object.freeze({
  STANDARD: 'standard',
  DETAILED: 'detailed',
  EXTREME: 'extreme',
});

/**
 * `geometry_quality` levels for 3D generation. Only effective for model
 * versions >= `ModelVersion.H3_0`; do not send it with `ModelVersion.H2_5`.
 */
export const GeometryQuality = Object.freeze({
  STANDARD: 'standard',
  DETAILED: 'detailed',
});

/** `texture_alignment` priority for image- and multiview-based generation. */
export const TextureAlignment = Object.freeze({
  ORIGINAL_IMAGE: 'original_image',
  GEOMETRY: 'geometry',
});

/**
 * `orientation` of a generated model relative to the input image. Only
 * effective when texturing is enabled.
 */
export const Orientation = Object.freeze({
  DEFAULT: 'default',
  ALIGN_IMAGE: 'align_image',
});

/** The four canonical camera angles used by the multiview endpoints. */
export const View = Object.freeze({
  FRONT: 'front',
  LEFT: 'left',
  BACK: 'back',
  RIGHT: 'right',
});

/** Model conversion output formats accepted by `POST /v3/models/convert`. */
export const OutputFormat = Object.freeze({
  GLTF: 'GLTF',
  GLB: 'GLB',
  USDZ: 'USDZ',
  FBX: 'FBX',
  OBJ: 'OBJ',
  STL: 'STL',
  THREEMF: '3MF',
});

/** Texture image formats supported by the conversion API. */
export const TextureFormat = Object.freeze({
  BMP: 'BMP',
  DPX: 'DPX',
  HDR: 'HDR',
  JPEG: 'JPEG',
  OPEN_EXR: 'OPEN_EXR',
  PNG: 'PNG',
  TARGA: 'TARGA',
  TIFF: 'TIFF',
  WEBP: 'WEBP',
});
