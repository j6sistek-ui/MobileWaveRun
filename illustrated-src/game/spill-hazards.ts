import type { SpillRock, SpillState } from "./spill";
import { PHYS } from "./catalog";
import { damageSpillEnemy } from "./spill-combat";
import { spillRiskActive } from "./spill-expeditions";

export type SpillHazardKind = "comet" | "mine" | "ion" | "gravity" | "flare" | "wreck";
export const SPILL_HAZARD_IDS: SpillHazardKind[] = ["comet", "mine", "ion", "gravity", "flare", "wreck"];
export const SPILL_HAZARDS: Record<SpillHazardKind, { name: string; short: string; teach: string; unlock: number }> = {
  comet: { name: "Comet strike", short: "Comets", unlock: 4,
    teach: "COMET: its path is marked before it moves. Leave the line or shoot the core." },
  mine: { name: "Drifting mines", short: "Mines", unlock: 7,
    teach: "MINES: shoot to disarm or leave the ring. Blasts hit enemies; linked mines warn before chaining." },
  ion: { name: "Ion storm", short: "Ion storm", unlock: 11,
    teach: "ION STORM: leave the charged band before it flashes. Shots cannot stop it." },
  gravity: { name: "Gravity well", short: "Gravity wells", unlock: 16,
    teach: "GRAVITY: debris and enemies drift. Optional gold rides the rim; avoid the dark core." },
  flare: { name: "Solar flare", short: "Solar flare", unlock: 22,
    teach: "SOLAR FLARE: hide behind the asteroid or leave the band. Breaking cover restarts its warning." },
  wreck: { name: "Fracturing wreck", short: "Wrecks", unlock: 27,
    teach: "WRECK: shoot the bright weak point to open a path; fragments receive their own warning." },
};
export const SPILL_HAZARD_TUNING = {
  warning: 1.2, cometLead: .75, mineFuse: .9, mineRange: 68,
  ionPulse: .45, gravityX: 30, gravityY: 55, gravityBendSpeed: 26, gravityBendDuration: 2.4,
  flareWarning: 1.8, flarePulse: .7, fragmentWarning: 1.2,
};
export type SpillFragment = { x: number; y: number; vx: number; vy: number; r: number; warn: number; life: number; dead: boolean };
export type SpillHazard = {
  id: number; kind: SpillHazardKind; x: number; y: number; vx: number; vy: number; r: number;
  age: number; activeTime: number; life: number; warn: number; hp: number; maxHp: number; dead: boolean;
  aimX: number; aimY: number; phase: "warning" | "active" | "spent";
  fuse: number; pulse: number; safeY: number; range: number; variant: number; hit: boolean;
  coverBroken?: boolean; fragments?: SpillFragment[]; salvageDropped?: boolean; enemyHits?: number[];
};
export type SpillHazardState = { version: 1; rng: number; nextId: number; next: number; spawned: number; actors: SpillHazard[] };
/** Frame-local work, never saved: combat merges these with swept shot impacts. */
export type SpillHazardContact = { time: number; resolve: () => void };
type Point = { x: number; y: number };
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const lane = (s: SpillState) => Math.max(.8, s.W / 390);
const active = (s: SpillState) => s.phase === "wave" || s.phase === "drain";
function hash(seed: number, wave: number) {
  let v = (seed ^ Math.imul(wave + 7, 0x9e3779b1)) >>> 0;
  v ^= v >>> 16; v = Math.imul(v, 0x7feb352d); v ^= v >>> 15;
  return v >>> 0;
}
/** Lessons are isolated. Later waves combine known counters, never an unbounded actor pile. */
export function spillHazardPlan(wave: number, seed = 0): { families: SpillHazardKind[]; maxActive: number; advanced: boolean } {
  if (wave < 4 || wave % 5 === 0) return { families: [], maxActive: 0, advanced: false };
  const taught = SPILL_HAZARD_IDS.find(kind => SPILL_HAZARDS[kind].unlock === wave);
  if (taught) return { families: [taught], maxActive: 1, advanced: false };
  const pool = SPILL_HAZARD_IDS.filter(kind => wave >= SPILL_HAZARDS[kind].unlock);
  // Separate bits from pair selection: six families and a modulo-three
  // pairing gate otherwise make some solo families unreachable.
  const roll = hash(seed, wave), first = pool[(roll >>> 5) % pool.length];
  if (wave >= 31 && roll % 10 === 0) return { families: ["mine"], maxActive: 2, advanced: wave >= 41 };
  if (wave >= 31 && roll % 3 !== 0) {
    const pair: SpillHazardKind[] = roll % 2 ? ["gravity", "comet"] : ["mine", "comet"];
    return { families: pair, maxActive: 2, advanced: wave >= 41 };
  }
  const families = [first];
  if (wave >= 21) families.push(pool[(pool.indexOf(first) + 1 + ((roll >>> 8) % (pool.length - 1))) % pool.length]);
  return { families, maxActive: 1, advanced: wave >= 41 };
}
export function createSpillHazards(seed: number): SpillHazardState {
  return { version: 1, rng: (seed ^ 0x3b9ac713) >>> 0, nextId: 1, next: 4, spawned: 0, actors: [] };
}
function random(s: SpillState) {
  const h = s.hazards; h.rng = (h.rng + 0x6d2b79f5) >>> 0;
  let x = h.rng; x = Math.imul(x ^ (x >>> 15), x | 1);
  x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
  return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
}
export function clearSpillHazards(s: SpillState) {
  s.hazards.actors = [];
  for (const rock of s.rocks) { delete rock.gravityBend; delete rock.gravityWell; }
}
export function beginSpillHazardWave(s: SpillState) {
  clearSpillHazards(s); s.hazards.next = 4; s.hazards.spawned = 0;
}
export function resizeSpillHazards(s: SpillState, sx: number, sy: number) {
  for (const h of s.hazards.actors) {
    h.x *= sx; h.y *= sy; h.vx *= sx; h.vy *= sy;
    h.aimX *= sx; h.aimY *= sy; h.safeY *= sy;
    if (h.kind === "ion") h.r = clamp(s.H * sy * .08, 22, 36);
    if (h.kind === "gravity") h.range = clamp(s.H * sy * .32, 95, 180);
    if (h.kind === "flare") h.range = clamp(s.H * sy * .2, 60, 100);
    for (const f of h.fragments ?? []) { f.x *= sx; f.y *= sy; f.vx *= sx; f.vy *= sy; }
  }
}
export function spillHazardPressure(s: SpillState) { return s.hazards.actors.filter(h => !h.dead).length; }
export function spillHazardWarning(s: SpillState) { return s.hazards.actors.some(h => !h.dead && (h.warn > 0 || (h.kind === "mine" && h.fuse >= 0))); }
function atHome(s: SpillState, h: SpillHazard) {
  if (h.kind !== "comet" || Math.abs(h.vx) < .001) return h.y;
  return h.y + h.vy * (s.W * .22 - h.x) / h.vx;
}
function safeFor(s: SpillState, h: SpillHazard, y: number) {
  const center = atHome(s, h), margin = h.kind === "mine" || h.kind === "flare" ? h.range + 44 : h.r + 52;
  if (h.kind === "gravity" && h.vy !== 0) {
    // Reserve the full remaining vertical envelope, including reflection at
    // the flight edges. A moving well must not drift into its announced refuge.
    const lo = 45, hi = s.H - 45, end = h.y + h.vy * Math.max(0, h.life);
    const min = h.vy < 0 ? Math.max(lo, end) : h.y;
    const max = h.vy > 0 ? Math.min(hi, end) : h.y;
    const reflected = end < lo ? Math.min(hi, lo + lo - end) : end > hi ? Math.max(lo, hi - (end - hi)) : h.y;
    return y < Math.min(min, reflected) - margin || y > Math.max(max, reflected) + margin;
  }
  return Math.abs(y - center) > margin;
}
type RockPrediction = (rock: SpillRock, ahead: number) => Point;
function routeClear(s: SpillState, safeY: number, predict?: RockPrediction) {
  for (const rock of s.rocks) {
    if (rock.dead) continue;
    for (let i = 0; i <= 24; i++) {
      const t = i / 10, f = Math.min(1, t / .9);
      const p = predict ? predict(rock, t) : { x: rock.x + rock.vx * Math.max(0, t - rock.warn), y: rock.y + rock.vy * Math.max(0, t - rock.warn) };
      const pilotX = s.pilot.x + (s.W * .22 - s.pilot.x) * f;
      const pilotY = s.pilot.y + (safeY - s.pilot.y) * f;
      const margin = rock.r + 38 + (predict ? 0 : Math.abs(rock.arc) * 1.25);
      if (Math.hypot(p.x - pilotX, p.y - pilotY) < margin) return false;
    }
  }
  return true;
}
function refuge(s: SpillState, candidate: SpillHazard, predict?: RockPrediction): number | null {
  const actors = [...s.hazards.actors.filter(h => !h.dead && h.id !== candidate.id), candidate];
  const heights = [s.pilot.y, ...actors.map(h => h.safeY), ...Array.from({ length: 11 }, (_, i) => 30 + (s.H - 60) * i / 10)];
  const valid = heights.filter(y => y >= 28 && y <= s.H - 28 && Math.abs(y - s.pilot.y) <= 220
    && actors.every(h => safeFor(s, h, y)) && routeClear(s, y, predict));
  valid.sort((a, b) => Math.abs(a - s.pilot.y) - Math.abs(b - s.pilot.y));
  return valid[0] ?? null;
}
/** Called before ambient/enemy admission so its pressure replaces theirs. */
export function admitSpillHazards(s: SpillState, dt: number, predict?: RockPrediction) {
  if (s.phase !== "wave") return;
  const plan = spillHazardPlan(s.wave, s.seed), state = s.hazards;
  const advanced = plan.advanced || (spillRiskActive(s, "volatile") && !plan.families.some(kind => SPILL_HAZARDS[kind].unlock === s.wave));
  if (!plan.families.length || s.event !== "none" || s.waveT > s.spec.dur - 6) return;
  state.next -= dt;
  if (state.next > 0 || state.spawned >= (s.wave < 21 ? 3 : 4) || spillHazardPressure(s) >= plan.maxActive) return;
  if (s.eventWarn > 0 || s.surgeT > 0 || spillHazardWarning(s)
    || s.combat.enemies.some(e => !e.dead && e.telegraph > 0)
    || s.combat.shots.some(p => !p.dead && p.team === "enemy")) { state.next = .35; return; }
  const kind = plan.families[state.spawned % plan.families.length];
  // New cover/body lessons retain their own space even on a mixed plan.
  if ((kind === "flare" || kind === "wreck" || state.actors.some(h => !h.dead && (h.kind === "flare" || h.kind === "wreck"))) && spillHazardPressure(s)) return;
  for (let attempt = 0; attempt < 8; attempt++) {
    const r = kind === "ion" ? clamp(s.H * .08, 22, 36) : kind === "comet" ? 16 : kind === "flare" || kind === "wreck" ? 42 : 14;
    const x = kind === "ion" ? s.W * .5 : kind === "flare" ? s.W * .72 : s.W + r + 24;
    const offset = kind === "gravity" ? (random(s) < .5 ? -1 : 1) * (74 + random(s) * 30) : (random(s) - .5) * 150;
    const y = clamp(s.pilot.y + offset, 45 + r, s.H - 45 - r);
    const aimX = s.W * .22;
    const aimY = clamp(kind === "comet" ? s.pilot.y + (random(s) - .5) * (advanced ? 160 : 70) : y, 40, s.H - 40);
    const dx = aimX - x, dy = aimY - y, distance = Math.max(1, Math.hypot(dx, dy));
    const speed = Math.min((advanced ? 800 : 630) * lane(s), Math.max(1, distance - r - PHYS.squirrelR) / SPILL_HAZARD_TUNING.cometLead);
    const h: SpillHazard = { id: state.nextId, kind, x, y,
      vx: kind === "comet" ? dx / distance * speed : kind === "ion" || kind === "flare" ? 0 : -70 * lane(s),
      vy: kind === "comet" ? dy / distance * speed : kind === "gravity" && advanced ? (random(s) - .5) * 18 : 0,
      r, age: 0, activeTime: 0, life: kind === "ion" ? 8 : 10,
      warn: (kind === "flare" ? SPILL_HAZARD_TUNING.flareWarning : SPILL_HAZARD_TUNING.warning) + (s.utilities.includes("scanner") ? .4 : 0),
      hp: kind === "mine" ? 2 : kind === "comet" || kind === "wreck" ? 3 : kind === "flare" ? 5 : 0,
      maxHp: kind === "mine" ? 2 : kind === "comet" || kind === "wreck" ? 3 : kind === "flare" ? 5 : 0,
      dead: false, aimX, aimY, phase: "warning", fuse: -1, pulse: 0,
      safeY: clamp(s.pilot.y + (y > s.pilot.y ? -110 : 110), 30, s.H - 30),
      range: kind === "gravity" ? clamp(s.H * .32, 95, 180) : kind === "mine" ? SPILL_HAZARD_TUNING.mineRange : kind === "flare" ? clamp(s.H * .2, 60, 100) : r,
      variant: advanced ? 1 : 0, hit: false };
    const safeY = refuge(s, h, predict);
    if (safeY === null) continue;
    if (kind === "flare" && s.rocks.some(rock => !rock.dead && Math.hypot(rock.x - x, rock.y - y) < rock.r + r + 24)) continue;
    h.safeY = safeY;
    for (const existing of state.actors) existing.safeY = safeY;
    state.actors.push(h); state.nextId++; state.spawned++;
    if (kind === "mine" && plan.maxActive === 2 && plan.families.length === 1 && state.actors.filter(a => !a.dead).length === 1) {
      const partner = { ...h, id: state.nextId, x: h.x + 44, y: clamp(h.y + (safeY < h.y ? 28 : -28), 50, s.H - 50) };
      const shared = refuge(s, partner, predict);
      if (shared !== null) { h.safeY = partner.safeY = shared; state.actors.push(partner); state.nextId++; state.spawned++; }
    }
    state.next = plan.maxActive > 1 ? 2.8 : 5.5;
    s.cues.push("warn"); return;
  }
  state.next = .6;
}

export function spillGravityDrift(s: SpillState): Point {
  let x = 0, y = 0;
  if (!active(s)) return { x, y };
  for (const h of s.hazards.actors) {
    if (h.dead || h.kind !== "gravity" || h.phase !== "active" || h.warn > 0) continue;
    const dx = h.x - s.pilot.x, dy = h.y - s.pilot.y, d = Math.max(1, Math.hypot(dx, dy));
    const weight = Math.max(0, 1 - d / h.range) * Math.min(1, h.activeTime / .6);
    x += dx / d * SPILL_HAZARD_TUNING.gravityX * weight;
    y += dy / d * SPILL_HAZARD_TUNING.gravityY * weight;
  }
  return { x: clamp(x, -30, 30), y: clamp(y, -55, 55) };
}
/** Enemy steering is affected by the same visible field, without moving a
 * frozen firing muzzle or allowing an invisible offscreen damage farm. */
export function spillGravityEnemyDrift(s: SpillState, point: Point): Point {
  let x = 0, y = 0;
  for (const h of s.hazards.actors) {
    if (h.dead || h.kind !== "gravity" || h.phase !== "active" || h.warn > 0) continue;
    const dx = h.x - point.x, dy = h.y - point.y, d = Math.max(1, Math.hypot(dx, dy));
    const weight = Math.max(0, 1 - d / h.range) * Math.min(1, h.activeTime / .6);
    x += dx / d * 40 * weight; y += dy / d * 70 * weight;
  }
  return { x: clamp(x, -40, 40), y: clamp(y, -70, 70) };
}
export function spillGravityBend(s: SpillState, rock: SpillRock) {
  if (rock.dead || rock.warn > 0 || (rock.gravityBend && s.t < rock.gravityBend.start + rock.gravityBend.duration)) return null;
  const well = s.hazards.actors.find(h => !h.dead && h.kind === "gravity" && h.phase === "active" && h.warn <= 0
    && h.id !== rock.gravityWell && Math.hypot(h.x - rock.x, h.y - rock.y) < h.range + rock.r);
  if (!well) return null;
  return { wellId: well.id, bend: { start: s.t, duration: SPILL_HAZARD_TUNING.gravityBendDuration,
    strength: clamp((well.y - rock.y) * .4, -SPILL_HAZARD_TUNING.gravityBendSpeed, SPILL_HAZARD_TUNING.gravityBendSpeed) } };
}
/** Exact integral of the authored force envelope; shared by simulation and prediction. */
export function spillGravityBendDelta(rock: SpillRock, from: number, to: number) {
  const b = rock.gravityBend;
  if (!b) return 0;
  const integral = (time: number) => {
    const u = clamp((time - b.start) / b.duration, 0, 1);
    return b.strength * b.duration / Math.PI * (1 - Math.cos(Math.PI * u));
  };
  return integral(to) - integral(from);
}
/** This is also the renderer's trajectory-marker gate, so a spent/remote
 * force cannot turn an unmarked ordinary rock into a free enemy projectile. */
export function spillBentRockThreat(s: SpillState, rock: SpillRock) {
  const b = rock.gravityBend;
  return !rock.dead && rock.warn <= 0 && !!b && s.t >= b.start && s.t < b.start + b.duration
    && s.hazards.actors.some(h => !h.dead && h.kind === "gravity" && h.phase === "active" && h.id === rock.gravityWell
      && Math.hypot(rock.x - h.x, rock.y - h.y) <= h.range + rock.r);
}
/** Retain the announced refuge when admitting or bending ordinary debris. */
export function spillHazardPathClear(s: SpillState, rock: SpillRock, at: (ahead: number) => Point) {
  if (!spillHazardPressure(s)) return true;
  const safeY = s.hazards.actors.find(h => !h.dead)?.safeY;
  if (safeY === undefined) return true;
  for (let i = 0; i <= 45; i++) {
    const p = at(i / 10);
    if (Math.abs(p.x - s.W * .22) < rock.r + 44 && Math.abs(p.y - safeY) < rock.r + 58) return false;
  }
  return true;
}

/** Moving-circle segment contact also catches a fast pass between simulation frames. */
function sweep(a: Point, b: Point, c: Point, d: Point, radius: number): number | null {
  const x = a.x - c.x, y = a.y - c.y, vx = b.x - a.x - d.x + c.x, vy = b.y - a.y - d.y + c.y;
  const cc = x * x + y * y - radius * radius;
  if (cc <= 0) return 0;
  const aa = vx * vx + vy * vy;
  if (aa < 1e-12) return null;
  const bb = 2 * (x * vx + y * vy), disc = bb * bb - 4 * aa * cc;
  if (disc < 0) return null;
  const t = (-bb - Math.sqrt(disc)) / (2 * aa);
  return t >= 0 && t <= 1 ? t : null;
}
/** Segment/rectangle entry, including starting inside. Solar rays come from
 * the right; the intact circular asteroid projects an honest parallel shadow. */
function rectEntry(a: Point, b: Point, left: number, right: number, top: number, bottom: number) {
  let enter = 0, leave = 1;
  for (const [p, v, lo, hi] of [[a.x, b.x - a.x, left, right], [a.y, b.y - a.y, top, bottom]]) {
    if (Math.abs(v) < 1e-10) { if (p < lo || p > hi) return null; continue; }
    const t0 = (lo - p) / v, t1 = (hi - p) / v;
    enter = Math.max(enter, Math.min(t0, t1)); leave = Math.min(leave, Math.max(t0, t1));
    if (enter > leave) return null;
  }
  return enter >= 0 && enter <= 1 ? enter : null;
}
export function spillFlareSheltered(h: SpillHazard, point: Point, radius = PHYS.squirrelR) {
  return !h.coverBroken && point.x + radius < h.x - h.r && Math.abs(point.y - h.y) + radius < h.r;
}
function flareContact(h: SpillHazard, from: Point, to: Point, radius: number) {
  const top = h.y - h.range - radius, bottom = h.y + h.range + radius;
  if (h.coverBroken) return rectEntry(from, to, -Infinity, Infinity, top, bottom);
  const times = [rectEntry(from, to, h.x - h.r - radius, Infinity, top, bottom),
    rectEntry(from, to, -Infinity, Infinity, top, h.y - h.r + radius),
    rectEntry(from, to, -Infinity, Infinity, h.y + h.r - radius, bottom)].filter((n): n is number => n !== null);
  return times.length ? Math.min(...times) : null;
}
/** Shootable cover is deliberately available during its warning; other
 * warning silhouettes remain harmless and cannot soak player projectiles. */
export function spillHazardTarget(h: SpillHazard) {
  return !h.dead && h.hp > 0 && (h.kind === "flare" || (h.warn <= 0 && h.phase === "active"));
}
export function spillHazardTargetRadius(h: SpillHazard) { return h.kind === "wreck" ? 11 : h.r; }
export function damageSpillHazard(s: SpillState, h: SpillHazard, damage: number) {
  if (!spillHazardTarget(h) || !(damage > 0)) return false;
  h.hp -= damage;
  if (h.hp > 0) return true;
  h.hp = 0;
  if (h.kind === "flare") {
    // Losing shelter is a new situation, so it gets a complete warning.
    h.coverBroken = true; h.phase = "warning"; h.warn = SPILL_HAZARD_TUNING.flareWarning;
    h.life = Math.max(h.life, h.warn + SPILL_HAZARD_TUNING.flarePulse + .5); h.hit = false;
    s.cues.push("warn");
  } else if (h.kind === "wreck") {
    h.phase = "spent"; h.fuse = 5; h.fragments = [];
    h.life = Math.max(h.life, SPILL_HAZARD_TUNING.fragmentWarning + 4.1);
    for (const side of [-1, 1]) {
      const f: SpillFragment = { x: h.x, y: h.y + side * 23, vx: -100 * lane(s), vy: side * 40,
        r: 10, warn: SPILL_HAZARD_TUNING.fragmentWarning, life: 4, dead: false };
      // Fragment paths are committed now. Keep the announced refuge clear;
      // an unsafe shard becomes harmless debris sparks, not a surprise hit.
      const homeTime = clamp((s.W * .22 - f.x) / f.vx, 0, f.life);
      if (Math.abs(f.y + f.vy * homeTime - h.safeY) > f.r + 58) h.fragments.push(f);
    }
    s.cues.push("warn");
  } else h.dead = true;
  s.bursts.push({ x: h.x, y: h.y, n: 12, power: .8, tone: "shatter" });
  if (h.kind === "mine") s.nuts.push({ x: h.x, y: h.y, vx: -60 * lane(s), vy: 0, got: false, bob: h.id, kind: "ore" });
  s.cues.push("shatter"); return true;
}
export function spillHazardPulse(s: SpillState, radius: number) {
  let hits = 0;
  for (const h of s.hazards.actors) if (Math.hypot(h.x - s.pilot.x, h.y - s.pilot.y) < radius && damageSpillHazard(s, h, h.hp)) hits++;
  return hits;
}
export function stepSpillHazards(s: SpillState, dt: number, beforePilot: Point,
  effects: { damagePilot: () => void; predictRock?: RockPrediction; contacts?: SpillHazardContact[] }) {
  if (!active(s) || dt <= 0) return;
  const enemiesBefore = new Map(s.combat.enemies.map(e => [e, { x: e.x, y: e.y }]));
  const queue = (time: number, resolve: () => void) => {
    if (effects.contacts) effects.contacts.push({ time: clamp(time, 0, 1), resolve });
    else resolve();
  };
  for (const h of s.hazards.actors) {
    if (h.dead) continue;
    h.age += dt; h.life -= dt;
    if (h.life <= 0) { h.dead = true; continue; }
    if (h.phase === "warning") {
      h.warn = Math.max(0, h.warn - dt);
      if (h.warn === 0) { h.phase = "active"; h.activeTime = 0; h.hit = false;
        h.fuse = h.kind === "ion" ? SPILL_HAZARD_TUNING.ionPulse : h.kind === "flare" ? SPILL_HAZARD_TUNING.flarePulse : -1; }
      // Activation starts next tick: no full-frame movement/damage on a warning's last sliver.
      continue;
    }
    if (h.phase === "spent") {
      if (h.kind === "wreck") {
        for (const f of h.fragments ?? []) {
          if (f.dead) continue;
          if (f.warn > 0) { f.warn = Math.max(0, f.warn - dt); continue; }
          const from = { x: f.x, y: f.y }; f.x += f.vx * dt; f.y += f.vy * dt; f.life -= dt;
          const t = sweep(beforePilot, s.pilot, from, f, f.r + PHYS.squirrelR);
          if (t !== null) queue(t, () => { if (!f.dead && active(s)) { f.dead = true; effects.damagePilot(); } });
          if (f.life <= 0 || f.x < -f.r || f.y < -f.r || f.y > s.H + f.r) queue(1, () => { f.dead = true; });
        }
        if (!(h.fragments ?? []).some(f => !f.dead)) h.dead = true;
        continue;
      }
      h.fuse -= dt; if (h.fuse <= 0) h.dead = true;
      continue;
    }
    const before = { x: h.x, y: h.y };
    h.activeTime += dt; h.x += h.vx * dt; h.y += h.vy * dt;
    if (h.kind === "gravity" && (h.y < 45 || h.y > s.H - 45)) { h.y = clamp(h.y, 45, s.H - 45); h.vy *= -1; }
    if (h.kind === "mine") {
      const enemyNear = s.combat.enemies.some(e => !e.dead && e.x > 0 && e.x < s.W && Math.hypot(e.x - h.x, e.y - h.y) <= h.range + e.r);
      if (h.fuse < 0 && (enemyNear || sweep(beforePilot, s.pilot, before, h, h.range + PHYS.squirrelR) !== null)) { h.fuse = SPILL_HAZARD_TUNING.mineFuse; s.cues.push("warn"); }
      else if (h.fuse >= 0) {
        const fuse = h.fuse;
        h.fuse = Math.max(0, h.fuse - dt);
        if (h.fuse === 0) {
          const t = clamp(fuse / dt, 0, 1);
          const point = { x: before.x + (h.x - before.x) * t, y: before.y + (h.y - before.y) * t };
          const pilot = { x: beforePilot.x + (s.pilot.x - beforePilot.x) * t, y: beforePilot.y + (s.pilot.y - beforePilot.y) * t };
          queue(t, () => {
            if (h.dead || !active(s)) return;
            h.phase = "spent"; h.fuse = Math.max(0, .25 - (dt - fuse)); h.x = point.x; h.y = point.y;
            for (const e of s.combat.enemies) {
              const from = enemiesBefore.get(e) ?? e, x = from.x + (e.x - from.x) * t, y = from.y + (e.y - from.y) * t;
              if (!e.dead && x >= 0 && x <= s.W && Math.hypot(x - point.x, y - point.y) <= h.range + e.r) damageSpillEnemy(s, e, 5);
            }
            // Chain links each retain a fresh full fuse. Disarming stops the chain.
            for (const other of s.hazards.actors) if (!other.dead && other !== h && other.kind === "mine" && other.phase === "active"
              && other.fuse < 0 && Math.hypot(other.x - point.x, other.y - point.y) <= h.range + other.r) {
              other.fuse = SPILL_HAZARD_TUNING.mineFuse; s.cues.push("warn");
            }
            if (Math.hypot(point.x - pilot.x, point.y - pilot.y) <= h.range + PHYS.squirrelR) { h.hit = true; effects.damagePilot(); }
          });
        }
      }
    } else if (h.kind === "flare") {
      const liveFraction = Math.min(1, Math.max(0, h.fuse) / dt);
      const end = { x: beforePilot.x + (s.pilot.x - beforePilot.x) * liveFraction, y: beforePilot.y + (s.pilot.y - beforePilot.y) * liveFraction };
      const time = flareContact(h, beforePilot, end, PHYS.squirrelR);
      if (!h.hit && time !== null) queue(time * liveFraction, () => {
        if (!h.dead && !h.hit && h.phase === "active" && active(s)) { h.hit = true; effects.damagePilot(); }
      });
      const fuse = h.fuse; h.fuse = Math.max(0, h.fuse - dt);
      if (h.fuse === 0) queue(fuse / dt, () => { if (h.phase === "active") h.dead = true; });
    } else if (h.kind === "ion") {
      const liveTime = Math.min(dt, Math.max(0, h.fuse));
      const endY = beforePilot.y + (s.pilot.y - beforePilot.y) * (liveTime / dt);
      const top = h.y - h.r - PHYS.squirrelR, bottom = h.y + h.r + PHYS.squirrelR;
      if (!h.hit && Math.max(beforePilot.y, endY) >= top && Math.min(beforePilot.y, endY) <= bottom) {
        const dy = s.pilot.y - beforePilot.y;
        const t = beforePilot.y >= top && beforePilot.y <= bottom ? 0 : ((dy > 0 ? top : bottom) - beforePilot.y) / dy;
        queue(t, () => { if (!h.dead && !h.hit && active(s)) { h.hit = true; effects.damagePilot(); } });
      }
      const fuse = h.fuse;
      h.fuse -= dt;
      if (h.fuse <= 0) queue(fuse / dt, () => {
        if (h.dead || !active(s)) return;
        h.pulse++;
        if (h.variant && h.pulse < 3) {
          // Move the next charged band onto the previous refuge, never during a warning.
          const candidate = { ...h, y: clamp(h.safeY, 45 + h.r, s.H - 45 - h.r), phase: "warning" as const };
          const safeY = refuge(s, candidate, effects.predictRock);
          if (safeY !== null && Math.abs(candidate.y - h.y) > h.r) {
            h.y = candidate.y; h.aimY = h.y; h.safeY = safeY;
            h.phase = "warning"; h.warn = SPILL_HAZARD_TUNING.warning; s.cues.push("warn");
          } else h.dead = true;
        } else h.dead = true;
      });
    } else if (!h.hit) {
      const t = sweep(beforePilot, s.pilot, before, h, h.r + PHYS.squirrelR);
      if (t !== null) queue(t, () => {
        if (h.dead || h.hit || h.phase !== "active" || !active(s)) return;
        h.hit = true; effects.damagePilot();
        if (h.kind === "comet") h.dead = true;
      });
    }
    if (h.kind === "gravity" && !h.salvageDropped && h.x < s.W - h.range * .3 && h.activeTime > .6) {
      h.salvageDropped = true;
      const side = h.safeY < h.y ? -1 : 1;
      s.nuts.push({ x: h.x - h.range * .5, y: clamp(h.y + side * h.range * .7, 28, s.H - 28),
        vx: h.vx, vy: 0, got: false, bob: h.id, kind: "gold" });
    }
    if (!active(s)) return;
    if (h.x < -h.range - 80 || h.y < -100 || h.y > s.H + 100) queue(1, () => { h.dead = true; });
  }
  s.hazards.actors = s.hazards.actors.filter(h => !h.dead);
}
/** Depot snapshots contain no live hazards, forces, telegraphs or armed fuses. */
export function restoreSpillHazards(value: unknown, seed: number): SpillHazardState | null {
  if (value === undefined) return createSpillHazards(seed);
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const h = value as SpillHazardState;
  if (h.version !== 1 || !Array.isArray(h.actors) || h.actors.length) return null;
  for (const key of ["rng", "nextId", "spawned"] as const) if (!Number.isInteger(h[key]) || h[key] < 0 || h[key] > 0xffffffff) return null;
  if (h.nextId < 1 || h.spawned > 4 || !Number.isFinite(h.next) || Math.abs(h.next) > 60) return null;
  return { version: 1, rng: h.rng, nextId: h.nextId, spawned: h.spawned, next: h.next, actors: [] };
}
