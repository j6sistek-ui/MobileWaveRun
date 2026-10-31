import { VANGUARD_DEPOT_SECONDS } from "./spill-depot-gag";
// DEBRIS FIELD (mode id "spill") — wave survival authority.
//
// A mining rig let go one system over. What reached us is a front of
// rock, cargo and shrapnel travelling one way: at you. No gates, no planets.
// Survive the wave; the next one is harder.
//
// This module is the RULES of the mode and nothing else — no canvas, no DOM,
// no art, no save. It is fed a dt and a handful of semantic inputs (launch,
// steering, dodge, fire, a Depot purchase) and it answers with state and a list
// of cues for the frame. The sim mirrors its ship into the world so
// the shared draw path can paint it; draw.ts paints the field; standalone.ts
// builds the Depot sheet. That split is the same one Hyper Run made
// (race.ts), and for the same reason: everything in here can be driven from
// a node test with no browser at all.
//
// Wave rules phase in over three seconds. The counted-down GO introduces
// each wave; steering or dodging can take control early in the empty field.
// The Depot holds its shelves inert briefly to prevent accidental purchases.
// Its four meters are PLATING, SHIELD, THRUSTERS and POWER-UPS. An unlocked
// PULSE fires at the next impact; charged coins replenish it.
//
// DIRECT STEERING (owner, 2026-10-29). The stick commands climb/descent;
// releasing it brakes to an altitude hold. Horizontal swipes dodge in
// either direction. The earlier tap/gravity hand is retired for this mode.

import { ENVS, LEGACY_DEBRIS_COUNT, PHYS } from "./catalog";
import { spillPrimeEcho } from "./spill-builds";
import { createSpillLoadout, restoreSpillLoadout, spillChassisStats, type SpillLoadout } from "./spill-career";
import { beginSpillExpedition, createSpillExpedition, restoreSpillExpedition, settleSpillExpedition,
  type SpillExpedition } from "./spill-expeditions";
import { admitSpillClimax, createSpillClimax, resizeSpillClimax, restoreSpillClimax, spillClimaxReserved,
  spillClimaxWave, type SpillClimax } from "./spill-climax";
import { admitSpillHazards, beginSpillHazardWave, clearSpillHazards, createSpillHazards,
  resizeSpillHazards, restoreSpillHazards, spillGravityBend, spillGravityBendDelta, spillGravityDrift,
  spillHazardPathClear, spillHazardPlan, spillHazardPressure, stepSpillHazards, SPILL_HAZARDS,
  type SpillHazardState, type SpillHazardContact } from "./spill-hazards";
import { SPILL_EVENTS, SPILL_SPECIALTIES, SPILL_UTILITIES, SPILL_UTILITY_IDS, spillContractOffers, spillEventFor,
  type SpillContract, type SpillContractKind, type SpillEvent, type SpillSpecialty, type SpillUtility } from "./spill-content";
import { admitSpillEnemies, beginSpillCombatWave, captureSpillCombatMotion, clearSpillCombat, createSpillCombat,
  resizeSpillCombat, restoreSpillCombat, spillCombatPressure, spillCombatPulse, spillCombatRockClear, stepSpillCombat,
  type SpillCombat } from "./spill-combat";

// ---------------------------------------------------------------- tuning

export const SPILL = {
  /** the ship may roam this share of the width. The right edge stops at
   *  half: further forward and you can park in front of the field where
   *  pieces have not spread apart yet, which was safer, not more dangerous */
  bandLeft: 0.08,
  bandRight: 0.5,
  /** where the ship sits when left alone, and how fast a lunge decays back
   *  to it. Slow enough to read as a drift rather than a spring */
  homeX: 0.22,
  driftHome: 0.55,
  /** the dash: about a third of the band end to end, slide included */
  lungeSpeed: 320,
  lungeTime: 0.15,
  lungeCooldown: 0.55,
  /** Symmetric vertical control. Release brakes without a gravity term. */
  steerSpeed: 300,
  steerAcceleration: 1800,
  steerBrake: 2400,
  edgeEase: 58,
  /** Retained for the legacy boundary painter; floorT now stays zero. */
  floorGrace: 0.25,
  floorWarn: 0.1,
  shipR: PHYS.squirrelR,
  grazeR: 46,
  pulseR: 240,
  pulseWideR: 320,
  /** POWER-UPS II arms an impact-triggered echo five seconds after a pulse. */
  doublePulseDelay: 5,
  /** the hull: three hits, then the run is over. A hit buys 1.2s of
   *  invulnerability so one piece can never take two pips */
  hull: 3,
  iframes: 1.2,
  shieldRecovery: 0.65,
  knockTime: 0.14,
  knockSpeed: -220,
  /** seconds of Gold the Respawn Core hands over on re-entry */
  goldSeconds: 3,
  /** Untimed stops. Docking and the input arm still prevent accidental buys. */
  dockTime: 4.8,
  depotArm: 0.8,
  /** the counted-down intermission: autopilot, then GO. Control comes back
   *  on the GO and never before, so it can be predicted */
  countdown: 3,
  /** a wave's field must drain before the count; a slow hulk can hold that
   *  open, so it is capped rather than waited on forever */
  drainCap: 6,
  respawnFreeze: 2,
  /** every rule phases in over this long, so nothing snaps on the first frame */
  modRamp: 3,
  clearOre: 12,
  minReadTime: 0.65,
  /** the free hint every first-time rule gets, in seconds. The control
   *  hint also leaves after this many inputs: a hand that has adjusted
   *  three times has read it */
  hintTime: 5,
  hintInputs: 3,
  /** how far the field may tilt under DRIFT, radians, and how fast it
   *  wanders. The authored DRIFT wave is the lesson and leans only this
   *  share of the way; the endless waves lean fully. The rule the flip
   *  taught: a first meeting must be survivable before it is understood */
  driftMax: 0.38,
  driftRate: 0.22,
  driftTeach: 0.6,
};

export type SpillMod = "none" | "surge" | "lowg" | "heavy" | "cross" | "blackout" | "swarm" | "drift";

/** every rule, in the order the ladder teaches them */
export const SPILL_MODS: readonly SpillMod[] = ["surge", "lowg", "heavy", "cross", "blackout", "swarm", "drift"];

/** the steering response rules cannot stack: a wave carries at most one */
const GRAVITY_MODS: readonly SpillMod[] = ["lowg", "heavy"];

export const SPILL_MOD_INFO: Record<SpillMod, { name: string; teach: string; short: string }> = {
  none: { name: "", short: "", teach: "" },
  surge: {
    name: "SURGE", short: "surge",
    teach: "SURGE: double debris for 6s · hold your lane",
  },
  lowg: {
    name: "LOW-G", short: "quick response",
    teach: "LOW-G: quicker steering response · release to hold altitude",
  },
  heavy: {
    name: "HEAVY", short: "slow response",
    teach: "HEAVY: slower steering response · plan your moves",
  },
  cross: {
    name: "CROSSWIND", short: "crosswind",
    teach: "CROSSWIND: pushed to the wall · dodge right to hold your lane",
  },
  blackout: {
    name: "BLACKOUT", short: "blackout",
    teach: "BLACKOUT: lights out · watch the rims",
  },
  swarm: {
    name: "SWARM", short: "swarm",
    teach: "SWARM: more spinners · read the weave",
  },
  drift: {
    name: "DRIFT", short: "drift",
    teach: "DRIFT: the field tilts · debris follows the angle",
  },
};

export const SPILL_CONTROL_HINT = "CONTROLS: drag up/down to steer · release to hold · swipe left/right to dodge";

// ------------------------------------------------------------ the ladder

export type SpillWaveSpec = {
  n: number;
  /** seconds of spawning before the field drains */
  dur: number;
  /** the hard ceiling on concurrent debris */
  cap: number;
  /** debris speed, × wave 1 */
  speed: number;
  mods: SpillMod[];
  /** how many hulks may share the screen */
  hulks: number;
  /** seconds between spawns at this wave, before the roll */
  interval: number;
};

/** Twenty authored waves. Every rule is taught alone the first time it
 *  appears; after wave 20 the game rolls them. Speed and crowding climb on
 *  separate curves so the field gets faster before it gets fuller.
 *  Spinners fly from wave 1: the weave is what makes the field read as a
 *  field rather than a hail of lines. */
const LADDER: readonly (readonly [number, number, number, SpillMod, number])[] = [
  //  dur cap speed  mod        hulks
  [20, 4, 1.05, "none", 0],
  [22, 5, 1.09, "none", 0],
  [24, 5, 1.14, "surge", 0],
  [26, 6, 1.18, "none", 1],
  [28, 6, 1.23, "none", 1],
  [30, 7, 1.27, "lowg", 1],
  [32, 7, 1.32, "none", 1],
  [34, 8, 1.36, "heavy", 1],
  [36, 8, 1.41, "surge", 1],
  [38, 9, 1.45, "none", 2],
  [40, 9, 1.50, "cross", 2],
  [40, 10, 1.54, "lowg", 2],
  [40, 10, 1.59, "blackout", 2],
  [40, 11, 1.63, "heavy", 2],
  [40, 11, 1.68, "surge", 2],
  [40, 12, 1.72, "swarm", 2],
  [40, 12, 1.77, "cross", 2],
  [40, 13, 1.81, "drift", 2],
  [40, 13, 1.86, "blackout", 2],
  [40, 14, 1.90, "swarm", 2],
];

export const SPILL_AUTHORED_WAVES = LADDER.length;
export const SPILL_DEPOT_EVERY = 5;

function hash(seed: number, n: number) {
  let x = (seed ^ Math.imul(n + 1, 0x9e3779b1)) >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d) >>> 0;
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b) >>> 0;
  return (x ^ (x >>> 16)) >>> 0;
}

function intervalFor(n: number) {
  const ramp = Math.min(1, (n - 1) / (SPILL_AUTHORED_WAVES - 1));
  const beyond = Math.max(0, n - SPILL_AUTHORED_WAVES);
  return Math.max(0.22, 0.78 - 0.42 * ramp - 0.01 * beyond);
}

function hazardCompatibleMods(n: number, seed: number, mods: SpillMod[]) {
  if (spillClimaxWave(n)) return [];
  const plan = spillHazardPlan(n, seed);
  if (plan.families.some(kind => SPILL_HAZARDS[kind].unlock === n)) return [];
  return mods.filter(mod => !(plan.families.includes("gravity") && ["heavy", "cross", "drift"].includes(mod))
    && !((plan.families.includes("ion") || plan.families.includes("flare")) && mod === "blackout"));
}

/** what wave n asks of the pilot. Authored through 20; rolled from the seed
 *  after that, so one run's wave 27 is repeatable and another run's is not */
export function spillWaveSpec(n: number, seed = 0): SpillWaveSpec {
  if (n >= 1 && n <= SPILL_AUTHORED_WAVES) {
    const [dur, cap, speed, mod, hulks] = LADDER[n - 1];
    return { n, dur, cap, speed, mods: hazardCompatibleMods(n, seed, mod === "none" ? [] : [mod]), hulks, interval: intervalFor(n) };
  }
  const beyond = Math.max(1, n - SPILL_AUTHORED_WAVES);
  const roll = hash(seed, n);
  const first = SPILL_MODS[roll % SPILL_MODS.length];
  const mods: SpillMod[] = [first];
  if (n >= SPILL_AUTHORED_WAVES + 6) {
    // a second rule from wave 26, never a second gravity rule
    const pool = SPILL_MODS.filter((m) => m !== first && !(GRAVITY_MODS.includes(first) && GRAVITY_MODS.includes(m)));
    mods.push(pool[(roll >>> 8) % pool.length]);
  }
  return {
    n,
    dur: 40,
    cap: Math.min(16, 14 + Math.floor((beyond - 1) / 3)),
    speed: Math.min(2.05, 1.9 * Math.pow(1.02, beyond)),
    mods: hazardCompatibleMods(n, seed, mods),
    hulks: 2,
    interval: intervalFor(n),
  };
}

// ------------------------------------------------------------ the depot
//
// The ship has four meters and a purchase fills one. Prices climb with the
// level, never with the wave, so a stop at wave 20 costs what a stop at
// wave 5 does - the run decides the order, not the clock.

export type SpillUpgrade = "plating" | "thrusters" | "pulse";
export type SpillBuyable = SpillUpgrade | "shield" | "repair" | "core";

export const SPILL_LEVELS = 3;

export const SPILL_SHOP: Record<SpillBuyable, { name: string; prices: readonly number[]; levels: readonly string[] }> = {
  plating: {
    name: "Health",
    prices: [60, 110, 180],
    levels: ["Max health 3 → 4", "Max health 4 → 5", "Max health 5 → 6"],
  },
  thrusters: {
    name: "Thrusters",
    prices: [50, 100, 170],
    levels: ["15% quicker steering and dodges", "30% quicker · carry 2 dodge charges", "45% quicker · dodges break small debris"],
  },
  pulse: {
    name: "Impact pulse",
    prices: [60, 110, 170],
    levels: ["Breaks debris on a charged hit", "Second blast readies after 5 seconds", "Wider blast · debris drops Salvage"],
  },
  shield: {
    name: "Shields",
    prices: [35],
    levels: ["Blocks one hit. Carry up to 2."],
  },
  repair: {
    name: "Repair",
    prices: [30],
    levels: ["Restore all health."],
  },
  core: {
    name: "Extra life",
    prices: [150],
    levels: ["Revive once with full health."],
  },
};

/** Thrusters improve acceleration and dodge speed; normal steering speed stays predictable. */
const THRUST_MUL = [1, 1.15, 1.3, 1.45] as const;

// ------------------------------------------------------------- the state

export type SpillPhase = "ready" | "countdown" | "wave" | "drain" | "docking" | "depot" | "respawn" | "over";

export type SpillKind = "shard" | "tumbler" | "hulk" | "spinner";

export type SpillRock = {
  /** Projectile damage is lazy; original rocks retain their exact spawn shape until hit. */
  hp?: number;
  /** Captured, bounded gravity arc; prediction and integration use its exact integral. */
  gravityBend?: { start: number; duration: number; strength: number };
  gravityWell?: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  kind: SpillKind;
  sprite: number;
  spin: number;
  rot: number;
  /** sinusoidal drift, for spinners */
  arc: number;
  arcPhase: number;
  /** a hulk waits offscreen behind a warning for this long */
  warn: number;
  grazed: boolean;
  dead: boolean;
};

export type SpillNutKind = "ore" | "gold" | "hull";
export type SpillNut = { x: number; y: number; vx: number; vy: number; got: boolean; bob: number; kind: SpillNutKind };

export type SpillBurst = { x: number; y: number; n: number; power: number; tone: "hit" | "shatter" | "ore" | "gold" | "shield" | "hull" | "lunge" | "graze" | "thrust" };

export type SpillCue =
  | "press" | "burst" | "lunge" | "hit" | "shatter" | "ore" | "gold" | "shield" | "hull" | "graze"
  | "pulse" | "wave" | "go" | "count" | "clear" | "dock" | "depot" | "armed" | "depot-close" | "buy" | "deny"
  | "respawn" | "dead" | "mission" | "milestone" | "surge" | "warn" | "recharge" | "charged" | "contract" | "event"
  | "laser" | "cannon" | "enemy-fire" | "enemy-down";

export type SpillDepot = {
  /** the shelves are inert until this runs out */
  arm: number;
  /** what this visit sold, for the receipt */
  bought: SpillBuyable[];
};

export type SpillState = {
  combat: SpillCombat;
  hazards: SpillHazardState;
  loadout: SpillLoadout;
  expedition: SpillExpedition;
  climax: SpillClimax;
  /** Evaluation runs cannot create checkpoints or advance career records. */
  practice?: boolean;
  /** Cosmetic mission family; absent in legacy/endless checkpoints. */
  zoneEnv?: number;
  seed: number;
  rng: number;
  W: number;
  H: number;
  phase: SpillPhase;
  /** Opening visit and its single free system choice; absent on older saves. */
  welcome?: boolean;
  openingEnabled?: boolean;
  freeUpgrade?: boolean;
  /** Transient art readiness; latched once at touchdown, never mid-gag. */
  depotGagReady?: boolean;
  depotGag?: boolean;
  phaseT: number;
  /** the wave being flown, or about to be */
  wave: number;
  /** waves CLEARED - the record. Set once, at the drain, never taken back */
  cleared: number;
  spec: SpillWaveSpec;
  /** seconds into the current wave's spawning window */
  waveT: number;
  /** whole-run clock, for score and the backdrop */
  t: number;
  /** a mission: the wave that must be cleared. 0 for the endless mode */
  target: number;
  pilot: { x: number; y: number; vx: number; vy: number; rot: number };
  /** Negative climbs, positive descends, zero brakes to an altitude hold. Transient input. */
  steerY: number;
  lungeDir: -1 | 1;
  /** Steering plume glow. Optional so older checkpoints still restore. */
  thrustT?: number;
  /** Steering or a dodge took control before GO. */
  manual: boolean;
  /** inputs made while the control hint showed */
  hintInputs: number;
  /** a burst flash, for the plume */
  burstT: number;
  lunge: number;
  lungeCharges: number;
  cool: number;
  knock: number;
  floorT: number;
  hull: number;
  maxHull: number;
  iframes: number;
  hitFlash: number;
  shield: number;
  canopyLevel: number;
  shieldFlash: number;
  gold: number;
  rocks: SpillRock[];
  nuts: SpillNut[];
  /** particle requests for the frame, drained by the sim */
  bursts: SpillBurst[];
  charge: number;
  chargeReady: boolean;
  pulseFlash: number;
  /** a second pulse waiting its five seconds */
  pulseQueue: number;
  echoReady: boolean;
  utilities: SpillUtility[];
  ownedUtilities: SpillUtility[];
  specialties: Partial<Record<SpillUpgrade, SpillSpecialty>>;
  brakeCool: number;
  repairOre: number;
  repairsThisWave: number;
  shards: number;
  contract: SpillContract | null;
  contractsDone: number;
  contractMessage: string;
  stipend: number;
  event: SpillEvent;
  eventWarn: number;
  eventSafeY: number;
  eventNext: number;
  eventPass: number;
  /** Legacy ledger name: this run has cleared the wave-20 milestone. */
  expeditionDone: boolean;
  /** First-ever wave-20 clear, shown at its Depot without ending the run. */
  firstPass: boolean;
  banked: { ore: number; contracts: number; waves: number; expedition: boolean; run: boolean };
  signal: string;
  combo: number;
  comboT: number;
  ore: number;
  /** Salvage mined over the whole run, spent or not */
  oreMined: number;
  score: number;
  grazes: number;
  hits: number;
  shattered: number;
  nextRock: number;
  nextNut: number;
  nextSpecial: number;
  surgeT: number;
  surgeFired: boolean;
  /** the ship's meters */
  up: Record<SpillUpgrade, number>;
  coreArmed: boolean;
  coreBought: boolean;
  /** this wave's rules, and how far they have phased in (0..1) */
  liveMods: SpillMod[];
  modRamp: number;
  /** DRIFT: the field's tilt, radians, and where it is wandering to */
  tilt: number;
  tiltTarget: number;
  tiltT: number;
  depot: SpillDepot | null;
  depotVisits: number;
  repairs: number;
  /** where a Respawn Core puts the ship back: the phase and its clock at
   *  the moment of the last hit */
  respawnReturn: SpillPhase;
  respawnPhaseT: number;
  banner: string;
  bannerT: number;
  hint: string;
  /** whether wave lessons and the controls card are shown at all - the
   *  HELP switch in settings; the rules still apply, they are just not
   *  narrated */
  hints: boolean;
  hintT: number;
  taught: string[];
  shake: number;
  deadFor: number;
  cause: "" | "STRUCK" | "GROUNDED" | "MISSION COMPLETE";
  cues: SpillCue[];
};

function rand(s: SpillState) {
  // mulberry32: the same stream for the same seed, which is what lets a
  // test replay a wave and what makes an endless run's rolls repeatable
  s.rng = (s.rng + 0x6d2b79f5) >>> 0;
  let x = s.rng;
  x = Math.imul(x ^ (x >>> 15), x | 1);
  x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
  return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
}

export function createSpill(W: number, H: number, seed: number, target = 0, hints = true, welcome = true): SpillState {
  return {
    combat: createSpillCombat(seed),
    hazards: createSpillHazards(seed),
    loadout: createSpillLoadout(), expedition: createSpillExpedition(), climax: createSpillClimax(),
    seed: seed >>> 0,
    rng: seed >>> 0,
    W,
    H,
    phase: "ready",
    welcome: false, freeUpgrade: false, openingEnabled: welcome,
    phaseT: 0,
    wave: 1,
    cleared: 0,
    spec: spillWaveSpec(1, seed >>> 0),
    waveT: 0,
    t: 0,
    target: Math.max(0, Math.floor(target)),
    pilot: { x: W * SPILL.homeX, y: H * 0.45, vx: 0, vy: 0, rot: 0 },
    steerY: 0, lungeDir: 1,
    manual: false,
    hintInputs: 0,
    burstT: 0,
    lunge: 0,
    lungeCharges: 1,
    cool: 0,
    knock: 0,
    floorT: 0,
    hull: SPILL.hull,
    maxHull: SPILL.hull,
    iframes: 0,
    hitFlash: 0,
    shield: 0,
    canopyLevel: 0,
    shieldFlash: 0,
    gold: 0,
    rocks: [],
    nuts: [],
    bursts: [],
    charge: 0,
    chargeReady: false,
    pulseFlash: 0,
    pulseQueue: 0,
    echoReady: false,
    utilities: [], ownedUtilities: [], specialties: {}, brakeCool: 0,
    repairOre: 0, repairsThisWave: 0, shards: 0,
    contract: null, contractsDone: 0, contractMessage: "", stipend: 0,
    event: "none", eventWarn: 0, eventSafeY: H * 0.5, eventNext: 5, eventPass: 0,
    expeditionDone: false, firstPass: false,
    banked: { ore: 0, contracts: 0, waves: 0, expedition: false, run: false },
    signal: "#c99bff",
    combo: 0,
    comboT: 0,
    ore: 0,
    oreMined: 0,
    score: 0,
    grazes: 0,
    hits: 0,
    shattered: 0,
    nextRock: 0.6,
    nextNut: 2.5,
    nextSpecial: 9,
    surgeT: 0,
    surgeFired: false,
    up: { plating: 0, thrusters: 0, pulse: 0 },
    coreArmed: false,
    coreBought: false,
    liveMods: [],
    modRamp: 0,
    tilt: 0,
    tiltTarget: 0,
    tiltT: 0,
    depot: null,
    depotVisits: 0, repairs: 0,
    respawnReturn: "wave",
    respawnPhaseT: 0,
    banner: "",
    bannerT: 0,
    hint: "",
    hints,
    hintT: 0,
    taught: [],
    shake: 0,
    deadFor: 0,
    cause: "",
    cues: [],
  };
}

/** the field keeps its shape through a rotation: everything scales with
 *  the canvas rather than being left in the old coordinates */
export function resizeSpill(s: SpillState, W: number, H: number) {
  if (!(W > 0 && H > 0) || (W === s.W && H === s.H)) return;
  const sx = W / s.W;
  const sy = H / s.H;
  resizeSpillCombat(s, sx, sy);
  resizeSpillHazards(s, sx, sy);
  resizeSpillClimax(s, sy);
  s.steerY = 0; s.lunge = 0; s.lungeDir = 1;
  s.pilot.vx = 0; s.pilot.vy = 0;
  for (const r of s.rocks) { r.x *= sx; r.y *= sy; r.vx *= sx; r.vy *= sy; r.arc *= sy;
    if (r.gravityBend) r.gravityBend.strength *= sy;
  }
  for (const n of s.nuts) { n.x *= sx; n.y *= sy; n.vx *= sx; n.vy *= sy; }
  s.eventSafeY *= sy;
  s.pilot.x *= sx;
  s.pilot.y = Math.max(22, Math.min(H - 22, s.pilot.y * sy));
  s.W = W;
  s.H = H;
}

// ---------------------------------------------------------------- rules

export const spillMod = (s: SpillState, m: SpillMod) => s.liveMods.includes(m);

/** debris crosses the screen in the same time whatever the width, so a
 *  desktop panorama is more room to read, not more seconds to react */
function lane(s: SpillState) {
  return Math.max(0.8, s.W / 390);
}

/** a rule's strength: 0 on the wave's first frame, 1 three seconds in */
function ramp(s: SpillState) {
  return Math.min(1, s.modRamp / SPILL.modRamp);
}

function steeringResponse(s: SpillState) {
  const response = spillMod(s, "lowg") ? 1.2 : spillMod(s, "heavy") ? 0.8 : 1;
  return 1 + (response - 1) * ramp(s);
}

function thrustMul(s: SpillState) {
  if (s.specialties.thrusters === "precision") return THRUST_MUL[1];
  return THRUST_MUL[Math.min(THRUST_MUL.length - 1, s.up.thrusters)];
}

function maxLunges(s: SpillState) {
  return s.up.thrusters >= 2 ? 2 : 1;
}

function pulseRadius(s: SpillState) {
  return (s.up.pulse >= 3 ? SPILL.pulseWideR : SPILL.pulseR) * lane(s);
}

export function spillHas(s: SpillState, utility: SpillUtility) { return s.utilities.includes(utility); }
export function spillChargeCap(s: SpillState) { return spillHas(s, "capacitor") ? 2 : 1; }

/** A moving escape corridor through the home lane. Its maximum vertical
 *  speed is below 25px/s; every stock ship can follow it. Salvage outside this
 *  route is the reason to take risks. Event sweeps reserve their marked gap. */
export function spillEscapeY(s: SpillState, ahead = 0) {
  if (s.event !== "none" && s.eventPass > 0) return s.eventSafeY;
  return s.H * 0.48 + Math.sin((s.t + ahead) * 0.22 + (s.seed % 19)) * Math.min(90, s.H * 0.12);
}

function escapeClear(s: SpillState, r: SpillRock) {
  for (let k = 0; k <= 45; k++) {
    const p = spillRockAt(s, r, k / 10);
    if (Math.abs(p.x - s.W * SPILL.homeX) > r.r + SPILL.shipR + 20) continue;
    if (Math.abs(p.y - spillEscapeY(s, k / 10)) < r.r + SPILL.shipR + 22) return false;
  }
  return true;
}

function say(s: SpillState, text: string, t: number) {
  s.banner = text;
  s.bannerT = t;
}

function cue(s: SpillState, c: SpillCue) {
  s.cues.push(c);
}

function burst(s: SpillState, x: number, y: number, n: number, tone: SpillBurst["tone"], power = 1) {
  s.bursts.push({ x, y, n, power, tone });
}

function surging(s: SpillState) {
  return s.surgeT > 0;
}

// ------------------------------------------------------------- spawning

/** four of the twenty-seven debris paintings are near-black against deep
 *  space — not dark objects, invisible ones. They stay out of the pool */
const UNREADABLE = new Set([8, 12, 14, 22]);

function readableSprite(s: SpillState) {
  for (let i = 0; i < 24; i++) {
    // Preserve the original rejection stream exactly: art expansion cannot
    // change seeded rock positions, motion, events or rewards.
    const n = Math.floor(rand(s) * LEGACY_DEBRIS_COUNT);
    if (!UNREADABLE.has(n)) {
      const family = s.zoneEnv == null ? null : ENVS[s.zoneEnv]?.debrisBias;
      return family ? family[n % family.length] : n;
    }
  }
  return s.zoneEnv == null ? 0 : ENVS[s.zoneEnv]?.debrisBias[0] ?? 0;
}

/** the rate a spinner weaves at, radians per second */
const ARC_RATE = 1.6;

/**
 * Where a piece will be t seconds from now. This is the same motion the
 * step integrates - a hulk waits out its warning before it moves, and a
 * spinner's weave is the integral of the cosine the step applies - so the
 * spawn check predicts exactly what the field will do.
 */
export function spillRockAt(s: SpillState, r: SpillRock, t: number) {
  const move = Math.max(0, t - r.warn);
  const x = r.x + r.vx * move;
  let y = r.y + r.vy * move;
  if (r.arc) {
    const t0 = s.t + r.warn;
    y += (Math.sin(r.arcPhase + ARC_RATE * (t0 + move)) - Math.sin(r.arcPhase + ARC_RATE * t0)) * r.arc / ARC_RATE;
  }
  y += spillGravityBendDelta(r, s.t, s.t + move);
  return { x, y };
}

/**
 * The one rule the brief set: debris never collides with debris. Not
 * simulated — refused. A candidate's path is sampled four and a half seconds
 * forward against every piece in flight, and any overlap rejects the spawn.
 */
export function spillPathClear(s: SpillState, cand: SpillRock) {
  if (!spillCombatRockClear(s, cand)) return false;
  if (!spillHazardPathClear(s, cand, ahead => spillRockAt(s, cand, ahead))) return false;
  for (const r of s.rocks) {
    if (r.dead) continue;
    for (let k = 0; k <= 18; k++) {
      const t = (k / 18) * 4.5;
      const a = spillRockAt(s, cand, t);
      const b = spillRockAt(s, r, t);
      if (a.x < -200 && b.x < -200) break;
      const gap = (cand.r + r.r) * 1.35;
      if ((a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y) < gap * gap) return false;
    }
  }
  return true;
}

function spawnRock(s: SpillState) {
  const spec = s.spec;
  const hulks = s.rocks.filter((r) => r.kind === "hulk" && !r.dead).length;
  const mayHulk = hulks < spec.hulks && s.waveT > 4;
  const swarm = spillMod(s, "swarm");
  const roll = rand(s);
  const kind: SpillKind = swarm ? (roll < 0.8 ? "spinner" : "tumbler")
    : mayHulk && roll > 0.94 ? "hulk"
      : roll < 0.4 ? "shard"
        : roll < 0.7 ? "tumbler"
          : "spinner";

  let speed =
    (kind === "hulk" ? 145 : kind === "shard" ? 290 : 205) * spec.speed * (surging(s) ? 1.12 : 1) * lane(s);
  const r = kind === "hulk" ? 36 + rand(s) * 14 : kind === "shard" ? 11 + rand(s) * 6 : 18 + rand(s) * 10;
  speed = Math.min(speed, Math.max(180, (s.W * (1 - SPILL.homeX) - r - 20) / SPILL.minReadTime));

  // an angle, but bounded: a piece must still cross the screen rather than
  // clip a corner, or it reads as unfair rather than as chaotic. Under
  // DRIFT the field's tilt is the angle the debris arrives at
  const ang = (rand(s) - 0.5) * (kind === "shard" ? 0.5 : 0.34) + (spillMod(s, "drift") ? s.tilt : 0);
  const y = 40 + rand(s) * (s.H - 80);

  const cand: SpillRock = {
    x: s.W + r + 20,
    y,
    vx: -Math.cos(ang) * speed,
    vy: Math.sin(ang) * speed,
    r,
    kind,
    sprite: readableSprite(s),
    spin: (rand(s) - 0.5) * (kind === "tumbler" ? 2.4 : kind === "hulk" ? 0.5 : 1.2),
    rot: rand(s) * Math.PI * 2,
    arc: kind === "spinner" ? (swarm ? 34 : 26) + rand(s) * 26 : 0,
    arcPhase: rand(s) * Math.PI * 2,
    warn: kind === "hulk" ? 1.1 : 0,
    grazed: false,
    dead: false,
  };
  if (!spillPathClear(s, cand) || !escapeClear(s, cand)) return false;
  s.rocks.push(cand);
  if (kind === "hulk") cue(s, "warn");
  return true;
}

/** Salvage spills in arcs, so collecting a stream is a line you fly, not a dot */
function spawnStream(s: SpillState) {
  const n = 4 + Math.floor(rand(s) * 5);
  const y0 = 70 + rand(s) * (s.H - 140);
  const curve = (rand(s) - 0.5) * 150;
  const speed = (190 + Math.min(1, (s.wave - 1) / 19) * 90) * lane(s);
  for (let i = 0; i < n; i++) {
    const f = i / Math.max(1, n - 1);
    s.nuts.push({
      x: s.W + 30 + i * 40,
      y: y0 + Math.sin(f * Math.PI) * curve,
      vx: -speed,
      vy: 0,
      got: false,
      bob: rand(s) * Math.PI * 2,
      kind: "ore",
    });
  }
}

/**
 * The things that drift past alone rather than in a stream. Gold Salvage is
 * what charges the PULSE - half a meter each - and pays five. A hull
 * fragment only shows up when there is a pip to restore. Shields are not
 * found in the field any more: the Depot sells them, cheaply, every stop.
 */
function spawnSpecial(s: SpillState) {
  const kind: SpillNutKind = s.hull < s.maxHull && rand(s) < 0.34 ? "hull" : "gold";
  s.nuts.push({
    x: s.W + 40,
    y: 80 + rand(s) * (s.H - 160),
    vx: -(150 + Math.min(1, (s.wave - 1) / 19) * 60) * lane(s),
    vy: 0,
    got: false,
    bob: rand(s) * Math.PI * 2,
    kind,
  });
}

/** Event hazards are warned before their release, with a stock-ship-sized
 *  opening chosen close enough to the current pilot to reach comfortably.
 *  The machine is scenery; surviving its sweeps needs no purchased weapon. */
export function spillEventGap(s: SpillState) { return Math.max(130, s.H * (s.event === "lanes" ? 0.19 : 0.23)); }

function stepEvent(s: SpillState, dt: number) {
  if (s.event === "none") return;
  if (spillClimaxReserved(s) && s.eventWarn <= 0) return;
  if (s.eventWarn > 0) {
    s.eventWarn = Math.max(0, s.eventWarn - dt);
    if (s.eventWarn === 0) {
      const gap = spillEventGap(s);
      const r = s.event === "cargo" ? 30 : s.event === "vein" ? 14 : 22;
      const cap = s.spec.cap + (spillMod(s, "swarm") ? 2 : 0) + (surging(s) ? 2 : 0);
      const spacing = s.event === "cargo" ? 140 : s.event === "vein" ? 160 : 100;
      for (let y = 50; y < s.H - 40; y += spacing) {
        if (s.rocks.filter(rock => !rock.dead).length >= cap) break;
        if (Math.abs(y - s.eventSafeY) < gap / 2 + r) continue;
        const rock: SpillRock = { x: s.W + 50 + (s.event === "lanes" ? (Math.floor(y / spacing) % 2) * 60 : 0), y, vx: -Math.min(250 * lane(s), (s.W * (1 - SPILL.homeX) - 60) / 0.85), vy: 0,
          r, kind: s.event === "rig" || s.event === "cargo" ? "tumbler" : "shard", sprite: readableSprite(s), spin: 0.35, rot: 0,
          arc: 0, arcPhase: 0, warn: 0, grazed: false, dead: false };
        if (spillPathClear(s, rock) && escapeClear(s, rock)) s.rocks.push(rock);
      }
      // The clear opening pays for following the warning. Riskier streams
      // continue elsewhere, but the event never requires a utility to win.
      for (let i = 0; i < 5; i++) s.nuts.push({ x: s.W + 90 + i * 38, y: s.eventSafeY,
        vx: -180 * lane(s), vy: 0, got: false, bob: i, kind: s.event === "vein" && i % 2 === 0 ? "gold" : "ore" });
      cue(s, "surge");
    }
  }
  if (!spillClimaxReserved(s) && s.waveT >= s.eventNext && s.waveT < s.spec.dur - 3) {
    s.eventNext += s.event === "rig" ? 9 : 10;
    s.eventPass++;
    const desired = s.pilot.y + (s.event === "rig" ? (s.eventPass % 2 ? -60 : 60) : (rand(s) - 0.5) * 160);
    s.eventSafeY = Math.max(Math.min(110, s.H * 0.3), Math.min(s.H - Math.min(110, s.H * 0.3), desired));
    // The rig clears its announced route before releasing the sweep.
    // Retire conflicting ambient debris without awarding shatter rewards.
    for (const rock of s.rocks) {
      if (!rock.dead && !escapeClear(s, rock)) { rock.dead = true; burst(s, rock.x, rock.y, 4, "graze", 0.3); }
    }
    s.eventWarn = spillHas(s, "scanner") ? 2.1 : 1.6;
    say(s, `${SPILL_EVENTS[s.event].name} · SWEEP ${s.eventPass}`, 1.6);
    cue(s, "event");
  }
}

// ---------------------------------------------------------------- input

function flying(s: SpillState) {
  return s.phase === "wave" || s.phase === "drain";
}

/** the hand has the ship: in flight, or through a count it took over */
function handOn(s: SpillState) {
  return flying(s) || (s.phase === "countdown" && s.manual);
}

/** the control hint leaves once the hand has plainly read it */
function noteInput(s: SpillState) {
  if (s.hint !== SPILL_CONTROL_HINT || s.hintT <= 1) return;
  s.hintInputs += 1;
  if (s.hintInputs >= SPILL.hintInputs) s.hintT = 1;
}

/** Compatibility launch action. Tapping during flight never moves the ship. */
export function spillTap(s: SpillState) {
  if (s.phase === "ready") {
    if (s.openingEnabled !== false) { s.welcome = true; s.freeUpgrade = true; s.wave = 0; beginDocking(s); }
    else beginCountdown(s, 1);
    return true;
  }
  return false;
}

/** Semantic stick input. Releasing always clears input, including outside flight. */
export function spillSteer(s: SpillState, axis: number): boolean {
  const next = Number.isFinite(axis) ? Math.max(-1, Math.min(1, axis)) : 0;
  if (!flying(s) && s.phase !== "countdown") { s.steerY = 0; return false; }
  if (next && s.phase === "countdown" && !s.manual) { s.manual = true; s.pilot.vy = 0; }
  if (next && Math.sign(next) !== Math.sign(s.steerY)) noteInput(s);
  s.steerY = next;
  return true;
}

/** Older shared helpers route to direct steering, never to a tap/gravity impulse. */
export function spillBurst(s: SpillState, dir: -1 | 1) { return spillSteer(s, dir); }

/** Both dodge directions spend the same charges and return toward the home lane. */
export function spillLunge(s: SpillState, dir: -1 | 1 = 1) {
  if (s.phase === "ready") return spillTap(s);
  if ((!handOn(s) && s.phase !== "countdown") || s.lungeCharges <= 0 || (dir !== -1 && dir !== 1)) return false;
  if (s.phase === "countdown" && !s.manual) { s.manual = true; s.pilot.vy = 0; }
  noteInput(s);
  s.lunge = SPILL.lungeTime;
  s.lungeDir = dir;
  s.lungeCharges -= 1;
  spillPrimeEcho(s);
  if (spillHas(s, "brake") || s.specialties.thrusters === "precision") s.pilot.vy *= 0.25;
  if (s.cool <= 0) s.cool = SPILL.lungeCooldown;
  burst(s, s.pilot.x - dir * 14, s.pilot.y, 8, "lunge", 0.5);
  cue(s, "lunge");
  return true;
}

function shatter(s: SpillState, r: SpillRock, power = 1.2) {
  if (r.dead) return;
  r.dead = true;
  s.shattered += 1;
  if (r.kind === "shard") s.shards += 1;
  s.score += 4;
  burst(s, r.x, r.y, 16, "shatter", power);
  if (s.up.pulse >= 3 || s.specialties.pulse === "yield") {
    const count = s.up.pulse >= 3 && s.specialties.pulse === "yield" ? 2 : 1;
    for (let i = 0; i < count; i++) s.nuts.push({ x: r.x + i * 12, y: r.y, vx: -60 * lane(s), vy: 0, got: false, bob: rand(s) * 6, kind: "ore" });
  }
}

/** everything close enough is shattered. Fired by the ship on impact once
 *  POWER-UPS I is in; II banks an echo for a later impact */
function firePulse(s: SpillState) {
  s.pulseFlash = 0.45;
  s.shake = 0.5;
  const reach = pulseRadius(s);
  let hit = spillCombatPulse(s, reach);
  for (const r of s.rocks) {
    if (r.dead || r.warn > 0) continue;
    const dx = r.x - s.pilot.x;
    const dy = r.y - s.pilot.y;
    if (dx * dx + dy * dy < reach * reach) {
      shatter(s, r);
      hit++;
    }
  }
  say(s, hit ? `PULSE ×${hit}` : "PULSE", 1.1);
  cue(s, "pulse");
  return hit;
}

/** spend a full meter now. The ship does this on its own at an impact;
 *  this is the hand-fired form, kept for tests and a keyboard */
export function spillPulse(s: SpillState) {
  if (!flying(s) || s.up.pulse < 1 || s.charge < 1) return false;
  s.charge -= 1;
  firePulse(s);
  if (s.up.pulse >= 2) s.pulseQueue = SPILL.doublePulseDelay;
  return true;
}

// ---------------------------------------------------------------- waves

function beginWave(s: SpillState) {
  beginSpillCombatWave(s);
  beginSpillHazardWave(s);
  s.climax = createSpillClimax();
  s.phase = "wave";
  s.phaseT = 0;
  // A held stick during the countdown keeps its direction through GO.
  s.manual = false;
  s.waveT = 0;
  s.modRamp = 0;
  s.surgeT = 0;
  s.surgeFired = false;
  s.nextRock = 0.9;
  s.nextNut = 2.5;
  s.nextSpecial = 8 + rand(s) * 6;
  s.repairsThisWave = 0;
  s.eventWarn = 0;
  s.eventNext = 5;
  s.eventPass = 0;
  cue(s, "go");
}

/** the intermission: the ship flies itself home while the next wave is
 *  named and counted down. Control comes back on the GO */
function beginCountdown(s: SpillState, n: number) {
  clearSpillCombat(s);
  clearSpillHazards(s);
  s.wave = n;
  s.spec = spillWaveSpec(n, s.seed);
  s.event = spillEventFor(n, s.seed);
  s.liveMods = s.spec.mods.slice();
  s.modRamp = 0;
  s.phase = "countdown";
  s.phaseT = 0;
  s.manual = false;
  s.steerY = 0;
  s.lunge = 0; s.lungeDir = 1;
  s.knock = 0;
  s.pilot.vx = 0;
  s.rocks = [];
  s.tiltTarget = 0;
  if (!spillMod(s, "drift")) s.tilt = 0;
  // the first time a rule appears it is taught, in the wave, for free.
  // After that it is just part of the escalation
  const fresh = s.liveMods.find((m) => !s.taught.includes(m));
  if (fresh) {
    s.taught.push(fresh);
    s.hint = SPILL_MOD_INFO[fresh].teach;
    s.hintT = s.hints ? SPILL.countdown + SPILL.hintTime : 0;
  } else if (n === 1) {
    s.hint = SPILL_CONTROL_HINT;
    s.hintT = s.hints ? SPILL.countdown + SPILL.hintTime : 0;
  }
  const hazardLesson = spillHazardPlan(n, s.seed).families.find(kind => SPILL_HAZARDS[kind].unlock === n);
  if (hazardLesson) {
    s.hint = SPILL_HAZARDS[hazardLesson].teach;
    s.hintT = s.hints ? SPILL.countdown + SPILL.hintTime : 0;
  }
  if (s.event !== "none" && s.hints) {
    s.hint = SPILL_EVENTS[s.event].hint;
    s.hintT = SPILL.countdown + SPILL.hintTime;
  }
  cue(s, "wave");
}

/** every fifth wave docks at the Depot; the rest count straight on */
function afterClear(s: SpillState) {
  if (s.wave % SPILL_DEPOT_EVERY === 0) beginDocking(s);
  else beginCountdown(s, s.wave + 1);
}

function endWave(s: SpillState) {
  clearSpillCombat(s);
  clearSpillHazards(s);
  s.steerY = 0; s.lunge = 0; s.lungeDir = 1;
  // the wave is cleared the moment the field has drained. A mission ends
  // on a win here, not on the crash that was coming eventually
  s.cleared = s.wave;
  s.score += 50 * s.wave;
  s.ore += SPILL.clearOre;
  s.stipend += SPILL.clearOre;
  settleContract(s);
  settleSpillExpedition(s);
  if (s.wave === 20) s.expeditionDone = true;
  cue(s, "clear");
  if (s.wave % SPILL_DEPOT_EVERY === 0) cue(s, "milestone");
  if (s.target && s.wave >= s.target) {
    s.phase = "over";
    s.phaseT = 0;
    s.deadFor = 0;
    s.cause = "MISSION COMPLETE";
    cue(s, "mission");
    return;
  }
  afterClear(s);
}

// ---------------------------------------------------------------- depot

export function spillDockTravelDuration(s: SpillState) { return s.welcome ? 2.4 : SPILL.dockTime; }
export function spillDockDuration(s: SpillState) {
  return spillDockTravelDuration(s) + (s.depotGag ? VANGUARD_DEPOT_SECONDS : 0);
}

function beginDocking(s: SpillState) {
  clearSpillCombat(s);
  clearSpillHazards(s);
  s.steerY = 0; s.lungeDir = 1;
  s.phase = "docking";
  s.phaseT = 0;
  s.depotGag = undefined;
  s.lunge = 0;
  s.knock = 0;
  s.pilot.vx = 0;
  s.rocks = [];
  // the coins still on screen when the dock call comes are the pilot's:
  // the ship is on autopilot to the Depot and cannot collect them, so they
  // are paid into the wallet rather than swept away (audit, 30 Sep 2026)
  for (const n of s.nuts) {
    if (n.got || n.kind === "hull" || n.x <= 0 || n.x >= s.W) continue;
    const worth = n.kind === "gold" ? 5 : 1;
    s.ore += worth; s.oreMined += worth;
  }
  s.nuts = [];
  s.banner = ""; s.bannerT = 0;
  cue(s, "dock");
}

function openDepot(s: SpillState) {
  s.phase = "depot";
  s.phaseT = 0;
  s.pilot.vy = 0;
  // docking restores one pip; the rest is the Depot's business
  s.hull = Math.min(s.maxHull, s.hull + 1);
  s.depot = { arm: SPILL.depotArm, bought: [] };
  if (!s.welcome) s.depotVisits += 1;
  cue(s, "depot");
}

/** Purchases own the module for this run; fitting it uses one of two slots.
 *  Swapping owned parts at a Depot is free, without selling or duplicating Salvage. */
export function spillUtility(s: SpillState, id: SpillUtility, replace?: SpillUtility): "ok" | "poor" | "full" | "closed" {
  if (s.welcome || s.phase !== "depot" || !s.depot || s.depot.arm > 0 || !SPILL_UTILITIES[id]) return "closed";
  const i = s.utilities.indexOf(id);
  if (replace && (i >= 0 || !s.utilities.includes(replace))) return "closed";
  if (i >= 0) { s.utilities.splice(i, 1); s.charge = Math.min(s.charge, spillChargeCap(s)); cue(s, "buy"); return "ok"; }
  // Validate the replacement before touching coins, ownership or slots.
  if (s.utilities.length >= 2 && !replace) return "full";
  if (!s.ownedUtilities.includes(id)) {
    if (s.ore < SPILL_UTILITIES[id].price) return "poor";
    s.ore -= SPILL_UTILITIES[id].price;
    s.ownedUtilities.push(id);
  }
  if (replace) s.utilities.splice(s.utilities.indexOf(replace), 1, id);
  else s.utilities.push(id);
  s.charge = Math.min(s.charge, spillChargeCap(s));
  cue(s, "buy"); return "ok";
}

export function spillSpecialize(s: SpillState, id: SpillSpecialty): boolean {
  const spec = SPILL_SPECIALTIES[id];
  if (s.welcome || s.phase !== "depot" || !s.depot || s.depot.arm > 0 || !spec || s.up[spec.axis] < 2) return false;
  s.specialties[spec.axis] = id; cue(s, "buy"); return true;
}

export function spillTakeContract(s: SpillState, kind: SpillContractKind): boolean {
  if (s.welcome || s.phase !== "depot" || !s.depot || s.depot.arm > 0 || s.contract) return false;
  const offer = spillContractOffers(s.wave).find(o => o.kind === kind);
  if (!offer) return false;
  s.contract = { kind, target: offer.target, reward: offer.reward, startWave: s.wave + 1, endWave: s.wave + 5,
    startOre: s.oreMined, startHits: s.hits, startShards: s.shards };
  s.contractMessage = ""; cue(s, "buy"); return true;
}

export function spillContractProgress(s: SpillState) {
  const c = s.contract;
  if (!c) return "No contract";
  if (c.kind === "clean") return s.hits === c.startHits ? `CLEAN PASSAGE · through wave ${c.endWave}` : "CLEAN PASSAGE · missed";
  return `${c.kind === "salvage" ? "COLLECT" : "SHATTER"} ${Math.min(c.target, c.kind === "salvage" ? s.oreMined - c.startOre : s.shards - c.startShards)}/${c.target} · by wave ${c.endWave}`;
}

function settleContract(s: SpillState) {
  const c = s.contract;
  if (!c || s.wave < c.endWave) return;
  const won = c.kind === "clean" ? s.hits === c.startHits : c.kind === "salvage" ? s.oreMined - c.startOre >= c.target : s.shards - c.startShards >= c.target;
  if (won) { s.ore += c.reward; s.contractsDone++; s.score += 500; }
  s.contractMessage = won ? `CONTRACT COMPLETE · +${c.reward} SALVAGE` : "CONTRACT MISSED · choose another";
  s.contract = null; cue(s, "contract");
}

function closeDepot(s: SpillState) {
  beginSpillExpedition(s);
  // the contract line belongs to the Depot it was settled at; it does not
  // greet the next one (audit, 30 Sep 2026)
  s.contractMessage = "";
  s.firstPass = false;
  s.welcome = false;
  s.freeUpgrade = false;
  s.depot = null;
  cue(s, "depot-close");
  beginCountdown(s, s.wave + 1);
}

/** the next level's price for a meter, or null when it is full */
export function spillPrice(s: SpillState, what: SpillBuyable): number | null {
  const shop = SPILL_SHOP[what];
  if (s.welcome && s.freeUpgrade && ["plating", "shield", "thrusters", "pulse"].includes(what)) return 0;
  if (what === "plating" || what === "thrusters" || what === "pulse") {
    return s.up[what] >= SPILL_LEVELS ? null : shop.prices[s.up[what]];
  }
  if (what === "shield") return s.shield >= 2 ? null : shop.prices[0];
  if (what === "repair") return s.hull >= s.maxHull ? null : shop.prices[0];
  return s.coreBought ? null : shop.prices[0];
}

/** fill one meter, or buy one of the flat items */
export function spillBuy(s: SpillState, what: SpillBuyable): "ok" | "poor" | "maxed" | "arming" | "closed" {
  const d = s.depot;
  if (!d || s.phase !== "depot") return "closed";
  // the shelves are inert for a moment after they appear, against a thumb
  // that is still tapping from the wave
  if (d.arm > 0) return "arming";
  const price = spillPrice(s, what);
  if (price === null) return "maxed";
  if (s.welcome && (!s.freeUpgrade || !["plating", "shield", "thrusters", "pulse"].includes(what))) return "closed";
  if (s.ore < price) { cue(s, "deny"); return "poor"; }
  s.ore -= price;
  switch (what) {
    case "plating":
      s.up.plating += 1;
      s.maxHull = SPILL.hull + s.up.plating + spillChassisStats(s.loadout.chassis).hull;
      s.hull += 1;                       // the new pip arrives filled
      break;
    case "thrusters":
      s.up.thrusters += 1;
      s.lungeCharges = maxLunges(s);
      break;
    case "pulse":
      s.up.pulse += 1;
      break;
    case "shield":
      s.shield = Math.min(2, s.shield + 1);
      s.canopyLevel = Math.max(s.canopyLevel, s.shield);
      s.shieldFlash = 0.6;
      break;
    case "repair":
      s.repairs = (s.repairs ?? 0) + 1;
      s.hull = s.maxHull;
      break;
    case "core":
      s.coreBought = true;
      s.coreArmed = true;
      break;
  }
  if (s.welcome) s.freeUpgrade = false;
  d.bought.push(what);
  cue(s, "buy");
  return "ok";
}

export function spillLeaveDepot(s: SpillState) {
  if (!s.depot || s.phase !== "depot") return false;
  if (s.depot.arm > 0 || (s.welcome && s.freeUpgrade)) return false;
  closeDepot(s);
  return true;
}

// ----------------------------------------------------------------- hits

function takeHit(s: SpillState, r: SpillRock | null, cause: "STRUCK" | "GROUNDED" = r ? "STRUCK" : "GROUNDED") {
  if (s.iframes > 0 || s.gold > 0) return;
  // A boundary has no debris to shatter, but protection applies equally.
  const breakRock = (power = 1.2) => { if (r) shatter(s, r, power); };
  // an unlocked, charged PULSE fires itself at the impact: the piece and
  // everything near it shatter and the hull is never touched
  if (s.up.pulse >= 1 && (s.charge >= 1 || s.echoReady)) {
    const echo = s.echoReady;
    if (echo) s.echoReady = false; else s.charge -= 1;
    firePulse(s);
    breakRock();
    s.iframes = SPILL.shieldRecovery;
    if (!echo && s.up.pulse >= 2 && s.pulseQueue <= 0) s.pulseQueue = SPILL.doublePulseDelay;
    return;
  }
  if (s.shield > 0) {
    // a shield eats the piece rather than the ship
    s.shield -= 1;
    s.shieldFlash = 0.5;
    s.shake = 0.6;
    breakRock();
    s.iframes = SPILL.shieldRecovery;
    say(s, "SHIELD HELD", 1.1);
    cue(s, "shield");
    return;
  }
  s.hull -= 1;
  s.hits += 1;
  s.iframes = SPILL.iframes + (s.specialties.plating === "brace" ? 0.4 : 0);
  s.hitFlash = 0.5;
  s.shake = 0.7;
  s.knock = SPILL.knockTime * (s.specialties.plating === "brace" ? 0.5 : 1);
  s.pilot.vy = -180;
  s.combo = 0;
  s.comboT = 0;
  breakRock(1.4);
  burst(s, s.pilot.x, s.pilot.y, 14, "hit", 1.1);
  cue(s, "hit");
  if (s.hull > 0) {
    say(s, s.hull === 1 ? "HEALTH CRITICAL" : "HEALTH LOST", 1.2);
    return;
  }
  lose(s, cause);
}

function lose(s: SpillState, cause: "STRUCK" | "GROUNDED") {
  clearSpillCombat(s);
  clearSpillHazards(s);
  s.steerY = 0; s.lunge = 0; s.lungeDir = 1;
  if (s.coreArmed) {
    // the extra life: the field freezes, and the ship comes back whole and
    // golden, to the phase it left
    s.coreArmed = false;
    s.respawnReturn = s.phase;
    s.respawnPhaseT = s.phaseT;
    s.phase = "respawn";
    s.phaseT = 0;
    s.iframes = 0;
    s.floorT = 0;
    burst(s, s.pilot.x, s.pilot.y, 30, "hit", 1.5);
    say(s, "RESPAWN CORE", SPILL.respawnFreeze);
    cue(s, "respawn");
    return;
  }
  s.phase = "over";
  s.phaseT = 0;
  s.deadFor = 0;
  s.cause = cause;
  s.shake = 1;
  burst(s, s.pilot.x, s.pilot.y, 34, "hit", 1.5);
  cue(s, "dead");
}

// ----------------------------------------------------------------- step

/** Both flight and manual countdown share dodge, cooldown and horizontal bounds. */
function handHorizontal(s: SpillState, dt: number) {
  if (s.cool > 0) {
    s.cool = Math.max(0, s.cool - dt);
    if (s.cool === 0) {
      s.lungeCharges = maxLunges(s);
      cue(s, "recharge");
    }
  } else if (s.lungeCharges < maxLunges(s)) s.lungeCharges = maxLunges(s);
  if (s.knock > 0) {
    s.knock = Math.max(0, s.knock - dt);
    s.pilot.vx = SPILL.knockSpeed;
  } else if (s.lunge > 0) {
    s.lunge = Math.max(0, s.lunge - dt);
    s.pilot.vx = s.lungeDir * SPILL.lungeSpeed * thrustMul(s);
    if (s.up.thrusters >= 3 || s.specialties.thrusters === "sweep") {
      for (const r of s.rocks) {
        if (r.dead || r.warn > 0 || r.kind !== "shard") continue;
        const dx = r.x - s.pilot.x;
        const dy = r.y - s.pilot.y;
        const reach = r.r + SPILL.shipR + (s.specialties.thrusters === "sweep" ? 28 : 6);
        if (dx * dx + dy * dy < reach * reach) shatter(s, r, 0.9);
      }
    }
  } else {
    // slides to a stop rather than stopping dead, so a dash has weight,
    // then drifts back to the home lane slowly
    s.pilot.vx *= 1 - Math.min(1, dt * 8.5);
    const home = s.W * SPILL.homeX;
    if (Math.abs(s.pilot.x - home) > 1) s.pilot.x += (home - s.pilot.x) * Math.min(1, dt * SPILL.driftHome);
  }
  // the crosswind is a steady push toward the wall; the lunge is the counter
  if (spillMod(s, "cross") && s.knock <= 0 && s.lunge <= 0) s.pilot.x -= 40 * lane(s) * ramp(s) * dt;

  s.pilot.x += s.pilot.vx * dt;
  s.pilot.x += spillGravityDrift(s).x * dt;

  const lo = s.W * SPILL.bandLeft;
  const hi = s.W * SPILL.bandRight;
  if (s.pilot.x < lo) { s.pilot.x = lo; s.pilot.vx = Math.max(0, s.pilot.vx); }
  if (s.pilot.x > hi) { s.pilot.x = hi; s.pilot.vx = 0; }
  s.pilot.rot = Math.max(-0.5, Math.min(0.5, s.pilot.vy / 700)) + s.pilot.vx / 2600;
}

/** Direct velocity with acceleration, responsive release and symmetric soft edges. */
function handVertical(s: SpillState, dt: number) {
  const axis = s.steerY;
  const top = 22, bottom = s.H - 22;
  const command = axis * SPILL.steerSpeed * spillChassisStats(s.loadout.chassis).steer + spillGravityDrift(s).y;
  const room = command < 0 ? s.pilot.y - top : bottom - s.pilot.y;
  const edge = command ? Math.max(0, Math.min(1, room / SPILL.edgeEase)) : 1;
  const wanted = command * edge;
  const braking = axis === 0 || (s.pilot.vy !== 0 && Math.sign(wanted) !== Math.sign(s.pilot.vy))
    || Math.abs(wanted) < Math.abs(s.pilot.vy);
  const acceleration = braking
    ? SPILL.steerBrake * (spillHas(s, "brake") ? 1.5 : 1)
    : SPILL.steerAcceleration * thrustMul(s) * steeringResponse(s);
  const change = acceleration * dt;
  s.pilot.vy += Math.max(-change, Math.min(change, wanted - s.pilot.vy));
  if (Math.abs(s.pilot.vy) < 0.001) s.pilot.vy = 0;
  s.pilot.y += s.pilot.vy * dt;
  if (s.pilot.y < top) { s.pilot.y = top; s.pilot.vy = Math.max(0, s.pilot.vy); }
  if (s.pilot.y > bottom) { s.pilot.y = bottom; s.pilot.vy = Math.min(0, s.pilot.vy); }
  if (axis) s.thrustT = 0.1;
  s.pilot.rot = Math.max(-0.5, Math.min(0.5, s.pilot.vy / 700)) + s.pilot.vx / 2600;
}

/** the ship flies itself: home lane, mid height, level. Used through the
 *  countdown and the dock so the hand can rest and know when it is needed */
function autopilot(s: SpillState, dt: number) {
  const docking = s.phase === "docking" || s.phase === "depot";
  const p = docking ? Math.min(1, s.phase === "depot" ? 1 : s.phaseT / spillDockTravelDuration(s)) : 0;
  const approach = p * p * (3 - 2 * p);
  const home = s.W * (SPILL.homeX + (0.55 - SPILL.homeX) * approach);
  s.pilot.vy = 0;
  s.pilot.vx = 0;
  s.pilot.x += (home - s.pilot.x) * Math.min(1, dt * 3);
  s.pilot.y += (s.H * (0.45 + 0.15 * approach) - s.pilot.y) * Math.min(1, dt * 3);
  s.pilot.rot *= Math.max(0, 1 - dt * 5);
}

/**
 * One frame. Returns every cue raised since the last frame - by this step
 * and by any input that landed between steps - oldest first, and clears
 * them. The sim turns them into sound and the engine into a re-render.
 */
/** ORE AND THE DRIFTS: move every coin (magnet pull included), collect the
 *  ones under the ship, and drop the ones that left the screen. Shared by
 *  the wave, the drain and the countdown, so a coin is never drawn where it
 *  cannot be picked up. */
function stepNuts(s: SpillState, dt: number) {
  if (s.comboT > 0) {
    s.comboT = Math.max(0, s.comboT - dt);
    if (s.comboT === 0) s.combo = 0;
  }
  for (const n of s.nuts) {
    if (n.got) continue;
    if (spillHas(s, "magnet") && n.kind !== "hull") {
      const dx = s.pilot.x - n.x, dy = s.pilot.y - n.y, distance = Math.hypot(dx, dy);
      if (distance > 1 && distance < 100 * Math.sqrt(lane(s))) {
        const pull = Math.min(distance, 420 * dt);
        n.x += dx / distance * pull; n.y += dy / distance * pull;
      }
    }
    n.x += n.vx * dt;
    n.y += n.vy * dt;
    n.bob += dt * 4;
    const dx = n.x - s.pilot.x;
    const dy = n.y + Math.sin(n.bob) * 3 - s.pilot.y;
    if (dx * dx + dy * dy < 30 * 30) {
      n.got = true;
      if (n.kind === "hull") {
        s.hull = Math.min(s.maxHull, s.hull + 1);
        say(s, "HEALTH RESTORED", 1.3);
        burst(s, n.x, n.y, 14, "hull", 0.9);
        cue(s, "hull");
      } else {
        const worth = n.kind === "gold" ? 5 : 1;
        s.ore += worth;
        s.oreMined += worth;
        s.repairOre += worth;
        if (s.specialties.plating === "salvage" && s.repairOre >= 30 && s.repairsThisWave < 2 && s.hull < s.maxHull) {
          s.repairOre -= 30; s.repairsThisWave++; s.hull++; cue(s, "hull"); say(s, "SALVAGE ARMOR · +1 HEALTH", 1.2);
        }
        s.repairOre = Math.min(30, s.repairOre);
        s.combo = Math.min(9, s.combo + 1);
        s.comboT = 2.6;
        s.score += 25 * s.combo * (n.kind === "gold" ? 2 : 1);
        if (n.kind === "gold") {
          s.charge = Math.min(spillChargeCap(s), s.charge + (s.specialties.pulse === "efficient" ? 0.65 : 0.5));
          say(s, s.up.pulse >= 1 ? (s.charge >= 1 ? "PULSE ARMED" : "CHARGED SALVAGE · CHARGING") : "CHARGED SALVAGE", 1);
          cue(s, "gold");
        } else cue(s, "ore");
        burst(s, n.x, n.y, n.kind === "gold" ? 14 : 7, n.kind === "gold" ? "gold" : "ore", 0.8);
      }
    }
  }
  s.nuts = s.nuts.filter((n) => !n.got && n.x > -40 && n.y > -40 && n.y < s.H + 40);
}

export function stepSpill(s: SpillState, dt: number): SpillCue[] {
  stepSpillBody(s, dt);
  const out = s.cues;
  s.cues = [];
  // the HUD lights ARMED on a cue, so the meter filling has to be one
  if (s.charge >= 1 && !s.chargeReady) { s.chargeReady = true; out.push("charged"); }
  else if (s.charge < 1 && s.chargeReady) s.chargeReady = false;
  return out;
}

function stepSpillBody(s: SpillState, dt: number) {
  if (s.bannerT > 0) s.bannerT = Math.max(0, s.bannerT - dt);
  if (s.hintT > 0) s.hintT = Math.max(0, s.hintT - dt);
  if (s.pulseFlash > 0) s.pulseFlash = Math.max(0, s.pulseFlash - dt * 2);
  if (s.hitFlash > 0) s.hitFlash = Math.max(0, s.hitFlash - dt * 2);
  if (s.shieldFlash > 0) s.shieldFlash = Math.max(0, s.shieldFlash - dt * 2);
  if (s.shake > 0) s.shake = Math.max(0, s.shake - dt * 2.2);
  if (s.burstT > 0) s.burstT = Math.max(0, s.burstT - dt);
  if (s.thrustT) s.thrustT = Math.max(0, s.thrustT - dt);

  if (s.phase === "ready") return;

  if (s.phase === "over") {
    s.deadFor += dt;
    for (const r of s.rocks) {
      r.x += r.vx * dt * 0.25;
      r.y += r.vy * dt * 0.25;
    }
    return;
  }

  if (s.phase === "countdown") {
    s.phaseT += dt;
    if (s.manual) {
      // Direct input flies the empty field until GO.
      handHorizontal(s, dt);
      handVertical(s, dt);
    } else autopilot(s, dt);
    // the ore still drifts: a stream that was mid-screen is still there,
    // and the ship COLLECTS it (owner, 30 Sep 2026: "coins show up but
    // can't collect in between waves"): the same step the wave runs, so a
    // coin under the ship in the countdown pays like any other
    stepNuts(s, dt);
    const before = Math.ceil(SPILL.countdown - (s.phaseT - dt));
    const now = Math.ceil(SPILL.countdown - s.phaseT);
    if (now !== before && now > 0) cue(s, "count");
    if (s.phaseT >= SPILL.countdown) beginWave(s);
    return;
  }

  if (s.phase === "docking") {
    s.phaseT += dt;
    autopilot(s, dt);
    if (s.depotGag === undefined && s.phaseT >= spillDockTravelDuration(s))
      s.depotGag = s.depotGagReady === true;
    if (s.phaseT >= spillDockDuration(s)) openDepot(s);
    return;
  }

  if (s.phase === "depot") {
    const d = s.depot!;
    s.phaseT += dt;
    autopilot(s, dt);
    if (d.arm > 0) {
      d.arm = Math.max(0, d.arm - dt);
      if (d.arm === 0) cue(s, "armed");
    }
    return;
  }

  if (s.phase === "respawn") {
    s.phaseT += dt;
    if (s.phaseT >= SPILL.respawnFreeze) {
      // sweep the killzone: nothing may be waiting on the ship's lane
      for (const r of s.rocks) {
        const dx = r.x - s.pilot.x;
        const dy = r.y - s.pilot.y;
        if (dx * dx + dy * dy < 220 * 220) shatter(s, r, 0.8);
      }
      s.hull = s.maxHull;
      s.gold = SPILL.goldSeconds;
      s.pilot.vy = 0;
      s.pilot.y = s.H * 0.45;
      s.phase = s.respawnReturn === "drain" ? "drain" : "wave";
      s.phaseT = 0;
      say(s, "BACK IN THE FIELD", 1.4);
    }
    return;
  }

  // ---- flying: the wave and its drain; only the spawner differs
  s.t += dt;
  s.phaseT += dt;
  s.modRamp = Math.min(SPILL.modRamp, s.modRamp + dt);
  const climb = Math.min(1, (s.wave - 1) / (SPILL_AUTHORED_WAVES - 1));

  if (s.phase === "wave") {
    s.waveT += dt;
    // the surge is a wave's mid-act: six seconds of doubled spawns, called
    // before it lands so a pilot can find a lane first
    if (!spillClimaxReserved(s) && spillMod(s, "surge") && !s.surgeFired && s.waveT >= 8 && spillHazardPressure(s) === 0) {
      s.surgeFired = true;
      s.surgeT = 6;
      say(s, "SURGE", 1.8);
      cue(s, "surge");
    }
    if (s.waveT >= s.spec.dur) {
      s.phase = "drain";
      s.phaseT = 0;
    }
  } else if (s.phase === "drain") {
    const live = s.rocks.some((r) => !r.dead && r.x > -r.r)
      || s.combat.enemies.some(e => !e.dead) || s.combat.shots.some(shot => !shot.dead && shot.team === "enemy")
      || spillHazardPressure(s) > 0;
    if (!live || s.phaseT >= SPILL.drainCap) {
      endWave(s);
      return;
    }
  }
  if (s.surgeT > 0) s.surgeT = Math.max(0, s.surgeT - dt);

  // DRIFT: the field's tilt wanders toward a target it re-rolls every few
  // seconds, eased so the change is a lean rather than a lurch, and scaled
  // by the ramp so the wave opens level
  if (spillMod(s, "drift")) {
    s.tiltT -= dt;
    if (s.tiltT <= 0) {
      s.tiltT = 4 + rand(s) * 3;
      s.tiltTarget = (rand(s) * 2 - 1) * SPILL.driftMax;
    }
    const lim = SPILL.driftMax * (s.wave <= SPILL_AUTHORED_WAVES ? SPILL.driftTeach : 1);
    const want = Math.max(-lim, Math.min(lim, s.tiltTarget)) * ramp(s);
    const step = SPILL.driftRate * dt;
    s.tilt += Math.max(-step, Math.min(step, want - s.tilt));
  } else if (s.tilt !== 0) {
    const step = SPILL.driftRate * dt;
    s.tilt += Math.max(-step, Math.min(step, -s.tilt));
  }

  // ---- the ship
  admitSpillHazards(s, dt, (rock, ahead) => spillRockAt(s, rock, ahead));
  const combatMotion = captureSpillCombatMotion(s);
  if (s.iframes > 0) s.iframes = Math.max(0, s.iframes - dt);
  if (s.gold > 0) s.gold = Math.max(0, s.gold - dt);
  if (s.brakeCool > 0) s.brakeCool = Math.max(0, s.brakeCool - dt);
  if (s.pulseQueue > 0) {
    s.pulseQueue = Math.max(0, s.pulseQueue - dt);
    if (s.pulseQueue === 0) { s.echoReady = true; cue(s, "charged"); }
  }
  handHorizontal(s, dt);
  handVertical(s, dt);

  // Steering eases toward both boundaries. Edges never damage the ship or force it upward.
  s.floorT = 0;

  // ---- the spawn director
  if (s.phase === "wave") {
    stepEvent(s, dt);
    admitSpillClimax(s);
    if (!spillClimaxReserved(s)) admitSpillEnemies(s, dt);
    s.nextRock -= dt;
    const combatPressure = spillCombatPressure(s);
    const hazardPressure = spillHazardPressure(s);
    const cap = Math.max(2, s.spec.cap + (spillMod(s, "swarm") ? 2 : 0) + (surging(s) ? 2 : 0) - combatPressure * 2 - hazardPressure * 3);
    if (!spillClimaxReserved(s) && s.nextRock <= 0 && s.rocks.filter((r) => !r.dead).length < cap) {
      const base = s.spec.interval;
      // a wave that is teaching something opens easier than its number
      const teaching = s.hintT > 0 && s.wave > 1 ? 1.35 : 1;
      const act = s.waveT / s.spec.dur;
      const pacing = act < 0.2 ? 1.35 : act < 0.5 ? 1 : act < 0.78 ? 0.8 : 1.4;
      s.nextRock = Math.max(0.1, (surging(s) ? base * 0.45 : base) * teaching * pacing * (0.65 + rand(s) * 0.7)
        * (combatPressure || hazardPressure ? 1.5 : 1));
      for (let k = 0; k < 6; k++) if (spawnRock(s)) break;
    }
    s.nextNut -= dt;
    if (s.nextNut <= 0) {
      s.nextNut = 4.5 + rand(s) * 4;
      spawnStream(s);
    }
    s.nextSpecial -= dt;
    if (s.nextSpecial <= 0) {
      s.nextSpecial = 10 + rand(s) * 8;
      spawnSpecial(s);
    }
  }

  // ---- debris
  for (const rock of s.rocks) {
    const proposal = spillGravityBend(s, rock);
    if (!proposal) continue;
    rock.gravityWell = proposal.wellId;
    const candidate = { ...rock, gravityBend: proposal.bend };
    const withoutSelf = { ...s, rocks: s.rocks.filter(other => other !== rock) };
    if (spillPathClear(withoutSelf, candidate) && escapeClear(s, candidate)) rock.gravityBend = proposal.bend;
  }
  for (const r of s.rocks) {
    if (r.dead) continue;
    // a hulk waits offscreen while it warns. The frame the warning runs
    // out in still flies its remainder, so the piece lands exactly where
    // the spawn check said it would
    let move = dt;
    if (r.warn > 0) {
      const left = r.warn;
      r.warn = Math.max(0, r.warn - dt);
      if (r.warn > 0) continue;
      move = dt - left;
    }
    r.x += r.vx * move;
    r.y += r.vy * move + (r.arc ? Math.cos(r.arcPhase + s.t * ARC_RATE) * r.arc * move : 0);
    r.y += spillGravityBendDelta(r, s.t - move, s.t);
    r.rot += r.spin * move;
  }
  const hazardContacts: SpillHazardContact[] = [];
  stepSpillHazards(s, dt, combatMotion.pilot, { contacts: hazardContacts, damagePilot: () => takeHit(s, null, "STRUCK"),
    predictRock: (rock, ahead) => spillRockAt(s, rock, ahead) });
  if (!flying(s)) return;
  stepSpillCombat(s, dt, combatMotion, { shipRadius: SPILL.shipR, hazardContacts,
    shatter: rock => shatter(s, rock), damagePilot: () => takeHit(s, null, "STRUCK") });
  if (!flying(s)) return;
  const golden = s.gold > 0;
  for (const r of s.rocks) {
    if (r.dead || r.warn > 0) continue;
    const dx = r.x - s.pilot.x;
    const dy = r.y - s.pilot.y;
    const d2 = dx * dx + dy * dy;
    const kill = r.r + SPILL.shipR;
    if (d2 < kill * kill) {
      if (golden) { shatter(s, r, 1.1); continue; }
      if (s.iframes > 0) continue;
      takeHit(s, r);
      if (!flying(s)) return;
      continue;
    }
    // near miss: once per piece, once it is alongside or past. Points,
    // not charge - the meter is the charged coins fill it
    const graze = r.r + SPILL.grazeR;
    if (!r.grazed && r.x < s.pilot.x + r.r && d2 < graze * graze) {
      r.grazed = true;
      s.grazes += 1;
      s.score += 6;
      burst(s, s.pilot.x + 10, s.pilot.y, 3, "graze", 0.4);
      cue(s, "graze");
    }
  }
  s.rocks = s.rocks.filter((r) => !r.dead && r.x > -r.r - 60 && r.y > -r.r - 80 && r.y < s.H + r.r + 80);

  stepNuts(s, dt);

  // surviving is worth points on its own, so a cautious run still scores
  s.score += dt * 10 * (1 + climb);
}

// -------------------------------------------------------------- readouts

/** waves CLEARED: the number the record keeps */
export function spillCleared(s: SpillState) {
  return s.cleared;
}

/** seconds left in the wave's spawning window, for the HUD clock */
export function spillWaveLeft(s: SpillState) {
  if (s.phase !== "wave") return 0;
  return Math.max(0, s.spec.dur - s.waveT);
}

/** the countdown's whole seconds, 3..1, or 0 when it is not running */
export function spillCount(s: SpillState) {
  if (s.phase !== "countdown") return 0;
  return Math.max(0, Math.ceil(SPILL.countdown - s.phaseT));
}

/** the rule strength the HUD shows, 0..1 */
export function spillRamp(s: SpillState) {
  return ramp(s);
}

export type SpillCheckpoint = { version: 1; state: SpillState };

/** Only a docked, ordinary expedition may be suspended. The checkpoint
 *  carries its RNG and bank ledger, so resuming cannot reroll or repay it. */
export function spillCheckpoint(s: SpillState): SpillCheckpoint | null {
  if (s.phase !== "depot" || !s.depot || s.target || s.practice) return null;
  const state: SpillState = JSON.parse(JSON.stringify(s));
  clearSpillCombat(state);
  clearSpillHazards(state);
  delete state.depotGag; delete state.depotGagReady;
  state.rocks = []; state.nuts = []; state.bursts = []; state.cues = [];
  state.thrustT = 0; state.manual = false;
  state.steerY = 0; state.lunge = 0; state.lungeDir = 1;
  state.pilot.vx = 0; state.pilot.vy = 0;
  state.depot!.arm = SPILL.depotArm;
  return { version: 1, state };
}

export function restoreSpill(raw: unknown, W: number, H: number): SpillState | null {
  if (!raw || typeof raw !== "object" || (raw as SpillCheckpoint).version !== 1) return null;
  const value = (raw as SpillCheckpoint).state;
  if (!value || typeof value !== "object" || value.phase !== "depot" || !value.depot || value.target !== 0 || value.practice) return null;
  const s = createSpill(W, H, 0);
  // Copy only the known schema. Every numeric field must be finite. A
  // malformed save is ignored, never allowed to crash the launch screen.
  for (const key of Object.keys(s) as (keyof SpillState)[]) {
    if (typeof s[key] === "number") {
      const n = value[key];
      // New transient controls were absent from original version-1 checkpoints.
      // Validate them when present, but never restore a held direction or dodge.
      if (key === "steerY" || key === "lungeDir") {
        if (n !== undefined && (typeof n !== "number" || !Number.isFinite(n)
          || (key === "steerY" ? Math.abs(n) > 1 : n !== -1 && n !== 1))) return null;
        continue;
      }
      if (typeof n !== "number" || !Number.isFinite(n) || Math.abs(n) > 1e12) return null;
      (s as any)[key] = n;
    }
  }
  const combat = restoreSpillCombat(value.combat, s.seed, s.wave);
  if (!combat) return null;
  s.combat = combat;
  const hazards = restoreSpillHazards(value.hazards, s.seed);
  if (!hazards) return null;
  s.hazards = hazards;
  const loadout = restoreSpillLoadout(value.loadout);
  const expedition = restoreSpillExpedition(value.expedition, s.wave);
  const climax = restoreSpillClimax(value.climax);
  if (!loadout || !expedition || !climax) return null;
  s.loadout = loadout; s.expedition = expedition; s.climax = climax;
  s.welcome = value.welcome === true && s.wave === 0;
  s.freeUpgrade = s.welcome && value.freeUpgrade === true;
  if (!Number.isInteger(s.wave) || (!s.welcome && s.wave < 5) || s.wave % 5 || s.cleared !== s.wave || s.W <= 0 || s.H <= 0 || s.ore < 0) return null;
  if (!value.up || !value.banked || !value.specialties) return null;
  for (const axis of ["plating", "thrusters", "pulse"] as const) {
    const n = value.up[axis];
    if (!Number.isInteger(n) || n < 0 || n > SPILL_LEVELS) return null;
    s.up[axis] = n;
    const spec = value.specialties[axis];
    if (spec && (!SPILL_SPECIALTIES[spec] || SPILL_SPECIALTIES[spec].axis !== axis || n < 2)) return null;
    if (spec) s.specialties[axis] = spec;
  }
  for (const key of ["hull", "shield", "canopyLevel", "oreMined", "ore", "hits", "shards", "contractsDone", "depotVisits"] as const) {
    if (!Number.isInteger(s[key]) || s[key] < 0) return null;
  }
  if (s.maxHull !== SPILL.hull + s.up.plating + spillChassisStats(s.loadout.chassis).hull || s.hull < 1 || s.hull > s.maxHull || s.shield < 0 || s.shield > 2 || s.canopyLevel < s.shield || s.canopyLevel > 2) return null;
  if (s.welcome && (s.cleared !== 0 || s.depotVisits !== 0 || s.oreMined !== 0
      || s.up.plating + s.up.thrusters + s.up.pulse + s.shield !== (s.freeUpgrade ? 0 : 1))) return null;
  const utilityList = (v: unknown): v is SpillUtility[] => Array.isArray(v) && v.length <= 4 && new Set(v).size === v.length && v.every(id => SPILL_UTILITY_IDS.includes(id));
  if (!utilityList(value.utilities) || value.utilities.length > 2 || !utilityList(value.ownedUtilities) || value.utilities.some(id => !value.ownedUtilities.includes(id))) return null;
  s.utilities = value.utilities.slice(); s.ownedUtilities = value.ownedUtilities.slice();
  if (s.charge < 0 || s.charge > spillChargeCap(s)) return null;
  for (const key of ["coreArmed", "coreBought", "echoReady", "expeditionDone", "hints"] as const) {
    if (typeof value[key] !== "boolean") return null;
    s[key] = value[key];
  }
  if (s.coreArmed && !s.coreBought) return null;
  // Version-1 checkpoints predating the milestone card have no firstPass.
  s.firstPass = value.firstPass === true && s.wave === 20;
  if (!Array.isArray(value.taught) || value.taught.some(m => !SPILL_MODS.includes(m as SpillMod))) return null;
  s.taught = value.taught.slice();
  for (const key of ["ore", "contracts", "waves"] as const) {
    const n = value.banked[key];
    if (!Number.isFinite(n) || n < 0) return null;
    s.banked[key] = n;
  }
  if (s.banked.ore > s.oreMined || s.banked.contracts > s.contractsDone || s.banked.waves > s.cleared) return null;
  s.banked.expedition = value.banked.expedition === true;
  s.banked.run = value.banked.run === true;
  const c = value.contract;
  if (c) {
    const offer = spillContractOffers(s.wave).find(o => o.kind === c.kind);
    if (!offer || c.target !== offer.target || c.reward !== offer.reward || c.startWave !== s.wave + 1 || c.endWave !== s.wave + 5
      || c.startOre !== s.oreMined || c.startHits !== s.hits || c.startShards !== s.shards) return null;
    s.contract = { ...c };
  }
  s.contractMessage = typeof value.contractMessage === "string" ? value.contractMessage.slice(0, 100) : "";
  s.signal = typeof value.signal === "string" && /^#[a-f0-9]{6}$/i.test(value.signal) ? value.signal : "#c99bff";
  s.phase = "depot"; s.depot = { arm: SPILL.depotArm, bought: [] };
  s.spec = spillWaveSpec(Math.max(1, s.wave), s.seed); s.event = spillEventFor(Math.max(1, s.wave), s.seed);
  s.liveMods = s.spec.mods.slice();
  s.pilot = { x: s.W * SPILL.homeX, y: s.H * 0.45, vx: 0, vy: 0, rot: 0 };
  s.phaseT = 0; s.floorT = 0; s.eventWarn = 0;
  s.steerY = 0; s.lunge = 0; s.lungeDir = 1;
  resizeSpill(s, W, H);
  return s;
}
