import { SPILL, SPILL_SHOP, createSpill, type SpillState, type SpillUpgrade } from "./spill";
import { SPILL_SPECIALTIES, SPILL_UTILITIES, type SpillSpecialty, type SpillUtility } from "./spill-content";

/** The workshop describes a build; only the Depot can purchase its tiers. */
export type SpillBuild = {
  plating: number; thrusters: number; pulse: number; shield: number;
  utilities?: SpillUtility[];
  specialties?: Partial<Record<SpillUpgrade, SpillSpecialty | null>>;
};

/** Font-independent equipment marks shared by the hull, HUD and workshop. */
export const SPILL_MODULE_MARKS: Record<SpillUtility, number[][][]> = {
  magnet: [[[5,4],[5,13],[7,18],[12,21],[17,18],[19,13],[19,4]],[[5,9],[8,9]],[[16,9],[19,9]]],
  scanner: [[[12,3],[18,5],[21,12],[18,19],[12,21],[6,19],[3,12],[6,5],[12,3]],[[12,12],[19,5]],[[8,13],[9,16],[12,17],[15,16]]],
  brake: [[[6,10],[12,4],[18,10]],[[12,4],[12,17]],[[4,17],[4,21],[20,21],[20,17]]],
  capacitor: [[[14,2],[5,14],[11,14],[9,22],[20,9],[13,9],[14,2]]],
};

export function spillBuildFromState(s: SpillState): SpillBuild {
  return { ...s.up, shield: s.canopyLevel, utilities: s.utilities.slice(), specialties: { ...s.specialties } };
}

export function spillPreviewState(build: SpillBuild) {
  const s = createSpill(390, 760, 0);
  for (const key of ["plating", "thrusters", "pulse"] as const) {
    s.up[key] = Math.max(0, Math.min(3, Math.floor(build[key])));
    const spec = build.specialties?.[key];
    if (spec && s.up[key] >= 2 && SPILL_SPECIALTIES[spec]?.axis === key) s.specialties[key] = spec;
  }
  s.hull = s.maxHull = SPILL.hull + s.up.plating;
  s.shield = s.canopyLevel = Math.max(0, Math.min(2, Math.floor(build.shield)));
  s.utilities = [...new Set(build.utilities ?? [])].filter(id => !!SPILL_UTILITIES[id]).slice(0, 2);
  s.ownedUtilities = s.utilities.slice();
  return s;
}

/** Total build cost, including every preceding tier; the earned starter is free. */
export function spillBuildOre(build: SpillBuild, starter: SpillUtility | null = null) {
  const s = spillPreviewState(build);
  let cost = s.shield * SPILL_SHOP.shield.prices[0];
  for (const key of ["plating", "thrusters", "pulse"] as const)
    cost += SPILL_SHOP[key].prices.slice(0, s.up[key]).reduce((n, p) => n + p, 0);
  return cost + s.utilities.reduce((n, id) => n + (id === starter ? 0 : SPILL_UTILITIES[id].price), 0);
}

const smooth = (t: number) => { const n = Math.max(0, Math.min(1, t)); return n * n * (3 - 2 * n); };

/** Cover the viewport throughout arrival. The camera moves INTO the bay;
 * no image edge, aspect-ratio change, or shrink into the workshop panel. */
export function spillDockView(W: number, H: number, imageW: number, imageH: number, elapsed: number, gagElapsed = -1) {
  const progress = smooth(elapsed / SPILL.dockTime);
  const closeup = smooth(gagElapsed / .65);
  const scale = Math.max(W / imageW, H / imageH) * (1.02 + progress * 0.4 + closeup);
  const width = imageW * scale, height = imageH * scale;
  const approachX = W * (0.86 - progress * 0.28) - width * 0.65;
  const closeupX = W * .4 - width * .686;
  const x = Math.max(W - width, Math.min(0, approachX + (closeupX - approachX) * closeup));
  const y = Math.max(H - height, Math.min(0, H * (0.62 - closeup * .08) - height * 0.62));
  return { x, y, width, height, progress, opacity: smooth(elapsed / 1.1) };
}

/** The marshal stands on the illustrated platform and travels with its camera. */
export function spillDockBear(view: ReturnType<typeof spillDockView>, elapsed: number, reducedMotion = false) {
  return { x: view.x + view.width * .686, y: view.y + view.height * .65, height: view.height * .075,
    frame: reducedMotion ? 0 : Math.max(0, Math.min(35, Math.floor(elapsed / SPILL.dockTime * 36))) };
}
