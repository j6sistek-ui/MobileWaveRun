#!/usr/bin/env node
/** THE SPILL, judged at the authority.
 *
 *  spill.ts owns the rules and knows nothing about a canvas, so every rule
 *  worth arguing about is asserted here against the built module: the wave
 *  ladder climbs and teaches in order, debris never overlaps debris, a
 *  direct steering holds altitude on release, DRIFT tilts the field slowly
 *  and never further than it says, the count hands control back on the GO
 *  and never before, the Depot docks, arms, sells fixed meters at flat
 *  prices, an unlocked PULSE fires itself at an impact and banks an echo
 *  five seconds later, a mission ends on the wave it names, and the sim seam
 *  banks the best wave without ever touching the acorn wallet. Last, a
 *  dodging bot flies wave 1 - a smoke test for "is this survivable at
 *  all", not a tuning instrument.
 */
globalThis.window = { location: { href: "http://local/" }, devicePixelRatio: 1,
  addEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {} }),
  // Spill missions are part of the production chart.
  __ACORNAUT_BETA__: false };
globalThis.document = { createElement: () => ({ getContext: () => null, style: {} }),
  addEventListener() {}, documentElement: { style: {} } };
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };

const Spill = await import("../dist/js/spill.js");
const Hazards = await import("../dist/js/spill-hazards.js");
// Stock-flight rule fixtures bypass the opening Depot; test-spill-welcome covers that flow.
const S = {...Spill, createSpill: (W,H,seed,target=0,hints=true) => Spill.createSpill(W,H,seed,target,hints,false)};
const sim = await import("../dist/js/sim.js");
const save = await import("../dist/js/save.js");
const camp = await import("../dist/js/campaign.js");

const fail = [];
const ok = (c, m) => { if (!c) fail.push(m); };
const DT = 1 / 60;
const W = 390, H = 760;

/** step until the predicate holds or the clock runs out */
function until(s, pred, seconds, each) {
  let t = 0;
  while (t < seconds) {
    if (each) each(s);
    // the last frame's cues, kept on the state for the assertion after
    s.lastCues = S.stepSpill(s, DT);
    t += DT;
    if (pred(s)) return true;
  }
  return false;
}
const immune = (s) => { s.iframes = 9; s.floorT = 0; };
const advance = (s) => { immune(s); if (s.phase === "depot" && s.depot.arm <= 0) S.spillLeaveDepot(s); };
/** hold the ship mid-air with no rocks about, so a wait is only a wait */
const hover = (s) => { s.rocks = []; s.pilot.y = s.H * 0.45; s.pilot.vy = 0; };
/** tap the ready card, then wait out the count */
const launch = (seed, target = 0) => {
  const s = S.createSpill(W, H, seed, target);
  ok(S.spillTap(s) === true, "the first tap launches");
  ok(s.phase === "countdown", `the first tap opens the count, got ${s.phase}`);
  ok(S.stepSpill(s, DT).includes("wave"), "the launch's wave cue reaches the first frame");
  until(s, (x) => x.phase === "wave", 5);
  return s;
};
const rockAt = (s, x, y, r = 20) => {
  s.rocks.push({ x, y, vx: -10, vy: 0, r, kind: "tumbler", sprite: 0, spin: 0, rot: 0,
    arc: 0, arcPhase: 0, warn: 0, grazed: true, dead: false });
};
/** a funded, armed Depot at the first dock */
const dock = (seed) => {
  const s = launch(seed);
  const reached = until(s, (x) => x.phase === "depot", 400, immune);
  ok(reached, `seed ${seed} reaches the Depot (${s.phase} at wave ${s.wave})`);
  until(s, (x) => x.depot.arm <= 0, 2);
  s.ore = 1000;
  return s;
};

// ------------------------------------------------------------ the ladder
{
  let prev = null;
  const firstSeen = {};
  for (let n = 1; n <= 40; n++) {
    const w = S.spillWaveSpec(n, 7);
    ok(w.dur > 0 && w.cap > 0 && w.interval > 0, `wave ${n} has a duration, a cap and an interval`);
    if (prev) {
      ok(w.cap >= prev.cap, `the cap never drops (wave ${n})`);
      ok(w.speed >= prev.speed && w.speed <= 2.05, `speed climbs to a readable cap (wave ${n})`);
      ok(w.interval <= prev.interval, `spawns never slow down (wave ${n})`);
    }
    for (const m of w.mods) if (!(m in firstSeen)) firstSeen[m] = n;
    const gravity = w.mods.filter((m) => m === "lowg" || m === "heavy");
    ok(gravity.length <= 1, `wave ${n} carries at most one gravity rule, got ${gravity.join("+")}`);
    ok(!w.mods.includes("flip"), `gravity never flips (wave ${n})`);
    if (n <= S.SPILL_AUTHORED_WAVES) ok(w.mods.length <= 1, `an authored wave teaches one rule (wave ${n})`);
    prev = w;
  }
  // Phase3 deliberately isolates new hazard lessons and filters conflicting
  // modifiers. The old exact order after HEAVY no longer describes the game;
  // preserve the initial lessons and prove all modifiers remain reachable.
  ok(firstSeen.surge === 3 && firstSeen.lowg === 6 && firstSeen.heavy === 8,
    `the initial movement lessons retain their authored waves: ${JSON.stringify(firstSeen)}`);
  for (const seed of [0, 1, 7, 19, 71, 99, 997, 0xffffffff]) {
    const available = new Set();
    for (let n = 1; n <= 80; n++) {
      const w = S.spillWaveSpec(n, seed), plan = Hazards.spillHazardPlan(n, seed);
      for (const mod of w.mods) available.add(mod);
      ok(w.mods.length <= (n <= S.SPILL_AUTHORED_WAVES ? 1 : 2), `modifier pressure stays bounded at wave ${n}, seed ${seed}`);
      if ([4, 7, 11, 16].includes(n)) ok(w.mods.length === 0, `new hazard lesson ${n} carries no extra modifier`);
      if (plan.families.includes("gravity")) ok(!w.mods.some(mod => ["heavy", "cross", "drift"].includes(mod)),
        `gravity countersteering is not combined with conflicting movement at wave ${n}, seed ${seed}`);
      if (plan.families.includes("ion")) ok(!w.mods.includes("blackout"), `ion bands remain visible at wave ${n}, seed ${seed}`);
    }
    for (const mod of S.SPILL_MODS) ok(available.has(mod), `${mod} is still available by wave80 for seed ${seed}`);
  }
  const a = S.spillWaveSpec(27, 99), b = S.spillWaveSpec(27, 99);
  ok(JSON.stringify(a) === JSON.stringify(b), "an endless wave is the same for the same seed");
  ok(S.spillWaveSpec(26, 99).mods.length <= 2, "up to two compatible rules remain after endless filtering");
}

// ------------------------------------------------------------- the hand
// Detailed axis, edge, upgrade and migration checks live in test-spill-steering.
{
  const s = launch(2); hover(s);
  const y = s.pilot.y;
  until(s, () => false, .5, x => { x.rocks = []; });
  ok(s.pilot.y === y && s.pilot.vy === 0, "neutral steering holds altitude without gravity");
  ok(S.spillTap(s) === false && s.pilot.vy === 0, "a flight tap cannot auto-rise");
  ok(S.spillSteer(s, -1), "up steering is accepted");
  until(s, () => false, .3, x => { x.rocks = []; });
  ok(s.pilot.y < y - 40 && s.pilot.vy < 0, "held up steers upward");
  S.spillSteer(s, 0);
  until(s, () => false, .2, x => { x.rocks = []; });
  const stopped = s.pilot.y;
  until(s, () => false, .5, x => { x.rocks = []; });
  ok(s.pilot.vy === 0 && s.pilot.y === stopped, "release stops and holds the new altitude");
  S.spillSteer(s, 1);
  until(s, () => false, .3, x => { x.rocks = []; });
  ok(s.pilot.y > stopped + 40 && s.pilot.vy > 0, "held down steers downward");
}
{
  const s = S.createSpill(W, H, 4, 0);
  ok(S.spillSteer(s, -1) === false && s.steerY === 0, "steering does not launch the ready card");
  ok(S.spillLunge(s) && s.phase === "countdown", "the legacy ready action still launches");
  ok(!s.manual && !S.spillTap(s), "another tap does not take control or launch twice");
  S.spillSteer(s, 0); ok(!s.manual, "neutral input does not disturb countdown autopilot");
  ok(S.spillSteer(s, -.5) && s.manual, "nonzero steering takes countdown control");
  until(s, x => x.phase === "wave", 4, x => { x.rocks = []; });
  ok(s.phase === "wave" && s.steerY === -.5, "held countdown steering survives GO");
  S.spillSteer(s, 0); until(s, () => false, .3, x => { x.rocks = []; });
  ok(s.pilot.vy === 0, "release after GO returns to altitude hold");
}
{
  const s = launch(43);
  ok(s.hint === S.SPILL_CONTROL_HINT && s.hintT > 3, "wave 1 shows direct-control instructions");
  S.spillSteer(s, -1); S.spillSteer(s, 1);
  ok(s.hintT > 3, "two deliberate directions keep the hint");
  S.spillLunge(s, -1);
  ok(s.hintT <= 1, "the third deliberate input dismisses the hint");
}

// --------------------------------------------------- the count and the GO
{
  const s = S.createSpill(W, H, 5, 0);
  S.spillTap(s);
  ok(S.spillCount(s) === 3, `the count opens at three (${S.spillCount(s)})`);
  const y = s.pilot.y = s.H * 0.9;
  const counts = [];
  let goAt = -1, t = 0;
  while (s.phase === "countdown" && t < 5) {
    const c = S.stepSpill(s, DT);
    t += DT;
    if (c.includes("count")) counts.push(S.spillCount(s));
    if (c.includes("go")) goAt = t;
  }
  ok(s.phase === "wave", `the count ends in the wave (${s.phase})`);
  ok(Math.abs(goAt - S.SPILL.countdown) < 0.05, `the GO lands on the count's end (${goAt.toFixed(2)}s)`);
  ok(JSON.stringify(counts) === "[2,1]", `the count ticks down (${JSON.stringify(counts)})`);
  ok(s.pilot.y < y - 100, `the autopilot flew the ship home during the count (${s.pilot.y.toFixed(0)} from ${y.toFixed(0)})`);
  ok(s.rocks.length === 0, "nothing spawns before the GO");
  ok(S.spillSteer(s, -1) && s.steerY === -1, "steering is available on GO");
}

// ------------------------------------------- debris never meets debris
{
  // to wave 7: spinners weave from wave 1 and hulks wait out a warning
  // from wave 4, and both used to be predicted wrong
  let overlaps = 0, samples = 0, rocksSeen = 0, spinners = 0, hulks = 0, wave1Spinners = 0;
  for (const seed of [3, 11, 42]) {
    const s = launch(seed);
    until(s, (x) => x.wave >= 7, 400, (x) => {
      for (const r of x.rocks) {
        if (r.kind === "spinner") { spinners++; if (x.wave === 1) wave1Spinners++; }
        if (r.kind === "hulk") hulks++;
      }
      immune(x);
      const live = x.rocks.filter((r) => !r.dead && r.warn <= 0 && r.x < x.W + 60 && r.x > -60);
      rocksSeen = Math.max(rocksSeen, live.length);
      for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
        const a = live[i], b = live[j];
        samples++;
        if (Math.hypot(a.x - b.x, a.y - b.y) < a.r + b.r) overlaps++;
      }
    });
  }
  ok(rocksSeen >= 3, `the field actually fills (peak ${rocksSeen} live pieces)`);
  ok(spinners > 0 && hulks > 0, `spinners and hulks were both in the field (${spinners}, ${hulks} rock-frames)`);
  ok(wave1Spinners > 0, "spinners weave from wave 1");
  ok(overlaps === 0, `debris never overlaps debris: ${overlaps} of ${samples} pair samples overlapped`);
}
{
  // the spawn check predicts exactly the motion the step flies
  const s = launch(44);
  s.rocks = [];
  const r = { x: s.W + 40, y: s.H / 2, vx: -200, vy: 10, r: 20, kind: "spinner", sprite: 0, spin: 0, rot: 0,
    arc: 40, arcPhase: 1.1, warn: 0.5, grazed: false, dead: false };
  s.rocks.push(r);
  const predicted = S.spillRockAt(s, r, 2);
  for (let i = 0; i < 120; i++) { s.pilot.y = s.H * 0.2; s.pilot.vy = 0; S.stepSpill(s, DT); }
  ok(Math.abs(r.x - predicted.x) < 2 && Math.abs(r.y - predicted.y) < 3,
    `a spinner behind a warning lands where the check said (${r.x.toFixed(1)},${r.y.toFixed(1)} vs ${predicted.x.toFixed(1)},${predicted.y.toFixed(1)})`);
}

// ----------------------------------------------------------------- DRIFT
{
  const s = launch(18);
  // walk the run to wave 18 without flying it
  until(s, (x) => x.wave >= 18 && x.phase === "wave", 900, advance);
  ok(s.wave === 18 && s.liveMods.includes("drift"), `wave 18 flies DRIFT (${s.wave}: ${s.liveMods})`);
  ok(Math.abs(s.tilt) < 1e-6, "the wave opens level");
  let maxTilt = 0, maxStep = 0, prev = s.tilt, moved = false;
  until(s, () => false, 20, (x) => {
    immune(x);
    hover(x);
    maxStep = Math.max(maxStep, Math.abs(x.tilt - prev));
    prev = x.tilt;
    maxTilt = Math.max(maxTilt, Math.abs(x.tilt));
    if (Math.abs(x.tilt) > 0.05) moved = true;
  });
  ok(moved, `the field tilts under DRIFT (peak ${maxTilt.toFixed(2)} rad)`);
  const teach = S.SPILL.driftMax * S.SPILL.driftTeach;
  ok(maxTilt <= teach + 1e-6, `and never past the lesson's limit (${maxTilt.toFixed(3)} vs ${teach.toFixed(3)})`);
  // the lesson leans only part way even when the roll asks for the full lean
  s.tiltT = 100; s.tiltTarget = S.SPILL.driftMax;
  until(s, () => false, 5, (x) => { immune(x); hover(x); });
  ok(Math.abs(s.tilt - teach) < 1e-3, `wave 18 stops at ${S.SPILL.driftTeach * 100}% of the tilt (${s.tilt.toFixed(3)})`);
  // an endless DRIFT wave leans fully
  let endless = 0;
  for (let n = S.SPILL_AUTHORED_WAVES + 1; n < 60 && !endless; n++) if (S.spillWaveSpec(n, s.seed).mods.includes("drift")) endless = n;
  ok(endless > 0, `the seed rolls DRIFT again past the ladder (wave ${endless})`);
  until(s, (x) => x.wave >= endless && x.phase === "wave", 3000, advance);
  ok(s.wave === endless && s.liveMods.includes("drift"), `reached it (${s.wave}: ${s.liveMods})`);
  s.tiltT = 100; s.tiltTarget = S.SPILL.driftMax;
  until(s, () => false, 6, (x) => { immune(x); hover(x); });
  ok(Math.abs(s.tilt - S.SPILL.driftMax) < 1e-3, `and there the field leans all the way (${s.tilt.toFixed(3)})`);
  ok(maxStep <= S.SPILL.driftRate * DT + 1e-6, `the tilt is a lean, never a lurch (${(maxStep / DT).toFixed(3)} rad/s)`);
  // the angle the debris arrives at follows the tilt
  s.tilt = 0.3; s.rocks = [];
  let tilted = 0, n = 0;
  until(s, () => false, 8, (x) => { immune(x); x.tilt = 0.3; for (const r of x.rocks) if (!r.grazed) { n++; if (r.vy > 0) tilted++; r.grazed = true; } });
  ok(n > 0 && tilted / n > 0.75, `debris flies the tilted field (${tilted}/${n} pieces angled with the tilt)`);
}

// ----------------------------------------------------------------- hull
{
  const s = launch(5);
  s.rocks = [];
  ok(s.hull === 3 && s.maxHull === 3, "the hull opens at three pips");
  rockAt(s, s.pilot.x, s.pilot.y);
  const hitCues = S.stepSpill(s, DT);
  ok(s.hull === 2 && s.hits === 1, `a hit costs one pip (hull ${s.hull}, hits ${s.hits})`);
  ok(s.iframes > 1, "a hit arms the invulnerability window");
  ok(s.rocks.every((r) => r.dead) || s.rocks.length === 0, "the piece that hit is shattered, so it cannot hit twice");
  ok(hitCues.includes("hit"), "the frame reports the hit");
  rockAt(s, s.pilot.x, s.pilot.y);
  S.stepSpill(s, DT);
  ok(s.hull === 2, "a second piece inside the window costs nothing");
  s.rocks = [];
  until(s, (x) => x.iframes <= 0, 3, hover);
  rockAt(s, s.pilot.x, s.pilot.y);
  S.stepSpill(s, DT);
  ok(s.hull === 1, `after the window the next hit lands (hull ${s.hull})`);
  s.iframes = 0; s.rocks = [];
  rockAt(s, s.pilot.x, s.pilot.y);
  const deadCues = S.stepSpill(s, DT);
  ok(s.phase === "over" && s.cause === "STRUCK", `the third hit ends the run (${s.phase} ${s.cause})`);
  ok(deadCues.includes("dead"), "and says so");
  ok(S.spillTap(s) === false, "a tap on the dead ship does nothing");
}
{
  // a shield eats the piece; shields come from the Depot, never the field
  const s = launch(6);
  s.rocks = [];
  s.shield = 1;
  rockAt(s, s.pilot.x, s.pilot.y);
  ok(S.stepSpill(s, DT).includes("shield"), "the shield's break is reported");
  ok(s.shield === 0 && s.hull === 3, `a shield absorbs the hit (shield ${s.shield}, hull ${s.hull})`);
  let drifts = 0;
  until(s, (x) => x.wave >= 4, 200, (x) => { immune(x); for (const n of x.nuts) if (n.kind !== "ore" && n.kind !== "gold" && n.kind !== "hull") drifts++; });
  ok(drifts === 0, `only ore, charged coins and hull kits drift in the field (${drifts})`);
}
{
  // Boundaries are soft movement limits, never a recurring damage source.
  const s = launch(8); s.nextRock = 1000;
  for (const dir of [-1, 1]) {
    S.spillSteer(s, dir);
    until(s, () => false, 4, x => { x.rocks = []; });
    ok(s.pilot.y >= 22 && s.pilot.y <= s.H - 22, "steering stays inside the vertical limits");
    ok(s.hull === 3 && s.hits === 0 && s.floorT === 0, "holding either edge never damages the ship");
  }
}

{
  // the Respawn Core: one extra life, hull restored, three seconds of Gold
  const s = launch(9);
  s.rocks = [];
  s.coreBought = true; s.coreArmed = true;
  s.hull = 1;
  rockAt(s, s.pilot.x, s.pilot.y);
  S.stepSpill(s, DT);
  ok(s.phase === "respawn" && !s.coreArmed, `the core catches the last hit (${s.phase})`);
  until(s, (x) => x.phase !== "respawn", 4);
  ok(s.phase === "wave" || s.phase === "drain", `and hands the pilot back (${s.phase})`);
  ok(s.hull === s.maxHull && s.gold > 2, `whole and golden (hull ${s.hull}, gold ${s.gold.toFixed(1)})`);
  s.rocks = []; s.gold = 0; s.iframes = 0; s.hull = 1;
  rockAt(s, s.pilot.x, s.pilot.y);
  S.stepSpill(s, DT);
  ok(s.phase === "over", "the core fires once");
}

// ---------------------------------------------------------------- PULSE
{
  // Gold Ore charges the meter, half each; grazes are points only
  const s = launch(10);
  hover(s);
  s.rocks.push({ x: s.pilot.x + 5, y: s.pilot.y + 50, vx: -400, vy: 0, r: 16, kind: "shard", sprite: 0, spin: 0, rot: 0,
    arc: 0, arcPhase: 0, warn: 0, grazed: false, dead: false });
  const c = S.stepSpill(s, DT);
  ok(c.includes("graze") && s.grazes === 1, "a near miss is a graze");
  ok(s.charge === 0, `a graze does not charge the PULSE (${s.charge})`);
  const gold = (x) => x.nuts.push({ x: x.pilot.x, y: x.pilot.y, vx: 0, vy: 0, got: false, bob: 0, kind: "gold" });
  s.rocks = []; s.ore = 0;
  gold(s);
  ok(S.stepSpill(s, DT).includes("gold"), "gold ore is reported");
  ok(s.charge === 0.5 && s.ore === 5, `one gold is half a meter and five Ore (charge ${s.charge}, ore ${s.ore})`);
  gold(s);
  ok(S.stepSpill(s, DT).includes("charged"), "the second fills the meter, audibly");
  ok(s.charge === 1, "and it stays full");
}
{
  // locked, a full meter does nothing at an impact; unlocked, it fires itself
  const s = launch(11);
  hover(s);
  s.charge = 1;
  rockAt(s, s.pilot.x, s.pilot.y);
  S.stepSpill(s, DT);
  ok(s.hull === 2 && s.charge === 1, `without POWER-UPS a full meter is only a meter (hull ${s.hull}, charge ${s.charge})`);
  ok(S.spillPulse(s) === false, "and the hand cannot fire it");
  s.up.pulse = 1; s.iframes = 0; s.rocks = [];
  rockAt(s, s.pilot.x, s.pilot.y);
  rockAt(s, s.pilot.x + 150, s.pilot.y - 100);
  rockAt(s, s.pilot.x + 400, s.pilot.y);
  const c = S.stepSpill(s, DT);
  ok(c.includes("pulse") && !c.includes("hit"), `the impact fires the PULSE instead of costing a pip (${c})`);
  ok(s.hull === 2 && s.charge === 0, `the hull is untouched and the meter spent (hull ${s.hull}, charge ${s.charge})`);
  ok(s.shattered >= 2 && s.rocks.filter((r) => !r.dead).length === 1, `everything in reach shatters, the far piece flies on (${s.shattered} shattered)`);
  ok(s.pulseQueue === 0, "one level, one pulse");
  // POWER-UPS II: a second pulse five seconds later
  s.up.pulse = 2; s.charge = 1; s.rocks = []; s.iframes = 0;
  rockAt(s, s.pilot.x, s.pilot.y);
  S.stepSpill(s, DT);
  ok(Math.abs(s.pulseQueue - S.SPILL.doublePulseDelay) < 1e-6, `the second pulse is queued (${s.pulseQueue}s)`);
  until(s, x => x.echoReady, 6, hover);
  ok(s.echoReady && s.pulseQueue === 0, "the echo arms after five seconds");
  until(s, () => false, 2, hover);
  ok(s.echoReady && !s.lastCues.includes("pulse"), "an empty field does not waste the echo");
  rockAt(s, s.pilot.x, s.pilot.y);
  const echo = S.stepSpill(s, DT);
  ok(echo.includes("pulse") && !s.echoReady && s.charge === 0 && s.hull === 2, "the echo absorbs the next impact without spending charge");
}

// ---------------------------------------------------- waves and the Depot
{
  const s = launch(13);
  ok(S.spillCleared(s) === 0, "nothing is cleared while wave 1 is flown");
  const cleared1 = until(s, (x) => x.phase === "countdown", 60, immune);
  ok(cleared1 && S.spillCleared(s) === 1, `draining the field clears the wave and counts the next (${s.phase}, cleared ${S.spillCleared(s)})`);
  ok(s.lastCues.includes("clear") && s.lastCues.includes("wave"), "the clear and the next wave are announced");
  ok(s.wave === 2, `the next wave follows (wave ${s.wave})`);
  ok(!s.manual, "the count opens on autopilot; the stick comes back on the GO");
  const docking = until(s, (x) => x.phase === "docking", 400, immune);
  ok(docking && s.wave === 5, `the fifth wave docks (${s.phase} at wave ${s.wave})`);
  ok(s.lastCues.includes("dock") && s.rocks.length === 0, "the dock is announced over an empty field");
  ok(S.spillCleared(s) === 5, "five waves stand cleared at the first dock");
  ok(S.spillBuy(s, "shield") === "closed", "nothing sells while docking");
  s.hull = 2;
  const t0 = s.phaseT;
  until(s, (x) => x.phase === "depot", S.SPILL.dockTime + 0.1);
  ok(s.phase === "depot", `docking opens the Depot (${s.phase})`);
  ok(s.phaseT - t0 < 0.05 && !("timer" in s.depot), "docking opens an untimed Depot");
  ok(s.hull === 3, "docking restores a pip");
  ok(s.stipend === 5 * S.SPILL.clearOre, "five clears fund at least the first plating upgrade");
  // the shelves are inert for a moment, against a thumb still tapping
  s.ore = 1000;
  ok(s.depot.arm > 0 && S.spillBuy(s, "shield") === "arming", "a tap as the shelves appear buys nothing");
  ok(S.spillLeaveDepot(s) === false, "nor leaves during the input arm");
  ok(s.ore === 1000, "and costs nothing");
  ok(until(s, (x) => x.depot.arm <= 0, 2) && s.lastCues.includes("armed"), "the shelves arm, audibly");
  // the meters: plating fills a pip that arrives full
  ok(S.spillPrice(s, "plating") === 60, `plating I is 60 (${S.spillPrice(s, "plating")})`);
  ok(S.spillBuy(s, "plating") === "ok" && s.up.plating === 1 && s.maxHull === 4 && s.hull === 4 && s.ore === 940,
    `PLATING I adds a filled pip (hull ${s.hull}/${s.maxHull}, ore ${s.ore})`);
  ok(S.spillPrice(s, "plating") === 110, "the next level costs more");
  ok(s.depot.bought.includes("plating"), "the receipt lists the purchase");
  ok(S.spillBuy(s, "plating") === "ok" && S.spillBuy(s, "plating") === "ok", "the meter fills to three");
  ok(S.spillPrice(s, "plating") === null && S.spillBuy(s, "plating") === "maxed", "and no further");
  ok(s.maxHull === 6 && s.hull === 6, `six pips at PLATING III (${s.hull}/${s.maxHull})`);
  // the flat shelf: shield stays cheap, repair, one core
  ok(S.spillPrice(s, "shield") === 35 && S.spillBuy(s, "shield") === "ok" && s.shield === 1, "a shield is 35");
  ok(S.spillPrice(s, "shield") === 35 && S.spillBuy(s, "shield") === "ok" && s.shield === 2, "and still 35 for the second");
  ok(S.spillPrice(s, "shield") === null, "two is the stack");
  ok(S.spillPrice(s, "repair") === null, "a whole hull has nothing to repair");
  s.hull = 2;
  ok(S.spillPrice(s, "repair") === 30 && S.spillBuy(s, "repair") === "ok" && s.hull === 6, "repair fills every pip for 30");
  ok(S.spillBuy(s, "core") === "ok" && s.coreArmed && s.coreBought, "the core arms");
  ok(S.spillBuy(s, "core") === "maxed", "and is sold once a run");
  ok(S.spillBuy(s, "thrusters") === "ok" && s.up.thrusters === 1, "THRUSTERS I");
  ok(S.spillBuy(s, "thrusters") === "ok" && s.lungeCharges === 2, "THRUSTERS II carries two lunges");
  ok(S.spillBuy(s, "pulse") === "ok" && s.up.pulse === 1, "POWER-UPS I unlocks the PULSE");
  s.ore = 0;
  ok(S.spillBuy(s, "pulse") === "poor" && s.cues.includes("deny"), "a short purse is refused, audibly");
  ok(S.stepSpill(s, DT).includes("deny"), "and the refusal reaches the next frame's cues");
  ok(S.spillLeaveDepot(s) && s.phase === "countdown" && s.wave === 6 && s.depot === null, `leaving counts wave 6 (${s.phase} ${s.wave})`);
  ok(s.liveMods.includes("lowg"), `wave 6 flies LOW-G (${s.liveMods})`);
  ok(s.hintT > 0 && s.hint.startsWith("LOW-G"), "and teaches it, once");
  ok(s.taught.includes("lowg"), "the lesson is remembered");
}
{
  // prices are the ship's, not the wave's: the second Depot charges what the first did
  const s = dock(19);
  ok(S.spillPrice(s, "shield") === 35 && S.spillPrice(s, "plating") === 60, "the first stop's prices");
  S.spillLeaveDepot(s);
  until(s, (x) => x.phase === "depot" && x.depotVisits === 2, 500, advance);
  ok(s.depotVisits === 2 && s.wave === 10, `the second stop is wave 10 (visit ${s.depotVisits}, wave ${s.wave})`);
  ok(S.spillPrice(s, "shield") === 35 && S.spillPrice(s, "plating") === 60, "cost the same at wave 10");
  ok(!("timer" in s.depot), "the second visit is untimed");
  until(s, x => x.depot.arm <= 0, 2);
  S.spillLeaveDepot(s);
  until(s, (x) => x.phase === "depot" && x.depotVisits === 3, 500, advance);
  ok(s.wave === 15 && !("timer" in s.depot), "the third visit remains untimed");
}
{
  // a rule phases in: steering response changes gradually rather than snapping
  const s = launch(20);
  until(s, (x) => x.wave >= 8 && x.phase === "wave", 500, advance);
  ok(s.liveMods.includes("heavy"), `wave 8 is HEAVY (${s.liveMods})`);
  ok(S.spillRamp(s) < 0.05, `and opens at nothing (${S.spillRamp(s).toFixed(2)})`);
  until(s, () => false, 3.1, immune);
  ok(S.spillRamp(s) === 1, `three seconds in it is whole (${S.spillRamp(s)})`);
}
{
  // a clear is never taken back: a crash at the drain keeps the wave
  const s = launch(31);
  until(s, (x) => x.phase === "drain", 60, immune);
  ok(s.phase === "drain", "the field drains after its window");
  ok(S.spillCleared(s) === 0, "the wave is not yet cleared at the drain");
  s.cleared = 1; s.hull = 1; s.iframes = 0;
  until(s, (x) => x.phase === "over", 3, (x) => { x.rocks = []; x.pilot.y = x.H * .45; x.pilot.vy = 0; rockAt(x, x.pilot.x, x.pilot.y); });
  ok(s.phase === "over" && s.cause === "STRUCK", `a collision in the drain can still be fatal (${s.phase})`);
  ok(S.spillCleared(s) === 1, `and a clear survives it (cleared ${S.spillCleared(s)})`);
}
{
  // a Respawn Core fired in the drain returns to the drain, so the wave
  // is neither restarted nor cleared twice
  const s = launch(32);
  until(s, (x) => x.phase === "drain", 60, immune);
  s.coreBought = true; s.coreArmed = true; s.hull = 1; s.iframes = 0;
  until(s, (x) => x.phase === "respawn", 3, (x) => { x.rocks = []; x.pilot.y = x.H * .45; x.pilot.vy = 0; rockAt(x, x.pilot.x, x.pilot.y); });
  ok(s.phase === "respawn", "the core catches a fatal collision in the drain");
  let clears = 0, guard = 0;
  while (s.phase !== "countdown" && guard++ < 60 * 10) { hover(s); const c = S.stepSpill(s, DT); if (c.includes("clear")) clears++; }
  ok(s.phase === "countdown" && s.wave === 2, `the run goes on to wave 2 (${s.phase} ${s.wave})`);
  ok(clears === 1, `wave 1 is cleared exactly once (${clears})`);
  ok(S.spillCleared(s) === 1, "and the record says one");
}
{
  // Long pauses never close or charge the Depot. Only an explicit leave does.
  const s = dock(14);
  const ore = s.ore;
  until(s, () => false, 3600);
  ok(s.phase === "depot" && s.wave === 5 && s.ore === ore, "one hour in the Depot costs nothing and never launches");
  ok(S.spillLeaveDepot(s) && s.phase === "countdown", "the pilot chooses when to leave");
  ok(S.stepSpill(s, DT).includes("depot-close"), "and leaving is announced");
}

// ------------------------------------------------------------- a mission
{
  const s = launch(21, 2);
  ok(s.target === 2, "the mission names its rung");
  until(s, (x) => x.phase === "over", 200, immune);
  ok(s.cause === "MISSION COMPLETE" && s.wave === 2, `clearing wave 2 finishes it (${s.cause} at ${s.wave})`);
  ok(S.spillCleared(s) === 2, "and both waves count");
  ok(s.lastCues.includes("mission"), "the finish is reported");
  ok(s.hull === 3, "nothing in the finishing frame touched the hull");
}

// ------------------------------------------------------------- the seam
{
  const fresh = () => (save.freshSave ? save.freshSave() : save.loadSave());
  const w = sim.makeWorld(430, 900);
  const sv = fresh();
  sv.tutorialDone = true; sv.guide = "done";
  const wallet = sv.acorns;
  sim.resetRun(w, sv, "spill", false);
  w.spill.openingEnabled = false;
  ok(w.spill !== null && w.tut === null && w.flight === "spill", "a spill run carries its own state and no tutorial");
  ok(w.shieldCharges === 0, "the hangar's start shield stays in the hangar");
  ok(sim.flap(w, sv) === "flap" && w.spill.phase === "countdown", "the first tap launches the field");
  ok(sim.flap(w, sv) === "none" && !w.spill.manual, "a second tap cannot take the stick");
  ok(S.spillSteer(w.spill, -1) && w.spill.manual, "steering takes the stick in the count");
  S.spillSteer(w.spill, 0);
  for (let i = 0; i < 60 * 4; i++) { w.spill.rocks = []; w.spill.floorT = 0; sim.updateWorld(w, sv, DT); }
  ok(w.spill.phase === "wave", `the sim steps the Spill through the count (${w.spill.phase})`);
  w.spill.pilot.y = w.H * 0.5; w.spill.pilot.vy = 0;
  const y1 = w.spill.pilot.y;
  ok(sim.flap(w, sv) === "none" && w.spill.pilot.vy === 0, "the shared tap cannot restore old flight impulses");
  ok(S.spillSteer(w.spill, -1), "the semantic axis controls the Spill");
  for (let i = 0; i < 10; i++) { w.spill.rocks = []; sim.updateWorld(w, sv, DT); }
  ok(w.spill.pilot.vy < 0 && w.spill.pilot.y < y1, "and the ship climbs");
  ok(Math.abs(w.squirrel.y - w.spill.pilot.y) < 1e-6, "the world's squirrel mirrors the Spill's pilot");
  ok(sim.pilotX(w) === w.spill.pilot.x, "and the pilot's X follows the lunge lane");
  ok(sim.dive(w, sv) === "dive" && w.spill.steerY === 1, "the legacy dive helper routes to downward steering");
  ok(sim.spillBurstUp(w) && w.spill.steerY === -1, "the legacy up helper routes to upward steering");
  S.spillSteer(w.spill, 0);
  // die: three pips gone, on the fourth wave
  w.spill.hull = 1; w.spill.iframes = 0; w.spill.rocks = []; w.spill.floorT = 0;
  w.spill.pilot.y = w.H * 0.45; w.spill.pilot.vy = 0;
  rockAt(w.spill, w.spill.pilot.x, w.spill.pilot.y);
  w.spill.wave = 4; w.spill.cleared = 3;
  const ev = sim.updateWorld(w, sv, DT);
  ok(ev === "die" && w.screen === "dead", `the last hit crashes the run (${ev}, ${w.screen})`);
  ok(w.score === 3 && sv.spillBest === 3, `the best is waves cleared (score ${w.score}, best ${sv.spillBest})`);
  ok(sv.acorns === wallet, "Ore never reaches the acorn wallet");
  ok(w.lastRun && w.lastRun.best === true, "a first run is a best");
  sv.acorns = 500;
  ok(sim.reviveRun(w, sv) === false && sv.acorns === 500, "the acorn continue is refused: the Spill sells its own");
}
{
  // THE LIVE ROAD: slot 8 of every zone is a Spill mission - a wave to
  // clear, or an Ore / Depot finish - on both pages (STAR_MAP_LIVE)
  const spills = camp.LEVELS.filter((l) => l.base === "spill");
  ok(spills.length === 26 && spills.every((l) => l.n === 8), `a Spill mission in every zone (${spills.length})`);
  ok(spills.every((l) => l.spillFinish || l.gates >= 1), "each names the wave to clear or an Ore / Depot finish");
  const def = camp.levelById("2-8");
  const rung = def.gates;
  ok(camp.goalText(def.goals[0], def) === `Clear ${rung} waves of the Debris Field`, `the finish reads as waves: ${camp.goalText(def.goals[0], def)}`);
  // owner's planner export (PR #222): every Spill mission pays three finish
  // stars for the wave count, so the HUD carries one line - the finish
  ok(def.goals.every((g) => g.kind === "finish"), "the stars are three finishes");
  const st = camp.emptyStats();
  ok(camp.goalHud(def.goals[0], st, 0, def).state !== "done", "the finish is open until the waves are cleared");
  st.hits = 1;
  ok(camp.goalHud(def.goals[0], st, 1, def).text === `WAVE 1/${rung}`, "the finish pill counts waves");
  // flown through the sim: reaching the rung settles the level with its stars
  const w = sim.makeWorld(430, 900);
  const sv = save.loadSave();
  sv.tutorialDone = true; sv.guide = "done";
  sim.resetRun(w, sv, "spill", false, def);
  w.spill.openingEnabled = false; // isolate mission completion from welcome UI
  ok(w.spill && w.spill.target === rung && w.spill.seed === 5000 + def.ord, "a mission flies a fixed ladder to its rung");
  sim.flap(w, sv);
  let guard = 0;
  while (w.screen === "play" && guard++ < 60 * 400) {
    immune(w.spill);
    sim.updateWorld(w, sv, DT);
  }
  ok(w.screen === "lvldone", `the mission settles (${w.screen})`);
  ok(w.lastLevel && w.lastLevel.finished && (sv.stars["2-8"] & 1) === 1, "the finish star lands");
  ok(w.lastLevel.met[2] === true, "a run with no hits earns the clean-hull star");
  ok(w.lastLevel.stats.ore === w.spill.oreMined && w.lastLevel.stats.hits === w.spill.hits
    && w.lastLevel.stats.score === Math.floor(w.spill.score),
    `the receipt carries the Spill's own ledger (ore ${w.lastLevel.stats.ore}/${w.spill.oreMined}, hits ${w.lastLevel.stats.hits}/${w.spill.hits})`);
}

// ------------------------------------------------------------- the bot
//
// A synthetic dodger chooses a gap around debris and steers toward it.
// This is a geometric smoke check, not evidence of human or phone balance.
function bot(s) {
  const p = s.pilot;
  if (s.phase !== "wave" && s.phase !== "drain") return;
  const ahead = s.rocks.filter((r) => !r.dead && r.warn <= 0 && r.x > p.x - 20 && r.x < p.x + 300);
  let target = s.H * 0.45;
  if (ahead.length) {
    // sample candidate heights inside the visible flight area, and
    // score each by clearance from every piece's predicted position when
    // it reaches the pilot, less the cost of getting there
    let best = -1e9;
    for (let y = 80; y <= s.H - 130; y += 20) {
      let clear = 1e9;
      for (const r of ahead) {
        const eta = Math.max(0, (r.x - p.x) / Math.max(40, -r.vx));
        const ry = r.y + r.vy * eta;
        clear = Math.min(clear, Math.abs(ry - y) - r.r);
      }
      const score = Math.min(clear, 140) - Math.abs(y - p.y) * 0.12;
      if (score > best) { best = score; target = y; }
    }
  }
  const dy = target - p.y;
  S.spillSteer(s, Math.abs(dy) < 5 ? 0 : Math.max(-1, Math.min(1, dy / 65)));

}
{
  const seeds = [1, 2, 3, 4, 5, 6];
  let cleared1 = 0, cleared2 = 0;
  const lived = [];
  for (const seed of seeds) {
    const s = launch(seed);
    until(s, (x) => x.phase === "over" || x.wave >= 3, 120, bot);
    lived.push(s.t.toFixed(1));
    if (S.spillCleared(s) >= 1) cleared1++;
    if (S.spillCleared(s) >= 2) cleared2++;
  }
  ok(cleared1 >= 4, `a dodging bot clears wave 1 on most seeds (${cleared1}/${seeds.length}; lived ${lived.join(", ")}s)`);
  console.log(`bot: wave 1 cleared ${cleared1}/${seeds.length}, wave 2 cleared ${cleared2}/${seeds.length}, lived ${lived.join(", ")}s`);
}

if (fail.length) {
  console.error(`FAIL (${fail.length})`);
  for (const f of fail) console.error(" - " + f);
  process.exit(1);
}
console.log("spill: all assertions pass");
