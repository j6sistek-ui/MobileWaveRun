import type { SpillRock, SpillState } from "./spill";
import { PHYS } from "./catalog";

export type SpillHazardKind = "comet" | "mine" | "ion" | "gravity";
export const SPILL_HAZARD_IDS: SpillHazardKind[] = ["comet", "mine", "ion", "gravity"];
export const SPILL_HAZARDS: Record<SpillHazardKind, { name: string; short: string; teach: string; unlock: number }> = {
  comet: { name: "Comet strike", short: "Comets", unlock: 4,
    teach: "COMET: its path is marked before it moves. Leave the line or shoot the core." },
  mine: { name: "Drifting mines", short: "Mines", unlock: 7,
    teach: "MINES: shoot to disarm, or leave the blast ring before the fuse expires." },
  ion: { name: "Ion storm", short: "Ion storm", unlock: 11,
    teach: "ION STORM: leave the charged band before it flashes. Shots cannot stop it." },
  gravity: { name: "Gravity well", short: "Gravity wells", unlock: 16,
    teach: "GRAVITY WELL: steer against the gentle pull. Watch debris bend; avoid the core." },
};
export const SPILL_HAZARD_TUNING = {
  warning: 1.2, cometLead: .75, mineFuse: .9, mineRange: 68,
  ionPulse: .45, gravityX: 30, gravityY: 55, gravityBendSpeed: 26, gravityBendDuration: 2.4,
};
export type SpillHazard = {
  id: number; kind: SpillHazardKind; x: number; y: number; vx: number; vy: number; r: number;
  age: number; activeTime: number; life: number; warn: number; hp: number; maxHp: number; dead: boolean;
  aimX: number; aimY: number; phase: "warning" | "active" | "spent";
  fuse: number; pulse: number; safeY: number; range: number; variant: number; hit: boolean;
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
  const roll = hash(seed, wave), first = pool[roll % pool.length];
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
  }
}
export function spillHazardPressure(s: SpillState) { return s.hazards.actors.filter(h => !h.dead).length; }
export function spillHazardWarning(s: SpillState) { return s.hazards.actors.some(h => !h.dead && (h.warn > 0 || (h.kind === "mine" && h.fuse >= 0))); }
function atHome(s: SpillState, h: SpillHazard) {
  if (h.kind !== "comet" || Math.abs(h.vx) < .001) return h.y;
  return h.y + h.vy * (s.W * .22 - h.x) / h.vx;
}
function safeFor(s: SpillState, h: SpillHazard, y: number) {
  const center = atHome(s, h), margin = h.kind === "mine" ? h.range + 44 : h.r + 52;
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
  if (!plan.families.length || s.event !== "none" || s.waveT > s.spec.dur - 6) return;
  state.next -= dt;
  if (state.next > 0 || state.spawned >= (s.wave < 21 ? 3 : 4) || spillHazardPressure(s) >= plan.maxActive) return;
  if (s.eventWarn > 0 || s.surgeT > 0 || spillHazardWarning(s)
    || s.combat.enemies.some(e => !e.dead && e.telegraph > 0)
    || s.combat.shots.some(p => !p.dead && p.team === "enemy")) { state.next = .35; return; }
  const kind = plan.families[state.spawned % plan.families.length];
  for (let attempt = 0; attempt < 8; attempt++) {
    const r = kind === "ion" ? clamp(s.H * .08, 22, 36) : kind === "comet" ? 16 : 14;
    const x = kind === "ion" ? s.W * .5 : s.W + r + 24;
    const offset = kind === "gravity" ? (random(s) < .5 ? -1 : 1) * (74 + random(s) * 30) : (random(s) - .5) * 150;
    const y = clamp(s.pilot.y + offset, 45 + r, s.H - 45 - r);
    const aimX = s.W * .22;
    const aimY = clamp(kind === "comet" ? s.pilot.y + (random(s) - .5) * (plan.advanced ? 160 : 70) : y, 40, s.H - 40);
    const dx = aimX - x, dy = aimY - y, distance = Math.max(1, Math.hypot(dx, dy));
    const speed = Math.min((plan.advanced ? 800 : 630) * lane(s), Math.max(1, distance - r - PHYS.squirrelR) / SPILL_HAZARD_TUNING.cometLead);
    const h: SpillHazard = { id: state.nextId, kind, x, y,
      vx: kind === "comet" ? dx / distance * speed : kind === "ion" ? 0 : -70 * lane(s),
      vy: kind === "comet" ? dy / distance * speed : kind === "gravity" && plan.advanced ? (random(s) - .5) * 18 : 0,
      r, age: 0, activeTime: 0, life: kind === "ion" ? 8 : 10,
      warn: SPILL_HAZARD_TUNING.warning + (s.utilities.includes("scanner") ? .4 : 0),
      hp: kind === "mine" ? 2 : kind === "comet" ? 3 : 0, maxHp: kind === "mine" ? 2 : kind === "comet" ? 3 : 0,
      dead: false, aimX, aimY, phase: "warning", fuse: -1, pulse: 0,
      safeY: clamp(s.pilot.y + (y > s.pilot.y ? -110 : 110), 30, s.H - 30),
      range: kind === "gravity" ? clamp(s.H * .32, 95, 180) : kind === "mine" ? SPILL_HAZARD_TUNING.mineRange : r,
      variant: plan.advanced ? 1 : 0, hit: false };
    const safeY = refuge(s, h, predict);
    if (safeY === null) continue;
    h.safeY = safeY;
    for (const existing of state.actors) existing.safeY = safeY;
    state.actors.push(h); state.nextId++; state.spawned++;
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
export function damageSpillHazard(s: SpillState, h: SpillHazard, damage: number) {
  if (h.dead || h.hp <= 0 || h.warn > 0 || h.phase !== "active" || !(damage > 0)) return false;
  h.hp -= damage;
  if (h.hp > 0) return true;
  h.dead = true;
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
      if (h.warn === 0) { h.phase = "active"; h.activeTime = 0; h.hit = false; h.fuse = h.kind === "ion" ? SPILL_HAZARD_TUNING.ionPulse : -1; }
      // Activation starts next tick: no full-frame movement/damage on a warning's last sliver.
      continue;
    }
    if (h.phase === "spent") {
      h.fuse -= dt; if (h.fuse <= 0) h.dead = true;
      continue;
    }
    const before = { x: h.x, y: h.y };
    h.activeTime += dt; h.x += h.vx * dt; h.y += h.vy * dt;
    if (h.kind === "gravity" && (h.y < 45 || h.y > s.H - 45)) { h.y = clamp(h.y, 45, s.H - 45); h.vy *= -1; }
    if (h.kind === "mine") {
      if (h.fuse < 0 && sweep(beforePilot, s.pilot, before, h, h.range + PHYS.squirrelR) !== null) { h.fuse = SPILL_HAZARD_TUNING.mineFuse; s.cues.push("warn"); }
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
            if (Math.hypot(point.x - pilot.x, point.y - pilot.y) <= h.range + PHYS.squirrelR) { h.hit = true; effects.damagePilot(); }
          });
        }
      }
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
        if (h.dead || h.hit || !active(s)) return;
        h.hit = true; effects.damagePilot();
        if (h.kind === "comet") h.dead = true;
      });
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
