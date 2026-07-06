# tripo3d-sdk-js

**English** · [简体中文](./README.zh-CN.md)

An unofficial, lightweight **JavaScript / TypeScript SDK** for the
[Tripo3D v3 API](https://developers.tripo3d.com/zh/docs/introduction) — a full
AI 3D generation platform covering text-to-3D, image-to-3D, multiview-to-3D,
re-texturing, mesh editing, auto-rigging and animation retargeting.

- Zero runtime dependencies (uses the platform `fetch`).
- Works on Node.js ≥ 18, Bun, Deno and modern browsers / edge runtimes.
- ESM-first with full TypeScript typings shipped in `types/`.
- Automatic retries on transient network / 5xx errors.
- First-class error hierarchy (`TripoAPIError`, `TripoTaskError`, …).
- Convenience `waitForTask()` poller with progress callbacks & timeouts.
- Sibling SDK to [`tripo3d-sdk-rust`](../tripo3d-sdk-rust) and [`tripo3d-sdk-go`](../tripo3d-sdk-go) — same API surface, idiomatic per language.

> Base URL: `https://openapi.tripo3d.com/v3` — this SDK targets the **v3**
> REST endpoints under `developers.tripo3d.com`, not the older
> `/v2/openapi/task` endpoint.

---

## Installation

```bash
npm install tripo3d-sdk-js
# or
pnpm add tripo3d-sdk-js
# or
yarn add tripo3d-sdk-js
```

Then create an API key on the [Tripo console](https://platform.tripo3d.ai/) and
expose it as an environment variable:

```bash
export TRIPO_API_KEY="tsk_..."
```

## Quick start

```js
import { TripoClient, ModelVersion } from 'tripo3d-sdk-js';

const client = new TripoClient(); // reads process.env.TRIPO_API_KEY

const taskId = await client.textToModel({
  prompt: 'a cute red panda holding bamboo',
  model: ModelVersion.H3_1,
  texture: true,
  pbr: true,
  texture_quality: 'detailed',
});

const task = await client.waitForTask(taskId, {
  pollingIntervalMs: 2000,
  onProgress: (t) => console.log(`${t.status} — ${t.progress ?? 0}%`),
});

console.log('Model URL:', task.output.model_url);
console.log('Preview:',  task.output.rendered_image_url);
```

> ⚠️ Model URLs expire ~5 minutes after task completion — download them right
> away. See `client.downloadModel(task)` for a helper that fetches the primary
> model into an `ArrayBuffer`.

---

## Client options

```ts
new TripoClient({
  apiKey?: string,                          // defaults to TRIPO_API_KEY env var
  baseUrl?: string,                         // default: https://openapi.tripo3d.com/v3
  fetch?: typeof globalThis.fetch,          // inject a custom fetch (e.g. undici)
  timeoutMs?: number,                       // per-request timeout, default 60s
  retries?: number,                         // extra attempts on 5xx / network errors, default 2
  userAgent?: string,
  defaultHeaders?: Record<string, string>,
});
```

---

## API reference

Every generation method returns a `task_id` (`string`). Use `waitForTask()`
(or `client.run(fn, params)`) to await the terminal result.

### Generation

| Method | Endpoint | Description |
| --- | --- | --- |
| `textToModel(params)` | `POST /generation/text-to-model` | Text → 3D model |
| `imageToModel(params)` | `POST /generation/image-to-model` | Single image → 3D model |
| `multiviewToModel(params)` | `POST /generation/multiview-to-model` | 4 views [front,left,back,right] → 3D model |
| `textToImage(params)` | `POST /generation/text-to-image` | Concept image from text |
| `imageToImage(params)` | `POST /generation/image-to-image` | Image style / edit |
| `imageToMultiview(params)` | `POST /generation/image-to-multiview` | Image → 4-view sheet |
| `editMultiview(params)` | `POST /generation/edit-multiview` | Refine multiview output |

### Model post-processing

| Method | Endpoint | Description |
| --- | --- | --- |
| `textureModel(params)` | `POST /models/texture` | Re-texture an existing model |
| `convertModel(params)` | `POST /models/convert` | Convert to GLTF / FBX / OBJ / STL / USDZ / 3MF |
| `segmentMesh(params)` | `POST /mesh/segment` | Semantic segmentation |
| `completeMesh(params)` | `POST /mesh/complete` | Mesh completion / repair |
| `decimateMesh(params)` | `POST /mesh/decimate` | Retopology / face-count reduction |

### Animation

| Method | Endpoint | Description |
| --- | --- | --- |
| `rigCheck(params)` | `POST /animations/rig-check` | Detect whether a model is riggable |
| `rigModel(params)` | `POST /animations/rig` | Attach a skeleton |
| `retargetAnimation(params)` | `POST /animations/retarget` | Apply preset animations |

### Utility

| Method | Endpoint | Description |
| --- | --- | --- |
| `getTask(taskId)` | `GET /tasks/{task_id}` | Fetch a task snapshot |
| `listTasks(taskIds)` | `POST /tasks/list` | Batch task query |
| `waitForTask(taskId, opts?)` | — | Poll until terminal state |
| `run(fn, params, waitOpts?)` | — | `waitForTask(fn(params))` combo |
| `uploadFile(blob, opts?)` | `POST /files` | Upload a raw file and get a `file_token` |
| `getBalance()` | `GET /account/balance` | Account credit balance |
| `downloadModel(task)` | — | Download the primary model URL to an `ArrayBuffer` |

---

## Passing images / files

Any method that accepts an image (`file`, `image_prompt`, `style_image`, …)
takes one of:

```js
'https://example.com/hero.png'          // absolute URL
'8f2a4c...'                             // a bare file_token from uploadFile()
{ file_token: '8f2a4c...' }             // explicit descriptor
{ url: 'https://example.com/a.png' }
{ object: { bucket: 'tripo-data', key: 'uploads/abc.png' } }
```

Upload a local buffer / Blob to get a `file_token`:

```js
import { readFile } from 'node:fs/promises';

const buffer = await readFile('./hero.png');
const { file_token } = await client.uploadFile(buffer, {
  filename: 'hero.png',
  contentType: 'image/png',
});

const taskId = await client.imageToModel({ file: file_token, model: 'v3.1-20260211' });
```

---

## End-to-end pipeline: game-ready character

```js
import {
  TripoClient, Animation, ModelVersion, RigSpec, TaskStatus,
} from 'tripo3d-sdk-js';

const client = new TripoClient();

// 1. Image → 3D (low-poly P1 topology, mobile/game friendly)
const modelId = await client.imageToModel({
  file: 'https://example.com/hero.png',
  model: ModelVersion.P1,
  face_limit: 5000,
  texture: true,
});
await client.waitForTask(modelId);

// 2. Verify skeleton compatibility
const checkId = await client.rigCheck({ input: modelId });
const check   = await client.waitForTask(checkId);
if (!check.output.riggable) throw new Error('Model is not riggable');

// 3. Attach skeleton (Mixamo-compatible bones → drop into Unity/Unreal)
const rigId = await client.rigModel({
  input: modelId,
  rig_type: check.output.rig_type,
  spec: RigSpec.MIXAMO,
});
await client.waitForTask(rigId);

// 4. Bake preset locomotion animations
const animId = await client.retargetAnimation({
  input: rigId,
  animations: [Animation.IDLE, Animation.WALK, Animation.RUN],
  out_format: 'glb',
});
const anim = await client.waitForTask(animId);

console.log('Animated GLB URLs:', anim.output.model_urls);
```

---

## Error handling

```js
import {
  TripoAPIError, TripoTaskError, TripoTimeoutError, TripoRequestError,
} from 'tripo3d-sdk-js';

try {
  const id   = await client.textToModel({ prompt: 'a chair' });
  const task = await client.waitForTask(id, { timeoutMs: 5 * 60_000 });
  // task.output.model_url ...
} catch (err) {
  if (err instanceof TripoAPIError) {
    console.error(`API error ${err.code}: ${err.message} — ${err.suggestion}`);
  } else if (err instanceof TripoTaskError) {
    console.error(`Task ${err.task.task_id} failed:`, err.errorMessage);
  } else if (err instanceof TripoTimeoutError) {
    console.error(`Gave up after ${err.timeoutMs}ms — task ${err.taskId}`);
  } else if (err instanceof TripoRequestError) {
    console.error(`Transport failure: HTTP ${err.status}`, err.body);
  } else {
    throw err;
  }
}
```

Cancel a poll with an `AbortController`:

```js
const ac = new AbortController();
setTimeout(() => ac.abort(), 30_000);
await client.waitForTask(id, { signal: ac.signal });
```

---

## Constants

```js
import {
  TaskStatus, Animation, RigType, RigSpec,
  ModelVersion, OutputFormat, TextureFormat,
} from 'tripo3d-sdk-js';

TaskStatus.SUCCESS         // 'success'
Animation.WALK             // 'preset:walk'
RigType.BIPED              // 'biped'
RigSpec.MIXAMO             // 'mixamo'
ModelVersion.H3_1          // 'v3.1-20260211'
ModelVersion.P1            // 'P1-20260311'
OutputFormat.FBX           // 'FBX'
```

Every constant is a plain string — you can also pass raw literals if you
prefer (the SDK never re-validates the value against the enum).

---

## Running the examples

```bash
export TRIPO_API_KEY="tsk_..."

node examples/text-to-model.js "a wooden treasure chest"
node examples/image-to-model.js ./hero.png
node examples/rig-and-animate.js https://example.com/hero.png
```

Each example saves the result GLB to the current directory.

---

## Development

```bash
npm test           # native node --test runner, fully hermetic (mocked fetch)
```

The source tree is intentionally small:

```
src/
  index.js         # public exports
  client.js        # TripoClient — all API methods
  http.js          # fetch wrapper with retry + envelope parsing
  errors.js        # error hierarchy
  constants.js     # enums (TaskStatus, Animation, …)
  utils.js         # helpers (file descriptor coercion, sleep, compact)
types/
  index.d.ts       # public TypeScript declarations
examples/          # runnable end-to-end demos
test/              # node --test suite
```

---

## Reference

- API reference (English): https://developers.tripo3d.com/en/docs/introduction
- API reference (中文):    https://developers.tripo3d.com/zh/docs/introduction
- Endpoint details:         https://docs.tripo3d.ai/

---

## License

MIT — see `LICENSE`.

This project is not affiliated with, or endorsed by, VAST AI / Tripo3D. It
merely provides a convenient client for their publicly documented v3 API.
