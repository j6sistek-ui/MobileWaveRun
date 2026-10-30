import type { Engine } from "./engine";
import { artUrl } from "./art";
import { spillAppearance } from "./spill-appearance";
import { paintShipPreview, type ShipPick } from "./draw";
import { writeSave } from "./save";
import { SPILL_ENGINE_COLORS, SPILL_UTILITIES, SPILL_UTILITY_IDS, SPILL_SPECIALTIES, SPILL_EVENTS,
  spillEngineColor, spillContractOffers, spillEventFor, type SpillUtility, type SpillSpecialty } from "./spill-content";
import { spillBuildFromState } from "./spill-presentation";
import { SPILL_SHOP, spillPrice, spillContractProgress, type SpillBuyable } from "./spill";
import { SPILL_WEAPONS, spillWeaponPrice, spillWeaponStats, type SpillWeaponId } from "./spill-combat";
import { SPILL_ARTIFACTS, SPILL_BUILD_RECIPES, spillArtifactOffers, type SpillArtifactId } from "./spill-builds";
import { SPILL_HAZARDS, SPILL_HAZARD_IDS, spillHazardPlan } from "./spill-hazards";
import { SPILL_CHASSIS, SPILL_WEAPON_MODULES, SPILL_TRIALS } from "./spill-career";
import { SPILL_RISKS, type SpillRiskId } from "./spill-expeditions";
import { spillClimaxWave } from "./spill-climax";

// Keep legacy save/content terminology internal while giving this game its own identity.
const displayText = (text: string) => text.replace(/Acorn Coins?/g, "Salvage").replace(/\bcoins\b/g, "salvage");
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = "", text = "") => {
  const n = document.createElement(tag); n.className = cls;
  n.textContent = displayText(text);
  if (tag === "button") (n as HTMLButtonElement).type = "button";
  return n;
};
type UIState = "available" | "selected" | "locked" | "unaffordable" | "complete" | "arming";
/** Presentation state is separate from disabled: an equipped item remains visibly fitted. */
function uiState(node: HTMLElement, state: UIState) { node.dataset.uiState = state; return node; }
const systems = ["plating", "shield", "thrusters", "pulse"] as const;
type System = typeof systems[number];
const symbols = {
  plating: "M7 2H17L23 8V16L17 22H7L1 16V8ZM8 6V18H16V6Z",
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
function coin() { const im = el("img", "ac-workshop-coin"); im.src = artUrl("space-ui/salvage.png"); im.alt = ""; im.draggable = false; return im; }
export function spillUtilityArt(id: SpillUtility) {
  const im = el("img", "ac-utility-art"); im.src = artUrl(`spill-ship/utilities/${id}.webp`);
  im.alt = ""; im.draggable = false; im.width = im.height = 64; return im;
}
function shipPreview(engine: Engine, pick: ShipPick, height: number, flashAt = -10000, scale = 3.2) {
  const canvas = el("canvas", "ac-workshop-preview"), dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = 344 * dpr; canvas.height = height * dpr;
  canvas.setAttribute("role", "img"); canvas.setAttribute("aria-label", "Your selected ship and fitted utilities");
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
  const save = engine.save, wrap = el("section", "ac-starting-kit mwr-section");
  wrap.append(el("h3", "", "Starting utility"), el("p", "ac-workshop-note", "Choose one earned item. Free on every new run."));
  const none = el("button", `ac-starter-none${!save.spillStarter ? " on" : ""}`, !save.spillStarter ? "✓ No starting utility" : "No starting utility");
  none.dataset.shipStarter = "stock"; none.setAttribute("aria-pressed", String(!save.spillStarter));
  uiState(none, !save.spillStarter ? "selected" : "available");
  none.onclick = () => { onPick(); engine.spillStarter(null); }; wrap.append(none);
  const choices = el("div", "ac-starting-options");
  for (const id of SPILL_UTILITY_IDS) {
    const u = SPILL_UTILITIES[id], earned = save.spillBest >= u.unlock, selected = save.spillStarter === id;
    const b = el("button", `ac-starter-option mwr-option${selected ? " on" : ""}`), text = el("span", "ac-starter-text");
    b.dataset.shipStarter = id; b.title = u.detail; b.disabled = !earned; b.setAttribute("aria-pressed", String(selected));
    uiState(b, !earned ? "locked" : selected ? "selected" : "available");
    text.append(el("b", "", u.name), el("span", "", id === "capacitor" ? "Extra Pulse charge · needs Impact pulse." : u.desc), el("strong", "", !earned ? `Clear wave ${u.unlock}` : selected ? "✓ Selected for next run" : "Select · free"));
    b.append(spillUtilityArt(id), text); b.onclick = () => { onPick(); engine.spillStarter(id); }; choices.append(b);
  }
  wrap.append(choices); return wrap;
}

/** Earned choices change a tradeoff, not the wave requirements. */
export function drawSpillCareer(engine: Engine) {
  const section = el("section", "ac-career-options mwr-section"), trial = engine.spillTrial();
  const inRun = engine.world.screen === "play", loadout = inRun ? engine.world.spill!.loadout : engine.save.spillCareer;
  section.setAttribute("aria-label", "Starting ship and weapon module");
  section.append(el("h3", "", "Ship & weapon tuning"),
    el("p", "ac-workshop-note", trial ? "Try every sidegrade here. Trial choices do not change your next real run." : "Earn options by clearing waves. Each has a tradeoff. Choices apply at the start of a run."));
  for (const [kind, title, choices, pick] of [
    ["chassis", "Chassis", SPILL_CHASSIS, (id: string) => engine.spillSelectChassis(id as typeof SPILL_CHASSIS[number]["id"])],
    ["module", "Weapon module", SPILL_WEAPON_MODULES, (id: string) => engine.spillSelectWeaponModule(id as typeof SPILL_WEAPON_MODULES[number]["id"])],
  ] as const) {
    const group = el("div", "ac-career-group"); group.setAttribute("role", "group"); group.setAttribute("aria-label", title);
    group.append(el("h4", "", title));
    const grid = el("div", "ac-career-grid");
    for (const choice of choices) {
      const selected = (loadout?.[kind] ?? "standard") === choice.id;
      const earned = !!trial || engine.save.spillBest >= choice.unlock;
      const button = el("button", `ac-career-choice mwr-option${selected ? " on" : ""}`);
      button.type = "button"; button.dataset.careerChoice = `${kind}-${choice.id}`;
      button.disabled = !earned; button.setAttribute("aria-pressed", String(selected));
      uiState(button, !earned ? "locked" : selected ? "selected" : "available");
      button.append(el("b", "", choice.name), el("span", "", choice.detail),
        el("strong", "", !earned ? `Clear wave ${choice.unlock}` : selected ? "✓ Selected" : "Select · free"));
      button.onclick = () => pick(choice.id); grid.append(button);
    }
    group.append(grid); section.append(group);
  }
  return section;
}
export function drawSpillEnginePicker(engine: Engine) {
  const chosen = spillEngineColor(engine.save), wrap = el("section", "ac-engine-picker mwr-section"), head = el("div", "ac-workshop-sectionhead");
  head.append(el("h3", "", `Engine color: ${chosen.name}`), el("span", "", "Appearance only")); wrap.append(head);
  const colors = el("div", "ac-engine-colors");
  for (const color of SPILL_ENGINE_COLORS) {
    const selected = color.id === chosen.id, earned = engine.save.spillBest >= color.at;
    const b = el("button", `ac-engine-color${selected ? " on" : ""}`), swatch = el("i", "ac-engine-swatch");
    b.dataset.shipColor = color.id; b.disabled = !earned; b.setAttribute("aria-pressed", String(selected));
    uiState(b, !earned ? "locked" : selected ? "selected" : "available");
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
  const save = engine.save, wrap = el("div", "ac-spillprep ac-spillsetup mwr-panel");
  const head = el("header", "ac-setup-head"), heading = el("div");
  heading.append(el("p", "ac-kicker", "THE SPILL · FLIGHT BRIEFING"), el("h2", "", "How to fly"));
  const help = el("button", "ac-helpdot", "?"); help.dataset.spillControl = "setup-guide";
  help.setAttribute("aria-label", "How the Depot works"); help.onclick = onGuide;
  head.append(heading, help); wrap.append(head);
  const body = el("div", "ac-setup-body");
  body.append(flightControlCards(), harderKickNote());
  const loop = el("ol", "ac-setup-loop"); loop.setAttribute("aria-label", "The run");
  for (const [text, withCoin] of [["Survive the waves", false], ["Collect Salvage", true], ["Depot every 5 waves · upgrade your ship · first upgrade free", false]] as const) {
    const step = el("li"); if (withCoin) step.append(coin()); step.append(el("span", "", text)); loop.append(step);
  }
  const stage = el("div", "ac-launch-ship");
  stage.append(shipPreview(engine, { plating: 0, thrusters: 0, pulse: 0, shield: 0, utilities: save.spillStarter ? [save.spillStarter] : [] }, 104, -10000, 2.5), el("b", "ac-launch-pilot", "Flight systems ready"));
  body.append(loop, stage); wrap.append(body);
  const actions = el("div", "ac-workshop-actions"), back = el("button", "ac-ghost ac-workshop-exit", "MAIN MENU"), go = el("button", "ac-primary ac-workshop-launch", "START RUN");
  back.onclick = () => engine.open("title"); go.dataset.spillControl = "land";
  go.onclick = () => {
    // the briefing has been shown: the save says so, and nothing repeats it
    if (!engine.spillTrial() && !save.spillDepotGuideSeen) { save.spillDepotGuideSeen = true; writeSave(save); }
    engine.spillLunge();
  };
  actions.append(back, go); wrap.append(actions); return wrap;
}

export type DepotView = { key: string; part: System; extras: boolean; specialties: boolean; builds: boolean; forecast: boolean; risk: boolean; guide: boolean; swap: SpillUtility | null; receipt: string; flashAt: number; openedAt: number; picked: boolean };
export const createDepotView = (): DepotView => ({ key: "", part: "plating", extras: false, specialties: false, builds: false, forecast: false, risk: false, guide: false, swap: null, receipt: "", flashAt: -10000, openedAt: performance.now(), picked: false });
/** THE FREE-PICK NUDGE (owner, 26 Sep 2026: "after a few seconds a pulsing ring
 *  around the free button and arrows to each of the upgraded options to help
 *  prompt a selection pick and clear selection route"). It waits this long
 *  after the pre-flight Depot opens. */
export const DEPOT_HINT_MS = 3000;
function drawDepotGuide(engine: Engine, onClose: () => void, closeLabel: string) {
  const sheet = el("section", "ac-lvlcard ac-depotcard ac-depotguidecard mwr-panel");
  sheet.setAttribute("role", "dialog"); sheet.setAttribute("aria-modal", "true"); sheet.setAttribute("aria-label", "How the Depot works"); sheet.tabIndex = -1;
  const inRun = engine.world.screen === "play", goal = inRun ? engine.world.lvl?.def.spillFinish : null;
  const objective = engine.spillTrial() ? "Clear this encounter. Trial progress is not saved." : goal ? goal.kind === "ore" ? `Collect ${goal.n} Salvage.` : `Visit ${goal.n} depots.`
    : inRun && engine.world.spill?.target ? `Survive ${engine.world.spill.target} waves.` : "Clear waves. Beat your best.";
  sheet.append(el("p", "ac-kicker", "THE SPILL · DEPOT GUIDE"), el("h2", "", "How the Depot works"), el("p", "ac-workshop-note", objective));
  const collect = el("div", "ac-guide-collect"), words = el("div");
  words.append(el("h3", "", "Collect Salvage"), el("p", "", "Buy upgrades here. First one free.")); collect.append(coin(), words); sheet.append(collect);
  const effects = el("div", "ac-guide-systems");
  for (const [id, name, effect] of [["plating", "Health", "More health"], ["shield", "Shields", "Block hits"], ["thrusters", "Thrusters", "Sharper steering"], ["pulse", "Pulse", "Charged blast"]] as const) {
    const item = el("div"); item.dataset.system = id; item.append(systemIcon(id), el("b", "", name), el("span", "", effect)); effects.append(item);
  }
  sheet.append(effects, el("p", "ac-guide-services", "Repair · full health   |   Extra life · revive once"));
  // Utilities are the wave-5 shelf, not the first decision: one compact row,
  // art and a short name, after the systems (owner: "not the most important
  // thing to understand").
  const title = el("div", "ac-workshop-sectionhead ac-guide-utilityhead"); title.append(el("h3", "", "Utilities"), el("span", "", "From the wave 5 Depot · fit 2")); sheet.append(title);
  const kit = el("div", "ac-guide-utilityrow");
  for (const id of SPILL_UTILITY_IDS) {
    const u = SPILL_UTILITIES[id], item = el("div"); item.dataset.guideUtility = id; item.title = displayText(`${u.name} · ${u.guide}`);
    item.append(spillUtilityArt(id), el("b", "", u.short)); kit.append(item);
  }
  sheet.append(kit);
  sheet.append(hazardGuide());
  sheet.append(el("p", "ac-guide-services", "Rare artifacts: choose one after waves 5, 15, 25… Fit one at a time; refit free at a Depot."));
  const carry = el("div", "ac-guide-carry"), lost = el("div", "ac-guide-loss"), kept = el("div", "ac-guide-keep");
  lost.append(el("h3", "", "Out of lives"), el("p", "", "Wave 1. Salvage, upgrades & artifacts reset."));
  kept.append(el("h3", "", "Unlocks stay"), el("p", "", "Ship & weapon tuning, starting utilities and engine colors.")); carry.append(lost, kept); sheet.append(carry);
  const enter = el("button", "ac-primary ac-workshop-launch", closeLabel); enter.dataset.spillControl = "enter-depot";
  enter.onclick = onClose;
  sheet.append(enter, el("p", "ac-workshop-note ac-guide-timing", "Depot every 5 waves · No timer")); return sheet;
}

/** Informational replay: reading it changes no run state and no save field. */
export function drawSpillGuideSheet(engine: Engine, onClose: () => void, closeLabel: string) {
  const wrap = el("div", "ac-lvlsheet ac-depotwrap ac-workshop ac-spillhelpwrap");
  wrap.style.setProperty("--workshop-art", `url("${artUrl("space-ui/menu-background.webp")}")`);
  const sheet = drawDepotGuide(engine, onClose, closeLabel);
  sheet.querySelector(".ac-guide-collect")?.before(drawSpillFlightHelp(false));
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

/** The briefing and Help share the current touch and keyboard controls. */
function flightControlCards() {
  const controls = el("div", "ac-spillhelp-controls");
  for (const [input, action, note] of [
    ["HOLD + DRAG", "Steer up / down", "W / S or Up / Down"],
    ["SECOND FINGER", "Tap to shoot - hold to repeat", "F or Space"],
    ["FLICK LEFT / RIGHT", "Quick sideways dodge", "A / D or Left / Right"],
    ["RELEASE", "Ease to a stop", "Mouse: drag + F / Space"],
  ]) {
    const card = el("div", "mwr-control-card");
    card.dataset.control = String(controls.childElementCount + 1).padStart(2, "0");
    card.append(el("b", "", input), el("span", "", action), el("small", "ac-sub", note));
    controls.append(card);
  }
  return controls;
}
const harderKickNote = () => el("small", "ac-sub ac-spillhelp-extra", "Hold anywhere on the field: a faint stick follows your steering finger. While holding, tap elsewhere with another finger to fire. Aim assistance follows enemies close to your forward line - match their height. After pausing, press again to steer or fire.");

/** The same instructions in Settings & Help and the replayable briefing. */
export function drawSpillFlightHelp(includeHazards = true) {
  const section = el("section", "ac-spillflighthelp mwr-section");
  section.setAttribute("aria-label", "How to fly · The Spill");
  section.append(el("p", "ac-kicker ac-secthead", "HOW TO FLY · THE SPILL"), flightControlCards(), harderKickNote(),
    el("p", "ac-sub", "Depot every 5 waves · spend Salvage · first upgrade free."));
  if (includeHazards) section.append(hazardGuide());
  return section;
}

/** Shared rule metadata keeps the forecast and field guide aligned with admission. */
function hazardGuide() {
  const section = el("section", "ac-hazard-guide");
  section.setAttribute("aria-label", "Space hazard field guide");
  section.append(el("h3", "", "Read the field"));
  for (const id of SPILL_HAZARD_IDS) {
    const spec = SPILL_HAZARDS[id], row = el("div"); row.dataset.hazard = id;
    row.append(el("b", "", `${spec.name} · wave ${spec.unlock}+`), el("p", "", spec.teach));
    section.append(row);
  }
  section.append(el("p", "ac-workshop-note", "Warnings give you time to move. Later waves combine lessons; no particular weapon or artifact is required."));
  const elite = el("div"); elite.dataset.hazard = "warden";
  elite.append(el("b", "", "Warden · fifth-wave climaxes from wave 10"),
    el("p", "", "Leave its warned firing line, then fire while its shield opens. Defeating it earns salvage; surviving until it retreats also clears the encounter."));
  section.append(elite);
  return section;
}

function hazardForecast(engine: Engine, view: DepotView) {
  const sp = engine.world.spill!, details = el("details", "ac-hazard-forecast mwr-section");
  const trial = engine.spillTrial();
  const trialSpec = trial ? SPILL_TRIALS.find(item => item.id === trial.id)! : null;
  const end = trialSpec ? Math.min(sp.wave + 5, trialSpec.endWave ?? trialSpec.wave) : sp.wave + 5;
  details.dataset.spillControl = "hazard-forecast"; details.open = view.forecast;
  details.append(el("summary", "", trial ? "Trial forecast" : "Next five waves"));
  details.ontoggle = () => { if (details.isConnected) view.forecast = details.open; };
  const list = el("ol");
  for (let wave = sp.wave + 1; wave <= end; wave++) {
    const plan = spillHazardPlan(wave, sp.seed), event = spillEventFor(wave, sp.seed), row = el("li");
    row.dataset.spillForecastWave = String(wave);
    const names = plan.families.map(id => SPILL_HAZARDS[id].name);
    const label = (event !== "none" ? SPILL_EVENTS[event].name : names.join(" + ") || "Debris & flight practice")
      + (spillClimaxWave(wave) ? " + Warden" : "");
    row.append(el("b", "", `Wave ${wave}`), el("span", "", label));
    const advanced = plan.advanced || (sp.expedition.selected === "volatile"
      && !plan.families.some(id => SPILL_HAZARDS[id].unlock === wave));
    if (plan.families.length) row.append(el("small", "", plan.maxActive > 1 ? "Compatible pairs" : advanced ? "Advanced patterns · one at a time" : "One hazard at a time"));
    list.append(row);
  }
  details.append(list, el("p", "ac-workshop-note", "Forecast shows hazard families. Encounters wait for safe space; fifth-wave events have their own lanes."), hazardGuide());
  return details;
}

function riskSelection(engine: Engine, view: DepotView, arming: boolean, rerender: () => void) {
  const sp = engine.world.spill!, details = el("details", "ac-expedition-options mwr-section");
  details.open = view.risk; details.dataset.spillControl = "route-options";
  const selected = sp.expedition.selected;
  details.append(el("summary", "", `Next route · ${SPILL_RISKS[selected].name}`));
  details.ontoggle = () => { if (details.isConnected) view.risk = details.open; };
  details.append(el("p", "ac-workshop-note", `Optional risk for waves ${sp.wave + 1}–${sp.wave + 5}. No entry fee. Bonus is paid only if you clear the whole block.`));
  const choices = el("div", "ac-risk-grid");
  for (const id of Object.keys(SPILL_RISKS) as SpillRiskId[]) {
    const choice = SPILL_RISKS[id], button = el("button", `ac-risk-choice mwr-option${id === selected ? " on" : ""}`);
    button.dataset.spillControl = `risk-${id}`; button.disabled = arming;
    uiState(button, id === selected ? "selected" : arming ? "arming" : "available");
    button.setAttribute("aria-pressed", String(id === selected));
    button.append(el("b", "", choice.name), el("span", "", choice.detail),
      el("strong", "", choice.reward ? `+${choice.reward} Salvage on block clear` : "Standard rewards"));
    button.onclick = () => {
      if (!engine.spillSelectRisk(id)) { view.receipt = "Route unavailable"; rerender(); }
    };
    choices.append(button);
  }
  details.append(choices); return details;
}

/** Readable build identity and optional planning live at the Depot, away from flight input. */
function drawArtifactWorkshop(engine: Engine, view: DepotView, arming: boolean,
  feedback: (message: string) => void, rerender: () => void) {
  const sp = engine.world.spill!, build = sp.combat.build;
  const section = el("section", "ac-workshop-builds mwr-section");
  section.setAttribute("aria-label", "Ship build and artifacts");
  const active = build.artifact ? SPILL_ARTIFACTS[build.artifact] : null;
  const summary = el("div", "ac-build-summary");
  if (active) summary.style.setProperty("--artifact-color", active.color);
  summary.append(el("h3", "", active ? `${active.style} build` : "Your build"),
    el("p", "", `${SPILL_WEAPONS[sp.combat.weapon].name} ${sp.combat.levels[sp.combat.weapon]}/3 · ${active?.name ?? "No artifact fitted"}`));
  if (active) summary.append(el("p", "ac-build-effect", active.description));
  section.append(summary);

  const offers = spillArtifactOffers(sp);
  if (offers.length) {
    const recovery = el("section", "ac-artifact-recovery");
    recovery.append(el("h3", "", "Rare artifact recovered"),
      el("p", "ac-workshop-note", "Choose one free. It replaces your fitted artifact; recovered artifacts stay available for this run."));
    const cards = el("div", "ac-artifact-grid");
    for (const id of offers) {
      const artifact = SPILL_ARTIFACTS[id], card = artifactCard(id);
      const take = el("button", "ac-workshop-buy", "Recover & fit · free");
      take.dataset.spillControl = `artifact-claim-${id}`; take.disabled = arming;
      uiState(take, arming ? "arming" : "available");
      take.setAttribute("aria-label", `${artifact.name}: recover and fit free`);
      take.onclick = () => {
        feedback(`${artifact.name} recovered and fitted`);
        if (!engine.spillClaimArtifact(id)) { view.receipt = "Artifact unavailable"; rerender(); }
      };
      card.append(take); cards.append(card);
    }
    recovery.append(cards); section.append(recovery);
  } else if (!build.owned.length) {
    section.append(el("p", "ac-workshop-note", "Recover rare artifacts after waves 5, 15, 25… One fitted slot. Artifacts last this run."));
  } else if (build.owned.length < 3) {
    const next = sp.wave < 5 ? 5 : 5 + (Math.floor((sp.wave - 5) / 10) + 1) * 10;
    section.append(el("p", "ac-workshop-note", `Next artifact recovery after wave ${next}. Unclaimed choices expire when you launch.`));
  }

  if (build.owned.length) {
    const owned = el("section", "ac-artifact-owned");
    owned.append(el("h3", "", "Recovered this run"),
      el("p", "ac-workshop-note", "Fit one · swap free · remove to return to standard rounds"));
    const choices = el("div", "ac-artifact-grid");
    for (const id of build.owned) {
      const artifact = SPILL_ARTIFACTS[id], selected = build.artifact === id, card = artifactCard(id);
      if (selected) card.classList.add("fitted");
      uiState(card, selected ? "selected" : "available");
      const fit = el("button", `ac-workshop-buy${selected ? " fitted" : ""}`, selected ? "✓ Fitted · remove" : "Fit free");
      fit.dataset.spillControl = selected ? "artifact-remove" : `artifact-equip-${id}`;
      fit.disabled = arming; fit.setAttribute("aria-pressed", String(selected));
      uiState(fit, selected ? "selected" : arming ? "arming" : "available");
      fit.setAttribute("aria-label", `${artifact.name}: ${selected ? "remove" : "fit free"}`);
      fit.onclick = () => {
        feedback(`${artifact.name} ${selected ? "removed · refit free this run" : "fitted"}`);
        if (!engine.spillEquipArtifact(selected ? null : id)) { view.receipt = "Artifact unavailable"; rerender(); }
      };
      card.append(fit); choices.append(card);
    }
    owned.append(choices); section.append(owned);
  }

  const recipes = el("details", "ac-build-recipes"); recipes.open = view.builds;
  recipes.append(el("summary", "", "Build ideas · plan your upgrades"));
  recipes.ontoggle = () => { if (recipes.isConnected) view.builds = recipes.open; };
  const intro = el("p", "ac-workshop-note", "Suggestions only. Mix freely; buy and fit each item separately. Utilities arrive after wave 5; system specialties need tier II.");
  const grid = el("div", "ac-build-recipe-grid");
  for (const recipe of SPILL_BUILD_RECIPES) {
    const artifact = SPILL_ARTIFACTS[recipe.artifact], card = el("article", "ac-build-recipe");
    card.style.setProperty("--artifact-color", artifact.color);
    card.append(el("h4", "", recipe.name), el("p", "", recipe.description));
    const list = el("ul");
    const item = (name: string, state: string, fitted: boolean) => {
      const li = el("li"); if (fitted) li.classList.add("fitted");
      li.append(el("span", "", name), el("small", "", state)); list.append(li);
    };
    item(SPILL_WEAPONS[recipe.weapon].name, sp.combat.weapon === recipe.weapon ? "Fitted" : "Switch free", sp.combat.weapon === recipe.weapon);
    for (const id of recipe.utilities) {
      const fitted = sp.utilities.includes(id), owned = sp.ownedUtilities.includes(id);
      item(SPILL_UTILITIES[id].name, fitted ? "Fitted" : owned ? "Owned · fit free" : `${SPILL_UTILITIES[id].price} Salvage`, fitted);
    }
    for (const id of recipe.specialties) {
      const spec = SPILL_SPECIALTIES[id], fitted = sp.specialties[spec.axis] === id;
      item(spec.name, fitted ? "Fitted" : sp.up[spec.axis] >= 2 ? "Available · fit free" : `Needs ${SPILL_SHOP[spec.axis].name} II`, fitted);
    }
    item(artifact.name, build.artifact === recipe.artifact ? "Fitted" : build.owned.includes(recipe.artifact) ? "Recovered · fit free" : "Rare recovery", build.artifact === recipe.artifact);
    card.append(list); grid.append(card);
  }
  recipes.append(intro, grid); section.append(recipes);
  return section;
}

function artifactCard(id: SpillArtifactId) {
  const artifact = SPILL_ARTIFACTS[id], card = el("article", "ac-artifact-card mwr-option");
  card.dataset.artifact = id; card.style.setProperty("--artifact-color", artifact.color);
  card.append(el("span", "ac-artifact-style", artifact.style), el("h4", "", artifact.name),
    el("p", "", artifact.description), el("small", "", artifact.detail));
  return card;
}

export function drawDepotWorkshop(engine: Engine, view: DepotView, rerender: () => void) {
  const sp = engine.world.spill!, key = `${sp.seed}:${sp.wave}`;
  // The guide is behind the "?" only: the instructions sheet before the run
  // already taught the loop, and a Depot that opens a second sheet on
  // arrival hid the free upgrade behind it (owner, 10 Sep 2026).
  if (key !== view.key) Object.assign(view, createDepotView(), { key });
  const wrap = el("div", "ac-lvlsheet ac-depotwrap ac-workshop");
  wrap.style.setProperty("--workshop-art", `url("${artUrl("space-ui/menu-background.webp")}")`);
  if (view.guide) {
    wrap.append(drawDepotGuide(engine, () => { view.guide = false; rerender(); }, "BACK TO DEPOT"));
    return wrap;
  }
  const sheet = el("section", "ac-lvlcard ac-depotcard ac-workshop-card mwr-panel");
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
    uiState(b, arming ? "arming" : price === null ? "complete" : sp.welcome && (!sp.freeUpgrade || what === "repair" || what === "core")
      ? "locked" : price > sp.ore ? "unaffordable" : "available");
    const text = price === null ? what === "repair" ? "Full health" : what === "core" ? sp.coreArmed ? "Ready" : "Used" : "Full"
      : sp.welcome && !sp.freeUpgrade ? "Next stop" : price === 0 ? "Free" : String(price);
    if (label && price !== null) b.append(el("span", "", label));
    if (price !== null && price > 0 && !sp.welcome) b.append(coin()); b.append(el("span", "", text));
    b.setAttribute("aria-label", `${SPILL_SHOP[what].name}: ${price === null ? "complete" : price === 0 ? "free upgrade" : `${price} Salvage`}`);
    b.onclick = () => {
      feedback(what === "repair" ? "Health restored" : what === "core" ? "Extra life ready" : `${SPILL_SHOP[what].name} upgraded`);
      if (engine.spillBuy(what) !== "ok") { view.receipt = "Upgrade unavailable"; rerender(); }
    }; return b;
  };
  const head = el("header", "ac-workshop-head"), heading = el("div"), tools = el("div", "ac-workshop-headtools"), wallet = el("div", "ac-workshop-wallet");
  const trial = engine.spillTrial();
  heading.append(el("p", "ac-kicker", trial ? "PRACTICE · NO PROGRESS SAVED" : `THE SPILL · ${sp.welcome ? "PRE-FLIGHT" : `WAVE ${sp.wave} CLEARED`}`), el("h2", "", trial ? "Trial loadout" : sp.firstPass ? "First pass complete" : "Salvage depot"));
  wallet.setAttribute("aria-label", `${sp.ore} Salvage`); wallet.append(coin(), el("b", "", String(sp.ore)), el("span", "mwr-wallet-label", "SALVAGE"));
  const guide = el("button", "ac-helpdot", "?"); guide.setAttribute("aria-label", "How the Depot works"); guide.dataset.spillControl = "guide"; guide.onclick = () => { view.guide = true; rerender(); };
  tools.append(wallet, guide); head.append(heading, tools); sheet.append(head);
  if (sp.firstPass && !trial) sheet.append(el("p", "ac-workshop-milestone", "Wave 20 complete. Victory recorded. Keep your ship and fly on."));
  const layout = el("div", "mwr-depot-layout"), bay = el("div", "mwr-depot-bay"), outfitting = el("div", "mwr-depot-outfitting");
  layout.append(bay, outfitting); sheet.append(layout);
  const status = el("div", "ac-workshop-status"), health = el("div", "ac-workshop-health"), healthText = el("span"), healthBar = el("progress");
  healthText.append(systemIcon("plating"), el("b", "", "Health"), el("span", "", `${sp.hull} / ${sp.maxHull}`));
  healthBar.max = sp.maxHull; healthBar.value = sp.hull; healthBar.setAttribute("aria-label", `${sp.hull} of ${sp.maxHull} health`); health.append(healthText, healthBar);
  const shields = el("div", "ac-workshop-shields"); shields.append(systemIcon("shield"), el("span", "", `Shields ${sp.shield} / 2`));
  status.append(health, shields); if (!sp.welcome) status.append(priceButton("repair", "Repair")); bay.append(status);
  if (sp.welcome) bay.append(el("p", "ac-workshop-free", sp.freeUpgrade ? "Choose one free upgrade" : "✓ Upgrade fitted · ready to launch"));
  const stage = el("div", "ac-workshop-stage"); stage.append(shipPreview(engine, spillBuildFromState(sp), 192, view.flashAt));
  // the arrows point at the four options until the pilot taps one of them
  if (hinting && !view.picked) stage.classList.add("ac-workshop-hint-arrows");
  const links = document.createElementNS("http://www.w3.org/2000/svg", "svg"); links.classList.add("ac-workshop-links"); links.setAttribute("viewBox", "0 0 344 192"); links.setAttribute("aria-hidden", "true");
  const paths = { plating: "M 97 36 L 119 36 L 153 85", shield: "M 252 36 L 235 36 L 214 82", thrusters: "M 90 165 L 104 130 L 110 119", pulse: "M 255 164 L 260 138 L 252 121" };
  for (const id of systems) {
    const path = document.createElementNS(links.namespaceURI, "path"); path.setAttribute("d", paths[id]); path.setAttribute("data-system", id); links.append(path);
    const b = el("button", `ac-workshop-system${view.part === id ? " selected" : ""}`); b.dataset.system = id; b.dataset.spillControl = `inspect-${id}`;
    uiState(b, view.part === id ? "selected" : "available");
    b.setAttribute("aria-pressed", String(view.part === id));
    const name = el("span", "ac-workshop-systemname"), price = spillPrice(sp, id);
    name.append(systemIcon(id), el("b", "", SPILL_SHOP[id].name));
    const cost = el("span", "ac-workshop-systemprice", price === null ? "Full" : sp.welcome && !sp.freeUpgrade ? "Next stop" : price === 0 ? "Free" : String(price));
    if (price && !sp.welcome) cost.append(coin()); b.append(name, cost);
    b.onclick = () => { view.part = id; view.specialties = false; view.picked = true; rerender(); }; stage.append(b);
  }
  stage.append(links); bay.append(stage);
  const part = view.part, tier = part === "shield" ? sp.shield : sp.up[part], max = part === "shield" ? 2 : 3;
  const selection = el("section", "ac-workshop-selection"), words = el("div", "ac-workshop-selectiontext"); selection.dataset.system = part;
  words.append(el("h3", "", `${SPILL_SHOP[part].name}${part === "plating" ? " upgrade" : ""}`), el("p", "", part === "shield"
    ? tier >= max ? "Two shields ready" : `Blocks one hit · ${tier} → ${tier + 1} shields`
    : tier >= max ? "Fully upgraded" : part === "plating" ? `Max health ${sp.maxHull} → ${sp.maxHull + 1}` : SPILL_SHOP[part].levels[tier]));
  const take = priceButton(part);
  // the ring marks the one button that fits the free upgrade
  if (hinting) take.classList.add("ac-workshop-hint-ring");
  selection.append(systemIcon(part), words, take); bay.append(selection);
  const price = spillPrice(sp, part);
  if (!sp.welcome && price !== null && price > sp.ore) bay.append(el("p", "ac-workshop-need", `${price - sp.ore} more Salvage needed`));
  if (!sp.welcome && part !== "shield" && tier >= 2) {
    const details = el("details", "ac-workshop-specialties"); details.open = view.specialties; details.append(el("summary", "", "Customize this upgrade · free"));
    details.ontoggle = () => { if (details.isConnected) view.specialties = details.open; };
    const choices = el("div", "ac-spilloptions");
    for (const [id, spec] of Object.entries(SPILL_SPECIALTIES).filter(([, spec]) => spec.axis === part)) {
      const selected = sp.specialties[part] === id, b = el("button", `ac-spilloption mwr-option${selected ? " selected" : ""}`);
      b.dataset.spillControl = id; b.disabled = arming; b.setAttribute("aria-pressed", String(selected));
      uiState(b, selected ? "selected" : arming ? "arming" : "available");
      b.append(el("b", "", spec.name), el("span", "", spec.desc), el("strong", "", selected ? "✓ Fitted" : "Fit free"));
      b.onclick = () => { feedback(`${spec.name} fitted`); engine.spillSpecialize(id as SpillSpecialty); }; choices.append(b);
    }
    details.append(choices); bay.append(details);
  }
  // Weapons are a separate choice: fitting either never spends the opening system upgrade.
  const weapons = el("section", "ac-workshop-weapons mwr-section"), weaponHead = el("div", "ac-workshop-sectionhead");
  weaponHead.append(el("h3", "", "Weapons"), el("span", "", "Switch free · upgrades last this run"));
  weapons.append(weaponHead);
  const weaponGrid = el("div", "ac-workshop-weapongrid");
  for (const id of Object.keys(SPILL_WEAPONS) as SpillWeaponId[]) {
    const spec = SPILL_WEAPONS[id], level = sp.combat.levels[id], selected = sp.combat.weapon === id;
    const stats = spillWeaponStats(sp, id);
    const card = el("section", `ac-workshop-weapon mwr-option${selected ? " fitted" : ""}`);
    uiState(card, selected ? "selected" : "available");
    card.append(el("h4", "", spec.name), el("p", "", spec.description),
      el("strong", "ac-weapon-stats", `Tier ${level}/3 · ${stats.damage} damage · ${(1 / stats.cooldown).toFixed(1)}/sec`));
    const fit = el("button", "ac-workshop-buy", selected ? "Equipped" : "Equip free");
    fit.dataset.spillControl = `weapon-${id}`;
    fit.setAttribute("aria-pressed", String(selected));
    fit.setAttribute("aria-label", `${spec.name}: ${selected ? "equipped" : "equip free"}`);
    fit.disabled = arming || selected;
    uiState(fit, selected ? "selected" : arming ? "arming" : "available");
    fit.onclick = () => {
      feedback(`${spec.name} equipped`);
      if (!engine.spillSelectWeapon(id)) { view.receipt = "Weapon unavailable"; rerender(); }
    };
    card.append(fit); weaponGrid.append(card);
  }
  weapons.append(weaponGrid);
  const weaponPrice = spillWeaponPrice(sp), weaponName = SPILL_WEAPONS[sp.combat.weapon].name;
  const upgradeRow = el("div", "ac-workshop-weaponupgrade"), upgrade = el("button", "ac-workshop-buy");
  upgrade.dataset.spillControl = "weapon-upgrade";
  upgrade.disabled = arming || weaponPrice === null || weaponPrice > sp.ore;
  uiState(upgrade, arming ? "arming" : weaponPrice === null ? "complete" : weaponPrice > sp.ore ? "unaffordable" : "available");
  upgrade.setAttribute("aria-label", `${weaponName}: ${weaponPrice === null ? "fully upgraded" : `upgrade for ${weaponPrice} Salvage`}`);
  if (weaponPrice !== null) upgrade.append(coin());
  upgrade.append(el("span", "", weaponPrice === null ? "Max tier" : String(weaponPrice)));
  upgradeRow.append(el("span", "", weaponPrice === null ? `${weaponName} fully upgraded` : `Upgrade ${weaponName}`), upgrade);
  upgrade.onclick = () => {
    feedback(`${weaponName} upgraded`);
    if (!engine.spillUpgradeWeapon()) { view.receipt = "Weapon upgrade unavailable"; rerender(); }
  };
  weapons.append(upgradeRow, el("p", "ac-workshop-note", sp.welcome
    ? "Second-finger tap or F / Space fires. Choose your free ship-system upgrade separately."
    : "Second-finger tap or F / Space fires. Weapon upgrades stay with this run."));
  outfitting.append(weapons);
  outfitting.append(drawArtifactWorkshop(engine, view, arming, feedback, rerender));
  if (sp.welcome || trial) outfitting.append(drawSpillCareer(engine));
  if (!sp.welcome && sp.wave >= 5 && (!trial || SPILL_TRIALS.find(item => item.id === trial.id)?.endWave)) {
    outfitting.append(riskSelection(engine, view, arming, rerender));
  }
  outfitting.append(hazardForecast(engine, view));
  // Utilities arrive after wave 5; the original four core hardpoints stay unchanged.
  if (!sp.welcome) {
    const shelf = el("section", "ac-workshop-utilities mwr-section"), shelfHead = el("div", "ac-workshop-sectionhead"), slots = el("div", "ac-workshop-slots");
    shelfHead.append(el("h3", "", `Utilities · ${sp.utilities.length} / 2 fitted`), el("span", "", sp.welcome ? "Buy after wave 5" : "Buy once this run · refit free")); shelf.append(shelfHead);
    for (let i = 0; i < 2; i++) {
      const id = sp.utilities[i], slot = el("span", id ? "fitted" : ""); if (id) slot.append(spillUtilityArt(id));
      slot.append(el("span", "", id ? SPILL_UTILITIES[id].name : `Empty slot ${i + 1}`)); slots.append(slot);
    }
    shelf.append(slots);
    const utilityGrid = el("div", "ac-workshop-utilitygrid");
    for (const id of SPILL_UTILITY_IDS) {
      const u = SPILL_UTILITIES[id], fitted = sp.utilities.includes(id), owned = sp.ownedUtilities.includes(id);
      const card = el("article", `ac-workshop-utility mwr-option${fitted ? " fitted" : ""}`), name = el("div", "ac-workshop-utilityname");
      uiState(card, fitted ? "selected" : !owned && sp.ore < u.price ? "unaffordable" : "available");
      card.title = u.detail; name.append(spillUtilityArt(id), el("h4", "", u.name)); card.append(name, el("p", "", u.desc));
      if (id === "capacitor" && !sp.up.pulse) card.append(el("small", "ac-workshop-requirement", "Needs Impact pulse"));
      const buy = el("button", `ac-workshop-buy${fitted ? " fitted" : ""}`); buy.dataset.spillControl = id;
      buy.disabled = arming || !!sp.welcome || (!fitted && !owned && sp.ore < u.price);
      uiState(buy, fitted ? "selected" : arming ? "arming" : sp.welcome ? "locked" : !owned && sp.ore < u.price ? "unaffordable" : "available");
      buy.setAttribute("aria-label", `${fitted ? "Remove" : "Fit"} ${u.name}${!owned ? ` for ${u.price} Salvage` : ""}`);
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
    outfitting.append(shelf);
  }
  if (!sp.welcome) {
    const extras = el("details", "ac-workshop-extras mwr-section"); extras.open = view.extras; extras.append(el("summary", "", "Extra life & bonus goals"));
    extras.ontoggle = () => { if (extras.isConnected) view.extras = extras.open; };
    const life = el("div", "ac-workshop-service"), text = el("div"); text.append(el("b", "", "Extra life"), el("p", "", sp.coreBought ? sp.coreArmed ? "Ready · revive once" : "Used this run" : "Revive once with full health"));
    life.append(systemIcon("core"), text, priceButton("core")); extras.append(life, el("p", "ac-workshop-note", `Choose one bonus goal · waves ${sp.wave + 1}–${sp.wave + 5}`));
    if (sp.contract) extras.append(el("p", "ac-workshop-contract", spillContractProgress(sp)));
    else for (const offer of spillContractOffers(sp.wave)) {
      const b = el("button", "ac-workshop-contract-option"), text = el("span"); b.disabled = arming; b.dataset.spillControl = `contract-${offer.kind}`;
      uiState(b, arming ? "arming" : "available");
      text.append(el("b", "", offer.name), el("span", "", offer.desc)); b.append(text, el("strong", "", `+${offer.reward} Salvage`));
      b.onclick = () => { feedback(`${offer.name} selected`); engine.spillContract(offer.kind); }; extras.append(b);
    }
    outfitting.append(extras);
  }
  if (sp.contractMessage) outfitting.append(el("p", "ac-workshop-contract", sp.contractMessage));
  const footer = el("footer", "ac-workshop-footer"), actions = el("div", "ac-workshop-actions");
  const receipt = el("p", "ac-workshop-receipt", view.receipt || (trial ? "Practice loadout · changes stay in this trial" : sp.welcome ? "One free upgrade before takeoff"
    : spillArtifactOffers(sp).length ? "Rare artifact recovered · choose one before launch" : "Take your time · next depot in 5 waves"));
  receipt.setAttribute("aria-live", "polite"); footer.append(receipt);
  if (trial) {
    const exit = el("button", "ac-ghost ac-workshop-exit", "END TRIAL");
    exit.dataset.spillControl = "end-trial"; exit.onclick = () => engine.spillEndTrial(); actions.append(exit);
  } else if (!sp.target) {
    const save = el("button", "ac-ghost ac-workshop-exit", "SAVE & EXIT"); save.disabled = arming; save.dataset.spillControl = "save"; save.onclick = () => engine.spillSuspend(); actions.append(save);
  }
  const go = el("button", "ac-primary ac-workshop-launch", sp.welcome && sp.freeUpgrade ? "CHOOSE FREE UPGRADE" : `LAUNCH WAVE ${sp.welcome ? 1 : sp.wave + 1}`);
  go.disabled = arming || !!(sp.welcome && sp.freeUpgrade); go.dataset.spillControl = "launch"; go.onclick = () => engine.spillLeaveDepot();
  uiState(go, arming ? "arming" : sp.welcome && sp.freeUpgrade ? "locked" : "available");
  actions.append(go); footer.append(actions); sheet.append(footer); wrap.append(sheet); return wrap;
}
