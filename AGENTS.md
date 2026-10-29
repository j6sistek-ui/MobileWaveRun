# MobileWaveRun contributor instructions

Read `.agent/CONTINUITY.md` and `README.md` before substantive changes.

This repository extracts AcornautSandbox's The Spill/Debris Field into its own browser game. Preserve the existing side-view mechanics and artwork in this baseline. Do not introduce a new engine, 3D flight, Phoenix assets, monetization, or other playable modes without owner direction. The broader SpaceSurvival scope review follows this extraction.

Edit TypeScript under `illustrated-src/game/`. `docs/UPSTREAM_SPILL.md` is the preserved design reference; source at the pinned upstream revision is the parity authority. Shared rendering/simulation support may remain during the baseline extraction; only Spill may be launched. Keep saves isolated from Acornaut.

Default verification uses the repository Dockerfile: `docker build -t mobile-wave-run .` then `docker run --rm mobile-wave-run`. Never install host system packages. If Docker is unavailable, record the limitation and use existing Node with workspace-local `npm ci`; run build, typecheck and tests. No lint script: use typecheck and `git diff --check`.

Keep original artwork provenance and hashes. Do not publish licensed Unreal assets or private source payloads in this public repository. Use scoped commits and a PR; never merge without explicit authorization for that PR. Report omitted tests and distinguish source/DOM checks from actual browser or physical-device play.
