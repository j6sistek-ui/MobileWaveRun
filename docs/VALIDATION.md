# Browser extraction validation — 2026-10-29

The authority is AcornautSandbox `b67bb50f3f3fa24b6a335133a1c176638a83f775`. The extraction preserves Spill rules, content, presentation and Depot gag source. Four LF-normalized SHA-256 checks and three seeded 900-frame full-state traces protect that baseline. Artwork provenance covers 125 exact upstream files, 10,529,964 bytes, including the two music tracks used here. The original source checkout remains unchanged.

## Automated checks

Use `npm run check` for TypeScript checking, a clean browser build, asset verification and the complete test suite. Local checks use existing Node24.19.0 and repository-local dependencies. The Docker engine was unavailable on this workstation; the provided Node22 Docker build and Linux CI workflow have separate execution status. `npm audit` reports zero known vulnerabilities after updating the test-only DOM dependency. No runtime npm dependencies are shipped in `dist/`.

Coverage includes original rules, damage and progression, all four first-Depot choices, coins during countdown, contracts and 48 event sweeps, checkpoint banking, endless continuation, three deterministic traces, 192 ship render configurations, five arrival frames and 36 bear animation frames. Standalone checks exercise the actual bootstrap, early input during delayed asset loading, blocked other-mode launches, isolated storage including quota failure, settings, focus, multitouch ownership, pause, free starter, Wave5 Depot purchase, save/quit/resume and restart. Forced Wave5 setup verifies the checkpoint integration; it is not evidence of a complete natural five-wave playthrough.

## Browser smoke check

The local build was opened over HTTP in the desktop app's browser. The real UI reached the home screen, opening briefing, starter Depot, free Thrusters upgrade, Wave1 and pause after a thrust input. Browser console inspection reported no errors or warnings. Desktop1280×720 and narrow390×760 layout bounds were inspected; the narrow pause controls fit the viewport without horizontal overflow.

The browser screenshot API failed to capture this tab. Therefore a complete visual comparison of the HTML overlays is **not verified**. Separate production-painter render images were generated and inspected; these are synthetic test scenes, not screenshots of the interactive browser. Audio listening, sustained play, physical mobile touch ergonomics, device performance, and native packaging remain unverified.

## Preserved baseline behavior

Instruction prompts retain the original teaching-speed behavior. Abort-to-title does not bank an active run in the upstream engine; this extraction retains that behavior. Checkpoints save at Depots, not mid-wave. These are potential later design topics, not changes bundled into extraction.

The host adds a loading readiness guard and updates control-pad feedback from the existing render loop only when its visual state changes. No extra simulation loop, balance adjustment, camera conversion, advertising adapter or Unreal asset is introduced. Three orphan shop/map modules were omitted; reachable shared engine/rendering support remains for baseline parity.
