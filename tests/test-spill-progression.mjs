#!/usr/bin/env node
// Player-facing survival, build, contract and save guarantees. Run after export-sandbox.
import assert from 'node:assert/strict';
const memory = new Map();
globalThis.window = { location: { href: 'http://local/' }, devicePixelRatio: 1, addEventListener() {}, matchMedia: () => ({ matches:false, addEventListener() {} }) };
globalThis.document = { createElement: () => ({ getContext: () => null, style: {} }), addEventListener() {}, documentElement: { style: {} } };
globalThis.localStorage = { getItem: k => memory.get(k) ?? null, setItem: (k,v) => memory.set(k,v), removeItem: k => memory.delete(k) };
const S = await import('../dist/js/spill.js');
const C = await import('../dist/js/spill-content.js');
const Save = await import('../dist/js/save.js');
const Sim = await import('../dist/js/sim.js');
const Camp = await import('../dist/js/campaign.js');
const P = await import('../dist/js/spill-presentation.js');
const dt=1/60;
function flight(wave=1,W=390,H=760) { const s=S.createSpill(W,H,71); s.phase='wave';s.wave=wave;s.spec=S.spillWaveSpec(wave,s.seed);s.event=C.spillEventFor(wave,s.seed);s.liveMods=s.spec.mods.slice();s.nextRock=s.nextNut=s.nextSpecial=1000; return s; }
function dock(wave=5) {const s=flight(wave);s.phase='depot';s.cleared=wave;s.depot={arm:0,bought:[]};s.depotVisits=wave/5;s.ore=2000;return s;}
function step(s,seconds,each=()=>{}) {for(let i=0;i<Math.ceil(seconds/dt);i++){each(s);S.stepSpill(s,dt);}}
function hover(s){s.pilot.y=s.H*.45;s.pilot.vy=0;s.rocks=[];}
function rock(s,x=s.pilot.x,y=s.pilot.y,kind='tumbler',r=20){return {x,y,vx:0,vy:0,r,kind,sprite:0,spin:0,rot:0,arc:0,arcPhase:0,warn:0,grazed:true,dead:false};}
function impact(s){s.iframes=0;s.rocks=[rock(s)];return S.stepSpill(s,dt);}

function clear(s,wave){s.wave=wave;s.phase='drain';s.rocks=[];S.stepSpill(s,dt);}
function pickup(s,kind='gold',y=s.pilot.y){s.nuts=[{x:s.pilot.x,y,vx:0,vy:0,got:false,bob:0,kind}];S.stepSpill(s,dt);}
// The station always covers the screen and keeps its final camera through the Depot handoff.
for(const [W,H] of [[320,760],[390,844],[1280,720],[844,390]]){
 let previous=0;
 for(let t=0;t<=S.SPILL.dockTime+.1;t+=.05){
  const v=P.spillDockView(W,H,1536,1024,t);
  assert(v.x<=0&&v.y<=0&&v.x+v.width>=W-.001&&v.y+v.height>=H-.001,'no rectangular scene edges');
  assert(v.width>=previous,'arrival moves into the bay');previous=v.width;
 }
 assert.deepEqual(P.spillDockView(W,H,1536,1024,S.SPILL.dockTime),P.spillDockView(W,H,1536,1024,S.SPILL.dockTime+1));
 const s=flight(5,W,H);s.hull=1;clear(s,5);step(s,3);assert.equal(s.phase,'docking','arrival leaves time to read the scene');
 assert.equal(S.spillBuy(s,'shield'),'closed');step(s,S.SPILL.dockTime-3+.1);assert.equal(s.phase,'depot');assert.equal(s.hull,2);
 step(s,1);assert.equal(s.hull,2,'the extended arrival heals only once');assert(Math.abs(s.pilot.x-W*.55)<3&&Math.abs(s.pilot.y-H*.6)<3);
}
// A planned build quotes the real cumulative purchases, with one earned starter free.
{
 const s=dock(),before=s.ore;
 for(const part of ['plating','thrusters','pulse'])for(let n=0;n<3;n++)assert.equal(S.spillBuy(s,part),'ok');
 S.spillBuy(s,'shield');S.spillBuy(s,'shield');S.spillUtility(s,'magnet');S.spillUtility(s,'scanner');S.spillSpecialize(s,'brace');
 const build=P.spillBuildFromState(s);assert.equal(P.spillBuildOre(build),before-s.ore);assert.equal(P.spillBuildOre(build,'magnet'),before-s.ore-C.SPILL_UTILITIES.magnet.price);
 const preview=P.spillPreviewState(build);assert.deepEqual(preview.up,s.up);assert.deepEqual(preview.utilities,s.utilities);assert.deepEqual(preview.specialties,s.specialties);
 build.utilities.pop();assert.equal(s.utilities.length,2,'preview build does not alias the live ship');
}
// Existing shield, pulse and extra-life protections still apply to damaging debris.
{
 const s=flight();s.up.plating=3;s.maxHull=s.hull=6;s.shield=s.canopyLevel=2;s.up.pulse=2;s.charge=1;
 impact(s);assert.equal(s.hull,6);assert.equal(s.shield,2);assert.equal(s.charge,0);assert(s.pulseQueue>0);
 impact(s);assert.equal(s.shield,1);assert.equal(s.hull,6);
 impact(s);assert.equal(s.shield,0);assert.equal(s.hull,6);
 impact(s);assert.equal(s.hull,5);assert.equal(s.hits,1);assert.equal(s.phase,'wave');
 s.gold=3;impact(s);assert.equal(s.hull,5);
 s.gold=0;s.hull=1;s.coreBought=s.coreArmed=true;impact(s);assert.equal(s.phase,'respawn');
 step(s,2.1);assert.equal(s.hull,6);assert(s.gold>0);
}
{
 const s=flight();s.shield=s.canopyLevel=2;s.rocks=[rock(s,s.pilot.x-30),rock(s,s.pilot.x+30)];
 assert(S.spillPathClear({...s,rocks:[s.rocks[0]]},s.rocks[1]));S.stepSpill(s,dt);
 assert.equal(s.shield,1,'two legal simultaneous rocks cost only one shield');assert.equal(s.hull,3);assert(s.iframes>0);
}
// Two slots, run ownership, free refits, and real utility behavior.
{
 const s=dock();assert.equal(S.spillUtility(s,'magnet'),'ok');assert.equal(S.spillUtility(s,'scanner'),'ok');const ore=s.ore;
 assert.equal(S.spillUtility(s,'brake'),'full');assert.equal(s.ore,ore);
 S.spillUtility(s,'magnet');assert.equal(S.spillUtility(s,'magnet'),'ok');assert.equal(s.ore,ore);
 S.spillUtility(s,'scanner');s.ore=0;assert.equal(S.spillUtility(s,'brake'),'poor');assert(!s.ownedUtilities.includes('brake'));
 const stock=flight(),mag=flight();mag.utilities=['magnet'];stock.nuts=[{x:stock.pilot.x+70,y:stock.pilot.y,vx:-30,vy:0,got:false,bob:0,kind:'ore'}];mag.nuts=structuredClone(stock.nuts);
 step(stock,.3,x=>{x.pilot.y=x.H*.45;x.pilot.vy=0;});step(mag,.3,x=>{x.pilot.y=x.H*.45;x.pilot.vy=0;});assert.equal(stock.oreMined,0);assert.equal(mag.oreMined,1);
 const brake=flight(),coast=flight();brake.utilities=['brake'];brake.pilot.vy=coast.pilot.vy=300;S.stepSpill(brake,dt);S.stepSpill(coast,dt);assert.equal(brake.hull,3);assert(brake.pilot.vy>=0&&brake.pilot.vy<coast.pilot.vy,'Brake stops neutral drift faster without an upward kick');
 const cap=flight();cap.up.pulse=1;cap.utilities=['capacitor'];for(let i=0;i<4;i++){hover(cap);pickup(cap);}assert.equal(cap.charge,2);impact(cap);assert.equal(cap.charge,1);impact(cap);assert.equal(cap.charge,0);assert.equal(cap.hull,3);
}
// Replacing a fitted utility is atomic: no charge or gear is lost on failure.
{
 const s=dock();s.up.pulse=1;S.spillUtility(s,'capacitor');S.spillUtility(s,'magnet');s.charge=2;s.ore=0;
 const before=JSON.stringify(s);assert.equal(S.spillUtility(s,'brake','capacitor'),'poor');assert.equal(JSON.stringify(s),before);
 assert.equal(S.spillUtility(s,'brake','scanner'),'closed');assert.equal(JSON.stringify(s),before);
 s.ore=100;assert.equal(S.spillUtility(s,'brake','capacitor'),'ok');assert.deepEqual(s.utilities,['brake','magnet']);assert.equal(s.charge,1);assert.equal(s.ore,65);
 assert(s.ownedUtilities.includes('capacitor'));assert.equal(S.spillUtility(s,'capacitor','brake'),'ok');assert.equal(s.ore,65);assert.deepEqual(s.utilities,['capacitor','magnet']);
}
// Old on/off engine saves migrate, and an explicit color survives new milestones.
{
 for(const [best,on,expected] of [[0,true,'stock'],[5,true,'copper'],[10,true,'cobalt'],[20,true,'corelight'],[30,true,'void'],[30,false,'stock']]){
  const save=Save.defaultSave();save.spillBest=best;save.spillSignal=on;Save.writeSave(save);assert.equal(Save.loadSave().spillEngineColor,expected);
 }
 const save=Save.defaultSave();save.spillBest=30;save.spillEngineColor='copper';save.spillSignal=true;save.spillDepotGuideSeen=true;
 Save.writeSave(save);const loaded=Save.loadSave();assert.equal(loaded.spillEngineColor,'copper');assert(loaded.spillDepotGuideSeen);
 const w=Sim.makeWorld(390,760);Sim.resetRun(w,loaded,'spill',false);assert.equal(w.spill.signal,C.SPILL_ENGINE_COLORS[1].color);
 save.spillBest=4;save.spillEngineColor='void';Save.writeSave(save);assert.equal(Save.loadSave().spillEngineColor,'stock');
}
{
 const s=dock();assert(!S.spillSpecialize(s,'brace'));S.spillBuy(s,'plating');S.spillBuy(s,'plating');assert(S.spillSpecialize(s,'brace'));
 const ore=s.ore;assert(S.spillSpecialize(s,'salvage'));assert.equal(s.ore,ore);s.phase='wave';s.hull=2;s.repairOre=29;pickup(s,'ore');assert.equal(s.hull,3);
 s.repairsThisWave=2;s.repairOre=29;pickup(s,'ore');assert.equal(s.hull,3,'salvage armor cannot exceed its wave cap');
 const efficient=flight();efficient.specialties.pulse='efficient';pickup(efficient);assert.equal(efficient.charge,.65);
 const jets=flight();jets.up.thrusters=2;jets.specialties.thrusters='precision';jets.pilot.vy=300;S.spillLunge(jets);assert.equal(jets.pilot.vy,75);
 const sweep=flight();sweep.up.thrusters=2;sweep.specialties.thrusters='sweep';sweep.rocks=[rock(sweep,sweep.pilot.x+35,sweep.pilot.y,'shard',12)];S.spillLunge(sweep);S.stepSpill(sweep,dt);assert.equal(sweep.shards,1);
}
// Contracts count earned progress, not purchases/stipends, and settle once.
for(const kind of ['salvage','clean','shards'])for(const wins of [false,true]){
 const s=dock();assert(S.spillTakeContract(s,kind));assert(!S.spillTakeContract(s,kind));const c={...s.contract},ore=s.ore;
 if(kind==='salvage'){s.ore+=c.target;if(wins)s.oreMined+=c.target;}
 if(kind==='clean'&&!wins)s.hits++;
 if(kind==='shards'&&wins)s.shards+=c.target;
 clear(s,10);assert.equal(s.contractsDone,wins?1:0);assert.equal(s.contract,null);
 assert.equal(s.ore,ore+(kind==='salvage'?c.target:0)+S.SPILL.clearOre+(wins?c.reward:0));
 step(s,5);assert.equal(s.contractsDone,wins?1:0);
}
// Isolate the existing debris event admission guarantee. This geometric helper only
// chooses lanes around rocks; it does not react to the new aimed enemy shots. Mixed
// combat admission and warning/reaction guarantees are covered in test-spill-combat.
let eventSweeps=0;
for(const W of [320,390,1280])for(const event of ['cargo','vein','lanes','rig']){
 const s=flight(20,W);s.event=event;s.nextRock=0;s.nextNut=0;s.nextSpecial=1000;s.eventNext=0;
 s.combat.nextEnemy=1000;
 step(s,35,x=>{x.pilot.y=S.spillEscapeY(x);x.pilot.vy=0;x.floorT=0;
   const cap=x.spec.cap+(x.liveMods.includes('swarm')?2:0)+(x.surgeT>0?2:0);assert(x.rocks.length<=cap,'event respects actor budget');});
 assert.equal(s.hits,0,`${event} has a stock escape route at ${W}px`);assert(s.eventPass>=3);eventSweeps+=s.eventPass;
}
{
 const stock=flight(5),scanner=flight(5);scanner.utilities=['scanner'];stock.eventNext=scanner.eventNext=0;S.stepSpill(stock,dt);S.stepSpill(scanner,dt);assert(scanner.eventWarn>stock.eventWarn);
 assert.equal(S.spillWaveSpec(10000).speed,2.05);
}
// Checkpoint preserves the build, contracts and RNG; bank ledger prevents replay payouts.
{
 const s=dock();s.oreMined=83;s.contractsDone=2;S.spillUtility(s,'magnet');S.spillBuy(s,'plating');S.spillTakeContract(s,'salvage');
 const save=Save.defaultSave();const wallet=save.acorns;Save.bankSpill(save,s);const before=structuredClone(save.spillRecords);
 const cp=S.spillCheckpoint(s);const resumed=S.restoreSpill(JSON.parse(JSON.stringify(cp)),1280,720);assert(resumed);
 assert.deepEqual(resumed.up,s.up);assert.deepEqual(resumed.contract,s.contract);assert.deepEqual(resumed.utilities,s.utilities);assert.equal(resumed.rng,s.rng);assert.equal(resumed.ore,s.ore);assert.equal(resumed.W,1280);
 Save.bankSpill(save,resumed);assert.deepEqual(save.spillRecords,before);assert.equal(save.acorns,wallet);
 save.spillSuspended=cp;Save.writeSave(save);assert(Save.loadSave().spillSuspended);
 for(const mutate of [x=>x.version=99,x=>x.state.hull=NaN,x=>x.state.hull=-1,x=>x.state.shield=.5,x=>x.state.wave=6,x=>x.state.utilities=['fake'],x=>x.state.contract.reward=999,x=>x.state.up.plating=99,x=>x.state.banked.ore=9999]){const bad=structuredClone(cp);mutate(bad);assert.equal(S.restoreSpill(bad,390,760),null);}
 s.phase='wave';assert.equal(S.spillCheckpoint(s),null);s.phase='depot';s.target=10;assert.equal(S.spillCheckpoint(s),null);
 const end=flight(20);end.up={plating:2,thrusters:2,pulse:1};end.maxHull=end.hull=5;end.ore=400;end.utilities=['magnet'];end.ownedUtilities=['magnet'];
 clear(end,20);assert.equal(end.phase,'docking');assert.equal(end.cause,'');assert(end.expeditionDone);step(end,S.SPILL.dockTime+S.SPILL.depotArm+.1);
 Save.bankSpill(save,end);const milestone=structuredClone(save.spillRecords);Save.bankSpill(save,end);assert.deepEqual(save.spillRecords,milestone);assert.equal(milestone.expeditions,1);assert.equal(milestone.runs,0,'wave 20 is not an ended run');
 const earned=end.ore;assert(S.spillLeaveDepot(end));assert.equal(end.wave,21);assert.equal(end.phase,'countdown');assert.deepEqual(end.up,{plating:2,thrusters:2,pulse:1});assert.deepEqual(end.utilities,['magnet']);assert.equal(end.ore,earned);
 clear(end,25);step(end,S.SPILL.dockTime+S.SPILL.depotArm+.1);assert.equal(end.phase,'depot');assert(S.spillLeaveDepot(end));assert.equal(end.wave,26);assert.equal(end.cause,'');
 Save.bankSpill(save,end,true);const final=structuredClone(save.spillRecords);Save.bankSpill(save,end,true);assert.deepEqual(save.spillRecords,final);assert.equal(final.expeditions,1);assert.equal(final.runs,1);
 const legacy=structuredClone(cp);delete legacy.state.firstPass;delete legacy.state.steerY;delete legacy.state.lungeDir;legacy.state.finished=false;assert(S.restoreSpill(legacy,390,760),'existing Depot saves remain resumable');
}
{
 const save=Save.defaultSave();assert.equal(save.spillSuspended,null);assert.equal(C.spillMastery(5).current.title,'Salvager');assert.equal(C.spillMastery(20).current.title,'Fieldbreaker');
 const w=Sim.makeWorld(390,760);save.spillBest=5;save.spillStarter='magnet';Sim.resetRun(w,save,'spill',false);assert.deepEqual(w.spill.utilities,['magnet']);
 save.spillStarter='capacitor';Sim.resetRun(w,save,'spill',false);assert.deepEqual(w.spill.utilities,[]);
 save.spillStarter='magnet';Sim.resetRun(w,save,'spill',false,Camp.levelById('4-8'));assert.deepEqual(w.spill.utilities,[],'missions start with a standard ship');
 const finalMission=Camp.levelById('10-8');assert(finalMission.gates>=1,'the zone-10 Spill mission names a wave');
 Sim.resetRun(w,save,'spill',false,finalMission);w.ready=false;w.spill.wave=finalMission.gates;w.spill.phase='drain';w.spill.rocks=[];const result=Sim.updateWorld(w,save,dt);assert.equal(result,'finish');assert.equal(w.screen,'lvldone');assert(w.lastLevel.finished);assert(save.stars['10-8']&1,'clearing the named wave still earns the Star Map victory');
 assert.equal(Camp.LEVELS.filter(l=>l.base==='spill').length,26,'the live road: a Spill mission in every zone');assert.equal(Camp.LEVELS.filter(l=>l.base==='tunnel').length,0);
}
console.log(`spill progression: protection, utilities, contracts, ${eventSweeps} event sweeps, checkpoint banking, endless continuation, mastery and Star Map victories pass`);
