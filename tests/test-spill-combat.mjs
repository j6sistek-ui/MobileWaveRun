import assert from 'node:assert/strict';

globalThis.window = { location: { href: 'http://local/' }, devicePixelRatio: 1,
  addEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {} }) };
globalThis.document = { createElement: () => ({ getContext: () => null, style: {} }),
  addEventListener() {}, documentElement: { style: {} } };
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const S = await import('../dist/js/spill.js');
const C = await import('../dist/js/spill-combat.js');
const dt = 1 / 60;
let cases = 0;
function test(name, body) { body(); cases++; console.log(`combat: ${name}`); }
function flight(W = 390, wave = 2, seed = 23) {
  const s = S.createSpill(W, 760, seed, 0, false, false);
  s.phase = 'wave'; s.wave = wave; s.spec = S.spillWaveSpec(wave, seed);
  s.nextRock = s.nextNut = s.nextSpecial = 1000;
  s.combat.nextEnemy = 60;
  return s;
}
function enemy(s, x = s.W * .75, y = s.pilot.y, kind = 'pursuer') {
  const hp = kind === 'pursuer' ? 4 : 3;
  const e = { id: s.combat.nextId++, kind, x, y, vx: 0, vy: 0, r: 18, hp, maxHp: hp,
    age: 2, life: 8.5, cooldown: 99, telegraph: 0, telegraphTotal: .9,
    aimX: s.pilot.x, aimY: s.pilot.y, shotSpeed: 0, homeY: y, side: 1, hitFlash: 0, dead: false };
  s.combat.enemies.push(e); return e;
}
function rock(s, x, y, kind = 'tumbler', r = 20) {
  const value = { x, y, vx: 0, vy: 0, r, kind, sprite: 0, spin: 0, rot: 0,
    arc: 0, arcPhase: 0, warn: 0, grazed: false, dead: false };
  s.rocks.push(value); return value;
}
function shot(s, team, x, y, vx, damage = 1, life = 1.4) {
  const value = { id: s.combat.nextId++, team, weapon: 'laser', x, y, vx, vy: 0, r: 3, damage, life, dead: false };
  s.combat.shots.push(value); return value;
}
function pureStep(s, time = dt, before = C.captureSpillCombatMotion(s)) {
  C.stepSpillCombat(s, time, before, { shipRadius: S.SPILL.shipR,
    shatter(r) { if (!r.dead) { r.dead = true; s.shattered++; } },
    damagePilot() { s.hull--; s.hits++; } });
}

test('manual fire only, release, forward default and distinct weapon stats', () => {
  const s = flight();
  for (let i = 0; i < 60; i++) pureStep(s);
  assert.equal(s.combat.shots.length, 0);
  C.spillSetFiring(s, true);
  for (let i = 0; i < 60; i++) pureStep(s);
  assert(s.combat.nextId - 1 >= 6 && s.combat.nextId - 1 <= 7, 'six to seven shots emitted in one second');
  assert(s.combat.shots.every(v => v.team === 'player' && v.vx > 0 && v.vy === 0));
  C.spillSetFiring(s, false);
  const id = s.combat.nextId;
  for (let i = 0; i < 90; i++) pureStep(s);
  assert.equal(s.combat.nextId, id);
  assert.equal(s.combat.shots.length, 0);
  for (let level = 1; level <= 3; level++) {
    s.combat.levels = { laser: level, cannon: level };
    const laser = C.spillWeaponStats(s, 'laser'), cannon = C.spillWeaponStats(s, 'cannon');
    assert.equal(laser.damage, level); assert.equal(cannon.damage, level * 4);
    assert(laser.speed > cannon.speed && laser.cooldown < cannon.cooldown && cannon.radius > laser.radius);
    assert(Math.abs(laser.damage / laser.cooldown - cannon.damage / cannon.cooldown) < .5);
  }
  s.phase = 'depot'; C.spillSetFiring(s, true); assert.equal(s.combat.firing, false);
});

test('a tap released between ticks fires once, with no firing backlog', () => {
  const s = flight();
  C.spillTapFire(s); C.spillSetFiring(s, true); C.spillSetFiring(s, false);
  pureStep(s);
  assert.equal(s.combat.nextId, 2); assert.equal(s.combat.pendingFire, 0);
  for (let i = 0; i < 90; i++) pureStep(s);
  assert.equal(s.combat.nextId, 2, 'release cannot turn one tap into automatic fire');
  s.combat.cooldown = .08;
  for (let i = 0; i < 10; i++) C.spillTapFire(s);
  for (let i = 0; i < 90; i++) pureStep(s);
  assert.equal(s.combat.nextId, 3, 'near-ready taps buffer only one shot');
  s.combat.cooldown = .65; C.spillTapFire(s);
  for (let i = 0; i < 60; i++) pureStep(s);
  assert.equal(s.combat.nextId, 3, 'a tap during a long cooldown expires');
});

test('cancellation and nonflight phases cannot retain a queued shot', () => {
  const s = flight();
  C.spillTapFire(s); C.spillSetFiring(s, true); C.spillClearFireInput(s); pureStep(s);
  assert.equal(s.combat.nextId, 1); assert.equal(s.combat.firing, false);
  C.spillTapFire(s); S.resizeSpill(s, 320, 760); pureStep(s);
  assert.equal(s.combat.nextId, 1); assert.equal(s.combat.pendingFire, 0);
  C.spillTapFire(s); C.clearSpillCombat(s); pureStep(s);
  assert.equal(s.combat.nextId, 1);
  for (const phase of ['ready', 'countdown', 'depot', 'docking', 'respawn', 'over']) {
    s.phase = phase; C.spillTapFire(s); C.spillSetFiring(s, true);
    assert.equal(s.combat.pendingFire, 0); assert.equal(s.combat.firing, false);
  }
});

test('Depot selection is free, upgrades are independent and atomic, opening choice survives', () => {
  const s = flight(); s.phase = 'depot'; s.welcome = true; s.freeUpgrade = true; s.depot = { arm: 1, bought: [] }; s.ore = 195;
  assert.equal(C.spillSelectWeapon(s, 'cannon'), false);
  assert.equal(C.spillUpgradeWeapon(s), false); assert.equal(s.ore, 195);
  s.depot.arm = 0;
  assert(C.spillSelectWeapon(s, 'cannon')); assert.equal(s.ore, 195); assert(s.freeUpgrade);
  assert.equal(C.spillWeaponPrice(s), 65); assert(C.spillUpgradeWeapon(s));
  assert.equal(s.ore, 130); assert.equal(C.spillWeaponPrice(s), 130);
  assert(C.spillUpgradeWeapon(s)); assert.equal(s.ore, 0); assert.equal(C.spillWeaponPrice(s), null);
  assert.equal(C.spillUpgradeWeapon(s), false); assert.equal(C.spillSelectWeapon(s, '__proto__'), false);
  assert(C.spillSelectWeapon(s, 'laser')); assert.equal(s.combat.levels.laser, 1);
  assert.equal(C.spillUpgradeWeapon(s), false); assert.equal(s.combat.levels.laser, 1);
  assert.equal(S.createSpill(390, 760, 3).combat.levels.cannon, 1);
});

test('soft assistance is limited to visible forward cone and never starts firing', () => {
  const s = flight();
  const near = enemy(s, 280, s.pilot.y + 25); enemy(s, 230, s.pilot.y + 180);
  pureStep(s); assert.equal(s.combat.targetId, near.id); assert.equal(s.combat.shots.length, 0);
  C.spillSetFiring(s, true); pureStep(s);
  assert(s.combat.shots[0].vy > 0);
  s.combat.shots = []; s.combat.cooldown = 0; near.dead = true; pureStep(s);
  assert.equal(s.combat.targetId, null); assert.equal(s.combat.shots[0].vy, 0);
});

test('sweeps hit earliest cover, preserve moving targets, and clip projectile lifetime', () => {
  const s = flight(); const cover = rock(s, 170, s.pilot.y); const e = enemy(s, 280);
  shot(s, 'player', 80, s.pilot.y, 24000, 4); pureStep(s);
  assert(cover.dead); assert.equal(e.hp, 4); assert.equal(s.combat.kills, 0);
  s.rocks = []; s.combat.shots = []; e.x = 180;
  shot(s, 'player', 80, s.pilot.y, 24000, 4); pureStep(s);
  assert.equal(s.combat.kills, 1); assert.equal(s.nuts.length, 3);
  pureStep(s); assert.equal(s.combat.kills, 1); assert.equal(s.nuts.length, 3);

  const moving = flight(), r = rock(moving, 300, moving.pilot.y, 'shard', 12);
  shot(moving, 'player', 50, moving.pilot.y, 1200);
  const before = C.captureSpillCombatMotion(moving); r.x = 60;
  pureStep(moving, dt, before); assert(r.dead, 'relative sweep catches a rock crossing between endpoints');
  const clipped = flight(), far = enemy(clipped, 280);
  shot(clipped, 'player', 100, clipped.pilot.y, 6000, 20, .001); pureStep(clipped, .1);
  assert.equal(far.hp, 4); assert.equal(clipped.combat.shots.length, 0);
});

test('enemy fire stops at debris, and an exact cover/player tie favors cover', () => {
  const s = flight(); const r = rock(s, 200, s.pilot.y);
  shot(s, 'enemy', 350, s.pilot.y, -24000); pureStep(s);
  assert.equal(s.hull, 3); assert.equal(r.hp, undefined); assert(!r.dead);
  rock(s, s.pilot.x, s.pilot.y, 'shard', S.SPILL.shipR);
  s.rocks.shift(); shot(s, 'enemy', 350, s.pilot.y, -24000); pureStep(s);
  assert.equal(s.hull, 3);
});

test('production damage uses shields, pulse, death and extra life without fake rock rewards', () => {
  const s = flight(); s.shield = 1;
  shot(s, 'enemy', 200, s.pilot.y, -12000); S.stepSpill(s, dt);
  assert.equal(s.shield, 0); assert.equal(s.hull, 3); assert.equal(s.shattered, 0);
  const dead = flight(); dead.hull = 1; C.spillSetFiring(dead, true);
  shot(dead, 'enemy', 200, dead.pilot.y, -12000); S.stepSpill(dead, dt);
  assert.equal(dead.phase, 'over'); assert.equal(dead.cause, 'STRUCK'); assert.equal(dead.combat.firing, false);
  assert.equal(dead.combat.shots.length, 0); assert.equal(dead.shattered, 0);
  const revive = flight(); revive.hull = 1; revive.coreArmed = true;
  enemy(revive); shot(revive, 'enemy', 200, revive.pilot.y, -12000); S.stepSpill(revive, dt);
  assert.equal(revive.phase, 'respawn'); assert.equal(revive.combat.enemies.length, 0);
  for (let i = 0; i < 121; i++) S.stepSpill(revive, dt);
  assert.equal(revive.phase, 'wave'); assert.equal(revive.hull, 3); assert(revive.gold > 0);

  const pulse = flight(); pulse.up.pulse = 1; pulse.charge = 1;
  const e = enemy(pulse, 220); e.hp = 2; e.telegraph = dt / 2; e.shotSpeed = 100;
  shot(pulse, 'enemy', 200, pulse.pilot.y, -12000);
  shot(pulse, 'enemy', 210, pulse.pilot.y + 40, -120);
  S.stepSpill(pulse, dt);
  assert.equal(pulse.hull, 3); assert.equal(pulse.charge, 0); assert.equal(pulse.combat.kills, 1);
  assert.equal(pulse.combat.shots.length, 0, 'pulse also clears a shot emitted on the impact tick'); assert.equal(pulse.nuts.length, 3);
});

test('projectile shatter and enemy drops use original score/coin collection once', () => {
  const s = flight(); rock(s, 190, s.pilot.y, 'shard', 12);
  shot(s, 'player', 110, s.pilot.y, 12000); S.stepSpill(s, dt);
  assert.equal(s.shattered, 1); assert.equal(s.shards, 1); assert.equal(s.oreMined, 0);
  const e = enemy(s, 260); shot(s, 'player', 110, s.pilot.y, 12000, 4); S.stepSpill(s, dt);
  assert(e.dead); assert.equal(s.combat.kills, 1); assert.equal(s.ore, 0); assert.equal(s.oreMined, 0);
  for (const n of s.nuts) { n.x = s.pilot.x; n.y = s.pilot.y; n.vx = n.vy = 0; }
  S.stepSpill(s, dt); assert.equal(s.ore, 3); assert.equal(s.oreMined, 3);
  S.stepSpill(s, dt); assert.equal(s.ore, 3); assert.equal(s.oreMined, 3);
});

test('320/390/1280 enemy warnings freeze aim and leave at least .75 seconds projectile lead', () => {
  for (const W of [320, 390, 1280]) {
    const s = flight(W); const e = enemy(s, W * .76, s.pilot.y - 20); e.cooldown = 0;
    pureStep(s); assert(e.telegraph > 0);
    const aim = [e.aimX, e.aimY], position = [e.x, e.y];
    const travel = (Math.hypot(e.x - e.aimX, e.y - e.aimY) - S.SPILL.shipR - 5) / e.shotSpeed;
    assert(travel >= .75 - 1e-9);
    s.pilot.y += 150;
    for (let i = 0; i < 50; i++) { pureStep(s); assert.deepEqual([e.aimX, e.aimY], aim); assert.deepEqual([e.x, e.y], position); }
    assert.equal(s.combat.shots.filter(v => v.team === 'enemy').length, 0);
    for (let i = 0; i < 5; i++) pureStep(s);
    const fired = s.combat.shots.find(v => v.team === 'enemy'); assert(fired);
    const angle = Math.atan2(aim[1] - position[1], aim[0] - position[0]);
    assert(Math.abs(Math.atan2(fired.vy, fired.vx) - angle) < 1e-9);
  }
});

test('320/390/1280 admission caps, arrivals and separate RNG; no enemies in wave one', () => {
  for (const W of [320, 390, 1280]) for (const wave of [1, 2, 15]) {
    const s = flight(W, wave), originalRng = s.rng;
    for (let i = 0; i < 30; i++) { s.combat.nextEnemy = 0; C.admitSpillEnemies(s, dt); }
    assert.equal(s.rng, originalRng);
    assert.equal(s.combat.enemies.length, wave === 1 ? 0 : wave < 10 ? 2 : 3);
    for (const e of s.combat.enemies) {
      assert(e.x > W && Math.hypot(e.x - s.pilot.x, e.y - s.pilot.y) >= 150);
      for (const other of s.combat.enemies) if (e !== other) assert(Math.hypot(e.x - other.x, e.y - other.y) > e.r + other.r);
    }
    if (wave > 1) assert(new Set(s.combat.enemies.map(e => e.kind)).size === 2);
    const blocked = flight(W, wave);
    for (let y = 0; y <= blocked.H + 50; y += 50) rock(blocked, W + 25, y, 'hulk', 60);
    blocked.combat.nextEnemy = 0; C.admitSpillEnemies(blocked, dt);
    assert.equal(blocked.combat.enemies.length, 0);
  }
});

test('encounters reserve ambient capacity and avoid overlapping event/surge admission', () => {
  const a = flight(), b = flight();
  for (const s of [a, b]) { s.nextRock = 0; for (let i = 0; i < 3; i++) rock(s, 450 + i * 120, 80 + i * 100); }
  enemy(b, 300, 600); S.stepSpill(a, dt); S.stepSpill(b, dt);
  assert(a.nextRock > 0 && b.nextRock < 0, 'one enemy reserves two ambient rock slots');
  const blocked = flight(); blocked.combat.nextEnemy = 0; blocked.eventWarn = 1;
  C.admitSpillEnemies(blocked, dt); assert.equal(blocked.combat.enemies.length, 0);
  blocked.eventWarn = 0; blocked.surgeT = 1;
  C.admitSpillEnemies(blocked, dt); assert.equal(blocked.combat.enemies.length, 0);
});

test('drain retires enemies without fresh shots, resets transient combat and keeps upgrades', () => {
  const s = flight(); s.combat.levels.cannon = 3; s.combat.kills = 4;
  const e = enemy(s); e.telegraph = .3;
  s.phase = 'drain'; C.spillSetFiring(s, true);
  for (let i = 0; i < 360 && s.phase === 'drain'; i++) {
    s.pilot.y = 340; s.pilot.vy = 0; s.iframes = 9; S.stepSpill(s, dt);
    assert(!s.combat.shots.some(v => v.team === 'enemy'));
  }
  assert.equal(s.phase, 'countdown'); assert.equal(s.combat.enemies.length, 0);
  assert.equal(s.combat.shots.length, 0); assert.equal(s.combat.firing, false);
  assert.equal(s.combat.levels.cannon, 3); assert.equal(s.combat.kills, 4);
});

test('resize preserves combat geometry and cancels held firing', () => {
  const s = flight(); const e = enemy(s); e.telegraph = .5;
  const q = shot(s, 'enemy', 250, 300, -200); C.spillSetFiring(s, true);
  const old = { x: e.x, y: e.y, aimX: e.aimX, aimY: e.aimY };
  S.resizeSpill(s, 780, 380);
  assert.equal(e.x, old.x * 2); assert.equal(e.y, old.y * .5);
  assert.equal(e.aimX, old.aimX * 2); assert.equal(e.aimY, old.aimY * .5);
  assert.equal(q.x, 500); assert.equal(q.vx, -400); assert.equal(q.y, 150);
  assert.equal(s.combat.firing, false);
});

test('version-one checkpoints migrate and reject malformed new combat state', () => {
  const s = flight(); s.phase = 'depot'; s.wave = s.cleared = 5; s.depot = { arm: 0, bought: [] };
  s.combat.weapon = 'cannon'; s.combat.levels.cannon = 3; s.combat.kills = 5; s.combat.waveKills = 2;
  s.combat.nextEnemy = 4; s.combat.firing = true; enemy(s); shot(s, 'player', 100, 200, 300);
  const checkpoint = S.spillCheckpoint(s); assert(checkpoint); assert(s.combat.firing);
  const restored = S.restoreSpill(checkpoint, 320, 760); assert(restored);
  assert.equal(restored.combat.weapon, 'cannon'); assert.equal(restored.combat.levels.cannon, 3);
  assert.equal(restored.combat.kills, 5); assert.equal(restored.combat.enemies.length, 0); assert(!restored.combat.firing);
  const beforeJoystick = structuredClone(checkpoint); delete beforeJoystick.state.combat.pendingFire;
  assert.equal(S.restoreSpill(beforeJoystick, 390, 760).combat.pendingFire, 0);
  const old = structuredClone(checkpoint); delete old.state.combat;
  const migrated = S.restoreSpill(old, 390, 760); assert(migrated);
  assert.equal(migrated.combat.weapon, 'laser'); assert.deepEqual(migrated.combat.levels, { laser: 1, cannon: 1 });
  for (const change of [c => c.weapon = 'missile', c => c.levels.laser = 0, c => c.levels.cannon = 4,
    c => c.kills = -1, c => c.waveKills = 20, c => c.rng = NaN, c => c.nextId = 1.5,
    c => c.firing = true, c => c.pendingFire = .1, c => c.pendingFire = '0',
    c => c.cooldown = 1, c => c.enemies = [{}], c => c.shots = [{}],
    c => c.nextEnemy = Infinity, c => c.muzzleFlash = '0', c => c.version = 2]) {
    const bad = structuredClone(checkpoint); change(bad.state.combat);
    assert.equal(S.restoreSpill(bad, 390, 760), null);
  }
});

test('mixed combat simulation repeats exactly for identical seed and inputs', () => {
  function run(seed) {
    const s = flight(320, 12, seed); s.combat.nextEnemy = .5;
    s.nextRock = .1; s.nextNut = 1; s.nextSpecial = 8;
    for (let i = 0; i < 1200; i++) {
      s.iframes = 9; s.floorT = 0;
      S.spillSteer(s, Math.sin(i / 60));
      if (i % 180 === 0) S.spillLunge(s, i % 360 === 0 ? -1 : 1);
      C.spillSetFiring(s, i % 120 < 80); S.stepSpill(s, dt);
    }
    return JSON.stringify(s);
  }
  assert.equal(run(33), run(33)); assert.notEqual(run(33), run(34));
});

console.log(`${cases} combat cases passed (rules/geometry only; natural mobile balance remains unverified)`);
