import assert from 'node:assert/strict';
import { createDom } from './helpers/dom.mjs';

const dom = createDom();
const { win, tick } = dom;
const boards = [];
win.__acornautPlatform = { boards: { submit: (...args) => boards.push(args) } };
const { createEngine } = await import('../dist/js/engine.js');
const S = await import('../dist/js/spill.js');
const Save = await import('../dist/js/save.js');
const { platform } = await import('../dist/js/platform.js');
const { SAVE_KEY } = await import('../dist/js/catalog.js');
const canvas = win.document.createElement('canvas'); win.document.body.append(canvas);
const engine = await createEngine(canvas); await engine.artReady; engine.start();
const persisted = () => platform.storage.get(SAVE_KEY);
function clearWave(s) {
  s.phase = 'drain'; s.rocks = []; s.nuts = []; s.combat.enemies = []; s.combat.shots = []; s.hazards.actors = [];
  s.pilot.vx = s.pilot.vy = 0; s.iframes = 1;
  tick(2);
}
try {
  engine.open('hangar');
  assert.equal(engine.spillSelectChassis('interceptor'), false);
  assert.equal(engine.spillSelectWeaponModule('focus'), false);
  engine.save.spillBest = 20;
  assert(engine.spillSelectChassis('bulwark')); assert(engine.spillSelectWeaponModule('wide'));
  engine.fly('spill');
  let s = engine.world.spill;
  assert.equal(s.hull, 4); assert.deepEqual(s.loadout, { chassis: 'bulwark', module: 'wide' });
  assert(engine.spillSelectChassis('interceptor')); assert.equal(s.hull, 2);
  engine.spillLunge(); tick(400);
  assert.equal(s.phase, 'depot');
  assert(engine.spillBuy('plating') === 'ok'); assert.equal(s.hull, 3);
  assert(engine.spillSuspend());
  const saved = JSON.stringify(engine.save.spillSuspended);
  const stored = persisted(); const realSave = JSON.stringify(engine.save);
  assert.equal(engine.spillStartTrial('invalid', 'stock'), false);
  assert.equal(engine.spillStartTrial('gravity', 'invalid'), false);
  assert.equal(persisted(), stored);
  assert(engine.spillStartTrial('gravity', 'stock')); tick(55);
  s = engine.world.spill;
  assert(s.practice); assert.equal(s.wave, 15); assert.equal(s.target, 16); assert.equal(s.hull, 3);
  assert(engine.spillSelectChassis('interceptor')); assert(engine.spillSelectWeaponModule('focus'));
  assert.equal(s.hull, 2); assert.equal(engine.spillSuspend(), false);
  const priorStarter = engine.save.spillStarter;
  engine.spillStarter('scanner'); assert.equal(engine.save.spillStarter, priorStarter);
  assert(engine.setSpillEngineColor('copper')); assert.equal(s.signal, '#efb07a');
  assert.equal(engine.spillBuy('plating'), 'poor');
  assert(engine.spillSelectWeapon('cannon')); assert(engine.spillSelectWeapon('laser'));
  assert.equal(JSON.stringify(engine.save), realSave); assert.equal(persisted(), stored, 'practice fitting writes no real settings, career or checkpoint');
  assert.equal(S.spillCheckpoint(s), null);
  engine.spillLeaveDepot(); tick(181);
  assert.equal(s.wave, 16); assert.equal(s.phase, 'wave');
  assert.equal(engine.spillSelectChassis('bulwark'), false, 'trial handling cannot change during flight');
  assert.equal(engine.spillSelectWeaponModule('wide'), false);
  engine.pause(); const t = s.t; tick(60); assert.equal(s.t, t);
  engine.resume(); clearWave(s);
  assert.equal(s.cause, 'MISSION COMPLETE'); assert(engine.spillTrial().complete);
  assert.equal(JSON.stringify(engine.save), realSave); assert.equal(persisted(), stored); assert.equal(boards.length, 0);
  assert(engine.spillRetryTrial()); tick(55);
  s = engine.world.spill; assert.equal(s.hull, 3); assert.equal(s.wave, 15);
  assert.deepEqual(s.loadout, { chassis: 'standard', module: 'standard' }, 'retry restores the named preset');
  engine.spillLeaveDepot(); tick(181);
  s.hull = 1; s.iframes = s.gold = s.shield = s.charge = 0; s.up.pulse = 0;
  s.rocks = [{ x: s.pilot.x, y: s.pilot.y, vx: 0, vy: 0, r: 20, kind: 'tumbler',
    sprite: 0, spin: 0, rot: 0, arc: 0, arcPhase: 0, warn: 0, grazed: true, dead: false }];
  tick(3); assert.equal(engine.world.screen, 'dead');
  assert.equal(JSON.stringify(engine.save), realSave); assert.equal(persisted(), stored); assert.equal(boards.length, 0);
  engine.spillEndTrial();
  assert.equal(engine.spillTrial(), null); assert.equal(engine.world.screen, 'title');
  assert.equal(JSON.stringify(engine.save.spillSuspended), saved);
  // A route trial flies the whole five-wave contract; no synthetic one-wave payout.
  for (const [id, route, bonus] of [['volatile', 'volatile', 45], ['patrol', 'bounty', 60]]) {
    assert(engine.spillStartTrial(id, 'stock')); tick(55);
    s = engine.world.spill;
    assert.equal(s.wave, 5); assert.equal(s.target, 10); assert.equal(s.expedition.selected, route);
    assert(engine.spillSelectChassis('bulwark'), 'route trial preflight has the same free sidegrade choices');
    engine.spillLeaveDepot(); tick(181);
    assert.equal(s.expedition.active, route);
    for (let wave = 6; wave <= 10; wave++) {
      assert.equal(s.wave, wave);
      if (wave < 10) assert.equal(s.expedition.rewarded, false);
      clearWave(s);
      if (wave < 10) tick(181);
    }
    assert(engine.spillTrial().complete); assert.equal(s.expedition.rewarded, true);
    assert.equal(s.stipend, 5 * S.SPILL.clearOre + bonus);
    assert.equal(JSON.stringify(engine.save), realSave); assert.equal(persisted(), stored); assert.equal(boards.length, 0);
    engine.spillEndTrial();
  }
  assert(engine.spillResume()); assert.equal(engine.world.spill.hull, 3);
  assert.deepEqual(engine.world.spill.loadout, { chassis: 'interceptor', module: 'wide' });
  assert(!engine.world.spill.practice);
  assert.equal(engine.spillStartTrial('comet', 'stock'), false, 'trial cannot replace a live ordinary run');
  console.log('career host: milestone choices, real run application/checkpoint, trial complete/death/retry/pause, exact save and score isolation passed');
} finally { engine.stop(); await win.happyDOM.close(); }
