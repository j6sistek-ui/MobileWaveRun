# MobileWaveRun contributor instructions

Read `.agent/CONTINUITY.md` and `README.md` before substantive changes.

This repository develops AcornautSandbox's extracted The Spill/Debris Field as a standalone browser game. The owner authorized priority-one weapons/enemies and then floating joystick flight with second-finger firing and left/right dodge on 2026-10-29. Keep the side view and existing Depot; do not restore tap-to-fly or fixed flight pads. No navigable station. Do not introduce a new engine, 3D flight, Phoenix assets, monetization, or other playable modes without owner direction.

The owner subsequently approved landscape support and Phase2 distinct builds. Phase2 adds optional run-only artifact cores, existing-module build guidance and Depot recovery/refitting; keep all choices in the Depot and preserve the accepted gesture controls. See `docs/BUILDS.md` for the rules and scope.

Phase3 is authorized: mechanically distinct space hazards with progressive lessons, variants and compatible combinations. Keep warnings and shared pressure limits; gravity must preserve stock steering counterplay and use the same debris trajectory for prediction and motion. The Depot forecast reads the rule metadata. See `docs/HAZARDS.md` and `docs/HAZARD_BENCHMARK.md` for tuning and the full-scope/primary-source review.

The owner subsequently confirmed the full remaining playable package: solar cover, fracturing wrecks, environmental enemy interactions, risky salvage, fifth-wave elites, optional risk routes and earned chassis/weapon-module sidegrades. Flight Trials are authorized practice entries into the same rules for immediate evaluation. Trials must never write, bank, unlock, submit scores or replace a real checkpoint. Keep first lessons plain, pressure bounded, reward ledgers once-only and a stock-ship movement answer. See `docs/EVALUATION.md`. This does not authorize a 3D conversion or imply owner gameplay acceptance.

The owner authorized a complete independent interface identity on 2026-10-30 using the supplied UIFBRCA Space Station kit and generated artwork. The temporary title is The Spill. Preserve gameplay, all actions and save schemas; visible currency is Salvage while internal legacy names stay compatible. Use the dark navy/metal/cyan system, Orbitron/Rajdhani, readable active/selected/disabled states and responsive edge HUDs. Keep menus scrollable, focus restoration and gesture controls intact. See `docs/UI_IDENTITY.md` for the presentation hooks and provenance. Ship only the incorporated runtime subset, retain the uifabrica.com Settings credit and license/OFL notices, and never upload the full editable kit as an asset pack. Record added assets in `ui-asset-manifest.json`; preserve the two historical asset manifests unchanged and bump `ART_VER` for runtime artwork changes.

The generated neutral hull skin replaces the visible acorn/pilot while using the original sprite coordinate space and retaining upgrade attachments and tier indicators. Keep its exact source-reference provenance in `docs/ui-image-prompts.json`; visual changes must not change ship collision geometry or balance.

Edit TypeScript under `illustrated-src/game/`. `docs/UPSTREAM_SPILL.md` preserves the extraction baseline; subsequent authorized gameplay changes are documented separately. Preserve unchanged upstream artwork and provenance. Shared rendering/simulation support may remain; only Spill may be launched. Keep saves isolated from Acornaut.

Default verification uses the repository Dockerfile: `docker build -t mobile-wave-run .` then `docker run --rm mobile-wave-run`. Never install host system packages. If Docker is unavailable, record the limitation and use existing Node with workspace-local `npm ci`; run build, typecheck and tests. No lint script: use typecheck and `git diff --check`.

Keep original artwork provenance and hashes. Do not publish licensed Unreal assets or private source payloads in this public repository. Use scoped commits and a PR; never merge without explicit authorization for that PR. Report omitted tests and distinguish source/DOM checks from actual browser or physical-device play.
