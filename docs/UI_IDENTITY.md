# The Spill: interface identity

The working title remains **The Spill**. This presentation pass separates the browser game from Acornaut's menu identity while keeping its side-view wave game, Depot, controls and save compatibility. It does not select a future 3D engine or change encounter, damage, movement, reward or unlock rules.

## Visual system

Near-black navy surfaces, brushed metal edges and cyan illumination connect the menu, briefing, Depot, Flight Trials, loadout, Settings, pause, results and flight HUD. Amber marks rewards or cautions. Orbitron supplies compact display headings; Rajdhani supplies readable labels, descriptions and numbers. Both are self-hosted, with system fallbacks; no host font installation or runtime font service is required.

The generated station backdrop is menu artwork, not a navigable station or a gameplay corridor. The title wordmark is decorative artwork accompanied by accessible text. Buttons and card content remain real DOM text, so state labels, prices and explanations are not baked into images.

Visible currency is **Salvage**, represented by a neutral cyan resource token. Internal `ore`, `coins`, save fields and imported rule metadata remain compatible. The bear/squirrel mascot presentation and named Acornaut pilot framing are removed from the standalone surfaces. A generated steel/navy hull with a sealed cyan canopy replaces the visible acorn hull and pilot. This hull-only skin uses the original 256-pixel sprite coordinate space; existing engine, nose and utility attachments remain, with plating/shield tier marks retained. Collision geometry and gameplay rules stay unchanged. The extraction's original files remain preserved.

## Layout and behavior contract

- Keep the flight center clear. HUD information belongs around the playfield edges; decorative frames must not become touch targets or conceal hazard warnings.
- Preserve portrait and landscape layouts, browser safe-area insets, rotation pause and the existing floating joystick. Do not add fixed flight buttons.
- Let long Depot, guide, loadout and trial content scroll. The Depot's ship/system bay and outfitting sections may sit side by side when space permits and stack on narrow screens. Launch/save actions remain outside the two-column content group.
- Keep the selected weapon visibly equipped even though its equip button is disabled. Selected, locked, insufficient-funds, completed, temporarily arming, hover, pressed and keyboard-focus states must be distinguishable. State text and `aria-pressed` carry meaning in addition to color.
- Retain all `data-action`, `data-spill-control`, `data-career-choice`, `data-ship-starter` and `data-ship-color` hooks. Existing focus restoration, details expansion, scroll restoration, modal behavior and checkpoint actions continue to apply.
- Honor reduced motion and avoid decorative continuous motion during navigation. Preserve the action labels and readable contrast when backgrounds or fonts are unavailable.

The shared presentation hooks are `mwr-panel`, `mwr-section`, `mwr-option`, `mwr-depot-layout`, `mwr-depot-bay`, `mwr-depot-outfitting`, `mwr-control-card` and `data-ui-state`. The latter describes presentation only; engine methods remain the authority for purchases, unlocks and launch guards. Avoid reimplementing rules in styles or UI state attributes.

## Runtime assets and provenance

`ui-asset-manifest.json` inventories **22 files / 2,078,969 bytes**. These are additive; the original 125 extraction files and two generated combat sprites retain their own manifests and hashes.

| Runtime group | Files | Preparation |
| --- | ---: | --- |
| Space Station panel frames/surfaces | 2 | Supplied art resampled to 960 px wide |
| Primary button idle/active | 2 | Supplied metal frame and cyan face composed at 600 x 211 |
| Play, Trials, Settings and target icon states | 8 | Supplied frame, face and symbol composed at 128 x 125 |
| Salvage token | 1 | Supplied metal base with an original three-cell cyan mark, 96 x 96 |
| Generated backdrop and title | 2 | Backdrop 1672 x 941 WebP; transparent wordmark 1200 x 400 PNG |
| Generated hull identity skin | 1 | Transparent 256 x 256 PNG; edited from the exact preserved `spill-ship/hull-0.png` reference |
| Orbitron and Rajdhani fonts/licenses | 6 | Four unmodified TTF files and two OFL notices |

Only the runtime subset is included. The full supplied Space Station/BtnPack archives, editable kit sources, high-resolution source PNGs and private generation originals are not shipped. Every derivative records source filenames, source hashes and its preparation recipe. Generated artwork additionally records generation IDs and exact prompts in [ui-image-prompts.json](ui-image-prompts.json); the hull edit also records its reference file's hash and size. Source hashes are provenance records; clean-checkout verification checks the shipped files and does not require private source archives.

`npm run verify-assets` checks exact byte counts and SHA-256 hashes, unique local paths, the runtime subset, generation-prompt coverage, official font source URLs, all self-hosted font URLs and the supplied license receipt. It also rejects unlisted files or symlinks in the shipped art/font inventory. Continue to bump `ART_VER` when altering runtime artwork. Do not rewrite historical manifests to make a modified upstream file pass.

## Credits and licenses

Space Station UI components: **uifabrica.com / Studio PUNCHEV LTD**, copyright 2018. The supplied [UF License Version 1.1](licenses/UIFBRCA-EULA.pdf) is preserved byte-for-byte (SHA-256 `caa192fc64c636dd61b7acecfe70b842d299680abdafbe10894cafcc54905466`). The game includes the required `uifabrica.com` credit in Settings.

License paraphrase: the supplied terms permit personal/commercial work, game/web/mobile app use and component modification; website use requires the credit. The UI set itself and derivative UI sets must not be resold or redistributed without the authors' written consent. These files are incorporated as the game's runtime interface, not offered as a reusable asset pack. Keep the full archives and editable sources private.

Fonts come from the official Google Fonts [Orbitron](https://github.com/google/fonts/tree/main/ofl/orbitron) and [Rajdhani](https://github.com/google/fonts/tree/main/ofl/rajdhani) directories, acquired 2026-10-30. Both use SIL Open Font License 1.1 (26 February 2007). Copyright and license notices ship in `public/fonts/space-ui/OFL-Orbitron.txt` and `OFL-Rajdhani.txt`. These third-party rights are separate from the game's proprietary [LICENSE](../LICENSE).

## Validation boundary

The asset verifier is an integrity/provenance check, not proof of layout, device performance or owner acceptance. The shared build, regression suite and actual browser/device review are recorded separately in [VALIDATION.md](VALIDATION.md). This document makes no claim that the new interface has passed those checks. Before accepting the UI, inspect menu, briefing, opening and later Depots, locked/equipped choices, pause, results and Trials at narrow portrait, short landscape and desktop sizes; exercise keyboard focus, scrolling, second-finger fire, rotation and saved-run resume.
