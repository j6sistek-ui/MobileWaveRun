import { drawSprite, type ArtBank } from "./art";
import { SPILL, type SpillState } from "./spill";
import { SPILL_WEAPONS, type SpillEnemy, type SpillShot } from "./spill-combat";

const TAU = Math.PI * 2;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const flight = (s: SpillState) => s.phase === "wave" || s.phase === "drain";

function line(ctx: CanvasRenderingContext2D, x: number, y: number, x2: number, y2: number) {
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke();
}

function enemyShape(enemy: SpillEnemy, art: ArtBank) {
  const sprite = art.spillCombat?.[enemy.kind];
  // Like the player's 58px hull, the painted tips extend beyond the forgiving
  // collision core. Both source sprites keep their original orientation.
  const width = enemy.r * (enemy.kind === "pursuer" ? 3.5 : 4.5);
  const height = sprite ? width * sprite.box.h / Math.max(sprite.box.w, sprite.box.h)
    : width * (enemy.kind === "pursuer" ? .5 : .78);
  return { sprite, width, height };
}

function fallbackHull(ctx: CanvasRenderingContext2D, enemy: SpillEnemy, width: number, height: number) {
  const { x, y, kind } = enemy;
  ctx.fillStyle = kind === "pursuer" ? "#a73e3d" : "#277c79";
  ctx.strokeStyle = "#dfbc84"; ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x - width / 2, y);
  if (kind === "flanker") {
    ctx.lineTo(x + width * .28, y - height / 2); ctx.lineTo(x + width * .12, y - height * .17);
    ctx.lineTo(x + width / 2, y - height * .17); ctx.lineTo(x + width / 2, y + height * .17);
    ctx.lineTo(x + width * .12, y + height * .17); ctx.lineTo(x + width * .28, y + height / 2);
  } else {
    ctx.lineTo(x + width * .12, y - height * .28); ctx.lineTo(x + width * .4, y - height / 2);
    ctx.lineTo(x + width / 2, y - height * .22); ctx.lineTo(x + width / 2, y + height * .22);
    ctx.lineTo(x + width * .4, y + height / 2); ctx.lineTo(x + width * .12, y + height * .28);
  }
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#f6c265"; ctx.beginPath(); ctx.ellipse(x - width * .12, y, width * .12, height * .13, 0, 0, TAU); ctx.fill();
}

function drawEnemy(ctx: CanvasRenderingContext2D, s: SpillState, art: ArtBank, enemy: SpillEnemy) {
  const { sprite, width, height } = enemyShape(enemy, art);
  const { x, y } = enemy;
  const wake = 7 + (Math.sin(enemy.age * 21 + enemy.id) + 1) * 2;
  ctx.fillStyle = "rgba(255,174,85,.44)";
  ctx.beginPath(); ctx.moveTo(x + width * .43, y - 3); ctx.lineTo(x + width * .43 + wake, y);
  ctx.lineTo(x + width * .43, y + 3); ctx.closePath(); ctx.fill();
  if (sprite) drawSprite(ctx, sprite, x, y, width);
  else fallbackHull(ctx, enemy, width, height);
  if (enemy.hitFlash > 0) {
    ctx.save(); ctx.globalAlpha = clamp(enemy.hitFlash / .12, 0, 1) * .45;
    ctx.globalCompositeOperation = "screen";
    if (sprite) drawSprite(ctx, sprite, x, y, width);
    else fallbackHull(ctx, enemy, width, height);
    ctx.restore();
  }
  // Full-health enemies carry no permanent bar. A damaged hull exposes its
  // remaining protection without adding numbers over the flight lane.
  if (enemy.hp < enemy.maxHp) {
    const bx = clamp(x - 16, 6, s.W - 38), by = clamp(y - height / 2 - 8, 6, s.H - 10);
    ctx.fillStyle = "rgba(8,12,22,.85)"; ctx.fillRect(bx - 1, by - 1, 34, 5);
    ctx.fillStyle = "#ffb291"; ctx.fillRect(bx, by, 32 * clamp(enemy.hp / enemy.maxHp, 0, 1), 3);
  }
  if (s.combat.targetId === enemy.id) {
    const left = x - width / 2 - 4, right = x + width / 2 + 4;
    const top = y - height / 2 - 4, bottom = y + height / 2 + 4;
    ctx.strokeStyle = "rgba(124,238,255,.76)"; ctx.lineWidth = 1.25;
    for (const [cx, cy, dx, dy] of [[left, top, 1, 1], [right, top, -1, 1], [left, bottom, 1, -1], [right, bottom, -1, -1]]) {
      ctx.beginPath(); ctx.moveTo(cx + dx * 5, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, cy + dy * 5); ctx.stroke();
    }
  }
  if (enemy.telegraph > 0) {
    const progress = clamp(1 - enemy.telegraph / Math.max(.01, enemy.telegraphTotal), 0, 1);
    const dx = enemy.aimX - x, dy = enemy.aimY - y, distance = Math.max(1, Math.hypot(dx, dy));
    const muzzleX = x + dx / distance * width * .48, muzzleY = y + dy / distance * width * .48;
    ctx.fillStyle = `rgba(255,143,92,${.15 + progress * .25})`;
    ctx.beginPath(); ctx.arc(muzzleX, muzzleY, 6 + progress * 4, 0, TAU); ctx.fill();
    ctx.strokeStyle = "#ffd3a0"; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.arc(muzzleX, muzzleY, 5, -Math.PI / 2, -Math.PI / 2 + TAU * progress); ctx.stroke();
  }
}

function drawShot(ctx: CanvasRenderingContext2D, shot: SpillShot) {
  const length = Math.max(1, Math.hypot(shot.vx, shot.vy));
  const dx = shot.vx / length, dy = shot.vy / length;
  if (shot.team === "enemy") {
    // An orange-red diamond and dark rim distinguish hostile rounds from both
    // cyan laser streaks and round, gold cannon shells, including in Blackout.
    const radius = shot.r + 1;
    ctx.strokeStyle = "rgba(255,95,76,.45)"; ctx.lineWidth = 3;
    line(ctx, shot.x, shot.y, shot.x - dx * 10, shot.y - dy * 10);
    ctx.fillStyle = "#ff775f"; ctx.strokeStyle = "#35141a"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(shot.x - radius, shot.y); ctx.lineTo(shot.x, shot.y - radius);
    ctx.lineTo(shot.x + radius, shot.y); ctx.lineTo(shot.x, shot.y + radius); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#fff1d6"; ctx.fillRect(shot.x - 1.2, shot.y - 1.2, 2.4, 2.4);
  } else if (shot.weapon === "laser") {
    ctx.lineCap = "round"; ctx.strokeStyle = "rgba(83,220,255,.24)"; ctx.lineWidth = 7;
    line(ctx, shot.x - dx * 16, shot.y - dy * 16, shot.x, shot.y);
    ctx.strokeStyle = "#89eeff"; ctx.lineWidth = 3;
    line(ctx, shot.x - dx * 16, shot.y - dy * 16, shot.x, shot.y);
    ctx.strokeStyle = "#efffff"; ctx.lineWidth = 1;
    line(ctx, shot.x - dx * 11, shot.y - dy * 11, shot.x, shot.y);
  } else {
    ctx.lineCap = "round"; ctx.strokeStyle = "rgba(255,171,65,.45)"; ctx.lineWidth = 5;
    line(ctx, shot.x - dx * 12, shot.y - dy * 12, shot.x, shot.y);
    ctx.fillStyle = "#ffd47b"; ctx.strokeStyle = "#654022"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(shot.x, shot.y, shot.r, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#fff7cf"; ctx.beginPath(); ctx.arc(shot.x - dx, shot.y - dy, 2, 0, TAU); ctx.fill();
  }
}

/** Paint only: warning endpoints and projectile centers are authority coordinates.
 * No random draws, simulation stepping, timers, retained canvases or state mutation. */
export function drawSpillCombat(ctx: CanvasRenderingContext2D, s: SpillState, art: ArtBank) {
  if (!s.combat || !flight(s)) return;
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, s.W, s.H); ctx.clip();
  for (const enemy of s.combat.enemies) {
    if (enemy.dead || enemy.telegraph <= 0) continue;
    const progress = clamp(1 - enemy.telegraph / Math.max(.01, enemy.telegraphTotal), 0, 1);
    ctx.strokeStyle = `rgba(255,155,105,${.28 + progress * .34})`; ctx.lineWidth = 1.25;
    ctx.setLineDash([5, 6]);
    line(ctx, enemy.x, enemy.y, enemy.aimX, enemy.aimY);
    ctx.setLineDash([]);
    ctx.strokeStyle = "rgba(255,170,114,.65)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(enemy.aimX, enemy.aimY, 6, 0, TAU); ctx.stroke();
  }
  for (const enemy of s.combat.enemies) if (!enemy.dead) drawEnemy(ctx, s, art, enemy);
  for (const shot of s.combat.shots) if (!shot.dead) drawShot(ctx, shot);
  if (s.combat.muzzleFlash > 0) {
    const amount = clamp(s.combat.muzzleFlash / .075, 0, 1);
    const x = s.pilot.x + SPILL.shipR + 4, y = s.pilot.y;
    ctx.globalAlpha = amount; ctx.fillStyle = s.combat.weapon === "laser" ? "#b1f5ff" : "#ffdf9c";
    ctx.beginPath(); ctx.moveTo(x - 3, y); ctx.lineTo(x + 5, y - 4);
    ctx.lineTo(x + 11, y); ctx.lineTo(x + 5, y + 4); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

/** The top-right slot begins below HEALTH/SHIELDS and finishes above status
 * banners. HUD caller already translates by the device's top safe area. */
export function drawSpillCombatHud(ctx: CanvasRenderingContext2D, s: SpillState) {
  if (!s.combat || !flight(s)) return;
  const c = s.combat, x = s.W - 104, y = 53, width = 92, height = 34;
  const cannon = c.weapon === "cannon", level = c.levels[c.weapon];
  const color = cannon ? "#ffda91" : "#9ceeff";
  ctx.save(); ctx.fillStyle = "rgba(9,17,30,.82)";
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = color; ctx.fillRect(x, y, 2, height);
  ctx.textAlign = "left"; ctx.font = "800 10px Figtree,system-ui";
  ctx.fillText(`${cannon ? "CANNON" : "LASER"} ${["", "I", "II", "III"][level] ?? "I"}`, x + 8, y + 12);
  ctx.fillStyle = c.firing ? color : "#b9c5d3"; ctx.font = "600 8px Figtree,system-ui";
  ctx.fillText(c.firing ? "FIRING" : "2ND TOUCH / F", x + 8, y + 24);
  const duration = SPILL_WEAPONS[c.weapon].cooldown * (1 - (level - 1) * .07);
  ctx.fillStyle = "rgba(255,255,255,.14)"; ctx.fillRect(x + 8, y + 29, width - 16, 2);
  ctx.fillStyle = color; ctx.fillRect(x + 8, y + 29, (width - 16) * clamp(1 - c.cooldown / duration, 0, 1), 2);
  ctx.restore();
}
