import { STAR_CHART_TRAILS } from "./catalog";

type Point = { x: number; y: number; age: number; power: number };
type Sample = { x: number; y: number; time: number; power: number };
export type TrailFrame = {
  time: number; x: number; y: number; travel: number; scale: number;
  power: number; active: boolean;
};
export type TrailHistory = { id: string; samples: Sample[]; last?: TrailFrame; paused?: boolean; phaseOffset?: number };
type Material = "ion" | "glass" | "mist" | "fire" | "crystal" | "arc" | "stars" | "veil" | "ice" | "smoke" | "nova" | "feather";
type Profile = { material: Material; colors: [string, string, string]; width: number; flow: number };

/** Pearlescent highlights and shaded midtones, rather than opaque rainbow
 * particles. The original trail's color family and material remain intact. */
export const STAR_TRAIL_PROFILES: Record<string, Profile> = {
  ion: { material: "ion", colors: ["#e5f9ff", "#78cddd", "#286181"], width: 3.6, flow: 115 },
  bubble: { material: "glass", colors: ["#eaf7ff", "#9bd4de", "#507e9c"], width: 5.2, flow: 92 },
  bloom: { material: "mist", colors: ["#f2dff1", "#b68ec8", "#634d85"], width: 9, flow: 95 },
  comet: { material: "fire", colors: ["#fff3da", "#e9b677", "#a4654a"], width: 6.5, flow: 150 },
  prism: { material: "crystal", colors: ["#edf4f5", "#9cd6cd", "#bf9cbe"], width: 5.2, flow: 112 },
  plasma: { material: "arc", colors: ["#f2eaff", "#ba9fdf", "#6c589d"], width: 4.5, flow: 135 },
  galaxy: { material: "stars", colors: ["#fff0d6", "#a0b5de", "#5b639e"], width: 8.5, flow: 103 },
  aurora: { material: "veil", colors: ["#d2f4e8", "#84cdb8", "#a896ce"], width: 10, flow: 110 },
  frost: { material: "ice", colors: ["#eff9ff", "#aed5e4", "#6a91b0"], width: 5, flow: 112 },
  voidsmoke: { material: "smoke", colors: ["#c9c3dc", "#79718e", "#29293f"], width: 11, flow: 90 },
  supernova: { material: "nova", colors: ["#fff4dc", "#e9b78b", "#b57470"], width: 8, flow: 145 },
  phoenixplume: { material: "feather", colors: ["#fff0cd", "#e6b18b", "#b77085"], width: 8, flow: 117 },
  opalfeather: { material: "feather", colors: ["#fff5ed", "#b1ddd3", "#a3b5d8"], width: 7, flow: 103 },
};

export const STAR_TRAIL_SECONDS = 1.45;
export const STAR_TRAIL_MAX_SAMPLES = 90;
const STEP = 1 / 60;
const histories = new WeakMap<object, TrailHistory>();
const clamp = (x: number) => Math.max(0, Math.min(1, x));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

export function createTrailHistory(id: string): TrailHistory { return { id, samples: [] }; }

/** Fixed-time interpolation retains the pilot's actual flight path at both
 * 30 and 144 Hz. Drawing twice at the same time never grows the history.
 * A reset/resize/teleport clears it instead of drawing a line across the sky. */
export function sampleStarTrail(h: TrailHistory, id: string, f: TrailFrame): Point[] {
  const old = h.last;
  if (h.id !== id || !old || f.time < old.time || f.time - old.time > .25 ||
      f.scale !== old.scale || Math.abs(f.travel - old.travel) > 180 * f.scale ||
      Math.hypot(f.x - old.x, f.y - old.y) > 180 * f.scale) {
    h.id = id; h.samples.length = 0; h.last = undefined;
  }
  const prev = h.last;
  if (f.active && STAR_CHART_TRAILS.has(id)) {
    if (!prev || !prev.active || !h.samples.length) {
      h.samples.push({ x: f.x + f.travel, y: f.y, time: f.time, power: clamp(f.power) });
    } else if (f.time > prev.time) {
      const lastTime = h.samples[h.samples.length - 1].time;
      for (let time = lastTime + STEP; time <= f.time + 1e-8; time += STEP) {
        const u = clamp((time - prev.time) / (f.time - prev.time));
        h.samples.push({ x: mix(prev.x + prev.travel, f.x + f.travel, u),
          y: mix(prev.y, f.y, u), time, power: mix(prev.power, f.power, u) });
      }
    }
  }
  h.last = { ...f };
  h.samples = h.samples.filter(p => f.time - p.time < STAR_TRAIL_SECONDS).slice(-STAR_TRAIL_MAX_SAMPLES);
  const flow = STAR_TRAIL_PROFILES[id]?.flow ?? 100;
  const points = h.samples.map(p => {
    const age = Math.max(0, f.time - p.time);
    return { x: p.x - f.travel - age * flow * f.scale, y: p.y, age, power: p.power };
  }).reverse();
  // The nozzle is current, even between the fixed history samples.
  if (f.active) points.unshift({ x: f.x, y: f.y, age: 0, power: clamp(f.power) });
  return points;
}

function path(c: CanvasRenderingContext2D, points: { x: number; y: number }[]) {
  c.beginPath(); c.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i], next = points[i + 1];
    c.quadraticCurveTo(p.x, p.y, (p.x + next.x) / 2, (p.y + next.y) / 2);
  }
  const end = points[points.length - 1]; c.lineTo(end.x, end.y);
}

/** A ribbon follows the stored curve, with width fading along its age.
 * Filled silhouettes avoid hundreds of separately stroked/glowing segments. */
function ribbon(c: CanvasRenderingContext2D, points: Point[], width: number, phase: number,
  wave: number, color: string, alpha: number, scale: number, time: number) {
  const edge = (side: number) => points.map((p, i) => {
    const a = points[Math.max(0, i - 1)], b = points[Math.min(points.length - 1, i + 1)];
    const dx = b.x - a.x, dy = b.y - a.y, length = Math.max(.001, Math.hypot(dx, dy));
    const u = clamp(p.age / STAR_TRAIL_SECONDS), fade = Math.pow(1 - u, 1.4);
    const swirl = Math.sin(p.age * 9 - time * 1.5 + phase) * Math.sin(u * Math.PI) * wave;
    const spread = (side * width * (.25 + .75 * Math.sin(u * Math.PI)) + swirl) * fade * scale;
    return { x: p.x - dy / length * spread, y: p.y + dx / length * spread };
  });
  const upper = edge(1), lower = edge(-1).reverse();
  c.globalAlpha = alpha; c.fillStyle = color;
  path(c, upper);
  for (const p of lower) c.lineTo(p.x, p.y);
  c.closePath(); c.fill();
}

function haze(c: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, alpha: number) {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color); g.addColorStop(1, color + "00");
  c.globalAlpha = alpha; c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
}

/** Shared by live flight and every card. Detail travels away from the pilot
 * with a continuous phase; no per-frame random flicker or canvas blur. */
export function paintStarTrail(c: CanvasRenderingContext2D, id: string, points: Point[], time: number, scale = 1) {
  const profile = STAR_TRAIL_PROFILES[id];
  if (!profile || points.length < 2) return;
  const { material: m, colors: [light, tint, shade], width } = profile;
  const soft = ["mist", "stars", "smoke", "veil"].includes(m);
  c.save(); c.lineCap = "round"; c.lineJoin = "round";
  c.globalCompositeOperation = m === "smoke" ? "source-over" : "lighter";
  // Three translucent envelopes give the stream depth without a neon tube.
  ribbon(c, points, width * 1.8, 0, width, shade, m === "smoke" ? .26 : .055, scale, time);
  ribbon(c, points, width, 1.2, width * .7, tint, soft ? .12 : .14, scale, time);
  const lanes = m === "ion" || m === "arc" || m === "veil" ? 3 : 2;
  for (let lane = 0; lane < lanes; lane++) {
    ribbon(c, points, soft ? 1.4 : .5, lane * 2.1, width * (m === "arc" ? 1.4 : .8),
      lane ? tint : light, soft ? .18 : .4, scale, time);
  }
  const head = points[0];
  if (head.age < .12) haze(c, head.x, head.y, (7 + head.power * 3) * scale, tint,
    (m === "smoke" ? .12 : .24) * (1 - head.age / .12));

  // Fixed detail budget, independent of viewport width and session duration.
  // A temporal age lookup avoids attaching motifs to shifting array indices.
  const count = m === "stars" ? 26 : m === "glass" ? 12 : 16;
  for (let i = 0; i < count; i++) {
    const u = ((i / count + time * .23) % 1 + 1) % 1;
    const age = u * STAR_TRAIL_SECONDS;
    if (age < points[0].age || age > points[points.length - 1].age) continue;
    let k = 1; while (k < points.length - 1 && points[k].age < age) k++;
    const a = points[k - 1], b = points[k], f = clamp((age - a.age) / Math.max(.0001, b.age - a.age));
    const fade = Math.pow(Math.sin(u * Math.PI), .7) * Math.pow(1 - u, .8);
    const seed = i * 2.39996, spread = Math.sin(seed + age * 2) * width * (soft ? 2 : 1.4) * Math.sin(u * Math.PI);
    const x = mix(a.x, b.x, f), y = mix(a.y, b.y, f) + spread * scale;
    const r = (1.1 + (i % 4) * .48) * scale;
    c.globalAlpha = fade * .65; c.fillStyle = i % 3 ? tint : light; c.strokeStyle = light;
    c.lineWidth = .55 * scale;
    if (m === "glass") {
      const radius = r * (1 + u * 1.5);
      const g = c.createRadialGradient(x - radius * .35, y - radius * .4, 0, x, y, radius);
      g.addColorStop(0, light + "77"); g.addColorStop(.35, tint + "08"); g.addColorStop(.8, shade + "12"); g.addColorStop(1, tint + "77");
      c.fillStyle = g; c.beginPath(); c.arc(x, y, radius, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(x, y, radius * .8, 3.6, 4.9); c.stroke();
    } else if (m === "crystal" || m === "ice") {
      c.save(); c.translate(x, y); c.rotate(seed + time * .12);
      c.fillStyle = (i % 2 ? tint : shade) + "77";
      c.beginPath(); c.moveTo(-r * 2.4, 0); c.lineTo(0, -r * .75); c.lineTo(r * 1.4, 0); c.lineTo(0, r * .7); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(-r * 2.4, 0); c.lineTo(0, -r * .75); c.lineTo(r * 1.4, 0); c.stroke();
      c.globalAlpha *= .5; c.beginPath(); c.moveTo(-r * 2, 0); c.lineTo(r, 0); c.stroke(); c.restore();
    } else if (m === "feather") {
      c.save(); c.translate(x, y); c.rotate(Math.sin(seed) * .45);
      const g = c.createLinearGradient(-r * 3, 0, r * 2, 0);
      g.addColorStop(0, shade + "00"); g.addColorStop(.5, tint + "66"); g.addColorStop(1, light + "bb");
      c.fillStyle = g; c.beginPath(); c.moveTo(-r * 3, 0);
      c.quadraticCurveTo(-r, -r * 1.7, r * 2, 0); c.quadraticCurveTo(-r, r, -r * 3, 0); c.fill();
      c.beginPath(); c.moveTo(-r * 2.6, 0); c.quadraticCurveTo(0, -r * .2, r * 1.7, 0); c.stroke();
      c.globalAlpha *= .45; for (let barb = 0; barb < 3; barb++) {
        const q = -r * 1.3 + barb * r * .7;
        c.beginPath(); c.moveTo(q - r * .8, -r * .65); c.lineTo(q, 0); c.lineTo(q - r * .6, r * .45); c.stroke();
      } c.restore();
    } else if (m === "mist" || m === "smoke") {
      haze(c, x, y, r * (3 + u * 3), m === "smoke" ? shade : tint, fade * .11);
      c.globalAlpha = fade * .16; c.strokeStyle = tint;
      c.beginPath(); c.ellipse(x, y, r * 3, r * 1.4, Math.sin(seed) * .5, 3.4, 5.4); c.stroke();
    } else if (m === "arc") {
      c.globalAlpha = fade * (.24 + .15 * Math.sin(time * 4 + seed));
      c.beginPath(); c.moveTo(x - r * 4, y); c.lineTo(x - r, y - r * 1.6);
      c.lineTo(x + r, y + r * .65); c.lineTo(x + r * 3, y - r * .5); c.stroke();
    } else if (m === "nova") {
      c.globalAlpha = fade * .19; c.strokeStyle = i % 2 ? tint : light;
      c.beginPath(); c.ellipse(x, y, r * .8, r * (2 + u * 3), -.12, -1.4, 1.4); c.stroke();
      haze(c, x, y, r * 2.4, tint, fade * .09);
    } else if (m === "stars") {
      haze(c, x, y, r * 3, shade, fade * .10);
      c.globalAlpha = fade * (.45 + .15 * Math.sin(time * 2 + seed)); c.fillStyle = light;
      c.beginPath(); c.arc(x, y, r * .35, 0, Math.PI * 2); c.fill();
      if (i % 5 === 0) { c.beginPath(); c.moveTo(x - r * 1.3, y); c.lineTo(x + r * 1.3, y); c.moveTo(x, y - r); c.lineTo(x, y + r); c.stroke(); }
    } else if (m !== "veil") {
      c.globalAlpha = fade * .55; c.strokeStyle = i % 3 ? tint : light;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + r * (m === "fire" ? 4 : 2.4), y - r * .2); c.stroke();
    }
  }
  c.restore();
}

export function paintLiveStarTrail(c: CanvasRenderingContext2D, owner: object, id: string, f: TrailFrame, paused = false) {
  if (!STAR_CHART_TRAILS.has(id)) { histories.delete(owner); return; }
  let h = histories.get(owner);
  if (!h) { h = createTrailHistory(id); histories.set(owner, h); }
  if (paused && h.last) { h.paused = true; f = h.last; }
  else if (h.paused && h.last) {
    // The world's UI clock advances while paused. Translate sample times
    // by that gap so the wake resumes without aging away or jumping.
    const gap = f.time - h.last.time;
    for (const p of h.samples) p.time += gap;
    h.phaseOffset = (h.phaseOffset ?? 0) + gap;
    h.last = { ...h.last, time: f.time }; h.paused = false;
  }
  paintStarTrail(c, id, sampleStarTrail(h, id, f), f.time - (h.phaseOffset ?? 0), f.scale);
}

/** Complete on first paint and frozen when the caller supplies t=0. */
export function paintStarTrailPreview(c: CanvasRenderingContext2D, id: string, x: number, y: number, time: number) {
  const points: Point[] = [];
  for (let i = 0; i <= 48; i++) {
    const u = i / 48;
    points.push({ x: x + 22 - u * 48, y: y + Math.sin(u * 4 - time * .7) * Math.sin(u * Math.PI) * 2,
      age: u * STAR_TRAIL_SECONDS, power: .5 });
  }
  paintStarTrail(c, id, points, time, .65);
}
