# Browser validation — 2026-10-29

## Joystick controls revision

`npm run check` passes typecheck, clean build, unchanged asset verification and all 14 test files on existing Node24.19.0. Docker Desktop's Linux engine pipe remains unavailable; no packages were installed. There is no separate lint script; `git diff --check` is the whitespace check.

New coverage includes 12 steering cases (analog symmetry, release within 150 ms, soft edges, both dodge directions, countdown movement/decay, upgrades/modifiers, real collision knockback, transitions, resize and old checkpoint migration), 11 gesture cases (dead zone, CSS-pixel sensitivity, short/long holds, horizontal speed/dominance, cooldown and no repeat), and the combat suite now has 16 cases including taps released between simulation frames and queued-shot cancellation. Host tests cover simultaneous steering/fire owners, no ownership transfer, stale keys/moves, touch/gesture default prevention, keyboard controls, countdown transitions, interruption cleanup, Depot scrolling and save/resume. Six combat frames, two signed dodge trails, Blackout, fallback and 192 ship configurations pass; both dodge trails were visually checked.

Original assets remain 125 exact files / 10,529,964 bytes plus the two existing generated sprites / 2,042,667 bytes. The previous tap/gravity trace hashes are intentionally retired. Two unchanged upstream presentation hashes, a separately labeled reviewed content-description hash, three deterministic 900-frame steering replays and specific movement assertions now guard the authorized change.

Real desktop browser testing followed the menu, starter Depot, free Health upgrade, checkpoint reload/resume and launch. W/S steering, A/D dodges, F firing, pause/resume and a 390×760 viewport were exercised. The normal run reached Wave 2 with 18 coins. A held mouse contact displayed the faint joystick in the screenshot below; only Pause remains as a fixed gameplay button. Computed gameplay canvas `touch-action` was `none`, and the browser console had no warnings/errors. Temporary viewport changes were reset and the preview left paused.

![Live Wave 2 with the floating joystick and no fixed flight pads](images/joystick-browser.jpg)

This is desktop browser and automated input evidence. Physical Safari/Chrome double-tap zoom prevention, two-finger ergonomics, audio listening, sustained performance and long-run balance remain unverified. The controls revision is not published until its PR is merged. See [CONTROLS.md](CONTROLS.md) for behavior and tuning context.

## Priority-one combat extension (historical)

The combat extension passes TypeScript checking, clean browser build, asset verification and all 12 test files using existing Node24.19.0. No dependency or host package installation was needed. Docker was attempted again; its Desktop Linux engine pipe is unavailable. The existing Linux CI workflow supplies a separate platform check at PR time. `git diff --check` passes; there is no separate lint script.

New coverage includes 14 combat rule cases (held fire, upgrades, forward assistance, moving-target sweeps, cover ties, damage/Pulse/extra life, once-only rewards, warning lead, admission caps, pressure allocation, drain/resize, legacy checkpoint migration, malformed-save rejection and deterministic mixed encounters). Host tests cover keyboard plus multiple pointer owners, release/cancel, pause/focus/visibility/resize, disabled controls, stop/restart, immediate purchase checkpoints and resume. Existing regressions still cover movement, progression, isolated storage and 192 equipment renders.

The production renderer loads both generated PNGs and verifies six weapon/viewport frames at 320×760, 390×760 and 1280×720, plus Blackout and missing-image fallback. Frames were inspected for silhouettes, warning alignment and peripheral HUD placement. Original provenance remains 125 exact upstream files / 10,529,964 bytes; the two generated files total 2,042,667 bytes. Three unchanged content/presentation hashes and all three original 900-frame non-firing Wave 1 state traces still pass. Only the newly added combat state is omitted from those legacy trace hashes; combat remains enabled.

Real browser smoke testing used the normal menu, opening Depot, Heavy Cannon selection, free Health upgrade, launch and pause. A continuous laser run used Space and held F to reach Wave 2 with 27 run coins; the screenshot shows the real laser, enemy and target marker. Pause showed Wave 2 correctly. The browser console had no warnings or errors. The narrow 319×629 Depot and flight controls were visually inspected; a 1280×720 pause layout had no horizontal overflow. The screenshot API works again after resetting the browser-control session, superseding the extraction-era capture limitation below. Temporary viewport overrides were reset.

![Live browser combat at Wave 2](images/combat-browser.jpg)

[Opening Depot screenshot](images/combat-depot.jpg)

The live run is a short smoke check, not a natural five-wave completion or balance certification. Physical phone touch ergonomics, audio listening, sustained performance, late endless-wave combinations and native packaging remain unverified. Desktop browser input automation could not reliably hold the on-screen Fire pad; its multiple-pointer lifecycle is covered by DOM integration tests, while held keyboard firing was exercised live. No merge or live-site publication is part of these local results.

## Extraction baseline (historical)

The extraction authority was AcornautSandbox `b67bb50f3f3fa24b6a335133a1c176638a83f775`. That baseline preserved Spill rules, content, presentation and Depot gag source with four LF-normalized SHA-256 checks and three seeded 900-frame full-state traces. Combat now intentionally extends the rules as described above. The original source checkout remains unchanged.

### Automated checks

Use `npm run check` for TypeScript checking, a clean browser build, asset verification and the complete test suite. Local checks use existing Node24.19.0 and repository-local dependencies. The Docker engine was unavailable on this workstation; the provided Node22 Docker build and Linux CI workflow have separate execution status. `npm audit` reports zero known vulnerabilities after updating the test-only DOM dependency. No runtime npm dependencies are shipped in `dist/`.

Coverage includes original rules, damage and progression, all four first-Depot choices, coins during countdown, contracts and 48 event sweeps, checkpoint banking, endless continuation, three deterministic traces, 192 ship render configurations, five arrival frames and 36 bear animation frames. Standalone checks exercise the actual bootstrap, early input during delayed asset loading, blocked other-mode launches, isolated storage including quota failure, settings, focus, multitouch ownership, pause, free starter, Wave5 Depot purchase, save/quit/resume and restart. Forced Wave5 setup verifies the checkpoint integration; it is not evidence of a complete natural five-wave playthrough.

### Browser smoke check

The local build was opened over HTTP in the desktop app's browser. The real UI reached the home screen, opening briefing, starter Depot, free Thrusters upgrade, Wave1 and pause after a thrust input. Browser console inspection reported no errors or warnings. Desktop1280×720 and narrow390×760 layout bounds were inspected; the narrow pause controls fit the viewport without horizontal overflow.

The browser screenshot API failed to capture this tab. Therefore a complete visual comparison of the HTML overlays is **not verified**. Separate production-painter render images were generated and inspected; these are synthetic test scenes, not screenshots of the interactive browser. Audio listening, sustained play, physical mobile touch ergonomics, device performance, and native packaging remain unverified.

### Preserved baseline behavior

Instruction prompts retain the original teaching-speed behavior. Abort-to-title does not bank an active run in the upstream engine; this extraction retains that behavior. Checkpoints save at Depots, not mid-wave. These are potential later design topics, not changes bundled into extraction.

The host adds a loading readiness guard and updates control-pad feedback from the existing render loop only when its visual state changes. No extra simulation loop, balance adjustment, camera conversion, advertising adapter or Unreal asset is introduced. Three orphan shop/map modules were omitted; reachable shared engine/rendering support remains for baseline parity.
