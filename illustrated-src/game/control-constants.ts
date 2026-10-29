// Loadout-neutral flight values shared by ordinary flight, Wormhole Run,
// and any race regime that promises the same control feel.
export const FLIGHT_GRAVITY = 1_300;
export const QUICK_DROP_VY = 380;

/** THE SUITS WHOSE REPEAT TAP QUEUES ("finish"). A repeat tap on one of
 *  these finishes the gesture that is playing and then replays it once.
 *  EMPTY since 12 Sep 2026: the owner flew the dials and ruled that every
 *  painted bank rewinds ("briellas cat, cyber, eclipse, and everything I
 *  don't name otherwise, gets velocity rewind") and the critters restart
 *  (TAP_REPEAT below). The mechanism stays for the beta REPEAT TAP dial.
 *  Kept in this data-only module so simulation does not load art. */
export const PAINTED_TAP_SUITS = new Set<string>([]);

/** THE LIVE REPEAT RULE, where it is not the default. Default: rewind.
 *  Owner, 12 Sep 2026: "Critters, bandit, noodle and quill get velocity
 *  restart" - and, asked what velocity means for a swim loop with no
 *  rising/falling poses, "A": restart only, the loop cycles as it does. */
export type TapRepeat = "rewind" | "finish" | "restart";
export const TAP_REPEAT: Record<string, TapRepeat> = {
  raccoon: "restart", ferret: "restart", hedgehog: "restart",
};
/** Spend less of the tap in its neutral lead-in, preserving the full gesture. */
export const PAINTED_TAP_EASE = .73;

/** THE TAP SHAPE. How a tap moves an ascent bank, per suit. Three answers:
 *    absent      the ramp above: PAINTED_TAP_EASE out over 62.5% of the
 *                second and back (PR #277, what is live for most suits)
 *    "velocity"  the freeze-day path: how fast the pilot is rising picks
 *                the frame; no ramp, no "cannot restart a climb" clamp,
 *                no added smoothing
 *    {fwd,back}  LINEAR out to the deep frame over `fwd` seconds, linear
 *                home over `back` - the owner's "linear forward and a
 *                faster snap back" (12 Sep 2026)
 *
 *  Owner, 12 Sep 2026, after a trace showed the ramp was the last
 *  difference between Eclipse today and Eclipse the day he froze it:
 *  "only change eclipse. to try it" - then "give me the dial. let's do
 *  this once and for all. forward .1-1 and back .1-1." So Eclipse is on
 *  velocity here, everything else is stock, and the beta pause sheet
 *  carries a per-suit dial (save.tapShape) that wins over this table on
 *  the beta page only. He flies, reports the numbers, they get baked here.
 *  The 1.0 s tap clock still bounds the picture: fwd + back past 1.0 s is
 *  cut where the clock ends. */
export type TapShape = { fwd: number; back: number };
export const TAP_SHAPE_MIN = 0.1, TAP_SHAPE_MAX = 1.0;
// THE RULING, 12 Sep 2026, after the owner flew the dials: "briellas cat,
// cyber, eclipse, and everything I don't name otherwise, gets velocity
// rewind." Every suit with an ascent bank is on velocity - the freeze-day
// painter, the path the Eclipse trace matched tick for tick. Robo, Big
// Booty, Cat and Volt "stay default rewind" (16-frame tap clips, no ascent
// bank - velocity cannot apply). Percy, Envoy and Patriot are a project of
// their own ("its artwork, its frame work"). High Orbit, AcorNut and
// Arcflash have their own controllers.
export const TAP_SHAPE: Record<string, TapShape | "velocity"> = {
  cyber: "velocity",
  briellacat: "velocity",
  // Owner-requested replacement banks follow Cyber's exact live path.
};

/** THE TAIL SPRING, per suit. The plume on a suit with its own tail layer
 *  rides a spring in sim.ts (TAIL in catalog.ts: stiffness, damping, and a
 *  kick per tap). These are MULTIPLIERS on those three, 1 = as shipped.
 *  Owner, 12 Sep 2026: "if it's possible to give a tail springiness". Nine
 *  suits draw a separate tail (TAIL_SPRING_SUITS, mirrored from art.ts's
 *  RIGGED_SUITS and pinned to it by test); the whole-frame banks have the
 *  tail painted in and nothing here can move it. Same deal as TAP_SHAPE:
 *  empty until the owner reports numbers; the beta dial (save.tailSpring)
 *  wins on the beta page. */
export type TailSpring = { stiff: number; damp: number; kick: number };
export const TAIL_SPRING_MIN = 0.25, TAIL_SPRING_MAX = 3;
export const TAIL_SPRING_ONE: TailSpring = { stiff: 1, damp: 1, kick: 1 };
export const TAIL_SPRING: Record<string, TailSpring> = {};
export const TAIL_SPRING_SUITS = ["robo", "catsuit", "volt", "cyber"];

/** THE TAP ACCENT, LIVE (owner, 12 Sep 2026: "enable it in game ... by
 *  default 1x is good"). The 167 ms ignition and the body reaction on every
 *  accepted tap, on both pages, with a per-suit strength: a multiplier on
 *  the ignition radius, the squash and the nose-up. 1 is the shipped
 *  reaction; 0 turns the accent off for that suit; absent means 1.
 *
 *  Owner's numbers, same message: "ghost gets 4x, alien gets 2x, leviathan
 *  gets 2x, volt gets 4x, briellas cat gets 0x, verdant, eclipse, cryostar
 *  get 4x." The player's own switch is Character Glow on the Profile tab
 *  (save.glowOff); the beta strength dial overrides this table per suit. */
export const TAP_ACCENT_STRENGTH: Record<string, number> = {
  ghost: 4, alien: 2, leviathan: 2, volt: 4, briellacat: 0,
  verdant: 4, eclipse: 4, cryostar: 4,
};
export const TAP_ACCENT_MIN = 0, TAP_ACCENT_MAX = 4;

/** THE WORMHOLE'S SETTLED FEEL.
 *
 *  These were FOUND BY FLYING, not chosen. The corridor's numbers were
 *  exposed as multiplier dials in a Tuning Run - an endless corridor that
 *  could not kill you, flown by autopilot with the dials live on screen -
 *  and turned until it read right on TAP TO FLY, the control the mode
 *  ships. What came back was lift 0.70, fall 0.75, flight speed 1.15,
 *  corridor 1.15, volatility 1.80 and debris 0.60 against what used to
 *  ship. They are folded in here and the dials are gone: this IS the
 *  flight now, and there is no multiplier left to be at 1.00.
 *
 *  Written as named constants rather than pre-multiplied arithmetic so the
 *  next person can see what each one governs.
 */
export const WORMHOLE_FLAP = -315;          // was PHYS.flap -450, x0.70
export const WORMHOLE_GRAVITY = 975;        // was PHYS.gravity 1300, x0.75
export const WORMHOLE_MAX_VY = 620;         // the dive cap, unchanged at x1.00
/** how fast the corridor arrives: base, plus a ramp over the run */
export const WORMHOLE_SPEED_BASE = 253;     // was 220, x1.15
export const WORMHOLE_SPEED_RAMP = 184;     // was 160, x1.15
/** how wide the tunnel runs */
export const WORMHOLE_WIDTH = 1.15;
/** how sharply the corridor wanders */
export const WORMHOLE_TURN = 1.8;
/** how thinly hazards arrive - a SPACING multiplier, so larger is fewer.
 *  The dial ran the other way (0.60 of the debris), hence the reciprocal. */
export const WORMHOLE_DEBRIS_SPACING = 1 / 0.6;

/** THE ROUND TRIP.
 *
 *  A wormhole is a DETOUR out of a gate run, and the numbers below are
 *  what make it read as one rather than as a slot machine bolted to the
 *  side of Lost in Space.
 *
 *  It arrives on a SCHEDULE, not a dice roll: one every twenty gates, so
 *  a pilot learns to expect it and can fly toward it. It pays acorns and
 *  nothing else - the gate counter is frozen for the whole trip, because
 *  a corridor that pays gates by the distance flown handed out forty-odd
 *  levels a trip and took a run to level 200 in an afternoon.
 *
 *  And both mouths are SLOW. Being dropped into a corridor at full pace
 *  with no idea where the walls are, and then flung back into a gate run
 *  the same way, is the part that felt broken: the pilot never had time
 *  to find themselves. Two seconds at either end, easing back to pace,
 *  is the calibration window.
 */
export const WORM_EVERY_GATES = 20;
/** how long either mouth stays slow, and how slow it starts */
export const WORM_CALM_SECONDS = 2;
export const WORM_CALM_SPEED = 0.42;
/** the exit opens this long before the clock runs out, so the trip ends by
 *  being FLOWN out of - the same contract the black hole's exit hole has */
export const WORM_EXIT_LEAD = 2.6;
/** and if the pilot misses it, this much longer before the corridor gives
 *  up and posts them home anyway. A missed door must never trap a run. */
export const WORM_EXIT_GRACE = 6;

/** HOW FAR EACH SUIT LEANS.
 *
 *  Owner ruling, 26 Aug 2026: *"the custom aren't custom pitch, they're
 *  custom animations."* A suit having its own painted frames says nothing
 *  about how far the engine should tip it — those are two separate axes,
 *  and every suit on the roster gets a dial here, painted bank or not.
 *
 *  WHAT THE NUMBER MEANS. It is a MULTIPLIER on the lean the suit already
 *  gets, split by direction: `up` scales the climb, `down` scales the dive.
 *  1 is what the game shipped with before any of this; 0 pins a suit flat.
 *
 *  CALIBRATED 26 Aug 2026, by the owner, flying the tuner: 0.80 climbing
 *  and 0.30 diving, across the whole roster. That is -20 degrees at full
 *  climb and +13 at full dive, against the -25/+44 that shipped. The dive
 *  is the half that carried the "too much tilt" read and it comes down by
 *  two thirds; the climb barely moves.
 *
 *  WHAT IT SCALES. Both sources of body rotation, so one number governs a
 *  suit however it happens to be drawn:
 *
 *    * the velocity bank in drawPilot - `squirrel.rot * 0.8` - which every
 *      suit gets, custom animation or not. In normal flight `rot` runs
 *      -0.55..+0.95 rad, so the bank is roughly -25° climbing to +44°
 *      diving before this multiplier.
 *    * the heading pitch in paintIllustrated - RIG_PITCH_UP/DOWN, 14° and
 *      30° - which only rigged suits without a painted bank receive.
 *
 *  A rigged suit therefore carries both and feels the dial twice, which is
 *  the point: the dial answers "how much does THIS suit lean", not "which
 *  code path drew it".
 *
 *  HOW TO TUNE ONE. Change the number, reload, fly it. There is no in-game
 *  tuning UI on purpose - that was removed 25 Aug and is not coming back.
 *  `verify_suit_lean` fails the build if a shipping suit is missing from
 *  this table, so a new suit cannot quietly inherit someone else's feel.
 */
export type SuitLean = { up: number; down: number };
export const SUIT_LEAN_DEFAULT: SuitLean = { up: 0.8, down: 0.3 };
export const SUIT_LEAN: Record<string, SuitLean> = {
  vanguard:    { up: 0, down: 0 }, // drawn attitudes; no extra body tipping
  arcflash:    { up: 0, down: 0 }, // its own joint controller owns body attitude
  // flight was the reference here at the default; it joined the 3D lineup below

  // --- rigged suits: these carry the velocity bank AND the heading pitch,
  //     so they are the ones most likely to read as over-tipped

  // --- custom ANIMATION suits. Their frames are the owner's and are not to
  //     be touched; their LEAN is a dial like everyone else's.
  volt:        { up: 0.8, down: 0.3 },
  robo:        { up: 0.8, down: 0.3 },
  catsuit:     { up: 0.8, down: 0.3 },
  // Briella's Cat flies its still until its sprite sheet lands
  briellacat:  { up: 0.8, down: 0.3 },
  // the critters fly their painted tap banks with the standard lean

  // --- declared shape exceptions
  cyber:       { up: 0.8, down: 0.3 },
  // both aliens fly with NO lean: the owner zeroed climb and dive -
  // "the animation does the work", the painted attitudes are the pitch
  alien:       { up: 0, down: 0 },
  // THE 3D LINEUP (26 Oct 2026) flies with no lean either: its rendered dive
  // frames carry the attitude, as the aliens' painted ones do
  ember:       { up: 0, down: 0 },
  voidsuit:    { up: 0, down: 0 },
  groveguard:  { up: 0, down: 0 },
  cinderforge: { up: 0, down: 0 },
  sunforged:   { up: 0, down: 0 },
  abyssal:     { up: 0, down: 0 },
  gemmie:      { up: 0, down: 0 },
  iontrim:     { up: 0, down: 0 },
  sammie:      { up: 0, down: 0 },
  cosmic:      { up: 0, down: 0 },
  flight:      { up: 0, down: 0 },
  frost:       { up: 0, down: 0 },
  leviathan:   { up: 0, down: 0 },
  copper:      { up: 0, down: 0 },
  hedgehog:    { up: 0, down: 0 },
  origamist:   { up: 0, down: 0 },
  eclipse:     { up: 0, down: 0 },
  cryostar:    { up: 0, down: 0 },
  verdant:     { up: 0, down: 0 },
  raccoon:     { up: 0, down: 0 },
  ferret:      { up: 0, down: 0 },
  bigbooty:    { up: 0, down: 0 },
  porcelain:   { up: 0, down: 0 },
  nacre:         { up: 0, down: 0 },
  seraph:        { up: 0, down: 0 },
  tracer:       { up: 0, down: 0 },
  glasssuit:    { up: 0, down: 0 },
  redline:      { up: 0, down: 0 },
  robodog:      { up: 0, down: 0 },
  geode:        { up: 0, down: 0 },
  ghost:       { up: 0, down: 0 },
};

/** The dial for a suit, or the default for one that has none yet. */
export function suitLean(id: string): SuitLean {
  return SUIT_LEAN[id] ?? SUIT_LEAN_DEFAULT;
}
