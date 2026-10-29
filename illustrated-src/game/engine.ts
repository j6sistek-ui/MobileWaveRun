import { canWearTrail, builtInTrailSuit, STAR_MAP_PREVIEW, ENV_GATES, palsClash, type BoostId, AD_RULES, REMOVE_ADS } from "./catalog";
import { platform } from "./platform";
import { beginFlightTest, type FlightTestPattern } from "./sim";
import { TAP_SHAPE_MIN, TAP_SHAPE_MAX, TAIL_SPRING_MIN, TAIL_SPRING_MAX, TAP_ACCENT_STRENGTH, TAP_ACCENT_MIN, TAP_ACCENT_MAX, type TapShape, type TailSpring } from "./control-constants";
import { isPremiumFrames, isPremiumSuit } from "./high-orbit-config";
import { spillAppearance, type SpillAppearance } from "./spill-appearance";
import { routeMasks, rewardId } from "./campaign-progress";
import { reachedGate } from "./campaign";
import { emptyArt, loadArt, loadPalBank, loadSuitBank, loadSpillScene, loadZoneArt, prefetchArtBanks, type ArtBank } from "./art";
import { vanguardDepotEligible } from "./spill-depot-gag";
import { sfx, unlockAudio, music, setSfxMuted } from "./audio";
import { wearsOwnHead, GUIDE_HELM, GUIDE_SUIT, TUTORIAL_SUIT, HELMETS, IAP_ITEMS, HYPER_RUN_ENABLED, IS_BETA, isIap, MOD_BATTERY_COST, MOD_SHIELD_COST, MODS, SUITS, TRAILS, TUT_ARM, BUNDLES, bundleIds, bundlePrice, idDust, idGrants, featurePrice, DUST_PACKS, DAILY_DUST, DAILY_STREAK_BONUS, DAILY_STREAK_LEN} from "./catalog";
import { drawHud, drawWorld, setSpillBackplateHost } from "./draw";
import { setVanguardPitchTrim } from "./vanguard";
import {
  batteryUnlocked,
  deepUnlocked,
  helmetRevealed,
  trailUnlocked,
  eraseSave,
  lostUnlocked,
  modsUnlocked,
  loadSave,
  grantTutorialKit,
  palUnlocked,
  startShieldUnlocked,
  starsOf,
  suitRevealed,
  writeSave,
  type SaveData,
  cleanPilotName,
  dualPalUnlocked,
} from "./save";
import { hyperRunById, levelById, levelUnlocked, STAR_REWARDS} from "./campaign";
import {
  dive,
  envIndexFor,
  flap,
  initStars,
  makeWorld,
  pausePlay,
  planRaceCueEffects,
  resizeWorld,
  resetRun,
  resumePlay,
  reviveCost,
  reviveRun,
  canRevive,
  setRaceInput,
  snapshot,
  takeRaceCueEffects,
  takeSpillCues,
  spillBurstUp,
  updateWorld,
  type FlightMode,
  type Screen,
  type Snapshot,
  type World,
} from "./sim";
import {
  canonicalRaceY,
  cancelRaceGesture,
  createRaceGestureState,
  dropRaceGesture,
  moveRaceDragGesture,
  moveRaceGesture,
  neutralizeOwnedRaceGesture,
  pressRaceDragGesture,
  pressRaceGesture,
  pressRaceKeyboardDragGesture,
  releaseRaceGesture,
  type RaceGestureOwner,
  type RaceGestureResult,
} from "./race-gesture";
import { raceViewport } from "./race-viewport";
import { spillBuy, spillLeaveDepot, spillLunge, spillUtility, spillSpecialize, spillTakeContract,
  spillCheckpoint, restoreSpill, type SpillBuyable, type SpillCue } from "./spill";
import { spillSetFiring, spillSelectWeapon, spillUpgradeWeapon, type SpillWeaponId } from "./spill-combat";
import { SPILL_UTILITIES, SPILL_ENGINE_COLORS, spillEngineColor, type SpillEngineColor, type SpillUtility, type SpillSpecialty, type SpillContractKind } from "./spill-content";
import { bankSpill, suitPitchFor, takeReceipt, buyBoost, skipLevel, unlockReward, ownsPremium, settleStarRewards, sealSave } from "./save";

export type ShopTab = "helmets" | "suits" | "trails" | "pals" | "ship";

/** where a real-money dust purchase stands: the store sheet is up, or how it ended */
export type DustPurchaseState = "pending" | "ok" | "cancelled" | "failed" | "unavailable";

export type Engine = {
  canvas: HTMLCanvasElement;
  world: World;
  save: SaveData;
  art: ArtBank | null;
  shopTab: ShopTab;
  start: () => void;
  stop: () => void;
  resize: () => void;
  fly: (mode: FlightMode) => void;
  /** wipe this build's save slot and reboot into a fresh game */
  startOver: () => void;
  /** the Founder's Pack door — and one more code that is a love letter */
  /** rename the pilot. Returns the name that was actually stored, which
   *  may differ from what was passed - it is sanitised on the way in. */
  setPilotName: (name: string) => string;
  /** Ask for a suit's flight bank NOW rather than waiting for the
   *  background sweep to reach it. Equipping already does this; the
   *  previews need it too, because they show a suit the pilot has not
   *  equipped and would otherwise animate only once the sweep arrives. */
  wantSuitArt: (id: string) => void;
  /** the same, for a pal's idle bank */
  wantPalArt: (id: string) => void;
  /** Nudge one Wormhole Run calibration dial. Applies to the LIVE run as
   *  well as the save, so the pilot feels the change on resume rather than
   *  on the next flight - which is the entire point of a pause-menu dial. */
  /** leave the first flight early, keeping the suit and helmet it grants */
  skipTutorial: () => void;
  /** lay the grouped shelves out as a wrapping grid instead of scrolling rows */
  setShelfGrid: (on: boolean) => void;
  /** the first flight is FLOWN, not skipped: leave the portal and walk
   *  straight into the guided Loadout that collects the reward */
  finishTutorial: () => void;
  /** pay out any Star Dust lines the pilot has crossed; returns the amount */
  settleDust: () => number;
  dailyState: () => { claimedToday: boolean; streak: number; bonusDay: boolean; pack: boolean; amount: number };
  claimDaily: () => "ok" | "claimed";
  dailyUnseen: () => boolean;
  /** Hand over a claim that has just been paid, ONCE. The shop claims on
   *  arrival, inside open(), where the UI cannot see it happen - so the
   *  payment is parked here and the next render collects it. Reading it
   *  clears it, which is what stops the popup reappearing on every
   *  re-render of the same visit. */
  takeDailyClaim: () => { amount: number; streak: number; bonus: boolean; pack: boolean } | null;
  /** "pending": the store took over and will grant on success; "ok": granted
   *  outright (beta only, or REMOVE_ADS already owned); "unavailable": no
   *  store on this platform. Takes a DUST_PACKS id or REMOVE_ADS.id. */
  buyDust: (id: string) => "ok" | "missing" | "pending" | "unavailable" | "poor";
  /** the pack id whose store purchase is in flight, or null */
  dustPending: () => string | null;
  /** the finished purchase the shop has not shown yet, ONCE; reading clears it */
  takeDustOutcome: () => { id: string; state: DustPurchaseState } | null;
  /** Apple requires the button; on the web it is a no-op */
  restorePurchases: () => Promise<void>;
  buyBundle: (id: string) => "ok" | "missing" | "owned" | "poor";
  /** buy ONE shop id with Star Dust. A set id hands over its suit, its
   *  matching helmet and its trail together - see idGrants. */
  buyShopItem: (id: string) => "ok" | "missing" | "owned" | "poor";
  /** buy the featured pack at the featured (half) price */
  buyFeature: (id: string) => "ok" | "missing" | "owned" | "poor";
  /** buy a Star Chart boost with Star Dust; it lands in save.boosts and is
   *  spent on the chart. See BOOSTS in catalog.ts. */
  buyBoost: (id: BoostId) => "ok" | "poor";
  /** spend a held Level Skip: three stars on a reachable mission */
  useLevelSkip: (levelId: string) => "ok" | "missing" | "hyper" | "done" | "locked" | "none";
  /** spend a held Star Unlock on one reward item, named by its ledger id
   *  (rewardId) */
  useStarUnlock: (rewardKey: string) => "ok" | "missing" | "currency" | "owned" | "none";
  /** start a Star Chart level; returns false if it is still locked */
  flyLevel: (id: string) => boolean;
  /** restart the mission being flown or paused - same level, fresh run */
  restartLevel: () => boolean;
  /** the crash sheet's acorn continue: pay the ad-slot's stand-in price
   *  and fly on. False when it isn't a free flight or the wallet is short. */
  continueRun: () => boolean;
  /** what that continue costs right now (10, or 50 past gate 100) */
  continueCost: () => number;
  /** ADS (13 Sep 2026). adOffer: what the crash sheet may offer right now -
   *  "ad" when a rewarded ad can continue this run for free, "busy" while
   *  one is playing, null otherwise. continueWithAd shows it and, on
   *  "earned", revives without touching the wallet. */
  adOffer: () => "ad" | "busy" | null;
  continueWithAd: () => Promise<"earned" | "dismissed" | "unavailable">;
  /** the Shop's rewarded dust: how many are left today and what one pays */
  adDustState: () => { left: number; pays: number; busy: boolean };
  watchAdForDust: () => Promise<"earned" | "dismissed" | "unavailable" | "spent">;
  /** leave the crash sheet through a full-screen ad when one is due, then
   *  run `next` (fly again, back to the menu); runs `next` at once otherwise */
  afterCrash: (next: () => void) => void;
  /** leaving a Star Chart result sheet: a full-screen ad after every 10th
   *  level the pilot finishes (owner, 6 Oct 2026), then `next` */
  afterLevel: (next: () => void) => void;
  /** Spill buttons and gestures share the same movement rules. */
  spillLunge: () => void;
  spillThrust: () => void;
  spillDive: () => void;
  spillFire: (held: boolean, owner?: string) => void;
  spillSelectWeapon: (id: SpillWeaponId) => boolean;
  spillUpgradeWeapon: () => boolean;
  setSpillButtonsOff: (off: boolean) => void;
  setSpillPromptsOff: (off: boolean) => void;
  spillBuy: (what: SpillBuyable) => string;
  spillLeaveDepot: () => void;
  spillUtility: (id: SpillUtility, replace?: SpillUtility) => string;
  spillSpecialize: (id: SpillSpecialty) => boolean;
  spillContract: (id: SpillContractKind) => boolean;
  spillSuspend: () => boolean;
  spillResume: () => boolean;
  spillStarter: (id: SpillUtility | null) => void;
  setSpillEngineColor: (id: SpillEngineColor) => boolean;
  setSpillAppearance: (kind: keyof SpillAppearance, id: string) => boolean;
  open: (s: Screen) => void;
  buyHelmet: (id: string) => string;
  buySuit: (id: string) => string;
  buyTrail: (id: string) => string;
  equipPal: (id: string) => string;
  toggleMod: (which: "shield" | "battery") => string;
  /** buy a flight mod if unowned, otherwise switch it on or off */
  setMod: (id: string) => string;
  /** the Profile's music switch: silences both score tracks, persisted */
  setMusicOff: (off: boolean) => void;
  /** the four settings switches, each persisted; see SaveData */
  setSfxOff: (off: boolean) => void;
  setHelpOff: (off: boolean) => void;
  /** a first-time guide was read: it does not open on its own again */
  guideSeen: (which: "pals" | "chart") => void;
  setMotionOff: (off: boolean) => void;
  setIntroOff: (off: boolean) => void;
  /** star or unstar a suit, helmet or trail for the FAVOURITES shelf */
  toggleFavorite: (id: string) => boolean;
  isFavorite: (id: string) => boolean;
  /** shrink or restore the loadout's animated case */
  /** the loadout case: folded by default, expanded on request */
  setHeroExpanded: (on: boolean) => void;
  /** AcorNut's pitch trim, in degrees; the dial until the number settles */
  /** the beta pitch dial: a suit's whole-animation forward lean, in degrees */
  setSuitPitch: (suitId: string, deg: number) => void;
  /** the beta flight lab: merge dials into the save and the live free flight */
  setLab: (patch: Record<string, number | boolean | undefined>) => void;
  resetLab: () => void;
  /** the beta repeat-tap dial: rewind instead of queue on the queue-roster suits */
  setTapRewind: (on: boolean) => void;
  /** the beta tap accent + body reaction switch */
  /** the Character Glow switch (Profile tab, both pages): on = the tap
   *  accent draws; the Test Lab's TAP ACCENT dial is the same switch */
  setGlowOff: (off: boolean) => void;
  setTapAccent: (on: boolean) => void;
  /** the beta accent strength dial, per suit, 0..4 over the table; null
   *  clears the override back to the table */
  setTapAccentStrength: (suitId: string, k: number | null) => void;
  /** the beta repeat-tap dial, per suit: rewind / finish / restart; null clears it */
  setTapRepeat: (suitId: string, mode: "rewind" | "finish" | "restart" | null) => void;
  /** the beta tap-shape dial, per suit; null clears the dial back to the table */
  setTapShape: (suitId: string, shape: TapShape | "velocity" | "default" | null) => void;
  /** the beta tail-spring dial, per suit; null clears it back to the table */
  setTailSpring: (suitId: string, spring: TailSpring | null) => void;
  /** THE TEST LAB's Flight Test (beta + dev doors only): a free flight that
   *  flies itself. startFlightTest launches it on the saved pattern. */
  startFlightTest: () => void;
  /** change the autopilot pattern and/or the transport speed (1, .5, .25;
   *  0 holds the world without leaving the run). Saved, except a hold. */
  setFlightTest: (patch: { pattern?: FlightTestPattern; speed?: number }) => void;
  /** advance a held Flight Test by exactly one 1/60 tick */
  flightTestStep: () => void;
  /** clear every beta dial and lab setting back to stock, in one go */
  resetTestLab: () => void;
  dismissDead: () => void;
  replayTutorial: () => void;
  pause: () => void;
  resume: () => void;
  setShopTab: (t: ShopTab) => void;
  /** settles once the art bank has loaded (or failed to) */
  artReady?: Promise<void>;
  subscribe: (fn: () => void) => () => void;
  /** Presentation-only readouts on the existing animation clock. */
  subscribeFrame: (fn: () => void) => () => void;
  snap: () => Snapshot;
};

export async function createEngine(canvas: HTMLCanvasElement): Promise<Engine> {
  // THE SPILL'S BACKPLATE (owner, 5 Sep 2026: "choppy laggy sometimes").
  // draw.ts bakes the Spill's gradient-and-panorama plate once per sector;
  // here it is mounted as an element BEHIND the game canvas, so the
  // backdrop costs the frame nothing - the compositor stacks the two. The
  // sway rides on a transform. Hidden the moment the run is not the Spill;
  // every other mode paints its own opaque sky over the canvas anyway.
  let backplate: HTMLCanvasElement | null = null;
  let backplateShown = false;
  let backplateW = 0, backplateH = 0, backplateTf = "";
  setSpillBackplateHost((plate, off, w, h) => {
    const parent = canvas.parentElement;
    if (!parent) return false;
    if (backplate !== plate) {
      if (backplate) backplate.remove();
      plate.className = "ac-backplate";
      parent.insertBefore(plate, canvas);
      backplate = plate;
      backplateW = backplateH = 0; backplateTf = "";
    }
    const st = plate.style;
    if (backplateW !== w || backplateH !== h) { st.width = `${w}px`; st.height = `${h}px`; backplateW = w; backplateH = h; }
    const tf = `translate3d(${(Math.round(off * 10) / 10).toFixed(1)}px,0,0)`;
    if (tf !== backplateTf) { st.transform = tf; backplateTf = tf; }
    if (!backplateShown) { st.display = ""; backplateShown = true; }
    return true;
  });
  const hideBackplate = () => {
    if (backplateShown && backplate) { backplate.style.display = "none"; backplateShown = false; }
  };
  const raw = canvas.getContext("2d");
  if (!raw) throw new Error("no 2d");
  const ctx = raw;
  const save = loadSave();
  // This extraction starts at the Spill's own briefing. It has no normal-flight
  // tutorial or cosmetic shop; retain the original stock Flight/Clear pilot.
  save.tutorialDone = true;
  save.guide = "done";
  save.equippedSuit = "flight";
  save.equipped = "clear";
  save.equippedTrail = "sparks";
  save.equippedPal = save.equippedPal2 = "none";
  // the saved music preference applies before the first frame ever asks
  // for a track, so a switched-off score never blips on at boot
  music.setMuted(!!save.musicOff);
  // THE SHELL'S MUTE (13 Sep 2026, CrazyGames): an ad on top of the game,
  // or the portal's own mute switch, silences everything; lifting it
  // restores exactly the pilot's own two settings. Neither setting is
  // written by it.
  let shellMuted = false;
  const applyMute = () => {
    music.setMuted(shellMuted || !!save.musicOff);
    setSfxMuted(shellMuted || !!save.sfxOff);
  };
  const muteAll = (m: boolean) => { shellMuted = m; applyMute(); };
  const world = makeWorld(360, 640);
  world.screen = "title";
  world.flight = "spill";
  let art: ArtBank | null = null;
  let spillReady = false;
  let raf = 0;
  let last = performance.now();
  let running = false;
  let raceAccumulator = 0;
  let raceGesture = createRaceGestureState();
  let raceResizeKeyboardReleasePending: "keyboard-rise" | "keyboard-drop" | null = null;
  const listeners = new Set<() => void>();
  const frameListeners = new Set<() => void>();
  const fireOwners = new Set<string>();
  const notify = () => listeners.forEach((fn) => fn());

  // The Spill used to live on a lab page and post its mission result back
  // through localStorage for the boot to bank. It flies inside the engine
  // now, so a stale record from that era is simply dropped.
  platform.storage.remove("acornaut_spill_result");
  let shopTab: ShopTab = "helmets";

  const engine: Engine = {
    canvas,
    world,
    save,
    art: null,
    shopTab,
    start() {
      if (running) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(loop);
    },
    stop() {
      clearSpillFire();
      cancelRaceControls();
      swipe = null;
      running = false;
      cancelAnimationFrame(raf);
    },
    resize,
    fly(mode) {
      // Gate the authority as well as the UI: shared support for other modes
      // remains for painter parity, but cannot be launched here.
      if (mode !== "spill" || !spillReady || !engine.art) return;
      unlockAudio();
      resetRun(world, save, mode, false);
      void loadZoneArt(engine.art, world.envB).then(notify);
      resize();
      if (mode === "spill") { raceAccumulator = 0; last = performance.now(); save.spillSuspended = null; writeSave(save); void loadSpillScene(engine.art, save.equippedSuit).then(notify); }
      resetInputTracking();
      platform.gameplayStart();
      notify();
    },
    startOver() {
      eraseSave();
      sealSave();
      window.location.reload();
    },
    setSpillAppearance(kind, id) {
      if (!STAR_MAP_PREVIEW || !["finish", "trail"].includes(kind)) return false;
      if (id !== "stock" && id !== (kind === "finish" ? "rust-runner" : "rust-wake")) return false;
      save.spillAppearance = { ...spillAppearance(save), [kind]: id };
      writeSave(save); notify(); return true;
    },
    flyLevel(_id) {
      // Star Chart and Hyper Run are outside this standalone mode.
      return false;
    },
    open(s) {
      if (!["title", "play", "pause", "dead", "hangar", "help", "profile"].includes(s)) return;
      if ((s === "play" || s === "pause") && !world.spill) return;
      if (s !== "play") {
        clearSpillFire();
        cancelRaceControls();
        swipe = null;
        // every route out of a run passes here: the portal's clock stops
        if (world.screen === "play") platform.gameplayStop();
        // Stars are written by the sim, which the engine does not observe.
        // Every route back out of a run passes through here, so this is the
        // one choke point where "you crossed a dust line" can be noticed.
        // settleDust is idempotent, so calling it on every screen change is
        // free when nothing is owed.
        settleDust();
        // THE DAILY IS PAID FOR SHOWING UP, AND SHOWING UP IS OPENING THE
        // GAME (owner, 2 Sep 2026: "just count log in, not store tap").
        // It used to land on arrival at the shop, which quietly made the
        // reward conditional on wanting to spend - a pilot who only ever
        // flew never collected a day of it. The claim moved to boot; the
        // shop keeps the receipt and the streak tracker it always drew.
        // THE GUIDE OPENS THE TAB IT IS TALKING ABOUT. The hub said "put on
        // your new Ion suit" and the Loadout opened on HELMETS, with only a
        // faint pulse on the SUITS pill to say so - so the instruction and
        // the screen disagreed the moment you arrived. Reported exactly
        // that way. Whichever step is live picks the shelf.
        if (s === "hangar") {
          if (save.guide === "hangar") { shopTab = "suits"; engine.shopTab = "suits"; }
          else if (save.guide === "helmet") { shopTab = "helmets"; engine.shopTab = "helmets"; }
        }
      }
      world.screen = s;
      if (s === "title") world.tut = null;
      // the graduation gift is collected on the crash sheet; leaving that
      // sheet any other way still moves the guide on
      if (save.guide === "reward" && s !== "dead" && s !== "pause") { save.guide = "hangar"; writeSave(save); }
      if (s === "title" || s === "log" || s === "hangar" || s === "shop" || s === "profile" || s === "help" || s === "scores") {
        // an aborted Debris Field run still banks its waves and records
        if (world.spill && (world.screen === "play" || world.screen === "pause")) { bankSpill(save, world.spill, true); writeSave(save); }
        world.race = null;
        world.spill = null;
        raceAccumulator = 0;
      }
      notify();
    },
    buyHelmet: (id) => transactHelmet(id),
    buySuit: (id) => transactSuit(id),
    buyTrail: (id) => transactTrail(id),
    equipPal: (id) => transactPal(id),
    toggleMod,
    setMod,
    setPilotName(name) {
      const clean = cleanPilotName(name);
      save.pilotName = clean;
      writeSave(save);
      notify();
      return clean;
    },
    wantSuitArt(id) {
      // only against the REAL bank - a load into the placeholder is thrown
      // away with it, yet would still be marked done
      if (art && art.ready) void loadSuitBank(art, id);
    },
    wantPalArt(id) {
      if (art && art.ready) void loadPalBank(art, id);
    },
    /** LEAVE THE FIRST FLIGHT, keeping everything it would have given you.
     *  A tutorial with no exit is a trap for anyone who already knows how to
     *  play, or who hits a lesson that is not landing - and it hands the
     *  pilot straight to the Loadout, which is where the tutorial was
     *  walking them anyway. */
    skipTutorial() {
      save.tutorialDone = true;
      grantTutorialKit(save);
      // AND JOIN THE GUIDED PATH. Skipping used to leave guide on "pending",
      // which is the state that means "the first flight has not finished
      // yet" - so the walk to the Loadout never started, the shelf never
      // knew which tab to open, and a pilot who skipped was simply dropped
      // somewhere with no next step. The kit has just been handed over;
      // "hangar" is the step that says go and put it on.
      if (save.guide === "pending" || save.guide === "reward") save.guide = "hangar";
      writeSave(save);
      world.tut = null;
      this.open("hangar");
    },
    finishTutorial() {
      // The same handoff as skipTutorial, and deliberately so - what the
      // pilot did differs, where they land does not. The kit was granted at
      // the handover; "hangar" is the step that says go and put it on.
      save.tutorialDone = true;
      grantTutorialKit(save);
      if (save.guide === "pending" || save.guide === "reward") save.guide = "hangar";
      writeSave(save);
      world.tut = null;
      shopTab = "suits";
      engine.shopTab = "suits";
      this.open("hangar");
    },
    setShelfGrid(on) {
      save.shelfGrid = !!on;
      writeSave(save);
      notify();
    },
    settleDust,
    dailyState,
    claimDaily,
    takeDailyClaim() {
      const p = pendingDaily;
      pendingDaily = null;
      return p;
    },
    /** Is there a daily the pilot has been paid but not yet shown? Boot
     *  banks the dust, so "unclaimed" no longer means anything to a badge;
     *  what is still worth pointing at is the receipt nobody has seen. */
    dailyUnseen: () => pendingDaily !== null,
    buyDust,
    dustPending,
    takeDustOutcome,
    restorePurchases,
    buyBundle,
    buyShopItem,
    buyFeature,
    buyBoost(id) {
      const r = buyBoost(save, id);
      if (r !== "ok") return r;
      writeSave(save);
      notify();
      return "ok";
    },
    useLevelSkip(levelId) {
      const def = levelById(levelId);
      if (!def) return "missing";
      const r = skipLevel(save, def);
      if (r !== "ok") return r;
      writeSave(save);
      // three new stars may cross a currency line; pay it now, not on the
      // next finish
      settleDust();
      notify();
      return "ok";
    },
    useStarUnlock(rewardKey) {
      const r = STAR_REWARDS.find((x) => rewardId(x) === rewardKey);
      if (!r) return "missing";
      const out = unlockReward(save, r);
      if (out !== "ok") return out;
      writeSave(save);
      notify();
      return "ok";
    },
    setMusicOff(off) {
      save.musicOff = off;
      writeSave(save);
      applyMute();
      notify();
    },
    setSfxOff(off) {
      save.sfxOff = off;
      writeSave(save);
      applyMute();
      notify();
    },
    setHelpOff(off) {
      save.helpOff = off;
      writeSave(save);
      notify();
    },
    guideSeen(which) {
      if (which === "pals") save.palGuideSeen = true; else save.chartGuideSeen = true;
      writeSave(save);
      notify();
    },
    setSpillButtonsOff(off) {
      if (off) clearSpillFire();
      save.spillButtonsOff = off;
      writeSave(save); notify();
    },
    setSpillPromptsOff(off) {
      save.spillPromptsOff = off;
      writeSave(save); notify();
    },
    setMotionOff(off) {
      save.motionOff = off;
      writeSave(save);
      // the class is what the stylesheet reads; the save is what survives
      document.body.classList.toggle("ac-nomotion", off);
      notify();
    },
    setIntroOff(off) {
      save.introOff = off;
      writeSave(save);
      notify();
    },
    toggleFavorite(id) {
      const list = save.favorites ?? [];
      const on = !list.includes(id);
      save.favorites = on ? [...list, id] : list.filter((x) => x !== id);
      writeSave(save);
      notify();
      return on;
    },
    isFavorite: (id) => (save.favorites ?? []).includes(id),
    setLab(patch) {
      save.lab = { ...(save.lab ?? {}), ...patch };
      for (const k of Object.keys(save.lab)) if (save.lab[k] === undefined) delete save.lab[k];
      if (IS_BETA && world.flight === "fly" && !world.lvl && !world.tut) world.lab = { ...save.lab };
      writeSave(save);
      notify();
    },
    resetLab() {
      save.lab = {};
      if (!world.lvl) world.lab = {};
      writeSave(save);
      notify();
    },
    setTapRewind(on) {
      save.tapRewind = on;
      world.tapAnimQueued = false;   // a queued replay from the other rule is not owed
      writeSave(save);
      notify();
    },
    setGlowOff(off) {
      save.glowOff = !!off;
      writeSave(save);
      notify();
    },
    setTapAccent(on) {
      // the Test Lab's dial and the Profile switch are one setting
      save.glowOff = !on;
      writeSave(save);
      notify();
    },
    setTapAccentStrength(suitId, k) {
      if (!save.tapAccentStrength) save.tapAccentStrength = {};
      if (k === null) delete save.tapAccentStrength[suitId];
      else {
        const v = Math.max(TAP_ACCENT_MIN, Math.min(TAP_ACCENT_MAX, Math.round(k * 4) / 4));
        // the table's own value is not an override
        if (v === (TAP_ACCENT_STRENGTH[suitId] ?? 1)) delete save.tapAccentStrength[suitId];
        else save.tapAccentStrength[suitId] = v;
      }
      writeSave(save);
      notify();
    },
    setTapRepeat(suitId, mode) {
      if (!save.tapRepeat) save.tapRepeat = {};
      if (mode === null) delete save.tapRepeat[suitId]; else save.tapRepeat[suitId] = mode;
      world.tapAnimQueued = false;   // a queued replay from the other rule is not owed
      writeSave(save);
      notify();
    },
    setTapShape(suitId, shape) {
      if (!save.tapShape) save.tapShape = {};
      if (shape === null) delete save.tapShape[suitId];
      else if (shape === "velocity" || shape === "default") save.tapShape[suitId] = shape;
      else {
        const c = (n: number) => Math.max(TAP_SHAPE_MIN, Math.min(TAP_SHAPE_MAX, Math.round(n * 20) / 20));
        save.tapShape[suitId] = { fwd: c(shape.fwd), back: c(shape.back) };
      }
      writeSave(save);
      notify();
    },
    setTailSpring(suitId, spring) {
      if (!save.tailSpring) save.tailSpring = {};
      if (spring === null) delete save.tailSpring[suitId];
      else {
        const c = (n: number) => Math.max(TAIL_SPRING_MIN, Math.min(TAIL_SPRING_MAX, Math.round(n * 20) / 20));
        save.tailSpring[suitId] = { stiff: c(spring.stiff), damp: c(spring.damp), kick: c(spring.kick) };
      }
      writeSave(save);
      notify();
    },
    startFlightTest() {
      // The normal-flight lab is not a playable mode in this extraction.
    },
    setFlightTest(patch) {
      if (!save.testLab) save.testLab = {};
      if (patch.pattern) {
        save.testLab.pattern = patch.pattern;
        if (world.flightTest) { world.flightTest.pattern = patch.pattern; world.flightTest.next = 0; world.flightTest.pair = false; }
      }
      if (patch.speed !== undefined) {
        const s = Math.max(0, Math.min(1, patch.speed));
        // a hold (0) is a moment, not a setting: the saved speed is what
        // the transport returns to
        if (s > 0) save.testLab.speed = s;
        if (world.flightTest) world.timeScale = s;
      }
      writeSave(save);
      notify();
    },
    flightTestStep() {
      // one authority tick, drained once - a Flight Test is never a race
      // or the Spill, so there are no cue plans to double-dispatch
      if (!world.flightTest || world.screen !== "play" || world.race || world.spill) return;
      const ev = updateWorld(world, save, 1 / 60);
      dispatchWorldEvent(ev);
      notify();
    },
    resetTestLab() {
      delete save.tapShape;
      delete save.tapRepeat;
      delete save.tailSpring;
      delete save.suitPitch;
      delete save.testLab;
      delete save.tapAccentStrength;
      // glowOff is the player's own switch, not a dial: reset-all leaves it
      save.tapRewind = false;
      save.lab = {};
      if (!world.lvl) world.lab = world.flightTest ? { freeRevive: true } : {};
      world.tapAnimQueued = false;
      if (world.flightTest) world.timeScale = 1;
      writeSave(save);
      notify();
    },
    setSuitPitch(suitId, deg) {
      if (!save.suitPitch) save.suitPitch = {};
      save.suitPitch[suitId] = Math.max(-20, Math.min(45, Math.round(deg)));
      if (suitId === "vanguard") setVanguardPitchTrim(save.suitPitch[suitId]);
      writeSave(save);
      notify();
    },
    setHeroExpanded(on) {
      save.heroExpanded = !!on;
      writeSave(save);
      notify();
    },
    restartLevel() {
      const id = world.lvl?.def.id;
      if (!id) return false;
      // leave the paused run without settling it as a loss twice: flyLevel
      // resets the world outright, and the pause screen is simply replaced
      return engine.flyLevel(id);
    },
    continueCost() {
      return reviveCost(world);
    },
    continueRun() {
      const ok = reviveRun(world, save);
      if (ok) { platform.gameplayStart(); notify(); }
      return ok;
    },
    adOffer() {
      if (!canRevive(world) || !platform.adsReady) return null;
      if (adBusy) return "busy";
      return platform.rewardedAdReady() ? "ad" : null;
    },
    async continueWithAd() {
      if (!canRevive(world) || adBusy || !platform.rewardedAdReady()) return "unavailable";
      adBusy = true; notify();
      // the game goes silent for exactly as long as the ad is on screen
      const out = await platform.showRewardedAd("continue", () => muteAll(true));
      muteAll(false);
      adBusy = false;
      // the run may have been left while the ad played (a back button, a
      // resize pause): only a crash still on screen is revived
      if (out === "earned" && canRevive(world)) { reviveRun(world, save, true); platform.gameplayStart(); }
      notify();
      return out;
    },
    adDustState() {
      const t = today();
      const used = save.adDustDay === t ? save.adDustCount : 0;
      return { left: Math.max(0, AD_RULES.rewardedDustPerDay - used), pays: AD_RULES.rewardedDust, busy: adBusy };
    },
    async watchAdForDust() {
      if (engine.adDustState().left <= 0) return "spent";
      if (adBusy || !platform.rewardedAdReady()) return "unavailable";
      adBusy = true; notify();
      const out = await platform.showRewardedAd("dust", () => muteAll(true));
      muteAll(false);
      adBusy = false;
      if (out === "earned") {
        const t = today();
        if (save.adDustDay !== t) { save.adDustDay = t; save.adDustCount = 0; }
        save.adDustCount += 1;
        save.starDust += AD_RULES.rewardedDust;
        writeSave(save);
      }
      notify();
      return out;
    },
    afterCrash(next) {
      // THE INTERSTITIAL, at the crash sheet's exit and nowhere else: never
      // over the receipt, never before the pilot has chosen to leave.
      // THE 30-GATE GATE (owner, 6 Oct 2026): no full-screen ad until the
      // pilot has once passed 30 gates in any Free Flight rule-set - a best
      // that is already on the save, so an early, struggling pilot is never
      // interrupted and nothing new has to be migrated
      const bestGates = Math.max(save.highScore ?? 0, save.deepBest ?? 0, save.lostBest ?? 0, save.arcadeBest ?? 0);
      const due = platform.adsReady && !save.noAds && platform.interstitialAdReady()
        && bestGates >= AD_RULES.interstitialAfterGates
        && save.crashesSinceAd >= AD_RULES.interstitialEveryCrashes
        && Date.now() - save.lastAdAt >= AD_RULES.interstitialMinGapSec * 1000;
      if (!due || adBusy) { next(); return; }
      playInterstitial("crash", next);
    },
    afterLevel(next) {
      // EVERY 10TH STAR CHART LEVEL (owner, 6 Oct 2026: "and after every
      // 10th star chart level"): the finale of each chapter, finished, plays
      // one full-screen ad at its result sheet's exit. Keyed on the level's
      // number ("3-10"), so a replay of a finale plays it again; the
      // two-minute gap still holds, and the crash cadence is untouched.
      const last = world.lastLevel;
      const n = last?.finished ? Number(last.def.id.split("-")[1]) : 0;
      const due = platform.adsReady && !save.noAds && platform.interstitialAdReady()
        && n > 0 && n % AD_RULES.interstitialEveryLevels === 0
        && Date.now() - save.lastAdAt >= AD_RULES.interstitialMinGapSec * 1000;
      if (!due || adBusy) { next(); return; }
      playInterstitial("level", next);
    },
    spillThrust() {
      if (!world.spill || world.screen !== "play" || save.spillButtonsOff) return;
      if (flap(world, save) === "flap") sfx.flap();
      notify();
    },
    spillDive() {
      if (!world.spill || world.screen !== "play") return;
      if (dive(world, save) === "dive") sfx.dive();
      notify();
    },
    spillFire(held, owner = "manual") {
      if (held) {
        if (!running || !spillReady || world.screen !== "play" || !world.spill
            || !["wave", "drain"].includes(world.spill.phase)) return;
        fireOwners.add(owner);
        unlockAudio();
      } else fireOwners.delete(owner);
      if (world.spill) spillSetFiring(world.spill, fireOwners.size > 0);
    },
    spillSelectWeapon(id) {
      if (world.screen !== "play" || !world.spill) return false;
      const ok = spillSelectWeapon(world.spill, id);
      if (ok) { checkpointSpill(); sfx.ui(); notify(); }
      return ok;
    },
    spillUpgradeWeapon() {
      if (world.screen !== "play" || !world.spill) return false;
      const ok = spillUpgradeWeapon(world.spill);
      if (ok) { checkpointSpill(); sfx.ui(); } else sfx.warning();
      notify(); return ok;
    },
    spillLunge() {
      if (!world.spill || world.screen !== "play") return;
      // on the ready card a lunge is a launch, and a launch has to go
      // through the tap path: that is what clears w.ready, and a run
      // started around it would sit frozen on the countdown forever
      if (world.ready) {
        if (flap(world, save) === "flap") sfx.flap();
        notify();
        return;
      }
      if (spillLunge(world.spill)) { sfx.near(); notify(); }
    },
    spillBuy(what) {
      if (!world.spill || world.screen !== "play") return "closed";
      const r = spillBuy(world.spill, what);
      if (r === "ok") sfx.ui(); else if (r === "poor") sfx.warning();
      if (r === "ok") checkpointSpill();
      notify();
      return r;
    },
    spillLeaveDepot() {
      if (!world.spill || world.screen !== "play") return;
      if (spillLeaveDepot(world.spill)) {
        if (!world.spill.target) { save.spillSuspended = null; writeSave(save); }
        sfx.section(); notify();
      }
    },
    spillUtility(id, replace) {
      if (!world.spill || world.screen !== "play") return "closed";
      const result = spillUtility(world.spill, id, replace);
      if (result === "ok") { checkpointSpill(); sfx.ui(); } else sfx.warning();
      notify(); return result;
    },
    spillSpecialize(id) {
      const ok = world.screen === "play" && world.spill && spillSpecialize(world.spill, id);
      if (ok) { checkpointSpill(); sfx.ui(); notify(); } return !!ok;
    },
    spillContract(id) {
      const ok = world.screen === "play" && world.spill && spillTakeContract(world.spill, id);
      if (ok) { checkpointSpill(); sfx.ui(); notify(); } return !!ok;
    },
    spillSuspend() {
      if (world.screen !== "play" || !world.spill || !spillCheckpoint(world.spill)) return false;
      checkpointSpill(); world.spill = null; world.screen = "title";
      platform.gameplayStop();
      resetInputTracking(); notify(); return true;
    },
    spillResume() {
      // The loading screen still owns input; do not consume a checkpoint or
      // launch an unseen run against the temporary empty art bank.
      if (!spillReady || !engine.art) return false;
      const restored = restoreSpill(save.spillSuspended, world.W, world.H);
      if (!restored) return false;
      unlockAudio(); resetRun(world, save, "spill", false); world.spill = restored; restored.signal = spillEngineColor(save).color; resize();
      void loadSpillScene(engine.art, save.equippedSuit).then(notify);
      world.ready = false; world.squirrel.y = restored.pilot.y; world.squirrel.vy = 0;
      world.score = restored.cleared; save.spillSuspended = spillCheckpoint(restored); writeSave(save);
      resetInputTracking(); raceAccumulator = 0; last = performance.now(); platform.gameplayStart(); notify(); return true;
    },
    spillStarter(id) {
      const preparing = world.screen === "play" && world.spill?.phase === "ready" && !world.spill.target;
      if (world.screen !== "hangar" && !preparing) return;
      if (id && (!SPILL_UTILITIES[id] || save.spillBest < SPILL_UTILITIES[id].unlock)) return;
      save.spillStarter = id;
      if (preparing) { world.spill.utilities = id ? [id] : []; world.spill.ownedUtilities = id ? [id] : []; }
      writeSave(save); notify();
    },
    setSpillEngineColor(id) {
      const fitting = world.screen === "play" && world.spill && ["ready", "depot"].includes(world.spill.phase);
      const color = SPILL_ENGINE_COLORS.find(c => c.id === id && save.spillBest >= c.at);
      if ((world.screen !== "hangar" && !fitting) || !color) return false;
      save.spillEngineColor = id;
      save.spillSignal = id !== "stock";
      if (fitting) { world.spill.signal = spillEngineColor(save).color; checkpointSpill(); }
      writeSave(save); notify(); return true;
    },
    dismissDead() {
      clearSpillFire();
      world.screen = "title";
      world.lastRun = null;
      world.spill = null;
      // collecting the graduation gift moves the coach to the hangar door
      if (save.guide === "reward") save.guide = "hangar";
      writeSave(save);
      notify();
    },
    replayTutorial() {
      // The Spill briefing is replayed by the host without starting a tutorial.
    },
    pause() {
      clearSpillFire();
      cancelRaceControls();
      swipe = null;
      // A race pause discards the incomplete presentation-frame remainder.
      // Resume starts from the next whole 60 Hz authority step, so focus loss
      // can never leak hidden-tab wall time into the time trial.
      if (world.race || world.spill) raceAccumulator = 0;
      pausePlay(world);
      platform.gameplayStop();
      notify();
    },
    resume() {
      if (!world.spill) return;
      clearSpillFire();
      resumePlay(world);
      raceAccumulator = 0;
      last = performance.now();
      platform.gameplayStart();
      notify();
    },
    setShopTab(t) {
      shopTab = t;
      engine.shopTab = t;
      notify();
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    subscribeFrame(fn) {
      frameListeners.add(fn);
      return () => frameListeners.delete(fn);
    },
    snap: () => snapshot(world),
  };

  // The guided path advances only on the act it asked for: equip the gift
  // suit, then the gift helmet, then fly Mission 1. If the helmet is
  // somehow already on when the suit lands, the middle step is skipped
  // rather than demanding a re-equip.
  function guideStep(ev: "suit" | "helm" | "level") {
    if (ev === "suit" && save.guide === "hangar" && save.equippedSuit === GUIDE_SUIT) {
      save.guide = save.equipped === GUIDE_HELM ? "levels" : "helmet";
      // AND MOVE THE SHELF WITH THE STEP. Equipping the suit advances the
      // guide to the helmet, but the pilot is still standing on the SUITS
      // shelf - so the instruction named something that was not on screen
      // and had no target to point at. open() sets the tab on arrival; this
      // is the same rule for a step that advances while already here.
      if (save.guide === "helmet") { shopTab = "helmets"; engine.shopTab = "helmets"; }
    } else if (ev === "helm" && save.guide === "helmet" && save.equipped === GUIDE_HELM) {
      save.guide = "levels";
    } else if (ev === "level" && save.guide === "levels") {
      save.guide = "done";
    } else return;
    writeSave(save);
  }

  function transactHelmet(id: string) {
    const item = HELMETS.find((h) => h.id === id);
    if (!item) return "missing";
    // the Loadout's rule, not the premium list's: every own-head suit
    // (Arcflash, AcorNut, Alien, the critters) keeps its head
    const worn = SUITS.find((u) => u.id === save.equippedSuit);
    if (isPremiumFrames(save.equippedSuit) || (worn && wearsOwnHead(worn))) return "fixedHead";
    // a matched-set helmet only goes on its own suit
    if (item.suitOnly && save.equippedSuit !== item.suitOnly) return "suitOnly";
    if (!helmetRevealed(save, id)) return "locked";
    // A premium item that is OWNED equips — it never re-enters the buy
    // path, whatever its cost field says. The Cat carried a stale acorn
    // price from before it went premium, and "owned" met "poor".
    if (save.unlocked.includes(id) || (isIap(id) && ownsPremium(save, id))) {
      save.equipped = id;
      guideStep("helm");
      writeSave(save);
      notify();
      return "equip";
    }
    if (save.acorns < item.cost) return "poor";
    save.acorns -= item.cost;
    save.unlocked.push(id);
    save.equipped = id;
    guideStep("helm");
    writeSave(save);
    notify();
    return "buy";
  }

  function transactSuit(id: string) {
    const item = SUITS.find((h) => h.id === id);
    if (!item) return "missing";
    if (!suitRevealed(save, id)) return "locked";
    // the background sweep usually has this bank home already; if the
    // player beats it here, jump the queue so their suit flies animated.
    // Only against the REAL bank — a load into the placeholder would be
    // thrown away with it, yet still marked done.
    if (art && art.ready) void loadSuitBank(art, id);
    // bought, keyed or earned on the road: the same answer the Loadout gives
    if (save.unlockedSuits.includes(id) || (isIap(id) && ownsPremium(save, id))) {
      save.equippedSuit = id;
      dropOrphanedHelmet();
      guideStep("suit");
      writeSave(save);
      notify();
      return "equip";
    }
    if (save.acorns < item.cost) return "poor";
    save.acorns -= item.cost;
    save.unlockedSuits.push(id);
    // AcorNut is BOUGHT now (owner, 13 Sep 2026: "unlock acornaut with
    // 1,000 acorns, remove from star chart"), and the tutorial's strip in
    // loadSave reads `purchased`, never unlockedSuits, to decide whether he
    // is earned - so the receipt goes where that question looks.
    if (id === TUTORIAL_SUIT) save.purchased = [...new Set([...(save.purchased || []), id])];
    save.equippedSuit = id;
    dropOrphanedHelmet();
    guideStep("suit");
    writeSave(save);
    notify();
    return "buy";
  }

  // stepping out of a suit takes its matched helmet off with it - and
  // stepping INTO one puts its matched helmet on. The second half was
  // missing (owner, 2 Sep 2026: "the leviathan helmet is missing"): a
  // suit-locked helmet is on no shelf, so the drop here was the only code
  // that ever touched it, and a pilot who bought the Regalia pack flew
  // Leviathan in a Clear dome with no way to change that. Only a Clear
  // dome or another suit's orphan is replaced; a helmet the pilot chose
  // on purpose stays.
  function dropOrphanedHelmet() {
    // These pilots hide the previous visor without replacing its save choice.
    if (isPremiumFrames(save.equippedSuit)) return;
    // Envoy kept this when she left the painted frames for a rendered bank (27 Oct 2026)
    const worn = SUITS.find((u) => u.id === save.equippedSuit);
    if (isPremiumSuit(save.equippedSuit) && worn && wearsOwnHead(worn)) return;
    const h = HELMETS.find((x) => x.id === save.equipped);
    if (h?.suitOnly && h.suitOnly !== save.equippedSuit) save.equipped = "clear";
    if (save.equipped === "clear") {
      const own = HELMETS.find((x) => x.suitOnly === save.equippedSuit && helmetRevealed(save, x.id));
      if (own) save.equipped = own.id;
    }
  }

  function transactTrail(id: string) {
    const item = TRAILS.find((h) => h.id === id);
    if (!item) return "missing";
    // Trails are never bought with acorns any more — a rung on the Star
    // Chart's ladder opens each one, premium ones come with the pack, and
    // an open trail simply equips.
    if (!canWearTrail(id, save.equippedSuit) || !trailUnlocked(save, id)) return "locked";
    // Fixed wake is presentation, not a replacement for the previous trail.
    if (builtInTrailSuit(id)) return "equip";
    save.equippedTrail = id;
    if (!save.unlockedTrails.includes(id)) save.unlockedTrails.push(id);
    writeSave(save);
    notify();
    return "equip";
  }

  function transactPal(id: string) {
    if (!palUnlocked(save, id)) return "locked";
    // the sweep usually has this home already; if the player beats it,
    // jump the queue so their pal flies animated rather than still
    if (art && art.ready) void loadPalBank(art, id);
    if (!save.unlockedPals.includes(id)) save.unlockedPals.push(id);
    // TWO SLOTS (owner, 7 Sep 2026, earned at 720 stars). The high slot is
    // the one the game always had; the low slot opens beside it. A tap on
    // a free pal takes the first empty slot, or replaces the low one when
    // both are full. A tap on a pal already flying dismisses it, and a
    // lone companion always climbs to the high slot. "None" clears both.
    if (id === "none") { save.equippedPal = "none"; save.equippedPal2 = "none"; }
    else if (!dualPalUnlocked(save)) { save.equippedPal = id; save.equippedPal2 = "none"; }
    else if (save.equippedPal === id) { save.equippedPal = save.equippedPal2; save.equippedPal2 = "none"; }
    else if (save.equippedPal2 === id) save.equippedPal2 = "none";
    else if (save.equippedPal === "none") save.equippedPal = id;
    else {
      if (palsClash(save.equippedPal, id)) return "clash";
      save.equippedPal2 = id;
    }
    writeSave(save);
    notify();
    return "equip";
  }

  function toggleMod(which: "shield" | "battery") {
    if (which === "shield") {
      if (!startShieldUnlocked(save)) return "locked";
      // Armed is armed: the charge is spent by the next run, not by a
      // second tap. A toggle here let a pilot switch it off for nothing
      // and pay again to switch it back on.
      if (save.startShield) return "armed";
      if (save.acorns < MOD_SHIELD_COST) return "poor";
      save.acorns -= MOD_SHIELD_COST;
      save.startShield = true;
      writeSave(save);
      notify();
      return "on";
    }
    if (!batteryUnlocked(save)) return "locked";
    if (save.battery) return "owned";
    if (save.acorns < MOD_BATTERY_COST) return "poor";
    save.acorns -= MOD_BATTERY_COST;
    save.battery = true;
    writeSave(save);
    notify();
    return "buy";
  }

  // ------------------------------------------------------------ star dust

  /** today, in the PILOT'S local calendar. Deliberately local rather than
   *  UTC: a daily reward should turn over at the player's midnight, not at
   *  one that lands mid-evening for half the world. */
  function today() {
    const d = new Date();
    const p2 = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
  }
  function dayNumber(iso: string) {
    if (!iso) return NaN;
    const [y, m, d] = iso.split("-").map(Number);
    return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
  }

  /** Pay every currency line the pilot has crossed but not yet been paid for.
   *  Idempotent by construction: each reward has a stable ledger id, while
   *  dustPaidTo retains the compatibility watermark used by older bundles.
   *  Called on load and after every finish, so old saves collect their whole
   *  backlog rather than losing it. */
  function settleDust() {
    // the rules live on the save (settleStarRewards) so the harness can
    // prove them; this is the write and the notify
    const paid = settleStarRewards(save);
    if (paid <= 0) return 0;
    writeSave(save);
    notify();
    return paid;
  }

  /** How the daily stands right now, without claiming it. */
  /** Bandit, Noodle and Quill: the first full week's prize */
  const STREAK_PACK = ["raccoon", "ferret", "hedgehog"];
  function dailyState() {
    const t = dayNumber(today());
    const last = dayNumber(save.lastDaily);
    const claimedToday = !isNaN(last) && last === t;
    // a streak survives exactly one night. Two nights and it starts over.
    const continues = !isNaN(last) && t - last === 1;
    const nextStreak = claimedToday ? save.dailyStreak : continues ? save.dailyStreak + 1 : 1;
    const wrapped = ((nextStreak - 1) % DAILY_STREAK_LEN) + 1;
    const bonusDay = wrapped === DAILY_STREAK_LEN;
    // THE FIRST FULL WEEK PAYS THE CRITTER PACK (owner, 8 Sep 2026: "the
    // VERY FIRST 7 day streak unlocks Quill, Bandit and Noodle... After
    // that, it's star dust"). The pack replaces that week's dust bonus.
    const pack = bonusDay && !save.streakPackClaimed;
    return {
      claimedToday,
      streak: claimedToday ? ((save.dailyStreak - 1) % DAILY_STREAK_LEN) + 1 : wrapped,
      bonusDay,
      pack,
      amount: DAILY_DUST + (bonusDay && !pack ? DAILY_STREAK_BONUS : 0),
    };
  }

  let pendingDaily: { amount: number; streak: number; bonus: boolean; pack: boolean } | null = null;

  function claimDaily() {
    const st = dailyState();
    if (st.claimedToday) return "claimed";
    const t = dayNumber(today());
    const last = dayNumber(save.lastDaily);
    // a clock turned BACKWARDS must not re-open a claim already taken
    if (!isNaN(last) && t < last) return "claimed";
    save.dailyStreak = !isNaN(last) && t - last === 1 ? save.dailyStreak + 1 : 1;
    save.lastDaily = today();
    save.starDust += st.amount;
    if (st.pack) {
      save.purchased = [...new Set([...(save.purchased || []), ...STREAK_PACK])];
      save.streakPackClaimed = true;
      if (art && art.ready) for (const id of STREAK_PACK) void loadSuitBank(art, id);
    }
    pendingDaily = { amount: st.amount, streak: st.streak, bonus: st.bonusDay, pack: st.pack };
    writeSave(save);
    notify();
    return "ok";
  }

  /** REAL MONEY GOES THROUGH THE BRIDGE. With a store adapter (the App
   *  Store shell) the purchase runs there and the dust is granted here on
   *  "ok" - the one place a receipt turns into currency. Without one, the
   *  beta still grants outright so testers can shop; the live web page
   *  refuses, because a pack that grants for free is not a placeholder, it
   *  is a loophole. */
  /** ONE RECEIPT, ONE GRANT. A transaction id the ledger has seen is
   *  ignored; one it has not is paid and recorded. Without an id (the
   *  beta's free grant) it simply pays. */
  function grantDust(pack: (typeof DUST_PACKS)[number], transactionId?: string) {
    if (transactionId && !takeReceipt(save, transactionId)) return false;
    save.starDust += pack.dust + pack.bonus;
    writeSave(save);
    notify();
    return true;
  }
  /** THE PURCHASE THE SHOP IS WAITING ON. While the store sheet is up the
   *  row is disabled and says so; when the store answers, the outcome is
   *  parked here until the shop has shown it, the way takeDailyClaim parks
   *  a daily. A second tap while one is in flight is ignored rather than
   *  opening a second sheet. */
  let dustPurchase: { id: string; state: DustPurchaseState } | null = null;
  /** an ad is on screen (rewarded or interstitial): the sheets show it and refuse a second */
  let adBusy = false;

  // one full-screen ad, wherever it is due: the game goes silent for as
  // long as it is on screen, the cadence and the gap clock reset, and
  // `next` runs when it closes (or at once if the SDK had nothing)
  function playInterstitial(placement: "crash" | "level", next: () => void) {
    adBusy = true; notify();
    save.crashesSinceAd = 0;
    save.lastAdAt = Date.now();
    writeSave(save);
    void platform.showInterstitialAd(placement, () => muteAll(true)).then(() => { muteAll(false); adBusy = false; next(); notify(); });
  }
  /** REMOVE ADS is kept on the save, not spent: a receipt the ledger has
   *  not seen sets it; one it has seen (a re-delivery) changes nothing. */
  function grantNoAds(transactionId?: string) {
    if (transactionId && !takeReceipt(save, transactionId)) return false;
    save.noAds = true;
    writeSave(save);
    notify();
    return true;
  }
  /** the one store round trip both products share: park the purchase as
   *  pending, let the store answer, grant on "ok" with its transaction id */
  function buyFromStore(id: string, grant: (transactionId?: string) => void) {
    if (dustPurchase?.state === "pending") return "pending" as const;
    dustPurchase = { id, state: "pending" };
    notify();
    platform.buyDust(id)
      .then((r) => {
        if (r.result === "ok") grant(r.transactionId);
        dustPurchase = { id, state: r.result };
        notify();
      })
      // a store that throws (network gone, sheet dismissed by the OS) is
      // a failed purchase, not an unhandled rejection with a stuck row
      .catch(() => { dustPurchase = { id, state: "failed" }; notify(); });
    return "pending" as const;
  }
  function buyDust(id: string) {
    // REMOVE ADS (owner, 7 Oct 2026): the store sells it once; the beta
    // grants it so testers can see the sheets go quiet; the web page has
    // no full-screen ads to remove and no store, so it refuses
    if (id === REMOVE_ADS.id) {
      if (save.noAds) return "ok";
      if (platform.storeReady) return buyFromStore(id, (tx) => grantNoAds(tx));
      if (IS_BETA) { grantNoAds(); return "ok"; }
      return "unavailable";
    }
    const pack = DUST_PACKS.find((p) => p.id === id);
    if (!pack) return "missing";
    // ACORNS BUY STAR DUST (owner, 13 Sep 2026: "leave the packs in, they
    // just cost acorns ... 1000 acorn = 500 star dust"; 15 Sep 2026: "User
    // can still buy star dust with acorns"). No receipt: nothing outside
    // the save was charged. Only the cash pack goes to a store.
    if (!pack.cash) {
      if (save.acorns < pack.acorns) return "poor";
      save.acorns -= pack.acorns;
      grantDust(pack);
      return "ok";
    }
    if (platform.storeReady) return buyFromStore(id, (tx) => grantDust(pack, tx));
    if (IS_BETA) { grantDust(pack); return "ok"; }
    return "unavailable";
  }
  function dustPending() { return dustPurchase?.state === "pending" ? dustPurchase.id : null; }
  function takeDustOutcome() {
    if (!dustPurchase || dustPurchase.state === "pending") return null;
    const out = dustPurchase;
    dustPurchase = null;
    return out;
  }
  /** WHAT THE STORE STILL OWES. Every consumable on the store's record
   *  that the ledger has not paid: a purchase that finished after the app
   *  was suspended, a child's Ask to Buy approved hours later, a receipt
   *  the store re-delivers on the next launch. Asked at boot, on resume and
   *  after Restore Purchases; idempotent by the ledger. */
  function deliverPending() {
    if (!platform.storeReady) return Promise.resolve(0);
    return platform.pendingPurchases().then((list) => {
      let paid = 0;
      for (const p of list) {
        // the non-consumable comes back on the same list (RevenueCat's
        // non-subscription transactions), which is what makes Restore
        // Purchases and a new device re-grant it
        if (p.id === REMOVE_ADS.id) { if (grantNoAds(p.transactionId)) paid++; continue; }
        const pack = DUST_PACKS.find((d) => d.id === p.id);
        if (pack && grantDust(pack, p.transactionId)) paid++;
      }
      return paid;
    });
  }
  function restorePurchases() {
    return platform.restorePurchases().then(() => deliverPending()).then(() => notify());
  }

  function buyBundle(id: string) {
    const bn = BUNDLES.find((b) => b.id === id);
    if (!bn) return "missing";
    const ids = bundleIds(bn);
    if (ids.every((i) => ownsPremium(save, i))) return "owned";
    // Both entry points charge the displayed kit quote, with full retail
    // ownership credit. Zero due can still complete an unowned kit; only
    // the ownership check above means there is nothing left to grant.
    const due = bundlePrice(bn, (i) => ownsPremium(save, i));
    if (save.starDust < due) return "poor";
    save.starDust -= due;
    // idGrants, like every other buy (audit, 8 Sep 2026): a pack listing a
    // suit must also hand over the trail painted for it, or the Circuit Pack
    // gives Cyber without the Clockwork wake that the single shelf and the
    // featured pack both include for the same id.
    save.purchased = [...new Set([...(save.purchased || []), ...ids.flatMap((i) => idGrants(i))])];
    writeSave(save);
    notify();
    return "ok";
  }

  // ONE item off the shelf. The id is the ownership atom, so this also
  // covers a set: buying "cryostar" hands over the suit, the helmet that
  // matches it and the trail painted for it, for one price.
  function buyShopItem(id: string) {
    if (!IAP_ITEMS.includes(id)) return "missing";
    if (ownsPremium(save, id)) return "owned";
    const due = idDust(id);
    if (save.starDust < due) return "poor";
    save.starDust -= due;
    save.purchased = [...new Set([...(save.purchased || []), ...idGrants(id)])];
    writeSave(save);
    notify();
    return "ok";
  }

  // The same kit quote as direct checkout. Credit is a price reduction,
  // never a currency refund; an explicit zero-due completion still grants
  // the missing contents and their set trails.
  function buyFeature(id: string) {
    const bn = BUNDLES.find((b) => b.id === id);
    if (!bn) return "missing";
    const ids = bundleIds(bn);
    if (ids.every((i) => ownsPremium(save, i))) return "owned";
    const due = featurePrice(bn, (i) => ownsPremium(save, i));
    if (save.starDust < due) return "poor";
    save.starDust -= due;
    // a pack hands over its trails too, and idGrants folds in any set trail
    // that the pack listed only by its suit
    const grants = ids.flatMap((i) => idGrants(i));
    save.purchased = [...new Set([...(save.purchased || []), ...grants])];
    writeSave(save);
    notify();
    return "ok";
  }

  // A flight mod is bought once and then switched, so one call covers both:
  // if you do not own it this is a purchase, and if you do it is a toggle.
  // Turning one on turns its opposite off — Steady Gates and Rough Air
  // cannot both describe the same run.
  function setMod(id: string) {
    const mod = MODS.find((m) => m.id === id);
    if (!mod) return "unknown";
    // an always-on mod is a comfort switch: no star gate, no price, no
    // purchase record. It answers only to the pilot toggling it.
    if (!mod.always && !modsUnlocked(save)) return "locked";
    if (save[mod.save]) {
      save[mod.save] = false;
      writeSave(save);
      notify();
      return "off";
    }
    const owned = mod.always || save.purchased.includes(mod.id);
    if (!owned) {
      if (save.acorns < mod.cost) return "poor";
      save.acorns -= mod.cost;
      save.purchased.push(mod.id);
    }
    save[mod.save] = true;
    if (mod.opposes) save[mod.opposes] = false;
    writeSave(save);
    notify();
    return owned ? "on" : "buy";
  }

  // How sharp we are willing to render. A phone reporting devicePixelRatio 3
  // was being drawn at 2.5 and then upscaled by the browser to fill the
  // screen — a fractional resample of every frame, which is most of what
  // read as "fuzzy": on identical glyphs, full-DPR rendering carries about
  // half again as much edge detail.
  //
  // Rendering at 3 is not free (it is 44% more pixels per frame), and the
  // right answer depends on the device, so this is measured rather than
  // assumed. We open at full DPR and, if the first seconds of play cannot
  // hold a frame budget, drop to the old cap ONCE and stay there. It never
  // climbs back: a renderer that renegotiates its own resolution mid-run
  // would be visible every time it changed its mind.
  const RENDER_CAP_HIGH = 3;
  // 2, not 2.5: the race and the Debris Field already cap there, and a 30%
  // pixel cut was not enough of a step for a phone that fired the probe
  const RENDER_CAP_SAFE = 2;
  let renderCap = RENDER_CAP_HIGH;
  let capProbe: number[] | null = [];

  function noteFrameCost(ms: number) {
    if (!capProbe || world.screen !== "play") return;
    capProbe.push(ms);
    if (capProbe.length < 90) return;
    // ignore the slowest few: a GC pause or a first-touch decode is not the
    // steady state we are deciding about
    const sorted = capProbe.slice().sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    capProbe = null;
    if (median > 20 && renderCap !== RENDER_CAP_SAFE) {
      renderCap = RENDER_CAP_SAFE;
      resize();
    }
  }

  function resize() {
    const parent = canvas.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, world.race || world.spill ? 2 : renderCap);
    // widescreen everywhere: the play area takes the whole window. The old
    // 1600px cap left a dark bar down the right of a wide monitor (owner,
    // 7 Sep 2026); the cap is now past any desktop, and whatever is left
    // over splits evenly rather than piling up on one side.
    const W = Math.min(rect.width, 3840);
    const H = rect.height;
    // the notch: --sat is env(safe-area-inset-top) on the stage (index.html).
    // window.getComputedStyle, not the bare global: the bare name is not on
    // globalThis outside a real browser, so every harness test that boots the
    // engine threw here (audit, 8 Sep 2026) - which is exactly the six tests
    // that cover engine.ts and standalone.ts at all.
    world.insetTop = parseFloat(window.getComputedStyle(parent).getPropertyValue("--sat")) || 0;
    const sizeChanged = W > 0 && H > 0 && (W !== world.W || H !== world.H);
    const ownedRaceResize = sizeChanged && world.race !== null && world.screen === "play"
      && raceGesture.owner !== null;
    if (ownedRaceResize) {
      const owner = raceGesture.owner;
      // Neutralize before pausing so the semantic state is stamped at the
      // current authority tick. The dedicated recognizer path always clears
      // the double-tap/swipe candidate; a duplicate resize sees no owner and
      // therefore cannot append another transition.
      applyRaceGesture(neutralizeOwnedRaceGesture(raceGesture));
      if (owner === "keyboard-rise" || owner === "keyboard-drop") {
        raceResizeKeyboardReleasePending = owner;
      }
      raceAccumulator = 0;
      swipe = null;
      pausePlay(world);
      if (typeof owner === "number") {
        try { canvas.releasePointerCapture(owner); } catch { /* capture is best-effort */ }
      }
    }
    const spillResize = sizeChanged && world.spill !== null && world.screen === "play" && !world.ready;
    if (spillResize) { resetInputTracking(); raceAccumulator = 0; pausePlay(world); }
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    canvas.style.left = `${Math.max(0, Math.floor((rect.width - W) / 2))}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    resizeWorld(world, W, H);
    if (!world.stars.length) initStars(world);
    if (ownedRaceResize || spillResize) notify();
  }

  let swipe: { owner: number; x0: number; y0: number; t0: number; fired: boolean } | null = null;

  function applyRaceGesture(result: RaceGestureResult) {
    raceGesture = result.state;
    if (!result.input) return false;
    const wasReady = world.ready;
    const accepted = setRaceInput(world, result.input);
    if (accepted && wasReady && !world.ready) raceAccumulator = 0;
    return accepted;
  }

  function resetInputTracking() {
    clearSpillFire();
    raceGesture = createRaceGestureState();
    raceResizeKeyboardReleasePending = null;
    swipe = null;
  }

  function clearSpillFire() {
    fireOwners.clear();
    if (world.spill) spillSetFiring(world.spill, false);
  }

  function cancelRaceControls(owner?: RaceGestureOwner) {
    return applyRaceGesture(cancelRaceGesture(raceGesture, owner));
  }

  function pos(e: PointerEvent | Touch) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (world.W / rect.width),
      y: (e.clientY - rect.top) * (world.H / rect.height),
    };
  }

  function raceInputY(viewY: number) {
    const viewport = raceViewport(world.W, world.H);
    return canonicalRaceY(viewY, viewport.top, viewport.contentHeight);
  }

  canvas.addEventListener(
    "pointerdown",
    (e) => {
      if (world.screen !== "play") return;
      if (!e.isPrimary || (e.pointerType === "mouse" && e.button !== 0)) return;
      e.preventDefault();
      const p = pos(e);
      if (world.race) {
        try { canvas.setPointerCapture(e.pointerId); } catch { /* capture is best-effort */ }
        const canonicalY = raceInputY(p.y);
        applyRaceGesture(world.race.phase === "tunnel"
          ? pressRaceDragGesture(raceGesture, e.pointerId, world.race.tick, canonicalY, world.race.y)
          : pressRaceGesture(raceGesture, e.pointerId, world.race.tick, canonicalY));
        notify();
        return;
      }
      swipe = { owner: e.pointerId, x0: p.x, y0: p.y, t0: performance.now(), fired: false };
      // the field captures the pointer so a swipe that leaves the canvas
      // still lands; its tap is the same flap as everywhere else
      if (world.spill) { try { canvas.setPointerCapture(e.pointerId); } catch { /* browser cancelled the pointer */ } }
      // A tap is a tap everywhere, the corridor and the debris field
      // included. Hold-to-rise and slide-and-hold were flown against it and
      // retired - see the note in updateTunnel - so nothing intercepts this
      // any more. Hyper Run, the one hold-to-rise mode left, took the
      // race branch above.
      const ev = flap(world, save);
      if (ev === "flap") sfx.flap();
      if (world.tut?.stage === "pal" && world.tut.hold && world.tut.t >= TUT_ARM) {
        world.tut.hold = false;
        world.tut.t = 0;
      }
      notify();
    },
    { passive: false },
  );
  canvas.addEventListener(
    "pointermove",
    (e) => {
      if (world.race && world.screen === "play") {
        const p = pos(e);
        const canonicalY = raceInputY(p.y);
        const result = world.race.phase === "tunnel"
          ? moveRaceDragGesture(raceGesture, e.pointerId, world.race.tick, canonicalY, world.race.y)
          : moveRaceGesture(raceGesture, e.pointerId, world.race.tick, canonicalY);
        const isDrop = result.input?.drop === true;
        const accepted = applyRaceGesture(result);
        if (isDrop && accepted) {
          sfx.dive();
          notify();
        }
        return;
      }

      if (!swipe || swipe.owner !== e.pointerId || swipe.fired || world.screen !== "play" || world.flight === "tunnel") return;
      const p = pos(e);
      if (!world.spill && performance.now() - swipe.t0 > 320) {
        swipe = null;
        return;
      }
      // THE SPILL's swipes: RIGHT is the lunge, UP is the kick skyward, and
      // DOWN falls through to the dive below. Each is read against the
      // other axis so a diagonal goes to whichever way it mostly travelled.
      if (world.spill) {
        const dx = p.x - swipe.x0;
        const dy = p.y - swipe.y0;
        if (dx >= 40 && dx > Math.abs(dy)) {
          swipe.fired = true;
          if (spillLunge(world.spill)) sfx.near();
          notify();
          return;
        }
        if (dy <= -34 && -dy > Math.abs(dx)) {
          swipe.fired = true;
          if (spillBurstUp(world)) sfx.flap();
          notify();
          return;
        }
      }
      if (p.y - swipe.y0 >= 34) {
        swipe.fired = true;
        const ev = dive(world, save);
        if (ev === "dive") sfx.dive();
        notify();
      }
    },
    { passive: true },
  );
  const end = (e: PointerEvent) => {
    if (raceGesture.owner === e.pointerId) {
      if (e.type === "pointercancel") cancelRaceControls(e.pointerId);
      else applyRaceGesture(releaseRaceGesture(raceGesture, e.pointerId));
      return;
    }
    if (world.race) return;
    // only the finger that owns the field's swipe can end it
    if (world.spill && swipe?.owner !== e.pointerId) return;
    swipe = null;
  };
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);
  canvas.addEventListener("lostpointercapture", end);
  // A finger resting on the field is a long-press to the browser: without
  // these, phones answer it with text selection and the copy bubble over
  // the whole HUD.
  canvas.addEventListener("touchstart", (e) => e.preventDefault(), { passive: false });
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  document.addEventListener("selectstart", (e) => {
    const t = e.target as HTMLElement | null;
    if (t?.closest?.("input, textarea")) return;
    e.preventDefault();
  });

  const DIVE_KEYS = new Set(["ArrowDown", "KeyS", "ControlLeft", "ControlRight"]);
  window.addEventListener("keydown", (e) => {
    // TYPING IS NOT FLYING. Space is the flap key, and this listener claimed
    // it globally with preventDefault - so pressing space in the pilot-name
    // box inserted nothing and, on the title screen, launched a run that
    // re-rendered the field and threw the typed name away. Any key aimed at
    // a text field belongs to that field. Checked on the focused element
    // rather than the event target so it holds however focus was reached.
    const focused = document.activeElement as HTMLElement | null;
    if (focused && (focused.tagName === "INPUT" || focused.tagName === "TEXTAREA"
        || focused.isContentEditable)) {
      return;
    }
    if (e.code === "Escape") {
      if (world.screen === "play") engine.pause();
      else if (world.screen === "pause") engine.resume();
      else if (world.screen !== "dead") engine.open("title");
      return;
    }
    if (e.code === "KeyF") {
      if (world.screen === "play") e.preventDefault();
      if (!e.repeat) engine.spillFire(true, "keyboard-f");
      return;
    }
    if (e.code === "Space" || e.code === "ArrowUp") {
      e.preventDefault();
      // A key held through an orientation change keeps generating repeat
      // keydowns. It may not auto-resume the paused race or become a new
      // press until the physical key has first been released.
      if (raceResizeKeyboardReleasePending) return;
      // a key held down is one tap, never a stream of them - in the field
      // and, since 12 Sep 2026 (tap retrofit study), in ordinary flight too
      if (e.repeat && (world.spill || world.screen === "play")) return;
      if (world.screen === "splash") engine.open("title");
      else if (world.screen === "title") {
        if (save.spillSuspended) engine.spillResume();
        else engine.fly("spill");
      }
      // A focus/visibility/Escape pause cancels the semantic owner. Ignore an
      // OS repeat from the still-held key; only a fresh physical press resumes.
      else if (world.screen === "pause") {
        if (!e.repeat) engine.resume();
      }
      else if (world.screen === "play") {
        if (world.race) {
          if (!e.repeat) applyRaceGesture(world.race.phase === "tunnel"
            ? pressRaceKeyboardDragGesture(raceGesture, "keyboard-rise", world.race.tick, 0)
            : pressRaceGesture(raceGesture, "keyboard-rise", world.race.tick, null));
        } else {
          const ev = flap(world, save);
          if (ev === "flap") sfx.flap();
        }
      } else if (world.screen === "dead" && world.deadTimer > 0.55) engine.dismissDead();
      notify();
    }
    // DIVE KEYS (owner, 7 Sep 2026: "computer specific controls, like the
    // control key for swipe down"): ArrowDown, S, or either Control key
    if (DIVE_KEYS.has(e.code) && world.screen === "play" && world.race) {
      e.preventDefault();
      if (raceResizeKeyboardReleasePending) return;
      if (e.repeat) return;
      if (world.race.phase === "tunnel") {
        applyRaceGesture(pressRaceKeyboardDragGesture(
          raceGesture,
          "keyboard-drop",
          world.race.tick,
          640,
        ));
      } else if (applyRaceGesture(dropRaceGesture(raceGesture))) sfx.dive();
      notify();
    } else if (DIVE_KEYS.has(e.code) && world.screen === "play" && world.flight !== "tunnel") {
      if (e.repeat) return;
      const ev = dive(world, save);
      if (ev === "dive") sfx.dive();
      notify();
    }
    // the Spill's extra keys: right (or D) for the lunge, W for the harder
    // kick skyward. Space is the tap and ArrowDown the dive, as everywhere
    if (world.spill && world.screen === "play" && !e.repeat) {
      if (e.code === "ArrowRight" || e.code === "KeyD") {
        e.preventDefault();
        engine.spillLunge();
      } else if (e.code === "KeyW") {
        e.preventDefault();
        if (spillBurstUp(world)) sfx.flap();
        notify();
      }
    }
  });
  window.addEventListener("keyup", (e) => {
    if (e.code === "Space" || e.code === "ArrowUp") {
      if (raceResizeKeyboardReleasePending === "keyboard-rise") {
        raceResizeKeyboardReleasePending = null;
        return;
      }
      if (raceGesture.owner === "keyboard-rise") {
        applyRaceGesture(releaseRaceGesture(raceGesture, "keyboard-rise"));
      }
    }
    if (DIVE_KEYS.has(e.code)) {
      if (raceResizeKeyboardReleasePending === "keyboard-drop") {
        raceResizeKeyboardReleasePending = null;
        return;
      }
      if (raceGesture.owner === "keyboard-drop") {
        applyRaceGesture(releaseRaceGesture(raceGesture, "keyboard-drop"));
      }
    }
  });
  // Capture releases even when a focused menu button consumes keyboard events.
  window.addEventListener("keyup", e => {
    if (e.code === "KeyF") engine.spillFire(false, "keyboard-f");
  }, true);
  window.addEventListener("blur", () => {
    if (world.screen === "play") {
      engine.pause();
      return;
    }
    cancelRaceControls();
    swipe = null;
    clearSpillFire();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (world.screen === "play") {
        engine.pause();
        return;
      }
      cancelRaceControls();
      swipe = null;
      clearSpillFire();
    }
  });
  function dispatchWorldEvent(ev: string | null) {
    if (ev === "acorn") sfx.acorn();
    if (ev === "gold" || ev === "ring") sfx.gold();
    if (ev === "freeze") sfx.freeze();
    if (ev === "section") sfx.section();
    if (ev === "region") sfx.region();
    if (ev === "warning") sfx.warning();
    if (ev === "near") sfx.near();
    if (ev === "milestone") sfx.milestone();
    if (ev === "bounce") sfx.bounce();
    if (ev === "debris") sfx.bounce();
    if (ev === "die") {
      // the interstitial cadence counts every crash; afterCrash spends it
      if (!world.lvl && !world.race && !world.spill && !world.continued) save.crashesSinceAd = (save.crashesSinceAd ?? 0) + 1;
      writeSave(save);
      sfx.die();
      platform.gameplayStop();
      notify();
    }
    if (ev === "shield") {
      sfx.shield();
      notify();
    }
    if (ev === "shift" || ev === "entry" || ev === "return") {
      sfx.shift();
      notify();
    }
  }
  function dispatchRaceCues(cues: Parameters<typeof planRaceCueEffects>[0]) {
    let shouldNotify = false;
    for (const effect of planRaceCueEffects(cues)) {
      if (effect.sfx === "gold") sfx.gold();
      if (effect.sfx === "bounce") sfx.bounce();
      if (effect.sfx === "acorn") sfx.acorn();
      if (effect.sfx === "shift") sfx.shift();
      if (effect.notify) shouldNotify = true;
    }
    if (shouldNotify) notify();
  }
  // THE SPILL's cues, once per frame. Tap and dive already sounded on the
  // pointer path, so they are skipped here; everything the field does on
  // its own - a hit, a shatter, a wave card, the Depot - sounds here, once
  // per kind per frame, so a PULSE through six rocks is one thud, not six.
  function dispatchSpillCues(cues: SpillCue[]) {
    if (!cues.length) return;
    const spill = world.spill;
    if (spill && cues.some(c => ["dead", "mission"].includes(c))) {
      bankSpill(save, spill, true);
      // AND THE BOARD HEARS ABOUT IT (App Store prep audit, section 2). The
      // "spill" board has been declared and configured since the shell
      // landed, and nothing ever posted to it: only endless free flight
      // reached submitScore (sim.ts). Waves cleared is the Debris Field's
      // own number - it is what the mode is scored on and what spillBest
      // already keeps - and higher is better, so it needs no special board.
      // a mission is not a board run (the same rule the sim keeps)
      if (spill.cleared > 0 && !spill.target) platform.submitScore("spill", spill.cleared);
      if (!spill.target) save.spillSuspended = null;
      writeSave(save);
    } else if (cues.includes("depot")) checkpointSpill();
    // one sound per SOUND per frame, not per cue: a hit and the shatter it
    // causes share the hull thud, a Depot-wave clear and its milestone share
    // the fanfare, and neither should play twice
    const sounds = new Set<keyof typeof sfx>();
    let shouldNotify = false;
    // a graze is deliberately not a re-render: the play overlay is only the
    // two buttons and pause, and "charged" already relights PULSE
    const NOTIFY: SpillCue[] = ["hit", "hull", "charged", "pulse", "wave", "go", "dock", "depot", "armed",
      "depot-close", "buy", "deny", "respawn", "recharge", "mission", "contract", "dead"];
    // press and burst sound on the pointer path already
    const SOUND: Partial<Record<SpillCue, keyof typeof sfx>> = {
      hit: "bounce", shatter: "bounce", ore: "acorn", gold: "gold", shield: "shield", hull: "region",
      graze: "near", pulse: "shift", count: "ui", go: "section", clear: "milestone", milestone: "milestone",
      dock: "region", depot: "region", buy: "ui", deny: "warning", respawn: "shift", surge: "warning",
      warn: "warning", event: "warning", contract: "milestone", mission: "milestone",
      laser: "near", cannon: "bounce", "enemy-fire": "warning", "enemy-down": "shield",
    };
    for (const c of new Set(cues)) {
      const snd = SOUND[c];
      if (snd) sounds.add(snd);
      if (NOTIFY.includes(c)) shouldNotify = true;
    }
    for (const snd of sounds) sfx[snd]();
    if (shouldNotify) notify();
  }
  function checkpointSpill() {
    const spill = world.spill;
    if (!spill || spill.phase !== "depot") return;
    if (!spill.target && spill.wave === 20 && save.spillBest < 20) spill.firstPass = true;
    bankSpill(save, spill);
    if (!spill.target) save.spillSuspended = spillCheckpoint(spill);
    writeSave(save);
  }
  let nextSpillPaint = 0;
  function loop(now: number) {
    const frameDt = Math.min(0.25, (now - last) / 1000);
    noteFrameCost(now - last);
    last = now;
    if (world.spill) {
      const scene = engine.art.spillScene;
      world.spill.depotGagReady = vanguardDepotEligible(save.equippedSuit, !!save.motionOff,
        !!scene?.depot && scene?.bear?.length === 36 && !!scene?.vanguardDepot && !!engine.art.spillShip[`hull-${world.spill.up.plating}`]);
      if (save.motionOff && world.spill.depotGag) world.spill.depotGag = false;
    }
    // ONE FIXED 1/60 STEP FOR EVERY MODE. Race and Spill always ran here;
    // ordinary flight joined them on 12 Sep 2026 (tap retrofit study). It
    // used to integrate on the frame delta clamped to 33 ms, so a 120 Hz
    // phone and a 60 Hz phone flew slightly different arcs through the same
    // taps. A hitch replays up to the 0.25 s cap.
    // The Flight Test's transport scales the world clock here, ahead of
    // the accumulator, so a half-speed bench still steps whole 1/60 ticks
    // and a hold (0) steps none. Every other run feeds it 1.
    raceAccumulator += frameDt * (world.flightTest && world.screen === "play" ? world.timeScale : 1);
    while (raceAccumulator + 1e-12 >= 1 / 60) {
      // Race cues are drained after every authority step, not once per
      // render frame. This preserves simultaneous pass/debris feedback and
      // prevents high-refresh rendering from replaying audio side effects.
      if (world.screen !== "play" || !world.spill || !["wave", "drain"].includes(world.spill.phase)) clearSpillFire();
      const ev = updateWorld(world, save, 1 / 60);
      if (world.screen !== "play" || !world.spill || !["wave", "drain"].includes(world.spill.phase)) clearSpillFire();
      if (world.race) dispatchRaceCues(takeRaceCueEffects(world));
      else { dispatchWorldEvent(ev); dispatchSpillCues(takeSpillCues(world)); }
      raceAccumulator -= 1 / 60;
      if (world.screen === "lvldone") break;
    }
    // Four scores, one at a time: the chiptune rides the retro renderer
    // (arcade + shifted stretches, exactly as always); the Hyper Run time
    // trial keeps the voyage loop; every other live run gets the upbeat
    // flight instrumental; and everything outside a run — menus, results,
    // the hangar — settles onto the slow menu score.
    const inRun = world.screen === "play" || world.screen === "pause";
    music.set(
      world.retro && inRun ? "cosmos"
        : world.race && inRun ? "voyage"
          : inRun ? "flight"
            : "menu");
    // Keep authority/input at 60 Hz without painting duplicate frames on 120 Hz phones.
    if (world.spill && now + 0.5 < nextSpillPaint) {
      if (running) raf = requestAnimationFrame(loop);
      return;
    }
    if (world.spill) {
      // Carry the deadline across frames so 90/144 Hz displays do not fall to 45/48 fps.
      if (nextSpillPaint < now - 100) nextSpillPaint = now;
      do { nextSpillPaint += 1000 / 60; } while (nextSpillPaint <= now + 0.5);
    } else nextSpillPaint = 0;
    if (!world.spill || world.screen !== "play" && world.screen !== "pause" && world.screen !== "dead") hideBackplate();
    ctx.clearRect(0, 0, world.W, world.H);
    if (art) {
      if (world.screen === "play" || world.screen === "dead" || world.screen === "pause") {
        void loadZoneArt(art, world.envA);
        void loadZoneArt(art, world.envB);
        if (!world.lvl && !world.retro && !world.spill && !world.tunnel && !world.race)
          void loadZoneArt(art, envIndexFor(world, world.score + ENV_GATES));
        drawWorld(ctx, world, save, art);
        if (world.screen !== "pause") drawHud(ctx, world, art, save);
      } else if (art.sky) {
        ctx.drawImage(art.sky, 0, 0, world.W, world.H);
        ctx.fillStyle = "rgba(7,11,22,0.35)";
        ctx.fillRect(0, 0, world.W, world.H);
      } else {
        ctx.fillStyle = "#070b16";
        ctx.fillRect(0, 0, world.W, world.H);
      }
    } else {
      ctx.fillStyle = "#070b16";
      ctx.fillRect(0, 0, world.W, world.H);
    }
    frameListeners.forEach(fn => fn());
    if (running) raf = requestAnimationFrame(loop);
  }

  resize();
  initStars(world);
  // paint from frame one with an empty bank, then swap the real art in as
  // it arrives — and if the whole load fails, the game still runs
  art = emptyArt();
  engine.art = art;
  // The loading screen owns input until the stock bank and Spill scene are
  // ready. Missing optional images use their existing fallback; unexpected
  // loader failures reject artReady and are shown by the host.
  // FLIGHT plus whatever the save wears ride the boot load; the rest of
  // the roster's flight banks stream in one at a time afterwards. The pal
  // is named here for the same reason the suit is: it is the one the pilot
  // is looking at, so it is the one that must not arrive late.
  // Store receipts and unrelated daily currency are not part of the Spill host.

  // the switches that are not read from the save on the fly are applied
  // once here, so a reload lands in the state the pilot left
  applyMute();
  // the shell gets its line back into the game once, here
  platform.attach({ mute: muteAll });
  document.body.classList.toggle("ac-nomotion", !!save.motionOff);
  setVanguardPitchTrim(suitPitchFor(save, "vanguard"));

  // the first flight is flown in AcorNut, so his bank rides the boot load
  // until the tutorial is done
  engine.artReady = loadArt(save.tutorialDone ? [save.equippedSuit] : [save.equippedSuit, TUTORIAL_SUIT], [save.equippedPal, save.equippedPal2])
    .then(async (bank) => {
      art = bank;
      engine.art = bank;
      await loadSpillScene(bank, save.equippedSuit);
      spillReady = true;
      void loadZoneArt(bank, world.envB).then(notify);
      notify();
      // ...and once the engine is stopped the sweep stops waiting too, or its
      // one-second poll would keep a headless test's process alive forever
      prefetchArtBanks(bank, () => !running || (world.screen !== "play" && world.screen !== "pause"));
    });
  notify();
  return engine;
}

export { deepUnlocked, lostUnlocked } from "./save";
