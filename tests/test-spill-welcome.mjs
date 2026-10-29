import assert from 'node:assert/strict';
globalThis.window={location:{href:'http://local/'},addEventListener(){},matchMedia:()=>({matches:false,addEventListener(){}})};
globalThis.localStorage={getItem:()=>null,setItem(){},removeItem(){}};
const S=await import('../dist/js/spill.js');
const Save=await import('../dist/js/save.js');
const step=(s,seconds)=>{for(let n=0;n<Math.ceil(seconds*60);n++)S.stepSpill(s,1/60);};
for(const target of [0,1,20]) for(const choice of ['plating','shield','thrusters','pulse']) {
 const s=S.createSpill(390,844,123,target); assert(S.spillTap(s));
 assert.equal(s.phase,'docking');assert.equal(s.wave,0);assert(!S.spillLeaveDepot(s));
 step(s,S.spillDockDuration(s)+.1);assert.equal(s.phase,'depot');assert.equal(s.depotVisits,0);
 assert.equal(S.spillBuy(s,choice),'arming');step(s,1);
 assert(!S.spillLeaveDepot(s));assert.equal(S.spillPrice(s,choice),0);
 if(!target){const restored=S.restoreSpill(S.spillCheckpoint(s),390,844);assert(restored?.freeUpgrade);assert.equal(restored.wave,0);}
 assert.equal(S.spillUtility(s,'magnet'),'closed');assert(!S.spillTakeContract(s,'clean'));
 assert.equal(S.spillBuy(s,'core'),'closed');assert.equal(S.spillBuy(s,choice),'ok');assert.equal(s.ore,0);
 assert.equal(s.freeUpgrade,false);assert.equal(S.spillBuy(s,'shield'),'closed');
 if(!target){const restored=S.restoreSpill(S.spillCheckpoint(s),390,844);assert(restored);assert(!restored.freeUpgrade);step(restored,1);assert.equal(S.spillBuy(restored,'plating'),'closed');assert(S.spillLeaveDepot(restored));assert.equal(restored.wave,1);}
 const save=Save.defaultSave();Save.bankSpill(save,s);assert.equal(save.spillBest,0);assert.equal(save.spillRecords.waves,0);
 assert(S.spillLeaveDepot(s));assert.equal(s.phase,'countdown');assert.equal(s.wave,1);assert(!s.welcome);
 step(s,3.1);assert.equal(s.phase,'wave');assert.equal(s.depotVisits,0);
 // Later visits charge normally, with no free-token regeneration.
 s.phase='depot';s.wave=s.cleared=5;s.depot={arm:0,bought:[]};s.ore=500;
 const cost=S.spillPrice(s,'plating');assert(cost>0);assert.equal(S.spillBuy(s,'plating'),'ok');assert.equal(s.ore,500-cost);
}
console.log('welcome: all four choices, mission/endless entry, arming, one free choice, checkpoints before/after purchase, no early objective credit and paid later Depots passed');
