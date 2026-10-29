import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(await readFile(path.join(root, 'asset-manifest.json'), 'utf8'));
assert.equal(manifest.schema, 1);
assert.equal(manifest.upstream.revision, 'b67bb50f3f3fa24b6a335133a1c176638a83f775');
const listed = new Set();
let total = 0;
for (const entry of manifest.files) {
  assert.match(entry.path, /^public\/(art|fonts)\//);
  assert.equal(entry.path.split('/').includes('..'), false, `Unsafe asset path: ${entry.path}`);
  assert.equal(listed.has(entry.path), false, `Duplicate asset: ${entry.path}`);
  listed.add(entry.path);
  assert.equal(entry.source, `docs/${entry.path.slice('public/'.length)}`);
  const bytes = await readFile(path.join(root, entry.path));
  assert.equal(bytes.length, entry.bytes, `${entry.path}: byte count changed`);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256, `${entry.path}: upstream bytes changed`);
  const gitBlob = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
  assert.equal(gitBlob, entry.gitBlob, `${entry.path}: upstream Git object mismatch`);
  total += bytes.length;
}
assert.equal(total, manifest.totalBytes);
async function inventory(relative) {
  const files = [];
  for (const item of await readdir(path.join(root, relative), { withFileTypes: true })) {
    const child = `${relative}/${item.name}`;
    assert.equal(item.isSymbolicLink(), false, `Unexpected asset symlink: ${child}`);
    if (item.isDirectory()) files.push(...await inventory(child));
    else files.push(child);
  }
  return files;
}
assert.deepEqual((await inventory('public/art')).concat(await inventory('public/fonts')).sort(), [...listed].sort(),
  'Every shipped asset must have pinned upstream provenance');

// Required painter/fallback coverage is explicit: trimming the extraction cannot silently turn
// a missing hull or coin into a procedural substitute and still pass a checksum-only inventory.
const required = [
  'spill-scene/depot.png', 'spill-scene/panorama.png', 'spill-scene/workshop.webp', 'spill-scene/depot-bear.jpg',
  'spill-ship/transforms.json', 'suits/flight.png', 'helms/clear.png', 'hyper-run/scout-ship.png',
  'pickups/acorn-coin.svg', 'music/menu.mp3', 'music/flight.mp3',
  ...Array.from({ length: 4 }, (_, i) => `spill-ship/hull-${i}.png`),
  ...['thrust', 'cone', 'cockpit'].flatMap(part => [1, 2, 3].map(level => `spill-ship/${part}-${level}.png`)),
  ...['magnet', 'scanner', 'brake', 'capacitor'].map(id => `spill-ship/utilities/${id}.webp`),
  ...Array.from({ length: 27 }, (_, i) => `debris/${i}.png`),
  ...['idle', 'flap'].flatMap(pose => [1, 2, 3, 4].map(i => `squirrel/${pose}-${i}.png`)),
  ...['acorn', 'golden'].flatMap(folder => Array.from({ length: 16 }, (_, i) => `${folder}/${i + 1}.png`)),
  ...Array.from({ length: 12 }, (_, i) => `suits/flight-tap-${i + 1}.png`),
  ...Array.from({ length: 4 }, (_, i) => `suits/flight-desc-${i + 1}.png`),
];
for (const asset of required) assert(listed.has(`public/art/${asset}`), `Missing required Spill asset: ${asset}`);
for (const license of ['OFL-Figtree.txt', 'OFL-Fraunces.txt'])
  assert(listed.has(`public/fonts/${license}`), `Missing font license: ${license}`);
const fonts = await readFile(path.join(root, 'public/fonts/fonts.css'), 'utf8');
for (const [, asset] of fonts.matchAll(/url\(['"]?([^)'"\s]+)['"]?\)/g))
  assert(listed.has(`public/fonts/${asset.replace(/^\.\//, '')}`), `Missing self-hosted font: ${asset}`);
console.log(`Assets verified: ${listed.size} exact upstream files, ${total} bytes; Spill and fallback coverage intact.`);
