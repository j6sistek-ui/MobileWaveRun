# Enhancement opportunities (review, 2026-11-17)

This is a review of the playable package as of `195bf26` plus the placeholder score. Nothing below is implemented. Every item needs owner direction before it is built. The AGENTS.md boundaries still apply:

- side view only;
- no 3D, new engine, monetization or new playable modes;
- the Depot is the only build surface;
- the gesture controls stay as accepted;
- Flight Trials stay hidden;
- save schemas stay compatible.

**Evidence tags:**
- **[B]** seen in a real headless Chromium run at 390×844, 844×390 or 320×568.
- **[C]** read in code.
- **[S]** measured with throwaway simulation bots, which are not human play.

Sizes are rough: S is under a day, M is a few days, L is larger.

## Where the game stands

The core loop is solid and well guarded: floating-stick steering, second-finger fire, flick dodge, readable warnings, and a Depot every five waves. It goes flat in four places.

- **Weapons are the same in practice [C].**
  - Rapid Laser does 1 damage per 0.16 s and Heavy Cannon does 4 per 0.65 s (`spill-combat.ts:15-16`). That is about 6.2 damage per second for both, at every tier.
  - There is no heat or ammo, so holding fire is always correct. The only cost is losing debris you might hide behind.
- **Enemies have one attack each [C].**
  - Pursuer and Flanker each fire a single shot at a frozen aim point. They differ only in movement, and they spawn strictly alternating (`spill-combat.ts:150`).
  - The Warden is the only boss.
- **Salvage runs out of uses [C][S].**
  - Every one-off purchase costs about 1,510 Salvage in total. That is the three systems, Respawn Core, utilities and the second weapon tier, but not repeat shields or repairs.
  - A greedy bot bought everything by wave 20–25. It then held over 3,000 Salvage by wave 50 with nothing to spend it on.
- **New content ends early [C].**
  - Debris speed and count stop rising by wave 27, the spawn interval by wave 34 and enemy health by wave 36.
  - The last new rule arrives at wave 41.
  - From wave 31, about 60% of the waves that aren't fifth waves use one of two fixed hazard pairs (`spill-hazards.ts:56-59`).
- **The safety net is generous [C][S].**
  - The deliberate stock-ship escape corridor (`spillEscapeY`, `spill.ts:643-657`) is never drawn.
  - A bot that followed it, used the marked refuges and sidestepped frozen aims cleared waves 16–33 without buying anything.
  - The corridor is a required rule. The design question is how forgiving it should stay late in a run, not whether it should exist.

## 1. Fix first: bugs found

| # | Issue | Evidence | Size |
|---|---|---|---|
| 1 | Escape, or switching tab or app, at the briefing or Depot opens a **"PAUSED · WAVE 0 · 0 SALVAGE"** sheet with Abort. `engine.pause()` only checks `screen === "play"`. | [B] [C] `engine.ts:1033`, `:1800`, `:1900-1910` | S |
| 2 | Dying mid-climax empties the rest of that wave. `lose()` clears the Warden, but `climax.spawned` stays true. | [C] `spill.ts:1287`, `spill-climax.ts:23` | S |
| 3 | In portrait, the results screen's **FLY AGAIN** is below the fold. Sticky actions only apply in short landscape. | [B] `space-ui.css:527-531` | S |
| 4 | In landscape, the opening Depot hides the free-upgrade **Buy** button below the scroller, while the hint ring points at it. | [B] | S |
| 5 | After a purchase, the Depot shows the *next* tier's effect beside "✓ fitted". For example, Thrusters I claims 2 dodge charges, but `maxLunges` only gives 2 from tier II. | [B] `spill-workshop.ts:499-502`, `spill.ts:631` | S |
| 6 | The full "How to fly" briefing repeats on every run. `spillDepotGuideSeen` is saved but never read. | [B] [C] `spill-workshop.ts:166` | S |
| 7 | The respawn sweep `shatter()`s nearby debris, which pays score, contract progress and Salvage drops. | [C] `spill.ts:1530-1534` | S |
| 8 | Salvage Armor's repair counter carries over between hits. The first coin after a hit can heal at once. | [C] `spill.ts:1436-1440` | S |
| 9 | Copy and labels: "RESUME RUN · WAVE 0 DEPOT"; the countdown hint overlaps the ship in portrait; the debrief says "Salvage recovered 0" while 12 was held; HULL vs Health; two duplicate prompt toggles in Settings. | [B] | S |

Heavy Cannon tier III also one-shots the Warden (12 damage against 12 health). Climax waves stop all other spawns from 45% of the wave onward, so they play easier than the waves around them. This is a balance issue, not a bug.

## 2. Quick wins: quality of life (each S unless noted)

1. **Confirm Abort and style it as danger.** Reuse `confirmSheet()` and `mwr-button-danger`. Today one tap ends the run, and the button looks like Resume.
2. **Better pause screen.** Show hull and shields, and the Music and SFX toggles (reuse `toggle()`). Add a short 3-2-1 before control returns, because both fingers must be re-placed.
3. **Dodge-charge pips in the edge HUD.** `lungeCharges` and its cooldown are never drawn. Players can't tell whether a flick is available.
4. **Short briefing for returning players.** Read the existing `spillDepotGuideSeen` flag. The **?** button and the Settings guide remain.
5. **Bank records on every wave clear,** not only at Depots and on death. The ledger is already idempotent. Guard it with `!trial` so Flight Trials still never write.
6. **Haptics toggle.** Feature-detected `navigator.vibrate` on hit, hull loss and death. Add an optional `hapticsOff` field. Android only.
7. **Depot tier copy.** Label the next tier "Next:" and state what is fitted. Compose this in the host so content-hash tests stay pinned.
8. **Debrief: cause of death and time survived (M).** `cause` today is only STRUCK or GROUNDED. Recording the killer (comet, mine, Warden volley, debris) is cheap and makes deaths feel fair.
9. **Undo the last Depot purchase (M).** `depot.bought` is recorded per visit but never used.
10. **Accessibility settings (M).**
    - HUD and text scale: canvas HUD text is 10 px.
    - Stick size, sensitivity and flick threshold.
    - A high-contrast or colourblind palette for warning colours.
    - Defaults stay equal to today's values, so the gesture regressions still hold.

## 3. Depth: gameplay (ranked by value for effort)

1. **A score system that rewards skill, plus a late Salvage sink (S).**
   - Today about 80% of score is coin combo [S]. Kills pay 25–75 and a graze pays 6.
   - Feed the combo from kills, grazes, mine disarms, weak points, environmental kills and the Warden.
   - Add a Depot option to convert surplus Salvage into score or a cosmetic engine trail.
   - Hooks: `stepNuts`, `killEnemy`, `damageSpillHazard`, `SPILL_SHOP`.
2. **Make the two weapons play differently (S–M).**
   - Examples: laser heat with an overheat window; cannon rounds that pierce shards or push mines.
   - Keep hold-to-fire as accepted. Hooks: `SPILL_WEAPONS`, `spillWeaponStats`.
3. **Contracts for the new systems (S).**
   - Today there are three contracts with fixed rewards. "Clear a Path" still tells players to "use Impact pulse or upgraded dashes", which predates weapons.
   - Add contracts for disarming mines, killing the Warden, sheltering from a flare and making an environmental kill.
   - Hooks: `SpillContractKind`, `settleContract`.
4. **New enemy behaviours on the existing warning rules (M).**
   - Four ideas, each reusing something that already exists:
     - a **minelayer** reusing the mine actor;
     - a **lancer** reusing the ion band;
     - an **escort** shielded from the front;
     - a **salvage thief** that steals uncollected pickups.
   - Keep warnings of at least 0.9 s and at least 0.75 s of shot travel. New sprites need provenance in COMBAT_ASSETS.
5. **Boss variety (M).**
   - Rotate fifth-wave elites built on hazard actors, for example a gravity-well carrier or a flare-shielded wreck core.
   - Escalate the attack patterns rather than health; against today's fork volley, standing still is safe.
   - Give a kill a real reward: a combo burst or an artifact reroll.
6. **Sector mutators past wave 41 (M).**
   - Each 10-wave sector draws one rule, announced in the **Next five waves** forecast and paying score rather than Salvage.
   - Example rules: denser comets, mines that chain further, low visibility.
   - Keep shared warning floors and concurrency caps. Hooks: `spillWaveSpec`, `spillHazardPlan`, forecast metadata.
7. **Risk routes that bite (S).**
   - Patrol adds no extra arrivals from wave 10 (`min(5, 5+1)`).
   - Volatile only changes comet, gravity and ion waves.
   - Once Salvage saturates, their rewards stop mattering. Pay them in score or rare artifact odds instead.
8. **More artifacts that interact with hazards (M).**
   - Examples: shots that bend near gravity wells; Pulse charging while sheltered from a flare; mine-disarm chains.
   - Reclaimer's +8 Salvage per wave goes stale once Salvage saturates.
9. **Unlocks earned through achievements (M).**
   - Sidegrades unlocked by deeds such as "disarm 50 mines" or "beat a Warden without being hit", not by best wave alone.
   - EVALUATION.md already rules out a permanent damage grind.

## 4. Platform and performance

1. **Installable web app and offline play (M).**
   - Add a manifest, icons and a service worker keyed to `ART_VER`.
   - Request `navigator.storage.persist()`: iOS can evict storage for sites not opened in 7 days, which erases saves.
   - Add an Android fullscreen toggle and a screen wake lock during flight.
2. **Faster first load (M–L).**
   - Startup today is 196 requests and about 15 MB [B]: about 11.5 MB of art, 1.8 MB of unminified JS and 1.2 MB of TTF fonts. Time to menu was 15.6 s on a 9 Mbps link and 59 s on 1.6 Mbps.
   - About 600 KB of other-mode JS and 1.6 MB of legacy pilot art load at boot.
   - Add a progress bar, defer non-Spill modules, and ship WebP/WOFF2 copies alongside the originals with manifest records.
   - A bundler is a new dev dependency and needs owner approval.
3. **Storage failure notice (S).** When storage is unavailable, saves silently fall back to memory. Tell the player.

## 5. Audio follow-ups to the placeholder score

1. **Commission the real soundtrack.** The placeholder already defines the cue list: menu, Depot, flight, Warden. Add results/game over and a short wave-clear sting. Composer brief: loopable, mixed to sit under the SFX, delivered as stems if adaptive layering is wanted.
2. **Adaptive layers (M).** Raise the flight loop's intensity per sector, or while a hazard is live, by adding drums, an arpeggio or a key change. The sequencer already mixes each voice separately, so per-layer gain is a small addition.
3. **Stingers (S).** Wave clear, Warden defeated, artifact recovered and death, timed to the beat.
4. **Volume sliders (S).** Separate Music and SFX levels instead of on/off switches. Add optional numeric save fields.

## Needs an owner decision before any work

- **Daily seed with local bests.** All randomness flows from one seed, so this is cheap, but AGENTS.md bars new modes without direction.
- **Keep the last Depot checkpoint after launch,** so a killed tab doesn't lose the run. Today launching clears it (`engine.ts:954`), which changes the documented "no mid-wave save" rule.
- **Late-run tuning of the escape corridor and climax waves:** how forgiving the stock-ship answer should be after wave 30.
- **Adding a bundler or minifier** as a dev dependency.

## Method and limits

Two read-only reviews ran alongside the soundtrack work, one on gameplay systems and one on quality of life and UI. Their headline claims were spot-checked in code or screenshots before inclusion: weapon damage per second, the climax respawn path, the Depot Escape pause, results-screen overflow, the unread guide flag, the dodge-charge rule and the economy totals. None of this was checked on a physical phone, for two-finger ergonomics, for real device frame rate, or for human long-run balance.
