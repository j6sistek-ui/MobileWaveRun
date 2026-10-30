# The Spill: interface identity

The working title remains **The Spill**. This presentation pass separates the browser game from Acornaut's menu identity while keeping its side-view wave game, Depot, controls and save compatibility. It does not select a future 3D engine or change encounter, damage, movement, reward or unlock rules.

## Visual system

Near-black navy surfaces, brushed metal edges and cyan illumination connect the menu, briefing, Depot, loadout, Settings & Controls, pause, results and flight HUD. Amber marks rewards or cautions. Orbitron supplies compact display headings; Rajdhani supplies readable labels, descriptions and numbers. Both are self-hosted, with system fallbacks; no host font installation or runtime font service is required.

The generated station backdrop is menu artwork, not a navigable station or a gameplay corridor. The title wordmark is decorative artwork accompanied by accessible text. Buttons and card content remain real DOM text, so state labels, prices and explanations are not baked into images.

Build for the phone first: prominent start/resume action, a compact framed ship preview, readable secondary choices and comfortable touch targets. Extra desktop space may widen the composition without turning the phone menu into a compressed desktop dashboard. Use the supplied example assemblies when composing the kit; the ship panel's top opening is the position for its centered **YOUR SHIP** nameplate.

Visible currency is **Salvage**, represented by a neutral cyan resource token. Internal `ore`, `coins`, save fields and imported rule metadata remain compatible. The bear/squirrel mascot presentation and named Acornaut pilot framing are removed from the standalone surfaces. A generated steel/navy hull with a sealed cyan canopy replaces the visible acorn hull and pilot. This hull-only skin uses the original 256-pixel sprite coordinate space; existing engine, nose and utility attachments remain, with plating/shield tier marks retained. Collision geometry and gameplay rules stay unchanged. The extraction's original files remain preserved.

## Current navigation

The main menu combines the former Settings and Controls choices into **Settings & Controls**. The concise **Settings** nameplate fits narrow phones. Existing switches remain on this page, with the full flight instructions, field guide and Depot help inside expandable **Controls & Field Guide**. The existing help route opens this same combined page.

At the owner's direction on 2026-10-30, **Flight Trials are hidden for now**. The host no longer exposes the trial picker, its menu entry or choose-trial links; there is no hidden production shortcut. Encounter metadata, practice simulation, save isolation and trial retry/result behavior remain for regression tests and a later return. Current player navigation uses normal runs; historical trial screenshots and validation remain evidence of the earlier presentation, not a currently available menu.

## Layout and behavior contract

- Keep the flight center clear. HUD information belongs around the playfield edges; decorative frames must not become touch targets or conceal hazard warnings.
- Preserve portrait and landscape layouts, browser safe-area insets, rotation pause and the existing floating joystick. Do not add fixed flight buttons.
- Assemble a panel from its separate honeycomb surface, outer metal frame and cyan nameplate. Inset the surface behind the transparent bevels so rectangular backing cannot protrude around corners. Keep label text inside the nameplate and content inside the frame. Nine-slice resizable controls and frames so their metal bevels retain a consistent thickness; do not stretch the whole border image to unrelated aspect ratios.
- Let long Depot, guide, loadout and settings content scroll, including expanded control instructions. Apply the same requirement if trial navigation returns. The Depot's outer shell owns the frame and separate title plate; its top bar, middle scroller and footer occupy separate rows with the same side inset. Health, Shields and the existing Repair action belong in the top bar. Keep `.ac-depotcard` as the middle scroll/focus target; launch/save actions must not overlay its content.
- The Depot's ship/system bay and outfitting sections may sit side by side when space permits and stack on narrow screens. In short landscape, place the four system controls in a row below the full ship preview, rather than over its image. Keep the free-upgrade message with the selected-system purchase. Depot guides retain their separate scrollable card; they do not use the workshop shell.
- Keep the selected weapon visibly equipped even though its equip button is disabled. Selected, locked, insufficient-funds, completed, temporarily arming, hover, pressed and keyboard-focus states must be distinguishable. State text and `aria-pressed` carry meaning in addition to color.
- Retain the remaining `data-action`, `data-spill-control`, `data-career-choice`, `data-ship-starter` and `data-ship-color` hooks; only the explicitly superseded Controls entry and trial navigation were removed. Existing focus restoration, details expansion, scroll restoration, modal behavior and checkpoint actions continue to apply.
- Honor reduced motion and avoid decorative continuous motion during navigation. Preserve the action labels and readable contrast when backgrounds or fonts are unavailable.

The shared presentation hooks are `mwr-panel`, `mwr-section`, `mwr-option`, `mwr-depot-layout`, `mwr-depot-bay`, `mwr-depot-outfitting`, `mwr-control-card` and `data-ui-state`. The Depot adds `mwr-depot-shell`, `mwr-depot-topbar`, `mwr-depot-vitals`, `mwr-depot-ship-stage` and `mwr-depot-upgrade-note`. Its shell contains the single `h2.mwr-panel-title`, header, `.ac-depotcard` and footer as siblings; the title plate sits over the frame's top gap. `data-ui-state` describes presentation only; engine methods remain the authority for purchases, unlocks and launch guards. Avoid reimplementing rules in styles or UI state attributes.

## Supplied assembly references

The supplied examples were inspected on 2026-10-30. These source images remain private; their receipts identify the references without adding their 19 MB to the repository.

| Inspected local source filename | Bytes | SHA-256 |
| --- | ---: | --- |
| `preview-panels.png` | 11,806,098 | `9a776138415078707925aa98514cc3f8c94daa3793cbdd55b100a0773646a0aa` |
| `preview-buttons.png` | 7,205,272 | `17aa3e4cdeab77478641a1e2155dbe1a8abaeb30e15d533bd57dbf87540358c0` |

The settings example layers `Panels__01.png` (dark honeycomb insert), `Panels__02.png` (transparent outer frame) and `Panels__04.png` (wide cyan title plate). `Panels__05.png` is the shorter title variant. The pause example uses a narrow frame; neither example uses the transparent frame alone as the panel body. Text remains centered within the title plate, and button faces sit inside their separate metal frames.

For future sizing work, the runtime frame is 960 x 651: its top rails end near x330 and resume near x629 at y60. Keep those arms and the corners out of the stretched middle, then center the independent nameplate over the gap. The button composites are 600 x 211 and the title plate is 480 x 126. Nine-slicing preserves the outer bevels; the button's small central cyan notches sit in the stretched middle, so extreme widths still require a separate center ornament or a more restrained aspect ratio. Check the assembled result at its actual phone size, not just the source image.

## Runtime assets and provenance

`ui-asset-manifest.json` inventories **23 files / 2,084,507 bytes**. These are additive; the original 125 extraction files and two generated combat sprites retain their own manifests and hashes.

| Runtime group | Files | Preparation |
| --- | ---: | --- |
| Space Station panel frame/surface/nameplate | 3 | Frame and surface resampled to 960 px wide; nameplate to 480 x 126 |
| Primary button idle/active | 2 | Supplied metal frame and cyan face composed at 600 x 211 |
| Play, retained Trials, Settings and target icon states | 8 | Supplied frame, face and symbol composed at 128 x 125 |
| Salvage token | 1 | Supplied metal base with an original three-cell cyan mark, 96 x 96 |
| Generated backdrop and title | 2 | Backdrop 1672 x 941 WebP; transparent wordmark 1200 x 400 PNG |
| Generated hull identity skin | 1 | Transparent 256 x 256 PNG; edited from the exact preserved `spill-ship/hull-0.png` reference |
| Orbitron and Rajdhani fonts/licenses | 6 | Four unmodified TTF files and two OFL notices |

Only the runtime subset is included. The full supplied Space Station/BtnPack archives, editable kit sources, high-resolution source PNGs and private generation originals are not shipped. Every derivative records source filenames, source hashes and its preparation recipe. Generated artwork additionally records generation IDs and exact prompts in [ui-image-prompts.json](ui-image-prompts.json); the hull edit also records its reference file's hash and size. Source hashes are provenance records; clean-checkout verification checks the shipped files and does not require private source archives.

`npm run verify-assets` checks exact byte counts and SHA-256 hashes, unique local paths, the runtime subset, generation-prompt coverage, official font source URLs, all self-hosted font URLs and the supplied license receipt. It also rejects unlisted files or symlinks in the shipped art/font inventory. Continue to bump `ART_VER` when altering runtime artwork. Do not rewrite historical manifests to make a modified upstream file pass.

## Credits and licenses

Space Station UI components: **uifabrica.com / Studio PUNCHEV LTD**, copyright 2018. The supplied [UF License Version 1.1](licenses/UIFBRCA-EULA.pdf) is preserved byte-for-byte (SHA-256 `caa192fc64c636dd61b7acecfe70b842d299680abdafbe10894cafcc54905466`). The game includes the required `uifabrica.com` credit on the combined Settings & Controls page.

License paraphrase: the supplied terms permit personal/commercial work, game/web/mobile app use and component modification; website use requires the credit. The UI set itself and derivative UI sets must not be resold or redistributed without the authors' written consent. These files are incorporated as the game's runtime interface, not offered as a reusable asset pack. Keep the full archives and editable sources private.

Fonts come from the official Google Fonts [Orbitron](https://github.com/google/fonts/tree/main/ofl/orbitron) and [Rajdhani](https://github.com/google/fonts/tree/main/ofl/rajdhani) directories, acquired 2026-10-30. Both use SIL Open Font License 1.1 (26 February 2007). Copyright and license notices ship in `public/fonts/space-ui/OFL-Orbitron.txt` and `OFL-Rajdhani.txt`. These third-party rights are separate from the game's proprietary [LICENSE](../LICENSE).

## Validation boundary

The asset verifier is an integrity/provenance check, not proof of layout, device performance or owner acceptance. The shared build, regression suite and actual browser/device review are recorded separately in [VALIDATION.md](VALIDATION.md). This document makes no claim that the latest navigation changes have passed those checks. Before accepting the UI, inspect menu, combined Settings & Controls with the guide expanded, briefing, opening and later Depots, locked/equipped choices, pause and results at narrow portrait, short landscape and desktop sizes; exercise keyboard focus, scrolling, second-finger fire, rotation and saved-run resume. Recheck trial navigation if it is restored.
