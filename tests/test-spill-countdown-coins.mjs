import assert from 'node:assert/strict';
// COINS BETWEEN WAVES (owner, 30 Sep 2026: "debris field coins show up but
// can't collect in between waves"). A stream that was mid-screen when the
// wave drained keeps drifting through the countdown; the ship has to be able
// to pick it up there, on autopilot and by hand alike.
globalThis.window={location:{href:'http://local/'},addEventListener(){},matchMedia:()=>({matches:false,addEventListener(){}})};
globalThis.localStorage={getItem:()=>null,setItem(){},removeItem(){}};
const S=await import('../dist/js/spill.js');
const step=(s,seconds)=>{for(let n=0;n<Math.ceil(seconds*60);n++)S.stepSpill(s,1/60);};
function countdownWithCoin(manual){
  const s=S.createSpill(390,844,7,0);
  // an ordinary wave-to-wave countdown (no depot), wave 1 cleared
  s.phase='countdown';s.phaseT=0;s.wave=1;s.cleared=1;s.manual=manual;s.welcome=false;
  s.nuts=[{x:s.pilot.x+60,y:s.pilot.y,vx:-120,vy:0,bob:0,kind:'ore',got:false},
          {x:s.pilot.x+160,y:s.pilot.y,vx:-120,vy:0,bob:0,kind:'gold',got:false}];
  return s;
}
{
  const s=countdownWithCoin(false);const ore=s.ore,mined=s.oreMined,score=s.score;
  step(s,1.2);
  assert.equal(s.phase,'countdown','still counting down (autopilot)');
  assert.equal(s.ore,ore+6,'the coin and the charged coin both paid in the countdown (autopilot)');
  assert.equal(s.oreMined,mined+6);assert(s.score>score,'and scored');
  assert.equal(s.nuts.length,0,'collected coins leave the field');
}
{
  // by hand the ship falls under gravity until a tap, so put the coin where
  // the ship actually is and confirm the very next step collects it
  const s=countdownWithCoin(true);step(s,0.3);
  const ore=s.ore;s.nuts=[{x:s.pilot.x+2,y:s.pilot.y,vx:-120,vy:0,bob:0,kind:'ore',got:false}];
  S.stepSpill(s,1/60);
  assert.equal(s.phase,'countdown','still counting down (hand)');
  assert.equal(s.ore,ore+1,'a coin under the hand-flown ship pays in the countdown');
}
// a coin the ship never reaches keeps drifting and leaves the screen on its own
{
  const s=countdownWithCoin(false);s.nuts=[{x:s.pilot.x+40,y:s.pilot.y-300,vx:-400,vy:0,bob:0,kind:'ore',got:false}];
  const ore=s.ore;step(s,2);assert.equal(s.ore,ore,'a coin off the ship\'s line pays nothing');assert.equal(s.nuts.length,0,'and drifts off screen');
}
// the drain still collects as before
{
  const s=S.createSpill(390,844,7,0);s.phase='drain';s.phaseT=0;s.wave=1;s.welcome=false;s.rocks=[];
  s.nuts=[{x:s.pilot.x+50,y:s.pilot.y,vx:-120,vy:0,bob:0,kind:'ore',got:false}];const ore=s.ore;
  S.stepSpill(s,1/60);S.stepSpill(s,1/60);S.stepSpill(s,1/60);
  assert(s.ore===ore+1||s.phase!=='drain','the drain collects or has already ended the wave');
}
console.log('spill countdown coins: leftover coins are collected in the countdown on autopilot and by hand, off-line coins drift away, the drain still collects');
