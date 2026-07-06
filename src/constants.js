/**
 * Enumerations and public constants for the Tripo3D v3 API.
 *
 * Kept as frozen plain objects (not TS enums) so the module works in
 * pure JavaScript environments — Node.js, browsers, edge runtimes, etc.
 */

/** Default REST endpoint for the Tripo3D v3 openapi service. */
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

/** Available `model` values (product lines) exposed by the v3 API. */
export const ModelVersion = Object.freeze({
  H3_1: 'v3.1-20260211',
  H3_0: 'v3.0-20250812',
  H2_5: 'v2.5-20250123',
  H2_0: 'v2.0-20240919',
  P1: 'P1-20260311',
  TURBO_V1: 'Turbo-v1.0-20250506',
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
