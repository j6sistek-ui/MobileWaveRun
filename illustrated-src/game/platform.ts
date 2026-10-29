/**
 * THE PLATFORM BRIDGE. Everything the game needs from the world outside
 * its own bundle goes through this one object: where the save is kept,
 * whether real money can be taken and at what price, where a score is
 * sent, and which doors are a shell's to open. The web build answers all
 * of it with localStorage and "not available"; a native shell (Capacitor
 * on iOS today, a Steam shell later) hands in an adapter on
 * `window.__acornautPlatform` BEFORE the bundle loads and the bridge
 * adopts it. Nothing in the game imports a store SDK, a Game Center SDK
 * or a Steamworks binding - the shell owns those, the game owns this
 * contract. See SHIPPING.md, "The platform bridge".
 *
 * This file imports nothing from the game, so catalog.ts and save.ts can
 * read it without a cycle.
 */

export type PlatformKind = "web" | "ios" | "android" | "steam";

/** the boards a run can post to - one per mode the shop of records shows */
export type BoardId = "fly" | "deep" | "lost" | "arcade" | "tunnel" | "spill" | "hyper";

export type BuyResult = "ok" | "cancelled" | "failed" | "unavailable";
/** what a finished purchase hands back: the outcome, and on "ok" the
 *  store's transaction id so the same receipt is never granted twice */
export type BuyOutcome = { result: BuyResult; transactionId?: string };
/** a consumable the store has on record for this user - the game grants
 *  the ones its receipt ledger has not seen (a purchase that completed
 *  after the app was suspended, an Ask to Buy approved later, a store
 *  re-delivery on the next launch) */
export type PendingPurchase = { id: string; transactionId: string };

/** WHAT A SHELL HANDS IN. Every member is optional: an adapter that says
 *  nothing about boards gets the web answer for boards. */
export type PlatformAdapter = {
  kind?: PlatformKind;
  /** synchronous key/value storage the shell keeps durable (the shell
   *  preloads it before the bundle runs, so reads never wait) */
  storage?: { get(key: string): string | null; set(key: string, value: string): void; remove(key: string): void };
  /** real-money store for the dust packs (catalog DUST_PACKS ids) */
  store?: {
    /** localized price string from the store, or null until it has answered */
    priceOf(id: string): string | null;
    /** completes the purchase; the GAME grants the dust on "ok". A bare
     *  BuyResult is accepted from an older adapter; a BuyOutcome carries
     *  the transaction id that makes the grant idempotent. */
    buy(id: string): Promise<BuyResult | BuyOutcome>;
    /** Apple requires the button even when every product is consumable */
    restore(): Promise<void>;
    /** every consumable transaction the store knows for this user, as
     *  GAME ids (the adapter maps store product ids back) */
    pending?(): Promise<PendingPurchase[]>;
  };
  boards?: {
    submit(board: BoardId, score: number): void;
    /** open the platform's own leaderboard UI (all-time, monthly, friends) */
    show(board?: BoardId): void;
  };
  /** ADS (13 Sep 2026, owner: "just ad revenue for now"). A shell with an
   *  ad SDK hands in these; the game never imports one. Rewarded ads pay
   *  the viewer only on "earned"; the game decides what that buys. */
  ads?: {
    /** a rewarded ad is loaded and could be shown right now */
    rewardedReady(): boolean;
    /** show one; "earned" when it was watched to the reward, "dismissed"
     *  when closed early, "unavailable" when nothing could be shown. The
     *  optional `started` fires the moment the ad is actually on screen
     *  (a portal's adStarted): the game mutes itself then, not on request. */
    rewarded(placement: AdPlacement, started?: () => void): Promise<AdOutcome>;
    interstitialReady(): boolean;
    /** show a full-screen ad at a natural break; resolves when it closes */
    interstitial(placement: AdPlacement, started?: () => void): Promise<void>;
    /** the ad SDK's consent platform says the pilot must be able to change
     *  their privacy choice (UMP privacyOptionsRequirementStatus REQUIRED);
     *  the Profile shows a PRIVACY OPTIONS row while this is true */
    privacyOptionsRequired?(): boolean;
    /** show that form; "updated" once consent was refreshed afterwards */
    showPrivacyOptionsForm?(): Promise<"updated" | "unavailable">;
  };
  /** GAMEPLAY EVENTS (13 Sep 2026, CrazyGames). A portal wants to know
   *  when the pilot is actually flying (its ads, its metrics and its
   *  "gameplay first" review all key off it). start on every launch,
   *  resume and revive; stop on every break: pause, crash, leaving a run.
   *  happy is an optional celebration beat (a mission finished, a Depot
   *  reached) - a portal may confetti it, a shell may ignore it. */
  gameplay?: { start(): void; stop(): void; happy?(): void };
  /** may the game show links that leave it (Discord, X, mail)? A portal
   *  forbids them (CrazyGames: no external links, no cross-promotion).
   *  Default: yes. */
  links?: boolean;
  /** the shell's line back INTO the game. The bridge calls this once at
   *  boot with the hooks the game exposes; a shell keeps them and calls
   *  them when the world outside changes (a portal's mute switch). */
  listen?(hooks: PlatformHooks): void;
  /** the shell shows Rig Editor / Ship Bench / Wormhole doors? Default: web yes, shells no */
  devDoors?: boolean;
};

/** what the game hands a shell to call back into it */
export type PlatformHooks = {
  /** silence everything (music and effects) or restore the pilot's own
   *  settings; the shell says which, the game remembers what they were */
  mute(m: boolean): void;
};

export type AdPlacement = "continue" | "dust" | "crash" | "level";
export type AdOutcome = "earned" | "dismissed" | "unavailable";

export type Platform = {
  kind: PlatformKind;
  native: boolean;
  storage: NonNullable<PlatformAdapter["storage"]>;
  /** true once a store adapter is present - the shop shows real prices,
   *  takes real money and offers Restore Purchases */
  storeReady: boolean;
  priceOf(id: string): string | null;
  buyDust(id: string): Promise<BuyOutcome>;
  restorePurchases(): Promise<void>;
  /** consumables on record at the store; [] on the web or before the store answers */
  pendingPurchases(): Promise<PendingPurchase[]>;
  boardsReady: boolean;
  submitScore(board: BoardId, score: number): void;
  showBoards(board?: BoardId): void;
  /** true once an ads adapter is present (a shell with the SDK, or the
   *  beta page's stand-in) - the crash sheet and the shop offer ad slots */
  adsReady: boolean;
  rewardedAdReady(): boolean;
  showRewardedAd(placement: AdPlacement, started?: () => void): Promise<AdOutcome>;
  interstitialAdReady(): boolean;
  showInterstitialAd(placement: AdPlacement, started?: () => void): Promise<void>;
  /** the shell's consent platform requires a reachable privacy-options entry */
  privacyOptionsRequired(): boolean;
  showPrivacyOptions(): Promise<"updated" | "unavailable">;
  /** the pilot is flying / has stopped flying (see PlatformAdapter.gameplay) */
  gameplayStart(): void;
  gameplayStop(): void;
  celebrate(): void;
  /** external links may be shown */
  links: boolean;
  /** hand the shell the game's hooks (once, at boot) */
  attach(hooks: PlatformHooks): void;
  devDoors: boolean;
};

const memory = new Map<string, string>();
/** localStorage when the browser allows it, an in-memory map when it does
 *  not (private mode, restricted storage) so the game still runs */
const webStorage: Platform["storage"] = {
  // a value that fell back to memory (quota, private mode) is the newest
  // one: read it first, or a failed write reads back as the stale slot
  // (audit, 30 Sep 2026)
  get(key) { const m = memory.get(key); if (m !== undefined) return m; try { return localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(key, value); memory.delete(key); } catch { memory.set(key, value); } },
  remove(key) { memory.delete(key); try { localStorage.removeItem(key); } catch { /* nothing to remove */ } },
};

function adapterOf(): PlatformAdapter | null {
  if (typeof window === "undefined") return null;
  const a = (window as unknown as { __acornautPlatform?: PlatformAdapter }).__acornautPlatform;
  return a && typeof a === "object" ? a : null;
}

/** THE BETA'S STAND-IN ADS. The beta page has no ad SDK, but the crash
 *  sheet's ad continue, the shop's ad dust and the interstitial cadence
 *  all have to be flown before a shell exists. On the beta page (and only
 *  there) a pretend ad "plays" for a moment and pays out, so every ad
 *  flow is exercisable; the web page offers no ads at all. */
function betaAds(): NonNullable<PlatformAdapter["ads"]> | undefined {
  if (typeof window === "undefined") return undefined;
  if ((window as { __ACORNAUT_BETA__?: unknown }).__ACORNAUT_BETA__ !== true) return undefined;
  const play = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
  return {
    rewardedReady: () => true,
    rewarded: () => play(1200).then(() => "earned" as const),
    interstitialReady: () => true,
    interstitial: () => play(800),
  };
}

function build(a: PlatformAdapter | null): Platform {
  const kind: PlatformKind = a?.kind ?? "web";
  const native = kind !== "web";
  const storage = a?.storage ?? webStorage;
  const store = a?.store;
  const boards = a?.boards;
  const ads = a?.ads ?? (a ? undefined : betaAds());
  return {
    kind,
    native,
    storage,
    storeReady: !!store,
    priceOf: (id) => store?.priceOf(id) ?? null,
    buyDust: (id) => store
      ? store.buy(id).then((r) => typeof r === "string" ? { result: r } : r)
      : Promise.resolve({ result: "unavailable" as const }),
    restorePurchases: () => store ? store.restore() : Promise.resolve(),
    pendingPurchases: () => store?.pending ? store.pending().catch(() => []) : Promise.resolve([]),
    boardsReady: !!boards,
    submitScore: (board, score) => { try { boards?.submit(board, score); } catch { /* a board that is down never costs a run */ } },
    showBoards: (board) => boards?.show(board),
    adsReady: !!ads,
    rewardedAdReady: () => { try { return !!ads?.rewardedReady(); } catch { return false; } },
    showRewardedAd: (placement, started) => ads
      ? ads.rewarded(placement, started).catch(() => "unavailable" as const)
      : Promise.resolve("unavailable" as const),
    interstitialAdReady: () => { try { return !!ads?.interstitialReady(); } catch { return false; } },
    // an ad that throws or hangs must never hold the game: a shell resolves
    // on close, and a failure resolves too
    showInterstitialAd: (placement, started) => ads ? ads.interstitial(placement, started).catch(() => undefined) : Promise.resolve(),
    privacyOptionsRequired: () => { try { return !!ads?.privacyOptionsRequired?.(); } catch { return false; } },
    showPrivacyOptions: () => ads?.showPrivacyOptionsForm
      ? ads.showPrivacyOptionsForm().catch(() => "unavailable" as const)
      : Promise.resolve("unavailable" as const),
    // a portal that is down never costs a run: every event is a try
    gameplayStart: () => { try { a?.gameplay?.start(); } catch { /* the pilot flies regardless */ } },
    gameplayStop: () => { try { a?.gameplay?.stop(); } catch { /* ditto */ } },
    celebrate: () => { try { a?.gameplay?.happy?.(); } catch { /* ditto */ } },
    links: a?.links ?? true,
    attach: (hooks) => { try { a?.listen?.(hooks); } catch { /* a shell that cannot listen is a shell without a mute switch */ } },
    devDoors: a?.devDoors ?? !native,
  };
}

export const platform: Platform = build(adapterOf());
