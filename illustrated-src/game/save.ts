import type { SpillAppearance } from "./spill-appearance";
import { highOrbitTrailSuit, isPremiumFrames, isPremiumSuit } from "./high-orbit-config";
import { importSampleCredit, migrateCampaign, earnedCampaignStars, missionCredit, routeMasks, settleMissionCredit, rewardId, type CampaignProgress } from "./campaign-progress";
import { CHART_LEVELS, CHART_MAX_STARS, levelUnlocked, STAR_REWARDS, substituteFor, type LevelDef, type StarReward } from "./campaign";
import { STAR_UNLOCKS,
  RACE_GATES,
} from "./campaign";
import { restoreSpill, type SpillCheckpoint, type SpillState } from "./spill";
import { SPILL_UTILITY_IDS, spillEngineColor, type SpillEngineColor, type SpillUtility } from "./spill-content";
import { createSpillCareer, restoreSpillCareer, type SpillCareer } from "./spill-career";

// `expeditions` counts wave-20 clears, not endings; retain the saved key.
export type SpillRecords = { bestScore: number; ore: number; contracts: number; waves: number; expeditions: number; runs: number };
export const freshSpillRecords = (): SpillRecords => ({ bestScore: 0, ore: 0, contracts: 0, waves: 0, expeditions: 0, runs: 0 });
import {
  BETA_UNLOCK_GATES,
  HELMETS,
  LEGACY_KEYS,
  PALS,
  SAVE_KEY,
  SUITS,
  isIap,
  TRAILS,
  BUNDLES,
  FIXED_SHOP_SUIT_IDS,
  bundleQuote,
  idDust,
  IS_BETA,
  GUIDE_SUIT,
  GUIDE_HELM,
  TUTORIAL_SUIT,
  SUIT_PITCH_MIN,
  SUIT_PITCH_MAX,
  suitPitchDefault,
  palsClash,
  BOOSTS,
  BOOST_IDS,
  idGrants,
  RETIRED_HELMETS,
  wearsOwnHead,
  type BoostId,
} from "./catalog";
import { platform } from "./platform";
import { TAP_SHAPE, TAP_SHAPE_MIN, TAP_SHAPE_MAX, TAIL_SPRING, TAIL_SPRING_MIN, TAIL_SPRING_MAX, TAIL_SPRING_ONE, TAP_ACCENT_STRENGTH, TAP_ACCENT_MIN, TAP_ACCENT_MAX, type TapShape, type TailSpring } from "./control-constants";

// Pinned to the shipped pre-regrouping catalog (9 Sep 2026). These are
// historical grant amounts, not the price of the new bundle layout.
export const BETA_DUST_GRANT_FLOOR = 12360;
export const BETA_LEGACY_DUST_GRANT_TOTAL = 7510;
export function betaDustGrantTarget(): number {
  const kits = BUNDLES.reduce((total, bundle) => total + bundleQuote(bundle, () => false).offer, 0);
  const singles = FIXED_SHOP_SUIT_IDS.reduce((total, id) => total + idDust(id), 0);
  return Math.max(BETA_DUST_GRANT_FLOOR, kits + singles);
}

export type SaveData = {
  campaignProgress?: CampaignProgress;
  betaSampleCreditImported?: boolean;
  spillAppearance?: SpillAppearance;
  highScore: number;
  deepBest: number;
  lostBest: number;
  arcadeBest: number;
  tunnelBest: number;
  /** THE SPILL: the highest wave cleared. Ore never lands here - it is
   *  spent inside the run and gone with it, so the mode's economy cannot
   *  reach the wallet or the shop */
  spillBest: number;
  spillCareer?: SpillCareer;
  spillRecords?: SpillRecords;
  spillSuspended?: SpillCheckpoint | null;
  spillStarter?: SpillUtility | null;
  spillSignal?: boolean;
  spillEngineColor?: SpillEngineColor;
  spillDepotGuideSeen?: boolean;
  /** FIRST-TIME GUIDES (owner, 26 Sep 2026): the pals sheet the first time the
   *  Loadout's PALS tab opens, and the Star Chart sheet the first time the
   *  chart opens after the guided start. Each shows once; its "?" reopens it. */
  palGuideSeen?: boolean;
  chartGuideSeen?: boolean;
  purchased: string[];
  /** REMOVE ADS bought: no full-screen ads, ever (rewarded ads stay) */
  noAds: boolean;
  /** store transaction ids already turned into dust, so a re-delivered
   *  receipt is never paid twice (owner's store build, 8 Sep 2026) */
  receipts: string[];
  /** STAR CHART BOOSTS held, by id. Zero for everyone unless a season or a
   *  code hands one out; a bought boost is spent on the spot and never
   *  lands here. See BOOSTS in catalog.ts. */
  boosts: Record<BoostId, number>;
  /** star rewards opened with a Star Unlock that are not wardrobe ids: the
   *  mods and modes ("deep", "lost", "startShield", "battery", "flightmods",
   *  "dualpal"). Wardrobe rewards go into the unlocked* lists like any
   *  other unlock. */
  keyUnlocks: string[];
  /** item ids opened with a Star Unlock, wardrobe and keyed alike. When
   *  the road later reaches one of these, the rung pays acorns instead. */
  boostedRewards: string[];
  /** what a rung paid INSTEAD of its item, by reward ledger id: SUB_ACORNS
   *  acorns for an item already owned, bought or Star-Unlocked alike. A
   *  "dust" entry is one written under the earlier rule and stays as paid. */
  rewardSubs: Record<string, { kind: "dust" | "acorns"; amount: number }>;
  acorns: number;
  xp: number;
  startShield: boolean;
  battery: boolean;
  /** STAR DUST: the premium currency. Acorns are flown for and buy the
   *  standard wardrobe; dust is bought or claimed and buys packs. */
  starDust: number;
  /** what the pilot calls themselves. Empty means "never chose one", which
   *  is why it is not defaulted to the fallback: a name the player picked
   *  and a name we picked for them are different facts. */
  pilotName: string;
  /** beta only: the one-time funding grant for testing Shop purchases */
  betaDustGrant: boolean;
  /** the funding total the beta grant was last brought up to */
  betaDustGrantTotal?: number;
  // A save written before the wormhole was settled still carries `tune` and
  // `tunnelControl`. They are simply not read any more - the dials are folded
  // into the shipped constants and the control is fixed at tap to fly - and
  // an unread key costs nothing. SAVE_KEY is untouched, so nobody's progress
  // moves.
  /** shelves laid out as a wrapping GRID rather than side-scrolling rows */
  shelfGrid: boolean;
  /** THE LEAN EDITOR'S WORKING VALUES.
   *
   *  Overrides SUIT_LEAN per suit while a lean is being dialled in. It lives
   *  in the save rather than in memory so a value survives the reload it
   *  takes to fly the change - tuning a feel means going back and forth
   *  between the hangar and a real run, and losing the number on the way
   *  makes that loop useless.
   *
   *  These are WORKING values, not the shipped ones: COPY LEAN in the hangar
   *  exports them as a block to paste into SUIT_LEAN, which is where a
   *  settled number belongs. Optional so every existing save loads clean. */
  suitLean?: Record<string, { up: number; down: number }>;
  /** highest star line already paid out, so a payout can never double-pay */
  dustPaidTo: number;
  /** local date string of the last daily claim, e.g. "2026-08-24" */
  lastDaily: string;
  /** THE AD LEDGER (13 Sep 2026): rewarded dust claimed today, and the
   *  interstitial cadence - crashes since the last full-screen ad and when
   *  it played (ms epoch) */
  adDustDay: string;
  adDustCount: number;
  crashesSinceAd: number;
  lastAdAt: number;
  /** THE FIRST SEVEN-DAY STREAK PAYS THE CRITTER PACK (owner, 8 Sep 2026);
   *  every seventh day after that pays the dust bonus. Set once. */
  streakPackClaimed: boolean;
  /** how many days in a row have been claimed, 1..DAILY_STREAK_LEN */
  dailyStreak: number;
  /** flight mods, bought once and kept. See MODS in catalog.ts. */
  steadyGates: boolean;
  roughAir: boolean;
  /** comfort switch: the equipped pal is cosmetic only */
  noPalFx: boolean;
  /** BETA ONLY: a repeat tap rewinds the picture on the queue-roster suits
   *  (PAINTED_TAP_SUITS) instead of finishing the gesture. Owner's dial for
   *  deciding which suits keep the queue; inert on live builds. */
  tapRewind: boolean;
  thrillSeeker: boolean;
  tutorialDone: boolean;
  unlocked: string[];
  equipped: string;
  unlockedSuits: string[];
  equippedSuit: string;
  unlockedTrails: string[];
  equippedTrail: string;
  unlockedPals: string[];
  equippedPal: string;
  /** THE LOW SLOT (owner, 7 Sep 2026): a second companion, earned at 720
   *  stars. equippedPal flies high; this one flies low. "none" when empty. */
  equippedPal2: string;
  // lifetime tallies — the Profile screen's three tiles. These only ever
  // grow; acorns spent in the hangar come off `acorns`, never off these.
  runs: number;
  lifetimeAcorns: number;
  zonesSeen: string[];
  /** Star Chart progress: level id -> 3-bit goal mask. See campaign.ts. */
  stars: Record<string, number>;
  /** the post-tutorial guided path. See GUIDE_SUIT in catalog.ts.
   *  pending -> reward -> hangar -> helmet -> levels -> done */
  guide: "pending" | "reward" | "hangar" | "helmet" | "levels" | "done";
  /** Briella's code: the game simply believes it has every star on the
   *  road (CHART_MAX_STARS, 780 today - it follows the road, owner 8 Sep 2026) */
  allStars: boolean;
  /** the Profile's music switch — absent (old saves) means music ON */
  musicOff?: boolean;
  /** THE SETTINGS SWITCHES (owner, 2 Sep 2026). Every one is optional and
   *  absent means ON, so an old save changes nothing:
   *  - sfxOff: silences the sound effects, independent of the score
   *  - helpOff: no coach lines, no wave lessons, no pre-flight briefing
   *  - motionOff: menus stop animating (transitions and pulses)
   *  - introOff: the launch film is skipped */
  sfxOff?: boolean;
  helpOff?: boolean;
  /** Spill-only comfort controls. Old saves show buttons and instructions. */
  spillButtonsOff?: boolean;
  spillPromptsOff?: boolean;
  motionOff?: boolean;
  introOff?: boolean;
  /** LOADOUT FAVOURITES: suit, helmet and trail ids the pilot starred.
   *  They surface in a FAVOURITES shelf at the top of each tab, a shelf
   *  that does not exist until the first star. */
  favorites?: string[];
  /** the loadout's animated case, opened out; folded is the default */
  heroExpanded?: boolean;
  /** AcorNut's forward lean in degrees, dialled on the phone until it settles */
  /** the beta flight lab's dials (fog, stickChance, spacing, gapScale, driftScale,
   *  driftRate, bounceScale, upsideDown, tapFreeze, freeRevive); beta only */
  lab?: Record<string, number | boolean>;
  /** per-suit forward lean in whole degrees, set with the beta pitch dial;
   *  absent = the catalog default (SUIT_PITCH_DEFAULTS) */
  suitPitch?: Record<string, number>;
  /** BETA dials, per suit (see TAP_SHAPE / TAIL_SPRING in control-constants):
   *  the tap shape - "default" (the stock ramp), "velocity", or a linear
   *  {fwd, back} in seconds - and the tail spring multipliers. Read only on
   *  the beta page; a live build flies the tables. */
  tapShape?: Record<string, TapShape | "velocity" | "default">;
  tailSpring?: Record<string, TailSpring>;
  /** BETA dial, per suit: what a repeat tap does (see repeatTapMode in sim.ts) */
  tapRepeat?: Record<string, "rewind" | "finish" | "restart">;
  /** retired 12 Sep 2026: the tap accent is live on both pages now, behind
   *  the player's Character Glow switch (glowOff). Left in old saves. */
  tapAccent: boolean;
  /** CHARACTER GLOW, the player's switch on the Profile tab (owner, 12 Sep
   *  2026: "create toggle in profile tab, to disable or enable character
   *  glow effect"). Off hides the tap accent - ignition and body reaction -
   *  on every suit. Default on. */
  glowOff?: boolean;
  /** BETA dial, per suit: the accent strength override, 0..4, over the
   *  TAP_ACCENT_STRENGTH table (owner, 12 Sep 2026: "build a dial, i can
   *  barely notice it"). A live build flies the table. */
  tapAccentStrength?: Record<string, number>;
  /** BETA Test Lab: the Flight Test's last autopilot pattern and transport
   *  speed, so the bench opens the way it was left. Read only on the beta
   *  page; a live build never starts a Flight Test. */
  testLab?: { pattern?: string; speed?: number };
  // Retired dials, left in old saves and ignored: diveDepth / poseMode (the
  // dive is shallow and every frame flies, see POSE_DIVE_DEPTH in draw.ts)
  // and eclipseMotionMode (Eclipse flies heading; every other suit flies
  // the shipped pose-per-velocity curve).
  /** Experimental records are isolated from chapter stars and rewards. */
  raceRecords?: Record<string, { bestFinishTicks: number; bestAcorns: number }>;
  /** debris fields cleared, stored by the level they sit after (33/66/99) */
  raceGates: number[];
};

export function defaultSave(): SaveData {
  return {
    highScore: 0,
    deepBest: 0,
    lostBest: 0,
    arcadeBest: 0,
    tunnelBest: 0,
    spillBest: 0, spillCareer: createSpillCareer(),
    spillRecords: freshSpillRecords(), spillSuspended: null, spillStarter: null, spillSignal: false,
    purchased: [],
    noAds: false,
    receipts: [],
    boosts: { levelskip: 0, starunlock: 0 },
    keyUnlocks: [],
    boostedRewards: [],
    rewardSubs: {},
    acorns: 0,
    xp: 0,
    startShield: false,
    battery: false,
    pilotName: "",
    starDust: 0,
    betaDustGrant: false,
    shelfGrid: false,
    suitLean: {},
    dustPaidTo: 0,
    lastDaily: "",
    adDustDay: "",
    adDustCount: 0,
    crashesSinceAd: 0,
    lastAdAt: 0,
    streakPackClaimed: false,
    dailyStreak: 0,
    steadyGates: false,
    roughAir: false,
    noPalFx: false,
    tapRewind: false,
    tapAccent: false,
    thrillSeeker: false,
    tutorialDone: false,
    unlocked: ["clear"],
    equipped: "clear",
    // CYBER, VOLT AND ROBO ARE FREE (owner, 15 Sep 2026: "Remove Cyber,
    // Robo, Volt bundle, make those available at start")
    unlockedSuits: ["flight", "cyber", "volt", "robo"],
    equippedSuit: "flight",
    unlockedTrails: ["sparks"],
    equippedTrail: "sparks",
    unlockedPals: ["none"],
    equippedPal: "none",
    equippedPal2: "none",
    runs: 0,
    lifetimeAcorns: 0,
    zonesSeen: [],
    stars: {},
    guide: "pending",
    allStars: false,
    musicOff: false,
    raceRecords: {},
    raceGates: [],
  };
}

/** ONE RECEIPT, ONE GRANT. The store may hand the same transaction to the
 *  game more than once: the purchase promise, then the pending list on the
 *  next resume, then Restore Purchases. The ledger says whether this id
 *  has been paid. True means "new, now recorded, pay it"; false means the
 *  dust already went out. The caller writes the save. */
export function takeReceipt(save: SaveData, transactionId: string) {
  if (!Array.isArray(save.receipts)) save.receipts = [];
  // THE LEDGER OUTLIVES THE SAVE (audit, 8 Sep 2026). Receipts also live in
  // their own storage slot, which Start Over never clears. Without it, a
  // pilot who reset their save kept their store identity, so the very next
  // boot's deliverPending() saw the whole consumable history as unpaid and
  // granted every dust pack they had ever bought, again. The two copies are
  // merged on read and written together; the save's own copy stays for
  // older builds that only know about it.
  const paid = receiptVault();
  if (save.receipts.includes(transactionId) || paid.has(transactionId)) return false;
  save.receipts.push(transactionId);
  paid.add(transactionId);
  writeReceiptVault(paid);
  return true;
}

/** the durable half of the receipt ledger: every transaction id this device
 *  has ever been paid for, kept beside the save rather than inside it */
const RECEIPT_KEY = SAVE_KEY + ":receipts";
function receiptVault(): Set<string> {
  try {
    const raw = platform.storage.get(RECEIPT_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(list) ? list.filter((r) => typeof r === "string") : []);
  } catch { return new Set(); }
}
function writeReceiptVault(paid: Set<string>) {
  // newest last, and bounded: a store history is finite but a corrupted
  // slot should not be able to grow without end
  try { platform.storage.set(RECEIPT_KEY, JSON.stringify([...paid].slice(-2000))); }
  catch { /* a device with no writable storage pays the old risk, not a new one */ }
}

/** Bank only new progress. This ledger is part of a suspended expedition,
 *  so loading or docking repeatedly never duplicates mastery or rewards. */
export function bankSpill(save: SaveData, s: SpillState, end = false) {
  if (s.practice || transientSaves.has(save)) return;
  const records = save.spillRecords ?? (save.spillRecords = freshSpillRecords());
  save.spillBest = Math.max(save.spillBest || 0, s.cleared);
  records.bestScore = Math.max(records.bestScore, Math.floor(s.score));
  for (const [field, value] of [["ore", s.oreMined], ["contracts", s.contractsDone], ["waves", s.cleared]] as const) {
    records[field] += Math.max(0, value - s.banked[field]); s.banked[field] = value;
  }
  if (s.expeditionDone && !s.banked.expedition) { records.expeditions++; s.banked.expedition = true; }
  if (end && !s.banked.run) { records.runs++; s.banked.run = true; }
}

function readRaw(key: string): Record<string, unknown> | null {
  try {
    const raw = platform.storage.get(key);
    if (!raw) return null;
    // A SAVE HAS TO BE AN OBJECT (App Store prep audit, section 2). JSON.parse
    // only throws on malformed text: `5`, `"abc"` and `[1,2]` all parse, all
    // come back truthy, and all used to be handed on as a save. Spreading a
    // string into the defaults pastes its characters on as numbered keys, and
    // worse, loadSave takes the FIRST key that reads truthy - so one corrupt
    // byte in the live slot would shadow a perfectly good legacy save behind
    // it. Anything that is not a plain object is not a save; say so, and the
    // next key in the list gets its turn.
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null || Array.isArray(value)) { stashCorrupt(key, raw); return null; }
    return value as Record<string, unknown>;
  } catch {
    try { stashCorrupt(key, platform.storage.get(key)); } catch { /* the stash is best effort */ }
    return null;
  }
}
/** A blob that is not a save is kept, once, under its own key before the
 *  fresh save overwrites the slot - so a hand edit gone wrong is recoverable
 *  from devtools rather than gone (audit, 30 Sep 2026). */
function stashCorrupt(key: string, raw: string | null) {
  if (!raw) return;
  const slot = `${key}:corrupt`;
  try { if (!platform.storage.get(slot)) platform.storage.set(slot, raw); } catch { /* best effort */ }
}

export function loadSave(): SaveData {
  const source = [SAVE_KEY, ...LEGACY_KEYS].map(key => ({ key, value: readRaw(key) })).find(x => x.value);
  const parsed = source?.value ?? null;
  const s: SaveData = { ...defaultSave(), ...(parsed as Partial<SaveData>) };
  // EVERY LIST IS A LIST (audit, 30 Sep 2026): a hand-edited `unlockedSuits: 5`
  // used to throw at the first .includes below, and a thrown loadSave is a
  // blank page with no Start Over to reach
  const bag = s as unknown as Record<string, unknown>;
  for (const k of ["unlocked", "unlockedSuits", "unlockedTrails", "unlockedPals", "purchased", "keyUnlocks", "boostedRewards", "zonesSeen", "favorites"]) {
    const v = bag[k];
    bag[k] = Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  }
  bag.raceGates = Array.isArray(bag.raceGates) ? (bag.raceGates as unknown[]).filter((x) => typeof x === "number") : [];
  // a ledger that is not a ledger is rebuilt from `stars` by migrateCampaign
  const cp = bag.campaignProgress as Partial<CampaignProgress> | null | undefined;
  if (cp && (typeof cp !== "object" || !cp.missions || typeof cp.missions !== "object" || !Array.isArray(cp.paidRewards))) delete bag.campaignProgress;
  else if (cp) {
    if (!Array.isArray(cp.barriers)) cp.barriers = [];
    if (!Array.isArray(cp.zoneVisits)) cp.zoneVisits = [];
    if (typeof cp.legacyEntitlementFloor !== "number" || !isFinite(cp.legacyEntitlementFloor)) cp.legacyEntitlementFloor = 0;
  }
  if (!s.unlocked?.includes("clear")) s.unlocked = ["clear", ...(s.unlocked || [])];
  if (!s.unlockedSuits?.includes("flight")) s.unlockedSuits = ["flight", ...(s.unlockedSuits || [])];
  // the free trio backfills into every existing save (15 Sep 2026)
  for (const id of ["cyber", "volt", "robo"]) if (!s.unlockedSuits.includes(id)) s.unlockedSuits.push(id);
  if (!s.unlockedTrails?.includes("sparks")) s.unlockedTrails = ["sparks", ...(s.unlockedTrails || [])];
  if (!s.unlockedPals?.includes("none")) s.unlockedPals = ["none", ...(s.unlockedPals || [])];
  // Grandfather recorded ownership from the earlier beta companion. The
  // new premium gate must not confiscate a pal already in the hangar.
  if (s.unlockedPals.includes("switchback") && !(s.purchased || []).includes("switchback")) {
    s.purchased = [...(s.purchased || []), "switchback"];
  }
  if (!HELMETS.some((h) => h.id === s.equipped)) s.equipped = "clear";
  // A save can arrive wearing things this build does not grant — the open
  // beta hands premium out, production does not, and the two share a
  // browser. Anything equipped but not owned HERE comes off; it is not
  // deleted from the save, so a real purchase puts it straight back on.
  if (isIap(s.equippedSuit) && !suitRevealed(s, s.equippedSuit)) s.equippedSuit = "flight";
  if (isIap(s.equipped) && !helmetRevealed(s, s.equipped)) s.equipped = "clear";
  // a matched-set helmet stranded on the wrong suit (saved before the rule
  // existed, or edited by hand) comes off rather than half-fitting
  {
    const h = HELMETS.find((x) => x.id === s.equipped);
    // a premium pilot with her own head (Envoy, rendered since 27 Oct 2026) hides the helmet, not removes it
    const ownHeadPremium = isPremiumSuit(s.equippedSuit) && wearsOwnHead(SUITS.find((u) => u.id === s.equippedSuit) ?? {});
    if (!isPremiumFrames(s.equippedSuit) && !ownHeadPremium && h?.suitOnly && h.suitOnly !== s.equippedSuit) s.equipped = "clear";
  }
  if (!SUITS.some((u) => u.id === s.equippedSuit)) s.equippedSuit = "flight";
  if (!TRAILS.some((t) => t.id === s.equippedTrail)) s.equippedTrail = "sparks";
  // A fixed suit wake never replaces the pilot's selectable trail. Old or
  // imported saves that stored this presentation effect use the starter.
  if (s.equippedTrail === "arcflashwake" || highOrbitTrailSuit(s.equippedTrail)) s.equippedTrail = "sparks";
  if (!PALS.some((p) => p.id === s.equippedPal)) s.equippedPal = "none";
  if (s.equippedPal !== "none" && !palUnlocked(s, s.equippedPal)) s.equippedPal = "none";
  // the low slot: a real pal, open, not a twin of the high one, not one
  // that clashes with it, and only while the slot itself is earned
  if (typeof s.equippedPal2 !== "string" || !PALS.some((p) => p.id === s.equippedPal2)) s.equippedPal2 = "none";
  if (s.equippedPal2 !== "none" && (!palUnlocked(s, s.equippedPal2) || !dualPalUnlocked(s)
    || s.equippedPal2 === s.equippedPal || palsClash(s.equippedPal, s.equippedPal2))) s.equippedPal2 = "none";
  // a lone companion always flies high
  if (s.equippedPal === "none" && s.equippedPal2 !== "none") { s.equippedPal = s.equippedPal2; s.equippedPal2 = "none"; }
  // saves written before Star Dust existed. dustPaidTo starts at 0 rather
  // than at the pilot's current stars, so a long-standing save is PAID its
  // backlog on next load instead of silently losing it.
  if (typeof s.starDust !== "number" || !isFinite(s.starDust)) s.starDust = 0;
  // the counters are whole, finite and never negative: a string here
  // concatenated its way to "5006860" acorns on the first payout
  for (const k of ["acorns", "xp", "highScore", "deepBest", "lostBest", "arcadeBest", "tunnelBest", "lifetimeAcorns", "runs", "spillBest", "starDust"] as const) {
    const v = s[k] as unknown;
    s[k] = typeof v === "number" && isFinite(v) ? Math.max(0, Math.floor(v)) : 0;
  }
  if (!Array.isArray(s.receipts)) s.receipts = [];
  s.receipts = s.receipts.filter((r) => typeof r === "string").slice(-500);
  if (typeof s.noAds !== "boolean") s.noAds = false;
  // saves written before the Star Chart boosts existed
  if (!s.boosts || typeof s.boosts !== "object" || Array.isArray(s.boosts)) s.boosts = { levelskip: 0, starunlock: 0 };
  for (const id of BOOST_IDS) {
    const n = (s.boosts as Record<string, unknown>)[id];
    s.boosts[id] = typeof n === "number" && isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  }
  if (!Array.isArray(s.keyUnlocks)) s.keyUnlocks = [];
  s.keyUnlocks = s.keyUnlocks.filter((k) => typeof k === "string");
  if (!Array.isArray(s.boostedRewards)) s.boostedRewards = [];
  s.boostedRewards = s.boostedRewards.filter((k) => typeof k === "string");
  if (!s.rewardSubs || typeof s.rewardSubs !== "object" || Array.isArray(s.rewardSubs)) s.rewardSubs = {};
  // every entry is read by the reward sheet as {kind, amount}; a malformed
  // one would throw inside render and blank the chart, so it is dropped here
  for (const k of Object.keys(s.rewardSubs)) {
    const v = s.rewardSubs[k] as { kind?: unknown; amount?: unknown } | null;
    if (!v || typeof v !== "object" || (v.kind !== "dust" && v.kind !== "acorns")
      || typeof v.amount !== "number" || !isFinite(v.amount)) delete s.rewardSubs[k];
  }
  if (typeof s.dustPaidTo !== "number" || !isFinite(s.dustPaidTo)) s.dustPaidTo = 0;
  if (typeof s.betaDustGrant !== "boolean") s.betaDustGrant = false;
  if (typeof s.shelfGrid !== "boolean") s.shelfGrid = false;
  // the lab: numbers and booleans only, anything else dropped
  if (!s.lab || typeof s.lab !== "object") s.lab = {};
  for (const k of Object.keys(s.lab)) {
    const v = s.lab[k];
    if (!(typeof v === "boolean" || (typeof v === "number" && isFinite(v)))) delete s.lab[k];
  }
  // the pitch table: whole degrees in range, anything else dropped. The
  // one-suit acornutPitch it replaces migrates unless it was the old 25
  // default, which the retested 12 supersedes.
  if (!s.suitPitch || typeof s.suitPitch !== "object") s.suitPitch = {};
  {
    const legacy = (s as unknown as { acornutPitch?: unknown }).acornutPitch;
    if (typeof legacy === "number" && isFinite(legacy) && Math.round(legacy) !== 25 && !("vanguard" in s.suitPitch)) s.suitPitch.vanguard = legacy;
    delete (s as unknown as { acornutPitch?: unknown }).acornutPitch;
    for (const id of Object.keys(s.suitPitch)) {
      const v = s.suitPitch[id];
      if (typeof v !== "number" || !isFinite(v)) delete s.suitPitch[id];
      else s.suitPitch[id] = Math.max(SUIT_PITCH_MIN, Math.min(SUIT_PITCH_MAX, Math.round(v)));
    }
  }
  // the beta dials: anything malformed is dropped, numbers are clamped
  if (!s.tapShape || typeof s.tapShape !== "object") s.tapShape = {};
  for (const id of Object.keys(s.tapShape)) {
    const v = s.tapShape[id] as unknown;
    if (v === "velocity" || v === "default") continue;
    const o = v as { fwd?: unknown; back?: unknown };
    if (o && typeof o === "object" && typeof o.fwd === "number" && isFinite(o.fwd) && typeof o.back === "number" && isFinite(o.back)) {
      const c = (n: number) => Math.max(TAP_SHAPE_MIN, Math.min(TAP_SHAPE_MAX, Math.round(n * 20) / 20));
      s.tapShape[id] = { fwd: c(o.fwd), back: c(o.back) };
    } else delete s.tapShape[id];
  }
  if (!s.tapRepeat || typeof s.tapRepeat !== "object") s.tapRepeat = {};
  for (const id of Object.keys(s.tapRepeat)) if (!["rewind", "finish", "restart"].includes(s.tapRepeat[id] as string)) delete s.tapRepeat[id];
  if (!s.tailSpring || typeof s.tailSpring !== "object") s.tailSpring = {};
  for (const id of Object.keys(s.tailSpring)) {
    const o = s.tailSpring[id] as unknown as { stiff?: unknown; damp?: unknown; kick?: unknown };
    const ok = (n: unknown): n is number => typeof n === "number" && isFinite(n);
    if (o && typeof o === "object" && ok(o.stiff) && ok(o.damp) && ok(o.kick)) {
      const c = (n: number) => Math.max(TAIL_SPRING_MIN, Math.min(TAIL_SPRING_MAX, Math.round(n * 20) / 20));
      s.tailSpring[id] = { stiff: c(o.stiff), damp: c(o.damp), kick: c(o.kick) };
    } else delete s.tailSpring[id];
  }
  if (!Array.isArray(s.unlockedSuits)) s.unlockedSuits = ["flight"];
  // ACORNUT IS EARNED (owner, 6 Sep 2026): 570 stars on the road, or the
  // tutorial's borrowed flight. A beta grant or an old free unlock in the
  // list does not count. Both the strip and the equipped check need the
  // star total, so both now run below, after migrateCampaign: see
  // "ACORNUT'S GATE READS THE LEDGER".
  // an old save has no lean table, and a corrupted one must not be able to
  // tip every suit sideways - anything that is not two finite numbers in
  // range is dropped rather than trusted
  if (!s.suitLean || typeof s.suitLean !== "object") s.suitLean = {};
  else {
    for (const id of Object.keys(s.suitLean)) {
      const v = s.suitLean[id] as { up?: unknown; down?: unknown };
      const okNum = (n: unknown) => typeof n === "number" && isFinite(n) && n >= 0 && n <= 2;
      if (!v || !okNum(v.up) || !okNum(v.down)) delete s.suitLean[id];
    }
  }
  s.pilotName = typeof s.pilotName === "string" ? cleanPilotName(s.pilotName) : "";
  if (typeof s.lastDaily !== "string") s.lastDaily = "";
  if (typeof s.adDustDay !== "string") s.adDustDay = "";
  for (const k of ["adDustCount", "crashesSinceAd", "lastAdAt"] as const) if (typeof s[k] !== "number" || !isFinite(s[k])) s[k] = 0;
  if (typeof s.streakPackClaimed !== "boolean") s.streakPackClaimed = false;
  if (typeof s.dailyStreak !== "number" || !isFinite(s.dailyStreak)) s.dailyStreak = 0;
  // saves written before the flight mods existed
  for (const k of ["steadyGates", "roughAir", "thrillSeeker", "noPalFx", "tapRewind", "tapAccent"] as const) {
    if (typeof s[k] !== "boolean") s[k] = false;
  }
  if (typeof s.glowOff !== "boolean") delete s.glowOff;
  // the accent strength dial became per suit on 12 Sep 2026; a number from
  // the one-day global dial is dropped, a record is kept where sane
  if (s.tapAccentStrength !== undefined) {
    const t = s.tapAccentStrength as unknown;
    if (!t || typeof t !== "object") delete s.tapAccentStrength;
    else {
      const clean: Record<string, number> = {};
      for (const [id, v] of Object.entries(t as Record<string, unknown>)) {
        if (typeof v === "number" && isFinite(v) && v >= 0 && v <= 4) clean[id] = v;
      }
      s.tapAccentStrength = clean;
    }
  }
  // the Test Lab's Flight Test settings: a bad value falls back, never bricks
  if (s.testLab !== undefined) {
    const t = s.testLab as unknown;
    if (!t || typeof t !== "object") delete s.testLab;
    else {
      const o = t as { pattern?: unknown; speed?: unknown };
      const clean: { pattern?: string; speed?: number } = {};
      if (typeof o.pattern === "string" && ["manual", "hover", "2", "4", "6", "8", "pairs", "station"].includes(o.pattern)) clean.pattern = o.pattern;
      if (typeof o.speed === "number" && isFinite(o.speed) && o.speed >= 0.25 && o.speed <= 1) clean.speed = o.speed;
      s.testLab = clean;
    }
  }
  // Steady Gates and Rough Air are opposites; a save carrying both is
  // incoherent, and stilling the gates is the safer of the two to honour.
  // Rough Air is retired; a save that still has it on simply stops using
  // it, and the flag is left in place so an older build reading the same
  // save is not confused by a missing key.
  s.roughAir = false;
  // saves written before the lifetime tallies existed
  if (typeof s.runs !== "number") s.runs = 0;
  if (typeof s.lifetimeAcorns !== "number") s.lifetimeAcorns = s.acorns;
  if (!Array.isArray(s.zonesSeen)) s.zonesSeen = [];
  if (!s.stars || typeof s.stars !== "object" || Array.isArray(s.stars)) s.stars = {};
  // saves written before the guided path existed have already seen the
  // game — never walk a veteran to the hangar
  if (!["pending", "reward", "hangar", "helmet", "levels", "done"].includes(s.guide as string)) s.guide = s.tutorialDone ? "done" : "pending";
  if (typeof s.allStars !== "boolean") s.allStars = false;
  // Retain unknown and retired fields, including experimentalRaceRecords.
  // They do not certify a current mission or grant a new barrier clear.
  // saves written before the Spill was a mode
  if (typeof s.spillBest !== "number" || !isFinite(s.spillBest)) s.spillBest = 0;
  s.spillBest = Math.max(0, Math.floor(s.spillBest));
  s.spillCareer = restoreSpillCareer(s.spillCareer, s.spillBest);
  const records = freshSpillRecords();
  for (const key of Object.keys(records) as (keyof SpillRecords)[]) {
    const n = s.spillRecords?.[key];
    if (typeof n === "number" && Number.isFinite(n) && n >= 0) records[key] = Math.floor(n);
  }
  s.spillRecords = records;
  if (!restoreSpill(s.spillSuspended, 390, 760)) s.spillSuspended = null;
  if (!SPILL_UTILITY_IDS.includes(s.spillStarter)) s.spillStarter = null;
  s.spillSignal = s.spillSignal === true;
  s.spillEngineColor = spillEngineColor(s).id;
  s.spillSignal = s.spillEngineColor !== "stock";
  s.spillDepotGuideSeen = s.spillDepotGuideSeen === true;
  s.palGuideSeen = s.palGuideSeen === true;
  s.chartGuideSeen = s.chartGuideSeen === true;
  // favourites are ids only; anything else in the array is a hand-edit
  // the case used to remember "compact"; it starts folded now and only
  // remembers "expanded". The pin-to-home list is gone with its feature.
  delete (s as unknown as { heroCompact?: unknown }).heroCompact;
  delete (s as unknown as { pinnedRewards?: unknown }).pinnedRewards;
  if (!Array.isArray(s.favorites)) s.favorites = [];
  s.favorites = [...new Set(s.favorites.filter((x) => typeof x === "string"))];
  if (!Array.isArray(s.raceGates)) s.raceGates = [];
  // only ever the three real gate ids, de-duplicated - a hand-edited save
  // cannot invent a fourth and unlock the chart with it
  s.raceGates = [...new Set(s.raceGates.filter((n) => RACE_GATES.some((g) => g.after === n)))];
  if (!s.raceRecords || typeof s.raceRecords !== "object" || Array.isArray(s.raceRecords)) {
    s.raceRecords = {};
  }
  if (parsed && typeof parsed.xp !== "number") {
    const owned =
      Math.max(0, (s.unlocked?.length || 1) - 1) +
      Math.max(0, (s.unlockedSuits?.length || 1) - 1) +
      Math.max(0, (s.unlockedTrails?.length || 1) - 1) +
      Math.max(0, (s.unlockedPals?.length || 1) - 1);
    s.xp = Math.round(4 * (s.highScore + s.deepBest + s.lostBest) + s.acorns + 200 * owned);
  }
  if (BETA_UNLOCK_GATES && s.acorns < 10000) s.acorns = 10000;
  // Regrouping singles and duos must not reduce an existing beta grant or
  // change the historical amount used for a save without its grant total.
  // Future kit/single prices may raise funding; the beta's existing floor
  // stays intact. Granted once: a tester who spends it stays spent.
  if (IS_BETA) {
    const total = betaDustGrantTarget();
    if (!s.betaDustGrant) {
      s.starDust += total;
      s.betaDustGrant = true;
      s.betaDustGrantTotal = total;
    } else {
      // A later funding increase tops up only the difference. A save that
      // never recorded its total received the historical non-fixed packs;
      // the current bundle grouping cannot reconstruct that old amount.
      const had = typeof s.betaDustGrantTotal === "number" && isFinite(s.betaDustGrantTotal)
        ? s.betaDustGrantTotal
        : BETA_LEGACY_DUST_GRANT_TOTAL;
      if (total > had) s.starDust += total - had;
      s.betaDustGrantTotal = Math.max(had, total);
    }
  }
  if (parsed && !parsed.campaignProgress) {
    // Save the exact source before any migrated write. A failed backup leaves
    // the original save untouched; normal load still works in restricted storage.
    try {
      const key = SAVE_KEY + ":before-campaign-v1";
      if (!platform.storage.get(key)) platform.storage.set(key, JSON.stringify(parsed));
    } catch { /* writeSave will still surface a real persistence failure */ }
  }
  migrateCampaign(s, !!parsed, !!source && source.key !== SAVE_KEY);
  // ACORNUT'S GATE READS THE LEDGER (audit, 8 Sep 2026). This used to count
  // bits in the legacy `stars` map, which is only a compatibility bridge:
  // for an ambiguous mission it carries the finish bit alone, so a pilot at
  // 570 real stars could total ~190 there and have AcorNut torn off on
  // every launch. suitRevealed asks the same question the rest of the game
  // asks (purchased, the ledger's star total, the beta). It must run AFTER
  // migrateCampaign: that call caches on first use, and an earlier starsOf()
  // would build the ledger without the cross-page ambiguity flag.
  // COLLECTING ACORNUT STICKS (owner, 8 Sep 2026: "i still have to collect
  // acornut everytime i load in"). This strip used to be unconditional, so
  // the entry the collect tap writes was torn back out on the next load:
  // the shelf saw a revealed, unowned, free suit and printed COLLECT REWARD
  // again, forever. It only ever existed to refuse an entry nobody earned,
  // so it asks that question now - and it cannot ask suitRevealed, which
  // says yes BECAUSE of the entry being judged.
  if (!tutorialSuitEarned(s)) s.unlockedSuits = s.unlockedSuits.filter((id) => id !== TUTORIAL_SUIT);
  if (s.equippedSuit === TUTORIAL_SUIT && !tutorialSuitEarned(s)) s.equippedSuit = "flight";  // priced, so revealed is not owned
  if (IS_BETA && !s.betaSampleCreditImported) {
    try {
      const raw = platform.storage.get("acornaut_star_map_sample_v1");
      const archived = raw ? JSON.parse(raw) : null;
      if (archived && typeof archived === "object" && (archived.stars || archived.campaignProgress?.version === 1)) {
        if (parsed && !platform.storage.get(SAVE_KEY + ":before-beta-260"))
          platform.storage.set(SAVE_KEY + ":before-beta-260", JSON.stringify(parsed));
        importSampleCredit(s, { ...defaultSave(), ...archived });
      }
      s.betaSampleCreditImported = true;
    } catch { /* Preserve both source slots if storage is unavailable. */ }
  }
  return s;
}

/** The one place a pilot name is made safe. Control characters and line
 *  breaks are stripped because the name is rendered into a single-line
 *  element, runs of whitespace are collapsed so a name cannot be padded to
 *  look longer than it is, and the result is capped. Kept here rather than
 *  at the input so a save hand-edited in devtools gets the same treatment
 *  as a name typed into the box. */
export const PILOT_NAME_MAX = 18;
export function cleanPilotName(raw: string) {
  // by character, not UTF-16 unit: a run of emoji used to end on a lone
  // surrogate that rendered as a broken glyph (audit, 30 Sep 2026)
  return Array.from(
    (raw || "")
      // eslint-disable-next-line no-control-regex
      // to a SPACE, not to nothing: a pasted name carrying a line break
      // should read as two words, not silently become one
      .replace(/[\u0000-\u001f\u007f-\u009f]/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  ).slice(0, PILOT_NAME_MAX).join("");
}

/** THE TUTORIAL'S KIT. The guided path points at the Ion suit and helmet
 *  and the coach calls them "your new ION SUIT" - but nothing ever granted
 *  them, so a fresh pilot was sent to the hangar to admire a 140-acorn suit
 *  they had 0 acorns for. Finishing the tutorial hands them over, which is
 *  what the copy has always claimed. Idempotent: it only ever adds. */
export function grantTutorialKit(s: SaveData) {
  if (!s.unlockedSuits.includes(GUIDE_SUIT)) s.unlockedSuits.push(GUIDE_SUIT);
  if (!s.unlocked.includes(GUIDE_HELM)) s.unlocked.push(GUIDE_HELM);
  // THE TUTORIAL SUIT GOES BACK (owner, 6 Sep 2026: "immediately after the
  // tutorial is done, he is locked"). The first flight is flown in AcorNut;
  // graduation locks him behind his 500 stars and seats the pilot in
  // Flight, so the shelf shows a worn suit while the coach walks them to
  // the Ion kit.
  // ...unless the 570 stars are already in, in which case he is the
  // pilot's outright and graduation has nothing to take back.
  if (!tutorialSuitEarned(s)) s.unlockedSuits = s.unlockedSuits.filter(id => id !== TUTORIAL_SUIT);
  if (s.equippedSuit === TUTORIAL_SUIT && !tutorialSuitEarned(s)) s.equippedSuit = "flight";  // priced, so revealed is not owned
}

// Trial authority may run ordinary simulation paths, including legacy score
// settlement. A memory-only clone protects storage even if a path writes.
const transientSaves = new WeakSet<SaveData>();
export function cloneSaveForTrial(save: SaveData): SaveData {
  const clone: SaveData = JSON.parse(JSON.stringify(save));
  transientSaves.add(clone); return clone;
}
export function writeSave(s: SaveData) {
  // through the bridge: localStorage on the web, the shell's durable
  // store in an app - the ONE place the save is written
  if (sealed || transientSaves.has(s)) return;
  platform.storage.set(SAVE_KEY, JSON.stringify(s));
}

// The one deliberate way to start over. Writes a FRESH save into this
// build's own slot — never a bare delete, because the beta slot would
// quietly re-seed itself from the production save on the next load.
export function eraseSave() {
  // WHAT MONEY BOUGHT STAYS (audit, 30 Sep 2026). The reset erases the
  // pilot - stars, acorns, records, settings - and keeps the shop items,
  // the Star Dust and the boosts, because the receipt vault stops the
  // store from ever re-granting a consumed pack: a reset that took them
  // took real money with no way back.
  const old = loadSave();
  const fresh = defaultSave();
  fresh.purchased = [...new Set(old.purchased || [])];
  fresh.noAds = old.noAds === true;
  fresh.starDust = Math.max(0, old.starDust || 0);
  fresh.boosts = { ...fresh.boosts, ...(old.boosts || {}) };
  writeSave(fresh);
}
/** after Start Over the page reloads; nothing that resolves in between
 *  (a store answer, a late settle) may write the old save back */
let sealed = false;
export function sealSave() { sealed = true; }

export function starsOf(s: SaveData) {
  const p = migrateCampaign(s);
  return Math.min(CHART_MAX_STARS, Math.max(earnedCampaignStars(s, CHART_LEVELS), p.legacyEntitlementFloor, s.allStars ? CHART_MAX_STARS : 0));
}

// Progression is EARNED BY STARS now — the Star Chart is the one ladder.
// The old XP thresholds are retired for good with the production split:
// a gate is stars, a stored unlock, or the beta. Nothing else opens one.
// EVERY PAL IS EVERYONE'S (owner, 15 Sep 2026: "By default all Pals
// unlocked ... gating all the fun features behind purchase or heavy
// gameplay was the wrong move to attract new players"). No rung, no price,
// no kit: the companion shelf is open from the first flight. The signature
// stays so every caller keeps asking the question in one place.
export function palUnlocked(_s: SaveData, _id: string) {
  return true;
}

// Helmets with a rung on the ladder reveal at their star count; the four
// starter tints have no rung and are open from the first flight. A helmet
// already bought stays owned whatever the ladder says.
export function helmetRevealed(s: SaveData, id: string) {
  const retired = RETIRED_HELMETS[id];
  if (retired) return s.unlocked.includes(id) || starsOf(s) >= retired.stars || (!!retired.bundle && (s.purchased || []).includes(retired.bundle));
  if (STAR_UNLOCKS.helmets[id] !== undefined && starsOf(s) >= STAR_UNLOCKS.helmets[id]) return true;
  if (isIap(id)) return iapOwned(s, id);
  if (STAR_UNLOCKS.helmets[id] === undefined) return true;
  return BETA_UNLOCK_GATES || starsOf(s) >= STAR_UNLOCKS.helmets[id] || s.unlocked.includes(id);
}

// Trails unlock on the ROADMAP only: a rung on the ladder, or the beta.
// Sparks has no rung and is everyone's from the first flight; premium
// trails keep the purchase contract.
export function trailUnlocked(s: SaveData, id: string) {
  // THE WAKE HAS ITS OWN RUNG at 520, fifty stars ahead of AcorNut, and
  // this line used to answer before the ladder below was ever read: an
  // audit found the crossed rung still printing "525 of 520 stars" with a
  // HOLD TO USE STAR UNLOCK button, so a pilot could burn a 500-dust boost
  // on a trail the chart had already given them. The rung counts here too;
  // it cannot leak the wake onto another suit, which canWearTrail still
  // refuses.
  if (id === "vanguardwake") return suitRevealed(s, "vanguard") || s.unlockedTrails.includes(id)
    || starsOf(s) >= (STAR_UNLOCKS.trails[id] ?? Infinity);
  if (id === "arcflashwake") return suitRevealed(s, "arcflash");
  const orbitSuit=highOrbitTrailSuit(id);
  if (orbitSuit) return suitRevealed(s, orbitSuit);
  if (STAR_UNLOCKS.trails[id] !== undefined && starsOf(s) >= STAR_UNLOCKS.trails[id]) return true;
  if (isIap(id)) return iapOwned(s, id);
  if (STAR_UNLOCKS.trails[id] === undefined) return true;
  return BETA_UNLOCK_GATES || starsOf(s) >= STAR_UNLOCKS.trails[id] || s.unlockedTrails.includes(id);
}

/** IS ACORNUT EARNED, judged WITHOUT the unlockedSuits entry. suitRevealed
 *  answers "does the pilot have him", and one of the ways it says yes is
 *  that his id is sitting in unlockedSuits - so it can never be asked
 *  whether that entry deserves to be there. This asks the question the
 *  entry cannot answer about itself: bought (1,000 acorns in the Loadout
 *  since 13 Sep 2026; the receipt lands in `purchased`), or the beta,
 *  which opens every gate. He has no rung on the road any more; the star
 *  clause below is kept for a ladder that puts one back. */
export function tutorialSuitEarned(s: SaveData) {
  if ((s.purchased || []).includes(TUTORIAL_SUIT)) return true;
  if (BETA_UNLOCK_GATES) return true;
  const gate = STAR_UNLOCKS.suits[TUTORIAL_SUIT];
  return gate !== undefined && starsOf(s) >= gate;
}

export function suitRevealed(s: SaveData, id: string) {
  // anyone who BOUGHT a suit keeps it, even one that has since moved off
  // the premium list - the cat did exactly that when it became the
  // 300-star prize
  if ((s.purchased || []).includes(id) || s.unlockedSuits.includes(id)) return true;
  if (STAR_UNLOCKS.suits[id] !== undefined && starsOf(s) >= STAR_UNLOCKS.suits[id]) return true;
  if (isIap(id)) return iapOwned(s, id);
  // a suit with a star gate is LOCKED below it - the no-gate fallback is
  // only for suits with no gate at all, or the cat would have been free
  if (STAR_UNLOCKS.suits[id] !== undefined) return BETA_UNLOCK_GATES;
  // no gate at all: on the shelf for everyone
  return true;
}

// Premium items are owned only once bought - on BOTH pages. The beta used
// to hand them over outright, which meant the one thing the beta could
// never test was the shop itself: every pack read as already owned, so the
// buy path, the price check and the dust ledger were all dead code to a
// tester. The beta is granted enough Star Dust to buy every pack instead
// (see betaDustGrant below), so the mechanic gets exercised and the items
// still end up in the hangar.
export function iapOwned(s: SaveData, id: string) {
  return (s.purchased || []).includes(id);
}

// Flight mods change how the game FEELS, so they are held back until a
// player has flown enough of the chart to have an opinion about it.
// A mod or a mode opened with a Star Unlock is opened: the reward's id
// sits in keyUnlocks and every gate below reads it beside the stars.
const keyed = (s: SaveData, id: string) => (s.keyUnlocks || []).includes(id);

export function modsUnlocked(s: SaveData) {
  return BETA_UNLOCK_GATES || starsOf(s) >= STAR_UNLOCKS.flightMods || keyed(s, "flightmods");
}

export function deepUnlocked(s: SaveData) {
  return BETA_UNLOCK_GATES || starsOf(s) >= STAR_UNLOCKS.deep || keyed(s, "deep");
}

export function lostUnlocked(s: SaveData) {
  return BETA_UNLOCK_GATES || starsOf(s) >= STAR_UNLOCKS.lost || keyed(s, "lost");
}

export function startShieldUnlocked(s: SaveData) {
  return BETA_UNLOCK_GATES || starsOf(s) >= STAR_UNLOCKS.startShield || keyed(s, "startShield");
}

export function batteryUnlocked(s: SaveData) {
  return BETA_UNLOCK_GATES || starsOf(s) >= STAR_UNLOCKS.battery || keyed(s, "battery");
}

/** the second companion slot (owner, 7 Sep 2026): a Star Chart reward */
export function dualPalUnlocked(s: SaveData) {
  return BETA_UNLOCK_GATES || starsOf(s) >= STAR_UNLOCKS.dualPal || keyed(s, "dualpal");
}

// ------------------------------------------------------ star chart boosts
// The rules live here, on the save, so the harness can prove them without
// a DOM: the engine wraps each one with a write and a notify.

/** a boost held in the account, waiting to be spent on the Star Chart */
export function boostReady(s: SaveData, id: BoostId) {
  return (s.boosts?.[id] ?? 0) > 0;
}

/** BUYING PUTS IT IN THE ACCOUNT (owner, 8 Sep 2026: "if they pay but
 *  lose connection or close app, it may be lost on the prompt, so it must
 *  stay in their account"). The Shop charges Star Dust and the count goes
 *  up; the Star Chart is where it is spent, one hold-to-confirm at a time. */
export function buyBoost(s: SaveData, id: BoostId): "poor" | "ok" {
  if (s.starDust < BOOSTS[id].dust) return "poor";
  s.starDust -= BOOSTS[id].dust;
  s.boosts[id] = (s.boosts[id] ?? 0) + 1;
  return "ok";
}

function spendBoost(s: SaveData, id: BoostId): "none" | "ok" {
  if (!boostReady(s, id)) return "none";
  s.boosts[id] -= 1;
  return "ok";
}

/** why a Level Skip cannot land on this mission, or "ok" */
export function skipEligible(s: SaveData, def: LevelDef): "hyper" | "done" | "locked" | "ok" {
  if (def.standalone || def.base === "race") return "hyper";
  if (missionCredit(s, def) >= 3) return "done";
  if (!levelUnlocked(def, routeMasks(s), starsOf(s), s.raceGates || [])) return "locked";
  return "ok";
}

/** every mission a Level Skip could land on right now, in road order */
export function skippableLevels(s: SaveData) {
  return CHART_LEVELS.filter((def) => skipEligible(s, def) === "ok");
}

/** LEVEL SKIP: three stars on a reachable, unfinished mission. The credit
 *  goes through the same ledger a flown finish uses, so the road, the
 *  star total and every reward line read it the same way. */
export function skipLevel(s: SaveData, def: LevelDef): "hyper" | "done" | "locked" | "none" | "ok" {
  const why = skipEligible(s, def);
  if (why !== "ok") return why;
  const paid = spendBoost(s, "levelskip");
  if (paid !== "ok") return paid;
  settleMissionCredit(s, def, 7);
  return "ok";
}

/** is this Star Chart reward already the pilot's, by stars or otherwise? */
export function rewardOwned(s: SaveData, r: StarReward) {
  if (r.kind === "acorns" || r.kind === "dust") return starsOf(s) >= r.stars;
  if (!r.id) return starsOf(s) >= r.stars;
  switch (r.kind) {
    case "suit": return suitRevealed(s, r.id);
    case "helmet": return helmetRevealed(s, r.id);
    case "trail": return trailUnlocked(s, r.id);
    case "pal": return palUnlocked(s, r.id);
    case "mode": return r.id === "deep" ? deepUnlocked(s) : r.id === "lost" ? lostUnlocked(s) : starsOf(s) >= r.stars;
    case "mod": return r.id === "startShield" ? startShieldUnlocked(s)
      : r.id === "battery" ? batteryUnlocked(s)
      : r.id === "flightmods" ? modsUnlocked(s)
      : r.id === "dualpal" ? dualPalUnlocked(s)
      : starsOf(s) >= r.stars;
    default: return starsOf(s) >= r.stars;
  }
}

/** the rewards a Star Unlock can open: items, not currency, not owned */
export function unlockableRewards(s: SaveData) {
  return STAR_REWARDS.filter((r) => r.kind !== "acorns" && r.kind !== "dust" && r.kind !== "stage"
    && r.kind !== "title" && !!r.id && !rewardOwned(s, r));
}

/** STAR UNLOCK: one reward item ahead of its stars. Wardrobe rewards land
 *  in the same unlocked* list a star crossing would fill; mods and modes
 *  are keyed by the reward's id. */
export function unlockReward(s: SaveData, r: StarReward): "currency" | "owned" | "none" | "ok" {
  // only the kinds an unlock can actually hand over; anything else (a
  // currency line, a stage, a title) would spend the boost and open nothing
  const openable = r.kind === "suit" || r.kind === "helmet" || r.kind === "trail"
    || r.kind === "pal" || r.kind === "mod" || r.kind === "mode";
  if (!openable || !r.id) return "currency";
  if (rewardOwned(s, r)) return "owned";
  const paid = spendBoost(s, "starunlock");
  if (paid !== "ok") return paid;
  const add = (list: string[]) => { if (!list.includes(r.id!)) list.push(r.id!); };
  // a premium id is owned through `purchased` - the one list every gate
  // and the shop read for it - so a Star Unlock lands it there, with the
  // set trail the shop would hand over beside it (idGrants)
  if (r.kind === "mod" || r.kind === "mode") add(s.keyUnlocks);
  else if (isIap(r.id)) { s.purchased = [...new Set([...(s.purchased || []), ...idGrants(r.id)])]; }
  else if (r.kind === "suit") add(s.unlockedSuits);
  else if (r.kind === "helmet") add(s.unlocked);
  else if (r.kind === "trail") add(s.unlockedTrails);
  else if (r.kind === "pal") add(s.unlockedPals);
  // by RUNG (kind:id:stars), not by bare id: five suit/helmet pairs share
  // one id across two rungs, and a bare id paid a phantom substitute on the
  // half the boost never touched (audit, 30 Sep 2026)
  if (!s.boostedRewards.includes(rewardId(r))) s.boostedRewards.push(rewardId(r));
  return "ok";
}

/** DOES THE PILOT HAVE THIS PREMIUM ID, by any route: bought, opened with
 *  a Star Unlock, or earned on the road. The shop reads this rather than
 *  the purchase list alone, so an item the road handed over leaves the
 *  shelf and comes off a pack's price (owner, 8 Sep 2026: "once they earn
 *  it on the road, it's removed from the shop"). */
export function ownsPremium(s: SaveData, id: string) {
  if ((s.purchased || []).includes(id)) return true;
  if (SUITS.some((u) => u.id === id)) return suitRevealed(s, id);
  if (HELMETS.some((h) => h.id === id)) return helmetRevealed(s, id);
  if (PALS.some((p) => p.id === id)) return palUnlocked(s, id);
  if (TRAILS.some((t) => t.id === id)) return trailUnlocked(s, id);
  return false;
}

/** PAY EVERY RUNG THE PILOT HAS CROSSED AND NOT BEEN PAID FOR. Currency
 *  rungs pay their amount. An item rung whose item another route already
 *  handed over pays currency in its place: Star Dust for a shop purchase,
 *  acorns for a Star Unlock. Every crossed rung is written to the ledger
 *  once, so nothing pays twice. The caller writes the save. Returns the
 *  total paid. */
export function settleStarRewards(s: SaveData) {
  const have = starsOf(s);
  // a total that is not a number pays nothing (it used to pay every rung)
  if (!Number.isFinite(have)) return 0;
  const ledger = migrateCampaign(s);
  let dust = 0, acorns = 0, high = s.dustPaidTo;
  for (const r of STAR_REWARDS) {
    if (r.stars > have) continue;
    const key = rewardId(r);
    if (ledger.paidRewards.includes(key)) continue;
    if (r.kind === "dust" || r.kind === "acorns") {
      if (!r.amount) continue;
      if (r.kind === "dust") { dust += r.amount; high = Math.max(high, r.stars); }
      else acorns += r.amount;
      ledger.paidRewards.push(key);
      continue;
    }
    if (!r.id) continue;
    // already yours, by Star Unlock or by purchase: the rung pays the one
    // flat substitute either way
    // older saves hold bare ids: honour one only where the id names a single rung
    const boosted = (s.boostedRewards || []).includes(key)
      || ((s.boostedRewards || []).includes(r.id) && STAR_REWARDS.filter((x) => x.id === r.id).length === 1);
    if (boosted || (s.purchased || []).includes(r.id)) {
      const sub = substituteFor(r.stars);
      if (sub.kind === "dust") dust += sub.amount; else acorns += sub.amount;
      s.rewardSubs = { ...(s.rewardSubs || {}), [key]: sub };
    }
    ledger.paidRewards.push(key);
  }
  if (dust <= 0 && acorns <= 0) return 0;
  s.starDust += dust;
  s.acorns += acorns;
  s.dustPaidTo = high;
  return dust + acorns;
}

/** the companions the hangar has equipped, high slot first, without the
 *  empty "none" - the one list every screen that shows a pal reads */
export function equippedPals(s: SaveData): string[] {
  return [s.equippedPal, s.equippedPal2].filter((p) => p && p !== "none");
}

/** The beta A/B preference cannot opt production into an experiment. */

/** the forward lean a suit flies at: the dialled number, else the catalog default */
export function suitPitchFor(save: SaveData | null | undefined, id: string): number {
  const v = save?.suitPitch?.[id];
  return typeof v === "number" && isFinite(v) ? v : suitPitchDefault(id);
}

/** how a tap moves this suit's ascent bank: the beta dial if set, else the
 *  table; null is the stock ramp. A live build never reads the dial. */
export function tapShapeFor(save: SaveData | null | undefined, id: string): TapShape | "velocity" | null {
  const dialled = IS_BETA ? save?.tapShape?.[id] : undefined;
  if (dialled === "default") return null;
  if (dialled !== undefined) return dialled;
  return TAP_SHAPE[id] ?? null;
}

/** this suit's tap accent strength: the beta dial if set, else the
 *  TAP_ACCENT_STRENGTH table, else 1. 0 means no accent on this suit. A
 *  live build flies the table. */
export function tapAccentStrengthFor(save: SaveData | null | undefined, suitId: string): number {
  const dialled = IS_BETA ? save?.tapAccentStrength?.[suitId] : undefined;
  const v = typeof dialled === "number" && isFinite(dialled) ? dialled : TAP_ACCENT_STRENGTH[suitId] ?? 1;
  return Math.max(TAP_ACCENT_MIN, Math.min(TAP_ACCENT_MAX, v));
}

/** this suit's tail spring multipliers: the beta dial if set, else the
 *  table, else 1/1/1. A live build never reads the dial. */
export function tailSpringFor(save: SaveData | null | undefined, id: string): TailSpring {
  const dialled = IS_BETA ? save?.tailSpring?.[id] : undefined;
  return dialled ?? TAIL_SPRING[id] ?? TAIL_SPRING_ONE;
}
