// Prints the gzipped size of the built JS and CSS and fails if the JS is over budget.
// Run after `npm run build`.
import { readdirSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';

const BUDGET_KB = 100;
const dir = 'dist/assets';
let jsTotal = 0;
for (const f of readdirSync(dir).filter((f) => /\.(js|css)$/.test(f))) {
  const kb = gzipSync(readFileSync(join(dir, f))).length / 1024;
  if (f.endsWith('.js')) jsTotal += kb;
  console.log(`${f.padEnd(32)} ${kb.toFixed(1)} KB gzipped`);
}
console.log(`JS total: ${jsTotal.toFixed(1)} KB gzipped (budget ${BUDGET_KB} KB)`);
if (jsTotal > BUDGET_KB) {
  console.error('Over budget.');
  process.exit(1);
}
