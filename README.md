# MobileWaveRun

**The Spill** is a standalone browser space-survival arcade game, originally extracted from AcornautSandbox's Debris Field mode. Keep flying through debris, shoot a path with Rapid Laser or Heavy Cannon, and fight short enemy encounters between Depot visits. Side-view movement, utilities, contracts, endless waves and Depot checkpoints remain the foundation for quick experiments before considering front-facing flight or a mobile engine conversion.

The interface now uses a dedicated navy, metallic and cyan identity across menus, the Depot and flight HUD, with a generated title/backdrop, Space Station UI components and self-hosted Orbitron/Rajdhani fonts. A steel/navy ship hull replaces the visible acorn and pilot while retaining the existing attachment layout. **Salvage** is the visible currency name; existing saves and gameplay values remain compatible. The Spill remains a working title. See [interface identity and credits](docs/UI_IDENTITY.md).

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

Clear waves and visit the Depot every five waves. Switch weapons for free or spend run Salvage on weapon tiers, alongside the existing systems, utilities and contracts. Save and quit from the Depot to resume the build later; older checkpoints receive the default Rapid Laser. Active flight is not a mid-wave save. See [combat rules and tuning](docs/COMBAT.md).

**Phase 2 builds:** recover one free artifact at the wave 5 Depot, then waves 15, 25 and later ten-wave intervals while any remain unowned. Reclaimer rewards weapon salvage, Slipstream Relay adds a dodge-primed echo, and Siege Core trades firing speed for impact blasts. Fit one core at a time and refit owned cores free at the Depot. Optional build plans connect them to existing modules; nothing is purchased automatically. Artifacts last only for the current run. See [build rules and playtest](docs/BUILDS.md).

**Phase 3 hazards:** comet strikes begin at wave 4, drifting mines at 7, ion storms at 11 and gravity wells at 16. Read the marked comet path, shoot or escape a mine's fuse radius, move out of a charging ion band, and countersteer around wells that also bend debris. Later waves introduce sequential families, selected pairs and advanced patterns. The Depot's **Next five waves** forecast and field guide help you prepare. See [hazard rules](docs/HAZARDS.md) and the [full-scope review and game benchmark](docs/HAZARD_BENCHMARK.md).

**Complete wave experiment:** solar flares with destructible cover arrive at wave 22, and weak-point wrecks with warned fragments at 27. Mines, comets and gravity-affected debris can hurt enemies; optional gold rides gravity rims. Every fifth wave from 10 builds to a shield/open-core Warden. Depots offer optional five-wave risk routes, and normal progress earns chassis and targeting tradeoffs. See [the evaluation guide](docs/EVALUATION.md).

**Try everything now:** choose **Flight Trials** on the main menu, pick an encounter and build, then launch from its Depot. Retry from Pause or the result. Trials use real gameplay rules and make every chassis/module available, while preserving normal saves, records and unlocks. Two route trials cover all five waves and their actual completion bonuses. Start with Solar cover, Fracturing wreck, Gravity and salvage, then Wave climax.

Saves use only `mobilewaverun:`-prefixed browser storage. Existing Acornaut saves are neither imported nor modified. Private browsing or unavailable storage falls back to the current session; clearing this site's browser data clears its saves. Use a consistent browser and URL/port to retain progress.

## Development and checks

Edit `illustrated-src/game/`; `dist/js` is generated. `npm run check` runs TypeScript checks, builds the static game, verifies asset provenance, and runs the extracted Spill regression tests plus standalone/save-isolation checks. There is no separate lint setup; use `npm run typecheck` and `git diff --check`. Render-test images are written under ignored `tests/.artifacts/`. See `docs/VALIDATION.md` for results and limits of the extraction checks.

The host and asset loader are scoped to Spill. Some shared engine, renderer and support modules remain because the original game intertwines them with this mode. The standalone host and engine reject other playable modes; Spill's current controls are documented above. No native app shell, advertisements, purchases, campaign map, cosmetic shop, or development editor is exposed.

## Origin and boundaries

Extracted from [AcornautSandbox](https://github.com/j6sistek-ui/AcornautSandbox) commit `b67bb50f3f3fa24b6a335133a1c176638a83f775` (2026-10-28). See `docs/UPSTREAM_SPILL.md` for the original design reference and `asset-manifest.json` for unchanged copied asset hashes. Combat and joystick flight are authorized extensions; old tap/gravity movement traces are superseded by joystick regressions. New enemy sprites have separate generated provenance in [COMBAT_ASSETS](docs/COMBAT_ASSETS.md). The interface subset has its own `ui-asset-manifest.json`, [credits and provenance](docs/UI_IDENTITY.md). Proprietary game material retains `LICENSE`; third-party UIFBRCA artwork and OFL fonts retain their supplied terms. Public visibility does not grant additional reuse rights.

The SpaceSurvival scope review selected weapons/enemies, distinct builds, broader hazards, fifth-wave climaxes, optional risks and persistent loadout choices. These now form a playable side-view evaluation package, with practice entries into the same wave mode. There is no navigable station, camera conversion or Phoenix/Unreal asset import. Physical phone performance, touch ergonomics, long-run balance and native packaging still require device testing.
