import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createCanvas, Image } from '@napi-rs/canvas';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = join(root, 'tests', '.artifacts', 'hazard-render');
mkdirSync(output, { recursive: true });
class LocalImage extends Image {
  set src(value) {
    this.sourcePath = value;
    try { super.src = readFileSync(value.replace(/\?.*$/, '')); }
    catch { queueMicrotask(() => this.onerror?.(new Error(`Missing image: ${value}`))); }
  }
  get src() { return this.sourcePath ?? ''; }
}
globalThis.Image = LocalImage; globalThis.HTMLImageElement = Image;
globalThis.window = { __ACORNAUT_ART__: join(root, 'dist', 'art').replaceAll('\\', '/'),
  location: { href: 'http://local/' }, devicePixelRatio: 1, addEventListener() {},
  matchMedia: () => ({ matches: false, addEventListener() {} }) };
globalThis.document = { createElement: () => createCanvas(1, 1), addEventListener() {}, documentElement: { style: {} } };
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.fetch = async url => {
  try { return { ok: true, json: async () => JSON.parse(readFileSync(String(url).replace(/\?.*$/, ''), 'utf8')) }; }
  catch { return { ok: false, json: async () => ({}) }; }
};
const S = await import('../dist/js/spill.js');
const H = await import('../dist/js/spill-hazards.js');
const View = await import('../dist/js/spill-hazard-view.js');
const Art = await import('../dist/js/art.js');
const Draw = await import('../dist/js/draw.js');
const Save = await import('../dist/js/save.js');
const Sim = await import('../dist/js/sim.js');
const bank = await Art.loadArt(['flight']); await Art.loadSpillScene(bank);
const save = Save.defaultSave(); save.tutorialDone = true; save.guide = 'done';
const digest = canvas => createHash('sha256').update(canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data).digest('hex');
const pixel = (canvas, x, y) => [...canvas.getContext('2d').getImageData(Math.round(x), Math.round(y), 1, 1).data];

function fixture(W, Ht, kind) {
  const world = Sim.makeWorld(W, Ht); Sim.resetRun(world, save, 'spill', false);
  const s = world.spill;
  Object.assign(s, { phase: 'wave', wave: 16, phaseT: 6, waveT: 6, t: 6, hints: false, hintT: 0,
    banner: '', bannerT: 0, event: 'none', eventWarn: 0, liveMods: [], rocks: [], nuts: [] });
  world.ready = false; world.shake = 0; world.time = 6;
  s.pilot.x = W * .22; s.pilot.y = Ht * .7;
  const h = { id: 1, kind, x: W * .72, y: Ht * .49, vx: kind === 'comet' ? -300 : -60, vy: 0,
    r: kind === 'ion' ? Math.max(22, Math.min(36, Ht * .08)) : kind === 'comet' ? 16 : 14,
    age: .6, activeTime: 0, life: 8, warn: .6, hp: 3, maxHp: 3, dead: false,
    aimX: W * .22, aimY: Ht * .49, phase: 'warning', fuse: -1, pulse: 0,
    safeY: Ht * .73, range: kind === 'gravity' ? Math.min(180, Ht * .32) : kind === 'mine' ? 68 : 16,
    variant: 0, hit: false };
  s.hazards.actors = [h];
  return { world, s, h };
}
function overlay(s, reduced = false) {
  const canvas = createCanvas(s.W, s.H);
  View.drawSpillHazards(canvas.getContext('2d'), s, reduced);
  return canvas;
}
function full(world) {
  const canvas = createCanvas(world.W, world.H), ctx = canvas.getContext('2d');
  Draw.drawWorld(ctx, world, save, bank); Draw.drawHud(ctx, world, bank, save);
  return canvas;
}

let frames = 0;
for (const [W, Ht] of [[320, 760], [390, 844], [844, 390]]) for (const kind of H.SPILL_HAZARD_IDS) {
  const { world, s, h } = fixture(W, Ht, kind);
  for (const phase of ['warning', 'active']) {
    h.phase = phase; h.warn = phase === 'warning' ? .6 : 0;
    h.activeTime = phase === 'active' ? 1 : 0;
    h.fuse = phase === 'active' && kind === 'ion' ? .3 : phase === 'active' && kind === 'mine' ? .5 : -1;
    const before = JSON.stringify(s), canvas = overlay(s);
    assert.equal(digest(canvas), digest(overlay(s)), 'same hazard state paints deterministically');
    assert.equal(JSON.stringify(s), before, 'painting cannot change warnings, timers or trajectories');
    if (kind === 'ion') {
      assert(pixel(canvas, W * .45, h.y)[3] > 0, 'entire ion band is marked');
      assert.equal(pixel(canvas, W * .45, h.safeY)[3], 0, 'safe height stays outside the harmful band');
    }
    if (kind === 'mine') {
      assert(pixel(canvas, h.x, h.y)[3] > 0, 'mine core remains visible');
      assert.equal(pixel(canvas, h.x + h.range + 4, h.y)[3], 0, 'mine glow does not invent a larger blast radius');
    }
    writeFileSync(join(output, `${kind}-${phase}-${W}.png`), full(world).toBuffer('image/png'));
    frames++;
  }
  const hint = createCanvas(W, Ht), ctx = hint.getContext('2d'), labels = [];
  const paintText = ctx.fillText.bind(ctx);
  ctx.fillText = (text, x, y, ...rest) => { labels.push({ text, x, y }); paintText(text, x, y, ...rest); };
  View.drawSpillHazardHint(ctx, s, Ht - 64);
  assert.equal(labels.length, 1, 'only one compact contextual hint');
  assert(labels[0].y > Ht - 100 && labels[0].y < Ht - 60, 'hint stays peripheral and clear of top HUD');
  assert(!/TAP.*FLY|BUTTON|SPACE BAR/.test(labels[0].text), 'hint does not restore old controls');
  h.dead = true;
  assert(overlay(s).getContext('2d').getImageData(0, 0, W, Ht).data.every(n => n === 0), 'dead hazards are absent');
}

// A reminder yields its existing rectangle to danger instead of hiding the
// moving core or relocating into the center. Test the short browser playfield.
const crowded = fixture(844, 336, 'gravity');
Object.assign(crowded.h, { phase: 'active', warn: 0, activeTime: 1, x: 507, y: 260 });
Object.assign(crowded.s.pilot, { x: 100, y: 140 });
function hintCount(state, inset = 0) {
  const canvas = createCanvas(state.W * 2, state.H * 2), ctx = canvas.getContext('2d');
  ctx.scale(2, 2); ctx.translate(0, inset);
  let count = 0;
  ctx.fillText = () => { count++; };
  View.drawSpillHazardHint(ctx, state, state.H - 64 - inset);
  return count;
}
assert.equal(hintCount(crowded.s), 0, 'bottom-middle gravity core cannot be covered by its hint');
assert.equal(hintCount(crowded.s, 24), 0, 'collision check accounts for HUD safe area and device scale');
Object.assign(crowded.h, { x: 630, y: 170 });
assert.equal(hintCount(crowded.s), 1, 'a clear hint remains in its existing peripheral slot');
const second = { ...crowded.h, id: 2, kind: 'comet', x: 422, y: 260, r: 16 };
crowded.s.hazards.actors.push(second);
assert.equal(hintCount(crowded.s), 0, 'another live hazard also suppresses the selected reminder');
second.dead = true;
assert.equal(hintCount(crowded.s), 1, 'dead hazards do not suppress readable help');
Object.assign(second, { dead: false, kind: 'mine', y: 170, r: 14, range: 68, fuse: .5 });
assert.equal(hintCount(crowded.s), 0, 'an armed mine protects its full blast area, not only its core');
second.fuse = -1;
assert.equal(hintCount(crowded.s), 1, 'untriggered distant mine leaves a clear hint available');
Object.assign(second, { kind: 'ion', y: 260, r: 26 });
assert.equal(hintCount(crowded.s), 0, 'the entire charged ion band suppresses overlapping help');
second.dead = true;
Object.assign(crowded.s.pilot, { x: 422, y: 260 });
assert.equal(hintCount(crowded.s), 0, 'the ship silhouette stays unobscured');

// A warned comet never retargets visually when the player moves.
const marked = fixture(390, 844, 'comet');
const markedBefore = digest(overlay(marked.s)); marked.s.pilot.y += 130;
assert.equal(digest(overlay(marked.s)), markedBefore, 'the warning path uses frozen aim coordinates');
marked.h.vy = 60;
const pathCtx = createCanvas(390, 844).getContext('2d'), ends = [], lineTo = pathCtx.lineTo.bind(pathCtx);
pathCtx.lineTo = (x, y) => { ends.push({ x, y }); lineTo(x, y); };
View.drawSpillHazards(pathCtx, marked.s);
const edgeY = marked.h.y - marked.h.x * marked.h.vy / marked.h.vx;
assert(ends.some(p => p.x === 0 && Math.abs(p.y - edgeY) < 1e-6),
  'committed comet path continues through the left edge, beyond the home-lane aim point');

// Core/range outlines use authority radii; reduced motion freezes decoration.
const gravity = fixture(844, 390, 'gravity');
Object.assign(gravity.h, { phase: 'active', warn: 0, activeTime: 1 });
const reducedBefore = digest(overlay(gravity.s, true)), animatedBefore = digest(overlay(gravity.s));
gravity.h.activeTime = 2;
assert.equal(digest(overlay(gravity.s, true)), reducedBefore, 'reduced motion stops decorative orbit rotation');
assert.notEqual(digest(overlay(gravity.s)), animatedBefore, 'ordinary motion retains subtle force direction animation');
const arcs = [], geometry = createCanvas(844, 390).getContext('2d'), arc = geometry.arc.bind(geometry);
geometry.arc = (x, y, r, ...rest) => { arcs.push({ x, y, r }); arc(x, y, r, ...rest); };
View.drawSpillHazards(geometry, gravity.s, true);
for (const radius of [gravity.h.r, gravity.h.range]) assert(arcs.some(a => a.x === gravity.h.x && a.y === gravity.h.y && a.r === radius));
const bentRock = { x: gravity.h.x - 50, y: gravity.h.y - 40, vx: -100, vy: 0, r: 12,
  kind: 'shard', sprite: 0, spin: 0, rot: 0, arc: 0, arcPhase: 0, warn: 0, grazed: false, dead: false,
  gravityWell: gravity.h.id, gravityBend: { start: gravity.s.t - .5, duration: 2.4, strength: 18 } };
gravity.s.rocks = [bentRock];
const pathEnds = [], gravityLine = geometry.lineTo.bind(geometry);
geometry.lineTo = (x, y) => { pathEnds.push({ x, y }); gravityLine(x, y); };
View.drawSpillHazards(geometry, gravity.s, true);
const future = S.spillRockAt(gravity.s, bentRock, .6);
assert(pathEnds.some(p => Math.abs(p.x - future.x) < 1e-6 && Math.abs(p.y - future.y) < 1e-6),
  'bent-debris cue follows the shared predictor far enough to show the curve');
assert(Math.hypot(future.x - bentRock.x, future.y - bentRock.y) > bentRock.r * 2,
  'the trajectory extends beyond the rock silhouette');
writeFileSync(join(output, 'gravity-bend-844.png'), full(gravity.world).toBuffer('image/png'));

// The actual full-world painter keeps solid hazard cores above the Blackout veil.
const blackout = fixture(390, 844, 'comet');
Object.assign(blackout.h, { phase: 'active', warn: 0, activeTime: 1 });
const brightCore = pixel(full(blackout.world), blackout.h.x, blackout.h.y);
blackout.s.liveMods = ['blackout']; blackout.s.modRamp = 3;
const dark = full(blackout.world);
assert.deepEqual(pixel(dark, blackout.h.x, blackout.h.y), brightCore, 'Blackout cannot dim the opaque hazard core');
writeFileSync(join(output, 'comet-blackout-390.png'), dark.toBuffer('image/png'));
blackout.s.phase = 'depot';
assert(overlay(blackout.s).getContext('2d').getImageData(0, 0, 390, 844).data.every(n => n === 0), 'Depot has no live hazard overlay');

console.log(JSON.stringify({ hazardFrames: frames, blackoutFrames: 1, deterministic: true,
  warningAimFrozen: true, authorityGeometry: true, reducedMotion: true, peripheralHints: true, output }));
