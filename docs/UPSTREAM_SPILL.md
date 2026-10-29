# The Spill — survival expeditions

The Spill is the app's build-focused survival mode: hold a line through a
broken acorn mining rig, collect Ore, and build a ship at a Depot every five
waves. Its identity is readable flight under pressure, with decisions between
waves that change how the next sector plays.

## The loop

Launch → three-second countdown → survive a wave → drain the field → collect
12 completion Ore. Every fifth clear docks for 4.8 seconds, restores one hull
pip, then opens the Depot. Its shelves arm after 0.8 seconds to reject a
lingering flight tap. **Every Depot is untimed.** It stays open until the pilot
leaves or saves and quits. The ordinary mode has no finish action.

The ordinary mode is endless from the start. Waves 1–20 retain the authored
modifier ladder. The first-ever wave-20 clear celebrates a first-pass victory
at the untimed Depot; continuing preserves the ship, Ore and contract and
launches wave 21. Subsequent wave-20 clears use the ordinary Depot.
After wave 20 the seed chooses modifier combinations; speed caps at 2.05×.
Wave completion depends on surviving the spawning window and drain, with no
kill quota or required weapon. The drain lasts at most six seconds.

A Star Map mission ends automatically at its target wave; the final Spill
mission, 10-8, wins at wave 20. Earlier missions keep their shorter lesson
targets. Chapter 2–10 level-8 missions
now use the Spill in production as well as beta; IDs and earned star masks
remain stable. Missions use the standard starting ship and a fixed seed.

## Controls and damage

The run opens on one instructions sheet (controls, the loop, the ship) with
a `?` that replays the Depot guide read-only; START RUN docks straight at the
opening Depot, which offers exactly one free system upgrade and nothing else.
The Depot guide never opens on its own; its `?` replays it, with utilities as
one compact row labelled for the wave 5 Depot, where they are first sold.

- Tap to fly, like every other mode except Hyper Run: a tap is an instant
  kick skyward (400 px/s against 1,000 px/s² of gravity, an 80 px hop that
  peaks in 0.4 s) and taps never stack. Swipe down to dive, swipe up for a
  harder kick, swipe right to lunge. The fall is capped at 420 px/s; a dive
  carries past the cap and decays back to it.
- A swipe still works after a long rest on the field, and only the owning
  pointer can end it. Nothing has to be released: blur, visibility loss and
  resize simply pause the run.
- Space / Up tap; a held key is one tap, never a stream. Down dives; W is the
  harder kick; Right / D lunges.
- Optional on-screen Thrust (tap), Dive (downward burst) and Lunge (forward
  dash) use those same rules. The button layer survives HUD updates and a
  second finger can Dive or Lunge while the first taps. The Thrust pad fires on
  the press and glows for the length of the kick's plume. Pause hides the pads.
- The numbers were chosen by sweep: the rule test's tapping bot flew seven
  candidate hands over twelve seeds, and 400/1,000 cleared wave 3 on all
  twelve and wave 5 on eight; flight's own 450/1,300 cleared wave 3 on six.
  Hyper Run keeps hold-to-rise.
- The Spill pause menu saves separate switches for buttons and instructional
  prompts. Hiding prompts affects presentation only: warning banners, event
  corridors, HUD information and wave pacing remain active. Global Help off
  also hides lessons. The settings apply immediately and after save/resume.
- Simulation advances in 60 Hz steps independently of display refresh rate.
- DRIFT changes debris velocity, while pilot, warnings and floor stay in the
  same screen coordinates used by collision detection.

A short floor brush is free. Sustained contact beyond 0.25 seconds uses the
same protection sequence as debris: active invulnerability/Gold → armed echo
or charged Pulse → shield → one hull pip → Respawn Core at zero hull.
Boundary recovery moves the pilot clear and kicks it upward. It never bypasses
extra hull or shields. A shield or Pulse impact grants 0.65 seconds of recovery;
a hull hit grants 1.2 seconds. A Core returns a full hull after a two-second
freeze, with three seconds of Gold protection.

## Depot builds

The Depot is a ship workbench: four connected hardpoints inspect plating,
thrusters, pulse and shields. Each shows its fitted level or remaining charges.
The selected system explains its next tier and exposes one purchase action;
Tier II opens its two free specialization choices. Two module slots remain
beside the ship, with utilities and contracts on separate tabs. Hull repair,
Respawn Core, Ore and departure remain part of the same hub.

The Ships Loadout uses the same painter and rules. Its launch section equips
an earned starter and mastery signal for the next endless run. Its separate
build preview shows every tier, specialization and utility, quotes cumulative
Ore costs and can inspect a suspended build. Planning spends nothing and
cannot change the suspended run; tiers still have to be purchased at a Depot.

The original four tracks and their flat, tier-based prices remain:

| Track | Tier I | Tier II | Tier III |
|---|---|---|---|
| Plating | 60 Ore: four hull | 110: five hull | 180: six hull |
| Thrusters | 50: stronger bursts | 100: two lunges | 170: shard-clearing Afterburner |
| Power-ups | 60: automatic impact Pulse | 110: banked echo after five seconds | 170: wide Pulse; shattered debris drops Ore |
| Shield | 35 per charge | Two carried | Canopy hardware stays fitted after spending charges |

Repair costs 30 Ore and fills missing hull. The 150 Ore Respawn Core is sold
once per run. Gold charges half a Pulse, even before the Pulse is unlocked.
The tier-II echo waits for a threat instead of firing into empty space.

Tier II unlocks a free specialization choice at any Depot:

| Track | Choice A | Choice B |
|---|---|---|
| Plating | Impact Bracing: half knockback, +0.4s recovery | Salvage Armor: every 30 mined Ore repairs a pip, at most twice per wave |
| Thrusters | Precision Jets: lunges brake vertical motion; tier-I burst strength | Wide Sweep: broader shard clearing, available at tier II |
| Power-ups | Efficient Coil: Gold charges 65% | Salvage Coil: shattered debris drops Ore at tier II, double at III |

Two utility slots create additional build choices. Purchased modules belong
to the current run; unfit and refit owned modules for free at a Depot.

| Utility | Price | Effect | Free starting utility unlock |
|---|---:|---|---:|
| Salvage Magnet | 40 | Pull nearby Ore/Gold, not hull patches | Clear wave 5 |
| Field Scanner | 35 | Earlier event warning; bright Blackout outlines | Clear wave 10 |
| Emergency Brake | 35 | Automatic floor recovery every 12s; lunge braking | Clear wave 10 |
| Reserve Capacitor | 45 | Store two Pulse charges | Clear wave 20 |

The Depot forecasts the next five waves and their modifiers/events. It offers
one optional contract for that block: mine Ore, keep a clean hull, or shatter
eight shards. Contract completion awards Ore and 500 score; a missed contract
never ends a run. Purchases and completion stipends do not count as mined Ore.

## Wave direction and readability

Four five-wave sectors progress through outer wreckage, cargo, reactor debris
and the rig core. Each wave eases in, builds pressure, crests, and releases.
Milestone waves add cargo ruptures, Gold veins, alternating convoy lanes or rig
sweeps. Events warn before release, provide an open corridor and place salvage
along it; stock ships can survive them. Ambient debris that conflicts with a
newly announced route dissipates without giving shatter rewards.

Spawn admission checks debris paths against each other and reserves a slowly
moving escape corridor at the home lane. The director enforces actor budgets
for event and ambient debris together. Screen-width scaling and a minimum
read time prevent endless speed from turning into unseen hits. Spinners,
shards and hulks have distinct motion cues. Blackout retains basic hazard
outlines; the Scanner improves them rather than making visibility mandatory.

## Art and presentation

`docs/art/spill-ship/` remains the fitted modular kit. Its canopy interiors
are opened by cached canvas masks, and explicit cockpit anchors render just
the equipped pilot's head and helmet at a readable scale. Upgraded thrusters
hide the baked-in stock nozzle. Gameplay, Depot and Loadout use one painter.
The ship remains 58 logical pixels long; its collision radius is unchanged.

`docs/art/spill-scene/depot.png` and `panorama.png` add the illustrated dock
and four sector views. They load when the mode opens; a failed image request
leaves the procedural scene and fallback ship usable. Earned signal colors
appear in the plume and utility lights. The HUD shows Ore, salvage score,
combo, hull, shields, Pulse/echo and an active contract.

Arrival uses a viewport-covering camera that advances into the station over
4.8 seconds, with approach and docking beats. The Depot keeps that final
camera and fades its workbench into place; station art never shrinks into a
menu banner. Utility marks use shared vector paths on the hull, HUD and
workbench, and fitted specializations add gold system indicators.

The supplied `depot-bear.jpg` contains 36 frames in a 6 × 6 grid. It is kept
intact and decoded once into transparent frames by `game/spill-depot-bear.ts`.
Background removal preserves the light suit; feet provide a stable frame
anchor. The bear faces the approaching ship on the platform, moving with the
station camera and signaling across the arrival. It holds its final pose at
the Depot. Reduced motion uses a still pose; a failed bear load does not
block the scene or the run.

## Records and suspension

Spendable Ore and purchased upgrades belong to a run. Persistent records keep
best cleared wave, best salvage score, total mined Ore, cleared waves,
contracts, wave-20 clears and runs. The legacy `expeditions` key counts those
wave-20 milestones without ending an ordinary run. Mastery titles/signals arrive at
waves 5, 10, 20 and 30. One earned utility may be selected before a normal run;
mission starting conditions remain fixed.

Ordinary runs autosave a versioned checkpoint at the Depot and after each
purchase/refit/contract. Save & Quit returns to the title. Resume restores the
ship, Ore, contract and RNG, and keeps the checkpoint until departure. The
checkpoint's bank ledger makes repeated dock/resume operations idempotent.
A malformed checkpoint is discarded. Mid-wave suspension is not supported;
leaving a Depot clears its checkpoint, so a later crash cannot rewind a wave.
Ore never enters the app's acorn wallet.

## Ownership and verification

| File | Responsibility |
|---|---|
| `game/spill.ts` | Pure rules, spawning, damage, checkpoints |
| `game/spill-content.ts` | Utilities, specializations, contracts, sectors and mastery |
| `game/spill-presentation.ts` | Shared preview builds, Ore quotes, module marks and arrival camera |
| `game/spill-depot-bear.ts` | Supplied marshal sheet decoding and foot anchors |
| `game/sim.ts` | World mirror, standard mission loadout and completion seam |
| `game/engine.ts` | Inputs, fixed stepping, interruption pause, banking and resume |
| `game/save.ts` | Record migration, sanitization and idempotent bank ledger |
| `game/draw.ts`, `game/art.ts` | Shared ship painter, HUD and lazy scene art |
| `game/standalone.ts` | Preflight, Depot, results and resume UI |
| `game/campaign.ts` | Production Spill missions |

Build with TypeScript 5.9.2 using `node illustrated-src/export-sandbox.mjs`.
`ACORNAUT_TSC` can point at its `lib/tsc.js`. The export builds both production
and beta, preserving the last four cache stamps.

- `node illustrated-src/test-spill.mjs`: ladder, controls, damage, waves,
  untimed Depots, missions and six-seed opening-wave bot smoke test.
- `node illustrated-src/test-spill-progression.mjs`: build behavior, contracts,
  48 event sweeps across 320/390/1280 widths, checkpoint validation, banking,
  arrival coverage/continuity and preview costs checked against actual purchases.
- `node illustrated-src/test-spill-ui.mjs`: menu/input integration in happy-dom,
  including missing-art fallback. Set `ACORNAUT_HAPPY_DOM` to its module entry
  if it is not installed in local module resolution.
- `node illustrated-src/test-spill-render.mjs`: actual canvas painter across
  all 192 equipment combinations, three viewport widths and five arrival frames. Requires
  `@napi-rs/canvas`; `ACORNAUT_CANVAS` may point at its package directory and
  `ACORNAUT_QA_OUTPUT` selects the contact-sheet output folder.

DOM tests do not certify browser layout or real-device touch feel. Validate
those on the review build before release; bot survivability is a smoke test,
not a claim that the entire economy is perfectly balanced.
