/**
 * examples/text-to-model.js
 *
 * Generate a 3D model from a text prompt, wait for the task to complete,
 * then save the resulting GLB to disk.
 *
 *   $ export TRIPO_API_KEY="tsk_..."
 *   $ node examples/text-to-model.js "a cute red panda"
 */

import { writeFile } from 'node:fs/promises';
import { TripoClient, ModelVersion, TaskStatus } from '../src/index.js';

const prompt = process.argv.slice(2).join(' ') || 'a cute red panda holding bamboo';

const client = new TripoClient({
  // apiKey defaults to process.env.TRIPO_API_KEY
});

console.log(`> prompt: ${prompt}`);

const taskId = await client.textToModel({
  prompt,
  model: ModelVersion.H3_1,
  texture: true,
  pbr: true,
  texture_quality: 'detailed',
});

console.log(`> submitted, task_id=${taskId}`);

const task = await client.waitForTask(taskId, {
  pollingIntervalMs: 2000,
  onProgress: (t) => {
    process.stdout.write(`\r  ${t.status} — ${t.progress ?? 0}%   `);
  },
});
process.stdout.write('\n');

if (task.status !== TaskStatus.SUCCESS) {
  console.error('Task did not succeed:', task);
  process.exit(1);
}

const downloaded = await client.downloadModel(task);
if (!downloaded) {
  console.log('Task succeeded but no model URL was returned:', task.output);
  process.exit(0);
}

const filename = `tripo-${taskId}.glb`;
await writeFile(filename, Buffer.from(downloaded.data));
console.log(`> saved ${filename} (${downloaded.data.byteLength.toLocaleString()} bytes)`);
console.log(`> preview: ${task.output?.rendered_image_url ?? task.output?.rendered_image ?? '(none)'}`);
