# Wave combat

Owner-authorized priority-one adaptation of the full SpaceSurvival scope, 2026-10-29. This is a playable side-view experiment within the existing endless wave loop and Depot. It adds deliberate weapon use and readable enemy encounters; it does not add station navigation, a new engine or a 3D camera.

## Playing

Choose Rapid Laser or Heavy Cannon in the opening Depot. Both are available immediately and switching at a Depot costs nothing. Choose the existing free starter system separately, then launch. Drag the first finger up/down to steer, tap a second finger to fire, and quickly flick the steering finger left/right to dodge. Hold the second finger for repeated fire. Keyboard W/S or Up/Down steers; A/D or Left/Right dodges; F or Space fires. The joystick replaces tap/gravity flight and the fixed pads. Pausing, losing focus or resizing clears held input and pending shots; press again after resuming. See [CONTROLS.md](CONTROLS.md).

Shots travel forward. A narrow forward cone gently aims at an enemy already near the ship's flight line; it does not turn the ship or fire automatically. Match the enemy's height to engage. Debris blocks shots from either side, so clearing a path also removes cover. Dodging remains valid: waves end by time and field drain, not by an enemy kill quota.

## Weapons and economy

| Weapon | Tier I / II / III damage | Base interval | Role |
| --- | --- | --- | --- |
| Rapid Laser | 1 / 2 / 3 | 0.16 seconds | Fast, narrow shots; frequent corrections against moving targets |
| Heavy Cannon | 4 / 8 / 12 | 0.65 seconds | Slower, wider rounds; fewer hits to break heavy debris |

Each tier reduces its base interval by 7% per additional tier. The shared `spillWeaponStats` function supplies firing and the Depot's displayed values. Upgrades cost 65 coins for tier II and 130 for tier III, separately for each weapon; the selected weapon and both tiers persist through Depot checkpoints. Ammunition is unlimited. There are no permanent power unlocks or extra currencies in this iteration.

Debris health is 1 for shards, 2 for spinners, 4 for tumblers and 10 for hulks. Destroying it uses the existing shatter, contract and equipped Pulse salvage rules. Destroyed Pursuers drop three collectible coins; Flankers drop four. Coins enter the existing run economy only when collected. Enemy defeats also award score and appear in the run's kill count; escaping enemies do not award a kill.

## Encounters and fairness

Wave 1 keeps the original debris lesson and allows shooting. From Wave 2, Pursuers close from the right and slowly follow the player's height; Flankers weave vertically farther away. Red and teal silhouettes, charge rings and frozen aim warnings distinguish them and their attacks.

Enemies wait through a 0.9-second aim warning and freeze their target before firing. Their shot speed preserves at least 0.75 seconds of nominal travel to the frozen target after that warning, including narrow viewports. Warning starts are staggered. Damage uses the existing shields, Pulse, recovery immunity and extra-life rules. Impact Pulse clears nearby hostile shots and damages nearby enemies.

Enemy admission is bounded to two concurrent ships and three arrivals below Wave 10, then three ships and five arrivals. Encounters take pressure away from the ambient debris spawner. New arrivals and new shot warnings defer during event warnings and surges. Enemies retreat during field drain; combat entities are cleared before countdowns, Depot visits, death and extra-life recovery. These bounds are fairness controls, not evidence that all late-wave combinations are balanced.

## Implementation and saves

`spill-combat.ts` owns combat rules and a separate seeded RNG; `spill.ts` integrates them into the existing fixed 60 Hz authority. Projectile collision sweeps choose the earliest impact across moving targets, with debris winning cover ties. No second simulation loop or runtime library is introduced.

Combat is nested in version-1 Depot checkpoints. Older checkpoints without it restore with tier-I Rapid Laser and tier-I Heavy Cannon. New checkpoints validate weapon IDs, tiers, counters and cleared transient state. Held inputs, live shots and enemies are never restored from storage. Existing isolated save keys and banking remain unchanged.

New sprites and their exact generation prompts are documented in [COMBAT_ASSETS.md](COMBAT_ASSETS.md). The 125 upstream asset files retain their original bytes. Joystick movement intentionally supersedes the original tap/gravity traces; dedicated movement and combat tests cover the current behavior. The debris-event lane test isolates debris because its helper does not dodge aimed shots. See [VALIDATION.md](VALIDATION.md) for executed checks and remaining playtest limits.

## Next playtest

Compare both weapons through the first Depot interval, then compare upgrades on the same encounters. Judge target readability, simultaneous steering/shooting, directional dodge distance, the value of keeping debris as cover, and whether cannon/laser choices feel distinct. Physical phone ergonomics, audio listening, sustained performance and late endless-wave balance still need real play. Front-facing movement and broader feature priorities remain later scope.
