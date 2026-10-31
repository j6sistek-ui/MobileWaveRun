import assert from 'node:assert/strict';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { createDom } from './helpers/dom.mjs';

// DOM integration, not a natural fifteen-wave completion or physical rotation test.
const dom = createDom();
const { win, tick, touch } = dom;
const app = win.document.createElement('main');
app.id = 'app'; win.document.body.append(app);
await import('../dist/js/bootstrap.js');
for (let turn = 0; !win.__sandbox && turn < 100; turn++) await nextTurn();
const engine = win.__sandbox;
assert(engine);
const S = await import('../dist/js/spill.js');
const H = await import('../dist/js/spill-hazards.js');
const Save = await import('../dist/js/save.js');
const action = id => {
  const node = app.querySelector(`[data-action="${id}"]`);
  assert(node, `missing action ${id}`); return node;
};
const control = id => {
  const node = app.querySelector(`[data-spill-control="${id}"]`);
  assert(node, `missing control ${id}`); return node;
};
const near = (a, b, note) => assert(Math.abs(a - b) < 1e-7, `${note}: ${a} vs ${b}`);
function forecast(s) {
  const section = app.querySelector('.ac-hazard-forecast');
  assert(section, 'Depot presents an optional next-block forecast');
  assert.match(section.textContent, /Next five waves/);
  assert.equal(section.querySelectorAll('button').length, 0, 'forecast introduces no purchase or flight action');
  const rows = [...section.querySelectorAll('[data-spill-forecast-wave]')];
  assert.equal(rows.length, 5);
  assert.deepEqual(rows.map(row => Number(row.dataset.spillForecastWave)), [1, 2, 3, 4, 5].map(n => s.wave + n));
  for (const row of rows) {
    const wave = Number(row.dataset.spillForecastWave);
    assert(row.textContent.includes(`Wave ${wave}`));
    const plan = H.spillHazardPlan(wave, s.seed);
    for (const kind of plan.families) assert(row.textContent.includes(H.SPILL_HAZARDS[kind].name), `${kind} is forecast from authority`);
    for (const kind of H.SPILL_HAZARD_IDS.filter(kind => !plan.families.includes(kind))) {
      assert(!row.textContent.includes(H.SPILL_HAZARDS[kind].name), `${kind} is not falsely forecast`);
    }
  }
  return section.textContent;
}

try {
  await engine.artReady;
  for (let turn = 0; !app.querySelector('[data-action="new-run"]') && turn < 100; turn++) await nextTurn();
  action('settings').click();
  action('control-guide').click();
  assert(action('control-guide').closest('details').open);
  const guide = app.querySelector('.ac-hazard-guide');
  assert(guide, 'controls help includes environmental counterplay');
  for (const kind of H.SPILL_HAZARD_IDS) {
    assert(guide.textContent.includes(H.SPILL_HAZARDS[kind].name));
    assert(guide.textContent.includes(H.SPILL_HAZARDS[kind].teach));
  }
  assert.equal(guide.querySelectorAll('button').length, 0);
  action('home').click(); action('new-run').click(); control('land').click(); tick(200);
  let s = engine.world.spill;
  const starterForecast = forecast(s);
  assert(!app.querySelector('.ac-hazard-forecast').open, 'forecast begins collapsed to keep the opening choice readable');
  const free = s.freeUpgrade, ore = s.ore, rng = s.rng, hazardRng = s.hazards.rng;
  const details = app.querySelector('.ac-hazard-forecast');
  details.open = true; details.dispatchEvent(new win.Event('toggle'));
  control('inspect-thrusters').click();
  assert(app.querySelector('.ac-hazard-forecast').open, 'forecast expansion survives an unrelated Depot redraw');
  assert.equal(forecast(s), starterForecast);
  assert.equal(s.freeUpgrade, free); assert.equal(s.ore, ore);
  assert.equal(s.rng, rng); assert.equal(s.hazards.rng, hazardRng, 'reading the forecast cannot consume the director RNG');
  control('thrusters').click(); control('launch').click(); tick(181);
  assert.equal(s.phase, 'wave');
  assert.equal(app.querySelectorAll('.ac-playbar button').length, 1, 'Pause remains the sole fixed flight button');
  assert.equal(app.querySelector('.ac-fire, .ac-thrust, .ac-spillcontrols'), null);

  // Reach a milestone through the real engine handoff using controlled geometry.
  s.wave = 15; s.spec = S.spillWaveSpec(15, s.seed); s.phase = 'drain';
  s.rocks = []; s.nuts = []; s.combat.enemies = []; s.combat.shots = [];
  H.clearSpillHazards(s);
  s.pilot.y = s.H * .45; s.pilot.vx = s.pilot.vy = 0; s.iframes = 9; s.floorT = 0;
  tick(); assert.equal(s.phase, 'docking');
  tick(Math.ceil((S.SPILL.dockTime + S.SPILL.depotArm + .2) * 60));
  assert.equal(s.phase, 'depot'); assert.equal(s.cleared, 15);
  const laterForecast = forecast(s);
  const scroll = new win.Event('touchmove', { bubbles: true, cancelable: true });
  app.querySelector('.ac-hazard-forecast').dispatchEvent(scroll);
  assert(!scroll.defaultPrevented, 'forecast keeps touch scrolling in the Depot');
  const savedSeed = s.seed, savedHazardRng = s.hazards.rng;
  control('save').click();
  assert.equal(engine.world.screen, 'title');
  assert.deepEqual(Save.loadSave().spillSuspended.state.hazards.actors, [], 'live hazards never enter a checkpoint');
  action('resume-run').click(); tick(50);
  s = engine.world.spill;
  assert.equal(s.seed, savedSeed); assert.equal(s.hazards.rng, savedHazardRng);
  assert.equal(forecast(s), laterForecast, 'saved-run resume preserves the same forecast');

  // A real pre-Phase3 checkpoint lacks the nested hazard object entirely.
  control('save').click();
  delete engine.save.spillSuspended.state.hazards;
  Save.writeSave(engine.save);
  action('resume-run').click(); tick(50);
  s = engine.world.spill;
  assert.equal(s.phase, 'depot'); assert.equal(s.wave, 15);
  assert.equal(forecast(s), laterForecast);
  assert.deepEqual(s.hazards.actors, [], 'legacy saves migrate without live threats');

  control('launch').click(); tick(181);
  assert.equal(s.wave, 16); assert.equal(s.phase, 'wave');
  s.nextRock = s.nextNut = s.nextSpecial = 1000; s.combat.nextEnemy = 1000;
  s.event = 'none'; s.eventWarn = 0; s.surgeT = 0; s.waveT = 5;
  s.hazards.next = 0; H.admitSpillHazards(s, 1 / 60);
  assert.equal(s.hazards.actors.length, 1);
  const h = s.hazards.actors[0], original = structuredClone(h);
  const progress = { wave: s.wave, waveT: s.waveT, rng: s.hazards.rng, hull: s.hull };
  touch(engine.canvas, 'pointerdown', 1, 100, 300);
  touch(engine.canvas, 'pointermove', 1, 100, 250);
  touch(engine.canvas, 'pointerdown', 2, 330, 600, false);
  dom.setSize(844, 390); engine.resize();
  assert.equal(engine.world.screen, 'pause'); assert.equal(engine.world.spill, s);
  assert.equal(s.steerY, 0); assert.equal(s.combat.firing, false);
  assert.deepEqual({ wave: s.wave, waveT: s.waveT, rng: s.hazards.rng, hull: s.hull }, progress);
  near(h.x, original.x * 844 / 390, 'hazard x scales with landscape');
  near(h.y, original.y * 390 / 760, 'hazard y scales with landscape');
  near(h.aimX, original.aimX * 844 / 390, 'frozen aim x scales');
  near(h.aimY, original.aimY * 390 / 760, 'frozen aim y scales');
  assert.equal(h.warn, original.warn, 'rotating never consumes a warning');
  const paused = JSON.stringify(s.hazards); tick(90);
  assert.equal(JSON.stringify(s.hazards), paused, 'pause freezes hazards and their director');
  dom.setSize(390, 760); engine.resize();
  near(h.x, original.x, 'round-trip x'); near(h.y, original.y, 'round-trip y');
  near(h.aimX, original.aimX, 'round-trip warning x'); near(h.aimY, original.aimY, 'round-trip warning y');
  action('resume').click();
  touch(engine.canvas, 'pointermove', 1, 100, 200);
  assert.equal(s.steerY, 0, 'stale contact cannot retake control');
  touch(engine.canvas, 'pointerdown', 3, 100, 300);
  touch(engine.canvas, 'pointermove', 3, 100, 250);
  assert.equal(s.steerY, -1, 'fresh control resumes while the warning remains visible');
  touch(win, 'pointerup', 3);
  console.log('hazard host: shared five-wave forecast, help, unchanged controls, Depot scroll, save/legacy resume and paused rotation passed');
} finally {
  engine.stop(); await win.happyDOM.close();
}
