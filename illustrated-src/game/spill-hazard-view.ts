import { SPILL, spillRockAt, type SpillState } from "./spill";
import { SPILL_HAZARD_TUNING, type SpillHazard, type SpillHazardKind } from "./spill-hazards";

const TAU = Math.PI * 2;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const COLORS: Record<SpillHazardKind, string> = {
  comet: "#ffd399", mine: "#ffad87", ion: "#e8acff", gravity: "#bbaaff",
};
const HINTS: Record<SpillHazardKind, string> = {
  comet: "COMET · leave the marked path",
  mine: "MINES · shoot to disarm; leave the ring",
  ion: "ION STORM · leave the charged band",
  gravity: "GRAVITY · counter-steer; debris bends",
};
const flight = (s: SpillState) => s.phase === "wave" || s.phase === "drain";

function line(ctx: CanvasRenderingContext2D, x: number, y: number, x2: number, y2: number) {
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke();
}
function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU);
}
function label(ctx: CanvasRenderingContext2D, s: SpillState, text: string, x: number, y: number, color: string) {
  ctx.font = "800 10px Figtree,system-ui"; ctx.textAlign = "center";
  const width = ctx.measureText(text).width + 14;
  x = clamp(x, width / 2 + 8, s.W - width / 2 - 8);
  y = clamp(y, 112, s.H - 34);
  ctx.fillStyle = "rgba(6,12,26,.88)"; ctx.fillRect(x - width / 2, y - 12, width, 19);
  ctx.fillStyle = color; ctx.fillText(text, x, y + 1);
}

function comet(ctx: CanvasRenderingContext2D, s: SpillState, h: SpillHazard, reduced: boolean) {
  const warning = h.phase === "warning", color = COLORS.comet;
  if (warning) {
    // The captured velocity continues past the original aim point to the
    // left edge. A dodge behind the home lane is still on this same path.
    const endX = h.vx < -.01 ? 0 : h.aimX;
    const endY = h.vx < -.01 ? h.y + (endX - h.x) * h.vy / h.vx : h.aimY;
    ctx.strokeStyle = "rgba(255,193,118,.09)"; ctx.lineWidth = h.r * 2;
    line(ctx, h.x, h.y, endX, endY);
    ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.setLineDash([7, 7]);
    line(ctx, h.x, h.y, endX, endY); ctx.setLineDash([]);
    // The entry arrow is an edge cue, not a second collision body.
    const x = clamp(h.x, 12, s.W - 12);
    const y = Math.abs(h.vx) > .01 ? h.y + (x - h.x) * h.vy / h.vx : h.y;
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(x - 7, y);
    ctx.lineTo(x + 3, y - 7); ctx.lineTo(x + 3, y + 7); ctx.closePath(); ctx.fill();
    label(ctx, s, `COMET · ${h.warn.toFixed(1)}s`, s.W - 67, y - 25, color);
    return;
  }
  const speed = Math.max(1, Math.hypot(h.vx, h.vy)), dx = h.vx / speed, dy = h.vy / speed;
  const tail = reduced ? 26 : 48;
  ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(255,159,81,.14)"; ctx.lineWidth = h.r * 1.6;
  line(ctx, h.x, h.y, h.x - dx * tail, h.y - dy * tail);
  ctx.strokeStyle = "rgba(255,209,148,.6)"; ctx.lineWidth = 4;
  line(ctx, h.x, h.y, h.x - dx * tail * .7, h.y - dy * tail * .7);
  const glow = ctx.createRadialGradient(h.x, h.y, 1, h.x, h.y, h.r);
  glow.addColorStop(0, "#fff7d9"); glow.addColorStop(.45, "#ffc880"); glow.addColorStop(1, "#9c4d35");
  ctx.fillStyle = glow; ctx.strokeStyle = color; ctx.lineWidth = 1.5;
  circle(ctx, h.x, h.y, h.r); ctx.fill(); ctx.stroke();
  if (h.hp < h.maxHp) {
    ctx.strokeStyle = "#fff7d9"; ctx.lineWidth = 2.5; ctx.beginPath();
    ctx.arc(h.x, h.y, h.r + 4, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(h.hp / h.maxHp, 0, 1)); ctx.stroke();
  }
}

function mine(ctx: CanvasRenderingContext2D, s: SpillState, h: SpillHazard) {
  const warning = h.phase === "warning", spent = h.phase === "spent";
  const armed = !warning && h.fuse >= 0, color = armed ? "#ff927e" : COLORS.mine;
  // Proximity and explosion share this exact radius. The ship's own radius
  // is included by collision, just as it is for all other solid hazards.
  ctx.fillStyle = spent ? "rgba(255,153,102,.2)" : armed ? "rgba(255,119,87,.09)" : "rgba(255,171,119,.025)";
  circle(ctx, h.x, h.y, h.range); ctx.fill();
  ctx.strokeStyle = color; ctx.lineWidth = spent ? 3 : 1.25;
  ctx.setLineDash(warning ? [3, 7] : armed || spent ? [] : [8, 5]); ctx.stroke(); ctx.setLineDash([]);
  if (spent) return;
  if (armed) {
    ctx.lineWidth = 3; ctx.beginPath();
    ctx.arc(h.x, h.y, h.range, -Math.PI / 2,
      -Math.PI / 2 + TAU * clamp(h.fuse / SPILL_HAZARD_TUNING.mineFuse, 0, 1)); ctx.stroke();
    label(ctx, s, `BLAST · ${h.fuse.toFixed(1)}s`, h.x, h.y - h.range - 12, color);
  }
  // Eight spokes distinguish mines from round debris, even without color.
  ctx.strokeStyle = color; ctx.lineWidth = 2;
  for (let i = 0; i < 8; i++) {
    const a = i * TAU / 8;
    line(ctx, h.x + Math.cos(a) * h.r * .7, h.y + Math.sin(a) * h.r * .7,
      h.x + Math.cos(a) * h.r, h.y + Math.sin(a) * h.r);
  }
  ctx.fillStyle = warning ? "rgba(20,24,34,.55)" : "#292731";
  circle(ctx, h.x, h.y, h.r * .72); ctx.fill(); ctx.stroke();
  ctx.fillStyle = warning ? "#5d5150" : color;
  ctx.fillRect(h.x - 3, h.y - 3, 6, 6);
  if (warning) label(ctx, s, `MINE · ${h.warn.toFixed(1)}s`, h.x, h.y - h.range - 12, color);
}

function ion(ctx: CanvasRenderingContext2D, s: SpillState, h: SpillHazard) {
  const warning = h.phase === "warning", top = h.y - h.r, bottom = h.y + h.r;
  ctx.fillStyle = warning ? "rgba(216,153,255,.055)" : "rgba(216,153,255,.22)";
  ctx.fillRect(0, top, s.W, h.r * 2);
  // The whole band is harmful; safeY is a route outside it, never a cutout.
  ctx.save(); ctx.beginPath(); ctx.rect(0, top, s.W, h.r * 2); ctx.clip();
  ctx.strokeStyle = warning ? "rgba(228,173,255,.23)" : "rgba(241,208,255,.6)"; ctx.lineWidth = 1;
  for (let x = -h.r * 2; x < s.W; x += 32) line(ctx, x, bottom, x + h.r * 2, top);
  ctx.restore();
  ctx.strokeStyle = COLORS.ion; ctx.lineWidth = warning ? 1.5 : 2.5;
  ctx.setLineDash(warning ? [9, 7] : []);
  line(ctx, 0, top, s.W, top); line(ctx, 0, bottom, s.W, bottom); ctx.setLineDash([]);
  const message = warning ? `ION PULSE · ${h.warn.toFixed(1)}s` : `ION ACTIVE · ${Math.max(0, h.fuse).toFixed(1)}s`;
  label(ctx, s, message, s.W - 82, top - 13, COLORS.ion);
  ctx.strokeStyle = "#a0e9c7"; ctx.lineWidth = 2;
  for (const x of [12, s.W - 12]) {
    const dir = h.safeY < h.y ? -1 : 1;
    line(ctx, x, h.safeY - dir * 6, x, h.safeY + dir * 6);
    ctx.beginPath(); ctx.moveTo(x - 4, h.safeY); ctx.lineTo(x, h.safeY + dir * 6);
    ctx.lineTo(x + 4, h.safeY); ctx.stroke();
  }
}

function gravity(ctx: CanvasRenderingContext2D, s: SpillState, h: SpillHazard, reduced: boolean) {
  const warning = h.phase === "warning", color = COLORS.gravity;
  const glow = ctx.createRadialGradient(h.x, h.y, h.r, h.x, h.y, h.range);
  glow.addColorStop(0, warning ? "rgba(153,133,255,.06)" : "rgba(153,133,255,.16)");
  glow.addColorStop(1, "rgba(153,133,255,.015)");
  ctx.fillStyle = glow; circle(ctx, h.x, h.y, h.range); ctx.fill();
  ctx.strokeStyle = "rgba(190,176,255,.6)"; ctx.lineWidth = 1.25;
  ctx.setLineDash(warning ? [4, 7] : [2, 5]); ctx.stroke(); ctx.setLineDash([]);
  // Sparse inward chevrons show force direction. Decorative rotation stops
  // with reduced motion; actor positions and collision rings remain truthful.
  const turn = reduced || warning ? 0 : h.activeTime * .12;
  ctx.strokeStyle = "rgba(196,184,255,.48)"; ctx.lineWidth = 1.5;
  for (let i = 0; i < 6; i++) {
    const a = i * TAU / 6 + turn, r = h.range * .64;
    const x = h.x + Math.cos(a) * r, y = h.y + Math.sin(a) * r;
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    ctx.beginPath(); ctx.moveTo(3, -4); ctx.lineTo(-3, 0); ctx.lineTo(3, 4); ctx.stroke(); ctx.restore();
  }
  ctx.strokeStyle = color; ctx.lineWidth = 2;
  circle(ctx, h.x, h.y, h.r); ctx.fillStyle = warning ? "rgba(11,12,31,.45)" : "#080b18"; ctx.fill(); ctx.stroke();
  ctx.strokeStyle = "rgba(205,192,255,.5)"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.ellipse(h.x, h.y, h.r * 1.8, h.r * .5, -.35, 0, TAU); ctx.stroke();
  if (warning) label(ctx, s, `GRAVITY · ${h.warn.toFixed(1)}s`, h.x, h.y - 34, color);
  else {
    // Only already-bent debris gets a short prediction, from the same motion
    // function used by admission/collision. No invented orbit or random path.
    let count = 0;
    ctx.strokeStyle = "rgba(195,181,255,.62)"; ctx.lineWidth = 1.5;
    for (const rock of s.rocks) {
      if (rock.dead || rock.warn > 0 || !rock.gravityBend || rock.gravityWell !== h.id
        || Math.hypot(rock.x - h.x, rock.y - h.y) > h.range + rock.r) continue;
      const ahead = Math.min(.6, 96 / Math.max(1, Math.hypot(rock.vx, rock.vy)));
      ctx.beginPath(); ctx.moveTo(rock.x, rock.y);
      for (let i = 1; i <= 4; i++) { const p = spillRockAt(s, rock, ahead * i / 4); ctx.lineTo(p.x, p.y); }
      ctx.stroke();
      if (++count >= 4) break;
    }
  }
}

/** Paint after the Blackout veil, before ships/projectiles. Authority geometry
 * and timers only: this renderer never steps, rolls randomness or mutates state. */
export function drawSpillHazards(ctx: CanvasRenderingContext2D, s: SpillState, reducedMotion = false) {
  if (!s.hazards || !flight(s)) return;
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, s.W, s.H); ctx.clip();
  for (const h of s.hazards.actors) {
    if (h.dead) continue;
    ctx.save();
    if (h.kind === "comet") comet(ctx, s, h, reducedMotion);
    else if (h.kind === "mine") mine(ctx, s, h);
    else if (h.kind === "ion") ion(ctx, s, h);
    else gravity(ctx, s, h, reducedMotion);
    ctx.restore();
  }
  ctx.restore();
}

/** One peripheral reminder, clear of the top HUD, rule chip and existing
 * teaching card. The caller respects the player's prompt preference. */
export function drawSpillHazardHint(ctx: CanvasRenderingContext2D, s: SpillState, bottom: number) {
  if (!s.hazards || !flight(s) || s.H < 320 || bottom < 150) return;
  const h = s.hazards.actors.find(h => !h.dead && h.phase === "warning")
    ?? s.hazards.actors.find(h => !h.dead && h.phase === "active");
  if (!h) return;
  ctx.save(); ctx.font = "700 11px Figtree,system-ui";
  const text = HINTS[h.kind], width = Math.min(s.W - 24, ctx.measureText(text).width + 22);
  const x = (s.W - width) / 2;
  // HUD has a safe-area translation on top of the canvas's device scale.
  // Compare in logical field coordinates, then omit the hint rather than
  // shifting it into the flight lane when a threat or the ship reaches it.
  const transform = ctx.getTransform();
  const left = x + (transform.a ? transform.e / transform.a : 0);
  const top = bottom - 23 + (transform.d ? transform.f / transform.d : 0);
  const overlapsCircle = (cx: number, cy: number, radius: number) =>
    Math.hypot(cx - clamp(cx, left, left + width), cy - clamp(cy, top, top + 23)) <= radius;
  const pad = SPILL.shipR + 8;
  const blocked = overlapsCircle(s.pilot.x, s.pilot.y, SPILL.shipR + 14)
    || s.hazards.actors.some(actor => {
      if (actor.dead) return false;
      if (actor.kind === "ion") return actor.y + actor.r + pad >= top && actor.y - actor.r - pad <= top + 23;
      const radius = actor.kind === "mine" && (actor.fuse >= 0 || actor.phase === "spent") ? actor.range : actor.r;
      return overlapsCircle(actor.x, actor.y, radius + pad);
    });
  if (blocked) { ctx.restore(); return; }
  ctx.fillStyle = "rgba(8,14,28,.84)"; ctx.fillRect(x, bottom - 23, width, 23);
  ctx.fillStyle = COLORS[h.kind]; ctx.fillRect(x, bottom - 23, 2, 23);
  ctx.textAlign = "center"; ctx.fillText(text, s.W / 2, bottom - 7, width - 16);
  ctx.restore();
}
