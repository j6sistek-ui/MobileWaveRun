import { createEngine, type Engine } from "./engine";
import { loadSpillScene } from "./art";
import { paintShipPreview } from "./draw";
import { SPILL_UTILITIES, spillMastery } from "./spill-content";
import { spillBuildFromState, type SpillBuild } from "./spill-presentation";
import { restoreSpill, type SpillState } from "./spill";
import { SPILL_WEAPONS } from "./spill-combat";
import { SPILL_ARTIFACTS } from "./spill-builds";
import { SPILL_RISKS } from "./spill-expeditions";
import { SPILL_TRIALS, SPILL_CHASSIS, SPILL_WEAPON_MODULES } from "./spill-career";
import { createDepotView, drawDepotWorkshop, drawSpillLaunchSetup, drawSpillStarters,
  drawSpillEnginePicker, drawSpillFlightHelp, drawSpillGuideSheet, drawSpillCareer } from "./spill-workshop";

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = "", text = "") => {
  const node = document.createElement(tag);
  node.className = cls;
  node.textContent = text;
  return node;
};

/** Spill-only navigation. The original engine still owns the clock, gestures,
 * rendering, checkpoints and purchases; this host only composes its screens. */
export async function bootStandalone(root: HTMLElement) {
  document.body.classList.add("ac-wide", "ac-beta", "mwr-ui");
  // Keep a real readable title if the decorative wordmark cannot load.
  const wordmark = new Image();
  wordmark.onload = () => document.body.classList.add("mwr-wordmark-ready");
  wordmark.src = "./art/space-ui/title-wordmark.png";
  root.replaceChildren();
  root.className = "ac-root";
  const stage = el("div", "ac-stage");
  const canvas = el("canvas", "ac-canvas");
  const overlay = el("div", "ac-overlay");
  const joystick = el("div", "ac-floating-stick");
  joystick.hidden = true;
  joystick.setAttribute("aria-hidden", "true");
  const stickKnob = el("span", "ac-floating-stick-knob");
  joystick.append(stickKnob);
  stage.append(canvas, overlay, joystick);
  root.append(stage);
  const loading = el("section", "ac-sheet ac-center mwr-screen mwr-loading");
  loading.dataset.screen = "loading";
  loading.setAttribute("aria-busy", "true");
  loading.append(el("p", "ac-kicker", "SURVIVAL FLIGHT"), el("h1", "mwr-wordmark", "THE SPILL"),
    el("p", "ac-sub", "Loading the ship and field…"));
  overlay.append(loading);

  let engine: Engine;
  try {
    engine = await createEngine(canvas);
  } catch (error) {
    loading.replaceChildren(el("h2", "", "The game could not start"), el("p", "ac-sub", String(error)));
    loading.setAttribute("aria-busy", "false");
    loading.setAttribute("role", "alert");
    throw error;
  }
  (window as unknown as { __sandbox?: Engine }).__sandbox = engine;
  const depotView = createDepotView();
  let booting = true;
  let helpOpen = false;
  let confirmNew = false;
  let settingsGuideOpen = false;
  let message = "";
  let lastScreen = "";

  function action(label: string, id: string, run: () => void, primary = false) {
    const button = el("button", `${primary ? "ac-primary mwr-button-primary" : "ac-ghost mwr-button-secondary"} mwr-button`);
    button.type = "button";
    button.dataset.action = id;
    button.setAttribute("aria-label", label);
    button.append(el("span", "mwr-button-label", label));
    button.onclick = run;
    return button;
  }

  function menuAction(label: string, id: string, icon: string, run: () => void, primary = false) {
    const button = action(label, id, run, primary), mark = el("span", "mwr-button-icon");
    mark.dataset.icon = icon; mark.setAttribute("aria-hidden", "true"); button.prepend(mark);
    return button;
  }

  function actions(...buttons: HTMLButtonElement[]) {
    const footer = el("footer", "mwr-actions"); footer.append(...buttons); return footer;
  }

  function stat(label: string, value: string | number) {
    const item = el("div", "mwr-stat");
    item.append(el("b", "mwr-stat-value", String(value)), el("span", "mwr-stat-label", label));
    return item;
  }

  function home() {
    helpOpen = confirmNew = false;
    if (engine.spillTrial()) engine.spillEndTrial();
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

  let controlState = "";
  function updateControls() {
    const state = engine.world.spill;
    const activeFlight = engine.world.screen === "play" && !!state && ["countdown", "wave", "drain"].includes(state.phase);
    canvas.classList.toggle("ac-flight-surface", activeFlight);
    const stick = engine.spillControls();
    const visible = activeFlight && stick.active;
    const key = visible ? `${stick.x}:${stick.y}:${stick.dx}:${stick.dy}` : "hidden";
    if (key === controlState) return;
    controlState = key;
    joystick.hidden = !visible;
    if (!visible) return;
    joystick.style.left = `${stick.x * 100}%`;
    joystick.style.top = `${stick.y * 100}%`;
    stickKnob.style.transform = `translate(${stick.dx * 25}px, ${stick.dy * 25}px)`;
  }

  function sheet(title: string, subtitle = "", screen = "menu") {
    const box = el("section", "ac-sheet ac-center ac-result mwr-screen");
    box.dataset.screen = screen;
    const head = el("header", "mwr-screen-header");
    head.append(el("p", "ac-kicker", "THE SPILL"), el("h2", "mwr-screen-title", title));
    if (subtitle) head.append(el("p", "ac-sub mwr-screen-subtitle", subtitle));
    box.append(head);
    return box;
  }

  /** The frame and nameplate stay together while the existing sheet scrolls. */
  function frameMenuScreens() {
    for (const box of overlay.querySelectorAll<HTMLElement>(".mwr-screen:not(.mwr-home):not(.mwr-loading)")) {
      const backdrop = el("div", "mwr-screen-backdrop"), frame = el("div", "mwr-screen-shell mwr-kit-panel");
      const title = box.querySelector<HTMLElement>(".mwr-screen-title");
      box.before(backdrop);
      backdrop.append(frame);
      if (title) {
        title.classList.add("mwr-panel-title");
        frame.append(title);
      }
      frame.append(box);
    }
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
    const box = el("section", "ac-sheet ac-center ac-result ac-home mwr-screen mwr-home");
    box.dataset.screen = "home";
    const head = el("header", "mwr-home-head");
    head.append(el("p", "ac-kicker", "SURVIVAL FLIGHT"), el("h1", "mwr-wordmark", "THE SPILL"),
      el("p", "ac-sub mwr-home-premise", "Read the field. Find your opening. Survive the next wave."));
    const body = el("div", "ac-home-body mwr-home-body"), nav = el("nav", "ac-home-actions mwr-home-actions");
    nav.setAttribute("aria-label", "Game menu");
    const bay = el("div", "mwr-ship-bay mwr-kit-panel");
    bay.append(el("p", "ac-kicker mwr-panel-title", "YOUR SHIP"), preview(nextBuild()),
      el("p", "ac-sub", "Recover salvage. Refit at the Depot."));
    body.append(bay, nav); box.append(head, body);
    const saved = restoreSpill(engine.save.spillSuspended, engine.world.W, engine.world.H);
    if (saved) nav.append(menuAction(`RESUME RUN · WAVE ${saved.wave} DEPOT`, "resume-run", "play", resumeSaved, true));
    nav.append(menuAction("NEW RUN", "new-run", "play", startNew, !saved));
    nav.append(menuAction("SHIP PLANNING", "ship", "target", () => engine.open("hangar")),
      menuAction("SETTINGS & CONTROLS", "settings", "settings", () => engine.open("profile")));
    const mastery = spillMastery(engine.save.spillBest);
    const records = el("footer", "mwr-home-records");
    records.append(el("p", "ac-gold mwr-rank", mastery.current.title),
      stat("Best wave", engine.save.spillBest), stat("Best salvage", engine.save.spillRecords?.bestScore ?? 0));
    box.append(records);
    if (message) {
      const note = el("p", "ac-sub", message);
      note.setAttribute("role", "alert"); box.append(note);
    }
    return box;
  }

  function drawShip() {
    const box = sheet("Ship planning", "Set your starting loadout. Upgrade during the run at the Depot.", "ship");
    box.append(preview(nextBuild()), drawSpillCareer(engine), drawSpillStarters(engine), drawSpillEnginePicker(engine));
    const saved = restoreSpill(engine.save.spillSuspended, engine.world.W, engine.world.H);
    if (saved) {
      box.append(el("h3", "", `Saved ship · wave ${saved.wave} Depot`), preview(spillBuildFromState(saved)),
        loadoutSummary(saved),
        el("p", "ac-sub", `Health ${saved.hull}/${saved.maxHull} · ${saved.ore} Salvage. Your saved build is unchanged.`));
    }
    box.append(actions(action("MAIN MENU", "home", home)));
    return box;
  }

  function toggle(id: string, label: string, detail: string, on: boolean, change: () => void) {
    const button = el("button", "ac-spillsetting mwr-setting");
    button.type = "button"; button.dataset.setting = id;
    button.setAttribute("role", "switch"); button.setAttribute("aria-label", label);
    button.setAttribute("aria-checked", String(on));
    const text = el("span"); text.append(el("b", "", label), el("small", "", detail));
    const state = el("strong", "mwr-toggle-state", on ? "ON" : "OFF");
    state.setAttribute("aria-hidden", "true"); button.append(text, state);
    button.onclick = change;
    return button;
  }

  function flightSettings() {
    const settings = el("section", "ac-spillsettings mwr-settings-panel");
    settings.append(el("h3", "", "Flight controls"));
    settings.append(el("p", "ac-sub", "Hold and drag to steer. Tap with another finger to shoot. Flick left or right to dodge."));
    const prompts = toggle("prompts", "Instructional prompts",
      engine.save.helpOff ? "Help is disabled in Settings." : "Control tips and wave lessons. Hazard warnings stay visible.",
      !engine.save.spillPromptsOff && !engine.save.helpOff, () => engine.setSpillPromptsOff(!engine.save.spillPromptsOff));
    prompts.disabled = !!engine.save.helpOff;
    settings.append(prompts);
    return settings;
  }

  function drawSettings() {
    const box = sheet("Settings", "Controls, flight help, sound and presentation.", "settings");
    const settings = el("section", "ac-spillsettings mwr-settings-panel");
    settings.append(el("h3", "", "Sound & presentation"));
    settings.append(toggle("music", "Music", "The score under menus and flight", !engine.save.musicOff,
      () => engine.setMusicOff(!engine.save.musicOff)),
      toggle("sound", "Sound effects", "Thrusters, pickups and hits", !engine.save.sfxOff,
        () => engine.setSfxOff(!engine.save.sfxOff)),
      toggle("help", "Help prompts", "Control tips and wave lessons", !engine.save.helpOff,
        () => engine.setHelpOff(!engine.save.helpOff)),
      toggle("motion", "Menu animation", "Pulses, fades and moving badges", !engine.save.motionOff,
        () => engine.setMotionOff(!engine.save.motionOff)),
      toggle("glow", "Ship accents", "Extra illumination on the hull", !engine.save.glowOff,
        () => engine.setGlowOff(!engine.save.glowOff)));
    const credit = el("p", "mwr-ui-credit", "UI artwork: "), creditLink = el("a", "", "uifabrica.com");
    creditLink.href = "https://uifabrica.com/";
    creditLink.target = "_blank"; creditLink.rel = "noopener noreferrer";
    credit.append(creditLink);
    const guide = el("details", "mwr-control-guide"); guide.open = settingsGuideOpen;
    const summary = el("summary", "", "CONTROLS & FIELD GUIDE"); summary.dataset.action = "control-guide";
    const guideBody = el("div", "mwr-guide-content"), guideActions = el("div", "mwr-guide-actions");
    guideActions.append(action("HOW THE DEPOT WORKS", "depot-guide", openHelp));
    guideBody.append(drawSpillFlightHelp(), guideActions); guide.append(summary, guideBody);
    box.append(settings, flightSettings(), guide, credit, actions(action("MAIN MENU", "home", home)));
    return box;
  }

  function drawPause() {
    const state = engine.world.spill!;
    const trial = engine.spillTrial();
    const box = sheet(trial ? "PRACTICE PAUSED" : "PAUSED", `WAVE ${state.wave} · ${state.ore} SALVAGE`, "pause");
    box.classList.add("ac-pause");
    box.append(loadoutSummary(state), flightSettings());
    if (state.expedition.active !== "standard") box.append(el("p", "ac-sub",
      `${SPILL_RISKS[state.expedition.active].name} · clear through wave ${state.expedition.endWave} for ${SPILL_RISKS[state.expedition.active].reward} bonus Salvage`));
    const footer = el("footer", "ac-pauseact mwr-actions");
    footer.append(action("RESUME", "resume", () => engine.resume(), true));
    if (trial) footer.append(action("RETRY TRIAL", "retry-trial", () => engine.spillRetryTrial()));
    footer.append(action(trial ? "END TRIAL" : "ABORT TO TITLE", "home", home));
    box.append(footer);
    return box;
  }

  function loadoutSummary(state: SpillState) {
    const id = state.combat.build.artifact, artifact = id ? SPILL_ARTIFACTS[id] : null;
    const chassis = SPILL_CHASSIS.find(item => item.id === state.loadout.chassis)!;
    const module = SPILL_WEAPON_MODULES.find(item => item.id === state.loadout.module)!;
    const summary = el("p", "ac-sub ac-loadout-summary",
      `${chassis.name} · ${module.name} · ${SPILL_WEAPONS[state.combat.weapon].name} ${state.combat.levels[state.combat.weapon]}/3 · ${artifact ? `${artifact.style} / ${artifact.name}` : "No artifact fitted"}`);
    summary.setAttribute("aria-label", "Current loadout");
    return summary;
  }

  function drawTrialResult(state: SpillState, cleared: boolean) {
    const trial = engine.spillTrial()!, encounter = SPILL_TRIALS.find(item => item.id === trial.id)!;
    const box = sheet(cleared ? "TRIAL CLEARED" : "TRIAL ENDED", encounter.endWave ? SPILL_RISKS[state.expedition.active].name : encounter.name, "trial-results");
    box.dataset.outcome = cleared ? "cleared" : "ended";
    const metrics = el("div", "mwr-stat-grid");
    metrics.append(stat("Health hits", state.hits), stat("Enemies defeated", state.combat.kills), stat("Debris shattered", state.shattered));
    box.append(el("p", "ac-trial-note", "PRACTICE · No records, unlocks or saved-run changes."),
      metrics,
      loadoutSummary(state), el("p", "ac-sub", "Could you read the warning, choose a response and stay in control? Try another build against the same field."),
      actions(
      action("RETRY TRIAL", "retry-trial", () => engine.spillRetryTrial(), true),
      action("MAIN MENU", "home", home)));
    if (encounter.endWave) {
      const reward = cleared && state.expedition.rewarded ? SPILL_RISKS[state.expedition.active].reward : 0;
      box.querySelector('.ac-loadout-summary')!.before(el("p", "ac-sub", `Trial wallet: ${state.ore} Salvage · Route completion bonus: ${reward}`));
    }
    return box;
  }

  function drawResults(state: SpillState) {
    const box = sheet(state.cause === "GROUNDED" ? "OUT OF HEALTH" : "LOST TO THE FIELD", "Run debrief", "results");
    const big = el("div", "ac-crashscore mwr-result-score");
    big.append(el("b", "", String(state.cleared)), el("span", "", state.cleared === 1 ? "WAVE CLEARED" : "WAVES CLEARED"));
    box.append(big);
    if (engine.world.lastRun?.best && state.cleared > 0) box.append(el("p", "ac-gold", "NEW BEST"));
    if (state.cause === "GROUNDED") box.append(el("p", "ac-sub", "You ran out of health at the lower edge."));
    const rows = el("div", "ac-rows ac-crashrows");
    for (const [label, value] of [
      ["Salvage score", Math.floor(state.score)], ["Salvage recovered", state.oreMined],
      ["Contracts completed", state.contractsDone], ["Health hits", state.hits],
      ["Grazes", state.grazes], ["Debris shattered", state.shattered], ["Enemies defeated", state.combat.kills],
      ["Best wave", engine.save.spillBest], ["Best salvage score", engine.save.spillRecords?.bestScore ?? 0],
    ] as const) {
      const row = el("div", "ac-row");
      row.append(el("span", "", label), el("span", "ac-rowgold", String(value))); rows.append(row);
    }
    const mastery = spillMastery(engine.save.spillBest);
    box.append(rows, loadoutSummary(state), el("p", "ac-sub", `LAST RUN · Health upgrades ${state.up.plating} · Thrusters ${state.up.thrusters} · Pulse ${state.up.pulse}`),
      el("p", "ac-sub", state.utilities.map(id => SPILL_UTILITIES[id].name).join(" + ") || "Stock utilities"),
      el("p", "ac-gold", mastery.current.title),
      el("p", "ac-sub", mastery.next ? `Next: clear wave ${mastery.next.at} for ${mastery.next.title} and a new engine color.` : "Every engine color earned. Beat your best wave."),
      actions(action("FLY AGAIN", "new-run", startNew, true), action("MAIN MENU", "home", () => engine.dismissDead())));
    return box;
  }

  function confirmSheet() {
    const wrap = el("div", "ac-lvlsheet mwr-modal");
    const card = el("section", "ac-lvlcard ac-center mwr-confirm");
    card.setAttribute("role", "dialog"); card.setAttribute("aria-modal", "true");
    card.setAttribute("aria-label", "Replace saved run");
    card.append(el("p", "ac-kicker", "SAVED RUN DETECTED"), el("h2", "mwr-screen-title", "Start a new run?"), el("p", "ac-sub", "This replaces your saved Depot run. Your records and earned starting utilities stay."), actions(
      action("KEEP SAVED RUN", "cancel-new-run", () => { confirmNew = false; render(); }, true),
      action("START NEW RUN", "confirm-new-run", () => { confirmNew = false; engine.fly("spill"); })));
    card.querySelector<HTMLElement>('[data-action="confirm-new-run"]')?.classList.add("mwr-button-danger");
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
    settingsGuideOpen = overlay.querySelector<HTMLDetailsElement>(".mwr-control-guide")?.open ?? settingsGuideOpen;
    const state = engine.world.spill;
    const screen = engine.world.screen;
    document.body.classList.toggle("mwr-motion-off", !!engine.save.motionOff);
    stage.dataset.screen = screen;
    stage.dataset.phase = state?.phase ?? "";
    updateControls();
    const oldGuide = !!overlay.querySelector(".ac-depotguidecard");
    const menuScroll = overlay.querySelector(".ac-result")?.scrollTop;
    const scroll = overlay.querySelector(".ac-depotcard, .ac-setup-body, .ac-result")?.scrollTop ?? 0;
    const active = document.activeElement as HTMLElement | null;
    const focusKey = ["spillControl", "shipStarter", "shipColor", "careerChoice", "action", "setting"]
      .find(key => active?.dataset[key]);
    const focusValue = focusKey ? active!.dataset[focusKey] : "";
    const screenKey = `${screen}:${state?.phase ?? ""}`;
    const sameScreen = lastScreen === screenKey;
    lastScreen = screenKey;
    if (screen !== "profile" && screen !== "help" && !(screen === "play" && state?.phase === "ready")) helpOpen = false;
    if (screen !== "title") confirmNew = false;
    overlay.replaceChildren();
    if (screen === "play" && state) {
      const bar = el("div", "ac-playbar mwr-playbar");
      const pause = action("II", "pause", () => engine.pause());
      pause.className = "ac-iconbtn mwr-pause-button"; pause.setAttribute("aria-label", "Pause");
      bar.append(pause); overlay.append(bar);
      const trial = engine.spillTrial();
      if (trial) bar.prepend(el("span", "ac-practice-badge", "PRACTICE"));
      if (trial && state.phase === "over") overlay.append(drawTrialResult(state, trial.complete));
      else if (state.phase === "depot") overlay.append(drawDepotWorkshop(engine, depotView, render));
      else if (state.phase === "ready") overlay.append(drawSpillLaunchSetup(engine, openHelp));
    } else if (screen === "pause" && state) overlay.append(drawPause());
    else if (screen === "dead" && state) overlay.append(engine.spillTrial() ? drawTrialResult(state, engine.spillTrial()!.complete) : drawResults(state));
    else if (screen === "hangar") overlay.append(drawShip());
    else if (screen === "profile" || screen === "help") overlay.append(drawSettings());
    else overlay.append(drawHome());

    frameMenuScreens();

    if (helpOpen) overlay.append(drawSpillGuideSheet(engine, closeHelp,
      screen === "profile" || screen === "help" ? "BACK TO SETTINGS" : "BACK TO LAUNCH"));
    if (confirmNew) overlay.append(confirmSheet());
    if (helpOpen || confirmNew) {
      const modal = overlay.lastElementChild!;
      for (const sibling of [...overlay.children]) if (sibling !== modal) {
        sibling.setAttribute("aria-hidden", "true");
        for (const target of sibling.querySelectorAll<HTMLElement>("button, a[href], input, select, textarea, summary, [tabindex]")) target.tabIndex = -1;
      }
    }
    const guideChanged = oldGuide !== !!overlay.querySelector(".ac-depotguidecard");
    const scroller = overlay.querySelector(".ac-depotcard, .ac-setup-body, .ac-result");
    if (scroller && sameScreen && !guideChanged) scroller.scrollTop = scroll;
    else if (sameScreen && menuScroll !== undefined) {
      // Keep the combined guide's place underneath its Depot-help modal.
      const menu = overlay.querySelector(".ac-result");
      if (menu) menu.scrollTop = menuScroll;
    }
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
    if (e.key !== "Escape" && target.closest?.("button, a[href], input, select, textarea, summary, [role=dialog]")) e.stopPropagation();
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
  // Rotation, browser chrome and safe-area changes do not always arrive as
  // the same window event. Resize from the actual stage after layout settles.
  // Coalesce notifications so one change does not rebuild the canvas repeatedly.
  let resizeFrame = 0;
  const queueResize = () => {
    if (resizeFrame) return;
    resizeFrame = requestAnimationFrame(() => { resizeFrame = 0; engine.resize(); });
  };
  window.addEventListener("resize", queueResize);
  window.addEventListener("orientationchange", queueResize);
  window.visualViewport?.addEventListener("resize", queueResize);
  window.screen?.orientation?.addEventListener("change", queueResize);
  const stageObserver = new ResizeObserver(queueResize);
  stageObserver.observe(stage);
  engine.start();
  try {
    await engine.artReady;
    await loadSpillScene(engine.art, engine.save.equippedSuit);
    booting = false;
    render();
  } catch (error) {
    engine.stop();
    loading.replaceChildren(el("h2", "", "The game could not finish loading"), el("p", "ac-sub", String(error)));
    loading.setAttribute("aria-busy", "false");
    loading.setAttribute("role", "alert"); overlay.replaceChildren(loading);
    throw error;
  }
}
