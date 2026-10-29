# Spill scene art

New artwork generated with the built-in image-generation tool, September 5,
2026, for the approved Spill survival update. Original generated PNGs are
retained here; they are not substitutions for collision geometry or HUD text.

| File | Dimensions | Use |
|---|---|---|
| `depot.png` | 1536 × 1024 | Illustrated docking transition and Depot stage |
| `panorama.png` | 2048 × 683 | Four sector crops behind the procedural starfield |

## Prompt set / art direction

**Depot:** Painterly science-fiction salvage dock for Acornaut's illustrated
survival game. A bronze industrial docking arm and clamps occupy the right
half, violet portal illumination, a small acorn insignia, midnight blue space
and restrained cyan lights. Preserve open space on the left for the modular
player ship. Match the worn bronze, silver and white ship kit; no characters,
ships, captions, labels or interface elements. The existing
`art-src/spill-ship-concepts/dock-painted.jpg` was inspected as visual direction.

**Sector panorama:** A continuous 3:1 illustrated deep-space panorama. Travel
from bronze asteroid wreckage on the left through violet cargo platforms and
cyan reactor debris to a large amber acorn mining rig on the right. Keep the
central half dark and readable, with most structures near the top/bottom;
no ships, characters or text. The image must crop into four connected sector
views while remaining consistent with the game's painted ship materials.

Generated output identifiers: Depot `exec-5a52cf47-8883-4cee-9401-1bce59b9f6db`;
panorama `exec-848d9983-0044-4476-b1f7-e730beaf7b4c`.

`loadSpillScene` loads these when entering or resuming the mode. Both have a
procedural fallback; failure never blocks a run. The Depot CSS uses the same
dock image as the canvas transition. The sector renderer darkens the panorama
so hazard cues and the pilot remain the foreground.
