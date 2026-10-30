import { createEngine, type Engine } from "./engine";
import { loadSpillScene } from "./art";
import { paintShipPreview } from "./draw";
import { SPILL_UTILITIES, spillMastery } from "./spill-content";
import { spillBuildFromState, type SpillBuild } from "./spill-presentation";
import { restoreSpill, type SpillState } from "./spill";
import { SPILL_WEAPONS } from "./spill-combat";
import { SPILL_ARTIFACTS } from "./spill-builds";
import { SPILL_RISKS } from "./spill-expeditions";
import { SPILL_TRIALS, SPILL_TRIAL_BUILDS, SPILL_CHASSIS, SPILL_WEAPON_MODULES,
  type SpillTrialId, type SpillTrialBuildId } from "./spill-career";
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
  document.body.classList.add("ac-wide", "ac-beta");
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
  let trialsOpen = false;
  let trialId: SpillTrialId = "gravity";
  let trialBuild: SpillTrialBuildId = "stock";
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
    helpOpen = confirmNew = trialsOpen = false;
    if (engine.spillTrial()) engine.spillEndTrial();
    engine.open("title");
  }

  function openTrials() {
    if (engine.spillTrial()) engine.spillEndTrial();
    trialsOpen = true;
    engine.open("title");
    render();
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
    box.classList.add("ac-home");
    const body = el("div", "ac-home-body"), actions = el("nav", "ac-home-actions");
    actions.setAttribute("aria-label", "Game menu");
    body.append(preview(nextBuild()), actions); box.append(body);
    const saved = restoreSpill(engine.save.spillSuspended, engine.world.W, engine.world.H);
    if (saved) actions.append(action(`RESUME RUN · WAVE ${saved.wave} DEPOT`, "resume-run", resumeSaved, true));
    actions.append(action("NEW RUN", "new-run", startNew, !saved));
    actions.append(action("FLIGHT TRIALS", "trials", openTrials),
      action("SHIP PLANNING", "ship", () => engine.open("hangar")),
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
    box.append(preview(nextBuild()), drawSpillCareer(engine), drawSpillStarters(engine), drawSpillEnginePicker(engine));
    const saved = restoreSpill(engine.save.spillSuspended, engine.world.W, engine.world.H);
    if (saved) {
      box.append(el("h3", "", `Saved ship · wave ${saved.wave} Depot`), preview(spillBuildFromState(saved)),
        loadoutSummary(saved),
        el("p", "ac-sub", `Health ${saved.hull}/${saved.maxHull} · ${saved.ore} Acorn Coins. Your saved build is unchanged.`));
    }
    box.append(action("MAIN MENU", "home", home));
    return box;
  }

  function drawTrials() {
    const box = sheet("Flight trials", "Try an encounter now. Repeat the same field with different builds.");
    box.classList.add("ac-trial-menu");
    box.append(el("p", "ac-trial-note", "PRACTICE · Your saved run, records and unlocks stay untouched."));
    const form = el("div", "ac-trial-fields");
    const encounter = SPILL_TRIALS.find(item => item.id === trialId)!;
    const build = SPILL_TRIAL_BUILDS.find(item => item.id === trialBuild)!;
    const choice = (name: string, id: string, selected: string,
      options: readonly { id: string; name: string }[], change: (value: string) => void) => {
      const label = el("label", "ac-trial-field"), select = el("select");
      select.dataset.action = id;
      label.append(el("b", "", name));
      for (const item of options) {
        const option = el("option", "", item.name); option.value = item.id;
        option.selected = item.id === selected; select.append(option);
      }
      select.onchange = () => change(select.value);
      label.append(select); form.append(label);
    };
    choice("Encounter", "trial-encounter", trialId, SPILL_TRIALS, value => { trialId = value as SpillTrialId; render(); });
    form.append(el("p", "ac-sub", `${encounter.detail} ${encounter.endWave ? `Waves ${encounter.wave}–${encounter.endWave}.` : `Wave ${encounter.wave}.`}`));
    choice("Build", "trial-build", trialBuild, SPILL_TRIAL_BUILDS, value => { trialBuild = value as SpillTrialBuildId; render(); });
    form.append(el("p", "ac-sub", build.detail));
    box.append(form, el("p", "ac-sub", "Begin at the Depot, launch, then retry from Pause or the result. The seed stays the same so each build faces the same plan."),
      action("START TRIAL", "start-trial", () => {
        trialsOpen = false;
        if (!engine.spillStartTrial(trialId, trialBuild)) { trialsOpen = true; message = "This trial could not start. Try again."; render(); }
      }, true), action("MAIN MENU", "home", home));
    if (message) box.append(el("p", "ac-sub", message));
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
    settings.append(el("p", "ac-sub", "Hold and drag to steer. Tap with another finger to shoot. Flick left or right to dodge."));
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
      toggle("glow", "Character glow", "The light around your pilot", !engine.save.glowOff,
        () => engine.setGlowOff(!engine.save.glowOff)));
    box.append(settings, flightSettings(), action("MAIN MENU", "home", home));
    return box;
  }

  function drawPause() {
    const state = engine.world.spill!;
    const trial = engine.spillTrial();
    const box = sheet(trial ? "PRACTICE PAUSED" : "PAUSED", `WAVE ${state.wave} · ${state.ore} ACORN COINS`);
    box.classList.add("ac-pause");
    box.append(loadoutSummary(state), flightSettings());
    if (state.expedition.active !== "standard") box.append(el("p", "ac-sub",
      `${SPILL_RISKS[state.expedition.active].name} · clear through wave ${state.expedition.endWave} for ${SPILL_RISKS[state.expedition.active].reward} bonus coins`));
    const actions = el("div", "ac-pauseact");
    actions.append(action("RESUME", "resume", () => engine.resume(), true));
    if (trial) actions.append(action("RETRY TRIAL", "retry-trial", () => engine.spillRetryTrial()),
      action("CHOOSE TRIAL", "choose-trial", openTrials));
    actions.append(action(trial ? "END TRIAL" : "ABORT TO TITLE", "home", home));
    box.append(actions);
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
    const box = sheet(cleared ? "TRIAL CLEARED" : "TRIAL ENDED", encounter.endWave ? SPILL_RISKS[state.expedition.active].name : encounter.name);
    box.append(el("p", "ac-trial-note", "PRACTICE · No records, unlocks or saved-run changes."),
      el("p", "ac-sub", `Health hits ${state.hits} · Enemies defeated ${state.combat.kills} · Debris shattered ${state.shattered}`),
      loadoutSummary(state), el("p", "ac-sub", "Could you read the warning, choose a response and stay in control? Try another build against the same field."),
      action("RETRY TRIAL", "retry-trial", () => engine.spillRetryTrial(), true),
      action("CHOOSE TRIAL", "choose-trial", openTrials), action("MAIN MENU", "home", home));
    if (encounter.endWave) {
      const reward = cleared && state.expedition.rewarded ? SPILL_RISKS[state.expedition.active].reward : 0;
      box.querySelector('.ac-loadout-summary')!.before(el("p", "ac-sub", `Trial wallet: ${state.ore} coins · Route completion bonus: ${reward}`));
    }
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
    const focusKey = ["spillControl", "shipStarter", "shipColor", "careerChoice", "action", "setting"]
      .find(key => active?.dataset[key]);
    const focusValue = focusKey ? active!.dataset[focusKey] : "";
    const screenKey = `${screen}:${state?.phase ?? ""}:${trialsOpen}`;
    const sameScreen = lastScreen === screenKey;
    lastScreen = screenKey;
    if (screen !== "help" && !(screen === "play" && state?.phase === "ready")) helpOpen = false;
    if (screen !== "title") confirmNew = false;
    overlay.replaceChildren();
    if (screen === "play" && state) {
      const bar = el("div", "ac-playbar");
      const pause = action("II", "pause", () => engine.pause());
      pause.className = "ac-iconbtn"; pause.setAttribute("aria-label", "Pause");
      bar.append(pause); overlay.append(bar);
      const trial = engine.spillTrial();
      if (trial) bar.prepend(el("span", "ac-practice-badge", "PRACTICE"));
      if (trial && state.phase === "over") overlay.append(drawTrialResult(state, trial.complete));
      else if (state.phase === "depot") overlay.append(drawDepotWorkshop(engine, depotView, render));
      else if (state.phase === "ready") overlay.append(drawSpillLaunchSetup(engine, openHelp));
    } else if (screen === "pause" && state) overlay.append(drawPause());
    else if (screen === "dead" && state) overlay.append(engine.spillTrial() ? drawTrialResult(state, engine.spillTrial()!.complete) : drawResults(state));
    else if (screen === "hangar") overlay.append(drawShip());
    else if (screen === "profile") overlay.append(drawSettings());
    else if (screen === "help") {
      const box = sheet("Controls");
      box.append(drawSpillFlightHelp(), action("HOW THE DEPOT WORKS", "depot-guide", openHelp), action("MAIN MENU", "home", home));
      overlay.append(box);
    } else overlay.append(trialsOpen ? drawTrials() : drawHome());

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
    else if (trialsOpen) { trialsOpen = false; render(); }
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
    loading.setAttribute("role", "alert"); overlay.replaceChildren(loading);
    throw error;
  }
}
