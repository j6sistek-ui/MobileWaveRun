import assert from 'node:assert/strict';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { createDom } from './helpers/dom.mjs';

const dom = createDom();
const { win, tick, touch } = dom;
const upstreamKeys = ['acornaut_illust_v1', 'acornaut_illust_beta', 'acornaut_beta', 'acornaut_v2'];
const upstreamSave = JSON.stringify({ spillBest: 99, acorns: 999999, tutorialDone: false });
for (const key of upstreamKeys) win.localStorage.setItem(key, upstreamSave);
const app = win.document.createElement('main');
app.id = 'app';
win.document.body.append(app);

// Use the real entry point, including the storage bridge installed before game imports.
await import('../dist/js/bootstrap.js');
for (let turn = 0; !win.__sandbox && turn < 100; turn++) await nextTurn();
const engine = win.__sandbox;
assert(engine, 'the real bootstrap must create the game');
const Spill = await import('../dist/js/spill.js');
const Save = await import('../dist/js/save.js');
function action(id) {
  const button = app.querySelector(`[data-action="${id}"]`);
  assert(button, `missing host action ${id}`);
  return button;
}
function control(id) {
  const button = app.querySelector(`[data-spill-control="${id}"]`);
  assert(button, `missing original Spill control ${id}`);
  return button;
}
function setting(id) {
  const button = app.querySelector(`[data-setting="${id}"]`);
  assert(button, `missing setting ${id}`);
  return button;
}
function isolated() {
  for (const key of upstreamKeys) assert.equal(win.localStorage.getItem(key), upstreamSave, `${key} stays untouched`);
  for (let index = 0; index < win.localStorage.length; index++) {
    const key = win.localStorage.key(index);
    assert(upstreamKeys.includes(key) || key.startsWith('mobilewaverun:'), `unexpected unscoped write: ${key}`);
  }
}

try {
  assert.equal(engine.save.spillBest, 0, 'fresh game ignores original Acornaut progress');
  assert(!engine.world.tut && !engine.world.race && !engine.world.lvl);
  assert(action('new-run'));
  const before = JSON.stringify(engine.world);
  for (const mode of ['fly', 'deep', 'lost', 'arcade', 'tunnel', 'hyper']) engine.fly(mode);
  assert.equal(engine.flyLevel('1-1'), false);
  engine.replayTutorial();
  engine.startFlightTest();
  assert.equal(JSON.stringify(engine.world), before, 'unrelated launch APIs cannot start other game modes');
  for (const mode of app.querySelectorAll('[data-mode]')) assert.equal(mode.dataset.mode, 'spill');
  isolated();

  action('settings').click();
  const musicWasOff = !!engine.save.musicOff;
  setting('music').focus();
  setting('music').click();
  assert.equal(engine.save.musicOff, !musicWasOff);
  assert.equal(Save.loadSave().musicOff, !musicWasOff, 'settings persist in the isolated save');
  assert.equal(win.document.activeElement, setting('music'), 'rerendering a setting retains keyboard focus');
  setting('music').click();
  setting('help').click();
  assert(setting('prompts').disabled, 'global help setting controls the instructional-prompt switch');
  setting('help').click();
  assert(!setting('prompts').disabled);
  action('home').click();
  action('controls').click();
  assert.equal(engine.world.screen, 'help');
  assert(!engine.world.spill, 'reading controls does not start a run');
  action('home').click();

  action('new-run').click();
  assert(engine.world.spill && !engine.world.tut, 'a new installation starts Spill without a different tutorial');
  assert(app.querySelector('.ac-spillsetup'), 'retain the original launch/controls sheet');
  control('land').click();
  assert.equal(engine.world.spill.phase, 'docking');
  tick(200);
  const first = engine.world.spill;
  assert.equal(first.phase, 'depot');
  assert.equal(first.wave, 0);
  assert.equal(first.depotVisits, 0);
  assert(first.freeUpgrade && control('launch').disabled);
  assert.equal(app.querySelectorAll('.ac-workshop-system').length, 4);
  control('inspect-thrusters').click();
  control('thrusters').click();
  assert.equal(first.up.thrusters, 1);
  assert.equal(first.ore, 0, 'the opening upgrade is free');
  assert.equal(first.freeUpgrade, false);
  control('launch').click();
  assert.equal(first.phase, 'countdown');
  tick(181);
  assert.equal(first.phase, 'wave');
  assert.equal(first.wave, 1);
  assert.deepEqual(first.up, { plating: 0, thrusters: 1, pulse: 0 });

  const joystick = app.querySelector('.ac-floating-stick');
  assert(joystick && joystick.hidden);
  assert.equal(app.querySelector('.ac-spillcontrols, .ac-thrust, .ac-fire'), null, 'fixed pads are removed');
  touch(engine.canvas, 'pointerdown', 11, 100, 300, false);
  touch(engine.canvas, 'pointermove', 11, 100, 250, false);
  assert.equal(first.steerY, -1, 'the first pointer steers even if isPrimary is false');
  tick();
  assert(!joystick.hidden);
  touch(win, 'pointerup', 99);
  assert.equal(first.steerY, -1, 'an unrelated release cannot steal steering');
  touch(win, 'pointerup', 11);
  assert.equal(first.steerY, 0);
  tick(); assert(joystick.hidden);
  action('pause').click();
  assert.equal(engine.world.screen, 'pause');
  const paused = JSON.stringify(first);
  tick(120);
  touch(engine.canvas, 'pointerdown', 21);
  touch(engine.canvas, 'pointermove', 21, 100, 220);
  touch(win, 'pointerup', 21);
  assert.equal(JSON.stringify(first), paused, 'pause freezes the run and rejects steering input');
  action('resume').click();
  assert.equal(engine.world.screen, 'play');
  assert(joystick.hidden, 'resume does not restore a released gesture');
  win.dispatchEvent(new win.KeyboardEvent('keydown', { code: 'KeyW', repeat: true }));
  assert.equal(first.steerY, 0, 'a stale held key cannot steer after resume');
  win.dispatchEvent(new win.Event('blur'));
  assert.equal(engine.world.screen, 'pause', 'losing focus pauses the game');
  action('resume').click();

  // Seed a Wave 5 clear only to exercise the host handoff. The preserved upstream rules test
  // advances real waves separately; this fixture does not claim a naturally survived run.
  first.wave = 5;
  first.spec = Spill.spillWaveSpec(5, first.seed);
  first.phase = 'drain';
  first.rocks = [];
  first.nuts = [];
  first.iframes = 9;
  first.floorT = 0;
  first.pilot.y = first.H * .45;
  tick();
  assert.equal(first.phase, 'docking');
  tick(Math.ceil((Spill.SPILL.dockTime + Spill.SPILL.depotArm + .2) * 60));
  assert.equal(first.phase, 'depot');
  assert.equal(first.cleared, 5);
  assert(!first.freeUpgrade, 'a later Depot does not regenerate the opening free choice');
  first.ore = 200;
  control('inspect-plating').click();
  control('plating').click();
  assert.equal(first.up.plating, 1);
  assert.equal(first.ore, 140, 'the first later plating upgrade keeps its original price');
  const build = structuredClone(first.up), ore = first.ore, rng = first.rng;
  control('save').click();
  assert.equal(engine.world.screen, 'title');
  assert.equal(engine.world.spill, null);
  const persisted = Save.loadSave().spillSuspended;
  assert(persisted && persisted.state.cleared === 5, 'Save & Quit persists a valid isolated checkpoint');
  action('new-run').click();
  assert(app.querySelector('[role="dialog"][aria-label="Replace saved run"]'));
  assert.equal(win.document.activeElement, action('cancel-new-run'), 'replace confirmation defaults to keeping the save');
  action('cancel-new-run').click();
  assert.deepEqual(Save.loadSave().spillSuspended, persisted, 'canceling a new run preserves the complete checkpoint');
  action('resume-run').click();
  tick(50);
  const resumed = engine.world.spill;
  assert(resumed && resumed.phase === 'depot');
  assert.deepEqual(resumed.up, build);
  assert.equal(resumed.ore, ore);
  assert.equal(resumed.rng, rng);
  control('launch').click();
  assert.equal(resumed.wave, 6);
  assert.equal(resumed.phase, 'countdown');
  assert.equal(Save.loadSave().spillSuspended, null, 'launch consumes the saved Depot checkpoint');

  resumed.phase = 'over';
  resumed.hull = 0;
  resumed.cause = 'impact';
  resumed.cues = ['dead'];
  tick();
  action('new-run').click();
  assert(app.querySelector('.ac-spillsetup'));
  assert.equal(engine.world.spill.hull, 3);
  assert.equal(engine.world.spill.ore, 0);
  assert.deepEqual(engine.world.spill.up, { plating: 0, thrusters: 0, pulse: 0 });
  isolated();
  console.log('host: real bootstrap, Spill-only entry, isolated saves, settings/focus, free starter, controls/pause, Wave 5 Depot, save/resume and restart passed');
} finally {
  engine.stop();
  await win.happyDOM.close();
}
