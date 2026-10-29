import type { Engine } from "./engine";
import { artUrl } from "./art";
import { spillAppearance } from "./spill-appearance";
import { SUITS } from "./catalog";
import { paintShipPreview, type ShipPick } from "./draw";
import { writeSave } from "./save";
import { SPILL_CONTROL_COLORS } from "./spill-control-art";
import { SPILL_ENGINE_COLORS, SPILL_UTILITIES, SPILL_UTILITY_IDS, SPILL_SPECIALTIES,
  spillEngineColor, spillContractOffers, type SpillUtility, type SpillSpecialty } from "./spill-content";
import { spillBuildFromState } from "./spill-presentation";
import { SPILL_SHOP, spillPrice, spillContractProgress, type SpillBuyable } from "./spill";

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = "", text = "") => {
  const n = document.createElement(tag); n.className = cls; n.textContent = text; return n;
};
const systems = ["plating", "shield", "thrusters", "pulse"] as const;
type System = typeof systems[number];
const symbols = {
  plating: "M12 21 3 12C-3 4 7-1 12 6 17-1 27 4 21 12Z",
  shield: "M12 2 21 6V12C21 17 17 21 12 23 7 21 3 17 3 12V6Z",
  thrusters: "M12 2C14 8 21 9 20 16 19 23 5 23 4 16 3 12 7 10 7 7 8 10 10 11 10 14 15 11 11 7 12 2Z",
  pulse: "M13 2 4 14H11L10 22 21 9H13Z", core: "M4 10A8 8 0 1 1 5 18M4 3V10H11",
};
function systemIcon(id: keyof typeof symbols) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24"); svg.setAttribute("aria-hidden", "true"); svg.classList.add("ac-workshop-icon");
  const path = document.createElementNS(svg.namespaceURI, "path"); path.setAttribute("d", symbols[id]);
  path.setAttribute("fill", id === "core" ? "none" : "currentColor");
  if (id === "core") { path.setAttribute("stroke", "currentColor"); path.setAttribute("stroke-width", "2"); }
  svg.append(path); return svg;
}
function coin() { const im = el("img", "ac-workshop-coin"); im.src = artUrl("pickups/acorn-coin.svg"); im.alt = ""; return im; }
export function spillUtilityArt(id: SpillUtility) {
  const im = el("img", "ac-utility-art"); im.src = artUrl(`spill-ship/utilities/${id}.webp`);
  im.alt = ""; im.draggable = false; im.width = im.height = 64; return im;
}
function shipPreview(engine: Engine, pick: ShipPick, height: number, flashAt = -10000, scale = 3.2) {
  const canvas = el("canvas", "ac-workshop-preview"), dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = 344 * dpr; canvas.height = height * dpr;
  canvas.setAttribute("role", "img"); canvas.setAttribute("aria-label", "Your selected ship, pilot and fitted utilities");
  const ctx = canvas.getContext("2d");
  if (ctx) {
    let last = -Infinity;
    const paint = (now: number) => {
      if (!canvas.isConnected) return;
      const reduced = engine.save.motionOff || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      if (now - last >= 1000 / 30 - 1) {
        last = now; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, 344, height);
        const flash = Math.max(0, 1 - (now - flashAt) / 700);
        if (flash && !reduced) {
          const glow = ctx.createRadialGradient(180, height * .55, 10, 180, height * .55, 130);
          glow.addColorStop(0, `rgba(130,225,176,${flash * .4})`); glow.addColorStop(1, "rgba(130,225,176,0)");
          ctx.fillStyle = glow; ctx.fillRect(0, 0, 344, height);
        }
        paintShipPreview(ctx, engine.art, engine.save, 189, height * .55, scale, reduced ? 0 : now / 1000, pick);
      }
      if (!reduced) requestAnimationFrame(paint);
    }; requestAnimationFrame(paint);
  }
  return canvas;
}

/** Earned starting utilities are equipped in Loadout. */
export function drawSpillStarters(engine: Engine, onPick = () => {}) {
  const save = engine.save, wrap = el("section", "ac-starting-kit");
  wrap.append(el("h3", "", "Starting utility"), el("p", "ac-workshop-note", "Choose one earned item. Free on every new run."));
  const none = el("button", `ac-starter-none${!save.spillStarter ? " on" : ""}`, !save.spillStarter ? "✓ No starting utility" : "No starting utility");
  none.dataset.shipStarter = "stock"; none.setAttribute("aria-pressed", String(!save.spillStarter));
  none.onclick = () => { onPick(); engine.spillStarter(null); }; wrap.append(none);
  const choices = el("div", "ac-starting-options");
  for (const id of SPILL_UTILITY_IDS) {
    const u = SPILL_UTILITIES[id], earned = save.spillBest >= u.unlock, selected = save.spillStarter === id;
    const b = el("button", `ac-starter-option${selected ? " on" : ""}`), text = el("span", "ac-starter-text");
    b.dataset.shipStarter = id; b.title = u.detail; b.disabled = !earned; b.setAttribute("aria-pressed", String(selected));
    text.append(el("b", "", u.name), el("span", "", id === "capacitor" ? "Extra Pulse charge · needs Impact pulse." : u.desc), el("strong", "", !earned ? `Clear wave ${u.unlock}` : selected ? "✓ Selected for next run" : "Select · free"));
    b.append(spillUtilityArt(id), text); b.onclick = () => { onPick(); engine.spillStarter(id); }; choices.append(b);
  }
  wrap.append(choices); return wrap;
}
export function drawSpillEnginePicker(engine: Engine) {
  const chosen = spillEngineColor(engine.save), wrap = el("section", "ac-engine-picker"), head = el("div", "ac-workshop-sectionhead");
  head.append(el("h3", "", `Engine color: ${chosen.name}`), el("span", "", "Appearance only")); wrap.append(head);
  const colors = el("div", "ac-engine-colors");
  for (const color of SPILL_ENGINE_COLORS) {
    const selected = color.id === chosen.id, earned = engine.save.spillBest >= color.at;
    const b = el("button", `ac-engine-color${selected ? " on" : ""}`), swatch = el("i", "ac-engine-swatch");
    b.dataset.shipColor = color.id; b.disabled = !earned; b.setAttribute("aria-pressed", String(selected));
    b.setAttribute("aria-label", `${color.name}${selected ? ", selected" : ""}${earned ? "" : `, clear wave ${color.at} to unlock`}`);
    swatch.style.setProperty("--engine-color", color.color); swatch.setAttribute("aria-hidden", "true");
    b.append(swatch, el("span", "", color.name), el("small", "", !earned ? `Wave ${color.at}` : selected ? "✓ Selected" : "Use color"));
    b.onclick = () => engine.setSpillEngineColor(color.id); colors.append(b);
  }
  wrap.append(colors);
  if (spillAppearance(engine.save).trail === "rust-wake") wrap.append(el("p", "ac-workshop-note", "Rust Wake overrides this color with orange. Switch to the standard trail in Loadout to use your color."));
  return wrap;
}
/** THE ONE INSTRUCTIONS SHEET (owner, 10 Sep 2026: "a single instructions
 *  menu should pop up for gameplay mechanics"). It teaches the hand and the
 *  loop, shows the ship the pilot is about to fly, and offers nothing to
 *  choose: the free upgrade waits at the Depot, utilities at wave 5. */
export function drawSpillLaunchSetup(engine: Engine, onGuide: () => void) {
  const save = engine.save, wrap = el("div", "ac-spillprep ac-spillsetup");
  const pilot = SUITS.find(s => s.id === save.equippedSuit)?.name ?? "Pilot";
  const head = el("header", "ac-setup-head"), heading = el("div");
  heading.append(el("p", "ac-kicker", "DEBRIS FIELD · NEW RUN"), el("h2", "", "How to fly"));
  const help = el("button", "ac-helpdot", "?"); help.dataset.spillControl = "setup-guide";
  help.setAttribute("aria-label", "How the Depot works"); help.onclick = onGuide;
  head.append(heading, help); wrap.append(head);
  const body = el("div", "ac-setup-body");
  body.append(flightControlCards(), harderKickNote());
  const loop = el("ol", "ac-setup-loop"); loop.setAttribute("aria-label", "The run");
  for (const [text, withCoin] of [["Survive the waves", false], ["Collect Acorn Coins", true], ["Depot every 5 waves · upgrade your ship · first upgrade free", false]] as const) {
    const step = el("li"); if (withCoin) step.append(coin()); step.append(el("span", "", text)); loop.append(step);
  }
  const stage = el("div", "ac-launch-ship");
  stage.append(shipPreview(engine, { plating: 0, thrusters: 0, pulse: 0, shield: 0, utilities: save.spillStarter ? [save.spillStarter] : [] }, 104, -10000, 2.5), el("b", "ac-launch-pilot", `${pilot} aboard`));
  body.append(loop, stage); wrap.append(body);
  const actions = el("div", "ac-workshop-actions"), back = el("button", "ac-ghost ac-workshop-exit", "MAIN MENU"), go = el("button", "ac-primary ac-workshop-launch", "START RUN");
  back.onclick = () => engine.open("title"); go.dataset.spillControl = "land";
  go.onclick = () => {
    // the briefing has been shown: the save says so, and nothing repeats it
    if (!save.spillDepotGuideSeen) { save.spillDepotGuideSeen = true; writeSave(save); }
    engine.spillLunge();
  };
  actions.append(back, go); wrap.append(actions); return wrap;
}

export type DepotView = { key: string; part: System; extras: boolean; specialties: boolean; guide: boolean; swap: SpillUtility | null; receipt: string; flashAt: number; openedAt: number; picked: boolean };
export const createDepotView = (): DepotView => ({ key: "", part: "plating", extras: false, specialties: false, guide: false, swap: null, receipt: "", flashAt: -10000, openedAt: performance.now(), picked: false });
/** THE FREE-PICK NUDGE (owner, 26 Sep 2026: "after a few seconds a pulsing ring
 *  around the free button and arrows to each of the upgraded options to help
 *  prompt a selection pick and clear selection route"). It waits this long
 *  after the pre-flight Depot opens. */
export const DEPOT_HINT_MS = 3000;
function drawDepotGuide(engine: Engine, onClose: () => void, closeLabel: string) {
  const sheet = el("section", "ac-lvlcard ac-depotcard ac-depotguidecard");
  sheet.setAttribute("role", "dialog"); sheet.setAttribute("aria-modal", "true"); sheet.setAttribute("aria-label", "How the Depot works"); sheet.tabIndex = -1;
  const inRun = engine.world.screen === "play", goal = inRun ? engine.world.lvl?.def.spillFinish : null;
  const objective = goal ? goal.kind === "ore" ? `Collect ${goal.n} Acorn Coins.` : `Visit ${goal.n} depots.`
    : inRun && engine.world.spill?.target ? `Survive ${engine.world.spill.target} waves.` : "Clear waves. Beat your best.";
  sheet.append(el("p", "ac-kicker", "DEBRIS FIELD · DEPOT GUIDE"), el("h2", "", "How the Depot works"), el("p", "ac-workshop-note", objective));
  const collect = el("div", "ac-guide-collect"), words = el("div");
  words.append(el("h3", "", "Collect Acorn Coins"), el("p", "", "Buy upgrades here. First one free.")); collect.append(coin(), words); sheet.append(collect);
  const effects = el("div", "ac-guide-systems");
  for (const [id, name, effect] of [["plating", "Health", "More health"], ["shield", "Shields", "Block hits"], ["thrusters", "Thrusters", "Stronger bursts"], ["pulse", "Pulse", "Charged blast"]] as const) {
    const item = el("div"); item.dataset.system = id; item.append(systemIcon(id), el("b", "", name), el("span", "", effect)); effects.append(item);
  }
  sheet.append(effects, el("p", "ac-guide-services", "Repair · full health   |   Extra life · revive once"));
  // Utilities are the wave-5 shelf, not the first decision: one compact row,
  // art and a short name, after the systems (owner: "not the most important
  // thing to understand").
  const title = el("div", "ac-workshop-sectionhead ac-guide-utilityhead"); title.append(el("h3", "", "Utilities"), el("span", "", "From the wave 5 Depot · fit 2")); sheet.append(title);
  const kit = el("div", "ac-guide-utilityrow");
  for (const id of SPILL_UTILITY_IDS) {
    const u = SPILL_UTILITIES[id], item = el("div"); item.dataset.guideUtility = id; item.title = `${u.name} · ${u.guide}`;
    item.append(spillUtilityArt(id), el("b", "", u.short)); kit.append(item);
  }
  sheet.append(kit);
  const carry = el("div", "ac-guide-carry"), lost = el("div", "ac-guide-loss"), kept = el("div", "ac-guide-keep");
  lost.append(el("h3", "", "Out of lives"), el("p", "", "Wave 1. Acorn Coins & upgrades reset."));
  kept.append(el("h3", "", "Unlocks stay"), el("p", "", "Starting utility choices & engine colors.")); carry.append(lost, kept); sheet.append(carry);
  const enter = el("button", "ac-primary ac-workshop-launch", closeLabel); enter.dataset.spillControl = "enter-depot";
  enter.onclick = onClose;
  sheet.append(enter, el("p", "ac-workshop-note ac-guide-timing", "Depot every 5 waves · No timer")); return sheet;
}

/** Informational replay: reading it changes no run state and no save field. */
export function drawSpillGuideSheet(engine: Engine, onClose: () => void, closeLabel: string) {
  const wrap = el("div", "ac-lvlsheet ac-depotwrap ac-workshop ac-spillhelpwrap");
  wrap.style.setProperty("--workshop-art", `url("${artUrl("spill-scene/workshop.webp")}")`);
  const sheet = drawDepotGuide(engine, onClose, closeLabel);
  sheet.querySelector(".ac-guide-collect")?.before(drawSpillFlightHelp());
  wrap.append(sheet);
  wrap.onclick = e => { if (e.target === wrap) onClose(); };
  // Keys read by a modal must not tap or launch the ready ship behind it.
  wrap.onkeydown = e => {
    e.stopPropagation();
    if (e.key === "Tab") { e.preventDefault(); sheet.querySelector("button")?.focus(); }
  };
  wrap.onkeyup = e => e.stopPropagation();
  return wrap;
}

/** TAP TO FLY, in three cards. The instructions sheet, Settings & Help and
 *  the briefing replay all draw these, so the hand is described once. */
// Each card names the PAD it describes and wears that pad's colour. All
// three were the same slab, so the panel teaching the controls looked
// nothing like the controls (owner, 10 Sep 2026: "the debris field buttons
// in help are too generic ... match same colors as buttons used in debris
// field for tap, dive, thrust"). The tints are READ from
// SPILL_CONTROL_COLORS, the table spillControlArt paints the real pads
// with, so repainting a pad repaints its card.
const FLIGHT_CONTROLS = [
  ["TAP", "Fly", "Tap · Space", "thrust"],
  ["SWIPE DOWN", "Dive", "Swipe down · ↓", "dive"],
  ["LUNGE", "Dash forward", "Swipe right · →", "lunge"],
] as const;
function flightControlCards() {
  const controls = el("div", "ac-spillhelp-controls");
  for (const [input, action, note, pad] of FLIGHT_CONTROLS) {
    const card = el("div", `ac-spillhelp-pad ac-spillhelp-${pad}`);
    const { light, edge } = SPILL_CONTROL_COLORS[pad];
    card.style.setProperty("--pad-light", light);
    card.style.setProperty("--pad-edge", edge);
    card.append(el("b", "", input), el("span", "", action), el("small", "ac-sub", note)); controls.append(card);
  }
  return controls;
}
const harderKickNote = () => el("small", "ac-sub ac-spillhelp-extra", "Swipe up · harder kick · W");

/** The same instructions in Settings & Help and the replayable briefing. */
export function drawSpillFlightHelp() {
  const section = el("section", "ac-spillflighthelp");
  section.setAttribute("aria-label", "How to fly · Debris Field");
  section.append(el("p", "ac-kicker ac-secthead", "HOW TO FLY · DEBRIS FIELD"), flightControlCards(), harderKickNote(),
    el("p", "ac-sub", "Depot every 5 waves · spend Acorn Coins · first upgrade free."));
  return section;
}

export function drawDepotWorkshop(engine: Engine, view: DepotView, rerender: () => void) {
  const sp = engine.world.spill!, key = `${sp.seed}:${sp.wave}`;
  // The guide is behind the "?" only: the instructions sheet before the run
  // already taught the loop, and a Depot that opens a second sheet on
  // arrival hid the free upgrade behind it (owner, 10 Sep 2026).
  if (key !== view.key) Object.assign(view, createDepotView(), { key });
  const wrap = el("div", "ac-lvlsheet ac-depotwrap ac-workshop");
  wrap.style.setProperty("--workshop-art", `url("${artUrl("spill-scene/workshop.webp")}")`);
  if (view.guide) {
    wrap.append(drawDepotGuide(engine, () => { view.guide = false; rerender(); }, "BACK TO DEPOT"));
    return wrap;
  }
  const sheet = el("section", "ac-lvlcard ac-depotcard ac-workshop-card");
  sheet.setAttribute("role", "dialog"); sheet.setAttribute("aria-label", "Salvage depot");
  const arming = (sp.depot?.arm ?? 0) > 0;
  // A redraw must not restart the nudge, so its delay is measured from when
  // this Depot opened: negative once the wait is over, which resumes the
  // pulse mid-cycle instead of hiding it again.
  const hinting = !!(sp.welcome && sp.freeUpgrade) && !arming;
  if (hinting) {
    sheet.classList.add("ac-workshop-hinting");
    sheet.style.setProperty("--hint-delay", `${Math.round(DEPOT_HINT_MS - (performance.now() - view.openedAt))}ms`);
  }
  const feedback = (message: string) => { view.receipt = message; view.flashAt = performance.now(); };
  const priceButton = (what: SpillBuyable, label?: string) => {
    const price = spillPrice(sp, what), b = el("button", "ac-workshop-buy"); b.dataset.spillControl = what;
    b.disabled = arming || price === null || price > sp.ore || (!!sp.welcome && (!sp.freeUpgrade || what === "repair" || what === "core"));
    const text = price === null ? what === "repair" ? "Full health" : what === "core" ? sp.coreArmed ? "Ready" : "Used" : "Full"
      : sp.welcome && !sp.freeUpgrade ? "Next stop" : price === 0 ? "Free" : String(price);
    if (label && price !== null) b.append(el("span", "", label));
    if (price !== null && price > 0 && !sp.welcome) b.append(coin()); b.append(el("span", "", text));
    b.setAttribute("aria-label", `${SPILL_SHOP[what].name}: ${price === null ? "complete" : price === 0 ? "free upgrade" : `${price} Acorn Coins`}`);
    b.onclick = () => {
      feedback(what === "repair" ? "Health restored" : what === "core" ? "Extra life ready" : `${SPILL_SHOP[what].name} upgraded`);
      if (engine.spillBuy(what) !== "ok") { view.receipt = "Upgrade unavailable"; rerender(); }
    }; return b;
  };
  const head = el("header", "ac-workshop-head"), heading = el("div"), tools = el("div", "ac-workshop-headtools"), wallet = el("div", "ac-workshop-wallet");
  heading.append(el("p", "ac-kicker", `DEBRIS FIELD · ${sp.welcome ? "PRE-FLIGHT" : `WAVE ${sp.wave} CLEARED`}`), el("h2", "", sp.firstPass ? "First pass complete" : "Salvage depot"));
  wallet.setAttribute("aria-label", `${sp.ore} Acorn Coins`); wallet.append(coin(), el("b", "", String(sp.ore)));
  const guide = el("button", "ac-helpdot", "?"); guide.setAttribute("aria-label", "How the Depot works"); guide.dataset.spillControl = "guide"; guide.onclick = () => { view.guide = true; rerender(); };
  tools.append(wallet, guide); head.append(heading, tools); sheet.append(head);
  if (sp.firstPass) sheet.append(el("p", "ac-workshop-milestone", "Wave 20 complete. Victory recorded. Keep your ship and fly on."));
  const status = el("div", "ac-workshop-status"), health = el("div", "ac-workshop-health"), healthText = el("span"), healthBar = el("progress");
  healthText.append(systemIcon("plating"), el("b", "", "Health"), el("span", "", `${sp.hull} / ${sp.maxHull}`));
  healthBar.max = sp.maxHull; healthBar.value = sp.hull; healthBar.setAttribute("aria-label", `${sp.hull} of ${sp.maxHull} health`); health.append(healthText, healthBar);
  const shields = el("div", "ac-workshop-shields"); shields.append(systemIcon("shield"), el("span", "", `Shields ${sp.shield} / 2`));
  status.append(health, shields); if (!sp.welcome) status.append(priceButton("repair", "Repair")); sheet.append(status);
  if (sp.welcome) sheet.append(el("p", "ac-workshop-free", sp.freeUpgrade ? "Choose one free upgrade" : "✓ Upgrade fitted · ready to launch"));
  const stage = el("div", "ac-workshop-stage"); stage.append(shipPreview(engine, spillBuildFromState(sp), 192, view.flashAt));
  // the arrows point at the four options until the pilot taps one of them
  if (hinting && !view.picked) stage.classList.add("ac-workshop-hint-arrows");
  const links = document.createElementNS("http://www.w3.org/2000/svg", "svg"); links.classList.add("ac-workshop-links"); links.setAttribute("viewBox", "0 0 344 192"); links.setAttribute("aria-hidden", "true");
  const paths = { plating: "M 97 36 L 119 36 L 153 85", shield: "M 252 36 L 235 36 L 214 82", thrusters: "M 90 165 L 104 130 L 110 119", pulse: "M 255 164 L 260 138 L 252 121" };
  for (const id of systems) {
    const path = document.createElementNS(links.namespaceURI, "path"); path.setAttribute("d", paths[id]); path.setAttribute("data-system", id); links.append(path);
    const b = el("button", `ac-workshop-system${view.part === id ? " selected" : ""}`); b.dataset.system = id; b.dataset.spillControl = `inspect-${id}`;
    b.setAttribute("aria-pressed", String(view.part === id));
    const name = el("span", "ac-workshop-systemname"), price = spillPrice(sp, id);
    name.append(systemIcon(id), el("b", "", SPILL_SHOP[id].name));
    const cost = el("span", "ac-workshop-systemprice", price === null ? "Full" : sp.welcome && !sp.freeUpgrade ? "Next stop" : price === 0 ? "Free" : String(price));
    if (price && !sp.welcome) cost.append(coin()); b.append(name, cost);
    b.onclick = () => { view.part = id; view.specialties = false; view.picked = true; rerender(); }; stage.append(b);
  }
  stage.append(links); sheet.append(stage);
  const part = view.part, tier = part === "shield" ? sp.shield : sp.up[part], max = part === "shield" ? 2 : 3;
  const selection = el("section", "ac-workshop-selection"), words = el("div", "ac-workshop-selectiontext"); selection.dataset.system = part;
  words.append(el("h3", "", `${SPILL_SHOP[part].name}${part === "plating" ? " upgrade" : ""}`), el("p", "", part === "shield"
    ? tier >= max ? "Two shields ready" : `Blocks one hit · ${tier} → ${tier + 1} shields`
    : tier >= max ? "Fully upgraded" : SPILL_SHOP[part].levels[tier]));
  const take = priceButton(part);
  // the ring marks the one button that fits the free upgrade
  if (hinting) take.classList.add("ac-workshop-hint-ring");
  selection.append(systemIcon(part), words, take); sheet.append(selection);
  const price = spillPrice(sp, part);
  if (!sp.welcome && price !== null && price > sp.ore) sheet.append(el("p", "ac-workshop-need", `${price - sp.ore} more Acorn Coins needed`));
  if (!sp.welcome && part !== "shield" && tier >= 2) {
    const details = el("details", "ac-workshop-specialties"); details.open = view.specialties; details.append(el("summary", "", "Customize this upgrade · free"));
    details.ontoggle = () => { if (details.isConnected) view.specialties = details.open; };
    const choices = el("div", "ac-spilloptions");
    for (const [id, spec] of Object.entries(SPILL_SPECIALTIES).filter(([, spec]) => spec.axis === part)) {
      const selected = sp.specialties[part] === id, b = el("button", `ac-spilloption${selected ? " selected" : ""}`);
      b.dataset.spillControl = id; b.disabled = arming; b.setAttribute("aria-pressed", String(selected));
      b.append(el("b", "", spec.name), el("span", "", spec.desc), el("strong", "", selected ? "✓ Fitted" : "Fit free"));
      b.onclick = () => { feedback(`${spec.name} fitted`); engine.spillSpecialize(id as SpillSpecialty); }; choices.append(b);
    }
    details.append(choices); sheet.append(details);
  }
  // The opening Depot offers only the four core upgrades. Utilities arrive after wave 5.
  if (!sp.welcome) {
    const shelf = el("section", "ac-workshop-utilities"), shelfHead = el("div", "ac-workshop-sectionhead"), slots = el("div", "ac-workshop-slots");
    shelfHead.append(el("h3", "", `Utilities · ${sp.utilities.length} / 2 fitted`), el("span", "", sp.welcome ? "Buy after wave 5" : "Buy once this run · refit free")); shelf.append(shelfHead);
    for (let i = 0; i < 2; i++) {
      const id = sp.utilities[i], slot = el("span", id ? "fitted" : ""); if (id) slot.append(spillUtilityArt(id));
      slot.append(el("span", "", id ? SPILL_UTILITIES[id].name : `Empty slot ${i + 1}`)); slots.append(slot);
    }
    shelf.append(slots);
    const utilityGrid = el("div", "ac-workshop-utilitygrid");
    for (const id of SPILL_UTILITY_IDS) {
      const u = SPILL_UTILITIES[id], fitted = sp.utilities.includes(id), owned = sp.ownedUtilities.includes(id);
      const card = el("article", `ac-workshop-utility${fitted ? " fitted" : ""}`), name = el("div", "ac-workshop-utilityname");
      card.title = u.detail; name.append(spillUtilityArt(id), el("h4", "", u.name)); card.append(name, el("p", "", u.desc));
      if (id === "capacitor" && !sp.up.pulse) card.append(el("small", "ac-workshop-requirement", "Needs Impact pulse"));
      const buy = el("button", `ac-workshop-buy${fitted ? " fitted" : ""}`); buy.dataset.spillControl = id;
      buy.disabled = arming || !!sp.welcome || (!fitted && !owned && sp.ore < u.price);
      buy.setAttribute("aria-label", `${fitted ? "Remove" : "Fit"} ${u.name}${!owned ? ` for ${u.price} Acorn Coins` : ""}`);
      buy.append(el("span", "", sp.welcome ? fitted ? "Starting utility" : "Next stop" : fitted ? "✓ Fitted · remove" : sp.utilities.length === 2 ? "Swap" : "Fit"));
      if (!sp.welcome && !owned) buy.append(coin(), el("span", "", String(u.price)));
      else if (!sp.welcome && owned && !fitted) buy.append(el("span", "", "Free"));
      buy.onclick = () => {
        if (!fitted && sp.utilities.length === 2) {
          view.swap = id; rerender(); document.querySelector<HTMLElement>(".ac-workshop-swap button")?.focus(); return;
        }
        feedback(`${u.name} ${fitted ? "removed · refit free this run" : "fitted"}`); engine.spillUtility(id);
      }; card.append(buy); utilityGrid.append(card);
    }
    shelf.append(utilityGrid);
    if (view.swap) {
      const swapId = view.swap, swap = el("div", "ac-workshop-swap"); swap.setAttribute("role", "group");
      swap.append(el("p", "", `Replace which utility with ${SPILL_UTILITIES[swapId].name.toLowerCase()}?`));
      for (const id of sp.utilities) {
        const b = el("button", "ac-ghost ac-workshop-secondary", SPILL_UTILITIES[id].name); b.dataset.spillControl = `replace-${id}`; b.disabled = arming;
        b.onclick = () => {
          view.swap = null; feedback(`${SPILL_UTILITIES[swapId].name} fitted`); engine.spillUtility(swapId, id);
          document.querySelector<HTMLElement>(`[data-spill-control="${swapId}"]`)?.focus({ preventScroll: true });
        }; swap.append(b);
      }
      const cancel = el("button", "ac-ghost ac-workshop-exit", "CANCEL"); cancel.dataset.spillControl = "cancel-swap";
      cancel.onclick = () => {
        view.swap = null; rerender(); document.querySelector<HTMLElement>(`[data-spill-control="${swapId}"]`)?.focus({ preventScroll: true });
      }; swap.append(cancel); shelf.append(swap);
    }
    sheet.append(shelf);
  }
  if (!sp.welcome) {
    const extras = el("details", "ac-workshop-extras"); extras.open = view.extras; extras.append(el("summary", "", "Extra life & bonus goals"));
    extras.ontoggle = () => { if (extras.isConnected) view.extras = extras.open; };
    const life = el("div", "ac-workshop-service"), text = el("div"); text.append(el("b", "", "Extra life"), el("p", "", sp.coreBought ? sp.coreArmed ? "Ready · revive once" : "Used this run" : "Revive once with full health"));
    life.append(systemIcon("core"), text, priceButton("core")); extras.append(life, el("p", "ac-workshop-note", `Choose one bonus goal · waves ${sp.wave + 1}–${sp.wave + 5}`));
    if (sp.contract) extras.append(el("p", "ac-workshop-contract", spillContractProgress(sp)));
    else for (const offer of spillContractOffers(sp.wave)) {
      const b = el("button", "ac-workshop-contract-option"), text = el("span"); b.disabled = arming; b.dataset.spillControl = `contract-${offer.kind}`;
      text.append(el("b", "", offer.name), el("span", "", offer.desc)); b.append(text, el("strong", "", `+${offer.reward} Acorn Coins`));
      b.onclick = () => { feedback(`${offer.name} selected`); engine.spillContract(offer.kind); }; extras.append(b);
    }
    sheet.append(extras);
  }
  if (sp.contractMessage) sheet.append(el("p", "ac-workshop-contract", sp.contractMessage));
  const footer = el("footer", "ac-workshop-footer"), actions = el("div", "ac-workshop-actions");
  const receipt = el("p", "ac-workshop-receipt", view.receipt || (sp.welcome ? "One free upgrade before takeoff" : "Take your time · next depot in 5 waves"));
  receipt.setAttribute("aria-live", "polite"); footer.append(receipt);
  if (!sp.target) {
    const save = el("button", "ac-ghost ac-workshop-exit", "SAVE & EXIT"); save.disabled = arming; save.dataset.spillControl = "save"; save.onclick = () => engine.spillSuspend(); actions.append(save);
  }
  const go = el("button", "ac-primary ac-workshop-launch", sp.welcome && sp.freeUpgrade ? "CHOOSE FREE UPGRADE" : `LAUNCH WAVE ${sp.welcome ? 1 : sp.wave + 1}`);
  go.disabled = arming || !!(sp.welcome && sp.freeUpgrade); go.dataset.spillControl = "launch"; go.onclick = () => engine.spillLeaveDepot();
  actions.append(go); footer.append(actions); sheet.append(footer); wrap.append(sheet); return wrap;
}
