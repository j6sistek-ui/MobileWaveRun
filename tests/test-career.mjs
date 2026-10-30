import assert from 'node:assert/strict';
import * as C from '../dist/js/spill-career.js';
import * as S from '../dist/js/spill.js';
import * as Combat from '../dist/js/spill-combat.js';
import * as Save from '../dist/js/save.js';
import { platform } from '../dist/js/platform.js';
import { SAVE_KEY } from '../dist/js/catalog.js';

let cases = 0;
function test(name, fn) { fn(); console.log(`  ${name}`); cases++; }
const docked = () => {
  const s = S.createSpill(390, 760, 901, 0, false, false);
  s.phase = 'depot'; s.wave = s.cleared = 5; s.depot = { arm: 0, bought: [] };
  return s;
};
test('career defaults and milestones grant choices, never automatic power', () => {
  assert.deepEqual(C.restoreSpillCareer(undefined, 99), C.createSpillCareer());
  assert.deepEqual(C.restoreSpillCareer({ version: 1, chassis: 'interceptor', module: 'focus' }, 4), C.createSpillCareer());
  assert.deepEqual(C.restoreSpillCareer({ version: 1, chassis: 'interceptor', module: 'focus' }, 5), { version: 1, chassis: 'interceptor', module: 'standard' });
  for (const choice of C.SPILL_CHASSIS) assert.equal(C.restoreSpillCareer({ version: 1, chassis: choice.id, module: 'standard' }, choice.unlock).chassis, choice.id);
  for (const choice of C.SPILL_WEAPON_MODULES) assert.equal(C.restoreSpillCareer({ version: 1, chassis: 'standard', module: choice.id }, choice.unlock).module, choice.id);
  for (const invalid of [null, [], 7, { version: 2 }, { version: 1, chassis: '__proto__', module: 'wide' }]) {
    assert.deepEqual(C.restoreSpillCareer(invalid, 100), C.createSpillCareer());
  }
});
test('loadout snapshot migration and malformed values are bounded', () => {
  const s = docked();
  const cp = S.spillCheckpoint(s);
  delete cp.state.loadout;
  assert.deepEqual(S.restoreSpill(cp, 390, 760).loadout, C.createSpillLoadout());
  for (const chassis of C.SPILL_CHASSIS) {
    s.loadout = { chassis: chassis.id, module: 'focus' };
    s.maxHull = s.hull = S.SPILL.hull + C.spillChassisStats(chassis.id).hull;
    const saved = S.spillCheckpoint(s);
    assert.deepEqual(S.restoreSpill(saved, 844, 390).loadout, s.loadout);
    saved.state.loadout.chassis = 'made-up'; assert.equal(S.restoreSpill(saved, 390, 760), null);
  }
});
test('chassis change actual movement and health; modules retain damage tradeoffs', () => {
  const speeds = {};
  for (const c of C.SPILL_CHASSIS) {
    const s = S.createSpill(390, 760, 901, 0, false, false);
    s.loadout.chassis = c.id; s.phase = 'wave'; s.nextRock = s.nextNut = s.nextSpecial = s.combat.nextEnemy = 1000;
    s.pilot.y = 380; S.spillSteer(s, -1);
    for (let i = 0; i < 30; i++) S.stepSpill(s, 1 / 60);
    speeds[c.id] = -s.pilot.vy;
  }
  assert(speeds.interceptor > speeds.standard && speeds.standard > speeds.bulwark);
  assert(C.spillWeaponModuleStats('focus').speed > 1 && C.spillWeaponModuleStats('focus').aim < 1);
  assert(C.spillWeaponModuleStats('wide').speed < 1 && C.spillWeaponModuleStats('wide').aim > 1);
});
test('fire-control modules change fired trajectories without increasing damage or cadence', () => {
  function volley(module, angle) {
    const s = S.createSpill(390, 760, 902, 0, false, false);
    s.phase = 'wave'; s.loadout.module = module;
    const x = s.W * .74, y = s.pilot.y + Math.tan(angle) * (x - s.pilot.x);
    s.combat.enemies.push({ id: 3, kind: 'pursuer', x, y, vx: 0, vy: 0, r: 18, hp: 4, maxHp: 4,
      age: 0, life: 8, cooldown: 99, telegraph: 0, telegraphTotal: .9,
      aimX: s.pilot.x, aimY: s.pilot.y, shotSpeed: 0, homeY: y, side: 1, hitFlash: 0, dead: false });
    Combat.spillTapFire(s);
    Combat.stepSpillCombat(s, 1 / 60, Combat.captureSpillCombatMotion(s), {
      shipRadius: S.SPILL.shipR, shatter() {}, damagePilot() {},
    });
    return { shot: s.combat.shots[0], cooldown: s.combat.cooldown };
  }
  const original = volley('standard', .22), focused = volley('focus', .22);
  assert(original.shot.vy > 0 && focused.shot.vy === 0, 'narrow lens requires tighter manual lining up');
  const normalWideTarget = volley('standard', .28), tracking = volley('wide', .28);
  assert(normalWideTarget.shot.vy === 0 && tracking.shot.vy > 0, 'tracking lens catches the wider forward target');
  const speed = v => Math.hypot(v.shot.vx, v.shot.vy);
  assert(speed(focused) > speed(original) && speed(original) > speed(tracking));
  for (const v of [focused, tracking]) {
    assert.equal(v.shot.damage, original.shot.damage); assert.equal(v.cooldown, original.cooldown);
  }
});
test('saved career sanitization keeps earlier checkpoints and base weapon availability', () => {
  const save = Save.defaultSave(); save.spillBest = 20;
  save.spillCareer = { version: 1, chassis: 'bulwark', module: 'wide' };
  save.spillSuspended = S.spillCheckpoint(docked());
  Save.writeSave(save);
  assert.deepEqual(Save.loadSave().spillCareer, save.spillCareer);
  assert(Save.loadSave().spillSuspended);
  save.spillBest = 0; Save.writeSave(save);
  assert.deepEqual(Save.loadSave().spillCareer, C.createSpillCareer());
  assert.deepEqual(Save.loadSave().spillSuspended.state.combat.levels, { laser: 1, cannon: 1 });
});
test('trial save clones cannot write or bank and trial states cannot suspend', () => {
  const save = Save.defaultSave(); Save.writeSave(save);
  const before = platform.storage.get(SAVE_KEY);
  const clone = Save.cloneSaveForTrial(save); clone.spillBest = 900; clone.acorns += 9000; Save.writeSave(clone);
  assert.equal(platform.storage.get(SAVE_KEY), before);
  const s = docked(); s.practice = true; s.oreMined = 100; s.score = 9999;
  Save.bankSpill(save, s, true); assert.equal(platform.storage.get(SAVE_KEY), before);
  assert.equal(save.spillBest, 0); assert.equal(S.spillCheckpoint(s), null);
  const cp = { version: 1, state: s }; assert.equal(S.restoreSpill(cp, 390, 760), null);
});
test('trial builds use bounded normal systems and no hidden invulnerability', () => {
  for (const build of C.SPILL_TRIAL_BUILDS) {
    const s = S.createSpill(390, 760, 901, 0, true, false);
    C.applySpillTrialBuild(s, build.id);
    assert.equal(s.iframes, 0); assert.equal(s.gold, 0); assert.equal(s.ore, 0);
    assert(s.hull >= 3 && s.hull <= 5);
    assert(s.utilities.length <= 2);
    assert.equal(s.combat.build.artifact === null, build.id === 'stock');
    assert.deepEqual(s.combat.shots, []); assert.deepEqual(s.hazards.actors, []);
  }
  assert.equal(new Set(C.SPILL_TRIALS.map(t => t.id)).size, C.SPILL_TRIALS.length);
});
console.log(`${cases} career and trial authority cases passed`);
