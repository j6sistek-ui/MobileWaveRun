// PROCEDURAL SKIES — the normal-mode environments, painted by code.
//
// The owner's call after the background test: normal flight's ten named
// skies render procedurally — more variety, recipes that can be tuned to
// match each zone's planets and theme, and a picture that composes itself
// for ANY viewport, portrait or landscape. Deep and Lost keep their
// painted dark plates; no recipe exists for a dark id, so those fall
// straight through to the painted path.
//
// Every sky is a RECIPE: an authored palette (seeded from the original
// painting's sampled colours) plus a fixed seed. Same recipe, same sky,
// forever — determinism is the baseline. Changing a sky is a reviewed
// edit to numbers here, never a regenerated binary.
//
// Rendering happens ONCE per environment per canvas size, into a cached
// offscreen canvas at reduced resolution (painterly softness survives the
// upscale by design); stars go on at full resolution so they stay crisp.
// The per-frame cost is one drawImage, the same as a painted sky.

import { type SkyId } from "./catalog";

type RGB = [number, number, number];

type SkyRecipe = {
  seed: number;
  /** the void: darkest quarter of the environment */
  base: RGB;
  /** the focal light: its brightest sliver */
  glow: RGB;
  /** three nebula layers, most dominant first */
  hues: [RGB, RGB, RGB];
  /** 0..1 — how much of the frame the nebula claims */
  density: number;
  /** focal glow strength */
  glowAmp: number;
};

// Palettes sampled from the shipping paintings, then hand-adjusted where
// an environment wanted more identity (neon's triad, mono's restraint).
// Tune freely: these numbers ARE the art direction.
const RECIPES: Partial<Record<SkyId, SkyRecipe>> = {
  indigo: { seed: 101, base: [10, 16, 49], glow: [110, 110, 190], hues: [[75, 95, 164], [50, 60, 140], [90, 70, 160]], density: 0.5, glowAmp: 0.6 },
  ice: { seed: 102, base: [50, 90, 130], glow: [215, 232, 240], hues: [[95, 169, 210], [150, 205, 230], [190, 220, 235]], density: 0.62, glowAmp: 0.72 },
  inferno: { seed: 103, base: [30, 16, 18], glow: [235, 120, 30], hues: [[239, 119, 28], [160, 50, 30], [90, 30, 40]], density: 0.55, glowAmp: 0.85 },
  mono: { seed: 104, base: [16, 18, 19], glow: [120, 120, 120], hues: [[70, 74, 76], [42, 44, 44], [128, 128, 127]], density: 0.42, glowAmp: 0.5 },
  magenta: { seed: 105, base: [38, 24, 89], glow: [225, 135, 195], hues: [[223, 105, 179], [141, 82, 173], [90, 50, 150]], density: 0.6, glowAmp: 0.75 },
  verdant: { seed: 106, base: [7, 33, 29], glow: [110, 200, 120], hues: [[34, 161, 106], [112, 194, 89], [20, 110, 90]], density: 0.55, glowAmp: 0.7 },
  ghost: { seed: 107, base: [120, 126, 138], glow: [242, 241, 238], hues: [[170, 175, 185], [220, 217, 218], [140, 147, 160]], density: 0.66, glowAmp: 0.6 },
  neon: { seed: 108, base: [24, 14, 64], glow: [80, 190, 235], hues: [[30, 217, 238], [232, 34, 186], [125, 53, 191]], density: 0.58, glowAmp: 0.8 },
  vortex: { seed: 109, base: [6, 4, 14], glow: [110, 70, 150], hues: [[113, 71, 138], [60, 35, 90], [150, 90, 170]], density: 0.48, glowAmp: 0.65 },
  gold: { seed: 110, base: [90, 50, 18], glow: [244, 200, 85], hues: [[239, 172, 38], [200, 130, 50], [250, 210, 120]], density: 0.6, glowAmp: 0.85 },
};

/** deterministic RNG — the same recipe renders the same sky forever */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(ix: number, iy: number, seed: number) {
  let h = (ix * 374761393 + iy * 668265263 + seed * 2246822519) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function vnoise(x: number, y: number, seed: number) {
  const ix = Math.floor(x); const iy = Math.floor(y);
  const fx = x - ix; const fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy, seed);
  const b = hash2(ix + 1, iy, seed);
  const c = hash2(ix, iy + 1, seed);
  const d = hash2(ix + 1, iy + 1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

function fbm(x: number, y: number, seed: number, octaves: number) {
  let sum = 0; let amp = 0.5; let f = 1;
  for (let i = 0; i < octaves; i++) {
    sum += vnoise(x * f, y * f, seed + i * 101) * amp;
    amp *= 0.55; f *= 2.05;
  }
  return sum;
}

function render(w: number, h: number, r: SkyRecipe): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width = w; out.height = h;
  const octx = out.getContext("2d")!;
  const scale = Math.min(1, 560 / Math.max(w, h));
  const W = Math.max(64, Math.round(w * scale));
  const H = Math.max(64, Math.round(h * scale));
  const work = document.createElement("canvas");
  work.width = W; work.height = H;
  const wc = work.getContext("2d")!;
  const img = wc.createImageData(W, H);
  const d = img.data;
  const rnd = mulberry32(r.seed);
  const fx = (rnd() < 0.5 ? 0.33 : 0.67) + (rnd() - 0.5) * 0.12;
  const fy = 0.3 + rnd() * 0.34;
  const t0 = 0.62 - r.density * 0.42;
  const layers = r.hues.map((rgb, i) => ({
    rgb,
    freq: 1.7 + i * 1.5 + rnd() * 0.6,
    amp: (1.15 - i * 0.2) * (0.6 + r.density * 0.6),
    t0: t0 + rnd() * 0.06,
    seed: r.seed + 31 * (i + 1),
  }));
  const inv = 1 / Math.max(W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const u = x * inv; const v = y * inv;
      const g = y / H;
      let rr = r.base[0] * (0.72 + g * 0.42);
      let gg = r.base[1] * (0.72 + g * 0.42);
      let bb = r.base[2] * (0.78 + g * 0.4);
      const wx = fbm(u * 2.3 + 11, v * 2.3, r.seed + 5, 4) - 0.5;
      const wy = fbm(u * 2.3, v * 2.3 + 7, r.seed + 9, 4) - 0.5;
      for (const L of layers) {
        const n = fbm((u + wx * 0.9) * L.freq, (v + wy * 0.9) * L.freq, L.seed, 6);
        const t = Math.max(0, (n - L.t0) / (1 - L.t0));
        const val = Math.pow(t, 1.45) * L.amp;
        rr += L.rgb[0] * val; gg += L.rgb[1] * val; bb += L.rgb[2] * val;
      }
      const dx = u - fx; const dy = v - fy * (H * inv);
      const glow = Math.exp(-(dx * dx + dy * dy) * 14) * r.glowAmp;
      rr += r.glow[0] * glow; gg += r.glow[1] * glow; bb += r.glow[2] * glow;
      // brushy grain — the barely-there streaks that keep it from reading flat
      const grain = (vnoise(u * 90, v * 260, r.seed + 77) - 0.5) * 9;
      rr += grain; gg += grain; bb += grain;
      const i4 = (y * W + x) * 4;
      d[i4] = Math.min(255, rr); d[i4 + 1] = Math.min(255, gg); d[i4 + 2] = Math.min(255, bb); d[i4 + 3] = 255;
    }
  }
  wc.putImageData(img, 0, 0);
  octx.imageSmoothingEnabled = true;
  octx.drawImage(work, 0, 0, w, h);
  const starCount = Math.round((w * h) / 6200);
  for (let i = 0; i < starCount; i++) {
    const sx = rnd() * w; const sy = rnd() * h;
    const sr = rnd() < 0.85 ? 0.7 + rnd() * 0.7 : 1.4 + rnd() * 1.2;
    const a = 0.25 + rnd() * 0.6;
    if (sr > 1.6) {
      const halo = octx.createRadialGradient(sx, sy, 0, sx, sy, sr * 5);
      halo.addColorStop(0, `rgba(255,255,255,${a * 0.5})`);
      halo.addColorStop(1, "rgba(255,255,255,0)");
      octx.fillStyle = halo;
      octx.fillRect(sx - sr * 5, sy - sr * 5, sr * 10, sr * 10);
    }
    octx.fillStyle = `rgba(255,255,255,${a})`;
    octx.beginPath(); octx.arc(sx, sy, sr, 0, Math.PI * 2); octx.fill();
  }
  const vig = octx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.max(w, h) * 0.75);
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(1, "rgba(0,0,10,0.34)");
  octx.fillStyle = vig; octx.fillRect(0, 0, w, h);
  return out;
}

// One resolution's worth of skies lives in the cache; a resize (or an
// orientation flip) invalidates all of them at once and each environment
// re-renders identically on its next appearance.
const cache = new Map<string, HTMLCanvasElement>();
let cacheKeyWH = "";

/** The procedural sky for this id at this canvas size — or null when the
 *  id has no recipe (every dark plate stays painted). */

// PRISMWING's repaint. Rotating the hue of a full-screen plate every frame
// would cost a filter pass per frame; the plate only changes when a bounce
// changes it, so the rotated copy is built once per (sky, hue step) and
// then drawn like any other image. Steps of 12 degrees keep that cache to
// thirty entries per sky instead of one per degree.
const hueCache = new Map<string, HTMLCanvasElement>();
let hueCacheWH = "";

export function hueShifted(
  src: HTMLCanvasElement | HTMLImageElement,
  id: string,
  deg: number,
): HTMLCanvasElement | HTMLImageElement {
  const step = Math.round(((deg % 360) + 360) % 360 / 12) * 12;
  if (!step) return src;
  const w = (src as HTMLCanvasElement).width;
  const h = (src as HTMLCanvasElement).height;
  if (!w || !h) return src;
  const wh = `${w}x${h}`;
  if (wh !== hueCacheWH) { hueCache.clear(); hueCacheWH = wh; }
  const key = `${id}:${step}`;
  const hit = hueCache.get(key);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d");
  if (!g) return src;
  // saturate BEFORE the rotation so a near-grey plate still lands on a
  // vibrant colour rather than a slightly different grey
  g.filter = `saturate(1.75) hue-rotate(${step}deg)`;
  g.drawImage(src, 0, 0);
  g.filter = "none";
  // a cache that grows without bound is a leak wearing a hat
  if (hueCache.size > 90) hueCache.clear();
  hueCache.set(key, c);
  return c;
}

export function proceduralSky(id: SkyId, w: number, h: number): HTMLCanvasElement | null {
  const r = RECIPES[id];
  if (!r || w < 8 || h < 8) return null;
  const wh = `${w}x${h}`;
  if (wh !== cacheKeyWH) { cache.clear(); cacheKeyWH = wh; }
  let hit = cache.get(id);
  if (!hit) {
    hit = render(w, h, r);
    cache.set(id, hit);
  }
  return hit;
}
