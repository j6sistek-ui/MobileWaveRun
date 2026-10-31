# Playable scope evaluation

The owner approved completing the remaining wave-game proposals on 2026-10-29, before deciding whether to invest in front-facing 3D. This build brings together combat, artifact builds, six hazard families, environmental tactics, fifth-wave climaxes, optional risk routes and earned loadout choices. The Depot remains the only place for run purchases. Station walking, free flight, a new engine and licensed Unreal assets are outside this experiment.

## Retained Flight Trials (currently hidden)

The owner requested simpler mobile navigation on 2026-10-30. **Flight Trials are currently unavailable from player navigation:** the host's trial picker, menu entry and choose-trial links are removed, with no hidden production shortcut. Use normal runs for current playtests. All wave mechanics described below remain in normal progression.

The trial encounter catalog, Stock/Salvager/Evasive/Heavy Combat presets and isolated practice implementation are retained for regression tests and a later return. Tests can start them through the existing engine APIs. A trial opens a Depot where both weapons and every chassis/targeting sidegrade can be compared; retry/result support remains. Each encounter has a fixed seed. The plan repeats; changes in steering and firing can still change later admissions and outcomes. The catalog below documents retained content, not a currently accessible player menu.

Trials use the ordinary simulation, damage, controls, warnings and equipment. They grant no invulnerability. They never advance best wave, unlocks, records, currency or score submissions, and cannot overwrite a suspended normal run. Restarting a trial resets its preset; optional Depot adjustments can be made again. Reloading ends an unsaved trial. Normal Depot checkpoints are still available through Resume.

| Trial | Starting wave | Purpose |
| --- | --- | --- |
| Comet crossing | 4 | Read committed trajectories; shoot or evade |
| Mine tactics | 7 | Shoot, escape the fuse, or let enemies enter danger |
| Ion timing | 11 | Relocate before a band activates |
| Gravity and salvage | 16 | Countersteer, read bent debris and weigh optional rim gold |
| Solar cover | 22 | Preserve cover or leave the flare band |
| Fracturing wreck | 27 | Aim at a weak point, then avoid warned fragments |
| Wave climax | 20 | Survive an event and the Warden's attack/open-core cycle |
| Late combinations | 41 | Known hazards and advanced patterns with bounded pressure |
| Volatile route | 6–10 | Complete a real five-wave risk block for a trial-only 45-coin bonus |
| Patrol route | 6–10 | Complete a real five-wave patrol block for a trial-only 60-coin bonus |

Single-encounter trials end when that wave clears. Route trials run all five waves; dying before the final clear pays no completion bonus. These are practice entries into the same wave mode, not an alternate progression economy.

## Fifth-wave climaxes

Wave 5 keeps its original event introduction. Every fifth wave from **10** starts with its ordinary debris event, then reserves the second act for one **Warden**. At 45% of the spawning window, new ordinary debris, enemy arrivals and event sweeps stop. Existing threats drain naturally before the elite enters; they are not deleted to create space. Admission stops seven seconds before wave end if the field never becomes clear.

The Warden has **12 health**, an arrival shield and a **1.35-second frozen warning** (Scanner adds 0.4 seconds). Its shot retains at least **0.9 seconds nominal travel** to the marked target. After firing, its core opens for **3.2 seconds**. Shoot then, or survive until it retreats. Killing it is never required to clear the wave.

At wave 20 and beyond, alternate cycles bracket the frozen ship height with two shots and a marked central gap. Near a screen edge it uses the ordinary lock shot instead, so clamping cannot close the promised gap. It relocates between cycles and attacks no faster as wave numbers rise. Shield opening/closing is resolved at each swept shot's impact time, including Siege splash.

One defeat awards 75 score and eight physical ore pickups. Retreat awards nothing. The existing docking cleanup still collects ordinary on-screen coins when control passes to autopilot; physical pickup rules otherwise apply. Elite health does not grow indefinitely. No other environmental hazard is layered over its fifth-wave encounter.

## Optional risk routes

At Depots after wave 5, expand **Next route**. A choice covers only the next five waves and defaults back to Standard for the following block. Selection is free; it cannot be changed in flight.

| Route | Change | Completion bonus |
| --- | --- | --- |
| Standard | Normal plan | None |
| Volatile | Known hazards use advanced variants earlier; first lessons remain plain | 45 run coins |
| Patrol | Earlier/more frequent enemy arrivals, replacing some debris pressure | 60 run coins |

Volatile retains full warnings, safe routes and the same concurrency ceiling. Patrol uses a four-second base arrival interval and allows one extra arrival where the normal wave limit permits, capped at five; simultaneous enemy limits stay unchanged. Fifth-wave reserved climaxes still suppress patrol arrivals.

Bonuses pay once on the final wave clear. They are stipends, not mined coins, so they cannot satisfy collection contracts or trigger collection healing. The selected next route and settled prior block survive Depot checkpoints; an unsettled or malformed block is rejected. Death does not create a completion bonus.

## Earned choices

Normal-run best-wave milestones unlock free starting options. Choose them in **Ship Planning** or before the opening Depot launches. They last for the run; later Depots retain ordinary equipment purchases and refits. Chassis currently share the existing ship artwork and collision size: they test handling tradeoffs rather than a new asset pipeline.

| Clear wave | Choice | Tradeoff |
| --- | --- | --- |
| 0 | Scout / standard targeting | Original handling, health and aiming |
| 5 | Interceptor chassis | 12% faster vertical steering; one fewer hull pip |
| 10 | Bulwark chassis | One extra hull pip; 12% slower vertical steering |
| 15 | Focus lens | 20% faster projectiles; 15% narrower aim assistance |
| 20 | Tracking lens | 30% wider aim assistance; 15% slower projectiles |

Chassis do not add dodge charges. Lenses do not increase damage or firing rate. Both original weapons remain immediately available. Existing earned starting utilities remain intact. This implements persistent ship and weapon-module options without a permanent damage grind, new currency or shop. Unlocks derive from real cleared-wave records; trials make all choices available only within the trial.

## Decide whether to take it into 3D

Use normal runs for current playtests. If Flight Trials return, start with **Solar cover**, **Fracturing wreck**, **Gravity and salvage**, then **Wave climax**, comparing Stock with one specialized build on the same trial. The useful questions are whether warnings explain the next action, choosing to fire changes the situation, risks feel voluntary, and a different build changes your decisions. Record confusing or unavoidable hits before adding more content.

| Current 2D test | Possible front-facing adaptation | What still needs a 3D prototype |
| --- | --- | --- |
| Gravity moves ship, enemies and debris | Pull in both screen-steering axes; use the rim as a risky passage | Combined forces, soft edge resistance and depth cues |
| Comet trajectories and mine links | Cross the ship's forward plane at distinct depths; mine pockets and chain warnings | Projected crossing point and time-to-contact readability |
| Repeated ion bands | Energy sheets with moving openings | Openings must be reachable without hiding behind visual depth |
| Flare shadow and destructible cover | Asteroid casts a safe volume along the flare direction | Clear cover alignment and warning when protection is removed |
| Wreck weak point and fragments | Open a passage through a wreck, then read outward fragments | Two-axis aiming, passage size and safe fragment paths |
| Warden warning/open core | Attack from forward depth, then expose a readable firing opportunity | Target size, assistance and stable-camera visibility |

These are design mappings, not implemented 3D behavior. The eventual prototype should retain automatic forward travel, two-axis drift, soft invisible boundaries and a stable camera. Depth-dependent hazards, camera behavior and mobile GPU cost cannot be validated by this side-view build. Carry over the successful decisions and tuning data; screen-pixel collision/admission code needs new 3D geometry.

## Source ownership

`spill-career.ts` owns options/trial metadata; `engine.ts` and `save.ts` isolate practice state. Trial entry remains available to the test harness through engine APIs, while `standalone.ts` exposes no player trial picker. `spill-expeditions.ts` owns route selection and one-time stipends. `spill-climax.ts` and `spill-climax-view.ts` own the Warden, with common combat hit/reward resolution. `spill-hazards.ts` and its view own environmental mechanics. `spill.ts` integrates lifecycle, steering, pressure and checkpoint validation. UI composes shared metadata in `standalone.ts` and `spill-workshop.ts`.

See [HAZARDS.md](HAZARDS.md), [BUILDS.md](BUILDS.md), [COMBAT.md](COMBAT.md) and [VALIDATION.md](VALIDATION.md) for rules and executed evidence. Implementation and automated checks are not owner acceptance; physical phone feel, audio, performance and long-run balance remain playtest work.
