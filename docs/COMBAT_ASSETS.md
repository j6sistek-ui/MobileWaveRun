# Combat artwork

The pursuer and flanker were generated with the built-in `image_gen` tool on 2026-10-29 for MobileWaveRun. Both face left. Red armor identifies the compact pursuer; a broad teal/ivory silhouette identifies the flanker. Their metal panels and rivets follow the existing ship's illustrated style.

The PNGs in `public/art/spill-combat/` are unchanged copies of the generated outputs, including source resolution and transparent alpha. No cropping, recoloring, resizing or background removal was applied to the files. Runtime fitting uses a measured alpha bounding box, so transparent padding does not shrink the visible hull. Exhaust, warnings, projectiles, target brackets and brief hit feedback are drawn separately by `spill-combat-view.ts`.

Exact prompts are recorded in [combat-image-prompts.json](combat-image-prompts.json). Generation IDs, byte sizes and SHA-256 hashes are recorded separately in [generated-asset-manifest.json](../generated-asset-manifest.json). These files are generated assets, not Acornaut upstream artwork. The original 125-file `asset-manifest.json` remains the authority for unchanged upstream art and fonts.

`npm run verify-assets` verifies both provenance sets and rejects any unlisted shipped art. Combat images load with the initial art bank; readiness waits for both requests to settle. A failed network request uses a distinct visible fallback silhouette and records `spillCombatStatus: "fallback"`, so the game does not hang or turn an enemy invisible. The real-canvas test requires both production PNGs to load successfully and separately exercises fallback behavior.

`tests/test-combat-render.mjs` writes combat frames to ignored `tests/.artifacts/combat-render/` at 320×760, 390×760 and 1280×720. It verifies deterministic painting, unchanged simulation state, transparent sprite padding, team/weapon readability, and weapon HUD bounds. These canvas checks do not certify physical-device performance, touch ergonomics or final owner acceptance.
