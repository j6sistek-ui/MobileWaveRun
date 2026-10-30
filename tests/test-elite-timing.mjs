import assert from 'node:assert/strict';
import * as S from '../dist/js/spill.js';
import * as C from '../dist/js/spill-combat.js';
import * as K from '../dist/js/spill-climax.js';

const dt = 1 / 60;
function scene(stage, hitTime, splash = false) {
  const s = S.createSpill(390, 760, 901, 0, false, false);
  s.phase = 'wave'; s.wave = 20; s.spec = S.spillWaveSpec(20, s.seed); s.waveT = 20; s.event = 'none';
  K.admitSpillClimax(s);
  const enemy = s.combat.enemies[0];
  enemy.x = 250; enemy.y = s.pilot.y; enemy.life = 8;
  enemy.elite.stage = stage; enemy.elite.timer = dt / 2;
  enemy.elite.aims = [s.pilot.y]; enemy.aimX = s.pilot.x; enemy.aimY = s.pilot.y;
  const target = splash ? { x: 210, y: s.pilot.y, r: 6, vx: 0, vy: 0, hp: 1, kind: 'shard',
    sprite: 0, spin: 0, rot: 0, arc: 0, arcPhase: 0, warn: 0, grazed: true, dead: false } : enemy;
  if (splash) s.rocks.push(target);
  s.combat.shots.push({ id: 20, team: 'player', weapon: 'laser', x: target.x - target.r - 3 - 600 * dt * hitTime,
    y: target.y, vx: 600, vy: 0, r: 3, damage: 1, life: 1, dead: false, ...(splash ? { blastRadius: 56 } : {}) });
  C.stepSpillCombat(s, dt, C.captureSpillCombatMotion(s), {
    shipRadius: S.SPILL.shipR, shatter(rock) { rock.dead = true; }, damagePilot() { s.hull--; },
  });
  return enemy;
}

for (const splash of [false, true]) {
  const damage = splash ? .5 : 1;
  assert.equal(scene('warning', .25, splash).hp, 12, 'shot before shield opening remains blocked');
  assert.equal(scene('warning', .75, splash).hp, 12 - damage, 'shot after shield opening deals damage');
  assert.equal(scene('exposed', .25, splash).hp, 12 - damage, 'shot before shield closing still deals damage');
  assert.equal(scene('exposed', .75, splash).hp, 12, 'shot after shield closing is blocked');
}
console.log('elite timing: eight real swept-shot/secondary-blast opening and closing cases passed');
