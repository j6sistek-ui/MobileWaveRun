import assert from 'node:assert/strict';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { createDom } from './helpers/dom.mjs';

// Production host flows. Flight Trials have no player-facing entry; the
// existing DOM harness engine starts isolated fixtures without a new runtime
// route or debug hook. Controlled transitions do not prove natural survival.
const dom = createDom();
const { win, tick } = dom;
const app = win.document.createElement('main'); app.id = 'app'; win.document.body.append(app);
await import('../dist/js/bootstrap.js');
for (let i = 0; !win.__sandbox && i < 100; i++) await nextTurn();
const engine = win.__sandbox;
assert(engine);
const Career = await import('../dist/js/spill-career.js');
const Save = await import('../dist/js/save.js');
const S = await import('../dist/js/spill.js');
const H = await import('../dist/js/spill-hazards.js');
const Risks = await import('../dist/js/spill-expeditions.js');
const node = (attribute, value) => {
  const found = app.querySelector(`[data-${attribute}="${value}"]`);
  assert(found, `missing ${attribute}: ${value}`); return found;
};
const action = id => node('action', id);
const control = id => node('spill-control', id);
const startTrialFixture = (id, build) => {
  assert.equal(engine.spillStartTrial(id, build), true, `isolated trial fixture: ${id}/${build}`);
  tick(60);
};
try {
  await engine.artReady;
  for (let i = 0; !app.querySelector('[data-action="new-run"]') && i < 100; i++) await nextTurn();
  assert.equal(app.querySelector('[data-action="trials"], .ac-trial-menu'), null,
    'the production menu has no Flight Trials entry or selector');
  action('ship').click();
  const career = app.querySelector('.ac-career-options');
  assert(career);
  for (const item of Career.SPILL_CHASSIS) {
    const button = node('career-choice', `chassis-${item.id}`);
    assert.equal(button.disabled, item.unlock > 0);
    assert(button.textContent.includes(item.detail));
  }
  assert.equal(node('career-choice', 'module-standard').getAttribute('aria-pressed'), 'true');
  action('home').click(); action('new-run').click(); control('land').click(); tick(200);
  control('plating').click(); control('save').click();
  assert.equal(engine.world.screen, 'title');
  const realSave = JSON.stringify(Save.loadSave());
  const checkpoint = JSON.stringify(engine.save.spillSuspended);
  startTrialFixture('flare', 'heavy');
  let state = engine.world.spill;
  assert.equal(engine.spillTrial().id, 'flare'); assert.equal(engine.spillTrial().build, 'heavy');
  assert.equal(state.phase, 'depot'); assert.equal(state.wave, 21);
  assert.match(app.textContent, /Trial loadout/); assert.match(app.textContent, /NO PROGRESS SAVED/);
  assert.equal(app.querySelector('[data-spill-control="save"]'), null);
  assert.equal(app.querySelector('[data-spill-control="route-options"]'), null,
    'a single encounter does not offer an impossible five-wave bonus');
  assert.equal(app.querySelectorAll('[data-spill-forecast-wave]').length, 1);
  assert.equal(node('career-choice', 'chassis-interceptor').disabled, false);
  node('career-choice', 'chassis-interceptor').click();
  assert.equal(state.loadout.chassis, 'interceptor');
  assert.match(app.querySelector('.ac-workshop-selection').textContent, /Max health 4 → 5/,
    'health upgrade text includes the selected chassis offset');
  assert.equal(JSON.stringify(engine.save.spillSuspended), checkpoint);
  control('end-trial').click();
  assert.equal(engine.spillTrial(), null); assert.equal(JSON.stringify(Save.loadSave()), realSave);
  startTrialFixture('mines', 'stock');
  state = engine.world.spill;
  const trialSeed = state.seed;
  control('launch').click(); tick(181);
  assert.equal(state.phase, 'wave'); assert.equal(state.wave, 7);
  assert.equal(app.querySelectorAll('.ac-playbar button').length, 1);
  assert.equal(app.querySelector('.ac-practice-badge').textContent, 'PRACTICE');
  assert.equal(app.querySelector('.ac-fire, .ac-thrust, .ac-spillcontrols'), null);
  action('pause').click(); assert.match(app.textContent, /PRACTICE PAUSED/);
  assert.equal(app.querySelector('[data-action="choose-trial"]'), null, 'pause does not expose a hidden selector');
  action('retry-trial').click(); tick(60);
  state = engine.world.spill;
  assert.equal(state.seed, trialSeed); assert.equal(state.wave, 6); assert.equal(state.phase, 'depot');
  control('launch').click(); tick(181);
  state.phase = 'over'; state.cause = 'MISSION COMPLETE'; state.cleared = 7;
  engine.open('play');
  assert.match(app.textContent, /TRIAL CLEARED/);
  assert(!app.textContent.includes('NEW BEST'));
  assert.equal(JSON.stringify(Save.loadSave()), realSave);
  assert.equal(app.querySelector('[data-action="choose-trial"]'), null, 'results do not expose a hidden selector');
  action('home').click();
  assert.equal(engine.spillTrial(), null); assert.equal(JSON.stringify(Save.loadSave()), realSave);
  startTrialFixture('volatile', 'heavy');
  state = engine.world.spill;
  assert.equal(state.wave, 5); assert.equal(state.target, 10);
  assert.equal(app.querySelectorAll('[data-spill-forecast-wave]').length, 5);
  assert.equal(control('risk-volatile').getAttribute('aria-pressed'), 'true');
  control('risk-bounty').click(); assert.equal(state.expedition.selected, 'bounty');
  node('career-choice', 'module-focus').click();
  assert.equal(state.loadout.module, 'focus', 'all sidegrades are available before a route trial');
  control('end-trial').click();
  assert.equal(JSON.stringify(Save.loadSave()), realSave);
  assert.equal(app.querySelector('[data-action="trials"], .ac-trial-menu'), null);
  assert.equal(engine.spillTrial(), null); assert.equal(JSON.stringify(Save.loadSave()), realSave);
  action('resume-run').click(); tick(60);
  state = engine.world.spill;
  assert.equal(state.wave, 0); assert.equal(state.up.plating, 1, 'the original checkpoint survived every trial action');
  control('launch').click(); tick(181);

  // Author an earned milestone through the actual Depot handoff.
  state.wave = 5; state.spec = S.spillWaveSpec(5, state.seed); state.phase = 'drain';
  state.rocks = []; state.nuts = []; state.combat.enemies = []; state.combat.shots = [];
  H.clearSpillHazards(state); state.iframes = 99;
  tick(); tick(Math.ceil((S.SPILL.dockTime + S.SPILL.depotArm + .2) * 60));
  assert.equal(state.phase, 'depot');
  const routes = control('route-options');
  assert.equal(routes.open, false, 'optional risks do not bury basic purchases');
  const money = state.ore;
  for (const id of Object.keys(Risks.SPILL_RISKS)) {
    const option = control(`risk-${id}`);
    assert(option.textContent.includes(Risks.SPILL_RISKS[id].detail));
    option.click();
    assert.equal(state.expedition.selected, id);
    assert.equal(state.ore, money, 'route selection never pays a bonus early');
  }
  control('risk-volatile').click();
  assert.equal(control('risk-volatile').getAttribute('aria-pressed'), 'true');
  const scrolling = new win.Event('touchmove', { bubbles: true, cancelable: true });
  control('route-options').dispatchEvent(scrolling);
  assert.equal(scrolling.defaultPrevented, false);
  control('save').click(); action('resume-run').click(); tick(60);
  assert.equal(engine.world.spill.expedition.selected, 'volatile');
  assert.equal(control('risk-volatile').getAttribute('aria-pressed'), 'true');
  console.log('evaluation host: hidden trial entry, isolated trial builds/retry/result/save protection, earned choices, sole flight pause and opt-in route persistence passed');
} finally {
  engine.stop(); await win.happyDOM.close();
}
