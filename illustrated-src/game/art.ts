import { VANGUARD_FRAMES } from "./vanguard";
import { DEBRIS_COUNT, LEGACY_DEBRIS_COUNT, ART_VER } from "./catalog";
import { prepareDepotBear, type DepotBearFrame } from "./spill-depot-bear";
import { SPILL_UTILITY_IDS } from "./spill-content";
import {ORBIT_PILOT_IDS,PREMIUM_SUIT_IDS,isPremiumFrames,isHighOrbitRig,type HighOrbitRigId,type PremiumSuitId} from "./high-orbit-config";
import {isArcflashRig} from "./arcflash";
import { bindSpriteDetails, spriteImageFor, type DetailSprite } from "./sprite-detail";

export type Box = { x: number; y: number; w: number; h: number };

export type Sprite = DetailSprite & {
  box: Box;
  core: number;
  /** centroid of the solid collision-bearing pixels, in source space */
  coreX: number;
  coreY: number;
};

export type ArtBank = {
  ready: boolean;
  squirrelIdle: Sprite[];
  squirrelFlap: Sprite[];
  acorn: Sprite[];
  golden: Sprite[];
  shield: Sprite[];
  planets: Sprite[];
  debris: Sprite[];
  pals: Record<string, Sprite>;
  palAnim: Record<string, Sprite[]>;
  helms: Record<string, Sprite>;
  suits: Record<string, Sprite>;
  vanguard?: Sprite[];
  vanguardParts?: Sprite;
  /** Arcflash's transparent 1024 × 768 joint atlas; never a frame bank. */
  arcflash?: HTMLImageElement;
  highOrbit?: Partial<Record<HighOrbitRigId,HTMLImageElement>>;
  /** Sixteen complete poses in a 4x4 sheet; never a cut-part atlas. */
  premiumFlight?: Partial<Record<PremiumSuitId,HTMLImageElement>>;
  sky: HTMLImageElement | null;
  arcadeAcorn: Sprite | null;
  frozen: Sprite | null;
  shieldnut: Sprite | null;
  /** THE SPILL's run-only Acorn Coin. The ore property preserves save/API compatibility.
   *  One painting; it bobs rather than cycles */
  ore: Sprite | null;
  /** the animated pickup cycles — frozen and shield now MOVE like the
   *  acorns always have; the single files above stay as icons/fallbacks */
  frozenAnim: Sprite[];
  shieldAnim: Sprite[];
  /** The painted vortex spin cycles: wormhole and black hole. Drawn
   *  full-canvas at a fixed footprint — the glow makes each frame's alpha
   *  box breathe, so box-fitting would jitter the size. The procedural
   *  vortex remains the fallback while frames stream in. */
  wormAnim: Sprite[];
  holeAnim: Sprite[];
  /** The black hole's collapse, played once as a hole warp takes hold. */
  holeEnter: Sprite[];
  // Suits that ship a hinged tail carry two extra layers, both on the
  // full canvas so they register against the whole-suit sprite.
  suitTail: Record<string, Sprite>;
  suitBody: Record<string, Sprite>;
  // Optional one-shot body animation banks. Frames stay on the same 256px
  // canvas as the static suit so the tail hinge and helmet rig remain stable.
  suitTap: Record<string, Sprite[]>;
  /** Continuous flight cycles (owner sheets, 7 Sep 2026): a whole-character
   *  loop that plays the entire time the suit is worn, on the clock, not on
   *  a tap - the critters' sixteen poses are a swimming cycle, not a burst. */
  suitLoop: Record<string, Sprite[]>;
  // Tail-only companion banks. These preserve the approved painted fur while
  // bending through the plume instead of rotating as one rigid piece.
  suitTapTail: Record<string, Sprite[]>;
  /** VOLT's alternate jump (the hangar A/B experiment) and its painted
   *  planet-bounce recoil. Volt-only for now. */
  suitBounce: Record<string, Sprite[]>;
  /** ECLIPSE's physics-pose experiment: posture follows vertical
   *  velocity. asc runs neutral->full climb, desc runs neutral->steep
   *  dive; both index-0 frames are the same level-glide attitude so
   *  crossing the arc never pops. Eclipse-only for testing. */
  suitAsc: Record<string, Sprite[]>;
  suitDesc: Record<string, Sprite[]>;
  /** Hyper Run layers are decoded with the launch bank, never mid-race. */
  hyperRun: Record<string, Sprite>;
  /** THE SPILL's ship: one hull per plating level and one part per level
   *  of the other three meters, all cut in one 256px frame. The fit - one
   *  offset/scale/turn per part, with per-hull overrides - is set by hand
   *  in the lab's Ship Bench and read from transforms.json beside the art */
  spillShip: Record<string, Sprite>;
  spillShipFit: SpillShipFit | null;
  /** Generated combat hulls remain separate from the pinned upstream kit. */
  spillCombat: Partial<Record<"pursuer" | "flanker", Sprite>>;
  spillCombatStatus: "pending" | "ready" | "fallback";
  spillScene?: { depot?: HTMLImageElement; panorama?: HTMLImageElement; bear?: DepotBearFrame[];
    vanguardDepot?: HTMLImageElement };
};

export type SpillShipXf = { dx: number; dy: number; scale: number; rot: number; behind?: boolean };
export type SpillShipFit = { parts: Record<string, SpillShipXf>; overrides: Record<string, Record<string, SpillShipXf>> };
export const SPILL_SHIP_IDS = [
  "hull-0", "hull-1", "hull-2", "hull-3",
  "thrust-1", "thrust-2", "thrust-3",
  "cone-1", "cone-2", "cone-3",
  "cockpit-1", "cockpit-2", "cockpit-3",
];
export const SPILL_ENEMY_IDS = ["pursuer", "flanker"] as const;

declare global {
  interface Window {
    __ACORNAUT_ART__?: string;
  }
}

export function artBase() {
  const raw = (typeof window !== "undefined" && window.__ACORNAUT_ART__) || "/art";
  return raw.replace(/\/$/, "");
}

export function artUrl(path: string) {
  const p = path.replace(/^\//, "");
  return `${artBase()}/${p}?v=${ART_VER}`;
}

function loadImg(src: string) {
  const url = src.includes("?") ? src : `${src}?v=${ART_VER}`;
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    // DECODED BEFORE IT IS HANDED OVER (audit, 30 Sep 2026): a 6 MP sky that
    // resolves on onload is decoded synchronously on its first drawImage,
    // which was the 100-200 ms hitch when a zone's panorama arrived mid-run
    img.onload = () => {
      const done = () => resolve(img);
      if (typeof img.decode === "function") img.decode().then(done, done); else done();
    };
    img.onerror = () => reject(new Error(src));
    img.src = url;
  });
}

const spillSceneLoads = new WeakMap<ArtBank, Promise<void>>();
/** Only the original Spill scene is shipped; the baseline pilot is Flight. */
export function loadSpillScene(bank: ArtBank, _suit = ""): Promise<void> {
  bank.spillScene ??= {};
  const existing = spillSceneLoads.get(bank);
  if (existing) return existing;
  const promise = Promise.all([... ["depot", "panorama"].map(async name => {
    try { bank.spillScene![name] = await loadImg(artUrl(`spill-scene/${name}.png`)); }
    catch { /* Preserve the original procedural scene fallback. */ }
  }), loadImg(artUrl("spill-scene/depot-bear.jpg"))
    .then(sheet => { bank.spillScene!.bear = prepareDepotBear(sheet); })
    .catch(() => { /* The original arrival remains usable without its marshal. */ })]).then(() => {});
  spillSceneLoads.set(bank, promise);
  return promise;
}

function measureSprite(img: HTMLImageElement): { box: Box; core: number; coreX: number; coreY: number } {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) return {
    box: { x: 0, y: 0, w, h }, core: Math.max(w, h), coreX: w / 2, coreY: h / 2,
  };
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, w, h).data;
  let minX = w;
  let minY = h;
  let maxX = 0;
  let maxY = 0;
  let sx = 0;
  let sy = 0;
  let sn = 0;
  const solid: number[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const a = data[(y * w + x) * 4 + 3];
      if (a < 16) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      if (a >= 80) {
        sx += x;
        sy += y;
        sn += 1;
        solid.push(x, y);
      }
    }
  }
  if (maxX < minX) return {
    box: { x: 0, y: 0, w, h }, core: Math.max(w, h), coreX: w / 2, coreY: h / 2,
  };
  const pad = 2;
  const box: Box = {
    x: Math.max(0, minX - pad),
    y: Math.max(0, minY - pad),
    w: Math.min(w, maxX - minX + 1 + pad * 2),
    h: Math.min(h, maxY - minY + 1 + pad * 2),
  };
  if (!sn) return {
    box, core: Math.max(box.w, box.h), coreX: box.x + box.w / 2, coreY: box.y + box.h / 2,
  };
  const cx = sx / sn;
  const cy = sy / sn;
  const dists: number[] = [];
  for (let i = 0; i < solid.length; i += 2) {
    const dx = solid[i] - cx;
    const dy = solid[i + 1] - cy;
    dists.push(Math.hypot(dx, dy));
  }
  dists.sort((a, b) => a - b);
  const r80 = dists[Math.min(dists.length - 1, Math.floor(dists.length * 0.8))];
  return { box, core: Math.max(8, r80 * 2), coreX: cx, coreY: cy };
}

function asSprite(img: HTMLImageElement): Sprite {
  const s = img as Sprite;
  const m = measureSprite(img);
  s.box = m.box;
  s.core = m.core;
  s.coreX = m.coreX;
  s.coreY = m.coreY;
  const still = typeof img.src === "string" ? img.src.match(/\/suits\/([^/]+)\.png(?:\?|$)/)?.[1] : undefined;
  if (still && isPremiumFrames(still))
    bindSpriteDetails([{ sprite: s, path: `suits/hd/${still}.png` }], path => loadImg(artUrl(path)));
  return s;
}

// These large, padded source paintings are fitted by their alpha box. They do
// not need the collision-core percentile sort used by the original debris.
// Scan once at load, keep the original image, and never allocate masks per frame.
function asCombatSprite(img: HTMLImageElement): Sprite {
  const width = img.naturalWidth || img.width, height = img.naturalHeight || img.height;
  const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  let left = width, top = height, right = -1, bottom = -1;
  if (ctx) {
    ctx.drawImage(img, 0, 0);
    const pixels = ctx.getImageData(0, 0, width, height).data;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      if (pixels[(y * width + x) * 4 + 3] < 16) continue;
      left = Math.min(left, x); right = Math.max(right, x);
      top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
  }
  if (right < left) { left = top = 0; right = width - 1; bottom = height - 1; }
  const x = Math.max(0, left - 2), y = Math.max(0, top - 2);
  const box = { x, y, w: Math.min(width, right + 3) - x, h: Math.min(height, bottom + 3) - y };
  const sprite = img as Sprite;
  sprite.box = box; sprite.core = Math.max(box.w, box.h);
  sprite.coreX = box.x + box.w / 2; sprite.coreY = box.y + box.h / 2;
  return sprite;
}

const combatLoads = new WeakMap<ArtBank, Promise<void>>();
export function loadSpillCombat(bank: ArtBank): Promise<void> {
  const existing = combatLoads.get(bank);
  if (existing) return existing;
  const promise = Promise.all(SPILL_ENEMY_IDS.map(async id => {
    try { bank.spillCombat[id] = asCombatSprite(await loadImg(artUrl(`spill-combat/${id}.png`))); }
    catch { /* A failed request uses the corresponding visible silhouette; readiness still settles. */ }
  })).then(() => {
    bank.spillCombatStatus = SPILL_ENEMY_IDS.every(id => bank.spillCombat[id]) ? "ready" : "fallback";
  });
  combatLoads.set(bank, promise);
  return promise;
}

// One missing file must never sink the bank: a 404 among sixty-odd
// sprites used to reject loadArt, and the game then drew NOTHING at all.
async function many(prefix: string, n: number, start = 1) {
  const out: Sprite[] = [];
  const loaded = await Promise.all(
    Array.from({ length: n }, (_, i) =>
      loadImg(`${prefix}${start + i}.png?v=${ART_VER}`)
        .then(asSprite)
        .catch(() => null),
    ),
  );
  for (const s of loaded) if (s) out.push(s);
  return out;
}

async function indexedSprites(folder: string, ids: readonly number[], count: number) {
  const out = new Array<Sprite>(count).fill(null);
  await Promise.all(ids.map(async id => {
    try { out[id] = asSprite(await loadImg(artUrl(`${folder}/${id}.png`))); }
    catch { /* preserve the slot: a missing image must never shift another ID */ }
  }));
  return out;
}

/** Spill uses its own panorama and fixed legacy debris bank, never zone planets/skies. */
export function loadZoneArt(_art: ArtBank, _env: number): Promise<void> {
  return Promise.resolve();
}

/** An empty bank the renderer can draw with immediately — every draw
 *  path already null-guards, so the game paints from the first frame
 *  instead of waiting on megabytes of panorama. */
export function emptyArt(): ArtBank {
  return {
    ready: false,
    squirrelIdle: [], squirrelFlap: [], acorn: [], golden: [], shield: [],
    planets: [], debris: [], pals: {}, palAnim: {}, helms: {},
    suits: {}, sky: null, arcadeAcorn: null, frozen: null, shieldnut: null, ore: null,
    frozenAnim: [], shieldAnim: [], wormAnim: [], holeAnim: [], holeEnter: [],
    suitTail: {}, suitBody: {}, suitTap: {}, suitLoop: {}, suitTapTail: {}, suitBounce: {}, suitAsc: {}, suitDesc: {}, hyperRun: {},
    spillShip: {}, spillShipFit: null, spillCombat: {}, spillCombatStatus: "pending",
  };
}

/** Compatibility for shared painters; no non-Spill sky requests are issued. */
export function skyImage(_id: string): HTMLImageElement | null { return null; }

// A separation halo, baked ONCE per sprite per mode. Doing this with a
// live ctx.shadowBlur cost a blur on every gate and every rock, every
// frame — a phone-framerate killer. Baked, it is one extra drawImage.
export const SPRITE_HALO_PAD = 20;
const haloCache = new Map<string, HTMLCanvasElement | null>();
export function spriteHalo(spr: Sprite | HTMLImageElement, mode: "dark" | "light") {
  const key = (spr.src || "") + "|" + mode;
  const hit = haloCache.get(key);
  if (hit !== undefined) {
    haloCache.delete(key); haloCache.set(key, hit);
    return hit;
  }
  const c = document.createElement("canvas");
  c.width = spr.width + SPRITE_HALO_PAD * 2;
  c.height = spr.height + SPRITE_HALO_PAD * 2;
  const cc = c.getContext("2d");
  if (!cc) {
    haloCache.set(key, null);
    return null;
  }
  // one soft pass, not two hard ones: doubled up at 0.9 alpha this read
  // as a drawn ring around every planet rather than separation
  cc.shadowColor = mode === "dark" ? "rgba(5,8,16,0.5)" : "rgba(170,200,255,0.28)";
  cc.shadowBlur = mode === "dark" ? 24 : 16;
  cc.shadowOffsetX = c.width * 2;               // keep only the shadow
  cc.drawImage(spr, SPRITE_HALO_PAD - c.width * 2, SPRITE_HALO_PAD);
  haloCache.set(key, c);
  // An expanded zone library must not retain a blur canvas for every
  // visited planet forever. Forty-eight covers nearby gates and pilot art.
  if (haloCache.size > 48) haloCache.delete(haloCache.keys().next().value);
  return c;
}

export function drawSprite(
  ctx: CanvasRenderingContext2D,
  spr: Sprite | HTMLImageElement | null | undefined,
  x: number,
  y: number,
  size: number,
  fit: "box" | "core" = "box",
  halo?: "dark" | "light",
  haloOpacity = 1,
) {
  if (!spr) return;
  const box = (spr as Sprite).box ?? { x: 0, y: 0, w: spr.width, h: spr.height };
  const core = (spr as Sprite).core;
  const dim = fit === "core" && core ? core : Math.max(box.w, box.h);
  const scale = size / Math.max(1, dim);
  const dw = box.w * scale;
  const dh = box.h * scale;
  const centerX = fit === "core" && Number.isFinite((spr as Sprite).coreX)
    ? (spr as Sprite).coreX
    : box.x + box.w / 2;
  const centerY = fit === "core" && Number.isFinite((spr as Sprite).coreY)
    ? (spr as Sprite).coreY
    : box.y + box.h / 2;
  const dx = x - (centerX - box.x) * scale;
  const dy = y - (centerY - box.y) * scale;
  if (halo) {
    const h = spriteHalo(spr, halo);
    if (h) {
      ctx.save();
      ctx.globalAlpha *= haloOpacity;
      const m = SPRITE_HALO_PAD * scale;
      ctx.drawImage(
        h, box.x, box.y, box.w + SPRITE_HALO_PAD * 2, box.h + SPRITE_HALO_PAD * 2,
        dx - m, dy - m, dw + m * 2, dh + m * 2,
      );
      ctx.restore();
    }
  }
  const image = spriteImageFor(ctx, spr, spr.width * scale, spr.height * scale);
  const ratio = image.width / spr.width;
  ctx.drawImage(image, box.x * ratio, box.y * ratio, box.w * ratio, box.h * ratio, dx, dy, dw, dh);
}

// ------------------------------------------------------------- lazy suits
// The per-suit FLIGHT banks — hinged tail/body layers and the animation
// series — are the heaviest thing the game ships (tens of megabytes across
// the roster, and the roster keeps growing). Only FLIGHT and the suit the
// save is wearing load with the boot bank; the rest stream in one suit at
// a time once the menu is up, so a fresh phone sees the game in a fraction
// of the old download. Every draw path already falls back to the rigid
// whole-suit sprite until a bank lands, so a not-yet-loaded suit is never
// broken — just briefly un-animated.
// Current catalog suits carry neck-cut tail/body pairs. Seraph's wing
// still touches its plume in the source, but the guarded mainline cut is
// safer than the earlier colour split and remains an active rig.
const RIGGED_SUITS = [
  // flight left with the 3D lineup (26 Oct 2026): it flies a rendered bank
  // The natural-flight nine use whole-frame banks and matching neutral
  // portraits. Their historical split parts are no longer requested.
  // alien is NOT rigged any more: its new spiral-tail master has no neck
  // to cut (neck-cut.py itself refused the art), and the suit flies a full
  // 8/8 painted bank - the static master is the honest loading fallback.
  // ghost went bank-only with its spectral rebuild: the wisp tail has no
  // neck to cut, and a full bank needs no rig.
  // bigbooty left with her 3D model (27 Oct 2026): a rendered bank, no rig cut
  "robo",
  // seraph left the rig list with the shelf-card promotion: its winged
  // asc-1 has no neck to cut (neck-cut.py refused it), and it flies a
  // full bank - the static master is its loading fallback, like alien.
  "catsuit",
  // verdant, cryostar and eclipse left with the 3D lineup (26 Oct 2026)
  "volt",
  // Cyber is NOT beta-gated any more. It started beta-only, then the shop
  // overhaul sold it on production in two bundles - and its rig stayed
  // behind this flag, so a pilot who bought it flew a flat sticker while
  // the beta page flew the animation. A suit's art must follow the suit.
  "cyber",
  // origamist left with the 3D lineup (26 Oct 2026): it flies a rendered bank
  // nacre (Envoy) followed on a new model with twin tails (27 Oct 2026)
  // High Orbit uses its own eleven-part atlases below.
];
const TAP_BANKS: Record<string, number> = {
  // The Robo-timing rollout is DONE: it was beta-only while the owner flew
  // each silhouette, and the verdict is that the painted bank beats the rig.
  // Production used to fall back to the universal rig path, whose tap is a
  // scale trick - ctx.scale(1 + p*0.052, 1 - p*0.028) squashing the whole
  // body 2.8% vertically - which is the belly-tuck the owner saw on live and
  // not on beta. A painted frame has no such thing: the pose IS the art.
  // Every one of these banks already shipped in the production art folder;
  // only this list kept production from asking for them.
  robo: 16, catsuit: 16, volt: 16,
  // THE 3D LINEUP (owner, 26 Oct 2026: "here are the replacements, DIRECT
  // replace"): ten suits re-made from rigged 3D squirrels by tools/rig3d -
  // a twelve-frame tap and a four-frame dive (the dive table below), no climb, the
  // same motion on every one. See the tapDive branch in draw.ts.
  ember: 12, voidsuit: 12, groveguard: 12, cinderforge: 12, sunforged: 12,
  abyssal: 12, gemmie: 12, iontrim: 12, sammie: 12, cosmic: 12,
  // and the next two on the same rendered skeleton, then four on their own rigs
  flight: 12, frost: 12, leviathan: 12, copper: 12, alien: 12, hedgehog: 12,
  arcflash: 12, origamist: 12, porcelain: 12, eclipse: 12, cryostar: 12, verdant: 12,
  ferret: 12, raccoon: 12,
  // Big Booty (27 Oct 2026): her own jiggle rig - see art-src/rig3d/receipt.json for the recipe
  bigbooty: 12,
  // Envoy (27 Oct 2026): a new model, its twin tails twirling and crossing
  nacre: 12,
  // Seraph (27 Oct 2026): its 3D model with a rigged tail and wings that beat down toward the
  // hands (art-src/rig3d/receipt.json)
  seraph: 12,
  // the owner's board (27 Oct 2026): five new suits from the staged future models
  tracer: 12, glasssuit: 12, redline: 12, robodog: 12, geode: 12,
  // Ghost (27 Oct 2026): her back wisp follows the main tail a beat late - recipe in the receipt
  ghost: 12,
  // seraph's, iontrim's, copper's and voidsuit's generated tap banks are
  // retired: their GENERATED motion lost the pilot's lower body at its
  // extremes, and each flies a painted ascent/descent ramp now -
  // deliveries #1-#4 of the flight-bank sweep. Iontrim's retirement also
  // deleted its TAP_FRAME_SKIP stopgap in draw.ts: the skip dies with the
  // bank it patched.
  // leviathan's generated tap bank is retired with its remaster: the suit
  // flies a painted 8/8 ramp now - the final delivery of the sweep.
  // The five unreleased suits' obsolete tap banks are retired with their
  // owner-requested 8/8 replacement sheets (7 Sep 2026).
};
// eclipse's tail-tap bank retired with its painted art (3D lineup, 26 Oct 2026)
const TAIL_TAP_BANKS: Record<string, number> = {};
const BOUNCE_BANKS: Record<string, number> = { volt: 16 };
// Alien descends on SEVEN frames, deliberately: the delivered desc-7 was a
// heavy black tail-swirl that would flash on colored skies, so the owner
// excluded it from the loop - desc-8 was renumbered into its slot. Banks
// have never owed anyone 8/8 (Flight itself flies 3/5). "alien2" is the
// owner's A/B twin (beta-only, see catalog.ts) flying the standard-spec
// bank while "alien" flies the custom-posed one.
//
// CRYOSTAR, VERDANT, GEMMIE and SAMMIE descend on SEVEN for the same kind
// of reason (owner, 2 Sep 2026: "drop the broken frames"). Every delivery
// ships desc-1 as a byte-identical copy of asc-1 - the wide neutral pose,
// shared so the climb/dive crossing at zero velocity is seamless. On most
// suits that costs nothing, because the master is the same size as the
// rest of the bank. On these four it is not: measured against their own
// dive frames, desc-1 runs 12-27% wider and 60-98% heavier, so every pass
// back through level flight ballooned the pilot mid-dive. That is the
// "large frame in rotation" the owner could see but not name. Dropped and
// renumbered; the crossing now lands on a true first-dive pose. The other
// eleven swept suits measured clean and keep their shared frame.
const ASC_BANKS: Record<string, number> =
    { cyber: 9,
        // seraph left too (27 Oct 2026): its 3D model, wings beating down on its own hinges
        // alien, copper, leviathan and then ghost left for the 3D lineup (26-27 Oct 2026)
        // Briella's Cat (owner sheet, 6 Sep 2026): 12 poses cut 7 up / 4 down
        briellacat: 7,
        };
const DESC_BANKS: Record<string, number> =
    { cyber: 9,
        briellacat: 4,
        // the 3D lineup's dives, paired with their twelve-frame taps above
        ember: 4, voidsuit: 4, groveguard: 4, cinderforge: 4, sunforged: 4,
        abyssal: 4, gemmie: 4, iontrim: 4, sammie: 4, cosmic: 4,
        flight: 4, frost: 4, leviathan: 4, copper: 4, alien: 4, hedgehog: 4,
        arcflash: 4, origamist: 4, porcelain: 4, eclipse: 4, cryostar: 4, verdant: 4,
        ferret: 4, raccoon: 4, bigbooty: 4, ghost: 4, nacre: 4, seraph: 4,
        tracer: 4, glasssuit: 4, redline: 4, robodog: 4, geode: 4,
        };
// THE CRITTERS' FLIGHT CYCLES: sixteen whole-character frames that loop
// on the clock for as long as the suit is worn. See suitLoop / fullLoop.
// all three critters left for the 3D lineup (26 Oct 2026): Quill, then Noodle and Bandit.
// The loop path stays for the next sheet that needs it.
const LOOP_BANKS: Record<string, number> = {};
const LAZY_SUIT_IDS = [...new Set([
  "vanguard",
  // Arcflash is SOLD on production (7 Sep 2026): its parts atlas must load
  // there too, or the suit flies as a flat body sticker off the live page.
  "arcflash",
  ...ORBIT_PILOT_IDS,
  ...Object.keys(LOOP_BANKS),
  ...RIGGED_SUITS,
  ...Object.keys(TAP_BANKS), ...Object.keys(TAIL_TAP_BANKS),
  ...Object.keys(BOUNCE_BANKS), ...Object.keys(ASC_BANKS), ...Object.keys(DESC_BANKS),
])];

// one load per suit for the page's lifetime — repeat calls (equip, the
// background sweep, a re-equip) all share the same in-flight promise
const suitBankLoads = new Map<string, Promise<void>>();
const SHIPPED_SUITS = new Set(["flight"]);
export function loadSuitBank(bank: ArtBank, id: string): Promise<void> {
  if (!SHIPPED_SUITS.has(id)) return Promise.resolve();
  const hit = suitBankLoads.get(id);
  if (hit) return hit;
  const base = artBase();
  const layer = (suffix: string) =>
    loadImg(`${base}/suits/${id}${suffix}.png?v=${ART_VER}`).then(asSprite).catch(() => null);
  const p = (async () => {
    if (isHighOrbitRig(id)) {
      try {
        const atlas=await loadImg(`${base}/suits/${id}/parts.png?v=${ART_VER}`);
        if(atlas.naturalWidth!==1024||atlas.naturalHeight!==768)throw new Error("Invalid High Orbit parts atlas");
        (bank.highOrbit??={})[id]=atlas;
      } catch { suitBankLoads.delete(id); }
      return;
    }
    if (isArcflashRig(id)) {
      try {
        const atlas = await loadImg(`${base}/suits/arcflash/parts.png?v=${ART_VER}`);
        if (atlas.naturalWidth !== 1024 || atlas.naturalHeight !== 768) {
          throw new Error("Invalid Arcflash parts atlas");
        }
        // Keep the original alpha and cell coordinates. Sprite measurement
        // or frame slicing would break the joints' registration.
        bank.arcflash = atlas;
      } catch {
        suitBankLoads.delete(id); // static body stays usable; allow retry
      }
      return;
    }
    if (id === "vanguard") {
      const [frames,parts] = await Promise.all([
        many(`${base}/suits/vanguard/frame-`, VANGUARD_FRAMES),
        loadImg(`${base}/suits/vanguard/maneuver-parts.png?v=${ART_VER}`).then(asSprite).catch(()=>null),
      ]);
      // Never publish a partial bank: filtering failed images must not shift poses.
      if (frames.length === VANGUARD_FRAMES) bank.vanguard = frames;
      else suitBankLoads.delete(id); // allow a later equip to retry
      if(parts&&parts.width===1024&&parts.height===768)bank.vanguardParts=parts;
      else suitBankLoads.delete(id); // retain the old rig and allow a later retry
      return;
    }
    const rigged = RIGGED_SUITS.includes(id);
    const [tail, body] = await Promise.all([
      rigged ? layer("-tail") : Promise.resolve(null),
      rigged ? layer("-body") : Promise.resolve(null),
    ]);
    const [tap, loop, tailTap, bounce, asc, desc] = await Promise.all([
      TAP_BANKS[id] ? many(`${base}/suits/${id}-tap-`, TAP_BANKS[id]) : Promise.resolve([]),
      LOOP_BANKS[id] ? many(`${base}/suits/${id}-loop-`, LOOP_BANKS[id]) : Promise.resolve([]),
      TAIL_TAP_BANKS[id] ? many(`${base}/suits/${id}-tail-tap-`, TAIL_TAP_BANKS[id]) : Promise.resolve([]),
      BOUNCE_BANKS[id] ? many(`${base}/suits/${id}-bounce-`, BOUNCE_BANKS[id]) : Promise.resolve([]),
      ASC_BANKS[id] ? many(`${base}/suits/${id}-asc-`, ASC_BANKS[id]) : Promise.resolve([]),
      DESC_BANKS[id] ? many(`${base}/suits/${id}-desc-`, DESC_BANKS[id]) : Promise.resolve([]),
    ]);
    if (tail) bank.suitTail[id] = tail;
    if (body) bank.suitBody[id] = body;
    if (tap.length) bank.suitTap[id] = tap;
    if (loop.length) bank.suitLoop[id] = loop;
    if (tailTap.length) bank.suitTapTail[id] = tailTap;
    if (bounce.length) bank.suitBounce[id] = bounce;
    // The remastered trio must not compress a missing pose out of its ramp.
    // Publish both complete banks together, retaining the still on failure.
    const completeMotion = !isPremiumFrames(id) || (asc.length === ASC_BANKS[id] && desc.length === DESC_BANKS[id]
      && [...asc,...desc].every(frame=>frame.width===256&&frame.height===256));
    if (isPremiumFrames(id)) {
      const detail = (path: string) => loadImg(artUrl(path));
      if (tail && body) bindSpriteDetails([
        { sprite: tail, path: `suits/hd/${id}-tail.png` },
        { sprite: body, path: `suits/hd/${id}-body.png` },
      ], detail);
      if (completeMotion) bindSpriteDetails([
        ...asc.map((sprite, i) => ({ sprite, path: `suits/hd/${id}-asc-${i + 1}.png` })),
        ...desc.map((sprite, i) => ({ sprite, path: `suits/hd/${id}-desc-${i + 1}.png` })),
      ], detail);
    }
    if (asc.length && completeMotion) bank.suitAsc[id] = asc;
    if (desc.length && completeMotion) bank.suitDesc[id] = desc;
    // many() drops a frame it could not fetch rather than sinking the whole
    // bank, and that is the right instinct - but draw.ts reads the tap,
    // tail-tap and bounce banks by EXACT count (16, 12, 16), so fifteen
    // frames is not one pose missing, it is the painted animation switched
    // off and the suit back on the universal rig's 2.8% belly tuck. Nothing
    // released the cache slot either way, so one flaky request on mobile
    // data pinned that for the rest of the session and a re-equip could not
    // clear it. An audit found it. Give a short bank the same courtesy
    // vanguard and switchback already get and drop the slot, so the next
    // equip or the background sweep can ask again. Whatever DID arrive stays
    // published: asc, desc and loop are read at whatever length they have,
    // so a 7-of-8 ramp still plays and only an empty one is worth a retry.
    const shortBank =
      (TAP_BANKS[id] && tap.length !== TAP_BANKS[id]) ||
      (TAIL_TAP_BANKS[id] && tailTap.length !== TAIL_TAP_BANKS[id]) ||
      (BOUNCE_BANKS[id] && bounce.length !== BOUNCE_BANKS[id]) ||
      (LOOP_BANKS[id] && !loop.length) ||
      (ASC_BANKS[id] && !asc.length) ||
      (DESC_BANKS[id] && !desc.length);
    if (shortBank || !completeMotion || (isPremiumFrames(id) && (!tail || !body))) suitBankLoads.delete(id);
  })();
  suitBankLoads.set(id, p);
  return p;
}

/** No PAL can be equipped in this standalone baseline. */
export function loadPalBank(_bank: ArtBank, _id: string): Promise<void> { return Promise.resolve(); }

/** Do not fetch the upstream cosmetic roster behind the standalone menu. */
export function prefetchArtBanks(_bank: ArtBank, _idle: () => boolean = () => true) {}

/** Bounded launch bank: identical upstream pixels for Spill and its established fallbacks. */
export async function loadArt(_eagerSuits: string[] = [], _eagerPals: string[] = []): Promise<ArtBank> {
  const bank = emptyArt();
  const base = artBase();
  const sprite = (path: string) => loadImg(artUrl(path)).then(asSprite).catch(() => null);
  async function named(ids: readonly string[], folder: string, extension = "png") {
    const out: Record<string, Sprite> = {};
    await Promise.all(ids.map(async id => {
      const image = await sprite(`${folder}/${id}.${extension}`);
      if (image) out[id] = image;
    }));
    return out;
  }
  await Promise.all([
    loadSpillCombat(bank),
    many(`${base}/squirrel/idle-`, 4).then(value => { bank.squirrelIdle = value; }),
    many(`${base}/squirrel/flap-`, 4).then(value => { bank.squirrelFlap = value; }),
    many(`${base}/acorn/`, 16).then(value => { bank.acorn = value; }),
    many(`${base}/golden/`, 16).then(value => { bank.golden = value; }),
    indexedSprites("debris", Array.from({ length: LEGACY_DEBRIS_COUNT }, (_, i) => i), DEBRIS_COUNT)
      .then(value => { bank.debris = value; }),
    named(["flight"], "suits").then(value => { bank.suits = value; }),
    named(["clear"], "helms").then(value => { bank.helms = value; }),
    named(["scout-ship"], "hyper-run").then(value => { bank.hyperRun = value; }),
    sprite("pickups/acorn-coin.svg").then(value => { bank.ore = value; }),
    Promise.all([named(SPILL_SHIP_IDS, "spill-ship"), named(SPILL_UTILITY_IDS, "spill-ship/utilities", "webp")])
      .then(([ship, utilities]) => { bank.spillShip = { ...ship, ...utilities }; }),
    fetch(artUrl("spill-ship/transforms.json"))
      .then(r => r.ok ? r.json() : null)
      .then(d => { bank.spillShipFit = d?.parts ? { parts: d.parts, overrides: d.overrides || {} } : null; })
      .catch(() => { /* Keep the original unfitted/scout fallback on a failed request. */ }),
    loadSuitBank(bank, "flight"),
  ]);
  bank.ready = true;
  return bank;
}
