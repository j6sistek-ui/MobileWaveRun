import { createEngine, type Engine } from "./engine";
import { loadSpillScene } from "./art";
import { paintShipPreview } from "./draw";
import { spillControlArt, SPILL_CONTROL_LAYOUT } from "./spill-control-art";
import { SPILL_UTILITIES, spillMastery } from "./spill-content";
import { spillBuildFromState, type SpillBuild } from "./spill-presentation";
import { restoreSpill, type SpillState } from "./spill";
import { createDepotView, drawDepotWorkshop, drawSpillLaunchSetup, drawSpillStarters,
  drawSpillEnginePicker, drawSpillFlightHelp, drawSpillGuideSheet } from "./spill-workshop";

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = "", text = "") => {
  const node = document.createElement(tag);
  node.className = cls;
  node.textContent = text;
  return node;
};

/** Spill-only navigation. The original engine still owns the clock, gestures,
 * rendering, checkpoints and purchases; this host only composes its screens. */
export async function bootStandalone(root: HTMLElement) {
  document.body.classList.add("ac-wide", "ac-beta");
  root.replaceChildren();
  root.className = "ac-root";
  const stage = el("div", "ac-stage");
  const canvas = el("canvas", "ac-canvas");
  const overlay = el("div", "ac-overlay");
  // Keep these outside the replaced overlay, exactly as in the upstream host.
  const controls = el("div", "ac-spillbar ac-spillcontrols");
  controls.hidden = true;
  controls.setAttribute("role", "group");
  controls.setAttribute("aria-label", "Debris Field flight controls");
  stage.append(canvas, overlay, controls);
  root.append(stage);
  const loading = el("section", "ac-sheet ac-center");
  loading.append(el("h1", "", "DEBRIS FIELD"), el("p", "ac-sub", "Loading the ship and field…"));
  overlay.append(loading);

  let engine: Engine;
  try {
    engine = await createEngine(canvas);
  } catch (error) {
    loading.replaceChildren(el("h2", "", "The game could not start"), el("p", "ac-sub", String(error)));
    loading.setAttribute("role", "alert");
    throw error;
  }
  (window as unknown as { __sandbox?: Engine }).__sandbox = engine;
  const depotView = createDepotView();
  let booting = true;
  let helpOpen = false;
  let confirmNew = false;
  let message = "";
  let lastScreen = "";

  function action(label: string, id: string, run: () => void, primary = false) {
    const button = el("button", primary ? "ac-primary" : "ac-ghost", label);
    button.type = "button";
    button.dataset.action = id;
    button.onclick = run;
    return button;
  }

  function home() {
    helpOpen = confirmNew = false;
    engine.open("title");
  }

  function startNew() {
    if (engine.save.spillSuspended) {
      confirmNew = true;
      render();
      return;
    }
    engine.fly("spill");
  }

  function resumeSaved() {
    if (!engine.spillResume()) {
      message = "This saved run could not be restored. You can start a new run.";
      render();
    }
  }

  function openHelp() { helpOpen = true; render(); }
  function closeHelp() {
    helpOpen = false;
    render();
    overlay.querySelector<HTMLElement>('[data-spill-control="setup-guide"], [data-action="depot-guide"]')?.focus({ preventScroll: true });
  }

  const thrust = el("button", "ac-thrust");
  const dive = el("button", "ac-dive");
  const lunge = el("button", "ac-lunge");
  for (const [kind, button] of [["dive", dive], ["thrust", thrust], ["lunge", lunge]] as const) {
    button.type = "button";
    button.innerHTML = spillControlArt(kind);
    const box = SPILL_CONTROL_LAYOUT[kind];
    button.style.left = `${box.x / SPILL_CONTROL_LAYOUT.width * 100}%`;
    button.style.top = `${box.y / SPILL_CONTROL_LAYOUT.height * 100}%`;
    button.style.width = `${box.width / SPILL_CONTROL_LAYOUT.width * 100}%`;
    button.style.height = `${box.height / SPILL_CONTROL_LAYOUT.height * 100}%`;
    for (const event of ["keydown", "keyup"] as const) button.addEventListener(event, e => {
      if (e.code === "Space" || e.code.startsWith("Arrow") || e.code === "Enter") e.stopPropagation();
    });
    button.addEventListener("contextmenu", e => e.preventDefault());
  }
  const lungeStatus = el("span", "ac-control-status");
  lunge.append(lungeStatus);
  thrust.setAttribute("aria-label", "Thrust: tap to fly");
  dive.setAttribute("aria-label", "Dive: downward burst");
  thrust.onpointerdown = e => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault(); engine.spillThrust(); updateControls();
  };
  thrust.onkeydown = e => {
    if (!["Space", "Enter"].includes(e.code)) return;
    e.preventDefault();
    if (e.repeat) return;
    engine.spillThrust(); updateControls();
  };
  thrust.onclick = e => { if (e.detail === 0) { engine.spillThrust(); updateControls(); } };
  dive.onclick = () => engine.spillDive();
  lunge.onclick = () => engine.spillLunge();
  controls.append(dive, thrust, lunge);

  let controlState = "";
  function updateControls() {
    const state = engine.world.spill;
    const visible = !!(engine.world.screen === "play" && state && !engine.save.spillButtonsOff
      && ["countdown", "wave", "drain"].includes(state.phase));
    const key = visible ? `${state.phase}:${state.manual}:${state.lungeCharges}:${state.up.thrusters}:${(state.thrustT ?? 0) > 0}` : "hidden";
    if (key === controlState) return;
    controlState = key;
    controls.hidden = !visible;
    if (!visible) return;
    const manual = state.phase !== "countdown" || state.manual;
    dive.disabled = !manual;
    lunge.disabled = !manual || state.lungeCharges <= 0;
    lunge.classList.toggle("spent", lunge.disabled);
    const cap = state.up.thrusters >= 2 ? 2 : 1;
    lungeStatus.textContent = state.lungeCharges ? `${state.lungeCharges}/${cap} READY` : "RECHARGING";
    lunge.setAttribute("aria-label", `Lunge: forward dash, ${state.lungeCharges} of ${cap} charges ready`);
    thrust.classList.toggle("firing", (state.thrustT ?? 0) > 0);
  }

  function sheet(title: string, subtitle = "") {
    const box = el("section", "ac-sheet ac-center ac-result");
    box.append(el("p", "ac-kicker", "DEBRIS FIELD"), el("h2", "", title));
    if (subtitle) box.append(el("p", "ac-sub", subtitle));
    return box;
  }

  function preview(build: SpillBuild) {
    const image = el("canvas", "ac-workshop-preview");
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    image.width = 344 * dpr; image.height = 180 * dpr;
    image.style.width = "min(344px, 100%)";
    image.style.height = "auto";
    image.setAttribute("role", "img");
    image.setAttribute("aria-label", "Ship with the selected equipment");
    const ctx = image.getContext("2d");
    if (ctx) {
      let last = -Infinity;
      const paint = (now: number) => {
        if (!image.isConnected) return;
        const reduced = engine.save.motionOff || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
        if (now - last >= 1000 / 30 - 1) {
          last = now;
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          ctx.clearRect(0, 0, 344, 180);
          paintShipPreview(ctx, engine.art, engine.save, 189, 90, 3.2, reduced ? 0 : now / 1000, build);
        }
        if (!reduced) requestAnimationFrame(paint);
      };
      requestAnimationFrame(paint);
    }
    return image;
  }

  function nextBuild(): SpillBuild {
    return { plating: 0, thrusters: 0, pulse: 0, shield: 0,
      utilities: engine.save.spillStarter ? [engine.save.spillStarter] : [] };
  }

  function drawHome() {
    const box = sheet("DEBRIS FIELD", "Survive the waves. Collect Acorn Coins. Build your ship at the Depot.");
    box.append(preview(nextBuild()));
    const saved = restoreSpill(engine.save.spillSuspended, engine.world.W, engine.world.H);
    if (saved) box.append(action(`RESUME RUN · WAVE ${saved.wave} DEPOT`, "resume-run", resumeSaved, true));
    box.append(action("NEW RUN", "new-run", startNew, !saved));
    box.append(action("SHIP PLANNING", "ship", () => engine.open("hangar")),
      action("CONTROLS", "controls", () => engine.open("help")),
      action("SETTINGS", "settings", () => engine.open("profile")));
    const mastery = spillMastery(engine.save.spillBest);
    box.append(el("p", "ac-gold", mastery.current.title),
      el("p", "ac-sub", `Best wave ${engine.save.spillBest} · Best salvage ${engine.save.spillRecords?.bestScore ?? 0}`));
    if (message) {
      const note = el("p", "ac-sub", message);
      note.setAttribute("role", "alert"); box.append(note);
    }
    return box;
  }

  function drawShip() {
    const box = sheet("Ship planning", "These choices apply to your next run. Buy upgrades at the Depot.");
    box.append(preview(nextBuild()), drawSpillStarters(engine), drawSpillEnginePicker(engine));
    const saved = restoreSpill(engine.save.spillSuspended, engine.world.W, engine.world.H);
    if (saved) {
      box.append(el("h3", "", `Saved ship · wave ${saved.wave} Depot`), preview(spillBuildFromState(saved)),
        el("p", "ac-sub", `Health ${saved.hull}/${saved.maxHull} · ${saved.ore} Acorn Coins. Your saved build is unchanged.`));
    }
    box.append(action("MAIN MENU", "home", home));
    return box;
  }

  function toggle(id: string, label: string, detail: string, on: boolean, change: () => void) {
    const button = el("button", "ac-spillsetting");
    button.type = "button"; button.dataset.setting = id;
    button.setAttribute("role", "switch"); button.setAttribute("aria-label", label);
    button.setAttribute("aria-checked", String(on));
    const text = el("span"); text.append(el("b", "", label), el("small", "", detail));
    button.append(text, el("strong", "", on ? "ON" : "OFF"));
    button.onclick = change;
    return button;
  }

  function flightSettings() {
    const settings = el("section", "ac-spillsettings");
    settings.append(el("h3", "", "Flight controls"));
    settings.append(toggle("buttons", "On-screen buttons", "Thrust, Dive and Lunge. Taps and swipes also work.",
      !engine.save.spillButtonsOff, () => engine.setSpillButtonsOff(!engine.save.spillButtonsOff)));
    const prompts = toggle("prompts", "Instructional prompts",
      engine.save.helpOff ? "Help is disabled in Settings." : "Control tips and wave lessons. Hazard warnings stay visible.",
      !engine.save.spillPromptsOff && !engine.save.helpOff, () => engine.setSpillPromptsOff(!engine.save.spillPromptsOff));
    prompts.disabled = !!engine.save.helpOff;
    settings.append(prompts);
    return settings;
  }

  function drawSettings() {
    const box = sheet("Settings");
    const settings = el("section", "ac-spillsettings");
    settings.append(toggle("music", "Music", "The score under menus and flight", !engine.save.musicOff,
      () => engine.setMusicOff(!engine.save.musicOff)),
      toggle("sound", "Sound effects", "Thrusters, pickups and hits", !engine.save.sfxOff,
        () => engine.setSfxOff(!engine.save.sfxOff)),
      toggle("help", "Help prompts", "Control tips and wave lessons", !engine.save.helpOff,
        () => engine.setHelpOff(!engine.save.helpOff)),
      toggle("motion", "Menu animation", "Pulses, fades and moving badges", !engine.save.motionOff,
        () => engine.setMotionOff(!engine.save.motionOff)),
      toggle("glow", "Character glow", "The flash and recoil on a tap", !engine.save.glowOff,
        () => engine.setGlowOff(!engine.save.glowOff)));
    box.append(settings, flightSettings(), action("MAIN MENU", "home", home));
    return box;
  }

  function drawPause() {
    const state = engine.world.spill!;
    const box = sheet("PAUSED", `WAVE ${state.wave} · ${state.ore} ACORN COINS`);
    box.classList.add("ac-pause");
    box.append(flightSettings());
    const actions = el("div", "ac-pauseact");
    actions.append(action("RESUME", "resume", () => engine.resume(), true),
      action("ABORT TO TITLE", "home", home));
    box.append(actions);
    return box;
  }

  function drawResults(state: SpillState) {
    const box = sheet(state.cause === "GROUNDED" ? "OUT OF HEALTH" : "LOST TO THE FIELD");
    const big = el("div", "ac-crashscore");
    big.append(el("b", "", String(state.cleared)), el("span", "", state.cleared === 1 ? "WAVE CLEARED" : "WAVES CLEARED"));
    box.append(big);
    if (engine.world.lastRun?.best && state.cleared > 0) box.append(el("p", "ac-gold", "NEW BEST"));
    if (state.cause === "GROUNDED") box.append(el("p", "ac-sub", "You ran out of health at the lower edge."));
    const rows = el("div", "ac-rows ac-crashrows");
    for (const [label, value] of [
      ["Salvage score", Math.floor(state.score)], ["Acorn Coins mined", state.oreMined],
      ["Contracts completed", state.contractsDone], ["Health hits", state.hits],
      ["Grazes", state.grazes], ["Debris shattered", state.shattered],
      ["Best wave", engine.save.spillBest], ["Best salvage score", engine.save.spillRecords?.bestScore ?? 0],
    ] as const) {
      const row = el("div", "ac-row");
      row.append(el("span", "", label), el("span", "ac-rowgold", String(value))); rows.append(row);
    }
    const mastery = spillMastery(engine.save.spillBest);
    box.append(rows, el("p", "ac-sub", `LAST RUN · Health upgrades ${state.up.plating} · Thrusters ${state.up.thrusters} · Pulse ${state.up.pulse}`),
      el("p", "ac-sub", state.utilities.map(id => SPILL_UTILITIES[id].name).join(" + ") || "Stock utilities"),
      el("p", "ac-gold", mastery.current.title),
      el("p", "ac-sub", mastery.next ? `Next: clear wave ${mastery.next.at} for ${mastery.next.title} and a new engine color.` : "Every engine color earned. Beat your best wave."),
      action("FLY AGAIN", "new-run", startNew, true), action("MAIN MENU", "home", () => engine.dismissDead()));
    return box;
  }

  function confirmSheet() {
    const wrap = el("div", "ac-lvlsheet");
    const card = el("section", "ac-lvlcard ac-center");
    card.setAttribute("role", "dialog"); card.setAttribute("aria-modal", "true");
    card.setAttribute("aria-label", "Replace saved run");
    card.append(el("h2", "", "Start a new run?"), el("p", "ac-sub", "This replaces your saved Depot run. Your records and earned starting utilities stay."),
      action("KEEP SAVED RUN", "cancel-new-run", () => { confirmNew = false; render(); }, true),
      action("START NEW RUN", "confirm-new-run", () => { confirmNew = false; engine.fly("spill"); }));
    wrap.append(card);
    wrap.addEventListener("keydown", e => {
      if (e.key !== "Tab") return;
      const buttons = [...card.querySelectorAll<HTMLButtonElement>("button")];
      const next = e.shiftKey ? buttons[buttons.length - 1] : buttons[0];
      if ((!e.shiftKey && document.activeElement === buttons[buttons.length - 1])
          || (e.shiftKey && document.activeElement === buttons[0])) {
        e.preventDefault(); next.focus();
      }
    });
    return wrap;
  }

  function render() {
    if (booting) return;
    const state = engine.world.spill;
    const screen = engine.world.screen;
    updateControls();
    const oldGuide = !!overlay.querySelector(".ac-depotguidecard");
    const scroll = overlay.querySelector(".ac-depotcard, .ac-setup-body, .ac-result")?.scrollTop ?? 0;
    const active = document.activeElement as HTMLElement | null;
    const focusKey = ["spillControl", "shipStarter", "shipColor", "action", "setting"]
      .find(key => active?.dataset[key]);
    const focusValue = focusKey ? active!.dataset[focusKey] : "";
    const sameScreen = lastScreen === `${screen}:${state?.phase ?? ""}`;
    lastScreen = `${screen}:${state?.phase ?? ""}`;
    if (screen !== "help" && !(screen === "play" && state?.phase === "ready")) helpOpen = false;
    if (screen !== "title") confirmNew = false;
    overlay.replaceChildren();
    if (screen === "play" && state) {
      const bar = el("div", "ac-playbar");
      const pause = action("II", "pause", () => engine.pause());
      pause.className = "ac-iconbtn"; pause.setAttribute("aria-label", "Pause");
      bar.append(pause); overlay.append(bar);
      if (state.phase === "depot") overlay.append(drawDepotWorkshop(engine, depotView, render));
      else if (state.phase === "ready") overlay.append(drawSpillLaunchSetup(engine, openHelp));
    } else if (screen === "pause" && state) overlay.append(drawPause());
    else if (screen === "dead" && state) overlay.append(drawResults(state));
    else if (screen === "hangar") overlay.append(drawShip());
    else if (screen === "profile") overlay.append(drawSettings());
    else if (screen === "help") {
      const box = sheet("Controls");
      box.append(drawSpillFlightHelp(), action("HOW THE DEPOT WORKS", "depot-guide", openHelp), action("MAIN MENU", "home", home));
      overlay.append(box);
    } else overlay.append(drawHome());

    if (helpOpen) overlay.append(drawSpillGuideSheet(engine, closeHelp, screen === "help" ? "BACK TO CONTROLS" : "BACK TO LAUNCH"));
    if (confirmNew) overlay.append(confirmSheet());
    if (helpOpen || confirmNew) {
      const modal = overlay.lastElementChild!;
      for (const sibling of [...overlay.children]) if (sibling !== modal) {
        sibling.setAttribute("aria-hidden", "true");
        for (const target of sibling.querySelectorAll<HTMLElement>("button, a[href], input, select, textarea, [tabindex]")) target.tabIndex = -1;
      }
    }
    const guideChanged = oldGuide !== !!overlay.querySelector(".ac-depotguidecard");
    const scroller = overlay.querySelector(".ac-depotcard, .ac-setup-body, .ac-result");
    if (scroller && sameScreen && !guideChanged) scroller.scrollTop = scroll;
    if (sameScreen && focusKey && focusValue && !guideChanged) {
      const key = focusKey.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
      overlay.querySelector<HTMLElement>(`[data-${key}="${focusValue}"]`)?.focus({ preventScroll: true });
    }
    if (guideChanged) {
      const guide = overlay.querySelector<HTMLElement>(".ac-depotguidecard, .ac-depotcard");
      if (guide) { guide.tabIndex = -1; guide.focus({ preventScroll: true }); }
    }
    if (confirmNew) overlay.querySelector<HTMLElement>('[data-action="cancel-new-run"]')?.focus({ preventScroll: true });
  }

  // Menu keyboard activation must not also reach the engine's flight keys.
  for (const event of ["keydown", "keyup"] as const) overlay.addEventListener(event, e => {
    const target = e.target as HTMLElement;
    if (e.key !== "Escape" && target.closest?.("button, input, select, textarea, [role=dialog]")) e.stopPropagation();
  });
  window.addEventListener("keydown", e => {
    if (e.key !== "Escape") return;
    if (helpOpen) closeHelp();
    else if (confirmNew) { confirmNew = false; render(); }
    else if (depotView.guide && engine.world.spill?.phase === "depot") { depotView.guide = false; render(); }
    else return;
    e.preventDefault(); e.stopImmediatePropagation();
  }, { capture: true });

  engine.subscribe(render);
  // A plume can expire without a gameplay cue. Read the existing RAF clock
  // without stepping the simulation or rebuilding the menu; unchanged state
  // returns before touching the DOM.
  engine.subscribeFrame(updateControls);
  window.addEventListener("resize", () => engine.resize());
  engine.start();
  try {
    await engine.artReady;
    await loadSpillScene(engine.art, engine.save.equippedSuit);
    booting = false;
    render();
  } catch (error) {
    engine.stop();
    loading.replaceChildren(el("h2", "", "The game could not finish loading"), el("p", "ac-sub", String(error)));
    loading.setAttribute("role", "alert"); overlay.replaceChildren(loading);
    throw error;
  }
}
