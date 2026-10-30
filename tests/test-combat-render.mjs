import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createCanvas, Image } from '@napi-rs/canvas';

const root = fileURLToPath(new URL('../', import.meta.url));
const artRoot = join(root, 'dist', 'art');
const output = join(root, 'tests', '.artifacts', 'combat-render');
mkdirSync(output, { recursive: true });

// Feed real local PNG bytes through the production async loader and its alpha
// measurement, not a second test implementation of sprite fitting.
class LocalImage extends Image {
  set src(value) {
    this.sourcePath = value;
    try { super.src = readFileSync(value.replace(/\?.*$/, '')); }
    catch { queueMicrotask(() => this.onerror?.(new Error(`Missing test image: ${value}`))); }
  }
  get src() { return this.sourcePath ?? ''; }
}
globalThis.Image = LocalImage;
globalThis.HTMLImageElement = Image;
globalThis.window = {
  __ACORNAUT_ART__: artRoot.replaceAll('\\', '/'), location: { href: 'http://local/' },
  devicePixelRatio: 1, addEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {} }),
};
globalThis.document = {
  createElement: () => createCanvas(1, 1), addEventListener() {}, documentElement: { style: {} },
};
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.fetch = async url => {
  try {
    const data = readFileSync(String(url).replace(/\?.*$/, ''), 'utf8');
    return { ok: true, json: async () => JSON.parse(data) };
  } catch { return { ok: false, json: async () => ({}) }; }
};

const Art = await import('../dist/js/art.js');
const View = await import('../dist/js/spill-combat-view.js');
const Draw = await import('../dist/js/draw.js');
const Save = await import('../dist/js/save.js');
const Sim = await import('../dist/js/sim.js');
const Combat = await import('../dist/js/spill-combat.js');
const Builds = await import('../dist/js/spill-builds.js');
const bank = await Art.loadArt(['flight']);
await Art.loadSpillScene(bank);
assert(bank.ready);
assert.equal(bank.spillCombatStatus, 'ready', 'production loader must decode both generated hulls');
for (const id of Art.SPILL_ENEMY_IDS) {
  const sprite = bank.spillCombat[id];
  assert(sprite && sprite.width >= 1024 && sprite.height >= 1024, `${id} retains source resolution`);
  const canvas = createCanvas(sprite.width, sprite.height), ctx = canvas.getContext('2d');
  ctx.drawImage(sprite, 0, 0);
  assert.equal(ctx.getImageData(0, 0, 1, 1).data[3], 0, `${id} has transparent padding`);
  assert(sprite.box.w > sprite.width * .7 && sprite.box.w < sprite.width, `${id} hull is fitted without transparent side padding`);
  assert(sprite.box.h < sprite.height * .9, `${id} vertical padding does not count as hull`);
}

function fixture(width, height, weapon) {
  const save = Save.defaultSave(); save.tutorialDone = true; save.guide = 'done';
  const world = Sim.makeWorld(width, height);
  Sim.resetRun(world, save, 'spill', false);
  const state = world.spill;
  state.phase = 'wave'; state.wave = 7; state.waveT = 8; state.phaseT = 8;
  state.pilot.x = Math.round(width * .22); state.pilot.y = Math.round(height * .45);
  state.hints = false; state.hintT = 0; state.banner = ''; state.bannerT = 0;
  state.ore = 123; state.hull = 3; state.shield = 1;
  state.up.pulse = 1; state.charge = 1; state.utilities = ['magnet', 'scanner'];
  state.liveMods = []; state.rocks = []; state.nuts = [];
  world.ready = false; world.shake = 0; world.time = state.t = 6;
  state.combat = Combat.createSpillCombat(912);
  Object.assign(state.combat, { weapon, levels: { laser: 2, cannon: 3 }, firing: true, cooldown: .08,
    kills: 5, waveKills: 1, targetId: 1, muzzleFlash: .06 });
  const enemy = (id, kind, x, y) => ({ id, kind, x, y, vx: -30, vy: 0, r: kind === 'pursuer' ? 18 : 16,
    hp: 4, maxHp: 4, age: 2, life: 6, cooldown: 1, telegraph: 0, telegraphTotal: .9,
    aimX: state.pilot.x, aimY: state.pilot.y, shotSpeed: 200, homeY: y, side: 1, hitFlash: 0, dead: false });
  state.combat.enemies = [
    { ...enemy(1, 'pursuer', Math.round(width * .74), Math.round(height * .42)), hp: 2, telegraph: .25 },
    enemy(2, 'flanker', Math.round(width * .86), Math.round(height * .24)),
    { ...enemy(3, 'pursuer', 25, 230), dead: true },
  ];
  state.combat.shots = [
    { id: 4, team: 'player', weapon, x: Math.round(width * .46), y: Math.round(height * .58),
      vx: 540, vy: 0, r: weapon === 'laser' ? 3 : 6, damage: 1, life: 1, dead: false },
    { id: 5, team: 'enemy', weapon: 'laser', x: Math.round(width * .62), y: Math.round(height * .69),
      vx: -220, vy: 0, r: 5, damage: 1, life: 1, dead: false },
    { id: 6, team: 'enemy', weapon: 'laser', x: 25, y: 260, vx: -200, vy: 0, r: 5, damage: 1, life: 1, dead: true },
  ];
  return { save, world, state };
}

const digest = canvas => createHash('sha256').update(canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data).digest('hex');
function alphaBounds(canvas) {
  const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
  let left = canvas.width, right = -1, top = canvas.height, bottom = -1, count = 0;
  for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) if (data[(y * canvas.width + x) * 4 + 3] > 12) {
    left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y); count++;
  }
  return { left, right, top, bottom, count };
}

let frames = 0;
for (const [width, height] of [[320, 760], [390, 760], [1280, 720]]) for (const weapon of ['laser', 'cannon']) {
  const { save, world, state } = fixture(width, height, weapon);
  const before = JSON.stringify(state);
  const render = () => {
    const canvas = createCanvas(width, height), ctx = canvas.getContext('2d');
    Draw.drawWorld(ctx, world, save, bank); Draw.drawHud(ctx, world, bank, save);
    return canvas;
  };
  const full = render();
  assert.equal(digest(full), digest(render()), 'the same combat state paints deterministically');
  assert.equal(JSON.stringify(state), before, 'painting cannot advance or mutate gameplay');
  writeFileSync(join(output, `combat-${weapon}-${width}.png`), full.toBuffer('image/png'));
  const effects = createCanvas(width, height), ctx = effects.getContext('2d');
  View.drawSpillCombat(ctx, state, bank);
  const player = state.combat.shots[0], hostile = state.combat.shots[1];
  const sample = (x, y) => [...ctx.getImageData(x, y, 1, 1).data];
  const playerColor = weapon === 'laser' ? sample(player.x - 7, player.y + 1) : sample(player.x, player.y + 3);
  assert(playerColor[3] > 100, 'the real player projectile is visible');
  if (weapon === 'laser') assert(playerColor[2] > playerColor[0], 'laser streaks are cyan');
  else assert(playerColor[0] > playerColor[2], 'cannon rounds are gold');
  const hostileColor = sample(hostile.x + 3, hostile.y);
  assert(hostileColor[0] > hostileColor[1] * 1.3, 'hostile projectiles have a distinct orange-red fill');
  assert.equal(sample(25, 230)[3], 0, 'dead enemies are not painted');
  assert.equal(sample(25, 260)[3], 0, 'dead shots are not painted');
  assert(sample(state.pilot.x + 6, state.pilot.y)[3] > 0, 'warning endpoint follows the frozen aim coordinates');
  const hud = createCanvas(width, height);
  View.drawSpillCombatHud(hud.getContext('2d'), state);
  const bounds = alphaBounds(hud);
  assert(bounds.count > 1000, 'weapon HUD is visible');
  assert(bounds.left >= width - 106 && bounds.right <= width - 11, 'HUD stays at the right edge with margin');
  assert(bounds.top >= 52 && bounds.bottom < 89, 'HUD fits between shields and status banners');
  frames++;
}

// Blackout still leaves enemy silhouettes and hostile warnings readable.
const blackout = fixture(390, 760, 'laser');
blackout.state.liveMods = ['blackout']; blackout.state.modRamp = 3;
const dark = createCanvas(390, 760);
Draw.drawWorld(dark.getContext('2d'), blackout.world, blackout.save, bank);
Draw.drawHud(dark.getContext('2d'), blackout.world, bank, blackout.save);
writeFileSync(join(output, 'combat-blackout-390.png'), dark.toBuffer('image/png'));

// The real ship image trails on the opposite side for each dodge direction.
const dodge = fixture(390, 760, 'laser');
Object.assign(dodge.state, { shield: 0, charge: 0, iframes: 0, lunge: 0, thrustT: 0, burstT: 0 });
dodge.state.pilot.x = 160; dodge.state.pilot.rot = 0;
dodge.state.combat.enemies = []; dodge.state.combat.shots = []; dodge.state.combat.muzzleFlash = 0;
const shipFrame = () => {
  const frame = createCanvas(390, 760);
  Draw.drawWorld(frame.getContext('2d'), dodge.world, dodge.save, bank);
  return frame;
};
const base = shipFrame().getContext('2d').getImageData(0, 0, 390, 760).data;
const ghostCenters = [];
for (const direction of [-1, 1]) {
  dodge.state.lunge = .12; dodge.state.lungeDir = direction;
  const before = JSON.stringify(dodge.state), frame = shipFrame();
  assert.equal(JSON.stringify(dodge.state), before, 'dodge painting cannot advance the flight');
  const pixels = frame.getContext('2d').getImageData(0, 0, 390, 760).data;
  let count = 0, sumX = 0;
  for (let y = dodge.state.pilot.y - 45; y <= dodge.state.pilot.y + 45; y++) {
    for (let x = 65; x < 255; x++) {
      const at = (y * 390 + x) * 4;
      if (Math.abs(pixels[at] - base[at]) + Math.abs(pixels[at + 1] - base[at + 1]) + Math.abs(pixels[at + 2] - base[at + 2]) > 12) {
        count++; sumX += x;
      }
    }
  }
  assert(count > 50, 'dodge adds a visible ship ghost');
  ghostCenters.push(sumX / count);
  writeFileSync(join(output, `dodge-${direction < 0 ? 'left' : 'right'}-390.png`), frame.toBuffer('image/png'));
}
assert(ghostCenters[0] > ghostCenters[1] + 12, 'left dodge ghost trails to the right of the right dodge ghost');

// Countdown and launch help use the current hand, without an empty pad tray.
const instruction = fixture(320, 760, 'laser');
instruction.world.insetTop = 24;
instruction.state.phase = 'countdown'; instruction.state.manual = false;
instruction.state.liveMods = ['cross'];
instruction.state.hintT = 0;
const hudCanvas = createCanvas(320, 760), hudCtx = hudCanvas.getContext('2d');
const text = [], paintText = hudCtx.fillText.bind(hudCtx);
hudCtx.fillText = (value, x, y, ...rest) => {
  text.push({ value, y: y + hudCtx.getTransform().f });
  paintText(value, x, y, ...rest);
};
Draw.drawHud(hudCtx, instruction.world, bank, instruction.save);
assert(text.some(line => line.value.includes('DRAG TO STEER')));
assert(!text.some(line => /TAP TO TAKE|TAP.*FLY|SWIPE.*DIVE/.test(line.value)));
assert(text.some(line => line.y > 700 && line.y < 740), 'live rule sits near the lower edge, clear of the former fixed pad area');
text.length = 0;
instruction.state.phase = 'ready'; instruction.state.target = 1;
Draw.drawHud(hudCtx, instruction.world, bank, instruction.save);
assert(text.some(line => line.value.includes('FLICK')));
assert(text.some(line => line.value.includes('SECOND FINGER TAP')));
assert(!text.some(line => /TAP TO LAUNCH|TAP.*FLY|SWIPE.*DIVE/.test(line.value)));

// Artifact feedback stays peripheral in portrait and landscape and is paint-only.
let buildFrames = 0;
for (const [width, height] of [[390, 760], [844, 390]]) for (const id of Builds.SPILL_ARTIFACT_IDS) {
  const { save, world, state } = fixture(width, height, id === 'siege' ? 'cannon' : 'laser');
  state.combat.build.artifact = id;
  state.combat.build.salvageDrops = id === 'reclaimer' ? 3 : 0;
  state.combat.build.echo = id === 'slipstream' ? 1.5 : 0;
  if (id === 'siege') state.combat.build.blasts = [{ x: width * .45, y: height * .55, r: 56, life: .18 }];
  if (id === 'slipstream') state.combat.shots[0].echo = true;
  const before = JSON.stringify(state), frame = createCanvas(width, height), ctx = frame.getContext('2d');
  Draw.drawWorld(ctx, world, save, bank); Draw.drawHud(ctx, world, bank, save);
  assert.equal(JSON.stringify(state), before, 'artifact feedback never mutates gameplay');
  const overlay = createCanvas(width, height), overlayCtx = overlay.getContext('2d'), labels = [];
  const original = overlayCtx.fillText.bind(overlayCtx);
  overlayCtx.fillText = (value, ...args) => { labels.push(value); original(value, ...args); };
  View.drawSpillCombatHud(overlayCtx, state);
  assert(labels.includes(id === 'reclaimer' ? 'SALVAGE 3/8' : id === 'slipstream' ? 'ECHO READY' : 'SIEGE CORE'));
  const bounds = alphaBounds(overlay);
  assert(bounds.left >= width - 106 && bounds.right <= width - 11 && bounds.bottom < 89, 'artifact HUD uses the existing weapon slot');
  const withEffects = digest(frame);
  state.combat.build.echo = 0; state.combat.build.blasts = []; delete state.combat.shots[0].echo;
  const plain = createCanvas(width, height);
  Draw.drawWorld(plain.getContext('2d'), world, save, bank); Draw.drawHud(plain.getContext('2d'), world, bank, save);
  if (id !== 'reclaimer') assert.notEqual(withEffects, digest(plain), 'priming/echo/blast feedback must produce visible pixels');
  writeFileSync(join(output, `build-${id}-${width}.png`), frame.toBuffer('image/png'));
  buildFrames++;
}

// Network failure settles readiness and paints visible, differentiated enemies.
globalThis.Image = class { set src(value) { queueMicrotask(() => this.onerror?.()); } };
const fallback = Art.emptyArt();
await Art.loadSpillCombat(fallback);
assert.equal(fallback.spillCombatStatus, 'fallback');
const { state } = fixture(390, 760, 'laser');
const fallbackBefore = JSON.stringify(state);
const canvas = createCanvas(390, 760), fallbackCtx = canvas.getContext('2d');
View.drawSpillCombat(fallbackCtx, state, fallback);
for (const enemy of state.combat.enemies.filter(enemy => !enemy.dead))
  assert(fallbackCtx.getImageData(enemy.x, enemy.y, 1, 1).data[3] > 0, 'missing sprite remains a visible enemy');
assert.equal(JSON.stringify(state), fallbackBefore, 'fallback painting cannot mutate gameplay');
console.log(JSON.stringify({ combatFrames: frames, buildFrames, blackoutFrames: 1, dodgeFrames: 2, currentControlHints: true, productionEnemySprites: Art.SPILL_ENEMY_IDS.length,
  deterministic: true, hudBounds: '320/390/1280', networkFallback: 'visible', output }));
