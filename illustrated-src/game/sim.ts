import { createVanguardMotion, stepVanguard, vanguardTap, vanguardDive, vanguardContact, vanguardGate, type VanguardMotion } from "./vanguard";
import { PAINTED_TAP_SUITS, TAP_REPEAT, type TapRepeat } from "./control-constants";
export type { TapRepeat };

/** WHAT A REPEAT TAP DOES to a tap animation still playing. Three answers:
 *    "rewind"  the picture reverses from where it is, bounces off the start
 *              and plays out again. Every tap moves the body that frame.
 *    "finish"  the gesture finishes untouched, then replays once; taps in
 *              between collapse into that one replay (PR #277's queue).
 *    "restart" the gesture starts over from its first frame, every tap.
 *  Live: the frozen roster rewinds (it is not in PAINTED_TAP_SUITS), the
 *  rest finish. Beta: the per-suit pause dial (save.tapRepeat) wins, then
 *  the older whole-roster switch (save.tapRewind). Owner, 12 Sep 2026:
 *  "give me a toggle in pause menu in beta only, so i can decide which
 *  ones get the treatment." A live build never reads either dial. */
/** the premium trio's whole-frame playback takes the same repeat answer as
 *  the painted banks (owner, 12 Sep 2026: Patriot "is finishing its cycle
 *  before it starts animation. it's not a restart on tap. that's the issue") */
function premiumRepeat(w: World, save: SaveData): TapRepeat {
  return repeatTapMode(pilotSuitId(w, save), save);
}
export function repeatTapMode(id: string, save: SaveData): TapRepeat {
  if (IS_BETA) {
    const dialled = save.tapRepeat?.[id];
    if (dialled) return dialled;
    if (save.tapRewind && PAINTED_TAP_SUITS.has(id)) return "rewind";
  }
  return TAP_REPEAT[id] ?? (PAINTED_TAP_SUITS.has(id) ? "finish" : "rewind");
}
export function repeatTapQueues(id: string, save: SaveData): boolean {
  return repeatTapMode(id, save) === "finish";
}
import { createArcflashMotion, stepArcflash, arcflashTap, arcflashDive, arcflashContact, type ArcflashMotion } from "./arcflash-motion";
import { createHighOrbitMotion, createPremiumWake, stepPremiumWake, stepHighOrbit, highOrbitTap, type HighOrbitMotion } from "./high-orbit-motion";
import { isHighOrbit, isPremiumSuit, highOrbitTrailSuit } from "./high-orbit-config";
import { trailWornBy, STAR_CHART_TRAILS } from "./catalog";
import { missionRandom } from "./mission-rng";
import { recordZoneVisit, routeMasks, settleMissionCredit, earnedCampaignStars, migrateCampaign, barrierId } from "./campaign-progress";
import { CHART_LEVELS, reachedGate } from "./campaign";
import {TUNNEL_LEAD_NODES, TUNNEL_LEAD_BLEND, BOUNCE_ANIM_DURATION, LEGACY_DEBRIS_COUNT, ENVS, ENV_GATES, IS_BETA, RETRO_GATE, TAIL, WARP_GATES, TAP_ANIM_DURATION, TUT_READ, skyIdFor, PHYS, TRAILS } from "./catalog";
import { nextFamilyPlanet, type PlanetBag } from "./planet-family";
import { modsUnlocked, batteryUnlocked, writeSave, tailSpringFor, type SaveData, grantTutorialKit, equippedPals} from "./save";
import { platform } from "./platform";
import { TUTORIAL_SUIT } from "./catalog";
import { emptyStats, goalMet, goldGatesFor, type LevelDef, type LevelFx, type RunStats, gateClearedBy} from "./campaign";
import {
  createRaceState,
  RACE_DT,
  queueRaceInput,
  raceDecisionAge,
  stepRace,
  type RaceCue,
  type RaceState,
} from "./race";
import { raceViewport, raceViewportY } from "./race-viewport";
import {
  createSpill,
  resizeSpill,
  spillBurst,
  spillCleared,
  spillTap,
  stepSpill,
  type SpillCue,
  type SpillState,
} from "./spill";
import { SPILL_UTILITIES, spillEngineColor } from "./spill-content";
import {
  WORMHOLE_MAX_VY,
  WORMHOLE_FLAP,
  WORMHOLE_GRAVITY,
  WORMHOLE_SPEED_BASE,
  WORMHOLE_SPEED_RAMP,
  WORMHOLE_WIDTH,
  WORMHOLE_TURN,
  WORMHOLE_DEBRIS_SPACING,
  WORM_EVERY_GATES,
  WORM_CALM_SECONDS,
  WORM_CALM_SPEED,
  WORM_EXIT_LEAD,
  WORM_EXIT_GRACE,
} from "./control-constants";

export type Screen = "splash" | "title" | "hangar" | "log" | "profile" | "help" | "shop" | "scores" | "play" | "dead" | "pause" | "lvldone";
export type FlightMode = "fly" | "deep" | "lost" | "arcade" | "tunnel" | "spill";
/** THE FIRST FLIGHT, BEAT BY BEAT.
 *
 *  The lesson is in two halves and the split is the whole design.
 *
 *  In the SCRIPTED half the pilot's input is a GESTURE RECOGNISED, never a
 *  force applied. The indicator appears, the director waits - for as long as
 *  it takes, there is no window - and when the gesture arrives the director
 *  runs the beat on the game's own physics. A second tap does nothing.
 *
 *  That is what makes this teachable. Every previous version taught with
 *  live control: it armed a window, the pilot tapped, physics applied, and
 *  a beginner a beat early learned that the game does not respond rather
 *  than that they were early. There is no window here to miss.
 *
 *  In the LIVE half control is handed over for the first time, and the
 *  three gates that follow are the pass mark: they must be flown clean and
 *  CONSECUTIVELY. Protection means the pilot does not die, not that they
 *  advance - a contact rewinds to the first of the three. Without that a
 *  player could bump through every gate on protection and reach the portal
 *  having never actually flown one. The seven gates after the pal are
 *  ordinary practice: protected, forgiving, no rewind.
 */
export type TutStage =
  // --- scripted: the pilot watches, and answers with a gesture -----------
  | "intro"        // the world holds; the lesson is about to open
  | "learnTap"     // popup: this is how you fly
  | "doTap1"       // indicator up, waiting for the first tap
  | "levelOff"     // the arc is flying; waiting for the body to come level
  | "learnTap2"    // frozen: try it again
  | "doTap2"       // indicator up, waiting for the second tap
  | "learnDive"    // at the apex: sometimes you need down, fast
  | "doDive"       // swipe indicator up, waiting for the swipe
  | "diving"       // the dive is flying, toward the staged planet
  | "boing"        // frozen on contact: planets are bouncy
  | "bouncing"     // the bounce flies, and pauses at the top
  | "handover"     // frozen: now you are in control
  // --- live: the pilot flies ---------------------------------------------
  | "gates3"       // three in a row, or back to the first of them
  | "pal"          // frozen: meet the companion and the magnet
  | "gates7"       // practice with the pal, protected, no rewind
  | "portal"       // the finish is out there
  | "done"         // frozen: congratulations, go to the Loadout
  | "free";        // the lesson is over and this is an ordinary flight

export type PlanetCol = {
  x: number;
  gapY: number;
  gap: number;
  r: number;
  topKind: number;
  botKind: number;
  scored: boolean;
  /** A LONE TEACHING PLANET, not a gate. The tutorial's bounce lesson wants
   *  one rock to land on, so it opens the mouth wide enough to carry the
   *  top half off the screen - and the on-screen nudge in gateOffset, which
   *  exists to stop exactly that, then shoves the whole thing back down.
   *  Solo planets are placed deliberately and keep the position they were
   *  given. */
  solo?: boolean;
  /** SPACE PUPPY ONLY (owner, 7 Sep 2026: "one planet per gate, but
   *  random"): the bounce house keeps just this half of the gate. Unset
   *  everywhere else, and every other run still spawns both. */
  half?: "top" | "bot";
  drift: number;
  driftAmp: number;
  blockers: { y: number; r: number; kind: number; xOff: number; debris: number;
              amp: number; rate: number; phase: number }[];
};

export type PickupKind =
  | "acorn" | "slow" | "gold" | "shield" | "hole" | "worm" | "retro" | "portal" | "multiplier";

export type Pickup = {
  x: number;
  y: number;
  got: boolean;
  bob: number;
  kind: PickupKind;
  pulled?: boolean;
  // Hazards carry their own reach. A black hole or wormhole spans the
  // whole gate mouth, so meeting one is a matter of arriving — not of
  // threading past it. Only the pal that suppresses them lets you through.
  r?: number;
  // The hole that closes a warp stretch rather than opening one. It is the
  // one hazard you are meant to fly into while already warped.
  exit?: boolean;
  tunnelSection?: number;
  tunnelPattern?: TunnelPattern;
  missed?: boolean;
};

export type TunnelPattern =
  | "launch"
  | "ribbon"
  | "acornArc"
  | "sweep"
  | "breather"
  | "squeeze"
  | "ripples"
  | "debrisWeave"
  | "surge";

export const TUNNEL_PATTERNS: TunnelPattern[] = [
  "launch", "ribbon", "acornArc", "sweep", "breather",
  "squeeze", "ripples", "debrisWeave", "surge",
];

export const TUNNEL_PATTERN_NAMES: Record<TunnelPattern, string> = {
  launch: "ENTRY VECTOR",
  ribbon: "RIBBON SLITHER",
  acornArc: "ACORN CURRENT",
  sweep: "GRAVITY SWEEP",
  breather: "STABLE FLOW",
  squeeze: "PULSE SQUEEZE",
  ripples: "RIPPLE RUN",
  debrisWeave: "DEBRIS WEAVE",
  surge: "WORMHOLE SURGE",
};

export const TUNNEL_REGION_NAMES = [
  "VIOLET FOLD",
  "ION CURRENT",
  "EMBER RIFT",
  "EMERALD SLIP",
  "EVENT HORIZON",
] as const;

export type TunnelNode = {
  x: number;
  top: number;
  bottom: number;
  centerRatio: number;
  halfRatio: number;
  index: number;
  section: number;
  pattern: TunnelPattern;
  region: number;
  sectionStart: boolean;
  sectionEnd: boolean;
  announced: boolean;
  cleared: boolean;
};

export type TunnelHazard = {
  x: number;
  y: number;
  r: number;
  side: -1 | 0 | 1;
  kind: "debris";
  art: number;
  spin: number;
  nearMissed: boolean;
  warned: boolean;
  section: number;
  pattern: TunnelPattern;
};

export type TunnelState = {
  nodes: TunnelNode[];
  /** how many opening nodes are held open, straight and empty */
  leadNodes: number;
  hazards: TunnelHazard[];
  scoreFloat: number;
  /** true when this corridor is a DETOUR out of a gate run rather than a
   *  Wormhole Run of its own. A detour scores nothing and runs no flow. */
  detour: boolean;
  multiplier: number;
  bestMultiplier: number;
  multiplierLeft: number;
  flow: number;
  flowBest: number;
  flowGrace: number;
  chain: number;
  bestChain: number;
  sectionsCleared: number;
  /** seconds survived this run — the mission finish line is TIME now */
  time: number;
  nearMisses: number;
  nextHazardAt: number;
  nextPickupAt: number;
  seed: number;
  buildSection: number;
  buildPattern: TunnelPattern;
  buildRegion: number;
  patternPos: number;
  patternLength: number;
  patternStartCenter: number;
  patternStartHalf: number;
  patternStartCenterRatio: number;
  patternStartHalfRatio: number;
  patternDirection: -1 | 1;
  activePattern: TunnelPattern;
  activeRegion: number;
  previousRegion: number;
  regionBlend: number;
  visualT: number;
  banner: string;
  bannerKind: "pattern" | "region" | "reward" | "milestone";
  bannerLeft: number;
  nextMilestone: number;
};

export type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  r: number;
  color: string;
  kind?: string;
  hue?: number;
  spin?: number;
  seed?: number;
};

export type Snapshot = {
  screen: Screen;
  score: number;
  runAcorns: number;
  envName: string;
  flight: FlightMode;
  powerLeft: number;
  invulnLeft: number;
  shieldCharges: number;
  scoreMultiplier: number;
  multiplierLeft: number;
  recoveryMsg: string;
  tutStage: TutStage | null;
  tutHold: boolean;
  tutNudge: string;
  dead: {
    score: number;
    acorns: number;
    best: boolean;
    flowBest: number;
    bestChain: number;
    sections: number;
    nearMisses: number;
    bestMultiplier: number;
    taps: number;
    bounces: number;
    holes: number;
  } | null;
  squirrel: { y: number; rot: number; vy: number };
};

export type World = {
  W: number;
  H: number;
  screen: Screen;
  flight: FlightMode;
  ready: boolean;
  score: number;
  runAcorns: number;
  /** the crash sheet's receipts: every accepted flap, planet bounce, and
   *  black hole flown this run */
  run: { taps: number; bounces: number; holes: number };
  squirrel: { y: number; vy: number; rot: number };
  planets: PlanetCol[];
  pickups: Pickup[];
  particles: Particle[];
  tunnel: TunnelState | null;
  race: RaceState | null;
  /** Bounded fixed-step cue history for presentation; never race authority. */
  raceCues: RaceCue[];
  /** One fixed step of deterministic race cues awaiting engine side effects. */
  raceCueEffects: RaceCue[];
  /** THE SPILL. Its own authority, like the race: the world's squirrel is a
   *  mirror of its pilot so the shared painter draws the equipped suit. */
  spill: SpillState | null;
  /** the frame's Spill cues, awaiting the engine's sound and re-render */
  spillCues: SpillCue[];
  stars: { x: number; y: number; r: number; a: number; tw: number }[];
  speed: number;
  distance: number;
  lastSpawnX: number;
  lastGapY: number;
  powerLeft: number;
  invulnLeft: number;
  flapBoost: number;
  /** elapsed rendering time for the one-shot articulated tap burst; -1 idle */
  tapAnimT: number;
  /** Vanguard-only visual clock and contact plumes. No gameplay authority. */
  vanguard: VanguardMotion;
  /** Arcflash-only joints and inertial tail. No gameplay authority. */
  arcflash: ArcflashMotion;
  highOrbit: HighOrbitMotion;
  /** queued slow-recovery time from taps received before the burst settles */
  /** playback direction: 1 forward; -1 after a repeat tap, rewinding to
   *  the start before playing through to the end again */
  tapAnimDir: number;
  /** Painted banks finish the current gesture before one coalesced replay. */
  tapAnimQueued: boolean;
  /** THE FLIGHT TEST (beta Test Lab): the run flies itself. null on every
   *  other run. See beginFlightTest / stepFlightTest. */
  flightTest: FlightTest | null;
  /** the Flight Test transport's world-clock multiplier (1, 1/2, 1/4, or 0
   *  for a hold); the engine loop scales its fixed-step accumulator by it.
   *  1 on every other run. */
  timeScale: number;
  /** the tap accent's body reaction spring (draw reads it, beta dial): 0 at rest, kicked per tap */
  tapReact: number;
  tapReactV: number;
  /** displayed pitch at burst entry, used to ease the otherwise instant snap */
  tapAnimFromRot: number;
  /** elapsed rendering time for the planet-contact response; -1 idle */
  bounceAnimT: number;
  /** screen-space rebound normal: -1 up, 1 down */
  bounceAnimDir: number;
  /** normalized visual amplitude captured from incoming vertical speed */
  bounceAnimStrength: number;
  /** where the gate run was left when a wormhole took the pilot */
  wormHold: WormHold | null;
  /** seconds left in the corridor */
  wormLeft: number;
  /** seconds of calibration left at a wormhole mouth. Both mouths are slow:
   *  the corridor is entered at a crawl so the walls can be read, and the
   *  gate run is handed back the same way. */
  wormCalm: number;
  /** the gate the NEXT wormhole is scheduled for. Counted in gates SPAWNED,
   *  which is the same ladder the pilot climbs - see spawnGate. */
  wormNextGate: number;
  /** gates built so far this run, the clock the schedule runs on */
  gatesSpawned: number;
  /** the exit door has been put in the corridor */
  wormExitArmed: boolean;
  /** how many zones the pilot has been carried past by wormholes. A trip
   *  is supposed to MOVE you: coming back out into the sky you left is the
   *  whole reason the detour read as pointless. */
  zoneJump: number;
  hitCooldown: number;
  trailT: number;
  bounceUp: boolean;
  scrollDirection: number;
  scrollReversing?: boolean;
  scrollTravel: number;
  tapFrozen: boolean;
  stuck: boolean;
  /** THE FLIGHT LAB (owner, 7 Sep 2026; beta, free flight only): the same
   *  modifiers a mission can carry, dialled from the pause sheet so a
   *  mechanic can be felt before it is written into a contract. Empty on
   *  every other run, so nothing here can touch a mission or production. */
  lab: LabFx;
  /** MAGNETAR (owner, 7 Sep 2026): the companion turns the world over; fixed at run start */
  palFlip: boolean;
  /** the equipped companion's level-style modifiers (PAL_FX), fixed at run start */
  palFx: LabFx | null;
  /** SAFE AREA (8 Sep 2026): the notch or status bar height in CSS px,
   *  read from the page at resize; the HUD's top row keeps clear of it */
  insetTop: number;
  /** SPACE PUPPY (owner, 7 Sep 2026): the run is a bounce house - no debris,
   *  no pickups, no gate count, giant planets, a floor that bounces */
  bounceHouse: boolean;
  /** TurClock: the live scroll multiplier, and the wandering clock driving it */
  clockMul: number;
  clockPhase: number;
  clockRate: number;
  /** Prismwing: degrees of hue rotation on the procedural sky, set on bounce */
  prismHue: number;
  /** Nightglider: seconds since the last tap lit the way */
  lampT: number;
  shieldCharges: number;
  absorbGrace: number;
  shieldFreeze: number;
  shieldSlow: number;
  startShieldArmed: boolean;
  deadTimer: number;
  time: number;
  envOrder: number[];
  envA: number;
  envB: number;
  envBlend: number;
  envMsgT: number;
  driftPhase: number;
  driftFactor: number;
  tiltPhase: number;
  warpT: number;
  warpLeft: number;
  // Free Flight's black hole runs on GATES, not seconds: the stretch is a
  // measured distance you fly out of, ending at a hole you can see coming.
  // -1 when no gate-counted warp is running.
  warpGateEnd: number;
  warpExitSpawned: boolean;
  warpTilt: number;
  warpMirror: boolean;
  prevTilt: number;
  prevMirror: boolean;
  deepTimer: number;
  warpKind: "hole" | "worm" | "shift" | "timeline" | null;
  // Arcade only: which of the two games you are currently flying in.
  // The simulation is identical either way — this switches the hand that
  // paints it, so a shift is a change of timeline, not of rules.
  retro: boolean;
  retroShifts: number;
  retroPending: boolean;
  // The tail is its own hinged piece on suits that ship one. It is not
  // keyframed — it hangs on a spring, so a tap kicks it and it swings,
  // overshoots, comes back past home and settles on its own. That is
  // where the weight comes from; a two-state flip would just snap.
  tailA: number;
  tailV: number;
  recoveryMsg: string;
  /** a HOLD TO CONTINUE / ad continue happened this run: the crash that
   *  follows is the same run ending, not a second flight (audit, 30 Sep 2026) */
  continued: boolean;
  palPos: { x: number; y: number; dart: number };
  /** the low slot's companion (owner, 7 Sep 2026: "one flys high one flys low") */
  palPos2: { x: number; y: number; dart: number };
  shake: number;
  pausedFrom: Screen | null;
  missionRng?: () => number;
  planetRng?: () => number;
  planetBag?: PlanetBag;
  // A CAMPAIGN LEVEL run. null on every endless run — nothing below may
  // change how an endless run plays. `stats` counts what the level's three
  // goals are judged on; `portal` flips once the finish spawns.
  lvl: {
    def: LevelDef;
    stats: RunStats;
    portal: boolean;
    barrierAfter?: number;
    /** gate ordinals that MUST carry a golden acorn (see goldGatesFor) */
    goldGates: number[];
    /** how many gates this level has spawned so far */
    spawnOrd: number;
  } | null;
  // the result sheet's payload — survives the world being reset
  lastLevel: {
    def: LevelDef;
    finished: boolean;
    met: [boolean, boolean, boolean];
    newMask: number;    // stars owned on this level after the run
    gained: number;     // stars newly earned by this run
    totalBefore: number;
    totalAfter: number;
    stats: RunStats;
    raceRecord?: {
      finishTicks: number;
      acorns: number;
      bestFinishTicks: number;
      bestAcorns: number;
      newBestTime: boolean;
      newBestAcorns: boolean;
      /** set when this run opened a debris field, so the receipt can say so */
      clearedGate?: { after: number; label: string } | null;
    };
  } | null;
  /** the first flight is flown in the tutorial suit; set for the whole run,
   *  crash sheet included, so the pilot is one character start to finish */
  tutSuit: boolean;
  tut: {
    stage: TutStage;
    hold: boolean;
    t: number;
    gates: number;
    gateBase: number;
    nudge: string;
    retries: number;
    springs: number;
    /** the teaching launch has been fired - see the bounce stage */
    launched: boolean;
    /** the height the course was built around - see buildTutorialCourse */
    apexY: number;
    bounced: boolean;
    /** THE INPUT LOCK. True for every scripted beat: a tap or a swipe is
     *  read as a GESTURE and consumed by the director, never applied to the
     *  flight. Cleared once at the handover, and never set again. */
    locked: boolean;
    /** the gesture this beat is waiting for, or null while none is wanted.
     *  Drives the on-screen indicator as well as the recogniser, so what is
     *  drawn and what is accepted can never disagree. */
    want: "tap" | "swipe" | "continue" | null;
    /** clean gates in a row inside gates3. A contact sends this to 0 and
     *  the pilot back to the first of the three - protection stops the
     *  death, it does not buy the gate. */
    streak: number;
    /** where the three-gate stretch begins, so a rewind has somewhere to
     *  put the pilot back to */
    streakX: number;
    /** how many times the three had to be restarted; for the coach's line,
     *  and so a struggling pilot can be told something different */
    restarts: number;
  } | null;
  lastRun: Snapshot["dead"];
};

export function makeWorld(W: number, H: number): World {
  return {
    W,
    H,
    screen: "splash",
    flight: "fly",
    ready: false,
    score: 0,
    runAcorns: 0,
    run: { taps: 0, bounces: 0, holes: 0 },
    squirrel: { y: H * 0.45, vy: 0, rot: 0 },
    planets: [],
    pickups: [],
    particles: [],
    tunnel: null,
    race: null,
    raceCues: [],
    raceCueEffects: [],
    spill: null,
    spillCues: [],
    stars: [],
    speed: PHYS.baseSpeed,
    distance: 0,
    lastSpawnX: 0,
    lastGapY: H * 0.45,
    powerLeft: 0,
    invulnLeft: 0,
    flapBoost: 0,
    tapAnimT: -1,
    vanguard: createVanguardMotion(),
    arcflash: createArcflashMotion(),
    highOrbit: createHighOrbitMotion(),
    tapAnimDir: 1,
    tapAnimQueued: false,
    flightTest: null,
    timeScale: 1,
    tapReact: 0,
    tapReactV: 0,
    tapAnimFromRot: 0,
    bounceAnimT: -1,
    bounceAnimDir: 0,
    bounceAnimStrength: 0,
    wormHold: null,
    wormLeft: 0,
    wormCalm: 0,
    wormNextGate: WORM_EVERY_GATES,
    gatesSpawned: 0,
    wormExitArmed: false,
    zoneJump: 0,
    hitCooldown: 0,
    trailT: 0,
    bounceUp: false, scrollDirection: -1, scrollTravel: 0, tapFrozen: false, stuck: false, lab: {}, palFlip: false, palFx: null, insetTop: 0, bounceHouse: false,
    clockMul: 1,
    clockPhase: 0,
    clockRate: 0.5,
    prismHue: 0,
    lampT: 9,
    shieldCharges: 0,
    absorbGrace: 0,
    shieldFreeze: 0,
    shieldSlow: 0,
    startShieldArmed: false,
    deadTimer: 0,
    time: 0,
    envOrder: ENVS.map((_, i) => i),
    envA: 0,
    envB: 0,
    envBlend: 1,
    envMsgT: 0,
    driftPhase: 0,
    driftFactor: 1,
    tiltPhase: 0,
    warpT: 0,
    warpLeft: 0,
    warpGateEnd: -1,
    warpExitSpawned: false,
    warpTilt: 0,
    warpMirror: true,
    prevTilt: 0,
    prevMirror: false,
    deepTimer: 0,
    warpKind: null,
    retro: false,
    retroShifts: 0,
    retroPending: false,
    tailA: 0,
    tailV: 0,
    recoveryMsg: "",
    continued: false,
    palPos: { x: 0, y: 0, dart: 0 },
    palPos2: { x: 0, y: 0, dart: 0 },
    shake: 0,
    pausedFrom: null,
    tutSuit: false,
    tut: null,
    lastRun: null,
    lvl: null,
    lastLevel: null,
  };
}

export function initStars(w: World) {
  w.stars = Array.from({ length: 80 }, () => ({
    x: Math.random() * w.W,
    y: Math.random() * w.H,
    r: Math.random() * 1.5 + 0.3,
    a: Math.random() * 0.7 + 0.2,
    tw: Math.random() * Math.PI * 2,
  }));
}

/**
 * Resize a live world without making a tunnel run jump lanes or silently
 * move its next obstacle closer to the pilot. The normal modes keep their
 * historic resize behaviour; Wormhole additionally remaps its authored
 * track around the fixed player anchor.
 */
export function resizeWorld(w: World, W: number, H: number) {
  const oldW = w.W;
  const oldH = w.H;
  if (!Number.isFinite(W) || !Number.isFinite(H) || W <= 0 || H <= 0) return;
  if (w.flight === "tunnel" && w.tunnel && oldW > 0 && oldH > 0 && (oldW !== W || oldH !== H)) {
    const scaleY = H / oldH;
    const shiftX = W * PHYS.squirrelX - oldW * PHYS.squirrelX;
    // the SAME clamp the track builder uses (tunnelMinHalf / tunnelMaxHalf,
    // WORMHOLE_WIDTH included). This was an inline copy without the width
    // factor, so a resize round-trip narrowed the corridor from 172.5 to
    // 150 at 640px; test-tunnel's resize check is what caught it.
    const minHalf = tunnelMinHalf(H);
    const maxHalf = tunnelMaxHalf(H);
    w.tunnel.patternStartCenter = Math.max(
      minHalf + 18,
      Math.min(H - minHalf - 18, w.tunnel.patternStartCenterRatio * H),
    );
    w.tunnel.patternStartHalf = Math.max(
      minHalf,
      Math.min(maxHalf, w.tunnel.patternStartHalfRatio * H),
    );
    for (const n of w.tunnel.nodes) {
      let center = n.centerRatio * H;
      const half = Math.max(minHalf, Math.min(maxHalf, n.halfRatio * H));
      center = Math.max(half + 18, Math.min(H - half - 18, center));
      n.x += shiftX;
      n.top = center - half;
      n.bottom = center + half;
    }
    for (const hazard of w.tunnel.hazards) {
      hazard.x += shiftX;
      hazard.y *= scaleY;
    }
    for (const pickup of w.pickups) {
      pickup.x += shiftX;
      pickup.y *= scaleY;
    }
    for (const particle of w.particles) {
      particle.x += shiftX;
      particle.y *= scaleY;
    }
    const resizedBounds = tunnelBoundsAt(w, W * PHYS.squirrelX);
    w.squirrel.y = Math.max(
      resizedBounds.top + PHYS.squirrelR + 2,
      Math.min(resizedBounds.bottom - PHYS.squirrelR - 2, w.squirrel.y * scaleY),
    );
    w.palPos.x += shiftX;
    w.palPos.y *= scaleY;
    w.palPos2.x += shiftX;
    w.palPos2.y *= scaleY;
    w.lastGapY *= scaleY;
  }
  // every planet mode — anything that is not the tunnel, which remapped
  // itself above, and not a race, which owns its own viewport
  const remapPlanets =
    w.flight !== "tunnel" && !w.tut && !w.race && !w.spill &&
    oldW > 0 && oldH > 0 && (oldW !== W || oldH !== H);
  w.W = W;
  w.H = H;
  // Rotating mid-run used to leave every planet mode in its OLD
  // coordinates: a run spawned portrait kept gates laid out for an
  // 844px-tall field, so a landscape window showed scattered planets,
  // no debris, and gaps it could not reach (audit finding S3). The
  // whole live world now remaps into the new field — gate centres
  // scale and re-clamp, debris seals rebuild for the new bands, and
  // the pilot keeps their relative altitude. The scripted tutorial is
  // exempt: its beats are authored for the field they started in.
  if (remapPlanets) {
    const scaleY = H / oldH;
    const shiftX = W * PHYS.squirrelX - oldW * PHYS.squirrelX;
    const margin = 72;
    const env = ENVS[w.envB];
    for (const p of w.planets) {
      p.x += shiftX;
      p.gapY = Math.max(margin + p.gap / 2, Math.min(H - margin - p.gap / 2, p.gapY * scaleY));
      p.blockers = sealBlockers(w, env, p.gapY, p.gap);
    }
    for (const a of w.pickups) {
      a.x += shiftX;
      a.y = Math.max(16, Math.min(H - 16, a.y * scaleY));
    }
    for (const pt of w.particles) {
      pt.x += shiftX;
      pt.y *= scaleY;
    }
    w.squirrel.y = Math.max(20, Math.min(H - 20, w.squirrel.y * scaleY));
    w.palPos.x += shiftX;
    w.palPos.y *= scaleY;
    w.palPos2.x += shiftX;
    w.palPos2.y *= scaleY;
    w.lastGapY = Math.max(margin + 84, Math.min(H - margin - 84, w.lastGapY * scaleY));
    // keep the spawner's look-ahead anchored to the new right edge
    w.lastSpawnX += W - oldW;
  }
  if (w.race) {
    const viewport = raceViewport(W, H);
    w.squirrel.y = raceViewportY(viewport, w.race.y);
    w.squirrel.vy = w.race.vy * viewport.scale;
  }
  if (w.spill) {
    resizeSpill(w.spill, W, H);
    w.squirrel.y = w.spill.pilot.y;
  }
}

/** where the pilot is drawn. Every mode but the Spill pins it to one lane;
 *  the Spill's lunge moves it, so the trail and the rings follow */
export function pilotX(w: World) {
  return w.spill ? w.spill.pilot.x : w.W * PHYS.squirrelX;
}

function shuffleEnv(w: World) {
  const mid = ENVS.map((_, i) => i).slice(1, -1);
  for (let i = mid.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [mid[i], mid[j]] = [mid[j], mid[i]];
  }
  w.envOrder = [0, ...mid, ENVS.length - 1];
}

export function envIndexFor(w: World, score: number) {
  // a level is ten-to-thirty gates under ONE sky — the stage's identity —
  // so the zone ladder does not apply inside one
  if (w.lvl && w.lvl.def.fx.env !== undefined) return w.lvl.def.fx.env;
  const step = Math.floor(score / ENV_GATES);
  // A run that has never met a wormhole climbs the ladder and stops at the
  // last zone, exactly as it always did - zoneJump is 0 and this is the
  // same expression it was. A run that HAS been thrown across space wraps
  // instead of pinning, because a pilot who keeps taking wormholes should
  // keep arriving somewhere, not run out of sky.
  if (w.zoneJump > 0) return w.envOrder[(step + w.zoneJump) % ENVS.length];
  return w.envOrder[Math.min(step, ENVS.length - 1)];
}

export type LabFx = LevelFx & {
  /** 0..1 chance a planet contact sticks (a mission's `sticky: true` is 1) */
  stickChance?: number;
  /** multiplies the distance between gates */
  spacing?: number;
  /** the crash sheet's continue costs nothing */
  freeRevive?: boolean;
};
/** The modifiers this run flies under: the mission's, or the lab's on a
 *  beta free flight. One question, so the two can never disagree. */
export function fxOf(w: World): LabFx {
  const base = w.lvl ? w.lvl.def.fx : w.lab;
  return w.palFx ? mergeFx(base, w.palFx) : base;
}

/** THE COMPANIONS THAT ARE LEVEL DIALS (owner, 7 Sep 2026). Magnetar,
 *  Baby Alien, Satellite and AstraFox each do something a mission's fx
 *  already can - flip the world, shrink the gates, close the fog, wind the
 *  sway - so they are written AS fx and folded into fxOf. A pal effect and
 *  a mission dial are then the same lever read at the same place, and a
 *  new companion of this kind is one row here, not a fifth `if`. */
const PAL_FX: Record<string, LabFx> = {
  magnetar: { upsideDown: true },
  babyalien: { gapScale: 0.6 },
  satellite: { fog: 1 },
  astrafox: { driftRate: 2.5, driftScale: 2.5, spacing: 0.85, pace: 1.2 },
};
/** the run's fx with a companion's on top: multipliers multiply, fog takes
 *  the thicker, the flip is an OR - so a mission's dial and the pal's stack
 *  rather than one silently replacing the other */
function mergeFx(base: LabFx, pal: LabFx): LabFx {
  const out: LabFx = { ...base };
  if (pal.upsideDown) out.upsideDown = true;
  if (pal.fog !== undefined) out.fog = Math.max(base.fog ?? 0, pal.fog);
  for (const k of ["pace", "gapScale", "driftScale", "driftRate", "spacing"] as const) {
    if (pal[k] !== undefined) out[k] = (base[k] ?? 1) * pal[k]!;
  }
  return out;
}
/** the world is drawn upside down: a mission's or the lab's fx, or Magnetar */
export function worldFlipped(w: World): boolean {
  return !!fxOf(w).upsideDown || w.palFlip;
}
/** EVERY COMPANION FLYING THIS RUN, high slot first - the list the painter
 *  and the HUD read. A mission's pal flies alone; otherwise both hangar
 *  slots (owner, 7 Sep 2026: two pals, "one flys high one flys low"). */
export function runPals(save: SaveData, w: World): string[] {
  // THE STAR CHART NEVER ADOPTS THE LOADOUT (owner, 8 Sep 2026: "no pal in
  // the star chart means no pal... it must run with active effects of
  // designated pal"). A mission flies its own pal or nobody.
  if (w.lvl) return w.lvl.def.fx.pal ? [w.lvl.def.fx.pal] : [];
  return equippedPals(save);
}
/** the high-slot companion this run flies; the harness reads it */
export function runPal(save: SaveData, w: World) {
  return runPals(save, w)[0] ?? "none";
}
/** the companions whose EFFECTS are live this run */
function palIds(save: SaveData, w: World): string[] {
  // a mission's pal is LIVE whatever the Pal Effects switch says - the
  // switch is a loadout comfort, and a star certifies the designated
  // flight; a mission without a pal has no pal effects at all
  if (w.lvl) return w.lvl.def.fx.pal && w.lvl.def.fx.pal !== "switchback" ? [w.lvl.def.fx.pal] : [];
  // THE LESSON FLIES CLEAN (audit, 30 Sep 2026): the tutorial lends Acorn
  // for its pal stages and nobody otherwise, so an equipped Magnetar
  // cannot teach the first flight upside down
  if (w.tut) return w.tut.stage === "pal" || w.tut.stage === "gates7" || w.tut.stage === "portal" ? ["buddy"] : [];
  // PAL EFFECTS OFF. Every gameplay effect a companion has is behind this
  // one question, so answering "nobody" here turns all of them off at once
  // and cannot miss one the way a flag checked in fourteen places would.
  // The pals are still EQUIPPED and still drawn - the draw path reads
  // runPals - because the point of the switch is to keep the companion
  // you like without the effect you do not.
  if (save.noPalFx) return [];
  // Stopwatch's tap toggle reads runPals directly; it has no fx entry here
  return equippedPals(save).filter((p) => p !== "switchback");
}
/** is this companion's effect live? With two slots, EVERY effect is asked
 *  this way, so stacking is the default and the exceptions are written
 *  where they bite: Wisp yields to AstraFox, Astrolobee's veto beats Meteor
 *  Core's bonus, Nightglider never boards beside a drift pal (catalog). */
function hasPal(save: SaveData, w: World, id: string) {
  return palIds(save, w).includes(id);
}

// A mod never touches a TUTORIAL run. The tutorial is teaching the game as
// designed, and a pilot who armed Thrill Seeker and then replayed it would
// be taught a different game. It is also gated on level, so a new pilot
// cannot have one on in the first place — this is the belt to that braces.
//
// Mods never touch a CAMPAIGN LEVEL either: a star has to certify the same
// flight for every pilot, and Steady Gates would quietly buy the no-bounce
// star while Thrill Seeker would double a level tuned at 1x. The level's
// own fx are the only dials.
function modsLive(save: SaveData, w: World) {
  return !w.tut && !w.lvl && modsUnlocked(save);
}

/** How hard the gates sway in Normal: 0 with Steady Gates, 1 otherwise. */
function driftModOf(save: SaveData, w: World) {
  if (w.lvl?.def.fx.pal === "nightglider") return 0;
  // NIGHTGLIDER HOLDS THE GATES STILL (owner, 2 Sep 2026: "no longer
  // strobes, it turns into steady gates"). The pal does what the Steady
  // Gates mod did, the way Wisp took over Rough Air - the pal is the one
  // you can see doing it, so the mod card is gone from the loadout.
  //
  // IT IS A COMPANION, NOT A MOD (audit, 8 Sep 2026). This sat below the
  // modsLive gate, so a pal bought with real money did nothing at all
  // until the pilot also reached the 180-star Flight Mods rung - a paid
  // item with no effect, which is exactly what a store reviewer tests.
  // hasPal already answers "nobody" under Pal Effects Off and on a
  // mission that did not name it, so asking first changes nothing else.
  if (hasPal(save, w, "nightglider")) return 0;
  if (!modsLive(save, w)) return 1;
  return save.steadyGates ? 0 : 1;
}

/** Thrill Seeker runs the whole world at double speed. See updateWorld.
 *  A level's fx.pace rides the same lever, so SOLAR FURNACE is Thrill
 *  Seeker at 1.2 rather than a second clock to reason about. */
function paceOf(save: SaveData, w: World) {
  // AstraFox rides the same clock (PAL_FX pace), on top of whatever the
  // mission or the mods set - fxOf has already multiplied the two.
  if (w.lvl) return fxOf(w).pace ?? 1;
  // Wormhole scores compare one shared control model. Cosmetics still
  // travel with the pilot, but global mods do not silently change its
  // reaction window or invalidate a generated safe path.
  if (w.flight === "tunnel") return 1;
  return (modsLive(save, w) && save.thrillSeeker ? 2 : 1) * (w.palFx?.pace ?? 1);
}

/** THE TWO COMPANIONS' PLACES. The high one rides just above and behind
 *  the pilot's shoulder, where the only pal always flew; the low one takes
 *  the mirror seat under the tail, on its own bob phase so the pair never
 *  reads as one sprite drawn twice. A dart (Acorn fetching a pickup) snaps
 *  the slot it happened in and the seat pulls it back afterwards. */
function followPals(w: World, sx: number, sy: number, dt: number) {
  const seats: [World["palPos"], number, number][] = [
    [w.palPos, -22, 0],
    [w.palPos2, 30, 2.1],
  ];
  for (const [pos, dy, phase] of seats) {
    const tx = sx - 42;
    const ty = sy + dy + Math.sin(w.time * 2.6 + phase) * 7;
    const k = Math.min(1, dt * (pos.dart > 0 ? 14 : 5));
    pos.x += (tx - pos.x) * k;
    pos.y += (ty - pos.y) * k;
    if (pos.dart > 0) pos.dart = Math.max(0, pos.dart - dt);
  }
}

function gravOf(save: SaveData, w: World) {
  if (w.flight === "tunnel") return WORMHOLE_GRAVITY;
  return PHYS.gravity * (hasPal(save, w, "pocketmoon") ? 0.85 : 1) * (hasPal(save, w, "nutsack") ? 1.2 : 1);
}

function flapOf(save: SaveData, w: World) {
  if (w.flight === "tunnel") return WORMHOLE_FLAP;
  return PHYS.flap * (hasPal(save, w, "nutsack") ? 0.71 : 1);
}

function gapSpacing(w: World) {
  return 230 + Math.min(50, w.distance * 0.004);
}

// Gates are not metronome-even: normal flight scatters them across
// 100%–115% of the base rhythm, and Lost in Space keeps the full
// 85%–115% spread because its rotation gives tight pairs room to read.
function nextGapSpacing(w: World) {
  return (fxOf(w).spacing ?? 1) * (w.flight === "lost"
    ? gapSpacing(w) * (0.85 + (w.missionRng ?? Math.random)() * 0.3)
    : gapSpacing(w) * (1 + (w.missionRng ?? Math.random)() * 0.15));
}

function overdriveT(score: number) {
  if (score < PHYS.overdriveGate) return 0;
  return Math.min(1, (score - PHYS.overdriveGate) / PHYS.overdriveSpan);
}

function difficulty(w: World) {
  const t = Math.min(1, w.distance / 12000);
  const od = overdriveT(w.score);
  const max = PHYS.maxSpeed * (1 + 0.1 * od);
  const gmin = PHYS.gapMin * (1 - 0.2 * od);
  return {
    speed: PHYS.baseSpeed + (max - PHYS.baseSpeed) * t,
    gap: PHYS.gapBase - (PHYS.gapBase - gmin) * t,
  };
}

function pickKind(w: World) {
  w.planetBag ??= { env: -1, remaining: [], last: -1 };
  return nextFamilyPlanet(w.planetBag, envIndexFor(w, w.score), w.planetRng ?? Math.random);
}

// Each zone owns two or three debris materials.
function pickDebris(env: (typeof ENVS)[number]) {
  return env.debrisBias[Math.floor(Math.random() * env.debrisBias.length)];
}

// Fully seal the corridor above the top gate and below the bottom one,
// packed tight enough that the flight lane cannot be slipped around.
/** WHERE A ROCK IS RIGHT NOW along the flight axis. Collision, both
 *  debris sweeps and the painter all ask here, so what the pilot flies
 *  into is what the pilot sees. Arcade keeps its rocks still - the retro
 *  timeline is a different painter and a different feel. */
/** Rock size, as a fraction of the first pass's radius. The base spread is
 *  19-26px; at 0.9 that becomes 17.1-23.4px. The floor that matters is the
 *  SEAL: rocks are laid down every 30px, so twice the smallest radius has to
 *  stay above that step or the column develops gaps a pilot can see - and
 *  aim - through. At 0.9 the smallest rock still spans 34.2px against a 30px
 *  step, so the seal holds. test-drift.mjs asserts it. */
export const DEBRIS_SIZE = 0.9;

/** How fast a rock drifts, as a fraction of the first pass's rate. The
 *  original swing was one every 5s to 14s, which is a readable wobble on a
 *  static column and far too busy once the whole field is moving. At a
 *  quarter speed it is one swing every 19s to 56s: slow enough to register
 *  as drift rather than motion, which is the whole point of the effect. */
export const DEBRIS_DRIFT_RATE = 0.25;

export function blockerX(p: PlanetCol, b: PlanetCol["blockers"][number], w?: World) {
  const home = p.x + (b.xOff || 0);
  if (!w || !b.amp) return home;
  if (w.flight !== "fly" && w.flight !== "deep" && w.flight !== "lost") return home;
  return home + Math.sin(w.time * b.rate + b.phase) * b.amp;
}

/** How far the playfield can ever lean. Lost in Space drives its tilt
 *  continuously; the other modes only reach theirs while a warp runs. */
export const LOST_TILT_MAX = (40 * Math.PI) / 180;
export const WARP_TILT_MAX = (25 * Math.PI) / 180;

/** HOW FAR PAST THE SCREEN THE SEAL MUST REACH.
 *
 *  The column used to stop 20px INSIDE the edge, so its cut end was already
 *  visible sitting still - and once the playfield leans, that end swings
 *  properly into view and you can see where the rocks simply stop. The lean
 *  carries a gate up to dx*sin(tilt) vertically, so the column is run out
 *  that far plus a rock and the end stays off screen at every angle.
 *
 *  Capped against the field height, because a wide landscape window has an
 *  enormous lever arm and a short field: uncapped it would ask for a column
 *  several screens long, all of it rocks nobody will ever see. */
function sealReach(w: World) {
  const tilt = w.flight === "lost" ? LOST_TILT_MAX : WARP_TILT_MAX;
  // the lean carries a gate this far vertically at the worst x
  const lean = (w.W / 2 + PHYS.planetR) * Math.sin(tilt);
  const cos = Math.max(0.2, Math.cos(tilt));
  // ...and the same rotation COMPRESSES the column toward the middle by
  // cos, so a rock parked exactly a lean past the edge still lands inside
  // it. Solving for the world y that projects to the screen edge with the
  // worst lean on top is what this is - my first cut used the lean alone
  // and left the cut end up to 65px inside the frame.
  return Math.min((w.H / 2 + lean + 26) / cos - w.H / 2, w.H * 1.1);
}

function sealBlockers(w: World, env: (typeof ENVS)[number], gapY: number, gap: number) {
  const r = PHYS.planetR;
  const blockers: PlanetCol["blockers"] = [];
  // a bounce house has nothing sharp in it
  if (w.bounceHouse) return blockers;
  // A short landscape field leaves only a thin band between each planet
  // and the screen edge — the portrait spacing (26px of air, 30px step,
  // 20px edge reserve) fit ZERO rocks there and every gate spawned bare.
  // Tight packing keeps the seal visible whatever the field height.
  const short = w.H < 560;
  const pad = short ? 4 : 26;
  const step = short ? 22 : 30;
  // The column PROJECTS past both screen edges, far enough that the lean
  // can never swing its cut end into view. See sealReach.
  const edge = -sealReach(w);
  const put = (y: number, n: number) => {
    const rr = (19 + (w.missionRng ?? Math.random)() * 7) * DEBRIS_SIZE;
    blockers.push({
      y,
      r: rr,
      kind: env.planetBias[0], // fallback only; rocks must not consume the gate bag
      xOff: ((n % 2) * 2 - 1) * (2 + (w.missionRng ?? Math.random)() * 5),
      // A FIELD, NOT A FENCE. Each rock swings along the flight axis on its
      // own clock - up to its own RADIUS either way, at its own speed, from
      // its own phase - so a stack reads as debris hanging in space rather
      // than as a wall of evenly spaced circles. Uniform amplitude is the
      // point: plenty of rocks barely move, which is what stops the column
      // pulsing as one body.
      //
      // It was a full width either way at first, which spread the column too
      // far to still read as one seal. Halved.
      amp: (w.missionRng ?? Math.random)() * rr,
      // The SPREAD was right and the SPEED was not: at full rate the column
      // read as arcade jitter rather than anything hanging in space. Only
      // the clock is scaled here - amplitude, phase and the per-rock variety
      // are all untouched, so the stack keeps exactly the diversity it had
      // and simply takes four times as long to get anywhere.
      rate: (0.45 + (w.missionRng ?? Math.random)() * 0.9) * DEBRIS_DRIFT_RATE,
      phase: (w.missionRng ?? Math.random)() * Math.PI * 2,
      debris: pickDebris(env),
    });
  };
  // the cap was 12, which stopped the column short of even the old edge on
  // a tall field; it now has to be able to actually reach the new one
  const CAP = 40;
  let y = gapY - gap / 2 - r * 2 - pad;
  for (let n = 0; y > edge && n < CAP; n++, y -= step) put(y, n);
  y = gapY + gap / 2 + r * 2 + pad;
  for (let n = 0; y < w.H - edge && n < CAP; n++, y += step) put(y, n);
  return blockers;
}

// ——— THE SCRIPTED COURSE ———
// One fixed run, laid out IN FULL before the first tap. The world freezes
// under every prompt and glide taps are ignored, so the guided beats fly
// one deterministic trajectory — computable up front. Nothing is moved or
// conjured mid-flight: the pilot sees the whole road ahead, exactly like
// a real run.
function buildTutorialCourse(w: World, save: SaveData) {
  w.planets = [];
  w.pickups = [];
  const sx = w.W * PHYS.squirrelX;
  const g = gravOf(save, w);
  const fv = flapOf(save, w);
  const arc = (v: number, t: number) => v * t + 0.5 * g * t * t;
  const y0 = w.H * 0.45;                 // the squirrel's start line
  const y1 = y0 + arc(fv, 0.8);          // at the TAP prompt
  const y2 = y1 + arc(fv, 0.55);         // at the TAP AGAIN prompt
  const tLand = 0.9;
  const yLand = y2 + arc(fv, tLand);     // the fall meets the planet here
  const tApex = (640 - 60) / g;          // the −640 spring up to the freeze
  const yApex = yLand - (640 * tApex - 0.5 * g * tApex * tApex);
  // THE COURSE IS BUILT AROUND THIS HEIGHT. The recovery gate is placed
  // relative to the apex when its beat begins, so the swipe lesson only
  // makes sense with the pilot AT the apex - anywhere else and "dive back
  // down and make the gap" points at a gap that is not below them.
  if (w.tut) w.tut.apexY = yApex;
  // NOTHING IS PRE-PLACED FOR THE SCRIPTED BEATS. The bounce planet and
  // the gates that follow are laid at the moment their beat begins, from
  // where the pilot actually is - see placeBouncePlanet and
  // buildTutorialGates. Pre-computing them meant assuming when the pilot
  // would tap, and the pilot now decides that.
  w.lastSpawnX = sx + 240;
  w.lastGapY = w.H * 0.45;
  // and NOT the three gates: the handover lays those, positioned against
  // wherever the bounce actually left the pilot. Laying them here as well
  // put six gates in the three-gate stretch - the extra three scrolled past
  // uncounted and then showed up in the pal's tally, twelve gates flown for
  // a course of ten.
}

/** Lay `count` sealed practice gates ahead of the pilot, with an acorn in
 *  each mouth, and leave the spawner pointing past them.
 *
 *  Shared by the course and by tutRewind, which is the point: the three
 *  gates a pilot is sent back to are laid by the same arithmetic that laid
 *  them the first time, so a restart cannot quietly be a different course.
 *  Sealed so they read as REAL gates - every mistake is protected here. */
/** Put the bounce planet exactly where THIS dive is going to land.
 *
 *  The course used to place it at build time, from an assumed run of the
 *  lesson: tap at 0.8s, tap again at 0.55s, fall for 0.9s. That held only
 *  while the tutorial drove the taps. Now the pilot answers each beat when
 *  they like, so those timings are whatever they are - and the planet sat
 *  where the old arithmetic said, while the dive went past it to the floor.
 *  Measured: the pilot ended the dive at y 870-928 on a 900px screen,
 *  bouncing off the bottom edge instead of a planet.
 *
 *  So it is placed at the moment the swipe is answered, from the pilot's
 *  real position and velocity. Same arithmetic, evaluated against what is
 *  actually happening:
 *
 *      dy = yLand - y0,  v = PHYS.dive,  t = (-v + sqrt(v^2 + 2 g dy)) / g
 *
 *  and the planet goes at the distance the world will have travelled in t.
 */
function placeBouncePlanet(w: World, save: SaveData) {
  const env = ENVS[w.envB];
  const sx = w.W * PHYS.squirrelX;
  const g = gravOf(save, w);
  const y0 = w.squirrel.y;
  // land in the lower third, but never so low the planet clips the floor
  const yLand = Math.max(y0 + 140, Math.min(w.H * 0.74, w.H - 120));
  const dy = Math.max(20, yLand - y0);
  const v = PHYS.dive;
  const t = (-v + Math.sqrt(v * v + 2 * g * dy)) / g;
  const kind = pickKind(w);
  // ONE PLANET, NOT A GATE.
  //
  // A PlanetCol is always a PAIR - the collision loop tests both halves -
  // and the teaching planet is supposed to be a lone rock to land on. With
  // the pair sitting where the fall actually reaches it, the pilot met the
  // TOP half on the way down and "bounced" a quarter of a second into a
  // dive they were meant to ride all the way. So the mouth is opened wide
  // enough to carry the top half clean off the screen, leaving exactly the
  // one planet the lesson talks about.
  //
  //     gapY + gap/2 = yLand + 6      the landing surface
  //     gapY - gap/2 < 0              the top half, gone
  //
  // which needs gap > yLand + 6. The extra 6r is NOT arithmetic slack: a
  // planet is DRAWN larger than the radius it collides on, so clearing the
  // collision circle still left a rock hanging over the top of the screen
  // looking like something to avoid. Six radii puts the top half at -7r,
  // far enough that no sprite scale brings it back into frame.
  const gap = yLand + 6 + 6 * PHYS.planetR;
  w.planets.push({
    // THE LEAD IS WHAT THE FALL EARNS, and nothing else.
    //
    // This used to read Math.max(180, speed * t) - a floor meant to stop the
    // planet spawning on top of the pilot. It broke the one thing the
    // arithmetic exists for: the planet reaches the pilot's line after
    // (x - sx) / speed seconds, the pilot reaches yLand after t, and the two
    // are the same instant ONLY when x - sx is exactly speed * t. The floor
    // bound on every screen tried - the fall earns about 93px of travel and
    // the floor forced 180 - so the planet arrived half a second late and
    // the dive passed 3px clear of it. The "boing" then fired off its
    // timeout rather than off a contact: the lesson said planets are bouncy
    // straight after a dive that visibly missed one.
    //
    // A small floor remains against literal overlap; at r=42 a 60px lead
    // still leaves daylight, and the fall earns more than that anyway.
    x: sx + Math.max(60, w.speed * t),
    gapY: yLand + 6 - gap / 2,
    gap, r: PHYS.planetR,
    topKind: kind, botKind: kind,
    scored: true,               // the teaching planet is not a gate to score
    solo: true,                 // and it is not nudged to keep a top half on screen
    drift: 0, driftAmp: 0,
    blockers: [],
  });
  void env;
}

function buildTutorialGates(w: World, save: SaveData, count: number) {
  const env = ENVS[w.envB];
  const sx = w.W * PHYS.squirrelX;
  const gap = 176;
  const y0 = w.H * 0.45;
  const clampY = (y: number) => Math.max(70 + gap / 2, Math.min(w.H - 70 - gap / 2, y));
  // a gentle weave back to the flight line, repeating for longer stretches
  const weave = [80, -40, 60, -20, 40, -60, 30];
  let d = Math.max(w.lastSpawnX, sx + 240);
  let lastY = w.lastGapY;
  for (let i = 0; i < count; i++) {
    d += 260;
    const yy = clampY(y0 + weave[i % weave.length]);
    const kind = pickKind(w);
    w.planets.push({
      x: d, gapY: yy, gap, r: PHYS.planetR,
      topKind: kind, botKind: kind,
      scored: false, drift: 0, driftAmp: 0,
      blockers: sealBlockers(w, env, yy, gap),
    });
    w.pickups.push({ x: d + 8, y: yy, got: false,
                     bob: Math.random() * Math.PI * 2, kind: "acorn" as const });
    lastY = yy;
  }
  w.lastSpawnX = d;
  w.lastGapY = lastY;
}

// While the tutorial teaches, a debris hit is a free reset — the whole
// shield theatre without spending anything. Unlimited, but only here.
/** PROTECTION IS NOT PROGRESS.
 *
 *  The three gates before the companion are the pass mark of the whole
 *  lesson: the pilot has to string them together. Protection keeps them
 *  alive when they clip one - it must not hand them the gate. Without this,
 *  a player could bump off every gate in the course and arrive at the
 *  portal having never actually flown one, which is the failure mode the
 *  owner named.
 *
 *  So a contact inside the three sends the streak to zero and puts the
 *  stretch back. The stretch is REBUILT from the deterministic course
 *  builder rather than restored from a snapshot: the layout is a pure
 *  function of the screen and the physics, so rebuilding cannot drift out
 *  of step with the director the way a saved-and-restored world can.
 */
function tutRewind(w: World, save: SaveData) {
  const t = w.tut;
  if (!t) return;
  t.streak = 0;
  t.restarts += 1;
  t.nudge = t.restarts === 1 ? "all three in a row - from the top"
    : t.restarts < 4 ? "again - three clean passes"
      : "take your time. three in a row.";
  // clear the stretch and lay it out again from the same arithmetic
  const sx = w.W * PHYS.squirrelX;
  w.planets = w.planets.filter((p) => p.x + p.r < sx - 12);
  w.pickups = w.pickups.filter((a) => a.x < sx - 12);
  // AND RESET THE SPAWN ORIGIN. buildTutorialGates continues from
  // w.lastSpawnX, which still pointed at the END of the stretch that was
  // just thrown away - so a rewind on the first gate laid the new three
  // more than a thousand pixels off the right of a 430px screen. Reported
  // as "THREE IN A ROW 0/3" over empty space with nothing ever arriving.
  w.lastSpawnX = sx + 240;
  w.lastGapY = w.squirrel.y;
  buildTutorialGates(w, save, 3);
  w.squirrel.y = w.H * 0.45;
  w.squirrel.vy = 0;
  w.squirrel.rot = 0;
  w.bounceUp = false;
  w.hitCooldown = 0;
  w.shieldFreeze = 0.45;
  w.shieldSlow = 2.6;
  w.recoveryMsg = "THREE IN A ROW — FROM THE TOP";
}

function tutReset(w: World, bx: number, by: number) {
  const sx = w.W * PHYS.squirrelX;
  let cy = w.H * 0.45;
  let best: PlanetCol | null = null;
  for (const p of w.planets) if (p.x + p.r >= sx - 20 && (!best || p.x < best.x)) best = p;
  if (best) cy = liveGapY(best, w);
  spark(w, bx, by, ["#7ad8ff", "#5dff9e", "#fff"], 16, "shield");
  for (const p of w.planets) {
    p.blockers = p.blockers.filter((b) => {
      const ax = blockerX(p, b, w);
      return Math.hypot(ax - bx, b.y - by) > 110 && Math.hypot(ax - sx, b.y - cy) > 150;
    });
  }
  w.squirrel.y = cy;
  w.squirrel.vy = 0;
  w.squirrel.rot = 0;
  w.hitCooldown = 0;
  w.bounceUp = false;
  w.shieldFreeze = 0.45;
  w.shieldSlow = 2.6;
  w.absorbGrace = 1.8;
  w.recoveryMsg = "PROTECTED — TRY AGAIN!";
  spark(w, sx, cy, ["#7ad8ff", "#fff"], 14, "shield");
}

function tutSafe(w: World) {
  // THE FIRST FLIGHT, AND THE FIRST MISSION. Both protect the pilot for the
  // same reason and through the same path: a beginner who crashes out in
  // their first minute has been told the game is not for them. Level one
  // carries fx.noFail and nothing else does, so the mercy stops the moment
  // the pilot has actually flown something.
  if (w.lvl?.def.fx.noFail) return true;
  return !!w.tut && w.tut.stage !== "free";
}

/** BLACK HOLE AND WORMHOLE SPAWN RATES, in one place.
 *
 *  Free Flight has always carried black holes. The Star Chart's Lost and
 *  Arcade stages used to sell WORMHOLES; those levels take a black hole
 *  instead now, at the rate the wormhole had, so the stage's rhythm is
 *  unchanged and only the hazard's identity moves. Free-play Arcade loses
 *  its reversal hazard outright.
 *
 *  Lost in Space is held at ZERO rather than deleted. It is coming back in
 *  a different form, and a spawn that still reads as a spawn - one number
 *  from being live again - is worth more than a branch someone has to
 *  rebuild from memory. */
const HOLE_RATE_FLY = 0.018;
/** the slot the wormhole used to occupy on a campaign level */
const HOLE_RATE_LEVEL = 0.05;
const WORM_RATE: Partial<Record<FlightMode, number>> = {
  lost: 0.05,   // back on, and now it actually transports you
};

function holeChance(w: World) {
  if (w.flight === "fly") return HOLE_RATE_FLY;
  // a Star Chart level built on Lost or Arcade: the wormhole's slot, rekeyed
  if (w.lvl && (w.flight === "lost" || w.flight === "arcade")) return HOLE_RATE_LEVEL;
  return 0;
}

/** Free play only. A campaign level never spawns one, whatever its base. */
function wormChance(w: World) {
  return w.lvl ? 0 : WORM_RATE[w.flight] ?? 0;
}

/** PER SECOND, NOT PER GATE.
 *
 *  Every pickup rolled once per gate - but gates ARRIVE FASTER as the run
 *  speeds up: 1.40x as often by distance 12,000, and 1.53x once overdrive
 *  is on top. Same odds per gate plus half again as many gates a second is
 *  a deep run being quietly showered, and it compounds against the pilot's
 *  favour rather than the run's.
 *
 *  Shields were the visible symptom - three in hand by gate 100, and a
 *  crash refilled before the next was spent, so a deep run stopped being
 *  risky - but every pickup had drifted the same way.
 *
 *  Dividing by how much faster the gates are arriving than they did at the
 *  start holds every pickup's rate PER SECOND flat for the whole run, which
 *  also makes the opening minute an honest sample of the whole thing.
 *
 *  Hazards are deliberately NOT normalised. A black hole arriving more
 *  often in a faster run is difficulty; a shield arriving more often is a
 *  bail-out. */
function cadenceNorm(w: World, d: { speed: number }) {
  const now = Math.max(1e-3, d.speed / gapSpacing(w));
  const start = PHYS.baseSpeed / 230;
  return Math.min(1, start / now);
}

/** SHIELDS THIN OUT AND THEN STOP.
 *
 *  A shield is a second chance, and a run that keeps handing them out has
 *  no late game - the pilot is never actually at risk. The rate steps down
 *  a quarter every fifty gates and reaches ZERO at gate 200, so the deep
 *  run is flown without a net. Every mode that spawns shields is covered,
 *  because this multiplies the one roll they all share.
 *
 *  The +1 SHIELD mod is untouched: that is a thing the pilot bought and
 *  brought with them, not something the run handed out. */
export const SHIELD_FADE_EVERY = 50;
export const SHIELD_FADE_END = 200;
export function shieldFalloff(w: World) {
  const steps = SHIELD_FADE_END / SHIELD_FADE_EVERY;          // four
  const step = Math.floor(Math.max(0, w.score) / SHIELD_FADE_EVERY);
  return Math.max(0, (steps - step) / steps);
}

function spawnPair(w: World, save: SaveData, x: number) {
  const env = ENVS[w.envB];
  const d = difficulty(w);
  // BABY ALIEN (owner, 7 Sep 2026): planetary gaps at .6
  let gap = d.gap * (fxOf(w).gapScale ?? 1);
  const margin = 72;
  let gapY = margin + gap / 2 + (w.missionRng ?? Math.random)() * (w.H - 2 * margin - gap);
  const dx = Math.max(80, x - w.lastSpawnX);
  // Reachability, on the live game's tuned model. The two budgets are NOT
  // symmetric and must not be swapped: climbing is the slow direction
  // (230px/s of sustainable lift) while gravity makes diving fast
  // (520px/s). Smaller y is higher, so climb bounds how far UP the next
  // gate may sit and dive bounds how far DOWN. Having these inverted made
  // the sandbox demand climbs the pilot could not make while flattening
  // every descent. Lost in Space reserves headroom for its sway + drift.
  const speed = Math.max(d.speed, 1);
  const lost = w.flight === "lost";
  const dxWorst = lost ? Math.max(100, dx - 48) : dx;
  const dtGate = dxWorst / (speed * (lost ? 1.4 : 1));
  const vMargin = lost ? 30 : 0;
  const climb = Math.max(40, 230 * dtGate - vMargin);
  const diveAmt = Math.max(60, 520 * dtGate - vMargin);
  gapY = Math.max(w.lastGapY - climb, Math.min(w.lastGapY + diveAmt, gapY));
  gapY = Math.max(margin + gap / 2, Math.min(w.H - margin - gap / 2, gapY));
  // BOUNCE HOUSE PLANETS (owner): each gate rolls its own size, up to 2.5x,
  // and never more than a third of the screen tall
  const r = w.bounceHouse
    ? Math.min(w.H / 6, PHYS.planetR * (1 + (w.missionRng ?? Math.random)() * 1.5))
    : PHYS.planetR;
  const blockers = sealBlockers(w, env, gapY, gap);

  // Vertical drift: the gate itself breathes up and down. Free Flight
  // now carries a gentle 15%-of-gap sway so a run is never a static
  // ladder; the wisp pal and Lost in Space push it further. Horizontal
  // drift — the scroll speed wobbling — is NOT here: that stays a Lost
  // in Space signature (see driftFactor, gated to "lost" alone).
  // Two mods buy a say in this, and only in Normal: Steady Gates stills the
  // sway entirely, Rough Air doubles it. They do not touch Lost in Space,
  // whose drift is the mode's whole identity, and neither touches a black
  // hole's tilt — that is orientation, not drift, and it stays either way.
  // WISP YIELDS TO ASTRAFOX (owner): the two drift companions do not stack,
  // so with both aboard the fox's multiplier rides the mode's own sway
  const wisp = hasPal(save, w, "wisp") && !hasPal(save, w, "astrafox");
  const normalDrift = w.flight === "fly" ? driftModOf(save, w) : 1;
  // a level's fx sway rides on top of the mode's own; CRIMSON STORM is
  // Rough Air with the volume knob exposed
  const lvlDrift = fxOf(w).driftScale ?? 1;
  const driftAmp =
    (wisp ? 26
      : w.flight === "lost" ? 12
        : w.tut ? 0
          : gap * 0.15 * normalDrift) * lvlDrift;
  const pairKind = pickKind(w);
  // BOUNCE HOUSE, and nowhere else: a lone planet, top or bottom by coin
  // flip, parked where the whole ball is on screen. gapY is back-solved so
  // the ordinary top/bottom arithmetic lands the one half where it was put.
  let half: PlanetCol["half"];
  if (w.bounceHouse) {
    const rng = w.missionRng ?? Math.random;
    half = rng() < 0.5 ? "top" : "bot";
    const cy = r + 10 + rng() * Math.max(0, w.H - 2 * r - 20);
    gapY = half === "top" ? cy + gap / 2 + r : cy - gap / 2 - r;
  }
  w.planets.push({
    x,
    gapY,
    gap,
    r,
    half,
    solo: !!half,
    // ONE PLANET PER GATE, drawn once. The two halves of a gate are one
    // object as far as the eye is concerned - a striped giant above and an
    // ice moon below reads as two things that happen to be near each other,
    // not as a gap through a place. Diversity lives ACROSS gates, which is
    // a shuffled five-planet family. No global picks cross zone boundaries.
    topKind: pairKind,
    botKind: pairKind,
    scored: false,
    drift: (w.missionRng ?? Math.random)() * Math.PI * 2,
    driftAmp,
    blockers,
  });

  const bee = hasPal(save, w, "bee");
  // Space Puppy's bounce house spawns nothing to collect either
  const noPick = bee || w.bounceHouse || (w.tut && w.tut.stage !== "gates7" && w.tut.stage !== "portal" && w.tut.stage !== "free");
  // A collection star must never be lost to the spawn dice: a level with
  // fx.acornEvery guarantees one acorn per gate, so "collect N" is always
  // achievable inside the level's own gate count with room to miss a few.
  // a level's promise is exempt: fx.acornEvery means EVERY gate, whatever
  // the run is doing, or a "collect eight" star stops being arithmetic
  const acornOdds = w.lvl?.def.fx.acornEvery ? 1 : 0.58 * cadenceNorm(w, d);
  // A LEVEL's promised pickups outrank the pal's veto. Bee spawns no
  // pickups and that is its trade in endless — but a level whose star says
  // "collect N" or "catch a golden acorn" must spawn them for every pilot,
  // whatever is flying alongside. Golds land on planned gates (goldGatesFor)
  // so the promise is arithmetic, not odds.
  // ONE PICKUP PER GAP. Four independent rolls could all land in the same
  // mouth - and with Arcade's double and Meteorcore's double stacked on
  // top, often did: three things almost on top of each other, which reads
  // as a pile rather than as a choice worth making.
  //
  // A level's PROMISED pickups are placed first and take the slot, because
  // a star that says "collect eight" must never be left to the dice. Every
  // roll below only fills a mouth the level did not already claim.
  let slotUsed = false;
  if (w.lvl) {
    w.lvl.spawnOrd += 1;
    if (w.lvl.def.fx.acornEvery) {
      const off = ((w.missionRng ?? Math.random)() - 0.5) * gap * 0.35;
      w.pickups.push({ x: x + 8, y: gapY + off, got: false, bob: (w.missionRng ?? Math.random)() * 6, kind: "acorn" });
      slotUsed = true;
    }
    if (w.lvl.goldGates.includes(w.lvl.spawnOrd)) {
      w.pickups.push({ x: x + 66, y: gapY + ((w.missionRng ?? Math.random)() - 0.5) * gap * 0.2, got: false, bob: (w.missionRng ?? Math.random)() * 6, kind: "gold" });
      slotUsed = true;
    }
  }
  // Arcade is the generous mode: power-ups spawn TWICE as often as NORMAL,
  // and no more (owner, 1 Oct 2026: "2x max"). NORMAL runs at half the
  // base rate — at the old rate a run was carrying a freeze or a shield
  // almost continuously, which is not a power-up any more, it is the
  // baseline — so Arcade sits at the base rate, which is exactly 2x NORMAL.
  // It used to double on top of the base rate as well, which made it 4x.
  // The pal bonus still multiplies on top of whichever mode you are in.
  // NOTE: this scales the three power-ups (freeze, golden, shield). The
  // black hole is a hazard and the 8-bit acorn is the door to the other
  // game, so neither rides this multiplier.
  const specialMul =
    // Astrolobee's veto beats Meteor Core's bonus (owner): no pickups at
    // all, so there is nothing to double
    (hasPal(save, w, "meteorcore") && !bee ? 2 : 1) *
    (w.flight === "fly" ? 0.5 : 1);
  const noShield = hasPal(save, w, "nutsack") || hasPal(save, w, "tinbot");
  const noHoles = hasPal(save, w, "tinbot") || w.bounceHouse;
  if (!noPick) {
    // The three power-ups roll ONCE, weighted against each other, rather
    // than three times independently. Their combined chance is what it
    // always was, so a run meets no fewer of them - it just never meets
    // two in the same mouth. The power-up goes first: rolling the acorn
    // first would have let its 58% swallow more than half of them.
    if (!w.tut && !slotUsed) {
      const norm = specialMul * cadenceNorm(w, d);
      const odds: [PickupKind, number][] = [
        ["slow", 0.05 * norm],
        ["gold", 0.035 * norm],
        // shields take BOTH corrections: flat per second like everything
        // else, AND fading out entirely by gate 200
        ["shield", noShield ? 0 : 0.03 * norm * shieldFalloff(w)],
      ];
      let roll = (w.missionRng ?? Math.random)();
      for (const [kind, chance] of odds) {
        if (roll >= chance) { roll -= chance; continue; }
        const spread = kind === "slow" ? 0.22 : kind === "gold" ? 0.2 : 0.18;
        const at = kind === "slow" ? 36 : kind === "gold" ? 52 : 20;
        w.pickups.push({ x: x + at, y: gapY + ((w.missionRng ?? Math.random)() - 0.5) * gap * spread,
                         got: false, bob: (w.missionRng ?? Math.random)() * 6, kind });
        slotUsed = true;
        break;
      }
    }
    if (!slotUsed && (w.tut || (w.missionRng ?? Math.random)() < acornOdds)) {
      const off = w.tut?.stage === "gates7" ? ((w.missionRng ?? Math.random)() < 0.5 ? -1 : 1) * gap * 0.32 : ((w.missionRng ?? Math.random)() - 0.5) * gap * 0.35;
      w.pickups.push({ x: x + 8, y: gapY + off, got: false, bob: (w.missionRng ?? Math.random)() * 6, kind: "acorn" });
      slotUsed = true;
    }
    // Deep Space runs its own shift on a timer, so a black hole there does
    // nothing but clutter the lane — live excludes them and so do we.
    //
    // Inside the stretch the roll is OFF. A hole met while already warped
    // could not be entered (the catch is guarded on warp state), so it was
    // scenery that looked like the exit — black holes inside the black
    // hole. The only hole that belongs in here is the one that ends it.
    // A warp has THREE representations and the guard only knew one of them.
    // enterWarp sets warpGateEnd for Free Flight and a warpLeft TIMER for
    // everything else - so on a Star Chart level built on Arcade, where
    // holeChance is 0.05, the whole fifteen-second stretch kept rolling for
    // new holes: black holes inside the black hole, exactly what this guard
    // was written to stop. warpT covers the entry swirl on the way in.
    const warping = w.warpGateEnd >= 0 || w.warpLeft > 0 || w.warpT > 0;
    const holeRate = holeChance(w);
    if (!w.tut && !noHoles && !warping && !(w.lvl && slotUsed) && holeRate > 0 && (w.missionRng ?? Math.random)() < holeRate) {
      w.pickups.push({ x: x + 64, y: gapY, got: false, bob: (w.missionRng ?? Math.random)() * 6, kind: "hole", r: gap * 0.5 + 10 });
    }
    // The way home. Once the fifteen gates are behind you the next gate
    // carries the exit, dead centre in the mouth so it cannot be missed by
    // accident — you leave the way you came in, through a hole, rather than
    // having the flight quietly right itself underneath you.
    // GATE-COUNTED stretches only. `warping` now also covers timer warps,
    // and warpGateEnd is -1 for those - so testing it here would make
    // `score >= -1` trivially true and hang a fake way-out on the first gate
    // of every Deep Space and Arcade warp, which end on their own clock.
    if (w.warpGateEnd >= 0 && !w.warpExitSpawned && w.score >= w.warpGateEnd) {
      w.warpExitSpawned = true;
      w.pickups.push({ x: x + 64, y: gapY, got: false, bob: (w.missionRng ?? Math.random)() * 6, kind: "hole", r: gap * 0.5 + 10, exit: true });
    }
    // The door to the other game. It rides in Free Flight only — the
    // one place you can leave the illustrated game and slip into the
    // arcade for a stretch. It spawns on the flight line like an acorn
    // rather than in the gate mouth like a black hole, because it is a
    // way across, not a hazard. It stays shut until gate 100: crossing
    // timelines is a late-run reward, not something you meet on your
    // second gate before you have seen this game properly.
    if (!w.tut && w.flight === "fly" && w.score >= RETRO_GATE && (w.missionRng ?? Math.random)() < 0.05) {
      w.pickups.push({ x: x + 44, y: gapY + ((w.missionRng ?? Math.random)() - 0.5) * gap * 0.2, got: false, bob: (w.missionRng ?? Math.random)() * 6, kind: "retro" });
    }
    // Wormholes are DOORS now, not reorientations: catching one flies the
    // pilot down a real corridor for fifteen seconds and puts them back
    // where they were. Lost in Space only - Arcade's reversal hazard stays
    // retired. See enterWormhole.
    // ...and not while already warped, for exactly the reason the hole roll
    // above is guarded. A door to somewhere else, opening inside a black
    // hole, reads as the way out and is not.
    //
    // ON A SCHEDULE, NOT A ROLL. It used to be a 5%-a-gate dice throw,
    // which meant a run could meet three in twenty gates or none in
    // eighty - and since a trip was worth roughly forty gates of credit,
    // the dice were also deciding the run. One every twenty gates is a
    // rhythm a pilot can learn and fly toward: twenty gates of Lost in
    // Space, a corridor, and out again at twenty-one.
    if (!w.tut && !noHoles && !warping && wormChance(w) > 0 && w.gatesSpawned >= w.wormNextGate) {
      w.wormNextGate = w.gatesSpawned + WORM_EVERY_GATES;
      w.pickups.push({ x: x + 64, y: gapY, got: false, bob: (w.missionRng ?? Math.random)() * 6, kind: "worm", r: gap * 0.5 + 10 });
    }
  }
  w.lastSpawnX = x;
  w.lastGapY = gapY;
  w.gatesSpawned += 1;
}

/** THE SUIT ON THE PILOT. The tutorial flies AcorNut whatever the save
 *  wears; every other run wears the equipped suit. One place to ask, so the
 *  painter, the trail, the shield and the motion hooks cannot disagree. */
export function pilotSuitId(w: World, save: SaveData) {
  return w.tutSuit ? TUTORIAL_SUIT : save.equippedSuit;
}

/** THE FLIGHT TEST (owner, 12 Sep 2026: "add you self flying simulator in
 *  there. 2/4/6/8 auto flap speed. and then some dials, to tweak it ...
 *  always there always. beta only").
 *
 *  A free flight that flies itself: an empty sky, a floor that bounces,
 *  a crash that cannot end it, and an autopilot that taps on the fixed
 *  tick through the real flap(). The patterns are the tap-retrofit spec's
 *  acceptance cases plus two for staring at one suit:
 *
 *    manual   the tester's taps only
 *    hover    one tap every 2V/g - zero net height, the cadence real play
 *             settles into (692 ms at the shipped -450 / 1300)
 *    2 4 6 8  that many taps a second, on the tick
 *    pairs    two taps 120 ms apart, then 0.8-1.1 s of nothing
 *    station  a tap whenever the pilot is below the centre line and
 *             falling, at most ten a second - stays on screen at any rate
 *
 *  Nothing here is reachable on the live page: beginFlightTest refuses
 *  outside the beta, and no live screen offers it. */
export type FlightTestPattern = "manual" | "hover" | "2" | "4" | "6" | "8" | "pairs" | "station";
export const FLIGHT_TEST_PATTERNS: readonly FlightTestPattern[] = ["manual", "hover", "2", "4", "6", "8", "pairs", "station"];
export type FlightTest = {
  pattern: FlightTestPattern;
  /** seconds of world clock until the autopilot's next tap */
  next: number;
  /** PAIRS: whether the next tap is the close second of a pair */
  pair: boolean;
  /** world-clock times of the last accepted taps (any source); the dock
   *  reads a measured taps/s off it */
  tapLog: number[];
};
/** seconds between taps for the fixed-cadence patterns; hover is 2V/g */
export function flightTestInterval(pattern: FlightTestPattern): number {
  switch (pattern) {
    case "hover": return 2 * Math.abs(PHYS.flap) / PHYS.gravity;
    case "2": return 1 / 2;
    case "4": return 1 / 4;
    case "6": return 1 / 6;
    case "8": return 1 / 8;
    default: return 0;
  }
}
export function beginFlightTest(w: World, save: SaveData, pattern: FlightTestPattern = "hover"): boolean {
  if (!IS_BETA) return false;
  resetRun(w, save, "fly", false);
  // an empty sky: the three opening pairs go, and the spawn cursor is
  // pushed so far out that the scroll never reaches it (the same trick
  // the painter harness uses)
  w.planets = [];
  w.pickups = [];
  w.lastSpawnX = 1e9;
  w.lab = { ...w.lab, freeRevive: true };
  w.flightTest = { pattern: FLIGHT_TEST_PATTERNS.includes(pattern) ? pattern : "hover", next: 0.35, pair: false, tapLog: [] };
  return true;
}
/** one fixed tick of the autopilot; dt is the world clock's step */
function stepFlightTest(w: World, save: SaveData, dt: number) {
  const t = w.flightTest!;
  while (t.tapLog.length && t.tapLog[0] < w.time - 6) t.tapLog.shift();
  if (t.pattern === "manual") return;
  t.next -= dt;
  if (t.next > 0) return;
  if (t.pattern === "station") {
    // below the line and falling: tap. Otherwise look again next tick.
    // The READY hold counts as "falling": nothing moves until a tap does,
    // so the first one is the autopilot's, as on every other pattern.
    if (w.ready || (w.squirrel.y > w.H * 0.5 && w.squirrel.vy > 0)) { flap(w, save); t.next = 0.1; }
    return;
  }
  flap(w, save);
  if (t.pattern === "pairs") {
    t.pair = !t.pair;
    t.next += t.pair ? 0.12 : 0.8 + 0.3 * Math.random();
  } else {
    t.next += flightTestInterval(t.pattern);
  }
}

export function resetRun(w: World, save: SaveData, flight: FlightMode, tutorial: boolean, level?: LevelDef, tunnelSeed?: number) {
  // the pause-sheet lab rides only a beta free flight; everything else
  // flies clean so no mission and no live run can inherit a dial
  w.lab = IS_BETA && flight === "fly" && !tutorial && !level && save.lab ? { ...save.lab } : {};
  w.flight = flight;
  w.missionRng = level?.seedVersion === "flight-seeded-v1" && level.seed != null ? missionRandom(level.seed) : undefined;
  w.planetRng = missionRandom(((level?.seed ?? 0x71ac0) ^ 0x5a17c9e3) >>> 0);
  w.planetBag = { env: -1, remaining: [], last: -1 };
  // A campaign level is an ordinary run wearing a finish line. It is set
  // up FIRST because everything below (env order, spawn fx) reads it.
  // guarded on typeof: the tunnel test suite used to pass its SEED in this
  // slot, and a bare truthy check made a number impersonate a level
  w.lvl = level && typeof level === "object"
    ? { def: level, stats: emptyStats(), portal: false,
        barrierAfter: level.base === "race" ? reachedGate(routeMasks(save), save.raceGates)?.after : undefined,
        goldGates: goldGatesFor(level), spawnOrd: 0 }
    : null;
  // every companion's fx, folded together - two pals stack the same way a
  // pal stacks on a mission. AFTER the mission is set: palIds reads w.lvl,
  // and computing this above it read the PREVIOUS run's mission, which is
  // how a mission flew the loadout's pal effects and a free flight after a
  // mission kept the mission's (owner, 8 Sep 2026).
  // ...and BEFORE the tutorial flag is read: a REPLAY TUTORIAL is set up
  // below, so this looked at the previous run's tutorial (or none) and let
  // the loadout's pal fly the lesson (audit, 30 Sep 2026)
  const lesson = tutorial && !level && flight !== "tunnel";
  w.palFx = lesson ? null : palIds(save, w).reduce<LabFx | null>((acc, id) => {
    const fx = PAL_FX[id];
    return fx ? mergeFx(acc ?? {}, fx) : acc;
  }, null);
  w.palFlip = !!w.palFx?.upsideDown;
  w.bounceHouse = !lesson && hasPal(save, w, "spacepuppy");
  // every run starts in this game; the arcade acorn is the only way out
  // Arcade IS the retro game — it starts there and never leaves. Every
  // other mode starts illustrated; in Free Flight the 8-bit acorn is the
  // only way across, and it always returns you home before the run ends.
  w.retro = flight === "arcade";
  w.retroShifts = 0;
  w.retroPending = false;
  w.tailA = 0;
  w.tailV = 0;
  w.score = 0;
  w.runAcorns = 0;
  w.run = { taps: 0, bounces: 0, holes: 0 };
  w.squirrel = { y: w.H * 0.45, vy: 0, rot: 0 };
  w.planets = [];
  w.pickups = [];
  w.particles = [];
  w.tunnel = null;
  w.race = w.lvl?.def.base === "race" ? createRaceState() : null;
  w.raceCues = [];
  w.raceCueEffects = [];
  // Spill missions retain their explicit legacy seeds across reorderings.
  // The endless mode
  // rolls a fresh one every run.
  w.spill = flight === "spill"
    ? createSpill(w.W, w.H, level ? level.seed! : (Math.random() * 0x100000000) >>> 0,
        level ? level.spillFinish ? Number.MAX_SAFE_INTEGER : level.gates : 0, !save.helpOff)
    : null;
  w.spillCues = [];
  if (w.spill) {
    w.spill.zoneEnv = level?.fx.env;
    const starter = save.spillStarter;
    if (!level && starter && SPILL_UTILITIES[starter] && save.spillBest >= SPILL_UTILITIES[starter].unlock) {
      w.spill.utilities = [starter]; w.spill.ownedUtilities = [starter];
    }
    w.spill.signal = spillEngineColor(save).color;
  }
  w.scrollReversing = false; w.scrollDirection = -1; w.scrollTravel = 0; w.tapFrozen = false; w.stuck = false;
  w.speed = PHYS.baseSpeed;
  w.distance = 0;
  w.lastSpawnX = w.W * 0.55;
  w.lastGapY = w.H * 0.45;
  w.powerLeft = 0;
  w.invulnLeft = 0;
  w.flapBoost = 0;
  w.tapAnimT = -1;
  w.vanguard = createVanguardMotion();
  w.arcflash = createArcflashMotion();
  w.highOrbit = isPremiumSuit(save.equippedSuit) ? createPremiumWake(save.equippedSuit)
    : createHighOrbitMotion(isHighOrbit(save.equippedSuit)?save.equippedSuit:'cinderforge');
  w.tapAnimDir = 1;
  w.tapAnimQueued = false;
  // a Flight Test never survives into another run; beginFlightTest sets it
  // back after this reset
  w.flightTest = null;
  w.timeScale = 1;
  w.tapReact = 0; w.tapReactV = 0;
  w.tapAnimFromRot = 0;
  w.bounceAnimT = -1;
  w.bounceAnimDir = 0;
  w.bounceAnimStrength = 0;
  w.wormHold = null;
  w.wormLeft = 0;
  w.wormCalm = 0;
  w.wormNextGate = WORM_EVERY_GATES;
  w.gatesSpawned = 0;
  w.wormExitArmed = false;
  w.zoneJump = 0;
  w.hitCooldown = 0;
  w.bounceUp = false;
  w.deadTimer = 0;
  w.ready = true;
  w.screen = "play";
  w.pausedFrom = null;
  w.shake = 0;
  // through palId so Pal Effects Off lifts the no-shield rule too
  const canShield = !hasPal(save, w, "nutsack") && !hasPal(save, w, "tinbot");
  // UFO STARTS WITH A SHIELD (owner, 7 Sep 2026: the black-hole slow "was
  // not working anyway, and it's useless really"). The saucer carries one
  // charge onto every run for free. The hangar's armed shield is only
  // spent on top of it when the battery has room for two; otherwise it
  // stays armed for a later run rather than being burned for nothing.
  const ufo = hasPal(save, w, "ufo") && canShield;
  const cap = batteryUnlocked(save) ? 3 : 1;
  w.startShieldArmed = !!(save.startShield && canShield && (!ufo || cap > 1));
  w.shieldCharges = Math.min(cap, (ufo ? 1 : 0) + (w.startShieldArmed ? 1 : 0));
  w.absorbGrace = 0;
  w.shieldFreeze = 0;
  w.shieldSlow = 0;
  w.warpT = 0;
  w.warpLeft = 0;
  w.warpGateEnd = -1;
  w.warpExitSpawned = false;
  w.warpTilt = 0;
  w.warpMirror = true;
  w.prevTilt = 0;
  w.prevMirror = false;
  w.deepTimer = 0;
  w.warpKind = null;
  w.driftPhase = (w.missionRng ?? Math.random)() * 100;
  w.driftFactor = 1;
  w.tiltPhase = (w.missionRng ?? Math.random)() * 100;
  w.recoveryMsg = "";
  w.continued = false;
  w.envA = 0;
  w.envB = 0;
  w.envBlend = 1;
  w.envMsgT = 0;   // the opening environment never announces itself —
  // its name (DEEP SPACE) reads as a mode label; shifts still toast
  w.palPos = { x: w.W * PHYS.squirrelX - 42, y: w.H * 0.45 - 20, dart: 0 };
  w.palPos2 = { x: w.W * PHYS.squirrelX - 42, y: w.H * 0.45 + 28, dart: 0 };
  if (flight === "lost") {
    w.warpMirror = false;
    w.warpTilt = lostTiltAt(w.tiltPhase);
  }
  shuffleEnv(w);
  if (w.lvl && w.lvl.def.fx.env !== undefined) {
    // the level opens already under its stage's sky — no crossfade in
    w.envA = w.lvl.def.fx.env;
    w.envB = w.lvl.def.fx.env;
  }
  if (w.race) {
    const viewport = raceViewport(w.W, w.H);
    w.squirrel.y = raceViewportY(viewport, w.race.y);
    w.squirrel.vy = 0;
    w.speed = w.race.speed;
    w.startShieldArmed = false;
    w.shieldCharges = 0;
  } else if (w.spill) {
    // the Spill carries its own shield and hull; the hangar's start
    // shield stays in the hangar
    w.squirrel.y = w.spill.pilot.y;
    w.startShieldArmed = false;
    w.shieldCharges = 0;
  } else if (flight === "tunnel") initTunnel(w, tunnelSeed);
  else for (let i = 0; i < 3; i++) spawnPair(w, save, w.W + 90 + i * nextGapSpacing(w));
  w.tutSuit = tutorial && !w.race && !w.spill && flight !== "tunnel";
  w.tut = w.race || w.spill || flight === "tunnel" ? null : tutorial
    ? { stage: "intro", hold: false, t: 0, gates: 0, gateBase: 0, nudge: "",
        retries: 0, springs: 0, apexY: 0, launched: false, bounced: false,
        locked: true, want: null, streak: 0, streakX: 0, restarts: 0 }
    : null;
  if (w.tut) buildTutorialCourse(w, save);
  // the recorder arms for EVERY run - see mark()
}

export type RaceSemanticInput = {
  held: boolean;
  boost: boolean;
  drop?: true;
  /** Canonical tunnel steering target; null ends an active drag. */
  dragY?: number | null;
};

/** Semantic race input is tick-stamped and consumed before the next race step. */
export function setRaceInput(w: World, input: RaceSemanticInput) {
  if (!w.race || w.screen !== "play") return false;
  queueRaceInput(w.race, input);
  if (input.held || input.drop || input.dragY != null) w.ready = false;
  return true;
}

/**
 * Consume the current fixed step's presentation side effects exactly once.
 * Race authority and the legacy updateWorld sound return remain unchanged.
 */
export function takeRaceCueEffects(w: World): RaceCue[] {
  const cues = w.raceCueEffects;
  w.raceCueEffects = [];
  return cues;
}

export type RaceCueSfx = "gold" | "bounce" | "acorn" | "shift";

export type RaceCueEffectPlan = Readonly<{
  cue: RaceCue;
  sfx: RaceCueSfx | null;
  notify: boolean;
}>;

/**
 * Pure presentation-side mapping from authority cues to existing WebAudio
 * routes. Keeping this separate from playback makes cadence and one-shot
 * dispatch executable evidence without moving any side effect into draw.
 */
export function planRaceCueEffects(cues: readonly RaceCue[]): RaceCueEffectPlan[] {
  return cues.map((cue) => {
    if (cue.kind === "ring-pass" || cue.kind === "tunnel-ring-pass" || cue.kind === "tunnel-ring-perfect") {
      return { cue, sfx: "gold", notify: false };
    }
    if (cue.kind === "debris-hit") return { cue, sfx: "bounce", notify: false };
    if (cue.kind === "acorn") return { cue, sfx: "acorn", notify: false };
    if (cue.kind === "entry" || cue.kind === "return") {
      return { cue, sfx: "shift", notify: true };
    }
    return { cue, sfx: null, notify: cue.kind === "finish" };
  });
}

const TUNNEL_STEP = 56;

const TUNNEL_PATTERN_LENGTH: Record<TunnelPattern, number> = {
  launch: 44,
  ribbon: 54,
  acornArc: 48,
  sweep: 48,
  breather: 40,
  squeeze: 46,
  ripples: 50,
  debrisWeave: 54,
  surge: 48,
};

const TUNNEL_SEQUENCE: TunnelPattern[] = [
  "ribbon",
  "acornArc",
  "sweep",
  "breather",
  "squeeze",
  "ripples",
  "breather",
  "debrisWeave",
  "surge",
  "breather",
];

/** THE CORRIDOR'S WIDTH, in one place.
 *
 *  These used to be written out wherever they were needed, and the copies
 *  agreed because they were the same literal arithmetic. Folding the tuned
 *  corridor multiplier in broke that: maxHalf grew 15% and the three other
 *  sites - the pattern's starting half, its ratio, and the opening speed -
 *  kept the old numbers. The visible symptom was a lead-in that could no
 *  longer reach full width, because the corridor slews at most 8px a node
 *  and now had 15% further to climb in the same twelve nodes. Caught by
 *  test-tunnel-controls, which asserts the lead-in is actually OPEN.
 */
function tunnelMinHalf(H: number) {
  return Math.max(72, Math.min(88, H * 0.15)) * WORMHOLE_WIDTH;
}
function tunnelMaxHalf(H: number) {
  return Math.max(tunnelMinHalf(H) + 38, Math.min(150, H * 0.27) * WORMHOLE_WIDTH);
}

function tunnelNoise(seed: number, index: number, salt = 0) {
  const x = Math.sin(seed * 0.001 + index * 91.733 + salt * 37.119) * 43758.5453;
  return x - Math.floor(x);
}

function beginTunnelSection(w: World) {
  const t = w.tunnel!;
  t.buildSection += 1;
  t.buildPattern = t.buildSection === 0
    ? "launch"
    : TUNNEL_SEQUENCE[(t.buildSection - 1) % TUNNEL_SEQUENCE.length];
  const cycle = Math.floor(Math.max(0, t.buildSection - 1) / TUNNEL_SEQUENCE.length);
  t.patternLength = Math.max(36, TUNNEL_PATTERN_LENGTH[t.buildPattern] - Math.min(8, cycle * 2));
  t.patternPos = 0;
  t.buildRegion = Math.floor(t.buildSection / 2) % TUNNEL_REGION_NAMES.length;
  const prev = t.nodes[t.nodes.length - 1];
  t.patternStartCenter = prev ? (prev.top + prev.bottom) * 0.5 : w.H * 0.5;
  t.patternStartHalf = prev ? (prev.bottom - prev.top) * 0.5 : tunnelMaxHalf(w.H);
  t.patternStartCenterRatio = prev ? prev.centerRatio : 0.5;
  t.patternStartHalfRatio = prev ? prev.halfRatio : t.patternStartHalf / w.H;
  t.patternDirection = tunnelNoise(t.seed, t.buildSection, 21) < 0.5 ? -1 : 1;
}

function tunnelPatternShape(
  w: World,
  pattern: TunnelPattern,
  u: number,
  baseHalf: number,
  room: number,
  startCenter: number,
  direction: -1 | 1,
) {
  const smooth = u * u * (3 - 2 * u);
  const amp = w.H * (0.065 + room * 0.075);
  let center = startCenter;
  let half = baseHalf;
  switch (pattern) {
    case "launch":
      center = w.H * 0.5 + Math.sin(u * Math.PI * 1.5) * w.H * 0.035;
      half += 24 * (1 - smooth);
      break;
    case "ribbon":
      center = w.H * 0.5 + Math.sin(u * Math.PI * 2.2 + direction * 0.6) * amp;
      half += 10;
      break;
    case "acornArc":
      center = w.H * 0.5 + Math.sin(u * Math.PI * 1.8 - direction * 0.8) * amp * 0.72;
      half += 13;
      break;
    case "sweep": {
      const target = w.H * 0.5 + direction * w.H * (0.15 + room * 0.045);
      center = startCenter + (target - startCenter) * smooth;
      half += 8;
      break;
    }
    case "breather":
      center = startCenter + (w.H * 0.5 - startCenter) * smooth + Math.sin(u * Math.PI * 2) * w.H * 0.018;
      half += 25;
      break;
    case "squeeze":
      center = w.H * 0.5 + Math.sin(u * Math.PI * 1.35 + direction) * amp * 0.48;
      half -= Math.sin(u * Math.PI) * (12 + room * 8);
      break;
    case "ripples":
      center = startCenter + Math.sin(u * Math.PI * 4.2) * amp * 0.48;
      half -= (0.5 + 0.5 * Math.sin(u * Math.PI * 6.2)) * (7 + room * 6);
      break;
    case "debrisWeave":
      center = w.H * 0.5 + Math.sin(u * Math.PI * 1.6 - direction) * amp * 0.42;
      half += 16;
      break;
    case "surge":
      center = w.H * 0.5 + Math.sin(u * Math.PI * 2.7 + direction) * amp * 1.08;
      half += 22;
      break;
  }
  return { center, half };
}

function addTunnelPickup(w: World, node: TunnelNode, kind: "acorn" | "slow" | "multiplier", lane: number, salt: number) {
  const t = w.tunnel!;
  w.pickups.push({
    x: node.x,
    y: lane,
    got: false,
    bob: tunnelNoise(t.seed, node.index, salt) * 6,
    kind,
    tunnelSection: node.section,
    tunnelPattern: node.pattern,
  });
}

function addTunnelHazard(w: World, node: TunnelNode, lane: number, salt: number) {
  const t = w.tunnel!;
  const absoluteX = node.index * TUNNEL_STEP;
  if (absoluteX < t.nextHazardAt) return false;
  t.hazards.push({
    x: node.x,
    y: lane,
    r: 19 + tunnelNoise(t.seed, node.index, salt) * 5,
    side: lane < (node.top + node.bottom) * 0.5 ? -1 : 1,
    kind: "debris",
    art: Math.floor(tunnelNoise(t.seed, node.index, salt + 1) * LEGACY_DEBRIS_COUNT),
    spin: (tunnelNoise(t.seed, node.index, salt + 2) < 0.5 ? -1 : 1) *
      (0.35 + tunnelNoise(t.seed, node.index, salt + 3) * 0.75),
    nearMissed: false,
    warned: false,
    section: node.section,
    pattern: node.pattern,
  });
  // the dial reads as density, so a bigger number is LESS room between
  t.nextHazardAt = absoluteX
    + (820 + tunnelNoise(t.seed, node.index, salt + 4) * 300) * WORMHOLE_DEBRIS_SPACING;
  return true;
}

function populateTunnelNode(w: World, node: TunnelNode, patternPos: number, patternLength: number) {
  const t = w.tunnel!;
  if (node.x <= w.W * 0.55) return;
  const center = (node.top + node.bottom) * 0.5;
  const half = (node.bottom - node.top) * 0.5;
  const u = patternPos / Math.max(1, patternLength - 1);
  let occupied = false;

  if (node.pattern === "debrisWeave") {
    const marks = [Math.round(patternLength * 0.31), Math.round(patternLength * 0.69)];
    const hazardIndex = marks.indexOf(patternPos);
    if (hazardIndex >= 0) {
      const side = (hazardIndex + node.section) % 2 ? -1 : 1;
      occupied = addTunnelHazard(w, node, center + side * half * 0.34, 31 + hazardIndex * 7);
    }
    // A Freeze Acorn appears before the weave, giving the player a clear
    // strategic choice without changing the one-tap control or removing
    // the lethal consequence of a collision.
    if (patternPos === marks[0] - 5) {
      addTunnelPickup(w, node, "slow", center, 48);
      occupied = true;
    }
  } else if (
    (node.pattern === "ribbon" && patternPos === Math.round(patternLength * 0.72)) ||
    (node.pattern === "sweep" && patternPos === Math.round(patternLength * 0.68)) ||
    (node.pattern === "surge" && patternPos === Math.round(patternLength * 0.57))
  ) {
    const side = (node.section + (node.pattern === "sweep" ? 1 : 0)) % 2 ? -1 : 1;
    occupied = addTunnelHazard(w, node, center + side * half * 0.32, 60);
  }

  if (occupied) return;
  if (node.pattern === "acornArc" && patternPos >= 5 && patternPos <= patternLength - 5 && patternPos % 4 === 0) {
    const lane = center + Math.sin(u * Math.PI * 2.15) * half * 0.55;
    const special = Math.abs(patternPos - Math.round(patternLength * 0.5)) <= 2;
    addTunnelPickup(w, node, special ? "multiplier" : "acorn", lane, 71);
    return;
  }

  const absoluteX = node.index * TUNNEL_STEP;
  if (absoluteX < t.nextPickupAt) return;
  const lane = center + (tunnelNoise(t.seed, node.index, 7) - 0.5) * half * 0.62;
  const roll = tunnelNoise(t.seed, node.index, 6);
  // A DETOUR IS AN ACORN RUN, and the cadence has to say so.
  //
  // The standalone Wormhole Run is a survival mode: it is flown for minutes
  // and its acorns are punctuation, one every 330-540px. A detour is
  // FIFTEEN SECONDS and pays nothing else - no gates, no flow, no score -
  // so on that cadence the pilot flew through an empty corridor for the
  // length of the trip and came out with nothing. Measured on the shipped
  // build: THREE pickups offered across a whole 13.8-second trip, which is
  // exactly the empty tunnel in the report.
  //
  // On a detour they come four times as thick, so the corridor reads as a
  // seam worth flying and the trip pays what it promised.
  const spacing = t.detour ? 82 + tunnelNoise(t.seed, node.index, 52) * 52
    : 330 + tunnelNoise(t.seed, node.index, 52) * 210;
  addTunnelPickup(w, node, roll < 0.08 ? "multiplier" : "acorn", lane, 8);
  t.nextPickupAt = absoluteX + spacing;
}

function appendTunnelNode(w: World) {
  const t = w.tunnel!;
  const prev = t.nodes[t.nodes.length - 1];
  const index = prev ? prev.index + 1 : 0;
  if (t.patternLength <= 0 || t.patternPos >= t.patternLength) beginTunnelSection(w);
  const patternPos = t.patternPos;
  const patternLength = t.patternLength;
  const pattern = t.buildPattern;
  const progress = Math.min(1, index * TUNNEL_STEP / 30000);
  const minHalf = tunnelMinHalf(w.H);
  const maxHalf = tunnelMaxHalf(w.H);
  const wave = Math.sin(index * 0.31 + t.seed) * 0.62 + Math.sin(index * 0.117 + 1.8) * 0.38;
  const baseHalf = maxHalf - (maxHalf - minHalf) * progress + wave * 5;
  const previousHalf = prev ? (prev.bottom - prev.top) * 0.5 : t.patternStartHalf;
  const room = Math.max(0, Math.min(1, (baseHalf - minHalf) / Math.max(1, maxHalf - minHalf)));
  const shape = tunnelPatternShape(
    w, pattern, patternPos / Math.max(1, patternLength - 1), baseHalf, room,
    t.patternStartCenter, t.patternDirection,
  );
  // THE LEAD-IN. A pilot thrown in from Lost in Space gets open, straight,
  // empty corridor first: full width, dead centre, nothing in it. Then the
  // real shape is eased in over the blend, because snapping from a straight
  // pipe to a moving one at full speed is the same ambush by another route.
  const lead = t.leadNodes;
  const leadPos = lead > 0 ? index - lead : Infinity;
  const inLead = leadPos < 0;
  const leadMix = leadPos >= TUNNEL_LEAD_BLEND ? 1
    : leadPos < 0 ? 0
    : (leadPos + 1) / (TUNNEL_LEAD_BLEND + 1);
  const targetHalf = inLead ? maxHalf
    : Math.max(minHalf, Math.min(maxHalf, shape.half)) * leadMix + maxHalf * (1 - leadMix);
  const half = Math.max(minHalf, Math.min(maxHalf, previousHalf + Math.max(-8, Math.min(8, targetHalf - previousHalf))));
  const previousCenter = prev ? (prev.top + prev.bottom) * 0.5 : w.H * 0.5;
  // Tight corridors turn more slowly. This is the core feasibility rule:
  // visual intensity can rise, but required vertical travel never rises at
  // the same time as the available space falls.
  const widthRoom = Math.max(0, Math.min(1, (half - minHalf) / Math.max(1, maxHalf - minHalf)));
  const maxTurn = (3.8 + widthRoom * 5.8) * WORMHOLE_TURN;
  const wantCenter = inLead ? w.H * 0.5
    : shape.center * leadMix + w.H * 0.5 * (1 - leadMix);
  let center = previousCenter + Math.max(-maxTurn, Math.min(maxTurn, wantCenter - previousCenter));
  const safeHalf = half;
  center = Math.max(safeHalf + 18, Math.min(w.H - safeHalf - 18, center));
  const node: TunnelNode = {
    x: prev ? prev.x + TUNNEL_STEP : -TUNNEL_STEP,
    top: center - safeHalf,
    bottom: center + safeHalf,
    centerRatio: center / w.H,
    halfRatio: safeHalf / w.H,
    index,
    section: t.buildSection,
    pattern,
    region: t.buildRegion,
    sectionStart: patternPos === 0,
    sectionEnd: patternPos === patternLength - 1,
    announced: false,
    cleared: false,
  };
  t.nodes.push(node);
  // nothing lives in the lead-in: no hazard, no pickup, no decision
  if (!inLead) populateTunnelNode(w, node, patternPos, patternLength);
  t.patternPos += 1;
}

function initTunnel(w: World, forcedSeed?: number, leadNodes = 0) {
  w.tunnel = {
    nodes: [], hazards: [], scoreFloat: 0, detour: false,
    multiplier: 1, bestMultiplier: 1, multiplierLeft: 0,
    flow: 0, flowBest: 0, flowGrace: 0, chain: 0, bestChain: 0,
    sectionsCleared: 0, time: 0, nearMisses: 0,
    nextHazardAt: 1800, nextPickupAt: 720,
    seed: Math.max(1, Math.floor(forcedSeed ?? ((w.missionRng ?? Math.random)() * 1000000 + 1))),
    leadNodes: 0,
    buildSection: -1, buildPattern: "launch", buildRegion: 0,
    patternPos: 0, patternLength: 0,
    patternStartCenter: w.H * 0.5, patternStartHalf: tunnelMaxHalf(w.H),
    patternStartCenterRatio: 0.5,
    patternStartHalfRatio: tunnelMaxHalf(w.H) / w.H,
    patternDirection: 1,
    activePattern: "launch", activeRegion: 0, previousRegion: 0, regionBlend: 1, visualT: 0,
    banner: `${TUNNEL_REGION_NAMES[0]} · ${TUNNEL_PATTERN_NAMES.launch}`,
    bannerKind: "region", bannerLeft: 2.8, nextMilestone: 50,
  };
  w.tunnel.leadNodes = leadNodes;
  // Push the first hazard and pickup past the lead-in as well.
  //
  // THE UNIT HERE IS NODE SPACE, NOT w.distance. Both thresholds are read
  // back as `node.index * TUNNEL_STEP` - see maybePlaceTunnelHazard and
  // maybePlaceTunnelPickup - and node indices start at 0 for every fresh
  // corridor. On a standalone Wormhole Run w.distance also starts at 0, so
  // the two agreed and the mix-up was invisible.
  //
  // On a DETOUR it is anything but: enterWormhole jumps w.distance to as
  // much as 30,000 to pick the corridor's difficulty, so adding it here
  // parked both thresholds thousands of pixels past anything a fifteen
  // second trip could reach. The corridor then spawned NOTHING - no
  // hazards to dodge, and four acorns across a 3,858px trip. That is the
  // empty tunnel in the report, and it is why the detour paid nothing:
  // there was nothing in it to pay with.
  if (leadNodes > 0) {
    const room = leadNodes * TUNNEL_STEP;
    w.tunnel.nextHazardAt = room;
    w.tunnel.nextPickupAt = room * 0.6;
  }
  while (w.tunnel.nodes.length < Math.ceil((w.W + 360) / TUNNEL_STEP) + 2) appendTunnelNode(w);
  w.squirrel.y = w.H * 0.5;
  w.lastGapY = w.H * 0.5;
  w.speed = WORMHOLE_SPEED_BASE;
  w.planets = [];
  w.startShieldArmed = false;
  w.shieldCharges = 0;
}

function addTunnelFlow(t: TunnelState, amount: number) {
  // FLOW IS THE STANDALONE MODE'S SCORING, and on a detour it scores
  // nothing - so it was a meter that filled, glowed, and meant precisely
  // nothing, sitting where the pilot needed to read the clock and the
  // acorn take. Reported in one word: "meaningless". It stays off here.
  if (t.detour) return;
  t.flow = Math.max(0, Math.min(100, t.flow + amount));
  t.flowBest = Math.max(t.flowBest, t.flow);
  t.flowGrace = 2.2;
}

function refreshTunnelMultiplier(t: TunnelState) {
  if (t.detour) { t.multiplier = 1; return; }
  const flowTier = t.flow >= 72 ? 3 : t.flow >= 30 ? 2 : 1;
  t.multiplier = Math.max(flowTier, t.multiplierLeft > 0 ? 2 : 1);
  t.bestMultiplier = Math.max(t.bestMultiplier, t.multiplier);
}

function sweptCircleHit(
  ax0: number, ay0: number, ax1: number, ay1: number,
  bx0: number, by0: number, bx1: number, by1: number,
  radius: number,
) {
  const rx0 = ax0 - bx0;
  const ry0 = ay0 - by0;
  const rvx = (ax1 - ax0) - (bx1 - bx0);
  const rvy = (ay1 - ay0) - (by1 - by0);
  const speedSq = rvx * rvx + rvy * rvy;
  const u = speedSq > 0 ? Math.max(0, Math.min(1, -(rx0 * rvx + ry0 * rvy) / speedSq)) : 0;
  const dx = rx0 + rvx * u;
  const dy = ry0 + rvy * u;
  return dx * dx + dy * dy < radius * radius;
}

export function tunnelBoundsAt(w: World, x: number) {
  const nodes = w.tunnel?.nodes;
  if (!nodes?.length) return { top: 0, bottom: w.H };
  let a = nodes[0];
  let b = nodes[nodes.length - 1];
  for (let i = 1; i < nodes.length; i++) {
    if (nodes[i].x >= x) { a = nodes[i - 1]; b = nodes[i]; break; }
  }
  const f = Math.max(0, Math.min(1, (x - a.x) / Math.max(1, b.x - a.x)));
  return { top: a.top + (b.top - a.top) * f, bottom: a.bottom + (b.bottom - a.bottom) * f };
}

/** THE WORMHOLE ACTUALLY TAKES YOU SOMEWHERE.
 *
 *  It used to flip your heading and call that a wormhole. Catching one now
 *  drops the pilot into a REAL corridor for fifteen seconds and then puts
 *  them back on the gate run exactly where they left it - same planets,
 *  same pickups, same height, same velocity, mid-flight.
 *
 *  The corridor's difficulty rides the gate it was caught at, on the
 *  TUNNEL'S OWN curve rather than a second one invented beside it: the
 *  entry is stamped into w.distance, which is what Wormhole Run already
 *  reads to decide corridor width and speed. Gate 10 enters at 8% of that
 *  curve; gate 120 and beyond enters at the top of it.
 *
 *  Score carries THROUGH rather than restarting - the corridor's run is
 *  seeded with the gate score, so the HUD never drops to zero and jumps
 *  back, and what the pilot earns in there is theirs to keep. A wormhole
 *  is a reward for flying into one. */
export const WORM_TRIP_SECONDS = 15;
/** the gate at which a wormhole opens onto the hardest corridor there is */
export const WORM_PEAK_GATE = 120;

type WormHold = {
  flight: FlightMode;
  planets: PlanetCol[];
  pickups: Pickup[];
  squirrel: { y: number; vy: number; rot: number };
  score: number;
  speed: number; distance: number; lastSpawnX: number; lastGapY: number;
  shieldCharges: number; startShieldArmed: boolean;
  warpTilt: number; warpMirror: boolean; prevTilt: number; prevMirror: boolean;
};

function wormEntryDistance(score: number) {
  return Math.min(30000, (Math.max(0, score) / WORM_PEAK_GATE) * 30000);
}

function enterWormhole(w: World, save: SaveData) {
  w.wormHold = {
    flight: w.flight,
    planets: w.planets, pickups: w.pickups,
    squirrel: { ...w.squirrel },
    score: w.score,
    speed: w.speed, distance: w.distance,
    lastSpawnX: w.lastSpawnX, lastGapY: w.lastGapY,
    shieldCharges: w.shieldCharges, startShieldArmed: w.startShieldArmed,
    warpTilt: w.warpTilt, warpMirror: w.warpMirror,
    prevTilt: w.prevTilt, prevMirror: w.prevMirror,
  };
  const carried = w.score;
  const shields = w.shieldCharges;
  w.wormLeft = WORM_TRIP_SECONDS;
  w.wormExitArmed = false;
  // THE FIRST MOUTH. Being dropped into a corridor at full pace with no
  // idea where its walls are is not difficulty, it is a coin flip - and it
  // is the half of this the report called "instantly teleports you back
  // full swing, with no time to know the position". Both mouths get the
  // same two seconds to read the room.
  w.wormCalm = WORM_CALM_SECONDS;
  w.flight = "tunnel";
  // distance first: initTunnel arms the hazard and pickup thresholds off it,
  // and a wormhole entry jumps it by up to 30,000
  w.distance = wormEntryDistance(carried);
  initTunnel(w, undefined, TUNNEL_LEAD_NODES);
  // initTunnel clears the pilot's shields, because a Wormhole Run of its
  // own has none. This is a DETOUR inside a run, so what the pilot was
  // carrying goes with them.
  w.shieldCharges = shields;
  // THE GATE COUNTER DOES NOT RUN IN HERE.
  //
  // A Wormhole Run scores itself by distance flown - scoreFloat climbs and
  // becomes w.score - and that is right for the standalone mode, where
  // w.score IS the mode's score. On a detour w.score is the GATE COUNT of
  // the run outside, so the corridor was paying gates by the metre:
  // measured at 43 gates for a single fifteen-second trip on Lost, 49 on
  // Deep. Reported as "within two runs i was almost at level 200", which
  // is exactly what two or three trips buy.
  //
  // So the corridor keeps its own float at zero and the frozen gate count
  // is held aside. The trip pays ACORNS. That is the whole benefit, and
  // it is the one the pilot flies for.
  w.tunnel!.scoreFloat = 0;
  w.tunnel!.detour = true;
  w.score = carried;
  // the corridor is flown upright: Lost in Space's lean belongs to the
  // gate run and is waiting for the pilot when they come back
  w.warpTilt = 0; w.warpMirror = false; w.prevTilt = 0; w.prevMirror = false;
  w.warpT = 0; w.warpLeft = 0; w.warpGateEnd = -1;
  w.particles = [];
  w.recoveryMsg = "THROUGH THE WORMHOLE";
  w.shake = 0.3;
}

/** Back to the gate run, exactly as it was left. */
function exitWormhole(w: World, crashed = false) {
  const hold = w.wormHold;
  if (!hold) return;
  w.wormHold = null;
  w.wormLeft = 0;
  w.flight = hold.flight;
  w.tunnel = null;
  w.planets = hold.planets;
  w.pickups = hold.pickups;
  w.squirrel = { ...hold.squirrel };
  w.speed = hold.speed;
  w.distance = hold.distance;
  w.lastSpawnX = hold.lastSpawnX;
  w.lastGapY = hold.lastGapY;
  w.startShieldArmed = hold.startShieldArmed;
  w.warpTilt = hold.warpTilt; w.warpMirror = hold.warpMirror;
  w.prevTilt = hold.prevTilt; w.prevMirror = hold.prevMirror;
  w.particles = [];
  w.wormExitArmed = false;
  // ONE GATE ON, and not one more. The corridor pays acorns; the ladder is
  // climbed by flying gates. In at twenty, out at twenty-one - unless the
  // pilot crashed in the corridor, which is no exit at all (audit, 30 Sep 2026)
  w.score = hold.score + (crashed ? 0 : 1);
  // THE SECOND MOUTH, and the same two seconds. The pilot has been flying a
  // corridor and is being handed back a tilted gate run whose next gate is
  // already on screen; at full pace that is a coin flip, which is what
  // "no time to know the position" meant.
  w.wormCalm = WORM_CALM_SECONDS;
  // A TRIP HAS TO MOVE YOU. Coming back out into the same sky is what made
  // the detour read as a light show with a timer - the whole promise of a
  // wormhole is that the other side is somewhere else. So the zone ladder
  // steps forward one rung per trip, on top of whatever the gate count has
  // earned, and the pilot lands looking at a place they have not flown.
  w.zoneJump += 1;
  w.absorbGrace = Math.max(w.absorbGrace, 1.2);
  w.hitCooldown = 0;
  w.recoveryMsg = "OUT THE FAR SIDE";
  w.shake = 0.24;
}


/** BOTH MOUTHS ARE SLOW.
 *
 *  A wormhole should feel like being thrown across space, and the two
 *  moments that decide whether it feels like that or like a glitch are the
 *  ones where the pilot has no idea where they are: dropped into a corridor
 *  whose walls they have not seen, and dropped back into a gate run whose
 *  next gate is already on top of them.
 *
 *  So both ends open at WORM_CALM_SPEED and ease back to pace over
 *  WORM_CALM_SECONDS. It is a calibration window, not a power-up: it is
 *  short, it is on both sides, and it costs the pilot nothing.
 *
 *  Ticked HERE rather than in the callers because exactly one of the two
 *  update paths runs on any given frame - the tunnel's, or the gate run's -
 *  and putting the clock beside the only thing that reads it means it can
 *  never be double-ticked or forgotten.
 */
function wormCalmFactor(w: World, realDt: number) {
  if (w.wormCalm <= 0) return 1;
  w.wormCalm = Math.max(0, w.wormCalm - realDt);
  const eased = 1 - w.wormCalm / WORM_CALM_SECONDS;   // 0 at the mouth, 1 at pace
  return WORM_CALM_SPEED + (1 - WORM_CALM_SPEED) * eased * eased;
}

/** The door home, put where it can be flown into: the middle of the
 *  corridor a screen and a half ahead, which is far enough to be seen
 *  coming and near enough to be reached. */
function spawnWormExit(w: World) {
  const x = w.W + 150;
  const b = tunnelBoundsAt(w, x);
  w.pickups.push({
    x, y: (b.top + b.bottom) * 0.5,
    got: false, bob: 0, kind: "worm", r: 46, exit: true,
  });
}

function updateTunnel(w: World, save: SaveData, simDt: number, realDt: number): string | null {
  const t = w.tunnel!;
  // a wormhole detour is on a clock; a real Wormhole Run is not
  if (w.wormHold) {
    w.wormLeft -= realDt;
    // THE TRIP ENDS BY BEING FLOWN OUT OF. The clock used to simply post
    // the pilot home mid-corridor, which is the "instantly teleports you
    // back" half of the report - no warning, no aim, no moment. Now the
    // exit opens a few seconds early, in the middle of the corridor where
    // it can actually be reached, and catching it is what ends the trip.
    if (!w.wormExitArmed && w.wormLeft <= WORM_EXIT_LEAD) {
      w.wormExitArmed = true;
      spawnWormExit(w);
    }
    // and if it was missed, put another one up rather than trapping the
    // run in a corridor with no door - the same contract the black hole's
    // exit hole has. The grace is the backstop under that.
    if (w.wormExitArmed && w.wormLeft <= 0 && !w.pickups.some((a) => a.exit)) spawnWormExit(w);
    if (w.wormLeft <= -WORM_EXIT_GRACE) { exitWormhole(w); return "shift"; }
  }
  const progress = Math.min(1, w.distance / 30000);
  const baseSpeed = WORMHOLE_SPEED_BASE + progress * WORMHOLE_SPEED_RAMP;
  // Surge is a real speed event, not just a louder-looking Ribbon. Its
  // corridor is deliberately wide and it never adds extra debris beyond
  // its one authored obstacle.
  w.speed = baseSpeed * (t.activePattern === "surge" ? 1.08 : 1) * wormCalmFactor(w, realDt);
  // Tunnel flight deliberately reuses the main game's gravity and flap
  // impulse. A tap resets upward velocity; gravity owns the descent.
  const oldSy = w.squirrel.y;
  // TAP TO FLY, and only tap to fly.
  //
  // Three controls were built and flown back to back - tap, hold to rise,
  // and Hyper Run's slide - and tap won on the ground that it MATCHES LOST
  // IN SPACE. A wormhole is something you fall into out of another mode,
  // mid-flight, with no briefing; arriving in a corridor that answers to a
  // different verb than the run you were just flying is the thing that
  // kills those runs. The other two read fine on their own and are gone.
  //
  // A tap sets vy outright (see flapOf); gravity owns the rest of the arc.
  w.squirrel.vy = Math.min(WORMHOLE_MAX_VY, w.squirrel.vy + gravOf(save, w) * simDt);
  w.squirrel.y += w.squirrel.vy * simDt;
  w.squirrel.rot = Math.max(-0.48, Math.min(0.72, w.squirrel.vy / 720));
  const move = w.speed * simDt;
  w.distance += move;
  t.visualT += simDt;
  t.time += simDt;
  refreshTunnelMultiplier(t);
  // a detour's corridor scores nothing at all: w.score is the gate count of
  // the run waiting outside and it is held exactly where it was left
  if (!t.detour) {
    t.scoreFloat += move / 100 * t.multiplier;
    w.score = Math.floor(t.scoreFloat);
  }
  if (t.multiplierLeft > 0) {
    t.multiplierLeft = Math.max(0, t.multiplierLeft - realDt);
  }
  if (t.detour) { t.flow = 0; t.flowGrace = 0; }
  else if (t.flowGrace > 0) t.flowGrace = Math.max(0, t.flowGrace - realDt);
  else t.flow = Math.max(0, t.flow - realDt * 3.5);
  if (t.bannerLeft > 0) t.bannerLeft = Math.max(0, t.bannerLeft - realDt);
  if (t.regionBlend < 1) t.regionBlend = Math.min(1, t.regionBlend + realDt * 0.8);
  for (const n of t.nodes) n.x -= move;
  for (const h of t.hazards) h.x -= move;
  for (const a of w.pickups) { a.x -= move; a.bob += simDt * 4; }
  while (t.nodes[t.nodes.length - 1].x < w.W + 280) appendTunnelNode(w);

  let sound: string | null = null;
  for (const n of t.nodes) {
    if (n.sectionStart && !n.announced && n.x <= w.W * 0.82) {
      n.announced = true;
      t.activePattern = n.pattern;
      t.banner = TUNNEL_PATTERN_NAMES[n.pattern];
      t.bannerKind = "pattern";
      t.bannerLeft = 2.2;
      if (t.activeRegion !== n.region) {
        t.previousRegion = t.activeRegion;
        t.activeRegion = n.region;
        t.regionBlend = 0;
        t.banner = `${TUNNEL_REGION_NAMES[n.region]} · ${TUNNEL_PATTERN_NAMES[n.pattern]}`;
        t.bannerKind = "region";
        t.bannerLeft = 2.8;
        sound = "region";
      } else if (!sound) sound = "section";
    }
    if (n.sectionEnd && !n.cleared && n.x <= w.W * PHYS.squirrelX) {
      n.cleared = true;
      t.sectionsCleared += 1;
      addTunnelFlow(t, 4);
    }
  }
  t.nodes = t.nodes.filter((n, i) => n.x > -TUNNEL_STEP * 2 || i >= t.nodes.length - 2);

  // A Wormhole MISSION has a finish line: SURVIVE the level's seconds
  // and the run completes on the spot — stars bank, the sheet comes up.
  if (w.lvl && t.time >= w.lvl.def.gates) {
    settleLevel(w, save, true);
    return null;
  }

  const sx = w.W * PHYS.squirrelX;
  const sy = w.squirrel.y;
  // Pals travel with the pilot visually, but their abilities remain off in
  // this score-normalized mode.
  followPals(w, sx, sy, realDt);
  const bounds = tunnelBoundsAt(w, sx);
  if (sy - PHYS.squirrelR <= bounds.top || sy + PHYS.squirrelR >= bounds.bottom) return die(w, save);
  for (const h of t.hazards) {
    if (!h.warned && h.x <= w.W + 150) {
      h.warned = true;
      if (!sound) sound = "warning";
    }
    const hitRadius = PHYS.squirrelR + h.r * 0.65;
    if (sweptCircleHit(sx, oldSy, sx, sy, h.x + move, h.y, h.x, h.y, hitRadius)) return die(w, save);
    if (!h.nearMissed && h.x <= sx && h.x + move > sx) {
      h.nearMissed = true;
      const cross = move > 0 ? Math.max(0, Math.min(1, (h.x + move - sx) / move)) : 1;
      const passY = oldSy + (sy - oldSy) * cross;
      const clearance = Math.abs(passY - h.y) - hitRadius;
      if (clearance >= 0 && clearance <= 19) {
        t.nearMisses += 1;
        addTunnelFlow(t, 15);
        t.banner = "NEAR MISS  +FLOW";
        t.bannerKind = "reward";
        t.bannerLeft = 1.15;
        if (!sound) sound = "near";
      }
    }
  }
  t.hazards = t.hazards.filter((h) => h.x > -80);

  for (const a of w.pickups) {
    if (a.got) continue;
    const ay = a.y + Math.sin(a.bob) * 4;
    // the way home is a DOOR, not an acorn: it is drawn big and it is
    // caught on its own radius, because a two-second window to find and
    // hit an 18px target after fifteen seconds of corridor is a trap
    if (a.exit) {
      if (!circleHit(sx, sy, PHYS.squirrelR, a.x, ay, a.r ?? 46)) continue;
      a.got = true;
      spark(w, a.x, ay, ["#b45cff", "#fff", "#4ad8ff"], 26, "warp");
      exitWormhole(w);
      return "shift";
    }
    if (!circleHit(sx, sy, PHYS.squirrelR, a.x, ay, 18)) continue;
    a.got = true;
    if (a.kind === "multiplier") {
      t.multiplierLeft = 8;
      addTunnelFlow(t, 28);
      spark(w, a.x, ay, ["#fff4a8", "#ffd060", "#b45cff"], 18, "gold");
      sound = "gold";
    } else if (a.kind === "slow") {
      w.powerLeft = PHYS.powerDuration;
      addTunnelFlow(t, 10);
      spark(w, a.x, ay, ["#6ef0ff", "#fff", "#8ad8ff"], 16, "cyan");
      sound = "freeze";
    } else {
      w.runAcorns += 1;
      t.chain += 1;
      t.bestChain = Math.max(t.bestChain, t.chain);
      addTunnelFlow(t, 4 + Math.min(3, t.chain * 0.25));
      spark(w, a.x, ay, ["#ffd060", "#fff"], 10, "gold");
      sound = "acorn";
    }
  }
  for (const a of w.pickups) {
    if (!a.got && !a.missed && a.x < sx - 22 && a.kind === "acorn" && !a.exit) {
      a.missed = true;
      t.chain = 0;
      if (!t.detour) t.flow = Math.max(0, t.flow - 12);
    }
  }
  w.pickups = w.pickups.filter((a) => a.x > -50 && !a.got && !a.missed);

  const rawDepth = Math.floor(w.distance / 100);
  if (rawDepth >= t.nextMilestone) {
    const reached = t.nextMilestone;
    t.nextMilestone += reached < 200 ? 50 : 100;
    t.banner = reached === 50 ? "CURRENT LOCKED" : reached === 100 ? "DEEP RUN" : reached === 200 ? "LONG HAUL" : `RANGE ${reached}`;
    t.bannerKind = "milestone";
    t.bannerLeft = 2.4;
    if (!sound) sound = "milestone";
  }
  refreshTunnelMultiplier(t);
  return sound;
}

function spark(w: World, x: number, y: number, colors: string[], n = 12, kind = "spark") {
  for (let i = 0; i < n; i++) {
    const ang = Math.random() * Math.PI * 2;
    const sp = 50 + Math.random() * 140;
    w.particles.push({
      x,
      y,
      vx: Math.cos(ang) * sp,
      vy: Math.sin(ang) * sp,
      life: 0.3 + Math.random() * 0.28,
      max: 0.58,
      r: 2 + Math.random() * 3,
      color: colors[i % colors.length],
      kind,
    });
  }
}

export function spawnTrail(w: World, save: SaveData, scale = 1) {
  const trail = trailWornBy(save.equippedTrail, pilotSuitId(w, save));
  // Arcflash emits from its moving wrist and boot nozzles in its own
  // painter. Do not add the generic tail-origin particles or consume RNG.
  if (trail === "arcflashwake") return;
  if (highOrbitTrailSuit(trail)) return;
  // Continuous Star Chart streams are presentation history, like the
  // exclusive wakes above. Do not stack random particle bursts over them.
  if (STAR_CHART_TRAILS.has(trail)) return;
  // the painted pilot's tail sweeps far to the left — emit behind it or
  // the whole plume is swallowed by the sprite
  const sx = pilotX(w) - 34;
  const sy = w.squirrel.y + 8;
  if (scale < 1 && Math.random() > scale) return;
  const colors = (TRAILS.find((t) => t.id === trail) ?? TRAILS[0]).colors;
  if (trail === "vanguardwake") {
    for (const lane of [-1, 1]) w.particles.push({
      x: sx, y: sy + lane * 3, vx: -150, vy: lane * 7,
      life: .34, max: .34, r: 1.1, color: colors[lane < 0 ? 0 : 1], kind: "vanguardwake",
    });
  } else if (trail === "ion") {
    for (let i = 0; i < 8; i++) {
      w.particles.push({
        x: sx,
        y: sy + (Math.random() - 0.5) * 6,
        vx: -150 - Math.random() * 160,
        vy: (Math.random() - 0.5) * 30,
        life: 0.22 + Math.random() * 0.15,
        max: 0.37,
        r: 1.4 + Math.random() * 1.6,
        color: colors[0],
        kind: "ion",
      });
    }
  } else if (trail === "bubble") {
    for (let i = 0; i < 7; i++) {
      w.particles.push({
        x: sx,
        y: sy,
        vx: -50 - Math.random() * 70,
        vy: -20 - Math.random() * 50,
        life: 0.5 + Math.random() * 0.35,
        max: 0.85,
        r: 2 + Math.random() * 3.5,
        color: colors[0],
        kind: "bubble",
      });
    }
  } else if (trail === "bloom") {
    for (let i = 0; i < 6; i++) {
      w.particles.push({
        x: sx,
        y: sy,
        vx: -55 - Math.random() * 70,
        vy: (Math.random() - 0.5) * 70,
        life: 0.4 + Math.random() * 0.3,
        max: 0.7,
        r: 1.5 + Math.random() * 2,
        color: colors[i % colors.length],
        kind: "bloom",
      });
    }
  } else if (trail === "comet") {
    for (let i = 0; i < 12; i++) {
      w.particles.push({
        x: sx,
        y: sy + (Math.random() - 0.5) * 7,
        vx: -160 - Math.random() * 240,
        vy: (Math.random() - 0.5) * 50,
        life: 0.5 + Math.random() * 0.4,
        max: 0.9,
        r: 2.4 + Math.random() * 3.2,
        color: colors[1],
        kind: "comet",
      });
    }
    for (let i = 0; i < 4; i++) {
      w.particles.push({
        x: sx + (Math.random() - 0.5) * 6,
        y: sy + (Math.random() - 0.5) * 6,
        vx: -60 - Math.random() * 80,
        vy: (Math.random() - 0.5) * 30,
        life: 0.2 + Math.random() * 0.12,
        max: 0.32,
        r: 3 + Math.random() * 2,
        color: "#fff8d0",
        kind: "cometcore",
      });
    }
  } else if (trail === "prism") {
    for (let i = 0; i < 9; i++) {
      w.particles.push({
        x: sx,
        y: sy + (Math.random() - 0.5) * 8,
        vx: -90 - Math.random() * 150,
        vy: (Math.random() - 0.5) * 80,
        life: 0.35 + Math.random() * 0.25,
        max: 0.6,
        r: 2 + Math.random() * 2.4,
        color: colors[i % colors.length],
        hue: Math.random() * 360,
        spin: (Math.random() - 0.5) * 12,
        kind: "prism",
      });
    }
  } else if (trail === "plasma") {
    for (let i = 0; i < 5; i++) {
      w.particles.push({
        x: sx,
        y: sy + (Math.random() - 0.5) * 8,
        vx: -140 - Math.random() * 180,
        vy: (Math.random() - 0.5) * 40,
        life: 0.16 + Math.random() * 0.12,
        max: 0.28,
        r: 1.6 + Math.random() * 1.4,
        color: colors[1],
        seed: Math.random() * 10,
        kind: "plasma",
      });
    }
    w.particles.push({
      x: sx,
      y: sy,
      vx: -60,
      vy: 0,
      life: 0.14,
      max: 0.14,
      r: 3.4,
      color: "#fff",
      kind: "plasmacore",
    });
  } else if (trail === "galaxy") {
    for (let i = 0; i < 12; i++) {
      w.particles.push({
        x: sx,
        y: sy + (Math.random() - 0.5) * 10,
        vx: -40 - Math.random() * 90,
        vy: (Math.random() - 0.5) * 40,
        life: 0.5 + Math.random() * 0.4,
        max: 0.9,
        r: 1.2 + Math.random() * 1.6,
        color: colors[i % colors.length],
        kind: "galaxy",
      });
    }
  } else if (trail === "aurora") {
    for (let i = 0; i < 8; i++) {
      w.particles.push({
        x: sx,
        y: sy + (Math.random() - 0.5) * 10,
        vx: -70 - Math.random() * 80,
        vy: (Math.random() - 0.5) * 50,
        life: 0.45 + Math.random() * 0.3,
        max: 0.75,
        r: 2 + Math.random() * 2.4,
        color: colors[i % colors.length],
        kind: "aurora",
      });
    }
  } else if (trail === "frost") {
    for (let i = 0; i < 8; i++) {
      w.particles.push({
        x: sx,
        y: sy + (Math.random() - 0.5) * 8,
        vx: -80 - Math.random() * 90,
        vy: (Math.random() - 0.5) * 40,
        life: 0.4 + Math.random() * 0.3,
        max: 0.7,
        r: 1.6 + Math.random() * 2,
        color: colors[i % colors.length],
        kind: "frost",
      });
    }
  } else if (trail === "voidsmoke") {
    for (let i = 0; i < 7; i++) {
      w.particles.push({
        x: sx,
        y: sy,
        vx: -40 - Math.random() * 50,
        vy: (Math.random() - 0.5) * 30,
        life: 0.6 + Math.random() * 0.4,
        max: 1,
        r: 4 + Math.random() * 5,
        color: colors[i % colors.length],
        kind: "voidsmoke",
      });
    }
  } else if (trail === "supernova") {
    for (let i = 0; i < 14; i++) {
      w.particles.push({
        x: sx,
        y: sy + (Math.random() - 0.5) * 8,
        vx: -120 - Math.random() * 180,
        vy: (Math.random() - 0.5) * 70,
        life: 0.35 + Math.random() * 0.3,
        max: 0.65,
        r: 2 + Math.random() * 3,
        color: colors[i % colors.length],
        kind: "supernova",
      });
    }
  } else if (trail === "opalfeather") {
    for (let i = 0; i < 7; i++) {
      w.particles.push({
        x: sx, y: sy + (Math.random() - 0.5) * 9,
        vx: -72 - Math.random() * 105, vy: (Math.random() - 0.5) * 42,
        life: 0.52 + Math.random() * 0.32, max: 0.84,
        r: 2.2 + Math.random() * 2.1, color: colors[i % colors.length],
        hue: Math.random() * 360, spin: (Math.random() - 0.5) * 4,
        kind: "opalfeather",
      });
    }
  } else if (trail === "clockwork") {
    for (let i = 0; i < 5; i++) {
      w.particles.push({
        x: sx, y: sy + (Math.random() - 0.5) * 10,
        vx: -58 - Math.random() * 86, vy: (Math.random() - 0.5) * 35,
        life: 0.62 + Math.random() * 0.34, max: 0.96,
        r: 2.4 + Math.random() * 2.2, color: colors[i % colors.length],
        hue: Math.random() * 360, spin: Math.random() < 0.5 ? -2.2 : 2.2,
        kind: "clockwork",
      });
    }
  } else if (trail === "celestialtide") {
    for (let i = 0; i < 7; i++) {
      w.particles.push({
        x: sx, y: sy + (Math.random() - 0.5) * 8,
        vx: -82 - Math.random() * 105, vy: (Math.random() - 0.5) * 48,
        life: 0.5 + Math.random() * 0.3, max: 0.8,
        r: 2 + Math.random() * 2.4, color: colors[i % colors.length],
        seed: Math.random() * Math.PI * 2, kind: "celestialtide",
      });
    }
  } else if (trail === "phoenixplume") {
    for (let i = 0; i < 8; i++) {
      w.particles.push({
        x: sx, y: sy + (Math.random() - 0.5) * 9,
        vx: -88 - Math.random() * 125, vy: -12 - Math.random() * 44,
        life: 0.48 + Math.random() * 0.32, max: 0.8,
        r: 2.3 + Math.random() * 2.4, color: colors[i % colors.length],
        hue: Math.random() * 360, spin: (Math.random() - 0.5) * 5,
        kind: "phoenixplume",
      });
    }
  } else if (trail === "verdantflourish") {
    for (let i = 0; i < 7; i++) {
      w.particles.push({
        x: sx, y: sy + (Math.random() - 0.5) * 10,
        vx: -62 - Math.random() * 92, vy: (Math.random() - 0.5) * 50,
        life: 0.58 + Math.random() * 0.34, max: 0.92,
        r: 2 + Math.random() * 2.2, color: colors[i % colors.length],
        hue: Math.random() * 360, spin: (Math.random() - 0.5) * 3,
        kind: "verdantflourish",
      });
    }
  } else if (trail === "eclipseglyph") {
    for (let i = 0; i < 6; i++) {
      w.particles.push({
        x: sx, y: sy + (Math.random() - 0.5) * 9,
        vx: -56 - Math.random() * 85, vy: (Math.random() - 0.5) * 34,
        life: 0.62 + Math.random() * 0.38, max: 1,
        r: 2.5 + Math.random() * 2.5, color: colors[i % colors.length],
        hue: Math.random() * 360, spin: Math.random() < 0.5 ? -1.4 : 1.4,
        kind: "eclipseglyph",
      });
    }
  } else {
    for (let i = 0; i < 9; i++) {
      w.particles.push({
        x: sx,
        y: sy,
        vx: -80 - Math.random() * 120,
        vy: (Math.random() - 0.5) * 90,
        life: 0.22 + Math.random() * 0.18,
        max: 0.42,
        r: 2 + Math.random() * 3,
        color: colors[i % colors.length],
        kind: "flame",
      });
    }
  }
}


/** THE GESTURE RECOGNISER, and the reason the lesson is teachable.
 *
 *  While the tutorial is LOCKED a tap or a swipe is not a force. It is an
 *  answer to the beat on screen: the director checks whether it is the
 *  gesture being asked for, and if it is, runs the beat itself - on the
 *  game's own physics, so what the pilot sees is the real thing rather than
 *  an animation of it.
 *
 *  Two properties matter, and both were missing before:
 *
 *    * THERE IS NO WINDOW. The beat waits indefinitely. A pilot cannot be
 *      early, cannot be late, and never learns that the game ignores them.
 *    * A REPEAT DOES NOTHING. `want` is cleared the moment a gesture lands,
 *      so the second tap of an eager double-tap falls through to a beat
 *      that is no longer asking for anything.
 *
 *  Returns true when the gesture was consumed, which is the caller's signal
 *  to apply no physics of its own.
 */
function tutGesture(w: World, save: SaveData, kind: "tap" | "swipe"): boolean {
  const t = w.tut;
  // THE LOCK AND THE FREEZE ARE DIFFERENT QUESTIONS. `locked` decides
  // whether a tap flies the pilot; `hold` means a popup is up waiting to be
  // pressed past. The pal beat freezes AFTER control has been handed over,
  // so gating this on the lock alone left it unanswerable - the lesson
  // stalled there for good, with the tap going to ordinary flight instead.
  if (!t || (!t.locked && !t.hold)) return false;
  // A MESSAGE GETS A MOMENT TO BE READ.
  //
  // The companion's popup arrives while the pilot is mid-rhythm on the gate
  // run, so the tap already on its way dismissed it before the words were on
  // screen - "you fly through the message instantly". A beat that is WAITING
  // for a gesture still waits forever; this only holds off the press-to-go-on
  // beats, and only for TUT_READ, which is the same moment the "tap to
  // continue" line finishes fading in. It is not an arming window on a
  // lesson - nothing is being asked of the pilot yet - so it cannot teach
  // them that the game ignores taps.
  if (t.want === "continue" && t.t < TUT_READ) return true;
  // a tap answers a "press to go on" beat as readily as a "tap" one
  const answered = t.want === kind || (t.want === "continue" && kind === "tap");
  if (!answered) {
    // the wrong gesture is not a failure, it is a nudge - and a tap during
    // the swipe lesson is the one everybody tries first
    if (t.want === "swipe" && kind === "tap") t.nudge = "swipe DOWN - drag, don't tap";
    return true;                       // consumed either way: nothing is flown while locked
  }
  t.want = null;
  t.nudge = "";
  t.t = 0;
  switch (t.stage) {
    case "doTap1":
    case "doTap2":
      // the beat IS a tap, so it flies one - real impulse, real gravity
      t.hold = false;
      t.stage = t.stage === "doTap1" ? "levelOff" : "learnDive";
      const tutorialImpulse = w.squirrel.vy-flapOf(save,w);
      w.squirrel.vy = flapOf(save, w);
      w.flapBoost = 0.22;
      w.tapAnimFromRot = w.squirrel.rot;
      w.tapAnimT = 0;
      w.tapAnimDir = 1;
      if (pilotSuitId(w, save) === "vanguard") vanguardTap(w.vanguard,tutorialImpulse);
      if (pilotSuitId(w, save) === "arcflash") arcflashTap(w.arcflash, tutorialImpulse);
      if (isHighOrbit(pilotSuitId(w, save))) highOrbitTap(w.highOrbit, tutorialImpulse, premiumRepeat(w, save));
      break;
    case "doDive":
      t.hold = false;
      t.stage = "diving";
      w.bounceUp = false;
      w.squirrel.vy = PHYS.dive;
      w.squirrel.rot = 0.5;
      if (pilotSuitId(w, save) === "vanguard") vanguardDive(w.vanguard);
      if (pilotSuitId(w, save) === "arcflash") arcflashDive(w.arcflash);
      break;
    case "learnTap":
    case "learnTap2":
    case "boing":
    case "pal":
      // a frozen popup the pilot presses past
      t.hold = false;
      t.stage = t.stage === "learnTap" ? "doTap1"
        : t.stage === "learnTap2" ? "doTap2"
          : t.stage === "boing" ? "bouncing" : "gates7";
      // THE BOUNCE HAS TO ACTUALLY FLY. Leaving `boing` on whatever
      // velocity the contact left behind meant the bounce beat resolved on
      // its first frame and the pilot never saw the arc they were just told
      // about. The spring is fired here, and from there it is ordinary
      // gravity - the same one-impulse rule as every other beat.
      if (t.stage === "bouncing") {
        w.bounceUp = false;
        w.squirrel.vy = -640;
        w.hitCooldown = 0;
        // AT FULL SPEED. Touching the teaching planet trips the protection,
        // and the protection drags the world to 0.55x - so the bounce the
        // pilot was just promised played at 0.55 squared of gravity, 393
        // against 1300. The planet is a lesson, not a save; the slow is
        // cleared so the arc is the one they will actually fly.
        w.shieldSlow = 0;
        w.shieldFreeze = 0;
      }
      if (t.stage === "doTap1" || t.stage === "doTap2") {
        t.want = "tap";
        // A WAITING BEAT HOLDS THE WORLD. The indicator says "tap now" and
        // the director waits as long as it takes - but gravity was still
        // running underneath, so the pilot sank the whole time they were
        // reading it. On the reported run the squirrel fell most of a
        // screen between the prompt appearing and the tap landing, which
        // makes the lesson's own instruction the thing that drops you.
        t.hold = true;
      }
      // the companion's stretch is laid when the companion arrives, so a
      // rewind inside the three never has to tidy up gates from later on
      if (t.stage === "gates7") {
        buildTutorialGates(w, save, 7);
        w.pickups.push({ x: w.lastSpawnX + 300, y: w.lastGapY, got: false, bob: 0,
                         kind: "portal", r: 64 });
      }
      break;
    case "handover":
      // THE ONE PLACE THE LOCK COMES OFF, and it never goes back on
      t.hold = false;
      t.locked = false;
      t.stage = "gates3";
      t.streak = 0;
      t.gates = 0;
      t.streakX = w.distance;
      // the gate the coach says is "lined up" is laid now, ahead of
      // wherever the bounce actually left the pilot
      w.lastSpawnX = w.W * PHYS.squirrelX + 240;
      w.lastGapY = w.squirrel.y;
      buildTutorialGates(w, save, 3);
      break;
    default:
      break;
  }
  return true;
}

export function flap(w: World, save: SaveData) {
  if (w.screen === "pause") return "none";
  if (w.screen !== "play") return "none";
  // WHILE THE LESSON IS SCRIPTED, A TAP IS AN ANSWER, NOT A FORCE.
  // tutGesture runs the beat itself when the gesture is the one being
  // asked for; either way nothing here flies the pilot.
  if (w.tut?.locked || w.tut?.hold) {
    // THE WORLD HAS TO BE RUNNING FOR THE LESSON TO BE FLYABLE. `ready`
    // freezes everything until the first tap, and returning before this
    // line left it set for the whole scripted phase - the director fired
    // its beats, the impulses landed, and nothing moved because the sim was
    // still held. Every beat then resolved on its timeout instead of on the
    // physics, which is exactly the "scripted rate" failure this design
    // exists to avoid.
    if (w.ready) w.ready = false;
    tutGesture(w, save, "tap");
    return "none";
  }
  if (w.ready) w.ready = false;
  // THE SPILL flies its own ship, and its tap is the same kick skyward it
  // is everywhere else. A tap its phase refuses - the Depot, the respawn
  // freeze, the autopilot before a hand takes the stick - is not a tap, so
  // nothing below counts it or animates it.
  if (w.spill && !spillTap(w.spill)) return "none";
  // the road's contracts fly on both pages: these modifiers follow the mission, not the page
  if (!w.tut && w.flight === "fly") {
    // SWITCHBACK (owner, 7 Sep 2026): the companion makes every tap toggle
    // the slow, the way the frozen acorn does - a slow, never a full stop.
    // a mission's Stopwatch ignores the Pal Effects switch, like every
    // other designated pal
    if (fxOf(w).tapFreeze || (runPals(save, w).includes("switchback") && (!!w.lvl || !save.noPalFx))) w.tapFrozen = !w.tapFrozen;
    if (w.stuck) { w.stuck = false; w.hitCooldown = .75; }
  }
  w.run.taps += 1;
  if (w.lvl) {
    w.lvl.stats.taps += 1;
  }
  // the Flight Test dock reads a measured taps/s off this log - the
  // autopilot's taps and the tester's own thumb alike
  if (w.flightTest) {
    w.flightTest.tapLog.push(w.time);
    if (w.flightTest.tapLog.length > 64) w.flightTest.tapLog.shift();
  }
  w.lampT = 0;              // NIGHTGLIDER's lamp is lit the same way
  // A repeated tap while the burst is still playing keeps the current body
  // pose and recovery clock. Physics, particles, pitch, and the live tail
  // spring still respond immediately, so the new input adds motion without
  // forcing the painted body through its idle/anticipation bookend again.
  if (w.tapAnimT < 0) {
    w.tapAnimT = 0;
    w.tapAnimDir = 1;
    w.tapAnimFromRot = w.squirrel.rot;
  } else if (repeatTapMode(pilotSuitId(w, save), save) === "finish") {
    // Rewinding on every short tap traps painted banks in their first poses.
    // Finish the gesture, then replay once for input accepted during it.
    w.tapAnimQueued = true;
  } else if (repeatTapMode(pilotSuitId(w, save), save) === "restart") {
    // the owner's third answer: every tap is a fresh gesture from frame one
    w.tapAnimT = 0;
    w.tapAnimDir = 1;
    w.tapAnimFromRot = w.squirrel.rot;
    w.tapAnimQueued = false;
  } else {
    // A repeat tap REWINDS the picture: the animation plays backward from
    // wherever it is, bounces off the start, and runs through to the end
    // again — a natural second wingbeat, never a hyper-speed restart.
    w.tapAnimDir = -1;
  }
  if (!w.spill) {
    const impulse = w.squirrel.vy-flapOf(save,w);
    w.squirrel.vy = flapOf(save, w);
    if (pilotSuitId(w, save) === "vanguard") vanguardTap(w.vanguard,impulse);
    if (pilotSuitId(w, save) === "arcflash") arcflashTap(w.arcflash, impulse);
    if (isHighOrbit(pilotSuitId(w, save))) highOrbitTap(w.highOrbit, impulse, premiumRepeat(w, save));
  }
  w.flapBoost = 0.22;
  // the body reaction spring takes a bounded impulse per accepted tap
  w.tapReactV += 26;
  if (w.tapReact > 1) w.tapReact = 1;
  // the tail drags DOWN as the pilot shoots up, then whips back
  w.tailV += TAIL.flap * tailSpringFor(save, pilotSuitId(w, save)).kick;
  spawnTrail(w, save);
  return "flap";
}

export function dive(w: World, save: SaveData) {
  if (w.screen !== "play" || w.ready) return "none";
  w.tapAnimQueued = false;
  // a dive throws the tail the other way, harder — it over-rotates past
  // home on the way back and rings down, which reads as weight falling
  w.tailV -= TAIL.dive * tailSpringFor(save, pilotSuitId(w, save)).kick;
  if (w.spill) {
    if (!spillBurst(w.spill, 1)) return "none";
    spark(w, w.spill.pilot.x, w.squirrel.y - 16, ["#c8d0e0", "#fff"], 10, "poof");
    return "dive";
  }
  // the same rule as a tap: while the lesson is scripted the swipe is an
  // answer, and the director flies the dive if this is the beat for it
  if (w.tut?.locked || w.tut?.hold) {
    const before = w.tut.stage;
    tutGesture(w, save, "swipe");
    return w.tut.stage === "diving" && before !== "diving" ? "dive" : "none";
  }
  if (pilotSuitId(w, save) === "vanguard") vanguardDive(w.vanguard);
  if (pilotSuitId(w, save) === "arcflash") arcflashDive(w.arcflash);
  if (w.bounceUp && w.hitCooldown > 0) {
    w.bounceUp = false;
    w.squirrel.vy = PHYS.bounceCancel;
    w.squirrel.rot = 0.35;
    spark(w, w.W * PHYS.squirrelX, w.squirrel.y - 14, ["#e8dcc8", "#fff"], 6, "poof");
    return "dive";
  }
  w.squirrel.vy = PHYS.dive;
  w.squirrel.rot = 0.5;
  w.bounceUp = false;
  spark(w, w.W * PHYS.squirrelX, w.squirrel.y - 16, ["#c8d0e0", "#fff"], 10, "poof");
  return "dive";
}

/** how much of a gate's planet must stay on screen once the world is tilted */
export const PLANET_ON_SCREEN = 0.75;

/** The tilt the playfield is CURRENTLY drawn at, without the fold's spin.
 *  draw's applyWarp adds the spin on top; the spin is a half-second flourish
 *  during which everything is turning anyway, so the edge limit below tracks
 *  the settled angle and does not chase it. One function so the limit and
 *  the render can never disagree about how far the world is leaning. */
export function tiltNow(w: World) {
  const lost = w.flight === "lost";
  const wp = w.warpT > 0 ? 1 - w.warpT
    : w.warpLeft > 0 || w.warpGateEnd >= 0 || lost ? 1 : 0;
  if (wp <= 0) return 0;
  return w.prevTilt + (w.warpTilt - w.prevTilt) * wp;
}

/** WHERE A GATE ACTUALLY SITS, with a limit on the screen edges.
 *
 *  The playfield is drawn rotated about its centre, so a gate dx from that
 *  centre is painted dx*sin(t) away from where it sits. Lost in Space leans
 *  up to 40 degrees continuously, which was walking whole planets off the
 *  bottom on the approach - measured on the reporting phone, none of the
 *  planet left on screen at the worst moment.
 *
 *  Clamping where gates may SPAWN would have cost 45% of Lost's vertical
 *  range and a third of Normal's, because a spawn clamp has to reserve for
 *  the worst tilt at all times. This limit is applied to the LIVE position
 *  instead, so it costs nothing until the lean actually threatens an edge.
 *
 *  Both planets are held, not just the low one. Pushing a gate up to rescue
 *  its bottom planet is exactly how the top one would leave the screen, so
 *  the top's own limit caps the push - and when the gate is too tall to
 *  satisfy both at that angle, the overflow is split evenly rather than
 *  spent entirely on one edge.
 *
 *  Every reader goes through here - collision, the tutorial's safe spot and
 *  both painters - so what the pilot flies into is what the pilot sees. */
export function liveGapY(p: PlanetCol, w?: World) {
  return p.gapY + gateOffset(p, w);
}

/** HOW FAR THE WHOLE GATE HAS MOVED from where it was spawned - its sway
 *  plus whatever the edge limit is asking of it. The planets and the rocks
 *  sealing the column both add THIS, so a gate that is nudged travels as one
 *  piece; adding the sway in two places and the nudge in one is precisely
 *  how a seal would tear away from its planets, and how collision would
 *  start disagreeing with the picture. */
export function gateOffset(p: PlanetCol, w?: World) {
  const sway = Math.sin(p.drift) * p.driftAmp;
  // a solo teaching planet is where it was put, on purpose - see PlanetCol
  if (p.solo) return sway;
  if (!w) return sway;
  const y = p.gapY + sway;
  const t = tiltNow(w);
  const cos = Math.cos(t);
  if (!(Math.abs(cos) > 1e-3)) return sway;
  const half = p.gap / 2 + p.r;
  const lean = (p.x - w.W / 2) * Math.sin(t);
  const mid = w.H / 2;
  // the far edge of a planet may hang this far past the screen and still
  // count as on it
  const slack = p.r * (2 * PLANET_ON_SCREEN - 1);
  const low = mid + lean + (y + half - mid) * cos;    // bottom planet, on screen
  const high = mid + lean + (y - half - mid) * cos;   // top planet, on screen
  const over = low - (w.H - slack);                   // >0: too low, wants to rise
  const under = slack - high;                         // >0: too high, wants to sink
  if (over <= 0 && under <= 0) return sway;
  // too tall to hold both at this angle: share the overflow instead of
  // spending it all on one edge
  if (over > 0 && under > 0) return sway + (under - over) / (2 * cos);
  return sway + (over > 0 ? -over / cos : under / cos);
}

function circleHit(x1: number, y1: number, r1: number, x2: number, y2: number, r2: number) {
  return Math.hypot(x1 - x2, y1 - y2) < r1 + r2;
}

function bounceOff(w: World, save: SaveData, px: number, py: number, mul = 1) {
  // THE TEACHING LAUNCH IS NOT INTERRUPTIBLE. The tutorial's bounce stage
  // fires one arc that peaks exactly where the swipe lesson is taught, and
  // this function overwrites vy on contact - which is precisely how that
  // arc kept being cancelled, leaving the pilot on the floor being told to
  // dive. The pilot is mid-scripted-flight here; a second contact is not a
  // new event, it is the same planet they are leaving.
  if (w.tut?.stage === "bouncing" && w.tut.launched) return;
  const sx = w.W * PHYS.squirrelX;
  const sy = w.squirrel.y;
  let dx = sx - px;
  let dy = sy - py;
  const dist = Math.hypot(dx, dy) || 1;
  dx /= dist;
  dy /= dist;
  const incomingVy = w.squirrel.vy;
  const jelly = hasPal(save, w, "voidjelly") ? 0.55 : 1;
  const mag = Math.min(560, 170 + Math.abs(w.squirrel.vy) * 0.5) * jelly * (fxOf(w).bounceScale ?? 1) * mul;
  w.squirrel.vy = dy * mag + (dy >= 0 ? 90 : -160);
  w.bounceAnimT = 0;
  w.bounceAnimDir = dy >= 0 ? 1 : -1;
  w.bounceAnimStrength = Math.max(0.68, Math.min(1, Math.abs(incomingVy) / 430));
  // Contact throws the plume opposite the rebound. This is additive to the
  // existing spring, so the authored impact settles naturally afterward.
  w.tailV += w.bounceAnimDir * (5.5 + 2.5 * w.bounceAnimStrength);
  if (pilotSuitId(w, save) === "vanguard") {
    vanguardContact(w.vanguard, sx - dx * 18, sy - dy * 18, dx, dy,
      Math.max(.68, Math.min(1, Math.abs(incomingVy) / 430)));
  }
  if (pilotSuitId(w, save) === "arcflash") {
    arcflashContact(w.arcflash, dy, Math.max(.68, Math.min(1, Math.abs(incomingVy) / 430)));
  }
  // PRISMWING. Contact repaints the SKY, and only the sky: a new hue every
  // bounce, stepped at least 60 degrees off the last so no two in a row
  // read as the same colour. Planets keep their zone and debris keeps its
  // palette - a pilot still has to recognise what is about to hit them.
  if (hasPal(save, w, "prismwing")) {
    w.prismHue = (w.prismHue + 60 + Math.random() * 240) % 360;
  }
  w.bounceUp = w.squirrel.vy < 0;
  w.squirrel.y += dy * 14;
  w.squirrel.rot = dy >= 0 ? 0.85 : -0.55;
  w.hitCooldown = 0.55;
  w.shake = 0.18;
  if (w.lvl) w.lvl.stats.bounces += 1;
  {
    const fx = fxOf(w);
    const stick = fx.sticky ? 1 : Math.max(0, Math.min(1, fx.stickChance ?? 0));
    if (stick > 0 && (w.missionRng ?? Math.random)() < stick) { w.stuck = true; w.squirrel.vy = 0; }
  }
  spark(w, sx, sy, ["#e8dcc8", "#ffd080", "#fff"], 18);
}

function pushOut(w: World, px: number, py: number, pr: number, sr: number) {
  const sx = w.W * PHYS.squirrelX;
  const rr = pr + sr;
  const dx = sx - px;
  if (Math.abs(dx) >= rr) return;
  const dyNeed = Math.sqrt(rr * rr - dx * dx);
  const above = w.squirrel.y <= py;
  w.squirrel.y = above ? py - dyNeed : py + dyNeed;
  if (above ? w.squirrel.vy > 0 : w.squirrel.vy < 0) w.squirrel.vy = 0;
}

function safeY(w: World) {
  const sx = w.W * PHYS.squirrelX;
  let best: PlanetCol | null = null;
  for (const p of w.planets) {
    if (p.x + p.r < sx - 20) continue;
    if (!best || p.x < best.x) best = p;
  }
  return best ? liveGapY(best, w) : w.H * 0.45;
}

function clearDebrisNear(w: World, x: number, y: number, r1: number, x2: number, y2: number, r2: number) {
  for (const p of w.planets) {
    p.blockers = p.blockers.filter((b) => {
      const ax = blockerX(p, b, w);
      return Math.hypot(ax - x, b.y - y) > r1 && Math.hypot(ax - x2, b.y - y2) > r2;
    });
  }
}

function absorb(w: World, bx?: number, by?: number) {
  const sx = w.W * PHYS.squirrelX;
  const cy = safeY(w);
  w.shieldCharges -= 1;
  if (w.lvl) w.lvl.stats.shieldsSpent += 1;
  if (bx !== undefined && by !== undefined) {
    spark(w, bx, by, ["#7ad8ff", "#5dff9e", "#fff"], 16, "shield");
    clearDebrisNear(w, bx, by, 110, sx, cy, 150);
  }
  w.squirrel.y = cy;
  w.squirrel.vy = 0;
  w.squirrel.rot = 0;
  w.hitCooldown = 0;
  w.bounceUp = false;
  w.shieldFreeze = 0.7;
  w.shieldSlow = 3;
  w.absorbGrace = 2.2;
  w.recoveryMsg = "SHIELD ABSORBED!";
  w.shake = 0.22;
  spark(w, sx, cy, ["#7ad8ff", "#fff", "#4ad8ff"], 16, "shield");
}

function lostTiltAt(p: number) {
  // the two weights sum to 1, so LOST_TILT_MAX is the exact peak, not a bound
  return LOST_TILT_MAX * (0.6 * Math.sin(p * 0.35) + 0.4 * Math.sin(p * 0.13 + 1.3));
}

function pickWarpVariant(w: World) {
  const variant = Math.floor((w.missionRng ?? Math.random)() * 5);
  w.warpMirror = variant < 3;
  const TILT = WARP_TILT_MAX;
  w.warpTilt = variant === 0 ? 0 : variant === 1 || variant === 3 ? TILT : -TILT;
}

// The playfield is only visibly warped when it is mirrored or tilted.
// Upright and unmirrored is the identity transform — it looks exactly
// like no warp at all, which is why a warp that lands there feels like
// nothing happened and then announces that it is over.
function warpVisible(tilt: number, mirror: boolean) {
  return mirror || Math.abs(tilt) > 1e-3;
}

function startSwirl(w: World, kind: "hole" | "worm" | "shift" | "timeline") {
  w.prevMirror = w.warpMirror;
  w.prevTilt = w.warpTilt;
  // A timeline shift is a fold, not a reorientation: the world spins
  // through the crossing and comes back exactly as it was. Only the hand
  // painting it is different on the far side.
  if (kind === "timeline") { /* prev === current, so the fold returns home */ }
  else if (kind === "worm") w.warpMirror = !w.warpMirror;
  else pickWarpVariant(w);
  // Outside Lost in Space — where the tilt is driven continuously — a
  // flip can land on upright-and-unmirrored, which draws identically to
  // no warp. Catching one then had no effect for fifteen seconds. Give
  // it a tilt so a wormhole always reorients something.
  if (kind !== "timeline" && w.flight !== "lost" && !warpVisible(w.warpTilt, w.warpMirror)) {
    w.warpTilt = WARP_TILT_MAX * ((w.missionRng ?? Math.random)() < 0.5 ? 1 : -1);
  }
  w.warpKind = kind;
  w.warpT = 1;
  if (kind === "hole") w.run.holes += 1;
}

function enterWarp(w: World, save: SaveData) {
  const sx = w.W * PHYS.squirrelX;
  const cy = safeY(w);
  clearDebrisNear(w, sx, cy, 150, sx, cy, 150);
  // AND SWEEP THE DOORS ALREADY IN FLIGHT.
  //
  // The spawn guard stops new holes being rolled while warped, which is
  // most of the job - but a hole spawns 64px ahead of a gate, so one can
  // already be on its way when the pilot catches a DIFFERENT hole a gate
  // earlier. That one is not a new roll and the guard never saw it: it
  // just scrolls into the warp behind them. Measured at about one warp in
  // seventy, which is exactly the rate at which this keeps being spotted
  // and not reproduced.
  //
  // The exit is deliberately exempt - it is the only hole that belongs in
  // here, and on a gate-counted stretch it may already have spawned.
  w.pickups = w.pickups.filter(
    (a) => a.got || a.exit || (a.kind !== "hole" && a.kind !== "worm"),
  );
  w.squirrel.y = cy;
  w.squirrel.vy = 0;
  w.squirrel.rot = 0;
  w.hitCooldown = 0;
  // Free Flight's black hole is a measured stretch of FIFTEEN GATES, not a
  // fifteen-second timer. A timer ended wherever it happened to end, which
  // read as the flight randomly righting itself; gates are a distance the
  // pilot can see passing, and the stretch closes on a hole they fly into
  // on purpose. Deep Space keeps its own short timer, Lost never warps out.
  if (w.flight === "fly") {
    w.warpLeft = 0;
    w.warpGateEnd = w.score + WARP_GATES;
    w.warpExitSpawned = false;
  } else {
    w.warpLeft = w.flight === "lost" ? 0 : w.flight === "deep" ? 10 : 15;
  }
  w.shieldFreeze = w.flight === "deep" ? 0.2 : 0.4;
  w.absorbGrace = w.flight === "deep" ? 0.9 : 1.6;
  w.shake = 0.18;
  spark(w, sx, cy, ["#b45cff", "#fff", "#4ad8ff"], 18, "warp");
}

function exitWarp(w: World) {
  w.warpGateEnd = -1;
  w.warpExitSpawned = false;
  if (w.flight === "deep") {
    startSwirl(w, "shift");
    return;
  }
  // Only claim to have restored something if the flight was actually
  // reoriented. A warp that drew upright and unmirrored changed nothing,
  // and announcing its end just reads as a phantom message.
  const wasWarped = warpVisible(w.warpTilt, w.warpMirror);
  w.prevTilt = w.warpTilt;
  w.prevMirror = w.warpMirror;
  w.warpTilt = 0;
  w.warpMirror = true;
  w.warpKind = null;
  w.shieldFreeze = 0.7;
  w.shieldSlow = 3;
  if (wasWarped) w.recoveryMsg = "ORIENTATION RESTORED";
  spark(w, w.W * PHYS.squirrelX, w.squirrel.y, ["#b45cff", "#fff"], 14, "warp");
}

// The level is over — the portal was flown or the pilot was lost. Stars
// are a BITMASK per level and only ever gain bits: goal 2 earned today and
// goal 3 earned on Tuesday add up to the same three stars, which is what
// lets a hard level be chipped at instead of demanding one perfect run.
export function settleLevel(w: World, save: SaveData, finished: boolean) {
  // a finished mission is a celebration beat for the platform (a portal's
  // happytime); a failed one is not
  if (finished) platform.celebrate();
  // A Wormhole mission grades off the tunnel's own ledger; sync it here so
  // the numbers on the result sheet are the numbers the run actually flew.
  if (w.lvl && w.lvl.def.base === "tunnel" && w.tunnel) {
    w.lvl.stats.acorns = w.runAcorns;
    w.lvl.stats.score = w.score;
    w.lvl.stats.flow = w.tunnel.bestMultiplier;
  }
  // A Spill mission grades off the Spill's own ledger the same way
  if (w.lvl && w.lvl.def.base === "spill" && w.spill) {
    w.lvl.stats.score = Math.floor(w.spill.score);
    w.lvl.stats.ore = w.spill.oreMined;
    w.lvl.stats.hits = w.spill.hits;
    w.lvl.stats.depots = w.spill.depotVisits;
    w.lvl.stats.repairs = w.spill.repairs ?? 0;
  }
  const lvl = w.lvl!;
  const def = lvl.def;
  const met: [boolean, boolean, boolean] = finished
    ? [goalMet(def.goals[0], lvl.stats), goalMet(def.goals[1], lvl.stats), goalMet(def.goals[2], lvl.stats)]
    : [false, false, false];
  const mask = (met[0] ? 1 : 0) | (met[1] ? 2 : 0) | (met[2] ? 4 : 0);
  if (def.standalone && def.base === "race") {
    const records = save.raceRecords ?? (save.raceRecords = {});
    const prior = records[def.raceEventId ?? def.id];
    const finishTicks = Math.max(0, Math.floor(lvl.stats.finishTicks));
    const priorTicks = prior?.bestFinishTicks ?? 0;
    const priorAcorns = prior?.bestAcorns ?? 0;
    const newBestTime = finished && finishTicks > 0 && (!priorTicks || finishTicks < priorTicks);
    const newBestAcorns = lvl.stats.acorns > priorAcorns;
    const bestFinishTicks = newBestTime ? finishTicks : priorTicks;
    const bestAcorns = Math.max(priorAcorns, lvl.stats.acorns);
    records[def.raceEventId ?? def.id] = { bestFinishTicks, bestAcorns };
    // AND THE BOARD HEARS ABOUT IT (App Store prep audit, section 2). The
    // "hyper" board has been declared and configured since the shell landed
    // and nothing ever posted to it. A race is scored on TIME, so this posts
    // ticks and the board has to be set Low to High - app.config.json says so
    // beside the id, and check.mjs repeats it, because a board configured the
    // usual way would rank the slowest pilot first.
    if (finished && finishTicks > 0) platform.submitScore("hyper", finishTicks);
    // DEBRIS FIELD. A finish inside the time clears the gate the pilot is
    // actually standing at - the first uncleared one - and only that one.
    // Beating 1:42 at the very first field does not silently bank all
    // three: each field is its own trip back.
    const candidate = reachedGate(routeMasks(save), save.raceGates);
    const gate = candidate && candidate.after === lvl.barrierAfter
      ? gateClearedBy(save.raceGates, finished, finishTicks) : null;
    let clearedGate: { after: number; label: string } | null = null;
    if (gate) {
      save.raceGates = [...new Set([...(save.raceGates || []), gate.after])];
      const progress = migrateCampaign(save);
      const id = barrierId(gate.after);
      if (!progress.barriers.includes(id)) progress.barriers.push(id);
      clearedGate = { after: gate.after, label: gate.label };
    }
    const total = earnedCampaignStars(save, CHART_LEVELS);
    writeSave(save);
    w.lastLevel = {
      def,
      finished,
      met,
      newMask: mask,
      gained: 0,
      totalBefore: total,
      totalAfter: total,
      stats: { ...lvl.stats },
      raceRecord: {
        finishTicks,
        acorns: lvl.stats.acorns,
        bestFinishTicks,
        bestAcorns,
        newBestTime,
        newBestAcorns,
        clearedGate,
      },
    };
    w.lvl = null;
    w.tut = null;
    w.screen = "lvldone";
    w.deadTimer = 0;
    return;
  }
  const totalBefore = earnedCampaignStars(save, CHART_LEVELS);
  const credit = settleMissionCredit(save, def, mask);
  const totalAfter = earnedCampaignStars(save, CHART_LEVELS);
  // the run still banks like any other: acorns are real, lifetime tallies grow
  save.acorns += w.runAcorns;
  save.runs = (save.runs ?? 0) + 1;
  save.lifetimeAcorns = (save.lifetimeAcorns ?? 0) + w.runAcorns;
  if (w.startShieldArmed) save.startShield = false;
  writeSave(save);
  w.lastLevel = {
    def,
    finished,
    met,
    newMask: credit.verified,
    gained: credit.gained,
    totalBefore,
    totalAfter,
    stats: { ...lvl.stats },
  };
  w.lvl = null;
  w.tut = null;
  w.screen = "lvldone";
  w.deadTimer = 0;
}

function die(w: World, save: SaveData) {
  // THE FLIGHT TEST CANNOT END. Its sky is empty and its floor bounces, so
  // nothing here should reach this - but a tester who dials the lab's
  // hazards back on must still keep the pilot: scoop them back onto the
  // flight line and carry on, the way the first flight does.
  if (w.flightTest) {
    w.squirrel.y = Math.max(PHYS.squirrelR, Math.min(w.H - PHYS.squirrelR, w.squirrel.y));
    w.squirrel.vy = Math.min(0, w.squirrel.vy);
    w.invulnLeft = Math.max(w.invulnLeft, 0.5);
    return "shield";
  }
  // A crash inside a wormhole detour is a crash on the run that flew into
  // it - the corridor is fifteen seconds of that run, not a run of its
  // own. Come home first, so the score, the best and the result screen all
  // belong to the flight the pilot actually chose.
  if (w.wormHold) exitWormhole(w, true);
  // The first flight and the first mission are both unfailable, and this is
  // the last door out - settleLevel below would end the run as a LOSS, which
  // for level one means a new pilot's first mission after the tutorial tells
  // them they failed. Unlimited tries, by never reaching that branch.
  if (tutSafe(w)) {
    absorb(w);
    w.shieldCharges = Math.max(w.shieldCharges, 1);
    return "shield";
  }
  if (w.lvl) {
    w.shake = 0.35;
    spark(w, w.W * PHYS.squirrelX, w.squirrel.y, ["#e8dcc8", "#ff6a28"], 20);
    settleLevel(w, save, false);
    return "die";
  }
  w.screen = "dead";
  w.deadTimer = 0;
  w.tut = null;
  w.shake = 0.35;
  // a recovery banner ("FLIGHT CONTINUES!") must not print through the crash sheet
  w.recoveryMsg = "";
  // the best BEFORE this crash: a continue's second crash at the same score
  // is not a new best, and neither is a tie (audit, 30 Sep 2026)
  const priorBest = w.flight === "deep" ? save.deepBest : w.flight === "lost" ? save.lostBest
    : w.flight === "arcade" ? save.arcadeBest : w.flight === "tunnel" ? save.tunnelBest
    : w.flight === "spill" ? (save.spillBest ?? 0) : save.highScore;
  // Graduation: the first crash after the tutorial hands over the first
  // suit and helmet, free. The crash sheet announces it, the coach walks
  // the pilot through wearing it, and Mission 1 takes it from there.
  if (save.tutorialDone && save.guide === "pending") {
    grantTutorialKit(save);
    save.guide = "reward";
    writeSave(save);
  }
  w.lastRun = {
    score: w.score,
    acorns: w.runAcorns,
    best: w.score > 0 && w.score > (priorBest ?? 0),
    flowBest: w.tunnel?.flowBest ?? 0,
    bestChain: w.tunnel?.bestChain ?? 0,
    sections: w.tunnel?.sectionsCleared ?? 0,
    nearMisses: w.tunnel?.nearMisses ?? 0,
    bestMultiplier: w.tunnel?.bestMultiplier ?? 1,
    taps: w.run.taps,
    bounces: w.run.bounces,
    holes: w.run.holes,
  };
  save.acorns += w.runAcorns;
  // lifetime tallies for the Profile screen: these only ever grow - one
  // flight per run, however many continues it took
  if (!w.continued) save.runs = (save.runs ?? 0) + 1;
  save.lifetimeAcorns = (save.lifetimeAcorns ?? 0) + w.runAcorns;
  if (w.flight === "deep") save.deepBest = Math.max(save.deepBest, w.score);
  else if (w.flight === "lost") save.lostBest = Math.max(save.lostBest, w.score);
  else if (w.flight === "arcade") save.arcadeBest = Math.max(save.arcadeBest, w.score);
  else if (w.flight === "tunnel") save.tunnelBest = Math.max(save.tunnelBest, w.score);
  else if (w.flight === "spill") save.spillBest = Math.max(save.spillBest ?? 0, w.score);
  else save.highScore = Math.max(save.highScore, w.score);
  // a new personal best is the one crash worth a cheer (a portal's happytime)
  if (!w.lvl && !w.tut && w.score > (priorBest ?? 0)) platform.celebrate();
  // the same number goes to the platform's board (Game Center, Steam);
  // a mission or a tutorial is not a board run, and the web has no board
  // the Debris Field's board takes waves cleared, posted by the engine's
  // cue dispatch - not the score here (it posted twice; audit, 30 Sep 2026)
  if (!w.lvl && !w.tut && w.score > 0 && w.flight !== "spill") platform.submitScore(w.flight, w.score);
  if (w.startShieldArmed) save.startShield = false;
  spark(w, pilotX(w), w.squirrel.y, ["#e8dcc8", "#ff6a28"], 20);
  return "die";
}

// ------------------------------------------------- the acorn continue
//
// THE AD SLOT, PAID IN ACORNS FOR NOW. Owner's spec, verbatim: "free
// flight temporary ad replacement spot is, on death, 10 acorns to
// continue, or 50 acorns if over level 100. temporary, don't argue
// economics of it. it's the ad screen." So this is the ad screen: the
// crash sheet offers a continue, the wallet pays what the ad will one day
// pay, and when the rail exists the trigger swaps and nothing else moves.
//
// The run was already BANKED by die() - acorns, bests, XP, the runs tally
// - so a continue is a continuation of the score, not of the bank:
// runAcorns restarts at zero and the next crash banks only what was
// gathered after the revive. Score, distance and difficulty carry on.
// Free flight only: a mission has protection and a restart of its own,
// a wormhole corridor is a fifteen-second side trip, and Hyper Run is a
// deterministic time trial where a continue would be a lie.

export function reviveCost(w: World) {
  if (w.lab.freeRevive) return 0;           // the lab's unlimited recovery
  return w.score > 100 ? 50 : 10;
}

// ------------------------------------------------------------- the Spill
//
// The Spill is stepped here and nowhere else. spill.ts owns the rules; this
// is the seam: the pilot is mirrored into the world's squirrel so the
// shared painter draws the equipped suit, the field's bursts become world
// particles so the shared particle painter draws them, the score is the
// highest wave cleared so the crash sheet and the record chip agree, and a
// dead or finished run leaves through die() and settleLevel() like every
// other run does.

const SPILL_TONES: Record<string, string[]> = {
  hit: ["#ffd8a0", "#ff9a5c", "#fff2d8", "#ffffff"],
  shatter: ["#ffd8a0", "#ff9a5c", "#fff2d8"],
  ore: ["#c99bff", "#7fe4ff", "#f3e9ff"],
  gold: ["#ffe9a0", "#ffd76a", "#fff"],
  shield: ["#9fe8ff", "#cfefff", "#ffffff"],
  hull: ["#8df0b4", "#d9ffe6", "#ffffff"],
  lunge: ["#8fd6ff", "#cfefff"],
  graze: ["#9fe8ff"],
};

/** a swipe up: the kick skyward. The swipe down is dive() */
export function spillBurstUp(w: World) {
  if (!w.spill || w.screen !== "play" || w.ready) return false;
  if (!spillBurst(w.spill, -1)) return false;
  spark(w, w.spill.pilot.x, w.squirrel.y + 16, ["#c8d0e0", "#fff"], 10, "poof");
  return true;
}

/** what the engine turns into sound and a re-render, once per frame */
export function takeSpillCues(w: World): SpillCue[] {
  const cues = w.spillCues;
  w.spillCues = [];
  return cues;
}

function updateSpill(w: World, save: SaveData, dt: number): string | null {
  const s = w.spill!;
  const cues = stepSpill(s, dt);
  w.squirrel.y = s.pilot.y;
  w.squirrel.vy = s.pilot.vy;
  w.squirrel.rot = s.pilot.rot;
  w.score = spillCleared(s);
  w.distance += dt * 100;
  if (s.shake > w.shake) w.shake = s.shake;
  for (const b of s.bursts) {
    const colors = SPILL_TONES[b.tone] ?? SPILL_TONES.hit;
    for (let i = 0; i < b.n; i++) {
      const ang = Math.random() * Math.PI * 2;
      const sp = (60 + Math.random() * 230) * b.power;
      w.particles.push({
        x: b.x, y: b.y,
        vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
        life: 0.35 + Math.random() * 0.5, max: 0.85,
        r: 1.5 + Math.random() * 3.2,
        color: colors[i % colors.length],
        kind: "spark",
      });
    }
  }
  s.bursts = [];
  if (w.lvl) {
    w.lvl.stats.score = Math.floor(s.score);
    w.lvl.stats.ore = s.oreMined;
    w.lvl.stats.hits = s.hits;
    w.lvl.stats.depots = s.depotVisits;
    w.lvl.stats.repairs = s.repairs ?? 0;
  }
  w.spillCues.push(...cues);
  const objective = w.lvl?.def.spillFinish;
  const objectiveDone = !!objective && s.hull > 0 && s.phase !== "over" && (objective.kind === "ore" ? s.oreMined : s.depotVisits) >= objective.n;
  if ((cues.includes("mission") || objectiveDone) && w.lvl) {
    settleLevel(w, save, true);
    return "finish";
  }
  if (cues.includes("dead")) return die(w, save);
  return null;
}

/** can this crash be continued at all - the same rule for acorns and ads */
export function canRevive(w: World) {
  return !(w.screen !== "dead" || w.lvl || w.race || w.spill || w.flight === "tunnel");
}
export function reviveRun(w: World, save: SaveData, free = false): boolean {
  // the Spill sells its own extra life in the Depot; the wallet stays shut
  if (!canRevive(w)) return false;
  // free: a rewarded ad paid for this one (13 Sep 2026); the wallet is untouched
  const cost = free ? 0 : reviveCost(w);
  if ((save.acorns ?? 0) < cost) return false;
  save.acorns -= cost;
  writeSave(save);
  // the same landing the shield gives, without spending one: the killzone
  // is swept, the pilot re-enters at the nearest safe height under a short
  // freeze, and the recovery banner says what happened
  const sx = w.W * PHYS.squirrelX;
  const cy = safeY(w);
  clearDebrisNear(w, sx, cy, 260, sx, cy, 300);
  w.planets = w.planets.filter((p) => p.x - p.r > sx + 90 || p.x + p.r < sx - 150);
  w.runAcorns = 0;
  w.squirrel.y = cy;
  w.squirrel.vy = 0;
  w.squirrel.rot = 0;
  w.hitCooldown = 0;
  w.bounceUp = false;
  w.shieldFreeze = 0.9;
  w.shieldSlow = 3;
  w.absorbGrace = 2.2;
  w.recoveryMsg = "FLIGHT CONTINUES!";
  w.continued = true;
  w.deadTimer = 0;
  w.screen = "play";
  return true;
}

export function pausePlay(w: World) {
  if (w.screen !== "play" || w.tut) return;
  w.pausedFrom = "play";
  w.screen = "pause";
}

export function resumePlay(w: World) {
  if (w.screen !== "pause") return;
  w.screen = "play";
  w.pausedFrom = null;
}

export function updateWorld(w: World, save: SaveData, dt: number): string | null {
  // THE FIRST FLIGHT RUNS IN SLOW MOTION.
  //
  // Owner's call, 26 Aug 2026: play the tutorial at a tenth speed, like a
  // freeze acorn, so the tap can be placed exactly. The lesson was never
  // hard to understand - it was hard to HIT, and a beginner missing the
  // window learns that the game does not respond rather than that they were
  // early. At a tenth, the window is ten times wider in real seconds and
  // the arc can be watched all the way up.
  //
  // Scaled HERE, at the top, rather than folded into the `slow` factor
  // further down, and that is deliberate: everything in a frame reads off
  // this one number - the world, the tutorial's own stage clock, the arming
  // timer, the recorder. Slowing only the physics would leave the prompts
  // firing on wall time against a world moving at a tenth, which is a
  // different broken tutorial rather than a fixed one.
  //
  // The freeze acorn's own factor stays what it is; this multiplies with it
  // like any other, so a slow acorn in the tutorial is simply slower still.
  // A fixed-step cue is edge-triggered. The engine drains it immediately;
  // clearing here also prevents a paused or READY update from replaying a
  // prior step if a non-engine caller chose not to drain it.
  w.raceCueEffects = [];
  w.time += dt;
  if (w.shake > 0) w.shake = Math.max(0, w.shake - dt * 2.4);
  for (const s of w.stars) s.tw += dt * 2;
  if (w.screen === "pause" || w.screen === "lvldone") return null;
  if (w.screen === "dead") {
    w.deadTimer += dt;
    w.squirrel.vy += PHYS.gravity * dt * 0.55;
    w.squirrel.y += w.squirrel.vy * dt;
    w.squirrel.rot = Math.min(1.2, w.squirrel.rot + dt * 2);
  }
  for (const p of w.particles) {
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.kind === "flame") p.vy -= 40 * dt;   // exhaust rises as it fades
    if (p.spin) p.hue = (p.hue || 0) + p.spin * dt * 40;
  }
  w.particles = w.particles.filter((p) => p.life > 0);

  if (w.screen !== "play") return null;

  if (w.race) {
    // The ready overlay is outside race time: neither its authority tick nor
    // its physics may advance until a positive hold or drop launches the run.
    if (w.ready) return null;
    const priorRaceTick = w.race.tick, priorRaceVy = w.race.vy;
    const priorHeld = w.race.held, priorBoost = w.race.boost, priorDrops = w.race.dropTicks.length;
    const result = stepRace(w.race);
    w.raceCueEffects = result.cues;
    // Preserve producer order and distinct same-tick events. Presentation
    // can show a pass and debris impact together without either overwriting
    // the other; age is derived from the post-step authority tick.
    w.raceCues = [...w.raceCues, ...result.cues]
      .filter((cue) => raceDecisionAge(w.race!.tick, cue.tick) <= 45);
    const viewport = raceViewport(w.W, w.H);
    w.squirrel.y = raceViewportY(viewport, w.race.y);
    w.squirrel.vy = w.race.vy * viewport.scale;
    w.squirrel.rot = Math.max(-0.48, Math.min(0.72, w.race.vy / 720));
    if (pilotSuitId(w, save) === "arcflash" && w.race.tick > priorRaceTick
      && !w.tut?.hold && w.shieldFreeze <= 0 && w.warpT <= 0 && !w.stuck) {
      // Read consumed race input, never the unaccepted gesture queue. A
      // continuous hold preserves joint rates and clocks between presses.
      if (w.race.dropTicks.length > priorDrops) arcflashDive(w.arcflash);
      else if (w.race.phase === "normal" && w.race.held
        && (!priorHeld || (w.race.boost && !priorBoost))) {
        arcflashTap(w.arcflash, Math.max(1, priorRaceVy - w.race.vy));
      }
      if (w.race.phase === "normal" && w.race.held && w.race.vy < 0) {
        w.arcflash.boosting = true; // sustained authority hold, without a new tap accent
      }
      if (!w.race.held || w.race.phase !== "normal") {
        w.arcflash.boosting = false;
        if (priorHeld) w.arcflash.velocityReset = true; // release brake/phase handoff
      }
      // The authority always advances one 60 Hz tick. Canonical velocity
      // keeps a phone and a large viewport in the same articulated pose.
      stepArcflash(w.arcflash, RACE_DT, w.race.vy);
    }
    const orbitRaceSuit=pilotSuitId(w,save);
    if (isHighOrbit(orbitRaceSuit) && w.race.tick>priorRaceTick && !w.tut?.hold
      && w.shieldFreeze<=0 && w.warpT<=0 && !w.stuck) {
      if(w.race.phase==='normal'&&w.race.held&&(!priorHeld||(w.race.boost&&!priorBoost)))
        highOrbitTap(w.highOrbit,Math.max(1,priorRaceVy-w.race.vy),premiumRepeat(w,save));
      if(isPremiumSuit(orbitRaceSuit))stepPremiumWake(w.highOrbit,orbitRaceSuit,RACE_DT,w.race.vy);
      else stepHighOrbit(w.highOrbit,orbitRaceSuit,RACE_DT,w.race.vy);
    }
    w.speed = w.race.speed;
    w.distance = w.race.coursePosition;
    w.runAcorns = w.race.acorns;
    w.score = w.race.ringLedger.filter((s) => s === "passed").length;
    if (w.lvl) {
      w.lvl.stats.acorns = w.race.acorns;
      w.lvl.stats.finishTicks = w.race.finishTicks ?? 0;
    }
    if (result.finished && w.lvl) {
      settleLevel(w, save, true);
      return "finish";
    }
    return result.sound;
  }

  // ---------------------------------------------------------------------
  // THE DIRECTOR
  //
  // One beat at a time. A beat either WAITS for a gesture - in which case
  // tutGesture answers it and this does nothing - or waits on the world:
  // the body coming level, a planet arriving, a gate being passed.
  //
  // Nothing here scripts the pilot's POSITION. Every motion in the lesson
  // is the game's own physics given one impulse, which is why it looks like
  // flying rather than like being dragged.
  // ---------------------------------------------------------------------
  if (w.tut) {
    const t = w.tut;
    t.t += dt;
    const freeze = (stage: TutStage, want: "tap" | "swipe" | "continue" | null = "continue") => {
      t.stage = stage;
      t.hold = true;           // hold IS the freeze: see `frozen` below
      t.want = want;
      t.t = 0;
    };

    switch (t.stage) {
      // a beat of stillness so the pilot sees the squirrel before being
      // told anything at all
      case "intro":
        if (t.t > 0.55) freeze("learnTap");
        break;

      // the popup has been read and pressed past; the indicator is up and
      // the director is waiting. There is no timeout here on purpose.
      case "learnTap":
      case "learnTap2":
      case "doTap1":
      case "doTap2":
      case "doDive":
      case "boing":
      case "handover":
      case "pal":
        break;

      // THE BODY COMING LEVEL, which is the cue the spec asks for: the tap
      // has been flown, the arc has peaked, and the squirrel is horizontal
      // again. Measured off the real rotation so it lands with the picture.
      case "levelOff":
        if (w.squirrel.vy >= 0 && Math.abs(w.squirrel.rot) < 0.12) freeze("learnTap2");
        else if (t.t > 4) freeze("learnTap2");     // never strand the lesson
        break;

      // the second tap is climbing; teach the dive at the top of it
      case "learnDive":
        if (w.squirrel.vy >= -30 || t.t > 3) {
          // THE DIVE NEEDS SOMETHING TO DIVE AT.
          //
          // The planet used to be laid when the swipe was ANSWERED, so the
          // pilot was asked to dive at an empty sky and only found out what
          // for afterwards. Reported as "the swipe down was a big miss - if
          // there was a planet or gap there it would probably be fixed",
          // and the clip shows a second and a half of SWIPE DOWN over
          // nothing at all.
          //
          // It goes down as the lesson OPENS. The world is held for the
          // whole ask, so the pilot cannot drift away from the arithmetic
          // that placed it - what they are looking at when they swipe is
          // exactly where they are going.
          placeBouncePlanet(w, save);
          freeze("doDive", "swipe");
        }
        break;

      // the dive is flying toward the staged planet. bounceUp is set by
      // bounceOff the instant it lands.
      case "diving":
        if (w.bounceUp && !t.bounced) { t.bounced = true; freeze("boing"); }
        else if (t.t > 3.5) { t.bounced = true; freeze("boing"); }
        break;

      // the bounce flies on its own spring and pauses at the top
      case "bouncing":
        if (w.squirrel.vy >= -30 || t.t > 3) freeze("handover");
        break;

      // THREE IN A ROW. gates counts clean passes; a contact rewinds the
      // stretch (see tutRewind) rather than letting protection buy it.
      case "gates3":
        if (t.streak >= 3) freeze("pal");
        break;

      // practice with the pal - protected, forgiving, and no rewind
      case "gates7":
        if (t.gates >= 10) t.stage = "portal";
        break;

      case "portal":
      case "done":
      case "free":
        break;
    }

    // controls are learned the moment gate practice begins - persist NOW so
    // quitting mid-tutorial never re-runs it, and hand over the kit the
    // Loadout is about to be pointed at
    if (!t.locked && !save.tutorialDone) {
      save.tutorialDone = true;
      grantTutorialKit(save);
      writeSave(save);
    }
  }

  // TAP TO FLY means exactly that: until the first tap the run is held
  // still. The banner was being shown while gravity and the scroll were
  // already running, so a player who read it before tapping was already
  // falling. w.time still advances above, so the pilot idles and the
  // world breathes — it just does not move or pull.
  // the tail keeps swinging through freezes and warps — it is the
  // pilot's own motion, not the world's
  // THE BODY REACTION SPRING behind the beta tap accent: second-order,
  // peak about 70 ms after a tap, settled by about 250 ms (from the tap
  // retrofit study, 12 Sep 2026). Stepped always, drawn only with the dial.
  {
    const wR = 22, zR = 0.65;
    w.tapReactV += (-wR * wR * w.tapReact - 2 * zR * wR * w.tapReactV) * dt;
    w.tapReact += w.tapReactV * dt;
    if (w.tapReact > 1) { w.tapReact = 1; w.tapReactV = Math.min(0, w.tapReactV); }
  }
  // per-suit spring multipliers (TAIL_SPRING / the beta tail dial), 1/1/1 as shipped
  const spring = tailSpringFor(save, pilotSuitId(w, save));
  w.tailV += (-TAIL.stiffness * spring.stiff * w.tailA - TAIL.damping * spring.damp * w.tailV) * dt;
  w.tailA += w.tailV * dt;
  if (w.tailA > TAIL.maxA) { w.tailA = TAIL.maxA; w.tailV *= -0.35; }
  if (w.tailA < -TAIL.maxA) { w.tailA = -TAIL.maxA; w.tailV *= -0.35; }
  if (w.tapAnimT >= 0) {
    const tapDt = dt * paceOf(save, w);
    w.tapAnimT += tapDt * w.tapAnimDir;
    if (w.tapAnimDir < 0 && w.tapAnimT <= 0) {
      // rewound to the start: bounce and play the whole beat to the end
      w.tapAnimT = 0;
      w.tapAnimDir = 1;
    } else if (w.tapAnimT >= TAP_ANIM_DURATION) {
      const replay = repeatTapQueues(pilotSuitId(w, save), save) && w.tapAnimQueued;
      w.tapAnimT = replay ? w.tapAnimT - TAP_ANIM_DURATION : -1;
      w.tapAnimQueued = false;
      w.tapAnimDir = 1;
    }
  }
  if (w.bounceAnimT >= 0) {
    w.bounceAnimT += dt * paceOf(save, w);
    if (w.bounceAnimT >= BOUNCE_ANIM_DURATION) {
      w.bounceAnimT = -1;
      w.bounceAnimDir = 0;
      w.bounceAnimStrength = 0;
    }
  }

  if (pilotSuitId(w, save) === "vanguard" && !w.tut?.hold && !w.spill) {
    stepVanguard(w.vanguard, dt, w.ready ? 0 : w.squirrel.vy);
  }
  if (pilotSuitId(w, save) === "arcflash" && !w.tut?.hold && !w.spill
    && w.shieldFreeze <= 0 && w.warpT <= 0 && !w.stuck) {
    // Use the flight clock so slow motion and faster contracts keep the
    // same pose through the same gravity arc. READY has its own calm idle.
    const visualSlow = w.powerLeft > 0 || w.tapFrozen ? PHYS.slowFactor : 1;
    const visualDt = w.ready ? dt : dt * visualSlow * (w.shieldSlow > 0 ? .55 : 1) * paceOf(save, w);
    stepArcflash(w.arcflash, visualDt, w.squirrel.vy, w.ready);
  }

  const orbitSuit=pilotSuitId(w,save);
  if (isHighOrbit(orbitSuit) && !w.tut?.hold && !w.spill && w.shieldFreeze<=0 && w.warpT<=0 && !w.stuck) {
    const slow=w.powerLeft>0||w.tapFrozen?PHYS.slowFactor:1;
    const visualDt=w.ready?dt:dt*slow*(w.shieldSlow>0?.55:1)*paceOf(save,w);
    if(isPremiumSuit(orbitSuit))stepPremiumWake(w.highOrbit,orbitSuit,visualDt,w.squirrel.vy,w.ready);
    else stepHighOrbit(w.highOrbit,orbitSuit,visualDt,w.squirrel.vy,w.ready);
  }
  // THE AUTOPILOT TAPS HERE, on the fixed tick, through the same flap()
  // a thumb uses - so every painter, dial and accent sees an accepted tap,
  // never a shortcut. Before the READY hold below: its first tap is what
  // releases the hold, exactly as a pilot's would.
  if (w.flightTest && w.screen === "play" && !w.tut) stepFlightTest(w, save, dt);
  const frozen = w.ready || (w.tut?.hold ?? false) || w.shieldFreeze > 0;
  if (w.shieldFreeze > 0) w.shieldFreeze = Math.max(0, w.shieldFreeze - dt);

  if (w.flight === "deep" && w.warpT <= 0 && w.warpLeft <= 0) {
    w.deepTimer += dt;
    if (w.deepTimer >= 10) startSwirl(w, "shift");
  }
  if (w.warpT > 0) {
    w.warpT = Math.max(0, w.warpT - dt * (w.flight === "deep" ? 2 : 1));
    // the games swap at the fold's midpoint, while the screen is edge-on,
    // so you never see one dissolve into the other
    if (w.retroPending && w.warpT <= 0.5) {
      w.retroPending = false;
      w.retro = !w.retro;
      w.recoveryMsg = w.retro ? "TIMELINE: ARCADE" : "TIMELINE: ILLUSTRATED";
    }
    if (w.warpT === 0) {
      if (w.warpKind === "timeline") w.warpKind = null;
      else enterWarp(w, save);
    }
  } else if (w.warpLeft > 0) {
    w.warpLeft = Math.max(0, w.warpLeft - dt);
    if (w.warpLeft === 0) exitWarp(w);
  }

  if (frozen || w.warpT > 0 || w.stuck) return null;

  let slow = w.powerLeft > 0 || w.tapFrozen ? PHYS.slowFactor : 1;
  if (w.shieldSlow > 0) {
    w.shieldSlow = Math.max(0, w.shieldSlow - dt);
    slow *= 0.55;
    if (w.shieldSlow <= 0) w.recoveryMsg = "";
  }
  if (w.flight === "lost") {
    w.driftPhase += dt * 0.7;
    w.driftFactor = 1 + 0.4 * (0.62 * Math.sin(w.driftPhase * 0.42) + 0.38 * Math.sin(w.driftPhase * 0.11 + 2.1));
    w.tiltPhase += dt * 0.45;
    w.warpTilt = lostTiltAt(w.tiltPhase);
  }

  // Thrill Seeker doubles the WORLD's clock, not the wall clock. Everything
  // the player reacts to — scroll, gravity, the arc of a tap, the gates'
  // sway — runs off simDt and so runs twice as fast. Power-up timers below
  // tick on plain dt, so a freeze still lasts its full 3.5 seconds; you
  // just cover twice the ground in it. And because `slow` multiplies in
  // here, freezing still halves the pace you are actually flying at rather
  // than dropping you back to normal speed.
  const simDt = dt * slow * paceOf(save, w);
  if (w.powerLeft > 0) w.powerLeft = Math.max(0, w.powerLeft - dt);
  if (w.invulnLeft > 0) w.invulnLeft = Math.max(0, w.invulnLeft - dt);
  if (w.absorbGrace > 0) w.absorbGrace = Math.max(0, w.absorbGrace - simDt);
  // the tap animation belongs to the world's clock, not the wall's, so it
  // keeps up with the pilot under Thrill Seeker
  if (w.flapBoost > 0) w.flapBoost = Math.max(0, w.flapBoost - dt * paceOf(save, w));
  // a live exhaust plume: the trail keeps streaming between taps instead
  // of puffing once and dying, so every trail reads as an engine
  w.trailT = (w.trailT ?? 0) + dt;
  if (!w.ready && w.trailT > 0.085) {
    w.trailT = 0;
    spawnTrail(w, save, 0.45);
  }
  if (w.hitCooldown > 0) w.hitCooldown = Math.max(0, w.hitCooldown - simDt);
  if (w.envMsgT > 0) w.envMsgT = Math.max(0, w.envMsgT - dt);
  w.lampT += dt;

  if (!w.ready && !w.race && !w.spill && w.flight !== "tunnel") recordZoneVisit(save, w.envB);
  if (w.spill) return updateSpill(w, save, dt);
  if (w.flight === "tunnel" && w.tunnel) return updateTunnel(w, save, simDt, dt);

  const d = difficulty(w);
  // TURCLOCK. The scroll wanders between 30% and 150% of what this run
  // would otherwise be doing - and the wander itself changes pace, because
  // a drift at a fixed frequency stops being a drift after two cycles and
  // becomes a rhythm the pilot can just count. The rate re-rolls each time
  // the phase comes round, so the next swell is never the last one's
  // length. The multiplier is smoothed toward its target rather than set,
  // so no frame ever jumps the world sideways.
  if (hasPal(save, w, "clockling") && !w.ready) {
    w.clockPhase += simDt * w.clockRate;
    if (w.clockPhase >= Math.PI * 2) {
      w.clockPhase -= Math.PI * 2;
      w.clockRate = 0.22 + (w.missionRng ?? Math.random)() * 0.66;   // ~9s to ~29s per swell
    }
    const target = 0.9 + 0.6 * Math.sin(w.clockPhase);   // 0.30 .. 1.50
    w.clockMul += (target - w.clockMul) * Math.min(1, simDt * 1.6);
  } else if (w.clockMul !== 1) {
    w.clockMul += (1 - w.clockMul) * Math.min(1, simDt * 2.2);
    if (Math.abs(w.clockMul - 1) < 0.005) w.clockMul = 1;
  }
  // ...and the far mouth of a wormhole, for the two seconds after one
  w.speed = d.speed * w.clockMul * wormCalmFactor(w, dt);
  w.squirrel.vy += gravOf(save, w) * simDt;
  w.squirrel.y += w.squirrel.vy * simDt;
  w.squirrel.rot = Math.max(-0.55, Math.min(0.95, w.squirrel.vy / 700));

  // Stopwatch (id switchback) toggles the slow on a tap; retired direction fields stay neutral.
  w.scrollReversing = false;
  const move = w.speed * w.driftFactor * simDt;
  if (pilotSuitId(w, save) === "vanguard") for (const p of w.vanguard.contacts) p.x -= move;
  w.distance += Math.abs(move);
  for (const p of w.planets) {
    p.x -= move;
    // how FAST the gate sways. Free Flight breathes at about half the
    // rate — the travel was right, the frequency read as fidgety.
    // Rough Air doubles how FAST a gate sways as well as how far, so the
    // two together read as turbulence rather than a slow deep breath.
    const driftRate = (hasPal(save, w, "wisp") && !hasPal(save, w, "astrafox") ? 1.7 : w.flight === "fly" ? 0.5 : 1.05)
      * (fxOf(w).driftRate ?? 1);
    p.drift += simDt * driftRate;
  }
  for (const a of w.pickups) {
    a.x -= move;
    a.bob += dt * 4;
  }
  w.lastSpawnX -= move;
  const lineReached = !!w.lvl && w.score >= w.lvl.def.gates;
  if (!lineReached) {
    // THE FIRST FLIGHT IS AN AUTHORED COURSE, not a random one. The spawner
    // was left running underneath it, so past the three gates and the seven
    // it kept adding its own: the pilot met fourteen gates on the way to a
    // portal placed after ten. Held until the lesson is over.
    if (!w.tut || w.tut.stage === "free") {
      while (w.lastSpawnX < w.W + 90) spawnPair(w, save, w.lastSpawnX + nextGapSpacing(w));
    }
  } else if (w.lvl && !w.lvl.portal) {
    // the last gate is passed: the field goes quiet and the FINISH portal
    // stands alone in clear sky — an arrival, not another obstacle
    w.lvl.portal = true;
    w.pickups.push({
      x: Math.max(w.lastSpawnX + nextGapSpacing(w), w.W + 140),
      y: w.H * 0.45,
      got: false,
      bob: 0,
      kind: "portal",
      r: 64,
    });
  }
  w.planets = w.planets.filter((p) => p.x > -90);
  w.pickups = w.pickups.filter((a) => a.x > -50 && !a.got);
  // A missed exit is not a life sentence. If the closing hole scrolled past
  // uncaught, arm the next gate to carry another one — the stretch ends by
  // being flown out of, so there always has to be a door on screen to aim at.
  if (w.warpGateEnd >= 0 && w.warpExitSpawned && !w.pickups.some((a) => a.exit)) {
    w.warpExitSpawned = false;
  }

  const targetEnv = envIndexFor(w, w.score);
  if (targetEnv !== w.envB) {
    w.envA = w.envB;
    w.envB = targetEnv;
    w.envBlend = 0;
    w.envMsgT = 2.2;
    // the Profile screen counts zones the pilot has actually reached
    if (!w.ready) recordZoneVisit(save, targetEnv);
  }
  if (w.envBlend < 1) w.envBlend = Math.min(1, w.envBlend + dt * 0.55);

  const sx = w.W * PHYS.squirrelX;
  const sy = w.squirrel.y;
  for (const p of w.planets) {
    if (!p.scored && p.x + p.r < sx - 12) {
      p.scored = true;
      // a bounce house keeps no score: gates pass uncounted (Space Puppy)
      if (!w.bounceHouse) w.score += 1;
      if (pilotSuitId(w, save) === "vanguard") vanguardGate(w.vanguard);
      if (w.tut && (w.tut.stage === "gates3" || w.tut.stage === "gates7" || w.tut.stage === "portal")) {
        w.tut.gates += 1;
        // TOUCHING A PLANET IS A PASS. Owner's rule, and it follows from the
        // lesson: two beats earlier the pilot was told "planets are bouncy,
        // they never hurt you". Failing them for a bounce teaches the
        // opposite of what the tutorial just taught. DEBRIS is the only
        // thing that costs the streak - see the blocker path, which rewinds.
        if (w.tut.stage === "gates3") w.tut.streak += 1;
      }
    }
  }

  const pals = palIds(save, w);
  const has = (id: string) => pals.includes(id);
  followPals(w, sx, sy, dt);
  // the magnet's dart goes to whichever slot Acorn is flying in
  const buddyPos = runPals(save, w)[1] === "buddy" ? w.palPos2 : w.palPos;

  if (has("buddy") || (w.tut && (w.tut.stage === "gates7" || w.tut.stage === "portal"))) {
    // Pull at a fixed speed, not in proportion to the distance. A
    // proportional pull looks right and never lands: the world drags the
    // acorn LEFT at w.speed while the magnet drags it right at dx * 4.2, so
    // it settles where those cancel — about speed / 4.2, which is 39px at
    // the opening pace and grows from there. The pickup radius is 28. Every
    // acorn the buddy touched parked just out of reach and rode along for
    // the rest of the run, and because it never scrolled off it was never
    // culled either.
    const pull = Math.max(360, w.speed * 2.2);
    for (const a of w.pickups) {
      if (a.got || a.kind !== "acorn") continue;
      const dy = sy - a.y;
      const dx = sx - a.x;
      const d = Math.hypot(dx, dy);
      if (d < PHYS.magnetR) {
        const step = Math.min(d, pull * dt);
        a.x += (dx / (d || 1)) * step;
        a.y += (dy / (d || 1)) * step;
        a.pulled = true;
      }
    }
  }

  // Ceiling bounces you back down — only debris is lethal up there.
  if (sy < PHYS.squirrelR && w.squirrel.vy < 0) {
    w.squirrel.y = PHYS.squirrelR;
    w.squirrel.vy = Math.abs(w.squirrel.vy) * 0.45 + 90;
    w.squirrel.rot = 0.5;
    spark(w, sx, 4, ["#e8dcc8", "#fff"], 8, "poof");
  }
  // a bounce house has a floor: the pilot springs back up instead of
  // falling out of the run (Space Puppy)
  // The Flight Test has the same floor: a suit being watched on MANUAL
  // with no taps must sit on the floor and bob, not fall out of the run.
  if ((w.bounceHouse || w.flightTest) && sy > w.H - PHYS.squirrelR && w.squirrel.vy > 0) {
    w.squirrel.y = w.H - PHYS.squirrelR;
    w.squirrel.vy = -(Math.abs(w.squirrel.vy) * 0.6 + 260);
    w.squirrel.rot = -0.5;
    spark(w, sx, w.H - 4, ["#ffb6c9", "#fff"], 8, "poof");
  }
  if (sy > w.H + 36) {
    if (tutSafe(w)) {
      // tutSafe now covers the first MISSION as well as the first FLIGHT,
      // and a mission has no w.tut - reading the stage unconditionally here
      // crashed level one on its first touch of the floor.
      const st = w.tut?.stage;
      if (!w.tut) {
        // level one: scoop them back onto the flight line, unlimited tries
        tutReset(w, sx, w.H + 10);
      } else if (st === "gates3" || st === "gates7" || st === "portal") {
        // practice time: scoop them straight back onto the flight line
        // rather than let them flounder along the floor. NOT a rewind even
        // inside the three - debris is the only failure, and the gate they
        // were heading for is still ahead of them to fly.
        tutReset(w, sx, w.H + 10);
      } else {
        w.squirrel.y = Math.max(24, Math.min(w.H - 24, w.squirrel.y));
        w.squirrel.vy *= -0.4;
      }
    } else if (w.shieldCharges > 0) {
      absorb(w);
      return "shield";
    } else return die(w, save);
  }

  const sr = PHYS.squirrelR;
  if (w.absorbGrace <= 0 && w.invulnLeft <= 0) {
    for (const p of w.planets) {
      for (const b of p.blockers) {
        const bx = blockerX(p, b, w);
        const by = b.y + gateOffset(p, w);
        if (circleHit(sx, sy, sr, bx, by, b.r * 0.92)) {
          if (w.shieldCharges > 0) {
            absorb(w, bx, by);
            return "shield";
          }
          if (tutSafe(w)) {
            if (w.hitCooldown <= 0 && w.shieldFreeze <= 0) {
              // inside the three, protection saves the pilot and takes the
              // stretch back - it never buys the gate
              if (w.tut?.stage === "gates3") tutRewind(w, save);
              else tutReset(w, bx, by);
            }
            continue;
          }
          return die(w, save);
        }
      }
    }
  }

  // Golden invuln phases debris only. Planet bounces stay live (live PR #42).
  for (const p of w.planets) {
    const gy = liveGapY(p, w);
    const topY = gy - p.gap / 2 - p.r;
    const botY = gy + p.gap / 2 + p.r;
    for (const py of p.half === "top" ? [topY] : p.half === "bot" ? [botY] : [topY, botY]) {
      if (!circleHit(sx, sy, sr, p.x, py, p.r * 0.92)) continue;
      if (w.hitCooldown <= 0) {
        if (w.shieldCharges > 0 && w.tut?.stage === "free") {
          /* planets bounce even with a shield — shields save debris / fall */
        }
        // BOUNCE HOUSE: 2x off every planet, 3x off the big ones (owner)
        bounceOff(w, save, p.x, py, w.bounceHouse ? (p.r >= PHYS.planetR * 1.75 ? 3 : 2) : 1);
        w.run.bounces += 1;
        return "bounce";
      }
      pushOut(w, p.x, py, p.r * 0.92, sr);
    }
  }

  let snd: string | null = null;
  for (const a of w.pickups) {
    if (a.got) continue;
    const ay = a.y + Math.sin(a.bob) * 4;
    if (Math.hypot(sx - a.x, sy - ay) > (a.r ?? 28)) continue;
    a.got = true;
    if (a.kind === "acorn") {
      w.runAcorns += has("nutsack") ? 2 : 1;
      if (w.lvl) w.lvl.stats.acorns += has("nutsack") ? 2 : 1;
      if (a.pulled) {
        buddyPos.x = a.x;
        buddyPos.y = a.y;
        buddyPos.dart = 0.35;
      }
      spark(w, a.x, ay, ["#ffd060", "#fff"], 10, "gold");
      snd = "acorn";
    } else if (a.kind === "slow") {
      w.powerLeft = PHYS.powerDuration * (has("cometsprite") ? 2 : 1);
      spark(w, a.x, ay, ["#6ef0ff", "#fff"], 12, "cyan");
      snd = "gold";
    } else if (a.kind === "gold") {
      if (w.lvl) w.lvl.stats.gold += 1;
      w.invulnLeft = PHYS.goldDuration * (has("starpup") ? 2 : 1);
      spark(w, a.x, ay, ["#ffe080", "#ffd060"], 14, "gold");
      snd = "gold";
    } else if (a.kind === "shield") {
      if (!has("nutsack") && !has("tinbot")) {
        // SHIELD BATTERY IS A STAR RUNG, NOT A PURCHASE (owner, 2 Sep 2026:
        // "always active, not a toggle"): earn the stars and you carry
        // three charges from then on. save.battery is left in place for
        // old saves and no longer read.
        const cap = batteryUnlocked(save) ? 3 : 1;
        w.shieldCharges = Math.min(cap, w.shieldCharges + 1);
      }
      spark(w, a.x, ay, ["#7ad8ff", "#5dff9e"], 12, "shield");
      snd = "shield";
    } else if (a.exit && a.kind === "hole" && w.warpT <= 0) {
      // Home through the same door. exitWarp puts the flight back upright
      // and clears the gate window, and it is reached by flying into
      // something rather than by a clock running out.
      exitWarp(w);
      spark(w, a.x, ay, ["#b45cff", "#fff", "#4ad8ff"], 20, "warp");
      snd = "shield";
    } else if (a.kind === "worm" && !w.wormHold && w.warpT <= 0) {
      // not a reorientation any more: a door
      spark(w, a.x, ay, ["#b45cff", "#fff", "#4ad8ff"], 26, "warp");
      enterWormhole(w, save);
      return "shift";
    } else if ((a.kind === "hole" || a.kind === "worm") && w.warpT <= 0 && w.warpLeft <= 0 && w.warpGateEnd < 0) {
      startSwirl(w, a.kind === "worm" ? "worm" : "hole");
      snd = "shield";
    } else if (a.kind === "portal" && w.tut) {
      // the first flight's finish line. It freezes on the congratulations
      // rather than settling a level - there is no level here, and the
      // reward is collected in the Loadout the coach is about to point at.
      spark(w, a.x, ay, ["#ffd060", "#5dff9e", "#fff"], 26, "warp");
      w.tut.stage = "done";
      w.tut.hold = true;
      w.tut.want = "continue";
      w.tut.t = 0;
      return "shift";
    } else if (a.kind === "portal" && w.lvl) {
      spark(w, a.x, ay, ["#ffd060", "#5dff9e", "#fff"], 26, "warp");
      settleLevel(w, save, true);
      return "shift";
    } else if (a.kind === "retro" && w.warpT <= 0) {
      // Through the fold and out the other side, in the other game. The
      // crossing borrows the wormhole's swirl so it reads as a crossing,
      // but it leaves no warp behind it: nothing about the flight changes,
      // only who is drawing it.
      w.retroShifts++;
      w.retroPending = true;
      startSwirl(w, "timeline");
      spark(w, a.x, ay, ["#ffd060", "#fff", "#b45cff"], 20, "warp");
      snd = "shift";
    }
  }
  return snd;
}

export function snapshot(w: World): Snapshot {
  return {
    screen: w.screen,
    score: w.score,
    runAcorns: w.runAcorns,
    envName: ENVS[w.envB]?.name ?? "DEEP SPACE",
    flight: w.flight,
    powerLeft: w.powerLeft,
    invulnLeft: w.invulnLeft,
    shieldCharges: w.shieldCharges,
    scoreMultiplier: w.tunnel?.multiplier ?? 1,
    multiplierLeft: w.tunnel?.multiplierLeft ?? 0,
    recoveryMsg: w.recoveryMsg,
    tutStage: w.tut?.stage ?? null,
    tutHold: !!w.tut?.hold,
    tutNudge: w.tut?.nudge ?? "",
    dead: w.lastRun,
    squirrel: { y: w.squirrel.y, rot: w.squirrel.rot, vy: w.squirrel.vy },
  };
}
