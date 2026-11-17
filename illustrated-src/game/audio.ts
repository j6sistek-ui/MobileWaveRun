// Sound for a game set in space. The old bank was one bare oscillator per
// event, which is where the chirp-and-boing came from: a square wave is a
// toy, not a thruster. Everything here is built from two ingredients
// instead — filtered NOISE, which is what exhaust and impacts actually
// are, and tuned tone, which carries the pitch — and every voice is fed
// through a shared plate so the whole game sounds like it is happening
// somewhere large.

import { ChipPlayer, type SongId } from "./chiptune";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let verb: GainNode | null = null;
let noise: AudioBuffer | null = null;

function ac() {
  if (!ctx) {
    const C =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new C();
    build(ctx);
  }
  // "interrupted" (WebKit, after a call or Siri) needs the same nudge as "suspended"
  if (ctx.state !== "running") ctx.resume().catch(() => { /* a closed context stays closed */ });
  return ctx;
}

// Master chain: everything lands on a compressor so a flurry of taps
// cannot stack into clipping, however fast the player is going.
function build(c: AudioContext) {
  const comp = c.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.knee.value = 22;
  comp.ratio.value = 8;
  comp.attack.value = 0.003;
  comp.release.value = 0.18;
  comp.connect(c.destination);

  master = c.createGain();
  master.gain.value = 0.9;
  master.connect(comp);

  // A short synthetic plate. Decaying noise is a crude impulse response,
  // but it is the difference between sounds happening AT you and sounds
  // happening around you — which is the whole point of the ask.
  const len = Math.floor(c.sampleRate * 1.8);
  const ir = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      const t = i / len;
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.6) * (1 - t * 0.35);
    }
  }
  const conv = c.createConvolver();
  conv.buffer = ir;
  // roll the top off the tail so the space reads as big, not brittle
  const tame = c.createBiquadFilter();
  tame.type = "lowpass";
  tame.frequency.value = 3600;
  conv.connect(tame);
  tame.connect(master);

  verb = c.createGain();
  verb.gain.value = 1;
  verb.connect(conv);

  // one second of white noise, reused by every voice that needs it
  const nlen = Math.floor(c.sampleRate);
  noise = c.createBuffer(1, nlen, c.sampleRate);
  const nd = noise.getChannelData(0);
  for (let i = 0; i < nlen; i++) nd[i] = Math.random() * 2 - 1;
}

export function unlockAudio() {
  try {
    ac();
  } catch {
    /* ignore */
  }
}

// ————— Music: a synthesized placeholder score, one song at a time —————
// The Acornaut recordings that came across with the extraction are retired
// (owner direction, 17 Nov 2026). chiptune.ts holds four short 8-bit loops —
// MENU for every screen outside a run, DEPOT for docking and the shop, FLIGHT
// for normal waves and WARDEN for the fifth-wave climax — synthesized on the
// shared WebAudio graph, so the phone's silent switch hushes them with the
// effects and no audio file is downloaded. They are placeholders until a real
// score exists; swap the song table, not this plumbing.
export type MusicTrack = SongId;
// The bus level matches the retired recordings' in-game loudness (about
// -32 dB RMS): the score is a floor under the SFX, not a ceiling over them.
const MUSIC_LEVEL = 0.11;
// Pausing keeps the tune but drops it well under anything else.
const MUSIC_DUCKED = 0.32;
let musicBus: GainNode | null = null;
let player: ChipPlayer | null = null;
let musicWanted: MusicTrack | null = null;
let musicMuted = false;
let musicDucked = false;
let musicUnlockArmed = false;
let lifecycleArmed = false;
let gestured = false;
let asleep = false;

function audioSupported() {
  return typeof window !== "undefined"
    && !!(window.AudioContext || (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext);
}

// Never build the context before the player has touched the page: browsers
// refuse to start it then (and say so in the console). The first gesture —
// caught by armMusicUnlock — starts the score instead.
function mayStartAudio() {
  if (ctx) return true;
  const activation = typeof navigator !== "undefined"
    ? (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation : undefined;
  return gestured || !!activation?.hasBeenActive;
}

function bus(c: AudioContext) {
  if (!musicBus) {
    musicBus = c.createGain();
    musicBus.gain.value = MUSIC_LEVEL * (musicDucked ? MUSIC_DUCKED : 1);
    musicBus.connect(master ?? c.destination);
  }
  return musicBus;
}

function startWanted(fadeSec = 0.35) {
  if (!musicWanted || musicMuted || asleep || !audioSupported() || !mayStartAudio()) return;
  if (player?.id === musicWanted) { player.resume(); return; }
  try {
    const c = ac();
    player?.stop(0.45);
    player = new ChipPlayer(c, bus(c), musicWanted);
    player.start(fadeSec);
  } catch {
    player = null; // no audio device: the game is still playable
  }
}

function stopPlayer(fadeSec: number) {
  player?.stop(fadeSec);
  player = null;
}

// One document listener starts the wanted song on the first interaction.
// Mobile browsers count only some events as a gesture that may start audio
// (touch END, not touch start, in Chrome), so several are watched and the
// listener stays armed: it also nudges a context the OS interrupted.
function armMusicUnlock() {
  if (musicUnlockArmed || typeof document === "undefined") return;
  musicUnlockArmed = true;
  const kick = () => {
    gestured = true;
    try { if (audioSupported()) ac(); } catch { /* no audio device: the game is still playable */ }
    if (!player) startWanted(0.6);
  };
  for (const type of ["pointerdown", "pointerup", "touchend", "keydown", "click"])
    document.addEventListener(type, kick, { capture: true, passive: true });
}

// THE APP GOES AWAY, AND SO SHOULD THE SOUND (App Store prep audit, section
// 2). Hiding the page stops the sequencer and suspends the context so a phone
// locked mid-flight does not keep scheduling notes behind the lock screen; a
// context left running across an interruption also comes back wrong on iOS.
// Coming back resumes the same song where it stopped if it is still wanted.
function armLifecycle() {
  if (lifecycleArmed || typeof document === "undefined") return;
  lifecycleArmed = true;
  const sleep = () => {
    asleep = true;
    player?.pause();
    if (ctx && ctx.state === "running") void ctx.suspend();
  };
  const wake = () => {
    asleep = false;
    if (!ctx) return;
    // "interrupted" (WebKit, after a call or Siri) needs the same nudge as "suspended"
    if (ctx.state !== "running") ctx.resume().catch(() => { /* a closed context stays closed */ });
    startWanted(0.3);
  };
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") sleep(); else wake();
  });
  // pagehide fires where visibilitychange does not: a WKWebView going into
  // the back/forward cache, and a tab being closed
  window.addEventListener("pagehide", sleep);
  window.addEventListener("pageshow", wake);
}

export const music = {
  // Called every frame with the track the moment wants (or null for
  // silence). It debounces itself, so the engine can call it unconditionally.
  set(track: MusicTrack | null) {
    if (track === musicWanted) return;
    musicWanted = track;
    if (!track) { stopPlayer(0.45); return; }
    armMusicUnlock();
    armLifecycle();
    startWanted();
  },
  setMuted(m: boolean) {
    if (m === musicMuted) return;
    musicMuted = m;
    if (m) stopPlayer(0.2);
    else startWanted(0.4);
  },
  /** Drop the score under the pause menu without losing its place. */
  duck(on: boolean) {
    if (on === musicDucked) return;
    musicDucked = on;
    if (musicBus && ctx) musicBus.gain.setTargetAtTime(MUSIC_LEVEL * (on ? MUSIC_DUCKED : 1), ctx.currentTime, 0.08);
  },
  muted: () => musicMuted,
  playing: () => player?.id ?? null,
};

function out(c: AudioContext, node: AudioNode, dry: number, wet: number) {
  const d = c.createGain();
  d.gain.value = dry;
  node.connect(d);
  d.connect(master!);
  if (wet > 0 && verb) {
    const w = c.createGain();
    w.gain.value = wet;
    node.connect(w);
    w.connect(verb);
  }
}

/** A filtered burst of noise: exhaust, impact, hiss — anything unpitched. */
function burst(o: {
  dur: number;
  from: number;
  to: number;
  q?: number;
  type?: BiquadFilterType;
  gain?: number;
  attack?: number;
  wet?: number;
  delay?: number;
}) {
  const c = ac();
  if (!noise) return;
  const t = c.currentTime + (o.delay ?? 0);
  const src = c.createBufferSource();
  src.buffer = noise;
  src.loop = true;
  src.playbackRate.value = 0.85 + Math.random() * 0.3;

  const f = c.createBiquadFilter();
  f.type = o.type ?? "bandpass";
  f.Q.value = o.q ?? 1;
  f.frequency.setValueAtTime(o.from, t);
  f.frequency.exponentialRampToValueAtTime(Math.max(30, o.to), t + o.dur);

  const g = c.createGain();
  const atk = Math.min(o.attack ?? 0.008, o.dur * 0.5);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(o.gain ?? 0.14, t + atk);
  g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);

  src.connect(f);
  f.connect(g);
  out(c, g, 1, o.wet ?? 0.16);
  src.start(t);
  src.stop(t + o.dur + 0.05);
}

/** A tuned voice: the pitched half of a sound. */
function tone(o: {
  freq: number;
  to?: number;
  dur: number;
  type?: OscillatorType;
  gain?: number;
  attack?: number;
  wet?: number;
  delay?: number;
  detune?: number;
}) {
  const c = ac();
  const t = c.currentTime + (o.delay ?? 0);
  const osc = c.createOscillator();
  osc.type = o.type ?? "sine";
  osc.detune.value = o.detune ?? 0;
  osc.frequency.setValueAtTime(o.freq, t);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t + o.dur);

  const g = c.createGain();
  const atk = Math.min(o.attack ?? 0.006, o.dur * 0.5);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(o.gain ?? 0.09, t + atk);
  g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);

  osc.connect(g);
  out(c, g, 1, o.wet ?? 0.2);
  osc.start(t);
  osc.stop(t + o.dur + 0.05);
}

// THE SOUND EFFECTS SWITCH. Every effect below passes through guard(), so
// this is the one place the switch has to be honoured - a muted pilot
// pays nothing for a flap but the function call. The score is a separate
// switch (music.setMuted): a pilot who wants the tune without the thrust,
// or the reverse, gets exactly that.
let sfxMuted = false;
export function setSfxMuted(m: boolean) {
  sfxMuted = m;
}
function guard(fn: () => void) {
  if (sfxMuted) return;
  try {
    fn();
  } catch {
    /* audio is never worth breaking a frame over */
  }
}

// Taps come in fast, and identical repeats read as a machine gun. Each
// burn is nudged in pitch and level so a run of them breathes.
let lastFlap = -1;

export const sfx = {
  // A deep THRUST, not a high burst. The first pass sat too high — a
  // bright jet sweeping up to ~2kHz over and over is fatiguing. This one
  // keeps its weight low: a lowpassed roar of exhaust that stays under
  // 700Hz, a firm low-sine thump for the kick in the back, and only a
  // whisper of bandpassed air on top so it still reads as a jet, not a
  // rumble. No high hiss layer at all. Bandpassed/lowpassed noise is
  // quiet by nature, so these gains run high and still sit right.
  flap: () =>
    guard(() => {
      const c = ac();
      const now = c.currentTime;
      // a rapid double-tap would otherwise pile two full thrusts on top
      // of each other; the second one is just the roar, softer
      const dense = now - lastFlap < 0.09;
      lastFlap = now;
      const v = 0.94 + Math.random() * 0.12;
      // the body of the thrust: a low roar of exhaust, opening only a
      // little so the energy stays down where a rocket lives
      burst({
        dur: dense ? 0.16 : 0.3,
        from: 150 * v,
        to: 680 * v,
        q: 0.7,
        type: "lowpass",
        gain: (dense ? 0.5 : 0.9) * v,
        wet: 0.12,
      });
      // the shove in the back: a firm low sine, dropping into sub
      // territory. A softer attack keeps its onset from clicking bright.
      tone({ freq: 132 * v, to: 46, dur: dense ? 0.16 : 0.26, gain: dense ? 0.16 : 0.26, attack: 0.01, wet: 0.06 });
      if (!dense) {
        // a breath of low-mid air so it still reads as a jet — quiet, and
        // it sweeps DOWN, kept under 900Hz so nothing ever gets shrill
        burst({ dur: 0.24, from: 820, to: 360, q: 0.8, gain: 0.05, wet: 0.14 });
      }
    }),

  // Falling: the burn inverted — a long lowpassed whoosh dropping away.
  dive: () =>
    guard(() => {
      burst({ dur: 0.36, from: 1900, to: 190, q: 0.7, type: "lowpass", gain: 0.13, wet: 0.2 });
      tone({ freq: 300, to: 90, dur: 0.34, type: "triangle", gain: 0.06, wet: 0.18 });
    }),

  // Hull contact: a dull thud with a short metallic ring over it. No
  // boing — the ring is two close sines beating against each other,
  // which is what struck metal actually does.
  bounce: () =>
    guard(() => {
      burst({ dur: 0.16, from: 900, to: 130, q: 0.8, type: "lowpass", gain: 0.16, attack: 0.002 });
      tone({ freq: 190, to: 120, dur: 0.16, gain: 0.1, attack: 0.002, wet: 0.12 });
      tone({ freq: 640, dur: 0.22, gain: 0.035, attack: 0.002, wet: 0.4 });
      tone({ freq: 640, dur: 0.22, gain: 0.03, attack: 0.002, wet: 0.4, detune: 24 });
    }),

  // Collected: a clean bell doubled at the octave, wet enough to ring out
  // instead of clicking shut.
  acorn: () =>
    guard(() => {
      tone({ freq: 880, dur: 0.16, gain: 0.07, wet: 0.4 });
      tone({ freq: 1760, dur: 0.12, gain: 0.028, wet: 0.45 });
      burst({ dur: 0.07, from: 4200, to: 6800, q: 2.2, gain: 0.02, wet: 0.3 });
    }),

  // Golden: the same bell, arpeggiated upward and left to bloom.
  gold: () =>
    guard(() => {
      [0, 0.055, 0.11].forEach((d, i) => {
        tone({ freq: 660 * Math.pow(1.335, i), dur: 0.4, gain: 0.055, wet: 0.55, delay: d });
      });
      tone({ freq: 1980, dur: 0.5, gain: 0.02, wet: 0.7, delay: 0.11 });
    }),

  // Wormhole section change: restrained and low so it can sit beneath
  // frequent tap thrusts without becoming another melody to follow.
  section: () =>
    guard(() => {
      tone({ freq: 185, to: 245, dur: 0.26, type: "triangle", gain: 0.045, wet: 0.36 });
      burst({ dur: 0.22, from: 520, to: 920, q: 1.1, gain: 0.025, wet: 0.28 });
    }),

  // Debris warning: two compact low pulses, audible but never a shrill
  // alarm. The visual edge beacon carries the exact lane information.
  warning: () =>
    guard(() => {
      tone({ freq: 310, to: 225, dur: 0.13, type: "triangle", gain: 0.075, wet: 0.16 });
      burst({ dur: 0.08, from: 880, to: 540, q: 1.8, gain: 0.035, wet: 0.12 });
      tone({ freq: 290, to: 210, dur: 0.13, type: "triangle", gain: 0.065, wet: 0.16, delay: 0.16 });
      burst({ dur: 0.08, from: 820, to: 500, q: 1.8, gain: 0.03, wet: 0.12, delay: 0.16 });
    }),

  region: () =>
    guard(() => {
      tone({ freq: 220, to: 330, dur: 0.4, type: "triangle", gain: 0.045, wet: 0.58 });
      tone({ freq: 440, to: 550, dur: 0.34, type: "sine", gain: 0.025, wet: 0.64, delay: 0.08 });
    }),

  // A close pass is a short rush of air, deliberately unpitched so it
  // rewards precision without fighting the acorn and Flow cues.
  near: () =>
    guard(() => {
      burst({ dur: 0.24, from: 1500, to: 260, q: 0.8, type: "bandpass", gain: 0.075, wet: 0.3 });
      tone({ freq: 260, to: 420, dur: 0.18, gain: 0.035, wet: 0.3 });
    }),

  freeze: () =>
    guard(() => {
      tone({ freq: 760, to: 310, dur: 0.48, type: "sine", gain: 0.06, wet: 0.62 });
      tone({ freq: 1140, to: 520, dur: 0.38, type: "triangle", gain: 0.025, wet: 0.68 });
      burst({ dur: 0.5, from: 2200, to: 480, q: 1.5, type: "lowpass", gain: 0.04, attack: 0.04, wet: 0.5 });
    }),

  milestone: () =>
    guard(() => {
      [330, 495, 660].forEach((freq, i) =>
        tone({ freq, dur: 0.34, gain: 0.045, wet: 0.55, delay: i * 0.075 }));
    }),

  // Shield: a rising swell with air moving through it, not a plain sine.
  shield: () =>
    guard(() => {
      tone({ freq: 300, to: 720, dur: 0.34, gain: 0.075, attack: 0.05, wet: 0.45 });
      burst({ dur: 0.42, from: 700, to: 3200, q: 1.6, gain: 0.045, attack: 0.09, wet: 0.5 });
    }),

  // The crossing between the two games: everything drawn inward and up,
  // then a low boom as you arrive on the far side.
  shift: () =>
    guard(() => {
      burst({ dur: 0.5, from: 400, to: 4200, q: 1.2, gain: 0.08, attack: 0.2, wet: 0.6 });
      tone({ freq: 520, to: 130, dur: 0.55, type: "sawtooth", gain: 0.05, attack: 0.12, wet: 0.5 });
      tone({ freq: 70, to: 40, dur: 0.7, gain: 0.12, wet: 0.3, delay: 0.34 });
      burst({ dur: 0.6, from: 2600, to: 300, q: 0.5, type: "lowpass", gain: 0.09, wet: 0.55, delay: 0.34 });
    }),

  // Decompression: the whole thing falls out from under you.
  die: () =>
    guard(() => {
      burst({ dur: 0.75, from: 1500, to: 90, q: 0.6, type: "lowpass", gain: 0.15, wet: 0.4 });
      tone({ freq: 220, to: 42, dur: 0.8, type: "sawtooth", gain: 0.075, wet: 0.35 });
      tone({ freq: 110, to: 34, dur: 0.9, gain: 0.08, wet: 0.3 });
    }),

  // Interface: a soft filtered tick, kept dry so menus stay close.
  ui: () =>
    guard(() => {
      burst({ dur: 0.05, from: 1800, to: 900, q: 2.5, gain: 0.05, attack: 0.002, wet: 0.08 });
    }),
};
