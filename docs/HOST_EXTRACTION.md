# Spill browser host extraction

Upstream: `j6sistek-ui/AcornautSandbox` at `b67bb50f3f3fa24b6a335133a1c176638a83f775`.

The new `illustrated-src/game/standalone.ts` replaces the multi-mode navigation shell. It calls the original `createEngine`, `paintShipPreview`, and exported Spill workshop builders. Flight rules, geometry, collision, purchases, progression, fixed stepping and the canvas painter are not implemented by the host.

The host retains the opening briefing/free upgrade, ordinary Depots, save and resume, pause controls, results, help, earned starting utility and engine-color selection. Ship planning previews the next starting kit and any suspended build; it does not buy upgrades or change the suspended ship. The shared DOM flight controls remain outside the replaced menu overlay so pointer ownership survives updates. Scroll position and control focus survive workshop updates.

The engine refuses non-Spill launches, all Star Chart launches, tutorial replay and the flight lab. The standalone bootstrap uses the original stock Flight suit, Clear helmet, Sparks trail and no PAL; it skips the unrelated normal-flight onboarding without granting its reward kit. Original store-receipt and daily-currency boot actions are omitted. Shared support for other modes may remain imported for renderer parity but has no launch route.

## Entry contract

- Serve over HTTP and set `window.__ACORNAUT_ART__` before importing the host.
- Install the isolated `window.__acornautPlatform.storage` adapter before any game import. The host itself never reads or writes raw browser storage.
- Call `bootStandalone(document.getElementById("app"))`. Startup failures reject this promise and show an error in the page.
- New-run and resume entry points reject input until the stock art bank and Spill scene are ready; early keyboard input cannot start a hidden run or consume a checkpoint.
- Retain the original base CSS and Spill workshop CSS, local Figtree/Fraunces fonts and viewport safe-area configuration.
- The host creates `.ac-root > .ac-stage`, the canvas, overlay and persistent controls. The engine inserts `.ac-backplate` before the canvas.
- `window.__sandbox` exposes the existing engine for tests. New shell buttons use `data-action`; the original workshop `data-spill-control`, `data-ship-starter` and `data-ship-color` attributes are unchanged.
- `subscribeFrame` refreshes only cached flight-control presentation state on the existing engine animation clock. It does not step gameplay or rebuild menus, and stops with the engine.

Verification must include actual browser layout and touch/keyboard behavior in addition to TypeScript and DOM tests. Source extraction does not establish phone performance or physical touch feel.
