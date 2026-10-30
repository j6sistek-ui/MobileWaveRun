import type { SpillState } from "./spill";
import type { SpillEnemy, SpillShot } from "./spill-combat";
import { PHYS } from "./catalog";

export type SpillElite = {
  stage: "arrival" | "warning" | "exposed" | "exit";
  timer: number; cycle: number; pattern: "lock" | "fork"; aims: number[];
  /** Transient normalized exposure interval for this frame's swept impacts. */
  exposureWindow?: [number, number] | null;
};
export type SpillClimax = { version: 1; spawned: boolean };
export const createSpillClimax = (): SpillClimax => ({ version: 1, spawned: false });
export const spillClimaxWave = (wave: number) => wave >= 10 && wave % 5 === 0;
export function spillClimaxReserved(s: SpillState) {
  return spillClimaxWave(s.wave) && s.waveT >= s.spec.dur * .45;
}
const scale = (s: SpillState) => Math.max(.8, s.W / 390);
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** The second act replaces ambient/event/enemy pressure. Existing threats drain;
 * they are never erased to make an entrance. Survival, not a kill, clears the wave. */
export function admitSpillClimax(s: SpillState) {
  if (s.phase !== "wave" || !spillClimaxReserved(s) || s.climax.spawned || s.waveT > s.spec.dur - 7) return;
  if (s.eventWarn > 0 || s.surgeT > 0 || s.hazards.actors.some(h => !h.dead)
    || s.combat.enemies.some(e => !e.dead) || s.combat.shots.some(p => !p.dead && p.team === "enemy")
    || s.rocks.some(r => !r.dead && r.x + r.r > 0)) return;
  const x = s.W + 38, y = clamp(s.H * .5, 60, s.H - 60), hp = 12;
  s.combat.enemies.push({ id: s.combat.nextId++, kind: "pursuer", x, y, vx: -120 * scale(s), vy: 0, r: 24,
    hp, maxHp: hp, age: 0, life: Math.min(20, s.spec.dur - s.waveT), cooldown: 0,
    telegraph: 0, telegraphTotal: 1.35, aimX: s.W * .22, aimY: y, shotSpeed: 0,
    homeY: y, side: 1, hitFlash: 0, dead: false,
    elite: { stage: "arrival", timer: 0, cycle: 0, pattern: "lock", aims: [] } });
  s.climax.spawned = true;
  s.banner = "WARDEN · evade its volley; fire when its shield opens"; s.bannerT = 2.5;
  s.cues.push("warn");
}

/** This helper is used for weapons, splash, Pulse and environmental hits alike. */
export function spillEliteDamage(enemy: SpillEnemy, damage: number, time?: number) {
  const elite = enemy.elite;
  if (!elite) return damage;
  if (time !== undefined && elite.exposureWindow !== undefined) {
    const window = elite.exposureWindow;
    return window && time >= window[0] && (time < window[1] || (time === 1 && window[1] === 1)) ? damage : 0;
  }
  return elite.stage === "exposed" ? damage : 0;
}

function warn(s: SpillState, e: SpillEnemy) {
  const elite = e.elite!;
  elite.pattern = s.wave >= 20 && elite.cycle % 2 === 1 && s.pilot.y >= 105 && s.pilot.y <= s.H - 105 ? "fork" : "lock";
  e.aimX = s.pilot.x; e.aimY = s.pilot.y;
  // The fork brackets the frozen position, with a clear middle route.
  elite.aims = elite.pattern === "fork"
    ? [clamp(e.aimY - 76, 28, s.H - 28), clamp(e.aimY + 76, 28, s.H - 28)]
    : [e.aimY];
  elite.stage = "warning";
  elite.timer = e.telegraphTotal = 1.35 + (s.utilities.includes("scanner") ? .4 : 0);
  e.telegraph = elite.timer;
  e.vx = e.vy = 0;
  s.cues.push("warn");
}

/** Same projectile authority/timeline as ordinary enemies. No tracking after
 * the warning, no shield HP inflation, and no attack during arrival/retreat. */
export function stepSpillElite(s: SpillState, e: SpillEnemy, dt: number, emitted: SpillShot[]) {
  const elite = e.elite;
  if (!elite) return false;
  const life = e.life, remaining = elite.timer;
  elite.exposureWindow = elite.stage === "exposed" ? [0, Math.min(1, Math.max(0, life / dt))] : null;
  e.age += dt; e.life -= dt; e.hitFlash = Math.max(0, e.hitFlash - dt);
  if (s.phase === "drain" || e.life <= 0) elite.stage = "exit";
  if (s.phase === "drain") elite.exposureWindow = null;
  if (elite.stage === "exit") {
    e.telegraph = 0; e.vx = 240 * scale(s); e.vy = 0; e.x += e.vx * dt;
    if (e.x > s.W + e.r + 45) e.dead = true;
    return true;
  }
  if (elite.stage === "arrival") {
    const homeX = s.W * .8;
    e.vx = -120 * scale(s); e.x = Math.max(homeX, e.x + e.vx * dt);
    const targetY = clamp(e.homeY, 55, s.H - 55);
    e.vy = clamp(targetY - e.y, -80, 80); e.y += e.vy * dt;
    if (e.x <= homeX && Math.abs(e.y - targetY) < 2) warn(s, e);
    return true;
  }
  elite.timer = Math.max(0, elite.timer - dt);
  if (elite.stage === "warning") {
    e.telegraph = elite.timer;
    if (elite.timer > 0) return true;
    for (const y of elite.aims) {
      const dx = e.aimX - e.x, dy = y - e.y, distance = Math.max(1, Math.hypot(dx, dy));
      const speed = Math.min(290 * scale(s), Math.max(1, distance - PHYS.squirrelR - 6) / .9);
      if (s.combat.shots.length + emitted.length >= 60) break;
      emitted.push({ id: s.combat.nextId++, team: "enemy", weapon: "laser", x: e.x, y: e.y,
        vx: dx / distance * speed, vy: dy / distance * speed, r: 6, damage: 1, life: 4, dead: false });
    }
    elite.exposureWindow = [clamp(remaining / dt, 0, 1), 1];
    elite.stage = "exposed"; elite.timer = 3.2; s.cues.push("enemy-fire");
    return true;
  }
  if (elite.timer === 0 && !s.combat.shots.some(p => !p.dead && p.team === "enemy")) {
    elite.exposureWindow = [0, clamp(remaining / dt, 0, 1)];
    elite.cycle++;
    e.homeY = clamp(s.H * .5 + (elite.cycle % 2 ? -1 : 1) * Math.min(100, s.H * .2), 55, s.H - 55);
    elite.stage = "arrival";
  }
  return true;
}

export function resizeSpillClimax(s: SpillState, sy: number) {
  for (const e of s.combat.enemies) if (e.elite) e.elite.aims = e.elite.aims.map(y => y * sy);
}
export function restoreSpillClimax(raw: unknown): SpillClimax | null {
  if (raw === undefined) return createSpillClimax();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const c = raw as SpillClimax;
  return c.version === 1 && typeof c.spawned === "boolean" ? { version: 1, spawned: c.spawned } : null;
}
