# The Spill ship: one hull, three swappable parts

Fourteen sprites, all 256x256 RGBA, all sharing one frame. Layer them in
this order:

    hull-N  ->  thrust-N  ->  cone-N  ->  cockpit-N

`frame.json` records the source crop and the tile size inside the 256 box.
`manifest.json` names the hulls and the parts per axis; the Ship Bench
reads it, so a new part is a file plus one line there.

**Fit is done by hand, not by the cut.** `docs/lab/ship/` is a fitting
bench: pick a hull, an axis and a level, drag, scale and turn the part,
and export one transform per part (offset, scale, rotation in this 256px
frame), with optional per-hull overrides. That JSON lives here as
`transforms.json` and is what the Spill's painter (`drawSpillShip` in
`game/draw.ts`) consumes; re-export from the bench and drop it in to
refit. The cuts below only have to be clean; they do not have to be
perfectly registered.

## The four axes

| axis           | Depot meter        | levels                                        |
|----------------|--------------------|-----------------------------------------------|
| `hull-0..3`    | Plating (material) | rusted sheet steel, bronze, polished silver, white composite |
| `cone-1..3`    | Power-ups          | silver, gold, armoured gold                    |
| `thrust-1..3`  | Thrusters          | ringed bell, three nozzles, white side pods    |
| `cockpit-1..3` | Shield             | visor, side windows, sealed canopy            |

Level 0 of cone, thrust and cockpit is "draw nothing": the bare hull already
carries a plain nozzle, a plain nose and an open cockpit. `hull-2-blue` is
the blue-steel hull the silver one replaced, kept as an alternate.

## Where the cuts came from

- **hulls**: the full renders, gamma-lifted onto a rising brightness ladder
  (median lit value 90, 117, 151, 181) so an upgrade reads as progress at
  the 58px the mode flies at. Background alpha is flood-filled inward from
  the frame edge, so the open cockpit clears and the pilot shows through.
- **cone-1..3, cockpit-1..3, thrust-3**: the owner's own cuts of the part
  renders, delivered with alpha on a 1500x1010 canvas that is a uniform
  0.876 scale of the render frame. Scaled back up and given the same gamma
  lift as the rust hull they were rendered on. They register within a
  pixel of the renders.
- **thrust-1, thrust-2**: cut from their renders at the collar seam,
  everything left of the egg's leftmost outline point.

## Runtime rendering

The production renderer loads this kit. Depot, Loadout and gameplay all use
`drawSpillShip`; previews cannot silently fit a different ship.

- Plating chooses `hull-0..3`; Thrusters and Power-ups choose their matching parts.
- The maximum shield stack purchased owns the canopy hardware for this run.
  Spending a shield charge changes the HUD and impact flash, not the ship fit.
  One charge fits `cockpit-1`, two fit `cockpit-3`; `cockpit-2` is an unused alternate.
- Explicit cockpit anchors in `draw.ts` place an enlarged head and equipped
  helmet. The full suit is cropped at the head rather than shrunk into the opening.
- Canopy paintings contain opaque glass. A cached canvas opens the glass
  interior and preserves its rim; a light tint and glint finish the window.
- Upgraded thrusters mask the baked-in stock nozzle, preventing duplicate engines.
- Missing kit art falls back to the scout, then a small procedural ship. These
  paths also render safely in the Depot preview if image loading fails.

`test-spill-render.mjs` paints all 192 hull/thruster/power-up/canopy combinations.
Scene artwork lives in the separate `../spill-scene/` directory.
