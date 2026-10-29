#!/usr/bin/env node
// Executes the production canvas painter for all 192 equipment combinations.
import {createRequire} from 'node:module';import {fileURLToPath} from 'node:url';import {dirname,resolve,join} from 'node:path';import {tmpdir} from 'node:os';import {mkdirSync} from 'node:fs';import assert from 'node:assert/strict';import {readFileSync,writeFileSync} from 'node:fs';
const require=createRequire(import.meta.url);const {createCanvas,loadImage,Image}=require(process.env.ACORNAUT_CANVAS || '@napi-rs/canvas');
globalThis.Image=Image;globalThis.HTMLImageElement=Image;globalThis.window={location:{href:'http://local/'},devicePixelRatio:1,addEventListener(){},matchMedia:()=>({matches:false,addEventListener(){}})};globalThis.document={createElement:()=>createCanvas(1,1),addEventListener(){},documentElement:{style:{}}};globalThis.localStorage={getItem:()=>null,setItem(){},removeItem(){}};
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');const output=process.env.ACORNAUT_QA_OUTPUT || join(root,'tests','.artifacts','spill-render');mkdirSync(output,{recursive:true});const Art=await import(new URL('../dist/js/art.js',import.meta.url).href);const Draw=await import(new URL('../dist/js/draw.js',import.meta.url).href);const Save=await import(new URL('../dist/js/save.js',import.meta.url).href);const Sim=await import(new URL('../dist/js/sim.js',import.meta.url).href);const S=await import(new URL('../dist/js/spill.js',import.meta.url).href);
async function sprite(path){const img=await loadImage(`${root}/dist/art/${path}${/\.(svg|webp)$/.test(path) ? "" : ".png"}`);const c=createCanvas(img.width,img.height),g=c.getContext('2d');g.drawImage(img,0,0);const d=g.getImageData(0,0,img.width,img.height).data;let x=img.width,y=img.height,r=0,b=0;for(let j=0;j<img.height;j++)for(let i=0;i<img.width;i++)if(d[(j*img.width+i)*4+3]>12){x=Math.min(x,i);y=Math.min(y,j);r=Math.max(r,i);b=Math.max(b,j);}img.box={x,y,w:r-x+1,h:b-y+1};img.core=Math.max(img.box.w,img.box.h);img.coreX=x+img.box.w/2;img.coreY=y+img.box.h/2;return img;}
const bank=Art.emptyArt();bank.ready=true;for(const id of Art.SPILL_SHIP_IDS)bank.spillShip[id]=await sprite(`spill-ship/${id}`);for(const id of ['magnet','scanner','brake','capacitor'])bank.spillShip[id]=await sprite(`spill-ship/utilities/${id}.webp`);bank.spillShipFit=JSON.parse(readFileSync(`${root}/dist/art/spill-ship/transforms.json`));bank.suits.flight=await sprite('suits/flight');bank.helms.clear=await sprite('helms/clear');bank.squirrelIdle=[await sprite('squirrel/idle-1')];bank.ore=await sprite('pickups/acorn-coin.svg');bank.golden=[await sprite('golden/1')];bank.spillScene={depot:await loadImage(`${root}/dist/art/spill-scene/depot.png`),panorama:await loadImage(`${root}/dist/art/spill-scene/panorama.png`)};for(let i=0;i<27;i++)bank.debris.push(await sprite(`debris/${i}`));
const save=Save.defaultSave();save.tutorialDone=true;save.guide='done';
const {prepareDepotBear}=await import(new URL('../dist/js/spill-depot-bear.js',import.meta.url).href);
bank.spillScene.bear=prepareDepotBear(await loadImage(`${root}/dist/art/spill-scene/depot-bear.jpg`));assert.equal(bank.spillScene.bear.length,36);
const marshals=createCanvas(6*256,6*240),mg=marshals.getContext('2d');mg.fillStyle='#121929';mg.fillRect(0,0,marshals.width,marshals.height);
for(const [i,f] of bank.spillScene.bear.entries()){
 const data=f.image.getContext('2d').getImageData(0,0,f.image.width,f.image.height).data;
 assert.equal(data[3],0,'sheet corner is transparent');assert(f.footY>f.image.height*.8&&f.footY<f.image.height,'feet stay in the frame');
 mg.drawImage(f.image,(i%6)*256+128-f.footX,Math.floor(i/6)*240+225-f.footY);
}
writeFileSync(join(output,'spill-bear-qa.png'),marshals.toBuffer('image/png'));
const sheet=createCanvas(1200,4*170),g=sheet.getContext('2d');g.fillStyle='#090e21';g.fillRect(0,0,1200,680);let errors=[];let count=0;
for(let p=0;p<4;p++)for(let t=0;t<4;t++)for(let u=0;u<4;u++)for(let c=0;c<3;c++){const cv=createCanvas(256,130);try{Draw.paintShipPreview(cv.getContext('2d'),bank,save,120,65,2.8,0,{plating:p,thrusters:t,pulse:u,shield:c});count++;}catch(e){errors.push(String(e));}}
for(let p=0;p<4;p++)for(let c=0;c<3;c++){const x=c*400+200,y=p*170+100;Draw.paintShipPreview(g,bank,save,x,y,4,0,{plating:p,thrusters:p,pulse:p,shield:c,utilities:c===0?[]:c===1?['magnet','scanner']:['brake','capacitor'],specialties:p>=2?{plating:'brace',thrusters:'precision',pulse:'efficient'}:{}});g.fillStyle='#fff';g.font='16px sans-serif';g.fillText(`Health tier ${p} · shields ${c}`,x-75,y-70);}
writeFileSync(join(output,'spill-ships-qa.png'),sheet.toBuffer('image/png'));
for(const width of [320,390,1280]){const canvas=createCanvas(width,760),ctx=canvas.getContext('2d'),world=Sim.makeWorld(width,760);Sim.resetRun(world,save,'spill',false);const s=world.spill;s.phase='wave';world.ready=false;s.up={plating:3,thrusters:3,pulse:3};s.hull=s.maxHull=6;s.shield=s.canopyLevel=2;s.utilities=['magnet','scanner'];s.ownedUtilities=s.utilities.slice();s.wave=20;s.phaseT=5;s.waveT=5;s.event='rig';s.eventWarn=1.6;s.eventSafeY=430;s.charge=2;s.echoReady=true;s.contract={kind:'clean',startWave:16,endWave:20,target:0,reward:50,startOre:0,startHits:0,startShards:0};s.banner='RIG BREAKUP · SWEEP 2';s.bannerT=1;Draw.drawWorld(ctx,world,save,bank);Draw.drawHud(ctx,world,bank);writeFileSync(join(output,`spill-flight-${width}.png`),canvas.toBuffer('image/png'));}
const arrival=createCanvas(5*390,760),arrivalCtx=arrival.getContext('2d');
for(const [index,time] of [0,.8,2.4,3.8,4.8].entries()){
 const canvas=createCanvas(390,760),ctx=canvas.getContext('2d'),world=Sim.makeWorld(390,760);Sim.resetRun(world,save,'spill',false);
 const s=world.spill;s.wave=s.cleared=5;s.phase='docking';s.hints=false;s.hintT=0;world.ready=false;
 for(let t=0;t<time;t+=1/60)S.stepSpill(s,Math.min(1/60,time-t));
 world.time=time;world.squirrel.y=s.pilot.y;Draw.drawWorld(ctx,world,save,bank);Draw.drawHud(ctx,world,bank);
 arrivalCtx.drawImage(canvas,index*390,0);arrivalCtx.fillStyle='#fff';arrivalCtx.font='16px sans-serif';arrivalCtx.fillText(`${time}s`,index*390+14,740);
}
writeFileSync(join(output,'spill-arrival-qa.png'),arrival.toBuffer('image/png'));
assert.equal(count,192);assert.deepEqual(errors,[]);console.log(JSON.stringify({configurations:count,arrivalFrames:5,bearFrames:36,errors,output}));
