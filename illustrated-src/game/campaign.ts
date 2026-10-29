import { BETA_MISSION_ROWS } from "./beta-campaign-manifest";
import { MISSION_ROWS, BETA_VARIANTS } from "./campaign-manifest";
import { IS_BETA, PALS } from "./catalog";
import {
  RACE_MAX_ACORNS,
  RACE_RINGS,
  RACE_THREE_STAR_TICKS,
  RACE_TWO_STAR_TICKS,
} from "./race";

// Independent stars accumulate across successful replays. Finishing the
// preceding mission advances the continuous road; total stars buy rewards.
// STAGES remains a legacy authoring/reward compatibility table. The explicit
// versioned manifest is authoritative for mission identities, goals and seeds.

// Spill missions ship on the chart; tunnel missions remain a beta trial.
export type FlightBase = "fly" | "deep" | "lost" | "arcade" | "tunnel" | "spill" | "race";

export type LevelFx = {
  pal?: string;        // authored beta companion; does not change the equipped loadout
  upsideDown?: boolean;
  bounceScale?: number;
  sticky?: boolean;    // contact holds the flight until a tap releases it
  tapFreeze?: boolean; // each tap toggles the existing slow effect
  env?: number;        // pin the run to one environment (index into ENVS)
  pace?: number;       // multiplies the world clock (like Thrill Seeker)
  gapScale?: number;   // multiplies the gate mouth
  driftScale?: number; // multiplies how far gates sway
  driftRate?: number;  // multiplies how fast gates sway
  fog?: number;        // 0 none .. 1 blind: sight circle around the pilot
  acornEvery?: boolean;// guarantee an acorn on every gate
  /** THE FIRST MISSION CANNOT BE FAILED. Owner's call: level one is flown
   *  for real and earns its star, but a crash is a free reset rather than a
   *  loss - unlimited tries. A new pilot who has just finished the tutorial
   *  and immediately fails their first mission has been told the game is
   *  not for them, which is the one lesson it must never teach. */
  noFail?: boolean;
};

export type Goal =
  | { kind: "finish" }
  | { kind: "bounces"; n: number }
  | { kind: "depots"; n: number }
  | { kind: "repairs"; n: number }
  | { kind: "acorns"; n: number }
  | { kind: "gold"; n: number }
  | { kind: "noBounce" }
  | { kind: "noShield" }
  | { kind: "flawless" }            // no bounces AND no shields spent
  | { kind: "maxTaps"; n: number }
  // mission-base goals (beta): Wormhole Flow multiplier, Spill score
  | { kind: "flow"; n: number }
  | { kind: "score"; n: number }
  // Spill missions: Acorn Coins mined over the run, and a run flown without a hit
  | { kind: "ore"; n: number }
  | { kind: "noHit" }
  | { kind: "time"; ticks: number };

export type LevelDef = {
  id: string;          // "3-7"
  stage: number;       // 1-based
  n: number;           // 1-based within the stage
  ord: number;         // display coordinate only
  name: string;
  base: FlightBase;
  gates: number;       // the finish line
  fx: LevelFx;
  goals: [Goal, Goal, Goal];
  /** Experimental cards are Log-only and never enter LEVELS/progression. */
  standalone?: boolean;
  raceEventId?: string;
  zoneId?: string;
  variantId?: string;
  seed?: number | null;
  seedVersion?: string;
  contractId?: string;
  objectiveIds?: string[];
  sample?: boolean;
  implemented?: boolean;
  previousIds?: string[];
  spillFinish?: { kind: "ore" | "depot"; n: number };
  challenge?: string;
  durationTarget?: [number, number];
};

export type StageDef = {
  num: number;
  name: string;
  tagline: string;
  env: number;
  base: FlightBase;
  unlock: number;      // total stars needed to open it
  /** per-level knobs; i is 0..9 */
  tune: (i: number) => { gates: number; fx: LevelFx; base?: FlightBase };
  /** star-2 and star-3 scripts; i is 0..9 */
  goals: (i: number, gates: number) => [Goal, Goal];
  names: string[];
};

// ------------------------------------------------------------------ stages

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const STAGES: StageDef[] = [
  {
    num: 1,
    name: "FLIGHT SCHOOL",
    tagline: "Learn the sky before it learns you.",
    env: 0, // DEEP SPACE
    base: "fly",
    unlock: 0,
    tune: (i) => ({
      gates: 8 + i,                                       // 8 .. 17
      fx: { pace: lerp(0.92, 1.0, i / 9), gapScale: lerp(1.12, 1.0, i / 9), acornEvery: true },
    }),
    goals: (i, g) => [
      { kind: "acorns", n: Math.min(3 + i, Math.max(3, g - 4)) },
      i % 3 === 2 ? { kind: "noBounce" }
        : i % 3 === 1 ? { kind: "maxTaps", n: g * 3 }
        : { kind: "gold", n: 1 },
    ],
    names: [
      "First Solo", "Trim the Line", "Clean Approach", "Fuel Run", "Golden Hourglass",
      "Steady Hands", "Long Glide", "Feather Throttle", "No Scratches", "Graduation",
    ],
  },
  {
    num: 2,
    name: "NURSERY BLOOM",
    tagline: "The nebula is beautiful and it moves.",
    env: 1, // NEBULA NURSERY
    base: "fly",
    unlock: 12,
    tune: (i) => ({
      gates: 12 + i,                                      // 12 .. 21
      fx: { driftScale: lerp(1.2, 1.5, i / 9), acornEvery: true },
    }),
    goals: (i, g) => [
      { kind: "acorns", n: 4 + Math.floor(i / 2) },
      i % 3 === 0 ? { kind: "noBounce" }
        : i % 3 === 1 ? { kind: "gold", n: 1 + (i > 5 ? 1 : 0) }
        : { kind: "noShield" },
    ],
    names: [
      "Bloomfield", "Pollen Drift", "Cradle Rock", "Petal Gap", "Slow Waltz",
      "Rooted Deep", "Wide Sway", "Nursery Rhyme", "Full Bloom", "Seedfall",
    ],
  },
  {
    num: 3,
    name: "ICE MOON",
    tagline: "Everything narrow, everything bright.",
    env: 2, // ICE MOON
    base: "fly",
    unlock: 27,
    tune: (i) => ({
      gates: 14 + i,                                      // 14 .. 23
      fx: { gapScale: lerp(1.0, 0.94, i / 9), driftScale: 1.15, acornEvery: true },
    }),
    goals: (i, g) => [
      i % 2 === 0 ? { kind: "acorns", n: 6 + Math.floor(i / 2) } : { kind: "gold", n: 2 },
      i % 3 === 2 ? { kind: "flawless" }
        : i % 3 === 0 ? { kind: "noBounce" }
        : { kind: "maxTaps", n: Math.round(g * 2.6) },
    ],
    names: [
      "Thin Ice", "Frostbite", "Narrows", "Crevasse", "Glacier Line",
      "White Static", "Cold Snap", "Icicle Alley", "Pressure Ridge", "Moonfall",
    ],
  },
  {
    num: 4,
    name: "SOLAR FURNACE",
    tagline: "The sky burns and the clock runs hot.",
    env: 3, // SOLAR FURNACE
    base: "fly",
    unlock: 45,
    tune: (i) => ({
      gates: 15 + i,                                      // 15 .. 24
      fx: { pace: lerp(1.08, 1.22, i / 9), acornEvery: true },
    }),
    goals: (i, g) => [
      { kind: "acorns", n: 7 + Math.floor(i / 2) },
      i % 3 === 1 ? { kind: "noBounce" }
        : i % 3 === 2 ? { kind: "noShield" }
        : { kind: "gold", n: 2 },
    ],
    names: [
      "Kindling", "Slow Roast", "Heat Shimmer", "Flare Stack", "Coronal Run",
      "Afterburner", "Melting Point", "Solar Wind", "White Heat", "Out of the Fire",
    ],
  },
  {
    num: 5,
    name: "MIDNIGHT RUN",
    tagline: "The dark closes in. Fly by the little you see.",
    env: 9, // SAPPHIRE ABYSS
    base: "fly",
    unlock: 66,
    tune: (i) => ({
      gates: 15 + i,                                      // 15 .. 24
      fx: { fog: lerp(0.45, 0.75, i / 9), acornEvery: true },
    }),
    goals: (i, g) => [
      { kind: "acorns", n: 6 + Math.floor(i / 2) },
      i % 3 === 0 ? { kind: "noShield" }
        : i % 3 === 1 ? { kind: "noBounce" }
        : { kind: "maxTaps", n: Math.round(g * 2.4) },
    ],
    names: [
      "Dusk", "Lantern Out", "Narrowed Eyes", "Deep Water", "Night Current",
      "Closing Iris", "Blue Hour", "Half Blind", "Abyssal", "Midnight Proper",
    ],
  },
  {
    num: 6,
    name: "CRYSTAL BELT",
    tagline: "Deep space rules: the sky itself keeps shifting.",
    env: 4, // CRYSTAL BELT
    base: "deep",
    unlock: 90,
    tune: (i) => ({
      gates: 12 + i,                                      // 12 .. 21
      fx: { acornEvery: true },
    }),
    goals: (i, g) => [
      { kind: "acorns", n: 5 + Math.floor(i / 2) },
      i % 3 === 2 ? { kind: "flawless" }
        : i % 3 === 0 ? { kind: "noBounce" }
        : { kind: "gold", n: 2 },
    ],
    names: [
      "Facet One", "Refraction", "Prism Break", "Lattice", "Inclusion",
      "Cleave Line", "Scatter", "Fracture Zone", "Core Sample", "The Jewel",
    ],
  },
  {
    num: 7,
    name: "CRIMSON STORM",
    tagline: "Turbulence. The gates will not sit still.",
    env: 8, // CRIMSON STORM
    base: "fly",
    unlock: 117,
    tune: (i) => ({
      gates: 16 + i,                                      // 16 .. 25
      fx: {
        driftScale: lerp(1.5, 2.0, i / 9),
        driftRate: lerp(1.4, 1.9, i / 9),
        pace: 1.05,
        acornEvery: true,
      },
    }),
    goals: (i, g) => [
      { kind: "acorns", n: 8 + Math.floor(i / 2) },
      i % 3 === 1 ? { kind: "flawless" }
        : i % 3 === 2 ? { kind: "noBounce" }
        : { kind: "noShield" },
    ],
    names: [
      "Front Coming In", "Squall", "Red Ceiling", "Gale Gates", "Eye Wall",
      "Downdraft", "Shear", "Thunderhead", "Landfall", "Stormbreaker",
    ],
  },
  {
    num: 8,
    name: "LOST REACHES",
    tagline: "Lost-in-space rules: tilt, drift, mirror.",
    env: 10, // VIOLET REALM
    base: "lost",
    unlock: 147,
    tune: (i) => ({
      gates: 12 + i,                                      // 12 .. 21
      fx: { acornEvery: true },
    }),
    goals: (i, g) => [
      { kind: "acorns", n: 5 + Math.floor(i / 2) },
      i % 3 === 0 ? { kind: "noBounce" }
        : i % 3 === 1 ? { kind: "gold", n: 2 }
        : { kind: "noShield" },
    ],
    names: [
      "Which Way Up", "Slantwise", "Mirror Left", "Vertigo", "Compass Spin",
      "Wrong Horizon", "Tumbled", "Sideways Rain", "The Long Way", "Found",
    ],
  },
  {
    num: 9,
    name: "THE BLACKOUT",
    tagline: "Steady shadows reveal a moving path.",
    env: 6, // MONOCHROME VOID
    base: "fly",
    unlock: 180,
    tune: (i) => ({
      gates: 8 + i,                                       // 8 .. 17
      fx: {
        gapScale: lerp(1.12, 1.02, i / 9),   // mercy, tapering
        pace: 0.95,
        driftScale: i >= 5 ? 1.2 : 1,        // late levels sway in the dark
        acornEvery: true,
      },
    }),
    goals: (i, g) => [
      { kind: "acorns", n: 3 + Math.floor(i / 2) },
      i % 3 === 2 ? { kind: "flawless" }
        : i % 3 === 0 ? { kind: "noBounce" }
        : { kind: "maxTaps", n: Math.round(g * 3.2) },   // taps ARE sight here
    ],
    names: [
      "Lights Out", "Afterimage", "Count the Beats", "Quiet Current", "Dead Reckoning",
      "Echo Location", "Blink", "Photograph", "Total Recall", "Eyes Shut",
    ],
  },
  {
    num: 10,
    name: "EVENT HORIZON",
    tagline: "Everything the sky has learned, at once.",
    env: 13, // HYPERVIVID
    base: "fly",
    unlock: 216,
    tune: (i) => {
      // the final ten rotate the whole game's machinery
      if (i < 3) return { gates: 18 + i * 2, base: "arcade" as FlightBase, fx: { acornEvery: true } };
      if (i < 6) return { gates: 20 + i, base: "deep" as FlightBase, fx: { fog: 0.5, acornEvery: true } };
      if (i < 9) return {
        gates: 22 + i,
        base: "lost" as FlightBase,
        fx: { driftScale: 1.5, acornEvery: true },
      };
      // level 100: the horizon
      return {
        gates: 30,
        base: "fly" as FlightBase,
        fx: { fog: 0.4, driftScale: 1.5, pace: 1.1, acornEvery: true },
      };
    },
    goals: (i, g) => [
      { kind: "acorns", n: 8 + i },
      i % 3 === 0 ? { kind: "flawless" }
        : i % 3 === 1 ? { kind: "noShield" }
        : { kind: "noBounce" },
    ],
    names: [
      "Old Timeline", "8-Bit Heart", "Museum Piece", "Shifting Ground", "Half Light",
      "Triple Shift", "Tilted Crown", "Mirrorfall", "Last Reach", "THE HORIZON",
    ],
  },
];

// ------------------------------------------------------------------ levels

/** Immutable authored definitions. Beta variants share a route position, but
 * have their own progress identity. Production never loads preview progress. */
// the road's contracts: the beta's authored 260 on both pages now that the
// road is live, the original production rows only if it is ever pulled back
export const LEGACY_LEVELS: LevelDef[] = MISSION_ROWS.slice(0, 100).map(row => {
  const variant = BETA_VARIANTS.find(v => v.id === row.id);
  return { ...row, ...variant, fx: { ...(variant?.fx ?? row.fx) },
    goals: (variant?.goals ?? row.goals).map(g => ({ ...g })) as [Goal, Goal, Goal] };
});
export const ALL_LEVELS: LevelDef[] = BETA_MISSION_ROWS.map(row =>
  ({ ...row, fx: { ...row.fx }, goals: row.goals.map(g => ({ ...g })) as [Goal, Goal, Goal] }));
export const LEVELS = ALL_LEVELS;
// THE PRODUCTION ROAD IS 100 MISSIONS (owner, 15 Sep 2026: "convert star
// chart to 100 levels. move the remaining 160 to Beta ... gating all the fun
// features behind purchase or heavy gameplay was the wrong move to attract
// new players"). Chapters 1 to 10 of the authored road, 300 stars; the beta
// keeps all 260. Progress past mission 100 stays in the save (LEVELS still
// walks the whole road for the ledger) and simply is not shown or counted
// on production.
export const CHART_LEVELS = IS_BETA ? LEVELS : LEVELS.slice(0, 100);
export const CHART_MAX_STARS = CHART_LEVELS.length * 3;
export const levelById = (id: string) => CHART_LEVELS.find(l => l.id === id) ?? null;
export const nextLevel = (id: string, order: readonly LevelDef[] = CHART_LEVELS) => {
  const i = order.findIndex(l => l.id === id);
  return i >= 0 ? order[i + 1] ?? null : null;
};
export const levelAt = (ord: number, order: readonly LevelDef[] = CHART_LEVELS) =>
  order[ord - 1] ?? null;
export const missionProgressId = (def: LevelDef) => def.variantId ?? def.id;

/** Beta proof-of-concept. It deliberately does not live in LEVELS, so it
 * cannot change chapter counts, unlock order, star totals, or rewards. */
export const HYPER_RUN_MAX_ACORNS = RACE_MAX_ACORNS;

// Hyper Run's mission definition. The names here still say "prototype"
// and that is deliberate: `id` is the KEY inside save.raceRecords,
// so renaming it would orphan every best time already recorded. The mode
// shipped; the storage key it was born with has to outlive its old name.
export const HYPER_RUN_MISSION: LevelDef = {
  id: "hyper-run",
  stage: 0,
  n: 1,
  ord: 0,
  name: "HYPER RUN",
  base: "race",
  gates: RACE_RINGS.length,
  fx: { env: 0 },
  goals: [
    { kind: "finish" },
    { kind: "time", ticks: RACE_TWO_STAR_TICKS },
    { kind: "time", ticks: RACE_THREE_STAR_TICKS },
  ],
  standalone: true,
  raceEventId: "hyper-run",
};

export const hyperRunById = (id: string) =>
  id === HYPER_RUN_MISSION.id ? HYPER_RUN_MISSION : null;

// ------------------------------------------------------------------ prose

export function goalText(g: Goal, def: LevelDef): string {
  switch (g.kind) {
    case "bounces": return `Bounce off planets ${g.n} times`;
    case "depots": return `Visit ${g.n} Depot${g.n === 1 ? "" : "s"}`;
    case "repairs": return `Buy ${g.n} hull repair at a Depot`;
    case "finish": return def.spillFinish ? def.spillFinish.kind === "ore" ? `Collect ${def.spillFinish.n} Acorn Coins` : `Reach Depot ${def.spillFinish.n}` : def.base === "tunnel" ? `Survive ${def.gates} seconds in the wormhole`
      : def.base === "spill" ? `Clear ${def.gates} waves of the Debris Field`
      : def.base === "race" ? "Finish the course"
      : `Reach the portal — ${def.gates} gates`;
    case "acorns": return `Collect ${g.n} acorn${g.n === 1 ? "" : "s"}`;
    case "gold": return g.n === 1 ? "Catch a golden acorn" : `Catch ${g.n} golden acorns`;
    case "noBounce": return "Touch no planet";
    case "noShield": return "Spend no shield";
    case "flawless": return "Flawless — no bounces, no shields spent";
    case "maxTaps": return `At most ${g.n} taps`;
    case "flow": return `Reach Flow \u00d7${g.n}`;
    case "score": return `Score ${g.n} points`;
    case "ore": return `Collect ${g.n} Acorn Coins`;
    case "noHit": return "Take no hull damage";
    case "time": {
      const seconds = Math.floor(g.ticks / 60);
      return `Finish in ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")} or faster`;
    }
  }
}

export function fxText(fx: LevelFx): string[] {
  const out: string[] = [];
  // THE SHEET NAMES THE PAL THE HANGAR NAMES. This tag printed the raw id
  // and called Stopwatch cosmetic; the audit found both wrong. A mission
  // flies its designated pal with its effects LIVE, and Stopwatch is no
  // exception - its tap toggle reads runPals, so in a mission every tap
  // still toggles the slow and a pilot who trusted "cosmetic" lost the run
  // to it. The ids fared no better: nothing else in the game calls
  // Astrolobee "bee" or Acorn "buddy", so the catalog name is what shows.
  if (fx.pal) {
    const pal = PALS.find((p) => p.id === fx.pal);
    out.push(`PAL: ${(pal ? pal.name : fx.pal).toUpperCase()}`);
  }
  if (fx.upsideDown) out.push("UPSIDE DOWN");
  if (fx.bounceScale) out.push("SPRINGY PLANETS");
  if (fx.sticky) out.push("STICKY PLANETS · TAP TO RELEASE");
  if (fx.tapFreeze) out.push("TAP TO TOGGLE SLOW");
  if (fx.fog) out.push(fx.fog >= 0.7 ? "HEAVY FOG" : "FOG");
  if (fx.pace && fx.pace > 1.02) out.push(fx.pace >= 1.15 ? "FAST FORWARD" : "BRISK");
  if (fx.pace && fx.pace < 0.98) out.push("GENTLE PACE");
  if (fx.gapScale && fx.gapScale < 0.98) out.push("NARROW GATES");
  // Nightglider holds the gates still, whatever the sway dial says
  const sways = fx.pal !== "nightglider";
  if (sways && fx.driftScale && fx.driftScale >= 1.4) out.push("HEAVY SWAY");
  else if (sways && fx.driftScale && fx.driftScale > 1.05) out.push("SWAYING GATES");
  return out;
}

// ------------------------------------------------------- stats and scoring

/** everything a run has to count for the three goals to be judged */
export type RunStats = {
  acorns: number;
  gold: number;
  bounces: number;
  shieldsSpent: number;
  taps: number;
  /** Wormhole missions: best Flow multiplier reached */
  flow: number;
  /** Spill missions: the run's score */
  score: number;
  /** Spill missions: Acorn Coins mined over the run, spent or not, and hull hits taken */
  ore: number;
  hits: number;
  depots: number;
  repairs: number;
  /** Hyper Run: authoritative 60 Hz finish time, zero until settled. */
  finishTicks: number;
};

export const emptyStats = (): RunStats => ({ acorns: 0, gold: 0, bounces: 0, shieldsSpent: 0, taps: 0, flow: 1, score: 0, ore: 0, hits: 0, depots: 0, repairs: 0, finishTicks: 0 });

/** how many golden acorns this level's goals ask for (0 = none) */
export function goldNeeded(def: LevelDef) {
  let n = 0;
  for (const g of def.goals) if (g.kind === "gold") n = Math.max(n, g.n);
  return n;
}

/** the gate ordinals where the level GUARANTEES a golden acorn: the goal's
 *  count plus one spare, spread evenly, so "catch a golden acorn" can never
 *  be lost to the spawn dice — the exact promise fx.acornEvery already
 *  makes for plain acorns */
export function goldGatesFor(def: LevelDef): number[] {
  const need = goldNeeded(def);
  if (!need) return [];
  const out: number[] = [];
  for (let i = 1; i <= need + 1; i++) {
    const ord = Math.max(1, Math.min(def.gates, Math.round((i * def.gates) / (need + 2))));
    if (!out.includes(ord)) out.push(ord);
  }
  return out;
}

// ------------------------------------------------- the pinned objectives
//
// While a mission is FLOWN its three goals ride the top of the screen, so
// the pilot always knows what is still winnable. Each pill is judged LIVE:
//
//   green - complete (a target reached) or still holding (a constraint
//           unbroken: no bounce yet, taps still under the cap)
//   red   - failed, permanently: the touch on "touch no planet", the
//           28th tap against a cap of 27
//   white - an accumulating target not yet reached
//
// A constraint shows GREEN while it holds rather than white: "currently
// passing" is the honest reading of an unbroken constraint, and the flip
// to red is the event worth noticing.

export type GoalHudState = "live" | "done" | "lost";
export type GoalHudPill = { text: string; state: GoalHudState };

export function goalHud(g: Goal, s: RunStats, gatesDone: number, def: LevelDef): GoalHudPill {
  switch (g.kind) {
    case "bounces": return { text: `BOUNCES ${Math.min(s.bounces,g.n)}/${g.n}`, state: s.bounces >= g.n ? "done" : "live" };
    case "depots": return { text: `DEPOTS ${Math.min(s.depots,g.n)}/${g.n}`, state: s.depots >= g.n ? "done" : "live" };
    case "repairs": return { text: `REPAIRS ${Math.min(s.repairs,g.n)}/${g.n}`, state: s.repairs >= g.n ? "done" : "live" };
    case "finish": {
      if (def.spillFinish) {
        const {kind,n}=def.spillFinish, value=kind === "ore" ? s.ore : s.depots;
        return {text: `${kind === "ore" ? "COINS" : "DEPOT"} ${Math.min(value,n)}/${n}`, state: value >= n ? "done" : "live"};
      }
      const n = Math.min(gatesDone, def.gates);
      if (def.base === "spill") return { text: `WAVE ${n}/${def.gates}`, state: n >= def.gates ? "done" : "live" };
      return { text: `PORTAL ${n}/${def.gates}`, state: n >= def.gates ? "done" : "live" };
    }
    case "acorns":
      return { text: `ACORNS ${Math.min(s.acorns, g.n)}/${g.n}`, state: s.acorns >= g.n ? "done" : "live" };
    case "gold":
      return { text: `GOLD ${Math.min(s.gold, g.n)}/${g.n}`, state: s.gold >= g.n ? "done" : "live" };
    case "noBounce":
      return { text: "NO TOUCHES", state: s.bounces > 0 ? "lost" : "done" };
    case "noShield":
      return { text: "NO SHIELDS", state: s.shieldsSpent > 0 ? "lost" : "done" };
    case "flawless":
      return { text: "FLAWLESS", state: s.bounces > 0 || s.shieldsSpent > 0 ? "lost" : "done" };
    case "maxTaps":
      return { text: `TAPS ${s.taps}/${g.n}`, state: s.taps > g.n ? "lost" : "done" };
    case "flow":
      return { text: `FLOW ×${s.flow}/${g.n}`, state: s.flow >= g.n ? "done" : "live" };
    case "score":
      return { text: `SCORE ${Math.min(s.score, g.n)}/${g.n}`, state: s.score >= g.n ? "done" : "live" };
    case "ore":
      return { text: `COINS ${Math.min(s.ore, g.n)}/${g.n}`, state: s.ore >= g.n ? "done" : "live" };
    case "noHit":
      return { text: "NO HITS", state: s.hits > 0 ? "lost" : "done" };
    case "time": {
      const sec = Math.ceil(g.ticks / 60);
      return { text: `UNDER ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`,
        state: s.finishTicks === 0 ? "live" : s.finishTicks <= g.ticks ? "done" : "lost" };
    }
  }
}

/** did this finished run meet the goal? (star 1 is the finish itself) */
export function goalMet(g: Goal, s: RunStats): boolean {
  switch (g.kind) {
    case "finish": return true;
    case "bounces": return s.bounces >= g.n;
    case "depots": return s.depots >= g.n;
    case "repairs": return s.repairs >= g.n;
    case "acorns": return s.acorns >= g.n;
    case "gold": return s.gold >= g.n;
    case "noBounce": return s.bounces === 0;
    case "noShield": return s.shieldsSpent === 0;
    case "flawless": return s.bounces === 0 && s.shieldsSpent === 0;
    case "maxTaps": return s.taps <= g.n;
    case "flow": return s.flow >= g.n;
    case "score": return s.score >= g.n;
    case "ore": return s.ore >= g.n;
    case "noHit": return s.hits === 0;
    case "time": return s.finishTicks > 0 && s.finishTicks <= g.ticks;
  }
}

// --------------------------------------------------------------- progress

/** stars for one level live in a 3-bit mask so each goal keeps its own */
export function countBits(mask: number) {
  return (mask & 1) + ((mask >> 1) & 1) + ((mask >> 2) & 1);
}

/** a level opens when its stage is open and the level before it is finished */
// DEBRIS FIELDS. Every 33 levels the road is blocked outright and the only
// way past is a Hyper Run inside a time. They award no stars on purpose: a
// gate is passed or not yet passed, never scored, so it can never sit
// half-finished the way a three-star level can. The times tighten as the
// chart does - the first is close to autopilot (the no-input replay
// profile finishes in exactly 9000 ticks), the last wants a real run.
export const RACE_GATES: { after: number; ticks: number; label: string }[] = [
  { after: 33, ticks: 9_000, label: "2:30" },
  { after: 66, ticks: 7_200, label: "2:00" },
  { after: 99, ticks: 6_120, label: "1:42" },
];

/** the gate standing between the pilot and this level, or null if the road
 *  is clear. Checks every gate below the level, not just the nearest, so a
 *  skipped one can never be walked around. */
export function gateBefore(ord: number, cleared: number[] | undefined) {
  const done = cleared || [];
  for (const g of RACE_GATES) {
    if (ord > g.after && !done.includes(g.after)) return g;
  }
  return null;
}

/** the gate a Hyper Run would be attempting right now: the first uncleared
 *  one. A run clears the gate in FRONT of the pilot and no more, so beating
 *  1:42 early does not silently bank all three. */
export function nextGate(cleared: number[] | undefined) {
  const done = cleared || [];
  return RACE_GATES.find((g) => !done.includes(g.after)) ?? null;
}

/** THE CLEAR RULE, kept pure so it can be tested without flying a race.
 *  A finish opens the gate in front of the pilot when it was an actual
 *  finish and the clock beat the limit. Returns the gate that opened, or
 *  null when nothing did. */
export function gateClearedBy(
  cleared: number[] | undefined,
  finished: boolean,
  finishTicks: number,
) {
  const g = nextGate(cleared);
  if (!g || !finished) return null;
  // a zero or negative clock is a quit or a broken read, never a pass
  if (!(finishTicks > 0)) return null;
  return finishTicks <= g.ticks ? g : null;
}

export function levelUnlocked(
  def: LevelDef, stars: Record<string, number>, _total: number,
  gatesCleared?: number[], order: readonly LevelDef[] = CHART_LEVELS,
  beta = IS_BETA,
) {
  const index = order.findIndex(l => l.id === def.id);
  if (index < 0 || def.implemented === false) return false;
  if (beta) return true;
  if (gateBefore(index + 1, gatesCleared)) return false;
  return index === 0 || ((stars[order[index - 1].id] || 0) & 1) === 1;
}

/** Arrival is part of a barrier attempt, independently of access to the mode. */
export function reachedGate(stars: Record<string, number>, cleared?: number[]) {
  const gate = nextGate(cleared);
  return gate && ((stars[levelAt(gate.after)?.id ?? ""] || 0) & 1) ? gate : null;
}

// --------------------------------------------------------------- rewards

export type StarReward = {
  stars: number;
  kind: "pal" | "mod" | "mode" | "suit" | "helmet" | "trail" | "title" | "stage" | "dust" | "acorns";
  id?: string;
  name: string;
  desc: string;
  /** "dust" rewards only: how much Star Dust crossing this line pays out */
  amount?: number;
};

// The reward ladder. Chapter cards and the two star titles are gone from it
// (owner, 8 Sep 2026: "remove the progression reward, no need for it to
// count in some hidden way... remove titles, we went away from the XP
// system in favor of the star chart"). Chapters open by finishing the
// mission before them, not by stars, so a card for them said nothing.
export const STAR_REWARDS: StarReward[] = [
  // GENERATED by illustrated-src/reward-ladder.mjs - edit the generator, not this list
  { stars: 5, kind: "mod", id: "startShield", name: "Start Shield", desc: "Arm any run with a shield from the hangar." },
  { stars: 5, kind: "trail", id: "ion", name: "Ion Stream", desc: "A trail of charged sky." },
  { stars: 10, kind: "mode", id: "deep", name: "Deep Space Flight", desc: "Endless mode: space shifts every 10s." },
  { stars: 10, kind: "helmet", id: "chronarch", name: "Chronarch Helmet", desc: "Time under glass. Was premium; now earned." },
  { stars: 15, kind: "suit", id: "alien", name: "Alien Suit", desc: "The visitor look, antennae included." },
  { stars: 20, kind: "dust", name: "15 Star Dust", desc: "Premium dust for the shop.", amount: 15 },
  { stars: 25, kind: "mod", id: "battery", name: "Shield Battery", desc: "Carry three shield charges at once." },
  { stars: 30, kind: "trail", id: "bubble", name: "Bubble Jets", desc: "A wake of glass beads." },
  { stars: 35, kind: "suit", id: "bigbooty", name: "Big Booty Suit", desc: "Maximum silhouette. Real jiggle." },
  { stars: 40, kind: "acorns", name: "170 Acorns", desc: "Spending acorns for the hangar.", amount: 170 },
  { stars: 45, kind: "mode", id: "lost", name: "Lost in Space", desc: "Endless mode: the sky rotates, drifts and mirrors." },
  { stars: 50, kind: "acorns", name: "170 Acorns", desc: "Spending acorns for the hangar.", amount: 170 },
  { stars: 55, kind: "trail", id: "bloom", name: "Nebula Bloom", desc: "Petals of nebula light." },
  // the Samurai and Cosmic helmets left the chart (owner, 27 Oct 2026: "both can be removed, cosmos is
  // broken anyways"); their rungs pay like their neighbours
  { stars: 60, kind: "acorns", name: "200 Acorns", desc: "Spending acorns for the hangar.", amount: 200 },
  { stars: 65, kind: "suit", id: "sammie", name: "Stone Suit", desc: "Earned on the Star Chart." },
  { stars: 70, kind: "mod", id: "flightmods", name: "Flight Mods", desc: "Steady Gates and Thrill Seeker unlock in the hangar." },
  { stars: 75, kind: "acorns", name: "240 Acorns", desc: "Spending acorns for the hangar.", amount: 240 },
  { stars: 80, kind: "trail", id: "comet", name: "Comet Booster", desc: "Burn like the real thing." },
  { stars: 85, kind: "dust", name: "26 Star Dust", desc: "Premium dust for the shop.", amount: 26 },
  { stars: 90, kind: "acorns", name: "310 Acorns", desc: "Spending acorns for the hangar.", amount: 310 },
  { stars: 95, kind: "dust", name: "26 Star Dust", desc: "Premium dust for the shop.", amount: 26 },
  { stars: 100, kind: "acorns", name: "310 Acorns", desc: "Spending acorns for the hangar.", amount: 310 },
  { stars: 105, kind: "trail", id: "prism", name: "Prism Shards", desc: "Light, broken beautifully." },
  { stars: 110, kind: "suit", id: "catsuit", name: "Cat Suit", desc: "Eats no acorns." },
  { stars: 115, kind: "acorns", name: "380 Acorns", desc: "Spending acorns for the hangar.", amount: 380 },
  { stars: 120, kind: "dust", name: "29 Star Dust", desc: "Premium dust for the shop.", amount: 29 },
  { stars: 125, kind: "dust", name: "29 Star Dust", desc: "Premium dust for the shop.", amount: 29 },
  { stars: 130, kind: "trail", id: "plasma", name: "Plasma Arc", desc: "A live violet current." },
  { stars: 135, kind: "helmet", id: "cinderforge", name: "Cinderforge Helmet", desc: "Ember glass. Arrives with the suit." },
  { stars: 140, kind: "suit", id: "cinderforge", name: "Cinderforge", desc: "Forge-black plate, ember trim." },
  { stars: 145, kind: "dust", name: "33 Star Dust", desc: "Premium dust for the shop.", amount: 33 },
  { stars: 150, kind: "acorns", name: "450 Acorns", desc: "Spending acorns for the hangar.", amount: 450 },
  { stars: 155, kind: "trail", id: "galaxy", name: "Galaxy Dust", desc: "A spiral arm behind you." },
  { stars: 160, kind: "helmet", id: "groveguard", name: "Groveguard Helm", desc: "Sealed. Worn only by Groveguard." },
  { stars: 165, kind: "trail", id: "aurora", name: "Aurora Ribbon", desc: "The polar sky, towed." },
  { stars: 170, kind: "suit", id: "groveguard", name: "Groveguard", desc: "Forest green and brass, its own sealed helm." },
  { stars: 175, kind: "acorns", name: "520 Acorns", desc: "Spending acorns for the hangar.", amount: 520 },
  { stars: 180, kind: "trail", id: "frost", name: "Frostbite", desc: "A wake of hoarfrost." },
  { stars: 185, kind: "dust", name: "38 Star Dust", desc: "Premium dust for the shop.", amount: 38 },
  { stars: 190, kind: "suit", id: "cosmic", name: "Cupcake", desc: "Frosted pink, sprinkles and all." },
  { stars: 195, kind: "dust", name: "40 Star Dust", desc: "Premium dust for the shop.", amount: 40 },
  { stars: 200, kind: "acorns", name: "590 Acorns", desc: "Spending acorns for the hangar.", amount: 590 },
  { stars: 205, kind: "trail", id: "voidsmoke", name: "Void Smoke", desc: "What the dark exhales." },
  { stars: 210, kind: "dust", name: "43 Star Dust", desc: "Premium dust for the shop.", amount: 43 },
  { stars: 215, kind: "acorns", name: "660 Acorns", desc: "Spending acorns for the hangar.", amount: 660 },
  { stars: 220, kind: "dust", name: "43 Star Dust", desc: "Premium dust for the shop.", amount: 43 },
  { stars: 225, kind: "acorns", name: "660 Acorns", desc: "Spending acorns for the hangar.", amount: 660 },
  { stars: 230, kind: "trail", id: "supernova", name: "Supernova", desc: "The loudest exit there is." },
  { stars: 235, kind: "helmet", id: "sunforged", name: "Sunforged Helm", desc: "Sealed. Worn only by Sunforged." },
  { stars: 240, kind: "suit", id: "sunforged", name: "Sunforged", desc: "Bronze and solar gold, its own sealed helm." },
  { stars: 245, kind: "dust", name: "47 Star Dust", desc: "Premium dust for the shop.", amount: 47 },
  { stars: 250, kind: "acorns", name: "730 Acorns", desc: "Spending acorns for the hangar.", amount: 730 },
  { stars: 255, kind: "trail", id: "phoenixplume", name: "Phoenix Plumage Trail", desc: "Earned here or available early in the Regalia Pack." },
  { stars: 260, kind: "helmet", id: "abyssal", name: "Abyssal Helmet", desc: "Abyss glass. Arrives with the suit." },
  { stars: 265, kind: "suit", id: "abyssal", name: "Abyssal", desc: "Deep-sea blue, bioluminescent trim." },
  { stars: 270, kind: "dust", name: "50 Star Dust", desc: "Premium dust for the shop.", amount: 50 },
  { stars: 275, kind: "acorns", name: "800 Acorns", desc: "Spending acorns for the hangar.", amount: 800 },
  { stars: 280, kind: "mod", id: "dualpal", name: "Second Companion", desc: "Fly two pals at once, one high and one low. Their effects stack." },
  { stars: 280, kind: "trail", id: "opalfeather", name: "Opal Feather Trail", desc: "Earned here or available early in the Regalia Pack." },
  { stars: 285, kind: "helmet", id: "gemmie", name: "Opal Helmet", desc: "Earned on the Star Chart." },
  { stars: 290, kind: "suit", id: "gemmie", name: "Gemmie Suit", desc: "Earned on the Star Chart." },
  { stars: 295, kind: "dust", name: "54 Star Dust", desc: "Premium dust for the shop.", amount: 54 },
  { stars: 300, kind: "acorns", name: "870 Acorns", desc: "Spending acorns for the hangar.", amount: 870 },
];

/** the pilot's TITLE comes from stars now, not XP — same ladder the
 *  rewards climb. Thresholds sit on chapter openings and the two title
 *  rewards, so a title always names something the pilot actually did. */
export function starTitle(total: number) {
  if (total >= 300) return "STARLORD";
  if (total >= 250) return "GATECRASHER";
  if (total >= 216) return "ACORNAUT";
  if (total >= 147) return "EVENT HORIZON";
  if (total >= 90) return "ACE";
  if (total >= 45) return "VOIDFARER";
  if (total >= 12) return "PILOT";
  return "CADET";
}

/** The first rung wins when an item is deliberately celebrated twice. */
function rewardGates(kind: StarReward["kind"]) {
  const out: Record<string, number> = {};
  for (const reward of STAR_REWARDS) if (reward.kind === kind && reward.id) {
    out[reward.id] = Math.min(out[reward.id] ?? Infinity, reward.stars);
  }
  return out;
}

/** star thresholds the save-side gates read; kept beside the reward list */
/** WHAT A RUNG PAYS WHEN ITS ITEM IS ALREADY YOURS (owner, 8 Sep 2026:
 *  "change pay out to acorns, 250, flat regardless of star unlock or store
 *  purchase... acorns are less useful long term"). Flat, whatever the rung
 *  and whichever way the item arrived. A suit and its helmet on two rungs
 *  are two items and pay twice, by the same decision. One number, here,
 *  to retune. Saves written under the earlier rule may still carry a
 *  "dust" entry in rewardSubs; the sheet shows what was paid. */
export const SUB_ACORNS = 250;
export function substituteFor(_stars: number): { kind: "dust" | "acorns"; amount: number } {
  return { kind: "acorns", amount: SUB_ACORNS };
}


export const STAR_UNLOCKS = {
  pals: rewardGates("pal"),
  suits: rewardGates("suit"),
  // the ladder wins where both name a helmet, so a real rung always outranks
  // a bare shelf gate
  // priced helmets have no star gate any more (owner, 15 Sep 2026): a
  // helmet with a price is bought with acorns whenever the pilot likes
  helmets: rewardGates("helmet"),
  trails: rewardGates("trail"),
  startShield: 5,
  battery: 25,
  // modes open with a CHAPTER, not a loose star count: Deep Space with
  // Chapter 2, Lost in Space with Chapter 4
  deep: 10,
  lost: 45,
  flightMods: 70,
  /** the second companion slot (owner, 7 Sep 2026) */
  dualPal: 280,
};
