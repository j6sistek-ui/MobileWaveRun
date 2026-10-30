import { NEW_PLANET_RGB } from "./zone-planet-colors";
import { platform } from "./platform";
import { ORBIT_PILOT_IDS, HIGH_ORBIT_PROFILES, PREMIUM_SUIT_IDS } from "./high-orbit-config";
import { FLIGHT_GRAVITY, QUICK_DROP_VY } from "./control-constants";

// TWO VERSIONS, ON PURPOSE (owner, 9 Sep 2026): "Production version
// intent: V1.0.0. Dev version: V1.0.12 and rolling each change. we isolate
// we are building v1 production version, and keep a dev stamp, that gets
// removed on packaging."
//
// GAME_VERSION is what we are BUILDING - the production label, and the only
// one a packaged build wears. It does not move while the v1 stretch is on.
// DEV_STAMP rides alongside it on the web pages and disappears the moment
// platform.native is true, so packaging drops it without anyone editing a
// string.
//
// QuarterDrop Games is a reserved name, not yet an LLC - no suffix until it
// is registered.
export const GAME_VERSION = "V1.0.0";
export const STUDIO = "Acornaut by QuarterDrop Games";
export const ART_VER = "330";

// TWO PAGES, ONE BUNDLE. The root page is the PRODUCTION game and sets
// nothing: every gate is real and everything is earned on the Star Chart.
// beta/index.html sets this global before importing the same bundle and
// gets the open TEST build: gates open, premium handed over, prototype
// doors on the Help sheet — and its own save slot, so an open-gate save
// can never leak into the production one.
// NEVER ON A STORE BUILD (App Store prep audit, section 2). The flag is a
// bare global, so anything that can get that global set - a stray script, a
// page loaded inside the shell, a future webDir slip - would hand a shipped
// app the open TEST build: every gate down, premium granted, a 10,000-acorn
// floor and free dust packs. The beta page is already outside shell/www, so
// this is the second lock rather than the first, and it is the one that
// cannot be undone by a packaging mistake. platform.native is set by the
// native adapter before the bundle boots.
export const IS_BETA =
  typeof window !== "undefined" &&
  !platform.native &&
  (window as { __ACORNAUT_BETA__?: unknown }).__ACORNAUT_BETA__ === true;

/** Beta itself is the 260-mission playtest. Retained name for cosmetic previews. */
export const STAR_MAP_PREVIEW = IS_BETA;

// THE ROAD IS LIVE (owner, 6 Sep 2026: "merge star map and spill and any
// gaps to main"). Production flies the same 260-mission road the beta
// playtested - the authored contracts in beta-campaign-manifest.ts, Spill
// missions on the road included - and EARNS it: sequential unlock, the
// three Hyper Run barriers, the reward ladder. Only the beta keeps its
// test conveniences (every mission open, the sample cosmetics, the dust
// grant), which still follow IS_BETA. Separate from STAR_MAP_PREVIEW on
// purpose: that flag carries the beta-only previews. The road itself is
// no longer a flag: campaign.ts builds the 260 rows for both pages.

// WHICH FEATURES, as opposed to WHICH SAVE SLOT. There used to be a second
// flag, BETA_FEATURES, for what is built; it was on everywhere and is gone.
// IS_BETA means only "this is the beta PAGE": it decides the save key, the
// build label and the test conveniences, never what the game contains.

// The two the owner asked to hold back are gated on their own, so either can
// be turned on by itself without touching anything else.
// HYPER RUN SHIPS. It was gated to the beta while it was a prototype; it
// is a finished mode now, with its own art, its own records and its own
// place in the mode picker, so the gate is gone rather than merely set to
// true for both pages. The constant stays because the art loader and a
// couple of call sites read it, and a named constant that says what it
// means beats `true` scattered through four files.
export const HYPER_RUN_ENABLED = true;

// Stamped by export-sandbox.mjs at build time, so two approvals of the
// same day are still tellable apart on the Profile footer. Unbuilt source
// (labs, tests) shows no stamp rather than a stale one.
export const BUILD_TIME = "__BUILD_TIME__";
// THE DEV STAMP ROLLS EVERY CHANGE (owner: "so i can verify it loaded").
// A version that never moves cannot answer the only question it is read
// for, which is the hour the owner just lost: new art loaded in a private
// window, old animations on screen, no way to tell a stale deploy from a
// bad delivery.
//
// The rolling part is ART_VER, which the shipping ritual already bumps on
// every PR - not a second number somebody has to remember to touch, which
// is exactly how the old label sat at 1.0.12 for twelve PRs. The 1.0.12
// base is the owner's to move whenever they want; the tail moves by
// itself.
export const DEV_STAMP = `1.0.12.${ART_VER}`;
export const BUILD = platform.native
  // packaged: the production label alone, no dev stamp
  ? `${STUDIO} · ${GAME_VERSION}`
  : `${STUDIO} · ${IS_BETA ? "Beta" : "Alpha"} ${GAME_VERSION} · dev ${DEV_STAMP}`;
// The production key predates the split and keeps every player's save.
// The beta seeds ITS key from the production save on first visit (so
// testers keep their progress) but writes only to its own slot after.
export const SAVE_KEY = IS_BETA ? "acornaut_illust_beta" : "acornaut_illust_v1";
export const LEGACY_KEYS = IS_BETA
  ? ["acornaut_illust_v1", "acornaut_beta", "acornaut_v2"]
  : ["acornaut_beta", "acornaut_v2"];
export const TUT_ARM = 1.25;

// Rendering-only tap burst. Physics remains instantaneous. The recovery is
// deliberately longer than a normal tap interval so the pose can keep
// settling between inputs instead of snapping home before the next tap.
export const TAP_ANIM_DURATION = 1.0;
// Approved from the beta trial: the burst runs everywhere. Suits without a
// painted bank take the universal articulated path.

// Rendering-only planet contact response — approved from the beta trial.
export const BOUNCE_ANIM_DURATION = 0.38;

// The tutorial's graduation gift, and the trail of guided steps that
// follows it: equip the suit, equip the helmet, fly Mission 1. One pair,
// named once, so the crash sheet, the hangar and the coach all agree.
export const GUIDE_SUIT = "iontrim";
// THE FIRST FLIGHT IS FLOWN IN ACORNUT (owner, 6 Sep 2026). The tutorial
// borrows the flagship; graduation hands it back, seats the pilot in Flight
// and the coach walks them to the Ion kit. He is earned at 500 stars.
export const TUTORIAL_SUIT = "vanguard";
// SUIT PITCH (owner, 6 Sep 2026): a whole-animation forward lean per suit,
// in degrees, positive = nose down. AcorNut tested best at 10-15 - split the
// difference. Every other suit flies as drawn until the owner tunes it with
// the beta pause-sheet dial; a tuned number lives in the save as suitPitch.
// owner, 7 Sep 2026: Eclipse leans 5 forward, Volt 25
// eclipse, cryostar and verdant dropped their 5 deg with their painted art: the 3D lineup flies level (26 Oct 2026)
export const SUIT_PITCH_DEFAULTS: Readonly<Record<string, number>> = { vanguard: 12, arcflash: 0, volt: 25 };
export const SUIT_PITCH_MIN = -20, SUIT_PITCH_MAX = 45;
export const suitPitchDefault = (id: string) => SUIT_PITCH_DEFAULTS[id] ?? 0;
export const GUIDE_HELM = "ion";


export const PHYS = {
  gravity: FLIGHT_GRAVITY,
  flap: -450,
  dive: QUICK_DROP_VY,
  bounceCancel: 210,
  squirrelX: 0.18,
  baseSpeed: 165,
  maxSpeed: 280,
  gapBase: 168,
  gapMin: 132,
  planetR: 42,
  powerDuration: 3.5,
  slowFactor: 0.42,
  // Halved from 10 on the owner's call (idea #3 of the audit list): ten
  // seconds of invulnerability trivialized long stretches. Starpup still
  // doubles it - the relative nerf is accepted.
  goldDuration: 5,
  overdriveGate: 100,
  overdriveSpan: 50,
  magnetR: 200,
  squirrelR: 16,
};


export type Helmet = {
  id: string;
  name: string;
  cost: number;
  visor: string;
  tint: number;
  rim: string;
  trim: string;
  glow: string | null;
  ears?: boolean;
  /** a matched set: only this suit may wear it. See helmetWornBy(). */
  suitOnly?: string;
  /** preserve a painted world/face inside the visor instead of punching it. */
  opaqueVisor?: boolean;
  /** visible only on the beta host while fitment is being reviewed. */
  beta?: boolean;
};

/** RETIRED HELMETS (owner, 27 Oct 2026: "both can be removed, cosmos is broken anyways"): off
 *  the shelves, the Star Chart and the Regalia Pack. A pilot who had already earned or bought one
 *  keeps it - past its old rung, or with the pack it came in - and nobody else is offered it. */
export const RETIRED_HELMETS: Record<string, { stars: number; bundle?: string }> = {
  sammie: { stars: 60, bundle: "bundle-regalia" },
  cosmic: { stars: 185 },
};

export const HELMETS: Helmet[] = [
  { id: "clear", name: "Clear", cost: 0, visor: "#bcd8f4", tint: 0.16, rim: "#cfd8e4", trim: "#8fa0b4", glow: null },
  { id: "ion", name: "Ion", cost: 15, visor: "#4ad8ff", tint: 0.2, rim: "#4ad8ff", trim: "#1b6f92", glow: "#4ad8ff" },
  { id: "solar", name: "Solar", cost: 30, visor: "#ffc46b", tint: 0.2, rim: "#ffb040", trim: "#a86a18", glow: "#ffa32e" },
  { id: "nebula", name: "Nebula", cost: 50, visor: "#c86bff", tint: 0.22, rim: "#e070ff", trim: "#6a2a9a", glow: "#c060ff" },
  { id: "lunar", name: "Lunar", cost: 70, visor: "#d8e2f0", tint: 0.18, rim: "#b6c2d4", trim: "#6f7c8e", glow: "#cfe0ff" },
  { id: "void", name: "Void", cost: 90, visor: "#2a2438", tint: 0.3, rim: "#d4af37", trim: "#1a1622", glow: "#a855f7" },
  { id: "comet", name: "Comet", cost: 120, visor: "#ff8a4a", tint: 0.2, rim: "#ff6a28", trim: "#8a2f0c", glow: "#ff7a30" },
  { id: "cherry", name: "Cherry", cost: 150, visor: "#ff9ec4", tint: 0.2, rim: "#ff8ab0", trim: "#a83a68", glow: "#ff7ab0" },
  { id: "royal", name: "Royal", cost: 200, visor: "#7fe0cf", tint: 0.18, rim: "#d4af37", trim: "#8a6a12", glow: "#ffd76a" },
  { id: "aurora", name: "Aurora", cost: 300, visor: "#4de8b8", tint: 0.18, rim: "#57e6c2", trim: "#1c7a5e", glow: "#5dffd0" },
  { id: "meteor", name: "Meteor", cost: 400, visor: "#c98a4e", tint: 0.2, rim: "#b5713a", trim: "#6e3f18", glow: "#ff9d47" },
  { id: "chrono", name: "Chrono", cost: 500, visor: "#e8d9a8", tint: 0.16, rim: "#c9a94f", trim: "#7a6428", glow: "#ffe27a" },
  { id: "gemmie", name: "Opal", cost: 0, visor: "#eddcff", tint: 0.16, rim: "#e0c8ff", trim: "#9a86b8", glow: "#ffb8f0" },
  { id: "phoenix", name: "Phoenix", cost: 175, visor: "#ffd2b0", tint: 0.18, rim: "#c4362a", trim: "#7a1d14", glow: "#ff6a1e" },
  { id: "sammie", name: "Samurai", cost: 0, visor: "#e6dccf", tint: 0.18, rim: "#7d1b20", trim: "#d4af37", glow: null },
  { id: "seraph", name: "Seraph", cost: 0, visor: "#fff4d8", tint: 0.14, rim: "#e8c66a", trim: "#a8853a", glow: "#ffe9a8" },
  { id: "chronarch", name: "Chronarch", cost: 0, visor: "#f0e6d2", tint: 0.16, rim: "#8a5a2a", trim: "#d4af37", glow: null },
  { id: "leviathan", suitOnly: "leviathan", name: "Leviathan", cost: 0, visor: "#d6fbff", tint: 0.18, rim: "#1c8f96", trim: "#0d5257", glow: "#3fe8f0" },
  { id: "princess", name: "Rose", cost: 350, visor: "#fdeef6", tint: 0.16, rim: "#6b3f9e", trim: "#c0348a", glow: "#ff8ad0" },
  { id: "verdant", name: "Verdant", cost: 0, visor: "#d8fff3", tint: 0.14, rim: "#d7b85a", trim: "#087a50", glow: "#38ff9a" },
  { id: "cryostar", name: "Cryostar", cost: 0, visor: "#dff8ff", tint: 0.15, rim: "#dcecf7", trim: "#168bd1", glow: "#54d8ff" },
  { id: "eclipse", name: "Eclipse", cost: 0, visor: "#eee6ff", tint: 0.17, rim: "#c98a72", trim: "#43206f", glow: "#b552ff" },
  { id: "cinderforge", name: "Cinderforge", cost: 0, visor: "#ff4a27", tint: 0.28, rim: "#8d211d", trim: "#2c1012", glow: "#ff3a20" },
  { id: "groveguard", suitOnly: "groveguard", opaqueVisor: true, name: "Groveguard", cost: 0, visor: "#7de5d3", tint: 0.18, rim: "#b89b58", trim: "#3e5b3d", glow: "#63e6d1" },
  { id: "cosmic", name: "Cosmic", cost: 0, visor: "#c8a7ff", tint: 0.2, rim: "#e0c8ff", trim: "#9c78bb", glow: "#c87dff" },
  { id: "sunforged", suitOnly: "sunforged", opaqueVisor: true, name: "Sunforged", cost: 0, visor: "#ffbf36", tint: 0.22, rim: "#c08a33", trim: "#4c351d", glow: "#ffb52e" },
  { id: "abyssal", name: "Abyssal", cost: 0, visor: "#4de8ff", tint: 0.24, rim: "#50cde8", trim: "#184c66", glow: "#39dcff" },
  { id: "amethyst", name: "Amethyst", cost: 0, visor: "#d8b5ff", tint: 0.2, rim: "#d3a94e", trim: "#4a2a76", glow: "#bf66ff" },
  { id: "ivoryguard", name: "Ivoryguard", cost: 0, visor: "#d9f4ff", tint: 0.17, rim: "#d8e9f1", trim: "#8a9ba8", glow: "#79d9ff" },
  { id: "reactor", name: "Reactor", cost: 0, visor: "#68ff4a", tint: 0.22, rim: "#b6ff5c", trim: "#6d7e28", glow: "#66ff32" },
];
if (!IS_BETA) {
  for (let i = HELMETS.length - 1; i >= 0; i--) {
    if (HELMETS[i].beta) HELMETS.splice(i, 1);
  }
}

export type Suit = {
  id: string;
  name: string;
  cost: number;
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
  /** the art already wears a head, so no helmet is painted over it */
  ownHead?: boolean;
  /** Built-in shell or intentionally bare head; neither accepts another visor. */
  headPolicy?: "integrated" | "helmetless";
  fixedHelmet?: string;
  /** the render still has a clear dome painted in, so Clear draws nothing
   *  over it. Bare-headed art — which is everything else now — wants the
   *  Clear helmet actually drawn. Drop this the moment a bare render lands. */
  bakedDome?: boolean;
  /** visible only on the beta host while fitment is being reviewed. */
  beta?: boolean;
};

// Some characters ARE their headgear: the Cat's ears and bubble are part
// of its painting, and a helmet stacked on one never lined up. Those suits
// take no helmet at all, and the Hangar will not let you pick one for them
// -- the head IS the cosmetic. Mark a new one with `ownHead: true`.
export function wearsOwnHead(suit: { cat?: boolean; ownHead?: boolean }) {
  return suit.cat === true || suit.ownHead === true;
}

// Some helmets are a MATCHED SET with one suit -- Leviathan's was fitted by
// hand on its own armour and looks like a costume piece, not a bubble, on
// anyone else. This is the one place the rule lives: give it the equipped
// ids and it answers which helmet is actually worn. A suit-locked helmet on
// the wrong suit falls back to Clear rather than half-fitting.
export function helmetWornBy(equippedHelmet: string, equippedSuit: string): Helmet {
  const h = HELMETS.find((x) => x.id === equippedHelmet) ?? HELMETS[0];
  if (h.suitOnly && h.suitOnly !== equippedSuit) return HELMETS[0];
  return h;
}

export const SUITS: Suit[] = [
  { id: "flight", name: "Flight", cost: 0, fur: "#d98f3d", furDark: "#a8641f", belly: "#f7e0bb", suit: "#c8762c", suitLite: "#eda85a", suitDark: "#8a4c14", trim: "#f6cf8a", glow: null, dust: null },
  // SOLD, NOT EARNED (owner, 13 Sep 2026: "unlock acornaut with 1,000
  // acorns, remove from star chart"). The flagship left the 570-star rung
  // for the Loadout shelf at this price; the tutorial still borrows him.
  { id: "vanguard", name: "AcorNut", cost: 1000, ownHead: true, fur: "#c4783e", furDark: "#593b28", belly: "#f6e7d1", suit: "#dcdedb", suitLite: "#fff8e8", suitDark: "#28303b", trim: "#d6ae63", glow: "#85edff", dust: null },
  // Carbon armour, blue eyes and a blue electrical wake. Since the 3D lineup
  // (owner, 26 Oct 2026) it flies a rendered bank and wears the pilot's helmet;
  // the wake stays, leaving from its feet.
  // ARCFLASH IS SOLD (owner, 7 Sep 2026): production, 1,850 star dust,
  // its blue electrical wake built in - see bundle-arcflash and DUST_STICKER.
  { id: "arcflash", name: "Arcflash", cost: 0, fur: "#c9702f", furDark: "#693715", belly: "#f4d4a4", suit: "#151c28", suitLite: "#536174", suitDark: "#080d16", trim: "#2587ff", glow: "#38caff", dust: null },
  { id: "porcelain", name: "Percy", cost: 0, fur: "#c7ccd3", furDark: "#767e8d", belly: "#fff8e9", suit: "#efe8d7", suitLite: "#fffdf3", suitDark: "#38567b", trim: "#466bb4", glow: "#b9d8ff", dust: null },
  { id: "nacre", name: "Envoy", cost: 0, ownHead: true, headPolicy: "helmetless", fur: "#cfb1df", furDark: "#8e709f", belly: "#f5d8dc", suit: "#e4d6dc", suitLite: "#fff0df", suitDark: "#4a315d", trim: "#d4a2d8", glow: "#e5a8ed", dust: null },
  { id: "origamist", name: "Patriot", cost: 0, fur: "#d5b99a", furDark: "#927555", belly: "#fff0d6", suit: "#eadcc5", suitLite: "#fff4dc", suitDark: "#444767", trim: "#d99a59", glow: "#f5bb75", dust: null },
  // ION IS THE ASTRONAUT (owner, 27 Oct 2026: "squirrel astronaut becomes ION (the trailer sample),
  // current ION give new name. Its more standard looking"): the old Ion art flies on as Tracer
  { id: "iontrim", name: "Ion", cost: 140, fur: "#a9a5a3", furDark: "#6d6866", belly: "#efe8e2", suit: "#9cc3dc", suitLite: "#d3e8f4", suitDark: "#4f6f86", trim: "#8a6a45", glow: "#bfe6ff", dust: "#d6efff" },
  // THE NEW LINEUP (owner's suit board, 27 Oct 2026): new suits cost more than the originals on
  // their shelf ("New ones get more expensive than the originals"); prices are first-draft.
  // Flown on beta and confirmed by the owner (27 Oct 2026: "Beta flies them good"): live
  { id: "tracer", name: "Tracer", cost: 420, fur: "#d98f3d", furDark: "#a8641f", belly: "#f7e0bb", suit: "#1b3f5c", suitLite: "#3d7fa8", suitDark: "#0e2436", trim: "#4ad8ff", glow: "#4ad8ff", dust: "#8fe9ff" },
  { id: "glasssuit", name: "Glass Suit", cost: 460, fur: "#c98f62", furDark: "#8c5a38", belly: "#f2dcc6", suit: "#dfe6ee", suitLite: "#ffffff", suitDark: "#9aa6b4", trim: "#d8a080", glow: "#ffe0c8", dust: "#fff0e4" },
  { id: "redline", name: "Red Line", cost: 500, fur: "#3a3a3e", furDark: "#1c1c20", belly: "#d9a679", suit: "#2b2d33", suitLite: "#4a4d55", suitDark: "#141519", trim: "#ff2e3a", glow: "#ff3b3b", dust: "#ff8a8a" },
  { id: "robodog", name: "Robo Dog", cost: 550, fur: "#b9bec4", furDark: "#6f757c", belly: "#e9edf0", suit: "#c8ced4", suitLite: "#ffffff", suitDark: "#5b636c", trim: "#2ad4e8", glow: "#3ce6ff", dust: "#a8f2ff" },
  { id: "geode", name: "Geode", cost: 600, fur: "#9b7fd0", furDark: "#5d4590", belly: "#e9defa", suit: "#7b5bc0", suitLite: "#c9b5f2", suitDark: "#3e2a6e", trim: "#d6a8ff", glow: "#c890ff", dust: "#e6d2ff" },
  { id: "copper", name: "Copper", cost: 50, fur: "#a85f28", furDark: "#663409", belly: "#e6bd83", suit: "#8c4718", suitLite: "#f2ab62", suitDark: "#421f06", trim: "#ffdda8", glow: "#ff8a2a", dust: "#ffb45c" },
  { id: "frost", name: "Frost", cost: 380, fur: "#e2ecf6", furDark: "#a9bccf", belly: "#ffffff", suit: "#6f9dc4", suitLite: "#a9d4ef", suitDark: "#40688a", trim: "#eaf7ff", glow: "#9fe4ff", dust: "#dff5ff" },
  { id: "voidsuit", name: "Void", cost: 240, fur: "#544a63", furDark: "#312a3d", belly: "#8d7fa0", suit: "#241d33", suitLite: "#4f4270", suitDark: "#100c18", trim: "#d4af37", glow: "#b45cff", dust: "#e7b6ff" },
  { id: "ember", name: "Ember", cost: 90, fur: "#b5722f", furDark: "#7c481a", belly: "#eccb96", suit: "#3a2a26", suitLite: "#7a4a3a", suitDark: "#1e1412", trim: "#ff7a2e", glow: "#ff5a1e", dust: "#ffb066" },
  { id: "robo", name: "Robo", cost: 0, robo: true, fur: "#9aa6b4", furDark: "#525d6c", belly: "#cfd8e2", suit: "#37414f", suitLite: "#7f93a6", suitDark: "#1d242e", trim: "#35e0ff", glow: "#35e0ff", dust: "#9be8ff" },
  { id: "alien", name: "Alien", cost: 0, fur: "#7ed957", furDark: "#3e8a2a", belly: "#d6f7b0", suit: "#2e6b5a", suitLite: "#57b09a", suitDark: "#173a2e", trim: "#c8ff6a", glow: "#7dff4d", dust: "#b6ff8a" },
  // The A/B is DECIDED: the standard bank won and flies "alien" above.
  // This is the retired custom-posed character, kept on the beta shelf as
  // Alien 1 by the owner's call ("alien 1 retires to unreleased").
  // SOLD, NOT EARNED (owner, 13 Sep 2026: "make ghost unlock by 200
  // acorns"). Left the 80-star rung for the shelf at this price.
  { id: "ghost", name: "Ghost", cost: 200, ghost: true, fur: "#dfe9f5", furDark: "#9fb4cf", belly: "#ffffff", suit: "#b9c8e0", suitLite: "#e8f0fb", suitDark: "#7f93b3", trim: "#bfe9ff", glow: "#9fd8ff", dust: "#dff2ff" },
  { id: "bigbooty", name: "Big Booty", cost: 0, booty: true, fur: "#e09a45", furDark: "#a86a1f", belly: "#ffe9c4", suit: "#8a3fd4", suitLite: "#b876ff", suitDark: "#54258c", trim: "#ffd23f", glow: "#ffb84d", dust: "#ffe08a" },
  { id: "catsuit", name: "Cat", cost: 0, cat: true, fur: "#e0863a", furDark: "#a85a1f", belly: "#f3d5a8", suit: "#d1712a", suitLite: "#f0a256", suitDark: "#8a4413", trim: "#cfd8e0", glow: null, dust: null },
  // THE CRITTERS (owner, 7 Sep 2026): three more acorn-intolerant characters,
  // each its own head, sold as the Critter Pack like the Circuit trio. Each
  // flies a painted 16-frame tap bank cut from the owner's sheets.
  { id: "raccoon", name: "Bandit", cost: 0, ownHead: true, fur: "#8f8a86", furDark: "#3a3532", belly: "#e8e2da", suit: "#d7dde3", suitLite: "#ffffff", suitDark: "#5c6672", trim: "#33c8ff", glow: "#38d0ff", dust: "#a8ecff" },
  { id: "ferret", name: "Noodle", cost: 0, ownHead: true, fur: "#6b4a3a", furDark: "#3b2418", belly: "#f1e6d6", suit: "#f2b21c", suitLite: "#ffd75a", suitDark: "#8a5f0a", trim: "#2b2b2b", glow: "#ffc83a", dust: "#ffe08a" },
  { id: "hedgehog", name: "Quill", cost: 0, ownHead: true, fur: "#8a6a48", furDark: "#3f2b18", belly: "#e9d6bd", suit: "#6f8f4a", suitLite: "#a8c46e", suitDark: "#37502a", trim: "#ff9a2a", glow: "#ffa53a", dust: "#ffd28a" },
  { id: "gemmie", name: "Gemmie", cost: 0, fur: "#e6cdf2", furDark: "#a98cc4", belly: "#ffffff", suit: "#d9c3ea", suitLite: "#ffffff", suitDark: "#8f7aa8", trim: "#a8e6ff", glow: "#ffb8f0", dust: "#d8f4ff" },
  // RE-MADE AS STONE (owner, 26 Oct 2026): the id stays so every save, bundle and reward
  // still finds it; the 3D stone creature's banks replace the Samurai art.
  { id: "sammie", name: "Stone", cost: 0, fur: "#a7a58c", furDark: "#6d6b58", belly: "#d6d3bd", suit: "#8f8d74", suitLite: "#c2bfa5", suitDark: "#4f4e3f", trim: "#5fd36a", glow: null, dust: null },
  { id: "seraph", name: "Seraph", cost: 0, fur: "#d98f3d", furDark: "#a8641f", belly: "#fff6e2", suit: "#f2ead8", suitLite: "#ffffff", suitDark: "#b8a882", trim: "#e8c66a", glow: "#ffe9a8", dust: "#fff4cf" },
  { id: "leviathan", name: "Leviathan", cost: 0, fur: "#d98f3d", furDark: "#a8641f", belly: "#f2e0c0", suit: "#127f7d", suitLite: "#3fd8cf", suitDark: "#06413f", trim: "#5ce6dc", glow: "#4fe8dd", dust: "#a8fff6" },
  { id: "verdant", name: "Verdant", cost: 0, fur: "#d98f3d", furDark: "#9e5719", belly: "#f8e4bd", suit: "#0c6844", suitLite: "#45b977", suitDark: "#063e2a", trim: "#d7b85a", glow: "#38ff9a", dust: "#a8ffd1" },
  { id: "cryostar", name: "Cryostar", cost: 0, fur: "#d98f3d", furDark: "#9e5719", belly: "#f8e4bd", suit: "#eaf6ff", suitLite: "#ffffff", suitDark: "#2f86ba", trim: "#56ceff", glow: "#54d8ff", dust: "#d8f8ff" },
  { id: "eclipse", name: "Eclipse", cost: 0, fur: "#d98f3d", furDark: "#9e5719", belly: "#f8e4bd", suit: "#171126", suitLite: "#503274", suitDark: "#090611", trim: "#c98a72", glow: "#b552ff", dust: "#e2b5ff" },
  { id: "volt", name: "Volt", cost: 0, ownHead: true, fur: "#8a7434", furDark: "#4a3f14", belly: "#c9b06a", suit: "#46421a", suitLite: "#6f6220", suitDark: "#1d1d04", trim: "#6eab3c", glow: "#54ff2e", dust: "#a8ff7a" },
  { id: "cinderforge", name: "Cinderforge", cost: 0, fur: "#d98f3d", furDark: "#9e5719", belly: "#f8e4bd", suit: "#2a1114", suitLite: "#7e2f27", suitDark: "#12080a", trim: "#ff4b2f", glow: "#ff3b22", dust: "#ff9470" },
  { id: "groveguard", name: "Groveguard", cost: 0, fur: "#d98f3d", furDark: "#9e5719", belly: "#f8e4bd", suit: "#2e5e2d", suitLite: "#719452", suitDark: "#18351c", trim: "#c6a75d", glow: "#65dca1", dust: "#bff0ac" },
  // RE-MADE AS CUPCAKE (owner, 26 Oct 2026): the 3D frosted squirrel replaces the Cosmic
  // art; the id stays, so its Star Chart rung, helmet and wake all carry over.
  { id: "cosmic", name: "Cupcake", cost: 0, fur: "#f07ab8", furDark: "#b84482", belly: "#fde3ef", suit: "#f59ac8", suitLite: "#ffd1e8", suitDark: "#a8336f", trim: "#7fd3ff", glow: "#d687ff", dust: "#f0cfff" },
  // BRIELLA'S CAT (owner, 6 Sep 2026): a whole pencil-and-fur character,
  // its own head, no helmet. Ships the still for now; the flight sprite
  // sheet follows and is wired as its bank when it lands. Beta until then.
  { id: "briellacat", name: "Briella's Cat", cost: 999, ownHead: true, fur: "#f4f3f0", furDark: "#b8b6b2", belly: "#ffffff", suit: "#ecebe8", suitLite: "#ffffff", suitDark: "#8c8a86", trim: "#2a2a2a", glow: null, dust: null },
  { id: "sunforged", name: "Sunforged", cost: 0, fur: "#d98f3d", furDark: "#9e5719", belly: "#f8e4bd", suit: "#5b4021", suitLite: "#b17b35", suitDark: "#2a1d11", trim: "#ffb83e", glow: "#ffad2b", dust: "#ffd88a" },
  { id: "abyssal", name: "Abyssal", cost: 0, fur: "#d98f3d", furDark: "#9e5719", belly: "#f8e4bd", suit: "#0c4d76", suitLite: "#178eb4", suitDark: "#06263e", trim: "#48d9ff", glow: "#39dcff", dust: "#a8f2ff" },
  { id: "cyber", name: "Cyber", cost: 0, ownHead: true, fur: "#9b3beb", furDark: "#2511aa", belly: "#e2cff3", suit: "#4e29b6", suitLite: "#d2a7f2", suitDark: "#0f0646", trim: "#ff3df0", glow: "#7030df", dust: "#c8a8ff" },
];
// Beta-only suits are stripped from production entirely. Anything a PACK
// sells therefore may not carry `beta` - Cyber did, so the Circuit Pack
// advertised three suits on the live page and could only ever deliver two.
// A bundle-vs-catalog check would catch the next one; for now the rule is
// simply that selling a thing requires shipping it.
if (!IS_BETA) {
  for (let i = SUITS.length - 1; i >= 0; i--) {
    if (SUITS[i].beta) SUITS.splice(i, 1);
  }
}

export type Trail = { id: string; name: string; cost: number; colors: string[] };

/** Equipable Star Chart rewards with a retained, continuous flight stream.
 * Suit-exclusive wakes keep their own nozzle-driven renderers. */
export const STAR_CHART_TRAILS = new Set([
  "ion", "bubble", "bloom", "comet", "prism", "plasma", "galaxy",
  "aurora", "frost", "voidsmoke", "supernova", "phoenixplume", "opalfeather",
]);

const SUIT_BUILT_IN_TRAILS: Record<string,string> = {
  vanguard:"vanguardwake", arcflash:"arcflashwake",
  ...Object.fromEntries(ORBIT_PILOT_IDS.map(id=>[id,HIGH_ORBIT_PROFILES[id].trail])),
};
export const builtInTrailSuit = (trail:string):string|undefined =>
  Object.keys(SUIT_BUILT_IN_TRAILS).find(id=>SUIT_BUILT_IN_TRAILS[id]===trail);

export function trailWornBy(equippedTrail: string, equippedSuit: string): string {
  return SUIT_BUILT_IN_TRAILS[equippedSuit] || (builtInTrailSuit(equippedTrail) ? "sparks" : equippedTrail);
}
export function canWearTrail(id: string, suit: string): boolean {
  return SUIT_BUILT_IN_TRAILS[suit] ? id === SUIT_BUILT_IN_TRAILS[suit] : !builtInTrailSuit(id);
}

export const TRAILS: Trail[] = [
  { id: "sparks", name: "Rocket Sparks", cost: 0, colors: ["#ffe080", "#ff8030", "#ff4020"] },
  { id: "vanguardwake", name: "AcorNut Wake", cost: 0, colors: ["#85edff", "#edc780", "#fff1d0"] },
  { id: "arcflashwake", name: "Arcflash Wake", cost: 0, colors: ["#dcfaff", "#36c8ff", "#155cff"] },
  ...ORBIT_PILOT_IDS.map(id=>({id:HIGH_ORBIT_PROFILES[id].trail,name:HIGH_ORBIT_PROFILES[id].wake,cost:0,colors:[...HIGH_ORBIT_PROFILES[id].colors]})),
  { id: "ion", name: "Ion Stream", cost: 0, colors: ["#b8f4ff", "#4ad8ff", "#1b6f92"] },
  { id: "bubble", name: "Bubble Jets", cost: 0, colors: ["#d8f6ff", "#7ad8ff", "#3aa0c8"] },
  { id: "bloom", name: "Nebula Bloom", cost: 0, colors: ["#ffb0ff", "#c060ff", "#6a2a9a"] },
  { id: "comet", name: "Comet Booster", cost: 0, colors: ["#ffd060", "#ff6a28", "#8a2f0c"] },
  { id: "prism", name: "Prism Shards", cost: 0, colors: ["#ff6ad2", "#6affd2", "#6ad2ff"] },
  { id: "plasma", name: "Plasma Arc", cost: 0, colors: ["#f4e8ff", "#b45cff", "#4a2080"] },
  { id: "galaxy", name: "Galaxy Dust", cost: 0, colors: ["#fff3b8", "#8fb8ff", "#3d4fa8"] },
  { id: "aurora", name: "Aurora Ribbon", cost: 0, colors: ["#5dffd0", "#7fe0cf", "#c86bff"] },
  { id: "frost", name: "Frostbite", cost: 0, colors: ["#eaf7ff", "#9fe4ff", "#6f9dc4"] },
  { id: "voidsmoke", name: "Void Smoke", cost: 0, colors: ["#c8b8e0", "#4f4270", "#241d33"] },
  { id: "supernova", name: "Supernova", cost: 0, colors: ["#fff8d0", "#ff9d47", "#ff4020"] },
  { id: "opalfeather", name: "Opal Feather", cost: 0, colors: ["#fff5ef", "#7fffe0", "#8fb8ff"] },
  { id: "clockwork", name: "Clockwork Wake", cost: 0, colors: ["#fff0b8", "#d89a3a", "#7a4a18"] },
  { id: "celestialtide", name: "Celestial Tide", cost: 0, colors: ["#e8f4ff", "#75caff", "#745cff"] },
  { id: "phoenixplume", name: "Phoenix Plumage", cost: 0, colors: ["#fff2a8", "#ff9b42", "#d9366e"] },
  { id: "verdantflourish", name: "Verdant Flourish", cost: 0, colors: ["#e7ffd5", "#55e89d", "#16866a"] },
  { id: "eclipseglyph", name: "Eclipse Sigils", cost: 0, colors: ["#ffe2bd", "#c77dff", "#35204f"] },
];

export type Pal = {
  id: string;
  name: string;
  tag: string;
  desc: string;
  art?: string;
};


// Idle animation banks, by pal. The length is the bank's TRUE length -
// resampling a 9-frame loop up to 16 only duplicates renders - and a pal
// absent from this table simply keeps its still.
export const PAL_ANIM: Record<string, number> = {
  switchback: 16, bee: 9, buddy: 25, clockling: 36, cometsprite: 4, meteorcore: 25,
  nightglider: 16, nutsack: 36, pocketmoon: 25, prismwing: 16,
  starpup: 25, tinbot: 36, ufo: 16, voidjelly: 36, wisp: 25,
  // owner sheets, 7 Sep 2026
  magnetar: 36, babyalien: 36, satellite: 36, astrafox: 36, spacepuppy: 36,
};

export const PALS: Pal[] = [
  { id: "none", name: "None", tag: "SOLO", desc: "Fly solo. The classic run." },
  // STOPWATCH (owner, 7 Sep 2026): the automaton holds the clock. The id
  // stays "switchback" so every save and receipt that named it still does.
  { id: "switchback", name: "Stopwatch", tag: "COMPANION", desc: "Tap Toggles Scroll Speed", art: "switchback" },
  { id: "bee", name: "Astrolobee", tag: "VANILLA", desc: "Powerup/Acorns Disabled", art: "bee" },
  { id: "buddy", name: "Acorn", tag: "MAGNET", desc: "Magnet Effect", art: "buddy" },
  { id: "voidjelly", name: "Jelly", tag: "SOFT BOUNCE", desc: "Bounce Softer", art: "voidjelly" },
  { id: "cometsprite", name: "Comet", tag: "LONG SLOW", desc: "2x Freeze Duration", art: "cometsprite" },
  { id: "meteorcore", name: "Meteor Core", tag: "2X SPECIALS", desc: "2x Power Ups", art: "meteorcore" },
  { id: "pocketmoon", name: "Moon", tag: "LOW GRAV", desc: "Lower Gravity", art: "pocketmoon" },
  { id: "ufo", name: "UFO", tag: "SHIELD UP", desc: "Start with Shield", art: "ufo" },
  { id: "nutsack", name: "Nut-Sack", tag: "2X NUTS", desc: "2x Acorns but the sack is heavy", art: "nutsack" },
  { id: "starpup", name: "Star Child", tag: "LONG GOLD", desc: "Double Golden Effect", art: "starpup" },
  { id: "tinbot", name: "TinTin", tag: "NO HOLES", desc: "Disables Blackholes", art: "tinbot" },
  { id: "wisp", name: "Wisp", tag: "GATE DRIFT", desc: "More gate movement", art: "wisp" },
  { id: "prismwing", name: "Prismwing", tag: "HUE SHIFT", desc: "Planet Bounces Repaint Sky", art: "prismwing" },
  { id: "clockling", name: "TurClock", tag: "TIME SLIP", desc: "Scroll Speed Drift", art: "clockling" },
  { id: "nightglider", name: "Nightglider", tag: "STEADY GATES", desc: "Gate Drift Off", art: "nightglider" },
  // owner, 7 Sep 2026: four new companions. Their effects live in PAL_FX
  // (sim.ts) as level fx, so a pal dial and a mission dial are one lever.
  { id: "magnetar", name: "Magnetar", tag: "FLIPPED", desc: "Upside Down World", art: "magnetar" },
  { id: "babyalien", name: "Baby Alien", tag: "MINI GAPS", desc: "Mini Gaps", art: "babyalien" },
  { id: "satellite", name: "Satellite", tag: "FOG 100%", desc: "Visibility Reduced", art: "satellite" },
  { id: "astrafox", name: "AstraFox", tag: "WILD GATES", desc: "Wild Gate Sway", art: "astrafox" },
  // SPACE PUPPY (owner, 7 Sep 2026: "one last pal to make the page even").
  // The axolotl turns a run into a bounce house: no debris, no pickups,
  // no gate count, planets up to 2.5x, bounces 2x and 3x off the big ones.
  { id: "spacepuppy", name: "Space Puppy", tag: "BOUNCE HOUSE", desc: "Bounce House", art: "spacepuppy" },
];

/** THE COMPANIONS THAT MOVE THE GATES. Nightglider holds them still, so
 *  it cannot fly beside one of these (owner, 7 Sep 2026) - the two would
 *  simply cancel and the pilot would be flying a blank. */
export const DRIFT_PALS = new Set(["wisp", "astrafox"]);
/** two companions that refuse to fly together */
export function palsClash(a: string, b: string) {
  return (a === "nightglider" && DRIFT_PALS.has(b)) || (b === "nightglider" && DRIFT_PALS.has(a));
}

export type Env = {
  name: string;
  wash: [number, number, number, number];
  wash2: [number, number, number, number];
  planetBias: number[];
  debrisBias: number[];
  sky: SkyId;
};

// Painted sky panoramas. Each carries its MEAN COLOUR, measured from
// the art, and so does every planet and rock. Legibility is then a
// perceptual question, not a brightness one: a pink planet on a green
// sky is perfectly readable at the same brightness, while grey on grey
// is not. sep() answers it, and nothing illegible is ever spawned.
export type SkyId =
  | "indigo" | "ice" | "inferno" | "mono" | "magenta"
  | "verdant" | "ghost" | "neon" | "vortex" | "gold"
  | "dark1" | "dark2" | "dark3" | "dark4" | "dark5" | "dark6" | "dark7"
  | "dark8" | "dark9" | "dark10" | "dark11" | "dark12" | "dark13" | "dark14";
export type RGB = [number, number, number];

export const SKY_RGB: Record<SkyId, RGB> = {
  indigo: [0.11, 0.14, 0.34],
  ice: [0.57, 0.73, 0.83],
  inferno: [0.42, 0.18, 0.11],
  mono: [0.17, 0.17, 0.18],
  magenta: [0.38, 0.20, 0.48],
  verdant: [0.09, 0.33, 0.24],
  ghost: [0.76, 0.76, 0.78],
  neon: [0.23, 0.20, 0.51],
  vortex: [0.09, 0.06, 0.15],
  gold: [0.76, 0.49, 0.14],
  // The fourteen deep-space plates. Every one sits under luma 0.18, so
  // anything painted lands on top of them instead of into them.
  dark1: [0.051, 0.067, 0.134],
  dark2: [0.114, 0.154, 0.236],
  dark3: [0.092, 0.094, 0.112],
  dark4: [0.107, 0.131, 0.176],
  dark5: [0.168, 0.176, 0.184],
  dark6: [0.078, 0.113, 0.165],
  dark7: [0.088, 0.124, 0.185],
  dark8: [0.072, 0.097, 0.187],
  dark9: [0.081, 0.092, 0.162],
  dark10: [0.093, 0.097, 0.099],
  dark11: [0.083, 0.102, 0.216],
  dark12: [0.085, 0.134, 0.212],
  dark13: [0.041, 0.058, 0.127],
  dark14: [0.052, 0.081, 0.139],
};

// Deep Space and Lost in Space fly under the dark plates only — no
// vibrant sky, no jewel-tone grade, just space. Free Flight keeps its
// painted colour zones. A zone still owns ONE plate, so a shift still
// reads as arriving somewhere, and 26 zones spread across 14 skies.
export const DARK_SKIES: SkyId[] = [
  "dark1", "dark2", "dark3", "dark4", "dark5", "dark6", "dark7",
  "dark8", "dark9", "dark10", "dark11", "dark12", "dark13", "dark14",
];

export function skyIdFor(flight: string, envIdx: number): SkyId {
  if (flight === "deep" || flight === "lost")
    return DARK_SKIES[((envIdx % DARK_SKIES.length) + DARK_SKIES.length) % DARK_SKIES.length];
  return ENVS[envIdx].sky;
}

// How much of the environment's colour wash survives. Under the dark
// plates it is dialled right back: the tint still names the zone, but it
// no longer paints the whole void turquoise.
export function washScale(flight: string) {
  return flight === "deep" || flight === "lost" ? 0.45 : 1;
}

export const PLANET_COUNT = 134;

// THE HUB'S OWN PLANET. The MODES tile on the home screen paints this one,
// and it is named here because the boot loader and the tile have to agree
// about it. They stopped agreeing once zone art went lazy: the boot fetch
// narrowed to ENVS[0].planetBias, which is Deep Space [0, 1, 2, 33, 34],
// while the tile kept asking for 8 - a Nebula Nursery planet that nothing
// fetches until a pilot actually flies that zone. The result was a blank
// box on a freshly loaded home screen. Both sides read this constant now,
// so moving the hub to a different planet cannot silently un-load it.
export const HUB_PLANET = 8;
export const DEBRIS_COUNT = 55;
// Special-mode seeded art rolls retain their original range.
export const LEGACY_DEBRIS_COUNT = 27;

export const PLANET_RGB: RGB[] = [
  [0.34, 0.45, 0.47], [0.68, 0.49, 0.25], [0.63, 0.66, 0.68],
  [0.35, 0.17, 0.12], [0.20, 0.51, 0.50], [0.46, 0.44, 0.43],
  [0.65, 0.42, 0.20], [0.13, 0.31, 0.49], [0.56, 0.29, 0.43],
  [0.25, 0.34, 0.13], [0.39, 0.23, 0.49], [0.18, 0.22, 0.27],
  [0.36, 0.27, 0.18], [0.67, 0.51, 0.58], [0.38, 0.18, 0.11],
  [0.39, 0.54, 0.70], [0.40, 0.19, 0.09], [0.29, 0.16, 0.39],
  [0.30, 0.18, 0.11], [0.33, 0.37, 0.48], [0.14, 0.31, 0.39],
  [0.43, 0.09, 0.13], [0.52, 0.40, 0.75], [0.71, 0.62, 0.57],
  [0.78, 0.74, 0.66], [0.13, 0.16, 0.24], [0.92, 0.65, 0.74],
  [0.15, 0.11, 0.28], [0.24, 0.60, 0.81], [0.16, 0.21, 0.48],
  [0.43, 0.26, 0.64], [0.36, 0.58, 0.69], [0.30, 0.15, 0.09],
  ...NEW_PLANET_RGB,
];

/** Perceptual separation in a luma + opponent-colour space. Luminance
 *  is weighted heaviest because form reads by brightness first, but hue
 *  gets its say — which is what makes pink-on-green legible. Calibrated
 *  against the art: orange-on-orange 0.04, black-on-black 0.13,
 *  white-on-white 0.13, grey-on-white 0.24, green-on-green 0.26 all sit
 *  below the bar; pink-on-green 0.55, blue-on-orange 0.63 and
 *  lava-on-ice 1.14 sit far above it. */
export function sep(a: RGB, b: RGB) {
  const l = (c: RGB) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  const dL = 2.1 * (l(a) - l(b));
  const dA = a[0] - a[1] - (b[0] - b[1]);
  const dB = a[2] - (a[0] + a[1]) / 2 - (b[2] - (b[0] + b[1]) / 2);
  return Math.sqrt(dL * dL + dA * dA + dB * dB);
}
export const MIN_SEP = 0.3;

export const ENVS: Env[] = [
  { name: "DEEP SPACE", wash: [40, 60, 110, 0.14], wash2: [70, 90, 160, 0.06], planetBias: [0, 1, 2, 33, 34], debrisBias: [1, 21], sky: "indigo" },
  { name: "NEBULA NURSERY", wash: [150, 70, 210, 0.16], wash2: [255, 110, 180, 0.08], planetBias: [4, 8, 35, 36, 37], debrisBias: [9, 27], sky: "magenta" },
  { name: "ICE MOON", wash: [90, 180, 220, 0.12], wash2: [160, 230, 255, 0.06], planetBias: [31, 38, 39, 40, 41], debrisBias: [11, 28], sky: "ice" },
  { name: "SOLAR FURNACE", wash: [255, 120, 40, 0.12], wash2: [255, 80, 60, 0.07], planetBias: [3, 42, 43, 44, 45], debrisBias: [12, 14], sky: "inferno" },
  { name: "CRYSTAL BELT", wash: [140, 220, 255, 0.12], wash2: [200, 140, 255, 0.07], planetBias: [28, 10, 51, 52, 53], debrisBias: [2, 6, 13], sky: "neon" },
  { name: "TIME FRACTURE", wash: [90, 255, 180, 0.1], wash2: [200, 255, 120, 0.05], planetBias: [11, 106, 107, 108, 109], debrisBias: [48, 49], sky: "verdant" },
  { name: "MONOCHROME VOID", wash: [255, 255, 255, 0.08], wash2: [140, 140, 150, 0.05], planetBias: [5, 61, 62, 63, 64], debrisBias: [0, 3], sky: "mono" },
  { name: "EMERALD EXPANSE", wash: [40, 255, 120, 0.12], wash2: [140, 255, 80, 0.06], planetBias: [87, 88, 89, 90, 91], debrisBias: [42, 43], sky: "verdant" },
  { name: "CRIMSON STORM", wash: [220, 40, 50, 0.14], wash2: [120, 10, 20, 0.08], planetBias: [21, 54, 55, 56, 57], debrisBias: [31, 32], sky: "inferno" },
  { name: "SAPPHIRE ABYSS", wash: [20, 50, 180, 0.16], wash2: [10, 20, 80, 0.08], planetBias: [46, 47, 48, 49, 50], debrisBias: [29, 30], sky: "indigo" },
  { name: "VIOLET REALM", wash: [140, 40, 220, 0.14], wash2: [80, 20, 140, 0.08], planetBias: [30, 27, 58, 59, 60], debrisBias: [33, 34], sky: "vortex" },
  { name: "GOLDEN HOUR", wash: [255, 180, 60, 0.12], wash2: [220, 120, 40, 0.07], planetBias: [74, 75, 76, 77, 78], debrisBias: [15, 25], sky: "gold" },
  { name: "SOLAR CORONA", wash: [255, 220, 80, 0.12], wash2: [255, 140, 40, 0.07], planetBias: [79, 80, 81, 82, 83], debrisBias: [38, 39], sky: "gold" },
  { name: "HYPERVIVID", wash: [255, 40, 180, 0.12], wash2: [40, 220, 255, 0.1], planetBias: [13, 19, 65, 66, 67], debrisBias: [18, 35], sky: "neon" },
  { name: "NEON BAZAAR", wash: [255, 40, 160, 0.12], wash2: [40, 255, 200, 0.08], planetBias: [25, 110, 111, 112, 113], debrisBias: [5, 50], sky: "neon" },
  { name: "ALIEN JUNGLE", wash: [40, 160, 60, 0.14], wash2: [20, 80, 40, 0.08], planetBias: [9, 12, 22, 92, 93], debrisBias: [17, 44], sky: "verdant" },
  { name: "ACID SWAMP", wash: [160, 220, 20, 0.12], wash2: [80, 120, 10, 0.07], planetBias: [94, 95, 96, 97, 98], debrisBias: [24, 45], sky: "verdant" },
  { name: "CORAL SHALLOWS", wash: [255, 120, 140, 0.12], wash2: [80, 180, 200, 0.08], planetBias: [23, 26, 84, 85, 86], debrisBias: [40, 41], sky: "magenta" },
  { name: "BONE DESERT", wash: [220, 190, 140, 0.1], wash2: [140, 100, 60, 0.07], planetBias: [6, 24, 71, 72, 73], debrisBias: [20, 37], sky: "gold" },
  { name: "PULSAR FIELD", wash: [180, 210, 255, 0.14], wash2: [80, 90, 200, 0.08], planetBias: [29, 102, 103, 104, 105], debrisBias: [16, 7, 47], sky: "ice" },
  { name: "BLACKOUT ZONE", wash: [60, 70, 110, 0.1], wash2: [30, 34, 60, 0.06], planetBias: [124, 125, 126, 127, 128], debrisBias: [8, 10], sky: "mono" },
  { name: "AURORA CROWN", wash: [60, 255, 190, 0.14], wash2: [140, 120, 255, 0.08], planetBias: [15, 20, 99, 100, 101], debrisBias: [19, 46], sky: "verdant" },
  { name: "RUST BELT", wash: [200, 110, 50, 0.12], wash2: [140, 70, 40, 0.07], planetBias: [16, 18, 68, 69, 70], debrisBias: [26, 4, 36], sky: "inferno" },
  { name: "GHOST NEBULA", wash: [200, 210, 235, 0.09], wash2: [150, 160, 200, 0.06], planetBias: [119, 120, 121, 122, 123], debrisBias: [52, 53], sky: "ghost" },
  { name: "PRISM STORM", wash: [255, 220, 0, 0.12], wash2: [0, 190, 255, 0.1], planetBias: [114, 115, 116, 117, 118], debrisBias: [23, 51], sky: "neon" },
  { name: "EVENT HORIZON", wash: [140, 40, 255, 0.16], wash2: [40, 0, 80, 0.1], planetBias: [129, 130, 131, 132, 133], debrisBias: [22, 54], sky: "vortex" },
];

// The tail hinge. A damped spring, not a keyframe set: stiffness sets
// how fast it returns, damping how many times it rings on the way. At
// these values it overshoots once, crosses home, and settles in about a
// second — the gravity bounce, for free.
export const TAIL = {
  stiffness: 55,
  damping: 6.2,
  flap: 8.0,     // impulse when the pilot taps
  dive: 11.0,    // harder, and the other way, when the pilot dives
  maxA: 0.75,    // radians — the plume never folds through the body
};

export const ENV_GATES = 20;

// Free Flight keeps the door to the arcade shut until this gate. The
// crossing is a late-run reward — meeting it on gate two would sell the
// illustrated game short before it has been seen.
export const RETRO_GATE = 100;
// How many gates a Free Flight black hole holds you for. The stretch ends
// at a hole you fly into, so this is a distance the pilot reads, not a
// timer that expires on them.
export const WARP_GATES = 15;

// Premium items. These never appear on the level track — no amount of
// flying reveals them — and acorns cannot buy them; they are bought for
// real money. The beta hands them over so they can be played and judged.
// THE THREE PACKS. Premium is sold as themed sets rather than a wall of
// single items: a pack is a LOOK - suit, its helmet, its trail, its
// companion - so buying one dresses the pilot completely instead of
// leaving them half-matched.
//
// Cyber, Volt and Robo moved in here from the Star Chart. That is a real
// trade and it is deliberate: they become premium skins, and the two
// reward slots they vacated (\u2605 60 and \u2605 200) are refilled below with
// helmets that used to be premium and are now earned. Nothing was simply
// taken away.
/** A slot in a pack, and what KIND of thing it is.
 *
 *  This used to be a flat list of ids where a repeated id meant "the suit
 *  and its helmet too" - because a suit and its helmet genuinely share one
 *  id. That implicitness has cost three separate bugs already, the last one
 *  a card advertising "16 items" for a pack of ten. The kind is written
 *  down now, so counting a pack, pricing it and painting its contents all
 *  read the same list and cannot disagree about what is in it. */
export type BundleItem = { kind: "suit" | "helm" | "trail" | "pal"; id: string };

/** Editable presentation and exact Stardust saving for one complete kit. */
export type BundleKit = { banner: string; discountDust: number };
export type Bundle = {
  id: string; name: string; blurb: string; dust: number; items: BundleItem[];
  kit: BundleKit;
  /** Kept out of the featured rotation; its single uses DUST_STICKER. */
  fixed?: boolean;
  /** Legacy owner-set-price marker, retained for catalog compatibility.
   *  All purchase paths now use the kit quote. */
  featuredAtSticker?: boolean;
  /** Offered every day on its own card, outside the featured rotation. */
  alwaysAvailable?: boolean;
  /** Its unowned contents remain purchasable singly while featured. */
  keepSingles?: boolean;
};
/** Single pilots remain premium without pretending to be bundles. */
export const FIXED_SHOP_SUIT_IDS = ["arcflash", "porcelain", "nacre", "origamist"] as const;

export const BUNDLES: Bundle[] = [
  { id: "bundle-premium-trio", kit: { banner: "shop/bundle-premium-trio.png", discountDust: 50 }, name: "Premium Pilot Trio", blurb: "Percy, Envoy and Patriot, with all three signature wakes. Also available individually.", dust: 250, featuredAtSticker: true, alwaysAvailable: true, keepSingles: true, items: [{ kind: "suit", id: "porcelain" }, { kind: "suit", id: "nacre" }, { kind: "suit", id: "origamist" }] },
  {
    id: "bundle-aurora",
    kit: { banner: "shop/bundle-aurora.png", discountDust: 50 },
    name: "Aurora Pack",
    blurb: "Ice, growth and eclipse \u2014 three skies, worn.",
    dust: 90,
    items: [
      { kind: "suit", id: "cryostar" }, { kind: "suit", id: "verdant" }, { kind: "suit", id: "eclipse" },
      { kind: "helm", id: "cryostar" }, { kind: "helm", id: "verdant" }, { kind: "helm", id: "eclipse" },
      { kind: "trail", id: "celestialtide" }, { kind: "trail", id: "verdantflourish" }, { kind: "trail", id: "eclipseglyph" },
    ],
  },
  {
    id: "bundle-regalia",
    kit: { banner: "shop/bundle-regalia.png", discountDust: 80 },
    name: "Regalia Pack",
    blurb: "Gemcut, seraphim and the deep \u2014 the ceremonial set.",
    dust: 120,
    items: [
      { kind: "suit", id: "gemmie" }, { kind: "suit", id: "sammie" },
      { kind: "suit", id: "seraph" }, { kind: "suit", id: "leviathan" },
      // the Samurai helmet left the pack and the shelves (owner, 27 Oct 2026); owners keep it
      { kind: "helm", id: "gemmie" },
      { kind: "helm", id: "seraph" }, { kind: "helm", id: "leviathan" },
      { kind: "trail", id: "opalfeather" }, { kind: "trail", id: "clockwork" }, { kind: "trail", id: "phoenixplume" },
    ],
  },
  // THE CIRCUIT PACK IS GONE (owner, 15 Sep 2026: "Remove Cyber, Robo, Volt
  // bundle, make those available at start"): the three suits are in every
  // save's unlockedSuits from the first flight. PALS LEFT EVERY KIT the same
  // day ("By default all Pals unlocked"): Prismwing, TurClock, Nightglider,
  // and the two companion kits that were nothing but pals.
  {
    id: "bundle-critters",
    kit: { banner: "shop/bundle-critters.png", discountDust: 45 },
    name: "Critter Pack",
    blurb: "Bandit, Noodle and Quill. Three more who eat no acorns.",
    dust: 75,
    items: [
      { kind: "suit", id: "raccoon" }, { kind: "suit", id: "ferret" }, { kind: "suit", id: "hedgehog" },
    ],
  },
  {
    id: "bundle-visor-collection",
    kit: { banner: "shop/bundle-visor-collection.png", discountDust: 10 },
    name: "Visor Collection",
    blurb: "Amethyst, Ivoryguard and Reactor: three distinct visors for the wardrobe.",
    dust: 20,
    items: [{ kind: "helm", id: "amethyst" }, { kind: "helm", id: "ivoryguard" }, { kind: "helm", id: "reactor" }],
  },
];

/** WHAT A SLOT IS WORTH. A suit is where the work goes - the rig, the neck
 *  cut, the tail layer, the flight banks - so it carries three times what
 *  anything else does. Helmets, trails and pals are one apiece. A first
 *  pass, and it lives here so re-weighting the economy is one edit. */
export const ITEM_WEIGHT: Record<BundleItem["kind"], number> = {
  suit: 3, helm: 1, trail: 1, pal: 1,
};

/** the ownership keys a pack grants - a suit and its helmet share one */
export const bundleIds = (b: (typeof BUNDLES)[number]) =>
  [...new Set(b.items.map((i) => i.id))];

export const bundleWeight = (b: (typeof BUNDLES)[number]) =>
  b.items.reduce((n, i) => n + ITEM_WEIGHT[i.kind], 0);

/** The legacy bundle checkout shares the actual Shop quote. `dust` remains
 *  historical catalog data; it no longer asks a different price from the
 *  featured card for the same kit. */
export function bundlePrice(
  b: Bundle,
  owns: (id: string) => boolean,
) {
  return bundleQuote(b, owns).due;
}


/** WHAT A FIXED-HEAD SUIT SAYS. Three views tell the pilot the same fact -
 *  a corner tag on the loadout stage, another on the shop case, and a note
 *  where the helmet shelf would be - and they were each wording it
 *  differently ("WEARS ITS OWN HEAD", "HELMET CANNOT BE CHANGED", "has its
 *  own head"). "Its own head" also describes the ART rather than the RULE:
 *  what the pilot needs to know is that the helmet is fixed, not that the
 *  character was drawn with one. One phrasing, in one place. */
export const OWN_HEAD_TAG = "CUSTOM HELMET \u00b7 CANNOT CHANGE";
export const OWN_HEAD_LINE = "Custom helmet: cannot change";
export function fixedHeadTag(suit: Suit): string {
  if (suit.headPolicy === "helmetless") return "HELMETLESS BY DESIGN";
  if (suit.fixedHelmet) return `${suit.fixedHelmet.toUpperCase()} · ALWAYS ON`;
  return suit.id === "arcflash" ? "INTEGRATED LOOK · CANNOT CHANGE" : OWN_HEAD_TAG;
}
export function fixedHeadLine(suit: Suit): string {
  if (suit.headPolicy === "helmetless") return "Helmetless by design";
  if (suit.fixedHelmet) return `${suit.fixedHelmet}: always on`;
  return suit.id === "arcflash" ? "Integrated look · cannot change" : OWN_HEAD_LINE;
}
export function fixedHeadDescription(suit: Suit): string {
  if (suit.headPolicy === "helmetless") return `${suit.name} always flies without a helmet. Equip another suit to change helmets.`;
  if (suit.fixedHelmet) return `${suit.fixedHelmet} is part of ${suit.name} and always stays on. Equip another suit to change helmets.`;
  return suit.id === "arcflash" ? "Arcflash's blue eyes and bare head are part of its look. Equip another suit to change helmets." : "The helmet is part of the character. Equip another suit to change helmets.";
}


/** THE LEAD-IN: open, straight, empty corridor at the mouth of a wormhole.
 *  A Lost in Space pilot is thrown in mid-flight with no READY screen, at a
 *  distance scaled to their gate - so the walls were already narrow and
 *  already moving before they had found the control. These nodes are held
 *  dead centre at full width and carry nothing, then the corridor eases
 *  into its real shape over the blend rather than snapping to it.
 *  At 56px a node and 220px/s that is about three seconds of room. */
export const TUNNEL_LEAD_NODES = 12;
export const TUNNEL_LEAD_BLEND = 6;




/** WHERE THE SWIPE LESSON OPENS, and how fast the pilot is carried there.
 *  The dive has to have somewhere to go: at 0.34 there is two thirds of a
 *  screen below, which survives a browser chrome bar and a short phone.
 *  The lift is a scripted rate rather than an impulse because an impulse is
 *  cancelled by a planet contact - see the note in updateWorld. */
/** How long a tutorial POPUP holds before a tap can dismiss it.
 *
 *  The companion's message arrives while the pilot is mid-rhythm on the gate
 *  run, and the tap already travelling dismissed it before the words were up.
 *  Half a second is enough that a stray tap lands on nothing and the next one
 *  is deliberate - and it is matched to the "tap to continue" fade, so the
 *  affordance appearing IS the moment it starts working.
 *
 *  This is not the arming window that broke the old tutorial: nothing is
 *  being asked of the pilot here, so a refused tap cannot read as the game
 *  ignoring them. Beats that ask for a TAP or a SWIPE still wait forever.
 */
export const TUT_READ = 0.5;






export const SHOP_SLOTS = 3;
export const SHOP_DAY_MS = 24 * 60 * 60 * 1000;

function keyOf(day: number, id: string) {
  let h = (day * 2654435761) >>> 0;
  for (let i = 0; i < id.length; i++) h = (Math.imul(h ^ id.charCodeAt(i), 16777619)) >>> 0;
  return h;
}

/** THE DAY'S SHELF.
 *
 *  Three packs, chosen by the DATE rather than by anything the pilot can
 *  touch: no reroll, no reshuffle on reopening the shop, the same three all
 *  day and a fresh draw tomorrow. It is deterministic from the day number
 *  alone, so it needs no server and nothing saved - every device agrees.
 *
 *  A pack already owned leaves the pool for good, which is what makes a
 *  purchase feel like it cleared something rather than just spending. The
 *  ordering is computed BEFORE that filter, so buying one pack never
 *  reshuffles the others sitting beside it.
 *
 *  And the point of all of it: adding a pack to BUNDLES is now a shop
 *  update, not a release. It simply joins the pool the next day draws from. */
export function shopBundles(now: number, owns: (id: string) => boolean) {
  const day = Math.floor(now / SHOP_DAY_MS);
  return [...BUNDLES]
    .map((b) => ({ b, k: keyOf(day, b.id) }))
    .sort((x, y) => x.k - y.k || (x.b.id < y.b.id ? -1 : 1))
    .map((x) => x.b)
    .filter((b) => !bundleIds(b).every(owns))
    .slice(0, SHOP_SLOTS);
}

export const IAP_ITEMS = [...new Set([...FIXED_SHOP_SUIT_IDS, ...BUNDLES.flatMap(bundleIds)])];

// ------------------------------------------------------- A LA CARTE
// The storefront sells single items as well as packs, so a single item
// needs a price - and there was never one. ITEM_WEIGHT already says what a
// slot is worth relative to the others, and the packs already imply a rate,
// so the a la carte price is that rate, set ABOVE the dearest pack. That
// ordering is the whole point: if a single cost what a pack charges per
// slot, the small packs would offer nothing and nobody would ever buy one.
// THE ECONOMY, 13 Sep 2026. Owner: "I actually think I want to eliminate
// IAP, just ad revenue for now ... keep the star dust, just lower the pack
// prices a lot so that daily rewards unlock it fast, and add some star packs
// earlier in the star chart ... leave the packs in, they just cost acorns
// ... 1000 acorn = 500 star dust." So: every Star Dust price is a tenth of
// what it was; the Star Dust packs stay on the shelf and are bought with
// ACORNS at ACORNS_PER_DUST; the real-money store is off unless a shell
// sets window.__ACORNAUT_IAP__ before the bundle loads (IAP_LIVE).
export const IAP_LIVE = typeof window !== "undefined"
  && (window as { __ACORNAUT_IAP__?: unknown }).__ACORNAUT_IAP__ === true;
export const ACORNS_PER_DUST = 2;
export const DUST_PER_WEIGHT = 10;

// A suit and its matching helmet SHARE an ownership id - buying "cryostar"
// hands over both - so a price is asked of the id, not of the render. This
// walks the catalogue rather than hard-coding, so a new set is priced the
// moment it is added.
export function idWeight(id: string) {
  let w = 0;
  if (SUITS.some((u) => u.id === id)) w += ITEM_WEIGHT.suit;
  if (HELMETS.some((h) => h.id === id)) w += ITEM_WEIGHT.helm;
  if (PALS.some((p) => p.id === id)) w += ITEM_WEIGHT.pal;
  if (TRAILS.some((t) => t.id === id)) w += ITEM_WEIGHT.trail;
  return w;
}
/** Explicit premium sticker prices replace the catalog's generic weight rate. */
export const DUST_STICKER: Record<string, number> = { arcflash: 185, porcelain: 100, nacre: 100, origamist: 100 };
export function idDust(id: string) {
  if (DUST_STICKER[id] !== undefined) return DUST_STICKER[id];
  return Math.max(10, Math.round((idWeight(id) * DUST_PER_WEIGHT) / 5) * 5);
}

// THE FREE TRAIL. Buying a set hands over its trail as well: the trail is
// the part of a look nobody would pick on its own, and giving it away with
// the suit and helmet is what makes a set feel like a set rather than an
// invoice. Only sets with a trail painted for them appear here.
export const SET_TRAIL: Record<string, string> = {
  cryostar: "celestialtide",
  verdant: "verdantflourish",
  eclipse: "eclipseglyph",
  gemmie: "opalfeather",
  seraph: "phoenixplume",
  cyber: "clockwork",
};

/** every id a purchase of `id` actually hands over */
export function idGrants(id: string) {
  const t = SET_TRAIL[id];
  return t ? [id, t] : [id];
}

/** A bundle needs three distinct products. A matching suit and helmet
 *  share one ownership key, and a set's free wake is a bonus, not another
 *  product that can turn a singleton or duo into a bundle. */
export function bundleProductIds(b: Bundle): string[] {
  const ids = bundleIds(b);
  const bonuses = new Set(ids.map(id => SET_TRAIL[id]).filter(Boolean));
  return ids.filter(id => !bonuses.has(id) && !builtInTrailSuit(id));
}

/** what the ids you do NOT own would cost bought one at a time.
 *
 *  A set trail costs NOTHING here (audit, 8 Sep 2026). SHOP_CYCLE sells no
 *  trail singly and idGrants hands it over free with its suit, so pricing
 *  one at the weight rate quoted a "was" figure nobody could ever be
 *  charged: the featured card struck through 1,440 for Aurora and called it
 *  50% OFF when the same three suits and the pal cost 1,170 on the single
 *  shelf. A trail is only free when the suit that grants it is in this list
 *  AND still unowned - that is the only way a purchase hands it over - so
 *  that is the only case zeroed.
 */
export function alaCarteTotal(ids: string[], owns: (id: string) => boolean) {
  const owed = [...new Set(ids)].filter((i) => !owns(i));
  const free = new Set(owed.map((i) => SET_TRAIL[i]).filter(Boolean));
  return owed.reduce((n, i) => n + (free.has(i) ? 0 : idDust(i)), 0);
}

/** One quote for cards and both checkout paths. The kit discount is an
 *  exact editable amount against the original individual retail value.
 *  Ownership then credits the full retail value already covered, including
 *  shared IDs and free set trails once. Credit never pays currency back:
 *  if it covers the offer, the remaining contents can be claimed for zero.
 *  `savings` and `discountPercent` describe the original kit discount;
 *  `credit` is shown separately and is never called an extra sale. */
export function bundleQuote(b: Bundle, owns: (id: string) => boolean) {
  const ids = bundleIds(b);
  // Signature wakes are inseparable suit effects, derived by the review UI.
  // Listing one as a product would invent a separately chargeable entitlement.
  if (ids.some(id => builtInTrailSuit(id))) {
    throw new Error(`Invalid bundle kit: ${b.id}; built-in wakes must not be listed as products`);
  }
  const retail = alaCarteTotal(ids, () => false);
  const discount = b.kit?.discountDust;
  if (bundleProductIds(b).length < 3 || !b.kit || b.kit.banner !== `shop/${b.id}.png` ||
      !Number.isFinite(discount) || !Number.isInteger(discount) || discount < 0 || discount > retail) {
    throw new Error(`Invalid bundle kit: ${b.id}`);
  }
  const offer = retail - discount;
  const credit = retail - alaCarteTotal(ids, owns);
  return {
    retail, offer, credit, due: Math.max(0, offer - credit), savings: discount,
    discountPercent: retail > 0 ? Math.round(discount / retail * 1000) / 10 : 0,
  };
}

export function featurePrice(
  b: Bundle,
  owns: (id: string) => boolean,
) {
  return bundleQuote(b, owns).due;
}

// Fail immediately when an edited kit has an invalid banner or discount.
// The standard build's catalog tests import this module before shipping.
for (const bundle of BUNDLES) bundleQuote(bundle, () => false);

// HOW MUCH OF THE CATALOGUE IS ON SALE TODAY. Deliberately small: the shelf
// is a reason to come back, not an inventory. Trails are never sold singly
// for now - they arrive free with their set.
// FIVE CARDS, NOT FOUR (owner, 12 Sep 2026: "make sure the shop has one more
// daily card showing, it's a bit of a gap on my screen, another helmet or
// other option"). The fifth slot is gear: a third helmet on a no-pal day,
// otherwise two helmets and the pal. Suits stay at two.
export const SHOP_CYCLE = {
  maxItems: 5, suits: 2, premiumSuits: 1, minHelms: 1, helms: 3, pals: 1, trails: 0,
  excludedIds: ["raccoon", "ferret", "hedgehog"],
  excludedBundleIds: ["bundle-critters"],
};


// STAR DUST is the premium currency. Acorns are earned by flying and buy
// the standard wardrobe; dust is bought (or claimed daily) and buys packs.
// Two currencies, two jobs, and the header shows both so neither can be
// mistaken for the other.
// HALF THE DOLLARS, SAME DUST. Owner, 12 Sep 2026: "cut the stardust cost in
// half globally in the store ... i meant the actual dollar values in half.
// given the early adapter stage, don't need to make it look expensive,
// anyone willing to pay should to do without it feeling expensive, it's a
// barrier right now". Per-item dust prices did not move; each pack simply
// costs half the money it did ($0.99 / $4.99 / $9.99 / $19.99 before).
// These strings are the WEB sticker only - a native shell shows the store's
// own localized price, so the same halving has to be set as the price
// tier on each product in App Store Connect and Play Console.
/** `acorns` is what an acorn pack costs (owner, 13 Sep 2026: "1000 acorn =
 *  500 star dust" - the bonus dust rides free). THE ONE REAL-MONEY PACK
 *  (owner, 15 Sep 2026: "Restore a single IAP for 2500 star dust @$3.99.
 *  User can still buy star dust with acorns") is `cash: true`: a shell's
 *  store sells it at its own localized price, `price` is the sticker the
 *  beta page previews it with, and a page with no store does not show it.
 *  TWO CASH PACKS, NO SMALL ACORN PACK (owner, 23 Sep 2026: "The 200 acorn
 *  pack in shop was supposed to be a $1.99 IAP for 250 stardust (no acorn
 *  options below 1000 acorns)"): dust-250 takes dust-100's slot. */
export const DUST_PACKS: { id: string; dust: number; bonus: number; acorns: number; price: string; cash?: true }[] = [
  { id: "dust-250",  dust: 250,  bonus: 0,   acorns: 0,                      price: "$1.99", cash: true },
  { id: "dust-550",  dust: 500,  bonus: 50,  acorns: 500 * ACORNS_PER_DUST,  price: "$2.49" },
  { id: "dust-1200", dust: 1000, bonus: 200, acorns: 1000 * ACORNS_PER_DUST, price: "$4.99" },
  { id: "dust-2600", dust: 2000, bonus: 600, acorns: 2000 * ACORNS_PER_DUST, price: "$9.99" },
  { id: "dust-2500", dust: 2500, bonus: 0,   acorns: 0,                      price: "$3.99", cash: true },
];
/** the packs a store sells for money, and the ones acorns buy */
export const CASH_PACKS = DUST_PACKS.filter((p) => p.cash);
/** REMOVE ADS (owner, 7 Oct 2026: "one more iap - ad removal 2.99 (except
 *  star dust and continuation ads) just the forced ones"). A non-consumable:
 *  bought once, kept on the save (eraseSave keeps it, Restore Purchases
 *  re-grants it), and it switches off the two FULL-SCREEN placements - the
 *  crash-exit interstitial and the every-10th-level one. The rewarded ads
 *  the pilot chooses (the free continue, the Shop's Star Dust) stay. */
export const REMOVE_ADS = {
  id: "no-ads",
  name: "Remove Ads",
  price: "$2.99",
  blurb: "No more full-screen ads, ever. The free continue and Star Dust ads stay.",
} as const;
export const ACORN_PACKS = DUST_PACKS.filter((p) => !p.cash);

/** STAR CHART BOOSTS (owner, 8 Sep 2026: "a level skip item... instant 3
 *  star any level (make it 100 star dust). And instant unlock any star
 *  reward item 500 star dust... consumed on purchase. only inventory if
 *  further 'seasonal style' rewards given"). A boost is spent the moment
 *  it is bought, on the mission or the reward picked right then. A count
 *  in save.boosts - handed out by a season or a code, never sold - pays
 *  first, and only then does the Profile show an inventory. */
export const BOOSTS = {
  levelskip: { name: "Level Skip", dust: 10, art: "ui/boost-skip.png",
    blurb: "Three stars on any Star Chart mission, right now. Not for Hyper Run." },
  starunlock: { name: "Star Unlock", dust: 50, art: "ui/boost-star.png",
    blurb: "Any Star Chart reward item, yours ahead of its stars." },
} as const;
export type BoostId = keyof typeof BOOSTS;
export const BOOST_IDS = Object.keys(BOOSTS) as BoostId[];

/** claimed once per day; the seventh straight day pays the streak bonus */
/** THE AD RULES (owner, 13 Sep 2026: "just ad revenue for now ... tying in
 *  ads"). Three placements, every number here so the owner can dial them:
 *  a rewarded ad continues a crashed free flight for free (the acorn
 *  continue stays as the other option); a rewarded ad in the Shop pays
 *  Star Dust, a few times a day; a full-screen ad plays at the crash
 *  sheet's exit every few crashes, never before the pilot has once passed
 *  30 gates (owner, 6 Oct 2026: "to not burden early bad players") and
 *  never twice within the gap. The web page has no ads; the beta page
 *  pretends. Retuned 6 Oct 2026: 10 dust up to 5 a day, was 25 up to 3. */
export const AD_RULES = {
  rewardedDust: 10,             // Star Dust for one rewarded ad in the Shop
  rewardedDustPerDay: 5,        // how many of those a day
  interstitialEveryCrashes: 3,  // a full-screen ad after every third crash...
  interstitialMinGapSec: 120,   // ...and never within two minutes of the last
  interstitialAfterGates: 30,   // ...and only once a best run has passed 30 gates
  interstitialEveryLevels: 10,  // and one at the exit of every 10th Star Chart level's result sheet
};
export const DAILY_DUST = 5;
export const DAILY_STREAK_BONUS = 25;
export const DAILY_STREAK_LEN = 7;

// THE HANGAR SHELVES. The suit wall stopped being one grid the day it
// passed twenty cards: a grid ranks nothing, and the one thing a hangar
// must answer at a glance is "what am I working toward". Each shelf is a
// sideways-scrolling row. A section whose suits are not in this build's
// catalog simply does not render, which is how the Unreleased shelf stays
// beta-only without carrying its own flag.
export const SUIT_SHELF: { title: string; ids: string[]; shop?: boolean }[] = [
  // THE OWNER'S BOARD (27 Oct 2026, first draft): five shelves, each sorted by unlock cost on
  // screen (AcorNut still leads his). Premium suits sit with their kind and show as the row's
  // store door until bought (shop: a row that sells premium). Robo was cut from the shelves; owners keep him (favourites).
  { title: "BASE", ids: ["flight", "iontrim", "glasssuit", "redline", "tracer", "copper", "frost", "ember", "origamist"], shop: true },
  { title: "GALACTIC", ids: ["gemmie", "sammie", "cryostar", "verdant", "voidsuit", "porcelain", "eclipse", "robodog", "geode"], shop: true },
  { title: "CUSTOM FLIGHTS", ids: ["vanguard", "alien", "bigbooty", "volt", "cyber", "leviathan", "nacre", "seraph"], shop: true },
  // the critters are premium: unowned ones show as doors to the shop
  { title: "ACORN INTOLERANT", ids: ["catsuit", "briellacat", "raccoon", "ferret", "hedgehog"], shop: true },
  { title: "ABSTRACT", ids: ["cinderforge", "groveguard", "cosmic", "sunforged", "abyssal", "arcflash", "ghost"], shop: true },
];

// The helmet wall groups by what the GLASS does, because that is how a
// pilot actually chooses one. Suit-locked helmets are not listed anywhere:
// they arrive with their suit and equipping them elsewhere does nothing,
// so a card would be a lie.
export const HELMET_SHELF: { title: string; ids: string[] }[] = [
  // Samurai and Cosmic retired from the shelves (owner, 27 Oct 2026); owners keep them
  { title: "CLEAR VISORS", ids: ["clear", "lunar", "gemmie", "phoenix", "seraph", "chronarch"] },
  { title: "COLOR VISORS", ids: ["ion", "solar", "void", "comet", "cherry", "meteor", "chrono", "amethyst", "reactor"] },
  { title: "GRAPHIC VISORS", ids: ["nebula", "royal", "aurora", "princess", "verdant", "cryostar", "eclipse", "cinderforge", "abyssal", "ivoryguard"] },
];

export function isIap(id: string) {
  return IAP_ITEMS.includes(id);
}

export const MOD_SHIELD_COST = 25;
export const MOD_BATTERY_COST = 500;
// The beta page's master switch. Production leaves it off and every
// gate below it is earned; flipping it by hand is never needed again —
// it follows the page, not the build.
export const BETA_UNLOCK_GATES = IS_BETA;

// Flight mods: bought once with acorns and kept, unlike the start shield,
// which is charged for every arming. Owning one does not make it
// compulsory — each stays a switch. `save` names the flag it owns.
//
// Steady Gates and Rough Air are opposites and cancel: turning one on
// turns the other off, because a run cannot have both a still ladder and
// a turbulent one.
export type Mod = {
  id: string;
  save: "steadyGates" | "thrillSeeker" | "noPalFx";
  name: string;
  cost: number;
  tag: string;
  desc: string;
  /** the mod this one switches off when it comes on */
  opposes?: "steadyGates" | "thrillSeeker" | "noPalFx";
  /** on from the start, for everyone, at no cost - a comfort switch rather
   *  than a reward. It is never bought and never gated behind stars. */
  always?: boolean;
};

export const MODS: Mod[] = [  {
    // Rough Air used to sit here and it did the same job as the Wisp pal:
    // both exist to make the gates sway harder. Two switches for one
    // outcome is a menu asking a question it has already answered, so the
    // mod goes and the pal keeps it - the pal is the one you can SEE doing
    // it. In its place, the opposite kind of switch entirely.
    id: "noPalFx",
    save: "noPalFx",
    name: "Pal Effects Off",
    cost: 0,
    always: true,
    tag: "ANY MODE",
    desc: "Fly with any companion for the look alone - none of its effect, good or bad.",
  },

  {
    id: "steadyGates",
    save: "steadyGates",
    name: "Steady Gates",
    cost: 400,
    tag: "NORMAL",
    desc: "Stops the gates drifting up and down in Normal. Black holes still turn the world over.",
  },
  {
    id: "thrillSeeker",
    save: "thrillSeeker",
    name: "Thrill Seeker",
    cost: 1200,
    tag: "EVERY MODE",
    desc: "The whole world runs at double speed. The same flight, half the time to read it. Power-ups still last as long — you just cover twice the ground.",
  },
];
