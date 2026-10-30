import assert from 'node:assert/strict';
import { createCanvas } from '@napi-rs/canvas';
import { mkdirSync, writeFileSync } from 'node:fs';
import * as S from '../dist/js/spill.js';
import * as H from '../dist/js/spill-hazards.js';
import * as C from '../dist/js/spill-combat.js';
import { drawSpillHazards } from '../dist/js/spill-hazard-view.js';

const DT = 1 / 60, sizes = [[320, 760], [390, 844], [844, 390], [1280, 720]];
let cases = 0;
const test = (name, run) => { run(); cases++; console.log(`hazard expansion: ${name}`); };
function flight(wave = 22, W = 390, Ht = 760, seed = 71) {
  const s = S.createSpill(W, Ht, seed, 0, false, false);
  Object.assign(s, { phase: 'wave', wave, waveT: 5, event: 'none', eventWarn: 0, eventNext: 1000,
    surgeT: 0, surgeFired: true, nextRock: 1000, nextNut: 1000, nextSpecial: 1000 });
  s.spec = S.spillWaveSpec(wave, seed); s.spec.dur = 100;
  s.combat.nextEnemy = 1000; s.pilot.y = Ht / 2;
  H.beginSpillHazardWave(s); return s;
}
function admit(s) { s.hazards.next = 0; H.admitSpillHazards(s, DT); assert(s.hazards.actors.length); s.hazards.next = 1000; return s.hazards.actors[0]; }
function activate(h) { h.phase = 'active'; h.warn = 0; h.activeTime = 1; }
function enemy(s, x, y, hp = 3) {
  const e = { id: s.combat.nextId++, kind: 'pursuer', x, y, vx: 0, vy: 0, r: 18, hp, maxHp: hp,
    age: 0, life: 20, cooldown: 1000, telegraph: 0, telegraphTotal: .9, aimX: 0, aimY: 0, shotSpeed: 0,
    homeY: y, side: 1, hitFlash: 0, dead: false };
  s.combat.enemies.push(e); return e;
}
function shot(s, x, y, vx, damage = 5) {
  s.combat.shots.push({ id: s.combat.nextId++, team: 'player', weapon: 'laser', x, y, vx, vy: 0,
    r: 3, damage, life: 2, dead: false });
}
function sim(s, dt = DT) {
  const motion = C.captureSpillCombatMotion(s), contacts = [];
  let hits = 0;
  H.stepSpillHazards(s, dt, motion.pilot, { damagePilot() { hits++; }, contacts });
  C.stepSpillCombat(s, dt, motion, { shipRadius: S.SPILL.shipR, shatter(r) { r.dead = true; }, damagePilot() { hits++; }, hazardContacts: contacts });
  return hits;
}

test('new lessons and every solo family remain reachable after the expanded six-family plan', () => {
  for (const [wave, kind] of [[22, 'flare'], [27, 'wreck']]) for (const [W, Ht] of sizes) {
    const s = flight(wave, W, Ht), h = admit(s);
    assert.equal(h.kind, kind); assert.equal(s.hazards.actors.length, 1);
    const hull = s.hull; for (let i = 0; i < 20; i++) S.stepSpill(s, DT);
    assert.equal(s.hull, hull, 'fresh warning is harmless');
    assert(Math.abs(h.safeY - s.pilot.y) <= 220);
  }
  const first = new Set();
  for (let seed = 0; seed < 1000; seed++) first.add(H.spillHazardPlan(41, seed).families[0]);
  assert.deepEqual([...first].sort(), [...H.SPILL_HAZARD_IDS].sort());
});

test('solar shadow, outside-band route and swept exposure match the painted geometry', () => {
  for (const [W, Ht] of sizes) {
    const s = flight(22, W, Ht), h = admit(s); activate(h); h.fuse = .7; h.y = Ht / 2;
    s.pilot.y = h.y; assert(H.spillFlareSheltered(h, s.pilot));
    assert.equal(sim(s), 0, 'full ship inside shadow is safe');
    s.pilot.y = h.y + h.r - S.SPILL.shipR + 1;
    assert.equal(sim(s), 1, 'partial protrusion is exposed');
    h.hit = false; s.pilot.y = h.y + h.range + S.SPILL.shipR + 1;
    assert.equal(sim(s), 0, 'outside the band remains an unconditional alternative');
  }
});

test('destroyed cover cancels a later same-frame exposure and restarts a full warning', () => {
  const s = flight(), h = admit(s); activate(h); h.fuse = .7;
  s.pilot.y = h.y; shot(s, h.x - 50, h.y, 1200, 5);
  const motion = C.captureSpillCombatMotion(s), contacts = []; let hits = 0;
  // Enter the exposed strip at the end of this tick, after the cover shot.
  s.pilot.y += 35;
  H.stepSpillHazards(s, .05, motion.pilot, { damagePilot() { hits++; }, contacts });
  C.stepSpillCombat(s, .05, motion, { shipRadius:16, shatter(){}, damagePilot(){hits++;}, hazardContacts:contacts });
  assert.equal(h.coverBroken, true); assert.equal(h.phase, 'warning'); assert.equal(h.warn, 1.8);
  assert.equal(hits, 0, 'earlier destruction gives the new warning before exposure');
  assert.equal(h.dead, false); assert.equal(h.hp, 0);
  assert.equal(H.damageSpillHazard(s, h, 99), false, 'cover cannot restart forever');
});

test('wreck hull is avoidable and only its bright core accepts an ordinary shot', () => {
  const s = flight(27), h = admit(s); activate(h); h.x = 260; h.y = 340; h.vx = 0;
  shot(s, 190, h.y + 30, 1000); sim(s, .1);
  assert.equal(h.hp, 3, 'a shot through the hull rim misses the weak point');
  shot(s, 190, h.y, 1000); sim(s, .1);
  assert.equal(h.hp, 0); assert.equal(h.phase, 'spent'); assert.equal(h.dead, false);
  assert(h.fragments.length > 0 && h.fragments.length <= 2);
  for (const f of h.fragments) assert.equal(f.warn, 1.2, 'new fragments always receive a full warning');
  assert.equal(s.combat.kills, 0); assert.equal(s.shattered, 0); assert.equal(s.ore, 0);
  const path = JSON.stringify(h.fragments); assert.equal(sim(s, .1), 0);
  assert(h.fragments.every((f, i) => f.x === JSON.parse(path)[i].x && f.y === JSON.parse(path)[i].y), 'fragments hold still during warning');
});

test('mine explosions damage visible enemies once and each chain link keeps a fresh fuse', () => {
  const s = flight(7), a = admit(s); activate(a); a.x = 230; a.y = 250; a.vx = 0; a.fuse = .01;
  const b = { ...a, id: a.id + 1, x: a.x + 50, fuse: -1 }; s.hazards.actors.push(b);
  s.pilot.y = 600; const e = enemy(s, a.x - 50, a.y);
  assert.equal(sim(s), 0); assert(e.dead); assert.equal(s.combat.kills, 1);
  assert.equal(b.fuse, .9, 'chain begins with a full fresh warning');
  const drops = s.nuts.length; sim(s); assert.equal(s.combat.kills, 1); assert.equal(s.nuts.length, drops);
  assert.equal(H.damageSpillHazard(s, b, 2), true, 'shooting can stop the pending chain');
  assert.equal(s.ore, 0, 'all salvage requires collection');
});

test('opening a wreck weak point before hull contact creates a usable passage immediately', () => {
  const s = flight(27), h = admit(s); activate(h); h.x = 250; h.y = s.pilot.y; h.vx = -2000;
  shot(s, 200, h.y, 1000, 3);
  assert.equal(sim(s,.1),0,'the earlier weak-point impact removes the later body contact');
  assert.equal(h.phase,'spent'); assert(h.fragments.every(f => f.warn === 1.2));
});

test('late wreck breaks preserve the full new fragment warning and a stock escape route', () => {
  for (const [W,Ht] of sizes) for (const wave of [22,27]) {
    const s = flight(wave,W,Ht), h = admit(s);
    if (wave === 27) { activate(h); h.life = .2; H.damageSpillHazard(s,h,3); assert(h.life >= 5.2); }
    for (let frame=0; frame<650 && !h.dead; frame++) {
      S.spillSteer(s,Math.max(-1,Math.min(1,(h.safeY-s.pilot.y)/65))); S.stepSpill(s,DT);
      assert.equal(s.hull,3,`stock reserved route survives ${h.kind} at ${W}x${Ht}`);
    }
    assert(h.dead);
  }
});

test('comet hitting an enemy before the player prevents its later ship contact', () => {
  const s = flight(4), h = admit(s); activate(h); h.x = 250; h.y = s.pilot.y; h.vx = -2000; h.vy = 0;
  const e = enemy(s, 190, h.y, 3);
  assert.equal(sim(s, .1), 0); assert(e.dead); assert(h.dead); assert.equal(s.combat.kills, 1);
});

test('gravity bends enemies within bounds and releases one physical rim reward', () => {
  const s = flight(16), h = admit(s); activate(h); h.x = 270; h.y = 350; h.vx = 0;
  const e = enemy(s, 320, 390); e.cooldown = 1000;
  const drift = H.spillGravityEnemyDrift(s, e);
  assert(drift.x < 0 && drift.y < 0); assert(Math.abs(drift.x) <= 40 && Math.abs(drift.y) <= 70);
  sim(s); assert(e.x < 320, 'enemy receives the visible pull');
  const gold = s.nuts.filter(n => n.kind === 'gold'); assert.equal(gold.length, 1);
  assert(Math.hypot(gold[0].x - h.x, gold[0].y - h.y) > h.r + S.SPILL.shipR, 'reward lies safely outside the damaging core');
  for (let i = 0; i < 60; i++) sim(s);
  assert.equal(s.nuts.filter(n => n.kind === 'gold').length, 1); assert.equal(s.ore, 0);
  const stable = flight(16), well = admit(stable); activate(well);
  const home = stable.W * .74; well.x = home - 70; well.y = stable.pilot.y; well.vx = 0;
  const pulled = enemy(stable,home,well.y,100);
  for (let i = 0; i < 30; i++) sim(stable);
  assert(pulled.x < home - 5,'horizontal pull accumulates instead of snapping to home each frame');
});

test('bent debris can hit an enemy while ordinary rocks do not create passive kill farms', () => {
  for (const bent of [false, true]) {
    const s = flight(16), well = admit(s); activate(well); well.x=270; well.y=300; well.vx=0;
    const e = enemy(s, 270, 250);
    const rock = { x:270, y:250, vx:-80, vy:0, r:12, kind:'shard', sprite:0, spin:0, rot:0, arc:0,
      arcPhase:0, warn:0, grazed:false, dead:false,
      ...(bent ? {gravityBend:{start:s.t,duration:2.4,strength:26},gravityWell:well.id} : {}) };
    s.rocks.push(rock); sim(s);
    assert.equal(e.dead,bent); assert.equal(rock.dead,bent);
    assert.equal(s.combat.kills,bent ? 1 : 0); assert.equal(s.shattered,0,'environmental shatter has no weapon/contract credit');
    sim(s); assert.equal(s.combat.kills,bent ? 1 : 0,'contact cannot pay twice');
  }
  const s=flight(16), well=admit(s); activate(well); well.x=270; well.y=300; well.vx=0;
  const stale={x:270,y:250,warn:0,dead:false,r:12,gravityWell:well.id,gravityBend:{start:-5,duration:2.4,strength:26}};
  assert.equal(H.spillBentRockThreat(s,stale),false,'expired bends never remain hidden damage flags');
});

test('new geometry and fragment warnings paint deterministically without mutating authority', () => {
  mkdirSync('tests/.artifacts/hazard-expansion', { recursive:true });
  for (const [W, Ht] of sizes) for (const wave of [22, 27]) {
    const s = flight(wave,W,Ht), h = admit(s); h.x = W * .7;
    for (const phase of ['warning','active','broken']) {
      if (phase !== 'warning') { activate(h); h.fuse = .7; }
      if (phase === 'broken') H.damageSpillHazard(s,h,99);
      const before = JSON.stringify(s), a = createCanvas(W,Ht), b = createCanvas(W,Ht);
      drawSpillHazards(a.getContext('2d'),s); drawSpillHazards(b.getContext('2d'),s);
      assert.deepEqual(a.toBuffer('image/png'),b.toBuffer('image/png')); assert.equal(JSON.stringify(s),before);
      writeFileSync(`tests/.artifacts/hazard-expansion/${h.kind}-${phase}-${W}.png`,a.toBuffer('image/png'));
    }
  }
});

test('64 full scheduled flare/wreck waves retain admissions, warning floors and reserved refuges', () => {
  const results = [];
  for (const [W,Ht] of sizes) for (const wave of [22,27]) for (const seed of [1,7,19,37,71,101,307,997]) {
    const s=S.createSpill(W,Ht,seed,0,false,false);
    Object.assign(s,{phase:'wave',phaseT:0,wave,waveT:0,event:'none'});
    s.spec=S.spillWaveSpec(wave,seed); s.liveMods=s.spec.mods.slice();
    C.beginSpillCombatWave(s); H.beginSpillHazardWave(s);
    // Scheduler observer only: invulnerability keeps the run alive, while
    // normal rocks/enemies/spawn timers/pressure still compete for admission.
    // The separate stock-ship test below supplies counterplay evidence.
    s.iframes=1000;
    const seen=new Set(); let frames=0, maximum=0;
    while(s.phase==='wave' && frames<6000) {
      const target=s.H*(.5+.15*Math.sin(frames/150));
      S.spillSteer(s,Math.max(-.7,Math.min(.7,(target-s.pilot.y)/80)));
      S.stepSpill(s,DT); frames++;
      const live=s.hazards.actors.filter(h=>!h.dead); maximum=Math.max(maximum,live.length);
      assert(live.length<=1,'new lessons never overlap environmental actors');
      for(const h of live) if(!seen.has(h.id)) {
        seen.add(h.id);
        assert.equal(h.kind,wave===22?'flare':'wreck');
        assert(h.warn>=(wave===22?1.8:1.2)-DT*2,'full initial warning survives natural admission');
        assert(h.safeY>=28 && h.safeY<=s.H-28);
        assert(Math.abs(h.safeY-s.pilot.y)<=220+S.SPILL.steerSpeed*DT,'refuge is within stock warning travel budget');
        const margin=h.kind==='flare'?h.range+44:h.r+52;
        assert(Math.abs(h.safeY-h.y)>margin,'refuge is outside the whole harmful band/body');
      }
    }
    assert(frames<6000,'production wave timer reaches drain');
    assert(seen.size>=2,`${W}x${Ht} wave${wave} seed${seed} admits multiple encounters`);
    assert(seen.size<=4,'encounter count retains its cap');
    results.push({wave,W,H:Ht,seed,admissions:seen.size,maximum});
  }
  console.log(JSON.stringify({newFamilyScheduleRuns:results.length,minimumAdmissions:Math.min(...results.map(r=>r.admissions)),
    maximumConcurrent:Math.max(...results.map(r=>r.maximum)),observerInvulnerable:true}));
});

test('192 stock-ship paths avoid new warned hazards using steering alone, without immunity', () => {
  let paths=0;
  for(const [W,Ht] of sizes) for(const wave of [22,27]) for(const seed of [1,7,19,37,71,101,307,997]) for(const fraction of [.25,.5,.75]) {
    const s=flight(wave,W,Ht,seed); s.pilot.y=Ht*fraction;
    const h=admit(s); assert.equal(h.phase,'warning'); assert.equal(s.iframes,0); assert.equal(s.hull,3);
    assert.equal(s.up.thrusters,0); assert.equal(s.shield,0);
    let frames=0;
    while(!h.dead && frames<900) {
      S.spillSteer(s,Math.max(-1,Math.min(1,(h.safeY-s.pilot.y)/65)));
      S.stepSpill(s,DT); frames++;
      assert.equal(s.hull,3,`${h.kind} stock route remains safe at ${W}x${Ht}, seed${seed}, start${fraction}`);
      assert.equal(s.hits,0); assert.equal(s.iframes,0,'no immunity hides an unsafe crossing');
    }
    assert(h.dead,'hazard completes its full warning and active pass'); paths++;
  }
  assert.equal(paths,192);
});

test('rotation preserves wreck weak points and fresh fragment paths, timers and rendered geometry', () => {
  for(const [fromW,fromH,toW,toH] of [[390,844,844,390],[844,390,390,844]]) {
    const s=flight(27,fromW,fromH),h=admit(s); activate(h); h.x=fromW*.72; h.y=fromH*.5; h.vx=0;
    const hp=h.hp; S.resizeSpill(s,toW,toH);
    assert.equal(H.spillHazardTargetRadius(h),11,'weak-point painted radius remains its hit radius');
    shot(s,h.x-60,h.y+30,1000); sim(s,.1); assert.equal(h.hp,hp,'resized hull rim does not absorb core-only fire');
    shot(s,h.x-60,h.y,1000); sim(s,.1); assert.equal(h.phase,'spent');
    const original=h.fragments.map(f=>({...f})),life=h.life;
    S.resizeSpill(s,fromW,fromH);
    assert.equal(h.life,life,'rotation does not spend the remaining wreck/fragment lifetime');
    assert(h.fragments.length>0);
    h.fragments.forEach((f,i)=>{
      const old=original[i];
      assert.equal(f.warn,old.warn); assert.equal(f.life,old.life); assert.equal(f.r,10);
      assert(Math.abs(f.x-old.x*fromW/toW)<1e-8); assert(Math.abs(f.y-old.y*fromH/toH)<1e-8);
      assert(Math.abs(f.vx-old.vx*fromW/toW)<1e-8); assert(Math.abs(f.vy-old.vy*fromH/toH)<1e-8);
    });
    const canvas=createCanvas(fromW,fromH),before=JSON.stringify(s);
    drawSpillHazards(canvas.getContext('2d'),s);
    assert.equal(JSON.stringify(s),before,'rotated painting remains read-only');
    for(const f of h.fragments) assert(canvas.getContext('2d').getImageData(Math.round(f.x),Math.round(f.y),1,1).data[3]>0,'fragment warning is painted at its collision center');
  }
});
console.log(`${cases} expansion rule/render cases passed; physical phone feel and balance remain unverified`);
