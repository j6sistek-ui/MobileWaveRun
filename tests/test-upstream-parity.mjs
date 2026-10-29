import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import * as Spill from '../dist/js/spill.js';

// Frozen from AcornautSandbox b67bb50f3f3fa24b6a335133a1c176638a83f775.
// These remain extraction guards for unchanged presentation modules. Flight physics
// intentionally changed on 2026-10-29, so the old tap/gravity state traces are retired.
const authority = {
  'spill-presentation.ts': '5d63ec10df0b0507c2e2fb5406e84e9dfe57b127d2699ea95b239f80cbdca27c',
  'spill-depot-gag.ts': 'e5899a33a6cb8981baa3dd1c6098bb426b27b903306f5ba87d1d4ad3a4ece172',
};
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
for (const [file, expected] of Object.entries(authority)) {
  // Windows Git checkouts use CRLF; normalize only line endings to the committed LF bytes.
  const source = readFileSync(new URL(`../illustrated-src/game/${file}`, import.meta.url), 'utf8').replaceAll('\r\n', '\n');
  assert.equal(sha256(source), expected, `${file} must preserve the pinned upstream source content`);
}

// The only authorized edits to this shared content module are Brake and Precision
// descriptions matching direct steering. Guard that reviewed revision separately;
// this is not a claim that modified content still equals upstream.
const content = readFileSync(new URL('../illustrated-src/game/spill-content.ts', import.meta.url), 'utf8').replaceAll('\r\n', '\n');
assert.equal(sha256(content), '10dc8a135b78424b711b0f493332eb1302f784753a384ae3dcf233c873c78a75',
  'shared content must retain the reviewed steering-description revision');

// New deterministic replay coverage, not frozen upstream behavior. Identical seeds
// and semantic input must reproduce the entire state including combat and RNG.
// No immunity, forced transition, spawning override or rendering dependency.
function replay(width, height, seed) {
  const state = Spill.createSpill(width, height, seed, 0, true, false);
  Spill.spillTap(state);
  for (let frame = 0; frame < 900; frame++) {
    if (frame % 90 === 0) Spill.spillSteer(state, [0, -.6, 0, .6][Math.floor(frame / 90) % 4]);
    if (frame === 240) Spill.spillLunge(state, -1);
    if (frame === 480) Spill.spillLunge(state, 1);
    Spill.stepSpill(state, 1 / 60);
  }
  assert(state.combat, 'combat stays enabled in the production replay');
  assert.equal(state.combat.firing, false);
  return JSON.stringify(state);
}
for (const [width, height, seed] of [[390, 760, 7], [1280, 720, 71], [320, 760, 305419896]]) {
  assert.equal(replay(width, height, seed), replay(width, height, seed),
    `seed ${seed} at ${width}x${height} must replay identically for 900 frames`);
  assert.notEqual(replay(width, height, seed), replay(width, height, seed + 1), 'the seed remains meaningful');
}
console.log('source guards: two upstream hashes and one reviewed content hash; three 900-frame steering replays passed');
