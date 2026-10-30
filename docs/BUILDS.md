# Phase 2: distinct ship builds

The second adaptation from the full SpaceSurvival scope is salvage, evasive and heavy-combat builds. Optional artifact cores change how weapons work, while existing systems, specialties and the two utility slots support each approach. The side-view wave loop, Depot, controls and currencies remain the foundation. There are no locked classes or automatic purchases.

## Artifact recovery and fitting

At the Depots after waves **5, 15, 25, then every ten waves**, recover one artifact for free from up to two unowned choices. The seed and recovery wave determine the offers; reopening the Depot or resuming a checkpoint does not reroll them. Recovering a core fits it immediately. Only one core can be active, but recovered cores stay available for free refitting or removal at later Depots during that run. Once all three are owned, there are no further recovery offers. Leaving without recovering forfeits that stop's choice.

The opening Depot keeps the original free system upgrade and weapon selection. Build suggestions are optional plans, not bundles: buy the suggested systems/utilities normally and select system specialties once their tier-II requirement is met. Recovery never spends coins, takes a utility slot, grants gear in a recipe, or creates a permanent unlock. A new run starts with no artifacts.

| Build / artifact | Gameplay change | Suggested existing equipment |
| --- | --- | --- |
| Salvager / **Reclaimer** | Each piece of debris destroyed by your weapon drops one extra physical coin, up to **8 per wave**. You must collect it. Pulse and dodge breaks do not trigger the bonus. | Rapid Laser, Salvage Magnet, Debris Scanner, Salvage Armor and Salvage Coil |
| Evasive / **Slipstream Relay** | A successful dodge primes one echo for **2 seconds**. The next manually triggered volley adds a trailing round at **half damage**. It does not stack or fire by itself. | Rapid Laser, Emergency Brake, Debris Scanner, Precision Jets and Impact Bracing |
| Heavy combat / **Siege Core** | A weapon impact deals **half damage** to nearby debris/enemies within **56 pixels of their collision edges**. Recharge takes **30% longer**. The directly hit target takes its normal hit once. | Heavy Cannon, Pulse Battery, Salvage Magnet, Impact Bracing and Efficient Coil |

Reclaimer's extra pickups participate in normal Magnet attraction, coin collection, Salvage Armor repairs and contract progress. Salvage Coil keeps its existing rewards alongside Reclaimer's limited bonus. Slipstream works with either dodge direction and either weapon; holding the fire finger still counts as deliberate firing. Siege works with either weapon and reuses the ordinary destruction and enemy-reward paths. Its blast cannot hurt the player or trigger another blast, and it skips warned/dead debris. Each impact affects at most 12 additional targets. Pulse Battery still requires an Impact pulse upgrade.

With Phase 3, echo rounds and Siege blasts also damage active comet cores and mines. Siege keeps the same 12-target secondary budget across debris, enemies and hazards. Mines provide their normal single disarm coin, without a Reclaimer rock bonus or enemy-kill credit. Scanner extends initial hazard warnings; the Depot forecast helps choose a build for the next block. Every hazard retains a movement-based answer for the stock ship. See [HAZARDS.md](HAZARDS.md).

## Readability and interruptions

The Depot shows the active build, effect, tradeoff, recovery options and owned cores. Pause, saved-ship planning and results identify the weapon and fitted artifact. The existing weapon HUD shows salvage allowance used, an echo-ready cue, or Siege Core without adding a fixed gameplay button. Primed echoes outline the ship; echo rounds and impact blast rings distinguish their effects.

Pause and screen rotation release held controls but preserve gameplay timers and the per-wave salvage allowance. The simulation pauses, so the two-second echo window does not tick away while paused. Countdown, Depot entry, death and extra-life recovery clear transient echo/blast effects; the allowance resets only when a new wave begins. Artifact ownership and selection survive normal Depot checkpoints. They do not provide mid-wave saving.

## Implementation and verification

`spill-builds.ts` contains metadata, build recipes, recovery transactions and validation. Persistent ownership is nested in `combat.build`; original checkpoints without that field default to no artifacts. New saves validate IDs, ownership, acquisition order, milestone waves, deterministic offers, reward caps and cleared transient effects. Artifact offers do not draw from debris or encounter RNG.

`spill-combat.ts` applies bonuses through the existing fixed simulation and swept impact ordering. The Depot and HUD use the same weapon-stat function, including Siege's cadence tradeoff. `spill.ts` primes the echo only after a dodge is accepted. `engine.ts` checkpoints successful recovery/refit transactions immediately.

Automated rule and host tests cover recovery, refitting, old saves, invalid saves, caps, once-only rewards, echo expiry/manual fire, splash ordering and interruption behavior. Production render checks and browser layout checks are recorded in [VALIDATION.md](VALIDATION.md); they do not replace physical-phone feel, performance or long-run economy testing.

## Next playtest and later scope

At the first recovery stop, try the available cores on the same weapon and compare their survival choices. Reclaimer should encourage collecting safely, Slipstream should reward dodge-and-return-fire timing, and Siege should favor clustered threats at the cost of cadence. Check the Depot's readability in both orientations. Suggested gear is optional; artifacts remain useful without a complete recipe.

Phase 3 now supplies broader hazard combinations and a read-only five-wave forecast. Fifth-wave climaxes, opt-in risk/reward contracts, and permanent ship/weapon/module unlocks remain later priorities. Front-facing flight and a mobile engine conversion remain separate feel and platform decisions. No navigable station or licensed Unreal assets are added.
