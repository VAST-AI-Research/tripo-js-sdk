/**
 * examples/text-to-image.js
 *
 * Generate a concept image from a text prompt, wait for the task to
 * complete, then save every URL found in the task output to disk.
 *
 *   $ export TRIPO_API_KEY="tsk_..."
 *   $ node examples/text-to-image.js "a cute red panda holding bamboo"
 */

import { writeFile } from 'node:fs/promises';
import { TripoClient, TaskStatus } from '../src/index.js';

const prompt = process.argv.slice(2).join(' ') || 'a cute red panda holding bamboo, studio lighting';

const client = new TripoClient();

console.log(`> prompt: ${prompt}`);

const taskId = await client.textToImage({ prompt });
console.log(`> submitted, task_id=${taskId}`);

const task = await client.waitForTask(taskId, {
  pollingIntervalMs: 2000,
  onProgress: (t) => process.stdout.write(`\r  ${t.status} — ${t.progress ?? 0}%   `),
});
process.stdout.write('\n');

if (task.status !== TaskStatus.SUCCESS) {
  console.error('Task did not succeed:', JSON.stringify(task, null, 2));
  process.exit(1);
}

console.log('> raw output:', JSON.stringify(task.output, null, 2));

const urls = collectUrls(task.output);
if (urls.length === 0) {
  console.log('> no downloadable URLs found in output.');
  process.exit(0);
}

let i = 0;
for (const [key, url] of urls) {
  const res = await fetch(url);
  const buf = Buffer.from(await res.arrayBuffer());
  const ext = guessExt(url, res.headers.get('content-type'));
  const filename = `tripo-${taskId}-${key}-${i++}${ext}`;
  await writeFile(filename, buf);
  console.log(`> saved ${filename} (${buf.byteLength.toLocaleString()} bytes) <- ${key}`);
}

function collectUrls(obj, prefix = '') {
  const found = [];
  if (!obj) return found;
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string' && value.startsWith('http')) {
      found.push([prefix + key, value]);
    } else if (Array.isArray(value)) {
      value.forEach((v, idx) => {
        if (typeof v === 'string' && v.startsWith('http')) found.push([`${prefix + key}${idx}`, v]);
      });
    } else if (value && typeof value === 'object') {
      found.push(...collectUrls(value, `${prefix + key}.`));
    }
  }
  return found;
}

function guessExt(url, contentType) {
  const map = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp' };
  if (contentType && map[contentType.split(';')[0]]) return map[contentType.split(';')[0]];
  const m = url.match(/\.(png|jpe?g|webp|gif)(\?|$)/i);
  return m ? `.${m[1].toLowerCase()}` : '.bin';
}
