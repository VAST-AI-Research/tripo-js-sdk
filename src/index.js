/**
 * @vastai/tripo-sdk — public entry point.
 *
 * Named exports are the recommended way to use this SDK:
 *
 *   import { TripoClient, Animation, RigType } from '@vastai/tripo-sdk';
 *
 *   const client = new TripoClient({ apiKey: process.env.TRIPO_API_KEY });
 *   const taskId = await client.textToModel({ prompt: 'a cute cat' });
 *   const task   = await client.waitForTask(taskId);
 *   console.log(task.output.model_url);
 */

export { TripoClient } from './client.js';

export {
  DEFAULT_BASE_URL,
  TaskStatus,
  TERMINAL_STATUSES,
  Animation,
  RigType,
  RigSpec,
  ModelVersion,
  ImageModel,
  ImageQuality,
  ImageBackground,
  ImageFormat,
  AspectRatio,
  ImageTemplate,
  ExportOrientation,
  TextureQuality,
  GeometryQuality,
  TextureAlignment,
  Orientation,
  View,
  OutputFormat,
  TextureFormat,
} from './constants.js';

export {
  TripoError,
  TripoRequestError,
  TripoAPIError,
  TripoTaskError,
  TripoTimeoutError,
} from './errors.js';

export { toFileDescriptor } from './utils.js';

import { TripoClient } from './client.js';
export default TripoClient;
