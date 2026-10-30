import assert from 'node:assert/strict';
import * as S from '../dist/js/spill.js';
import * as E from '../dist/js/spill-expeditions.js';
import * as K from '../dist/js/spill-climax.js';
import * as C from '../dist/js/spill-combat.js';

const DT = 1 / 60;
let cases = 0;
const test = (name, run) => { run(); cases++; console.log(`expeditions: ${name}`); };
function flight(wave = 20, W = 390, H = 760) {
  const s = S.createSpill(W, H, 7120, 0, false, false);
  s.wave = wave; s.phase = 'wave'; s.spec = S.spillWaveSpec(wave, s.seed);
  s.waveT = s.spec.dur * .46; s.event = 'none';
  s.nextRock = s.nextNut = s.nextSpecial = 1e6; s.combat.nextEnemy = 1e6;
  return s;
}
function depot(wave = 5) {
  const s = flight(wave); s.phase = 'depot'; s.cleared = wave;
  s.combat.nextEnemy = 4.5;
  s.depot = { arm: 0, bought: [] }; return s;
}
function elite(s) {
  K.admitSpillClimax(s); assert.equal(s.combat.enemies.length, 1);
  return s.combat.enemies[0];
}
function stepElite(s, e, seconds) {
  const emitted = [];
  for (let i = 0; i < Math.ceil(seconds / DT); i++) K.stepSpillElite(s, e, DT, emitted);
  return emitted;
}

test('route selection is explicit, Depot-only and committed once for the next block', () => {
  const s = depot();
  assert(E.spillSelectRisk(s, 'volatile'));
  assert.equal(s.ore, 0);
  s.depot.arm = .3; assert.equal(E.spillSelectRisk(s, 'bounty'), false); s.depot.arm = 0;
  assert.equal(E.spillSelectRisk(s, '__proto__'), false);
  assert(S.spillLeaveDepot(s));
  assert.equal(s.wave, 6); assert.equal(E.spillRiskActive(s, 'volatile'), true);
  assert.equal(s.expedition.endWave, 10);
  assert.equal(s.expedition.selected, 'standard', 'next block requires a fresh opt-in');
  assert.equal(E.spillSelectRisk(s, 'standard'), false);
  s.wave = 11; assert.equal(E.spillRiskActive(s, 'volatile'), false);
  const opening = depot(0); opening.welcome = true;
  assert.equal(E.spillSelectRisk(opening, 'volatile'), false);
});

test('risk stipend requires the final clear, pays once and never manufactures mined coins', () => {
  for (const id of ['volatile', 'bounty']) {
    const s = depot(); E.spillSelectRisk(s, id); S.spillLeaveDepot(s);
    for (const cleared of [6, 7, 8, 9]) { s.cleared = cleared; assert.equal(E.settleSpillExpedition(s), 0); }
    s.cleared = 10;
    assert.equal(E.settleSpillExpedition(s), E.SPILL_RISKS[id].reward);
    assert.equal(E.settleSpillExpedition(s), 0);
    assert.equal(s.ore, E.SPILL_RISKS[id].reward); assert.equal(s.oreMined, 0);
    assert.equal(s.stipend, E.SPILL_RISKS[id].reward);
  }
});

test('new and legacy checkpoints restore route state without replaying rewards', () => {
  const s = depot(); E.spillSelectRisk(s, 'bounty');
  const checkpoint = S.spillCheckpoint(s); assert(checkpoint);
  const restored = S.restoreSpill(checkpoint, 844, 390); assert(restored);
  assert.equal(restored.expedition.selected, 'bounty');
  const old = structuredClone(checkpoint);
  delete old.state.expedition; delete old.state.climax; delete old.state.loadout;
  assert(S.restoreSpill(old, 390, 760));
  for (const mutation of [
    c => { c.state.expedition.active = 'fake'; },
    c => { c.state.expedition.rewarded = false; },
    c => { c.state.expedition.endWave = Infinity; },
    c => { c.state.climax.spawned = 'yes'; },
    c => { c.state.practice = true; },
  ]) { const bad = structuredClone(checkpoint); mutation(bad); assert.equal(S.restoreSpill(bad, 390, 760), null); }
});

test('Warden waits for existing pressure without deleting debris or hostile shots', () => {
  const s = flight();
  const r = { x: 50, y: 100, r: 15, dead: false };
  s.rocks.push(r); K.admitSpillClimax(s);
  assert.equal(s.combat.enemies.length, 0); assert.equal(r.dead, false);
  s.rocks = [];
  const p = { team: 'enemy', dead: false }; s.combat.shots.push(p);
  K.admitSpillClimax(s); assert.equal(s.combat.enemies.length, 0); assert.equal(p.dead, false);
  s.combat.shots = []; const e = elite(s);
  K.admitSpillClimax(s); assert.equal(s.combat.enemies.length, 1);
  assert.equal(e.maxHp, 12, 'elite is a timing/position task, not endless HP scaling');
});

test('Warden frozen lock/fork paths have warning and travel floors at every viewport', () => {
  for (const [W, H] of [[320, 760], [390, 844], [844, 390], [1280, 720]]) {
    const s = flight(20, W, H), e = elite(s);
    let shots = [];
    for (let i = 0; i < 180 && e.elite.stage !== 'warning'; i++) K.stepSpillElite(s, e, DT, shots);
    assert.equal(e.elite.stage, 'warning'); assert(e.telegraph >= 1.35);
    const frozen = [e.x, e.y, e.aimX, e.aimY, ...e.elite.aims];
    s.pilot.y += 100; K.stepSpillElite(s, e, .5, shots);
    assert.deepEqual([e.x, e.y, e.aimX, e.aimY, ...e.elite.aims], frozen);
    shots.push(...stepElite(s, e, .9));
    assert.equal(shots.length, 1); assert.equal(e.elite.stage, 'exposed');
    const shot = shots[0];
    const contactTime = (Math.hypot(e.x - e.aimX, e.y - e.aimY) - S.SPILL.shipR - shot.r) / Math.hypot(shot.vx, shot.vy);
    assert(contactTime >= .9 - 1e-9);
    e.elite.stage = 'arrival'; e.elite.cycle = 1; e.homeY = e.y;
    K.stepSpillElite(s, e, DT, []);
    assert.equal(e.elite.pattern, 'fork'); assert.equal(e.elite.aims.length, 2);
    assert(e.elite.aims[1] - e.elite.aims[0] >= 100, 'fork preserves its marked middle');
    const before = e.elite.aims.slice(); S.resizeSpill(s, H, W);
    e.elite.aims.forEach((y, i) => assert(Math.abs(y - before[i] * W / H) < 1e-9, 'rotate actual frozen paths with actor'));
  }
});

test('shielded damage is ignored, exposed damage awards one physical reward', () => {
  const s = flight(), e = elite(s), baseScore = s.score;
  C.damageSpillEnemy(s, e, 100);
  assert.equal(e.hp, 12); assert.equal(s.combat.kills, 0);
  e.elite.stage = 'exposed';
  C.damageSpillEnemy(s, e, 12); C.damageSpillEnemy(s, e, 12);
  assert.equal(s.combat.kills, 1); assert.equal(s.score - baseScore, 75);
  assert.equal(s.nuts.length, 8); assert.equal(s.ore, 0);
});

test('edge positions receive a lock instead of a false fork-gap promise', () => {
  for (const [W, H] of [[320, 760], [390, 844], [844, 390], [1280, 720]]) {
    for (const y of [S.SPILL.shipR, H - S.SPILL.shipR]) {
      const s = flight(20, W, H), e = elite(s);
      s.pilot.y = y; e.x = W * .8; e.y = e.homeY = Math.max(55, Math.min(H - 55, y));
      e.elite.cycle = 1;
      K.stepSpillElite(s, e, DT, []);
      assert.equal(e.elite.stage, 'warning');
      assert.equal(e.elite.pattern, 'lock'); assert.deepEqual(e.elite.aims, [y]);
    }
  }
});

test('stock steering evades the actual lock volley and holding the fork middle stays safe', () => {
  let scenarios = 0;
  for (const [W, H] of [[320, 760], [390, 844], [844, 390], [1280, 720]]) {
    for (const start of ['middle', 'top', 'bottom', 'fork']) {
      const s = flight(20, W, H), e = elite(s);
      const y = start === 'top' ? S.SPILL.shipR : start === 'bottom' ? H - S.SPILL.shipR : H / 2;
      s.pilot.y = y; e.x = W * .8; e.y = e.homeY = Math.max(55, Math.min(H - 55, y));
      e.elite.cycle = start === 'fork' ? 1 : 0;
      assert.equal(s.iframes, 0); assert.equal(s.shield, 0); assert.equal(s.gold, 0); assert.equal(s.up.pulse, 0);
      S.stepSpill(s, DT);
      assert.equal(e.elite.pattern, start === 'fork' ? 'fork' : 'lock');
      let hostile = 0, closest = Infinity;
      for (let tick = 0; tick < 240; tick++) {
        // The actual stock steering authority receives ordinary input after the warning.
        S.spillSteer(s, start === 'fork' || tick >= 30 ? 0 : start === 'bottom' ? -1 : 1);
        S.stepSpill(s, DT);
        for (const shot of s.combat.shots) if (shot.team === 'enemy') {
          hostile = Math.max(hostile, s.combat.shots.filter(p => p.team === 'enemy').length);
          closest = Math.min(closest, Math.hypot(shot.x - s.pilot.x, shot.y - s.pilot.y));
        }
      }
      assert.equal(hostile, start === 'fork' ? 2 : 1, 'the complete warned volley actually fired');
      assert.equal(s.hull, 3); assert.equal(s.hits, 0); assert.equal(s.iframes, 0, 'no invulnerability masked a contact');
      assert(closest > S.SPILL.shipR + 6, 'actual projectile remains outside the collision radius');
      if (start === 'fork') assert.equal(s.pilot.y, y, 'stationary middle is a real answer');
      else assert(Math.abs(s.pilot.y - y) > 80, 'steering moved the stock ship out of the committed line');
      scenarios++;
    }
  }
  console.log(`${scenarios} stock counterplay scenarios without invulnerability, shields, firing or upgrades`);
});

test('survival remains an answer; retreat never adds a reward or blocks drainage', () => {
  const s = flight(), e = elite(s); s.phase = 'drain';
  const emitted = stepElite(s, e, 4);
  assert.equal(emitted.length, 0); assert(e.dead);
  assert.equal(s.combat.kills, 0); assert.equal(s.ore, 0);
  s.phaseT = 6; S.stepSpill(s, DT); assert.equal(s.cleared, 20);
});

test('complete scheduled climax waves admit once, keep warnings and terminate', () => {
  let runs = 0;
  for (const wave of [10, 15, 20, 40]) for (const [W, H] of [[320, 760], [844, 390]]) for (const seed of [7, 71, 7120]) {
    const s = S.createSpill(W, H, seed, wave, false, false);
    // Normal authority/countdown/spawners. Invulnerability only keeps this schedule observer alive.
    s.wave = wave - 1; s.phase = 'depot'; s.depot = { arm: 0, bought: [] };
    assert(S.spillLeaveDepot(s));
    const seen = new Set(); let steps = 0;
    while (s.phase !== 'over' && steps++ < 60 * 60) {
      s.iframes = 2;
      S.stepSpill(s, DT);
      for (const e of s.combat.enemies) if (e.elite) seen.add(e.id);
      assert(s.combat.enemies.filter(e => e.elite && !e.dead).length <= 1);
    }
    assert.equal(s.cause, 'MISSION COMPLETE', `${wave}/${W}/${seed} reaches end`);
    assert.equal(seen.size, 1, `${wave}/${W}/${seed} admits one climax`);
    runs++;
  }
  console.log(`${runs} complete climax schedule simulations (invulnerability observer, not natural survival)`);
});

console.log(`${cases} expedition/climax cases passed`);
