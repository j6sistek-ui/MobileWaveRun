import assert from 'node:assert/strict';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { createDom } from './helpers/dom.mjs';

// Leave image requests unresolved until the keyboard path has been exercised.
// This models a slow initial load without a network or a real browser dependency.
const dom = createDom({ holdImages: true });
const { win } = dom;
const app = win.document.createElement('main');
app.id = 'app';
win.document.body.append(app);
await import('../dist/js/bootstrap.js');
for (let turn = 0; !win.__sandbox && turn < 100; turn++) await nextTurn();
const engine = win.__sandbox;
assert(engine, 'bootstrap exposes the engine before deferred art completes');
try {
  assert(!engine.art?.ready, 'the fixture holds the actual initial art load');
  assert.match(app.textContent, /Loading the ship and field/);
  const Spill = await import('../dist/js/spill.js');
  const fixture = Spill.createSpill(390, 760, 7);
  Spill.spillTap(fixture);
  for (let frame = 0; fixture.phase !== 'depot' && frame < 300; frame++) Spill.stepSpill(fixture, 1 / 60);
  const checkpoint = Spill.spillCheckpoint(fixture);
  assert(checkpoint && Spill.restoreSpill(checkpoint, 390, 760), 'resume fixture is a valid checkpoint');
  engine.save.spillSuspended = checkpoint;
  assert.equal(engine.spillResume(), false, 'direct resume also waits for initial art');
  engine.fly('spill');
  assert.equal(engine.world.screen, 'title', 'direct launch also waits for initial art');
  assert.deepEqual(engine.save.spillSuspended, checkpoint, 'early launch and resume preserve the saved checkpoint');
  engine.save.spillSuspended = null;
  for (const code of ['Space', 'ArrowUp']) {
    win.dispatchEvent(new win.KeyboardEvent('keydown', { code, key: code === 'Space' ? ' ' : code, bubbles: true }));
    win.dispatchEvent(new win.KeyboardEvent('keyup', { code, bubbles: true }));
  }
  assert.equal(engine.world.screen, 'title', 'an early key cannot enter play behind the loading sheet');
  assert.equal(engine.world.spill, null, 'no run or checkpoint is created before art is usable');
  assert(!app.querySelector('[data-spill-control="land"]'));
  dom.releaseImages();
  for (let turn = 0; !app.querySelector('[data-action="new-run"]') && turn < 100; turn++) await nextTurn();
  assert(engine.art?.ready, 'the original loader completes after release');
  assert(app.querySelector('[data-action="new-run"]'), 'loading ends at the title');
  win.dispatchEvent(new win.KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true }));
  assert.equal(engine.world.screen, 'play', 'a fresh key after startup launches normally');
  assert.equal(engine.world.spill?.phase, 'ready');
  assert(app.querySelector('[data-spill-control="land"]'));
  console.log('startup: delayed art blocks early launch keys, then permits a fresh launch after loading');
} finally {
  dom.releaseImages();
  engine.stop();
  await win.happyDOM.close();
}
