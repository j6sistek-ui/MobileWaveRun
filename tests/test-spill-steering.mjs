import assert from 'node:assert/strict';
import * as S from '../dist/js/spill.js';

const DT = 1 / 60;
let cases = 0;
const test = (name, run) => { run(); cases++; console.log(`  ${name}`); };
const near = (actual, expected, message) => assert(Math.abs(actual - expected) < 1e-8, `${message}: ${actual} vs ${expected}`);
// Isolate motion from encounter scheduling. No immunity or collision overrides:
// a separate collision fixture below still exercises health and impact knockback.
function flight(W = 390, H = 760) {
  const s = S.createSpill(W, H, 71, 0, false, false);
  s.phase = 'wave'; s.nextRock = s.nextNut = s.nextSpecial = 1000;
  s.combat.nextEnemy = 1000;
  s.pilot.y = H / 2;
  return s;
}
function ticks(s, count) { for (let i = 0; i < count; i++) S.stepSpill(s, DT); }
function impact(s, kind = 'tumbler', dx = 0) {
  s.rocks.push({ x: s.pilot.x + dx, y: s.pilot.y, vx: 0, vy: 0, r: 12, kind,
    sprite: 0, spin: 0, rot: 0, arc: 0, arcPhase: 0, warn: 0, grazed: true, dead: false });
  S.stepSpill(s, DT);
}

test('neutral holds altitude; taps and legacy burst have no vertical kick', () => {
  const s = flight(), y = s.pilot.y;
  ticks(s, 120); assert.equal(s.pilot.y, y); assert.equal(s.pilot.vy, 0);
  assert.equal(S.spillTap(s), false); assert.equal(s.pilot.vy, 0);
  assert(S.spillBurst(s, -1)); assert.equal(s.steerY, -1); assert.equal(s.pilot.vy, 0);
  S.spillSteer(s, 0); ticks(s, 20); assert.equal(s.pilot.y, y);
});

test('climb and descent are symmetric, analog, and acceleration limited', () => {
  const up = flight(), down = flight(), half = flight();
  S.spillSteer(up, -1); S.spillSteer(down, 1); S.spillSteer(half, .5);
  assert.equal(up.pilot.vy, 0, 'input cannot teleport velocity');
  ticks(up, 1); ticks(down, 1);
  near(up.pilot.vy, -S.SPILL.steerAcceleration * DT, 'first upward acceleration');
  near(down.pilot.vy, S.SPILL.steerAcceleration * DT, 'first downward acceleration');
  ticks(up, 23); ticks(down, 23); ticks(half, 24);
  near(up.pilot.y + down.pilot.y, up.H, 'equal distance in opposite directions');
  near(up.pilot.vy, -300, 'up speed'); near(down.pilot.vy, 300, 'down speed');
  near(half.pilot.vy, 150, 'half stick requests half speed');
  assert(up.pilot.rot < 0 && down.pilot.rot > 0 && up.thrustT > 0);
});

test('release stops within 150ms and then holds without residual drift', () => {
  const s = flight(); S.spillSteer(s, 1); ticks(s, 20);
  const y = s.pilot.y;
  S.spillSteer(s, 0); ticks(s, 9);
  assert.equal(s.pilot.vy, 0); assert(s.pilot.y - y <= 20, 'bounded stopping distance');
  const held = s.pilot.y; ticks(s, 120);
  assert.equal(s.pilot.y, held); assert.equal(s.pilot.rot, 0); assert.equal(s.thrustT, 0);
});

test('axis clamps and invalid numbers release; inactive phases reject steering', () => {
  const s = flight();
  S.spillSteer(s, -20); assert.equal(s.steerY, -1);
  S.spillSteer(s, 20); assert.equal(s.steerY, 1);
  for (const value of [NaN, Infinity, -Infinity]) { S.spillSteer(s, value); assert.equal(s.steerY, 0); }
  for (const phase of ['ready', 'docking', 'depot', 'respawn', 'over']) {
    s.phase = phase; s.steerY = 1;
    assert.equal(S.spillSteer(s, -1), false); assert.equal(s.steerY, 0);
  }
});

test('both soft edges remain safe, slow outward travel and allow immediate escape', () => {
  for (const [W, H] of [[320, 760], [390, 844], [1280, 720]]) for (const dir of [-1, 1]) {
    const s = flight(W, H); s.shield = 1; s.coreArmed = true; s.charge = .5;
    s.pilot.y = dir < 0 ? 32 : H - 32;
    S.spillSteer(s, dir); ticks(s, 30);
    assert(Math.abs(s.pilot.vy) < 10, 'outward speed eases near the edge');
    ticks(s, 150);
    assert(s.pilot.y >= 22 && s.pilot.y <= H - 22);
    assert.equal(s.hull, 3); assert.equal(s.hits, 0); assert.equal(s.shield, 1);
    assert.equal(s.coreArmed, true); assert.equal(s.charge, .5); assert.equal(s.floorT, 0);
    const edgeY = s.pilot.y; S.spillSteer(s, -dir); ticks(s, 8);
    assert((s.pilot.y - edgeY) * -dir > 10, 'the edge never traps inward steering');
  }
});

test('left/right dodges share charges, speed, cooldown, bounds and home return', () => {
  const left = flight(1280), right = flight(1280), home = left.pilot.x;
  for (const [s, dir] of [[left, -1], [right, 1]]) {
    assert.equal(S.spillLunge(s, 0), false); assert.equal(s.lungeCharges, 1);
    assert(S.spillLunge(s, dir)); assert.equal(s.lungeCharges, 0);
    assert.equal(S.spillLunge(s, -dir), false, 'a spent charge blocks either direction');
    ticks(s, 6); assert.equal(Math.sign(s.pilot.vx), dir);
    near(s.pilot.vx, dir * S.SPILL.lungeSpeed, 'signed dodge velocity');
  }
  near(home - left.pilot.x, right.pilot.x - home, 'symmetric displacement away from bounds');
  ticks(left, 30); ticks(right, 30);
  assert.equal(left.lungeCharges, 1); assert.equal(right.lungeCharges, 1);
  const gap = right.pilot.x - home; ticks(right, 120);
  assert(Math.abs(right.pilot.x - home) < gap / 2, 'dodge settles toward the home lane');
  const narrow = flight(320);
  for (let i = 0; i < 3; i++) { S.spillLunge(narrow, -1); ticks(narrow, 36); }
  assert(narrow.pilot.x >= narrow.W * S.SPILL.bandLeft);
});

test('countdown control preserves held steering and dodges immediately without delayed movement', () => {
  const s = S.createSpill(390, 760, 11, 0, false, false);
  S.spillTap(s); S.spillSteer(s, 0); assert.equal(s.manual, false);
  S.spillSteer(s, -.5); assert.equal(s.manual, true);
  ticks(s, Math.ceil(S.SPILL.countdown / DT) + 1);
  assert.equal(s.phase, 'wave'); assert.equal(s.steerY, -.5);
  for (const dir of [-1, 1]) {
    const d = S.createSpill(1280, 760, 12, 0, false, false); S.spillTap(d);
    const x = d.pilot.x; assert(S.spillLunge(d, dir)); assert(d.manual);
    ticks(d, 1); assert((d.pilot.x - x) * dir > 0, 'dodge moves during the count');
    ticks(d, 35); assert.equal(d.lunge, 0); assert.equal(d.lungeCharges, 1);
    ticks(d, Math.ceil(S.SPILL.countdown / DT));
    assert.equal(d.phase, 'wave'); assert.equal(d.lunge, 0);
    assert(Math.abs(d.pilot.vx) < 1, 'a consumed countdown dodge cannot suddenly start on GO');
  }
});

test('Thrusters improve acceleration and dodge speed; extra charges and shard sweeping remain', () => {
  const base = flight(), tier = flight(); tier.up.thrusters = 3;
  for (const s of [base, tier]) { S.spillSteer(s, 1); ticks(s, 1); }
  near(tier.pilot.vy / base.pilot.vy, 1.45, 'tier III steering acceleration');
  ticks(base, 19); ticks(tier, 19); assert.equal(base.pilot.vy, tier.pilot.vy, 'top speed stays readable');
  const two = flight(1280); two.up.thrusters = 2; ticks(two, 1);
  assert.equal(two.lungeCharges, 2); assert(S.spillLunge(two, -1)); ticks(two, 1);
  near(two.pilot.vx, -S.SPILL.lungeSpeed * 1.3, 'tier II dodge speed');
  assert(S.spillLunge(two, 1)); assert.equal(two.lungeCharges, 0);
  for (const dir of [-1, 1]) {
    const sweep = flight(1280); sweep.up.thrusters = 3;
    S.spillLunge(sweep, dir); impact(sweep, 'shard', dir * 22);
    assert.equal(sweep.shattered, 1); assert.equal(sweep.hits, 0);
  }
  const precision = flight(); precision.up.thrusters = 3; precision.specialties.thrusters = 'precision';
  S.spillSteer(precision, 1); ticks(precision, 1);
  near(precision.pilot.vy, S.SPILL.steerAcceleration * 1.15 * DT, 'Precision stays at tier I response');
});

test('Brake improves neutral stopping, without automatic upward movement', () => {
  const stock = flight(), brake = flight(); brake.utilities = ['brake'];
  for (const s of [stock, brake]) { s.pilot.vy = 300; S.spillSteer(s, 0); ticks(s, 1); }
  near(300 - brake.pilot.vy, (300 - stock.pilot.vy) * 1.5, 'Brake stopping rate');
  ticks(stock, 8); ticks(brake, 8); assert.equal(brake.pilot.vy, 0);
  assert(brake.pilot.y < stock.pilot.y, 'Brake reduces stopping distance');
  brake.pilot.y = brake.H - 22; ticks(brake, 120);
  assert.equal(brake.pilot.y, brake.H - 22); assert.equal(brake.pilot.vy, 0);
});

test('LOW-G and HEAVY change response gradually while neutral remains stable', () => {
  const velocities = [];
  for (const mod of ['lowg', 'heavy']) {
    const s = flight(); s.liveMods = [mod]; s.modRamp = S.SPILL.modRamp;
    const y = s.pilot.y; ticks(s, 5); assert.equal(s.pilot.y, y);
    S.spillSteer(s, 1); ticks(s, 1); velocities.push(s.pilot.vy);
  }
  near(velocities[0], S.SPILL.steerAcceleration * DT * 1.2, 'LOW-G acceleration');
  near(velocities[1], S.SPILL.steerAcceleration * DT * .8, 'HEAVY acceleration');
  const start = flight(); start.liveMods = ['heavy']; S.spillSteer(start, 1); ticks(start, 1);
  assert(start.pilot.vy > velocities[1], 'the heavy rule ramps in rather than switching fully at GO');
});

test('real collisions still knock back, and fatal/respawn/clear transitions cancel input', () => {
  const s = flight(); impact(s);
  assert.equal(s.hits, 1); assert.equal(s.hull, 2); assert(s.pilot.vy < 0 && s.knock > 0);
  const x = s.pilot.x; ticks(s, 1); assert(s.pilot.x < x, 'horizontal impact knock remains');
  for (const core of [false, true]) {
    const hit = flight(); hit.hull = 1; hit.coreArmed = core;
    S.spillSteer(hit, 1); S.spillLunge(hit, -1); impact(hit);
    assert.equal(hit.phase, core ? 'respawn' : 'over');
    assert.equal(hit.steerY, 0); assert.equal(hit.lunge, 0); assert.equal(hit.lungeDir, 1);
  }
  for (const [wave, target, phase] of [[1, 0, 'countdown'], [5, 0, 'docking'], [1, 1, 'over']]) {
    const cleared = flight(); cleared.wave = wave; cleared.target = target; cleared.phase = 'drain';
    S.spillSteer(cleared, 1); S.spillLunge(cleared, -1); ticks(cleared, 1);
    assert.equal(cleared.phase, phase); assert.equal(cleared.steerY, 0); assert.equal(cleared.lunge, 0);
  }
});

test('resize and version-1 checkpoints never retain transient steering or dodge', () => {
  const s = flight(); S.spillSteer(s, -1); S.spillLunge(s, -1); ticks(s, 2);
  S.resizeSpill(s, 1280, 720);
  assert.equal(s.steerY, 0); assert.equal(s.lunge, 0); assert.equal(s.lungeDir, 1);
  assert.equal(s.pilot.vx, 0); assert.equal(s.pilot.vy, 0);
  s.phase = 'depot'; s.wave = s.cleared = 5; s.depot = { arm: 0, bought: [] };
  s.combat.nextEnemy = 5; // Restore an ordinary schedule before testing the persisted schema.
  s.steerY = .5; s.lungeDir = -1; s.lunge = .1; s.pilot.vy = 50;
  const cp = S.spillCheckpoint(s); assert(cp); assert.equal(s.steerY, .5, 'snapshot does not mutate caller');
  assert.equal(cp.state.steerY, 0); assert.equal(cp.state.lunge, 0); assert.equal(cp.state.pilot.vy, 0);
  for (const legacy of [false, true]) {
    const stored = structuredClone(cp);
    if (legacy) { delete stored.state.steerY; delete stored.state.lungeDir; }
    else { stored.state.steerY = -1; stored.state.lungeDir = -1; stored.state.lunge = .1; }
    const restored = S.restoreSpill(stored, 390, 760); assert(restored);
    assert.equal(restored.steerY, 0); assert.equal(restored.lunge, 0); assert.equal(restored.lungeDir, 1);
  }
  for (const [field, value] of [['steerY', NaN], ['steerY', 2], ['steerY', '0'], ['lungeDir', 0], ['lungeDir', Infinity]]) {
    const bad = structuredClone(cp); bad.state[field] = value;
    assert.equal(S.restoreSpill(bad, 390, 760), null, `reject malformed ${field}`);
  }
});

console.log(`steering: ${cases} focused cases passed`);
