# MobileWaveRun

The Spill (Debris Field) from AcornautSandbox, isolated as a browser game. This baseline keeps the current side-view flight, artwork, wave rules, upgrades, utilities, contracts, and Depot checkpoints. It is the starting point for quick gameplay experiments before considering front-facing flight or a mobile engine conversion.

## Play locally

On Windows with existing Node.js22+, double-click **Launch MobileWaveRun.cmd**. Keep its server window open while playing. It builds and opens http://127.0.0.1:8795.

Container workflow (default):

```sh
docker build -t mobile-wave-run .
docker run --rm -p 127.0.0.1:8795:8795 mobile-wave-run
```

Then open http://127.0.0.1:8795. If Docker is unavailable, use existing Node.js22+ with repository-local dependencies:

```sh
npm ci
npm run check
npm start
```

The owner's Pages domain is **quarterdrop.app**, preserved in `CNAME`. `.github/workflows/pages.yml` validates and publishes `dist/` on pushes to `main`; PRs only build and test. GitHub Pages must use **GitHub Actions** as its build source. The deployment job is limited to `main`, so this extraction does not publish until merged. Custom-domain DNS and TLS are managed by the existing Pages configuration.

You can also serve `dist/` from any static HTTP host, including a subdirectory. Do not open the HTML through `file://`; browser module loading requires HTTP. The PR workflow produces a downloadable `MobileWaveRun-browser` artifact. Native mobile packaging is a later step.

## Play and saves

Start a new run from the menu, select a free starter upgrade in the first Depot, and launch. The in-game Controls sheet explains tapping to rise, diving, lunging, and equipment. Clear waves and visit the Depot every five waves. Save and quit from the Depot to resume that checkpoint later. Active flight is not a mid-wave save.

Saves use only `mobilewaverun:`-prefixed browser storage. Existing Acornaut saves are neither imported nor modified. Private browsing or unavailable storage falls back to the current session; clearing this site's browser data clears its saves. Use a consistent browser and URL/port to retain progress.

## Development and checks

Edit `illustrated-src/game/`; `dist/js` is generated. `npm run check` runs TypeScript checks, builds the static game, verifies asset provenance, and runs the extracted Spill regression tests plus standalone/save-isolation checks. There is no separate lint setup; use `npm run typecheck` and `git diff --check`. Render-test images are written under ignored `tests/.artifacts/`. See `docs/VALIDATION.md` for results and limits of the extraction checks.

The host and asset loader are scoped to Spill. Some shared engine, renderer and support modules remain because the original game intertwines them with this mode. They preserve the baseline's rendering/input behavior; the standalone host and engine reject other playable modes. No native app shell, advertisements, purchases, campaign map, cosmetic shop, or development editor is exposed.

## Origin and boundaries

Extracted from [AcornautSandbox](https://github.com/j6sistek-ui/AcornautSandbox) commit `b67bb50f3f3fa24b6a335133a1c176638a83f775` (2026-10-28). See `docs/UPSTREAM_SPILL.md` for the original design reference and `asset-manifest.json` for copied asset paths and SHA-256 hashes. The parity checks normalize line endings only. Source and art retain the original proprietary license in `LICENSE`; public visibility does not grant reuse rights.

This extraction does not alter movement balance or convert the camera to 3D. Phoenix/Unreal assets are not included. Next is a review of SpaceSurvival's original scope beyond Phase1 to select mechanics worth trialing here. Physical phone performance, touch ergonomics and native packaging still require device testing.
