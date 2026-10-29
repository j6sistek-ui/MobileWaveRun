import { spillDockTravelDuration } from "./spill";
import { clipHelmetGlass } from "./helmet-openings";
import { paintFittedHelmet } from "./helmet-fit";
import { paintVanguardDepot, vanguardDepotPose } from "./spill-depot-gag";
import { paintVanguard, paintVanguardShield, paintVanguardWake, paintVanguardContacts, vanguardPreview } from "./vanguard";
import { paintArcflash, paintArcflashWake, paintArcflashCockpit, paintArcflashBootWake, isArcflashRig, type ArcflashTravel } from "./arcflash";
import { arcflashPreview, type ArcflashMotion } from "./arcflash-motion";
import { paintLiveStarTrail } from "./star-trails";
import { trailWornBy } from "./catalog";
import {isHighOrbit,isHighOrbitRig,isPremiumSuit,isPremiumFrames,highOrbitTrailSuit,CUT_RIG_RETIRED,type HighOrbitId} from "./high-orbit-config";
import {paintHighOrbit,paintHighOrbitCockpit} from "./high-orbit";
import {highOrbitPreview,premiumWakePreview,type HighOrbitMotion} from "./high-orbit-motion";
import {paintPremiumBankWake,paintBootWake,type PremiumBankWake} from "./premium-bank-wake";
import {RIG3D_BOOTS} from "./rig3d-boots";
import {CYBER_TRIO_REGISTRATION} from "./cyber-trio-registration";
import {paintHighOrbitWake,type HighOrbitTravel} from "./high-orbit-effects";
import { runPals, fxOf, worldFlipped } from "./sim";
import { spillAppearance } from "./spill-appearance";
import { hasZoneRemaster, zonePainting, zoneVisual } from "./zone-visuals";
import { samplePlanetBackdrop, type PlanetHalo } from "./planet-contrast";
import {SKY_RGB, PLANET_RGB, BOUNCE_ANIM_DURATION, ENVS, HELMETS, IS_BETA, PHYS, SUITS, TAIL, TRAILS, TAP_ANIM_DURATION, helmetWornBy, skyIdFor, washScale, wearsOwnHead } from "./catalog";
import { goalHud } from "./campaign";
import { drawTrailPreviewOn, drawPalOn, drawAstronautOn, canDrawPal } from "./cosmetics";
import { proceduralSky, hueShifted } from "./sky-gen";
import { drawSprite, skyImage, spriteHalo, SPRITE_HALO_PAD, type ArtBank, type Sprite } from "./art";
import { spriteImageFor } from "./sprite-detail";
import { retroBackdrop, retroPlanet, retroObstacle, retroAcorn, retroBlocker } from "./retro";
import { suitPitchFor, tapShapeFor, tapAccentStrengthFor, type SaveData } from "./save";
import { blockerX, gateOffset, liveGapY, pilotSuitId, tiltNow, tunnelBoundsAt, WORM_TRIP_SECONDS, type Particle, type World } from "./sim";
import { WORM_EXIT_LEAD, suitLean, SUIT_LEAN_DEFAULT, PAINTED_TAP_EASE, type SuitLean, type TapShape } from "./control-constants";
import { raceViewport, raceViewportX, raceViewportY } from "./race-viewport";
import {
  SPILL,
  SPILL_MOD_INFO,
  spillHas, spillChargeCap, spillContractProgress, spillEventGap,
  spillCount,
  spillMod,
  spillRamp,
  spillWaveLeft,
  type SpillRock,
  type SpillState,
} from "./spill";
import { spillEngineColor } from "./spill-content";
import { drawSpillCombat, drawSpillCombatHud } from "./spill-combat-view";
import { SPILL_MODULE_MARKS, spillDockBear, spillDockView, spillPreviewState, type SpillBuild } from "./spill-presentation";
import {
  RACE_ACORNS,
  RACE_BASE_SPEED,
  RACE_DEBRIS,
  RACE_ENTRY_TICKS,
  RACE_GATE_CLEARANCE,
  RACE_GATE_MISS_FADE_TICKS,
  RACE_GATE_PASS_FADE_TICKS,
  RACE_HZ,
  RACE_LENGTH,
  RACE_MAX_INTERACTIVE_GAP,
  RACE_MAX_SPEED,
  RACE_PILOT_X,
  RACE_READY_COPY,
  RACE_RETURN_TICKS,
  RACE_RINGS,
  RACE_TUNNEL_PERFECT_APERTURE,
  RACE_TUNNEL_RING_APERTURE,
  RACE_TUNNEL_SPEED,
  RACE_TUNNEL_TICKS,
  formatRaceTicks,
  raceDecisionAge,
  raceRouteTarget,
  raceTunnelGeometry,
  raceTunnelQuality,
  raceTunnelRings,
} from "./race";

function frameOf<T>(list: T[], t: number, speed = 6) {
  if (!list.length) return null;
  return list[Math.floor(t * speed) % list.length];
}

function applyWarp(ctx: CanvasRenderingContext2D, w: World) {
  if (worldFlipped(w)) { ctx.translate(w.W,w.H); ctx.rotate(Math.PI); }
  const lost = w.flight === "lost";
  const wp = w.warpT > 0 ? 1 - w.warpT : w.warpLeft > 0 || w.warpGateEnd >= 0 || lost ? 1 : 0;
  if (wp <= 0) return;
  ctx.translate(w.W / 2, w.H / 2);
  const spin = w.warpT > 0 ? Math.sin(wp * Math.PI) * 2.6 : 0;
  // tiltNow is the settled lean, shared with the gate edge limit so the two
  // can never disagree; the fold's spin is this painter's own flourish
  ctx.rotate(tiltNow(w) + spin);
  const mFrom = w.prevMirror ? -1 : 1;
  const mTo = w.warpMirror ? -1 : 1;
  ctx.scale(mFrom + (mTo - mFrom) * wp, 1);
  ctx.translate(-w.W / 2, -w.H / 2);
}

function coverDraw(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | HTMLCanvasElement,
  W: number,
  H: number,
  pan = 0.5,
) {
  // a procedural sky is already composed for this exact canvas.
  // `pan` slides the visible window across whatever the cover-crop cannot
  // show: 0 = left/top edge, 1 = right/bottom edge, 0.5 = the old centre.
  const sw = (img as HTMLImageElement).naturalWidth || img.width;
  const sh = (img as HTMLImageElement).naturalHeight || img.height;
  const scale = Math.max(W / Math.max(1, sw), H / Math.max(1, sh));
  const dw = sw * scale;
  const dh = sh * scale;
  ctx.drawImage(img, (W - dw) * pan, (H - dh) * 0.5, dw, dh);
}

/** How bright the sky is right now, across an environment crossfade. */
export function skyLuma(w: World) {
  const lum = (id: keyof typeof SKY_RGB) => {
    const c = SKY_RGB[id] ?? [0.1, 0.1, 0.2];
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const a = lum(skyIdFor(w.flight, w.envA));
  const b = lum(skyIdFor(w.flight, w.envB));
  return a + (b - a) * w.envBlend;
}

// Rotate an [r,g,b,a] wash around the colour wheel, alpha untouched. The
// saturation lift matches the one the plate gets, so the wash and the sky
// under it land on the same new colour instead of two nearby ones.
function rotateRgb(c: number[], deg: number): number[] {
  const [r, g, bl] = c;
  const mx = Math.max(r, g, bl), mn = Math.min(r, g, bl);
  const d = mx - mn;
  let h = 0;
  if (d) {
    h = mx === r ? ((g - bl) / d) % 6 : mx === g ? (bl - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
  }
  const l = (mx + mn) / 2 / 255;
  const sNow = d === 0 ? 0 : d / 255 / (1 - Math.abs(2 * l - 1) || 1);
  const sat = Math.min(1, sNow * 1.75);
  h = (((h + deg) % 360) + 360) % 360;
  const cc = (1 - Math.abs(2 * l - 1)) * sat;
  const x = cc * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - cc / 2;
  const seg = Math.floor(h / 60) % 6;
  const t: number[][] = [[cc, x, 0], [x, cc, 0], [0, cc, x], [0, x, cc], [x, 0, cc], [cc, 0, x]];
  const [rr, gg, bb] = t[seg];
  return [(rr + m) * 255, (gg + m) * 255, (bb + m) * 255, c[3]];
}

function drawBackdrop(ctx: CanvasRenderingContext2D, w: World, art: ArtBank) {
  const { W, H } = w;
  // Each environment flies under its own sky; shifts crossfade. In the
  // BETA the ten normal-mode environments render PROCEDURALLY from their
  // recipes (sky-gen.ts) as the base layer, while
  // Deep and Lost's dark plates have no recipe and stay painted.
  // Deep and Lost fly under ONE wide painting in the beta, whatever the
  // orientation: landscape sees the full 16:9, portrait sees a window that
  // DRIFTS across it over the run, and a rotation only resizes the window
  // instead of swapping the art. The portrait dark plates stay shipped as
  // the live game's source and the beta's fallback while a wide file loads.
  const wideDark = w.flight === "deep" || w.flight === "lost";
  const idA = skyIdFor(w.flight, w.envA);
  const idB = skyIdFor(w.flight, w.envB);
  const procA = proceduralSky(idA, W, H);
  const procB = proceduralSky(idB, W, H);
  // PRISMWING repaints the PROCEDURAL plate and nothing else. A painted
  // sky is a photograph of a place and rotating its hue makes it look
  // broken, so those are left alone - which is also why the effect is
  // described as procedural-only rather than universal.
  const hue = w.prismHue || 0;
  const skyA = (hue && procA ? hueShifted(procA, idA, hue) : procA)
    ?? (wideDark ? skyImage(idA + "-wide") : null) ?? skyImage(idA);
  const skyB = (hue && procB ? hueShifted(procB, idB, hue) : procB)
    ?? (wideDark ? skyImage(idB + "-wide") : null) ?? skyImage(idB);
  // a slow triangle wave: out and back, never a snap
  const drift = (w.time * 0.012) % 2;
  const pan = wideDark ? 1 - Math.abs(1 - drift) : 0.5;
  const painted = skyB ?? skyA;
  if (painted) {
    coverDraw(ctx, skyA ?? painted, W, H, pan);
    if (skyB && skyA && skyB !== skyA && w.envBlend > 0) {
      ctx.globalAlpha = w.envBlend;
      coverDraw(ctx, skyB, W, H, pan);
      ctx.globalAlpha = 1;
    }
    // Readability scrim, scaled to how bright this sky is: a white
    // nebula gets a real veil so gates and debris stay readable against
    // it, a black void barely any. This is what stops the white-on-white
    // blindness without dulling the art everywhere.
    const lum = skyLuma(w);
    // A plate that is already void-dark needs almost no scrim — flooring
    // it at 0.16 only greys out the nebula it was chosen for.
    const floor = Math.min(0.16, lum * 0.8);
    const veil = Math.max(floor, Math.min(0.52, 0.16 + (lum - 0.2) * 0.62));
    ctx.fillStyle = `rgba(7,11,22,${veil.toFixed(3)})`;
    ctx.fillRect(0, 0, W, H);
  } else if (art.sky) {
    coverDraw(ctx, art.sky, W, H);
    ctx.fillStyle = "rgba(7,11,22,0.28)";
    ctx.fillRect(0, 0, W, H);
  } else {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#070b18");
    g.addColorStop(1, "#10182c");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  // The remaster is a painted depth layer over the existing procedural
  // plate. Prismwing can still color the procedural layer and its wash;
  // painted scenery, suits and planets never receive a hue filter.
  const sceneA = hasZoneRemaster(w.envA) ? zonePainting(w.envA) : null;
  const sceneB = hasZoneRemaster(w.envB) ? zonePainting(w.envB) : null;
  const drawScene = (image: HTMLImageElement | null, env: number, alpha: number) => {
    if (!image || alpha <= 0) return;
    ctx.save(); ctx.globalAlpha = alpha * .78;
    coverDraw(ctx, image, W, H, zoneVisual(env).pan);
    ctx.restore();
  };
  if (w.envA === w.envB) drawScene(sceneA, w.envA, 1);
  else { drawScene(sceneA, w.envA, 1 - w.envBlend); drawScene(sceneB, w.envB, w.envBlend); }

  const env = ENVS[w.envB];
  const envA = ENVS[w.envA];
  const blend = w.envBlend;
  const ws = washScale(w.flight);
  // PRISMWING again. The procedural plate carries the hue, but in flight
  // that plate sits under this colour wash and the readability scrim, and
  // those are what the eye actually reads - rotating the plate alone
  // measured as a 3-point shift in mean colour, which is why the owner
  // reported it as not working at all. The wash is backdrop, exactly like
  // the plate, so it turns with it. Planets and debris still do not.
  const spin = (c: number[]) => (w.prismHue ? rotateRgb(c, w.prismHue) : c);
  const wash = spin(env.wash.map((v, i) => (envA.wash[i] + (v - envA.wash[i]) * blend) * (i === 3 ? ws : 1)) as number[]);
  ctx.fillStyle = `rgba(${wash[0]},${wash[1]},${wash[2]},${wash[3]})`;
  ctx.beginPath();
  ctx.ellipse(W * 0.68, H * 0.28, W * 0.55, H * 0.28, 0.25, 0, Math.PI * 2);
  ctx.fill();
  const wash2 = spin(env.wash2.map((v, i) => (envA.wash2[i] + (v - envA.wash2[i]) * blend) * (i === 3 ? ws : 1)) as number[]);
  ctx.fillStyle = `rgba(${wash2[0]},${wash2[1]},${wash2[2]},${wash2[3]})`;
  ctx.beginPath();
  ctx.ellipse(W * 0.22, H * 0.78, W * 0.45, H * 0.22, -0.2, 0, Math.PI * 2);
  ctx.fill();
  // the environment owns the WHOLE sky, not two soft pools — a graded
  // full-screen tint makes each 20-gate shift unmistakable
  const grade = ctx.createLinearGradient(0, 0, 0, H);
  grade.addColorStop(0, `rgba(${wash[0]},${wash[1]},${wash[2]},${Math.min(0.42, wash[3] * 1.9)})`);
  grade.addColorStop(0.55, `rgba(${wash[0]},${wash[1]},${wash[2]},${Math.min(0.2, wash[3] * 0.9)})`);
  grade.addColorStop(1, `rgba(${wash2[0]},${wash2[1]},${wash2[2]},${Math.min(0.4, wash2[3] * 2.2)})`);
  ctx.fillStyle = grade;
  ctx.fillRect(0, 0, W, H);

  for (const s of w.stars) {
    ctx.globalAlpha = s.a * (0.55 + 0.45 * Math.sin(s.tw));
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

type RaceGateVisualState = "idle" | "passed" | "missed";

/** A gate may use its paintings only as registered back/front pairs. Resolved
 * gates also need the idle pair because both states share the crossfade. */
export function hyperRunGateUsesPaintedPairs(
  hyperRun: Readonly<Record<string, unknown>>,
  state: RaceGateVisualState,
) {
  const pairComplete = (pairState: RaceGateVisualState) =>
    !!hyperRun[`gate-${pairState}-back`] && !!hyperRun[`gate-${pairState}-front`];
  return pairComplete("idle") && (state === "idle" || pairComplete(state));
}

export const HYPER_RUN_GATE_FALLBACK_GEOMETRY = {
  shape: "full-ring",
  backStart: 0,
  backEnd: Math.PI * 2,
  frontStart: Math.PI * 0.2,
  frontEnd: Math.PI * 0.8,
} as const;

const raceClamp01 = (n: number) => Math.max(0, Math.min(1, n));
const raceSmooth = (n: number) => {
  const t = raceClamp01(n);
  return t * t * (3 - 2 * t);
};
const raceSegment = (tick: number, start: number, end: number) =>
  raceSmooth((tick - start) / Math.max(1, end - start));
const raceLerp = (a: number, b: number, t: number) => a + (b - a) * t;

export type HyperRunInlineWormholePhase = "entry" | "tunnel" | "return";

/** Pure presentation schedule for the portal-free inline wormhole. Keeping the
 * enclosure and crossfade contract here lets runtime evidence exercise the
 * exact values consumed by the shipping renderer. */
export function hyperRunInlineWormholePresentation(
  phase: HyperRunInlineWormholePhase,
  tick: number,
) {
  if (phase === "entry") return {
    enclosure: tick <= 11
      ? raceLerp(0, 0.08, raceSegment(tick, 0, 11))
      : tick <= 35
        ? raceLerp(0.08, 0.88, raceSegment(tick, 12, 35))
        : raceLerp(0.88, 1, raceSegment(tick, 36, RACE_ENTRY_TICKS - 1)),
    energyAlpha: raceSegment(tick, 0, 11),
    courseAlpha: 1 - raceSegment(tick, 20, RACE_ENTRY_TICKS - 1),
  };
  if (phase === "return") return {
    enclosure: tick <= 5 ? 1 : 1 - raceSegment(tick, 6, RACE_RETURN_TICKS - 1),
    energyAlpha: tick <= 11 ? 1 : 1 - raceSegment(tick, 12, RACE_RETURN_TICKS - 1),
    courseAlpha: raceSegment(tick, 6, 23),
  };
  return { enclosure: 1, energyAlpha: 1, courseAlpha: 0 };
}

/** Hyper Run ring paintings are registered to their complete square canvas.
 * Generic drawSprite deliberately alpha-fits other art; using it here would
 * independently enlarge and recenter the gate's small foreground arc. */
function drawRaceSprite(
  ctx: CanvasRenderingContext2D,
  art: ArtBank,
  id: string,
  x: number,
  y: number,
  size: number,
  tilt = 0,
  alpha = 1,
) {
  const sprite = art.hyperRun[id];
  if (!sprite) return false;
  if (alpha <= 0) return true;
  const sw = sprite.naturalWidth || sprite.width;
  const sh = sprite.naturalHeight || sprite.height;
  ctx.save();
  ctx.globalAlpha *= raceClamp01(alpha);
  ctx.translate(x, y);
  ctx.rotate(tilt);
  ctx.drawImage(sprite, 0, 0, sw, sh, -size / 2, -size / 2, size, size);
  ctx.restore();
  return true;
}

function drawRaceGateFallback(
  ctx: CanvasRenderingContext2D,
  state: RaceGateVisualState,
  layer: "back" | "front",
  x: number,
  y: number,
  size: number,
  tilt: number,
  alpha: number,
) {
  if (alpha <= 0) return;
  const palette = state === "passed"
    ? { rim: "#7fffd4", edge: "#fff0a5" }
    : state === "missed"
      ? { rim: "#a47a50", edge: "#79c9d7" }
      : { rim: "#65dcff", edge: "#b5a0ff" };
  const r = size * 0.422;
  ctx.save();
  ctx.globalAlpha *= raceClamp01(alpha);
  ctx.translate(x, y);
  ctx.rotate(tilt);
  ctx.lineCap = "round";
  if (layer === "back") {
    // A complete rear ring provides the structural silhouette. The pilot is
    // painted over it; only the small lower lip is restored in the front pass.
    ctx.strokeStyle = palette.rim;
    ctx.lineWidth = Math.max(2, size * 0.11);
    ctx.shadowColor = palette.rim;
    ctx.shadowBlur = size * 0.06;
    ctx.beginPath();
    ctx.arc(0, 0, r, HYPER_RUN_GATE_FALLBACK_GEOMETRY.backStart, HYPER_RUN_GATE_FALLBACK_GEOMETRY.backEnd);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = palette.edge;
    ctx.lineWidth = Math.max(1, size * 0.018);
    ctx.beginPath();
    ctx.arc(0, 0, r - size * 0.052, HYPER_RUN_GATE_FALLBACK_GEOMETRY.backStart, HYPER_RUN_GATE_FALLBACK_GEOMETRY.backEnd);
    ctx.stroke();
  } else {
    ctx.strokeStyle = palette.edge;
    ctx.lineWidth = Math.max(2, size * 0.115);
    ctx.shadowColor = palette.rim;
    ctx.shadowBlur = size * 0.075;
    ctx.beginPath();
    ctx.arc(0, 0, r, HYPER_RUN_GATE_FALLBACK_GEOMETRY.frontStart, HYPER_RUN_GATE_FALLBACK_GEOMETRY.frontEnd);
    ctx.stroke();
  }
  ctx.restore();
}

function drawRaceGateLayer(
  ctx: CanvasRenderingContext2D,
  art: ArtBank,
  state: RaceGateVisualState,
  layer: "back" | "front",
  x: number,
  y: number,
  size: number,
  tilt: number,
  alpha = 1,
  usePaintings = true,
) {
  if (usePaintings && drawRaceSprite(ctx, art, `gate-${state}-${layer}`, x, y, size, tilt, alpha)) return;
  drawRaceGateFallback(ctx, state, layer, x, y, size, tilt, alpha);
}

function raceGateVisual(race: NonNullable<World["race"]>, i: number) {
  const ledger = race.ringLedger[i];
  if (ledger === "skipped") return null;
  if (ledger !== "passed" && ledger !== "missed") {
    return { state: "idle" as const, blend: 1 };
  }
  const decisionTick = race.ringDecisionTicks[i];
  if (decisionTick == null) return { state: ledger, blend: 1 };
  // race.tick names the next pre-increment step after rendering. A decision
  // stamped during the just-completed step therefore has visual age zero.
  const age = raceDecisionAge(race.tick, decisionTick);
  const duration = ledger === "passed" ? RACE_GATE_PASS_FADE_TICKS : RACE_GATE_MISS_FADE_TICKS;
  return { state: ledger, blend: raceClamp01(age / duration) };
}

function drawRaceGateVisualLayer(
  ctx: CanvasRenderingContext2D,
  art: ArtBank,
  gate: { x: number; y: number; tilt: number; state: RaceGateVisualState; blend: number },
  layer: "back" | "front",
  size: number,
) {
  const usePaintings = hyperRunGateUsesPaintedPairs(art.hyperRun, gate.state);
  if (gate.state === "idle") {
    drawRaceGateLayer(ctx, art, "idle", layer, gate.x, gate.y, size, gate.tilt, 1, usePaintings);
    return;
  }
  if (gate.blend < 1) {
    drawRaceGateLayer(ctx, art, "idle", layer, gate.x, gate.y, size, gate.tilt, 1 - gate.blend, usePaintings);
  }
  if (gate.blend > 0) {
    drawRaceGateLayer(ctx, art, gate.state, layer, gate.x, gate.y, size, gate.tilt, gate.blend, usePaintings);
  }
}

type RaceFlowLayer = "far" | "mid" | "near";
type RaceReadabilityZone = Readonly<{ x: number; y: number; r: number }>;
export type HyperRunFlowSample = Readonly<{
  layer: RaceFlowLayer;
  x: number;
  sourceY: number;
  y: number;
  length: number;
  width: number;
  alpha: number;
  bend: number;
}>;
type MutableHyperRunFlowSample = {
  -readonly [K in keyof HyperRunFlowSample]: HyperRunFlowSample[K]
};
type HyperRunFlowArgs = Readonly<{
  seed: number;
  tick: number;
  coursePosition: number;
  speed: number;
  targetY: number | null;
  targetDistance: number;
  virtualWidth: number;
  reducedMotion?: boolean;
}>;
const raceFlowScratch: MutableHyperRunFlowSample[] = Array.from({ length: 48 }, () => ({
  layer: "far", x: 0, sourceY: 0, y: 0, length: 0, width: 0, alpha: 0, bend: 0,
}));

const raceMod = (n: number, d: number) => ((n % d) + d) % d;
const raceFlowHash = (seed: number, index: number, salt: number) => {
  let x = (seed ^ Math.imul(index + 1, 0x9e3779b1) ^ Math.imul(salt + 1, 0x85ebca6b)) >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d) >>> 0;
  x ^= x >>> 15;
  return (x >>> 0) / 0x100000000;
};

/** Pure deterministic presentation data. It is exported so cadence and replay
 * tests can prove that rendering never consumes randomness or wall-clock time. */
function writeHyperRunFlow(args: HyperRunFlowArgs, samples: MutableHyperRunFlowSample[]) {
  const reduced = !!args.reducedMotion;
  const replaceWithTangents = !reduced && args.targetY != null && args.targetDistance <= RACE_MAX_INTERACTIVE_GAP ? 6 : 0;
  const counts: Readonly<Record<RaceFlowLayer, number>> = reduced
    ? { far: 12, mid: 8, near: 3 }
    : { far: 24, mid: 16 - replaceWithTangents, near: 8 };
  const speedMix = raceClamp01((args.speed - RACE_BASE_SPEED) / Math.max(1, RACE_MAX_SPEED - RACE_BASE_SPEED));
  const span = Math.max(1, args.virtualWidth + 160);
  let cursor = 0;
  (["far", "mid", "near"] as const).forEach((layer, layerIndex) => {
    const parallax = layer === "far" ? 0.18 : layer === "mid" ? 0.48 : 0.82;
    const bend = layer === "mid" && !reduced && args.targetY != null && args.targetDistance <= RACE_MAX_INTERACTIVE_GAP
      ? raceLerp(0.15, 0.25, raceClamp01(1 - args.targetDistance / RACE_MAX_INTERACTIVE_GAP))
      : 0;
    for (let i = 0; i < counts[layer]; i++) {
      const xSeed = raceFlowHash(args.seed, i, 10 + layerIndex);
      const ySeed = raceFlowHash(args.seed, i, 20 + layerIndex);
      const lengthSeed = raceFlowHash(args.seed, i, 30 + layerIndex);
      const baseY = 36 + ySeed * 568 + Math.sin((args.tick + i * 17) * 0.035) * (reduced ? 0 : 2.2);
      const targetY = args.targetY ?? baseY;
      const baseLength = layer === "far" ? 8 : layer === "mid" ? 18 : 12;
      const sample = samples[cursor] ?? (samples[cursor] = {
        layer, x: 0, sourceY: 0, y: 0, length: 0, width: 0, alpha: 0, bend: 0,
      });
      sample.layer = layer;
      sample.x = -80 + raceMod(xSeed * span - args.coursePosition * parallax, span);
      sample.sourceY = baseY;
      sample.y = raceLerp(baseY, targetY, bend);
      sample.length = baseLength + speedMix * (layer === "mid" ? 34 : 20) + lengthSeed * 9;
      sample.width = layer === "far" ? 0.8 : layer === "mid" ? 1.25 : 1.5;
      sample.alpha = layer === "far" ? 0.34 : layer === "mid" ? 0.42 : 0.32;
      sample.bend = bend;
      cursor++;
    }
  });
  samples.length = cursor;
  return samples;
}

function raceReducedMotion() {
  return typeof window !== "undefined"
    && typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function racePointSegmentDistance(
  px: number, py: number,
  x1: number, y1: number,
  x2: number, y2: number,
) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const l2 = dx * dx + dy * dy;
  if (l2 <= 1e-9) return Math.hypot(px - x1, py - y1);
  const t = raceClamp01(((px - x1) * dx + (py - y1) * dy) / l2);
  return Math.hypot(px - (x1 + dx * t), py - (y1 + dy * t));
}

function drawRaceFlow(
  ctx: CanvasRenderingContext2D,
  viewport: ReturnType<typeof raceViewport>,
  samples: readonly HyperRunFlowSample[],
  layer: RaceFlowLayer,
  zones: readonly RaceReadabilityZone[],
) {
  const { scale, left, top } = viewport;
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.lineCap = "round";
  for (const sample of samples) {
    if (sample.layer !== layer) continue;
    const x1 = left + sample.x * scale;
    const x2 = x1 + sample.length * scale;
    const y1 = top + sample.y * scale;
    const y2 = top + sample.sourceY * scale;
    const guarded = zones.some((zone) => racePointSegmentDistance(zone.x, zone.y, x1, y1, x2, y2) < zone.r + 18 * scale);
    if (layer === "near" && guarded) continue;
    ctx.globalAlpha = guarded ? sample.alpha * 0.18 : sample.alpha;
    ctx.strokeStyle = layer === "far" ? "#b8d7ff" : layer === "mid" ? "#50d2ff" : "#d2f2ff";
    ctx.lineWidth = Math.max(0.65, sample.width * scale);
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    if (sample.bend > 0) {
      ctx.quadraticCurveTo(raceLerp(x2, x1, 0.55), raceLerp(y2, y1, 0.55), x1, y1);
    } else {
      ctx.lineTo(x1, y1);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawRacePendingMembrane(
  ctx: CanvasRenderingContext2D,
  viewport: ReturnType<typeof raceViewport>,
  x: number,
  y: number,
  layer: "back" | "front",
) {
  const r = RACE_GATE_CLEARANCE * viewport.scale;
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  if (layer === "back") {
    const lens = ctx.createRadialGradient(x - r * 0.18, y - r * 0.22, r * 0.08, x, y, r);
    lens.addColorStop(0, "rgba(210,250,255,.18)");
    lens.addColorStop(0.68, "rgba(49,181,255,.09)");
    lens.addColorStop(1, "rgba(19,126,255,0)");
    ctx.fillStyle = lens;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.strokeStyle = layer === "back" ? "rgba(112,221,255,.52)" : "rgba(190,247,255,.8)";
  ctx.lineWidth = Math.max(1, (layer === "back" ? 1.25 : 1.8) * viewport.scale);
  ctx.shadowColor = "rgba(48,194,255,.72)";
  ctx.shadowBlur = layer === "front" ? 5 * viewport.scale : 0;
  ctx.beginPath();
  ctx.arc(x, y, r, layer === "back" ? Math.PI : 0, layer === "back" ? Math.PI * 2 : Math.PI);
  ctx.stroke();
  ctx.restore();
}

function drawRaceDecisionCue(
  ctx: CanvasRenderingContext2D,
  viewport: ReturnType<typeof raceViewport>,
  state: "passed" | "missed",
  age: number,
  canonicalY: number,
  layer: "back" | "front",
) {
  const { scale, pilotX } = viewport;
  const y = raceViewportY(viewport, canonicalY);
  if (state === "passed") {
    if (age > 26) return;
    const drift = age < 10 ? 0 : raceLerp(0, 24, raceClamp01((age - 10) / 8));
    const x = pilotX - drift * scale;
    const expansion = age <= 2 ? 0.58 : age <= 9 ? raceLerp(0.7, 1.1, (age - 3) / 6) : 1.12;
    const fade = age < 19 ? 1 : 1 - (age - 19) / 7;
    const r = 60 * scale * expansion;
    ctx.save();
    ctx.globalAlpha *= raceClamp01(fade);
    ctx.globalCompositeOperation = "screen";
    ctx.strokeStyle = age <= 2 ? "rgba(235,255,255,.98)" : "rgba(52,202,255,.78)";
    ctx.lineWidth = (age <= 2 ? 4 : 2.2) * scale;
    ctx.shadowColor = "#2cc9ff";
    ctx.shadowBlur = 9 * scale;
    ctx.beginPath();
    ctx.arc(x, y, r, layer === "back" ? Math.PI : 0, layer === "back" ? Math.PI * 2 : Math.PI);
    ctx.stroke();
    if (layer === "front" && age >= 10 && age <= 18) {
      ctx.shadowBlur = 0;
      ctx.lineWidth = 2 * scale;
      for (const dy of [-11, 11]) {
        ctx.beginPath();
        ctx.moveTo(x - r - 8 * scale, y + dy * scale);
        ctx.lineTo(x - r - 18 * scale, y + dy * scale);
        ctx.lineTo(x - r - 13 * scale, y + (dy - 5) * scale);
        ctx.stroke();
      }
    }
    ctx.restore();
    return;
  }
  if (age > 26) return;
  const fade = age < 19 ? 1 : 1 - raceClamp01((age - 19) / 7);
  const r = RACE_GATE_CLEARANCE * scale * raceLerp(1, 0.72, raceClamp01(age / 18));
  const contract = raceSegment(age, 3, 12);
  const notchX = raceLerp(8, 4, contract) * scale;
  const notchY = raceLerp(24, 15, contract) * scale;
  ctx.save();
  ctx.globalAlpha *= fade;
  ctx.strokeStyle = layer === "back" ? "rgba(93,139,161,.6)" : "rgba(210,166,116,.86)";
  ctx.lineWidth = 2 * scale;
  ctx.beginPath();
  ctx.arc(pilotX, y, r, layer === "back" ? Math.PI : 0.08, layer === "back" ? Math.PI * 1.72 : Math.PI * 0.82);
  ctx.stroke();
  if (layer === "front") {
    ctx.beginPath();
    ctx.moveTo(pilotX - notchX, y - notchY);
    ctx.lineTo(pilotX + 3 * scale, y - 7 * scale);
    ctx.lineTo(pilotX - 4 * scale, y + 6 * scale);
    ctx.lineTo(pilotX + notchX, y + notchY);
    ctx.stroke();
  }
  ctx.restore();
}

function drawRaceDirector(
  ctx: CanvasRenderingContext2D,
  viewport: ReturnType<typeof raceViewport>,
  pilotY: number,
  targetY: number,
  distance: number,
) {
  if (distance <= 160) return;
  const alpha = raceSmooth((distance - 160) / 80);
  const x = viewport.right - 18;
  const y = Math.max(viewport.top + 36, Math.min(viewport.bottom - 36, raceViewportY(viewport, targetY)));
  const delta = targetY - pilotY;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y);
  ctx.lineJoin = "round";
  ctx.lineWidth = 5;
  ctx.strokeStyle = "rgba(2,8,18,.92)";
  ctx.fillStyle = "#a9f5ff";
  ctx.beginPath();
  if (Math.abs(delta) <= 24) {
    ctx.moveTo(0, -7); ctx.lineTo(7, 0); ctx.lineTo(0, 7); ctx.lineTo(-7, 0); ctx.closePath();
  } else if (delta < 0) {
    ctx.moveTo(0, -9); ctx.lineTo(8, 6); ctx.lineTo(-8, 6); ctx.closePath();
  } else {
    ctx.moveTo(0, 9); ctx.lineTo(8, -6); ctx.lineTo(-8, -6); ctx.closePath();
  }
  ctx.stroke(); ctx.fill();
  ctx.strokeStyle = "rgba(38,194,255,.95)";
  ctx.lineWidth = 2;
  ctx.stroke();
  if (Math.abs(delta) > 24) {
    const direction = delta < 0 ? 1 : -1;
    const stem = Math.min(18, 6 + Math.abs(delta) / 32);
    ctx.beginPath();
    ctx.moveTo(0, direction * 8);
    ctx.lineTo(0, direction * (8 + stem));
    ctx.stroke();
  }
  ctx.restore();
}

const raceTunnelTopScratch: number[] = [];
const raceTunnelBottomScratch: number[] = [];

export function hyperRunTunnelSampleCount(virtualWidth: number) {
  // Thirty segments put both canonical pilot X (96/360 = 8/30) and the
  // panoramic 20% pilot plane (6/30) on an authored boundary vertex.
  return Math.max(30, Math.ceil(Math.max(0, virtualWidth) / 48 / 30) * 30);
}

type HyperRunTunnelRingOutcome = "pending" | "passed" | "perfect" | "missed";
type HyperRunTunnelRingLayer = "back" | "front";

/** The shipping projection used by both ring layers. Presentation sees the
 * post-step phase tick, so the +1 keeps the pending ring one step ahead and
 * places its resolved result on the pilot plane after authority judges it.
 * Keeping this pure lets the runtime review prove the crossing at every
 * approved viewport. */
export function hyperRunTunnelRingScreenX(
  viewport: ReturnType<typeof raceViewport>,
  ringTick: number,
  viewTick: number,
) {
  return viewport.pilotX
    + (ringTick + 1 - viewTick) * (RACE_TUNNEL_SPEED / RACE_HZ) * viewport.scale;
}

function drawHyperRunTunnelRingPath(
  ctx: CanvasRenderingContext2D,
  radius: number,
  layer: HyperRunTunnelRingLayer,
) {
  ctx.beginPath();
  if (layer === "back") ctx.arc(0, 0, radius, 0, Math.PI * 2);
  else ctx.arc(0, 0, radius, Math.PI * 0.2, Math.PI * 0.8);
}

function drawHyperRunTunnelRing(
  ctx: CanvasRenderingContext2D,
  viewport: ReturnType<typeof raceViewport>,
  x: number,
  canonicalY: number,
  outcome: HyperRunTunnelRingOutcome,
  age: number,
  layer: HyperRunTunnelRingLayer,
) {
  if (age > 27) return;
  const { scale } = viewport;
  const y = raceViewportY(viewport, canonicalY);
  const reduced = raceReducedMotion();
  const fade = outcome === "pending" || age <= 17
    ? 1
    : 1 - raceSegment(age, 18, 27);
  const outerRadius = RACE_TUNNEL_RING_APERTURE * scale;
  const innerRadius = RACE_TUNNEL_PERFECT_APERTURE * scale;
  const outerWidth = Math.max(1.8, 3.2 * scale);
  const innerWidth = Math.max(1.35, 2.15 * scale);
  const perfect = outcome === "perfect";
  const passed = outcome === "passed";
  const missed = outcome === "missed";

  ctx.save();
  ctx.globalAlpha *= raceClamp01(fade * (missed ? 0.68 : 1));
  ctx.translate(x, y);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (missed) ctx.setLineDash([Math.max(3, 7 * scale), Math.max(3, 7 * scale)]);

  // A neutral dark keyline is deliberately painted first. It keeps the white
  // geometry readable over pale stars without turning outcome into colour.
  ctx.globalCompositeOperation = "source-over";
  ctx.strokeStyle = "rgba(2,5,13,.82)";
  ctx.lineWidth = outerWidth + Math.max(2.4, 4.2 * scale);
  drawHyperRunTunnelRingPath(ctx, outerRadius, layer); ctx.stroke();
  ctx.lineWidth = innerWidth + Math.max(2, 3.4 * scale);
  drawHyperRunTunnelRingPath(ctx, innerRadius, layer); ctx.stroke();

  ctx.globalCompositeOperation = "source-over";
  ctx.strokeStyle = missed ? "rgba(255,255,255,.7)" : "#fff";
  ctx.lineWidth = outerWidth;
  ctx.shadowColor = "#fff";
  ctx.shadowBlur = reduced ? 0 : (perfect ? 13 : outcome === "pending" ? 5 : 8) * scale;
  drawHyperRunTunnelRingPath(ctx, outerRadius, layer); ctx.stroke();

  ctx.strokeStyle = passed
    ? "rgba(255,255,255,.62)"
    : missed ? "rgba(255,255,255,.58)" : "#fff";
  ctx.lineWidth = innerWidth;
  drawHyperRunTunnelRingPath(ctx, innerRadius, layer); ctx.stroke();
  ctx.setLineDash([]);

  if (layer === "front" && perfect && age <= 16) {
    const reach = outerRadius + (7 + raceSmooth(age / 16) * 7) * scale;
    ctx.strokeStyle = `rgba(255,255,255,${(0.92 * (1 - age / 17)).toFixed(3)})`;
    ctx.lineWidth = Math.max(1.2, 2 * scale);
    ctx.shadowBlur = reduced ? 0 : 9 * scale;
    for (let arm = 0; arm < 4; arm++) {
      const a = arm * Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * (outerRadius + 3 * scale), Math.sin(a) * (outerRadius + 3 * scale));
      ctx.lineTo(Math.cos(a) * reach, Math.sin(a) * reach);
      ctx.stroke();
    }
  } else if (layer === "front" && missed && age <= 16) {
    const r = innerRadius * 0.62;
    ctx.strokeStyle = `rgba(255,255,255,${(0.72 * (1 - age / 17)).toFixed(3)})`;
    ctx.lineWidth = Math.max(1.2, 2 * scale);
    for (const direction of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(-r, direction * -r); ctx.lineTo(r, direction * r); ctx.stroke();
    }
  }
  ctx.restore();

  if (layer === "front" && outcome !== "pending" && age <= 24) {
    const label = perfect ? "PERFECT · EXIT BOOST" : passed ? "CLEAR" : "MISS";
    const labelFade = age <= 14 ? 1 : 1 - raceSegment(age, 15, 24);
    const labelY = Math.max(viewport.top + 18,
      Math.min(viewport.bottom - 8, y - outerRadius - 11 * scale));
    ctx.save();
    ctx.globalAlpha *= labelFade;
    ctx.textAlign = "center";
    ctx.font = `900 ${Math.max(9, 11 * scale)}px Figtree, system-ui`;
    ctx.lineWidth = Math.max(2, 3 * scale);
    ctx.strokeStyle = "rgba(2,5,13,.9)";
    ctx.strokeText(label, x, labelY);
    ctx.fillStyle = missed ? "rgba(255,255,255,.72)" : "#fff";
    ctx.fillText(label, x, labelY);
    ctx.restore();
  }
}

function drawHyperRunTunnelRingLayer(
  ctx: CanvasRenderingContext2D,
  w: World,
  viewTick: number,
  layer: HyperRunTunnelRingLayer,
) {
  const race = w.race!;
  const viewport = raceViewport(w.W, w.H);
  const rings = raceTunnelRings(race);
  const ledger = race.tunnelRingLedger[race.wormholes] ?? [];
  const decisions = race.tunnelRingDecisionTicks[race.wormholes] ?? [];
  const pad = (RACE_TUNNEL_RING_APERTURE + 22) * viewport.scale;
  for (let i = 0; i < rings.length; i++) {
    const ring = rings[i];
    const outcome = (ledger[i] ?? "pending") as HyperRunTunnelRingOutcome;
    const decisionTick = decisions[i];
    const age = outcome === "pending" || decisionTick == null
      ? 0
      : raceDecisionAge(race.tick, decisionTick);
    if (outcome !== "pending" && age > 27) continue;
    // Pending gates travel by phase tick. A resolved gate is held on the pilot
    // plane for its age-zero frame, then drifts left as feedback. This preserves
    // the exact crossing read despite the fixed-step authority increment.
    const x = outcome === "pending"
      ? hyperRunTunnelRingScreenX(viewport, ring.tick, viewTick)
      : viewport.pilotX - age * (RACE_TUNNEL_SPEED / RACE_HZ) * viewport.scale;
    if (x < viewport.left - pad || x > viewport.right + pad) continue;
    drawHyperRunTunnelRing(ctx, viewport, x, ring.y, outcome, age, layer);
  }
}

function drawHyperRunTunnelDirector(ctx: CanvasRenderingContext2D, w: World, viewTick: number) {
  const race = w.race!;
  const viewport = raceViewport(w.W, w.H);
  const rings = raceTunnelRings(race);
  const ledger = race.tunnelRingLedger[race.wormholes] ?? [];
  const nextIndex = rings.findIndex((ring, i) => (ledger[i] ?? "pending") === "pending" && ring.tick >= viewTick);
  if (nextIndex < 0) return;
  const ring = rings[nextIndex];
  const ringX = hyperRunTunnelRingScreenX(viewport, ring.tick, viewTick);
  if (ringX <= viewport.right - RACE_TUNNEL_RING_APERTURE * viewport.scale) return;
  const x = viewport.right - Math.max(12, 16 * viewport.scale);
  const y = Math.max(viewport.top + 28, Math.min(viewport.bottom - 28, raceViewportY(viewport, ring.y)));
  const r = Math.max(5, 7 * viewport.scale);
  ctx.save();
  ctx.translate(x, y);
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(4, 6 * viewport.scale);
  ctx.strokeStyle = "rgba(2,5,13,.9)";
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-r - 6 * viewport.scale, -r); ctx.lineTo(-r, 0); ctx.lineTo(-r - 6 * viewport.scale, r); ctx.stroke();
  ctx.lineWidth = Math.max(1.4, 2.1 * viewport.scale);
  ctx.strokeStyle = "rgba(255,255,255,.96)";
  ctx.shadowColor = "#fff"; ctx.shadowBlur = raceReducedMotion() ? 0 : 5 * viewport.scale;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-r - 6 * viewport.scale, -r); ctx.lineTo(-r, 0); ctx.lineTo(-r - 6 * viewport.scale, r); ctx.stroke();
  ctx.restore();
}

function drawHyperRunTunnelDragCue(ctx: CanvasRenderingContext2D, w: World) {
  const race = w.race!;
  const localTick = race.phase === "entry" ? Math.max(0, race.phaseTick - 12) : race.phaseTick + 36;
  if (race.phase !== "entry" && race.phase !== "tunnel") return;
  const tutorialFade = race.wormholes === 0
    ? localTick <= 72 ? 1 : 1 - raceSegment(localTick, 73, 96)
    : 0;
  // Keep a restrained target pipper alive whenever a drag is owned. The
  // slower follower then reads as deliberate steering rather than lag.
  const activeTarget = race.phase === "tunnel" && race.tunnelDragY != null;
  const fade = Math.max(tutorialFade, activeTarget ? 0.72 : 0);
  if (fade <= 0) return;
  const viewport = raceViewport(w.W, w.H);
  const pilotY = raceViewportY(viewport, race.y);
  const targetY = race.tunnelDragY == null ? pilotY : raceViewportY(viewport, race.tunnelDragY);
  const x = Math.min(viewport.right - 54 * viewport.scale, viewport.pilotX + 66 * viewport.scale);
  const railTop = Math.max(viewport.top + 26, Math.min(pilotY, targetY) - 42 * viewport.scale);
  const railBottom = Math.min(viewport.bottom - 26, Math.max(pilotY, targetY) + 42 * viewport.scale);
  const dotY = Math.max(railTop, Math.min(railBottom, targetY));
  ctx.save();
  ctx.globalAlpha *= raceClamp01(fade * 0.88);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(2,5,13,.88)";
  ctx.lineWidth = Math.max(4, 6 * viewport.scale);
  ctx.beginPath(); ctx.moveTo(x, railTop); ctx.lineTo(x, railBottom); ctx.stroke();
  ctx.lineWidth = Math.max(1.3, 2 * viewport.scale);
  ctx.strokeStyle = "rgba(255,255,255,.9)";
  ctx.beginPath(); ctx.moveTo(x, railTop); ctx.lineTo(x, railBottom); ctx.stroke();
  for (const [y, direction] of [[railTop, 1], [railBottom, -1]] as const) {
    ctx.beginPath();
    ctx.moveTo(x - 5 * viewport.scale, y + direction * 7 * viewport.scale);
    ctx.lineTo(x, y); ctx.lineTo(x + 5 * viewport.scale, y + direction * 7 * viewport.scale);
    ctx.stroke();
  }
  if (race.tunnelDragY != null) {
    ctx.globalAlpha *= 0.7;
    ctx.setLineDash([3 * viewport.scale, 5 * viewport.scale]);
    ctx.beginPath(); ctx.moveTo(viewport.pilotX + 22 * viewport.scale, pilotY); ctx.lineTo(x, dotY); ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.fillStyle = "#fff";
  ctx.beginPath(); ctx.arc(x, dotY, Math.max(2.5, 3.5 * viewport.scale), 0, Math.PI * 2); ctx.fill();
  if (activeTarget) {
    const pipper = Math.max(6, 8 * viewport.scale);
    ctx.strokeStyle = "rgba(169,245,255,.92)";
    ctx.lineWidth = Math.max(1, 1.4 * viewport.scale);
    ctx.beginPath(); ctx.arc(x, dotY, pipper, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - pipper - 4 * viewport.scale, dotY); ctx.lineTo(x - pipper / 2, dotY);
    ctx.moveTo(x + pipper / 2, dotY); ctx.lineTo(x + pipper + 4 * viewport.scale, dotY);
    ctx.moveTo(x, dotY - pipper - 4 * viewport.scale); ctx.lineTo(x, dotY - pipper / 2);
    ctx.moveTo(x, dotY + pipper / 2); ctx.lineTo(x, dotY + pipper + 4 * viewport.scale);
    ctx.stroke();
  }
  if (tutorialFade > 0) {
    ctx.textAlign = "left";
    ctx.font = `900 ${Math.max(8, 9 * viewport.scale)}px Figtree, system-ui`;
    const labelX = Math.min(viewport.right - 102, x + 10 * viewport.scale);
    const labelY = Math.max(viewport.top + 20, Math.min(viewport.bottom - 22, dotY));
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(2,5,13,.9)";
    for (const [text, y] of [["DRAG TO ALIGN", labelY], ["CENTER = FASTER EXIT", labelY + 13]] as const) {
      ctx.strokeText(text, labelX, y);
      ctx.fillText(text, labelX, y);
    }
  }
  ctx.restore();
}

function drawRaceTunnel(
  ctx: CanvasRenderingContext2D,
  w: World,
  viewTick = w.race!.phaseTick,
  enclosure = 1,
) {
  const race = w.race!;
  const viewport = raceViewport(w.W, w.H);
  const { scale, left, right, top, bottom, contentWidth, contentHeight, pilotX } = viewport;
  const reduced = raceReducedMotion();
  const visualTick = race.tick;
  const samples = hyperRunTunnelSampleCount(viewport.virtualWidth);
  raceTunnelTopScratch.length = samples + 1;
  raceTunnelBottomScratch.length = samples + 1;
  const enclosureMix = raceSmooth(enclosure);
  const structureFactor = raceSmooth(raceClamp01((enclosure - 0.2) / 0.8));
  for (let i = 0; i <= samples; i++) {
    const x = left + contentWidth * (i / samples);
    const distance = (x - pilotX) / Math.max(0.001, scale);
    const lookTicks = distance / Math.max(0.001, RACE_TUNNEL_SPEED / RACE_HZ);
    const sampleTick = Math.max(0, Math.min(RACE_TUNNEL_TICKS - 1, viewTick + lookTicks));
    const tunnel = raceTunnelGeometry(race, sampleTick);
    const center = tunnel.center;
    const liveTop = raceViewportY(viewport, center - tunnel.half);
    const liveBottom = raceViewportY(viewport, center + tunnel.half);
    // Entry and return never reveal a second scene. The same energy banks begin
    // at the screen edges, close onto the authority corridor, then reopen.
    raceTunnelTopScratch[i] = raceLerp(top, liveTop, enclosureMix);
    raceTunnelBottomScratch[i] = raceLerp(bottom, liveBottom, enclosureMix);
  }

  const corridorPath = () => {
    ctx.beginPath();
    for (let i = 0; i <= samples; i++) {
      const x = left + contentWidth * (i / samples);
      if (i) ctx.lineTo(x, raceTunnelTopScratch[i]);
      else ctx.moveTo(x, raceTunnelTopScratch[i]);
    }
    for (let i = samples; i >= 0; i--) {
      ctx.lineTo(left + contentWidth * (i / samples), raceTunnelBottomScratch[i]);
    }
    ctx.closePath();
  };
  const traceBoundary = (line: readonly number[], offset = 0, strand = 0) => {
    ctx.beginPath();
    for (let i = 0; i <= samples; i++) {
      const x = left + contentWidth * (i / samples);
      const wave = reduced ? 0 : Math.sin(i * 0.68 + visualTick * 0.11 + strand * 1.7) * (1.2 + strand * 0.7) * scale;
      const y = line[i] + offset + wave;
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
  };
  const traceBankBeam = (line: readonly number[], edge: number, depth: number, strand: number) => {
    ctx.beginPath();
    for (let i = 0; i <= samples; i++) {
      const x = left + contentWidth * (i / samples);
      const wave = reduced ? 0 : Math.sin(i * 0.52 + visualTick * 0.09 + strand * 1.9)
        * (1.2 + strand * 0.45) * scale;
      const y = raceLerp(edge, line[i], depth) + wave;
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
  };

  // The same course sky remains visible throughout the shortcut. Plasma adds
  // colour and depth, but never replaces the scene with an opaque dark plate.
  const wash = ctx.createLinearGradient(left, top, right, bottom);
  wash.addColorStop(0, "rgba(48,18,104,.12)");
  wash.addColorStop(0.42, "rgba(104,36,174,.18)");
  wash.addColorStop(0.72, "rgba(30,112,190,.15)");
  wash.addColorStop(1, "rgba(12,214,236,.10)");
  ctx.fillStyle = wash;
  ctx.fillRect(left, top, contentWidth, contentHeight);

  // Outside the playable route is a translucent energy bank, not darkness.
  // The live collision boundary below remains substantially brighter than it.
  ctx.fillStyle = "rgba(25,7,55,.18)";
  ctx.beginPath();
  ctx.moveTo(left, top); ctx.lineTo(right, top);
  for (let i = samples; i >= 0; i--) ctx.lineTo(left + contentWidth * (i / samples), raceTunnelTopScratch[i]);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = "rgba(5,27,61,.17)";
  ctx.beginPath();
  ctx.moveTo(left, bottom); ctx.lineTo(right, bottom);
  for (let i = samples; i >= 0; i--) ctx.lineTo(left + contentWidth * (i / samples), raceTunnelBottomScratch[i]);
  ctx.closePath(); ctx.fill();

  // Parallel beams make the enclosure itself readable: they originate on the
  // existing screen boundaries and sweep inward with the closing energy banks.
  // No radial mouth or portal is involved.
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.lineCap = "round";
  const bankBeamCount = reduced ? 2 : 5;
  for (const [line, edge] of [
    [raceTunnelTopScratch, top], [raceTunnelBottomScratch, bottom],
  ] as const) {
    for (let strand = 0; strand < bankBeamCount; strand++) {
      const depth = (strand + 1) / (bankBeamCount + 1);
      ctx.strokeStyle = strand % 2
        ? "rgba(91,225,255,.18)"
        : "rgba(190,92,255,.22)";
      ctx.lineWidth = Math.max(0.7, (0.9 + strand * 0.32) * scale);
      traceBankBeam(line, edge, depth, strand);
      ctx.stroke();
    }
  }
  ctx.restore();

  ctx.save();
  corridorPath();
  ctx.clip();
  const corridor = ctx.createLinearGradient(left, top, right, bottom);
  corridor.addColorStop(0, "rgba(76,39,176,.12)");
  corridor.addColorStop(0.52, "rgba(37,104,196,.14)");
  corridor.addColorStop(1, "rgba(64,232,255,.10)");
  ctx.fillStyle = corridor;
  ctx.fillRect(left, top, contentWidth, contentHeight);
  ctx.globalCompositeOperation = "screen";
  ctx.lineCap = "round";

  // Long, layered future-to-past streaks make the 562.5-unit shortcut read
  // materially faster than normal flight without introducing a vanishing point.
  const streakCount = reduced ? 14 : 38;
  for (let i = 0; i < streakCount; i++) {
    const span = contentWidth + 260 * scale;
    const travel = reduced ? 0 : visualTick * (11 + i % 5) * scale;
    const x = left - 130 * scale + raceMod(raceFlowHash(race.seed, i, 62) * span - travel, span);
    const index = Math.max(0, Math.min(samples, Math.round((x - left) / Math.max(1, contentWidth) * samples)));
    const lane = 0.08 + raceFlowHash(race.seed, i, 61) * 0.84;
    const y = raceLerp(raceTunnelTopScratch[index], raceTunnelBottomScratch[index], lane);
    const length = (reduced ? 14 + (i % 4) * 3 : 48 + (i % 7) * 14) * scale;
    ctx.strokeStyle = i % 5 === 0
      ? "rgba(229,184,255,.55)"
      : i % 3 === 0
        ? "rgba(128,91,255,.46)"
        : "rgba(91,226,255,.43)";
    ctx.lineWidth = Math.max(0.7, (0.8 + (i % 3) * 0.55) * scale);
    ctx.beginPath(); ctx.moveTo(x + length, y); ctx.lineTo(x, y); ctx.stroke();
  }

  // Transverse bands are sampled directly from the authority corridor. Their
  // lateral cadence provides Wormhole Run depth while keeping the camera side-on.
  // They resolve only after the edge beams have begun closing; early formation
  // remains loose filaments and speed streaks instead of a tunnel popping in.
  ctx.globalAlpha *= structureFactor;
  const bandCount = reduced ? 5 : 11;
  ctx.setLineDash([3 * scale, 8 * scale]);
  for (let i = 0; i < bandCount; i++) {
    const u = reduced ? (i + 0.5) / bandCount : raceMod((i + 0.5) / bandCount - visualTick * 0.018, 1);
    const index = Math.min(samples, Math.max(0, Math.round(u * samples)));
    const x = left + contentWidth * (index / samples);
    const ty = raceTunnelTopScratch[index];
    const by = raceTunnelBottomScratch[index];
    const bow = reduced ? 0 : Math.sin((visualTick + i * 13) * 0.08) * 9 * scale;
    ctx.strokeStyle = i % 2 ? "rgba(156,96,255,.20)" : "rgba(83,222,255,.24)";
    ctx.lineWidth = Math.max(0.7, 1.1 * scale);
    ctx.beginPath();
    ctx.moveTo(x, ty + 3 * scale);
    ctx.quadraticCurveTo(x - 10 * scale + bow, (ty + by) * 0.5, x, by - 3 * scale);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // A restrained center guide turns the corridor into a readable route rather
  // than a texture. It is decorative only and never feeds collision authority.
  const guideCount = reduced ? 5 : 9;
  for (let i = 0; i < guideCount; i++) {
    const u = reduced ? (i + 0.5) / guideCount : raceMod((i + 0.5) / guideCount - visualTick * 0.011, 1);
    const index = Math.min(samples, Math.max(0, Math.round(u * samples)));
    const x = left + contentWidth * (index / samples);
    const y = (raceTunnelTopScratch[index] + raceTunnelBottomScratch[index]) * 0.5;
    const r = (reduced ? 3.5 : 4.5) * scale;
    ctx.strokeStyle = "rgba(214,250,255,.34)";
    ctx.lineWidth = Math.max(0.7, 1.1 * scale);
    ctx.beginPath();
    ctx.moveTo(x - r, y - r); ctx.lineTo(x, y); ctx.lineTo(x - r, y + r);
    ctx.stroke();
  }
  ctx.restore();

  // Procedural purple/blue wall filaments give the shortcut a living energy
  // boundary. The cyan core is the exact collision edge and stays brightest.
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  for (const [line, direction] of [
    [raceTunnelTopScratch, -1], [raceTunnelBottomScratch, 1],
  ] as const) {
    const strandCount = reduced ? 1 : 3;
    for (let strand = strandCount - 1; strand >= 0; strand--) {
      const offset = direction * (8 + strand * 8) * scale;
      ctx.strokeStyle = strand % 2
        ? "rgba(90,108,255,.26)"
        : "rgba(197,82,255,.34)";
      ctx.lineWidth = Math.max(0.8, (1.2 + strand * 0.8) * scale);
      traceBoundary(line, offset, strand);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(172,69,255,.34)";
    ctx.lineWidth = Math.max(4, 18 * scale);
    traceBoundary(line);
    ctx.stroke();
    ctx.strokeStyle = "rgba(204,91,255,.72)";
    ctx.lineWidth = Math.max(2, 6.5 * scale);
    traceBoundary(line);
    ctx.stroke();
    if (structureFactor > 0) {
      ctx.save();
      ctx.globalAlpha *= structureFactor;
      ctx.shadowColor = "#56e8ff";
      ctx.shadowBlur = 12 * scale;
      ctx.strokeStyle = "rgba(112,238,255,.96)";
      ctx.lineWidth = Math.max(1.5, 2.6 * scale);
      traceBoundary(line);
      ctx.stroke();
      ctx.restore();
    }
  }
  ctx.restore();

  if (race.wallSuppressTicks > 0) {
    const index = Math.min(samples, Math.max(0, Math.round((pilotX - left) / Math.max(1, contentWidth) * samples)));
    const pilotY = raceViewportY(viewport, race.y);
    const line = Math.abs(pilotY - raceTunnelTopScratch[index]) < Math.abs(pilotY - raceTunnelBottomScratch[index])
      ? raceTunnelTopScratch : raceTunnelBottomScratch;
    const start = Math.max(0, index - 2);
    const end = Math.min(samples, index + 2);
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = raceClamp01(race.wallSuppressTicks / 15);
    ctx.strokeStyle = "rgba(255,211,112,.92)";
    ctx.lineWidth = Math.max(2, 5 * scale);
    ctx.shadowColor = "#ff8bd8";
    ctx.shadowBlur = 10 * scale;
    ctx.beginPath();
    for (let i = start; i <= end; i++) {
      const x = left + contentWidth * (i / samples);
      if (i === start) ctx.moveTo(x, line[i]); else ctx.lineTo(x, line[i]);
    }
    ctx.stroke();
    ctx.restore();
  }

}

type VisibleRaceGate = {
  i: number;
  x: number;
  y: number;
  tilt: number;
  state: RaceGateVisualState;
  blend: number;
};

type RaceCourseFrame = {
  gates: VisibleRaceGate[];
  zones: RaceReadabilityZone[];
  flow: HyperRunFlowSample[];
  targetIndex: number | null;
  targetDistance: number;
  targetY: number | null;
};

function buildRaceCourseFrame(w: World, viewport: ReturnType<typeof raceViewport>): RaceCourseFrame {
  const race = w.race!;
  const route = raceRouteTarget(race);
  const targetIndex = route.nextRingIndex;
  const target = targetIndex == null ? null : RACE_RINGS[targetIndex];
  const targetDistance = target ? target.x - race.coursePosition : Number.POSITIVE_INFINITY;
  const targetY = race.phase === "entry" ? race.entryAnchorY : target?.y ?? null;
  const gates: VisibleRaceGate[] = [];
  const zones: RaceReadabilityZone[] = [{
    x: viewport.pilotX,
    y: raceViewportY(viewport, race.y),
    r: 38 * viewport.scale,
  }];
  const ringSize = 148 * viewport.scale;
  RACE_RINGS.forEach((ring, i) => {
    if (race.phase === "entry" && i === race.entryRingIndex) return;
    const visual = raceGateVisual(race, i);
    if (!visual) return;
    const x = raceViewportX(viewport, RACE_PILOT_X + ring.x - race.coursePosition);
    if (x < viewport.left - ringSize || x > viewport.right + ringSize) return;
    const gate = { i, x, y: raceViewportY(viewport, ring.y), tilt: ring.tilt, ...visual };
    gates.push(gate);
    zones.push({ x, y: gate.y, r: ringSize * 0.5 });
  });
  RACE_DEBRIS.forEach((item, i) => {
    if (race.debrisLedger[i]) return;
    const x = raceViewportX(viewport, RACE_PILOT_X + item.x - race.coursePosition);
    if (x < viewport.left - 60 * viewport.scale || x > viewport.right + 60 * viewport.scale) return;
    zones.push({ x, y: raceViewportY(viewport, item.y), r: (item.r + 10) * viewport.scale });
  });
  RACE_ACORNS.forEach((item, i) => {
    if (race.acornLedger[i]) return;
    const x = raceViewportX(viewport, RACE_PILOT_X + item.x - race.coursePosition);
    if (x < viewport.left - 30 * viewport.scale || x > viewport.right + 30 * viewport.scale) return;
    zones.push({ x, y: raceViewportY(viewport, item.y), r: 24 * viewport.scale });
  });
  return {
    gates,
    zones,
    flow: writeHyperRunFlow({
      seed: race.seed,
      tick: race.tick,
      coursePosition: race.coursePosition,
      speed: race.speed,
      targetY,
      targetDistance: race.phase === "entry" ? 0 : targetDistance,
      virtualWidth: viewport.virtualWidth,
      reducedMotion: raceReducedMotion(),
    }, raceFlowScratch),
    targetIndex,
    targetDistance,
    targetY,
  };
}

function drawRaceCourseUnderlay(
  ctx: CanvasRenderingContext2D,
  w: World,
  art: ArtBank,
  viewport: ReturnType<typeof raceViewport>,
  frame: RaceCourseFrame,
) {
  const race = w.race!;
  const { scale } = viewport;
  const ringSize = 148 * scale;
  drawRaceFlow(ctx, viewport, frame.flow, "far", frame.zones);
  if (frame.targetIndex != null && frame.targetY != null && frame.targetDistance <= RACE_MAX_INTERACTIVE_GAP) {
    const gate = frame.gates.find((candidate) => candidate.i === frame.targetIndex);
    if (gate) {
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.strokeStyle = "rgba(92,217,255,.34)";
      ctx.lineWidth = Math.max(0.8, scale);
      for (let i = 0; i < 6; i++) {
        const dy = (i - 2.5) * 10 * scale;
        ctx.beginPath();
        ctx.moveTo(gate.x + ringSize * 0.85, gate.y + dy * 1.5);
        ctx.quadraticCurveTo(gate.x + ringSize * 0.62, gate.y + dy, gate.x + ringSize * 0.44, gate.y + dy * 0.45);
        ctx.stroke();
      }
      ctx.restore();
    }
  }
  frame.gates.forEach((gate) => {
    drawRaceGateVisualLayer(ctx, art, gate, "back", ringSize);
    if (race.ringLedger[gate.i] === "pending") drawRacePendingMembrane(ctx, viewport, gate.x, gate.y, "back");
  });
  RACE_RINGS.forEach((ring, i) => {
    const decisionTick = race.ringDecisionTicks[i];
    const state = race.ringLedger[i];
    if (decisionTick == null || (state !== "passed" && state !== "missed")) return;
    drawRaceDecisionCue(ctx, viewport, state, raceDecisionAge(race.tick, decisionTick), ring.y, "back");
  });
  RACE_DEBRIS.forEach((item, i) => {
    if (race.debrisLedger[i]) return;
    const x = raceViewportX(viewport, RACE_PILOT_X + item.x - race.coursePosition);
    if (x < viewport.left - 60 * scale || x > viewport.right + 60 * scale) return;
    drawSprite(ctx, art.debris[item.art % Math.max(1, art.debris.length)],
      x, raceViewportY(viewport, item.y), item.r * 2 * scale, "core", "dark");
  });
  RACE_ACORNS.forEach((item, i) => {
    if (race.acornLedger[i]) return;
    const x = raceViewportX(viewport, RACE_PILOT_X + item.x - race.coursePosition);
    if (x < viewport.left - 30 * scale || x > viewport.right + 30 * scale) return;
    drawSprite(ctx, frameOf(art.acorn, w.time, 10), x, raceViewportY(viewport, item.y), 26 * scale);
  });
  drawRaceFlow(ctx, viewport, frame.flow, "mid", frame.zones);
  const finishX = raceViewportX(viewport, RACE_PILOT_X + RACE_LENGTH - race.coursePosition);
  if (finishX > viewport.left - ringSize && finishX < viewport.right + ringSize) {
    ctx.save();
    ctx.strokeStyle = "rgba(255,224,128,.85)";
    ctx.lineWidth = 4 * scale;
    ctx.setLineDash([8 * scale, 8 * scale]);
    ctx.beginPath();
    ctx.moveTo(finishX, raceViewportY(viewport, 80));
    ctx.lineTo(finishX, raceViewportY(viewport, 560));
    ctx.stroke();
    ctx.restore();
  }
}

function drawRaceCourseOverlay(
  ctx: CanvasRenderingContext2D,
  w: World,
  art: ArtBank,
  viewport: ReturnType<typeof raceViewport>,
  frame: RaceCourseFrame,
  excludeDecisionIndex: number | null = null,
) {
  const race = w.race!;
  const ringSize = 148 * viewport.scale;
  frame.gates.forEach((gate) => {
    drawRaceGateVisualLayer(ctx, art, gate, "front", ringSize);
    if (race.ringLedger[gate.i] === "pending") drawRacePendingMembrane(ctx, viewport, gate.x, gate.y, "front");
  });
  RACE_RINGS.forEach((ring, i) => {
    if (i === excludeDecisionIndex) return;
    const decisionTick = race.ringDecisionTicks[i];
    const state = race.ringLedger[i];
    if (decisionTick == null || (state !== "passed" && state !== "missed")) return;
    drawRaceDecisionCue(ctx, viewport, state, raceDecisionAge(race.tick, decisionTick), ring.y, "front");
  });
  drawRaceFlow(ctx, viewport, frame.flow, "near", frame.zones);
}

function drawRaceCueOverlay(
  ctx: CanvasRenderingContext2D,
  w: World,
  viewport: ReturnType<typeof raceViewport>,
) {
  const race = w.race!;
  for (let i = 0; i < w.raceCues.length; i++) {
    const cue = w.raceCues[i];
    const age = raceDecisionAge(race.tick, cue.tick);
    if (age > 45) continue;
    const x = viewport.pilotX;
    const y = raceViewportY(viewport, cue.y);
    const fade = 1 - raceClamp01(age / 30);
    if (cue.kind === "ring-pass" && age <= 2) {
      const coreY = raceViewportY(viewport, race.y);
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.fillStyle = `rgba(235,255,255,${(1 - age / 3).toFixed(3)})`;
      ctx.beginPath(); ctx.arc(x, coreY, (5 + age * 2) * viewport.scale, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    } else if (cue.kind === "debris-hit") {
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.strokeStyle = "rgba(255,153,95,.9)";
      ctx.lineWidth = 2 * viewport.scale;
      ctx.beginPath(); ctx.arc(x, y, (22 + age * 0.7) * viewport.scale, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    } else if (cue.kind === "acorn") {
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.strokeStyle = "rgba(255,225,112,.92)";
      ctx.lineWidth = 2 * viewport.scale;
      for (let arm = 0; arm < 4; arm++) {
        const a = arm * Math.PI / 2;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(a) * 10 * viewport.scale, y + Math.sin(a) * 10 * viewport.scale);
        ctx.lineTo(x + Math.cos(a) * 18 * viewport.scale, y + Math.sin(a) * 18 * viewport.scale);
        ctx.stroke();
      }
      ctx.restore();
    }
    if (cue.chargeDelta !== 0 && age <= 30) {
      let slot = 0;
      for (let j = 0; j < i; j++) {
        if (w.raceCues[j].tick === cue.tick && w.raceCues[j].chargeDelta !== 0) slot++;
      }
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.fillStyle = cue.chargeDelta > 0 ? "#b7fff1" : "#ffc0a0";
      ctx.font = `900 ${Math.max(11, 13 * viewport.scale)}px Figtree, system-ui`;
      ctx.textAlign = "left";
      ctx.fillText(`${cue.chargeDelta > 0 ? "+" : ""}${cue.chargeDelta}`,
        x + 34 * viewport.scale, y - (18 - slot * 16 + age * 0.35) * viewport.scale);
      ctx.restore();
    }
  }
}

function drawHyperRunShipExhaust(
  ctx: CanvasRenderingContext2D,
  w: World,
  scale: number,
  engineX: number,
) {
  const race = w.race!;
  const hyperspeed = race.phase === "tunnel" ? 1
    : race.phase === "entry" || race.phase === "return"
      ? hyperRunInlineWormholePresentation(race.phase, race.phaseTick).energyAlpha
      : 0;
  // The physics applies its deterministic press edge on the first fixed tick.
  // Mirror that intent in the engine plume on the same rendered frame so a
  // hold or boost never feels like it disappeared into an input queue.
  const controlThrust = race.phase === "normal"
    ? race.boost ? 1 : race.held ? 0.45 : 0
    : 0;
  const thrust = Math.max(hyperspeed, controlThrust);
  const pulse = 0.5 + 0.5 * Math.sin(w.time * raceLerp(17, 26, thrust));
  const length = raceLerp(15, 25, thrust) + pulse * raceLerp(4, 7, thrust);
  const half = raceLerp(4.2, 5.4, thrust) * scale;
  const tail = engineX - length * scale;
  const gradient = ctx.createLinearGradient(engineX, 0, tail, 0);
  gradient.addColorStop(0, "rgba(255,255,255,.96)");
  gradient.addColorStop(0.18, "rgba(97,221,255,.92)");
  gradient.addColorStop(0.58, "rgba(146,82,255,.66)");
  gradient.addColorStop(1, "rgba(83,38,180,0)");
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = gradient;
  ctx.shadowColor = "rgba(111,92,255,.82)";
  ctx.shadowBlur = raceLerp(6, 10, thrust) * scale;
  ctx.beginPath();
  ctx.moveTo(engineX, -half);
  ctx.quadraticCurveTo(engineX - length * scale * 0.48, -half * 0.64, tail, 0);
  ctx.quadraticCurveTo(engineX - length * scale * 0.48, half * 0.64, engineX, half);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function hyperRunShipLayout(
  authorityX: number,
  scale: number,
  ship: Pick<Sprite, "box" | "width" | "height">,
) {
  const shipSize = 88 * scale;
  const box = ship.box ?? { x: 0, y: 0, w: ship.width, h: ship.height };
  const fitScale = shipSize / Math.max(1, Math.max(box.w, box.h));
  const noseOffset = box.w * fitScale / 2;
  const centerX = authorityX - noseOffset;
  return {
    shipSize,
    centerX,
    cockpitX: centerX + 7.2 * scale,
    cockpitY: -10.5 * scale,
    engineX: centerX - box.w * fitScale / 2 + 1.5 * scale,
    noseX: centerX + noseOffset,
  };
}

/** Hyper Run's vehicle is a beta-only visual frame around the real equipped
 * pilot. The ship nose, not its painted center, is registered to the race
 * authority plane so a gate resolves when contact appears to happen. */
function drawHyperRunPilot(
  ctx: CanvasRenderingContext2D,
  w: World,
  save: SaveData,
  art: ArtBank,
  authorityX: number,
  scale: number,
) {
  const ship = art.hyperRun["scout-ship"];
  if (!ship) {
    drawPilot(ctx, w, save, art, authorityX, scale);
    return;
  }

  const layout = hyperRunShipLayout(0, scale, ship);
  const bank = Math.max(-0.22, Math.min(0.25, w.squirrel.rot * 0.34));
  const halo = raceReducedMotion() ? undefined
    : w.race!.phase === "tunnel" ? "light" : skyLuma(w) > 0.42 ? "dark" : "light";

  ctx.save();
  ctx.translate(authorityX, w.squirrel.y);
  // Banking around the authority point keeps the nose/crossing registration
  // stable while the body and exhaust sell the player's vertical intent.
  ctx.rotate(bank);
  drawHyperRunShipExhaust(ctx, w, scale, layout.engineX);

  ctx.save();
  ctx.beginPath();
  ctx.ellipse(layout.cockpitX, layout.cockpitY, 13.2 * scale, 12.4 * scale, 0, 0, Math.PI * 2);
  ctx.clip();
  const cockpitGlow = ctx.createRadialGradient(
    layout.cockpitX + 2 * scale, layout.cockpitY - 3 * scale, 1,
    layout.cockpitX, layout.cockpitY, 15 * scale,
  );
  cockpitGlow.addColorStop(0, "rgba(71,112,166,.62)");
  cockpitGlow.addColorStop(1, "rgba(3,8,22,.96)");
  ctx.fillStyle = cockpitGlow;
  ctx.fillRect(layout.cockpitX - 16 * scale, layout.cockpitY - 15 * scale, 32 * scale, 30 * scale);
  paintSpillHead(ctx, art, save, { cx: layout.cockpitX, cy: layout.cockpitY, rx: 12 * scale, ry: 11 * scale });
  ctx.restore();

  drawSprite(ctx, ship, layout.centerX, 0, layout.shipSize, "box", halo);
  ctx.restore();
}

function drawHyperRunWorld(ctx: CanvasRenderingContext2D, w: World, save: SaveData, art: ArtBank) {
  const race = w.race!;
  const viewport = raceViewport(w.W, w.H);
  const { scale, pilotX } = viewport;

  if (race.phase === "normal" || race.phase === "finish") {
    const frame = buildRaceCourseFrame(w, viewport);
    drawRaceCourseUnderlay(ctx, w, art, viewport, frame);
    drawHyperRunPilot(ctx, w, save, art, pilotX, scale);
    drawRaceCourseOverlay(ctx, w, art, viewport, frame);
    drawRaceCueOverlay(ctx, w, viewport);
    if (race.phase === "normal" && frame.targetIndex != null && frame.targetY != null) {
      drawRaceDirector(ctx, viewport, race.y, frame.targetY, frame.targetDistance);
    }
    return;
  }

  if (race.phase === "entry") {
    const t = race.phaseTick;
    const frame = buildRaceCourseFrame(w, viewport);
    // Nothing teleports or opens a second scene. The course remains in place
    // while energy appears at the screen edges, then closes around the live
    // tunnel geometry. At the last entry tick this is pixel-continuous with
    // tunnel tick zero.
    const { enclosure, energyAlpha, courseAlpha } =
      hyperRunInlineWormholePresentation("entry", t);

    ctx.save();
    ctx.globalAlpha *= courseAlpha;
    drawRaceCourseUnderlay(ctx, w, art, viewport, frame);
    ctx.restore();

    ctx.save();
    ctx.globalAlpha *= energyAlpha;
    // The first alignment gates materialize with the energy instead of popping
    // in on the first tunnel frame. They remain presentation-only during entry.
    drawRaceTunnel(ctx, w, 0, enclosure);
    drawHyperRunTunnelRingLayer(ctx, w, 0, "back");
    ctx.restore();

    drawHyperRunPilot(ctx, w, save, art, pilotX, scale);
    ctx.save();
    ctx.globalAlpha *= energyAlpha;
    drawHyperRunTunnelRingLayer(ctx, w, 0, "front");
    drawHyperRunTunnelDirector(ctx, w, 0);
    drawHyperRunTunnelDragCue(ctx, w);
    ctx.restore();
    ctx.save();
    ctx.globalAlpha *= courseAlpha;
    drawRaceCourseOverlay(ctx, w, art, viewport, frame);
    ctx.restore();
    drawRaceCueOverlay(ctx, w, viewport);
    return;
  }

  if (race.phase === "tunnel") {
    drawRaceTunnel(ctx, w, race.phaseTick);
    drawHyperRunTunnelRingLayer(ctx, w, race.phaseTick, "back");
    drawHyperRunPilot(ctx, w, save, art, pilotX, scale);
    drawHyperRunTunnelRingLayer(ctx, w, race.phaseTick, "front");
    drawHyperRunTunnelDirector(ctx, w, race.phaseTick);
    drawHyperRunTunnelDragCue(ctx, w);
    drawRaceCueOverlay(ctx, w, viewport);
    return;
  }

  const t = race.phaseTick;
  const frame = buildRaceCourseFrame(w, viewport);
  // Return is the exact inverse visual: the energy banks open toward the same
  // screen edges and dissolve, uncovering normal flight beneath them.
  const { enclosure, energyAlpha, courseAlpha } =
    hyperRunInlineWormholePresentation("return", t);

  ctx.save();
  ctx.globalAlpha *= courseAlpha;
  drawRaceCourseUnderlay(ctx, w, art, viewport, frame);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha *= energyAlpha;
  drawRaceTunnel(ctx, w, RACE_TUNNEL_TICKS - 1, enclosure);
  ctx.restore();

  drawHyperRunPilot(ctx, w, save, art, pilotX, scale);
  ctx.save();
  ctx.globalAlpha *= courseAlpha;
  drawRaceCourseOverlay(ctx, w, art, viewport, frame);
  ctx.restore();
  drawRaceCueOverlay(ctx, w, viewport);
}

/** What the corridor wants, in the pilot's own words. Kept in one place so
 *  the READY card and the lead-in can never disagree about the control -
 *  there is only one now, and it is the same verb Lost in Space uses. */
function tunnelControlLabel(_w: World) {
  return "TAP TO RISE";
}

// ------------------------------------------------------------- THE SPILL
//
// Its own deep space, on purpose: a cold base, two drifting nebula pools
// and a warm bloom on the right, where the spill is coming FROM. It borrows
// none of the painted skies so the mode never reads as one of the
// environments. Everything you can hit wears the light rim the dark skies
// use, so a rock separates from the void. The pilot flies the scout ship,
// sized to the squirrel's window so the field is the same field.

const wrap = (v: number, m: number) => ((v % m) + m) % m;

// THE PLATE IS BAKED (owner, 5 Sep 2026: "the spill mode was being a bit
// choppy laggy sometimes"). Profiled frame by frame, the one full-screen
// draw of the 2172x724 panorama - scaled to the canvas, at 38% alpha, every
// frame - was the whole difference between a 16ms and a 33ms Spill frame;
// nothing else in the frame had changed since the mode ran smoothly. The
// window onto the panorama barely moves: the sector steps every five waves
// and the sway is 2.5% over a nine-minute period. So the gradient and the
// panorama are composited ONCE, into a canvas the size of the screen in
// device pixels with headroom either side for the sway, and each frame
// blits that plate opaque and one-to-one, nudged by the sway. Re-baked only
// when the sector or the screen size changes. Same picture, one cheap copy
// instead of a scaled alpha composite of a two-megapixel source.
// THE PLATE IS A LAYER, NOT A DRAW. Baking removes the resample and the
// alpha, but a one-to-one blit of a screen-sized canvas is still a
// full-screen copy every frame - and on a software-rasterised canvas that
// alone is a frame's budget. So the host (the engine, which owns the DOM)
// can take the plate and mount it BEHIND the game canvas as its own
// element: the game canvas is cleared to transparent each frame, the
// compositor lays the two together, and the field's frame never touches
// the backdrop's pixels at all. The sway becomes a transform on the
// layer. Without a host the plate is drawn into the frame as before.
export type SpillBackplateHost = (plate: HTMLCanvasElement, offCss: number, wCss: number, hCss: number) => boolean;
let spillBackplateHost: SpillBackplateHost | null = null;
export function setSpillBackplateHost(host: SpillBackplateHost | null) { spillBackplateHost = host; }
let spillPlate: HTMLCanvasElement | null = null;
let spillPlateKey = "";
let spillPlateSx0 = 0;      // source x the plate's left edge was baked from
let spillPlateW = 0;        // the plate's width in CSS px
function spillPlateFor(ctx: CanvasRenderingContext2D, W: number, H: number,
  panorama: HTMLImageElement | null, sxBase: number, sw: number, pad: number) {
  const dpr = ctx.getTransform().a || 1;
  const iw = panorama?.naturalWidth ?? 0, ih = panorama?.naturalHeight ?? 0;
  const k = panorama ? W / sw : 1;                 // dest px per source px
  const swP = panorama ? Math.min(iw, sw + (2 * pad) / k) : 0;
  const sx0 = panorama ? Math.max(0, Math.min(iw - swP, sxBase - pad / k)) : 0;
  const WP = panorama ? swP * k : W;
  const pw = Math.max(1, Math.round(WP * dpr)), ph = Math.max(1, Math.round(H * dpr));
  const key = `${pw}x${ph}|${panorama ? `${iw}x${ih}@${Math.round(sx0)}/${Math.round(swP)}` : "-"}`;
  if (spillPlate && spillPlateKey === key) return spillPlate;
  const c = spillPlate ?? document.createElement("canvas");
  c.width = pw; c.height = ph;                     // also clears it
  const g2 = c.getContext("2d");
  if (!g2) return null;
  g2.setTransform(dpr, 0, 0, dpr, 0, 0);
  const g = g2.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#05060f");
  g.addColorStop(0.55, "#0a0d1e");
  g.addColorStop(1, "#05070f");
  g2.fillStyle = g;
  g2.fillRect(0, 0, WP, H);
  if (panorama) {
    g2.globalAlpha = 0.38;
    g2.drawImage(panorama, sx0, 0, swP, ih, 0, 0, WP, H);
    g2.globalAlpha = 1;
  }
  spillPlate = c; spillPlateKey = key; spillPlateSx0 = sx0; spillPlateW = WP;
  return c;
}

function spillBackdrop(ctx: CanvasRenderingContext2D, w: World, s: SpillState, art: ArtBank, covered = false) {
  const { W, H } = w;
  // parked at the Depot the scene covers the whole screen, opaque: the
  // panorama, the pools and the stars under it would be painted for nothing
  if (covered) return;
  const panorama = art.spillScene?.panorama ?? null;
  let sx = 0, sw = 0, sxBase = 0;
  if (panorama) {
    const ih = panorama.naturalHeight, iw = panorama.naturalWidth;
    sw = Math.min(iw, ih * W / H);
    const sector = Math.min(3, Math.floor((s.wave - 1) / 5));
    sxBase = (iw - sw) * Math.min(1, sector / 3);
    sx = Math.max(0, (iw - sw) * Math.min(1, sector / 3 + Math.sin(s.t * 0.012) * 0.025));
  }
  // the sway is at most 2.5% of the panorama's slack; 12% of the screen
  // either side covers it with room to spare
  const pad = Math.ceil(W * 0.12);
  const plate = spillPlateFor(ctx, W, H, panorama, sxBase, sw, pad);
  if (plate) {
    const k = panorama ? W / sw : 1;
    // where the frame's window sits inside the baked plate, clamped so the
    // plate always covers the whole screen
    const off = panorama ? Math.max(W - spillPlateW, Math.min(0, (spillPlateSx0 - sx) * k)) : 0;
    const hosted = spillBackplateHost ? spillBackplateHost(plate, off, spillPlateW, H) : false;
    if (!hosted) ctx.drawImage(plate, off, 0, spillPlateW, H);
  } else {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#05060f");
    g.addColorStop(0.55, "#0a0d1e");
    g.addColorStop(1, "#05070f");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  const drift = s.t * 6;
  const pool = (cx: number, cy: number, rx: number, ry: number, col: string) => {
    const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rx, ry));
    rg.addColorStop(0, col);
    rg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, ry / Math.max(rx, ry));
    ctx.translate(-cx, -cy);
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(rx, ry), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };
  pool(wrap(W * 0.75 - drift * 0.4, W * 1.6) - W * 0.3, H * 0.3, W * 0.7, H * 0.34, "rgba(70,60,160,0.20)");
  pool(wrap(W * 0.2 - drift * 0.25, W * 1.6) - W * 0.3, H * 0.78, W * 0.6, H * 0.28, "rgba(150,50,120,0.13)");
  // the wound the debris is coming out of
  pool(W * 1.02, H * 0.45, W * 0.5, H * 0.6, "rgba(255,140,60,0.10)");
  // the world's stars, streaming: the field is flying INTO the spill, and
  // the bigger a star the nearer, so the nearer the faster
  for (const st of w.stars) {
    const x = wrap(st.x - s.t * (10 + st.r * 20), W);
    ctx.globalAlpha = st.a * (0.55 + 0.45 * Math.sin(st.tw));
    ctx.fillStyle = st.r > 1.2 ? "#eaf2ff" : "#cfe0ff";
    ctx.beginPath();
    ctx.arc(x, st.y, st.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawSpillRock(ctx: CanvasRenderingContext2D, art: ArtBank, r: SpillRock) {
  const img = art.debris[r.sprite % Math.max(1, art.debris.length)];
  ctx.save();
  ctx.translate(r.x, r.y);
  ctx.rotate(r.rot);
  if (img) drawSprite(ctx, img, 0, 0, r.r * 2, "core", "light");
  else {
    ctx.fillStyle = "#6b6357";
    ctx.beginPath();
    ctx.arc(0, 0, r.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  if (r.kind === "spinner") {
    ctx.strokeStyle = "rgba(150,213,240,.55)"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(r.x, r.y, r.r + 4, r.rot, r.rot + 1.9); ctx.stroke();
    ctx.beginPath(); ctx.arc(r.x, r.y, r.r + 4, r.rot + Math.PI, r.rot + Math.PI + 1.9); ctx.stroke();
  } else if (r.kind === "shard") {
    ctx.strokeStyle = "rgba(231,210,174,.45)"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(r.x + r.r, r.y); ctx.lineTo(r.x + r.r + 18, r.y - r.vy * 0.02); ctx.stroke();
  }
  if (r.kind === "hulk") {
    // a hulk gets a rim so it reads as the thing you must not be near
    ctx.strokeStyle = "rgba(255,150,90,0.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.r + 5, 0, Math.PI * 2);
    ctx.stroke();
  }
}

/** a hulk announces itself from the edge before it enters. Being killed by
 *  something you could not yet see is the one death that is not the
 *  player's fault, and this mode has no gates to read the field by */
function drawSpillWarning(ctx: CanvasRenderingContext2D, w: World, r: SpillRock) {
  const a = 0.35 + 0.45 * Math.sin(w.time * 14);
  ctx.save();
  ctx.globalAlpha = a;
  ctx.strokeStyle = "#ff9a4c";
  ctx.lineWidth = 3;
  const x = w.W - 16;
  ctx.beginPath();
  ctx.moveTo(x, r.y - 16);
  ctx.lineTo(x - 13, r.y);
  ctx.lineTo(x, r.y + 16);
  ctx.stroke();
  ctx.globalAlpha = a * 0.35;
  ctx.fillStyle = "#ff9a4c";
  ctx.fillRect(w.W - 5, r.y - 26, 5, 52);
  ctx.restore();
}

/** THE SHIP. Hyper Run's scout, at the squirrel's size so the field plays
 *  the same, with a plume that answers the hand: a glow while held, a
 *  flare on a burst. Falls back to the painted pilot if the ship has not
 *  loaded, so the mode is never a blank */
/** the ship the Spill flies: a hull per PLATING level and a part per level
 *  of THRUSTERS (the tail), POWER-UPS (the cone) and the shield charges
 *  (the canopy). Every sprite shares one 256px frame, and each part sits
 *  where the owner fitted it in the lab's Ship Bench: transforms.json is
 *  that fit, offset/scale/turn about the part's own centre, with per-hull
 *  overrides. A missing bank falls back to Hyper Run's scout */
const SPILL_SHIP_LEN = 58;
type SpillHole = { cx: number; cy: number; rx: number; ry: number };
// Explicit source-frame anchors; the pilot uses an enlarged head window.
// Alpha-outline guessing made a notch in the plating dictate face size.
const SPILL_COCKPITS: Record<string, SpillHole> = {
  "hull-0": { cx: 150, cy: 85, rx: 30, ry: 27 },
  "hull-1": { cx: 150, cy: 85, rx: 30, ry: 27 },
  "hull-2": { cx: 151, cy: 85, rx: 30, ry: 27 },
  "hull-3": { cx: 150, cy: 85, rx: 30, ry: 27 },
};
const spillCanopyFrames = new WeakMap<Sprite, HTMLCanvasElement>();
function spillCanopyFrame(sp: Sprite) {
  let frame = spillCanopyFrames.get(sp);
  if (frame) return frame;
  frame = document.createElement("canvas"); frame.width = sp.naturalWidth || sp.width; frame.height = sp.naturalHeight || sp.height;
  const g = frame.getContext("2d");
  if (!g) return sp;
  g.drawImage(sp, 0, 0);
  // The original canopy paintings have an opaque glass interior. Preserve
  // their painted rim while opening its window, just as punchedHelm does.
  g.globalCompositeOperation = "destination-out";
  g.beginPath(); g.ellipse(138, 88, 26.5, 19.5, 0.24, 0, Math.PI * 2); g.fill();
  spillCanopyFrames.set(sp, frame); return frame;
}

function paintSpillHead(ctx: CanvasRenderingContext2D, art: ArtBank, save: SaveData, hole: SpillHole) {
  const suit = SUITS.find(u => u.id === save.equippedSuit) ?? SUITS[0];
  if(isHighOrbitRig(suit.id)){
    paintHighOrbitCockpit(ctx,art,suit.id,hole.cx,hole.cy,hole.rx,hole.ry);
    return;
  }
  if (isArcflashRig(suit.id)) {
    paintArcflashCockpit(ctx,art,hole.cx,hole.cy,hole.rx,hole.ry);
    return;
  }
  const body = art.suits[suit.id] ?? art.squirrelIdle[0];
  if (!body) return;
  const key = art.suits[suit.id] ? `suit:${suit.id}` : "idle-1";
  const anchor = isPremiumFrames(suit.id) ? CYBER_TRIO_REGISTRATION[suit.id].head : DOME[key] ?? DOME["suit:flight"];
  const helmet = helmetWornBy(save.equipped, suit.id);
  const b = naturalFlightKey(key) ? NATURAL_FLIGHT_BOX : body.box;
  const scale = hole.rx * 0.94 / anchor[2];
  const x = hole.cx - (anchor[0] - b.x - b.w / 2) * scale;
  const y = hole.cy - (anchor[1] - b.y - b.h / 2) * scale;
  ctx.save(); ctx.beginPath();
  ctx.ellipse(hole.cx, hole.cy, hole.rx, hole.ry, 0, 0, Math.PI * 2); ctx.clip();
  ctx.drawImage(body, hole.cx - anchor[0] * scale, hole.cy - anchor[1] * scale, body.width * scale, body.height * scale);
  if (!isPremiumFrames(suit.id)) paintDome(ctx, body, key, helmet, x, y, Math.max(b.w, b.h) * scale, art);
  ctx.restore();
}

function spillShipParts(s: SpillState) {
  const lvl = (n: number) => Math.max(0, Math.min(3, Math.floor(n)));
  return {
    hull: `hull-${lvl(s.up.plating)}`,
    thrust: s.up.thrusters > 0 ? `thrust-${lvl(s.up.thrusters)}` : null,
    cone: s.up.pulse > 0 ? `cone-${lvl(s.up.pulse)}` : null,
    // the canopy is the shield: a visor for one charge, sealed for two
    cockpit: s.canopyLevel >= 2 ? "cockpit-3" : s.canopyLevel >= 1 ? "cockpit-1" : null,
  };
}

function paintSpillModule(ctx: CanvasRenderingContext2D, id: keyof typeof SPILL_MODULE_MARKS, x: number, y: number, size: number) {
  ctx.save(); ctx.translate(x, y); ctx.scale(size / 24, size / 24);
  ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.beginPath();
  for (const points of SPILL_MODULE_MARKS[id]) {
    ctx.moveTo(points[0][0], points[0][1]);
    for (const [px, py] of points.slice(1)) ctx.lineTo(px, py);
  }
  ctx.stroke(); ctx.restore();
}

const rustHullCache = new WeakMap<HTMLImageElement, HTMLCanvasElement>();
/** Appearance proof on the existing hull only. The source footprint, pilot
 * window and every separately fitted module keep their registered geometry. */
function rustHull(hull: Sprite) {
  const old = rustHullCache.get(hull); if (old) return old;
  const c = document.createElement("canvas"); c.width = hull.width; c.height = hull.height;
  const g = c.getContext("2d"); if (!g) return hull;
  g.drawImage(hull, 0, 0); g.globalCompositeOperation = "source-atop";
  g.fillStyle = "rgba(181,93,44,.34)"; g.fillRect(0, 0, c.width, c.height);
  const b = hull.box, y = b.y + b.h * .76;
  g.fillStyle = "rgba(241,211,161,.7)"; g.fillRect(b.x + b.w * .2, y, b.w * .58, 3);
  for (let i = 0; i < 6; i++) {
    g.beginPath(); g.arc(b.x + b.w * (.24 + i * .095), y + 7, 1.7, 0, Math.PI * 2); g.fill();
  }
  rustHullCache.set(hull, c); return c;
}

function drawSpillShip(ctx: CanvasRenderingContext2D, w: World, save: SaveData, art: ArtBank, s: SpillState, x: number, parked = false) {
  const appearance = spillAppearance(save);
  const rustWake = appearance.trail === "rust-wake";
  const parts = spillShipParts(s);
  const hull = art.spillShip?.[parts.hull];
  if (!hull) { drawSpillScout(ctx, w, save, art, s, x); return; }
  const fit = art.spillShipFit;
  const xfOf = (name: string) => fit?.overrides?.[parts.hull]?.[name] ?? fit?.parts?.[name] ?? { dx: 0, dy: 0, scale: 1, rot: 0 };
  const layers = ([["thrust", parts.thrust], ["cone", parts.cone], ["cockpit", parts.cockpit]] as const)
    .map(([, name]) => name ? { name, sp: art.spillShip[name], xf: xfOf(name) } : null)
    .filter((l): l is { name: string; sp: Sprite; xf: { dx: number; dy: number; scale: number; rot: number; behind?: boolean } } => !!l && !!l.sp);
  const z = SPILL_SHIP_LEN / hull.box.w;
  const thrust = Math.max(s.thrustT ? 0.55 * Math.min(1, s.thrustT / 0.22) : 0, s.burstT > 0 ? Math.min(1, s.burstT / 0.22) : 0);

  ctx.save();
  ctx.translate(x, s.pilot.y);
  ctx.rotate(Math.max(-0.28, Math.min(0.32, s.pilot.rot * 0.45)));
  ctx.scale(z, z);
  // the hull's box centre is the collision point; everything else is
  // painted in the sprites' shared frame around it
  ctx.translate(-(hull.box.x + hull.box.w / 2), -(hull.box.y + hull.box.h / 2));

  // the plume, from the mouth of whatever is on the tail
  const tail = layers.find((l) => l.name.startsWith("thrust"));
  let engineX = hull.box.x + 3, engineY = hull.box.y + hull.box.h * 0.45;
  if (tail) {
    const cx = tail.sp.box.x + tail.sp.box.w / 2, cy = tail.sp.box.y + tail.sp.box.h / 2;
    engineX = cx + tail.xf.dx - (tail.sp.box.w / 2) * tail.xf.scale + 2;
    engineY = cy + tail.xf.dy;
  }
  const pulse = 0.5 + 0.5 * Math.sin(w.time * (17 + 9 * thrust));
  const length = ((9 + 14 * thrust) + pulse * (3 + 4 * thrust)) / z;
  const half = (3 + 1.4 * thrust) / z;
  const grad = ctx.createLinearGradient(engineX, engineY, engineX - length, engineY);
  grad.addColorStop(0, "rgba(255,255,255,.96)");
  grad.addColorStop(0.18, rustWake ? "rgba(255,210,135,.92)" : "rgba(97,221,255,.92)");
  const signal = hexRgb(rustWake ? "#c77740" : s.signal);
  grad.addColorStop(0.58, `rgba(${signal.r},${signal.g},${signal.b},.66)`);
  grad.addColorStop(1, "rgba(83,38,180,0)");
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  if (parked) ctx.globalAlpha = 0;
  ctx.fillStyle = grad;
  ctx.shadowColor = `rgba(${signal.r},${signal.g},${signal.b},.82)`;
  ctx.shadowBlur = (5 + 5 * thrust) / z;
  ctx.beginPath();
  ctx.moveTo(engineX, engineY - half);
  ctx.quadraticCurveTo(engineX - length * 0.48, engineY - half * 0.64, engineX - length, engineY);
  ctx.quadraticCurveTo(engineX - length * 0.48, engineY + half * 0.64, engineX, engineY + half);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  const paint = (l: typeof layers[number]) => {
    const cx = l.sp.box.x + l.sp.box.w / 2, cy = l.sp.box.y + l.sp.box.h / 2;
    ctx.save();
    ctx.translate(cx + l.xf.dx, cy + l.xf.dy);
    ctx.rotate((l.xf.rot * Math.PI) / 180);
    ctx.scale(l.xf.scale, l.xf.scale);
    ctx.drawImage(l.name.startsWith("cockpit") ? spillCanopyFrame(l.sp) : l.sp, -cx, -cy);
    ctx.restore();
  };
  for (const l of layers) if (l.xf.behind) paint(l);
  // Stock nozzles are baked into the old hull art. Clip that source area
  // when an upgrade is fitted; otherwise two different engines show at once.
  ctx.save();
  if (parts.thrust) { ctx.beginPath(); ctx.rect(57, 0, 199, 256); ctx.clip(); }
  ctx.drawImage(appearance.finish === "rust-runner" ? rustHull(hull) : hull, 0, 0); ctx.restore();
  const hole = SPILL_COCKPITS[parts.hull] ?? SPILL_COCKPITS["hull-0"];
  ctx.save(); ctx.beginPath(); ctx.ellipse(hole.cx, hole.cy, hole.rx, hole.ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#10243d"; ctx.fill();
  ctx.strokeStyle = "#b49a71"; ctx.lineWidth = 3; ctx.stroke();
  if (!parked) paintSpillHead(ctx, art, save, hole);
  // Glass is a restrained tint and edge glint, never an opaque disk.
  if (parts.cockpit) {
    ctx.beginPath(); ctx.ellipse(hole.cx, hole.cy, hole.rx - 2, hole.ry - 2, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(115,203,240,.08)"; ctx.fill();
    ctx.strokeStyle = "rgba(207,242,255,.65)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(hole.cx, hole.cy, hole.rx - 2, hole.ry - 2, 0, Math.PI * 1.12, Math.PI * 1.65); ctx.stroke();
  }
  ctx.restore();
  for (const l of layers) if (!l.xf.behind) paint(l);
  // Fixed attachment mounts shared by flight and all ship previews.
  const mounts = { magnet: [184, 134, 43, 48], scanner: [95, 45, 40, 48],
    brake: [42, 112, 48, 46], capacitor: [115, 141, 45, 45] } as const;
  for (const id of s.utilities) {
    const [mx, my, mw, mh] = mounts[id], module = art.spillShip[id];
    if (module) ctx.drawImage(module, mx, my, mw, mh);
    else { ctx.strokeStyle = "#a4e9ea"; paintSpillModule(ctx, id, mx + 6, my + 6, 20); }
  }
  ctx.fillStyle = "#f5cb7a";
  for (let i = 0; i < 3; i++) if (s.specialties[(["plating", "thrusters", "pulse"] as const)[i]])
    ctx.fillRect(151 + i * 7, 133, 4, 3);

  ctx.restore();
}

/** the fallback: Hyper Run's scout, as the mode flew before it had a ship */
function drawSpillScout(ctx: CanvasRenderingContext2D, w: World, save: SaveData, art: ArtBank, s: SpillState, x: number) {
  const ship = art.hyperRun["scout-ship"];
  if (!ship) {
    // A slow or failed asset request must leave a visible, usable ship.
    ctx.save(); ctx.translate(x, s.pilot.y);
    ctx.fillStyle = "#b99b73"; ctx.beginPath(); ctx.ellipse(0, 3, 27, 12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#152c46"; ctx.beginPath(); ctx.arc(7, -6, 10, 0, Math.PI * 2); ctx.fill();
    paintSpillHead(ctx, art, save, { cx: 7, cy: -6, rx: 10, ry: 10 });
    ctx.strokeStyle = "#a8ddeb"; ctx.lineWidth = 1; ctx.stroke(); ctx.restore();
    return;
  }
  const scale = 58 / 88;
  const box = ship.box ?? { x: 0, y: 0, w: ship.width, h: ship.height };
  const fit = (88 * scale) / Math.max(1, Math.max(box.w, box.h));
  const layout = hyperRunShipLayout(box.w * fit / 2, scale, ship);
  const engineX = layout.engineX;
  const thrust = Math.max(s.thrustT ? 0.55 * Math.min(1, s.thrustT / 0.22) : 0, s.burstT > 0 ? Math.min(1, s.burstT / 0.22) : 0);
  ctx.save();
  ctx.translate(x, s.pilot.y);
  ctx.rotate(Math.max(-0.28, Math.min(0.32, s.pilot.rot * 0.45)));
  const pulse = 0.5 + 0.5 * Math.sin(w.time * (17 + 9 * thrust));
  const length = (9 + 14 * thrust) + pulse * (3 + 4 * thrust);
  const half = 3 + 1.4 * thrust;
  const tail = engineX - length;
  const grad = ctx.createLinearGradient(engineX, 0, tail, 0);
  grad.addColorStop(0, "rgba(255,255,255,.96)");
  grad.addColorStop(0.18, "rgba(97,221,255,.92)");
  grad.addColorStop(0.58, "rgba(146,82,255,.66)");
  grad.addColorStop(1, "rgba(83,38,180,0)");
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = grad;
  ctx.shadowColor = "rgba(111,92,255,.82)";
  ctx.shadowBlur = 5 + 5 * thrust;
  ctx.beginPath();
  ctx.moveTo(engineX, -half);
  ctx.quadraticCurveTo(engineX - length * 0.48, -half * 0.64, tail, 0);
  ctx.quadraticCurveTo(engineX - length * 0.48, half * 0.64, engineX, half);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(layout.cockpitX, layout.cockpitY, 13.2 * scale, 12.4 * scale, 0, 0, Math.PI * 2);
  ctx.clip();
  const cockpitGlow = ctx.createRadialGradient(
    layout.cockpitX + 2 * scale, layout.cockpitY - 3 * scale, 1,
    layout.cockpitX, layout.cockpitY, 15 * scale,
  );
  cockpitGlow.addColorStop(0, "rgba(71,112,166,.62)");
  cockpitGlow.addColorStop(1, "rgba(3,8,22,.96)");
  ctx.fillStyle = cockpitGlow;
  ctx.fillRect(layout.cockpitX - 16 * scale, layout.cockpitY - 15 * scale, 32 * scale, 30 * scale);
  paintSpillHead(ctx, art, save, { cx: layout.cockpitX, cy: layout.cockpitY, rx: 12 * scale, ry: 11 * scale });
  ctx.restore();
  drawSprite(ctx, ship, layout.centerX, 0, layout.shipSize, "box", "light");
  ctx.restore();
}

// THE DEPOT IS A PLATE TOO (owner, 6 Sep 2026: "check new depot artwork
// too"). Parked at the Depot nothing in the scene moves - the camera has
// arrived, the marshal holds his last frame - yet every frame redrew the
// 1536x1024 scene scaled across the screen, the shade over it and the bear,
// under a DOM sheet the player is reading. Profiled: two in five frames
// over budget. So once the ship is parked the scene, the shade and the
// marshal are composited once into a screen-sized plate and handed to the
// same layer behind the canvas the panorama uses. The approach itself -
// the camera closing in, the fade, the Vanguard gag - still paints live,
// because it moves.
type DepotBearFrame = { image: HTMLCanvasElement | HTMLImageElement; footX: number; footY: number };
let spillDepotPlate: HTMLCanvasElement | null = null;
let spillDepotKey = "";
function spillDepotPlateFor(ctx: CanvasRenderingContext2D, W: number, H: number, dock: HTMLImageElement,
  view: { x: number; y: number; width: number; height: number }, bear: DepotBearFrame | undefined,
  marshal: { x: number; y: number; height: number; frame: number }) {
  const dpr = ctx.getTransform().a || 1;
  const pw = Math.max(1, Math.round(W * dpr)), ph = Math.max(1, Math.round(H * dpr));
  const key = `${pw}x${ph}|${view.x.toFixed(1)},${view.y.toFixed(1)},${view.width.toFixed(1)},${view.height.toFixed(1)}|${bear ? `${bear.image.width}x${bear.image.height}@${marshal.frame}` : "-"}`;
  if (spillDepotPlate && spillDepotKey === key) return spillDepotPlate;
  const c = spillDepotPlate ?? document.createElement("canvas");
  c.width = pw; c.height = ph;
  const g = c.getContext("2d");
  if (!g) return null;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.drawImage(dock, view.x, view.y, view.width, view.height);
  const shade = g.createLinearGradient(0, 0, 0, H);
  shade.addColorStop(0, "rgba(3,7,20,.38)"); shade.addColorStop(0.5, "rgba(3,7,20,0)"); shade.addColorStop(1, "rgba(3,7,20,.3)");
  g.fillStyle = shade; g.fillRect(0, 0, W, H);
  if (bear) {
    g.fillStyle = "rgba(6,5,16,.45)"; g.beginPath();
    g.ellipse(marshal.x, marshal.y, marshal.height * .28, marshal.height * .055, 0, 0, Math.PI * 2); g.fill();
    g.save(); g.translate(marshal.x, marshal.y);
    const scale = marshal.height / bear.image.height;
    g.scale(-scale, scale); // face the incoming ship
    g.drawImage(bear.image, -bear.footX, -bear.footY); g.restore();
  }
  spillDepotPlate = c; spillDepotKey = key;
  return c;
}

function drawSpillWorld(ctx: CanvasRenderingContext2D, w: World, save: SaveData, art: ArtBank) {
  const s = w.spill!;
  const { W, H } = w;
  const dock = art.spillScene?.depot;
  const parked = !!dock && s.phase === "depot";
  spillBackdrop(ctx, w, s, art, parked);
  if (dock && parked) {
    const view = spillDockView(W, H, dock.naturalWidth || dock.width, dock.naturalHeight || dock.height, SPILL.dockTime, -1);
    const marshal = spillDockBear(view, SPILL.dockTime, !!save.motionOff);
    const bear = art.spillScene?.bear?.[marshal.frame];
    const plate = spillDepotPlateFor(ctx, W, H, dock, view, bear, marshal);
    const hosted = plate && spillBackplateHost ? spillBackplateHost(plate, 0, W, H) : false;
    if (plate && !hosted) ctx.drawImage(plate, 0, 0, W, H);
  } else if (dock && s.phase === "docking") {
    const gagTime = s.depotGag ? s.phaseT - spillDockTravelDuration(s) : -1;
    const cameo = gagTime >= 0 && !!art.spillScene?.vanguardDepot;
    const arrival = Math.min(SPILL.dockTime, s.phaseT * SPILL.dockTime / spillDockTravelDuration(s));
    const view = spillDockView(W, H, dock.naturalWidth || dock.width, dock.naturalHeight || dock.height, arrival, cameo ? gagTime : -1);
    ctx.save(); ctx.globalAlpha = view.opacity;
    ctx.drawImage(dock, view.x, view.y, view.width, view.height);
    const shade = ctx.createLinearGradient(0, 0, 0, H);
    shade.addColorStop(0, "rgba(3,7,20,.38)"); shade.addColorStop(0.5, "rgba(3,7,20,0)"); shade.addColorStop(1, "rgba(3,7,20,.3)");
    ctx.fillStyle = shade; ctx.fillRect(0, 0, W, H);
    const marshal = spillDockBear(view, arrival, !!save.motionOff);
    const bear = art.spillScene?.bear?.[marshal.frame];
    if (cameo) {
      const pose = vanguardDepotPose(gagTime);
      const actorX = view.x + view.width * (.664 + .054 * pose.walk + .027 * pose.enter);
      const actorY = view.y + view.height * (.645 - .10 * pose.enter);
      // He travels behind the marshal. The same painted trousers stay in
      // both hands through the laugh, then disappear into the waist pocket.
      paintVanguardDepot(ctx, art.spillScene!.vanguardDepot!, actorX, actorY,
        marshal.height * .9, gagTime);
      if (pose.enter > 0) {
        const px = view.x + view.width * .745, py = view.y + view.height * .582;
        const glow = ctx.createRadialGradient(px, py, 0, px, py, marshal.height * .8);
        glow.addColorStop(0, `rgba(200,178,255,${.18 * Math.sin(pose.enter * Math.PI)})`);
        glow.addColorStop(1, "rgba(124,73,239,0)");
        ctx.fillStyle = glow; ctx.fillRect(px - marshal.height, py - marshal.height, marshal.height * 2, marshal.height * 2);
      }
    }
    if (bear) {
      ctx.fillStyle = "rgba(6,5,16,.45)"; ctx.beginPath();
      ctx.ellipse(marshal.x, marshal.y, marshal.height * .28, marshal.height * .055, 0, 0, Math.PI * 2); ctx.fill();
      ctx.save(); ctx.translate(marshal.x, marshal.y);
      const scale = marshal.height / bear.image.height;
      ctx.scale(-scale, scale); // face the incoming ship
      ctx.drawImage(bear.image, -bear.footX, -bear.footY); ctx.restore();
    }
    if (cameo) {
      // The hull stays parked in the same world position as the camera
      // moves in; its cockpit is empty and its thruster is off.
      const parkedX = view.x + view.width * .648, parkedY = view.y + view.height * .64;
      const shipScale = view.height / (Math.max(W / (dock.naturalWidth || dock.width), H / (dock.naturalHeight || dock.height)) * (dock.naturalHeight || dock.height) * 1.42);
      ctx.save(); ctx.translate(parkedX, parkedY); ctx.scale(shipScale, shipScale);
      ctx.translate(-s.pilot.x, -s.pilot.y);
      drawSpillShip(ctx, w, save, art, s, s.pilot.x, true); ctx.restore();
      ctx.restore(); return;
    }
    ctx.restore();
  }

  const blackout = spillMod(s, "blackout") && (s.phase === "wave" || s.phase === "drain");

  // DRIFT is already in the debris velocity. Keep the ship, warnings,
  // pickups and boundary in the same screen coordinates as collision.
  ctx.save();

  if (s.eventWarn > 0) {
    const gap = spillEventGap(s), y0 = s.eventSafeY - gap / 2, y1 = s.eventSafeY + gap / 2;
    ctx.fillStyle = `rgba(255,156,93,${0.07 + Math.sin(w.time * 8) * 0.025})`;
    ctx.fillRect(W * 0.48, 0, W * 0.52, y0); ctx.fillRect(W * 0.48, y1, W * 0.52, H - y1);
    ctx.strokeStyle = "rgba(138,228,183,.8)"; ctx.lineWidth = 2; ctx.setLineDash([8, 7]);
    ctx.beginPath(); ctx.moveTo(W * 0.5, y0); ctx.lineTo(W, y0); ctx.moveTo(W * 0.5, y1); ctx.lineTo(W, y1); ctx.stroke(); ctx.setLineDash([]);
    ctx.font = "800 10px Figtree,system-ui"; ctx.textAlign = "right"; ctx.fillStyle = "#a3efc2";
    ctx.fillText("OPEN CORRIDOR", W - 14, s.eventSafeY + 4);
  }

  for (const n of s.nuts) {
    if (n.got) continue;
    const y = n.y + Math.sin(n.bob) * 3;
    if (n.kind !== "ore") {
      // the rare ones carry a halo, so they read as worth crossing for
      const pull = 20 + Math.sin(w.time * 5 + n.bob) * 3;
      const g = ctx.createRadialGradient(n.x, y, 0, n.x, y, pull);
      g.addColorStop(0, n.kind === "hull" ? "rgba(120,255,170,0.5)" : "rgba(255,215,120,0.5)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(n.x, y, pull, 0, Math.PI * 2);
      ctx.fill();
    }
    if (n.kind === "ore") drawSprite(ctx, art.ore ?? frameOf(art.acorn, w.time, 10), n.x, y, 28);
    else if (n.kind === "gold") {
      drawSprite(ctx, art.ore ?? frameOf(art.golden, w.time, 10), n.x, y, 34);
      ctx.strokeStyle = "#c3f5ff"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(n.x,y,20,0,Math.PI*2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(n.x+13,y-22); ctx.lineTo(n.x+8,y-15); ctx.lineTo(n.x+14,y-15); ctx.lineTo(n.x+10,y-8); ctx.stroke();
    }
    else {
      // a hull fragment: a green plate with a cross, the pip it restores
      ctx.save();
      ctx.translate(n.x, y);
      ctx.rotate(Math.sin(n.bob) * 0.2);
      ctx.fillStyle = "#5fd48a";
      round(ctx, -11, -11, 22, 22, 6);
      ctx.fill();
      ctx.fillStyle = "#0a2a18";
      ctx.fillRect(-2, -7, 4, 14);
      ctx.fillRect(-7, -2, 14, 4);
      ctx.restore();
    }
  }

  for (const r of s.rocks) {
    if (r.dead) continue;
    if (r.warn > 0) drawSpillWarning(ctx, w, r);
    else drawSpillRock(ctx, art, r);
    if (spillHas(s, "scanner") && r.warn <= 0 && r.x > W - 65) drawSpillWarning(ctx, w, r);
  }

  if (blackout) {
    // THE BLACKOUT dims the field to rims and warnings, phased in with
    // the rule. The veil goes over the rocks and under the ship
    ctx.fillStyle = `rgba(0,0,0,${(0.62 * spillRamp(s)).toFixed(3)})`;
    ctx.fillRect(-W, -H, W * 3, H * 3);
    for (const r of s.rocks) if (!r.dead && r.warn > 0) drawSpillWarning(ctx, w, r);
    for (const r of s.rocks) if (!r.dead && r.warn <= 0) {
      ctx.strokeStyle = spillHas(s, "scanner") ? "rgba(166,230,255,.92)" : "rgba(168,188,206,.4)";
      ctx.lineWidth = spillHas(s, "scanner") ? 2 : 1;
      ctx.beginPath(); ctx.arc(r.x, r.y, r.r + 1, 0, Math.PI * 2); ctx.stroke();
    }
  }

  drawSpillCombat(ctx, s, art);
  for (const p of w.particles) drawParticle(ctx, p);

  if (s.phase !== "over" && w.screen !== "dead") {
    // a lunge leaves a ghost behind it, so the dash reads as a dash
    if (s.lunge > 0) {
      ctx.save();
      ctx.globalAlpha = 0.3;
      drawSpillShip(ctx, w, save, art, s, s.pilot.x - 18);
      ctx.restore();
    }
    // the hull's invulnerability blinks the ship rather than hiding it
    const blink = s.iframes > 0 && Math.floor(w.time * 18) % 2 === 0;
    ctx.save();
    if (blink) ctx.globalAlpha = 0.35;
    drawSpillShip(ctx, w, save, art, s, s.pilot.x);
    ctx.restore();
    if (s.gold > 0) {
      ctx.strokeStyle = `rgba(255,208,96,${0.35 + 0.25 * Math.sin(w.time * 10)})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(s.pilot.x, s.pilot.y, 32, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (s.shield > 0) {
      ctx.strokeStyle = `rgba(150,230,255,${(0.4 + 0.3 * Math.sin(w.time * 5) + s.shieldFlash).toFixed(2)})`;
      ctx.lineWidth = s.shield > 1 ? 3.5 : 2;
      ctx.beginPath();
      ctx.arc(s.pilot.x, s.pilot.y, 28, 0, Math.PI * 2);
      ctx.stroke();
    }
    // an armed PULSE rings the ship faintly: it will fire at the next impact
    if (s.up.pulse >= 1 && s.charge >= 1) {
      ctx.strokeStyle = `rgba(255,225,140,${(0.25 + 0.2 * Math.sin(w.time * 7)).toFixed(2)})`;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.arc(s.pilot.x, s.pilot.y, 40, w.time * 1.5, w.time * 1.5 + Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  } else if (w.screen === "dead") {
    drawSpillShip(ctx, w, save, art, s, s.pilot.x);
  }
  ctx.restore();   // gameplay coordinates

  // the floor announces sustained contact before damage - drawn level, because the
  // floor is the screen's edge, not the field's
  if (s.floorT > SPILL.floorWarn && s.phase !== "over") {
    const f = Math.min(1, (s.floorT - SPILL.floorWarn) / (SPILL.floorGrace - SPILL.floorWarn));
    const g = ctx.createLinearGradient(0, H - 90, 0, H);
    g.addColorStop(0, "rgba(255,60,60,0)");
    g.addColorStop(1, `rgba(255,60,60,${(0.2 + f * 0.5).toFixed(2)})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, H - 90, W, 90);
  }

  if (s.pulseFlash > 0) {
    const reach = (s.up.pulse >= 3 ? SPILL.pulseWideR : SPILL.pulseR) * Math.max(0.8, W / 390);
    const g = ctx.createRadialGradient(s.pilot.x, s.pilot.y, 0, s.pilot.x, s.pilot.y, reach);
    g.addColorStop(0, `rgba(255,225,180,${0.5 * s.pulseFlash})`);
    g.addColorStop(1, "rgba(255,150,60,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  if (s.hitFlash > 0) {
    ctx.fillStyle = `rgba(255,70,50,${(0.22 * s.hitFlash).toFixed(3)})`;
    ctx.fillRect(0, 0, W, H);
  }
}

/** a two-line teaching panel: the rule's name, then what to do about it.
 *  It sits a quarter of the way down, or under the status stack if the
 *  screen is too short for both */
/** the lesson panel sits low, under the flight path, its bottom edge at
 *  `bottom` - the owner flew wave 1 with the controls card in the lane */
function drawSpillHint(ctx: CanvasRenderingContext2D, w: World, text: string, alpha: number, bottom: number) {
  const cut = text.indexOf(": ");
  const title = cut > 0 ? text.slice(0, cut) : "";
  let body = cut > 0 ? text.slice(cut + 2) : text;
  const bw = Math.min(360, w.W - 32);
  ctx.font = "600 12px Figtree, system-ui";
  // a body wider than the panel breaks once, at the separator nearest the
  // middle - a dot if the line has them, so a list never breaks mid-item
  const lines: string[] = [];
  if (ctx.measureText(body).width > bw - 28) {
    const sep = body.includes(" · ") ? " · " : " ";
    let best = -1;
    for (let i = body.indexOf(sep); i >= 0; i = body.indexOf(sep, i + 1)) {
      if (best < 0 || Math.abs(i - body.length / 2) < Math.abs(best - body.length / 2)) best = i;
    }
    if (best > 0) { lines.push(body.slice(0, best), body.slice(best + sep.length)); body = ""; }
  }
  if (body) lines.push(body);
  const bh = 30 + (title ? 18 : 0) + lines.length * 16;
  const cy = bottom - bh / 2;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "rgba(12,18,36,0.82)";
  ctx.strokeStyle = "rgba(127,214,255,0.45)";
  ctx.lineWidth = 1.5;
  round(ctx, w.W / 2 - bw / 2, cy - bh / 2, bw, bh, 14);
  ctx.fill();
  ctx.stroke();
  ctx.textAlign = "center";
  let y = cy - bh / 2 + 22;
  if (title) {
    ctx.fillStyle = "#9fe6ff";
    ctx.font = "800 14px Figtree, system-ui";
    ctx.fillText(title, w.W / 2, y);
    y += 18;
  }
  ctx.fillStyle = "rgba(243,239,228,0.85)";
  ctx.font = "600 12px Figtree, system-ui";
  for (const line of lines) {
    ctx.fillText(line, w.W / 2, y);
    y += 16;
  }
  ctx.restore();
}

function drawSpillHud(ctx: CanvasRenderingContext2D, w: World, art?: ArtBank | null, hidePrompts = false, padsOn = true) {
  const s = w.spill!;
  const { W, H } = w;
  ctx.textAlign = "center";
  // the wave sits where every other mode puts its score; a mission counts
  // it against the rung it has to reach
  ctx.fillStyle = "#fff";
  ctx.font = "800 36px Figtree, system-ui";
  ctx.fillText(s.welcome ? "DEPOT" : s.target ? `${s.wave}/${s.target}` : String(s.wave), W / 2, 46);
  ctx.font = "700 11px Figtree, system-ui";
  ctx.fillStyle = "rgba(255,224,128,0.9)";
  const names = s.liveMods.map((m) => SPILL_MOD_INFO[m].name).filter(Boolean).join(" + ");
  const sub = s.phase === "wave" ? `WAVE ${s.wave}${names ? ` · ${names}` : ""} · ${Math.ceil(spillWaveLeft(s))}s`
    : s.phase === "drain" ? `WAVE ${s.wave} · FIELD DRAINING`
      : s.phase === "countdown" ? `NEXT · WAVE ${s.wave}${names ? ` · ${names}` : ""}`
        : s.phase === "docking" ? s.welcome ? "PRE-FLIGHT · ARRIVING AT THE DEPOT" : `WAVE ${s.wave} CLEARED`
          : s.phase === "depot" ? "DEPOT · TAKE YOUR TIME"
            : s.phase === "respawn" ? "RESPAWN CORE" : "DEBRIS FIELD";
  ctx.fillText(sub, W / 2, 64);
  // the PULSE meter. Locked, it is dim and says so; unlocked and full it
  // is armed, and fires by itself at the next impact
  const unlocked = s.up.pulse >= 1;
  const barW = 80;
  const barX = W / 2 - barW / 2;
  ctx.fillStyle = "rgba(255,255,255,.15)";
  ctx.fillRect(barX, 69, barW, 3);
  ctx.fillStyle = !unlocked ? "rgba(200,190,255,.45)" : s.charge >= 1 ? "#ffe680" : "#8fd6ff";
  ctx.fillRect(barX, 69, barW * Math.min(1, s.charge / spillChargeCap(s)), 3);
  if (s.phase !== "depot" && s.phase !== "docking") {
    ctx.font = "800 9px Figtree, system-ui";
    if (unlocked && s.charge >= 1) {
      ctx.fillStyle = "#ffe680";
      ctx.globalAlpha = 0.7 + 0.3 * Math.sin(w.time * 8);
      ctx.fillText(`PULSE ARMED${spillChargeCap(s) > 1 ? ` · ${Math.floor(s.charge)}/2` : ""}`, W / 2, 82);
      ctx.globalAlpha = 1;
    } else if (!unlocked && s.charge > 0) {
      ctx.fillStyle = "rgba(200,190,255,.6)";
      ctx.fillText("UNLOCK PULSE", W / 2, 82);
    }
  }
  // Acorn Coins, top-left, where the acorns sit in every other mode
  if (art?.ore) drawSprite(ctx, art.ore, 22, 24, 24);
  else {
    ctx.fillStyle = "#c99bff";
    ctx.beginPath();
    ctx.moveTo(22, 15); ctx.lineTo(30, 24); ctx.lineTo(22, 33); ctx.lineTo(14, 24);
    ctx.closePath();
    ctx.fill();
  }
  ctx.textAlign = "left";
  ctx.font = "700 14px Figtree, system-ui";
  ctx.fillStyle = "#d9b8ff";
  ctx.fillText(`${s.ore}`, 38, 28);
  if (s.combo > 1) {
    ctx.fillStyle = "#ffd76a";
    ctx.font = "800 12px Figtree, system-ui";
    ctx.fillText(`×${s.combo}`, 38, 44);
  }
  ctx.fillStyle = "rgba(221,211,246,.7)"; ctx.font = "700 9px Figtree, system-ui";
  ctx.fillText(`SCORE ${Math.floor(s.score)}`, 14, 58);
  ctx.strokeStyle = "#a4e9ea";
  s.utilities.forEach((id, i) => paintSpillModule(ctx, id, 14 + i * 22, 61, 16));
  // Current protection stays readable beside the pause control.
  const healthW = Math.min(72, W * .2), healthX = W - 58 - healthW;
  ctx.fillStyle = "rgba(255,255,255,.18)"; round(ctx, healthX, 20, healthW, 9, 4); ctx.fill();
  const health = Math.max(0, Math.min(1, s.hull / s.maxHull));
  if (health > 0) { ctx.fillStyle = health <= .34 ? "#ff9978" : "#70e3a0"; round(ctx, healthX, 20, healthW * health, 9, 4); ctx.fill(); }
  ctx.textAlign = "right"; ctx.font = "800 10px Figtree, system-ui";
  ctx.fillStyle = "#b3f1d2"; ctx.fillText("HEALTH", W - 58, 15);
  ctx.fillStyle = "#a3e6ff"; ctx.fillText(`SHIELDS ${s.shield}`, W - 58, 44);
  drawSpillCombatHud(ctx, s);
  // status lines stack under the meter
  let hudY = 100;
  const hudLine = (text: string, color: string) => {
    ctx.textAlign = "center";
    ctx.fillStyle = color;
    ctx.font = "700 13px Figtree, system-ui";
    ctx.fillText(text, W / 2, hudY);
    hudY += 18;
  };
  if (s.bannerT > 0 && s.phase !== "countdown") {
    ctx.globalAlpha = Math.min(1, s.bannerT * 1.6);
    hudLine(s.banner, s.banner.startsWith("HEALTH") ? "#ff9a8c" : s.banner.startsWith("PULSE") ? "#ffe680" : "#f2b653");
    ctx.globalAlpha = 1;
  }
  if (s.gold > 0) hudLine(`GOLD  ${Math.ceil(s.gold)}s`, "#ffd060");
  if (s.surgeT > 0) hudLine(`SURGE  ${Math.ceil(s.surgeT)}s`, "#ff9a4c");
  if (s.pulseQueue > 0) hudLine(`ECHO READY IN ${Math.ceil(s.pulseQueue)}s`, "#ffe680");
  else if (s.echoReady) hudLine("ECHO ARMED", "#ffe680");
  if (s.contract) hudLine(spillContractProgress(s), "#cdb3ff");
  // a mission's three objectives ride the top of the run, live
  if (w.lvl && w.lvl.def.base === "spill") {
    const live = { ...w.lvl.stats, ore: s.oreMined, hits: s.hits, depots: s.depotVisits, repairs: s.repairs ?? 0 };
    const pills = w.lvl.def.goals.map((g) => goalHud(g, live, w.score, w.lvl!.def));
    ctx.font = "800 9.5px Figtree, system-ui";
    const padX = 7, gapX = 6, ph = 17, py = hudY - 10;
    const widths = pills.map((p) => ctx.measureText(p.text).width + padX * 2);
    let x = W / 2 - (widths.reduce((a, b) => a + b, 0) + gapX * (pills.length - 1)) / 2;
    ctx.textAlign = "center";
    for (let i = 0; i < pills.length; i++) {
      const p = pills[i];
      ctx.fillStyle = p.state === "done" ? "rgba(52,140,88,.42)"
        : p.state === "lost" ? "rgba(168,44,36,.5)" : "rgba(16,24,44,.55)";
      round(ctx, x, py, widths[i], ph, 8);
      ctx.fill();
      ctx.strokeStyle = p.state === "done" ? "rgba(111,210,144,.8)"
        : p.state === "lost" ? "rgba(255,122,104,.85)" : "rgba(255,255,255,.22)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = p.state === "done" ? "#8df0b4" : p.state === "lost" ? "#ffa294" : "#d7e6f7";
      ctx.fillText(p.text, x + widths[i] / 2, py + 12);
      x += widths[i] + gapX;
    }
    hudY += 14;
  }
  // THE RULE CHIP: the live rule sits beside the controls for the whole
  // wave, with a bar that fills as it phases in, so nothing is a surprise
  if (names && (s.phase === "wave" || s.phase === "drain" || s.phase === "countdown")) {
    ctx.font = "800 11px Figtree, system-ui";
    const label = names;
    const tw = ctx.measureText(label).width;
    // above the DIVE pad while the pads are on, the way the hint card is
    const cx = 16, cy = H - (w.insetTop || 0) - (padsOn ? 156 : 40);
    const cw = tw + 26;
    ctx.fillStyle = "rgba(14,20,38,.8)";
    round(ctx, cx, cy - 15, cw, 30, 15);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,154,76,.55)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.textAlign = "left";
    ctx.fillStyle = "#ff9a4c";
    ctx.fillText(label, cx + 13, cy + 4);
    ctx.fillStyle = "rgba(255,154,76,.3)";
    ctx.fillRect(cx + 13, cy + 9, tw, 2);
    ctx.fillStyle = "#ff9a4c";
    ctx.fillRect(cx + 13, cy + 9, tw * (s.phase === "countdown" ? 0 : spillRamp(s)), 2);
  }
  // the free lesson, while it runs. The DOM flight pads sit on the bottom
  // 110px or so of a phone (plus its safe area), so the card climbs above
  // them while they are on; it sat across the Thrust pad otherwise
  if (!hidePrompts && s.hintT > 0 && s.phase !== "ready" && s.phase !== "depot" && s.phase !== "docking" && s.phase !== "over") {
    drawSpillHint(ctx, w, s.hint, Math.min(1, s.hintT * 2), H - (padsOn ? 156 : 96));
  }
  if (s.phase === "ready" && s.target) {
    const compact = W < 520;
    // a phone gets the same briefing in shorter lines, never a clipped one
    // FOUR LINES, NOT A BRIEFING (owner, 2 Sep 2026: "no need for a half
    // page of text"). The loop is the whole story - survive, collect,
    // Depot, upgrade - and the ore line wears the ore itself.
    // The ore line is kept SHORT on purpose: the ore sprite flanks it, and
    // on a phone a long line pushed the sprites off the panel's edge.
    const lines = [
      "SURVIVE THE WAVES",
      "COLLECT ACORN COINS",
      compact ? "DEPOT EVERY 5 WAVES · UPGRADE THE SHIP"
              : "DEPOT EVERY 5 WAVES · SPEND ACORN COINS",
      compact ? "TAP ▲ FLY · SWIPE ▼ DIVE · SWIPE ▶ LUNGE"
              : "TAP ▲ FLY · SWIPE ▼ DIVE · SWIPE ▲ BURST · SWIPE ▶ LUNGE",
      "TAP TO LAUNCH",
    ];
    const oreLine = 1;
    const lineHeight = compact ? 20 : 21;
    const panelWidth = Math.min(W - 24, compact ? 430 : 560);
    const panelHeight = lines.length * lineHeight + 28;
    const panelTop = Math.min(H - panelHeight - 12, Math.max(96, H * 0.6));
    ctx.fillStyle = "rgba(4,8,20,.78)";
    ctx.strokeStyle = "rgba(201,155,255,.4)";
    ctx.lineWidth = 1;
    round(ctx, W / 2 - panelWidth / 2, panelTop, panelWidth, panelHeight, 12);
    ctx.fill();
    ctx.stroke();
    ctx.textAlign = "center";
    lines.forEach((line, i) => {
      const isLaunch = i === lines.length - 1;
      ctx.fillStyle = isLaunch ? "#ffe086" : i === 0 ? "#fff" : "rgba(215,230,247,.9)";
      ctx.globalAlpha = isLaunch ? 0.75 + 0.25 * Math.sin(w.time * 4) : 1;
      ctx.font = isLaunch ? "900 15px Figtree, system-ui" : i === 0 ? "900 13px Figtree, system-ui" : "800 12px Figtree, system-ui";
      ctx.fillText(line, W / 2, panelTop + 21 + i * lineHeight);
      // the ore, drawn as the thing it is, riding the line that names it
      if (i === oreLine && art?.ore) {
        const tw = ctx.measureText(line).width;
        const y = panelTop + 21 + i * lineHeight - 5;
        drawSprite(ctx, art.ore, W / 2 - tw / 2 - 14, y, 20);
        drawSprite(ctx, art.ore, W / 2 + tw / 2 + 14, y, 20);
      }
    });
    ctx.globalAlpha = 1;
    const titleY = Math.max(H * 0.3, hudY + 24);
    ctx.fillStyle = "#fff";
    ctx.font = "900 30px Figtree, system-ui";
    ctx.fillText("DEBRIS FIELD", W / 2, titleY);
    ctx.fillStyle = "rgba(215,230,247,.8)";
    ctx.font = "600 12px Figtree, system-ui";
    if (compact) {
      ctx.fillText("A mining rig let go one system over.", W / 2, titleY + 22);
      ctx.fillText("What reached us is travelling one way.", W / 2, titleY + 38);
    } else {
      ctx.fillText("A mining rig let go one system over. What reached us is travelling one way.", W / 2, titleY + 22);
    }
  }
  if (s.phase === "countdown") {
    // THE COUNT. The ship flies itself; the hand rests; control returns on
    // the GO and never before. The number is the biggest thing on screen
    const n = spillCount(s);
    const frac = 1 - ((SPILL.countdown - s.phaseT) % 1);
    ctx.save();
    ctx.textAlign = "center";
    ctx.fillStyle = "#fff";
    ctx.font = "900 26px Figtree, system-ui";
    ctx.fillText(`WAVE ${s.wave}`, W / 2, H * 0.34);
    if (names) {
      ctx.fillStyle = "#ff9a4c";
      ctx.font = "800 15px Figtree, system-ui";
      ctx.fillText(names, W / 2, H * 0.34 + 24);
    }
    if (s.target) {
      ctx.fillStyle = "rgba(215,230,247,.8)";
      ctx.font = "700 12px Figtree, system-ui";
      ctx.fillText(`CLEAR WAVE ${s.target} TO FINISH`, W / 2, H * 0.34 + (names ? 44 : 24));
    }
    ctx.globalAlpha = 0.55 + 0.45 * (1 - frac);
    ctx.fillStyle = "#ffe086";
    ctx.font = `900 ${Math.round(64 + 18 * (1 - frac))}px Figtree, system-ui`;
    ctx.fillText(String(n), W / 2, H * 0.34 + 120);
    ctx.globalAlpha = 1;
    ctx.fillStyle = "rgba(215,230,247,.7)";
    ctx.font = "700 11px Figtree, system-ui";
    ctx.fillText(s.manual ? "YOU HAVE THE STICK · FIELD ON GO" : "AUTOPILOT · TAP TO TAKE THE STICK", W / 2, H * 0.34 + 146);
    ctx.restore();
  }
  if (s.phase === "wave" && s.phaseT < 0.6) {
    // the GO, for the half second it takes to read it
    ctx.save();
    ctx.globalAlpha = Math.min(1, (0.6 - s.phaseT) * 3);
    ctx.textAlign = "center";
    ctx.fillStyle = "#8df0b4";
    ctx.font = "900 54px Figtree, system-ui";
    ctx.fillText("GO", W / 2, H * 0.34 + 120);
    ctx.restore();
  }
  if (s.phase === "docking" && !s.depotGag) {
    ctx.textAlign = "center";
    ctx.fillStyle = "#f5d59b";
    ctx.font = "800 12px Figtree, system-ui";
    ctx.fillText("SALVAGE DEPOT", W / 2, H * 0.24);
    ctx.fillStyle = "#f1e9ff"; ctx.font = `800 ${W < 380 ? 21 : 26}px Figtree, system-ui`;
    ctx.fillText(s.phaseT / spillDockTravelDuration(s) < .22 ? "DEPOT IN SIGHT" : s.phaseT / spillDockTravelDuration(s) < .78 ? "APPROACHING THE BAY" : "DOCKING COMPLETE", W / 2, H * 0.24 + 34);
    ctx.fillStyle = "rgba(209,222,246,.78)"; ctx.font = "600 11px Figtree, system-ui";
    ctx.fillText("AUTOPILOT ENGAGED", W / 2, H * 0.24 + 58);
  }
  if (s.phase === "respawn") {
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffe086";
    ctx.font = "900 26px Figtree, system-ui";
    ctx.fillText("RESPAWN CORE", W / 2, H * 0.36);
    ctx.fillStyle = "rgba(215,230,247,.85)";
    ctx.font = "700 12px Figtree, system-ui";
    ctx.fillText("full health · 3 seconds of Gold protection", W / 2, H * 0.36 + 22);
  }
}

export function drawWorld(ctx: CanvasRenderingContext2D, w: World, save: SaveData, art: ArtBank) {
  const { W, H } = w;
  ctx.save();
  if (w.shake > 0) {
    const mag = w.shake * 10;
    ctx.translate((Math.random() - 0.5) * mag, (Math.random() - 0.5) * mag);
  }

  if (w.flight === "tunnel" && w.tunnel) {
    drawTunnelWorld(ctx, w, save, art);
    ctx.restore();
    return;
  }
  if (w.spill) {
    drawSpillWorld(ctx, w, save, art);
    ctx.restore();
    return;
  }

  // Sky stays upright. Warp only tilts the playfield (live does the same).
  if (w.retro) retroBackdrop(ctx, W, H, w.envA, w.envB, w.envBlend, w.stars);
  else drawBackdrop(ctx, w, art);

  ctx.save();
  applyWarp(ctx, w);

  if (w.race) {
    const viewport = raceViewport(w.W, w.H);
    ctx.save();
    ctx.beginPath();
    ctx.rect(viewport.left, viewport.top, viewport.contentWidth, viewport.contentHeight);
    ctx.clip();
    drawHyperRunWorld(ctx, w, save, art);
    ctx.restore();
    ctx.restore();
    ctx.restore();
    return;
  }

  if (w.retro) {
    drawRetroWorld(ctx, w, save, art);
    ctx.restore();
    ctx.restore();
    return;
  }

  // Debris retains its safety rim. Planets get a faint edge only where
  // their color blends with the locally painted background.
  const halo: "dark" | "light" = skyLuma(w) > 0.42 ? "dark" : "light";
  const separationAt = samplePlanetBackdrop(ctx, `${w.envA}:${w.envB}:${w.flight}:${w.W}:${w.H}`, performance.now() / 1000);
  const background = SKY_RGB[skyIdFor(w.flight, w.envB)];
  for (const p of w.planets) {
    const gy = liveGapY(p, w);
    // a bounce-house gate (Space Puppy) keeps one half; every other gate both
    const topY = gy - p.gap / 2 - p.r, botY = gy + p.gap / 2 + p.r;
    if (p.half !== "bot") drawPlanet(ctx, art, p.x, topY, p.r, p.topKind,
      separationAt(p.topKind, p.x, topY, p.r, background));
    if (p.half !== "top") drawPlanet(ctx, art, p.x, botY, p.r, p.botKind,
      separationAt(p.botKind, p.x, botY, p.r, background));
    for (const b of p.blockers) {
      const by = b.y + gateOffset(p, w);
      const bx = blockerX(p, b, w);
      const img = art.debris[b.debris];
      if (img) drawSprite(ctx, img, bx, by, b.r * 2, "core", halo);
      else drawPlanet(ctx, art, bx, by, b.r, b.kind, { mode: halo, opacity: 1 });
    }
  }

  for (const a of w.pickups) {
    if (a.got) continue;
    const y = a.y + Math.sin(a.bob) * 4;
    if (a.kind === "acorn") drawSprite(ctx, frameOf(art.acorn, w.time, 10), a.x, y, 28);
    else if (a.kind === "gold") drawSprite(ctx, frameOf(art.golden, w.time, 10), a.x, y, 32);
    else if (a.kind === "slow") {
      // the frozen acorn is its own painting now — no ring needed to say
      // what it does, the frost says it
      drawSprite(ctx, frameOf(art.frozenAnim, w.time, 10) ?? art.frozen ?? frameOf(art.acorn, w.time, 10), a.x, y, 32);
      ctx.strokeStyle = `rgba(150,225,255,${0.28 + 0.16 * Math.sin(w.time * 6)})`;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(a.x, y, 20 + Math.sin(w.time * 6) * 1.6, 0, Math.PI * 2);
      ctx.stroke();
    } else if (a.kind === "shield") {
      drawSprite(ctx, frameOf(art.shieldAnim, w.time, 10) ?? art.shieldnut, a.x, y, 34);
    }
    else if (a.kind === "hole" || a.kind === "worm") {
      // Both vortices have painted spin cycles now (beta). Full-canvas draw
      // at a fixed footprint: the glow makes each frame's alpha box breathe,
      // so drawSprite's box fit would visibly jitter the size. 16 frames at
      // ~9fps matches the clips' native pacing; the cycles loop seamlessly.
      const spin = frameOf(a.kind === "worm" ? art.wormAnim : art.holeAnim, w.time, 9);
      if (spin) {
        const s = (a.r ?? 28) * 4;
        ctx.drawImage(spin, a.x - s / 2, y - s / 2, s, s);
      } else {
        drawVortex(ctx, a.x, y, a.kind === "worm", w.time, a.r ?? 28);
      }
    } else if (a.kind === "portal") {
      drawFinishPortal(ctx, a.x, y, w.time, a.r ?? 64, warpMirroredNow(w));
    } else if (a.kind === "retro") {
      drawShiftAcorn(ctx, art, a.x, y, w.time);
    }
  }

  for (const p of w.particles) drawParticle(ctx, p);

  {
    // a mission's fog, the lab's, or Satellite's (PAL_FX) - fxOf has them all
    const fx = fxOf(w);
    const px = W * PHYS.squirrelX;
    const py = w.squirrel.y;
    if (fx.fog) {
      // a sight circle: the world exists as far as you can see it
      const sight = Math.max(90, w.H * (0.62 - 0.4 * fx.fog));
      const g = ctx.createRadialGradient(px, py, sight * 0.55, px, py, sight * 1.5);
      g.addColorStop(0, "rgba(4,6,14,0)");
      g.addColorStop(1, `rgba(4,6,14,${(0.55 + 0.43 * fx.fog).toFixed(3)})`);
      ctx.fillStyle = g;
      ctx.fillRect(-w.W, -w.H, w.W * 3, w.H * 3);
    }

  }

  // Nightglider keeps its existing steady-gates effect in the simulation.

  for (const [i, pal] of flyingPals(save, w).entries()) {
    const pos = i === 0 ? w.palPos : w.palPos2;
    const bob = Math.sin(w.time * 2.6 + i * 2.1) * 2;
    paintPal(ctx, art, pal, pos.x, pos.y + bob, 26, w.time);
  }

  drawPilot(ctx, w, save, art);

  // The shield and golden rings belong to the PILOT, so they must be
  // drawn inside the warp transform with him. Outside it they were laid
  // down in untransformed screen space, and in Lost in Space — where the
  // world rotates continuously — they drifted off on their own.
  if (w.invulnLeft > 0) {
    ctx.strokeStyle = `rgba(255,208,96,${0.35 + 0.25 * Math.sin(w.time * 10)})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(W * PHYS.squirrelX, w.squirrel.y, 30, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (w.shieldCharges > 0 && pilotSuitId(w, save) !== "vanguard") {
    ctx.strokeStyle = "rgba(122,216,255,0.45)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(W * PHYS.squirrelX, w.squirrel.y, 26, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
  ctx.restore();
}

type TunnelPalette = {
  bg: [[number, number, number], [number, number, number], [number, number, number], [number, number, number]];
  core: [number, number, number];
  streakA: [number, number, number];
  streakB: [number, number, number];
  ringA: [number, number, number];
  ringB: [number, number, number];
  wall: [[number, number, number], [number, number, number], [number, number, number], [number, number, number]];
  top: [number, number, number];
  bottom: [number, number, number];
};

const TUNNEL_PALETTES: TunnelPalette[] = [
  { bg: [[116,56,214],[37,18,105],[11,18,52],[3,4,13]], core: [151,102,255], streakA: [119,237,255], streakB: [211,123,255], ringA: [151,222,255], ringB: [187,113,255], wall: [[9,7,19],[23,16,45],[56,32,95],[81,48,138]], top: [203,107,255], bottom: [89,202,255] },
  { bg: [[20,174,198],[11,86,118],[5,32,61],[2,9,18]], core: [77,235,255], streakA: [133,255,238], streakB: [83,173,255], ringA: [135,255,239], ringB: [83,172,255], wall: [[3,13,22],[5,35,53],[8,78,95],[17,116,132]], top: [103,255,222], bottom: [83,174,255] },
  { bg: [[213,83,58],[104,28,72],[39,12,48],[9,4,15]], core: [255,143,92], streakA: [255,215,130], streakB: [255,97,181], ringA: [255,208,132], ringB: [255,105,183], wall: [[19,7,13],[48,13,29],[101,29,50],[142,49,65]], top: [255,174,101], bottom: [255,92,177] },
  { bg: [[27,170,120],[8,91,78],[4,40,42],[2,10,16]], core: [92,255,195], streakA: [153,255,184], streakB: [73,220,216], ringA: [142,255,183], ringB: [73,222,216], wall: [[4,16,17],[6,42,38],[10,79,64],[17,118,87]], top: [143,255,179], bottom: [70,224,216] },
  { bg: [[117,31,160],[28,10,59],[8,7,24],[1,2,7]], core: [225,170,255], streakA: [255,226,145], streakB: [198,108,255], ringA: [255,226,148], ringB: [199,112,255], wall: [[6,4,12],[17,9,31],[42,17,64],[73,28,94]], top: [255,218,133], bottom: [197,106,255] },
];

const mixChannel = (a: number, b: number, f: number) => Math.round(a + (b - a) * f);
function mixRgb(a: [number, number, number], b: [number, number, number], f: number): [number, number, number] {
  return [mixChannel(a[0],b[0],f), mixChannel(a[1],b[1],f), mixChannel(a[2],b[2],f)];
}
const rgb = (c: [number, number, number]) => `rgb(${c[0]},${c[1]},${c[2]})`;
const rgba = (c: [number, number, number], a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

function tunnelPalette(w: World): TunnelPalette {
  const t = w.tunnel!;
  const from = TUNNEL_PALETTES[t.previousRegion % TUNNEL_PALETTES.length];
  const to = TUNNEL_PALETTES[t.activeRegion % TUNNEL_PALETTES.length];
  const f = t.regionBlend;
  return {
    bg: from.bg.map((c, i) => mixRgb(c, to.bg[i], f)) as TunnelPalette["bg"],
    core: mixRgb(from.core, to.core, f),
    streakA: mixRgb(from.streakA, to.streakA, f),
    streakB: mixRgb(from.streakB, to.streakB, f),
    ringA: mixRgb(from.ringA, to.ringA, f),
    ringB: mixRgb(from.ringB, to.ringB, f),
    wall: from.wall.map((c, i) => mixRgb(c, to.wall[i], f)) as TunnelPalette["wall"],
    top: mixRgb(from.top, to.top, f),
    bottom: mixRgb(from.bottom, to.bottom, f),
  };
}

function drawTunnelWorld(ctx: CanvasRenderingContext2D, w: World, save: SaveData, art: ArtBank) {
  const { W, H } = w;
  const tunnel = w.tunnel!;
  const palette = tunnelPalette(w);
  const flowGlow = tunnel.multiplier === 3 ? 1.34 : tunnel.multiplier === 2 ? 1.16 : 1;
  const mouth = tunnelBoundsAt(w, W * 0.94);
  const vanishingY = (mouth.top + mouth.bottom) * 0.5;
  const bg = ctx.createRadialGradient(W * 1.04, vanishingY, 8, W * 0.96, vanishingY, Math.max(W, H) * 0.9);
  bg.addColorStop(0, rgb(palette.bg[0]));
  bg.addColorStop(0.18, rgb(palette.bg[1]));
  bg.addColorStop(0.56, rgb(palette.bg[2]));
  bg.addColorStop(1, rgb(palette.bg[3]));
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const tunnelPath = () => {
    ctx.beginPath();
    tunnel.nodes.forEach((n, i) => i ? ctx.lineTo(n.x, n.top) : ctx.moveTo(n.x, n.top));
    for (let i = tunnel.nodes.length - 1; i >= 0; i--) ctx.lineTo(tunnel.nodes[i].x, tunnel.nodes[i].bottom);
    ctx.closePath();
  };

  // All depth cues are clipped to the playable corridor, so the painted
  // wormhole and the collision geometry always agree.
  ctx.save();
  tunnelPath();
  ctx.clip();
  const core = ctx.createRadialGradient(W * 1.03, vanishingY, 0, W * 1.03, vanishingY, W * 1.15);
  core.addColorStop(0, rgba(palette.core, Math.min(0.94, 0.72 * flowGlow)));
  core.addColorStop(0.2, rgba(palette.bottom, 0.22 * flowGlow));
  core.addColorStop(0.55, rgba(palette.bg[2], 0.12));
  core.addColorStop(1, "rgba(0,0,0,.48)");
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, W, H);

  ctx.globalCompositeOperation = "screen";
  for (let i = 0; i < 22; i++) {
    const phase = ((i * 73 - w.distance * (0.55 + (i % 5) * 0.05)) % (W + 180) + W + 180) % (W + 180) - 90;
    const b = tunnelBoundsAt(w, phase);
    const y = b.top + (b.bottom - b.top) * ((i * 0.417) % 1);
    const len = 22 + (i % 6) * 9 + w.speed * 0.055;
    ctx.strokeStyle = i % 3 === 0 ? rgba(palette.streakA, 0.34 * flowGlow) : rgba(palette.streakB, 0.25 * flowGlow);
    ctx.lineWidth = 0.8 + (i % 3) * 0.65;
    ctx.beginPath();
    ctx.moveTo(phase - len, y + (y - vanishingY) * 0.035);
    ctx.lineTo(phase + 5, y);
    ctx.stroke();
  }

  for (let x = W + 40 - ((w.distance * 0.82) % 76); x > -55; x -= 76) {
    const b = tunnelBoundsAt(w, x);
    const cy = (b.top + b.bottom) * 0.5;
    const half = (b.bottom - b.top) * 0.5;
    const depth = Math.max(0, Math.min(1, (x + 55) / (W + 95)));
    ctx.strokeStyle = rgba(depth > 0.55 ? palette.ringA : palette.ringB, (0.07 + depth * 0.16) * flowGlow);
    ctx.lineWidth = 0.8 + depth * 1.7;
    ctx.beginPath();
    ctx.ellipse(x, cy, 8 + depth * 17, Math.max(12, half * 0.94), 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalCompositeOperation = "source-over";
  ctx.restore();

  const wall = (top: boolean) => {
    // Both walls run dark at the outer screen edge to bright at the live
    // collision boundary. Mirroring the gradient keeps the lower wall
    // from collapsing into one flat final-stop color.
    const g = top
      ? ctx.createLinearGradient(0, 0, W, H * 0.28)
      : ctx.createLinearGradient(0, H, W, H * 0.72);
    g.addColorStop(0, rgb(palette.wall[0]));
    g.addColorStop(0.45, rgb(palette.wall[1]));
    g.addColorStop(0.78, rgb(palette.wall[2]));
    g.addColorStop(1, rgb(palette.wall[3]));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(tunnel.nodes[0].x, top ? 0 : H);
    for (const n of tunnel.nodes) ctx.lineTo(n.x, top ? n.top : n.bottom);
    ctx.lineTo(tunnel.nodes[tunnel.nodes.length - 1].x, top ? 0 : H);
    ctx.closePath();
    ctx.fill();
  };
  wall(true);
  wall(false);

  // Layered contours give the walls thickness without adding fake hitboxes.
  for (const offset of [12, 28, 48]) {
    for (const top of [true, false]) {
      ctx.strokeStyle = rgba(top ? palette.top : palette.bottom, (0.17 - offset * 0.0018) * flowGlow);
      ctx.lineWidth = offset === 12 ? 2 : 1;
      ctx.beginPath();
      tunnel.nodes.forEach((n, i) => {
        const y = (top ? n.top - offset : n.bottom + offset) + Math.sin(n.index * 0.52 + tunnel.visualT * 1.8) * 2;
        if (i === 0) ctx.moveTo(n.x, y); else ctx.lineTo(n.x, y);
      });
      ctx.stroke();
    }
  }
  for (const top of [true, false]) {
    ctx.strokeStyle = rgba(top ? palette.top : palette.bottom, 0.96);
    ctx.shadowColor = rgb(top ? palette.top : palette.bottom);
    ctx.shadowBlur = 14 * flowGlow;
    ctx.lineWidth = 4;
    ctx.beginPath();
    tunnel.nodes.forEach((n, i) => {
      const y = top ? n.top : n.bottom;
      if (i === 0) ctx.moveTo(n.x, y); else ctx.lineTo(n.x, y);
    });
    ctx.stroke();
  }
  ctx.shadowBlur = 0;

  // Debris is born beyond the right edge. This edge beacon appears about
  // a second before impact range, buying reaction time without drawing a
  // fake safe path through the real collision geometry.
  for (const h of tunnel.hazards) {
    if (h.x < W - 28 || h.x > W + 190) continue;
    const eta = Math.max(0, Math.min(1, (h.x - (W - 28)) / 218));
    const pulse = 0.58 + Math.sin(w.time * 9) * 0.22;
    ctx.save();
    ctx.globalAlpha = (1 - eta * 0.45) * pulse;
    const guide = () => {
      ctx.beginPath();
      ctx.moveTo(W - 25, h.y); ctx.lineTo(W, h.y);
      ctx.stroke();
    };
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = "rgba(18,3,15,.96)";
    ctx.lineWidth = 5;
    guide();
    ctx.strokeStyle = "#fff0d2";
    ctx.lineWidth = 1.8;
    guide();
    ctx.setLineDash([]);
    const chevron = () => {
      ctx.beginPath();
      ctx.moveTo(W - 22, h.y);
      ctx.lineTo(W - 8, h.y - 9);
      ctx.lineTo(W - 8, h.y + 9);
      ctx.closePath();
    };
    chevron(); ctx.fillStyle = "rgba(255,90,76,.72)"; ctx.fill();
    chevron(); ctx.strokeStyle = "rgba(18,3,15,.96)"; ctx.lineWidth = 5; ctx.stroke();
    chevron(); ctx.strokeStyle = "#fff0d2"; ctx.lineWidth = 1.8; ctx.stroke();
    ctx.restore();
  }

  for (const h of tunnel.hazards) {
    ctx.save();
    ctx.translate(h.x, h.y);
    ctx.rotate(tunnel.visualT * h.spin);
    const rock = art.debris[h.art % Math.max(1, art.debris.length)];
    if (rock) drawSprite(ctx, rock, 0, 0, h.r * 2.35, "core", "light");
    else {
      ctx.fillStyle = "#6e5a79";
      ctx.beginPath(); ctx.arc(0, 0, h.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    ctx.strokeStyle = "rgba(18,3,15,.88)";
    ctx.lineWidth = 4.5;
    ctx.beginPath(); ctx.arc(h.x, h.y, h.r + 5, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = `rgba(255,244,218,${0.68 + 0.18 * Math.sin(w.time * 5)})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(h.x, h.y, h.r + 5, 0, Math.PI * 2); ctx.stroke();
  }

  for (const a of w.pickups) {
    if (a.got) continue;
    const y = a.y + Math.sin(a.bob) * 4;
    if (a.kind === "multiplier") {
      ctx.strokeStyle = "rgba(255,238,128,.85)";
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(a.x, y, 21 + Math.sin(w.time * 5) * 2, 0, Math.PI * 2); ctx.stroke();
      drawSprite(ctx, frameOf(art.golden, w.time, 10) ?? frameOf(art.acorn, w.time, 10), a.x, y, 33);
      ctx.fillStyle = "#fff"; ctx.font = "900 10px Figtree, system-ui"; ctx.textAlign = "center";
      ctx.fillText("FLOW", a.x, y + 4);
    } else if (a.kind === "slow") {
      drawSprite(ctx, frameOf(art.frozenAnim, w.time, 10) ?? art.frozen ?? frameOf(art.acorn, w.time, 10), a.x, y, 33);
      ctx.strokeStyle = `rgba(150,225,255,${0.35 + 0.2 * Math.sin(w.time * 6)})`;
      ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.arc(a.x, y, 21 + Math.sin(w.time * 6) * 2, 0, Math.PI * 2); ctx.stroke();
    } else if (a.exit) {
      // THE WAY HOME, and it has to read as a door from across the screen.
      // The corridor's own else-branch drew every unknown kind as an acorn,
      // which would have made the exit look like one more pickup to graze
      // past - the opposite of the one thing the pilot must aim at.
      const spin = frameOf(art.wormAnim, w.time, 9);
      const r = a.r ?? 46;
      if (spin) {
        const sz = r * 4;
        ctx.drawImage(spin, a.x - sz / 2, y - sz / 2, sz, sz);
      } else {
        drawVortex(ctx, a.x, y, true, w.time, r);
      }
      ctx.strokeStyle = `rgba(201,140,255,${0.45 + 0.3 * Math.sin(w.time * 5)})`;
      ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.arc(a.x, y, r + 6 + Math.sin(w.time * 5) * 3, 0, Math.PI * 2); ctx.stroke();
    } else drawSprite(ctx, frameOf(art.acorn, w.time, 10), a.x, y, 28);
  }
  for (const p of w.particles) drawParticle(ctx, p);
  if (w.powerLeft > 0) {
    const frost = ctx.createRadialGradient(W * PHYS.squirrelX, w.squirrel.y, 25, W * PHYS.squirrelX, w.squirrel.y, Math.max(W,H) * 0.72);
    frost.addColorStop(0, "rgba(130,225,255,0)");
    frost.addColorStop(1, "rgba(82,188,255,.13)");
    ctx.fillStyle = frost;
    ctx.fillRect(0, 0, W, H);
  }
  for (const [i, pal] of runPals(save, w).entries()) {
    const pos = i === 0 ? w.palPos : w.palPos2;
    const bob = Math.sin(w.time * 2.6 + i * 2.1) * 2;
    paintPal(ctx, art, pal, pos.x, pos.y + bob, 26, w.time);
  }
  drawPilot(ctx, w, save, art);
}

// The other timeline. Same planets in the same places, same rocks with
// the same seeds — only the hand painting them changes. Everything a
// player can touch comes from the identical world objects, so a shift
// never changes what is solid, only what it looks like.
function drawRetroWorld(
  ctx: CanvasRenderingContext2D, w: World, save: SaveData, art: ArtBank,
) {
  const { W } = w;
  for (const p of w.planets) {
    const gy = liveGapY(p, w);
    if (p.half !== "bot") retroPlanet(ctx, p.x, gy - p.gap / 2 - p.r, p.r, p.topKind);
    if (p.half !== "top") retroPlanet(ctx, p.x, gy + p.gap / 2 + p.r, p.r, p.botKind);
    for (const b of p.blockers) {
      const by = b.y + gateOffset(p, w);
      // blockerX, NOT p.x + b.xOff (audit, 8 Sep 2026). Every rock drifts
      // along the flight axis by up to its own radius, and the COLLIDER
      // reads that drift (see the blockerX calls in sim). Painting the home
      // position instead put the picture up to a full rock-width away from
      // the thing that kills you: the pilot threaded visibly clear and
      // died, or flew through a painted rock untouched. The illustrated
      // painter above already reads it the same way.
      retroObstacle(ctx, blockerX(p, b, w), by, { r: b.r, ...retroBlocker(w.envB, b.debris, b.y) });
    }
  }

  for (const a of w.pickups) {
    if (a.got) continue;
    const y = a.y + Math.sin(a.bob) * 4;
    if (a.kind === "retro") {
      drawShiftAcorn(ctx, art, a.x, y, w.time);
      continue;
    }
    // THE DOOR HAS TO READ AS A DOOR (audit, 8 Sep 2026). Every arcade-based
    // Star Chart mission ends on a portal, and this loop had no case for it:
    // it fell through the chain to `a.kind === "slow"`, i.e. false, and the
    // arrival marker was painted as an ordinary brown acorn - the very thing
    // the pilot has spent the run grazing past - over a 64px hitbox. The
    // corridor painter learned this lesson already; so does this one.
    if (a.kind === "portal") {
      drawFinishPortal(ctx, a.x, y, w.time, a.r ?? 64, warpMirroredNow(w));
      continue;
    }
    const power =
      a.kind === "gold" ? "golden"
        : a.kind === "shield" ? "shield"
          : a.kind === "hole" ? "blackhole"
            : a.kind === "worm" ? "wormhole"
              : a.kind === "slow";
    retroAcorn(ctx, a.x, y, power);
  }

  for (const p of w.particles) drawParticle(ctx, p);

  {
    // a mission's fog, the lab's, or Satellite's (PAL_FX) - fxOf has them all
    const fx = fxOf(w);
    const px = W * PHYS.squirrelX;
    const py = w.squirrel.y;
    if (fx.fog) {
      // a sight circle: the world exists as far as you can see it
      const sight = Math.max(90, w.H * (0.62 - 0.4 * fx.fog));
      const g = ctx.createRadialGradient(px, py, sight * 0.55, px, py, sight * 1.5);
      g.addColorStop(0, "rgba(4,6,14,0)");
      g.addColorStop(1, `rgba(4,6,14,${(0.55 + 0.43 * fx.fog).toFixed(3)})`);
      ctx.fillStyle = g;
      ctx.fillRect(-w.W, -w.H, w.W * 3, w.H * 3);
    }

  }

  for (const [i, pal] of flyingPals(save, w).entries()) {
    const pos = i === 0 ? w.palPos : w.palPos2;
    const bob = Math.sin(w.time * 2.6 + i * 2.1) * 2;
    // live draws its pals at unit SCALE, not at a pixel size - but only
    // the companions its vector kit actually has. A pal it has never
    // heard of used to be painted as nothing here; it keeps its painted
    // still instead, at the size the illustrated timeline flies it.
    if (canDrawPal(pal)) drawPalOn(ctx, pal, pos.x, pos.y + bob, 1, w.time);
    else paintPal(ctx, art, pal, pos.x, pos.y + bob, 26, w.time);
  }

  const wornId = pilotSuitId(w, save);
  const helm = helmetWornBy(save.equipped, wornId);
  const suit = SUITS.find((u) => u.id === wornId) ?? SUITS[0];
  paintLiveStarTrail(ctx, w, trailWornBy(save.equippedTrail, wornId), {
    time: w.time, x: W * PHYS.squirrelX - 25, y: w.squirrel.y + 8,
    travel: w.distance, scale: 1, power: Math.min(1, Math.max(0, w.flapBoost) / .22),
    active: !w.ready && w.screen === "play",
  }, w.screen === "pause" || w.screen === "lvldone");
  drawAstronautOn(ctx, W * PHYS.squirrelX, w.squirrel.y, w.squirrel.rot, 1, helm, suit, {
    flame: w.flapBoost > 0 ? w.flapBoost / 0.22 : 0,
    seed: 0,
    shield: w.shieldCharges > 0,
  });
}

// The door itself. Painted in the arcade's own pixels either way, so it
// reads the same from both sides — this is the one object that belongs
// to neither timeline.
function drawShiftAcorn(
  ctx: CanvasRenderingContext2D, art: ArtBank, x: number, y: number, t: number,
) {
  const spr = art.arcadeAcorn;
  const glow = 20 + Math.sin(t * 5) * 4;
  const g = ctx.createRadialGradient(x, y, 2, x, y, glow + 12);
  g.addColorStop(0, "rgba(255,214,96,0.55)");
  g.addColorStop(0.5, "rgba(255,170,40,0.22)");
  g.addColorStop(1, "rgba(255,170,40,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, glow + 12, 0, Math.PI * 2);
  ctx.fill();
  // the four cardinal sparks from the source art, kept as real pixels
  ctx.fillStyle = "#ffd83f";
  const d = 20 + Math.sin(t * 5) * 2;
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + t * 0.8;
    ctx.fillRect(Math.round(x + Math.cos(a) * d) - 2, Math.round(y + Math.sin(a) * d) - 2, 4, 4);
  }
  if (spr) {
    ctx.imageSmoothingEnabled = false;
    drawSprite(ctx, spr, x, y, 30);
    ctx.imageSmoothingEnabled = true;
  }
}

// The finish line. It borrows the wormhole's language — a swirl you fly
// into — but in gold and green, the game's reward colours, so it reads as
// an arrival on first sight.
// Whether applyWarp() has the playfield horizontally mirrored RIGHT NOW —
// the same wp math it uses, reduced to the sign of its x-scale. World-space
// text must counter-flip by this, or a black hole near the finish leaves
// the FINISH banner reading backwards.
function warpMirroredNow(w: World) {
  const lost = w.flight === "lost";
  const wp = w.warpT > 0 ? 1 - w.warpT : w.warpLeft > 0 || w.warpGateEnd >= 0 || lost ? 1 : 0;
  if (wp <= 0) return false;
  const mFrom = w.prevMirror ? -1 : 1;
  const mTo = w.warpMirror ? -1 : 1;
  return mFrom + (mTo - mFrom) * wp < 0;
}

function drawFinishPortal(ctx: CanvasRenderingContext2D, x: number, y: number, t: number, reach = 64, mirrored = false) {
  const k = reach / 28;
  const pulse = (12 + Math.sin(t * 4) * 3) * k;
  const grd = ctx.createRadialGradient(x, y, 2 * k, x, y, pulse + 14 * k);
  grd.addColorStop(0, "#fff8dc");
  grd.addColorStop(0.4, "#ffd060");
  grd.addColorStop(0.75, "rgba(93,255,158,0.5)");
  grd.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.arc(x, y, pulse + 14 * k, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(t * 1.6);
  ctx.strokeStyle = "rgba(255,224,128,0.75)";
  ctx.lineWidth = 2.2;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.arc(0, 0, (7 + i * 5.5) * k * 0.55, i * 1.3, i * 1.3 + 2.4);
    ctx.stroke();
  }
  ctx.restore();
  ctx.textAlign = "center";
  ctx.font = "800 13px Figtree, system-ui";
  ctx.fillStyle = `rgba(255,236,180,${0.75 + 0.25 * Math.sin(t * 5)})`;
  ctx.save();
  ctx.translate(x, y - reach - 8);
  if (mirrored) ctx.scale(-1, 1);
  ctx.fillText("FINISH", 0, 0);
  ctx.restore();
  ctx.textAlign = "left";
}

function drawVortex(
  ctx: CanvasRenderingContext2D, x: number, y: number, worm: boolean, t: number, reach = 28,
) {
  // the swirl fills its reach: a hazard you can see the full width of
  const k = reach / 28;
  const pulse = (12 + Math.sin(t * 6) * 3) * k;
  const grd = ctx.createRadialGradient(x, y, 2 * k, x, y, pulse + 14 * k);
  grd.addColorStop(0, worm ? "#d8f6ff" : "#1a1028");
  grd.addColorStop(0.45, worm ? "#4ad8ff" : "#6a2a9a");
  grd.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.arc(x, y, pulse + 14 * k, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(t * (worm ? 3 : -2.2));
  ctx.strokeStyle = worm ? "rgba(180,240,255,0.55)" : "rgba(180,90,255,0.45)";
  ctx.lineWidth = 1.4 * Math.max(1, k * 0.7);
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.arc(0, 0, (6 + i * 5) * k, i, i + 2.2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawParticle(ctx: CanvasRenderingContext2D, p: Particle) {
  const t = Math.max(0, p.life / p.max);
  ctx.globalAlpha = t;
  const kind = p.kind || "spark";
  if (kind === "vanguardwake") {
    ctx.strokeStyle=p.color;ctx.lineWidth=Math.max(.6,p.r*t);ctx.lineCap="round";
    ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x+8*t,p.y);ctx.stroke();
  } else if (kind === "ion") {
    ctx.strokeStyle = t > 0.5 ? "#c8f4ff" : "#3ac0f0";
    ctx.lineWidth = Math.max(0.8, p.r * t);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + 9, p.y);
    ctx.stroke();
  } else if (kind === "bubble") {
    ctx.strokeStyle = "rgba(170,220,255,0.9)";
    ctx.lineWidth = 1;
    const br = t > 0.25 ? p.r : p.r * (1 + (0.25 - t) * 6);
    ctx.beginPath();
    ctx.arc(p.x, p.y, br, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "rgba(200,235,255,0.25)";
    ctx.beginPath();
    ctx.arc(p.x - p.r * 0.3, p.y - p.r * 0.3, p.r * 0.28, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === "bloom") {
    ctx.fillStyle = t > 0.5 ? "#f0b8ff" : "#a45cd8";
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * (2 - t), 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = t * 0.5;
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * 0.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === "comet") {
    const len = 10 + p.r * 3;
    const grad = ctx.createLinearGradient(p.x, p.y, p.x + len, p.y);
    grad.addColorStop(0, "#fff8d0");
    grad.addColorStop(0.4, "#ff9d47");
    grad.addColorStop(1, "rgba(255,64,32,0)");
    ctx.strokeStyle = grad;
    ctx.lineWidth = Math.max(1, p.r * t);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + len, p.y);
    ctx.stroke();
  } else if (kind === "cometcore") {
    ctx.fillStyle = "#fff8d0";
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * t, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === "prism") {
    ctx.fillStyle = `hsl(${p.hue || 0} 90% 65%)`;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(((p.hue || 0) * Math.PI) / 180);
    ctx.fillRect(-p.r, -p.r * 0.4, p.r * 2, p.r * 0.8);
    ctx.restore();
  } else if (kind === "plasma") {
    ctx.strokeStyle = "#b45cff";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    const seed = p.seed || 1;
    ctx.lineTo(p.x + 8, p.y + Math.sin(seed) * 6);
    ctx.lineTo(p.x + 16, p.y - Math.cos(seed) * 4);
    ctx.stroke();
  } else if (kind === "plasmacore") {
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === "galaxy") {
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * t, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = t * 0.5;
    ctx.fillStyle = "#fff";
    ctx.fillRect(p.x - 0.6, p.y - 2.4, 1.2, 4.8);
    ctx.fillRect(p.x - 2.4, p.y - 0.6, 4.8, 1.2);
  } else if (kind === "aurora") {
    ctx.fillStyle = p.color;
    ctx.globalAlpha = t * 0.55;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, p.r * 2.2, p.r * 0.7, 0.4, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === "frost") {
    ctx.strokeStyle = "#9fe4ff";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - p.r);
    ctx.lineTo(p.x, p.y + p.r);
    ctx.moveTo(p.x - p.r, p.y);
    ctx.lineTo(p.x + p.r, p.y);
    ctx.stroke();
  } else if (kind === "voidsmoke") {
    ctx.fillStyle = p.color;
    ctx.globalAlpha = t * 0.35;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * (1.6 - t), 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === "supernova") {
    ctx.fillStyle = t > 0.5 ? "#fff8d0" : t > 0.25 ? "#ff9d47" : "#ff4020";
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * (1.4 - t * 0.4), 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === "opalfeather") {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(((p.hue || 0) * Math.PI) / 180);
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 5;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.moveTo(-p.r * 2.1, 0);
    ctx.quadraticCurveTo(-p.r * 0.2, -p.r * 1.15, p.r * 1.7, 0);
    ctx.quadraticCurveTo(-p.r * 0.2, p.r * 0.75, -p.r * 2.1, 0);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.78)";
    ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.moveTo(-p.r * 1.6, 0); ctx.lineTo(p.r * 1.4, 0); ctx.stroke();
    ctx.restore();
  } else if (kind === "clockwork") {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(((p.hue || 0) * Math.PI) / 180);
    ctx.strokeStyle = p.color;
    ctx.fillStyle = "rgba(255,224,145,.16)";
    ctx.lineWidth = Math.max(0.8, p.r * 0.28);
    ctx.shadowColor = "#f4b94f";
    ctx.shadowBlur = 3;
    for (let i = 0; i < 8; i++) {
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(p.r * 0.78, -p.r * 0.28, p.r * 0.62, p.r * 0.56);
    }
    ctx.beginPath(); ctx.arc(0, 0, p.r, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, p.r * 0.34, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  } else if (kind === "celestialtide") {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.strokeStyle = p.color;
    ctx.lineCap = "round";
    ctx.lineWidth = Math.max(0.8, p.r * 0.36);
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 5;
    const wave = Math.sin((p.seed || 0) + p.x * 0.04) * p.r;
    ctx.beginPath();
    ctx.moveTo(-p.r * 2.2, wave * 0.25);
    ctx.quadraticCurveTo(-p.r * 0.4, -p.r * 1.35, p.r * 1.7, wave * 0.4);
    ctx.stroke();
    ctx.globalAlpha = t * 0.55;
    ctx.beginPath();
    ctx.moveTo(-p.r * 1.7, p.r * 0.8);
    ctx.quadraticCurveTo(0, -p.r * 0.25, p.r * 1.4, p.r * 0.7);
    ctx.stroke();
    ctx.restore();
  } else if (kind === "phoenixplume") {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(-0.3 + ((p.hue || 0) * Math.PI) / 360);
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 6;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.moveTo(-p.r * 2.4, p.r * 0.2);
    ctx.quadraticCurveTo(-p.r * 0.4, -p.r * 1.7, p.r * 1.5, -p.r * 0.35);
    ctx.quadraticCurveTo(p.r * 0.2, p.r * 0.1, p.r * 1.15, p.r * 1.15);
    ctx.quadraticCurveTo(-p.r * 0.6, p.r * 0.7, -p.r * 2.4, p.r * 0.2);
    ctx.fill();
    ctx.strokeStyle = "#fff3bd";
    ctx.lineWidth = 0.75;
    ctx.beginPath(); ctx.moveTo(-p.r * 1.8, p.r * 0.18); ctx.lineTo(p.r, 0); ctx.stroke();
    ctx.restore();
  } else if (kind === "verdantflourish") {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(((p.hue || 0) * Math.PI) / 180);
    ctx.shadowColor = "#55e89d";
    ctx.shadowBlur = 5;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.moveTo(-p.r * 1.6, 0);
    ctx.quadraticCurveTo(0, -p.r * 1.45, p.r * 1.65, 0);
    ctx.quadraticCurveTo(0, p.r * 1.15, -p.r * 1.6, 0);
    ctx.fill();
    ctx.strokeStyle = "rgba(235,255,216,.85)";
    ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.moveTo(-p.r * 1.25, 0); ctx.lineTo(p.r * 1.25, 0); ctx.stroke();
    ctx.fillStyle = "#efffc8";
    ctx.beginPath(); ctx.arc(-p.r * 1.8, -p.r, 0.65, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  } else if (kind === "eclipseglyph") {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(((p.hue || 0) * Math.PI) / 180);
    ctx.strokeStyle = p.color;
    ctx.lineWidth = Math.max(0.8, p.r * 0.3);
    ctx.shadowColor = "#c77dff";
    ctx.shadowBlur = 6;
    ctx.beginPath(); ctx.arc(0, 0, p.r, 0.55, Math.PI * 1.72); ctx.stroke();
    ctx.globalAlpha = t * 0.7;
    ctx.beginPath(); ctx.arc(0, 0, p.r * 1.55, 3.5, 5.75); ctx.stroke();
    ctx.fillStyle = "#ffe2bd";
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(p.r * 1.35, -0.75, 1.5, 1.5);
    ctx.restore();
  } else {
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * t, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawPlanet(
  ctx: CanvasRenderingContext2D,
  art: ArtBank,
  x: number,
  y: number,
  r: number,
  kind: number,
  halo?: PlanetHalo,
) {
  const img = art.planets[kind];
  if (img) {
    drawSprite(ctx, img, x, y, r * 2, "core", halo?.mode, halo?.opacity);
    return;
  }
  const color = PLANET_RGB[kind] ?? [0.3, 0.3, 0.3];
  ctx.fillStyle = `rgb(${color.map(c => Math.round(c * 255)).join(",")})`;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  if (halo) {
    ctx.save();
    ctx.strokeStyle = halo.mode === "light" ? `rgba(190,205,220,${0.2 * halo.opacity})` : `rgba(8,12,20,${0.3 * halo.opacity})`;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }
}

function hexRgb(hex: string) {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h[0] + h[0] + h[1] + h[1] + h[2] + h[2] : h;
  const n = parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

// Head sockets measured against the unchanged 256px suit paintings.
// Flight's still, climb and dive rows were refitted by the owner's eye on
// the rig editor, 5 Oct 2026 (the old still was 14% larger than its own
// frames and both were well over the painted skull: "it's helmet is huge").
// Ion, Copper, Frost, Void, Ember, Ghost, Gemmie, Sammie and Leviathan
// followed, each off the 206/106/36 family template and onto its own
// painted skull; Robo's still and tap bank, and Seraph's ramp, the same.
// Big Booty's tap bank and the Verdant, Cryostar, Eclipse and Gemmie ramps
// carry a radius PER FRAME, the owner's call (6 Oct 2026: "use my values
// first everywhere, then gate later if not work"); the no-size-pulse gates
// stand down for those (helmet-art-baseline.json per_frame_radii).
// Refitted 28 Sep 2026 with independent helmet cavities; see
// design/helmet-fit-all/REVIEW.md. The socket follows ears and muzzle, and
// its neck ring follows the painted collar instead of the body's lean.
// x/y are source-space centers, r is the fitted head radius, and the
// optional fourth value is local head/collar rotation in degrees. Frame
// timing, body transforms, artwork and glass masks are independent of this
// table and stay unchanged. Static portraits and oversized painted neutral
// heads may need different radii from the remaining motion bank.
const DOME: Record<string, [number, number, number] | [number, number, number, number]> = {
  "idle-1": [192, 106, 56],
  "idle-2": [192, 103, 51],
  "idle-3": [192, 102, 53],
  "idle-4": [194, 99, 51],
  "flap-1": [169, 86, 48],
  "flap-2": [164, 93, 50],
  "flap-3": [164, 79, 48],
  "flap-4": [163, 80, 45],
  // Static portraits; each radius fits that painting's head, not its body box.
  // Five beta suits: whole-frame skull registration from beta-flight-refresh.
  "suit:robo": [184, 98, 32.71, 0],
  "suit:catsuit": [212, 86, 50],
  "suit:phoenix": [207, 92, 41],
  // robo — pose-specific head and collar registration.
  "robo-tap-1": [193, 102, 34.24, 0],
  "robo-tap-2": [193, 102, 34.24, 0],
  "robo-tap-3": [193, 100, 34.24, 0],
  "robo-tap-4": [194, 95, 34.24, 0],
  "robo-tap-5": [194, 87, 34.24, 0],
  "robo-tap-6": [195, 81, 34.24, 0],
  "robo-tap-7": [195, 79, 34.24, 0],
  "robo-tap-8": [194, 83, 34.24, 0],
  "robo-tap-9": [193, 92, 34.24, 0],
  "robo-tap-10": [192, 102, 34.24, 0],
  "robo-tap-11": [192, 109, 34.24, 0],
  "robo-tap-12": [193, 110, 34.24, 0],
  "robo-tap-13": [194, 109, 34.24, 0],
  "robo-tap-14": [195, 106, 34.24, 0],
  "robo-tap-15": [194, 103, 34.24, 0],
  "robo-tap-16": [194, 99, 34.24, 0],
  // THE 3D LINEUP (26 Oct 2026): measured, not placed - tools/rig3d projects each
  // frame's 3D head through the render camera (anchors.json). Centre and tilt are
  // per frame; the radius is the suit's median, so the glass never resizes.
  "suit:ember": [183.97, 101.49, 27.22, 1.83],
  "ember-tap-1": [183.97, 101.49, 27.22, 1.83],
  "ember-tap-2": [182.77, 98.45, 27.22, -1.85],
  "ember-tap-3": [181.94, 96.94, 27.22, -4.19],
  "ember-tap-4": [181.82, 97.21, 27.22, -4.57],
  "ember-tap-5": [182.4, 99.17, 27.22, -2.88],
  "ember-tap-6": [183.41, 102.43, 27.22, 0.42],
  "ember-tap-7": [184.43, 106.21, 27.22, 4.44],
  "ember-tap-8": [185.21, 109.5, 27.22, 8.08],
  "ember-tap-9": [185.7, 111.34, 27.22, 10.39],
  "ember-tap-10": [185.89, 111.13, 27.22, 10.77],
  "ember-tap-11": [185.7, 108.89, 27.22, 9.1],
  "ember-tap-12": [185.04, 105.32, 27.22, 5.84],
  "ember-desc-1": [183.97, 101.49, 27.22, 1.83],
  "ember-desc-2": [184.95, 115.48, 27.22, 15.54],
  "ember-desc-3": [184.68, 129.78, 27.22, 28.72],
  "ember-desc-4": [181.15, 142.71, 27.22, 41.18],
  "suit:voidsuit": [182.69, 112.11, 27.72, 1.82],
  "voidsuit-tap-1": [182.69, 112.11, 27.72, 1.82],
  "voidsuit-tap-2": [181.35, 109.62, 27.72, -1.87],
  "voidsuit-tap-3": [180.35, 108.38, 27.72, -4.22],
  "voidsuit-tap-4": [180.08, 108.59, 27.72, -4.6],
  "voidsuit-tap-5": [180.57, 110.24, 27.72, -2.91],
  "voidsuit-tap-6": [181.58, 112.9, 27.72, 0.4],
  "voidsuit-tap-7": [182.71, 116.05, 27.72, 4.43],
  "voidsuit-tap-8": [183.65, 118.83, 27.72, 8.09],
  "voidsuit-tap-9": [184.28, 120.4, 27.72, 10.4],
  "voidsuit-tap-10": [184.61, 120.22, 27.72, 10.78],
  "voidsuit-tap-11": [184.51, 118.34, 27.72, 9.11],
  "voidsuit-tap-12": [183.87, 115.32, 27.72, 5.84],
  "voidsuit-desc-1": [182.69, 112.11, 27.72, 1.82],
  "voidsuit-desc-2": [183.49, 123.89, 27.72, 15.57],
  "voidsuit-desc-3": [182.95, 135.88, 27.72, 28.77],
  "voidsuit-desc-4": [179.66, 147.47, 27.72, 41.24],
  "suit:groveguard": [187.04, 110.31, 26.17, 1.73],
  "groveguard-tap-1": [187.04, 110.31, 26.17, 1.73],
  "groveguard-tap-2": [185.86, 108.17, 26.17, -1.93],
  "groveguard-tap-3": [185.03, 107.18, 26.17, -4.27],
  "groveguard-tap-4": [184.88, 107.51, 26.17, -4.65],
  "groveguard-tap-5": [185.42, 109.06, 26.17, -2.96],
  "groveguard-tap-6": [186.36, 111.5, 26.17, 0.33],
  "groveguard-tap-7": [187.34, 114.26, 26.17, 4.34],
  "groveguard-tap-8": [188.07, 116.58, 26.17, 7.97],
  "groveguard-tap-9": [188.52, 117.79, 26.17, 10.28],
  "groveguard-tap-10": [188.73, 117.5, 26.17, 10.65],
  "groveguard-tap-11": [188.64, 115.76, 26.17, 8.99],
  "groveguard-tap-12": [188.1, 113.09, 26.17, 5.73],
  "groveguard-desc-1": [187.04, 110.31, 26.17, 1.73],
  "groveguard-desc-2": [187.89, 120.87, 26.17, 15.42],
  "groveguard-desc-3": [186.57, 132.56, 26.17, 28.58],
  "groveguard-desc-4": [183.01, 144.6, 26.17, 41.04],
  "suit:cinderforge": [185.02, 106.88, 27.18, 1.8],
  "cinderforge-tap-1": [185.02, 106.88, 27.18, 1.8],
  "cinderforge-tap-2": [183.7, 104.15, 27.18, -1.88],
  "cinderforge-tap-3": [182.9, 102.97, 27.18, -4.22],
  "cinderforge-tap-4": [182.69, 103.4, 27.18, -4.6],
  "cinderforge-tap-5": [183.1, 105.19, 27.18, -2.91],
  "cinderforge-tap-6": [183.85, 108.2, 27.18, 0.39],
  "cinderforge-tap-7": [185.68, 111.58, 27.18, 4.41],
  "cinderforge-tap-8": [187.28, 114.16, 27.18, 8.05],
  "cinderforge-tap-9": [188.33, 115.42, 27.18, 10.36],
  "cinderforge-tap-10": [188.68, 115.06, 27.18, 10.73],
  "cinderforge-tap-11": [188.21, 113.11, 27.18, 9.07],
  "cinderforge-tap-12": [186.91, 110.17, 27.18, 5.81],
  "cinderforge-desc-1": [185.02, 106.88, 27.18, 1.8],
  "cinderforge-desc-2": [188.8, 119.63, 27.18, 15.51],
  "cinderforge-desc-3": [189.89, 132.77, 27.18, 28.69],
  "cinderforge-desc-4": [188.62, 146.22, 27.18, 41.14],
  "suit:sunforged": [184.69, 105.65, 27.04, 1.79],
  "sunforged-tap-1": [184.69, 105.65, 27.04, 1.79],
  "sunforged-tap-2": [183.6, 102.96, 27.04, -1.89],
  "sunforged-tap-3": [182.76, 101.59, 27.04, -4.23],
  "sunforged-tap-4": [182.48, 101.88, 27.04, -4.61],
  "sunforged-tap-5": [182.82, 103.72, 27.04, -2.92],
  "sunforged-tap-6": [183.56, 106.67, 27.04, 0.38],
  "sunforged-tap-7": [185.19, 109.97, 27.04, 4.4],
  "sunforged-tap-8": [187.01, 112.84, 27.04, 8.05],
  "sunforged-tap-9": [188.16, 114.49, 27.04, 10.37],
  "sunforged-tap-10": [188.57, 114.32, 27.04, 10.74],
  "sunforged-tap-11": [188.14, 112.3, 27.04, 9.08],
  "sunforged-tap-12": [186.8, 109.04, 27.04, 5.81],
  "sunforged-desc-1": [184.69, 105.65, 27.04, 1.79],
  "sunforged-desc-2": [188.8, 118.83, 27.04, 15.52],
  "sunforged-desc-3": [190.08, 132.44, 27.04, 28.71],
  "sunforged-desc-4": [188.1, 145.92, 27.04, 41.18],
  "suit:abyssal": [184.85, 114.5, 25.88, 1.82],
  "abyssal-tap-1": [184.85, 114.5, 25.88, 1.82],
  "abyssal-tap-2": [184.07, 111.63, 25.88, -1.87],
  "abyssal-tap-3": [183.48, 110.17, 25.88, -4.22],
  "abyssal-tap-4": [183.34, 110.43, 25.88, -4.6],
  "abyssal-tap-5": [183.65, 112.35, 25.88, -2.91],
  "abyssal-tap-6": [184.23, 115.44, 25.88, 0.4],
  "abyssal-tap-7": [184.74, 118.94, 25.88, 4.43],
  "abyssal-tap-8": [185.08, 121.89, 25.88, 8.09],
  "abyssal-tap-9": [185.28, 123.48, 25.88, 10.41],
  "abyssal-tap-10": [185.48, 123.26, 25.88, 10.78],
  "abyssal-tap-11": [185.58, 121.28, 25.88, 9.12],
  "abyssal-tap-12": [185.42, 118.06, 25.88, 5.84],
  "abyssal-desc-1": [184.85, 114.5, 25.88, 1.82],
  "abyssal-desc-2": [184.52, 127.1, 25.88, 15.57],
  "abyssal-desc-3": [182.65, 139.3, 25.88, 28.78],
  "abyssal-desc-4": [178.01, 150.6, 25.88, 41.24],
  "suit:gemmie": [183.43, 99.44, 27.13, 1.82],
  "gemmie-tap-1": [183.43, 99.44, 27.13, 1.82],
  "gemmie-tap-2": [182.35, 96.36, 27.13, -1.86],
  "gemmie-tap-3": [181.61, 94.53, 27.13, -4.21],
  "gemmie-tap-4": [181.5, 94.73, 27.13, -4.59],
  "gemmie-tap-5": [182.03, 97.04, 27.13, -2.9],
  "gemmie-tap-6": [182.94, 100.59, 27.13, 0.41],
  "gemmie-tap-7": [184.34, 104.23, 27.13, 4.43],
  "gemmie-tap-8": [186.4, 107.0, 27.13, 8.08],
  "gemmie-tap-9": [187.72, 108.35, 27.13, 10.39],
  "gemmie-tap-10": [188.03, 108.09, 27.13, 10.77],
  "gemmie-tap-11": [187.21, 105.92, 27.13, 9.1],
  "gemmie-tap-12": [185.38, 102.92, 27.13, 5.83],
  "gemmie-desc-1": [183.43, 99.44, 27.13, 1.82],
  "gemmie-desc-2": [188.66, 113.27, 27.13, 15.55],
  "gemmie-desc-3": [190.83, 128.76, 27.13, 28.74],
  "gemmie-desc-4": [189.93, 144.01, 27.13, 41.19],
  "suit:sammie": [185.89, 114.58, 26.09, 1.83],
  "sammie-tap-1": [185.89, 114.58, 26.09, 1.83],
  "sammie-tap-2": [184.91, 112.4, 26.09, -1.84],
  "sammie-tap-3": [184.22, 111.2, 26.09, -4.18],
  "sammie-tap-4": [184.09, 111.6, 26.09, -4.55],
  "sammie-tap-5": [184.54, 113.59, 26.09, -2.87],
  "sammie-tap-6": [185.3, 116.28, 26.09, 0.43],
  "sammie-tap-7": [186.11, 119.42, 26.09, 4.43],
  "sammie-tap-8": [186.73, 122.42, 26.09, 8.08],
  "sammie-tap-9": [187.15, 124.23, 26.09, 10.38],
  "sammie-tap-10": [187.36, 123.89, 26.09, 10.75],
  "sammie-tap-11": [187.27, 121.55, 26.09, 9.09],
  "sammie-tap-12": [186.77, 117.99, 26.09, 5.83],
  "sammie-desc-1": [185.89, 114.58, 26.09, 1.83],
  "sammie-desc-2": [186.55, 127.66, 26.09, 15.52],
  "sammie-desc-3": [185.53, 139.88, 26.09, 28.68],
  "sammie-desc-4": [181.44, 151.15, 26.09, 41.12],
  "suit:cosmic": [184.32, 101.02, 27.17, 1.83],
  "cosmic-tap-1": [184.32, 101.02, 27.17, 1.83],
  "cosmic-tap-2": [183.15, 98.55, 27.17, -1.85],
  "cosmic-tap-3": [182.31, 97.42, 27.17, -4.21],
  "cosmic-tap-4": [182.1, 97.75, 27.17, -4.59],
  "cosmic-tap-5": [182.57, 99.46, 27.17, -2.89],
  "cosmic-tap-6": [183.44, 102.21, 27.17, 0.42],
  "cosmic-tap-7": [184.99, 105.39, 27.17, 4.45],
  "cosmic-tap-8": [187.08, 108.2, 27.17, 8.11],
  "cosmic-tap-9": [188.42, 109.75, 27.17, 10.42],
  "cosmic-tap-10": [188.8, 109.48, 27.17, 10.8],
  "cosmic-tap-11": [188.13, 107.45, 27.17, 9.13],
  "cosmic-tap-12": [186.43, 104.3, 27.17, 5.85],
  "cosmic-desc-1": [184.32, 101.02, 27.17, 1.83],
  "cosmic-desc-2": [189.28, 113.87, 27.17, 15.58],
  "cosmic-desc-3": [191.36, 128.37, 27.17, 28.79],
  "cosmic-desc-4": [190.6, 142.66, 27.17, 41.25],
  "suit:seraph": [192.36, 121.33, 25.14, 2.3],
  "seraph-tap-1": [192.36, 121.33, 25.14, 2.3],
  "seraph-tap-2": [190.56, 118.3, 25.14, -1.36],
  "seraph-tap-3": [189.53, 116.98, 25.14, -3.7],
  "seraph-tap-4": [189.6, 117.64, 25.14, -4.07],
  "seraph-tap-5": [190.72, 120.11, 25.14, -2.39],
  "seraph-tap-6": [192.54, 123.77, 25.14, 0.9],
  "seraph-tap-7": [194.47, 127.67, 25.14, 4.9],
  "seraph-tap-8": [195.99, 130.77, 25.14, 8.53],
  "seraph-tap-9": [196.8, 132.3, 25.14, 10.82],
  "seraph-tap-10": [196.82, 131.68, 25.14, 11.19],
  "seraph-tap-11": [195.98, 129.08, 25.14, 9.54],
  "seraph-tap-12": [194.37, 125.29, 25.14, 6.3],
  "seraph-desc-1": [192.36, 121.33, 25.14, 2.3],
  "seraph-desc-2": [193.32, 136.19, 25.14, 15.94],
  "seraph-desc-3": [190.83, 151.42, 25.14, 29.01],
  "seraph-desc-4": [185.26, 166.97, 25.14, 41.35],
  "suit:iontrim": [191.55, 107.14, 24.07, 1.7],
  "iontrim-tap-1": [191.55, 107.14, 24.07, 1.7],
  "iontrim-tap-2": [190.33, 104.37, 24.07, -1.99],
  "iontrim-tap-3": [189.6, 103.16, 24.07, -4.34],
  "iontrim-tap-4": [189.66, 103.73, 24.07, -4.72],
  "iontrim-tap-5": [190.45, 105.93, 24.07, -3.03],
  "iontrim-tap-6": [191.63, 109.29, 24.07, 0.28],
  "iontrim-tap-7": [192.75, 113, 24.07, 4.31],
  "iontrim-tap-8": [193.54, 116.04, 24.07, 7.97],
  "iontrim-tap-9": [193.95, 117.51, 24.07, 10.29],
  "iontrim-tap-10": [194, 116.93, 24.07, 10.66],
  "iontrim-tap-11": [193.63, 114.46, 24.07, 9],
  "iontrim-tap-12": [192.78, 110.84, 24.07, 5.72],
  "iontrim-desc-1": [191.55, 107.14, 24.07, 1.7],
  "iontrim-desc-2": [193.45, 122.23, 24.07, 15.45],
  "iontrim-desc-3": [191.56, 137.73, 24.07, 28.68],
  "iontrim-desc-4": [186.22, 152.39, 24.07, 41.17],
  "suit:tracer": [186.2, 112.62, 26.96, 1.82],
  "tracer-tap-1": [186.2, 112.62, 26.96, 1.82],
  "tracer-tap-2": [184.49, 109.48, 26.96, -1.87],
  "tracer-tap-3": [183.33, 108.02, 26.96, -4.22],
  "tracer-tap-4": [183.18, 108.46, 26.96, -4.6],
  "tracer-tap-5": [184.07, 110.69, 26.96, -2.9],
  "tracer-tap-6": [185.56, 114.27, 26.96, 0.41],
  "tracer-tap-7": [187.13, 118.34, 26.96, 4.44],
  "tracer-tap-8": [188.4, 121.78, 26.96, 8.1],
  "tracer-tap-9": [189.19, 123.57, 26.96, 10.41],
  "tracer-tap-10": [189.41, 123.16, 26.96, 10.79],
  "tracer-tap-11": [188.98, 120.63, 26.96, 9.12],
  "tracer-tap-12": [187.85, 116.72, 26.96, 5.84],
  "tracer-desc-1": [186.2, 112.62, 26.96, 1.82],
  "tracer-desc-2": [188.58, 124.69, 26.96, 15.58],
  "tracer-desc-3": [187.99, 138.17, 26.96, 28.78],
  "tracer-desc-4": [184.8, 150.86, 26.96, 41.25],
  "suit:glasssuit": [186.04, 112.31, 26.32, 1.71],
  "glasssuit-tap-1": [186.04, 112.31, 26.32, 1.71],
  "glasssuit-tap-2": [185.04, 109.7, 26.32, -1.96],
  "glasssuit-tap-3": [184.37, 108.43, 26.32, -4.31],
  "glasssuit-tap-4": [184.35, 108.81, 26.32, -4.68],
  "glasssuit-tap-5": [184.98, 110.74, 26.32, -3],
  "glasssuit-tap-6": [185.88, 113.74, 26.32, 0.3],
  "glasssuit-tap-7": [186.71, 117.08, 26.32, 4.32],
  "glasssuit-tap-8": [187.28, 119.84, 26.32, 7.96],
  "glasssuit-tap-9": [187.6, 121.22, 26.32, 10.27],
  "glasssuit-tap-10": [187.71, 120.84, 26.32, 10.64],
  "glasssuit-tap-11": [187.53, 118.8, 26.32, 8.98],
  "glasssuit-tap-12": [186.96, 115.67, 26.32, 5.72],
  "glasssuit-desc-1": [186.04, 112.31, 26.32, 1.71],
  "glasssuit-desc-2": [187.19, 125.06, 26.32, 15.42],
  "glasssuit-desc-3": [185.63, 137.24, 26.32, 28.61],
  "glasssuit-desc-4": [182.08, 148.78, 26.32, 41.08],
  "suit:redline": [189.5, 106.74, 29.22, 1.65],
  "redline-tap-1": [189.5, 106.74, 29.22, 1.65],
  "redline-tap-2": [188.4, 104.62, 29.22, -2.02],
  "redline-tap-3": [187.68, 103.75, 29.22, -4.36],
  "redline-tap-4": [187.63, 104.27, 29.22, -4.74],
  "redline-tap-5": [188.23, 106.03, 29.22, -3.06],
  "redline-tap-6": [189.21, 108.66, 29.22, 0.24],
  "redline-tap-7": [190.26, 111.52, 29.22, 4.26],
  "redline-tap-8": [191.16, 113.84, 29.22, 7.9],
  "redline-tap-9": [191.7, 114.93, 29.22, 10.21],
  "redline-tap-10": [191.84, 114.44, 29.22, 10.58],
  "redline-tap-11": [191.51, 112.48, 29.22, 8.92],
  "redline-tap-12": [190.67, 109.63, 29.22, 5.66],
  "redline-desc-1": [189.5, 106.74, 29.22, 1.65],
  "redline-desc-2": [191.39, 119.27, 29.22, 15.36],
  "redline-desc-3": [190.03, 132.01, 29.22, 28.56],
  "redline-desc-4": [187.21, 143.32, 29.22, 41.05],
  "suit:robodog": [189.04, 108.64, 25.09, 1.78],
  "robodog-tap-1": [189.04, 108.64, 25.09, 1.78],
  "robodog-tap-2": [187.63, 105.97, 25.09, -1.9],
  "robodog-tap-3": [186.82, 104.76, 25.09, -4.24],
  "robodog-tap-4": [186.94, 105.25, 25.09, -4.62],
  "robodog-tap-5": [187.91, 107.31, 25.09, -2.93],
  "robodog-tap-6": [189.33, 110.53, 25.09, 0.37],
  "robodog-tap-7": [190.71, 114.1, 25.09, 4.39],
  "robodog-tap-8": [191.7, 117.11, 25.09, 8.03],
  "robodog-tap-9": [192.2, 118.63, 25.09, 10.34],
  "robodog-tap-10": [192.18, 118.14, 25.09, 10.71],
  "robodog-tap-11": [191.62, 115.76, 25.09, 9.05],
  "robodog-tap-12": [190.51, 112.22, 25.09, 5.79],
  "robodog-desc-1": [189.04, 108.64, 25.09, 1.78],
  "robodog-desc-2": [192.3, 123.12, 25.09, 15.49],
  "robodog-desc-3": [193.23, 137.37, 25.09, 28.67],
  "robodog-desc-4": [189.9, 150.55, 25.09, 41.13],
  "suit:geode": [183.83, 121.67, 27.29, 1.77],
  "geode-tap-1": [183.83, 121.67, 27.29, 1.77],
  "geode-tap-2": [182.77, 119.03, 27.29, -1.91],
  "geode-tap-3": [182.0, 117.73, 27.29, -4.26],
  "geode-tap-4": [181.81, 118.06, 27.29, -4.64],
  "geode-tap-5": [182.24, 119.91, 27.29, -2.95],
  "geode-tap-6": [183.05, 122.81, 27.29, 0.36],
  "geode-tap-7": [183.93, 126.03, 27.29, 4.38],
  "geode-tap-8": [184.62, 128.71, 27.29, 8.03],
  "geode-tap-9": [185.09, 130.14, 27.29, 10.34],
  "geode-tap-10": [185.34, 129.89, 27.29, 10.71],
  "geode-tap-11": [185.27, 128.0, 27.29, 9.05],
  "geode-tap-12": [184.76, 124.97, 27.29, 5.78],
  "geode-desc-1": [183.83, 121.67, 27.29, 1.77],
  "geode-desc-2": [184.41, 133.84, 27.29, 15.5],
  "geode-desc-3": [183.92, 144.47, 27.29, 28.69],
  "geode-desc-4": [181.2, 151.8, 27.29, 41.16],

  "suit:ghost": [191.69, 101.54, 26.36, 2.03],
  "ghost-tap-1": [191.69, 101.54, 26.36, 2.03],
  "ghost-tap-2": [190.17, 99, 26.36, -1.66],
  "ghost-tap-3": [189.14, 97.91, 26.36, -4.02],
  "ghost-tap-4": [189.18, 98.47, 26.36, -4.4],
  "ghost-tap-5": [190.38, 100.55, 26.36, -2.7],
  "ghost-tap-6": [191.98, 103.69, 26.36, 0.61],
  "ghost-tap-7": [193.48, 107.17, 26.36, 4.65],
  "ghost-tap-8": [194.65, 110.05, 26.36, 8.31],
  "ghost-tap-9": [195.23, 111.44, 26.36, 10.63],
  "ghost-tap-10": [195.21, 110.86, 26.36, 11.01],
  "ghost-tap-11": [194.61, 108.47, 26.36, 9.34],
  "ghost-tap-12": [193.33, 105.01, 26.36, 6.06],
  "ghost-desc-1": [191.69, 101.54, 26.36, 2.03],
  "ghost-desc-2": [195.39, 116.14, 26.36, 15.8],
  "ghost-desc-3": [195.62, 132.15, 26.36, 28.99],
  "ghost-desc-4": [193.28, 148.77, 26.36, 41.42],
  "suit:porcelain": [185.99, 116.93, 27.51, 1.8],
  "porcelain-tap-1": [185.99, 116.93, 27.51, 1.8],
  "porcelain-tap-2": [185.27, 114.46, 27.51, -1.88],
  "porcelain-tap-3": [184.7, 113.33, 27.51, -4.23],
  "porcelain-tap-4": [184.5, 113.75, 27.51, -4.6],
  "porcelain-tap-5": [184.72, 115.59, 27.51, -2.92],
  "porcelain-tap-6": [185.17, 118.43, 27.51, 0.39],
  "porcelain-tap-7": [185.65, 121.57, 27.51, 4.4],
  "porcelain-tap-8": [186.39, 124.24, 27.51, 8.05],
  "porcelain-tap-9": [186.99, 125.61, 27.51, 10.36],
  "porcelain-tap-10": [187.3, 125.26, 27.51, 10.74],
  "porcelain-tap-11": [187.2, 123.25, 27.51, 9.07],
  "porcelain-tap-12": [186.61, 120.16, 27.51, 5.81],
  "porcelain-desc-1": [185.99, 116.93, 27.51, 1.8],
  "porcelain-desc-2": [186.2, 129.65, 27.51, 15.51],
  "porcelain-desc-3": [184.06, 141.78, 27.51, 28.7],
  "porcelain-desc-4": [179.67, 153.11, 27.51, 41.16],
  "suit:bigbooty": [197.85, 110.52, 26.23, 1.25],
  "bigbooty-tap-1": [197.85, 110.52, 26.23, 1.25],
  "bigbooty-tap-2": [196.78, 108.28, 26.23, -1.34],
  "bigbooty-tap-3": [196.04, 107.44, 26.23, -2.99],
  "bigbooty-tap-4": [195.88, 107.97, 26.23, -3.25],
  "bigbooty-tap-5": [196.35, 109.67, 26.23, -2.06],
  "bigbooty-tap-6": [197.16, 112.27, 26.23, 0.26],
  "bigbooty-tap-7": [197.96, 115.28, 26.23, 3.1],
  "bigbooty-tap-8": [198.57, 117.91, 26.23, 5.69],
  "bigbooty-tap-9": [199.01, 119.33, 26.23, 7.34],
  "bigbooty-tap-10": [199.3, 118.97, 26.23, 7.6],
  "bigbooty-tap-11": [199.27, 116.84, 26.23, 6.41],
  "bigbooty-tap-12": [198.78, 113.68, 26.23, 4.09],
  "bigbooty-desc-1": [197.85, 110.52, 26.23, 1.25],
  "bigbooty-desc-2": [198.06, 123.37, 26.23, 11.05],
  "bigbooty-desc-3": [195.01, 135.55, 26.23, 20.85],
  "bigbooty-desc-4": [188.82, 146.13, 26.23, 30.67],

  "suit:eclipse": [186.2, 112.62, 26.96, 1.82],
  "eclipse-tap-1": [186.2, 112.62, 26.96, 1.82],
  "eclipse-tap-2": [184.49, 109.48, 26.96, -1.87],
  "eclipse-tap-3": [183.33, 108.02, 26.96, -4.22],
  "eclipse-tap-4": [183.18, 108.46, 26.96, -4.6],
  "eclipse-tap-5": [184.07, 110.69, 26.96, -2.9],
  "eclipse-tap-6": [185.56, 114.27, 26.96, 0.41],
  "eclipse-tap-7": [187.13, 118.34, 26.96, 4.44],
  "eclipse-tap-8": [188.4, 121.78, 26.96, 8.1],
  "eclipse-tap-9": [189.19, 123.57, 26.96, 10.41],
  "eclipse-tap-10": [189.41, 123.16, 26.96, 10.79],
  "eclipse-tap-11": [188.98, 120.63, 26.96, 9.12],
  "eclipse-tap-12": [187.85, 116.72, 26.96, 5.84],
  "eclipse-desc-1": [186.2, 112.62, 26.96, 1.82],
  "eclipse-desc-2": [188.58, 124.69, 26.96, 15.58],
  "eclipse-desc-3": [187.99, 138.17, 26.96, 28.78],
  "eclipse-desc-4": [184.8, 150.86, 26.96, 41.25],
  "suit:cryostar": [186.2, 112.62, 26.96, 1.82],
  "cryostar-tap-1": [186.2, 112.62, 26.96, 1.82],
  "cryostar-tap-2": [184.49, 109.48, 26.96, -1.87],
  "cryostar-tap-3": [183.33, 108.02, 26.96, -4.22],
  "cryostar-tap-4": [183.18, 108.46, 26.96, -4.6],
  "cryostar-tap-5": [184.07, 110.69, 26.96, -2.9],
  "cryostar-tap-6": [185.56, 114.27, 26.96, 0.41],
  "cryostar-tap-7": [187.13, 118.34, 26.96, 4.44],
  "cryostar-tap-8": [188.4, 121.78, 26.96, 8.1],
  "cryostar-tap-9": [189.19, 123.57, 26.96, 10.41],
  "cryostar-tap-10": [189.41, 123.16, 26.96, 10.79],
  "cryostar-tap-11": [188.98, 120.63, 26.96, 9.12],
  "cryostar-tap-12": [187.85, 116.72, 26.96, 5.84],
  "cryostar-desc-1": [186.2, 112.62, 26.96, 1.82],
  "cryostar-desc-2": [188.58, 124.69, 26.96, 15.58],
  "cryostar-desc-3": [187.99, 138.17, 26.96, 28.78],
  "cryostar-desc-4": [184.8, 150.86, 26.96, 41.25],
  "suit:verdant": [186.2, 112.62, 26.96, 1.82],
  "verdant-tap-1": [186.2, 112.62, 26.96, 1.82],
  "verdant-tap-2": [184.49, 109.48, 26.96, -1.87],
  "verdant-tap-3": [183.33, 108.02, 26.96, -4.22],
  "verdant-tap-4": [183.18, 108.46, 26.96, -4.6],
  "verdant-tap-5": [184.07, 110.69, 26.96, -2.9],
  "verdant-tap-6": [185.56, 114.27, 26.96, 0.41],
  "verdant-tap-7": [187.13, 118.34, 26.96, 4.44],
  "verdant-tap-8": [188.4, 121.78, 26.96, 8.1],
  "verdant-tap-9": [189.19, 123.57, 26.96, 10.41],
  "verdant-tap-10": [189.41, 123.16, 26.96, 10.79],
  "verdant-tap-11": [188.98, 120.63, 26.96, 9.12],
  "verdant-tap-12": [187.85, 116.72, 26.96, 5.84],
  "verdant-desc-1": [186.2, 112.62, 26.96, 1.82],
  "verdant-desc-2": [188.58, 124.69, 26.96, 15.58],
  "verdant-desc-3": [187.99, 138.17, 26.96, 28.78],
  "verdant-desc-4": [184.8, 150.86, 26.96, 41.25],
  "suit:arcflash": [186.2, 112.62, 26.96, 1.82],
  "arcflash-tap-1": [186.2, 112.62, 26.96, 1.82],
  "arcflash-tap-2": [184.49, 109.48, 26.96, -1.87],
  "arcflash-tap-3": [183.33, 108.02, 26.96, -4.22],
  "arcflash-tap-4": [183.18, 108.46, 26.96, -4.6],
  "arcflash-tap-5": [184.07, 110.69, 26.96, -2.9],
  "arcflash-tap-6": [185.56, 114.27, 26.96, 0.41],
  "arcflash-tap-7": [187.13, 118.34, 26.96, 4.44],
  "arcflash-tap-8": [188.4, 121.78, 26.96, 8.1],
  "arcflash-tap-9": [189.19, 123.57, 26.96, 10.41],
  "arcflash-tap-10": [189.41, 123.16, 26.96, 10.79],
  "arcflash-tap-11": [188.98, 120.63, 26.96, 9.12],
  "arcflash-tap-12": [187.85, 116.72, 26.96, 5.84],
  "arcflash-desc-1": [186.2, 112.62, 26.96, 1.82],
  "arcflash-desc-2": [188.58, 124.69, 26.96, 15.58],
  "arcflash-desc-3": [187.99, 138.17, 26.96, 28.78],
  "arcflash-desc-4": [184.8, 150.86, 26.96, 41.25],
  "suit:origamist": [186.2, 112.62, 26.96, 1.82],
  "origamist-tap-1": [186.2, 112.62, 26.96, 1.82],
  "origamist-tap-2": [184.49, 109.48, 26.96, -1.87],
  "origamist-tap-3": [183.33, 108.02, 26.96, -4.22],
  "origamist-tap-4": [183.18, 108.46, 26.96, -4.6],
  "origamist-tap-5": [184.07, 110.69, 26.96, -2.9],
  "origamist-tap-6": [185.56, 114.27, 26.96, 0.41],
  "origamist-tap-7": [187.13, 118.34, 26.96, 4.44],
  "origamist-tap-8": [188.4, 121.78, 26.96, 8.1],
  "origamist-tap-9": [189.19, 123.57, 26.96, 10.41],
  "origamist-tap-10": [189.41, 123.16, 26.96, 10.79],
  "origamist-tap-11": [188.98, 120.63, 26.96, 9.12],
  "origamist-tap-12": [187.85, 116.72, 26.96, 5.84],
  "origamist-desc-1": [186.2, 112.62, 26.96, 1.82],
  "origamist-desc-2": [188.58, 124.69, 26.96, 15.58],
  "origamist-desc-3": [187.99, 138.17, 26.96, 28.78],
  "origamist-desc-4": [184.8, 150.86, 26.96, 41.25],
  "suit:leviathan": [186.86, 102.5, 24.93, 1.8],
  "leviathan-tap-1": [186.86, 102.5, 24.93, 1.8],
  "leviathan-tap-2": [185.3, 99.36, 24.93, -1.93],
  "leviathan-tap-3": [184.38, 98.01, 24.93, -4.31],
  "leviathan-tap-4": [184.44, 98.69, 24.93, -4.69],
  "leviathan-tap-5": [185.43, 101.19, 24.93, -2.98],
  "leviathan-tap-6": [186.94, 105, 24.93, 0.37],
  "leviathan-tap-7": [188.42, 109.22, 24.93, 4.44],
  "leviathan-tap-8": [189.53, 112.68, 24.93, 8.14],
  "leviathan-tap-9": [190.12, 114.35, 24.93, 10.48],
  "leviathan-tap-10": [190.18, 113.68, 24.93, 10.86],
  "leviathan-tap-11": [189.64, 110.85, 24.93, 9.17],
  "leviathan-tap-12": [188.46, 106.71, 24.93, 5.87],
  "leviathan-desc-1": [186.86, 102.5, 24.93, 1.8],
  "leviathan-desc-2": [190, 120.7, 24.93, 15.69],
  "leviathan-desc-3": [188.79, 138.78, 24.93, 29],
  "leviathan-desc-4": [184.5, 156.43, 24.93, 41.51],
  "suit:copper": [190.92, 108.99, 26.56, 1.81],
  "copper-tap-1": [190.92, 108.99, 26.56, 1.81],
  "copper-tap-2": [189.32, 106.19, 26.56, -1.86],
  "copper-tap-3": [188.15, 104.84, 26.56, -4.2],
  "copper-tap-4": [188.0, 105.18, 26.56, -4.57],
  "copper-tap-5": [188.84, 107.11, 26.56, -2.89],
  "copper-tap-6": [190.39, 110.24, 26.56, 0.4],
  "copper-tap-7": [191.65, 113.83, 26.56, 4.41],
  "copper-tap-8": [192.71, 116.92, 26.56, 8.05],
  "copper-tap-9": [193.59, 118.58, 26.56, 10.36],
  "copper-tap-10": [193.79, 118.27, 26.56, 10.73],
  "copper-tap-11": [193.23, 116.05, 26.56, 9.07],
  "copper-tap-12": [192.24, 112.61, 26.56, 5.81],
  "copper-desc-1": [190.92, 108.99, 26.56, 1.81],
  "copper-desc-2": [193.69, 122.68, 26.56, 15.5],
  "copper-desc-3": [193.8, 136.27, 26.56, 28.66],
  "copper-desc-4": [190.84, 148.51, 26.56, 41.11],
  "suit:alien": [188.74, 121.7, 22.29, 1.82],
  "alien-tap-1": [188.74, 121.7, 22.29, 1.82],
  "alien-tap-2": [187.8, 119.23, 22.29, -1.85],
  "alien-tap-3": [187.09, 118.11, 22.29, -4.19],
  "alien-tap-4": [186.89, 118.53, 22.29, -4.57],
  "alien-tap-5": [187.23, 120.36, 22.29, -2.88],
  "alien-tap-6": [187.87, 123.17, 22.29, 0.41],
  "alien-tap-7": [188.55, 126.4, 22.29, 4.42],
  "alien-tap-8": [189.1, 129.21, 22.29, 8.06],
  "alien-tap-9": [189.51, 130.68, 22.29, 10.36],
  "alien-tap-10": [189.8, 130.35, 22.29, 10.73],
  "alien-tap-11": [189.87, 128.29, 22.29, 9.08],
  "alien-tap-12": [189.51, 125.09, 22.29, 5.82],
  "alien-desc-1": [188.74, 121.7, 22.29, 1.82],
  "alien-desc-2": [188.54, 134.72, 22.29, 15.5],
  "alien-desc-3": [185.29, 146.95, 22.29, 28.66],
  "alien-desc-4": [179.25, 157.86, 22.29, 41.1],
  "suit:flight": [186.2, 112.62, 26.96, 1.82],
  "flight-tap-1": [186.2, 112.62, 26.96, 1.82],
  "flight-tap-2": [184.49, 109.48, 26.96, -1.87],
  "flight-tap-3": [183.33, 108.02, 26.96, -4.22],
  "flight-tap-4": [183.18, 108.46, 26.96, -4.6],
  "flight-tap-5": [184.07, 110.69, 26.96, -2.9],
  "flight-tap-6": [185.56, 114.27, 26.96, 0.41],
  "flight-tap-7": [187.13, 118.34, 26.96, 4.44],
  "flight-tap-8": [188.4, 121.78, 26.96, 8.1],
  "flight-tap-9": [189.19, 123.57, 26.96, 10.41],
  "flight-tap-10": [189.41, 123.16, 26.96, 10.79],
  "flight-tap-11": [188.98, 120.63, 26.96, 9.12],
  "flight-tap-12": [187.85, 116.72, 26.96, 5.84],
  "flight-desc-1": [186.2, 112.62, 26.96, 1.82],
  "flight-desc-2": [188.58, 124.69, 26.96, 15.58],
  "flight-desc-3": [187.99, 138.17, 26.96, 28.78],
  "flight-desc-4": [184.8, 150.86, 26.96, 41.25],
  "suit:frost": [186.2, 112.62, 26.96, 1.82],
  "frost-tap-1": [186.2, 112.62, 26.96, 1.82],
  "frost-tap-2": [184.49, 109.48, 26.96, -1.87],
  "frost-tap-3": [183.33, 108.02, 26.96, -4.22],
  "frost-tap-4": [183.18, 108.46, 26.96, -4.6],
  "frost-tap-5": [184.07, 110.69, 26.96, -2.9],
  "frost-tap-6": [185.56, 114.27, 26.96, 0.41],
  "frost-tap-7": [187.13, 118.34, 26.96, 4.44],
  "frost-tap-8": [188.4, 121.78, 26.96, 8.1],
  "frost-tap-9": [189.19, 123.57, 26.96, 10.41],
  "frost-tap-10": [189.41, 123.16, 26.96, 10.79],
  "frost-tap-11": [188.98, 120.63, 26.96, 9.12],
  "frost-tap-12": [187.85, 116.72, 26.96, 5.84],
  "frost-desc-1": [186.2, 112.62, 26.96, 1.82],
  "frost-desc-2": [188.58, 124.69, 26.96, 15.58],
  "frost-desc-3": [187.99, 138.17, 26.96, 28.78],
  "frost-desc-4": [184.8, 150.86, 26.96, 41.25],
};

// Measured head registration in each shipped helmet sprite. The ten
// regenerated paintings share [128,136,80]; their source export applies the
// inverse scale/translation so existing suit sockets keep the same fit.
// Ornament bounds do not determine head size. Per-design tilt is retained.
const HELM_GLASS: Record<string, [number, number, number] | [number, number, number, number]> = {
  "comet": [129, 129, 125],
  "clear": [129, 128, 125],
  "ion": [129, 128, 125],
  "solar": [128, 128, 125],
  "nebula": [129, 129, 125],
  "lunar": [129, 126, 125, -4],
  "void": [125, 128, 125],
  "cherry": [126, 128, 125],
  "royal": [128, 136, 80],
  "aurora": [128, 127, 127.5],
  "meteor": [128, 127, 127.5],
  "chrono": [132, 126, 127.5],
  "gemmie": [128, 128, 131.9],
  "phoenix": [128, 136, 80, -2],
  "seraph": [128, 136, 80],
  "chronarch": [128, 136, 80],
  "princess": [128, 136, 80],
  "sammie": [128, 136, 80],
  "leviathan": [128, 136, 80, 12],
  "verdant": [128, 136, 80],
  "cryostar": [128, 136, 80],
  "eclipse": [128, 136, 80],
  "cinderforge": [128, 125, 115.9],
  "groveguard": [130, 124, 106],
  "cosmic": [134, 119, 124.2],
  "sunforged": [123, 128, 129],
  "abyssal": [125, 131, 128.8],
  "amethyst": [127, 128, 126.3],
  "ivoryguard": [127, 126, 130.6],
  "reactor": [140, 110, 96.2],
};

// The real helmet art, its glass centre punched translucent once so the
// pilot's face shows through when it is composited onto the head.
const punchedCache = new Map<string, HTMLCanvasElement>();
const LIGHT_OPAQUE_VISORS = new Set([
  "gemmie", "phoenix", "sammie", "seraph",
  "chronarch", "princess",
  "cryostar", "verdant", "eclipse",
]);
function punchedHelm(spr: Sprite, id: string, opaqueVisor = false) {
  const hit = punchedCache.get(id);
  if (hit) return hit;
  const g = HELM_GLASS[id];
  const c = document.createElement("canvas");
  c.width = spr.width;
  c.height = spr.height;
  const cc = c.getContext("2d");
  if (!cc || !g) return null;
  cc.drawImage(spr, 0, 0);
  if (opaqueVisor) {
    punchedCache.set(id, c);
    return c;
  }
  const strong = LIGHT_OPAQUE_VISORS.has(id);
  const grad = cc.createRadialGradient(
    g[0], g[1], g[2] * 0.1,
    g[0], g[1], g[2] * (strong ? 0.88 : 0.82),
  );
  grad.addColorStop(0, `rgba(0,0,0,${strong ? 0.88 : 0.55})`);
  grad.addColorStop(0.7, `rgba(0,0,0,${strong ? 0.62 : 0.3})`);
  grad.addColorStop(1, "rgba(0,0,0,0)");
  cc.save();
  clipHelmetGlass(cc, id);
  cc.globalCompositeOperation = "destination-out";
  cc.fillStyle = grad;
  cc.fillRect(0, 0, c.width, c.height);
  cc.restore();
  cc.globalCompositeOperation = "source-over";
  punchedCache.set(id, c);
  return c;
}

// Where each rigged suit's tail hinges, in its own 256px canvas.
const TAIL_PIVOT: Record<string, [number, number]> = {
  // The middle of the NECK -- the narrowest crossing of the silhouette
  // where the plume meets the rump -- found by neck-cut.py rather than set
  // by hand. The old values sat on the outer edge of the tail mask, which
  // is why a swing tore a piece off the animal instead of sweeping along
  // it. Re-cut the art and these must be re-read from the same run.
  cyber: [101, 125],
  // Percy, Patriot and Envoy left the painted trio for rendered 3D banks (no split tail to pivot)
  bigbooty: [92, 129],
  catsuit: [74, 149],
  copper: [108, 142],
  ember: [108, 135],
  flight: [102, 130],
  frost: [107, 139],
  gemmie: [101, 147],
  iontrim: [102, 141],
  leviathan: [75, 138],
  robo: [101, 140],
  sammie: [111, 139],
  voidsuit: [105, 147],
  verdant: [102, 142],
  cryostar: [106, 146],
  volt: [107, 136],
  eclipse: [105, 143],
  cinderforge: [104, 132],
  groveguard: [102, 130],
  cosmic: [104, 131],
  sunforged: [101, 128],
  abyssal: [104, 132],
  amethyst: [103, 132],
  ivoryguard: [103, 132],
  reactor: [102, 130],
};

// Draw one layer of a rigged suit. Both layers are full-canvas, so they
// are placed against the WHOLE suit's trimmed box — that is what keeps
// tail and body registered to each other however either one is cropped.
function drawRigLayer(
  ctx: CanvasRenderingContext2D,
  layer: Sprite | HTMLImageElement,
  ref: { x: number; y: number; w: number; h: number },
  x: number,
  y: number,
  size: number,
  rot = 0,
  pivot?: [number, number],
  halo?: "dark" | "light",
) {
  const scale = size / Math.max(1, Math.max(ref.w, ref.h));
  // top-left of the full canvas, in screen space
  const ox = x - (ref.w * scale) / 2 - ref.x * scale;
  const oy = y - (ref.h * scale) / 2 - ref.y * scale;
  ctx.save();
  if (rot && pivot) {
    const px = ox + pivot[0] * scale;
    const py = oy + pivot[1] * scale;
    ctx.translate(px, py);
    ctx.rotate(rot);
    ctx.translate(-px, -py);
  }
  if (halo) {
    const h = spriteHalo(layer, halo);
    if (h) {
      const pad = SPRITE_HALO_PAD * scale;
      ctx.drawImage(h, ox - pad, oy - pad, h.width * scale, h.height * scale);
    }
  }
  ctx.drawImage(spriteImageFor(ctx, layer, layer.width * scale, layer.height * scale),
    ox, oy, layer.width * scale, layer.height * scale);
  ctx.restore();
}

function rigPlacement(
  ref: { x: number; y: number; w: number; h: number },
  x: number,
  y: number,
  size: number,
  pivot: [number, number],
) {
  const scale = size / Math.max(1, Math.max(ref.w, ref.h));
  const ox = x - (ref.w * scale) / 2 - ref.x * scale;
  const oy = y - (ref.h * scale) / 2 - ref.y * scale;
  return { scale, px: ox + pivot[0] * scale, py: oy + pivot[1] * scale };
}

type TapPoseRegistration = {
  /** Centroid of the pose's painted orange head pixels, in source space. */
  head: [number, number];
  /** Uniform correction that restores the approved static head area. */
  scale: number;
};

// The generated Eclipse tap paintings kept their 256px roots but drew the
// pilot about 15-20% smaller inside them. The fixed helmet therefore stayed
// full-size while the exposed head/body shrank, then popped back when the
// static bookend returned. These measurements register each pose to the
// approved eclipse-body.png head without repainting any pixels or touching
// physics. Static bookends intentionally bypass this table.
const ECLIPSE_TAP_HEAD_TARGET: [number, number] = [200.28, 83.82];
const ECLIPSE_TAP_REGISTRATION: TapPoseRegistration[] = [
  { head: [186.03, 76.74], scale: 1.192 },
  { head: [184.89, 74.67], scale: 1.176 },
  { head: [185.24, 77.51], scale: 1.174 },
  { head: [186.15, 76.12], scale: 1.203 },
  { head: [185.34, 77.74], scale: 1.168 },
  { head: [184.87, 74.78], scale: 1.183 },
  { head: [184.29, 74.73], scale: 1.184 },
  { head: [184.69, 76.24], scale: 1.176 },
];

function drawRegisteredTapLayer(
  ctx: CanvasRenderingContext2D,
  layer: Sprite | HTMLImageElement,
  ref: { x: number; y: number; w: number; h: number },
  x: number,
  y: number,
  size: number,
  registration: TapPoseRegistration,
  halo?: "dark" | "light",
) {
  const screenScale = size / Math.max(1, Math.max(ref.w, ref.h));
  const ox = x - (ref.w * screenScale) / 2 - ref.x * screenScale;
  const oy = y - (ref.h * screenScale) / 2 - ref.y * screenScale;
  const sourceX = ox + registration.head[0] * screenScale;
  const sourceY = oy + registration.head[1] * screenScale;
  const targetX = ox + ECLIPSE_TAP_HEAD_TARGET[0] * screenScale;
  const targetY = oy + ECLIPSE_TAP_HEAD_TARGET[1] * screenScale;
  ctx.save();
  ctx.translate(targetX, targetY);
  ctx.scale(registration.scale, registration.scale);
  ctx.translate(-sourceX, -sourceY);
  drawRigLayer(ctx, layer, ref, x, y, size, 0, undefined, halo);
  ctx.restore();
}

// The shared tail translation for suits without a painted tap bank. Six
// overlapping radial sections rotate by progressively larger amounts from the
// planted hinge to the tip. At game scale this reads as a continuous flexible
// plume, while every pixel still comes from the model's approved tail asset.
function drawBentRigLayer(
  ctx: CanvasRenderingContext2D,
  layer: Sprite | HTMLImageElement,
  ref: { x: number; y: number; w: number; h: number },
  x: number,
  y: number,
  size: number,
  baseRot: number,
  bend: number,
  pivot: [number, number],
) {
  const { scale, px, py } = rigPlacement(ref, x, y, size, pivot);
  const box = (layer as Sprite).box ?? { x: 0, y: 0, w: layer.width, h: layer.height };
  const corners = [
    [box.x, box.y], [box.x + box.w, box.y],
    [box.x, box.y + box.h], [box.x + box.w, box.y + box.h],
  ];
  const maxR = Math.max(...corners.map(([cx, cy]) => Math.hypot(cx - pivot[0], cy - pivot[1]))) * scale;
  const segments = 6;
  const overlap = Math.max(0.75, scale * 3.5);
  // Tip first, base last: the overlap hides section edges beneath the denser
  // inner fur instead of building a bright double-alpha seam on top.
  for (let i = segments - 1; i >= 0; i--) {
    const inner = Math.max(0, (maxR * i) / segments - overlap);
    const outer = (maxR * (i + 1)) / segments + overlap;
    const along = (i + 0.5) / segments;
    const smooth = along * along * (3 - 2 * along);
    ctx.save();
    ctx.beginPath();
    ctx.arc(px, py, outer, 0, Math.PI * 2);
    if (inner > 0) ctx.arc(px, py, inner, 0, Math.PI * 2, true);
    ctx.clip("evenodd");
    drawRigLayer(ctx, layer, ref, x, y, size, baseRot + bend * Math.pow(smooth, 1.18), pivot);
    ctx.restore();
  }
}

// Fast compression/straightening, then a much longer return. A second tap
// does not reset these curves; the ordinary spring tail still receives its
// new impulse and rides over this authored silhouette motion.
const TAP_TAIL_CURVE = [0, 0.18, 0.4, 0.58, 0.64, 0.59, 0.48, 0.35, 0.23, 0.13, 0.06, 0];
const TAP_BODY_CURVE = [0, 0.42, 0.82, 1, 0.9, 0.74, 0.58, 0.43, 0.29, 0.17, 0.08, 0];
// Tail is driven away from the rebound at contact, overshoots once, then
// rejoins the live spring. The sign is supplied by the collision normal.
const BOUNCE_TAIL_CURVE = [0, 0.58, 0.76, 0.48, 0.16, -0.11, 0];

function sampleMotionCurve(curve: number[], t: number, duration: number) {
  const at = Math.max(0, Math.min(curve.length - 1, (t / duration) * (curve.length - 1)));
  const lo = Math.floor(at);
  const hi = Math.min(curve.length - 1, lo + 1);
  const f = at - lo;
  const eased = f * f * (3 - 2 * f);
  return curve[lo] * (1 - eased) + curve[hi] * eased;
}

function sampleTapCurve(curve: number[], tapAnimT: number) {
  return sampleMotionCurve(curve, tapAnimT, TAP_ANIM_DURATION);
}

function bounceShape(t: number, strength: number) {
  const p = Math.max(0, Math.min(1, t / BOUNCE_ANIM_DURATION));
  const squash = p < 0.18 ? 1 - p / 0.18 : 0;
  const stretchP = Math.max(0, Math.min(1, (p - 0.1) / 0.42));
  const stretch = p >= 0.1 && p <= 0.52 ? Math.sin(stretchP * Math.PI) : 0;
  const settleP = Math.max(0, Math.min(1, (p - 0.46) / 0.54));
  const settle = p >= 0.46 ? Math.sin(settleP * Math.PI * 2) * (1 - settleP) : 0;
  return {
    x: 1 + strength * (squash * 0.1 - stretch * 0.045 + settle * 0.012),
    y: 1 + strength * (-squash * 0.13 + stretch * 0.085 - settle * 0.018),
  };
}


// Which art still has a helmet painted into it. Exactly the eight ORIGINAL
// squirrel frames do - idle-1..4 and flap-1..4, checked against the files -
// and so does any suit flagged bakedDome in the catalog. Everything else
// ships bare-headed and needs a helmet drawn on it, including Clear.
//
// THE RULE USED TO BE "ANY KEY THAT IS NOT `suit:<id>` IS BAKED", which was
// true when those eight were the only frame keys there were. Seventy-two
// more have arrived since - the per-suit tap, ascent and descent banks -
// and every one of them is bare-headed art that inherited "baked" by
// accident. So Clear drew nothing the moment a bank played, and the pilot
// lost their helmet mid-flight. Reported as "flight+clear helmet = no
// helmet equipped"; the loadout preview flies the ascent bank, so it was
// true standing still too. Every other helmet was unaffected - this guard
// is the only thing that reads the flag - which is why it went unseen.
const BAKED_FRAMES = new Set([
  "idle-1", "idle-2", "idle-3", "idle-4",
  "flap-1", "flap-2", "flap-3", "flap-4",
  "__mix",   // the crossfade between two of those eight, and only ever that
]);
function bakedDome(key: string) {
  if (BAKED_FRAMES.has(key)) return true;
  // a per-suit bank frame - flight-asc-2, robo-tap-9, eclipse-desc-4 - is
  // painted bare-headed like the suit render it animates
  if (!key.startsWith("suit:")) return false;
  const id = key.slice(5);
  return SUITS.some((u) => u.id === id && u.bakedDome === true);
}

// The owner's regenerated standard series shares one painted skull diameter
// and one presentation box. Alpha-box fitting would undo the normalization
// whenever a tail was longer, making the same helmet a different size.
export const NATURAL_FLIGHT_SUITS = new Set<string>([
  // empty since the 3D lineup (26-27 Oct 2026): iontrim, voidsuit, sammie, gemmie, ember,
  // frost, copper, leviathan and last ghost left it - their rendered banks register by their
  // own first tap frame. The fixed-box path stays for the next normalized series
]);
const NATURAL_FLIGHT_BOX = { x: 32, y: 32, w: 192, h: 192 };
function naturalFlightKey(key: string) {
  return NATURAL_FLIGHT_SUITS.has(key.replace(/^suit:/, "").replace(/-(asc|desc)-\d+$/, ""));
}

function paintDome(
  ctx: CanvasRenderingContext2D,
  body: Sprite | HTMLImageElement,
  key: string,
  helmet: (typeof HELMETS)[number],
  x: number,
  y: number,
  size: number,
  art?: ArtBank | null,
) {
  // The Clear helmet used to draw nothing at all, because every suit render
  // had a clear dome painted into it. Most are bare-headed now, so Clear has
  // to paint its own — otherwise picking it leaves the pilot in a vacuum
  // bare-faced. Only the art that still carries a dome skips it: the eight
  // flight animation frames, and the suits flagged bakedDome.
  if (helmet.id === "clear" && bakedDome(key)) return;
  const a = DOME[key];
  if (!a) return;
  const box = naturalFlightKey(key) ? NATURAL_FLIGHT_BOX
    : (body as Sprite).box ?? { x: 0, y: 0, w: body.width, h: body.height };
  const scale = size / Math.max(1, Math.max(box.w, box.h));
  const hx = x - (box.w * scale) / 2 + (a[0] - box.x) * scale;
  const hy = y - (box.h * scale) / 2 + (a[1] - box.y) * scale;
  const r = a[2] * scale;
  paintRegisteredDome(ctx,helmet,hx,hy,r,a[3]||0,art);
}

/** Both measured frame banks and articulated skulls use the same helmet art
 * and glass opening. A rig supplies its actual head transform directly. */
function paintRegisteredDome(ctx:CanvasRenderingContext2D,helmet:(typeof HELMETS)[number],
 hx:number,hy:number,r:number,headAngle:number,art?:ArtBank|null) {
  // The glass mask controls transparency; the separate head cavity controls
  // fitting. Ornaments and an off-centre window never determine head scale.
  const helmSpr = art?.helms?.[helmet.id];
  const g = HELM_GLASS[helmet.id];
  if (helmSpr && g) {
    const punched = punchedHelm(helmSpr, helmet.id, helmet.opaqueVisor === true);
    if (punched) {
      paintFittedHelmet(ctx,punched,helmet.id,punched.width,punched.height,hx,hy,r,headAngle);
      return;
    }
  }
  const v = hexRgb(helmet.visor);
  ctx.save();
  const grad = ctx.createRadialGradient(hx - r * 0.25, hy - r * 0.3, r * 0.2, hx, hy, r);
  grad.addColorStop(0, `rgba(${v.r},${v.g},${v.b},0.08)`);
  grad.addColorStop(0.7, `rgba(${v.r},${v.g},${v.b},0.26)`);
  grad.addColorStop(1, `rgba(${v.r},${v.g},${v.b},0.4)`);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(hx, hy, r, 0, Math.PI * 2);
  ctx.fill();
  if (helmet.glow) {
    ctx.shadowColor = helmet.glow;
    ctx.shadowBlur = r * 0.55;
  }
  ctx.lineWidth = Math.max(1.5, r * 0.09);
  ctx.strokeStyle = helmet.rim;
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.arc(hx, hy, r * 0.97, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

export function paintOrbitPilot(ctx:CanvasRenderingContext2D,art:ArtBank|null|undefined,id:HighOrbitId,
 x:number,y:number,size:number,helmet:(typeof HELMETS)[number],state?:HighOrbitMotion,travel?:HighOrbitTravel,effects=true,pitch=0){
  paintHighOrbit(ctx,art,id,x,y,size,state,travel,effects,pitch,
    (hx,hy,r,angle)=>paintRegisteredDome(ctx,helmet,hx,hy,r,angle,art),
    helmet.opaqueVisor===true&&!!art?.helms?.[helmet.id]);
}

// presentation-only smoothing for the physics-pose banks: one shared clock
// keyed on world time, so pause holds the pose and resume never jumps
//
// This is the FIRST-PASS driver, restored deliberately. Two later attempts
// to damp the hover-cadence rocking - a long velocity average (v95) and a
// direction debounce (v98) - each bought calm by spending the animation,
// and the owner would rather re-approach the timing from here than keep
// tuning a body that barely moves. Do not re-add damping without a look at
// WHEN the pose starts rather than how fast it turns.
let motionVySmooth = 0;
let motionVyClock = -1;
// THE CROSSING TAKES TIME (owner, 2 Sep 2026: "ghost goes from up to down
// in a frame, no transition, need return to horizontal before dive"). At
// 9/s a tap's -450 impulse crossed zero in about four frames, so the
// neutral pose flashed by unseen. 5.5/s puts the level frame on screen
// for ~150ms on the way through, in both directions.
// HOW FAST THE POSE FOLLOWS THE CLIMB (owner, 8 Sep 2026: "it had a visual
// animation"). At 5.5 the smoother ate the tap spike whole: measured over a
// real run at the owner's own cadence (31 taps in 20s), the pose reached
// three of eight frames and changed on 2% of frames - a still with a twitch.
// See POSE_CLIMB_SPAN below for the other half of the fix.
const POSE_SMOOTH = 24;
function smoothMotionVy(t: number, vy: number) {
  const dt = motionVyClock < 0 || t < motionVyClock ? 0.016 : Math.min(0.05, t - motionVyClock);
  motionVyClock = t;
  motionVySmooth += (vy - motionVySmooth) * Math.min(1, dt * POSE_SMOOTH);
  return motionVySmooth;
}

// THE POSE CURVE. Frame index used to be LINEAR in speed, so a mild dive
// already sat three frames deep and every descent looked like a plunge -
// "pitch at 0 ... is aggressive" on the whole swept roster. Raising |v|
// to a power above one keeps gentle attitudes in the first frames and
// saves the deep forward rotation for a genuinely hard dive: "less
// linear and more hyperbolic". Applied to both ramps so a climb stays
// symmetrical.
export const POSE_CURVE = 1.7;
// THE DIVE FLIES ITS WHOLE RAMP (owner, 8 Sep 2026: "as long as the frames
// are there.. then the codes broken", "let me see how it FEELS").
//
// This was 0.5, from 2 Sep: "shallow is the dive answer across the board".
// The complaint behind that ruling was that a MILD dive already sat three
// frames deep - "pitch at 0 ... is aggressive" - and TWO fixes landed for
// it on the same day: POSE_CURVE, which holds gentle attitudes in the first
// frames, and this cap on top of it. The curve alone does the job. The cap
// was belt and braces, and it cost five of every eight dive frames:
//
//   fall px/s      100     200     300     400     500    620+
//   cap at 0.5     desc-1  desc-1  desc-2  desc-2  desc-2  desc-3
//   no cap         desc-1  desc-2  desc-3  desc-4  desc-6  desc-8
//
// A light dive moves ONE frame. What comes back is the deep end - the
// frames the sheets were drawn around and the game had never once painted,
// on 22 suits. Nothing rotates: for a bank suit rigPitch is 0 in the
// shipped motion mode, so this picks a painted frame and the attitude is
// whatever the artist drew into it.
//
// This is the DEFAULT. Per-suit overrides live in SUIT_DIVE_DEPTH below,
// because one global number could not survive the owner's roster review.
export const POSE_DIVE_DEPTH = 1;

// THE FROZEN ROSTER (owner, 9 Sep 2026, flying the whole thing after the
// ramp landed: "ok honestly they all fly. it's much better").
//
// The review named twelve suits as finished and OFF LIMITS while the rest
// are worked on - "there need to be frozen untouchable while tweaking other
// suits" - and that is not something a comment can enforce. Six of them fly
// an ascent/descent bank, so before this they shared ONE dive dial with
// every suit the same review called awful. Tuning Ion moved Eclipse.
//
//   AcorNut     "Perfect"          Big Booty   "perfect"
//   Flight      "just ok, but it's base level, introductory and free, good"
//   Robo        "great for its character"
//   Alien       "a bit odd, but it's an alien, keep it"
//   Volt        "unique but looks fluid"
//   Cyber       "more of a cruise but matches its character, the tail does
//                almost all the work"
//   Eclipse     "very good"        Seraph      "solid flier now"
//   Arcflash    "beautiful but unique and shouldn't be copied"
//   Cat         "amazing"
//   Briella's   "the motion is incredible, honestly ideal for standard to
//                replicate against"
//
// AcorNut, Arcflash, Robo, Big Booty, Volt and Cat reach no dial at all -
// their own painters or 16-frame tap banks answer first - so freezing them
// is a matter of not touching those paths. The six that DO ride this dial
// are pinned here at the value they were approved on, and the harness
// fails if any of them moves. Do not edit a frozen line without the owner
// saying so in as many words.
//
// Everything else is tunable. The values below are the same review's own
// complaints, in one word each: the over-divers come back, and the suits
// whose dive frames "barely do work" are held to the shallow end until
// their art is regenerated.
// SHRUNK 12 Sep 2026 (owner: "Robo must remain, Volt remain. Cat, remain.
// Those are truely frozen. the rest are all open for evaluation right
// now", then "robot cat big booty volt all stay default rewind"). AcorNut
// and Arcflash keep their own controllers and were frozen on the 10th
// ("yes arcflash and acornut are good"). Everything else - flight, alien,
// cyber, eclipse, seraph, briellacat, cryostar, verdant - is open, and
// flies the owner's ruling from the TAP_SHAPE / TAP_REPEAT tables.
export const FROZEN_SUITS = ["vanguard", "arcflash", "robo", "bigbooty", "catsuit", "volt"] as const;

// FLIGHT METHOD IS DELIBERATELY NOT STANDARDISED.
// This block used to hold FLIGHT_FAMILIES and FLIES_APART, which grouped
// suits and made a settled family fly one shared ramp. That is the thing
// the owner asked to go, 10 Sep 2026: "Not force every new character to be
// exactly the same", and "standardization's hard when the perfect method
// hasn't been discovered yet ... I like some models more than others, but
// nothing screams use only this one.. so don't gate it."
//
// After the last art pass most suits carry their own tap bank, so they can
// each fly a bit differently, and that is fine for now. There may one day
// be a single solution for all of them or a unique one per character - the
// flight modifier is where that gets worked out - and until then nothing
// here decides it in advance.
//
// What replaced the family rule is simpler and is the real point: every
// suit carries its own number (see SUIT_DIVE_DEPTH), so a value changed to
// fix one reported problem cannot silently move a suit nobody was looking
// at. The failure being prevented is a fix that gets applied globally and
// is never verified to have solved anything.

export const SUIT_DIVE_DEPTH: Record<string, number> = {
  // ---- FROZEN: approved 9 Sep 2026, do not touch ----
  flight: 1, alien: 1, cyber: 1, eclipse: 1, seraph: 1, briellacat: 1,
  // the Eclipse family, locked together on Eclipse's own ramp
  cryostar: 1, verdant: 1,

  // ---- tunable ----
  // THE 3D LINEUP (26 Oct 2026): four rendered dive frames, walked in full
  cinderforge: 1, groveguard: 1, cosmic: 1, sunforged: 1, abyssal: 1,
  iontrim: 1, voidsuit: 1, ember: 1, sammie: 1, gemmie: 1,
  tracer: 1, glasssuit: 1, redline: 1, robodog: 1, geode: 1,
  // Fresh natural banks carry the shallow body pitch in the art and use
  // every tail-whip pose. The temporary limits on obsolete art are retired.
  copper: 1, leviathan: 1,
  ghost: 1, frost: 1,

  // ---- EVERY SUIT CARRIES ITS OWN NUMBER ----
  // These twelve used to have no line here and fell through to
  // POSE_DIVE_DEPTH, which meant one edit moved all twelve at once. Owner,
  // 10 Sep 2026: "right now, every suit is its own. needs to be coded. so
  // changing a value in one place doesn't force everyone to change."
  //
  // Most of them never reach this dial today - their own painters or tap
  // banks answer first - but "never reaches it today" is exactly how a
  // shared number stays invisible until some other change routes them
  // through it. Written out at the value they already flew, so nothing
  // moves; what changes is that moving one of them now takes aim.
  vanguard: 1, arcflash: 1, robo: 1, bigbooty: 1, catsuit: 1, volt: 1,
  raccoon: 1, ferret: 1, hedgehog: 1,
  porcelain: 1, nacre: 1, origamist: 1,
};

/** The dive dial this suit flies. Every shipped suit has its own entry, so
 *  this only falls back for an id that is not a suit at all. */
export function diveDepthFor(id: string) {
  const v = SUIT_DIVE_DEPTH[id];
  return typeof v === "number" ? v : POSE_DIVE_DEPTH;
}

// ECLIPSE, CRYOSTAR AND VERDANT ARE A PREFERENCE, NOT A FAMILY RULE.
// Owner, 10 Sep 2026: "eclipse, verdant, cryo should remain as similar as
// possible, and any change to one should prompt the integrator to ask me
// if i should apply to all 3." So they are not welded together - each has
// its own line above like everything else - but they are named here so a
// change to one cannot go in quietly. The harness asks the question; the
// owner answers it. Splitting them is allowed, it just has to be on
// purpose.
export const MATCHED_TRIO: readonly string[] = ["eclipse", "cryostar", "verdant"];

// THE CLIMB SPAN: the vertical speed that means "full climb pose". This was
// 470 px/s, and the game never gets there - a hard climb peaks near 428, so
// even the best tap asked for 60% of the ramp, which POSE_CURVE then bent
// down to about 30%. The deep frames of every ascent bank were unreachable
// art. 260 is measured, not guessed: the pose walks all eight frames and
// changes on 20% of frames, against the 22% of the spring tail that a motion
// bank REPLACES (fullMotion suppresses the rig tail, so this ramp is the
// whole animation for a suit that has one). The dive keeps its own 620 and
// POSE_DIVE_DEPTH untouched - the shallow dive is the owner's call from
// 2 Sep and this changes nothing about it.
export const POSE_CLIMB_SPAN = 260;

// The RATE-DRIVEN mapping (the hangar A/B switches this on).
//
// The shipped mapping poses the body by INSTANTANEOUS vertical speed, and
// that is what feels jerky: a tap resets vy to -450 and gravity rebuilds it
// at 1300/s2, so the pose is yanked across its whole range twice a second
// whether or not the pilot is actually going anywhere.
//
// What the pilot experiences is not instantaneous speed, it is RATE: am I
// holding level, climbing, or falling, and how hard. So two signals, doing
// two different jobs:
//
//   COMMITMENT (~0.55s average) - how far the body is willing to lean. Tapping
//   just enough to hold station averages to nearly nothing, so the body stays
//   horizontal. Several taps in a row average clearly negative and the body
//   commits to a real climb. A long fall commits to the dive.
//
//   LIFE (~0.09s average) - the instantaneous beat, which only ever pulls the
//   pose a fraction of the way from its commitment. This is what keeps the
//   animation alive between taps, at whatever pace the pilot is tapping,
//   without letting a single tap throw the whole body.
//
// Hover therefore reads as small movement around horizontal; a climb reads as
// a committed climb that still breathes on each beat; and nothing snaps.
//
// A third piece, found by filming all the candidates offline: a pose that is
// merely CORRECT still dies. Pinned in a long fall, every velocity mapping
// tested held one frame for seconds - a still image at the most dramatic
// moment. So the pose carries a small motion BUDGET: a gentle cycle whose
// amplitude opens only as the mapping itself goes still, and closes again the
// moment real motion returns. A pinned dive keeps breathing; a busy hover
// gets no extra churn piled onto it.
//
// The target is a band, measured by counting frame changes per second against
// the real constants: under ~3/s reads as a still image, 6-12/s reads as
// deliberate animation (hand-drawn work sits here), over ~20/s reads as
// vibration. This lands 9-15/s in flight and 2-3/s pinned; the shipped
// mapping manages 20/s hovering and 0/s falling.
// HEADING: the body simply points where it is going - the tangent of the
// flight arc, atan2(vy, forward speed). It is the most physically honest of
// the three and it self-normalises, since the same climb rate reads shallower
// when the run is faster. Its cost is resolution: the true tangent sweeps
// roughly 130 degrees on every hop, so eight frames of bank have to cover
// that whole sweep and the frames turn over quickly.
const MOTION_HEADING_MAX = (55 * Math.PI) / 180;

// Owner-requested Eclipse motion transfer, 8 Sep 2026. These whole-character
// banks share Eclipse's heading, preview arc and contact response.
const ECLIPSE_FLIGHT_SUITS = new Set(["eclipse", "cryostar", "verdant"]);


// Suits with no painted motion banks get the same flight from their RIG.
// Measured off Eclipse's banks, its motion is mostly two rotations: the body
// pitches about 19 degrees through the climb and about 40 through the dive,
// and the tail trails the body by roughly 25 degrees climbing and swings well
// past it in a deep dive. Both are inside what the tail hinge already does
// for every one of the 29 rigged suits, so the fleet can fly the same shape
// without a single new drawing.
//
// What this CANNOT reproduce is the limb articulation painted into Eclipse's
// frames - the arms and hands that turned out to be why heading reads alive.
// A rigged suit gets the silhouette of the motion, not the performance, and
// that gap is the argument for transferring real frames onto the suits that
// matter most rather than settling here.
/** The lean actually in force for a suit: the editor's working value if the
 *  pilot is dialling one in, otherwise the shipped table, otherwise neutral.
 *  Every rotation site goes through here so the hangar preview and the real
 *  flight can never disagree about what a number means. */
function leanFor(save: SaveData | null | undefined, id: string) {
  const edited = save?.suitLean?.[id];
  return edited ?? suitLean(id);
}

const RIG_PITCH_UP = (14 * Math.PI) / 180;    // eased back from Eclipse's 19
const RIG_PITCH_DOWN = (30 * Math.PI) / 180;  // eased back from Eclipse's 40
const RIG_TAIL_TRAIL = 0.55;                  // how much of the pitch the tail lags by
// Suits whose own animation is already approved and must not be touched.
// Suits the heading pitch must NOT touch. The rotation is calibrated for a
// character painted belly-down at about +14 degrees, which is where the
// whole family sits: Flight 14, Ion 12, Frost 16, Ghost 17, Eclipse 24.
// A suit painted outside that band gets rotated from the wrong starting
// attitude, and the further off it is the worse the result. The Alien is
// painted HEAD-UP at -22 - 36 degrees the other side of the family - so a
// climb tipped it back until it sat upright in the sky rather than
// climbing, which is what the owner saw as leading with its head.
// The 3D lineup too (26 Oct 2026): its rendered dive frames carry the attitude.
const RIG_PITCH_SKIP = new Set(["robo", "bigbooty", "catsuit", "alien", "raccoon", "ferret", "hedgehog",
  "ember", "voidsuit", "groveguard", "cinderforge", "sunforged", "abyssal", "gemmie", "iontrim", "sammie", "cosmic",
  "flight", "frost", "leviathan", "copper", "arcflash", "origamist", "eclipse", "cryostar", "verdant", "porcelain", "ghost", "nacre",
  "tracer", "glasssuit", "redline", "robodog", "geode", "seraph"]);
// the critters' flight cycles play at this rate, on the world clock
const LOOP_FPS = 12;
// A painted motion bank normally CARRIES the attitude, so rotating it as
// well would pitch the character twice. Cyber's bank is not built that way:
// it is one glide ramp played in both directions, carrying how far the body
// EXTENDS rather than which way it points, and the rig supplies the
// direction over the top. That is what lets nine frames read as a climb and
// a dive instead of needing two sheets that never quite agree at the seam.
const RIG_PITCH_WITH_BANK = new Set(["cyber"]);

// THE FRAMES A GENERATED BANK LOST. Twenty-two of the tap banks were made
// from one shared motion, and that motion loses the pilot's LOWER BODY at
// its extremes - hip, haunch and hind leg leave the silhouette entirely and
// the torso becomes a bar from neck to tail. Measured, not guessed: every
// one of those twenty-two banks bottoms out on the SAME frame, 5, while the
// five hand-animated banks bottom out at 9, 10, 14 and 15. An identical
// damage point across twenty-two sheets is a shared generator, not a
// coincidence.
//
// Redrawing them is the real fix. Until then a bank can name the frames it
// lost, and the tap plays the survivors across the same duration - the
// gesture keeps its timing and its endpoints, it just steps through fewer
// poses. Purely subtractive: no frame is altered, and emptying a list
// restores the bank exactly.
const TAP_FRAME_SKIP: Record<string, number[]> = {
  // Ion's skip list is gone: the redraw arrived. Its damaged tap bank is
  // retired outright for a painted asc/desc ramp, and the skip died with
  // the bank it patched - a skip entry for a suit with no tap bank is a
  // typo, and the verifier says so.
};

/** The frames of a bank that are actually fit to draw, 0-based. */
function tapFrameOrder(id: string, n: number): number[] {
  const skip = TAP_FRAME_SKIP[id];
  const all: number[] = [];
  for (let i = 0; i < n; i++) if (!skip || skip.indexOf(i + 1) < 0) all.push(i);
  return all.length ? all : [0];
}
let headingA = 0;
let headingClock = -1;
// WHEN THE DESCENT FRAMES TRIGGER (owner, 9 Sep 2026: "then it's a matter
// of devising when descent frames trigger... like the descent frames the
// tail doesn't need to appear in free fall, if your barely falling, for a
// tap, it's a jump up driven by motion of the squirrel so the tap should
// play").
//
// The tap owns a whole second, and gravity does not wait: by the time the
// gesture finishes the pilot is often already falling hard. Handing over
// raw at that moment jumps the picture from level straight to the deepest
// dive - measured at tick 204 of the harness, pose 0 to pose 7 in one
// frame, on a fall of 872 px/s. So the DIVE eases in over this time
// constant while the TAP stays exact: the tap is a gesture and must land on
// its drawn frames, the dive is momentum and should arrive like momentum.
// Seeded from wherever the tap left off, which is level, so the handover
// itself costs nothing.
const DIVE_ENTRY_SECONDS = 0.18;
let bankPose = 0;
let bankPoseClock = -1;
function easeBankPose(t: number, target: number, exact: boolean) {
  const fresh = bankPoseClock < 0 || t < bankPoseClock;
  const dt = fresh ? 0.016 : Math.min(0.05, t - bankPoseClock);
  bankPoseClock = t;
  if (exact || fresh) bankPose = target;
  else bankPose += (target - bankPose) * (1 - Math.exp(-dt / DIVE_ENTRY_SECONDS));
  return bankPose;
}

function trackHeadingMotion(t: number, vy: number, vx: number) {
  const fresh = headingClock < 0 || t < headingClock;
  if (fresh) headingA = 0;
  const dt = fresh ? 0.016 : Math.min(0.05, t - headingClock);
  headingClock = t;
  const target = Math.atan2(vy, Math.max(60, vx));
  headingA += (target - headingA) * (1 - Math.exp(-dt / 0.12));
  return Math.max(-1, Math.min(1, headingA / MOTION_HEADING_MAX));
}

const MOTION_LIFE = 0.35;   // how far the beat may pull the pose off its commitment
const MOTION_CYCLE_HZ = 1.15;
const MOTION_CYCLE_FRAMES = 0.9;   // amplitude in FRAMES, at full stillness
let rateFast = 0;
let rateSlow = 0;
let ratePrev = 0;
let rateStill = 0;
let ratePhase = 0;
let rateClock = -1;
function trackRateMotion(t: number, vy: number) {
  const fresh = rateClock < 0 || t < rateClock;
  if (fresh) {
    rateFast = 0;
    rateSlow = 0;
  }
  const dt = fresh ? 0.016 : Math.min(0.05, t - rateClock);
  rateClock = t;
  rateFast += (vy - rateFast) * (1 - Math.exp(-dt / 0.09));
  rateSlow += (vy - rateSlow) * (1 - Math.exp(-dt / 0.55));
  // climbing is the slow direction in this game (about 230px/s sustained) and
  // gravity makes falling fast (about 520px/s), so the two are scaled apart
  // rather than sharing one number
  const lean = (v: number) => {
    const k = Math.min(1, Math.abs(v) / (v < 0 ? 300 : 520));
    return (v < 0 ? -1 : 1) * Math.pow(k, 1.15);
  };
  const commit = lean(rateSlow);
  const pose = commit + (lean(rateFast) - commit) * MOTION_LIFE;
  // how much the pose is moving on its own, and therefore how much of the
  // cycle's budget is needed to keep the body alive
  const moving = Math.min(1, Math.abs(pose - ratePrev) / dt / 1.6);
  ratePrev = pose;
  rateStill += ((1 - moving) - rateStill) * (1 - Math.exp(-dt / 0.25));
  ratePhase += dt * 2 * Math.PI * MOTION_CYCLE_HZ;
  return { pose, cycle: Math.sin(ratePhase) * MOTION_CYCLE_FRAMES * rateStill };
}

function paintIllustrated(
  ctx: CanvasRenderingContext2D,
  spr: Sprite | HTMLImageElement | null | undefined,
  x: number,
  y: number,
  size: number,
  helmet: (typeof HELMETS)[number],
  suit: (typeof SUITS)[number],
  _t = 0,
  art?: ArtBank | null,
  frameKey = "idle-1",
  sprNext?: Sprite | HTMLImageElement | null,
  keyNext?: string,
  blend = 0,
  halo: "dark" | "light" = "dark",
  tailRot = 0,
  tapAnimT = -1,
  bounceAnimT = -1,
  bounceAnimDir = 0,
  bounceAnimStrength = 0,
  motionVy = 0,
  motionMode = 0,
  motionVx = 0,
  // the lean in force for this suit. Passed rather than looked up because
  // paintIllustrated has no save: the caller already resolved it, and two
  // resolutions could disagree.
  lean: SuitLean = SUIT_LEAN_DEFAULT,
  // the loadout case hands in the pose itself (-1 full climb .. +1 full
  // dive, already shaped), so its sweep lands on frames exactly, with no
  // smoother between; NaN means "derive it from the motion, as in play"
  poseOverride = NaN,
  // Live bank playback is input-driven; isolated shelf previews may cycle.
  tapDriven = false,
  // how a tap moves the ascent bank: null = the stock ramp, "velocity" =
  // the freeze-day path, {fwd, back} = the owner's linear dial (see
  // TAP_SHAPE in control-constants; tapShapeFor resolves the beta dial)
  tapShape: TapShape | "velocity" | null = null,
  wake?: PremiumBankWake,
  // Arcflash's electrical wake, now that it flies a rendered bank (its joint rig retired)
  arcWake?: { state: ArcflashMotion; travel?: ArcflashTravel },
) {
  // the equipped suit IS the body: its painted render replaces the
  // default flight frames, carried by the pilot's motion
  // Flight's animation frames already wear the Clear dome. Any other helmet
  // needs the bare rigged Flight painting so it does not stack two helmets.
  // Where the articulated tap ships (the beta), Flight + Clear ALSO takes
  // the rigged painting: the old crossfade walks through eight paintings
  // whose outfits disagree (shoes on some frames, bare feet on others),
  // and the rig path moves one consistent body like every other suit.
  if (suit.id === "vanguard") {
    paintVanguard(ctx, art, x, y, size);
    return;
  }
  if (isArcflashRig(suit.id)) {
    paintArcflash(ctx, art, x, y, size);
    return;
  }
  if (isHighOrbitRig(suit.id)) {
    paintOrbitPilot(ctx,art,suit.id,x,y,size,helmet);
    return;
  }
  const suited = art?.suits?.[suit.id] ?? null;
  const body = suited ?? spr;
  if (!body) return;

  // A rigged suit draws as two pieces with the tail hinged, so a tap
  // actually moves something. The tail goes down first — it sits behind
  // the pilot — then the body over it.
  const rigT = suited ? art?.suitTail?.[suit.id] : null;
  const rigB = suited ? art?.suitBody?.[suit.id] : null;
  // A COMPLETE MOTION BANK IS ITS OWN TICKET IN. This gate used to demand
  // rig layers, which silently held Alien 2 - a bank-only suit with no
  // body/tail cut - to the static-sprite path below: 16 painted attitudes
  // shipped and the pilot never moved. The frames carry the whole
  // character, so a suit that has them needs no rig to fly them; every
  // branch in here that touches rigT/rigB is unreachable on that route
  // (fullMotion is checked first and returns).
  // A flight CYCLE is a ticket in for the same reason (the critters,
  // 7 Sep 2026): sixteen whole-character frames, no rig cut, and the gate
  // was holding them to the static sprite - the owner's sheets never moved.
  // A tap bank with a dive bank and no climb (the 3D test, 25 Oct 2026) is a
  // ticket in on the same terms: whole-character frames, no rig cut.
  const bankReady = suited
    ? ((art?.suitAsc?.[suit.id]?.length ?? 0) > 0 && (art?.suitDesc?.[suit.id]?.length ?? 0) > 0)
      || (art?.suitLoop?.[suit.id]?.length ?? 0) > 0
      || (!(art?.suitAsc?.[suit.id]?.length) && (art?.suitTap?.[suit.id]?.length ?? 0) > 0
        && (art?.suitDesc?.[suit.id]?.length ?? 0) > 0)
    : false;
  // The regenerated neutral is the exact first frame. While the banks load,
  // keep its normalized head/helmet fit instead of flashing the old split rig.
  if (suited && NATURAL_FLIGHT_SUITS.has(suit.id) && !bankReady) {
    drawRigLayer(ctx, suited, NATURAL_FLIGHT_BOX, x, y, size, 0, undefined, halo);
    paintDome(ctx, suited, "suit:" + suit.id, helmet, x, y, size, art);
    return;
  }
  if (suited && ((rigT && rigB) || bankReady)) {
    // Rig-driven heading flight: the whole character pitches to point along
    // its flight path, and the tail trails that pitch instead of following it
    // rigidly. Only for suits with no painted bank of their own, and never
    // while a painted full-character frame is on screen - those already carry
    // an attitude and would be rotated twice.
    const rigPitchOn = motionMode === 2 && !RIG_PITCH_SKIP.has(suit.id)
      && (RIG_PITCH_WITH_BANK.has(suit.id) || !(art?.suitAsc?.[suit.id]?.length));
    let rigPitch = 0;
    if (rigPitchOn) {
      const hp = trackHeadingMotion(_t, motionVy, motionVx);
      // the same dial, so one number governs a suit's lean however it is
      // drawn - a rigged suit carries both sources and feels it twice
      const rigLean = lean;
      rigPitch = hp < 0 ? hp * RIG_PITCH_UP * rigLean.up : hp * RIG_PITCH_DOWN * rigLean.down;
    }
    const pitched = rigPitch !== 0;
    if (pitched) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rigPitch);
      ctx.translate(-x, -y);
    }
    const ref = (suited as Sprite).box ?? { x: 0, y: 0, w: suited.width, h: suited.height };
    const pivot = TAIL_PIVOT[suit.id];
    // ECLIPSE's physics-pose experiment: with ascend/descend banks present,
    // posture is DRIVEN BY VERTICAL VELOCITY, not a tap clock — rising
    // deepens the climb pose, the arc settles to level, and falling rolls
    // into the dive ramp. Earth physics, worn on the body.
    const ascFrames = art?.suitAsc?.[suit.id] ?? [];
    const descFrames = art?.suitDesc?.[suit.id] ?? [];
    const fullMotion = ascFrames.length > 0 && descFrames.length > 0;
    // A CONTINUOUS CYCLE (the critters): whole-character frames that loop on
    // the clock the whole time the suit is worn. Outranks the tap bank, and
    // like a motion bank it carries its own tail, so no rig layer draws.
    const loopFrames = art?.suitLoop?.[suit.id] ?? [];
    const fullLoop = !fullMotion && loopFrames.length > 0;
    const tapFrames = art?.suitTap?.[suit.id] ?? [];
    const tapTailFrames = art?.suitTapTail?.[suit.id] ?? [];
    // A SIXTEEN-frame bank is a full-character shoot — body, tail, and all —
    // so during the burst the frame IS the pilot: no rig tail, no body
    // layer, no pulse. Smaller banks keep the layered treatment below.
    const fullTap = tapAnimT >= 0 && tapFrames.length === 16;
    // A TAP BANK AND A DIVE BANK, NO CLIMB (owner, 25 Oct 2026: "12 tap, 4
    // dive, try something new"). Built for rendered 3D banks: the tap plays
    // its whole gesture on the tap clock, falling walks the dive by velocity,
    // and between the two the pilot rests on the tap's first frame, which is
    // also the dive's first. Every frame is the whole character.
    const tapDive = !fullMotion && tapFrames.length > 0 && descFrames.length > 0;
    // A full-character BOUNCE bank plays the painted planet-contact recoil
    // (impact, discharge, slight overturn, correction) instead of the rig.
    // Contact takes visual priority over any tap in flight.
    const bounceFrames = art?.suitBounce?.[suit.id] ?? [];
    const fullBounce = bounceAnimT >= 0 && bounceFrames.length === 16;
    let tailPose: Sprite | HTMLImageElement = rigT;
    let tailPoseRot = tailRot - rigPitch * RIG_TAIL_TRAIL;
    if (fullBounce || fullMotion || fullLoop || tapDive) {
      /* these frames carry the whole character, tail included */
    } else if (bounceAnimT >= 0 && suit.id === "eclipse" && pivot) {
      const bend = bounceAnimDir * bounceAnimStrength
        * sampleMotionCurve(BOUNCE_TAIL_CURVE, bounceAnimT, BOUNCE_ANIM_DURATION);
      drawBentRigLayer(ctx, rigT, ref, x, y, size, tailRot * 0.42, bend, pivot);
    } else if (!fullTap && !fullBounce && !fullMotion && !fullLoop && tapAnimT >= 0 && tapTailFrames.length === 12) {
      // One tail drawing per 30 fps presentation frame. The sequence bends
      // progressively from the planted hinge to the tip: launch drag, delayed
      // whip, one rebound, settle. A small share of the live spring remains so
      // a tap entered mid-swing does not snap to a canned orientation.
      // Reach the straightened launch silhouette quickly, then spend most of
      // the clock pulling the tail back in. This is intentionally asymmetric:
      // the old even spacing made the last tail pose jerk into rest.
      const tailTimes = [0, 0.03, 0.065, 0.105, 0.15, 0.2, 0.26, 0.335, 0.415, 0.5, 0.575, 0.625, TAP_ANIM_DURATION];
      let tailIndex = 11;
      for (let i = 0; i < 12; i++) {
        if (tapAnimT < tailTimes[i + 1]) { tailIndex = i; break; }
      }
      tailPose = tapTailFrames[tailIndex];
      // Preserve enough of the live spring to show every accepted tap even
      // while the painted recovery is still in progress.
      tailPoseRot *= 0.48;
      drawRigLayer(ctx, tailPose, ref, x, y, size, tailPoseRot, pivot, halo);
    } else if (!fullTap && !fullBounce && !fullMotion && !fullLoop && tapAnimT >= 0 && pivot) {
      drawBentRigLayer(ctx, rigT, ref, x, y, size, tailRot * 0.48, sampleTapCurve(TAP_TAIL_CURVE, tapAnimT), pivot);
    } else if (!fullTap && !fullBounce && !fullMotion && !fullLoop) {
      drawRigLayer(ctx, tailPose, ref, x, y, size, tailPoseRot, pivot, halo);
    }
    let poseA: Sprite | HTMLImageElement = rigB;
    let tapPoseRegistration: TapPoseRegistration | null = null;
    if (bounceAnimT >= 0 && suit.id === "eclipse") {
      // Contact takes visual priority over the tap bank. The approved static
      // body is transformed below; no armor, hand, face, or helmet pixels are
      // redrawn for the impact.
      poseA = rigB;
    } else if (tapAnimT >= 0 && tapFrames.length === 8) {
      // A traditional stepped bank stays crisp at the 52 px gameplay size.
      // Crossfading painterly faces produces double eyes and soft armor seams;
      // eight close poses already supply the in-betweens. Static body bookends
      // make both the tap entry and return to glide exact, with no identity pop.
      const poses: (Sprite | HTMLImageElement)[] = [rigB, ...tapFrames, rigB];
      // Knees tuck promptly; hands and torso return over the long half of the
      // motion. Repeat taps leave this clock alone, preventing the recovery
      // frames from snapping backward to an earlier arm pose.
      const poseTimes = [0, 0.035, 0.08, 0.135, 0.2, 0.275, 0.365, 0.46, 0.55, 0.625, TAP_ANIM_DURATION];
      let pose = poses.length - 1;
      for (let i = 0; i < poses.length; i++) {
        if (tapAnimT < poseTimes[i + 1]) { pose = i; break; }
      }
      poseA = poses[pose];
      if (suit.id === "eclipse" && pose > 0 && pose < poses.length - 1) {
        tapPoseRegistration = ECLIPSE_TAP_REGISTRATION[pose - 1] ?? null;
      }
    }
    if (fullBounce) {
      const idx = Math.min(15, Math.floor((bounceAnimT / BOUNCE_ANIM_DURATION) * 16));
      const refB = (bounceFrames[0] as Sprite).box ?? ref;
      drawRigLayer(ctx, bounceFrames[idx], refB, x, y, size, 0, undefined, halo);
      if (!wearsOwnHead(suit)) paintDome(ctx, suited, "suit:" + suit.id, helmet, x, y, size, art);
    } else if (fullMotion) {
      // A light exponential smooth keeps rapid taps from strobing the
      // pose; the ramps themselves already grade the attitude.
      // two mappings, switched from the hangar so both can be flown back to back
      let v: number;
      let cycle = 0;
      // set when a branch has already produced a frame position and must not
      // be run through the dive depth and pose curve a second time
      let preShaped = false;
      // VELOCITY (owner, 12 Sep 2026: "only change eclipse. to try it"):
      // how fast the pilot rises picks the frame, as it did at the freeze.
      // The three gates on velocityAscent are the whole difference a
      // freeze-vs-today trace found for Eclipse.
      const velocityAscent = tapShape === "velocity";
      if (Number.isFinite(poseOverride)) {
        v = Math.max(-1, Math.min(1, poseOverride));
      } else if (!velocityAscent && tapAnimT >= 0 && ascFrames.length > 1) {
        // THE TAP PLAYS THE ANIMATION. EVERY SUIT. VELOCITY PLAYS THE DIVE.
        //
        // Owner, 9 Sep 2026: "every single suit, regardless of its custom
        // frames or anything, should follow this... if the tap animation
        // doesn't play fully, it feels unresponsive... a 16 frame animation
        // should play." And on why velocity was the wrong master: "i think
        // when we tried to trigger tail motion depth by velocity, the tail
        // position downward passes over to frame depth."
        //
        // That is the bug in one sentence. Driving the climb from vertical
        // speed makes the ARC own the picture, so a tap only gets whatever
        // slice of the bank its velocity spike happens to reach - and a tap
        // is a jump, not a readout. The nine newest banks shipped with a
        // slew-rate limiter on top of that, which inverted it completely:
        // measured on the sim, a second tap after a pause moved the pose no
        // visible frame at all, while spamming taps was the only way to
        // reach the deep frames.
        //
        // So the climb runs on the TAP CLOCK for every banked suit, exactly
        // the way Cat and Robo's sixteen-frame banks do a few branches
        // below - the whole bank across the whole tap, linearly, whatever
        // the velocity is doing. Accepted repeat taps queue one replay;
        // they never rewind or truncate the current painted gesture.
        //
        //   tap, pause, tap    robo (16f, shipped)  1345789bcdfg.1245689acde
        //                      a bank on the clock  122344566788.11233455677
        //
        // The dive is untouched and stays velocity-driven below: no tap is
        // involved in falling, so it engages on real downward momentum.
        // OUT AND BACK, because an ascent bank is a RAMP, not a cycle.
        // Robo's sixteen frames are a whole gesture that returns to neutral
        // on its own; the eight-frame path a few branches below even
        // bookends them, [rig, ...frames, rig]. An asc bank is not that: it
        // runs level -> deepest climb, so playing it straight through and
        // stopping leaves the pilot parked at maximum climb and then SNAPS
        // into the dive. The harness caught exactly that - "iontrim: no
        // skipped tail pose at tick 204", the tick the tap window closes.
        //
        // So the gesture climbs out and settles back to level inside the
        // tap, on the cadence already authored for the eight-frame bank
        // (poseTimes below): through the bank over the first 62.5% of the
        // window, home over the rest. It ends where the glide and the dive
        // both begin, so the handover costs no frame.
        const n = ascFrames.length;
        let climb: number;
        if (tapShape) {   // narrowed past "velocity" by the branch above
          // THE DIAL: linear out over fwd seconds, linear home over back.
          // tapAnimT is seconds on the 1.0 s tap clock, so past fwd + back
          // the pilot simply sits home until the clock ends.
          climb = tapAnimT <= tapShape.fwd ? tapAnimT / tapShape.fwd
            : Math.max(0, 1 - (tapAnimT - tapShape.fwd) / tapShape.back);
        } else {
          const at = Math.pow(Math.min(1, Math.max(0, tapAnimT / TAP_ANIM_DURATION)), PAINTED_TAP_EASE);
          const OUT = 0.625;
          climb = at <= OUT ? at / OUT : 1 - (at - OUT) / (1 - OUT);
        }
        const k = Math.min(n - 1, Math.round(climb * (n - 1)));
        // already a frame position, so the pose curve must not touch it
        v = easeBankPose(_t, -(k / (n - 1)), true);
        preShaped = true;
      } else {
        if (motionMode === 1) {
          const r = trackRateMotion(_t, motionVy);
          v = r.pose;
          cycle = r.cycle;
        } else if (motionMode === 2) {
          v = trackHeadingMotion(_t, motionVy, motionVx);
        } else {
          const sv = smoothMotionVy(_t, motionVy);
          v = sv < 0 ? -Math.min(1, -sv / POSE_CLIMB_SPAN) : Math.min(1, sv / 620);
        }
        // shape the attitude: the dive half shallowed, both halves curved
        // After an input gesture, rising velocity must not restart its climb.
        if (tapDriven && !velocityAscent) v = Math.max(0, v);
        if (v > 0) v *= diveDepthFor(suit.id);
      }
      if (!preShaped && !Number.isFinite(poseOverride)) {
        v = Math.sign(v) * Math.pow(Math.abs(v), POSE_CURVE);
        // the dive arrives like momentum, not like a cut
        if (ascFrames.length > 1 && !velocityAscent) v = easeBankPose(_t, v, false);
      }
      const diving = v > 0;
      const bank = diving ? descFrames : ascFrames;
      const idxM = diving || v < 0
        ? Math.max(0, Math.min(bank.length - 1, Math.round(Math.abs(v) * (bank.length - 1) + cycle)))
        : 0;
      const frame = bank[idxM];
      // A WINDOW FOR THE EVALUATION HARNESS: which frame the game is
      // painting right now, and the shaped velocity it chose it from.
      // Read-only, one object write per frame, never read by the game.
      (window as unknown as { __acornautPose?: unknown }).__acornautPose =
        { suit: suit.id, bank: diving ? "desc" : "asc", idx: idxM + 1, v };
      const refM = NATURAL_FLIGHT_SUITS.has(suit.id) ? NATURAL_FLIGHT_BOX : (ascFrames[0] as Sprite).box ?? ref;
      if (isPremiumSuit(suit.id) && wake) paintPremiumBankWake(ctx,suit.id,diving?"desc":"asc",idxM,refM,x,y,size,wake);
      drawRigLayer(ctx, frame, refM, x, y, size, 0, undefined, halo);
      // the helmet rides the HEAD, which these frames move with the
      // attitude - each frame carries its own dome anchor. The anchor is
      // in canvas space, so it must be mapped through the SAME reference
      // box the frame itself is drawn with (asc[0]), not the frame's own.
      if (!wearsOwnHead(suit)) {
        paintDome(ctx, ascFrames[0], `${suit.id}-${diving ? "desc" : "asc"}-${idxM + 1}`,
          helmet, x, y, size, art);
      }
    } else if (tapDive) {
      let frame: Sprite | HTMLImageElement;
      let k = 0;
      let bankName = "tap";
      let v = 0;
      if (Number.isFinite(poseOverride)) {
        // the loadout's sweep: its climb half scrubs the tap gesture, its
        // dive half walks the dive
        v = Math.max(-1, Math.min(1, poseOverride));
        const bank = v > 0 ? descFrames : tapFrames;
        k = Math.max(0, Math.min(bank.length - 1, Math.round(Math.abs(v) * (bank.length - 1))));
        bankName = v > 0 ? "desc" : "tap";
        frame = bank[k];
      } else if (tapAnimT >= 0) {
        // the whole gesture across the whole tap, linearly, like Robo's
        k = Math.min(tapFrames.length - 1, Math.floor((tapAnimT / TAP_ANIM_DURATION) * tapFrames.length));
        frame = tapFrames[k];
        // the dive eases in from level when the gesture ends
        easeBankPose(_t, 0, true);
      } else {
        const sv = smoothMotionVy(_t, motionVy);
        v = sv > 0 ? Math.pow(Math.min(1, sv / 620), POSE_CURVE) * diveDepthFor(suit.id) : 0;
        v = easeBankPose(_t, v, false);
        k = Math.max(0, Math.min(descFrames.length - 1, Math.round(v * (descFrames.length - 1))));
        bankName = k > 0 ? "desc" : "tap";
        frame = k > 0 ? descFrames[k] : tapFrames[0];
      }
      (window as unknown as { __acornautPose?: unknown }).__acornautPose =
        { suit: suit.id, bank: bankName, idx: k + 1, v };
      // one registration for both banks: they are rendered on one canvas
      const refT = (tapFrames[0] as Sprite).box ?? ref;
      // a signature wake leaves from the frame's own measured feet, under the pilot
      const boots = RIG3D_BOOTS[`${suit.id}-${bankName}-${k + 1}`];
      if (wake && boots && isHighOrbit(suit.id)) paintBootWake(ctx, suit.id, boots, refT, x, y, size, wake);
      if (arcWake && boots) paintArcflashBootWake(ctx, arcWake.state, boots, refT, x, y, size, arcWake.travel);
      drawRigLayer(ctx, frame, refT, x, y, size, 0, undefined, halo);
      // every rendered frame carries its own measured helmet anchor (tools/rig3d
      // anchors.json), read against the bank's first frame like the bank itself
      if (!wearsOwnHead(suit)) {
        const pose = `${suit.id}-${bankName}-${k + 1}`;
        paintDome(ctx, tapFrames[0], DOME[pose] ? pose : "suit:" + suit.id, helmet, x, y, size, art);
      }
    } else if (fullLoop) {
      // THE TAP TRIGGERS IT, NOT A CLOCK (owner, 9 Sep 2026: "the critters
      // still should activate on tap, not a clock. even if it's not a ascent
      // bank or descent bank.. it's an animation triggered by the tap").
      //
      // Quill, Noodle and Bandit carry a sixteen-frame cycle and no ascent
      // or descent bank at all, so they were the one group the tap could not
      // reach: the cycle ran free on the world clock and a tap changed
      // nothing about the picture. That is the unresponsive feel exactly -
      // the pilot presses and the character does not answer.
      //
      // So the cycle plays across the tap, the same way every other painted
      // bank now does, and the sim queues one replay for repeat taps. With
      // no tap running the character rests on its first frame, which is what
      // a bank with no dive half can honestly show. The world clock stays
      // for the hangar and any caller with no tap of its own, so a shelf
      // card still breathes.
      const idx = tapAnimT >= 0
        ? Math.min(loopFrames.length - 1,
            Math.floor((tapAnimT / TAP_ANIM_DURATION) * loopFrames.length))
        : tapDriven ? 0 : Math.floor(Math.max(0, _t) * LOOP_FPS) % loopFrames.length;
      const refL = (loopFrames[0] as Sprite).box ?? ref;
      drawRigLayer(ctx, loopFrames[idx], refL, x, y, size, 0, undefined, halo);
    } else if (fullTap) {
      // frame registration comes from the bank's own first frame, so every
      // frame lands at the same scale and the character never pulses in size
      // play the surviving frames over the whole tap, so a skipped frame
      // costs a pose rather than shortening the gesture
      const order = tapFrameOrder(suit.id, tapFrames.length);
      const idx = order[Math.min(order.length - 1,
        Math.floor((tapAnimT / TAP_ANIM_DURATION) * order.length))];
      const ref16 = (tapFrames[0] as Sprite).box ?? ref;
      drawRigLayer(ctx, tapFrames[idx], ref16, x, y, size, 0, undefined, halo);
      if (!wearsOwnHead(suit)) {
        // A per-pose anchor where the bank moves the head; the single static
        // anchor everywhere else, which is correct for banks that hold it
        // still. Measured against the BANK's own box, so it is read with the
        // bank's first frame as the reference body - same as asc/desc above.
        const pose = `${suit.id}-tap-${idx + 1}`;
        if (DOME[pose]) paintDome(ctx, tapFrames[0], pose, helmet, x, y, size, art);
        // Even a static source-space socket must use the same bank box as
        // the body. The suit portrait's trim can differ from tap[0]'s trim.
        else paintDome(ctx, tapFrames[0], "suit:" + suit.id, helmet, x, y, size, art);
      }
    } else if (tapAnimT >= 0 && tapFrames.length !== 8 && pivot) {
      // Universal body impulse: scale from the tail hinge, not the canvas
      // centre. The model stretches forward a few pixels and rebounds without
      // repainting armor, anatomy, face, or the helmet attachment.
      const pulse = sampleTapCurve(TAP_BODY_CURVE, tapAnimT);
      const { px, py } = rigPlacement(ref, x, y, size, pivot);
      ctx.save();
      ctx.translate(px, py);
      ctx.scale(1 + pulse * 0.052, 1 - pulse * 0.028);
      ctx.translate(-px, -py);
      drawRigLayer(ctx, poseA, ref, x, y, size, 0, undefined, halo);
      if (!wearsOwnHead(suit)) paintDome(ctx, suited, "suit:" + suit.id, helmet, x, y, size, art);
      ctx.restore();
    } else {
      if (tapPoseRegistration) {
        drawRegisteredTapLayer(ctx, poseA, ref, x, y, size, tapPoseRegistration, halo);
      } else {
        drawRigLayer(ctx, poseA, ref, x, y, size, 0, undefined, halo);
      }
      if (!wearsOwnHead(suit)) paintDome(ctx, suited, "suit:" + suit.id, helmet, x, y, size, art);
    }
    if (pitched) ctx.restore();
    return;
  }
  // frames crossfade instead of hard-switching — the four paintings blend
  // through each other so the cycle reads as motion, not a slideshow
  const f = suited ? 0 : blend;
  if (!suited && sprNext && f > 0.02) {
    const prevA = ctx.globalAlpha;
    ctx.globalAlpha = prevA * (1 - f);
    drawSprite(ctx, body, x, y, size);
    ctx.globalAlpha = prevA * f;
    drawSprite(ctx, sprNext, x, y, size);
    ctx.globalAlpha = prevA;
  } else {
    // the pilot's separation follows the sky like everything else — a
    // hardcoded dark halo left dark suits (the Void skin especially)
    // with no edge at all against a dark backdrop
    drawSprite(ctx, body, x, y, size, "box", halo);
  }
  if (suited) {
    if (!wearsOwnHead(suit)) paintDome(ctx, body, "suit:" + suit.id, helmet, x, y, size, art);
    return;
  }
  // the dome anchor glides between the two frames' measured positions
  const a1 = DOME[frameKey];
  const a2 = keyNext ? DOME[keyNext] : null;
  if (a1 && a2 && f > 0.02) {
    const mix: [number, number, number] = [
      a1[0] + (a2[0] - a1[0]) * f,
      a1[1] + (a2[1] - a1[1]) * f,
      a1[2] + (a2[2] - a1[2]) * f,
    ];
    DOME.__mix = mix;
    paintDome(ctx, body, "__mix", helmet, x, y, size, art);
    delete DOME.__mix;
  } else {
    paintDome(ctx, body, frameKey, helmet, x, y, size, art);
  }
}

/** "#rrggbb" (or "#rgb") to an rgba() string at the given alpha; anything
 *  else passes through (a colour the canvas already understands) */
function glowRgba(hex: string, a: number) {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  let h = m[1]; if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
}

function drawPilot(
  ctx: CanvasRenderingContext2D,
  w: World,
  save: SaveData,
  art: ArtBank,
  xOverride?: number,
  localScale = 1,
  yOverride?: number,
  bankScale = 0.8,
  effects = true,
) {
  const x = xOverride ?? w.W * PHYS.squirrelX;
  const y = yOverride ?? w.squirrel.y;
  const wornId = pilotSuitId(w, save);
  const suit = SUITS.find((s) => s.id === wornId) ?? SUITS[0];
  const helm = helmetWornBy(save.equipped, wornId);
  // Paint before the body transform so old stream samples stay in the
  // world when the pilot banks. Attach the stream at the pilot's rear edge.
  paintLiveStarTrail(ctx, w, trailWornBy(save.equippedTrail, wornId), {
    time: w.time, x: x - 25 * localScale, y: y + 8 * localScale,
    travel: w.distance, scale: localScale, power: Math.min(1, Math.max(0, w.flapBoost) / .22),
    active: !w.ready && w.screen === "play",
  }, w.screen === "pause" || w.screen === "lvldone");
  // The repainted flap frames are one coherent character, so the tap
  // cycles them again — plus a soft nose-up kick and scale pop for punch.
  const flapping = w.flapBoost > 0;
  const frames = flapping ? art.squirrelFlap : art.squirrelIdle;
  const speed = flapping ? 10 : 5;
  const ft = w.time * speed;
  const idx = frames.length ? Math.floor(ft) % frames.length : 0;
  const nxt = frames.length ? (idx + 1) % frames.length : 0;
  // smoothstep eases the crossfade so each pose still gets its moment
  const fr = ft - Math.floor(ft);
  const blend = fr * fr * (3 - 2 * fr);
  const spr = frames[idx] ?? null;
  const frameKey = (flapping ? "flap-" : "idle-") + (idx + 1);
  const keyNext = (flapping ? "flap-" : "idle-") + (nxt + 1);
  const flagship = suit.id === "vanguard";
  const arcflash = isArcflashRig(suit.id);
  const orbit = isHighOrbitRig(suit.id);
  const independentRig = flagship || arcflash || orbit;
  if (flagship) paintVanguardContacts(ctx, w.vanguard);
  const articulatedTap = independentRig || (NATURAL_FLIGHT_SUITS.has(suit.id) || !!art.suitBody?.[suit.id]) && w.tapAnimT >= 0;
  const eclipseImpact = ECLIPSE_FLIGHT_SUITS.has(suit.id) && w.bounceAnimT >= 0;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(localScale, localScale);
  if (eclipseImpact) {
    // Scale around the planet-facing edge instead of the sprite centre. The
    // contact point stays planted while Eclipse flattens, lengthens into the
    // rebound, and rings down to the exact original silhouette.
    const shape = bounceShape(w.bounceAnimT, w.bounceAnimStrength);
    const contactY = -w.bounceAnimDir * 18;
    ctx.translate(0, contactY);
    ctx.scale(shape.x, shape.y);
    ctx.translate(0, -contactY);
  }
  // THE TAP ACCENT (beta switch; tap retrofit study, 12 Sep 2026, item 4):
  // a 167 ms ignition behind the boots in the suit's glow colour, and a
  // second-order body reaction - about 3% wider, 5% shorter, 6 degrees
  // nose-up at the peak, ~70 ms after the tap, settled by ~250 ms. Both
  // read the ACCEPTED tap (flapBoost, tapReact), never the tap clock, so
  // every tap shows at every cadence. Off unless the owner switches it on.
  //
  // THE STRENGTH DIAL (owner, 12 Sep 2026, after a frame-by-frame look at
  // Cyber: "build a dial, i can barely notice it"). One multiplier on all
  // three parts - ignition radius, squash and nose-up - 1 is what shipped,
  // 4 is four times it. And the ignition now burns white at the core with
  // the suit's glow as the rim: Cyber's glow is the same violet as its
  // body, so a glow-only ignition vanished on the one suit the owner was
  // judging it on.
  //
  // LIVE ON BOTH PAGES since 12 Sep 2026 (owner: "enable it in game").
  // The player's switch is Character Glow on the Profile tab; the strength
  // is per suit from TAP_ACCENT_STRENGTH (0 = none on that suit), with the
  // beta dial over it.
  const accentK = !save.glowOff && !independentRig ? tapAccentStrengthFor(save, suit.id) : 0;
  if (accentK > 0) {
    const k = accentK;
    const age = 0.22 - Math.max(0, w.flapBoost);   // seconds since the last tap
    if (w.flapBoost > 0 && age < 0.167) {
      const stage = age < 0.017 ? 1 : age < 0.05 ? 2 : age < 0.1 ? 3 : 4;
      const amp = [0, 0.5, 1, 0.6, 0.3][stage];
      const col = (suit as { glow?: string | null }).glow ?? helm.glow ?? "#4ad8ff";
      const radius = (9 * amp + 2) * Math.sqrt(k);
      ctx.save();
      ctx.translate(-9, 5);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
      g.addColorStop(0, `rgba(255,255,255,${(0.95 * amp).toFixed(3)})`);
      g.addColorStop(0.35, glowRgba(col, 0.85 * amp));
      g.addColorStop(1, glowRgba(col, 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    const r = Math.max(0, Math.min(1, w.tapReact)) * k;
    ctx.rotate(-r * (6 * Math.PI) / 180);
    ctx.scale(1 + 0.03 * r, Math.max(0.5, 1 - 0.05 * r));
  }
  // the sim's real pitch — dives nose down, bounces kick the body over;
  // the old ±6° bank made every impact read as nothing happening
  // THE LEAN DIAL, applied to the rotation every suit gets - painted bank
  // or not. Split by direction because climbing and diving are separately
  // tunable: negative rot is nose-up. At 1 this is exactly the expression
  // it replaced. See SUIT_LEAN in control-constants.ts.
  const lean = leanFor(save, suit.id);
  let bank = w.squirrel.rot * bankScale * (w.squirrel.rot < 0 ? lean.up : lean.down);
  if (articulatedTap && !eclipseImpact) {
    // Every current model now uses the same eased visual pitch clock. Eclipse
    // supplies painted body poses; the other rigs use the identity-safe body
    // pulse and sectional tail bend in paintIllustrated below.
    const raw = Math.max(0, Math.min(1, w.tapAnimT / 0.14));
    const eased = 1 - Math.pow(1 - raw, 3);
    const fromLean = w.tapAnimFromRot < 0 ? lean.up : lean.down;
    bank = w.tapAnimFromRot * 0.8 * fromLean * (1 - eased) + bank * eased;
  }
  const kick = Math.min(1, Math.max(0, w.flapBoost) / 0.22);
  // THE PITCH DIAL: the suit's whole-animation forward lean, on top of the
  // velocity bank. Independent rigs apply it inside their own painters so
  // moving nozzles turn without rotating already-emitted world-space wake.
  if (!independentRig) ctx.rotate(bank - (articulatedTap ? 0 : kick * 0.12) + (suitPitchFor(save, suit.id) * Math.PI) / 180);
  const pop = 1 + (articulatedTap ? 0 : kick * 0.05);
  ctx.scale(pop, pop);
  // fresh planet bounce: a squash-and-stretch pulse sells the impact
  const sq = Math.max(0, (w.hitCooldown - 0.33) / 0.22);
  if (!independentRig && !eclipseImpact && sq > 0) ctx.scale(1 + sq * 0.16, 1 - sq * 0.2);
  if (flagship) paintVanguard(ctx, art, 0, 2, 52, w.vanguard);
  else if (arcflash) paintArcflash(ctx, art, 0, 2, 52, w.arcflash,
    { x: x/localScale, y: y/localScale, travel: w.distance/localScale }, true,
    (suitPitchFor(save, suit.id) * Math.PI) / 180);
  else if (isHighOrbitRig(suit.id)) paintOrbitPilot(ctx,art,suit.id,0,2,52,helm,w.highOrbit,
    {x:x/localScale,y:(y+2*localScale)/localScale,travel:w.distance/localScale},true,
    (suitPitchFor(save,suit.id)*Math.PI)/180);
  else paintIllustrated(ctx, spr, 0, 2, 52, helm, suit, w.time, art, frameKey,
    frames[nxt] ?? null, keyNext, blend,
    w.flight === "tunnel" ? "light" : skyLuma(w) > 0.42 ? "dark" : "light", w.tailA, w.tapAnimT,
    // Cryostar and Verdant now share Eclipse's heading mapping by owner
    // request. All three use the same smoother, pose curve and frame index.
    w.bounceAnimT, w.bounceAnimDir, w.bounceAnimStrength, w.squirrel.vy, ECLIPSE_FLIGHT_SUITS.has(suit.id) ? 2 : 0, w.speed,
    lean, NaN, true, tapShapeFor(save, suit.id),
    // the High Orbit five fly rendered banks now (CUT_RIG_RETIRED); their wake rides the bank
    effects && (isPremiumSuit(suit.id) || CUT_RIG_RETIRED.has(suit.id)) ? {state:w.highOrbit,travel:w.distance/localScale} : undefined,
    effects && suit.id === "arcflash" && !arcflash ? {state:w.arcflash,travel:{x:x/localScale,y:y/localScale,travel:w.distance/localScale}} : undefined);
  if (flagship && w.shieldCharges > 0) paintVanguardShield(ctx, 0, 0, w.time);
  ctx.restore();
}

const PAL_ANIM_FPS = 12;

// The offline review uses the exact production pilot painter and a local
// simulation. It never writes a player's save or substitutes a pose player.
export {drawPilot as paintPilot};

/** the companions to paint: the tutorial's Acorn alone during its lesson,
 *  otherwise every pal the run flies, high slot first */
function flyingPals(save: SaveData, w: World): string[] {
  if (w.tut && (w.tut.stage === "pal" || w.tut.stage === "gates7" || w.tut.stage === "portal")) return ["buddy"];
  return runPals(save, w);
}

function paintPal(
  ctx: CanvasRenderingContext2D,
  art: ArtBank | null | undefined,
  id: string,
  x: number,
  y: number,
  size: number,
  time = 0,
) {
  // A pal with an idle bank plays it; one without keeps its still, which is
  // what every pal did before the banks existed. The banks are their own
  // true lengths, so the clock is frames-per-second and not a fraction of
  // some shared cycle - a 4-frame loop and a 36-frame loop both read at the
  // pace they were drawn for.
  const bank = art?.palAnim?.[id];
  const anim = bank && bank.length > 1
    ? bank[Math.floor(time * PAL_ANIM_FPS) % bank.length]
    : null;
  const spr = anim ?? art?.pals?.[id];
  if (spr) {
    // box fit, not core: companions are sidekicks, smaller than the pilot
    // The premium silhouettes carry more transparent negative space than
    // the round original pals. Small visual-only lifts keep their faces at
    // the same apparent card/live scale without changing their hitboxes or
    // any gameplay value (pals have neither).
    const fit = size * (
      id === "nightglider" ? 1.32
        : id === "clockling" ? 1.12
          : id === "prismwing" ? 1.08
            : 1
    );
    if (id === "switchback") {
      // The owner's frames share one registered canvas. Fitting each fin
      // silhouette independently would make the acorn breathe and wander.
      ctx.drawImage(spr, x-fit*128/208, y-fit*128/208, fit*256/208, fit*256/208);
    } else drawSprite(ctx, spr, x, y, fit);
    return;
  }
  if (id !== "none") {
    // no painted portrait for this companion — the vector renderer from
    // the live game draws it (comet sprite, nebula wisp)
    drawPalOn(ctx, id, x, y, size / 32, performance.now() / 1000);
    return;
  }
  if (id === "none") {
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, size * 0.32, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - size * 0.2, y + size * 0.2);
    ctx.lineTo(x + size * 0.2, y - size * 0.2);
    ctx.stroke();
  }
}

export function paintPortrait(
  ctx: CanvasRenderingContext2D,
  art: ArtBank | null,
  helmet: (typeof HELMETS)[number],
  suit: (typeof SUITS)[number],
  cx: number,
  cy: number,
  size: number,
  _t = 0,
) {
  if(isHighOrbitRig(suit.id)){
    paintOrbitPilot(ctx,art,suit.id,cx,cy+2,size,helmet,undefined,undefined,false);
    return;
  }
  // Always paint the PILOT wearing the helmet. Helmet-only art belongs
  // on the helmet cards, which have their own path — short-circuiting
  // here left the Flight suit showing a floating helmet and no squirrel.
  const body = art?.suits?.[suit.id] ?? art?.squirrelIdle?.[0];
  if (!body) return;
  const key = art?.suits?.[suit.id] ? "suit:" + suit.id : "idle-1";
  if (naturalFlightKey(key)) drawRigLayer(ctx, body, NATURAL_FLIGHT_BOX, cx, cy + 2, size);
  else drawSprite(ctx, body, cx, cy + 2, size);
  if (!wearsOwnHead(suit)) paintDome(ctx, body, key, helmet, cx, cy + 2, size, art);
}

/** A LOOPING JUMP, painted with the game's own renderer.
 *
 *  The shop needs to show what a suit actually DOES, and a static portrait
 *  cannot: Robo's articulated tap, Eclipse's impact squash and every rig's
 *  pitch all live in the flight path, not the idle pose. drawPilot() owns
 *  that path but reads a dozen fields off a live World, so rather than fake
 *  a World this drives paintIllustrated directly - the same painter, given
 *  a synthetic tap clock instead of a simulated one.
 *
 *  One cycle: tap, rise, stall, fall. Same shape as a real flap, so what
 *  the shop shows is what the pilot will fly.
 */
/** THE PLUME, ON THE SIM'S OWN SPRING. The preview used to hand
 *  paintIllustrated a flat tail angle of 0, which is why the tail sat
 *  curled and still while every other part of the suit moved - and why the
 *  pal, which has no such shortcut, looked alive next to it.
 *
 *  The sim integrates this spring frame by frame off its world state. A
 *  preview has no world, and is drawn from two different canvases, so it
 *  cannot keep state of its own without them fighting over it. But the
 *  forcing here is known: one impulse per beat, forever. So the same
 *  recurrence - not an approximation of it, the same lines - is replayed
 *  from two beats back on each call, which is far past the point where an
 *  older beat is worth a pixel. Checked against the sim across a settled
 *  beat: within 0.1 rad at the steepest point and 4% at the peak, which is
 *  one frame's worth of curve. */
function previewTailAngle(p: number, beat: number) {
  const dt = 1 / 60;
  let a = 0;
  let v = 0;
  const settle = (steps: number) => {
    for (let i = 0; i < steps; i++) {
      v += (-TAIL.stiffness * a - TAIL.damping * v) * dt;
      a += v * dt;
      if (a > TAIL.maxA) { a = TAIL.maxA; v *= -0.35; }
      if (a < -TAIL.maxA) { a = -TAIL.maxA; v *= -0.35; }
    }
  };
  for (let k = 0; k < 2; k++) { v += TAIL.flap; settle(Math.round(beat / dt)); }
  v += TAIL.flap;
  settle(Math.round(p / dt) + 1);   // +1: the sim draws after its step
  return a;
}

/** The preview's lean, smoothed and LOOP-CONSISTENT.
 *
 *  A damped follower has memory, so its value at a given phase depends on
 *  everything before it - and a preview is entered at an arbitrary time.
 *  Replaying two whole beats first lands on the loop's steady state rather
 *  than on whatever the first painted frame happened to start from, so the
 *  same phase always draws the same lean no matter when the menu opened.
 *  Same trick previewTailAngle uses for the plume.
 */
function previewRot(p: number, beat: number, kick: number, pull: number) {
  const dt = 1 / 120;
  const tau = 0.085;                       // ~85ms to ease through a tap
  const k = 1 - Math.exp(-dt / tau);
  let r = 0;
  const end = beat * 2 + p;
  for (let tt = 0; tt < end; tt += dt) {
    const ph = ((tt % beat) + beat) % beat;
    const vy = -kick + pull * ph;
    r += (Math.max(-0.34, Math.min(0.6, vy / 900)) - r) * k;
  }
  return r;
}

/** The same fitted ship in flight, the Depot and the Loadout: hull,
 * engines, pulse cone, canopy, pilot and installed module indicators.
 * Preview state is isolated from purchases and the live run. */
export type ShipPick = SpillBuild;
const shipPreviewStates = new Map<string, SpillState>();
export function paintShipPreview(
  ctx: CanvasRenderingContext2D, art: ArtBank | null | undefined, save: SaveData,
  cx: number, cy: number, scale: number, t: number, pick: ShipPick,
) {
  if (!art) return;
  const key = JSON.stringify(pick);
  let s = shipPreviewStates.get(key);
  if (!s) {
    s = spillPreviewState(pick);
    if (shipPreviewStates.size >= 16) shipPreviewStates.delete(shipPreviewStates.keys().next().value!);
    shipPreviewStates.set(key, s);
  }
  s.pilot.y = 0; s.thrustT = 0.22;
  s.signal = spillEngineColor(save).color;
  const w = { time: t, squirrel: { y: 0, vy: 0, rot: 0 }, W: 390, H: 760 } as World;
  ctx.save(); ctx.translate(cx, cy + Math.sin(t * 1.7) * 2); ctx.scale(scale, scale);
  drawSpillShip(ctx, w, save, art, s, 0); ctx.restore();
}

export function paintFlightPreview(
  ctx: CanvasRenderingContext2D,
  art: ArtBank | null | undefined,
  suit: (typeof SUITS)[number],
  helmet: (typeof HELMETS)[number],
  cx: number,
  cy: number,
  size: number,
  t: number,
  lean: SuitLean = SUIT_LEAN_DEFAULT,
  // THE LEAN EDITOR'S INSTRUMENT. The ordinary preview flies a gentle tap
  // arc that never reaches the attitudes a real dive does, so dialling a
  // lean against it would be tuning the wrong end of the range. In sweep
  // mode the pilot rolls slowly between FULL CLIMB and FULL DIVE - the
  // clamps the sim actually uses - so the number being changed is judged at
  // the extremes where it matters.
  sweep = false,
  // the suit's dialled forward lean, radians (see SUIT_PITCH_DEFAULTS)
  pitch = 0,
) {
  if (!art) return;
  if (isArcflashRig(suit.id)) {
    paintArcflash(ctx, art, cx, cy, size, arcflashPreview(ctx,t), undefined, true, pitch);
    return;
  }
  if (isHighOrbitRig(suit.id)) {
    paintOrbitPilot(ctx,art,suit.id,cx,cy,size,helmet,highOrbitPreview(ctx,suit.id,t),undefined,true,pitch);
    return;
  }
  if (suit.id === "vanguard") {
    const state = vanguardPreview(ctx, t);
    ctx.save(); ctx.translate(cx,cy); ctx.scale(size/52,size/52);
    paintVanguardContacts(ctx,state); ctx.restore();
    paintVanguard(ctx, art, cx, cy, size, state);
    return;
  }
  // FLIGHT, NOT A POSE. The pass before this showed one tap every five
  // seconds and then held still for the other four - which read as a frozen
  // suit sitting next to a pal that never stops, and looked nothing like
  // the game, where the pilot taps again long before the last flap has
  // finished. So the preview flies: a tap every beat, the arc between them,
  // and the plume swinging on the sim's own spring. Still slowed, because
  // seeing the motion was the point of a preview - but never stopped.
  const BEAT = 1.6;                       // one tap per beat
  const RATE = 0.5;                       // the tap animation itself, halved
  const p = ((t % BEAT) + BEAT) % BEAT;   // time since this beat's tap

  // THE TAP PLAYS THE WHOLE BANK. It used to play a FIFTH of it: the window
  // ran 0.6s and fed the clock straight through as tapAnimT = p * RATE, so
  // tapAnimT never passed 0.30 against a TAP_ANIM_DURATION of 1.0 - which
  // indexes frames 0..4 of sixteen and then hard-cuts back to the rig pose
  // mid-gesture. That cut is the jolt: measured at 10px of travel and 15% of
  // silhouette in a single frame on Robo. Mapping the window onto the whole
  // duration plays all sixteen and lands on the frame the bank was drawn to
  // land on, which is the rig pose it returns to.
  const tapWindow = TAP_ANIM_DURATION;
  const flapWindow = 0.24 / RATE;
  // THE HEAD DOES NOT SIT STILL IN THE HELMET, and holding the body pose to
  // hide that was the wrong trade - it cost every rigged suit its animation,
  // which is the whole reason the preview exists. The suits animate.
  //
  // The float itself is real and pre-existing: a rigged suit's tap poses
  // move the head, but the dome is anchored to ONE per-suit position because
  // no per-POSE anchors were ever measured for those banks. Suits that wear
  // their own head - Cat, Volt, Cyber - never had the problem, which is
  // exactly why Cyber looked right.
  //
  // Fixing it properly means a measured dome anchor per pose per rigged
  // suit. Template-matching the head through the banks tracks Robo cleanly
  // and drifts on Big Booty and Eclipse, so it is an art measurement rather
  // than something to infer - see the note in the PR.
  const tapAnimT = p < tapWindow ? (p / tapWindow) * TAP_ANIM_DURATION : -1;

  const flapping = p < flapWindow;
  const frames = flapping ? art.squirrelFlap : art.squirrelIdle;
  const speed = flapping ? 10 : 5;
  const ft = t * speed * RATE;
  const idx = frames?.length ? Math.floor(ft) % frames.length : 0;
  const nxt = frames?.length ? (idx + 1) % frames.length : 0;
  const fr = ft - Math.floor(ft);
  const blend = fr * fr * (3 - 2 * fr);

  // The arc a tap actually makes: up hard on the beat, the pull easing it
  // back down, the next tap catching it. The pull is chosen so the pilot
  // comes back to exactly the height it left from as the beat comes round,
  // which is what makes this loop with no seam and no fade.
  const KICK = 210;                       // the sim's own tap velocity
  const PULL = (2 * KICK) / BEAT;
  // A PAINTED MOTION BANK IS SWEPT, NOT TAPPED (owner, 2 Sep 2026: "seraph
  // animation frozen... again. gemmie is twitching sizes bad. ghost still
  // has a flash frame"). Driven by the tap sawtooth below, a bank suit only
  // ever reached the first three climb frames and the first six dive
  // frames, and hard-cut from the deepest dive back to the shallow climb
  // on every beat - a different frame for one paint, then the reset.
  // Seraph's first three frames of either ramp are the same glide, so on
  // that arc it never visibly moved. In the case the pilot now rolls
  // through the frames PLAY REACHES, in order, both ways: the whole climb
  // ramp, and the dive ramp as far as the shallow dive takes it - a
  // triangle in frame-space, so every frame gets the same time and the
  // turn at each end holds one step. The pose goes straight into the
  // painter, no smoother in between, so it lands on the frame exactly.
  // Tap-bank suits keep the beat, because their tap IS the showcase.
  const ascN = art.suitAsc?.[suit.id]?.length ?? 0;
  const descN = art.suitDesc?.[suit.id]?.length ?? 0;
  const swept = !sweep && !ECLIPSE_FLIGHT_SUITS.has(suit.id) && ascN > 0 && descN > 0 && (art.suitTap?.[suit.id]?.length ?? 0) !== 16;
  let sweptPose = NaN;
  let vy = -KICK + PULL * p;
  let rise = -KICK * p + (PULL * p * p) / 2;   // zero at both ends of a beat
  // ROTATION IS SMOOTHED, because the arc's VELOCITY is a sawtooth: vy runs
  // -210 up to +210 across a beat and then snaps back to -210 at the next
  // tap. Position loops seamlessly - rise is zero at both ends - but a
  // rotation taken straight off vy jumps 27 degrees on every beat boundary.
  // In flight that is hidden by speed and by the pose changing on the same
  // frame; at half speed and 158px it reads as the pilot flinching.
  let rot = sweep
    // the sim's own clamps: -0.55 at full climb, +0.95 at full dive
    ? -0.55 + (0.95 + 0.55) * (0.5 - 0.5 * Math.cos((t / 2.6) * Math.PI * 2))
    : previewRot(p, BEAT, KICK, PULL);
  if (swept) {
    const STEP = 0.13;                    // seconds per frame
    const up = ascN - 1;                  // asc-1 .. asc-N
    const dive = diveDepthFor(suit.id);
    const reach = Math.round(Math.pow(dive, POSE_CURVE) * (descN - 1));
    const down = reach + 1;               // asc-1 -> desc-1 .. desc-(reach+1)
    const SWEEP = 2 * STEP * (up + down);
    const x = (((t % SWEEP) + SWEEP) % SWEEP) / SWEEP;
    const u = 1 - 2 * Math.abs(2 * x - 1);          // -1 .. 1 .. -1, linear
    // frame-space: negative steps climb, positive steps dive; the painter
    // rounds |pose|*(N-1) to an index, so a half step either side of zero
    // is the level frame, one full step like every other
    sweptPose = u < 0
      ? -(-u * up) / Math.max(1, up)
      : u * down > 0.5 ? Math.max(1e-4, (u * down - 1) / Math.max(1, descN - 1)) : 0;
    // the lean and the bob follow the same arc: the velocity that would
    // have produced this attitude in play, the dive side at its shallow cap
    vy = sweptPose < 0
      ? -POSE_CLIMB_SPAN * Math.pow(-sweptPose, 1 / POSE_CURVE)
      : (620 * Math.pow(sweptPose, 1 / POSE_CURVE)) / dive;
    rise = -70 * Math.sin(x * Math.PI * 2);
    rot = Math.max(-0.34, Math.min(0.6, vy / 900));
  }

  ctx.save();
  ctx.translate(cx, cy + rise * (size / 52) * 0.055);
  ctx.scale(size / 52, size / 52);
  // the old line divided by 0.24 while the window was 0.24/RATE, so the
  // second half of every flap fed a NEGATIVE kick - tilting the wrong way
  // and shrinking the suit instead of popping it
  const kick = flapping ? 1 - p / flapWindow : 0;
  const articulated = !!art.suitBody?.[suit.id] && tapAnimT >= 0;
  // the same expression the real flight uses, so what the editor shows is
  // what the run does
  ctx.rotate(rot * 0.8 * (rot < 0 ? lean.up : lean.down) - (articulated ? 0 : kick * 0.12) + pitch);
  const pop = 1 + (articulated ? 0 : kick * 0.05);
  ctx.scale(pop, pop);
  paintIllustrated(ctx, frames?.[idx] ?? null, 0, 2, 52, helmet, suit, t, art,
    (flapping ? "flap-" : "idle-") + (idx + 1),
    frames?.[nxt] ?? null, (flapping ? "flap-" : "idle-") + (nxt + 1), blend,
    "light", previewTailAngle(p, BEAT), tapAnimT, -1, 0, 0, vy, 2, 300, lean, sweptPose, false,
    tapShapeFor(null, suit.id),   // the table only: a preview has no save
    isPremiumSuit(suit.id) ? {state:premiumWakePreview(ctx,suit.id,t,vy),travel:t*300}
      : CUT_RIG_RETIRED.has(suit.id) && isHighOrbit(suit.id) ? {state:highOrbitPreview(ctx,suit.id,t),travel:t*300} : undefined,
    suit.id === "arcflash" && !isArcflashRig(suit.id) ? {state:arcflashPreview(ctx,t)} : undefined);
  ctx.restore();
}

export function paintPalPreview(
  ctx: CanvasRenderingContext2D,
  art: ArtBank | null | undefined,
  id: string,
  cx: number,
  cy: number,
  size: number,
) {
  paintPal(ctx, art, id, cx, cy, size, performance.now() / 1000);
}

export function paintTrailPreview(
  ctx: CanvasRenderingContext2D,
  trail: (typeof TRAILS)[number],
  cx: number,
  cy: number,
  t = 0,
) {
  if (trail.id === "vanguardwake") paintVanguardWake(ctx, cx, cy, t);
  else if (trail.id === "arcflashwake") paintArcflashWake(ctx, cx, cy, t);
  else if (highOrbitTrailSuit(trail.id)) paintHighOrbitWake(ctx,highOrbitTrailSuit(trail.id)!,cx,cy,t);
  else drawTrailPreviewOn(ctx, trail.id, cx, cy, t);
}

/** The vortex that eats the screen while a black hole or wormhole
 *  takes hold — spiral arms winding in, a dark core, a colour bloom.
 *  Purely procedural: no art needed. */
function drawSwirl(ctx: CanvasRenderingContext2D, w: World, art?: ArtBank | null) {
  // The black hole now has a painted collapse: the ring winds in, whips
  // its streaks around and pinches out. When those frames are loaded a
  // hole warp plays them over the bloom instead of the procedural core.
  const painted = w.warpKind === "hole" && !(w.flight === "lost") ? art?.holeEnter : null;
  if (painted && painted.length) {
    const prog = Math.min(0.999, Math.max(0, 1 - w.warpT));
    const frame = painted[Math.min(painted.length - 1, Math.floor(prog * painted.length))];
    const { W: pw, H: ph } = w;
    const diag = Math.hypot(pw, ph);
    const e = prog < 0.5 ? 2 * prog * prog : 1 - Math.pow(-2 * prog + 2, 2) / 2;
    // Grow into the viewer rather than opening already full-bleed: at the
    // start the portal is a shape on screen, by the end it has swallowed
    // it. Centred where the procedural swirl sits, so the two read as one
    // effect while the bank is still streaming in.
    const s = diag * (0.62 + 1.05 * e);
    ctx.save();
    const bloom = ctx.createRadialGradient(pw / 2, ph * 0.46, 0, pw / 2, ph * 0.46, diag * 0.62);
    bloom.addColorStop(0, `rgba(192,132,252,${(0.45 * e).toFixed(3)})`);
    bloom.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = bloom;
    ctx.fillRect(0, 0, pw, ph);
    ctx.drawImage(frame, pw / 2 - s / 2, ph * 0.46 - s / 2, s, s);
    ctx.restore();
    return;
  }
  const { W, H } = w;
  const t = 1 - w.warpT;                       // 0 -> 1 over the transition
  const worm = w.warpKind === "worm" || w.flight === "lost";
  const cx = W / 2;
  const cy = H * 0.46;
  const reach = Math.hypot(W, H) * 0.62;
  const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  const hue = worm ? [110, 240, 216] : [192, 132, 252];
  ctx.save();
  // colour bloom washing over the sky
  const bloom = ctx.createRadialGradient(cx, cy, 0, cx, cy, reach);
  bloom.addColorStop(0, `rgba(${hue[0]},${hue[1]},${hue[2]},${(0.55 * ease).toFixed(3)})`);
  bloom.addColorStop(0.55, `rgba(${hue[0]},${hue[1]},${hue[2]},${(0.16 * ease).toFixed(3)})`);
  bloom.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = bloom;
  ctx.fillRect(0, 0, W, H);
  // spiral arms
  ctx.translate(cx, cy);
  ctx.rotate(t * Math.PI * 2.4 * (worm ? -1 : 1));
  ctx.lineCap = "round";
  for (let a = 0; a < 5; a++) {
    ctx.beginPath();
    const off = (a / 5) * Math.PI * 2;
    for (let k = 0; k <= 42; k++) {
      const f = k / 42;
      const rad = reach * (0.06 + f * 0.95) * (1 - ease * 0.45);
      const ang = off + f * 4.4;
      const px = Math.cos(ang) * rad;
      const py = Math.sin(ang) * rad * 0.92;
      if (k === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.strokeStyle = `rgba(${hue[0]},${hue[1]},${hue[2]},${(0.5 * ease).toFixed(3)})`;
    ctx.lineWidth = 2 + 5 * ease;
    ctx.stroke();
  }
  // the core opens up and swallows the middle
  const coreR = reach * 0.30 * ease;
  const core = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(1, coreR));
  core.addColorStop(0, `rgba(4,2,10,${(0.96 * ease).toFixed(3)})`);
  core.addColorStop(0.72, `rgba(8,4,20,${(0.7 * ease).toFixed(3)})`);
  core.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(0, 0, Math.max(1, coreR), 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = `rgba(255,255,255,${(0.5 * ease).toFixed(3)})`;
  ctx.lineWidth = 1.5 + 2 * ease;
  ctx.beginPath();
  ctx.arc(0, 0, Math.max(1, coreR * 1.04), 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

export function hyperRunChargeCopy(race: NonNullable<World["race"]>) {
  const route = raceRouteTarget(race);
  if (race.phase === "entry") return "WORMHOLE";
  if (route.entryReady) return "WORMHOLE READY";
  if (route.nextCleanGateEnters) return "NEXT CLEAN GATE: WORMHOLE";
  if (route.finalRoute) return "FINAL SPRINT";
  return `CHARGE ${race.charge}/100`;
}

export function hyperRunReadyLines(viewWidth: number): readonly string[] {
  if (viewWidth >= 520) return RACE_READY_COPY;
  return [
    "THREAD GATES · CHARGE SHORTCUTS",
    "FINISH FAST",
    "FLIGHT · HOLD / RELEASE",
    "DOUBLE-TAP + HOLD · BOOST",
    "SWIPE DOWN · DIVE",
    "WORMHOLE · DRAG TO ALIGN",
    "CENTER = FASTER EXIT",
    "PRESS + HOLD TO LAUNCH",
  ];
}

export function drawHud(ctx: CanvasRenderingContext2D, w: World, art?: ArtBank | null, save?: SaveData) {
  // THE NOTCH. Everything in the HUD is laid out from the top edge, so the
  // whole HUD steps down by the safe-area inset; the two bottom-anchored
  // pieces (the Spill's corner control and the level panel) step back up.
  ctx.save();
  ctx.translate(0, w.insetTop || 0);
  try { drawHudBody(ctx, w, art, save); } finally { ctx.restore(); }
}

function drawHudBody(ctx: CanvasRenderingContext2D, w: World, art?: ArtBank | null, save?: SaveData) {
  const { W } = w;
  if (w.spill) {
    drawSpillHud(ctx, w, art, !!save?.spillPromptsOff || !!save?.helpOff, !save?.spillButtonsOff);
    return;
  }
  if (w.race) {
    const race = w.race;
    ctx.textAlign = "center";
    ctx.fillStyle = "#fff";
    ctx.font = "800 30px Figtree, system-ui";
    ctx.fillText(formatRaceTicks(race.finishTicks ?? race.tick), W / 2, 40);
    ctx.fillStyle = "rgba(255,224,128,.92)";
    ctx.font = "800 10px Figtree, system-ui";
    const phase = race.phase === "normal" ? "HYPER RUN" : race.phase.toUpperCase();
    ctx.fillText(`${phase} · ${Math.min(RACE_LENGTH, Math.floor(race.coursePosition))} / ${RACE_LENGTH}`, W / 2, 57);
    const route = raceRouteTarget(race);
    const tunnelQuality = race.phase === "tunnel" || race.phase === "return"
      ? raceTunnelQuality(race)
      : null;
    const judgedRings = tunnelQuality
      ? tunnelQuality.passed + tunnelQuality.perfect + tunnelQuality.missed
      : 0;
    const totalTunnelRings = tunnelQuality ? judgedRings + tunnelQuality.pending : 0;
    const chargeCopy = tunnelQuality
      ? race.phase === "return"
        ? `EXIT ${Math.round(tunnelQuality.exitSpeed)} · ${tunnelQuality.perfect} PERFECT`
        : `ALIGN ${judgedRings}/${totalTunnelRings} · PERFECT ${tunnelQuality.perfect} · EXIT ${Math.round(tunnelQuality.exitSpeed)}`
      : hyperRunChargeCopy(race);
    const cellW = 4;
    const gap = 2;
    const groupGap = 3;
    const totalW = cellW * 20 + gap * 19 + groupGap * 4;
    const x0 = W / 2 - totalW / 2;
    for (let i = 0; i < 20; i++) {
      const groupsBefore = Math.floor(i / 4);
      const x = x0 + i * (cellW + gap) + groupsBefore * groupGap;
      const activeCells = tunnelQuality
        ? Math.floor(judgedRings / Math.max(1, totalTunnelRings) * 20)
        : Math.floor(race.charge / 5);
      ctx.fillStyle = i < activeCells
        ? tunnelQuality ? "#fff" : "#6ef0d8"
        : "rgba(255,255,255,.15)";
      ctx.fillRect(x, 66, cellW, 6);
    }
    ctx.fillStyle = race.phase === "tunnel" || race.phase === "return"
      ? "#a9f5ff"
      : race.phase === "entry" || route.entryReady || route.nextCleanGateEnters
      ? "#ffe77d"
      : route.finalRoute
        ? "rgba(214,225,241,.78)"
        : "rgba(255,255,255,.68)";
    ctx.font = "700 9px Figtree, system-ui";
    ctx.fillText(chargeCopy, W / 2, 84);
    ctx.textAlign = "left";
    ctx.fillStyle = "#ffd080";
    ctx.font = "700 14px Figtree, system-ui";
    ctx.fillText(`${race.acorns}`, 24, 28);
    if (w.ready) {
      const readyLines = hyperRunReadyLines(W);
      const compact = W < 520;
      const lineHeight = compact ? 20 : 21;
      const panelWidth = Math.min(W - 24, compact ? 430 : 560);
      const panelHeight = readyLines.length * lineHeight + 40;
      const panelTop = Math.min(w.H - (w.insetTop || 0) - panelHeight - 12, Math.max(96, w.H * 0.66));
      ctx.fillStyle = "#101830";
      ctx.strokeStyle = "#2a3454";
      ctx.lineWidth = 1;
      round(ctx, W / 2 - panelWidth / 2, panelTop, panelWidth, panelHeight, 18);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#4ab4ff";
      round(ctx, W / 2 - panelWidth / 2 + 10, panelTop + panelHeight - 44, panelWidth - 20, 34, 16);
      ctx.fill();
      ctx.textAlign = "center";
      readyLines.forEach((line, i) => {
        const isLaunch = i === readyLines.length - 1;
        ctx.fillStyle = isLaunch ? "#0c1224" : i === 0 ? "#fff" : "rgba(215,230,247,.9)";
        ctx.font = isLaunch
          ? "800 18px Figtree, system-ui"
          : i === 0 ? "900 14px Figtree, system-ui" : "800 14px Figtree, system-ui";
        ctx.fillText(line, W / 2, isLaunch ? panelTop + panelHeight - 19 : panelTop + 21 + i * lineHeight);
      });
    }
    return;
  }
  ctx.textAlign = "center";
  ctx.fillStyle = "#fff";
  ctx.font = "800 36px Figtree, system-ui";
if (w.lvl) {
    // a level counts DOWN to the finish, not up into the void — and a
    // Wormhole mission counts SECTIONS, its own unit of survival
    const total = w.lvl.def.gates;
    if (w.lvl.def.base === "tunnel" && w.tunnel) {
      // a wormhole mission is a SURVIVAL clock: seconds left to the finish
      ctx.fillText(`${Math.ceil(Math.max(0, total - w.tunnel.time))}s`, W / 2, 46);
    } else {
      ctx.fillText(`${Math.min(w.score, total)}/${total}`, W / 2, 46);
    }
    ctx.font = "700 11px Figtree, system-ui";
    ctx.fillStyle = "rgba(255,224,128,0.9)";
    ctx.fillText(
      w.lvl.portal ? "FLY TO THE PORTAL" : `LEVEL ${w.lvl.def.ord} · ${w.lvl.def.name}`,
      W / 2, 64,
    );
    // THE THREE OBJECTIVES RIDE THE TOP OF THE RUN. Owner's call: pinned,
    // with counters, green while complete or holding, red the moment one is
    // lost - the touch on "touch no planet", the 28th tap against a cap of
    // 27. Gate missions only: a wormhole or race mission runs its own strip
    // in this exact band and two banners deep is a windshield, not a HUD.
    if (w.lvl.def.base !== "tunnel" && w.lvl.def.base !== "race" && w.lvl.def.base !== "spill") {
      // stats the pills read must be LIVE: taps/bounces/shields tick in the
      // sim, but acorns and gold sync into stats only at the judge - so the
      // run's own counters stand in for them here
      const live = { ...w.lvl.stats, acorns: w.runAcorns };
      const pills = w.lvl.def.goals.map((g) => goalHud(g, live, w.score, w.lvl!.def));
      ctx.font = "800 9.5px Figtree, system-ui";
      const padX = 7, gapX = 6, ph = 17, py = 74;
      const widths = pills.map((p) => ctx.measureText(p.text).width + padX * 2);
      let x = W / 2 - (widths.reduce((a, b) => a + b, 0) + gapX * (pills.length - 1)) / 2;
      for (let i = 0; i < pills.length; i++) {
        const p = pills[i];
        ctx.fillStyle = p.state === "done" ? "rgba(52,140,88,.42)"
          : p.state === "lost" ? "rgba(168,44,36,.5)" : "rgba(16,24,44,.55)";
        round(ctx, x, py, widths[i], ph, 8);
        ctx.fill();
        ctx.strokeStyle = p.state === "done" ? "rgba(111,210,144,.8)"
          : p.state === "lost" ? "rgba(255,122,104,.85)" : "rgba(255,255,255,.22)";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = p.state === "done" ? "#8df0b4"
          : p.state === "lost" ? "#ffa294" : "#d7e6f7";
        ctx.fillText(p.text, x + widths[i] / 2, py + 12);
        x += widths[i] + gapX;
      }
    }
  } else {
    ctx.fillText(String(w.score), W / 2, 46);
  }
  if (w.flight === "tunnel" && w.tunnel) {
    const t = w.tunnel;
    if (t.detour) {
      // A DETOUR HAS A DIFFERENT JOB TO REPORT. Flow is the standalone
      // mode's scoring and pays nothing here, so a meter that filled and
      // glowed while the gate count sat frozen was reporting a number that
      // did not exist - "meaningless", in one word. What a trip is worth is
      // acorns, and what the pilot needs is how long is left and where the
      // door is, so that is what the strip says instead.
      const left = Math.max(0, w.wormLeft);
      const closing = left <= WORM_EXIT_LEAD;
      const tone = closing ? "#c98cff" : "#78dfff";
      ctx.fillStyle = tone;
      ctx.font = "800 10px Figtree, system-ui";
      ctx.fillText(closing ? "FLY INTO THE EXIT" : `WORMHOLE  ${Math.ceil(left)}s`, W / 2, 64);
      const barW = 80;
      const barX = W / 2 - barW / 2;
      ctx.fillStyle = "rgba(255,255,255,.15)";
      ctx.fillRect(barX, 69, barW, 3);
      ctx.fillStyle = tone;
      ctx.fillRect(barX, 69, barW * Math.min(1, left / WORM_TRIP_SECONDS), 3);
    } else {
    const flowColor = t.multiplier >= 3 ? "#f3b4ff" : t.multiplier === 2 ? "#ffe680" : "#78dfff";
    ctx.fillStyle = flowColor;
    ctx.font = "800 10px Figtree, system-ui";
    ctx.fillText(`FLOW  ×${t.multiplier}`, W / 2, 64);
    const barW = 80;
    const barX = W / 2 - barW / 2;
    ctx.fillStyle = "rgba(255,255,255,.15)";
    ctx.fillRect(barX, 69, barW, 3);
    ctx.fillStyle = flowColor;
    ctx.fillRect(barX, 69, barW * (t.flow / 100), 3);
    }
    if (t.bannerLeft > 0) {
      ctx.globalAlpha = Math.min(1, t.bannerLeft);
      ctx.fillStyle = t.bannerKind === "region" || t.bannerKind === "milestone"
        ? "#f2b653"
        : t.bannerKind === "reward" ? "#ffe680" : "rgba(225,232,255,.9)";
      ctx.font = "800 11px Figtree, system-ui";
      ctx.fillText(t.banner, W / 2, 88);
      ctx.globalAlpha = 1;
    }
  }
  if (w.envMsgT > 0) {
    ctx.globalAlpha = Math.min(1, w.envMsgT);
    ctx.fillStyle = "rgba(232,164,74,0.95)";
    ctx.font = "700 12px Figtree, system-ui";
    ctx.fillText(ENVS[w.envB].name, W / 2, 66);
    ctx.globalAlpha = 1;
  }
  ctx.textAlign = "left";
  ctx.font = "700 14px Figtree, system-ui";
  ctx.fillStyle = "#ffd080";
  ctx.fillText(`${w.runAcorns}`, 36, 28);
  if (w.shieldCharges > 0) {
    for (let i = 0; i < w.shieldCharges; i++) {
      ctx.fillStyle = "rgba(122,216,255,0.9)";
      ctx.beginPath();
      // left of the pause button, which owns the top-right corner
      ctx.arc(W - 64 - i * 16, 26, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.7)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
  // status lines stack instead of colliding — mode line first, then any
  // live power-ups beneath it
  let hudY = w.flight === "tunnel" ? 108 : 88;
  const hudLine = (text: string, color: string) => {
    ctx.textAlign = "center";
    ctx.fillStyle = color;
    ctx.font = "700 13px Figtree, system-ui";
    ctx.fillText(text, W / 2, hudY);
    hudY += 18;
  };
  if (w.warpGateEnd >= 0) {
    // Free Flight measures the stretch in gates, so the readout counts the
    // same thing the pilot is flying through, and names the way out.
    const left = Math.max(0, w.warpGateEnd - w.score);
    hudLine(left > 0 ? "BLACK HOLE  " + left + " gates" : "BLACK HOLE  exit ahead", "#c084fc");
  } else if (w.warpLeft > 0) {
    hudLine((w.flight === "deep" ? "SHIFT  " : "BLACK HOLE  ") + Math.ceil(w.warpLeft) + "s", "#c084fc");
  }
  else if (w.flight === "deep" && w.warpT <= 0) hudLine("FIRST SHIFT IN " + Math.ceil(Math.max(0, 10 - w.deepTimer)) + "s", "rgba(192,132,252,0.8)");
  if (w.powerLeft > 0) hudLine(`${w.flight === "tunnel" ? "FREEZE" : "SLOW"}  ${Math.ceil(w.powerLeft)}s`, "#6ef0ff");
  if (w.invulnLeft > 0) hudLine(`GOLD  ${Math.ceil(w.invulnLeft)}s`, "#ffd060");
  if (w.flight === "tunnel" && w.tunnel && w.tunnel.multiplierLeft > 0)
    hudLine(`FLOW BOOST  ${Math.ceil(w.tunnel.multiplierLeft)}s`, "#ffe680");
  const experiment = w.stuck ? "STICKY CONTACT · TAP TO RELEASE"
    : fxOf(w).tapFreeze || (runPals(save, w).includes("switchback") && !w.tut && w.flight === "fly") ? `TAP SLOW · ${w.tapFrozen ? "ON" : "OFF"}`
    : w.scrollReversing ? `SWITCHBACK · ${w.scrollDirection > 0 ? "FORWARD" : "REVERSE"}` : "";
  if (experiment && !w.ready) {
    ctx.save(); ctx.font="bold 12px sans-serif"; ctx.textAlign="center";
    ctx.fillStyle="#e9d2a4"; ctx.fillText(experiment,W/2,w.H*.18); ctx.restore();
  }
  if (w.recoveryMsg) {
    ctx.textAlign = "center";
    ctx.fillStyle = "#fff";
    ctx.font = "800 15px Figtree, system-ui";
    ctx.fillText(w.recoveryMsg, W / 2, w.H * 0.22);
  }
  if (w.warpT > 0) {
    drawSwirl(ctx, w, art);
    ctx.textAlign = "center";
    ctx.fillStyle = w.warpKind === "worm" || w.flight === "lost" ? "#6ef0d8" : "#c084fc";
    ctx.font = "800 22px Figtree, system-ui";
    ctx.fillText(
      w.warpKind === "timeline"
        ? "TIMELINE SHIFT!"
        : w.warpKind === "worm" || w.flight === "lost"
          ? "WORMHOLE!"
          : w.flight === "deep" ? "SPACE SHIFT!" : "BLACK HOLE!",
      W / 2, w.H * 0.3,
    );
  }
  if (w.ready && !w.tut) {
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = "700 18px Figtree, system-ui";
    ctx.globalAlpha = 0.75 + 0.25 * Math.sin(w.time * 4);
    ctx.fillText(w.flight === "tunnel" ? tunnelControlLabel(w) : "TAP TO FLY", W / 2, w.H * 0.38);
    ctx.globalAlpha = 1;
  }
  // THE LEAD-IN HINT. A wormhole entry never shows READY - the pilot is
  // thrown straight in from Lost in Space - so the only place the corridor
  // can say which verb it wants is here, over the open run of it. It fades
  // out as the walls arrive rather than vanishing at a hard edge.
  if (!w.ready && !w.tut && w.flight === "tunnel" && w.tunnel && w.tunnel.leadNodes > 0) {
    const nose = w.tunnel.nodes.find((n) => n.x > w.W * PHYS.squirrelX);
    const left = nose ? w.tunnel.leadNodes - nose.index : 0;
    if (left > 0) {
      ctx.textAlign = "center";
      ctx.fillStyle = "#6ef0d8";
      ctx.font = "800 19px Figtree, system-ui";
      ctx.globalAlpha = Math.min(1, left / 4) * (0.72 + 0.28 * Math.sin(w.time * 5));
      ctx.fillText(tunnelControlLabel(w), W / 2, w.H * 0.30);
      ctx.globalAlpha = 1;
    }
  }
  // ---- THE COACH ------------------------------------------------------
  //
  // Every line the first flight says, in one place, keyed by beat. A frozen
  // beat gets the panel; a beat that is flying gets a single line at the top
  // so it never covers what the pilot is meant to be watching.
  if (w.tut?.hold) {
    const st = w.tut.stage;
    const say: Partial<Record<string, [string, string]>> = {
      learnTap:  ["THIS IS HOW YOU FLY", "a tap gives you a boost upward"],
      learnTap2: ["TRY IT AGAIN", "one more, and watch the arc"],
      boing:     ["BOING!", "planets are bouncy - they never hurt you"],
      handover:  ["NOW YOU'RE IN CONTROL", "tap to fly through the gap in each gate"],
      pal:       ["A COMPANION APPEARS!", "the Acorn pal reels in nearby acorns"],
      done:      ["FLIGHT TUTORIAL COMPLETE", "head to the Loadout to collect your reward"],
    };
    const [title, body] = say[st] ?? ["", ""];
    if (title) drawPrompt(ctx, w, title, body, w.H * 0.36);
    if (w.tut.nudge) {
      ctx.fillStyle = "#ffd080";
      ctx.font = "700 13px Figtree, system-ui";
      ctx.textAlign = "center";
      ctx.fillText(w.tut.nudge, W / 2, w.H * 0.68);
    }
  }

  // ---- THE GESTURE INDICATOR ------------------------------------------
  //
  // A TAPPING INDICATOR, not a target. Owner's ruling: it says "now, like
  // this", not "here". A tap anywhere answers the beat - the real game
  // takes a tap anywhere, and teaching a control the game does not have
  // would be worse than teaching nothing.
  //
  // Centred, a third up from the bottom, which is where a thumb already
  // rests on a phone and clear of the HUD at both ends.
  if (w.tut?.want === "tap" || w.tut?.want === "swipe") {
    const cx = W / 2;
    const cy = w.H * 0.667;
    const beat = 0.5 + 0.5 * Math.sin(w.time * 3.4);
    ctx.save();
    ctx.textAlign = "center";
    if (w.tut.want === "tap") {
      // a ring that pulses outward, and a solid core that does not move -
      // the core is the thumb, the ring is the press
      ctx.strokeStyle = `rgba(255,92,92,${0.28 + 0.42 * (1 - beat)})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy, 26 + beat * 16, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "rgba(255,92,92,0.9)";
      ctx.beginPath();
      ctx.arc(cx, cy, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = "800 11px Figtree, system-ui";
      ctx.fillText("TAP", cx, cy + 4);
    } else {
      // a downward stroke with a head that travels it, drawn from the same
      // anchor so the two lessons read as one vocabulary
      const y0 = cy - 44;
      const y1 = cy + 44;
      ctx.strokeStyle = "rgba(255,92,92,0.35)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx, y0);
      ctx.lineTo(cx, y1);
      ctx.stroke();
      const hy = y0 + (y1 - y0) * beat;
      ctx.fillStyle = "rgba(255,92,92,0.92)";
      ctx.beginPath();
      ctx.arc(cx, hy, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(cx - 7, y1 - 12);
      ctx.lineTo(cx, y1 - 3);
      ctx.lineTo(cx + 7, y1 - 12);
      ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.font = "800 11px Figtree, system-ui";
      ctx.fillText("SWIPE DOWN", cx, y1 + 20);
    }
    ctx.restore();
  }

  // ---- a single line while a beat is FLYING ---------------------------
  const flying: Partial<Record<string, string>> = {
    levelOff: "WATCH THE ARC",
    learnDive: "SOMETIMES YOU NEED DOWN, FAST",
    doDive: "SOMETIMES YOU NEED DOWN, FAST",
    diving: "PLANET AHEAD",
    bouncing: "BOING!",
    gates3: "THREE IN A ROW",
    gates7: "FLY THE GAPS  ·  GRAB THE ACORNS",
    portal: "MAKE FOR THE PORTAL",
  };
  // The reason stays on screen while the ask is up: the line vanished the
  // moment the indicator appeared, so "sometimes you need down, fast" was
  // gone by the time the pilot was being asked to do it.
  const asking = !!w.tut?.want && w.tut.want !== "continue";
  const line = w.tut && (!w.tut.hold || asking) ? flying[w.tut.stage] : undefined;
  if (line) {
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(243,239,228,0.82)";
    ctx.font = "800 13px Figtree, system-ui";
    ctx.fillText(line, W / 2, 86);
    if (w.tut?.stage === "gates3") {
      ctx.fillStyle = "#ffd080";
      ctx.font = "700 12px Figtree, system-ui";
      ctx.fillText(`${w.tut.streak} / 3`, W / 2, 104);
    }
  }
}

function drawPrompt(ctx: CanvasRenderingContext2D, w: World, title: string, body: string, cy: number) {
  const bw = Math.min(320, w.W - 40);
  const bh = 108;
  ctx.fillStyle = "rgba(12,18,36,0.82)";
  ctx.strokeStyle = "rgba(232,164,74,0.45)";
  ctx.lineWidth = 1.5;
  round(ctx, w.W / 2 - bw / 2, cy - bh / 2, bw, bh, 16);
  ctx.fill();
  ctx.stroke();
  ctx.textAlign = "center";
  ctx.fillStyle = "#fff";
  ctx.font = "800 16px Figtree, system-ui";
  ctx.fillText(title, w.W / 2, cy - 8);
  ctx.fillStyle = "rgba(243,239,228,0.72)";
  ctx.font = "600 12px Figtree, system-ui";
  ctx.fillText(body, w.W / 2, cy + 16);
  // THE CALL TO ACTION FADES IN, and it no longer waits on an arming
  // window - there is no window any more. It is a beat of breathing room so
  // the title lands before the instruction does.
  if (w.tut?.hold) {
    const inA = Math.max(0, Math.min(1, w.tut.t / 0.35));
    if (inA > 0) {
      ctx.globalAlpha = inA * (0.7 + 0.3 * Math.sin(w.time * 4));
      ctx.fillStyle = "#6ef0ff";
      ctx.font = "700 12px Figtree, system-ui";
      ctx.fillText("tap to continue", w.W / 2, cy + 36);
      ctx.globalAlpha = 1;
    }
  }
}

function round(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
