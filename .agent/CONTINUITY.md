# MobileWaveRun continuity

## [PLANS]
- 2026-10-29T12:25Z [USER] Extract only The Spill into new repository https://github.com/j6sistek-ui/MobileWaveRun; retain current side-view gameplay and browser launch. Later review original SpaceSurvival scope beyond Phase1 for adaptation. No 3D/Phoenix adoption now.

## [DECISIONS]
- 2026-10-29T12:25Z [TOOL] Upstream AcornautSandbox pinned b67bb50f3f3fa24b6a335133a1c176638a83f775. Read-only source clone in task work/spill-source. New destination was empty; main initialized with empty commit2ac0fb7 so implementation can be reviewed as a PR on codex/extract-spill-browser.
- 2026-10-29T12:25Z [CODE] Preserve rules/render/input timing; replace multi-mode host with Spill-only entry and isolate persistence. Shared supporting modules retained initially for parity; no other mode entry points allowed.

## [DISCOVERIES]
- 2026-10-29T12:25Z [TOOL] Docker engine pipe unavailable; use documented local Node dependency fallback, no host installation. Runtime/build/test verification pending.
- 2026-10-29T12:46Z [CODE] Early launch during asset loading could start a hidden run; guarded launch/resume until art and scene are ready. Control feedback now refreshes only when visual state changes using existing render loop. Baseline abort banking and teaching speed behavior preserved.

## [PROGRESS]
- 2026-10-29T12:25Z [TOOL] Copied source support and original Spill design reference. Extraction in progress; no launch/visual/parity claim yet.

## [OUTCOMES]
- 2026-10-29T12:46Z [TOOL] Supersedes pending implementation: Spill-only browser host, scoped loader, independent storage, static build, launcher and container/CI workflows implemented. npm run check passes typecheck/build/125 exact assets (10,529,964 bytes)/9 test files; audit and diff checks pass. Includes deterministic source parity and192 ship render configurations. Original source checkout and Unreal assets unchanged.
- 2026-10-29T12:46Z [TOOL] Real browser UI reached free-upgrade Depot, Wave1 and pause, no console errors/warnings; desktop/narrow layout bounds inspected. Browser screenshots unavailable; full overlay visual comparison and physical-device/audio/performance acceptance UNCONFIRMED. See docs/VALIDATION.md. PR publication next, do not merge without owner approval.
