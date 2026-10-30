# MobileWaveRun

The Spill (Debris Field) from AcornautSandbox, developed as a standalone browser arcade game. Keep flying through debris, shoot a path with Rapid Laser or Heavy Cannon, and fight short enemy encounters between Depot visits. Side-view movement, utilities, contracts, endless waves and Depot checkpoints remain the foundation for quick experiments before considering front-facing flight or a mobile engine conversion.

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

Start a new run, choose a weapon and a free starter system in the first Depot, and launch. Both weapons are available immediately. Touch the field and **drag up/down** to steer: a faint floating joystick appears under your first finger. Release to hold height. **Tap with a second finger** to shoot, or hold it for repeated fire. Quickly **flick the steering finger left/right** to dodge in that direction. There are no fixed flight buttons. On a keyboard, use **W/S or Up/Down** to steer, **A/D or Left/Right** to dodge, and **F or Space** to fire. Mouse dragging also steers.

Gameplay gestures stay inside the playfield instead of zooming or scrolling the browser; menu scrolling remains available. Forward aim assistance helps line up nearby targets, but you choose when to fire. Wave 1 introduces shooting debris; enemy encounters begin at Wave 2. Enemy shots are warned before firing and debris can provide cover. See [controls and tuning](docs/CONTROLS.md).

**Landscape:** turn the phone sideways; the field and menus fit the available viewport in either orientation. The phone's rotation lock must be off. Rotating during flight pauses the same run and releases held controls; tap **Resume**, then touch again. Side notches stay outside the playfield and dialogs, and the layout follows browser-bar height changes.

Clear waves and visit the Depot every five waves. Switch weapons for free or spend run coins on weapon tiers, alongside the existing systems, utilities and contracts. Save and quit from the Depot to resume the build later; older checkpoints receive the default Rapid Laser. Active flight is not a mid-wave save. See [combat rules and tuning](docs/COMBAT.md).

Saves use only `mobilewaverun:`-prefixed browser storage. Existing Acornaut saves are neither imported nor modified. Private browsing or unavailable storage falls back to the current session; clearing this site's browser data clears its saves. Use a consistent browser and URL/port to retain progress.

## Development and checks

Edit `illustrated-src/game/`; `dist/js` is generated. `npm run check` runs TypeScript checks, builds the static game, verifies asset provenance, and runs the extracted Spill regression tests plus standalone/save-isolation checks. There is no separate lint setup; use `npm run typecheck` and `git diff --check`. Render-test images are written under ignored `tests/.artifacts/`. See `docs/VALIDATION.md` for results and limits of the extraction checks.

The host and asset loader are scoped to Spill. Some shared engine, renderer and support modules remain because the original game intertwines them with this mode. The standalone host and engine reject other playable modes; Spill's current controls are documented above. No native app shell, advertisements, purchases, campaign map, cosmetic shop, or development editor is exposed.

## Origin and boundaries

Extracted from [AcornautSandbox](https://github.com/j6sistek-ui/AcornautSandbox) commit `b67bb50f3f3fa24b6a335133a1c176638a83f775` (2026-10-28). See `docs/UPSTREAM_SPILL.md` for the original design reference and `asset-manifest.json` for unchanged copied asset hashes. Combat and joystick flight are authorized extensions; old tap/gravity movement traces are superseded by joystick regressions. New enemy sprites have separate generated provenance in [COMBAT_ASSETS](docs/COMBAT_ASSETS.md). Source and art retain the proprietary license in `LICENSE`; public visibility does not grant reuse rights.

The SpaceSurvival scope review selected weapons and enemies as the first adaptation. There is no navigable station, camera conversion, Phoenix/Unreal asset import or new playable mode. Physical phone performance, touch ergonomics, long-run combat balance and native packaging still require device testing.
