/**
 * Hermetic tests for TripoClient — no real network access.
 * A fake `fetch` implementation records calls and returns canned responses.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  TripoClient,
  TripoAPIError,
  TripoTaskError,
  TripoTimeoutError,
  Animation,
  ModelVersion,
  ImageModel,
  ImageQuality,
  ImageBackground,
  ImageFormat,
  ExportOrientation,
  View,
  RigSpec,
  TaskStatus,
} from '../src/index.js';

/**
 * Create a fake fetch that dispatches by `method path` and records every call.
 * @param {Record<string, (req: { url: URL, body: any, headers: Headers }) => any>} routes
 */
function makeFetch(routes) {
  const calls = [];
  const fn = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url);
    const method = (init.method ?? 'GET').toUpperCase();
    const key = `${method} ${url.pathname}`;

    let parsedBody = null;
    if (init.body != null) {
      if (typeof init.body === 'string') {
        try {
          parsedBody = JSON.parse(init.body);
        } catch {
          parsedBody = init.body;
        }
      } else {
        parsedBody = init.body;
      }
    }

    calls.push({ url, method, key, body: parsedBody, headers: new Headers(init.headers) });

    const handler = routes[key];
    if (!handler) {
      return new Response(JSON.stringify({ code: 9999, message: `no route: ${key}` }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const result = await handler({ url, body: parsedBody, headers: new Headers(init.headers) });
    if (result instanceof Response) return result;
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  return { fn, calls };
}

const okTask = (id, overrides = {}) => ({
  code: 0,
  data: {
    task_id: id,
    type: 'text_to_model',
    status: 'success',
    progress: 100,
    output: { model_url: `https://cdn.tripo3d.example/${id}.glb` },
    ...overrides,
  },
});

// ─────────────────────────────────────────────────────────────────────────────

test('constructor requires an API key', () => {
  const saved = process.env.TRIPO_API_KEY;
  delete process.env.TRIPO_API_KEY;
  try {
    assert.throws(() => new TripoClient(), /api key is required/i);
  } finally {
    if (saved !== undefined) process.env.TRIPO_API_KEY = saved;
  }
});

test('textToModel POSTs the expected payload and returns task_id', async () => {
  const { fn, calls } = makeFetch({
    'POST /v3/generation/text-to-model': ({ body }) => {
      assert.equal(body.prompt, 'a cat');
      assert.equal(body.model, ModelVersion.H3_1);
      assert.equal(body.texture, true);
      // undefined values must be stripped.
      assert.ok(!('negative_prompt' in body));
      return { code: 0, data: { task_id: 'task_123' } };
    },
  });
  const client = new TripoClient({ apiKey: 'k', fetch: fn });
  const id = await client.textToModel({
    prompt: 'a cat',
    model: ModelVersion.H3_1,
    texture: true,
    negative_prompt: undefined,
  });
  assert.equal(id, 'task_123');
  assert.equal(calls[0].headers.get('Authorization'), 'Bearer k');
});

test('imageToModel forwards a bare input string for the server to infer', async () => {
  const { fn, calls } = makeFetch({
    'POST /v3/generation/image-to-model': ({ body }) => {
      assert.equal(body.input, 'https://ex.com/a.png');
      return { code: 0, data: { task_id: 'task_img' } };
    },
  });
  const client = new TripoClient({ apiKey: 'k', fetch: fn });
  const id = await client.imageToModel({ input: 'https://ex.com/a.png' });
  assert.equal(id, 'task_img');
  assert.equal(calls.length, 1);
});

test('imageToModel accepts an explicit descriptor and export_orientation', async () => {
  const { fn } = makeFetch({
    'POST /v3/generation/image-to-model': ({ body }) => {
      assert.deepEqual(body.input, { file_token: 'abc-123' });
      assert.equal(body.model, ModelVersion.P2);
      assert.equal(body.export_orientation, ExportOrientation.MINUS_Y);
      return { code: 0, data: { task_id: 'task_img2' } };
    },
  });
  const client = new TripoClient({ apiKey: 'k', fetch: fn });
  const id = await client.imageToModel({
    input: { file_token: 'abc-123' },
    model: ModelVersion.P2,
    export_orientation: ExportOrientation.MINUS_Y,
  });
  assert.equal(id, 'task_img2');
});

test('multiviewToModel sends 4 positional inputs with skipped views as empty strings', async () => {
  const { fn } = makeFetch({
    'POST /v3/generation/multiview-to-model': ({ body }) => {
      assert.deepEqual(body.inputs, ['front.png', '', 'back.png', '']);
      return { code: 0, data: { task_id: 'task_mv' } };
    },
  });
  const client = new TripoClient({ apiKey: 'k', fetch: fn });
  assert.equal(
    await client.multiviewToModel({ inputs: ['front.png', null, 'back.png', null] }),
    'task_mv'
  );
});

test('multiviewToModel reuses a task_id through a single-element inputs array', async () => {
  const { fn } = makeFetch({
    'POST /v3/generation/multiview-to-model': ({ body }) => {
      assert.deepEqual(body.inputs, [{ task_id: 'task_mv_src' }]);
      return { code: 0, data: { task_id: 'task_mv' } };
    },
  });
  const client = new TripoClient({ apiKey: 'k', fetch: fn });
  assert.equal(await client.multiviewToModel({ input_task_id: 'task_mv_src' }), 'task_mv');
});

test('multiviewToModel rejects invalid inputs', async () => {
  const client = new TripoClient({ apiKey: 'k', fetch: async () => new Response('{}') });
  await assert.rejects(client.multiviewToModel({}), /inputs/);
  await assert.rejects(
    client.multiviewToModel({ inputs: ['a', 'b', 'c'] }),
    /exactly 4 items/
  );
  await assert.rejects(
    client.multiviewToModel({ inputs: [null, 'b', 'c', 'd'] }),
    /front view/
  );
  await assert.rejects(
    client.multiviewToModel({ inputs: ['a', null, null, null] }),
    /at least 2 views/
  );
  await assert.rejects(
    client.multiviewToModel({ inputs: ['a', 'b', null, null], input_task_id: 'x' }),
    /mutually exclusive/
  );
});

test('textToImage sends the new image parameters', async () => {
  const { fn } = makeFetch({
    'POST /v3/generation/text-to-image': ({ body }) => {
      assert.equal(body.model, ImageModel.CHAT_IMAGE_2_5_SUNBURST);
      assert.equal(body.quality, ImageQuality.MAX);
      assert.equal(body.background, ImageBackground.TRANSPARENT);
      assert.equal(body.output_format, ImageFormat.PNG);
      return { code: 0, data: { task_id: 'task_t2i' } };
    },
  });
  const client = new TripoClient({ apiKey: 'k', fetch: fn });
  const id = await client.textToImage({
    prompt: 'a glass sneaker',
    model: ImageModel.CHAT_IMAGE_2_5_SUNBURST,
    quality: ImageQuality.MAX,
    background: ImageBackground.TRANSPARENT,
    output_format: ImageFormat.PNG,
  });
  assert.equal(id, 'task_t2i');
});

test('imageToImage sends a model and multiple reference images', async () => {
  const { fn } = makeFetch({
    'POST /v3/generation/image-to-image': ({ body }) => {
      assert.equal(body.model, ImageModel.SEEDREAM_V5);
      assert.deepEqual(body.inputs, ['https://ex.com/a.png', 'ftok-b']);
      assert.equal(body.input, undefined);
      return { code: 0, data: { task_id: 'task_i2i' } };
    },
  });
  const client = new TripoClient({ apiKey: 'k', fetch: fn });
  const id = await client.imageToImage({
    inputs: ['https://ex.com/a.png', 'ftok-b'],
    model: ImageModel.SEEDREAM_V5,
    prompt: 'use the character from image[1] and the outfit from image[2]',
  });
  assert.equal(id, 'task_i2i');
});

test('imageToImage rejects invalid inputs', async () => {
  const client = new TripoClient({ apiKey: 'k', fetch: async () => new Response('{}') });
  await assert.rejects(client.imageToImage({ prompt: 'x' }), /`input` or `inputs`/);
  await assert.rejects(
    client.imageToImage({ input: 'a', inputs: ['b'], prompt: 'x' }),
    /mutually exclusive/
  );
  await assert.rejects(client.imageToImage({ input: 'a' }), /`prompt` is required/);
});

test('editMultiview sends per-view prompts', async () => {
  const { fn } = makeFetch({
    'POST /v3/generation/edit-multiview': ({ body }) => {
      assert.equal(body.input, 'task_mv_src');
      assert.deepEqual(body.prompts, [
        { prompt: 'make the shirt red', view: View.FRONT },
        { prompt: 'add a logo', view: View.BACK },
      ]);
      return { code: 0, data: { task_id: 'task_edit' } };
    },
  });
  const client = new TripoClient({ apiKey: 'k', fetch: fn });
  const id = await client.editMultiview({
    input: 'task_mv_src',
    prompts: [
      { prompt: 'make the shirt red', view: View.FRONT },
      { prompt: 'add a logo', view: View.BACK },
    ],
  });
  assert.equal(id, 'task_edit');
});

test('editMultiview rejects a missing input or an out-of-range prompt list', async () => {
  const client = new TripoClient({ apiKey: 'k', fetch: async () => new Response('{}') });
  await assert.rejects(
    client.editMultiview({ prompts: [{ prompt: 'x', view: View.FRONT }] }),
    /`input` is required/
  );
  await assert.rejects(client.editMultiview({ input: 'task_mv_src' }), /1 to 4 items/);
  await assert.rejects(
    client.editMultiview({ input: 'task_mv_src', prompts: new Array(5).fill({ prompt: 'x', view: View.FRONT }) }),
    /1 to 4 items/
  );
});

test('waitForTask polls until success and invokes onProgress', async () => {
  let n = 0;
  const { fn } = makeFetch({
    'GET /v3/tasks/task_xyz': () => {
      n += 1;
      if (n < 3) return { code: 0, data: { task_id: 'task_xyz', type: 't', status: 'running', progress: n * 30 } };
      return okTask('task_xyz');
    },
  });
  const client = new TripoClient({ apiKey: 'k', fetch: fn });
  const seen = [];
  const task = await client.waitForTask('task_xyz', {
    pollingIntervalMs: 1,
    onProgress: (t) => seen.push(t.status),
  });
  assert.equal(task.status, 'success');
  assert.deepEqual(seen, ['running', 'running', 'success']);
});

test('waitForTask throws TripoTaskError on failure by default', async () => {
  const { fn } = makeFetch({
    'GET /v3/tasks/task_fail': () => ({
      code: 0,
      data: { task_id: 'task_fail', type: 't', status: 'failed', error_code: 42, error_msg: 'nope' },
    }),
  });
  const client = new TripoClient({ apiKey: 'k', fetch: fn });
  await assert.rejects(
    client.waitForTask('task_fail', { pollingIntervalMs: 1 }),
    (err) => err instanceof TripoTaskError && err.errorCode === 42
  );
});

test('waitForTask respects timeoutMs', async () => {
  const { fn } = makeFetch({
    'GET /v3/tasks/task_slow': () => ({
      code: 0,
      data: { task_id: 'task_slow', type: 't', status: 'running', progress: 5 },
    }),
  });
  const client = new TripoClient({ apiKey: 'k', fetch: fn });
  await assert.rejects(
    client.waitForTask('task_slow', { pollingIntervalMs: 5, timeoutMs: 20 }),
    TripoTimeoutError
  );
});

test('API-level error responses raise TripoAPIError with code/message', async () => {
  const { fn } = makeFetch({
    'POST /v3/generation/text-to-model': () => ({
      code: 2010,
      message: 'Insufficient credits',
      suggestion: 'Please top up your account',
    }),
  });
  const client = new TripoClient({ apiKey: 'k', fetch: fn });
  await assert.rejects(
    client.textToModel({ prompt: 'a cat' }),
    (err) => err instanceof TripoAPIError && err.code === 2010 && /Insufficient credits/.test(err.message)
  );
});

test('rigCheck + rigModel + retargetAnimation build correct payloads', async () => {
  const seen = [];
  const { fn } = makeFetch({
    'POST /v3/animations/rig-check': ({ body }) => {
      seen.push(['rig-check', body]);
      return { code: 0, data: { task_id: 'chk_1' } };
    },
    'POST /v3/animations/rig': ({ body }) => {
      seen.push(['rig', body]);
      return { code: 0, data: { task_id: 'rig_1' } };
    },
    'POST /v3/animations/retarget': ({ body }) => {
      seen.push(['retarget', body]);
      return { code: 0, data: { task_id: 'anim_1' } };
    },
  });
  const client = new TripoClient({ apiKey: 'k', fetch: fn });
  const chk = await client.rigCheck({ input: 'task_src' });
  const rig = await client.rigModel({ input: 'task_src', rig_type: 'biped', spec: RigSpec.MIXAMO });
  const anim = await client.retargetAnimation({
    input: rig,
    animations: [Animation.WALK, Animation.IDLE],
  });
  assert.equal(chk, 'chk_1');
  assert.equal(rig, 'rig_1');
  assert.equal(anim, 'anim_1');
  assert.deepEqual(seen[0][1], { input: 'task_src' });
  assert.deepEqual(seen[1][1], { input: 'task_src', rig_type: 'biped', spec: 'mixamo' });
  assert.deepEqual(seen[2][1], {
    input: 'rig_1',
    animations: ['preset:walk', 'preset:idle'],
  });
});

test('retargetAnimation rejects > 5 animations', async () => {
  const client = new TripoClient({ apiKey: 'k', fetch: async () => new Response('{}') });
  await assert.rejects(
    client.retargetAnimation({ input: 'x', animations: new Array(6).fill(Animation.WALK) }),
    /at most 5/
  );
});

test('run() creates a task and waits for completion', async () => {
  let polled = 0;
  const { fn } = makeFetch({
    'POST /v3/generation/text-to-model': () => ({ code: 0, data: { task_id: 't1' } }),
    'GET /v3/tasks/t1': () => {
      polled += 1;
      if (polled < 2) return { code: 0, data: { task_id: 't1', type: 'text_to_model', status: 'running' } };
      return okTask('t1');
    },
  });
  const client = new TripoClient({ apiKey: 'k', fetch: fn });
  const task = await client.run(client.textToModel, { prompt: 'x' }, { pollingIntervalMs: 1 });
  assert.equal(task.status, TaskStatus.SUCCESS);
  assert.equal(task.task_id, 't1');
});

test('getBalance parses the standard envelope', async () => {
  const { fn } = makeFetch({
    'GET /v3/account/balance': () => ({ code: 0, data: { balance: 12.5, frozen: 0 } }),
  });
  const client = new TripoClient({ apiKey: 'k', fetch: fn });
  const b = await client.getBalance();
  assert.equal(b.balance, 12.5);
});

test('HTTP 500 with non-envelope body triggers retries then TripoRequestError', async () => {
  let attempts = 0;
  const fn = async () => {
    attempts += 1;
    return new Response('internal boom', { status: 500 });
  };
  const client = new TripoClient({ apiKey: 'k', fetch: fn, retries: 2 });
  await assert.rejects(client.getBalance(), /HTTP 500/);
  assert.equal(attempts, 3);
});
