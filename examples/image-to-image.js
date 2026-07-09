/**
 * examples/image-to-image.js
 *
 * Apply a style/edit transformation to an existing image and save the
 * result to disk.
 *
 *   # local file
 *   $ node examples/image-to-image.js ./cat.png "turn it into a watercolor painting"
 *   # remote URL
 *   $ node examples/image-to-image.js https://example.com/cat.jpg "make it look like a pencil sketch"
 */

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { TripoClient, TaskStatus } from '../src/index.js';

const inputArg = process.argv[2];
const prompt = process.argv.slice(3).join(' ') || 'turn it into a watercolor painting';
if (!inputArg) {
  console.error('Usage: node examples/image-to-image.js <local-file|url> [prompt]');
  process.exit(1);
}

const client = new TripoClient();

let fileRef;
if (inputArg.startsWith('http://') || inputArg.startsWith('https://')) {
  fileRef = { url: inputArg };
} else {
  const buffer = await readFile(inputArg);
  const contentType = guessContentType(inputArg);
  const upload = await client.uploadFile(buffer, { filename: path.basename(inputArg), contentType });
  console.log(`> uploaded, file_token=${upload.file_token}`);
  fileRef = { file_token: upload.file_token };
}

console.log(`> prompt: ${prompt}`);
const taskId = await client.imageToImage({ file: fileRef, prompt });
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

function guessContentType(p) {
  const ext = path.extname(p).toLowerCase();
  return (
    { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif' }[
      ext
    ] ?? 'application/octet-stream'
  );
}

function guessExt(url, contentType) {
  const map = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp' };
  if (contentType && map[contentType.split(';')[0]]) return map[contentType.split(';')[0]];
  const m = url.match(/\.(png|jpe?g|webp|gif)(\?|$)/i);
  return m ? `.${m[1].toLowerCase()}` : '.bin';
}
