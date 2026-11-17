// Placeholder score: song data, track selection and the player's lifecycle.
// A recording fake stands in for WebAudio; it proves scheduling and wiring,
// not how the music sounds on a phone speaker.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createDom } from './helpers/dom.mjs';

const dom = createDom();
const win = dom.win;

class FakeParam {
  constructor(value = 0) { this.value = value; this.targets = []; }
  setValueAtTime(v) { this.value = v; return this; }
  linearRampToValueAtTime(v) { this.value = v; return this; }
  exponentialRampToValueAtTime(v) { this.value = v; return this; }
  setTargetAtTime(v) { this.targets.push(v); this.value = v; return this; }
  cancelScheduledValues() { return this; }
}
class FakeNode {
  constructor(ctx, kind) { this.ctx = ctx; this.kind = kind; this.outputs = []; ctx.nodes.push(this); }
  connect(dest) { this.outputs.push(dest); return dest; }
  disconnect() { this.outputs = []; }
}
class FakeContext {
  static instances = [];
  constructor() {
    FakeContext.instances.push(this);
    this.nodes = []; this.currentTime = 0; this.sampleRate = 8000; this.state = 'running';
    this.destination = new FakeNode(this, 'destination');
  }
  resume() { this.state = 'running'; return Promise.resolve(); }
  suspend() { this.state = 'suspended'; return Promise.resolve(); }
  createGain() { const n = new FakeNode(this, 'gain'); n.gain = new FakeParam(1); return n; }
  createDynamicsCompressor() {
    const n = new FakeNode(this, 'compressor');
    for (const k of ['threshold', 'knee', 'ratio', 'attack', 'release']) n[k] = new FakeParam();
    return n;
  }
  createConvolver() { return new FakeNode(this, 'convolver'); }
  createBiquadFilter() {
    const n = new FakeNode(this, 'filter'); n.frequency = new FakeParam(); n.Q = new FakeParam(); return n;
  }
  createBuffer(channels, length) {
    const data = Array.from({ length: channels }, () => new Float32Array(length));
    return { getChannelData: i => data[i] };
  }
  createBufferSource() {
    const n = new FakeNode(this, 'source'); n.playbackRate = new FakeParam(1);
    n.start = () => {}; n.stop = () => {}; return n;
  }
  createOscillator() {
    const n = new FakeNode(this, 'osc'); n.frequency = new FakeParam(); n.detune = new FakeParam();
    n.setPeriodicWave = wave => { n.wave = wave; }; n.start = () => {}; n.stop = () => {}; return n;
  }
  createPeriodicWave(real, imag) { return { real, imag }; }
}
win.AudioContext = FakeContext;
let visibility = 'visible';
Object.defineProperty(win.document, 'visibilityState', { get: () => visibility, configurable: true });

const chip = await import('../dist/js/chiptune.js');
const { music } = await import('../dist/js/audio.js');
const { spillMusicTrack } = await import('../dist/js/engine.js');
const S = await import('../dist/js/spill.js');

// 1. Every song compiles (the compiler rejects ragged melody/drum bars) and loops.
assert.deepEqual([...chip.SONG_IDS].sort(), ['depot', 'flight', 'menu', 'warden']);
for (const id of chip.SONG_IDS) {
  const song = chip.compileSong(id);
  assert(song.sections.length >= 3, `${id} has a structure, not a single bar`);
  assert(song.loopFrom >= 0 && song.loopFrom < song.sections.length, `${id} loops inside its order`);
  assert(chip.songSeconds(id) > 20 && chip.songSeconds(id) < 90, `${id} loop length is a sensible placeholder`);
  assert(chip.songTitle(id).length > 3);
  const events = song.sections.flat(2);
  for (const voice of ['lead', 'arp', 'bass', 'drum'])
    assert(events.some(e => e.voice === voice), `${id} uses its ${voice} voice`);
  for (const e of events.filter(e => e.voice !== 'drum')) {
    assert(e.midi >= 36 && e.midi <= 96, `${id} note ${e.midi} stays in a speaker-friendly range`);
    assert(e.steps >= 1);
  }
}
const tempos = chip.SONG_IDS.map(id => [id, chip.compileSong(id).stepSec]);
const byId = Object.fromEntries(tempos);
assert(byId.warden < byId.flight && byId.flight < byId.depot && byId.depot < byId.menu,
  'tempo rises from menu to Depot to flight to the Warden');

// 2. Offline queueing schedules notes without the real-time pump.
{
  const ctx = new FakeContext();
  const sink = ctx.createGain();
  new chip.ChipPlayer(ctx, sink, 'flight').queue(2);
  const oscillators = ctx.nodes.filter(n => n.kind === 'osc');
  assert(oscillators.length > 20, 'two seconds of flight music queue many voices');
  assert(oscillators.some(n => n.wave), 'pulse voices use the band-limited duty-cycle wave');
  assert(oscillators.some(n => n.type === 'triangle'), 'bass uses the triangle voice');
  FakeContext.instances.length = 0;
}

// 3. Track selection follows the run.
const real = S.createSpill(390, 760, 7);
const at = (screen, phase, enemies = []) => spillMusicTrack({ screen, spill: { ...real, phase, combat: { ...real.combat, enemies } } });
assert.equal(spillMusicTrack({ screen: 'title', spill: null }), 'menu');
assert.equal(spillMusicTrack({ screen: 'play', spill: null }), 'menu');
assert.equal(at('title', 'wave'), 'menu', 'leaving to the title returns to the menu loop');
for (const phase of ['ready', 'docking', 'depot']) assert.equal(at('play', phase), 'depot', `${phase} plays the Depot loop`);
for (const phase of ['countdown', 'wave', 'drain', 'respawn']) assert.equal(at('play', phase), 'flight', `${phase} plays the flight loop`);
assert.equal(at('pause', 'wave'), 'flight', 'pausing keeps the song (it is ducked instead)');
assert.equal(at('play', 'over'), 'menu', 'a lost run settles back onto the menu loop');
const warden = { kind: 'pursuer', dead: false, elite: { stage: 'arrival' } };
assert.equal(at('play', 'wave', [warden]), 'warden', 'a live Warden takes over the score');
assert.equal(at('play', 'wave', [{ ...warden, dead: true }]), 'flight', 'a departed Warden hands back to flight');
assert.equal(at('play', 'wave', [{ kind: 'pursuer', dead: false }]), 'flight', 'ordinary enemies keep the flight loop');
assert.equal(real.phase, 'ready', 'a new run starts at launch prep');
assert.equal(spillMusicTrack({ screen: 'play', spill: real }), 'depot');

// 4. No audio context exists before the first gesture; the gesture starts the wanted song.
music.set('menu');
assert.equal(FakeContext.instances.length, 0, 'the score never builds a context the browser would refuse');
assert.equal(music.playing(), null);
win.document.dispatchEvent(new win.Event('pointerup'));
assert.equal(FakeContext.instances.length, 1, 'the first gesture builds the shared context');
const ctx = FakeContext.instances[0];
assert.equal(music.playing(), 'menu');
const count = () => ctx.nodes.filter(n => n.kind === 'osc').length;
assert(count() > 0, 'starting queues the first notes immediately');

// 5. Switching, muting and ducking.
music.set('depot');
assert.equal(music.playing(), 'depot');
music.set('depot');
assert.equal(music.playing(), 'depot', 'the per-frame call is debounced');
const bus = ctx.nodes.find(n => n.kind === 'gain' && Math.abs(n.gain.value - 0.11) < 1e-9);
assert(bus, 'the music bus sits at the calibrated placeholder level');
music.duck(true);
assert(Math.abs(bus.gain.targets.at(-1) - 0.11 * 0.32) < 1e-9, 'pause ducks the score');
music.duck(false);
assert(Math.abs(bus.gain.targets.at(-1) - 0.11) < 1e-9, 'resume restores the level');
music.setMuted(true);
assert.equal(music.playing(), null, 'the Music switch stops the sequencer');
music.set('flight');
assert.equal(music.playing(), null, 'a muted score stays silent across track changes');
music.setMuted(false);
assert.equal(music.playing(), 'flight', 'unmuting starts the wanted song');

// 6. Hiding the page stops scheduling and suspends the context; returning resumes the same song.
visibility = 'hidden';
win.document.dispatchEvent(new win.Event('visibilitychange'));
assert.equal(ctx.state, 'suspended');
const asleep = count();
ctx.currentTime += 5;
await new Promise(resolve => setTimeout(resolve, 160));
assert.equal(count(), asleep, 'no notes are queued while the page is hidden');
visibility = 'visible';
win.document.dispatchEvent(new win.Event('visibilitychange'));
assert.equal(ctx.state, 'running');
assert.equal(music.playing(), 'flight', 'the same song comes back');
assert(count() > asleep, 'waking resumes scheduling');

music.set(null);
assert.equal(music.playing(), null);

// 7. The Acornaut recordings are gone from the shipped game.
for (const file of ['public/art/music/menu.mp3', 'public/art/music/flight.mp3', 'dist/art/music/menu.mp3', 'dist/art/music/flight.mp3'])
  assert.equal(existsSync(new URL(`../${file}`, import.meta.url)), false, `${file} must not ship`);
console.log('music: four placeholder songs compile, follow menu/Depot/flight/Warden, gate on a gesture, mute, duck and sleep');
