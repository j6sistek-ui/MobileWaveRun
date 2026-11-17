# Audio and placeholder score

## Status

On 2026-11-17 the owner directed removal of the Acornaut soundtrack that came across with the extraction. The Spill now plays a **synthesized 8-bit placeholder score**. It is not intended to ship. It holds tempo and mood until a real soundtrack is commissioned.

- The retired files are `public/art/music/menu.mp3` and `public/art/music/flight.mp3`. They are recorded in [`retired-asset-manifest.json`](../retired-asset-manifest.json), with their pinned hashes. The historical `asset-manifest.json` is unchanged.
- `scripts/verify-assets.mjs` checks three things. Each retired entry must match its pinned upstream hash. The file must be absent from `public/`. No audio file may ship without a provenance record.
- No audio file is downloaded. The score is generated at runtime on the shared WebAudio graph, the same one the sound effects use. The phone's silent switch therefore silences music and effects together.

## The four loops

All four were written for this repository in [`illustrated-src/game/chiptune.ts`](../illustrated-src/game/chiptune.ts). Each uses two pulse voices (lead and arpeggio or counter-melody), a triangle bass and a noise kit.

| Track | Title | Tempo | When it plays |
|---|---|---|---|
| `menu` | Drift Signal | 92 BPM, A minor | Title, settings, results, and after a lost run (`over`) |
| `depot` | Dock Lights | 108 BPM swing, C major | Launch prep (`ready`), docking and the Depot |
| `flight` | Debris Run | 150 BPM, E minor | Countdown, waves, drain and respawn |
| `warden` | Warden Protocol | 168 BPM, D minor | While a live fifth-wave Warden elite is on the field |

Selection lives in `spillMusicTrack()` (`engine.ts`). Songs crossfade over about 0.45 s. Pausing keeps the current song and ducks it to 32% of its normal level. The Settings **Music** switch stops the sequencer entirely.

## Behaviour and limits

- **Gesture gate.** No `AudioContext` is created before the player first touches the page or presses a key. The browser would refuse to start it anyway, and say so in the console. The unlock listener watches `pointerdown`, `pointerup`, `touchend`, `keydown` and `click`, because mobile Chrome only treats touch *end* as a gesture.
- **Scheduling.** A lookahead scheduler queues 0.3 s of notes on the audio clock every 50 ms, so frame-rate hitches do not make the music stutter. After a stall it skips ahead rather than bunching late notes together.
- **Lifecycle.** Hiding the page (lock screen, app switch, `pagehide`) stops scheduling and suspends the context. Returning resumes the same song where it stopped.
- **Level.** The music bus is calibrated to the retired recordings' in-game loudness, about −32 dB RMS after the master compressor. This was measured by rendering each loop offline in Chromium.

## Replacing the placeholder

1. Edit the `SONGS` table in `chiptune.ts` to change the tunes. The tracker notation is documented at the top of that file. The compiler rejects ragged bars.
2. To use recorded music, put a streaming player behind the same `music` API in `audio.ts` (`set`, `setMuted`, `duck`, `muted`, `playing`). Add the files with a provenance record, then relax the audio-file guard in `verify-assets.mjs`. Keep the shared-graph routing so the silent switch still works.

`tests/test-music.mjs` checks that every song compiles, that track selection follows the run, and that the player handles the gesture gate, switching, mute, duck and page sleep. It uses a recording WebAudio fake. It proves wiring, not how the music sounds on a phone speaker.
