// PLACEHOLDER SCORE (owner direction, 17 Nov 2026). The Acornaut menu and
// flight recordings that came across with the extraction are retired; The
// Spill needs its own soundtrack, and until one is commissioned it plays
// these four short 8-bit loops. They were written for this repository and are
// synthesized at runtime from pulse, triangle and noise voices, so nothing is
// streamed or shipped as an audio file. Replace the song table (or the whole
// module behind `music` in audio.ts) when the real score arrives.
//
// The sequencer is deliberately small: songs are chord charts plus hand
// written melody lines in a 16-step-per-bar tracker notation, compiled once
// into per-step events. A lookahead scheduler queues notes on the audio clock
// so the game's frame rate never makes the music stutter.

export type SongId = "menu" | "depot" | "flight" | "warden";

type BassStyle = "hold" | "half" | "walk" | "octave" | "drive" | "gallop";
type ArpStyle = "up8" | "up16" | "updown16" | "stab";

type Section = {
  /** One chord per bar, e.g. "Am7", "F#m", "Bb". */
  chords: string[];
  /** Melody on pulse 1: whitespace separated, 16 tokens per bar.
   *  A note ("C5", "F#4", "Bb3") starts, "-" holds it, "." is silence. */
  lead?: string;
  /** Optional counter-melody on pulse 2, which then replaces the arpeggio. */
  counter?: string;
  bass?: BassStyle;
  arp?: ArpStyle;
  /** 16 characters, repeated every bar: k kick, s snare, h hat, o open hat,
   *  x kick+hat, c crash, . nothing. */
  drums?: string;
  /** Replaces `drums` on the section's final bar. */
  fill?: string;
};

type Song = {
  title: string;
  bpm: number;
  /** 0 = straight 16ths; 0.2 pushes every off-step a fifth of a step late. */
  swing?: number;
  leadDuty: number;
  arpDuty: number;
  /** Per-voice levels before the shared music bus. */
  mix: { lead: number; arp: number; bass: number; drums: number };
  sections: Record<string, Section>;
  order: string[];
  /** Index into `order` the loop returns to (skips an intro). */
  loopFrom: number;
};

// ————— The four loops —————
// Kept short and generic on purpose: they only need to set tempo and mood for
// menus, the Depot, normal waves and the Warden until the real score exists.
const SONGS: Record<SongId, Song> = {
  // Title, settings and results: slow, spacious, a little lonely.
  menu: {
    title: "Drift Signal", bpm: 92, leadDuty: 0.5, arpDuty: 0.25,
    mix: { lead: 0.15, arp: 0.075, bass: 0.34, drums: 0.5 },
    sections: {
      intro: { chords: ["Am7", "Fmaj7", "Dm7", "E"], bass: "hold", arp: "up8", drums: "h.......h......." },
      theme: {
        chords: ["Am7", "Fmaj7", "Dm7", "E"], bass: "half", arp: "up8", drums: "k.......h...h...",
        lead: "E5 - - - - - D5 - C5 - - - B4 - - - "
          + "A4 - - - - - - - C5 - - - E5 - - - "
          + "F5 - - - E5 - - - D5 - - - C5 - D5 - "
          + "B4 - - - - - - - G#4 - - - - - . . ",
      },
      answer: {
        chords: ["Fmaj7", "G", "Em7", "Am"], bass: "half", arp: "up8", drums: "k.......h...h.h.",
        lead: "A5 - - - G5 - - - F5 - E5 - - - C5 - "
          + "D5 - - - - - - - B4 - - - G4 - - - "
          + "E5 - - - G5 - - - B5 - - - A5 - G5 - "
          + "A5 - - - - - - - - - - - . . . . ",
      },
    },
    order: ["intro", "theme", "answer", "intro", "theme", "answer"], loopFrom: 0,
  },

  // The Depot: unhurried, warm, a shop you are happy to browse.
  depot: {
    title: "Dock Lights", bpm: 108, swing: 0.18, leadDuty: 0.25, arpDuty: 0.125,
    mix: { lead: 0.14, arp: 0.07, bass: 0.34, drums: 0.48 },
    sections: {
      vamp: { chords: ["Cmaj7", "Am7", "Dm7", "G7"], bass: "walk", arp: "up8", drums: "k...s...k.k.s..." },
      tune: {
        chords: ["Cmaj7", "Am7", "Dm7", "G7"], bass: "walk", arp: "up8", drums: "k.h.s.h.k.k.s.h.",
        lead: "E5 - G5 - B5 - - - A5 - G5 - E5 - - - "
          + "C5 - E5 - G5 - - - E5 - - - C5 - - - "
          + "D5 - F5 - A5 - - - C6 - A5 - F5 - - - "
          + "G5 - - - F5 - D5 - B4 - - - - - . . ",
      },
      bridge: {
        chords: ["Fmaj7", "Em7", "Dm7", "G7"], bass: "walk", arp: "up8", drums: "k.h.s.h.k.k.s.h.",
        fill: "k.h.s.h.s.s.sss.",
        lead: "A5 - - - C6 - - - A5 - G5 - F5 - - - "
          + "G5 - - - B5 - - - G5 - E5 - D5 - - - "
          + "F5 - E5 - D5 - C5 - D5 - - - A4 - - - "
          + "B4 - - - D5 - - - F5 - - - G5 - - - ",
      },
    },
    order: ["vamp", "tune", "tune", "bridge", "tune"], loopFrom: 1,
  },

  // Normal waves: driving and bright, room left on top for the effects.
  flight: {
    title: "Debris Run", bpm: 150, leadDuty: 0.5, arpDuty: 0.125,
    mix: { lead: 0.13, arp: 0.055, bass: 0.36, drums: 0.55 },
    sections: {
      intro: {
        chords: ["Em", "C", "D", "B"], bass: "drive", arp: "up16", drums: "k...k...k...k...",
        fill: "k...s...s.s.ssss",
      },
      a: {
        chords: ["Em", "C", "D", "B"], bass: "drive", arp: "up16", drums: "k.h.s.h.k.k.s.h.",
        lead: "E5 - - B4 - - E5 - F#5 - G5 - F#5 - E5 - "
          + "G5 - - E5 - - G5 - A5 - B5 - A5 - G5 - "
          + "F#5 - - D5 - - F#5 - A5 - - - G5 - F#5 - "
          + "D#5 - - - F#5 - - - B5 - - - A5 - F#5 - ",
      },
      b: {
        chords: ["C", "D", "Em", "B"], bass: "octave", arp: "up16", drums: "x.h.s.h.x.k.s.ho",
        fill: "k.h.s.h.k.s.s.ss",
        lead: "E6 - D6 - C6 - B5 - C6 - - - G5 - - - "
          + "D6 - C6 - B5 - A5 - B5 - - - F#5 - - - "
          + "G5 - A5 - B5 - - - E6 - - - D6 - B5 - "
          + "D#6 - - - B5 - - - F#5 - - - D#5 - - - ",
      },
      break: {
        chords: ["Am", "Em", "C", "B"], bass: "gallop", arp: "updown16", drums: "k.h.k.h.k.h.k.hh",
        fill: "k.s.k.s.s.s.ssss",
      },
    },
    order: ["intro", "a", "a", "b", "break", "a", "b"], loopFrom: 1,
  },

  // The Warden: faster, minor, insistent — the fifth-wave climax.
  warden: {
    title: "Warden Protocol", bpm: 168, leadDuty: 0.25, arpDuty: 0.125,
    mix: { lead: 0.14, arp: 0.05, bass: 0.38, drums: 0.58 },
    sections: {
      alarm: {
        chords: ["Dm", "Dm", "Bb", "A"], bass: "gallop", arp: "stab", drums: "k.hkk.hks.hkk.hs",
        fill: "k.s.k.s.s.ssssss",
      },
      a: {
        chords: ["Dm", "Bb", "Gm", "A"], bass: "gallop", arp: "up16", drums: "k.hks.hkk.hks.hs",
        lead: "D5 - D5 - F5 - D5 - A5 - - - G#5 - A5 - "
          + "Bb5 - A5 - F5 - D5 - F5 - - - E5 - F5 - "
          + "G5 - - - Bb5 - - - D6 - C6 - Bb5 - A5 - "
          + "C#6 - - - A5 - - - E5 - - - C#5 - E5 - ",
      },
      b: {
        chords: ["Dm", "Bb", "Gm", "A"], bass: "drive", arp: "updown16", drums: "x.hks.hkx.hks.ho",
        fill: "s.s.s.s.ssssssss",
        lead: "D6 . D6 . . . C6 . . . A5 . . . F5 . "
          + "D6 . D6 . . . F6 . . . E6 . . . D6 . "
          + "Bb5 - - - A5 - - - G5 - - - F5 - - - "
          + "E5 - - - F5 - - - G5 - - - C#6 - - - ",
      },
    },
    order: ["alarm", "a", "b", "a", "b"], loopFrom: 1,
  },
};

export const SONG_IDS = Object.keys(SONGS) as SongId[];
export const songTitle = (id: SongId) => SONGS[id].title;

// ————— Compilation —————
type Voice = "lead" | "arp" | "bass" | "drum";
type Drum = "k" | "s" | "h" | "o" | "c";
type NoteEvent = { voice: Exclude<Voice, "drum">; midi: number; steps: number };
type DrumEvent = { voice: "drum"; drum: Drum };
type StepEvent = NoteEvent | DrumEvent;
export type CompiledSong = {
  id: SongId; title: string; stepSec: number; swing: number;
  leadDuty: number; arpDuty: number; mix: Song["mix"];
  /** order[i] -> per-step event lists */
  sections: StepEvent[][][]; loopFrom: number;
};

const NOTE_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function midiOf(name: string): number {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!m) throw new Error(`Bad note ${name}`);
  return 12 * (Number(m[3]) + 1) + NOTE_PC[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0);
}
const QUALITY: Record<string, number[]> = {
  "": [0, 4, 7], m: [0, 3, 7], "7": [0, 4, 7, 10], m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11],
  sus4: [0, 5, 7], sus2: [0, 2, 7], dim: [0, 3, 6], "6": [0, 4, 7, 9],
};
function chordOf(name: string) {
  const m = /^([A-G])([#b]?)(.*)$/.exec(name);
  if (!m || !(m[3] in QUALITY)) throw new Error(`Bad chord ${name}`);
  const pc = (NOTE_PC[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0) + 12) % 12;
  return { pc, tones: QUALITY[m[3]] };
}

// Bass patterns per bar: [semitones above the root, length in 16th steps].
const BASS: Record<BassStyle, [number, number][]> = {
  hold: [[0, 16]],
  half: [[0, 8], [7, 8]],
  walk: [[0, 4], [7, 4], [12, 4], [7, 4]],
  octave: [[0, 2], [12, 2], [0, 2], [12, 2], [0, 2], [12, 2], [0, 2], [12, 2]],
  drive: [[0, 2], [0, 2], [12, 2], [0, 2], [0, 2], [0, 2], [12, 2], [7, 2]],
  gallop: [[0, 1], [0, 1], [12, 2], [0, 1], [0, 1], [12, 2], [0, 1], [0, 1], [7, 2], [0, 1], [0, 1], [12, 2]],
};

function melody(line: string, bars: number, voice: "lead" | "arp", into: StepEvent[][]) {
  const tokens = line.trim().split(/\s+/);
  if (tokens.length !== bars * 16) throw new Error(`Melody needs ${bars * 16} steps, has ${tokens.length}`);
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === "-" || t === ".") continue;
    let steps = 1;
    while (i + steps < tokens.length && tokens[i + steps] === "-") steps++;
    into[i].push({ voice, midi: midiOf(t), steps });
  }
}

function compileSection(sec: Section): StepEvent[][] {
  const bars = sec.chords.length;
  const steps: StepEvent[][] = Array.from({ length: bars * 16 }, () => []);
  sec.chords.forEach((name, bar) => {
    const { pc, tones } = chordOf(name);
    const at = bar * 16;
    // Bass sits between E2 and D#3: low enough to anchor, high enough that a
    // phone speaker can still reproduce it.
    const bassRoot = 40 + ((pc - 4 + 12) % 12);
    let pos = 0;
    for (const [off, len] of BASS[sec.bass ?? "half"]) {
      steps[at + pos].push({ voice: "bass", midi: bassRoot + off, steps: len });
      pos += len;
    }
    if (!sec.counter && sec.arp) {
      // Arpeggio voicing: root between A3 and G#4, tones climbing from it.
      const root = 57 + ((pc - 9 + 12) % 12);
      const up = [...tones.map(t => root + t), root + 12];
      const seq = sec.arp === "updown16" ? [...up, ...up.slice(1, -1).reverse()] : up;
      if (sec.arp === "up8") for (let i = 0; i < 8; i++) steps[at + i * 2].push({ voice: "arp", midi: seq[i % seq.length], steps: 2 });
      else if (sec.arp === "stab") for (const i of [0, 3, 6, 10]) steps[at + i].push({ voice: "arp", midi: up[(i / 3) % up.length | 0] + 12, steps: 1 });
      else for (let i = 0; i < 16; i++) steps[at + i].push({ voice: "arp", midi: seq[i % seq.length], steps: 1 });
    }
    const pattern = bar === bars - 1 && sec.fill ? sec.fill : sec.drums;
    if (pattern) {
      if (pattern.length !== 16) throw new Error(`Drum bar needs 16 steps: ${pattern}`);
      [...pattern].forEach((ch, i) => {
        if (ch === "x") steps[at + i].push({ voice: "drum", drum: "k" }, { voice: "drum", drum: "h" });
        else if (ch !== ".") steps[at + i].push({ voice: "drum", drum: ch as Drum });
      });
    }
  });
  if (sec.lead) melody(sec.lead, bars, "lead", steps);
  if (sec.counter) melody(sec.counter, bars, "arp", steps);
  return steps;
}

const compiled = new Map<SongId, CompiledSong>();
export function compileSong(id: SongId): CompiledSong {
  const hit = compiled.get(id);
  if (hit) return hit;
  const song = SONGS[id];
  const byName = new Map(Object.entries(song.sections).map(([name, sec]) => [name, compileSection(sec)]));
  const out: CompiledSong = {
    id, title: song.title, stepSec: 60 / song.bpm / 4, swing: song.swing ?? 0,
    leadDuty: song.leadDuty, arpDuty: song.arpDuty, mix: song.mix,
    sections: song.order.map(name => {
      const sec = byName.get(name);
      if (!sec) throw new Error(`Unknown section ${name}`);
      return sec;
    }),
    loopFrom: song.loopFrom,
  };
  compiled.set(id, out);
  return out;
}

// ————— Voices —————
const waves = new WeakMap<BaseAudioContext, Map<number, PeriodicWave>>();
const noises = new WeakMap<BaseAudioContext, AudioBuffer>();

/** Band-limited pulse wave with the given duty cycle (0.125/0.25/0.5). */
function pulseWave(c: BaseAudioContext, duty: number) {
  let byDuty = waves.get(c);
  if (!byDuty) waves.set(c, byDuty = new Map());
  let w = byDuty.get(duty);
  if (!w) {
    const n = 48;
    const real = new Float32Array(n), imag = new Float32Array(n);
    for (let k = 1; k < n; k++) {
      real[k] = Math.sin(2 * Math.PI * k * duty) / (Math.PI * k);
      imag[k] = (1 - Math.cos(2 * Math.PI * k * duty)) / (Math.PI * k);
    }
    w = c.createPeriodicWave(real, imag);
    byDuty.set(duty, w);
  }
  return w;
}

/** Coarse, sample-and-held noise: closer to a console noise channel than hiss. */
function noiseBuffer(c: BaseAudioContext) {
  let b = noises.get(c);
  if (!b) {
    const len = Math.floor(c.sampleRate * 0.5);
    b = c.createBuffer(1, len, c.sampleRate);
    const d = b.getChannelData(0);
    let v = 0;
    for (let i = 0; i < len; i++) {
      if (i % 2 === 0) v = Math.random() * 2 - 1;
      d[i] = v;
    }
    noises.set(c, b);
  }
  return b;
}

const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

function envelope(g: GainNode, t: number, dur: number, peak: number, sustain: number) {
  const p = g.gain;
  const decayEnd = t + Math.min(0.08, dur * 0.6);
  p.setValueAtTime(0.0001, t);
  p.linearRampToValueAtTime(peak, t + 0.004);
  p.linearRampToValueAtTime(peak * sustain, decayEnd);
  p.setValueAtTime(peak * sustain, Math.max(decayEnd + 0.001, t + dur - 0.03));
  p.linearRampToValueAtTime(0.0001, t + dur);
}

function pulseNote(c: BaseAudioContext, dest: AudioNode, t: number, dur: number, midi: number,
  duty: number, vol: number, vibrato: boolean) {
  const osc = c.createOscillator();
  osc.setPeriodicWave(pulseWave(c, duty));
  osc.frequency.setValueAtTime(hz(midi), t);
  const g = c.createGain();
  envelope(g, t, dur, vol, 0.72);
  osc.connect(g).connect(dest);
  let lfo: OscillatorNode | null = null;
  if (vibrato && dur > 0.32) {
    // Delayed vibrato on held notes, the classic console lead trick.
    lfo = c.createOscillator();
    lfo.frequency.value = 5.6;
    const depth = c.createGain();
    depth.gain.setValueAtTime(0, t);
    depth.gain.linearRampToValueAtTime(0, t + 0.18);
    depth.gain.linearRampToValueAtTime(14, t + 0.34);
    lfo.connect(depth).connect(osc.detune);
    lfo.start(t);
    lfo.stop(t + dur + 0.02);
  }
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function triangleNote(c: BaseAudioContext, dest: AudioNode, t: number, dur: number, midi: number, vol: number) {
  const osc = c.createOscillator();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(hz(midi), t);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.004);
  g.gain.setValueAtTime(vol, Math.max(t + 0.005, t + dur - 0.02));
  g.gain.linearRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(dest);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function drumHit(c: BaseAudioContext, dest: AudioNode, t: number, kind: Drum, vol: number) {
  if (kind === "k") {
    const osc = c.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(170, t);
    osc.frequency.exponentialRampToValueAtTime(48, t + 0.11);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    osc.connect(g).connect(dest);
    osc.start(t);
    osc.stop(t + 0.18);
  }
  const lengths: Record<Drum, number> = { k: 0.03, s: 0.13, h: 0.035, o: 0.16, c: 0.7 };
  const filters: Record<Drum, [BiquadFilterType, number]> = {
    k: ["lowpass", 900], s: ["bandpass", 1900], h: ["highpass", 7000], o: ["highpass", 6200], c: ["highpass", 4200],
  };
  const levels: Record<Drum, number> = { k: 0.35, s: 0.55, h: 0.22, o: 0.2, c: 0.26 };
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c);
  src.loop = true;
  src.playbackRate.value = kind === "s" ? 0.7 : 1;
  const f = c.createBiquadFilter();
  f.type = filters[kind][0];
  f.frequency.value = filters[kind][1];
  const g = c.createGain();
  const len = lengths[kind];
  g.gain.setValueAtTime(vol * levels[kind], t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  src.connect(f).connect(g).connect(dest);
  src.start(t, Math.random() * 0.3);
  src.stop(t + len + 0.02);
  if (kind === "s") {
    // a short tuned body under the snare's rattle
    const body = c.createOscillator();
    body.type = "triangle";
    body.frequency.setValueAtTime(220, t);
    body.frequency.exponentialRampToValueAtTime(150, t + 0.07);
    const bg = c.createGain();
    bg.gain.setValueAtTime(vol * 0.35, t);
    bg.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    body.connect(bg).connect(dest);
    body.start(t);
    body.stop(t + 0.1);
  }
}

// ————— Player —————
const LOOKAHEAD = 0.3; // seconds of music queued ahead of the audio clock
const PUMP_MS = 50;

/** Plays one song on a loop into `dest`, through its own fade gain. */
export class ChipPlayer {
  readonly id: SongId;
  private readonly song: CompiledSong;
  private readonly out: GainNode;
  private sec = 0;
  private step = 0;
  private next = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private stopped = false;

  constructor(private readonly c: BaseAudioContext, dest: AudioNode, id: SongId) {
    this.id = id;
    this.song = compileSong(id);
    this.out = c.createGain();
    this.out.gain.value = 0;
    this.out.connect(dest);
  }

  /** Begin (or restart the pump) with a fade-in. */
  start(fadeSec = 0.35) {
    const now = this.c.currentTime;
    this.next = now + 0.05;
    this.out.gain.cancelScheduledValues(now);
    this.out.gain.setValueAtTime(0.0001, now);
    this.out.gain.linearRampToValueAtTime(1, now + Math.max(0.01, fadeSec));
    this.resume();
  }

  /** Stop queueing notes; already-queued ones finish. Used while hidden. */
  pause() {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
  }

  resume() {
    if (this.stopped || this.timer !== null) return;
    this.pump();
    this.timer = setInterval(() => this.pump(), PUMP_MS);
  }

  /** Fade out and release every node. The player cannot be restarted. */
  stop(fadeSec = 0.45) {
    if (this.stopped) return;
    this.stopped = true;
    this.pause();
    const now = this.c.currentTime;
    const g = this.out.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(Math.max(0.0001, g.value), now);
    g.linearRampToValueAtTime(0.0001, now + Math.max(0.01, fadeSec));
    setTimeout(() => { try { this.out.disconnect(); } catch { /* already gone */ } }, (fadeSec + LOOKAHEAD) * 1000 + 100);
  }

  /** Queue `seconds` of the song at full level from the current clock,
   *  without the real-time pump: offline previews and tests use this. */
  queue(seconds: number) {
    const now = this.c.currentTime;
    this.out.gain.setValueAtTime(1, now);
    this.next = now;
    this.scheduleUntil(now + seconds);
  }

  private scheduleUntil(until: number) {
    while (this.next < until) {
      this.play(this.next);
      this.advance();
    }
  }

  private pump() {
    const now = this.c.currentTime;
    // After a stall (a long frame, or the tab sleeping) skip ahead rather
    // than firing a burst of late notes on top of each other.
    if (this.next < now - 0.1) this.next = now + 0.03;
    this.scheduleUntil(now + LOOKAHEAD);
  }

  private play(at: number) {
    const s = this.song;
    const t = at + (this.step % 2 === 1 ? s.swing * s.stepSec : 0);
    for (const ev of s.sections[this.sec][this.step]) {
      if (ev.voice === "drum") { drumHit(this.c, this.out, t, ev.drum, s.mix.drums); continue; }
      const dur = ev.steps * s.stepSec * (ev.voice === "bass" ? 0.92 : 0.86);
      if (ev.voice === "bass") triangleNote(this.c, this.out, t, dur, ev.midi, s.mix.bass);
      else if (ev.voice === "lead") pulseNote(this.c, this.out, t, dur, ev.midi, s.leadDuty, s.mix.lead, true);
      else pulseNote(this.c, this.out, t, dur, ev.midi, s.arpDuty, s.mix.arp, false);
    }
  }

  private advance() {
    const s = this.song;
    this.next += s.stepSec;
    if (++this.step >= s.sections[this.sec].length) {
      this.step = 0;
      this.sec = this.sec + 1 >= s.sections.length ? s.loopFrom : this.sec + 1;
    }
  }
}

/** Loop length of a song in seconds, from its first section to the end. */
export function songSeconds(id: SongId) {
  const s = compileSong(id);
  return s.sections.reduce((n, sec) => n + sec.length, 0) * s.stepSec;
}
