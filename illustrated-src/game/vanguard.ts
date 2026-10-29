import type { ArtBank } from './art';
import { paintVanguardRig } from './vanguard-rig';
import { PHYS } from './catalog';
import { createManeuverMotion, maneuverTap, maneuverContact, stepManeuver, paintManeuver } from './vanguard-maneuver';
import type { ManeuverMotion } from './vanguard-maneuver';

export const VANGUARD_FRAMES = 16;
// ONE MOTION (owner, 6 Sep 2026: "the Flight version is the version now,
// remove the others"). The Cinematic, Continuous and Upright trials are
// gone; what shipped as Flight - the articulated cruise on the maneuver
// rig - is AcorNut's flight. The mode field stays on the state as a
// constant because the rig keys its texture cache on it.
export type VanguardMotionMode = 'cruise';
export const VANGUARD_CYCLE_SECONDS = 1.8;
export const VANGUARD_CONTACT_SECONDS = .95;
type Contact = { x: number; y: number; nx: number; ny: number; age: number; strength: number };
/** Presentation only: a continuous tail clock plus an independent heading.
 * Neither clock feeds forces, collision, scoring or random seeds.
 */
export type VanguardMotion = {
  mode: VanguardMotionMode;
  phase: number; frame: number; heading: number; pitch: number; time: number;
  diving: boolean; freshThrust: boolean;
  thrustLeft: number; thrustPower: number; thrust: number;
  /** THE JETPACK BURST (owner: "add jetpack effect on tap"): 1 on the tap,
   *  gone in .42s - a flash at the pack and three puffs that carry off
   *  along the plume. Presentation only. */
  burst: number;
  /** THE BOOSTER (owner: "jet booster effect up to the apex, as long as the
   *  suit is rising from the tap"): lit by a tap, held while the pilot still
   *  climbs, cut the instant the climb ends - the shut-off IS the apex, and
   *  the fall starts from it. 0..1 flame intensity, presentation only. */
  boost: number;
  boosting: boolean;
  contacts: Contact[];
  // Independent inertial joints. Taps add energy, never restart a gesture.
  nearArm: number; farArm: number; nearLeg: number; farLeg: number; settle: number;
  drive: number; contactAge: number; contactPower: number; contactNormalY: number;
  maneuver: ManeuverMotion;
  rates: { heading: number; pitch: number; nearArm: number; farArm: number;
    nearLeg: number; farLeg: number; settle: number; drive: number };

};
export function createVanguardMotion(): VanguardMotion {
  return { mode: 'cruise', phase: 0, frame: 0, heading: 0, pitch: 16*DEG+pitchTrim,
    time: 0, diving: false, freshThrust: true, thrustLeft: 0, thrustPower: 0,
    thrust: 0, burst: 0, boost: 0, boosting: false, contacts: [], nearArm: 0, farArm: 0, nearLeg: 0, farLeg: 0, settle: 0,
    drive: 0, contactAge: 10, contactPower: 0, contactNormalY: -1, maneuver:createManeuverMotion(false),
    rates: { heading: 0, pitch: 0, nearArm: 0, farArm: 0, nearLeg: 0, farLeg: 0, settle: 0, drive: 0 } };
}
export function vanguardGate(s: VanguardMotion) { s.freshThrust = true; }
// deltaVy is the accepted upward impulse (old vy minus new vy).
export function vanguardTap(s: VanguardMotion, deltaVy = 450) {
  maneuverTap(s.maneuver,Math.max(0,deltaVy));
  // Actual accepted acceleration controls intensity. Repeated taps sustain
  // pressure; they cannot snap a joint or rewind the continuous tail.
  s.thrustPower = clamp(Math.max(0,deltaVy)/650, .24, 1);
  s.thrustLeft = .26;
  s.burst = 1;
  s.boosting = true;
  s.freshThrust = false; s.diving = false;
}
export function vanguardDive(s: VanguardMotion) {
  s.diving = true; s.freshThrust = true; s.thrustLeft = 0; s.boosting = false;
}
export function vanguardContact(s: VanguardMotion, x: number, y: number, nx: number, ny: number, strength: number) {
  s.contacts.push({ x, y, nx, ny, age: 0, strength });
  if (s.contacts.length > 3) s.contacts.shift();
  s.freshThrust = true; s.diving = false;
  s.contactAge = 0; s.contactPower = clamp(strength, .35, 1); s.contactNormalY = clamp(ny,-1,1);
  maneuverContact(s.maneuver,ny,strength);
  // Surface dust outlives an immediate tap; the body follows the rebound vy.
}
const DEG = Math.PI/180;
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi,x));
// Whole-animation forward lean (degrees, positive = nose down/forward). The
// maneuver rig and the frames fallback both rotate by it; the pause-sheet dial
// adjusts it at runtime and the save remembers the choice.
export const VANGUARD_PITCH_TRIM_DEFAULT = 12;
let pitchTrim = VANGUARD_PITCH_TRIM_DEFAULT*DEG;
export function setVanguardPitchTrim(degrees: number) {
  if (!Number.isFinite(degrees)) degrees = VANGUARD_PITCH_TRIM_DEFAULT;
  pitchTrim = clamp(degrees,-20,45)*DEG;
}
// Critically damped second-order response with bounded angular speed. Unlike
// a pose lerp, an accepted tap cannot reverse rotation in one video frame.
function joint(s: VanguardMotion, key: keyof VanguardMotion['rates'], target: number,
  dt: number, omega = 15, maxRate = 1.2) {
  let v = s.rates[key];
  v += (omega*omega*(target-s[key])-2*omega*v)*dt;
  v = clamp(v,-maxRate,maxRate);
  s[key] += v*dt; s.rates[key] = v;
}
function stepArticulated(s: VanguardMotion, dt: number, vy: number) {
  const upright = false;
  // Real short arcs change pose immediately, while the inertia continues
  // through their apex. Descent is read mostly in limbs, not a nose dive.
  const direction = clamp(vy/360,-1,1);
  const lift = Math.max(0,-direction), fall = Math.max(0,direction);
  for (let left=dt; left>1e-8;) {
    const h=Math.min(left,1/120); left-=h;
    s.time += h; s.contactAge += h;
    s.thrustLeft = Math.max(0,s.thrustLeft-h);
    s.burst = Math.max(0, s.burst - h/.42);
    // The booster stays lit only while the tap's climb continues. The sim's
    // vy crossing zero is the apex: cut it there, and it stays out until the
    // next tap - a fall never relights it.
    if (s.boosting && vy >= 0) s.boosting = false;
    s.boost += ((s.boosting ? 1 : 0) - s.boost) * (1 - Math.exp(-h/(s.boosting ? .045 : .07)));
    if (!s.boosting && s.boost < .01) s.boost = 0;
    const pressure=s.thrustPower*Math.min(1,s.thrustLeft/.18);
    s.thrust += (pressure-s.thrust)*(1-Math.exp(-h/.065));
    joint(s,'drive',pressure,h,18,3);
    const target = (direction<0 ? direction*(upright?6:10) : direction*(s.diving?(upright?25:18):(upright?12:8)))*DEG;
    joint(s,'heading',target,h,17,1.15);
    // Smooth the base attitude too: changing the beta toggle preserves pose.
    joint(s,'pitch',(upright?-28:16)*DEG+pitchTrim+s.heading-s.drive*(upright?2:1.4)*DEG,h,19,1.2);
    // Loose limbs keep a slow, asymmetric float even when short taps hold
    // velocity near its ascent limit. This clock NEVER restarts on input.
    // The delayed second arm and legs follow through instead of pumping in
    // lockstep; the second harmonic softens the return into a longer settle.
    const cycle=s.time*2*Math.PI/2.15;
    const nearFloat=Math.sin(cycle)+.12*Math.sin(cycle*2-.65);
    const farFloat=Math.sin(cycle-1.10)+.14*Math.sin(cycle*2-1.8);
    const kneeFloat=Math.sin(s.time*2*Math.PI/2.65-1.3);
    const trailingKnee=Math.sin(s.time*2*Math.PI/2.65-2.35);
    // Contact is its own damped compression/push-off, never a tap squat.
    const age=s.contactAge;
    const compress=s.contactPower*Math.exp(-Math.pow((age-.10)/.075,2));
    const push=s.contactPower*Math.exp(-Math.pow((age-.29)/.13,2));
    const after=s.contactPower*Math.exp(-Math.pow((age-.51)/.17,2));
    const bounce=(upright?1:.55);
    const feet=bounce*Math.max(0,-s.contactNormalY);
    const brace=bounce*(s.contactNormalY>0 ? -1 : 1);
    joint(s,'nearArm',(.06+lift*.09-fall*.10+s.drive*.09+nearFloat*.36+compress*.16*brace),h,14,1.3);
    joint(s,'farArm',(.13+lift*.06-fall*.07+s.drive*.085+farFloat*.40+compress*.19*brace),h,12,1.3);
    joint(s,'nearLeg',(-lift*.09+fall*.10-s.drive*.06+kneeFloat*.23+(compress*.27-push*.18+after*.04)*feet),h,11,1.2);
    joint(s,'farLeg',(-lift*.06+fall*.07-s.drive*.04+trailingKnee*.18+(compress*.19-push*.13)*feet),h,10,1.2);
    joint(s,'settle',(-s.drive*2.5+Math.sin(cycle-.7)*2.8+(compress*7-push*4)*feet),h,13,35);
  }
  s.phase=(s.phase+dt/VANGUARD_CYCLE_SECONDS)%1;
  s.frame=Math.floor(s.phase*VANGUARD_FRAMES);
}
export function stepVanguard(s: VanguardMotion, dt: number, vy: number) {
  if (!(dt>0) || !Number.isFinite(dt) || !Number.isFinite(vy)) return;
  // The engine bounds ticks; guard isolated preview callers after suspension.
  dt=Math.min(dt,.25);
  stepManeuver(s.maneuver,dt,vy,s.diving,false);
  stepArticulated(s,dt,vy);
  for(const p of s.contacts) p.age+=dt;
  s.contacts=s.contacts.filter(p=>p.age<VANGUARD_CONTACT_SECONDS);
}

export function paintVanguard(ctx: CanvasRenderingContext2D, art: ArtBank | null | undefined,
  x: number, y: number, size: number, state?: VanguardMotion) {
  if(state&&art?.vanguardParts){
    paintManeuver(ctx,art.vanguardParts,x,y,size,state.maneuver,pitchTrim);
    if (state.boost > 0 || state.burst > 0) paintManeuverBurst(ctx,x,y,size,state);
    return;
  }
  const bank = art?.vanguard?.length === VANGUARD_FRAMES ? art.vanguard : undefined;
  const frame = bank?.[state?.frame ?? 0] ?? art?.suits.vanguard;
  if (!frame) return;
  const scale = size / 400;
  ctx.save(); ctx.translate(x,y); ctx.rotate(state?.pitch ?? 16*DEG+pitchTrim);
  if (state && state.thrust > .01) paintJetpackExhaust(ctx,scale,state);
  // One registered, fully opaque whole-character drawing. The face and legs
  // hold their scale; the drawn tail changes shape instead of being stretched.
  if (state) paintVanguardRig(ctx,frame,scale,state);
  else ctx.drawImage(frame,-280*scale,-280*scale,512*scale,512*scale);
  if (state && state.boost > 0) paintBoosterAt(ctx,scale,state,[[-60,-48,.8],[-44,-34,1]],-.92,-.40);
  if (state && state.burst > 0) paintBurstAt(ctx,scale,state,[[-60,-48,.8],[-44,-34,1]],-.92,-.40);
  ctx.restore();
}
// THE BURST (owner, 6 Sep 2026: "add jetpack effect on tap"). Painted OVER
// the rig: the steady plume sits behind the body, and a burst drawn there
// never read. A white-hot flash at the pack's mouth with a cyan streak that
// dies in a third of the burst, and three puffs that grow and fade as they
// travel off along the plume. Sized to the pack, not the pixel - the pilot
// is 66px on a phone. Deterministic; nothing here feeds the sim.
function paintBurstAt(ctx: CanvasRenderingContext2D, scale: number, s: VanguardMotion,
  nozzles: readonly (readonly [number, number, number])[], dx: number, dy: number) {
  ctx.save(); ctx.scale(scale,scale);
  const u=1-s.burst;                           // 0 at the tap, 1 when spent
  for (const [x,y,m] of nozzles) {
    ctx.save(); ctx.translate(x,y);
    const flash=Math.max(0,1-u*3.2);
    if (flash>0) {
      const fr=52*m;
      const fg=ctx.createRadialGradient(0,0,0,0,0,fr);
      fg.addColorStop(0,`rgba(255,255,255,${.95*flash})`);
      fg.addColorStop(.35,`rgba(180,245,255,${.75*flash})`);
      fg.addColorStop(.7,`rgba(245,191,104,${.3*flash})`);
      fg.addColorStop(1,'rgba(245,191,104,0)');
      ctx.fillStyle=fg;ctx.beginPath();ctx.arc(0,0,fr,0,Math.PI*2);ctx.fill();
      const L=(70+60*(1-flash))*m;
      ctx.strokeStyle=`rgba(255,255,255,${.9*flash})`;ctx.lineWidth=8*m;ctx.lineCap='round';
      ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(dx*L,dy*L);ctx.stroke();
      ctx.strokeStyle=`rgba(120,235,255,${.6*flash})`;ctx.lineWidth=16*m;
      ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(dx*L*.8,dy*L*.8);ctx.stroke();
    }
    for (let i=0;i<3;i++) {
      const d=(26+i*30+u*(110+i*26))*m;         // distance along the burst
      const side=((i-1)*16)*m*(1+u*1.2);         // fan out as they travel
      const px=dx*d-dy*side, py=dy*d+dx*side;
      const r=(22+i*5+u*40)*m;
      const a=.8*(1-u)*(1-u*.6)*(1-i*.12);
      const pg=ctx.createRadialGradient(px,py,0,px,py,r);
      pg.addColorStop(0,`rgba(250,246,238,${a})`);pg.addColorStop(.5,`rgba(236,228,214,${a*.7})`);pg.addColorStop(1,'rgba(236,228,214,0)');
      ctx.fillStyle=pg;ctx.beginPath();ctx.arc(px,py,r,0,Math.PI*2);ctx.fill();
    }
    ctx.restore();
  }
  ctx.restore();
}
// The maneuver rig's pack: the same transform paintManeuver uses, the
// nozzles paintExhaust uses, the plume's own direction (down and back).
function paintManeuverBurst(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, s: VanguardMotion) {
  const p=s.maneuver.pose, scale=size/400;
  ctx.save(); ctx.translate(x,y); ctx.scale(scale,scale); ctx.translate(0,60+p.heave); ctx.rotate(p.body*DEG+pitchTrim);
  if (s.boost > 0) paintBoosterAt(ctx,1,s,[[-84,5,1],[-66,-1,.72]],-.35,.94);
  if (s.burst > 0) paintBurstAt(ctx,1,s,[[-84,5,1],[-66,-1,.72]],-.35,.94);
  ctx.restore();
}
// THE BOOSTER FLAME. A steady jet held for the whole climb: a white-hot
// core inside a cyan cone, an amber fringe, an outer glow, and a flicker
// on the clock so a long climb never reads as a still decal. It is painted
// over the rig at the pack's mouth, in the plume's own direction, so its
// tip does not hide under the body. Fades in a frame or two on the tap and
// snuffs over ~70ms at the apex, which is the moment the fall begins.
function paintBoosterAt(ctx: CanvasRenderingContext2D, scale: number, s: VanguardMotion,
  nozzles: readonly (readonly [number, number, number])[], dx: number, dy: number) {
  const b = s.boost; if (b <= 0) return;
  ctx.save(); ctx.scale(scale,scale);
  const t = s.time;
  const flick = 1 + .07*Math.sin(t*61) + .05*Math.sin(t*37+1.3);
  const nx = -dy, ny = dx;                       // across the flame
  for (const [x,y,m] of nozzles) {
    const L = (54 + 118*b) * m * flick;          // flame length
    const W = (15 + 9*b) * m;                    // half-width at the mouth
    ctx.save(); ctx.translate(x,y);
    // outer glow
    const g = ctx.createRadialGradient(dx*L*.3,dy*L*.3,0,dx*L*.3,dy*L*.3,L*.75);
    g.addColorStop(0,`rgba(120,230,255,${.28*b})`); g.addColorStop(1,'rgba(120,230,255,0)');
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(dx*L*.3,dy*L*.3,L*.75,0,Math.PI*2); ctx.fill();
    // cyan cone with an amber fringe
    const cone = (len: number, w: number, c0: string, c1: string, c2: string) => {
      const lg = ctx.createLinearGradient(0,0,dx*len,dy*len);
      lg.addColorStop(0,c0); lg.addColorStop(.45,c1); lg.addColorStop(1,c2);
      ctx.fillStyle = lg; ctx.beginPath();
      ctx.moveTo(nx*w,ny*w);
      ctx.quadraticCurveTo(dx*len*.55+nx*w*.8, dy*len*.55+ny*w*.8, dx*len, dy*len);
      ctx.quadraticCurveTo(dx*len*.55-nx*w*.8, dy*len*.55-ny*w*.8, -nx*w, -ny*w);
      ctx.closePath(); ctx.fill();
    };
    cone(L, W, `rgba(232,172,81,${.55*b})`, `rgba(91,232,255,${.75*b})`, 'rgba(232,172,81,0)');
    cone(L*.62, W*.55, `rgba(255,255,255,${.95*b})`, `rgba(224,252,255,${.8*b})`, 'rgba(180,245,255,0)');
    // mouth
    const mg = ctx.createRadialGradient(0,0,0,0,0,W*1.3);
    mg.addColorStop(0,`rgba(255,255,255,${.9*b})`); mg.addColorStop(1,'rgba(255,255,255,0)');
    ctx.fillStyle=mg; ctx.beginPath(); ctx.arc(0,0,W*1.3,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}
function paintJetpackExhaust(ctx: CanvasRenderingContext2D, scale: number, s: VanguardMotion) {
  ctx.save(); ctx.scale(scale,scale);
  const power=s.thrust, lift=s.drive;
  // Nozzles follow the painted pack, not screen coordinates. The plume has
  // a warm outer falloff, cyan inner flow and a compact white-hot core.
  // Smooth low-frequency breathing: no random sparks or strobe on taps.
  for (const [x,y,m] of [[-54,-37,.78],[-40,-26,1]]) {
    ctx.save(); ctx.translate(x,y); ctx.rotate(-.08-lift*.06);
    const len=(34+100*power)*m*(1+.04*Math.sin(s.time*7));
    const grad=ctx.createLinearGradient(0,0,-len*.63,len*.77);
    grad.addColorStop(0,`rgba(222,252,255,${power*.95})`);
    grad.addColorStop(.25,`rgba(87,226,255,${power*.75})`);
    grad.addColorStop(.64,`rgba(245,191,104,${power*.3})`);
    grad.addColorStop(1,'rgba(245,191,104,0)');
    ctx.fillStyle=grad;ctx.beginPath();ctx.moveTo(-5,-3);
    ctx.bezierCurveTo(-len*.2,len*.28,-len*.37,len*.57,-len*.63,len*.77);
    ctx.bezierCurveTo(-len*.31,len*.67,-len*.08,len*.30,5,3);ctx.closePath();ctx.fill();
    ctx.fillStyle=`rgba(223,251,255,${power*.85})`;ctx.beginPath();
    ctx.moveTo(-3,-2);ctx.quadraticCurveTo(-3,8,-len*.19,len*.27);
    ctx.quadraticCurveTo(2,9,3,2);ctx.closePath();ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}
/** Dust stays at the contacted surface in world space and lives through
 * the next tap. Three bounded, deterministic plumes; no RNG consumption.
 */
export function paintVanguardContacts(ctx: CanvasRenderingContext2D, s: VanguardMotion) {
  ctx.save();
  for (const p of s.contacts) {
    const u = p.age / VANGUARD_CONTACT_SECONDS;
    const appear = Math.min(1, p.age / .055);
    for (let i=0;i<11;i++) {
      const fan = (i-5)/5;
      const spread = (5 + 26*u) * fan;
      const lift = (4 + 12*(1-Math.abs(fan))) * Math.sin(u*Math.PI*.8);
      const x = p.x - p.ny*spread + p.nx*lift;
      const y = p.y + p.nx*spread + p.ny*lift;
      const r = (2.1 + (i%3)*.6 + u*3) * p.strength;
      ctx.fillStyle = `rgba(218,210,192,${.25*appear*(1-u)*(1-u)})`;
      ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
    }
  }
  ctx.restore();
}

// Each hangar/portrait canvas owns its preview clock. Same event controller
// as flight, including several rapid taps and a bounce followed by a tap.
const previews = new WeakMap<object, { t: number; vy: number; state: VanguardMotion }>();
const PREVIEW_EVENTS = [[.05,'tap'],[.23,'tap'],[.41,'tap'],[.59,'tap'],[.77,'tap'],[.95,'tap'],
  [1.13,'tap'],[1.31,'tap'],[2.9,'dive'],[3.75,'bounce'],[3.8,'tap'],[3.98,'tap'],[4.16,'tap'],
  [4.34,'tap'],[5.5,'gate'],[5.55,'tap'],[5.73,'tap'],[5.91,'tap']] as const;
export function vanguardPreview(key: object, time: number) {
  const t = Math.max(0,time) % 8;
  let p = previews.get(key);
  if (!p || t < p.t) { p = {t:0,vy:0,state:createVanguardMotion()}; previews.set(key,p); }
  while (p.t < t - 1e-8) {
    const end = Math.min(t,p.t+1/60);
    for (const [at,event] of PREVIEW_EVENTS) if (at > p.t && at <= end) {
      if (event === 'tap') { vanguardTap(p.state,p.vy-PHYS.flap); p.vy=PHYS.flap; }
      if (event === 'dive') { vanguardDive(p.state); p.vy=PHYS.dive; }
      if (event === 'bounce') { vanguardContact(p.state,0,25,0,-1,1); p.vy=-350; }
      if (event === 'gate') vanguardGate(p.state);
    }
    p.vy = p.vy + PHYS.gravity * (end-p.t); stepVanguard(p.state,end-p.t,p.vy); p.t=end;
  }
  return p.state;
}

/** Cosmetic shield: quiet cyan lens with three gold field arcs. No flash,
 * hitbox, duration or charge changes. Called inside the world's transform.
 */
export function paintVanguardShield(ctx: CanvasRenderingContext2D, x: number, y: number, time: number) {
  ctx.save();ctx.translate(x,y);
  const lens=ctx.createRadialGradient(-7,-8,2,0,0,29);
  lens.addColorStop(0,'rgba(130,235,255,0)');lens.addColorStop(.8,'rgba(130,235,255,.025)');
  lens.addColorStop(1,'rgba(130,235,255,.22)');
  ctx.fillStyle=lens;ctx.beginPath();ctx.arc(0,0,29,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='rgba(255,215,137,.8)';ctx.lineWidth=1.4;
  for(let i=0;i<3;i++){
    const a=time*.3+i*Math.PI*2/3;ctx.beginPath();ctx.arc(0,0,29,a,a+1.45);ctx.stroke();
  }
  ctx.restore();
}

export function paintVanguardWake(ctx: CanvasRenderingContext2D,x:number,y:number,t:number){
  ctx.save();ctx.lineCap='round';
  for(let lane=-1;lane<=1;lane+=2){
    ctx.strokeStyle=lane<0?'#85edff':'#edc780';ctx.lineWidth=1.6;
    ctx.beginPath();ctx.moveTo(x+18,y+lane*3);ctx.bezierCurveTo(x+1,y+lane*5,x-12,y+lane*2,x-24,y+lane*7);ctx.stroke();
    ctx.fillStyle='#fff1d0';const dx=18-((t*24)%42);ctx.fillRect(x+dx,y+lane*4-1,3,2);
  }
  ctx.restore();
}
