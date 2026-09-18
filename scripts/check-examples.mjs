/**
 * Examples are not covered by the test suite, so verify that every symbol
 * they import from the package entry point is actually exported. This is the
 * check that catches a rename landing in `src/` without the examples
 * following.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const exports = await import(join(root, 'src/index.js'));
const importRe = /import\s*\{([^}]+)\}\s*from\s*'\.\.\/src\/index\.js'/g;

let missing = 0;
for (const file of readdirSync(join(root, 'examples')).filter((f) => f.endsWith('.js'))) {
  const source = readFileSync(join(root, 'examples', file), 'utf8');
  for (const match of source.matchAll(importRe)) {
    const names = match[1]
      .split(',')
      .map((s) => s.trim().split(/\s+as\s+/)[0])
      .filter(Boolean);
    for (const name of names) {
      if (!(name in exports)) {
        console.error(`${file}: imports \`${name}\`, which src/index.js does not export`);
        missing += 1;
      }
    }
  }
}

if (missing > 0) {
  console.error(`\n${missing} unresolved import(s).`);
  process.exit(1);
}
console.log('All example imports resolve.');
