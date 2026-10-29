// @ts-nocheck
// Ported from live Acornaut character/hangar renderer.
// One astronaut + pal + trail preview drives hangar and flight.
import { STAR_CHART_TRAILS } from "./catalog";
import { paintStarTrailPreview } from "./star-trails";

export type HelmDraw = {
  id: string;
  visor: string;
  tint: number;
  rim: string;
  trim: string;
  glow: string | null;
};

export type SuitDraw = {
  id: string;
  fur: string;
  furDark: string;
  belly: string;
  suit: string;
  suitLite: string;
  suitDark: string;
  trim: string;
  glow: string | null;
  dust: string | null;
  robo?: boolean;
  alien?: boolean;
  ghost?: boolean;
  booty?: boolean;
  cat?: boolean;
  ownHead?: boolean;
};

let ctx: CanvasRenderingContext2D;

function use(c: CanvasRenderingContext2D) {
  ctx = c;
}

// A CACHE KEYED ON A RAW FLOAT IS NOT A CACHE (audit, 8 Sep 2026). The key
// used to be the alpha exactly as it arrived, and half the callers here hand
// over a number that moves every frame — the robo core pulse, the ghost
// plumes, the alien bolts, the thruster flame as it decays after a tap. Each
// frame therefore minted new entries that nothing ever evicted, so a long run
// left six figures of dead rgba strings pinned for the life of the page and
// every lookup got slower than the one before it. Rounding to 1/200 caps the
// table at 201 alphas per colour; every fixed alpha in this file and every
// helmet tint in the catalog is already a multiple of 0.01, so they all land
// on themselves and nothing on screen changes. The rounded value goes into
// the string too, or the key and the colour it names would disagree.
const _rgba = {};
function withAlpha(hex, a) {
  const q = Math.round(a * 200) / 200;
  const key = hex + '|' + q;
  let v = _rgba[key];
  if (v) return v;
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h[0] + h[0] + h[1] + h[1] + h[2] + h[2] : h;
  const n = parseInt(full, 16);
  v = 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + q + ')';
  _rgba[key] = v;
  return v;
}
const TAIL_PTS = [
  [-2, 13], [-12, 12], [-20, 4.5], [-23, -7], [-19.5, -17.5], [-13.5, -23],
];
const TAIL_W = [3.2, 5.4, 6.6, 7.0, 5.8, 3.0];
const TAIL_N = 26;

function splinePoint(pts, u) {
  const n = pts.length - 1;
  const i = Math.max(0, Math.min(Math.floor(u), n - 1));
  const f = u - i;
  const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n, i + 2)];
  const f2 = f * f, f3 = f2 * f;
  const comp = (a, b, c, d) =>
    0.5 * (2 * b + (-a + c) * f + (2 * a - 5 * b + 4 * c - d) * f2 + (-a + 3 * b - 3 * c + d) * f3);
  return [comp(p0[0], p1[0], p2[0], p3[0]), comp(p0[1], p1[1], p2[1], p3[1])];
}

function tailWidth(u) {
  const n = TAIL_W.length - 1;
  const i = Math.max(0, Math.min(Math.floor(u), n - 1));
  const f = u - i;
  return TAIL_W[i] * (1 - f) + TAIL_W[i + 1] * f;
}

const TAIL_SAMPLES = (function () {
  const seg = TAIL_PTS.length - 1;
  const out = [];
  for (let k = 0; k <= TAIL_N; k++) {
    const u = (k / TAIL_N) * seg;
    const p = splinePoint(TAIL_PTS, u);
    const q = splinePoint(TAIL_PTS, Math.min(u + 0.05, seg));
    let dx = q[0] - p[0], dy = q[1] - p[1];
    const L = Math.hypot(dx, dy) || 1;
    dx /= L; dy /= L;
    out.push({
      x: p[0], y: p[1], w: tailWidth(u),
      nx: -dy, ny: dx,
      // phase normalised so the lobe count does not change with TAIL_N;
      // kept subtle — a hint of fur without looking like a cloud
      lobe: 1 + 0.05 * Math.sin((k / TAIL_N) * 26 - 0.6)
              + 0.025 * Math.sin((k / TAIL_N) * 47 + 1.7),
    });
  }
  return out;
})();

// The tail is swept as a union of tapered discs rather than a pair of
// offset curves: offsetting folds in on itself where the tail bends hardest
// and puts a notch in the silhouette, whereas overlapping discs cannot.
function tailPath(wMul, shift, lobes) {
  const mul = wMul || 1;
  ctx.beginPath();
  for (let k = 0; k < TAIL_SAMPLES.length; k++) {
    const s = TAIL_SAMPLES[k];
    let r = s.w * mul;
    if (lobes) r *= s.lobe;
    const cx = shift ? s.x + s.nx * s.w * shift : s.x;
    const cy = shift ? s.y + s.ny * s.w * shift : s.y;
    ctx.moveTo(cx + r, cy);
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
  }
}

// Robot tail: articulated metal segments following the same spline, so
// the silhouette matches the furry tail everywhere it appears.
function drawRoboTail(suit) {
  if (suit.glow) {
    tailPath(1.16, 0, false);
    ctx.fillStyle = withAlpha(suit.glow, 0.18);
    ctx.fill();
  }
  const step = 4;
  for (let k = TAIL_SAMPLES.length - 1; k >= 0; k -= step) {
    const sSeg = TAIL_SAMPLES[k];
    const r = sSeg.w * 1.02;
    const g = ctx.createRadialGradient(sSeg.x - r * 0.4, sSeg.y - r * 0.4, r * 0.2, sSeg.x, sSeg.y, r);
    g.addColorStop(0, suit.belly);
    g.addColorStop(0.55, suit.fur);
    g.addColorStop(1, suit.furDark);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(sSeg.x, sSeg.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = withAlpha(suit.furDark, 0.9);
    ctx.lineWidth = 1;
    ctx.stroke();
    // joint bolt
    ctx.fillStyle = withAlpha(suit.trim, 0.65);
    ctx.beginPath();
    ctx.arc(sSeg.x, sSeg.y, Math.max(0.9, r * 0.16), 0, Math.PI * 2);
    ctx.fill();
  }
  // glowing tail-tip light
  const tip = TAIL_SAMPLES[TAIL_SAMPLES.length - 1];
  const t = performance.now() / 1000;
  const pulse = 0.6 + 0.4 * Math.sin(t * 4);
  ctx.fillStyle = withAlpha(suit.trim, 0.9 * pulse);
  ctx.beginPath();
  ctx.arc(tip.x, tip.y, 2.6, 0, Math.PI * 2);
  ctx.fill();
}

// Ghost tail: no fur at all — three overlapping spectral plumes that
// waver on their own beats, with ecto-motes rising off the tip.
function drawGhostTail(suit) {
  const t = performance.now() / 1000;
  ctx.save();
  for (let k = 0; k < 3; k++) {
    const sway = Math.sin(t * 1.6 + k * 1.9) * 3.5;
    const g = ctx.createLinearGradient(-34, 6, -4, -14);
    g.addColorStop(0, withAlpha(suit.glow || '#9fd8ff', 0));
    g.addColorStop(0.45, withAlpha(suit.glow || '#9fd8ff', 0.22));
    g.addColorStop(1, withAlpha(suit.belly, 0.75));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-6, 9);
    ctx.quadraticCurveTo(-20 - k * 3, 12 + sway, -30 - k * 4, 2 + sway * 1.4 - k * 5);
    ctx.quadraticCurveTo(-34 - k * 4, -6 + sway - k * 5, -26 - k * 3, -12 - k * 4 + sway);
    ctx.quadraticCurveTo(-14, -14, -5, -6);
    ctx.closePath();
    ctx.fill();
  }
  for (let i = 0; i < 4; i++) {
    const kf = (t * 0.7 + i * 0.25) % 1;
    ctx.fillStyle = withAlpha(suit.glow || '#9fd8ff', 0.5 * (1 - kf));
    ctx.beginPath();
    ctx.arc(-14 - i * 5, -2 - kf * 14 + Math.sin(i * 3 + t * 2) * 2,
            1.1 + (1 - kf), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawTail(suit) {
  if (suit.robo) { drawRoboTail(suit); return; }
  if (suit.ghost) { drawGhostTail(suit); return; }
  // emissive edge, drawn as a slightly larger silhouette behind the tail
  if (suit.glow) {
    tailPath(1.16, 0, true);
    ctx.fillStyle = withAlpha(suit.glow, 0.26);
    ctx.fill();
  }

  // dark keyline, same trick — a larger silhouette behind the fill
  tailPath(1.07, 0, true);
  ctx.fillStyle = suit.furDark;
  ctx.fill();

  tailPath(1, 0, true);
  const g = ctx.createLinearGradient(-30, 14, -4, -26);
  g.addColorStop(0, suit.furDark);
  g.addColorStop(0.35, suit.fur);
  g.addColorStop(0.82, suit.fur);
  g.addColorStop(1, suit.belly);
  ctx.fillStyle = g;
  ctx.fill();

  // lighter inner streak — the two-tone underside real squirrels have
  ctx.save();
  ctx.clip();
  ctx.globalAlpha = 0.36;
  ctx.fillStyle = suit.belly;
  tailPath(0.46, -0.38, false);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.restore();

  // a few fur strands for texture
  ctx.strokeStyle = withAlpha(suit.furDark, 0.32);
  ctx.lineWidth = 1;
  ctx.lineCap = 'round';
  for (let i = 1; i <= 6; i++) {
    const s = TAIL_SAMPLES[Math.round((i / 7.2) * (TAIL_SAMPLES.length - 1))];
    // strands lean back along the plume like brushed fur
    const lean = 0.35;
    ctx.beginPath();
    ctx.moveTo(s.x + s.nx * s.w * 0.2, s.y + s.ny * s.w * 0.2);
    ctx.lineTo(s.x + s.nx * s.w * 0.88 - s.ny * s.w * lean,
               s.y + s.ny * s.w * 0.88 + s.nx * s.w * lean);
    ctx.stroke();
  }
}

// —— body ——————————————————————————————————————————————————
function drawSuitBody(suit) {
  // BIG BOOTY: the haunches go ABSOLUTELY MAXIMUM — twin planetoid
  // cheeks, each bouncing on its own beat with cartoon squash-and-
  // stretch, a deep seam, juicy double shine, and the gold waistband
  // of shorts that never stood a chance. Silhouette first, always.
  if (suit.booty) {
    const t = performance.now() / 1000;
    // out-of-phase beats so the cheeks BOUNCE independently, not slide
    const jigL = Math.sin(t * 7) * 1.8;
    const jigR = Math.sin(t * 7 + 0.7) * 1.8;
    const cheek = (cx, cy, rr, jig) => {
      // squash & stretch: wider as it lands, taller as it rises
      const sqx = 1 + Math.abs(jig) * 0.022;
      const sqy = 1 - Math.abs(jig) * 0.022;
      const g = ctx.createRadialGradient(cx - rr * 0.32, cy - rr * 0.4, 1, cx, cy, rr + 4);
      g.addColorStop(0, suit.suitLite);
      g.addColorStop(0.5, suit.suit);
      g.addColorStop(1, suit.suitDark);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(cx, cy + jig, rr * sqx, rr * 0.96 * sqy, 0.15, 0, Math.PI * 2);
      ctx.fill();
      // juicy double shine: big top gleam + a small kiss of rim light
      ctx.fillStyle = withAlpha('#ffffff', 0.3);
      ctx.beginPath();
      ctx.ellipse(cx - rr * 0.32, cy - rr * 0.4 + jig,
                  rr * 0.4, rr * 0.26, -0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = withAlpha('#ffffff', 0.16);
      ctx.beginPath();
      ctx.ellipse(cx + rr * 0.25, cy + rr * 0.35 + jig,
                  rr * 0.2, rr * 0.12, 0.35, 0, Math.PI * 2);
      ctx.fill();
      // under-cheek shadow arc so it reads perfectly ROUND
      ctx.strokeStyle = withAlpha(suit.suitDark, 0.7);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(cx, cy + jig, rr * 0.92, 0.5, 1.8);
      ctx.stroke();
    };
    // FAR cheek first: tucked up behind the body so the near cheek and
    // torso cover almost all of it — only its top crescent peeks out.
    // (Two full bubbles hanging below read as… something else.)
    cheek(-6.5, 5, 13, jigR);
    // NEAR cheek: the giant one that owns the whole silhouette
    cheek(-14, 13.5, 15.5, jigL);
    // gold waistband riding the top of all that curve
    ctx.strokeStyle = suit.trim;
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-27, 5);
    ctx.quadraticCurveTo(-10, -3, 5, 5);
    ctx.stroke();
  }

  // hind haunch
  ctx.fillStyle = suit.suitDark;
  ctx.beginPath();
  ctx.ellipse(-6, 10, 8.4, 8.0, 0.18, 0, Math.PI * 2);
  ctx.fill();

  // little legs dangling beneath the suit, trailing slightly in flight
  const leg = (hx, hy, fx, fy, footR) => {
    ctx.strokeStyle = suit.suitDark;
    ctx.lineWidth = 4.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.quadraticCurveTo((hx + fx) / 2 - 1.2, (hy + fy) / 2, fx, fy);
    ctx.stroke();
    // paw
    ctx.fillStyle = suit.furDark;
    ctx.beginPath();
    ctx.ellipse(fx + 1.1, fy + 0.6, footR, footR * 0.62, 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = withAlpha(suit.suitDark, 0.75);
    ctx.lineWidth = 0.7;
    for (let i = 0; i < 2; i++) {
      ctx.beginPath();
      ctx.moveTo(fx + 2.2 + i * 1.4, fy - 0.6);
      ctx.lineTo(fx + 3.0 + i * 1.4, fy + 1.4);
      ctx.stroke();
    }
  };
  leg(-3.5, 13, -2, 19.5, 3.4);   // hind leg off the haunch
  leg(6, 13, 7.8, 18.5, 3.0);     // front leg under the chest

  // torso
  const g = ctx.createRadialGradient(-4, 2, 2, 1, 9, 18);
  g.addColorStop(0, suit.suitLite);
  g.addColorStop(0.5, suit.suit);
  g.addColorStop(1, suit.suitDark);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, 7, 13.0, 11.8, 0, 0, Math.PI * 2);
  ctx.fill();

  // chest panel
  ctx.fillStyle = withAlpha(suit.trim, 0.2);
  ctx.beginPath();
  ctx.ellipse(2.5, 9, 6.8, 7.0, 0, 0, Math.PI * 2);
  ctx.fill();

  // shoulder trim stripe
  ctx.strokeStyle = suit.trim;
  ctx.lineWidth = 2.1;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-9.5, 4.5);
  ctx.quadraticCurveTo(-2, 0.6, 6, 3.4);
  ctx.stroke();

  // control panel on the belly
  ctx.fillStyle = suit.suitDark;
  roundRect(1.5, 9.5, 6.5, 5.5, 1.8);
  ctx.fill();
  ctx.strokeStyle = withAlpha(suit.trim, 0.7);
  ctx.lineWidth = 0.9;
  ctx.stroke();
  ctx.fillStyle = suit.trim;
  ctx.beginPath();
  ctx.arc(3.4, 12.2, 0.95, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = suit.glow || suit.trim;
  ctx.beginPath();
  ctx.arc(6.2, 12.2, 0.95, 0, Math.PI * 2);
  ctx.fill();

  // front paws, held forward the way a squirrel holds a nut
  ctx.fillStyle = suit.suitDark;
  ctx.beginPath();
  ctx.ellipse(9.5, 10.5, 4.2, 3.3, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = suit.furDark;
  ctx.beginPath();
  ctx.ellipse(12.4, 9.0, 3.0, 2.5, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = withAlpha(suit.suitDark, 0.85);
  ctx.lineWidth = 0.7;
  for (let i = 0; i < 2; i++) {
    ctx.beginPath();
    ctx.moveTo(13.6 + i * 1.3, 7.8 + i * 0.9);
    ctx.lineTo(14.9 + i * 1.2, 9.1 + i * 0.9);
    ctx.stroke();
  }

  // robo: panel seams + a power core light on the torso
  if (suit.robo) {
    ctx.strokeStyle = withAlpha(suit.furDark, 0.7);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-11, 3); ctx.quadraticCurveTo(0, 6.5, 11, 3.5);
    ctx.moveTo(-9.5, 11); ctx.quadraticCurveTo(0, 14, 9.5, 11.5);
    ctx.stroke();
    const t = performance.now() / 1000;
    const corePulse = 0.65 + 0.35 * Math.sin(t * 3);
    ctx.fillStyle = withAlpha(suit.trim, corePulse);
    ctx.beginPath();
    ctx.arc(-3, 7.5, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = withAlpha(suit.trim, 0.5);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(-3, 7.5, 3.6, 0, Math.PI * 2);
    ctx.stroke();
  }

  // rim light so the silhouette separates from the starfield
  ctx.strokeStyle = suit.glow ? withAlpha(suit.glow, 0.8) : 'rgba(255,236,200,0.32)';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.ellipse(0, 7, 13.0, 11.8, 0, 0.35, 2.6);
  ctx.stroke();
}

// Robot head: metal cranium with a glowing visor eye, fin ears and an
// antenna — same position and size as the furry head so helmets fit.
function drawRoboHead(suit) {
  const t = performance.now() / 1000;
  // fin ears where the furry ears sit
  ctx.fillStyle = suit.furDark;
  ctx.beginPath();
  ctx.moveTo(4, -17); ctx.lineTo(6.5, -24); ctx.lineTo(9, -17.5);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = suit.fur;
  ctx.beginPath();
  ctx.moveTo(9.5, -17); ctx.lineTo(12, -25); ctx.lineTo(14.5, -17.5);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = withAlpha(suit.trim, 0.8);
  ctx.beginPath();
  ctx.moveTo(10.8, -19); ctx.lineTo(12, -23); ctx.lineTo(13.2, -19.2);
  ctx.closePath();
  ctx.fill();

  // cranium
  const hg = ctx.createRadialGradient(7, -15, 2, 11, -9, 15);
  hg.addColorStop(0, suit.belly);
  hg.addColorStop(0.5, suit.fur);
  hg.addColorStop(1, suit.furDark);
  ctx.fillStyle = hg;
  roundRect(0.5, -20, 19.5, 17.5, 7);
  ctx.fill();
  ctx.strokeStyle = withAlpha(suit.furDark, 0.8);
  ctx.lineWidth = 1;
  ctx.stroke();

  // visor eye band with a scanning glow
  ctx.fillStyle = '#0c1118';
  roundRect(6, -15.5, 13, 6, 3);
  ctx.fill();
  const scan = 8 + Math.sin(t * 2.4) * 4;
  ctx.fillStyle = suit.trim;
  ctx.beginPath();
  ctx.arc(6 + scan, -12.5, 1.9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = withAlpha(suit.trim, 0.35);
  ctx.beginPath();
  ctx.arc(6 + scan, -12.5, 3.2, 0, Math.PI * 2);
  ctx.fill();

  // muzzle plate with speaker grille (where the teeth would be)
  ctx.fillStyle = suit.furDark;
  roundRect(13, -8, 8.5, 6.5, 2.5);
  ctx.fill();
  ctx.strokeStyle = withAlpha(suit.belly, 0.6);
  ctx.lineWidth = 0.8;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(14.8, -6.2 + i * 1.8);
    ctx.lineTo(20, -6.2 + i * 1.8);
    ctx.stroke();
  }

  // antenna
  ctx.strokeStyle = suit.furDark;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(3.5, -19.5); ctx.lineTo(1.5, -26);
  ctx.stroke();
  const blink = Math.floor(t * 2) % 2 === 0;
  ctx.fillStyle = blink ? '#ff5050' : withAlpha('#ff5050', 0.35);
  ctx.beginPath();
  ctx.arc(1.2, -27.2, 1.6, 0, Math.PI * 2);
  ctx.fill();
}

// Alien head: teardrop cranium, one huge obsidian almond eye (plus a
// hint of a second), glowing antennae — but the ears, muzzle and buck
// teeth stay, so it's still recognisably OUR squirrel.
function drawAlienHead(suit) {
  const t = performance.now() / 1000;
  // far ear
  ctx.fillStyle = suit.furDark;
  ctx.beginPath();
  ctx.ellipse(5.4, -20.2, 2.6, 4.4, -0.4, 0, Math.PI * 2);
  ctx.fill();
  // swept teardrop cranium, wider at the back like a classic grey
  const hg = ctx.createRadialGradient(7.5, -15, 2, 11, -9, 16);
  hg.addColorStop(0, suit.belly);
  hg.addColorStop(0.45, suit.fur);
  hg.addColorStop(1, suit.furDark);
  ctx.fillStyle = hg;
  ctx.beginPath();
  ctx.ellipse(9, -12.5, 10.6, 9.6, -0.12, 0, Math.PI * 2);
  ctx.fill();
  // near ear + inner
  ctx.fillStyle = suit.fur;
  ctx.beginPath();
  ctx.ellipse(11, -20.6, 3.2, 4.8, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = withAlpha(suit.furDark, 0.6);
  ctx.beginPath();
  ctx.ellipse(11.2, -20.2, 1.5, 2.7, -0.2, 0, Math.PI * 2);
  ctx.fill();
  // antennae with pulsing tips
  ctx.strokeStyle = suit.furDark;
  ctx.lineWidth = 1.3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(6.5, -21); ctx.quadraticCurveTo(4.5, -27, 5.8, -30);
  ctx.moveTo(13.5, -21); ctx.quadraticCurveTo(15.5, -27, 14.4, -30.5);
  ctx.stroke();
  const pulse = 0.55 + 0.45 * Math.sin(t * 3.4);
  for (const [bx, by] of [[5.8, -31], [14.4, -31.5]]) {
    ctx.fillStyle = withAlpha(suit.glow || suit.trim, 0.35 * pulse);
    ctx.beginPath(); ctx.arc(bx, by, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = withAlpha(suit.trim, 0.6 + 0.4 * pulse);
    ctx.beginPath(); ctx.arc(bx, by, 1.5, 0, Math.PI * 2); ctx.fill();
  }
  // muzzle + buck teeth: the squirrel stays a squirrel
  ctx.fillStyle = suit.belly;
  ctx.beginPath();
  ctx.ellipse(16.4, -8.4, 5.0, 4.0, 0.16, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fffaf0';
  roundRect(17.2, -6.2, 3.6, 4.0, 1.2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(60,110,60,0.5)';
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(19, -6); ctx.lineTo(19, -2.4);
  ctx.stroke();
  // tiny slit nostrils instead of a nose
  ctx.strokeStyle = withAlpha(suit.furDark, 0.9);
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(19.4, -10.4); ctx.lineTo(20.4, -10.0);
  ctx.moveTo(19.0, -9.2); ctx.lineTo(20.0, -8.8);
  ctx.stroke();
  // the EYE: huge obsidian almond with a wet shine and a green glint
  ctx.save();
  ctx.translate(11.6, -12.6);
  ctx.rotate(-0.35);
  const eg = ctx.createRadialGradient(-1, -1.5, 0.5, 0, 0, 6.4);
  eg.addColorStop(0, '#2c3a44');
  eg.addColorStop(0.5, '#101820');
  eg.addColorStop(1, '#05080c');
  ctx.fillStyle = eg;
  ctx.beginPath();
  ctx.ellipse(0, 0, 6.2, 3.9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = withAlpha(suit.furDark, 0.9);
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.ellipse(-2.2, -1.5, 1.6, 1.0, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(190,255,190,0.5)';
  ctx.beginPath(); ctx.arc(2.4, 0.8, 0.7, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // hint of the second eye further back
  ctx.fillStyle = '#0a1014';
  ctx.beginPath();
  ctx.ellipse(3.6, -14.4, 2.0, 1.3, -0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath(); ctx.arc(3.0, -14.8, 0.5, 0, Math.PI * 2); ctx.fill();
}

// —— head ——————————————————————————————————————————————————
// The retro counterpart to the illustrated cat suit. Same head base as
// the squirrel, but with the two cues that flip the animal: pointed
// triangular ears in place of the rounded tufts, and a small pink
// triangle nose with no buck teeth (the buck teeth are what read as
// "rodent"). Everything else — muzzle, eye, whiskers — carries over.
function drawCatHead(suit) {
  // far ear (behind the head) — a back-swept triangle
  ctx.fillStyle = suit.furDark;
  ctx.beginPath();
  ctx.moveTo(3.4, -18.6); ctx.lineTo(6.2, -27.8); ctx.lineTo(9.6, -20.2);
  ctx.closePath();
  ctx.fill();

  // head
  const hg = ctx.createRadialGradient(7.5, -15, 2, 11, -9, 15);
  hg.addColorStop(0, suit.fur);
  hg.addColorStop(0.62, suit.fur);
  hg.addColorStop(1, suit.furDark);
  ctx.fillStyle = hg;
  ctx.beginPath();
  ctx.ellipse(10, -11, 9.6, 9.0, 0, 0, Math.PI * 2);
  ctx.fill();

  // cheek fluff
  ctx.fillStyle = withAlpha(suit.belly, 0.5);
  ctx.beginPath();
  ctx.ellipse(11.4, -6.8, 5.0, 3.3, 0.25, 0, Math.PI * 2);
  ctx.fill();

  // near ear — an upright triangle with a pink inner
  ctx.fillStyle = suit.fur;
  ctx.beginPath();
  ctx.moveTo(9.2, -19.0); ctx.lineTo(13.0, -29.2); ctx.lineTo(16.4, -18.4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#eeae94';
  ctx.beginPath();
  ctx.moveTo(11.2, -19.4); ctx.lineTo(13.1, -26.0); ctx.lineTo(14.8, -19.0);
  ctx.closePath();
  ctx.fill();

  // muzzle
  ctx.fillStyle = suit.belly;
  ctx.beginPath();
  ctx.ellipse(16.4, -8.6, 5.2, 4.2, 0.16, 0, Math.PI * 2);
  ctx.fill();

  // small pink triangle nose — no buck teeth
  ctx.fillStyle = '#c9776a';
  ctx.beginPath();
  ctx.moveTo(19.0, -10.4); ctx.lineTo(21.6, -10.0); ctx.lineTo(20.2, -7.8);
  ctx.closePath();
  ctx.fill();
  // mouth split under the nose
  ctx.strokeStyle = withAlpha(suit.furDark, 0.6);
  ctx.lineWidth = 0.7;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(20.2, -7.8); ctx.lineTo(20.2, -5.6);
  ctx.stroke();

  // whiskers — longer and more of them than the squirrel's
  ctx.strokeStyle = withAlpha('#fff', 0.6);
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(19.6, -8.8); ctx.lineTo(25.4, -10.6);
  ctx.moveTo(19.8, -7.8); ctx.lineTo(25.6, -7.8);
  ctx.moveTo(19.6, -6.8); ctx.lineTo(25.0, -5.2);
  ctx.stroke();

  // eye
  ctx.fillStyle = '#181008';
  ctx.beginPath();
  ctx.arc(13.4, -13.0, 2.9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(14.3, -13.9, 1.15, 0, Math.PI * 2);
  ctx.fill();
}

function drawHead(suit) {
  if (suit.robo) { drawRoboHead(suit); return; }
  if (suit.alien) { drawAlienHead(suit); return; }
  if (suit.cat) { drawCatHead(suit); return; }
  // far ear (behind the head)
  ctx.fillStyle = suit.furDark;
  ctx.beginPath();
  ctx.ellipse(6.0, -20.6, 3.2, 5.2, -0.4, 0, Math.PI * 2);
  ctx.fill();

  // head
  const hg = ctx.createRadialGradient(7.5, -15, 2, 11, -9, 15);
  hg.addColorStop(0, suit.fur);
  hg.addColorStop(0.62, suit.fur);
  hg.addColorStop(1, suit.furDark);
  ctx.fillStyle = hg;
  ctx.beginPath();
  ctx.ellipse(10, -11, 9.6, 9.0, 0, 0, Math.PI * 2);
  ctx.fill();

  // cheek fluff
  ctx.fillStyle = withAlpha(suit.belly, 0.5);
  ctx.beginPath();
  ctx.ellipse(11.4, -6.8, 5.0, 3.3, 0.25, 0, Math.PI * 2);
  ctx.fill();

  // near ear, with inner pink and a tuft
  ctx.fillStyle = suit.fur;
  ctx.beginPath();
  ctx.ellipse(11.4, -19.8, 3.8, 5.6, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#eeae94';
  ctx.beginPath();
  ctx.ellipse(11.6, -19.4, 1.8, 3.2, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = suit.furDark;
  ctx.lineWidth = 1;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(10.4, -24.2); ctx.lineTo(9.5, -26.6);
  ctx.moveTo(12.8, -24.0); ctx.lineTo(13.6, -26.4);
  ctx.stroke();

  // muzzle
  ctx.fillStyle = suit.belly;
  ctx.beginPath();
  ctx.ellipse(16.4, -8.6, 5.2, 4.2, 0.16, 0, Math.PI * 2);
  ctx.fill();

  // buck teeth — the strongest "this is a rodent" cue
  ctx.fillStyle = '#fffaf0';
  roundRect(17.2, -6.3, 3.8, 4.3, 1.2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(150,110,70,0.55)';
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(19.1, -6.1); ctx.lineTo(19.1, -2.2);
  ctx.stroke();

  // nose
  ctx.fillStyle = '#3a2418';
  ctx.beginPath();
  ctx.ellipse(20.2, -10.0, 2.0, 1.6, 0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.beginPath();
  ctx.ellipse(19.7, -10.6, 0.7, 0.5, 0.35, 0, Math.PI * 2);
  ctx.fill();

  // whiskers
  ctx.strokeStyle = withAlpha(suit.belly, 0.5);
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(19.2, -8.4); ctx.lineTo(23.6, -9.6);
  ctx.moveTo(19.2, -7.6); ctx.lineTo(23.4, -6.7);
  ctx.stroke();

  // eye — the Ghost skin's eyes burn spectral cyan
  if (suit.ghost) {
    ctx.fillStyle = withAlpha('#8ff4ff', 0.35);
    ctx.beginPath();
    ctx.arc(13.4, -13.0, 4.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = suit.ghost ? '#0f2a33' : '#181008';
  ctx.beginPath();
  ctx.arc(13.4, -13.0, 2.9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = suit.ghost ? '#8ff4ff' : '#fff';
  ctx.beginPath();
  ctx.arc(14.3, -13.9, 1.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath();
  ctx.arc(12.5, -11.9, 0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = withAlpha(suit.furDark, 0.85);
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.arc(13.4, -13.0, 4.6, -2.5, -1.15);
  ctx.stroke();
}

// —— atmosphere ————————————————————————————————————————————
function drawAura(color, t, seed) {
  const pulse = 0.88 + 0.12 * Math.sin(t * 1.7 + seed);
  const r = 42 * pulse;
  const g = ctx.createRadialGradient(0, -4, 8, 0, -4, r);
  g.addColorStop(0, withAlpha(color, 0.2));
  g.addColorStop(0.45, withAlpha(color, 0.08));
  g.addColorStop(1, withAlpha(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, -4, r, 0, Math.PI * 2);
  ctx.fill();
}

// Cosmic dust drifting around the character. Positions come from the clock
// so no per-instance state is needed and every shop cell can differ.
function drawDust(color, t, seed, front) {
  const n = front ? 3 : 7;
  const off = (front ? 31 : 0) + seed * 3.7;
  for (let i = 0; i < n; i++) {
    const k = i * 1.9 + off;
    const a = t * 0.5 + k;
    const rad = 26 + 11 * Math.sin(t * 0.65 + k);
    const mx = Math.cos(a) * rad * 1.1;
    const my = -5 + Math.sin(a) * rad * 0.78;
    const tw = 0.5 + 0.5 * Math.sin(t * 2.1 + k * 2.2);
    ctx.globalAlpha = (front ? 0.55 : 0.8) * (0.2 + 0.6 * tw);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(mx, my, 0.7 + 1.5 * tw, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawThruster(f, suit) {
  const len = 10 + 16 * f;
  const g = ctx.createLinearGradient(-9, 15, -9 - len, 15);
  g.addColorStop(0, withAlpha(suit.trim, 0.95 * f));
  g.addColorStop(0.35, 'rgba(255,190,70,' + (0.85 * f) + ')');
  g.addColorStop(1, 'rgba(255,70,20,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-8, 12.5);
  ctx.quadraticCurveTo(-9 - len, 15.5, -8, 18.5);
  ctx.quadraticCurveTo(-5, 15.5, -8, 12.5);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,248,190,' + (0.9 * f) + ')';
  ctx.beginPath();
  ctx.moveTo(-8, 13.8);
  ctx.quadraticCurveTo(-10 - len * 0.45, 15.5, -8, 17.2);
  ctx.quadraticCurveTo(-6, 15.5, -8, 13.8);
  ctx.fill();
}

// —— helmet ————————————————————————————————————————————————
const HELM_C = { x: 11, y: -11, r: 15.2 };

function drawHelmet(helm, suit, t, seed) {
  const c = HELM_C;

  // Cat-ear helmets grow two metal ears from behind the dome — drawn
  // first so the glass rim overlaps their base. Silver shell, warm inner,
  // to match the illustrated cat helmet render.
  if (helm.ears) {
    const ear = (bx, by, tx, ty, ox, oy) => {
      ctx.fillStyle = helm.rim;
      ctx.beginPath();
      ctx.moveTo(c.x + bx - 3.4, c.y + by);
      ctx.lineTo(c.x + tx, c.y + ty);
      ctx.lineTo(c.x + bx + 3.4, c.y + by);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#e79a5a';
      ctx.beginPath();
      ctx.moveTo(c.x + ox - 1.6, c.y + oy + 3.2);
      ctx.lineTo(c.x + ox, c.y + oy - 3.0);
      ctx.lineTo(c.x + ox + 1.6, c.y + oy + 3.2);
      ctx.closePath();
      ctx.fill();
    };
    ear(-6.5, -11, -9.5, -21, -7, -12);
    ear(6.5, -11, 9.5, -21, 7, -12);
  }

  if (helm.glow) {
    const pulse = 0.9 + 0.1 * Math.sin(t * 2 + seed);
    const g = ctx.createRadialGradient(c.x, c.y, c.r * 0.85, c.x, c.y, c.r * 1.5 * pulse);
    g.addColorStop(0, withAlpha(helm.glow, 0.34));
    g.addColorStop(0.5, withAlpha(helm.glow, 0.12));
    g.addColorStop(1, withAlpha(helm.glow, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.r * 1.5 * pulse, 0, Math.PI * 2);
    ctx.fill();
  }

  // glass tint — kept light so the squirrel's face stays readable
  ctx.fillStyle = withAlpha(helm.visor, helm.tint);
  ctx.beginPath();
  ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
  ctx.fill();

  // curved-glass depth toward the lower right
  const dg = ctx.createRadialGradient(c.x - 5, c.y - 6, 2, c.x + 2, c.y + 3, c.r);
  dg.addColorStop(0, 'rgba(255,255,255,0.1)');
  dg.addColorStop(0.55, 'rgba(255,255,255,0)');
  dg.addColorStop(1, withAlpha(helm.trim, 0.28));
  ctx.fillStyle = dg;
  ctx.beginPath();
  ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
  ctx.clip();
  drawVisorArt(helm, t, seed);
  ctx.restore();

  // specular highlights
  ctx.fillStyle = 'rgba(255,255,255,0.13)';
  ctx.beginPath();
  ctx.ellipse(c.x - 5.5, c.y - 6.5, 6.4, 4.8, -0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1.7;
  ctx.beginPath();
  ctx.arc(c.x, c.y, c.r - 2.6, -2.35, -1.15);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(c.x, c.y, c.r - 2.6, -0.75, -0.15);
  ctx.stroke();

  // rim
  ctx.strokeStyle = helm.rim;
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = withAlpha(helm.trim, 0.85);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(c.x, c.y, c.r - 1.9, 0, Math.PI * 2);
  ctx.stroke();

  drawHelmetOrnament(helm, t, seed);

  // neck seal — opaque, so the dome reads as sitting on the suit
  ctx.fillStyle = suit.suitDark;
  roundRect(2.5, 0.5, 17, 7, 3.2);
  ctx.fill();
  ctx.strokeStyle = helm.rim;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = withAlpha(helm.rim, 0.45);
  ctx.beginPath();
  ctx.ellipse(11, 2.4, 7.2, 1.3, 0, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = i === 1 ? (helm.glow || helm.rim) : withAlpha(suit.trim, 0.9);
    ctx.beginPath();
    ctx.arc(6.5 + i * 4.5, 5.6, 1.0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawVisorArt(helm, t, seed) {
  const c = HELM_C;
  if (helm.id === 'ion') {
    ctx.strokeStyle = 'rgba(120,230,255,0.4)';
    ctx.lineWidth = 0.8;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(c.x - 14, c.y + i * 6 + 2);
      ctx.lineTo(c.x + 14, c.y + i * 6 - 2);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(140,240,255,0.6)';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.arc(c.x + 5, c.y - 5, 4.5, 0, Math.PI * 2);
    ctx.stroke();
  } else if (helm.id === 'nebula') {
    // Additive so it reads as a galaxy reflected in the glass rather than
    // paint covering the squirrel's face, and offset up-left off the face.
    ctx.globalCompositeOperation = 'lighter';
    const gx = c.x - 6, gy = c.y - 6;
    const g = ctx.createRadialGradient(gx, gy, 1, gx, gy, 13);
    g.addColorStop(0, 'rgba(150,80,170,0.5)');
    g.addColorStop(0.45, 'rgba(90,30,130,0.3)');
    g.addColorStop(1, 'rgba(40,10,70,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(gx, gy, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(190,130,220,0.5)';
    ctx.lineWidth = 1.2;
    for (let a = 0; a < 2; a++) {
      ctx.beginPath();
      for (let i = 0; i < 18; i++) {
        const th = i * 0.3 + a * Math.PI + t * 0.35;
        const rr = i * 0.44;
        const px = gx + Math.cos(th) * rr;
        const py = gy + Math.sin(th) * rr * 0.75;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
  } else if (helm.id === 'lunar') {
    ctx.fillStyle = 'rgba(120,135,160,0.32)';
    const craters = [[-7, -10, 2.5], [1, -13, 1.9], [8, -10.5, 2.8], [-2, -7, 1.5], [12, -5, 2.1]];
    for (let i = 0; i < craters.length; i++) {
      ctx.beginPath();
      ctx.arc(c.x + craters[i][0], c.y + craters[i][1], craters[i][2], 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (helm.id === 'void') {
    // additive rings high on the dome, clear of the face
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(150,80,220,0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(c.x, c.y - 8, 10, 2.8, -0.3 + Math.sin(t * 0.4) * 0.06, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(180,130,60,0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(c.x, c.y - 8, 6.4, 1.8, -0.3, 0, Math.PI * 2);
    ctx.stroke();
  } else if (helm.id === 'cherry') {
    ctx.strokeStyle = 'rgba(255,200,220,0.45)';
    ctx.lineWidth = 1.1;
    const pts = [[0, -12.5], [10, -4.5], [6, 8], [-6, 8], [-10, -4.5]];
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      if (i === 0) ctx.moveTo(c.x + pts[i][0], c.y + pts[i][1]);
      else ctx.lineTo(c.x + pts[i][0], c.y + pts[i][1]);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      ctx.moveTo(c.x, c.y);
      ctx.lineTo(c.x + pts[i][0], c.y + pts[i][1]);
    }
    ctx.stroke();
  } else if (helm.id === 'solar') {
    ctx.strokeStyle = 'rgba(255,210,130,0.35)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(c.x + 2, c.y + 2, 4 + i * 4, -2.6, -0.6);
      ctx.stroke();
    }
  } else if (helm.id === 'royal') {
    ctx.strokeStyle = 'rgba(255,220,140,0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(c.x, c.y, 10.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(c.x, c.y, 6.5, 0, Math.PI * 2);
    ctx.stroke();
  } else if (helm.id === 'aurora') {
    // northern-lights curtains reflected in the glass
    ctx.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 3; k++) {
      ctx.strokeStyle = 'rgba(' + (60 + k * 30) + ',' + (200 - k * 25) + ',170,0.4)';
      ctx.lineWidth = 3.2 - k * 0.8;
      ctx.beginPath();
      for (let i = 0; i <= 12; i++) {
        const px = c.x - 12 + i * 2;
        const py = c.y - 9 + k * 3.4 + Math.sin(i * 0.8 + t * 1.6 + k * 1.4) * 2.6;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
  } else if (helm.id === 'meteor') {
    // shooting-star streaks
    ctx.strokeStyle = 'rgba(255,200,130,0.5)';
    ctx.lineWidth = 1.2;
    for (let k = 0; k < 3; k++) {
      const f = ((t * 0.8 + k * 0.37) % 1);
      const px = c.x + 11 - f * 22;
      const py = c.y - 11 + f * 15 + k * 2.5;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + 5.5, py - 4);
      ctx.stroke();
    }
  } else if (helm.id === 'chrono') {
    // ticking clock face
    ctx.strokeStyle = 'rgba(255,232,160,0.55)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(c.x, c.y - 1, 8.5, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(c.x + Math.cos(a) * 7.2, c.y - 1 + Math.sin(a) * 7.2);
      ctx.lineTo(c.x + Math.cos(a) * 8.5, c.y - 1 + Math.sin(a) * 8.5);
      ctx.stroke();
    }
    const mins = Math.floor(t) % 60;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(c.x, c.y - 1);
    ctx.lineTo(c.x + Math.cos(t * 0.6) * 6.5, c.y - 1 + Math.sin(t * 0.6) * 6.5);
    ctx.moveTo(c.x, c.y - 1);
    ctx.lineTo(c.x + Math.cos(mins * 0.5) * 4.2, c.y - 1 + Math.sin(mins * 0.5) * 4.2);
    ctx.stroke();
  }
}

function drawHelmetOrnament(helm, t, seed) {
  const c = HELM_C;
  const id = helm.id;

  if (id === 'clear') {
    ctx.fillStyle = helm.trim;
    ctx.beginPath(); ctx.arc(c.x - 12.2, c.y + 6.4, 2.0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(c.x - 13.8, c.y - 1, 1.6, 0, Math.PI * 2); ctx.fill();

  } else if (id === 'ion') {
    const flick = 0.75 + 0.25 * Math.sin(t * 7 + seed);
    ctx.strokeStyle = helm.rim;
    ctx.lineWidth = 1.7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(c.x - 6, c.y - 13.5); ctx.lineTo(c.x - 8.5, c.y - 21);
    ctx.moveTo(c.x + 6, c.y - 13.5); ctx.lineTo(c.x + 8.5, c.y - 21);
    ctx.stroke();
    ctx.fillStyle = helm.glow;
    ctx.beginPath(); ctx.arc(c.x - 8.5, c.y - 22, 2.3 * flick, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(c.x + 8.5, c.y - 22, 2.3 * flick, 0, Math.PI * 2); ctx.fill();
    // crackling arc between the tips, not a smooth handle
    ctx.strokeStyle = withAlpha(helm.glow, 0.85 * flick);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(c.x - 8.5, c.y - 22);
    const steps = 5;
    for (let i = 1; i <= steps; i++) {
      const px = c.x - 8.5 + (17 * i) / steps;
      const wob = (i % 2 ? -1 : 1) * (1.6 + 1.4 * Math.sin(t * 9 + i + seed));
      ctx.lineTo(px, c.y - 24.5 + wob);
    }
    ctx.stroke();

  } else if (id === 'solar') {
    ctx.fillStyle = helm.rim;
    const angles = [-1.15, -0.72, -0.29, 0.14, 0.57];
    for (let i = 0; i < angles.length; i++) {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(angles[i]);
      ctx.beginPath();
      ctx.moveTo(-3.2, -c.r + 1.5);
      ctx.lineTo(0, -c.r - 7);
      ctx.lineTo(3.2, -c.r + 1.5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = withAlpha('#ffe9a8', 0.9);
    ctx.beginPath(); ctx.arc(c.x, c.y - c.r - 2.5, 2.0, 0, Math.PI * 2); ctx.fill();

  } else if (id === 'nebula') {
    for (let i = 0; i < 3; i++) {
      const a = t * 0.9 + i * 2.1 + seed;
      const mx = c.x + Math.cos(a) * (c.r + 5);
      const my = c.y + Math.sin(a) * (c.r + 5) * 0.55;
      ctx.fillStyle = withAlpha('#ffd7ff', 0.85);
      ctx.beginPath(); ctx.arc(mx, my, 1.6, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = withAlpha('#ffd7ff', 0.4);
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(mx - 3.2, my); ctx.lineTo(mx + 3.2, my);
      ctx.moveTo(mx, my - 3.2); ctx.lineTo(mx, my + 3.2);
      ctx.stroke();
    }

  } else if (id === 'lunar') {
    ctx.fillStyle = helm.rim;
    roundRect(c.x - 6.5, c.y - c.r - 5, 13, 4.6, 2);
    ctx.fill();
    ctx.fillStyle = '#f2f6ff';
    ctx.beginPath(); ctx.arc(c.x, c.y - c.r - 2.7, 3.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = helm.trim;
    ctx.beginPath(); ctx.arc(c.x + 1.5, c.y - c.r - 3.3, 2.8, 0, Math.PI * 2); ctx.fill();

  } else if (id === 'void') {
    // orbital rings ride high on the dome so they never cross the face
    const ry = c.y - 7;
    ctx.strokeStyle = withAlpha('#d4af37', 0.9);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(c.x, ry, c.r + 4, (c.r + 4) * 0.3, -0.34 + Math.sin(t * 0.5) * 0.05, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = withAlpha('#b45cff', 0.5);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(c.x, ry, c.r + 7, (c.r + 7) * 0.27, -0.34, 0, Math.PI * 2);
    ctx.stroke();

  } else if (id === 'comet') {
    const f = 0.85 + 0.15 * Math.sin(t * 6 + seed);
    ctx.fillStyle = helm.rim;
    ctx.beginPath();
    ctx.moveTo(c.x - 5, c.y - c.r + 1);
    ctx.quadraticCurveTo(c.x - 3, c.y - c.r - 11 * f, c.x + 3, c.y - c.r - 4.5);
    ctx.quadraticCurveTo(c.x + 5, c.y - c.r - 9 * f, c.x + 8, c.y - c.r + 2);
    ctx.quadraticCurveTo(c.x + 1, c.y - c.r - 3, c.x - 5, c.y - c.r + 1);
    ctx.fill();
    ctx.fillStyle = '#ffd77a';
    ctx.beginPath();
    ctx.moveTo(c.x - 2, c.y - c.r);
    ctx.quadraticCurveTo(c.x, c.y - c.r - 7 * f, c.x + 3, c.y - c.r - 1);
    ctx.quadraticCurveTo(c.x + 1, c.y - c.r - 3, c.x - 2, c.y - c.r);
    ctx.fill();
    for (let i = 0; i < 3; i++) {
      const k = (t * 1.4 + i * 0.7 + seed) % 1;
      ctx.fillStyle = withAlpha('#ff9a3c', 0.8 * (1 - k));
      ctx.beginPath();
      ctx.arc(c.x - 14 - k * 12, c.y - 8 + Math.sin(i * 2 + t * 3) * 3, 1.8 * (1 - k) + 0.5, 0, Math.PI * 2);
      ctx.fill();
    }

  } else if (id === 'cherry') {
    for (let i = 0; i < 4; i++) {
      const a = t * 0.7 + i * 1.6 + seed;
      const px = c.x + Math.cos(a) * (c.r + 6);
      const py = c.y + Math.sin(a * 1.1) * (c.r + 3) * 0.6;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(a);
      ctx.fillStyle = withAlpha('#ffc2da', 0.9);
      ctx.beginPath();
      ctx.ellipse(0, 0, 2.5, 1.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = helm.rim;
    for (let i = 0; i < 5; i++) {
      const a = -1.9 + i * 0.42;
      ctx.beginPath();
      ctx.ellipse(c.x + Math.cos(a) * c.r, c.y + Math.sin(a) * c.r, 2.2, 1.4, a, 0, Math.PI * 2);
      ctx.fill();
    }

  } else if (id === 'royal') {
    ctx.fillStyle = '#d4af37';
    ctx.beginPath();
    ctx.moveTo(c.x - 9.5, c.y - c.r + 2);
    ctx.lineTo(c.x - 7, c.y - c.r - 7.5);
    ctx.lineTo(c.x - 2.8, c.y - c.r - 2);
    ctx.lineTo(c.x, c.y - c.r - 10);
    ctx.lineTo(c.x + 2.8, c.y - c.r - 2);
    ctx.lineTo(c.x + 7, c.y - c.r - 7.5);
    ctx.lineTo(c.x + 9.5, c.y - c.r + 2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#fff0b8';
    ctx.lineWidth = 0.9;
    ctx.stroke();
    ctx.fillStyle = '#ff6080';
    ctx.beginPath(); ctx.arc(c.x - 7, c.y - c.r - 8, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#60c0ff';
    ctx.beginPath(); ctx.arc(c.x, c.y - c.r - 10.6, 1.7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#7dffb0';
    ctx.beginPath(); ctx.arc(c.x + 7, c.y - c.r - 8, 1.5, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 3; i++) {
      const k = 0.5 + 0.5 * Math.sin(t * 3 + i * 2.1 + seed);
      const sx = c.x - 11 + i * 11;
      const sy = c.y - c.r - 13 - i * 1.5;
      ctx.strokeStyle = withAlpha('#ffe9a8', k);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(sx - 2.4 * k, sy); ctx.lineTo(sx + 2.4 * k, sy);
      ctx.moveTo(sx, sy - 2.4 * k); ctx.lineTo(sx, sy + 2.4 * k);
      ctx.stroke();
    }

  } else if (id === 'aurora') {
    // flowing light ribbon above the dome
    ctx.lineCap = 'round';
    for (let k = 0; k < 2; k++) {
      ctx.strokeStyle = withAlpha(k ? '#5dffd0' : '#8fffb8', 0.75 - k * 0.25);
      ctx.lineWidth = 2.4 - k;
      ctx.beginPath();
      for (let i = 0; i <= 14; i++) {
        const px = c.x - 14 + i * 2;
        const py = c.y - c.r - 5 - k * 3 + Math.sin(i * 0.55 + t * 2.2 + k) * 3.2;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

  } else if (id === 'meteor') {
    // bronze rivets on the rim + two tiny orbiting rocks
    ctx.fillStyle = '#7a4a20';
    for (let i = 0; i < 4; i++) {
      const a = -2.2 + i * 0.55;
      ctx.beginPath();
      ctx.arc(c.x + Math.cos(a) * c.r, c.y + Math.sin(a) * c.r, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let i = 0; i < 2; i++) {
      const a = t * (i ? 1.1 : -0.8) + i * 2.6 + seed;
      const mx = c.x + Math.cos(a) * (c.r + 6);
      const my = c.y + Math.sin(a) * (c.r + 6) * 0.5;
      const rg = ctx.createRadialGradient(mx - 1, my - 1, 0.4, mx, my, 3);
      rg.addColorStop(0, '#c8a078');
      rg.addColorStop(1, '#5a3a1c');
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.moveTo(mx + 2.6, my);
      ctx.lineTo(mx + 0.8, my - 2.4);
      ctx.lineTo(mx - 2.2, my - 1.2);
      ctx.lineTo(mx - 2.4, my + 1.6);
      ctx.lineTo(mx + 0.6, my + 2.5);
      ctx.closePath();
      ctx.fill();
    }

  } else if (id === 'chrono') {
    // brass gear crest, slowly turning
    const a0 = t * 0.9;
    const gx = c.x, gy = c.y - c.r - 6;
    ctx.fillStyle = '#c9a94f';
    for (let i = 0; i < 8; i++) {
      const a = a0 + (i / 8) * Math.PI * 2;
      ctx.save();
      ctx.translate(gx + Math.cos(a) * 5.5, gy + Math.sin(a) * 5.5);
      ctx.rotate(a);
      ctx.fillRect(-1.4, -1.6, 2.8, 3.2);
      ctx.restore();
    }
    const gg = ctx.createRadialGradient(gx - 1.5, gy - 1.5, 1, gx, gy, 6);
    gg.addColorStop(0, '#ffe9a8');
    gg.addColorStop(1, '#8a6a24');
    ctx.fillStyle = gg;
    ctx.beginPath();
    ctx.arc(gx, gy, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3a2c10';
    ctx.beginPath();
    ctx.arc(gx, gy, 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

// The one entry point. Everything in the game draws the character through
// this, which is what keeps the hangar and gameplay identical.
function drawAstronaut(x, y, rot, scale, helm, suit, opts) {
  opts = opts || {};
  const flame = opts.flame || 0;
  const seed = opts.seed || 0;
  const t = performance.now() / 1000;

  ctx.save();
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  if (scale !== 1) ctx.scale(scale, scale);

  if (suit.glow) drawAura(suit.glow, t, seed);
  if (suit.dust) drawDust(suit.dust, t, seed, false);
  if (flame > 0) drawThruster(flame, suit);
  drawTail(suit);
  drawSuitBody(suit);
  drawHead(suit);
  if (!suit.cat && !suit.ownHead) drawHelmet(helm, suit, t, seed);
  if (suit.dust) drawDust(suit.dust, t, seed, true);

  // protective bubble while carrying a shield acorn
  if (opts.shield) {
    const pu = 0.94 + 0.06 * Math.sin(t * 3.2 + seed);
    const r = 37 * pu;
    const g = ctx.createRadialGradient(0, -5, r * 0.6, 0, -5, r);
    g.addColorStop(0, 'rgba(93,255,158,0)');
    g.addColorStop(1, 'rgba(93,255,158,0.16)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, -5, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(140,255,190,0.75)';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(0, -5, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, -5, r - 2.5, -2.3, -1.3);
    ctx.stroke();
  }

  ctx.restore();
}
/** WHICH COMPANIONS THE VECTOR KIT CAN DRAW. drawPal below is one if/else
 *  chain, and an id it has never heard of falls out of the bottom having
 *  painted nothing. That was invisible until the arcade timeline asked it
 *  for the nine later pals and got blank sky beside a live effect (audit,
 *  8 Sep 2026). The list lives HERE, beside the chain it describes, so a
 *  twelfth pal is one edit rather than two files quietly disagreeing; the
 *  painters that need a fallback ask canDrawPal instead of keeping a copy. */
const PAL_VECTORS = new Set([
  "buddy", "bee", "nutsack", "meteorcore", "cometsprite", "pocketmoon",
  "voidjelly", "ufo", "starpup", "tinbot", "wisp",
]);
export function canDrawPal(id: string) { return PAL_VECTORS.has(id); }

function drawPal(id, x, y, s, t) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  if (id === 'buddy') {
    // small acorn person with a sparkle jet
    ctx.fillStyle = 'rgba(255,220,120,0.5)';
    ctx.beginPath();
    ctx.arc(-8, 3 + Math.sin(t * 9) * 1.2, 1.6, 0, Math.PI * 2);
    ctx.fill();
    const nut = ctx.createRadialGradient(-2, 0, 1, 0, 2, 8);
    nut.addColorStop(0, '#e8b060');
    nut.addColorStop(1, '#7a4515');
    ctx.fillStyle = nut;
    ctx.beginPath();
    ctx.ellipse(0, 2, 6, 7.2, 0, 0, Math.PI * 2);
    ctx.fill();
    const cap = ctx.createRadialGradient(0, -4, 1, 0, -3, 8);
    cap.addColorStop(0, '#8a5a28');
    cap.addColorStop(1, '#3a2010');
    ctx.fillStyle = cap;
    ctx.beginPath();
    ctx.ellipse(0, -3.4, 7.4, 4.8, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(-7.4, -4, 14.8, 2.4);
    ctx.strokeStyle = '#5a3a18';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -6); ctx.lineTo(0, -8.4);
    ctx.stroke();
    // face
    ctx.fillStyle = '#241207';
    ctx.beginPath(); ctx.arc(-1.8, 1, 1.05, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(2.4, 1, 1.05, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#241207';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(0.3, 3.2, 1.7, 0.25, Math.PI - 0.25);
    ctx.stroke();
    // cheeks
    ctx.fillStyle = 'rgba(255,140,110,0.4)';
    ctx.beginPath(); ctx.arc(-3.6, 2.7, 1, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(4.2, 2.7, 1, 0, Math.PI * 2); ctx.fill();
  } else if (id === 'bee') {
    // wings behind the body, flapping fast
    const w = Math.sin(t * 26) * 0.6;
    ctx.fillStyle = 'rgba(220,240,255,0.7)';
    ctx.save();
    ctx.rotate(-0.5 + w);
    ctx.beginPath(); ctx.ellipse(-1, -6.5, 2.6, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.rotate(0.25 - w);
    ctx.beginPath(); ctx.ellipse(2, -6, 2.2, 4.4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    const bg = ctx.createRadialGradient(-2, -2, 1, 0, 0, 8);
    bg.addColorStop(0, '#ffd95c');
    bg.addColorStop(1, '#c88a10');
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.ellipse(0, 0, 7, 5.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3a2808';
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.ellipse(i * 2.6, 0, 1.1, 5.4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // helmet dome (it IS an astro bee)
    ctx.strokeStyle = 'rgba(200,230,255,0.8)';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.arc(4.2, -1.6, 3.6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#241207';
    ctx.beginPath(); ctx.arc(4.6, -1.8, 0.9, 0, Math.PI * 2); ctx.fill();
    // stinger
    ctx.fillStyle = '#3a2808';
    ctx.beginPath();
    ctx.moveTo(-6.8, 0); ctx.lineTo(-9.4, 0.8); ctx.lineTo(-6.6, 1.8);
    ctx.closePath();
    ctx.fill();
  } else if (id === 'nutsack') {
    // burlap sack, tied at the neck, stitched, with a shy face
    const bag = ctx.createRadialGradient(-2, -2, 2, 0, 2, 10);
    bag.addColorStop(0, '#c49a5c');
    bag.addColorStop(1, '#7a5a2a');
    ctx.fillStyle = bag;
    ctx.beginPath();
    ctx.moveTo(-6.5, -4);
    ctx.quadraticCurveTo(-9, 6, -4.5, 8.5);
    ctx.quadraticCurveTo(0, 10, 4.5, 8.5);
    ctx.quadraticCurveTo(9, 6, 6.5, -4);
    ctx.quadraticCurveTo(2, -6.5, -6.5, -4);
    ctx.fill();
    // tied neck + ears of the sack
    ctx.fillStyle = '#8a6632';
    ctx.beginPath();
    ctx.ellipse(0, -5, 4.4, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#5a3f18';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-3.5, -6.5); ctx.lineTo(-5, -9.5);
    ctx.moveTo(3.5, -6.5); ctx.lineTo(5, -9.5);
    ctx.stroke();
    // stitches
    ctx.strokeStyle = 'rgba(60,40,15,0.6)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-4, 2); ctx.lineTo(-2.4, 3.2);
    ctx.moveTo(2.2, 5.4); ctx.lineTo(3.8, 4.2);
    ctx.stroke();
    // face
    ctx.fillStyle = '#241207';
    ctx.beginPath(); ctx.arc(-2, 0.5, 1, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(2.4, 0.5, 1, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#241207';
    ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.arc(0.2, 2.6, 1.5, 0.3, Math.PI - 0.3); ctx.stroke();

  } else if (id === 'meteorcore') {
    // green glowing rock, cracks lit from inside
    const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, 13);
    glow.addColorStop(0, 'rgba(93,255,158,0.5)');
    glow.addColorStop(1, 'rgba(93,255,158,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 2); ctx.fill();
    const rock = ctx.createRadialGradient(-2, -3, 1, 0, 0, 9);
    rock.addColorStop(0, '#5a7a5a');
    rock.addColorStop(1, '#22321f');
    ctx.fillStyle = rock;
    ctx.beginPath();
    ctx.moveTo(-7.5, -1); ctx.lineTo(-3.5, -7); ctx.lineTo(3, -6.5);
    ctx.lineTo(7.5, -0.5); ctx.lineTo(4.5, 6.5); ctx.lineTo(-3.5, 7);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#5dff9e';
    ctx.lineWidth = 1.1;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-4.5, -2); ctx.lineTo(-1, 0.5); ctx.lineTo(-2, 4);
    ctx.moveTo(1.5, -4.5); ctx.lineTo(2.5, -0.5); ctx.lineTo(5.5, 1);
    ctx.stroke();
    ctx.fillStyle = '#0c1a0c';
    ctx.beginPath(); ctx.arc(-1.5, -2.2, 1, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(2.6, -2.2, 1, 0, Math.PI * 2); ctx.fill();

  } else if (id === 'cometsprite') {
    // little comet with a streaking tail and starry eyes
    for (let i = 0; i < 3; i++) {
      ctx.strokeStyle = 'rgba(140,210,255,' + (0.6 - i * 0.16) + ')';
      ctx.lineWidth = 2.4 - i * 0.6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-3 - i * 1.5, -1 + i * 2.2);
      ctx.quadraticCurveTo(-9 - i * 3, 0 + i * 2, -14 - i * 3.5, 3 + i * 2);
      ctx.stroke();
    }
    const head = ctx.createRadialGradient(1, -1.5, 1, 0, 0, 7);
    head.addColorStop(0, '#ffffff');
    head.addColorStop(0.55, '#bfe6ff');
    head.addColorStop(1, '#4a9ad8');
    ctx.fillStyle = head;
    ctx.beginPath(); ctx.arc(0, 0, 6.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#12365a';
    ctx.beginPath(); ctx.arc(-1.5, -1, 1.05, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(2.5, -1, 1.05, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#12365a';
    ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.arc(0.5, 1.6, 1.6, 0.25, Math.PI - 0.25); ctx.stroke();

  } else if (id === 'pocketmoon') {
    const m = ctx.createRadialGradient(-2.5, -3, 1, 0, 0, 8.5);
    m.addColorStop(0, '#f0f4fa');
    m.addColorStop(0.6, '#b8c4d4');
    m.addColorStop(1, '#6a7688');
    ctx.fillStyle = m;
    ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(90,100,120,0.5)';
    ctx.beginPath(); ctx.arc(-3.5, 2, 1.8, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(3, 3.5, 1.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(4, -3.5, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2a3242';
    ctx.beginPath(); ctx.arc(-1.8, -1.5, 1, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(1.8, -1.5, 1, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#2a3242';
    ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.arc(0, 0.8, 1.5, 0.3, Math.PI - 0.3); ctx.stroke();

  } else if (id === 'voidjelly') {
    // translucent jelly dome with drifting tentacles
    const wob = Math.sin(t * 3);
    const dome = ctx.createRadialGradient(-1, -3, 1, 0, -1, 8);
    dome.addColorStop(0, 'rgba(230,190,255,0.9)');
    dome.addColorStop(0.6, 'rgba(160,90,220,0.6)');
    dome.addColorStop(1, 'rgba(90,40,150,0.35)');
    ctx.fillStyle = dome;
    ctx.beginPath();
    ctx.arc(0, -1, 7.5, Math.PI, 0);
    ctx.quadraticCurveTo(7.5, 3.5, 5.5, 3.5);
    ctx.lineTo(-5.5, 3.5);
    ctx.quadraticCurveTo(-7.5, 3.5, -7.5, -1);
    ctx.fill();
    ctx.strokeStyle = 'rgba(220,180,255,0.7)';
    ctx.lineWidth = 1;
    ctx.lineCap = 'round';
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 2.6, 3.5);
      ctx.quadraticCurveTo(i * 2.6 + wob * 2, 7, i * 2.6 - wob * 2.4, 10.5);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(40,10,80,0.85)';
    ctx.beginPath(); ctx.arc(-2, -2, 1, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(2, -2, 1, 0, Math.PI * 2); ctx.fill();

  } else if (id === 'ufo') {
    const hull = ctx.createRadialGradient(0, -2, 1, 0, 0, 9);
    hull.addColorStop(0, '#eef4fa');
    hull.addColorStop(0.5, '#93a3ba');
    hull.addColorStop(1, '#39435a');
    ctx.fillStyle = hull;
    ctx.beginPath();
    ctx.ellipse(0, 0, 9, 3.4, 0, 0, Math.PI * 2);
    ctx.fill();
    const dome = ctx.createRadialGradient(-1, -3.5, 0.5, 0, -2, 4.5);
    dome.addColorStop(0, 'rgba(190,245,255,0.9)');
    dome.addColorStop(1, 'rgba(40,120,190,0.5)');
    ctx.fillStyle = dome;
    ctx.beginPath();
    ctx.ellipse(0, -1.6, 4.2, 3.4, 0, Math.PI, 0);
    ctx.fill();
    // pilot dot
    ctx.fillStyle = '#2a4a2a';
    ctx.beginPath(); ctx.arc(0.4, -2.6, 1.2, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 4; i++) {
      const on = Math.floor(t * 5 + i) % 4 === 0;
      ctx.fillStyle = on ? '#40f0ff' : 'rgba(255,208,64,0.5)';
      ctx.beginPath();
      ctx.arc(-6 + i * 4, 1.6, 0.9, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (id === 'starpup') {
    // a five-point star with a puppy face and a wagging spark tail
    const wag = Math.sin(t * 9) * 0.35;
    ctx.fillStyle = 'rgba(255,214,90,0.55)';
    ctx.beginPath();
    ctx.arc(-8, 4 + wag * 4, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.rotate(wag * 0.25);
    const sg = ctx.createRadialGradient(-1.5, -2, 1, 0, 0, 9);
    sg.addColorStop(0, '#fff3c0');
    sg.addColorStop(0.6, '#ffce45');
    sg.addColorStop(1, '#c98a10');
    ctx.fillStyle = sg;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5;
      const rr = i % 2 === 0 ? 8.6 : 4.1;
      const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(150,95,10,0.6)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
    // puppy face: floppy highlight ears, wide eyes, tongue
    ctx.fillStyle = '#3a2410';
    ctx.beginPath(); ctx.arc(-2, -0.8, 1.1, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(2, -0.8, 1.1, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(-1.6, -1.2, 0.4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(2.4, -1.2, 0.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3a2410';
    ctx.beginPath(); ctx.ellipse(0, 1.2, 0.9, 0.7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff8a9a';
    ctx.beginPath(); ctx.ellipse(0.4, 2.8, 0.9, 1.2, 0.15, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  } else if (id === 'tinbot') {
    // little rivet-and-solder robot with one earnest eye
    const hover = Math.sin(t * 4) * 0.8;
    ctx.save();
    ctx.translate(0, hover);
    // thruster flame
    ctx.fillStyle = 'rgba(110,240,255,' + (0.4 + 0.3 * Math.sin(t * 16)).toFixed(2) + ')';
    ctx.beginPath();
    ctx.moveTo(-2, 8.5); ctx.lineTo(0, 12 + Math.sin(t * 16)); ctx.lineTo(2, 8.5);
    ctx.closePath();
    ctx.fill();
    const body = ctx.createLinearGradient(-6, -6, 6, 8);
    body.addColorStop(0, '#cfd8e2');
    body.addColorStop(0.5, '#8b98a8');
    body.addColorStop(1, '#525d6c');
    ctx.fillStyle = body;
    roundRect(-5.5, -2, 11, 10.5, 2.5);
    ctx.fill();
    ctx.strokeStyle = 'rgba(40,48,60,0.7)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
    // rivets
    ctx.fillStyle = 'rgba(40,48,60,0.8)';
    [[-4, -0.5], [4, -0.5], [-4, 7], [4, 7]].forEach(([px, py]) => {
      ctx.beginPath(); ctx.arc(px, py, 0.6, 0, Math.PI * 2); ctx.fill();
    });
    // chest bolt light
    ctx.fillStyle = Math.floor(t * 3) % 2 ? '#ffd23f' : 'rgba(255,210,63,0.35)';
    ctx.beginPath(); ctx.arc(0, 4, 1.4, 0, Math.PI * 2); ctx.fill();
    // dome head with a single big eye
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.arc(0, -5, 5, Math.PI, 0); ctx.fill();
    ctx.strokeStyle = 'rgba(40,48,60,0.7)';
    ctx.beginPath(); ctx.arc(0, -5, 5, Math.PI, 0); ctx.stroke();
    ctx.fillStyle = '#0c1118';
    ctx.beginPath(); ctx.arc(1, -6, 2.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#40f0ff';
    ctx.beginPath(); ctx.arc(1 + Math.sin(t * 2) * 0.8, -6, 1.2, 0, Math.PI * 2); ctx.fill();
    // antenna
    ctx.strokeStyle = '#525d6c';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-2.5, -9.5); ctx.lineTo(-3.5, -13); ctx.stroke();
    ctx.fillStyle = '#ff5050';
    ctx.beginPath(); ctx.arc(-3.7, -13.8, 1, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  } else if (id === 'wisp') {
    // a translucent spirit flame that never quite holds one shape
    const sway = Math.sin(t * 2.2);
    const glow = ctx.createRadialGradient(0, 0, 1, 0, 0, 12);
    glow.addColorStop(0, 'rgba(190,255,245,0.8)');
    glow.addColorStop(0.5, 'rgba(90,220,205,0.35)');
    glow.addColorStop(1, 'rgba(60,180,170,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.fill();
    const core = ctx.createRadialGradient(-1, -2, 0.5, 0, 0, 7);
    core.addColorStop(0, 'rgba(235,255,250,0.95)');
    core.addColorStop(0.7, 'rgba(120,230,215,0.55)');
    core.addColorStop(1, 'rgba(80,200,190,0.15)');
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.moveTo(0, -9 + sway);
    ctx.quadraticCurveTo(5.5, -4, 5, 1.5);
    ctx.quadraticCurveTo(4.5, 6, 0, 6.5);
    ctx.quadraticCurveTo(-4.5, 6, -5, 1.5);
    ctx.quadraticCurveTo(-5.5, -4, 0, -9 + sway);
    ctx.fill();
    // trailing wisps peel off behind
    ctx.strokeStyle = 'rgba(150,240,225,0.5)';
    ctx.lineWidth = 1.1;
    ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const k = (t * 1.1 + i * 0.33) % 1;
      ctx.globalAlpha = 0.6 * (1 - k);
      ctx.beginPath();
      ctx.moveTo(-4 - k * 6, 2 + Math.sin(i * 2.1 + t * 3) * 2.5);
      ctx.quadraticCurveTo(-7 - k * 8, 0, -9 - k * 10, 3 + Math.sin(i) * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // sleepy contented eyes
    ctx.strokeStyle = 'rgba(20,70,65,0.85)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(-2, -2, 1.4, 0.15, Math.PI - 0.15); ctx.stroke();
    ctx.beginPath(); ctx.arc(2, -2, 1.4, 0.15, Math.PI - 0.15); ctx.stroke();
  }
  ctx.restore();
}
function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function drawTrailPreview(id, cx, cy, t) {
  if (STAR_CHART_TRAILS.has(id)) { paintStarTrailPreview(ctx, id, cx, cy, t); return; }
  // a stylised burst frozen mid-flap
  const ph = (t * 2) % 1;
  ctx.save();
  ctx.translate(cx + 16, cy);
  if (id === 'sparks') {
    const g = ctx.createLinearGradient(0, 0, -34, 0);
    g.addColorStop(0, 'rgba(255,224,128,0.95)');
    g.addColorStop(0.5, 'rgba(255,128,48,0.8)');
    g.addColorStop(1, 'rgba(255,64,32,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.quadraticCurveTo(-36, 0, 0, 6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffe080';
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(-8 - ((ph * 26 + i * 9) % 28), (i % 2 ? -1 : 1) * (4 - i), 2.2 - i * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (id === 'ion') {
    ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      const off = (ph * 30 + i * 8) % 32;
      ctx.strokeStyle = i % 2 ? '#c8f4ff' : '#3ac0f0';
      ctx.lineWidth = 2 - i * 0.3;
      ctx.beginPath();
      ctx.moveTo(-2 - off, -4 + i * 2.6);
      ctx.lineTo(-12 - off, -4 + i * 2.6);
      ctx.stroke();
    }
  } else if (id === 'bubble') {
    ctx.strokeStyle = 'rgba(170,220,255,0.9)';
    for (let i = 0; i < 4; i++) {
      const off = (ph * 26 + i * 8) % 30;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(-4 - off, (i % 2 ? -1 : 1) * (5 - i), 2 + i, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else if (id === 'bloom') {
    for (let i = 0; i < 4; i++) {
      const off = (ph * 24 + i * 8) % 30;
      ctx.fillStyle = i % 2 ? '#f0b8ff' : '#a45cd8';
      ctx.beginPath();
      ctx.arc(-4 - off, (i % 2 ? -1 : 1) * (4 - i * 0.5), 2 + i * 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (id === 'comet') {
    const g = ctx.createLinearGradient(4, 0, -44, 0);
    g.addColorStop(0, 'rgba(255,250,225,1)');
    g.addColorStop(0.35, 'rgba(255,190,50,0.85)');
    g.addColorStop(1, 'rgba(255,110,10,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(4, -6.5);
    ctx.quadraticCurveTo(-46, 0, 4, 6.5);
    ctx.closePath();
    ctx.fill();
    ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const off = (ph * 30 + i * 11) % 34;
      ctx.strokeStyle = i % 2 ? 'rgba(255,246,210,0.9)' : 'rgba(255,180,40,0.85)';
      ctx.lineWidth = 2.4 - i * 0.5;
      ctx.beginPath();
      ctx.moveTo(-2 - off, (i - 1) * 3.4);
      ctx.lineTo(-14 - off, (i - 1) * 3.4);
      ctx.stroke();
    }
    const core = ctx.createRadialGradient(3, 0, 1, 3, 0, 7);
    core.addColorStop(0, '#ffffff');
    core.addColorStop(0.5, '#ffe27a');
    core.addColorStop(1, 'rgba(255,150,30,0)');
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(3, 0, 7, 0, Math.PI * 2);
    ctx.fill();
  } else if (id === 'prism') {
    for (let i = 0; i < 5; i++) {
      const off = (ph * 26 + i * 8) % 34;
      ctx.save();
      ctx.translate(-4 - off, (i % 2 ? -1 : 1) * (5 - i * 0.8));
      ctx.rotate(ph * 6 + i * 1.3);
      ctx.fillStyle = 'hsla(' + ((i * 72) % 360) + ',95%,68%,0.9)';
      ctx.beginPath();
      ctx.moveTo(0, -3.4); ctx.lineTo(2.6, 2.2); ctx.lineTo(-2.6, 2.2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  } else if (id === 'plasma') {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let i = 0; i < 2; i++) {
      const off = (ph * 34 + i * 14) % 34;
      ctx.strokeStyle = i ? 'rgba(255,255,255,0.8)' : '#c77dff';
      ctx.lineWidth = 2 - i * 0.9;
      ctx.beginPath();
      ctx.moveTo(-2 - off, 0);
      ctx.lineTo(-7 - off, -4);
      ctx.lineTo(-12 - off, 3);
      ctx.lineTo(-17 - off, -2);
      ctx.stroke();
    }
    const pg = ctx.createRadialGradient(0, 0, 0.5, 0, 0, 6);
    pg.addColorStop(0, 'rgba(255,255,255,0.9)');
    pg.addColorStop(0.6, 'rgba(199,125,255,0.5)');
    pg.addColorStop(1, 'rgba(140,60,255,0)');
    ctx.fillStyle = pg;
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fill();
  } else if (id === 'galaxy') {
    for (let i = 0; i < 6; i++) {
      const off = (ph * 22 + i * 7) % 36;
      const tint = i % 3 === 0 ? '255,255,255' : i % 3 === 1 ? '190,150,255' : '140,190,255';
      const tw = 0.55 + 0.45 * Math.sin(ph * 12 + i * 2.2);
      const s = 1.4 + (i % 3) * 0.7;
      const px = -3 - off, py = (i % 2 ? -1 : 1) * (6 - i * 0.9);
      ctx.fillStyle = 'rgba(' + tint + ',' + tw.toFixed(2) + ')';
      ctx.beginPath();
      ctx.moveTo(px, py - s * 1.6);
      ctx.lineTo(px + s * 0.4, py - s * 0.4);
      ctx.lineTo(px + s * 1.6, py);
      ctx.lineTo(px + s * 0.4, py + s * 0.4);
      ctx.lineTo(px, py + s * 1.6);
      ctx.lineTo(px - s * 0.4, py + s * 0.4);
      ctx.lineTo(px - s * 1.6, py);
      ctx.lineTo(px - s * 0.4, py - s * 0.4);
      ctx.closePath();
      ctx.fill();
    }
  } else if (id === 'aurora') {
    ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const off = (ph * 26 + i * 11) % 34;
      const col = i === 0 ? '93,255,200' : i === 1 ? '197,138,255' : '110,240,255';
      ctx.strokeStyle = 'rgba(' + col + ',0.85)';
      ctx.lineWidth = 2.4 - i * 0.5;
      ctx.beginPath();
      ctx.moveTo(-2 - off, (i - 1) * 5);
      ctx.quadraticCurveTo(-8 - off, (i - 1) * 5 + 4, -14 - off, (i - 1) * 5 - 2);
      ctx.stroke();
    }
  } else if (id === 'frost') {
    for (let i = 0; i < 3; i++) {
      const off = (ph * 24 + i * 10) % 32;
      ctx.save();
      ctx.translate(-4 - off, (i % 2 ? -1 : 1) * (5 - i));
      ctx.rotate(ph * 5 + i);
      ctx.strokeStyle = 'rgba(210,240,255,0.9)';
      ctx.lineWidth = 1;
      ctx.lineCap = 'round';
      for (let k = 0; k < 3; k++) {
        const a = k * Math.PI / 3;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 3.6, Math.sin(a) * 3.6);
        ctx.lineTo(-Math.cos(a) * 3.6, -Math.sin(a) * 3.6);
        ctx.stroke();
      }
      ctx.restore();
    }
  } else if (id === 'voidsmoke') {
    for (let i = 0; i < 3; i++) {
      const off = (ph * 20 + i * 9) % 30;
      const rr = 3 + i * 1.6 + ph * 2;
      ctx.fillStyle = 'rgba(10,6,20,0.55)';
      ctx.beginPath();
      ctx.arc(-4 - off, (i % 2 ? -1 : 1) * (3 - i), rr, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(180,92,255,0.6)';
      ctx.lineWidth = 1.1;
      ctx.stroke();
    }
  } else if (id === 'supernova') {
    const ring = 3 + ((ph * 18) % 16);
    ctx.strokeStyle = 'rgba(255,240,200,' + (1 - ring / 19).toFixed(2) + ')';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(-8, 0, ring, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,150,60,' + (0.6 - ring / 32).toFixed(2) + ')';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(-8, 0, ring * 1.3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 4; i++) {
      const a = i * 1.7 + 0.4;
      ctx.beginPath();
      ctx.arc(-8 + Math.cos(a) * ring * 0.8, Math.sin(a) * ring * 0.8, 1.1, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (id === 'opalfeather') {
    for (let i = 0; i < 4; i++) {
      const off = (ph * 27 + i * 9) % 36;
      ctx.save();
      ctx.translate(-3 - off, (i % 2 ? -1 : 1) * (5 - i));
      ctx.rotate(-0.22 + Math.sin(ph * 6 + i) * 0.28);
      ctx.shadowColor = i % 2 ? '#7fffe0' : '#8fb8ff'; ctx.shadowBlur = 5;
      ctx.fillStyle = i % 3 === 0 ? '#fff5ef' : i % 3 === 1 ? '#7fffe0' : '#8fb8ff';
      ctx.beginPath();
      ctx.moveTo(-4.8, 0); ctx.quadraticCurveTo(0, -3.4, 4.3, 0); ctx.quadraticCurveTo(0, 2.5, -4.8, 0); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = .6;
      ctx.beginPath(); ctx.moveTo(-3.8, 0); ctx.lineTo(3.4, 0); ctx.stroke();
      ctx.restore();
    }
  } else if (id === 'clockwork') {
    for (let i = 0; i < 4; i++) {
      const off = (ph * 24 + i * 10) % 36;
      const r = 2.6 + (i % 2) * 1.2;
      ctx.save();
      ctx.translate(-3 - off, (i % 2 ? -1 : 1) * 4);
      ctx.rotate((ph * 5 + i) * (i % 2 ? -1 : 1));
      ctx.strokeStyle = i % 2 ? '#fff0b8' : '#d89a3a'; ctx.lineWidth = 1;
      for (let k = 0; k < 8; k++) {
        ctx.rotate(Math.PI / 4); ctx.strokeRect(r * .7, -.5, 1.8, 1);
      }
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, r * .34, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
  } else if (id === 'celestialtide') {
    ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      const off = (ph * 29 + i * 9) % 38;
      ctx.strokeStyle = i % 2 ? '#75caff' : '#a993ff';
      ctx.lineWidth = 1.8 - i * .2;
      ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = 4;
      ctx.beginPath();
      ctx.moveTo(-2 - off, (i - 1.5) * 3);
      ctx.quadraticCurveTo(-7 - off, (i - 1.5) * 3 - 5, -14 - off, (i - 1.5) * 3 + 1);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
  } else if (id === 'phoenixplume') {
    for (let i = 0; i < 4; i++) {
      const off = (ph * 30 + i * 9) % 38;
      ctx.save();
      ctx.translate(-2 - off, (i % 2 ? -1 : 1) * (4.5 - i * .5));
      ctx.rotate(-.25 + Math.sin(ph * 7 + i) * .2);
      ctx.fillStyle = i % 3 === 0 ? '#fff2a8' : i % 3 === 1 ? '#ff9b42' : '#d9366e';
      ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 5;
      ctx.beginPath();
      ctx.moveTo(-5.5, .3); ctx.quadraticCurveTo(-.5, -4.3, 4.2, -.7);
      ctx.quadraticCurveTo(1.2, .2, 3.3, 3.1); ctx.quadraticCurveTo(-1.1, 2.2, -5.5, .3); ctx.fill();
      ctx.restore();
    }
  } else if (id === 'verdantflourish') {
    for (let i = 0; i < 4; i++) {
      const off = (ph * 23 + i * 10) % 37;
      ctx.save();
      ctx.translate(-3 - off, (i % 2 ? -1 : 1) * (5 - i));
      ctx.rotate(ph * 2.5 + i * 1.3);
      ctx.fillStyle = i % 2 ? '#55e89d' : '#e7ffd5';
      ctx.shadowColor = '#55e89d'; ctx.shadowBlur = 4;
      ctx.beginPath();
      ctx.moveTo(-4.2, 0); ctx.quadraticCurveTo(0, -3.5, 4.2, 0); ctx.quadraticCurveTo(0, 3, -4.2, 0); ctx.fill();
      ctx.strokeStyle = '#16866a'; ctx.lineWidth = .7;
      ctx.beginPath(); ctx.moveTo(-3.2, 0); ctx.lineTo(3.2, 0); ctx.stroke();
      ctx.restore();
    }
  } else if (id === 'eclipseglyph') {
    for (let i = 0; i < 4; i++) {
      const off = (ph * 21 + i * 10) % 37;
      const r = 2.8 + (i % 2);
      ctx.save();
      ctx.translate(-3 - off, (i % 2 ? -1 : 1) * 4);
      ctx.rotate(ph * 3 + i);
      ctx.strokeStyle = i % 2 ? '#ffe2bd' : '#c77dff'; ctx.lineWidth = 1.2;
      ctx.shadowColor = '#c77dff'; ctx.shadowBlur = 5;
      ctx.beginPath(); ctx.arc(0, 0, r, .5, Math.PI * 1.72); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, r * 1.5, 3.5, 5.7); ctx.stroke();
      ctx.restore();
    }
  }
  ctx.restore();
}

function drawPalPreview(id, cx, cy, t) {
  if (id === 'none') {
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 15, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - 10, cy + 10);
    ctx.lineTo(cx + 10, cy - 10);
    ctx.stroke();
  } else {
    drawPal(id, cx, cy + Math.sin(t * 2.4) * 3, 1.9, t);
  }
}


export function drawAstronautOn(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  rot: number,
  scale: number,
  helm: HelmDraw,
  suit: SuitDraw,
  opts?: { flame?: number; seed?: number; shield?: boolean },
) {
  use(c);
  drawAstronaut(x, y, rot, scale, helm, suit, opts || {});
}

export function drawPalOn(
  c: CanvasRenderingContext2D,
  id: string,
  x: number,
  y: number,
  s: number,
  t: number,
) {
  use(c);
  drawPal(id, x, y, s, t);
}

export function drawTrailPreviewOn(
  c: CanvasRenderingContext2D,
  id: string,
  cx: number,
  cy: number,
  t: number,
) {
  use(c);
  drawTrailPreview(id, cx, cy, t);
}
