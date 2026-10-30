import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createCanvas, Image } from '@napi-rs/canvas';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = join(root, 'tests', '.artifacts', 'climax-render');
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
const K = await import('../dist/js/spill-climax.js');
const View = await import('../dist/js/spill-climax-view.js');
const Art = await import('../dist/js/art.js');
const Draw = await import('../dist/js/draw.js');
const Save = await import('../dist/js/save.js');
const Sim = await import('../dist/js/sim.js');
const bank = await Art.loadArt(['flight']); await Art.loadSpillScene(bank);
const save = Save.defaultSave(); save.tutorialDone = true; save.guide = 'done';
const digest = canvas => createHash('sha256').update(canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data).digest('hex');

function fixture(W, H) {
  const world = Sim.makeWorld(W, H); Sim.resetRun(world, save, 'spill', false);
  const s = world.spill;
  Object.assign(s, { phase: 'wave', wave: 20, phaseT: 20, waveT: 20, t: 20, hints: false, hintT: 0,
    banner: '', bannerT: 0, event: 'none', eventWarn: 0, liveMods: [], rocks: [], nuts: [] });
  s.spec = S.spillWaveSpec(20, s.seed); world.ready = false; world.shake = 0; world.time = 20;
  s.pilot.x = W * .22; s.pilot.y = H * .65;
  K.admitSpillClimax(s); assert.equal(s.combat.enemies.length, 1);
  const e = s.combat.enemies[0];
  e.x = W * .8; e.y = e.homeY = H * .45; e.aimX = s.pilot.x; e.aimY = H * .6;
  s.banner = ''; s.bannerT = 0;
  return { world, s, e };
}
function overlay(s, collect = false) {
  const canvas = createCanvas(s.W, s.H), ctx = canvas.getContext('2d'), paths = [], labels = [];
  if (collect) {
    const lineTo = ctx.lineTo.bind(ctx), fillText = ctx.fillText.bind(ctx);
    ctx.lineTo = (x, y) => { paths.push([x, y]); lineTo(x, y); };
    ctx.fillText = (text, x, y, ...rest) => { labels.push({ text, x, y }); fillText(text, x, y, ...rest); };
  }
  View.drawSpillClimax(ctx, s); return { canvas, paths, labels };
}
function full(world) {
  const canvas = createCanvas(world.W, world.H), ctx = canvas.getContext('2d');
  Draw.drawWorld(ctx, world, save, bank); Draw.drawHud(ctx, world, bank, save); return canvas;
}

let frames = 0;
for (const [W, H] of [[320, 760], [390, 844], [844, 390]]) {
  const { world, s, e } = fixture(W, H);
  for (const state of ['arrival', 'lock', 'fork', 'exposed', 'exit']) {
    e.elite.stage = ['lock', 'fork'].includes(state) ? 'warning' : state;
    e.elite.pattern = state === 'fork' ? 'fork' : 'lock';
    e.elite.aims = state === 'fork' ? [e.aimY - 76, e.aimY + 76] : [e.aimY];
    e.elite.timer = state === 'exposed' ? 2.4 : .8; e.telegraph = e.elite.stage === 'warning' ? .8 : 0;
    const before = JSON.stringify(s), painted = overlay(s, true);
    assert.equal(digest(painted.canvas), digest(overlay(s).canvas));
    assert.equal(JSON.stringify(s), before, 'overlay cannot step or mutate authority');
    assert.equal(painted.labels.length, 1, 'one shield/timer label');
    const label = painted.labels[0];
    assert(label.x >= 8 && label.x <= W - 8 && label.y >= 112 && label.y <= H - 29);
    if (e.elite.stage === 'warning') {
      assert.equal(painted.paths.length, e.elite.aims.length);
      for (const [index, y] of e.elite.aims.entries()) {
        assert.equal(painted.paths[index][0], 0, 'warning continues beyond the pilot to the left edge');
        const expected = e.y + (y - e.y) * -e.x / (e.aimX - e.x);
        assert(Math.abs(painted.paths[index][1] - expected) < 1e-8, 'drawn line follows actual frozen trajectory');
      }
      const originalY = s.pilot.y; s.pilot.y -= 80;
      assert.equal(digest(painted.canvas), digest(overlay(s).canvas), 'moving after warning cannot retarget the visual');
      s.pilot.y = originalY;
    } else assert.equal(painted.paths.length, 0, 'no attack line during arrival, exposed window or retreat');
    if (state === 'exposed') assert.match(label.text, /CORE OPEN/);
    if (state === 'exit') assert.match(label.text, /RETREATING/);
    writeFileSync(join(output, `${state}-${W}.png`), full(world).toBuffer('image/png')); frames++;
  }
  e.dead = true;
  assert(overlay(s).canvas.getContext('2d').getImageData(0, 0, W, H).data.every(n => n === 0));
  e.dead = false; s.phase = 'depot';
  assert(overlay(s).canvas.getContext('2d').getImageData(0, 0, W, H).data.every(n => n === 0));
}
console.log(`${frames} Warden frames: deterministic/read-only overlay, frozen full-path geometry, shield states and dead/Depot omission passed`);
