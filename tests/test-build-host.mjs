import assert from 'node:assert/strict';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { createDom } from './helpers/dom.mjs';

// Actual bootstrap, Depot controls and persistence. Milestone fixtures exercise
// host transitions; they are not evidence of naturally surviving fifteen waves.
const dom = createDom({ holdImages: true });
const { win, tick, touch } = dom;
const app = win.document.createElement('main');
app.id = 'app'; win.document.body.append(app);
await import('../dist/js/bootstrap.js');
for (let turn = 0; !win.__sandbox && turn < 100; turn++) await nextTurn();
const engine = win.__sandbox;
assert(engine, 'real bootstrap creates the engine');
const Spill = await import('../dist/js/spill.js');
const Save = await import('../dist/js/save.js');
const Builds = await import('../dist/js/spill-builds.js');
const control = id => {
  const button = app.querySelector(`[data-spill-control="${id}"]`);
  assert(button, `missing Depot control ${id}`); return button;
};
const action = id => {
  const button = app.querySelector(`[data-action="${id}"]`);
  assert(button, `missing host action ${id}`); return button;
};
const claimIds = () => [...app.querySelectorAll('[data-spill-control^="artifact-claim-"]')]
  .map(button => button.dataset.spillControl.slice('artifact-claim-'.length));
const storedBuild = () => Save.loadSave().spillSuspended.state.combat.build;
const reachDepot = (state, wave) => {
  state.wave = wave; state.spec = Spill.spillWaveSpec(wave, state.seed);
  state.phase = 'drain'; state.rocks = []; state.nuts = [];
  state.combat.enemies = []; state.combat.shots = [];
  state.pilot.y = state.H * .45; state.pilot.vx = state.pilot.vy = 0;
  state.iframes = 9; state.floorT = 0;
  tick(); assert.equal(state.phase, 'docking');
  tick(Math.ceil((Spill.SPILL.dockTime + Spill.SPILL.depotArm + .2) * 60));
  assert.equal(state.phase, 'depot'); assert.equal(state.cleared, wave);
};

try {
  assert.equal(engine.spillClaimArtifact('reclaimer'), false, 'loading cannot claim an artifact');
  assert.equal(engine.spillEquipArtifact(null), false);
  dom.releaseImages(); await engine.artReady;
  for (let turn = 0; !app.querySelector('[data-action="new-run"]') && turn < 100; turn++) await nextTurn();
  action('new-run').click(); control('land').click(); tick(200);
  let state = engine.world.spill;
  assert.equal(state.phase, 'depot'); assert(state.freeUpgrade);
  assert.equal(state.combat.build.artifact, null);
  assert.deepEqual(state.combat.build.owned, []);
  assert.deepEqual(claimIds(), [], 'opening Depot cannot grant milestone rewards');
  const recipes = app.querySelector('.ac-build-recipes');
  assert(recipes && !recipes.open, 'build planning stays collapsed beside the opening decisions');
  assert.equal(recipes.querySelectorAll('button').length, 0, 'build suggestions never bundle purchases');
  assert.equal(engine.spillClaimArtifact('reclaimer'), false);
  assert.equal(engine.spillEquipArtifact('siege'), false, 'unowned artifacts cannot be fitted');
  control('weapon-cannon').click();
  assert.equal(state.combat.weapon, 'cannon');
  assert(state.freeUpgrade, 'weapon choice preserves the separate free system');
  control('inspect-thrusters').click(); control('thrusters').click();
  assert.equal(state.ore, 0); assert.equal(state.up.thrusters, 1);
  assert.equal(state.freeUpgrade, false);
  control('launch').click(); tick(181);
  assert.equal(state.phase, 'wave');
  assert.equal(app.querySelector('.ac-fire, .ac-thrust, .ac-spillcontrols'), null,
    'builds introduce no fixed flight buttons');

  reachDepot(state, 5);
  const offers = Builds.spillArtifactOffers(state);
  assert.equal(offers.length, 2);
  assert.deepEqual(claimIds(), offers, 'UI exposes precisely the available recovery choices');
  const ore = state.ore, rng = state.rng, combatRng = state.combat.rng;
  control('save').click(); action('resume-run').click(); tick(50);
  state = engine.world.spill;
  assert.deepEqual(Builds.spillArtifactOffers(state), offers, 'resuming cannot reroll the offered artifacts');
  assert.deepEqual(claimIds(), offers);
  assert.equal(state.rng, rng); assert.equal(state.combat.rng, combatRng);

  const first = offers.includes('slipstream') ? 'slipstream' : offers[0];
  const rejected = offers.find(id => id !== first);
  state.depot.arm = 1;
  assert.equal(engine.spillClaimArtifact(first), false, 'arrival arming guard applies to recovery');
  assert.equal(engine.spillEquipArtifact(null), false, 'arrival arming guard applies to refitting');
  tick(65);
  assert.equal(control(`artifact-claim-${first}`).disabled, false, 'recovery unlocks when arrival arming ends');
  control(`artifact-claim-${first}`).click();
  assert.equal(state.combat.build.artifact, first);
  assert.deepEqual(state.combat.build.owned, [first]);
  assert.deepEqual(state.combat.build.claimedWaves, [5]);
  assert.equal(state.ore, ore, 'recovery never consumes run coins');
  assert.equal(state.combat.weapon, 'cannon', 'artifact recovery never replaces the selected weapon');
  assert.deepEqual(state.up, { plating: 0, thrusters: 1, pulse: 0 }, 'recipes never auto-purchase systems');
  assert.deepEqual(storedBuild().owned, [first], 'successful recovery checkpoints immediately');
  assert.equal(storedBuild().artifact, first);
  assert.equal(engine.spillClaimArtifact(rejected), false, 'one recovery per milestone');
  assert.deepEqual(claimIds(), []);
  assert(app.textContent.includes(Builds.SPILL_ARTIFACTS[first].name));

  const scroller = app.querySelector('.ac-depotcard');
  scroller.scrollTop = 220;
  const scrollTouch = new win.Event('touchmove', { bubbles: true, cancelable: true });
  scroller.dispatchEvent(scrollTouch);
  assert(!scrollTouch.defaultPrevented, 'artifact options do not steal Depot touch scrolling');
  control('artifact-remove').click();
  assert.equal(state.combat.build.artifact, null);
  assert.deepEqual(state.combat.build.owned, [first], 'removing an artifact keeps run ownership');
  assert.equal(storedBuild().artifact, null);
  assert.equal(app.querySelector('.ac-depotcard').scrollTop, 220, 'refitting preserves Depot scroll position');
  control(`artifact-equip-${first}`).click();
  assert.equal(state.combat.build.artifact, first);
  assert.equal(state.ore, ore);
  control('save').click(); action('resume-run').click(); tick(50);
  state = engine.world.spill;
  assert.equal(state.combat.build.artifact, first);
  assert.deepEqual(state.combat.build.owned, [first]);
  assert.deepEqual(state.combat.build.claimedWaves, [5]);
  assert.deepEqual(claimIds(), [], 'reload does not reopen an already claimed recovery');
  assert.equal(state.combat.build.echo, 0);
  assert.equal(state.combat.build.blasts.length, 0);

  control('launch').click(); tick(181);
  assert.equal(state.phase, 'wave'); assert.equal(state.wave, 6);
  assert.equal(engine.spillEquipArtifact(null), false, 'equipment cannot be changed while flying');
  assert.equal(engine.spillClaimArtifact(rejected), false);
  touch(engine.canvas, 'pointerdown', 1, 100, 250);
  touch(engine.canvas, 'pointermove', 1, 100, 210);
  touch(engine.canvas, 'pointerdown', 2, 330, 600, false);
  assert(state.combat.firing); assert(state.steerY < 0);
  dom.setSize(844, 390); engine.resize();
  assert.equal(engine.world.screen, 'pause');
  assert.equal(state.steerY, 0); assert.equal(state.combat.firing, false);
  assert.equal(state.combat.build.artifact, first, 'rotation keeps the equipped build');
  assert(app.textContent.includes(Builds.SPILL_ARTIFACTS[first].name), 'pause names the current artifact');
  action('resume').click();
  touch(engine.canvas, 'pointerdown', 3, 100, 210);
  touch(engine.canvas, 'pointermove', 3, 100, 250);
  assert(state.steerY > 0, 'fresh input works after rotating with an artifact fitted');
  touch(win, 'pointerup', 3);

  reachDepot(state, 15);
  const secondOffers = Builds.spillArtifactOffers(state);
  assert.equal(secondOffers.length, 2);
  assert(!secondOffers.includes(first));
  assert.deepEqual(claimIds(), secondOffers);
  const second = secondOffers[0], beforeRefit = state.ore;
  control(`artifact-claim-${second}`).click();
  assert.equal(state.combat.build.artifact, second);
  assert.deepEqual(state.combat.build.owned, [first, second]);
  assert.deepEqual(state.combat.build.claimedWaves, [5, 15]);
  control(`artifact-equip-${first}`).click();
  assert.equal(state.combat.build.artifact, first);
  assert.equal(storedBuild().artifact, first);
  assert.equal(state.ore, beforeRefit, 'switching between owned artifacts costs nothing');
  assert.equal(state.combat.build.owned.length, 2);

  control('launch').click(); tick(181);
  state.phase = 'over'; state.hull = 0; state.cause = 'impact'; state.cues = ['dead']; tick();
  assert(app.textContent.includes(Builds.SPILL_ARTIFACTS[first].name), 'results name the final build');
  action('new-run').click();
  assert.equal(engine.world.spill.combat.build.artifact, null);
  assert.deepEqual(engine.world.spill.combat.build.owned, [], 'new runs do not retain artifact power');
  console.log('build host: opening boundaries, milestone choices, arming, immediate checkpoints, stable offers, refit/remove, scroll, rotation, summaries and fresh-run reset passed');
} finally {
  engine.stop();
  await win.happyDOM.close();
}
