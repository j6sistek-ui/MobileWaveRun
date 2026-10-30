import assert from 'node:assert/strict';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { createDom } from './helpers/dom.mjs';

// Real host/input/resize integration. DOM dimensions are controlled here;
// browser layout, notch placement and physical rotation are separate checks.
const dom = createDom();
const { win, tick, touch } = dom;
Object.defineProperty(win, 'devicePixelRatio', { value: 2, configurable: true });
const app = win.document.createElement('main');
app.id = 'app'; win.document.body.append(app);
await import('../dist/js/bootstrap.js');
for (let turn = 0; !win.__sandbox && turn < 100; turn++) await nextTurn();
const engine = win.__sandbox;
assert(engine, 'bootstrap creates the real engine');
const Spill = await import('../dist/js/spill.js');
const action = id => {
  const node = app.querySelector(`[data-action="${id}"]`);
  assert(node, `missing action ${id}`); return node;
};
const control = id => {
  const node = app.querySelector(`[data-spill-control="${id}"]`);
  assert(node, `missing control ${id}`); return node;
};
const key = (type, code, repeat = false) => win.dispatchEvent(new win.KeyboardEvent(type,
  { code, repeat, bubbles: true, cancelable: true }));
const near = (actual, expected, message) => assert(Math.abs(actual - expected) < 1e-8, `${message}: ${actual} != ${expected}`);
const size = (W, H) => {
  assert.deepEqual([engine.world.W, engine.world.H], [W, H]);
  assert.deepEqual([engine.world.spill.W, engine.world.spill.H], [W, H]);
  assert.deepEqual([engine.canvas.width, engine.canvas.height], [W * 2, H * 2], 'backing pixels follow DPR without changing gameplay units');
  assert.equal(engine.canvas.style.width, `${W}px`);
  assert.equal(engine.canvas.style.height, `${H}px`);
};

try {
  for (let turn = 0; !app.querySelector('[data-action="new-run"]') && turn < 100; turn++) await nextTurn();
  action('new-run').click(); control('land').click(); tick(200);
  control('inspect-thrusters').click(); control('thrusters').click(); control('launch').click(); tick(181);
  const state = engine.world.spill;
  assert.equal(state.phase, 'wave'); size(390, 760);
  // Controlled actors isolate rotation geometry from admission/collision randomness.
  state.wave = 2; state.spec = Spill.spillWaveSpec(2, state.seed);
  state.ore = 37; state.score = 919; state.shield = 1;
  state.nextRock = state.nextNut = state.nextSpecial = 1000; state.combat.nextEnemy = 1000;
  state.pilot.x = 110; state.pilot.y = 320; state.iframes = 10;
  state.rocks = [{ x: 350, y: 80, vx: -40, vy: 2, r: 15, kind: 'shard', sprite: 0,
    spin: .1, rot: 0, arc: 4, arcPhase: 0, warn: 0, grazed: false, dead: false }];
  state.nuts = [{ x: 300, y: 640, vx: -20, vy: 2, kind: 'ore', bob: 0, got: false }];
  state.combat.enemies = [{ id: 11, kind: 'pursuer', x: 330, y: 580, vx: -20, vy: 1,
    r: 18, hp: 4, maxHp: 4, age: 1, life: 8, cooldown: 9, telegraph: .8, telegraphTotal: .9,
    aimX: 110, aimY: 320, shotSpeed: 200, homeY: 580, side: 1, hitFlash: 0, dead: false }];
  state.combat.shots = [{ id: 12, team: 'enemy', weapon: 'laser', x: 280, y: 500,
    vx: -100, vy: -20, r: 5, damage: 1, life: 2, dead: false }];
  state.combat.nextId = 13;
  const progression = () => JSON.stringify({ seed: state.seed, rng: state.rng, wave: state.wave,
    phase: state.phase, phaseT: state.phaseT, waveT: state.waveT, hull: state.hull, shield: state.shield,
    ore: state.ore, score: state.score, up: state.up, levels: state.combat.levels, kills: state.combat.kills });
  const before = progression(), geometry = structuredClone({ pilot: state.pilot, rock: state.rocks[0],
    nut: state.nuts[0], enemy: state.combat.enemies[0], shot: state.combat.shots[0] });
  touch(engine.canvas, 'pointerdown', 1, 90, 300, false);
  touch(engine.canvas, 'pointermove', 1, 90, 250, false);
  touch(engine.canvas, 'pointerdown', 2, 340, 680, false);
  key('keydown', 'KeyW'); key('keydown', 'KeyF');
  assert.equal(state.steerY, -1); assert(state.combat.firing && state.combat.pendingFire > 0);

  // Transient zero/nonfinite measurements must not blank the canvas or cancel controls.
  for (const [W, H] of [[0, 0], [844, 0], [NaN, 390], [844, Infinity]]) {
    dom.setSize(W, H); engine.resize();
    size(390, 760);
    assert.equal(engine.world.screen, 'play'); assert.equal(state.steerY, -1);
    assert(engine.spillControls().active && state.combat.firing);
  }

  dom.setSize(844, 390); engine.resize();
  assert.equal(engine.world.spill, state, 'rotation keeps the existing run object');
  size(844, 390); assert.equal(engine.world.screen, 'pause');
  assert.equal(progression(), before, 'rotation changes neither progress nor simulation time');
  assert.equal(state.steerY, 0); assert.equal(state.pilot.vx, 0); assert.equal(state.pilot.vy, 0);
  assert.equal(state.combat.firing, false); assert.equal(state.combat.pendingFire, 0);
  assert.equal(engine.spillControls().active, false);
  assert(app.querySelector('.ac-floating-stick').hidden);
  for (const [item, original] of [[state.pilot, geometry.pilot], [state.rocks[0], geometry.rock],
    [state.nuts[0], geometry.nut], [state.combat.enemies[0], geometry.enemy], [state.combat.shots[0], geometry.shot]]) {
    near(item.x, original.x * 844 / 390, 'horizontal position scales to landscape');
    near(item.y, original.y * 390 / 760, 'vertical position scales to landscape');
  }
  near(state.rocks[0].arc, geometry.rock.arc * 390 / 760, 'debris weave scales');
  near(state.combat.enemies[0].aimY, geometry.enemy.aimY * 390 / 760, 'frozen warning aim scales');
  near(state.combat.shots[0].vx, geometry.shot.vx * 844 / 390, 'shot travel time survives width change');
  const paused = JSON.stringify(state);
  engine.resize(); tick(30);
  assert.equal(JSON.stringify(state), paused, 'duplicate resize and paused frames do not advance the run');
  touch(engine.canvas, 'pointermove', 1, 90, 200, false);
  key('keydown', 'KeyW', true); key('keydown', 'KeyF', true);
  assert.equal(JSON.stringify(state), paused, 'old pointer motion and key repeats stay cancelled');

  // Return to portrait while paused: no restart, drift or cumulative geometry loss.
  dom.setSize(390, 760); engine.resize(); size(390, 760);
  assert.equal(engine.world.spill, state); assert.equal(progression(), before);
  for (const [item, original] of [[state.pilot, geometry.pilot], [state.rocks[0], geometry.rock],
    [state.nuts[0], geometry.nut], [state.combat.enemies[0], geometry.enemy], [state.combat.shots[0], geometry.shot]]) {
    near(item.x, original.x, 'round-trip x'); near(item.y, original.y, 'round-trip y');
  }

  dom.setSize(844, 390); engine.resize(); action('resume').click();
  touch(engine.canvas, 'pointermove', 1, 90, 200, false);
  key('keydown', 'KeyW', true); key('keydown', 'KeyF', true);
  assert.equal(state.steerY, 0); assert.equal(state.combat.firing, false);
  touch(win, 'pointerup', 1); touch(win, 'pointerup', 2); key('keyup', 'KeyW'); key('keyup', 'KeyF');
  touch(engine.canvas, 'pointerdown', 3, 160, 240, false);
  assert.equal(state.steerY, 0, 'new landscape contact begins neutral');
  touch(engine.canvas, 'pointermove', 3, 160, 216, false);
  assert.equal(state.steerY, -.5, '24 CSS pixels has the same analog response after rotation');
  tick();
  const stick = app.querySelector('.ac-floating-stick');
  near(parseFloat(stick.style.left), 160 / 844 * 100, 'stick origin uses landscape width');
  near(parseFloat(stick.style.top), 240 / 390 * 100, 'stick origin uses landscape height');
  touch(win, 'pointerup', 3); assert.equal(state.steerY, 0);

  // Browser-chrome height changes go through the installed resize listener.
  const sameRun = engine.world.spill;
  dom.setSize(844, 350); win.dispatchEvent(new win.Event('resize')); tick(3);
  size(844, 350); assert.equal(engine.world.spill, sameRun); assert.equal(engine.world.screen, 'pause');
  assert.equal(state.steerY, 0); assert.equal(state.combat.firing, false);
  action('resume').click(); tick();
  assert.equal(engine.world.screen, 'play'); assert.equal(state.wave, 2); assert.equal(state.ore, 37);
  assert.deepEqual(state.up, { plating: 0, thrusters: 1, pulse: 0 });

  // A browser can report the same settled size through several event sources.
  // Coalesce the callbacks and retain the bitmap/control owner when it did not change.
  let resizeCalls = 0, backingWrites = 0;
  const resize = engine.resize;
  engine.resize = () => { resizeCalls++; resize(); };
  for (const property of ['width', 'height']) {
    const descriptor = Object.getOwnPropertyDescriptor(win.HTMLCanvasElement.prototype, property);
    assert(descriptor?.get && descriptor?.set);
    Object.defineProperty(engine.canvas, property, { configurable: true,
      get() { return descriptor.get.call(this); },
      set(value) { backingWrites++; descriptor.set.call(this, value); } });
  }
  touch(engine.canvas, 'pointerdown', 4, 160, 240, false);
  touch(engine.canvas, 'pointermove', 4, 160, 216, false);
  for (const type of ['resize', 'orientationchange', 'resize']) win.dispatchEvent(new win.Event(type));
  assert.equal(resizeCalls, 0, 'viewport notifications wait for the next animation frame');
  tick(2);
  assert.equal(resizeCalls, 1, 'a burst of viewport notifications uses one stage measurement');
  assert.equal(backingWrites, 0, 'same-size notifications do not clear the canvas bitmap');
  assert.equal(engine.world.screen, 'play'); assert.equal(state.steerY, -.5);
  assert(engine.spillControls().active, 'same-size notification preserves the current steering finger');
  touch(win, 'pointerup', 4);
  engine.resize = resize;
  console.log('landscape: portrait/landscape round trip, DPR, same-run progress, geometry, invalid size guards, stale input, fresh CSS-pixel steering, height-only resize and coalesced same-size notifications passed');
} finally {
  engine.stop();
  await win.happyDOM.close();
}
