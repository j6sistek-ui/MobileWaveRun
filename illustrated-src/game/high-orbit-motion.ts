import {HIGH_ORBIT_PROFILES,isPremiumSuit,type HighOrbitId,type PremiumSuitId} from './high-orbit-config';
import {createManeuverMotion,maneuverTap,stepManeuver,type ManeuverMotion} from './vanguard-maneuver';

export const PREMIUM_FLIGHT_DURATION=1;
/** dir is present only while a rewind runs backwards (-1); the state shape is
 *  otherwise unchanged from the frozen fixtures in test-premium-pilots. */
export type PremiumFramePlayback={age:number;active:boolean;queued:boolean;dir?:-1};
/** what a second tap does to a premium playback that is still running:
 *  finish (queue one replay), restart (frame one again), rewind (play
 *  backwards, bounce off frame one, run to the end) - the same three
 *  answers sim.ts repeatTapMode gives the painted banks. */
export type PremiumRepeat='finish'|'restart'|'rewind';

/** AcorNut's maneuver banks retargeted to the five High Orbit anatomies.
 * Accepted taps accent the limbs and tail without resetting a joint. The
 * tail follows travel and recoil instead of a free-running sine. Premium frames share only its accepted
 * input lifecycle, clock and wake power; their unused joint poses never move.
 * No game forces, save writes or simulation RNG. */
export type HighOrbitPose = {
  body:number; head:number; heave:number;
  nearArm:number; nearElbow:number; farArm:number; farElbow:number;
  nearThigh:number; nearKnee:number; farThigh:number; farKnee:number;
  tailRoot:number; tailMid:number; tailTip:number;
};
export type HighOrbitMotion = {
  id:HighOrbitId; time:number; phase:number; velocity:number; previousVy:number;
  initialized:boolean; pulse:number; recoil:number; power:number; pose:HighOrbitPose; rates:HighOrbitPose;
  /** Premium whole-frame playback; absent from the five articulated rigs. */
  frames?:PremiumFramePlayback;
  /** AcorNut locomotion and thrust gesture; never used by premium frames. */
  maneuver?:ManeuverMotion;
};
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
const smooth=(v:number)=>{v=clamp(v,0,1);return v*v*(3-2*v);};
const keys:(keyof HighOrbitPose)[]=['body','head','heave','nearArm','nearElbow','farArm','farElbow',
  'nearThigh','nearKnee','farThigh','farKnee','tailRoot','tailMid','tailTip'];
const rest:HighOrbitPose={body:49,head:0,heave:0,nearArm:60,nearElbow:50,farArm:70,farElbow:48,
  nearThigh:18,nearKnee:-32,farThigh:12,farKnee:-26,tailRoot:0,tailMid:0,tailTip:0};
export function createHighOrbitMotion(id:HighOrbitId='cinderforge'):HighOrbitMotion {
  return {id,time:0,phase:0,velocity:0,previousVy:0,initialized:false,pulse:0,recoil:0,power:.12,
    ...(isPremiumSuit(id)?{frames:{age:0,active:false,queued:false}}:{maneuver:createManeuverMotion(false)}),
    pose:{...rest},rates:Object.fromEntries(keys.map(k=>[k,0])) as HighOrbitPose};
}
/** The remastered trio uses the standard painted-bank controller. Retain
 * only its cosmetic wake clock/power; no sixteen-frame playback can start. */
export function createPremiumWake(id:PremiumSuitId):HighOrbitMotion {
  const state=createHighOrbitMotion(id);delete state.frames;return state;
}
export function stepPremiumWake(s:HighOrbitMotion,id:PremiumSuitId,dt:number,vy:number,ready=false){
  if(s.id!==id){delete s.maneuver;Object.assign(s,createPremiumWake(id));}
  delete s.frames;
  stepHighOrbit(s,id,dt,vy,ready);
}
/** An accepted tap accents even a short refresh below the velocity detector's
 * threshold. No pose/rate reset and no change to the approved wake power. */
export function highOrbitTap(s:HighOrbitMotion,acceptedImpulse=450,repeat:PremiumRepeat='finish') {
  if(!Number.isFinite(acceptedImpulse)||acceptedImpulse<=0)return;
  s.recoil=Math.max(s.recoil,.5+.5*(1-Math.exp(-acceptedImpulse/360)));
  // High Orbit's smaller, retargeted limbs need a full readable accent even
  // when a fast repeat tap refreshes only a few pixels/second of velocity.
  if(s.maneuver)maneuverTap(s.maneuver,Math.max(450,acceptedImpulse));
  if(isPremiumSuit(s.id)&&s.frames){
    const f=s.frames;
    if(!f.active){f.age=0;f.active=true;delete f.dir;}
    // The explicit accepted-tap hook and its same-instant velocity
    // observation count as only one request (age is still zero).
    else if(f.age>1e-8){
      // Owner, 12 Sep 2026 (Patriot): "it's finishing its cycle before it
      // starts animation. it's not a restart on tap. that's the issue." The
      // repeat rule is the caller's (sim.ts repeatTapMode); finish is the
      // stock answer for callers that pass nothing.
      if(repeat==='restart'){f.age=0;f.queued=false;delete f.dir;}
      else if(repeat==='rewind'){f.dir=-1;f.queued=false;}
      else f.queued=true;
    }
  }
}
function follow(s:HighOrbitMotion,key:keyof HighOrbitPose,target:number,dt:number,frequency:number,damping:number) {
  const omega=frequency*2*Math.PI,acceleration=(target-s.pose[key])*omega*omega-2*damping*omega*s.rates[key];
  s.rates[key]+=acceleration*dt;
  s.pose[key]+=s.rates[key]*dt;
}
export function stepHighOrbit(s:HighOrbitMotion,id:HighOrbitId,dt:number,vy:number,ready=false) {
  if(!Number.isFinite(dt)||!Number.isFinite(vy)||dt<=0)return;
  if(s.id!==id)Object.assign(s,createHighOrbitMotion(id));
  dt=Math.min(dt,.1);
  const impulse=s.initialized&&!ready?Math.max(0,s.previousVy-vy):0;
  // Velocity changes are observed only after the authority has consumed input.
  // Small gravity fluctuations cannot create a tap accent.
  if(impulse>70){s.pulse=Math.min(1,s.pulse+.3+impulse/700);highOrbitTap(s,impulse);}
  const start=s.initialized&&impulse<=70?s.previousVy:vy;
  s.previousVy=vy;s.initialized=true;
  const profile=HIGH_ORBIT_PROFILES[id];
  for(let left=dt;left>1e-8;){
    const h=Math.min(left,1/120);left-=h;
    const current=ready?0:start+(vy-start)*(dt-left)/dt;
    s.velocity+=(current-s.velocity)*(1-Math.exp(-h/.045));
    s.time+=h;s.phase+=h*2*Math.PI/profile.period;
    if(isPremiumSuit(id)&&s.frames?.active&&!ready){
      const f=s.frames;f.age+=h*(f.dir??1);
      // a rewinding playback bounces off frame one and runs forward again
      if(f.age<=0&&f.dir){f.age=0;delete f.dir;}
      if(f.age>=PREMIUM_FLIGHT_DURATION-1e-10){
        if(f.queued){f.age=Math.max(0,f.age-PREMIUM_FLIGHT_DURATION);f.queued=false;}
        else{f.age=PREMIUM_FLIGHT_DURATION;f.active=false;}
      }
    }
    s.pulse*=Math.exp(-h/.24);
    s.recoil*=Math.exp(-h/.24);
    const lift=ready?0:smooth(-s.velocity/370),fall=ready?0:smooth(s.velocity/610);
    const power=ready?.12:.14+.65*lift+.18*s.pulse;
    s.power+=(power-s.power)*(1-Math.exp(-h/.07));
    if(isPremiumSuit(id))continue;
    const maneuver=s.maneuver??(s.maneuver=createManeuverMotion(false));
    stepManeuver(maneuver,h,current,false,false);
    const p=maneuver.pose,energy=ready?.32:1;
    // Retarget deltas from AcorNut's neutral Flight pose. High Orbit keeps
    // its own rest angles, short bones, head registration and flight pitch.
    const target:HighOrbitPose={
      body:49-17*lift+11*fall+energy*(p.body-29)*.2,
      head:-10*lift+8*fall+energy*((p.head+3)*.15-s.recoil*3),
      heave:energy*p.heave*.3,
      nearArm:60+energy*(p.nearArm-9)*.7,
      nearElbow:50+energy*(p.nearElbow-55)*.55,
      farArm:70+energy*(p.farArm-67)*.7,
      farElbow:48+energy*(p.farElbow-25)*.55,
      nearThigh:18+energy*(p.nearThigh-10)*.45,
      nearKnee:-32+energy*(p.nearKnee+47)*.35,
      farThigh:12+energy*(p.farThigh+8)*.4,
      farKnee:-26+energy*(p.farKnee+10)*.3,
      // Travel and accepted input drive the root; passive lag drives the tip.
      tailRoot:profile.whip*(-20*lift+10*fall-s.recoil*24),
      tailMid:0,tailTip:0,
    };
    for(const key of keys.slice(0,11))follow(s,key,target[key],h,(key==='head'?4.2:key==='body'?3.5:3.1)/profile.inertia,.86);
    follow(s,'tailRoot',target.tailRoot,h,3.4/profile.inertia,.72);
    // Cascaded sections retain momentum after the torso reverses.
    follow(s,'tailMid',s.pose.tailRoot,h,2.2/profile.inertia,.76);
    follow(s,'tailTip',s.pose.tailMid,h,1.85/profile.inertia,.8);
  }
}
const previews=new WeakMap<object,Map<HighOrbitId,{state:HighOrbitMotion,time:number}>>();
const wakePreviews=new WeakMap<object,Map<PremiumSuitId,{state:HighOrbitMotion,time:number}>>();
/** The shelf's standard preview supplies velocity; the wake never chooses art. */
export function premiumWakePreview(owner:object,id:PremiumSuitId,time:number,vy:number):HighOrbitMotion {
  let map=wakePreviews.get(owner);if(!map){map=new Map();wakePreviews.set(owner,map);}
  let p=map.get(id);
  if(!p||time<p.time){p={state:createPremiumWake(id),time:time-1/60};map.set(id,p);}
  stepPremiumWake(p.state,id,clamp(time-p.time,0,.1),vy);p.time=time;return p.state;
}
/** The same controller and a short physical gravity arc drive each shelf card. */
export function highOrbitPreview(owner:object,id:HighOrbitId,time:number):HighOrbitMotion {
  let map=previews.get(owner);if(!map){map=new Map();previews.set(owner,map);}
  let p=map.get(id);
  if(!p||time<p.time){p={state:createHighOrbitMotion(id),time:time-.016};if(isPremiumSuit(id))highOrbitTap(p.state);map.set(id,p);}
  const elapsed=clamp(time-p.time,0,.1);
  for(let left=elapsed;left>1e-8;){
    const dt=Math.min(left,1/60);left-=dt;p.time+=dt;
    const local=((p.time%4.8)+4.8)%4.8;
    const tapAge=local<1.44?local%.36:local-1.08;
    const vy=local>3.85?610:Math.min(590,-400+1100*tapAge);
    stepHighOrbit(p.state,id,dt,vy);
  }
  p.time=time;return p.state;
}
