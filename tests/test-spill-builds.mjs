import assert from 'node:assert/strict';

globalThis.window = { location: { href: 'http://local/' }, devicePixelRatio: 1,
  addEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {} }) };
globalThis.document = { createElement: () => ({ getContext: () => null, style: {} }),
  addEventListener() {}, documentElement: { style: {} } };
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const S = await import('../dist/js/spill.js');
const C = await import('../dist/js/spill-combat.js');
const B = await import('../dist/js/spill-builds.js');
const dt = 1 / 60;
let cases = 0;
function test(name, body) { body(); cases++; console.log(`builds: ${name}`); }
function flight(artifact = null, W = 390, H = 760) {
  const s = S.createSpill(W, H, 71, 0, false, false);
  s.phase = 'wave'; s.wave = 6; s.spec = S.spillWaveSpec(6, s.seed);
  s.nextRock = s.nextNut = s.nextSpecial = 1000; s.combat.nextEnemy = 60;
  s.combat.build.artifact = artifact;
  return s;
}
function depot(wave = 5, seed = 71) {
  const s = flight(); s.seed = seed; s.wave = s.cleared = wave;
  s.phase = 'depot'; s.depot = { arm: 0, bought: [] }; s.depotVisits = Math.floor(wave / 5);
  return s;
}
function rock(s, x = s.pilot.x + 100, y = s.pilot.y, kind = 'shard', radius = 10) {
  const r = { x, y, vx: 0, vy: 0, r: radius, kind, sprite: 0, spin: 0, rot: 0,
    arc: 0, arcPhase: 0, warn: 0, grazed: false, dead: false };
  s.rocks.push(r); return r;
}
function enemy(s, x, y, hp = 20) {
  const e = { id: s.combat.nextId++, kind: 'pursuer', x, y, vx: 0, vy: 0, r: 12,
    hp, maxHp: hp, age: 1, life: 8.5, cooldown: 99, telegraph: 1,
    telegraphTotal: .9, aimX: s.pilot.x, aimY: s.pilot.y, shotSpeed: 0,
    homeY: y, side: 1, hitFlash: 0, dead: false };
  s.combat.enemies.push(e); return e;
}
function shot(s, x, y, damage = 1, blastRadius) {
  const v = { id: s.combat.nextId++, team: 'player', weapon: 'laser',
    x, y, vx: 600, vy: 0, r: 3, damage, life: 1.4, dead: false };
  if (blastRadius) v.blastRadius = blastRadius;
  s.combat.shots.push(v); return v;
}
function step(s, time = dt, motion = C.captureSpillCombatMotion(s)) {
  C.stepSpillCombat(s, time, motion, { shipRadius: S.SPILL.shipR,
    shatter(r) { if (!r.dead) { r.dead = true; s.shattered++; } },
    damagePilot() { s.hull--; s.hits++; } });
}

test('rare recovery choices are deterministic, without spending either gameplay RNG', () => {
  for (const seed of [0, 1, 71, 0xffffffff]) {
    const s = depot(5, seed), before = [s.rng, s.combat.rng, s.ore];
    const offers = B.spillArtifactOffers(s);
    assert.equal(offers.length, 2); assert.equal(new Set(offers).size, 2);
    assert.deepEqual(B.spillArtifactOffers(s), offers);
    s.depot.arm = .8; assert.deepEqual(B.spillArtifactOffers(s), offers, 'show disabled choices during arming');
    assert.equal(B.spillClaimArtifact(s, offers[0]), false);
    s.depot.arm = 0; assert.equal(B.spillClaimArtifact(s, '__proto__'), false);
    assert(B.spillClaimArtifact(s, offers[0])); assert.equal(s.combat.build.artifact, offers[0]);
    assert.deepEqual(B.spillArtifactOffers(s), []); assert.equal(B.spillClaimArtifact(s, offers[1]), false);
    assert.deepEqual([s.rng, s.combat.rng, s.ore], before);
    for (const wave of [15, 25]) {
      s.wave = s.cleared = wave;
      const next = B.spillArtifactOffers(s); assert(next.length >= 1 && next.length <= 2);
      assert(next.every(id => !s.combat.build.owned.includes(id)));
      assert(B.spillClaimArtifact(s, next[0]));
    }
    assert.equal(s.combat.build.owned.length, 3);
    s.wave = 35; assert.deepEqual(B.spillArtifactOffers(s), []);
  }
  for (const wave of [0, 1, 10, 20, 30]) assert.deepEqual(B.spillArtifactOffers(depot(wave)), []);
});

test('refits are free, Depot-only, run-owned and leave system choices intact', () => {
  const s = depot(), id = B.spillArtifactOffers(s)[0];
  s.freeUpgrade = true; const before = structuredClone(s.up);
  assert.equal(B.spillEquipArtifact(s, id), false);
  assert(B.spillClaimArtifact(s, id)); assert(B.spillEquipArtifact(s, null));
  assert.equal(s.combat.build.artifact, null); assert(B.spillEquipArtifact(s, id));
  assert(s.freeUpgrade); assert.deepEqual(s.up, before); assert.equal(s.ore, 0);
  s.phase = 'wave'; assert.equal(B.spillEquipArtifact(s, null), false);
  assert.deepEqual(flight().combat.build.owned, []);
});

test('recovery saves preserve choices and reject forged ownership or milestone claims', () => {
  const s = depot(), id = B.spillArtifactOffers(s)[0]; B.spillClaimArtifact(s, id);
  const cp = S.spillCheckpoint(s), restored = S.restoreSpill(JSON.parse(JSON.stringify(cp)), 844, 390);
  assert(restored); assert.deepEqual(restored.combat.build, s.combat.build);
  assert.deepEqual(B.spillArtifactOffers(restored), [], 'resume cannot reroll a claimed milestone');
  const legacy = structuredClone(cp); delete legacy.state.combat.build;
  assert.deepEqual(S.restoreSpill(legacy, 390, 760).combat.build, B.createSpillBuild());
  for (const mutate of [
    b => b.owned.push(b.owned[0]), b => b.claimedWaves[0] = 15,
    b => b.claimedWaves[0] = 10, b => b.claimedWaves = [],
    b => b.artifact = '__proto__', b => b.owned[0] = '__proto__',
    b => b.artifact = B.SPILL_ARTIFACT_IDS.find(v => !b.owned.includes(v)),
    b => b.echo = 1, b => b.blasts.push({ x: 0, y: 0, r: 56, life: .22 }),
    b => b.salvageDrops = 9, b => b.salvageDrops = NaN,
  ]) {
    const bad = structuredClone(cp); mutate(bad.state.combat.build);
    assert.equal(S.restoreSpill(bad, 390, 760), null);
  }
  const excluded = B.SPILL_ARTIFACT_IDS.find(v => !B.spillArtifactOffers(depot()).includes(v));
  const bad = structuredClone(cp); bad.state.combat.build.owned = [excluded]; bad.state.combat.build.artifact = excluded;
  assert.equal(S.restoreSpill(bad, 390, 760), null, 'a valid ID was not necessarily offered');
  const skipped = depot(15); B.spillClaimArtifact(skipped, B.spillArtifactOffers(skipped)[0]);
  assert(S.restoreSpill(S.spillCheckpoint(skipped), 390, 760), 'skipping wave5 is legal');
});

test('Reclaimer rewards destruction once, caps at eight, and pays only on collection', () => {
  const s = flight('reclaimer'), before = [s.rng, s.combat.rng];
  for (let i = 0; i < 10; i++) {
    s.rocks = []; const r = rock(s); shot(s, r.x - 15, r.y); step(s);
    assert(r.dead);
  }
  assert.equal(s.combat.build.salvageDrops, 8); assert.equal(s.nuts.length, 8);
  assert.equal(s.ore, 0); assert.equal(s.oreMined, 0);
  assert.deepEqual([s.rng, s.combat.rng], before);
  s.combat.shots = []; s.rocks = [];
  s.nuts[0].x = s.pilot.x; s.nuts[0].y = s.pilot.y;
  S.stepSpill(s, dt); assert.equal(s.ore, 1); assert.equal(s.oreMined, 1);
  C.clearSpillCombat(s); assert.equal(s.combat.build.salvageDrops, 8, 'death/phase cleanup cannot replenish the budget');
  C.beginSpillCombatWave(s); assert.equal(s.combat.build.salvageDrops, 0);
  const stock = flight(); const r = rock(stock); shot(stock, r.x - 15, r.y); step(stock);
  assert.equal(stock.nuts.length, 0);
});

test('Pulse and dodge breaks do not pay Reclaimer bonuses; existing salvage yield still stacks with weapon loot', () => {
  for (const mode of ['pulse', 'dodge']) {
    const s = flight('reclaimer');
    rock(s, s.pilot.x + 35, s.pilot.y);
    if (mode === 'pulse') { s.up.pulse = 1; s.charge = 1; assert(S.spillPulse(s)); }
    else { s.up.thrusters = 3; assert(S.spillLunge(s)); S.stepSpill(s, dt); }
    assert.equal(s.combat.build.salvageDrops, 0); assert.equal(s.nuts.length, 0);
  }
  const s = flight('reclaimer'); s.up.pulse = 2; s.specialties.pulse = 'yield';
  const r = rock(s); shot(s, r.x - 15, r.y); S.stepSpill(s, dt);
  assert.equal(s.combat.build.salvageDrops, 1); assert.equal(s.nuts.length, 2);
});

test('Slipstream requires a successful dodge and manual fire, adds one half-damage echo, and expires', () => {
  for (const direction of [-1, 1]) {
    const s = flight('slipstream'); assert(S.spillLunge(s, direction));
    assert.equal(s.combat.build.echo, 2); assert.equal(s.combat.shots.length, 0);
    assert.equal(S.spillLunge(s, direction), false, 'failed dodge cannot stack or refresh');
    step(s, .4); assert.equal(s.combat.shots.length, 0);
    C.spillTapFire(s); step(s);
    assert.equal(s.combat.shots.length, 2); assert.equal(s.combat.build.echo, 0);
    const [main, echo] = s.combat.shots; assert(echo.echo); assert.equal(echo.damage, main.damage * .5);
    assert(echo.x < main.x); assert.equal(echo.vy, main.vy);
    s.combat.shots = []; s.combat.cooldown = 0; C.spillTapFire(s); step(s);
    assert.equal(s.combat.shots.length, 1);
  }
  const expired = flight('slipstream'); S.spillLunge(expired); step(expired, 2.01);
  C.spillTapFire(expired); step(expired); assert.equal(expired.combat.shots.length, 1);
  const countdown = flight('slipstream'); countdown.phase = 'countdown'; S.spillLunge(countdown);
  assert.equal(countdown.combat.build.echo, 0);
});

test('primed echo pauses with input cancellation but phase cleanup removes it and resize retains budgets', () => {
  const s = flight('slipstream'); S.spillLunge(s); C.spillTapFire(s); C.spillSetFiring(s, true);
  s.combat.build.salvageDrops = 4; C.spillClearFireInput(s);
  assert.equal(s.combat.build.echo, 2); assert.equal(s.combat.pendingFire, 0);
  S.resizeSpill(s, 844, 390); assert.equal(s.combat.build.echo, 2);
  assert.equal(s.combat.build.salvageDrops, 4);
  step(s); assert.equal(s.combat.shots.length, 0);
  C.clearSpillCombat(s); assert.equal(s.combat.build.echo, 0);
});

test('death and extra-life recovery discard primed shots without replenishing same-wave salvage', () => {
  for (const extraLife of [false, true]) {
    const s = flight('slipstream'); s.hull = 1;
    s.coreBought = s.coreArmed = extraLife;
    s.combat.build.echo = 1.7; s.combat.build.salvageDrops = 8;
    s.combat.build.blasts.push({ x: 200, y: 200, r: 56, life: .22 });
    const hostile = shot(s, s.pilot.x, s.pilot.y); hostile.team = 'enemy';
    S.stepSpill(s, dt);
    assert.equal(s.phase, extraLife ? 'respawn' : 'over');
    assert.equal(s.combat.build.echo, 0); assert.equal(s.combat.shots.length, 0);
    assert.deepEqual(s.combat.build.blasts, []); assert.equal(s.combat.build.salvageDrops, 8);
    if (extraLife) {
      S.stepSpill(s, S.SPILL.respawnFreeze + .1);
      assert.equal(s.phase, 'wave'); assert.equal(s.combat.build.salvageDrops, 8);
      C.spillTapFire(s); step(s); assert.equal(s.combat.shots.length, 1);
    }
  }
});

test('Siege uses slower real cooldown and bounded splash, without doubling the direct hit or hurting the pilot', () => {
  for (const id of ['laser', 'cannon']) {
    const stock = flight(), s = flight('siege'); s.combat.weapon = stock.combat.weapon = id;
    assert.equal(C.spillWeaponStats(s).cooldown, C.spillWeaponStats(stock).cooldown * 1.3);
    C.spillTapFire(s); step(s); assert.equal(s.combat.shots[0].blastRadius, 56);
    assert.equal(s.combat.cooldown, C.spillWeaponStats(s).cooldown);
  }
  const s = flight('siege'); const direct = rock(s, 200, s.pilot.y, 'hulk');
  const nearby = rock(s, 220, s.pilot.y + 30, 'hulk'), far = rock(s, 300, s.pilot.y, 'hulk');
  const warned = rock(s, 220, s.pilot.y - 25); warned.warn = 1;
  const e = enemy(s, 220, s.pilot.y + 45);
  shot(s, 175, s.pilot.y, 4, 56); step(s, .05);
  assert.equal(direct.hp, 6); assert.equal(nearby.hp, 8); assert.equal(far.hp, undefined);
  assert.equal(warned.hp, undefined); assert.equal(e.hp, 18); assert.equal(s.hull, 3);
  assert.equal(s.combat.build.blasts.length, 1); assert.equal(s.combat.build.blasts[0].life, .22);
  step(s, .23); assert.equal(s.combat.build.blasts.length, 0);
});

test('Siege splash honors the impact-time position and cannot recursively explode destroyed debris', () => {
  const s = flight('siege'); rock(s, 200, s.pilot.y, 'hulk');
  const moved = rock(s, 220, s.pilot.y + 20, 'hulk');
  const beyond = rock(s, 290, s.pilot.y + 20, 'shard');
  const motion = C.captureSpillCombatMotion(s); moved.y += 300;
  shot(s, 186, s.pilot.y, 4, 56); step(s, .05, motion);
  assert.equal(moved.hp, 8, 'near the impact at the beginning of the tick, despite ending far away');
  assert.equal(beyond.hp, undefined); assert.equal(s.combat.build.blasts.length, 1);
  const many = flight('siege'); rock(many, 200, many.pilot.y, 'hulk');
  for (let i = 0; i < 20; i++) rock(many, 220, many.pilot.y + 25, 'hulk');
  shot(many, 175, many.pilot.y, 4, 56); step(many, .05);
  assert.equal(many.rocks.filter(r => r.hp === 8).length, 12, 'secondary hit budget stays bounded');
});

console.log(`${cases} build cases passed`);
