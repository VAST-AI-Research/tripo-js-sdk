/**
 * examples/image-to-model.js
 *
 * Convert a local or remote image into a 3D model.
 *
 *   # local file
 *   $ node examples/image-to-model.js ./cat.png
 *   # remote URL
 *   $ node examples/image-to-model.js https://example.com/cat.jpg
 */

import { readFile } from 'node:fs/promises';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { TripoClient, ModelVersion } from '../src/index.js';

const inputArg = process.argv[2];
if (!inputArg) {
  console.error('Usage: node examples/image-to-model.js <local-file|url>');
  process.exit(1);
}

const client = new TripoClient();

let fileRef;
if (inputArg.startsWith('http://') || inputArg.startsWith('https://')) {
  fileRef = { url: inputArg };
} else {
  const buffer = await readFile(inputArg);
  const contentType = guessContentType(inputArg);
  const upload = await client.uploadFile(buffer, {
    filename: path.basename(inputArg),
    contentType,
  });
  console.log(`> uploaded, file_token=${upload.file_token}`);
  fileRef = { file_token: upload.file_token };
}

const taskId = await client.imageToModel({
  input: fileRef,
  model: ModelVersion.H3_1,
  texture: true,
  pbr: true,
  texture_alignment: 'original_image',
});
console.log(`> submitted, task_id=${taskId}`);

const task = await client.waitForTask(taskId, {
  onProgress: (t) => process.stdout.write(`\r  ${t.status} — ${t.progress ?? 0}%   `),
});
process.stdout.write('\n');

const dl = await client.downloadModel(task);
if (dl) {
  const filename = `tripo-${taskId}.glb`;
  await writeFile(filename, Buffer.from(dl.data));
  console.log(`> saved ${filename} (${dl.data.byteLength.toLocaleString()} bytes)`);
}

function guessContentType(p) {
  const ext = path.extname(p).toLowerCase();
  return (
    {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
      '.bmp': 'image/bmp',
    }[ext] ?? 'application/octet-stream'
  );
}
