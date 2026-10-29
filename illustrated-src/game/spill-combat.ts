import type { SpillRock, SpillState } from "./spill";

/** Combat stays in the same 60 Hz authority as the field. Nothing here owns input or rendering. */
export type SpillWeaponId = "laser" | "cannon";
export type SpillEnemyKind = "pursuer" | "flanker";
export const SPILL_WEAPONS: Record<SpillWeaponId, {
  name: string; description: string; cooldown: number; speed: number; damage: number; radius: number;
}> = {
  laser: { name: "Rapid Laser", description: "Fast, light shots with gentle forward aim assistance.", cooldown: 0.16, speed: 720, damage: 1, radius: 3 },
  cannon: { name: "Heavy Cannon", description: "Slower, heavier shots that break tough debris.", cooldown: 0.65, speed: 540, damage: 4, radius: 6 },
};

export type SpillEnemy = {
  id: number; kind: SpillEnemyKind; x: number; y: number; vx: number; vy: number; r: number;
  hp: number; maxHp: number; age: number; life: number; cooldown: number;
  /** Seconds remaining. The enemy holds position and the target is frozen throughout this warning. */
  telegraph: number; telegraphTotal: number; aimX: number; aimY: number; shotSpeed: number;
  homeY: number; side: number; hitFlash: number; dead: boolean;
};
export type SpillShot = {
  id: number; team: "player" | "enemy"; weapon: SpillWeaponId;
  x: number; y: number; vx: number; vy: number; r: number; damage: number; life: number; dead: boolean;
};
export type SpillCombat = {
  version: 1; weapon: SpillWeaponId; levels: Record<SpillWeaponId, number>;
  firing: boolean; cooldown: number; enemies: SpillEnemy[]; shots: SpillShot[];
  kills: number; waveKills: number; rng: number; nextId: number; nextEnemy: number; spawned: number;
  /** Keeps enemy warnings from all committing on the same frame. */
  enemyFireGap: number; targetId: number | null; muzzleFlash: number;
};
type Point = { x: number; y: number };
export type SpillCombatMotion = { pilot: Point; rocks: Map<SpillRock, Point> };
export type SpillCombatEffects = {
  shipRadius: number;
  shatter: (rock: SpillRock) => void;
  damagePilot: () => void;
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const scale = (s: SpillState) => Math.max(0.8, s.W / 390);
const active = (s: SpillState) => s.phase === "wave" || s.phase === "drain";
const validWeapon = (id: unknown): id is SpillWeaponId => id === "laser" || id === "cannon";
const depotOpen = (s: SpillState) => s.phase === "depot" && !!s.depot && s.depot.arm <= 0;
function random(c: SpillCombat) {
  c.rng = (c.rng + 0x6d2b79f5) >>> 0;
  let x = c.rng;
  x = Math.imul(x ^ (x >>> 15), x | 1);
  x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
  return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
}

export function createSpillCombat(seed: number): SpillCombat {
  return { version: 1, weapon: "laser", levels: { laser: 1, cannon: 1 }, firing: false,
    cooldown: 0, enemies: [], shots: [], kills: 0, waveKills: 0,
    rng: (seed ^ 0x63a94f21) >>> 0, nextId: 1, nextEnemy: 4.5, spawned: 0,
    enemyFireGap: 0, targetId: null, muzzleFlash: 0 };
}

export function spillSetFiring(s: SpillState, held: boolean) {
  s.combat.firing = held === true && active(s);
}
export function spillSelectWeapon(s: SpillState, id: SpillWeaponId): boolean {
  if (!depotOpen(s) || !validWeapon(id)) return false;
  s.combat.weapon = id;
  s.combat.firing = false;
  s.combat.cooldown = 0;
  s.cues.push("buy");
  return true;
}
export function spillWeaponPrice(s: SpillState): number | null {
  const level = s.combat.levels[s.combat.weapon];
  return level >= 3 ? null : level === 1 ? 65 : 130;
}
export function spillWeaponStats(s: SpillState, id: SpillWeaponId = s.combat.weapon) {
  const weapon = SPILL_WEAPONS[id], level = s.combat.levels[id];
  return { ...weapon, damage: weapon.damage * level,
    cooldown: weapon.cooldown * (1 - (level - 1) * 0.07) };
}
export function spillUpgradeWeapon(s: SpillState): boolean {
  const price = spillWeaponPrice(s);
  if (!depotOpen(s) || price === null || s.ore < price) return false;
  s.ore -= price;
  s.combat.levels[s.combat.weapon]++;
  s.cues.push("buy");
  return true;
}

/** Transient combat never follows the pilot into a countdown, Depot, death or extra-life reset. */
export function clearSpillCombat(s: SpillState) {
  const c = s.combat;
  c.firing = false; c.cooldown = 0; c.enemies = []; c.shots = [];
  c.targetId = null; c.muzzleFlash = 0; c.enemyFireGap = 0;
}
export function beginSpillCombatWave(s: SpillState) {
  clearSpillCombat(s);
  s.combat.waveKills = 0; s.combat.spawned = 0;
  s.combat.nextEnemy = 4.5 + random(s.combat) * 1.5;
}
export function resizeSpillCombat(s: SpillState, sx: number, sy: number) {
  s.combat.firing = false;
  for (const e of s.combat.enemies) {
    e.x *= sx; e.y *= sy; e.vx *= sx; e.vy *= sy;
    e.aimX *= sx; e.aimY *= sy; e.homeY *= sy;
    e.shotSpeed *= Math.min(sx, sy);
  }
  for (const shot of s.combat.shots) { shot.x *= sx; shot.y *= sy; shot.vx *= sx; shot.vy *= sy; }
}

export function captureSpillCombatMotion(s: SpillState): SpillCombatMotion {
  return { pilot: { x: s.pilot.x, y: s.pilot.y }, rocks: new Map(s.rocks.map(r => [r, { x: r.x, y: r.y }])) };
}

/** Combat has its own pressure allocation, replacing some ambient rocks rather than adding to their cap. */
export function spillCombatPressure(s: SpillState) {
  const enemies = s.combat.enemies.filter(e => !e.dead).length;
  return enemies || (s.combat.shots.some(shot => shot.team === "enemy" && !shot.dead) ? 1 : 0);
}

export function spillCombatRockClear(s: SpillState, rock: SpillRock) {
  return s.combat.enemies.every(e => e.dead || Math.hypot(e.x - rock.x, e.y - rock.y) > e.r + rock.r + 24);
}

function spawnEnemy(s: SpillState): boolean {
  const c = s.combat;
  const kind: SpillEnemyKind = c.spawned % 2 === 0 ? "pursuer" : "flanker";
  const r = kind === "pursuer" ? 18 : 16;
  const x = s.W + r + 12;
  for (let attempt = 0; attempt < 8; attempt++) {
    const margin = Math.min(100, s.H * 0.22);
    const y = margin + random(c) * Math.max(1, s.H - margin * 2);
    if (Math.hypot(x - s.pilot.x, y - s.pilot.y) < 150) continue;
    if (c.enemies.some(e => !e.dead && Math.hypot(e.x - x, e.y - y) < e.r + r + 90)) continue;
    // Check the arrival segment too; appearing behind a rock is not a readable entrance.
    if (s.rocks.some(rock => !rock.dead && [0, 0.25, 0.5, 0.75].some(t => {
      const move = Math.max(0, t - rock.warn);
      return Math.hypot(x - 100 * scale(s) * t - (rock.x + rock.vx * move), y - (rock.y + rock.vy * move)) < r + rock.r + 30;
    }))) continue;
    const hp = (kind === "pursuer" ? 4 : 3) + Math.min(3, Math.floor(s.wave / 12));
    c.enemies.push({ id: c.nextId++, kind, x, y, vx: -100 * scale(s), vy: 0, r, hp, maxHp: hp,
      age: 0, life: 8.5, cooldown: 1.8, telegraph: 0, telegraphTotal: 0.9,
      aimX: x - 100, aimY: y, shotSpeed: 0, homeY: y, side: random(c) < 0.5 ? -1 : 1,
      hitFlash: 0, dead: false });
    c.spawned++;
    s.cues.push("warn");
    return true;
  }
  return false;
}

/** Admission is separate from stepping so the ambient director sees the new pressure immediately. */
export function admitSpillEnemies(s: SpillState, dt: number) {
  if (s.phase !== "wave" || s.wave < 2 || s.waveT >= s.spec.dur - 4) return;
  const c = s.combat;
  c.nextEnemy -= dt;
  const cap = s.wave < 10 ? 2 : 3;
  if (c.nextEnemy > 0 || c.enemies.filter(e => !e.dead).length >= cap || c.spawned >= (s.wave < 10 ? 3 : 5)) return;
  if (s.eventWarn > 0 || s.surgeT > 0) return;
  c.nextEnemy = spawnEnemy(s) ? 5.5 + random(c) * 2 : 0.5;
}

/** First entry into a moving circle, in normalized time. A cover tie wins at the caller. */
function sweep(a: Point, b: Point, before: Point, after: Point, radius: number): number | null {
  const x = a.x - before.x, y = a.y - before.y;
  const vx = b.x - a.x - (after.x - before.x), vy = b.y - a.y - (after.y - before.y);
  const cc = x * x + y * y - radius * radius;
  if (cc <= 0) return 0;
  const aa = vx * vx + vy * vy;
  if (aa < 1e-12) return null;
  const bb = 2 * (x * vx + y * vy), disc = bb * bb - 4 * aa * cc;
  if (disc < 0) return null;
  const hit = (-bb - Math.sqrt(disc)) / (2 * aa);
  return hit >= 0 && hit <= 1 ? hit : null;
}

function killEnemy(s: SpillState, e: SpillEnemy) {
  if (e.dead) return;
  e.dead = true;
  s.combat.kills++; s.combat.waveKills++;
  s.score += e.kind === "pursuer" ? 25 : 35;
  s.bursts.push({ x: e.x, y: e.y, n: 16, power: 1.1, tone: "shatter" });
  // Rewards stay physical pickups and pass through the existing collection/contract ledger.
  const count = e.kind === "pursuer" ? 3 : 4;
  for (let i = 0; i < count; i++) s.nuts.push({ x: e.x + i * 10, y: e.y,
    vx: -90 * scale(s), vy: 0, got: false, bob: i, kind: "ore" });
  s.cues.push("enemy-down");
}

/** The existing impact pulse also clears nearby hostile fire and damages nearby enemies. */
export function spillCombatPulse(s: SpillState, radius: number): number {
  let hits = 0;
  for (const shot of s.combat.shots)
    if (shot.team === "enemy" && Math.hypot(shot.x - s.pilot.x, shot.y - s.pilot.y) < radius) shot.dead = true;
  for (const e of s.combat.enemies) {
    if (e.dead || Math.hypot(e.x - s.pilot.x, e.y - s.pilot.y) >= radius) continue;
    e.hp -= s.up.pulse >= 3 ? 3 : 2; e.hitFlash = 0.15; hits++;
    if (e.hp <= 0) killEnemy(s, e);
  }
  return hits;
}

function aimTarget(s: SpillState) {
  let best: SpillEnemy | null = null, distance = Infinity;
  for (const e of s.combat.enemies) {
    const dx = e.x - s.pilot.x, dy = e.y - s.pilot.y;
    if (e.dead || dx <= 20 || e.x > s.W || Math.abs(Math.atan2(dy, dx)) > 0.24) continue;
    const d = Math.hypot(dx, dy);
    if (d < distance) { best = e; distance = d; }
  }
  return best;
}

export function stepSpillCombat(s: SpillState, dt: number, motion: SpillCombatMotion, effects: SpillCombatEffects) {
  if (!active(s) || dt <= 0) return;
  const c = s.combat;
  c.cooldown = Math.max(0, c.cooldown - dt);
  c.muzzleFlash = Math.max(0, c.muzzleFlash - dt);
  c.enemyFireGap = Math.max(0, c.enemyFireGap - dt);
  const enemyBefore = new Map<SpillEnemy, Point>();
  const emitted: SpillShot[] = [];
  for (const e of c.enemies) {
    if (e.dead) continue;
    enemyBefore.set(e, { x: e.x, y: e.y });
    e.age += dt; e.life -= dt; e.hitFlash = Math.max(0, e.hitFlash - dt);
    if (s.phase === "drain" || e.life <= 0) {
      e.telegraph = 0; e.vx = 180 * scale(s); e.vy = 0; e.x += e.vx * dt;
      if (e.x > s.W + e.r + 45) e.dead = true;
      continue;
    }
    if (e.telegraph > 0) {
      e.vx = e.vy = 0;
      e.telegraph = Math.max(0, e.telegraph - dt);
      if (e.telegraph === 0) {
        const dx = e.aimX - e.x, dy = e.aimY - e.y, d = Math.max(1, Math.hypot(dx, dy));
        emitted.push({ id: c.nextId++, team: "enemy", weapon: "laser", x: e.x, y: e.y,
          vx: dx / d * e.shotSpeed, vy: dy / d * e.shotSpeed, r: 5, damage: 1, life: 3, dead: false });
        e.cooldown = e.kind === "pursuer" ? 2.3 : 2.8;
        s.cues.push("enemy-fire");
      }
      continue;
    }
    const homeX = s.W * (e.kind === "pursuer" ? 0.74 : 0.86);
    e.vx = e.x > homeX + 1 ? -100 * scale(s) : 0;
    const desiredY = e.kind === "pursuer" ? s.pilot.y : e.homeY + Math.sin(e.age * 1.2) * 85 * e.side;
    e.vy = clamp(desiredY - e.y, -42, 42);
    e.x = Math.max(homeX, e.x + e.vx * dt);
    e.y = clamp(e.y + e.vy * dt, 45, s.H - 85);
    e.cooldown = Math.max(0, e.cooldown - dt);
    if (e.cooldown === 0 && e.x <= s.W - e.r && e.x - s.pilot.x > 50 && c.enemyFireGap === 0 && s.eventWarn <= 0 && s.surgeT <= 0) {
      e.aimX = s.pilot.x; e.aimY = s.pilot.y;
      const distance = Math.hypot(e.x - e.aimX, e.y - e.aimY);
      // After the 0.9 s frozen warning, the projectile still grants >=0.75 s to contact.
      e.shotSpeed = Math.min(245 * scale(s), Math.max(1, distance - effects.shipRadius - 5) / 0.75);
      e.telegraph = e.telegraphTotal;
      c.enemyFireGap = 1.4;
      s.cues.push("warn");
    }
  }

  const target = aimTarget(s);
  c.targetId = target?.id ?? null;
  if (c.firing && c.cooldown === 0 && c.shots.length < 60) {
    const weapon = spillWeaponStats(s);
    const muzzleX = s.pilot.x + effects.shipRadius + 4;
    const angle = target ? Math.atan2(target.y - s.pilot.y, target.x - muzzleX) : 0;
    const speed = weapon.speed * scale(s);
    emitted.push({ id: c.nextId++, team: "player", weapon: c.weapon,
      x: muzzleX, y: s.pilot.y,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      r: weapon.radius, damage: weapon.damage, life: 1.4, dead: false });
    c.cooldown = weapon.cooldown;
    c.muzzleFlash = 0.075;
    s.cues.push(c.weapon);
  }

  // Newly emitted shots start at this tick's final muzzle position and move next tick.
  // This avoids granting a full tick of travel after a warning that expired at its end.
  // Publish them now so an impact pulse in this tick clears them too.
  c.shots = c.shots.concat(emitted);
  const newShots = new Set(emitted);
  for (const shot of c.shots) {
    if (shot.dead || newShots.has(shot)) continue;
    const time = Math.min(dt, Math.max(0, shot.life));
    if (time <= 0) { shot.dead = true; continue; }
    const fraction = time / dt;
    const from = { x: shot.x, y: shot.y }, to = { x: shot.x + shot.vx * time, y: shot.y + shot.vy * time };
    let first = Infinity;
    let rockHit: SpillRock | null = null, enemyHit: SpillEnemy | null = null, pilotHit = false;
    const atEnd = (before: Point, after: Point) => ({ x: before.x + (after.x - before.x) * fraction, y: before.y + (after.y - before.y) * fraction });
    for (const rock of s.rocks) {
      if (rock.dead || rock.warn > 0) continue;
      const before = motion.rocks.get(rock) ?? rock;
      const hit = sweep(from, to, before, atEnd(before, rock), shot.r + rock.r);
      if (hit !== null && hit < first) { first = hit; rockHit = rock; enemyHit = null; pilotHit = false; }
    }
    if (shot.team === "player") {
      for (const e of c.enemies) {
        if (e.dead) continue;
        const before = enemyBefore.get(e) ?? e;
        const hit = sweep(from, to, before, atEnd(before, e), shot.r + e.r);
        if (hit !== null && hit < first - 1e-9) { first = hit; enemyHit = e; rockHit = null; }
      }
    } else {
      const hit = sweep(from, to, motion.pilot, atEnd(motion.pilot, s.pilot), shot.r + effects.shipRadius);
      if (hit !== null && hit < first - 1e-9) { first = hit; pilotHit = true; rockHit = null; }
    }
    shot.life -= time;
    shot.x = from.x + (to.x - from.x) * Math.min(1, first);
    shot.y = from.y + (to.y - from.y) * Math.min(1, first);
    if (first !== Infinity) {
      shot.dead = true;
      if (rockHit && shot.team === "player") {
        const maxHp = rockHit.kind === "hulk" ? 10 : rockHit.kind === "tumbler" ? 4 : rockHit.kind === "spinner" ? 2 : 1;
        rockHit.hp = (rockHit.hp ?? maxHp) - shot.damage;
        if (rockHit.hp <= 0) effects.shatter(rockHit);
        else s.bursts.push({ x: shot.x, y: shot.y, n: 3, power: 0.3, tone: "hit" });
      } else if (enemyHit) {
        enemyHit.hp -= shot.damage; enemyHit.hitFlash = 0.12;
        if (enemyHit.hp <= 0) killEnemy(s, enemyHit);
      } else if (pilotHit) {
        effects.damagePilot();
        if (!active(s)) return;
      }
    }
    if (shot.life <= 0 || shot.x < -60 || shot.x > s.W + 100 || shot.y < -60 || shot.y > s.H + 60) shot.dead = true;
  }
  c.shots = c.shots.filter(shot => !shot.dead).slice(0, 64);
  c.enemies = c.enemies.filter(e => !e.dead);
}

/** Checkpoints are only written at the Depot. Live entities/input must never be accepted from storage. */
export function restoreSpillCombat(value: unknown, seed: number): SpillCombat | null {
  if (value === undefined) return createSpillCombat(seed); // original version-1 checkpoints
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const c = value as SpillCombat;
  if (c.version !== 1 || !validWeapon(c.weapon) || !c.levels || typeof c.levels !== "object") return null;
  for (const id of ["laser", "cannon"] as const)
    if (!Number.isInteger(c.levels[id]) || c.levels[id] < 1 || c.levels[id] > 3) return null;
  for (const key of ["kills", "waveKills", "rng", "nextId", "spawned"] as const)
    if (!Number.isInteger(c[key]) || c[key] < 0 || c[key] > 0xffffffff) return null;
  if (c.waveKills > c.kills || c.nextId < 1 || c.spawned > 5) return null;
  if (typeof c.nextEnemy !== "number" || !Number.isFinite(c.nextEnemy) || Math.abs(c.nextEnemy) > 60) return null;
  if (c.firing !== false || c.cooldown !== 0 || c.enemyFireGap !== 0 || c.targetId !== null || c.muzzleFlash !== 0) return null;
  if (!Array.isArray(c.enemies) || c.enemies.length || !Array.isArray(c.shots) || c.shots.length) return null;
  return { ...createSpillCombat(seed), weapon: c.weapon, levels: { laser: c.levels.laser, cannon: c.levels.cannon },
    kills: c.kills, waveKills: c.waveKills, rng: c.rng, nextId: c.nextId, nextEnemy: c.nextEnemy, spawned: c.spawned };
}
