/**
 * examples/rig-and-animate.js
 *
 * End-to-end "game-ready character" pipeline:
 *
 *   image-to-model  →  rig-check  →  rig  →  retarget(walk, idle, run)
 *
 *   $ node examples/rig-and-animate.js https://example.com/hero.png
 */

import { writeFile } from 'node:fs/promises';
import {
  TripoClient,
  Animation,
  ModelVersion,
  RigSpec,
  TaskStatus,
} from '../src/index.js';

const imageUrl =
  process.argv[2] ||
  'https://raw.githubusercontent.com/VAST-AI-Research/tripo-python-sdk/master/example.png';

const client = new TripoClient();

async function stage(label, taskId) {
  console.log(`\n[${label}] task_id=${taskId}`);
  const task = await client.waitForTask(taskId, {
    onProgress: (t) => process.stdout.write(`\r  ${t.status} — ${t.progress ?? 0}%   `),
  });
  process.stdout.write('\n');
  return task;
}

// 1. Generate a base 3D model — the P1 line has clean, low-poly topology.
const modelTaskId = await client.imageToModel({
  input: imageUrl,
  model: ModelVersion.P2,
  face_limit: 5000,
  texture: true,
});
const modelTask = await stage('image-to-model', modelTaskId);

// 2. Check whether the model is riggable and what skeleton type fits.
const checkTaskId = await client.rigCheck({ input: modelTaskId });
const checkTask = await stage('rig-check', checkTaskId);

const riggable = checkTask.output?.riggable ?? false;
const rigType = checkTask.output?.rig_type ?? 'biped';
if (!riggable) {
  console.error(`Model is not riggable (rig_type=${rigType}). Aborting.`);
  process.exit(1);
}
console.log(`  → riggable=true, rig_type=${rigType}`);

// 3. Attach the skeleton (use Mixamo naming so it drops into Unity/Unreal).
const rigTaskId = await client.rigModel({
  input: modelTaskId,
  rig_type: rigType,
  spec: RigSpec.MIXAMO,
});
await stage('rig', rigTaskId);

// 4. Retarget preset animations.
const animTaskId = await client.retargetAnimation({
  input: rigTaskId,
  animations: [Animation.IDLE, Animation.WALK, Animation.RUN],
  out_format: 'glb',
});
const animTask = await stage('retarget', animTaskId);

if (animTask.status !== TaskStatus.SUCCESS) {
  console.error('Retarget task did not succeed:', animTask);
  process.exit(1);
}

const urls = animTask.output?.model_urls ?? [animTask.output?.model_url];
console.log('\nAnimated model URLs:');
for (const [i, u] of urls.entries()) {
  console.log(`  [${i}] ${u}`);
}

const first = await client.downloadModel(animTask);
if (first) {
  const filename = `character-${animTaskId}.glb`;
  await writeFile(filename, Buffer.from(first.data));
  console.log(`> saved ${filename} (${first.data.byteLength.toLocaleString()} bytes)`);
}
