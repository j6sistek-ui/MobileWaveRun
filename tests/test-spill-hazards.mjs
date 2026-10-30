import assert from 'node:assert/strict';
import * as S from '../dist/js/spill.js';
import * as H from '../dist/js/spill-hazards.js';
import * as C from '../dist/js/spill-combat.js';

const DT = 1 / 60;
const SIZES = [[320, 760], [390, 844], [844, 390], [1280, 720]];
let cases = 0;
const test = (name, run) => { run(); cases++; console.log(`hazards: ${name}`); };
const near = (a, b, message) => assert(Math.abs(a - b) < 1e-6, `${message}: ${a} vs ${b}`);
function flight(wave = 4, W = 390, Ht = 760, seed = 71) {
  const s = S.createSpill(W, Ht, seed, 0, false, false);
  s.phase = 'wave'; s.wave = wave; s.spec = S.spillWaveSpec(wave, seed);
  s.event = 'none'; s.eventWarn = 0; s.eventNext = 1000; s.surgeT = 0; s.surgeFired = true;
  s.nextRock = s.nextNut = s.nextSpecial = 1000; s.combat.nextEnemy = 1000;
  s.pilot.y = Ht / 2; s.waveT = 5;
  H.beginSpillHazardWave(s);
  return s;
}
function admit(s) {
  s.hazards.next = 0; H.admitSpillHazards(s, DT);
  assert(s.hazards.actors.length, `hazard admitted on wave ${s.wave} at ${s.W}×${s.H}`);
  return s.hazards.actors[s.hazards.actors.length - 1];
}
function tick(s, n, each = () => {}) {
  for (let i = 0; i < n; i++) { each(s, i); S.stepSpill(s, DT); }
}
function rock(s, x = s.W * .7, y = s.H * .5) {
  const r = { x, y, vx: -80, vy: 0, r: 12, kind: 'shard', sprite: 0,
    spin: 0, rot: 0, arc: 0, arcPhase: 0, warn: 0, grazed: false, dead: false };
  s.rocks.push(r); return r;
}
function shot(s, team, x, y, vx, damage = 4) {
  const p = { id: s.combat.nextId++, team, weapon: 'laser', x, y, vx, vy: 0,
    r: 3, damage, life: 1.4, dead: false };
  s.combat.shots.push(p); return p;
}

test('teaching order, deterministic plans and bounded endless complexity', () => {
  for (const [wave, kind] of [[4, 'comet'], [7, 'mine'], [11, 'ion'], [16, 'gravity']]) {
    for (const seed of [0, 71, 0xffffffff]) {
      const plan = H.spillHazardPlan(wave, seed);
      assert.deepEqual(plan.families, [kind], `wave ${wave} introduces one family`);
      assert.equal(plan.maxActive, 1);
    }
  }
  const found = new Set();
  for (const seed of [0, 1, 71, 4567, 0xffffffff]) for (let wave = 1; wave <= 100; wave++) {
    const a = H.spillHazardPlan(wave, seed);
    assert.deepEqual(a, H.spillHazardPlan(wave, seed), 'forecast is stable without consuming state');
    assert.equal(a.families.length, new Set(a.families).size);
    assert(a.maxActive >= 0 && a.maxActive <= (wave < 31 ? 1 : 2), 'endless never exceeds two active hazards');
    if (wave < 4) assert.equal(a.families.length, 0);
    for (const kind of a.families) {
      assert(wave >= H.SPILL_HAZARDS[kind].unlock, `${kind} cannot appear before it is taught`);
      found.add(kind);
    }
    if (wave < 41) assert.equal(a.advanced, false, 'advanced patterns follow the earlier lessons');
  }
  assert.deepEqual([...found].sort(), [...H.SPILL_HAZARD_IDS].sort());
});

test('warnings freeze their marked paths and cannot damage or push the ship', () => {
  for (const [W, Ht] of SIZES) for (const wave of [4, 7, 11, 16]) {
    const s = flight(wave, W, Ht), h = admit(s);
    assert(h.warn >= .9, `${h.kind} offers a readable warning`);
    const path = { x: h.x, y: h.y, vx: h.vx, vy: h.vy, aimX: h.aimX, aimY: h.aimY, safeY: h.safeY };
    let hits = 0;
    const beforePilot = { x: s.pilot.x, y: s.pilot.y };
    s.pilot.y += 70;
    H.stepSpillHazards(s, h.warn / 2, beforePilot, { damagePilot() { hits++; } });
    assert.equal(hits, 0, `${h.kind} warning is harmless`);
    assert.deepEqual(H.spillGravityDrift(s), { x: 0, y: 0 }, 'warning fields never apply force');
    assert.deepEqual({ x: h.x, y: h.y, vx: h.vx, vy: h.vy, aimX: h.aimX, aimY: h.aimY, safeY: h.safeY }, path,
      `${h.kind} does not home its marked path onto a moving pilot`);
  }
});

test('hazard admission shares a bounded budget and defers during authored pressure', () => {
  for (const wave of [4, 7, 11, 16, 21, 31, 41, 81]) {
    for (const pressure of ['eventWarn', 'surgeT']) {
      const s = flight(wave); s[pressure] = 2; s.hazards.next = 0;
      H.admitSpillHazards(s, DT);
      assert.equal(s.hazards.actors.length, 0, `no new hazard during ${pressure}`);
    }
    const s = flight(wave), plan = H.spillHazardPlan(wave, s.seed);
    for (let attempt = 0; attempt < 40; attempt++) { s.hazards.next = 0; H.admitSpillHazards(s, DT); }
    assert(s.hazards.actors.length <= plan.maxActive);
    assert(H.spillHazardPressure(s) >= s.hazards.actors.filter(h => !h.dead).length);
  }
  for (const wave of [5, 10, 15, 20, 25, 40, 60]) {
    const s = flight(wave); s.event = 'cargo'; s.hazards.next = 0;
    H.admitSpillHazards(s, DT);
    assert.equal(s.hazards.actors.length, 0, 'milestone event waves retain their own pressure budget');
  }
  const shared = flight(4);
  shared.combat.nextEnemy = 0; C.admitSpillEnemies(shared, DT);
  assert.equal(shared.combat.enemies.length, 1);
  const enemy = shared.combat.enemies[0];
  enemy.x = shared.W * .75; enemy.y = shared.pilot.y; enemy.cooldown = 0;
  admit(shared);
  shared.combat.nextEnemy = 0; C.admitSpillEnemies(shared, DT);
  assert.equal(shared.combat.enemies.length, 1, 'hazards replace new enemy pressure rather than piling onto it');
  C.stepSpillCombat(shared, DT, C.captureSpillCombatMotion(shared), {
    shipRadius: S.SPILL.shipR, shatter() {}, damagePilot() {},
  });
  assert.equal(enemy.telegraph, 0, 'existing enemies wait before starting a fresh attack during a hazard');
  H.clearSpillHazards(shared);
  C.stepSpillCombat(shared, DT, C.captureSpillCombatMotion(shared), {
    shipRadius: S.SPILL.shipR, shatter() {}, damagePilot() {},
  });
  assert(enemy.telegraph > 0, 'enemy attacks resume once the environmental pressure ends');
  const pendingShot = flight(4);
  shot(pendingShot, 'enemy', pendingShot.W * .8, pendingShot.pilot.y, -100);
  pendingShot.hazards.next = 0; H.admitSpillHazards(pendingShot, DT);
  assert.equal(pendingShot.hazards.actors.length, 0, 'an incoming enemy shot is not overlaid by a new hazard warning');
});

test('reserving a new warning never silently removes visible debris', () => {
  for (const [W, Ht] of SIZES) for (const wave of [4, 7, 11, 16]) {
    const s = flight(wave, W, Ht);
    for (const y of [.2, .35, .5, .65, .8]) rock(s, W * .6, Ht * y);
    const before = JSON.stringify(s.rocks);
    s.hazards.next = 0;
    H.admitSpillHazards(s, DT, (r, t) => S.spillRockAt(s, r, t));
    assert.equal(JSON.stringify(s.rocks), before, 'the director must reject a blocked route instead of deleting visible obstacles');
    assert.equal(s.shattered, 0); assert.equal(s.oreMined, 0);
  }
});

test('stock steering can escape a comet or ion lane in either direction after its warning', () => {
  for (const [W, Ht] of SIZES) for (const wave of [4, 11]) for (const direction of [-1, 1]) {
    const s = flight(wave, W, Ht), h = admit(s);
    s.hazards.next = 1000; s.spec.dur = 100;
    if (h.kind === 'comet') {
      const speed = Math.hypot(h.vx, h.vy);
      const distance = Math.hypot(h.x - h.aimX, h.y - h.aimY) - h.r - S.SPILL.shipR;
      assert(distance / speed >= .75 - 1e-8, 'comet preserves travel lead after the telegraph');
    }
    S.spillSteer(s, direction);
    tick(s, 240);
    assert.equal(s.hull, 3, `${h.kind} remains avoidable with stock ${direction < 0 ? 'up' : 'down'} steering at ${W}×${Ht}`);
    assert.equal(s.hits, 0);
  }
});

test('gravity is bounded and cannot pin full inward steering against a soft edge', () => {
  for (const [W, Ht] of SIZES) for (const direction of [-1, 1]) {
    const s = flight(16, W, Ht), h = admit(s);
    s.hazards.next = 1000; s.spec.dur = 100;
    h.warn = 0; h.phase = 'active'; h.age = 2; h.activeTime = 1; h.life = 20;
    // Isolate steering against a fully developed force. The natural scheduler
    // sweep below retains well travel and the full approach warning.
    h.vx = h.vy = 0;
    s.pilot.y = direction < 0 ? Ht - 35 : 35;
    h.x = s.pilot.x + 70; h.y = direction < 0 ? Ht - 45 : 45;
    const startY = s.pilot.y;
    for (let i = 0; i < 90; i++) {
      const force = H.spillGravityDrift(s);
      assert(Math.abs(force.x) <= 30 + 1e-8 && Math.abs(force.y) <= 55 + 1e-8);
      S.spillSteer(s, direction); S.stepSpill(s, DT);
    }
    assert((s.pilot.y - startY) * direction > 80, `gravity cannot trap inward steering at ${W}×${Ht}`);
    assert.equal(s.hull, 3);
    assert(s.pilot.y >= 22 && s.pilot.y <= Ht - 22, 'field forces respect soft bounds');
  }
});

test('gravity curves accepted debris and the admission predictor matches the live path', () => {
  const s = flight(16, 844, 390), h = admit(s);
  s.hazards.next = 1000; s.spec.dur = 100;
  h.warn = 0; h.phase = 'active'; h.age = 2; h.life = 20;
  h.x = s.W * .7; h.y = s.H * .5;
  const r = rock(s, h.x + 40, h.y - 60);
  S.stepSpill(s, DT);
  assert(r.gravityBend, 'an isolated nearby rock receives the bounded gravity bend');
  const beforeY = r.y;
  for (let i = 0; i < 60; i++) {
    const expected = S.spillRockAt(s, r, DT);
    S.stepSpill(s, DT);
    near(r.x, expected.x, 'predicted x equals authoritative motion');
    near(r.y, expected.y, 'predicted curved y equals authoritative motion');
  }
  assert(Math.abs(r.y - beforeY) > 1, 'gravity affects debris rather than only drawing a warning');
  assert.equal(s.hull, 3);
});

test('late compatible pairs reserve a reachable common refuge for a stock ship', () => {
  for (const [W, Ht] of SIZES) for (const wave of [31, 41, 81]) {
    const seed = Array.from({ length: 30 }, (_, n) => n).find(n => H.spillHazardPlan(wave, n).maxActive === 2);
    assert.notEqual(seed, undefined);
    const s = flight(wave, W, Ht, seed), first = admit(s);
    s.spec.dur = 100;
    first.warn = 0; first.phase = 'active'; first.activeTime = 1;
    const second = admit(s);
    assert.equal(s.hazards.actors.length, 2);
    assert.equal(first.safeY, second.safeY, 'both threats describe one surviving route');
    assert(Math.abs(second.safeY - s.pilot.y) <= 220, 'refuge stays inside stock reaction reach');
    const safeY = second.safeY;
    s.hazards.next = 1000;
    tick(s, 300, () => S.spillSteer(s, Math.max(-1, Math.min(1, (safeY - s.pilot.y) / 65))));
    assert.equal(s.hull, 3, `announced refuge survives paired threats on wave ${wave} at ${W}×${Ht}`);
  }
});

test('advanced moving gravity cores keep the announced refuge safe for their entire pass', () => {
  // Independent movement review found seed22's descending well could reach
  // the refuge it had marked as safe. Exercise middle and edge entry positions.
  for (const [W, Ht, seed, fraction, y] of [
    [320, 760, 22, .22, 380], [320, 760, 22, .08, 30], [320, 760, 22, .5, 30],
    [320, 760, 22, .08, 380], [320, 760, 22, .5, 380],
    [844, 390, 22, .08, 360], [844, 390, 22, .5, 360], [844, 390, 23, .08, 30],
  ]) {
    const s = flight(41, W, Ht, seed);
    s.spec.dur = 100; s.pilot.x = W * fraction; s.pilot.y = y;
    const h = admit(s);
    assert.equal(h.kind, 'gravity'); assert.equal(h.variant, 1);
    s.hazards.next = 1000;
    for (let frame = 0; frame < 620 && !h.dead; frame++) {
      S.spillSteer(s, Math.max(-1, Math.min(1, (h.safeY - s.pilot.y) / 65)));
      S.stepSpill(s, DT);
      assert.equal(s.hull, 3, `marked gravity refuge remains safe at ${W}×${Ht}, seed${seed}, x${fraction}, y${y}, frame${frame}`);
    }
    assert(h.dead, 'the well completes its pass without pinning the ship');
  }
});

test('warning expiry grants only the remaining travel time; active contacts are swept', () => {
  const s = flight(), h = admit(s), initialX = s.pilot.x + 200;
  h.x = initialX; h.y = s.pilot.y; h.vx = -12000; h.vy = 0;
  h.warn = DT / 2; h.phase = 'warning'; h.life = 10;
  let hits = 0;
  const pilot = { x: s.pilot.x, y: s.pilot.y };
  H.stepSpillHazards(s, DT, pilot, { damagePilot() { hits++; } });
  assert.equal(hits, 0, 'a warning ending mid-frame cannot grant a full frame of travel');
  assert(h.x >= initialX - 100 - 1e-6);
  H.stepSpillHazards(s, DT, pilot, { damagePilot() { hits++; } });
  assert.equal(hits, 1, 'fast comet crossing the ship cannot tunnel between endpoints');

  const moving = flight(), fixed = admit(moving);
  fixed.x = moving.pilot.x; fixed.y = moving.pilot.y; fixed.vx = fixed.vy = 0;
  fixed.warn = 0; fixed.phase = 'active'; fixed.life = 10;
  const before = { x: moving.pilot.x, y: moving.pilot.y - 120 };
  moving.pilot.y += 120;
  let crossed = 0;
  H.stepSpillHazards(moving, DT, before, { damagePilot() { crossed++; } });
  assert.equal(crossed, 1, 'a pilot crossing the core is included in the relative sweep');
});

test('all hazard contacts use the same sixteen-pixel ship core as debris and projectiles', () => {
  assert.equal(S.SPILL.shipR, 16, 'fixture follows the actual playable ship collision radius');
  for (const wave of [4, 7, 11, 16]) for (const outside of [false, true]) {
    const s = flight(wave), h = admit(s);
    h.warn = 0; h.phase = 'active'; h.activeTime = 1; h.vx = h.vy = 0; h.life = 10;
    const reach = (h.kind === 'mine' ? h.range : h.r) + S.SPILL.shipR;
    const distance = reach + (outside ? 5.9 : -.1);
    if (h.kind === 'ion') { h.y = s.pilot.y + distance; h.fuse = .45; }
    else { h.x = s.pilot.x + distance; h.y = s.pilot.y; }
    if (h.kind === 'mine') h.fuse = DT / 2;
    let hits = 0;
    H.stepSpillHazards(s, DT, { x: s.pilot.x, y: s.pilot.y }, { damagePilot() { hits++; } });
    assert.equal(hits, outside ? 0 : 1, `${h.kind} ${outside ? 'must not hit the former six-pixel oversized rim' : 'must hit a true core overlap'}`);
  }
  for (const outside of [false, true]) {
    const s = flight(7), h = admit(s);
    h.warn = 0; h.phase = 'active'; h.vx = h.vy = 0;
    h.x = s.pilot.x + h.range + S.SPILL.shipR + (outside ? 5.9 : -.1); h.y = s.pilot.y;
    H.stepSpillHazards(s, DT, { x: s.pilot.x, y: s.pilot.y }, { damagePilot() {} });
    assert.equal(h.fuse >= 0, !outside, 'mine proximity uses the same ship core as its blast');
  }
});

test('counterfire and comet contact resolve in time order within the same simulation tick', () => {
  for (const earlyShot of [true, false]) {
    const s = flight(4, 844, 390), h = admit(s);
    s.hazards.next = 1000;
    h.warn = 0; h.phase = 'active'; h.life = 10; h.hp = 1;
    h.x = s.pilot.x + 40; h.y = s.pilot.y; h.vx = -600; h.vy = 0;
    const laser = shot(s, 'player', s.pilot.x + (earlyShot ? 20 : 4), s.pilot.y, 540, 1);
    const shotTime = (h.x - laser.x - h.r - laser.r) / (laser.vx - h.vx);
    const shipTime = (h.x - s.pilot.x - h.r - S.SPILL.shipR) / -h.vx;
    assert(shotTime > 0 && shotTime < DT && shipTime > 0 && shipTime < DT);
    assert.equal(shotTime < shipTime, earlyShot, 'fixture contains the intended event ordering');
    S.stepSpill(s, DT);
    assert.equal(s.hull, earlyShot ? 3 : 2,
      earlyShot ? 'a round that destroys the comet first prevents its later ship impact'
        : 'a round arriving after ship contact cannot retroactively erase damage');
    assert.equal(s.hits, earlyShot ? 0 : 1);
    assert(h.dead);
  }
});

test('a mine disarms before its fuse expires, but a later shot cannot undo its explosion', () => {
  for (const earlyShot of [true, false]) {
    const s = flight(7), mine = admit(s);
    s.hazards.next = 1000;
    mine.warn = 0; mine.phase = 'active'; mine.life = 10; mine.hp = 1;
    mine.x = s.pilot.x + 60; mine.y = s.pilot.y; mine.vx = mine.vy = 0;
    mine.fuse = .010;
    const laser = shot(s, 'player', s.pilot.x + (earlyShot ? 36 : 30), s.pilot.y, 1000, 1);
    const shotTime = (mine.x - laser.x - mine.r - laser.r) / laser.vx;
    assert(shotTime > 0 && shotTime < DT);
    assert.equal(shotTime < mine.fuse, earlyShot, 'shot and fuse have the intended temporal order');
    S.stepSpill(s, DT);
    assert.equal(s.hull, earlyShot ? 3 : 2,
      earlyShot ? 'counterfire before detonation prevents damage' : 'counterfire after detonation cannot refund damage');
    assert.equal(s.hits, earlyShot ? 0 : 1);
    assert.equal(s.nuts.length, earlyShot ? 1 : 0, 'salvage belongs only to a mine disarmed before exploding');
    assert.equal(s.shattered, 0); assert.equal(s.combat.kills, 0);
  }
});

test('mine shooting respects cover and awards one physical coin without rock or enemy credit', () => {
  const s = flight(7), mine = admit(s);
  s.hazards.next = 1000;
  mine.warn = 0; mine.phase = 'active'; mine.x = s.pilot.x + 120; mine.y = s.pilot.y;
  mine.vx = mine.vy = 0; mine.life = 10;
  const cover = rock(s, s.pilot.x + 60, s.pilot.y); cover.vx = 0;
  shot(s, 'player', s.pilot.x + 20, s.pilot.y, 24000);
  S.stepSpill(s, DT);
  assert(cover.dead, 'nearest debris consumes the round');
  assert.equal(mine.dead, false); assert.equal(mine.hp, mine.maxHp);
  const shattered = s.shattered, kills = s.combat.kills, mined = s.oreMined;
  shot(s, 'player', s.pilot.x + 20, s.pilot.y, 24000);
  S.stepSpill(s, DT);
  assert(mine.dead, 'the next clear shot disarms the mine');
  assert.equal(s.nuts.length, 1);
  assert.equal(s.nuts[0].kind, 'ore');
  assert.equal(s.oreMined, mined, 'a drop is not credited before collection');
  assert.equal(s.shattered, shattered); assert.equal(s.combat.kills, kills);
  H.damageSpillHazard(s, mine, 99); H.spillHazardPulse(s, 500);
  assert.equal(s.nuts.length, 1, 'already disarmed mines cannot pay twice');
  s.nuts[0].x = s.pilot.x; s.nuts[0].y = s.pilot.y; s.nuts[0].vx = s.nuts[0].vy = 0;
  S.stepSpill(s, DT);
  assert.equal(s.oreMined, mined + 1, 'collection uses the existing salvage ledger');

  const pulse = flight(7), other = admit(pulse);
  other.warn = 0; other.phase = 'active'; other.x = pulse.pilot.x + 55; other.y = pulse.pilot.y;
  other.vx = other.vy = 0; pulse.up.pulse = 1; pulse.charge = 1;
  assert(S.spillPulse(pulse));
  assert(other.dead); assert.equal(pulse.nuts.length, 1);
  assert.equal(pulse.shattered, 0); assert.equal(pulse.combat.kills, 0);
  assert.equal(pulse.hull, 3);
});

test('mine proximity has a readable fuse and can be escaped without a weapon', () => {
  for (const [W, Ht] of SIZES) for (const direction of [-1, 1]) {
    const s = flight(7, W, Ht), mine = admit(s);
    s.hazards.next = 1000; s.spec.dur = 100;
    mine.warn = 0; mine.phase = 'active'; mine.x = s.pilot.x + 60; mine.y = s.pilot.y;
    mine.vx = mine.vy = 0; mine.life = 10;
    S.stepSpill(s, DT);
    assert.equal(s.hull, 3, 'entering proximity does not explode immediately');
    assert(mine.fuse >= .9 - DT - 1e-6, 'mine grants its full reaction fuse');
    S.spillSteer(s, direction); tick(s, 100);
    assert.equal(s.hull, 3, `stock ${direction < 0 ? 'up' : 'down'} movement escapes the mine at ${W}×${Ht}`);
    assert.equal(s.oreMined, 0, 'an avoided mine cannot grant disarm salvage');
  }
});

test('advanced ion bands shift only after a fresh warning and stock steering survives all pulses', () => {
  const seed = Array.from({ length: 200 }, (_, n) => n).find(n => H.spillHazardPlan(41, n).families[0] === 'ion');
  assert.notEqual(seed, undefined);
  for (const [W, Ht] of SIZES) {
    const s = flight(41, W, Ht, seed), h = admit(s);
    assert.equal(h.kind, 'ion'); assert.equal(h.variant, 1);
    s.spec.dur = 100; s.hazards.next = 1000;
    let transitions = 0, beforeY = h.y;
    const bands = new Set([h.y]);
    for (let frame = 0; frame < 450 && !h.dead; frame++) {
      S.spillSteer(s, Math.max(-1, Math.min(1, (h.safeY - s.pilot.y) / 65)));
      S.stepSpill(s, DT);
      if (h.y !== beforeY) {
        transitions++; bands.add(h.y);
        assert.equal(h.phase, 'warning', 'a charged band never moves while active');
        assert(h.warn >= 1.2 - 1e-8, 'each shifted band receives a full new telegraph');
        beforeY = h.y;
      }
      assert.equal(s.hull, 3, `following the newly announced refuge avoids ion damage at ${W}×${Ht}`);
    }
    assert.equal(h.pulse, 3, 'unblocked advanced ion pattern completes three pulses');
    assert.equal(transitions, 2); assert(bands.size >= 2);
    assert(h.dead, 'the three-pulse pattern retires instead of continuing indefinitely');
  }
});

test('same seed and input reproduce mixed endless encounters', () => {
  function replay(seed) {
    const s = flight(41, 844, 390, seed);
    s.spec.dur = 100; s.hull = s.maxHull = 30; s.up.plating = 27;
    // Extra health keeps this deterministic mixed-pressure fixture running;
    // counterplay tests above retain the normal stock hull and controls.
    s.nextRock = .8; s.nextNut = 1; s.combat.nextEnemy = 2;
    for (let frame = 0; frame < 1200; frame++) {
      if (frame % 60 === 0) S.spillSteer(s, [.6, -.6, 0][Math.floor(frame / 60) % 3]);
      if (frame % 150 === 0) S.spillLunge(s, frame % 300 ? -1 : 1);
      if (frame % 15 === 0) C.spillTapFire(s);
      S.stepSpill(s, DT);
      assert(s.hazards.actors.filter(h => !h.dead).length <= 2);
      assert(s.combat.shots.length <= 64);
    }
    assert(s.hazards.spawned > 0, 'replay actually admits environmental hazards');
    return JSON.stringify(s);
  }
  assert.equal(replay(71), replay(71));
  assert.notEqual(replay(71), replay(72));
});

test('natural full-wave schedules admit hazards and real late pairs without starving narrow fields', () => {
  const results = [];
  for (const [W, Ht] of SIZES) for (const wave of [4, 7, 11, 16, 31, 41]) {
    for (const seed of [1, 7, 19, 37, 71, 101, 307, 997]) {
      const s = S.createSpill(W, Ht, seed, 0, false, false);
      s.phase = 'wave'; s.phaseT = 0; s.wave = wave; s.waveT = 0;
      s.spec = S.spillWaveSpec(wave, seed); s.liveMods = s.spec.mods.slice(); s.event = 'none';
      C.beginSpillCombatWave(s); H.beginSpillHazardWave(s);
      s.iframes = 1000;
      // Invulnerability observes scheduling for the full wave. Timers, enemy
      // fire, debris, warning/fuse time and admission limits remain production values.
      const seen = new Set(), families = new Set();
      let maximum = 0, pairFrames = 0, frames = 0;
      while (s.phase === 'wave' && frames < 6000) {
        const target = s.H * (.5 + .15 * Math.sin(frames / 150));
        S.spillSteer(s, Math.max(-.7, Math.min(.7, (target - s.pilot.y) / 80)));
        S.stepSpill(s, DT); frames++;
        const live = s.hazards.actors.filter(h => !h.dead);
        for (const h of live) {
          if (!seen.has(h.id)) {
            assert(h.warn >= 1.2 - DT * 2, 'endless combinations keep the same reaction floor');
            if (h.kind === 'comet') {
              const distance = Math.hypot(h.x - h.aimX, h.y - h.aimY) - h.r - S.SPILL.shipR;
              assert(distance / Math.hypot(h.vx, h.vy) >= .75 - 1e-8);
            }
          }
          seen.add(h.id); families.add(h.kind);
        }
        maximum = Math.max(maximum, live.length);
        if (live.length === 2) pairFrames++;
        assert(live.length <= H.spillHazardPlan(wave, seed).maxActive);
      }
      assert(frames < 6000, 'normal wave timer reaches drain');
      assert(seen.size > 0, `hazard admission cannot starve wave ${wave}, seed ${seed}, ${W}×${Ht}`);
      if (wave < 21) assert.equal(families.size, 1, 'first lessons only admit the named new family');
      results.push({ W, H: Ht, wave, seed, admitted: seen.size, maximum, pairFrames });
    }
  }
  for (const [W, Ht] of SIZES) {
    assert(results.some(r => r.W === W && r.H === Ht && r.pairFrames > 0),
      `late scheduling actually overlaps a compatible pair at ${W}×${Ht}`);
  }
  console.log(JSON.stringify({ scheduleRuns: results.length,
    minimumAdmissions: Math.min(...results.map(r => r.admitted)),
    maximumConcurrent: Math.max(...results.map(r => r.maximum)),
    runsWithPairs: results.filter(r => r.pairFrames > 0).length }));
});

test('Depot migration rejects live or malformed hazards and transitions clear their effects', () => {
  const s = flight(16), h = admit(s);
  h.phase = 'active'; h.warn = 0; h.activeTime = 2;
  s.phase = 'depot'; s.wave = s.cleared = 15; s.depot = { arm: 0, bought: [] };
  s.depotVisits = 3; s.combat.nextEnemy = 4;
  const raw = S.spillCheckpoint(s);
  assert(raw);
  assert.deepEqual(raw.state.hazards.actors, [], 'checkpoint construction drops live fields and warnings');
  const restored = S.restoreSpill(raw, 844, 390);
  assert(restored); assert.deepEqual(restored.hazards.actors, []);
  assert.deepEqual(H.spillGravityDrift(restored), { x: 0, y: 0 });
  const legacy = structuredClone(raw); delete legacy.state.hazards;
  const migrated = S.restoreSpill(legacy, 390, 760);
  assert(migrated); assert.deepEqual(migrated.hazards.actors, []);
  const bads = [
    b => { b.state.hazards.actors = [h]; },
    b => { b.state.hazards.rng = -1; },
    b => { b.state.hazards.next = NaN; },
    b => { b.state.hazards.nextId = 0; },
    b => { b.state.hazards.spawned = 50; },
  ];
  for (const corrupt of bads) {
    const bad = structuredClone(raw); corrupt(bad);
    assert.equal(S.restoreSpill(bad, 390, 760), null, 'bad hazard state cannot enter a resumed run');
  }
  tick(restored, Math.ceil(S.SPILL.depotArm * 60) + 1);
  assert(S.spillLeaveDepot(restored));
  assert.equal(restored.phase, 'countdown');
  assert.deepEqual(restored.hazards.actors, []);
  tick(restored, 181);
  assert.equal(restored.phase, 'wave'); assert.equal(restored.wave, 16);
  assert.equal(restored.hazards.spawned, 0, 'new wave starts with its own bounded admission count');

  const dead = flight(), comet = admit(dead);
  const bentRock = rock(dead, dead.W * .8, dead.H * .2);
  bentRock.gravityBend = { start: dead.t, duration: 2.4, strength: 26 };
  bentRock.gravityWell = comet.id;
  dead.hull = 1; comet.phase = 'active'; comet.warn = 0;
  comet.x = dead.pilot.x + 80; comet.y = dead.pilot.y; comet.vx = -12000; comet.vy = 0;
  S.stepSpill(dead, DT);
  assert.equal(dead.phase, 'over');
  assert.deepEqual(dead.hazards.actors, [], 'death never leaves a live field running behind results');
  assert.equal(bentRock.gravityBend, undefined, 'cleared fields leave no invisible debris curvature');
  assert.equal(bentRock.gravityWell, undefined);
});

console.log(`${cases} hazard cases passed (source/geometry checks, not device or long-run balance acceptance)`);
