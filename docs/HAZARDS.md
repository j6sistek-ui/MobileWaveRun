# Phase 3: space hazards

The owner authorized broader hazard mechanics and expanding skill demands on 2026-10-30. This extends the accepted side-view joystick game, existing weapons, artifacts and Depot. The design review and primary-source comparisons are in [HAZARD_BENCHMARK.md](HAZARD_BENCHMARK.md).

## What the player does

| First wave | Hazard | Read and respond |
| --- | --- | --- |
| 4 | Comet strike | A dashed path commits before the comet moves. Leave the line or shoot the core. |
| 7 | Drifting mines | A spiked core shows its proximity/blast ring. Shoot to disarm, use a charged impact Pulse, or leave before the fuse ends. |
| 11 | Ion storm | A striped horizontal band charges, then briefly becomes harmful. Move above or below it. The band cannot be shot away. |
| 16 | Gravity well | A small dark core has a wider influence ring. Steer against the mild pull and read nearby debris bending toward it. Avoid the core. |
| 22 | Solar flare | Use the asteroid's marked shadow or leave the charged band. Shooting cover removes that shelter but restarts a full warning. |
| 27 | Fracturing wreck | Avoid the large wreck or shoot its bright weak point to open a path. Released fragments have their own committed warning lines. |

Warnings are harmless. Collision geometry uses the drawn core, ring or band plus the ship's existing collision radius. Ordinary shots can break a comet or mine; debris in front still intercepts the shot first. Disarming a mine drops one physical coin which must be collected. It does not count as an enemy kill or a rock shatter, and it cannot pay twice. Gravity and ion storms are environmental threats rather than targets with large health pools.

The remaining proposals were authorized on 2026-10-29. Visible enemies can trigger mines and take their blast damage. Comets and gravity cores can hit enemies; visibly gravity-bent debris can also strike them. Those defeats use the same once-only kill/physical-pickup ledger as weapons. Ordinary unbent rocks do not farm passive enemy kills. Gravity gently pulls ordinary enemies as well as the ship and nearby debris; elites keep their frozen warning geometry. One optional gold pickup worth five coins rides each well's outer rim. It obeys normal collection/Magnet rules, with no automatic admission-time payout.

The early families test different skills: reading a trajectory, choosing a target, relocating on a timer and compensating for a force. No extra flight buttons or camera effects are introduced. Existing shields, invulnerability, Pulse and extra-life handling apply to hazard hits. A stock ship can use movement instead of needing a particular artifact or weapon.

## Progression

- Waves 1–3 retain the flight/combat introduction.
- Waves 4–20 introduce each family in the order above and practice already introduced families, one active at a time.
- Waves 21–30 can select two known families for a wave, encountered sequentially.
- Waves 22 and 27 separately teach solar cover and wreck weak points. Later sequential plans include those known families.
- From wave 31, selected **gravity + comet**, **mine + comet**, and two-mine clusters can overlap, up to two active hazards. Other plans stay sequential; ion/flare bands and wrecks are not layered over another environmental hazard. Each linked mine gets a fresh 0.9-second fuse; shooting it stops that link.
- From wave 41, advanced patterns add broader comet angles, drifting well trajectories and up to three ion pulses in changing bands. Each changed band receives a fresh full warning and safe-route check; an unsafe continuation ends the encounter. Reaction warnings and concurrency limits remain bounded.
- Every fifth wave retains an existing special event. From wave 10 its second act reserves a Warden encounter instead of further ambient/event pressure. New environmental hazards do not stack over those events or elites. See [EVALUATION.md](EVALUATION.md).

The optional Volatile route enables advanced known patterns earlier, while first lessons remain plain. It never shortens warnings or raises concurrency. Expanded family selection changes some later seeded plans from the four-family build, while a saved run remains deterministic on this build.

The same run seed gives the same plan. At the Depot, **Next five waves** shows the upcoming families and event names. Expanding it reveals the field guide; reading it spends no currency and consumes no random numbers. It stays collapsed initially to preserve the free-upgrade decision. Saved runs keep the same forecast.

## Pressure and fairness

Hazards reduce ordinary debris capacity and enemy admission. An encounter waits around existing enemy warnings/shots and surges. Geometry checks reserve a reachable safe height and reject incompatible combinations; visible rocks are never silently removed to manufacture room. A warning never tracks the player's movements after being announced. Later waves broaden the decisions rather than indefinitely shrinking warning time or increasing simultaneous threats.

First hazard lessons suppress the older wave modifier. Gravity plans exclude Heavy, Crosswind and Drift; ion/flare plans exclude Blackout. Climax waves suppress modifiers. The original modifier lesson order is therefore superseded, while the early Surge/Low-G/Heavy lessons remain at 3/6/8. Later modifiers still appear in compatible plans. Enemy ships can remain visible during a hazard, but new enemy attacks and arrivals wait until it clears.

The gravity field is intentionally an arcade interpretation of a black hole. Its ship drift is capped at 30 horizontal and 55 vertical logical pixels/second, against stock vertical steering of 300. The pull ramps in over 0.6 seconds after activation. Neutral steering can drift inside the influence ring; ordinary joystick input remains stronger. There is no camera rotation, reversed input or random steering failure.

Nearby rocks receive a bounded smooth bend only if their new path passes the same clearance checks used for normal admission. The predictor and actual motion share the bend's analytic integral. Its peak additional vertical speed is 26 pixels/second for 2.4 seconds (under 40 pixels of total deflection before viewport scaling). A short path mark shows accepted bends near a well. Rejected bends leave a rock's existing motion intact.

Enemy pull is capped at 40 horizontal/70 vertical logical pixels per second. It accumulates smoothly inside the field rather than snapping back to the enemy's home position. Mine blasts deal 5 enemy damage, comets 4, gravity cores 5 and visibly bent debris 3. These interactions use the same normalized frame timeline as shots; an earlier enemy/comet impact removes that comet before a later ship impact.

## Cover and fractures

A flare charges a full-width band with a half-height of 60–100 pixels, based on the viewport. Its asteroid has a 42-pixel radius and 5 health. A ship is sheltered only when its full collision body fits inside the marked shadow behind the cover; the outside-band route remains available even after the cover breaks. Initial charge is 1.8 seconds (Scanner adds 0.4), followed by a 0.7-second pulse. Removing cover cancels later exposure in the same tick and starts another full 1.8-second warning. The flare expires after its pulse.

A wreck has a 42-pixel collision body and an 11-pixel bright target with 3 health. Ordinary shots outside that target do not destroy the whole hull. Breaking it removes the body immediately and releases at most two 10-pixel fragments. Each has a fresh 1.2-second warning, a committed path and four seconds of movement; a late break extends the encounter so its warning is not cut short. Fragment trajectories that would cross the reserved refuge become harmless sparks instead. Pulse and Siege can also destroy the weak point under their normal reach rules. Wreck/cover destruction grants no invented rock-shatter or enemy credit.

## Tuning and ownership

`illustrated-src/game/spill-hazards.ts` owns metadata, seeded plans, actor admission, collision, rewards and force envelopes. `spill.ts` integrates flight, debris prediction and lifecycle; `spill-combat.ts` resolves weapon/Pulse interactions. The renderer reads that state in `spill-hazard-view.ts`. The Depot and combined Settings & Controls field guide use the shared metadata in `spill-workshop.ts`.

| Setting | Initial value |
| --- | --- |
| Initial warning | 1.2 seconds; Scanner adds 0.4 seconds |
| Comet travel lead after warning | At least 0.75 seconds to the home lane |
| Mine proximity/blast radius | 68 logical pixels |
| Mine fuse | 0.9 seconds |
| Ion active pulse | 0.45 seconds |
| Gravity force ceiling | 30 horizontal / 55 vertical pixels per second |
| Gravity bend envelope | 26 pixels per second peak / 2.4 seconds |
| Encounter ceiling | 3 per wave before 21; 4 from 21 |
| Concurrent environmental hazards | 1 initially; at most 2 for selected late pairs |
| Solar warning / active pulse | 1.8 / 0.7 seconds |
| Wreck fragment warning / lifetime | 1.2 / 4 seconds; at most 2 fragments |

The force and trajectory effects are procedural Canvas artwork tied directly to collision geometry. They need no new downloaded or licensed assets. Reduced Motion removes decorative rotation and shortens comet tails while keeping warnings and collision bounds visible. Hazard warnings are painted above the existing Blackout veil.

## Saves, interruptions and validation

Depot saves clear live hazards, warning timers, armed mines and transient field effects. A checkpoint from before Phase 3 receives an empty hazard state; malformed hazard payloads are rejected. Pause freezes the simulation. Rotation pauses the same wave, scales existing hazard positions and frozen aims, clears held controls, and requires fresh input after Resume.

See [VALIDATION.md](VALIDATION.md) for executed checks and their limits. Automated stock-ship escape checks and browser flows are not a claim that every late combination is balanced on a physical phone. **Flight Trials are currently hidden** from player navigation; their six-family, late-combination and climax presets remain for tests and a later return. Use normal wave progression for current playtests, assessing cover/weak-point decisions, gravity tactics, warning readability and whether the forecast helps select a build. The [evaluation guide](EVALUATION.md) separates these 2D mechanics from possible future 3D adaptations.
