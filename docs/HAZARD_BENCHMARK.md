# Phase 3 hazard design review

Reviewed 2026-10-30. This is a qualitative comparison of published developer descriptions, not a comparative playtest, performance benchmark or claim of equivalent game balance. The lessons below are paraphrases; the proposed adaptations are our design judgments.

## Full SpaceSurvival scope

The source review used the complete owner workspace documents `docs/GAME_SCOPE.md`, `IMPLEMENT.md`, `docs/PHASE2_INTEGRATION.md` and `docs/production/FEATURE_PROPOSALS.md` in SpaceSurvival. The full game scope includes ion storms, gravity anomalies/black holes, mines/defenses and stellar/comet hazards. It calls for increasing behavioral variety and combinations, rather than simply enormous health pools. Its gravity concept affects flight and nearby objects. The four-hazard/ten-wave limits in the early Unreal acceptance slice are not limits on this authorized mobile expansion.

Those ideas fit the existing wave/Depot loop if each can be read with the accepted joystick, firing finger and sideways dodge. Walking stations, free flight, inventory management and a camera conversion add no value to this experiment. The feature proposal separating constant ambient debris from thrown pressure remains a parked proposal; this change does not silently adopt that whole design.

## Comparable games

| Primary source | Published behavior (paraphrase) | Adaptation and boundary |
| --- | --- | --- |
| [Nova Drift developer patch notes](https://blog.novadrift.io/patch-notes/), version 1.0, 2024-08-06 | Newly spawned asteroids/comets near the screen edge deal reduced damage to protect reaction time. Comets have a larger, distinct warning. | Telegraph major hazards before collision becomes possible. Keep reaction floors at late waves. Do not copy arena movement or its large upgrade tree. |
| [EVERSPACE developer tactics](https://news.xbox.com/en-us/2016/11/22/everspace-developer-tips-strategies/), ROCKFISH Games, 2016-11-22 | Players can lure pursuing enemies into minefields and black holes. | Environmental forces should affect more than the pilot. Phase 3 bends debris as well as the ship; enemy manipulation can be extended after this is readable. Do not import six-axis navigation, fuel or exploration overhead. |
| [Returnal enemy design](https://blog.playstation.com/2021/04/14/creating-returnals-otherworldly-enemies-vfx-driven-tentacle-tech-and-deep-sea-inspirations/), Housemarque, published 2021-04-14, page also lists 2023-03-30 | Emissive effects announce attacks. Slow bullets, fast attacks and expanding waves demand different responses. Developers prototype roles separately and in selected combinations. | Teach trajectory reading, shot selection, timing and countersteering separately, then combine compatible roles. Do not copy its projectile density, traversal or extra controls. |
| [Sky Force Reloaded official store description](https://store.steampowered.com/app/667600/Sky_Force_Reloaded/), Infinite Dreams, description undated; PC release 2017-11-29 | Rescues put the player in danger, and higher difficulty modes extend stage mastery. | Optional risky salvage is a useful later extension. Do not make a mandatory rescue system or permanent-upgrade grind part of hazard survival. |

All sources accessed 2026-10-30 UTC. No art, code or branded content is copied from these games. The subsequent owner-authorized package implements enemy/environment interactions and optional gravity-rim salvage, plus solar cover and wreck weak points. The table preserves the initial comparison's sequence; it is not a list of features still deferred. No additional competitor playtest is claimed.

## Selected mechanics

| Family | Skill | Escalation |
| --- | --- | --- |
| Comet sweep | Read a committed path and move before it crosses | Diagonal sweeps; selected pairings |
| Proximity mine | Decide whether to shoot, avoid, or leave the fuse radius | More demanding placement alongside a compatible moving threat |
| Ion front | Relocate before a timed band fires | Repeated pulses, each separately warned |
| Gravity well | Countersteer and reassess bending debris | Drifting wells and a compatible comet |
| Solar flare | Preserve cover or choose an open escape route | Destructible shelter with fresh warning on loss |
| Fracturing wreck | Choose whether and where to fire | Open a passage, then read committed fragment paths |

An arcade gravity well is deliberately weaker than ordinary steering. It is a gameplay interpretation of the owner's black-hole idea, not a physical simulation. Warnings, a distinct core, bounded influence and visible debris trajectories are essential; unpredictable unannounced trajectory changes would undermine the control work already accepted.

The progression is **learn, practice, combine, vary**. Hazards spend the same field-pressure budget as ordinary debris and enemies. Fifth-wave events keep their own space. Late waves should add decisions while retaining a fixed reaction floor and a finite concurrency ceiling. Exact implementation and tuning live in [HAZARDS.md](HAZARDS.md).

## Next playtest questions

1. Can the player identify the next action from the warning alone, in portrait and landscape?
2. Does the stock ship escape gravity without exhausting dodge charges?
3. Is a bent rock surprising in a useful way while its updated path remains legible?
4. Do later combinations feel like two understandable tasks, or visual noise?
5. Is the forecast useful when choosing a Depot build without making any build mandatory?

The owner subsequently authorized the remaining package before personal validation. The two additional families, environmental tactics, Warden, risk routes and earned sidegrades are part of normal wave progression. Flight Trials are currently hidden from player navigation; their presets and isolated practice rules remain for tests and a later return. Use normal runs and the questions above to evaluate these mechanics; no personal acceptance is inferred from their authorization. [EVALUATION.md](EVALUATION.md) maps each behavior to possible 3D changes. Published design principles cannot settle physical phone feel, depth readability or long-run balance.
