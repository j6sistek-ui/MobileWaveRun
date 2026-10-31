import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createCanvas, GlobalFonts, Image } from '@napi-rs/canvas';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = join(root, 'tests', '.artifacts', 'space-ui-render');
mkdirSync(output, { recursive: true });
const fonts = join(root, 'public', 'fonts', 'space-ui');
for (const file of readdirSync(fonts).filter(file => /\.(ttf|otf)$/i.test(file))) {
  assert(GlobalFonts.registerFromPath(join(fonts, file)), `font decodes: ${file}`);
}
assert(GlobalFonts.has('Rajdhani') && GlobalFonts.has('Orbitron'), 'render checks use the shipped typefaces');
const imageRequests = [];
class LocalImage extends Image {
  set src(value) {
    this.sourcePath = value; imageRequests.push(value);
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
const Art = await import('../dist/js/art.js');
const Draw = await import('../dist/js/draw.js');
const Save = await import('../dist/js/save.js');
const Sim = await import('../dist/js/sim.js');
const Hazards = await import('../dist/js/spill-hazards.js');
const bank = await Art.loadArt(['flight']); await Art.loadSpillScene(bank);
assert(bank.ore, 'the new salvage pickup is decoded by the production loader');
assert(bank.spillHull, 'the standalone neutral hull is decoded by the production loader');
assert(imageRequests.some(path => path.includes('/space-ui/salvage.png')));
assert(!imageRequests.some(path => /acorn-coin|depot-bear/.test(path)), 'Spill no longer requests the old currency or mascot');
const save = Save.defaultSave(); save.tutorialDone = true; save.guide = 'done'; save.motionOff = true;
const digest = canvas => createHash('sha256').update(canvas.toBuffer('image/png')).digest('hex');
const stockBuild = { plating: 0, thrusters: 0, pulse: 0, shield: 0, utilities: [] };
const shipPreview = (build = stockBuild, art = bank, appearance = save) => {
  const canvas = createCanvas(320, 190);
  Draw.paintShipPreview(canvas.getContext('2d'), art, appearance, 160, 95, 3.2, 0, build);
  return canvas;
};
const untouchedSave = JSON.stringify(save), stockShip = digest(shipPreview());
assert.equal(digest(shipPreview(stockBuild, { ...bank, suits: {}, helms: {}, squirrelIdle: [] })), stockShip,
  'the ship never depends on the old pilot or mascot artwork');
assert.notEqual(digest(shipPreview(stockBuild, bank, { ...save, glowOff: true })), stockShip,
  'the preserved glow preference controls the extra hull accent');
for (const [axis, levels] of [['plating', 4], ['thrusters', 4], ['pulse', 4], ['shield', 3]]) {
  const images = new Set();
  for (let tier = 0; tier < levels; tier++) images.add(digest(shipPreview({ ...stockBuild, [axis]: tier })));
  assert.equal(images.size, levels, `every ${axis} tier remains visually distinct`);
}
assert.equal(JSON.stringify(save), untouchedSave, 'preview art never changes the saved build');
const shipSheet = createCanvas(960, 760), shipSheetCtx = shipSheet.getContext('2d');
shipSheetCtx.fillStyle = '#07131f'; shipSheetCtx.fillRect(0, 0, 960, 760);
for (let tier = 0; tier < 4; tier++) for (let shield = 0; shield < 3; shield++) {
  const build = { plating: tier, thrusters: tier, pulse: tier, shield,
    utilities: shield === 1 ? ['magnet', 'scanner'] : shield === 2 ? ['brake', 'capacitor'] : [] };
  const x = shield * 320, y = tier * 190;
  shipSheetCtx.drawImage(shipPreview(build), x, y);
  shipSheetCtx.fillStyle = '#cfedfa'; shipSheetCtx.font = '600 14px Rajdhani';
  shipSheetCtx.fillText(`Hull / engine / pulse ${tier} · canopy ${shield}`, x + 18, y + 26);
}
writeFileSync(join(output, 'ship-tiers.png'), shipSheet.toBuffer('image/png'));
let frames = 0;
for (const [W, H] of [[320, 568], [390, 844], [844, 390], [1280, 720]]) {
  const w = Sim.makeWorld(W, H); Sim.resetRun(w, save, 'spill', false);
  const s = w.spill;
  Object.assign(s, { phase: 'wave', welcome: false, wave: 42, phaseT: 8, waveT: 8, t: 8,
    hints: false, hintT: 0, bannerT: 0, liveMods: [], rocks: [], nuts: [], ore: 12345, score: 987654,
    hull: 3, maxHull: 5, shield: 2, combo: 4, utilities: ['scanner', 'magnet'] });
  w.ready = false; w.shake = 0; w.time = 8; w.insetTop = 12;
  for (const charged of [false, true]) {
    s.up.pulse = charged ? 1 : 0; s.charge = charged ? 1 : .4;
    s.liveMods = charged ? ['blackout', 'swarm'] : [];
    s.gold = charged ? 3 : 0; s.surgeT = charged ? 4 : 0; s.echoReady = charged;
    s.contract = charged ? { kind: 'clean', endWave: 45, startHits: s.hits } : null;
    const before = JSON.stringify(s), canvas = createCanvas(W, H), ctx = canvas.getContext('2d');
    const labels = [], fillText = ctx.fillText.bind(ctx);
    ctx.fillText = (text, x, y, maxWidth) => {
      const width = Math.min(ctx.measureText(text).width, maxWidth ?? Infinity);
      const left = x - (ctx.textAlign === 'center' ? width / 2 : ctx.textAlign === 'right' ? width : 0);
      labels.push({ text, left, right: left + width, y: y + w.insetTop });
      return maxWidth === undefined ? fillText(text, x, y) : fillText(text, x, y, maxWidth);
    };
    Draw.drawHud(ctx, w, bank, save);
    assert.equal(JSON.stringify(s), before, 'presentation does not advance or modify the run');
    for (const label of labels) {
      assert(label.left >= 8 && label.right <= W - 8, `${W}px label stays inside safe bounds: ${label.text}`);
      assert(label.y >= 12 && label.y < H - 8, `vertical safe area: ${label.text}`);
      assert(!/ACORN|DEBRIS FIELD/.test(label.text), 'player-facing labels use the standalone identity');
    }
    for (const text of ['SALVAGE', 'SHIELDS 2', 'HULL 3/5', charged ? 'PULSE ARMED' : 'PULSE LOCKED']) {
      assert(labels.some(label => label.text.includes(text)), `essential instrument visible: ${text}`);
    }
    if (charged) for (const text of ['GOLD 3s', 'SURGE 4s', 'ECHO ARMED', 'CLEAN PASSAGE']) {
      assert(labels.some(label => label.text.includes(text)), `effect/contract remains visible: ${text}`);
    }
    const center = ctx.getImageData(0, Math.floor(H * .42), W, Math.floor(H * .16)).data;
    assert(center.every(value => value === 0), 'persistent instruments leave the middle flight lane unobstructed');
    const full = createCanvas(W, H), g = full.getContext('2d');
    Draw.drawWorld(g, w, save, bank); Draw.drawHud(g, w, bank, save);
    writeFileSync(join(output, `flight-${W}-${charged ? 'armed' : 'locked'}.png`), full.toBuffer('image/png')); frames++;
  }
  // Injecting the original optional mascot cannot put it back over the Depot.
  s.phase = 'docking'; s.phaseT = 1; s.depotGag = false;
  const frame = () => { const c = createCanvas(W, H); Draw.drawWorld(c.getContext('2d'), w, save, bank); return c; };
  bank.spillScene.bear = undefined; const clean = digest(frame());
  const bear = createCanvas(64, 128), g = bear.getContext('2d'); g.fillStyle = '#f00'; g.fillRect(0, 0, 64, 128);
  bank.spillScene.bear = Array(36).fill({ image: bear, footX: 32, footY: 128 });
  assert.equal(digest(frame()), clean, 'legacy mascot is absent even if an old fixture supplies it');
  bank.spillScene.bear = undefined;
}
let launchFrames = 0;
for (const [W, H] of [[568, 320], [667, 320], [844, 390]]) for (const hazard of Object.values(Hazards.SPILL_HAZARDS)) {
  const w = Sim.makeWorld(W, H); Sim.resetRun(w, save, 'spill', false); const s = w.spill;
  Object.assign(s, { welcome: false, wave: 16, target: 20, hint: hazard.teach, hintT: 3,
    bannerT: 0, liveMods: ['blackout', 'swarm'], gold: 3, surgeT: 4, echoReady: true,
    contract: { kind: 'clean', endWave: 20, startHits: s.hits }, rocks: [], nuts: [] });
  w.ready = false; w.insetTop = 12;
  for (const phase of ['countdown', 'wave']) {
    s.phase = phase; s.phaseT = .2;
    const canvas = createCanvas(W, H), ctx = canvas.getContext('2d'), labels = [];
    const original = ctx.fillText.bind(ctx), before = JSON.stringify(s);
    ctx.fillText = (text, x, y, maxWidth) => {
      const metrics = ctx.measureText(text), width = Math.min(metrics.width, maxWidth ?? Infinity);
      const left = x - (ctx.textAlign === 'center' ? width / 2 : ctx.textAlign === 'right' ? width : 0);
      labels.push({ text, y: y + w.insetTop, top: y + w.insetTop - metrics.actualBoundingBoxAscent,
        bottom: y + w.insetTop + metrics.actualBoundingBoxDescent, left, right: left + width, font: ctx.font });
      return maxWidth === undefined ? original(text, x, y) : original(text, x, y, maxWidth);
    };
    Draw.drawHud(ctx, w, bank, save);
    assert.equal(JSON.stringify(s), before, 'launch layout cannot advance the countdown or lesson');
    const lesson = labels.find(label => label.text === hazard.teach.split(': ')[0]);
    assert(lesson, 'the full hazard lesson remains visible during launch');
    const launch = labels.filter(label => /^(WAVE 16$|CLEAR WAVE|AUTOPILOT|YOU ARE STEERING|GO$)/.test(label.text)
      || /^\d$/.test(label.text) && /(?:4\d|5\d)px/.test(label.font));
    assert(launch.length >= (phase === 'countdown' ? 4 : 1), 'launch title, goal, steering status and number remain visible');
    for (const label of launch) {
      assert(label.left >= 12 && label.right <= W - 12, 'compact launch labels remain in the viewport');
      assert(label.bottom + 10 <= lesson.top, `${W}×${H}: ${label.text} clears the ${lesson.text} lesson panel`);
    }
    if (hazard.name === 'Gravity well') {
      const full = createCanvas(W, H), g = full.getContext('2d'); Draw.drawWorld(g, w, save, bank); Draw.drawHud(g, w, bank, save);
      writeFileSync(join(output, `launch-${W}x${H}-${phase}.png`), full.toBuffer('image/png'));
    }
    launchFrames++;
  }
}
console.log(JSON.stringify({ frames, launchFrames, fonts: 'shipped Rajdhani and Orbitron', safeAreaText: true, clearCenter: true,
  statePreserved: true, independentCurrency: true, mascotRemoved: true, output }));
