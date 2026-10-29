import type { ArtBank } from './art';
import { ARCFLASH_PARTS } from './arcflash-parts';
import { arcflashTailAngles, createArcflashMotion } from './arcflash-motion';
import type { ArcflashMotion, ArcflashPose } from './arcflash-motion';
import {rigLimbFit,rigPartMatrix} from './rig-limb-fit';

type Point = readonly [number, number];
const DEG = Math.PI / 180;
const clamp = (n:number,a:number,b:number) => Math.max(a,Math.min(b,n));
const mix = (a:number,b:number,t:number) => a+(b-a)*t;
const NECK:Point=[0,-82], HIP:Point=[0,58];
const NS:Point=[-48,-36], FS:Point=[35,-65], NH:Point=[-42,47], FH:Point=[20,20], TAIL:Point=[-52,54];
const REGISTRATION:Point=[65,25];
export const ARCFLASH_ANATOMY = Object.freeze({nearArm:55,farArm:50,nearForearm:54,farForearm:50,
  nearThigh:69,farThigh:64,nearShin:63,farShin:59,head:120,torso:140,displaySpan:540});
const along=(p:Point,length:number,angle:number):Point=>[p[0]+Math.sin(angle*DEG)*length,p[1]+Math.cos(angle*DEG)*length];
const rotate=(p:Point,angle:number):Point=>[p[0]*Math.cos(angle*DEG)-p[1]*Math.sin(angle*DEG),p[0]*Math.sin(angle*DEG)+p[1]*Math.cos(angle*DEG)];
const add=(a:Point,b:Point):Point=>[a[0]+b[0],a[1]+b[1]];

/** Fixed-length forward kinematics. The painter and all four emitters share
 * these exact endpoints; no screen-space guessed nozzle positions. */
export function arcflashLandmarks(p:ArcflashPose) {
  const ne=along(NS,55,p.nearArm),fe=along(FS,50,p.farArm);
  const nk=along(NH,69,p.nearThigh),fk=along(FH,64,p.farThigh);
  return {nearShoulder:NS,farShoulder:FS,nearHip:NH,farHip:FH,
    nearElbow:ne,farElbow:fe,nearWrist:along(ne,54,p.nearArm+p.nearElbow),farWrist:along(fe,50,p.farArm+p.farElbow),
    nearKnee:nk,farKnee:fk,nearBoot:along(nk,63,p.nearThigh+p.nearKnee),farBoot:along(fk,59,p.farThigh+p.farKnee)};
}
type Nozzle={point:Point;direction:Point};
export function arcflashNozzles(s:ArcflashMotion,pitch=0):Nozzle[] {
  const p=s.pose,j=arcflashLandmarks(p);
  const world=(q:Point):Point=>rotate(add(rotate(q,p.body),[REGISTRATION[0],REGISTRATION[1]+p.heave]),pitch/DEG);
  const nozzle=(q:Point,angle:number):Nozzle=>({point:world(q),direction:[Math.cos(angle*DEG+pitch),Math.sin(angle*DEG+pitch)]});
  return [nozzle(j.farBoot,p.body+90-p.farThigh-p.farKnee),nozzle(j.nearBoot,p.body+90-p.nearThigh-p.nearKnee),
    // Wrist ports gimbal as elbows fold, keeping the short jets aft/down.
    nozzle(j.farWrist,p.body+90-p.farArm-.15*p.farElbow),nozzle(j.nearWrist,p.body+90-p.nearArm-.15*p.nearElbow)];
}

function part(ctx:CanvasRenderingContext2D,atlas:CanvasImageSource,index:number,a:Point,b:Point) {
  const spec=ARCFLASH_PARTS[index],fit=rigLimbFit('arcflash',index);
  ctx.save();ctx.transform(...rigPartMatrix(spec,a,b,fit.breadth,fit.facing));
  ctx.drawImage(atlas,index%4*256,Math.floor(index/4)*256,256,256,0,0,256,256);ctx.restore();
}

const tailSource:Point[]=[],triangles:number[][]=[];
for(let y=0;y<=4;y++)for(let x=0;x<=4;x++)tailSource.push([x*64,y*64]);
for(let y=0;y<4;y++)for(let x=0;x<4;x++){const i=y*5+x;triangles.push([i,i+1,i+6],[i,i+6,i+5]);}
const cross=(a:Point,b:Point,c:Point)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);

/** Three lagged sections deform one furry painting. A positive-area guard
 * reduces curvature before a wide patch could fold; root motion survives. */
export function arcflashTailMesh(s:ArcflashMotion):Point[] {
  const spec=ARCFLASH_PARTS[10],ax=spec.b[0]-spec.a[0],ay=spec.b[1]-spec.a[1],len=ax*ax+ay*ay;
  const angle=arcflashTailAngles(s);
  // Source-to-rig scale is constant across every pose and tail vertex.
  const scale=225/Math.sqrt(len);
  for(let guard=1;guard>=0;guard-=.25){
    const points=tailSource.map(([x,y]):Point=>{
      const t=clamp(((x-spec.a[0])*ax+(y-spec.a[1])*ay)/len,0,1);
      const u=t<.5?t*2:(t-.5)*2,ease=u*u*(3-2*u);
      const bend=t<.5?mix(angle.root,angle.mid,ease):mix(angle.mid,angle.tip,ease);
      return add(TAIL,rotate([(x-spec.a[0])*scale,(y-spec.a[1])*scale],-54+angle.root+(bend-angle.root)*guard));
    });
    if(triangles.every(([a,b,c])=>cross(points[a],points[b],points[c])>64*64*scale*scale*.25))return points;
  }
  return tailSource.map(([x,y])=>add(TAIL,rotate([(x-spec.a[0])*scale,(y-spec.a[1])*scale],-54+angle.root)));
}
function tail(ctx:CanvasRenderingContext2D,atlas:CanvasImageSource,s:ArcflashMotion) {
  const points=arcflashTailMesh(s);
  for(const [a,b,c] of triangles){
    const [sx,sy]=tailSource[a],[bx,by]=tailSource[b],[cx,cy]=tailSource[c];
    const [x0,y0]=points[a],[x1,y1]=points[b],[x2,y2]=points[c],det=(bx-sx)*(cy-sy)-(cx-sx)*(by-sy);
    const m00=((x1-x0)*(cy-sy)-(x2-x0)*(by-sy))/det,m01=((x2-x0)*(bx-sx)-(x1-x0)*(cx-sx))/det;
    const m10=((y1-y0)*(cy-sy)-(y2-y0)*(by-sy))/det,m11=((y2-y0)*(bx-sx)-(y1-y0)*(cx-sx))/det;
    const center:Point=[(x0+x1+x2)/3,(y0+y1+y2)/3];
    ctx.save();ctx.beginPath();
    for(const [i,v] of [points[a],points[b],points[c]].entries()){
      const dx=v[0]-center[0],dy=v[1]-center[1],length=Math.max(1,Math.hypot(dx,dy));
      const x=v[0]+dx/length*.7,y=v[1]+dy/length*.7;i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
    }
    ctx.closePath();ctx.clip();ctx.transform(m00,m10,m01,m11,x0-m00*sx-m01*sy,y0-m10*sx-m11*sy);
    ctx.drawImage(atlas,512,512,256,256,0,0,256,256);ctx.restore();
  }
}

type Sample={x:number;y:number;dx:number;dy:number;time:number;power:number};
type Wake={time:number;travel:number;root:Point;boots:Sample[][]};
const wakes=new WeakMap<ArcflashMotion,Map<number,Wake>>();
/** Camera-independent world coordinates, expressed in the caller's canvas
 * units. Optional for a shelf preview; live play supplies actual distance. */
export type ArcflashTravel={x:number;y:number;travel:number};
function wake(ctx:CanvasRenderingContext2D,s:ArcflashMotion,size:number,nozzles:Nozzle[],origin:ArcflashTravel) {
  const unit=size/ARCFLASH_ANATOMY.displaySpan;
  let views=wakes.get(s);if(!views){views=new Map();wakes.set(s,views);}
  let history=views.get(size);
  if(!history||s.time<history.time||Math.hypot(origin.x-history.root[0],origin.y-history.root[1])>size*5||Math.abs(origin.travel-history.travel)>size*8){
    history={time:-1,travel:origin.travel,root:[origin.x,origin.y],boots:[[],[]]};
    if(views.size>3)views.clear();views.set(size,history);
  }
  const power=.12+Math.max(s.pressure,s.drive,s.boost)*.88;
  if(s.time>history.time+1/125){
    for(let i=0;i<2;i++){
      const n=nozzles[i];history.boots[i].unshift({x:origin.travel+origin.x+n.point[0]*unit,y:origin.y+n.point[1]*unit,
        dx:n.direction[0],dy:n.direction[1],time:s.time,power});
      history.boots[i]=history.boots[i].filter(p=>s.time-p.time<.48).slice(0,48);
    }
    history.time=s.time;history.travel=origin.travel;history.root=[origin.x,origin.y];
  }
  ctx.save();ctx.globalCompositeOperation='lighter';ctx.lineCap='round';ctx.lineJoin='round';
  for(let boot=0;boot<2;boot++){
    const samples=history.boots[boot];if(samples.length<2)continue;
    for(let strand=0;strand<3;strand++){
      const points=samples.map((p,i):Point=>{
        const age=s.time-p.time,flow=age*size*(1.1+p.power*.9),fade=i/(samples.length-1);
        const noise=(Math.sin(age*53-s.time*12+strand*2.2+boot)+.32*Math.sin(age*127-s.time*8+strand))*size*.048*Math.sin(fade*Math.PI);
        return [p.x-origin.travel-origin.x+p.dx*flow-p.dy*noise,p.y-origin.y+p.dy*flow+p.dx*noise];
      });
      for(let pass=0;pass<2;pass++){
        // Segments fade independently, preserving old stronger pulses as the
        // current jet releases. Noise evolves smoothly; no simulation RNG.
        for(let i=1;i<points.length;i++){
          const fade=Math.pow(1-i/points.length,1.25),p=samples[i];
          ctx.globalAlpha=fade*(.18+p.power*.62)*(pass?.85:.28)*(boot?.95:.65);
          ctx.strokeStyle=pass?(strand===1?'#dcf9ff':'#22b9ff'):'#0879ff';ctx.lineWidth=size*(pass?.008:.045);
          ctx.beginPath();ctx.moveTo(points[i-1][0],points[i-1][1]);ctx.lineTo(points[i][0],points[i][1]);ctx.stroke();
          if(pass&&strand===1&&i%7===3){ctx.fillStyle='#a5e9ff';ctx.beginPath();ctx.arc(points[i][0],points[i][1],size*.012*fade,0,Math.PI*2);ctx.fill();}
          if(pass&&strand===2&&i%9===5){
            // A few off-axis forks and drifting sparks give the wake its
            // electrical character without replacing the retained path.
            const dx=points[i][0]-points[i-1][0],dy=points[i][1]-points[i-1][1],len=Math.max(.001,Math.hypot(dx,dy));
            const spread=Math.sin(p.time*29+boot*2.7)*size*.16*fade*(.35+p.power);
            const ex=points[i][0]-dy/len*spread,ey=points[i][1]+dx/len*spread;
            ctx.lineWidth=size*.005;ctx.strokeStyle='#62d9ff';ctx.beginPath();ctx.moveTo(points[i][0],points[i][1]);
            ctx.lineTo(mix(points[i][0],ex,.54)+dx/len*size*.035,mix(points[i][1],ey,.54)+dy/len*size*.035);
            ctx.lineTo(ex,ey);ctx.stroke();ctx.fillStyle='#b8f1ff';ctx.beginPath();ctx.arc(ex,ey,size*.008*fade,0,Math.PI*2);ctx.fill();
          }
        }
      }
    }
  }
  ctx.restore();
}
function jets(ctx:CanvasRenderingContext2D,s:ArcflashMotion,nozzles:Nozzle[]) {
  const power=.08+Math.max(s.pressure,s.drive,s.boost)*.92;
  ctx.save();ctx.globalCompositeOperation='lighter';
  for(let i=0;i<nozzles.length;i++){
    const n=nozzles[i],wrist=i>=2,length=(wrist?20:34)+(wrist?60:104)*power;
    const width=(wrist?5:7)*(1+power*.35),flicker=.94+.06*Math.sin(s.time*39+i*2.3);
    ctx.save();ctx.translate(...n.point);ctx.rotate(Math.atan2(n.direction[1],n.direction[0]));
    const plume=ctx.createLinearGradient(0,0,length,0);plume.addColorStop(0,'#e2faff');plume.addColorStop(.16,'#43d5ff');plume.addColorStop(.5,'#096fff88');plume.addColorStop(1,'#0060ff00');
    ctx.globalAlpha=(.4+power*.6)*flicker;ctx.fillStyle=plume;ctx.beginPath();ctx.moveTo(-3,-width);ctx.quadraticCurveTo(length*.26,-width*.85,length,0);ctx.quadraticCurveTo(length*.26,width*.85,-3,width);ctx.closePath();ctx.fill();
    const glow=ctx.createRadialGradient(0,0,1,0,0,width*3.2);glow.addColorStop(0,'#f0fdff');glow.addColorStop(.2,'#54dfffaa');glow.addColorStop(1,'#007aff00');
    ctx.fillStyle=glow;ctx.fillRect(-width*3.2,-width*3.2,width*6.4,width*6.4);ctx.restore();
  }
  ctx.restore();
}

/** Arcflash flies a rendered tap/dive bank (owner, 26 Oct 2026) and wears the pilot's helmet.
 * Its electrical wake stays, leaving from the rendered frame's feet (paintArcflashBootWake); the
 * joint rig, its parts atlas and cockpit crop are kept, unused, for the archive pass. */
export const ARCFLASH_RIG_RETIRED = true;
export const isArcflashRig = (id:string) => id === 'arcflash' && !ARCFLASH_RIG_RETIRED;
/** The same electrical wake from a rendered frame's emitters ([x, y] in that frame's pixels,
 * rig3d-boots.ts), streaming aft; drawn in the bank painter's space like the frame itself. */
export function paintArcflashBootWake(ctx:CanvasRenderingContext2D,s:ArcflashMotion,
 boots:readonly (readonly [number,number])[],ref:{x:number;y:number;w:number;h:number},
 x:number,y:number,size:number,travel?:ArcflashTravel) {
  const unit=size/ARCFLASH_ANATOMY.displaySpan,k=size/Math.max(1,ref.w,ref.h);
  // the wake runs two lanes; a rig that found one hind foot lends it a twin a few pixels below
  const lanes=boots.length>1?boots:[boots[0],[boots[0][0]-2,boots[0][1]+4] as const];
  const nozzles=lanes.map(([ex,ey]):Nozzle=>({point:[(ex-ref.x-ref.w/2)*k/unit,(ey-ref.y-ref.h/2)*k/unit],direction:[-.97,.24]}));
  ctx.save();ctx.translate(x,y);
  wake(ctx,s,size,nozzles,travel??{x,y,travel:s.time*size*2.6});
  ctx.restore();
}

const still=createArcflashMotion();
/** The ship cockpit needs this suit's bare face, not Flight's helmet crop. */
export function paintArcflashCockpit(ctx:CanvasRenderingContext2D,art:ArtBank,x:number,y:number,rx:number,ry:number) {
  const texture=art.arcflash??art.suits.arcflash;if(!texture)return;
  // Measured face centers in the packed head cell and rig-rendered fallback.
  const [cx,cy,r]=art.arcflash?[154,149,67]:[194,82,34],scale=rx*.96/r;
  ctx.save();ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.clip();
  ctx.drawImage(texture,0,0,256,256,x-cx*scale,y-cy*scale,256*scale,256*scale);ctx.restore();
}
/** Complete static trail-card sample, also visible on its first paint. */
export function paintArcflashWake(ctx:CanvasRenderingContext2D,x:number,y:number,t:number) {
  ctx.save();ctx.translate(x+18,y);ctx.lineCap='round';ctx.lineJoin='round';ctx.globalCompositeOperation='lighter';
  for(let lane=0;lane<2;lane++)for(let strand=0;strand<3;strand++){
    for(let pass=0;pass<2;pass++){
      const gradient=ctx.createLinearGradient(0,0,-43,0);gradient.addColorStop(0,pass?'#d8f8ff':'#0879ff88');gradient.addColorStop(.45,pass?'#2cc9ff':'#0879ff55');gradient.addColorStop(1,'#086fff00');
      ctx.strokeStyle=gradient;ctx.lineWidth=pass?.65:3;ctx.beginPath();
      for(let i=0;i<=16;i++){
        const u=i/16,px=-u*43,py=(lane?4:-4)+Math.sin(u*18-t*5+strand*2)*u*(1-u)*9;
        i?ctx.lineTo(px,py):ctx.moveTo(px,py);
      }ctx.stroke();
    }
  }
  ctx.fillStyle='#91e5ff';for(let i=0;i<5;i++){ctx.beginPath();ctx.arc(-9-i*7,Math.sin(t*3+i*2.3)*(5+i*.5),.8,0,Math.PI*2);ctx.fill();}
  ctx.restore();
}
/** One painter for the live pilot, showroom, and fallback portrait. No frame
 * bank, scale pop, mirrored anatomy, or unrelated Vanguard motion path. */
export function paintArcflash(ctx:CanvasRenderingContext2D,art:ArtBank|null|undefined,x:number,y:number,size:number,
  state?:ArcflashMotion,travel?:ArcflashTravel,effects=true,pitch=0) {
  if(!art?.arcflash){const fallback=art?.suits?.arcflash;if(fallback){ctx.save();ctx.translate(x,y);ctx.rotate(pitch);ctx.drawImage(fallback,-size/2,-size/2,size,size);ctx.restore();}return;}
  const s=state??still,p=s.pose,j=arcflashLandmarks(p),nozzles=arcflashNozzles(s,pitch),unit=size/ARCFLASH_ANATOMY.displaySpan;
  ctx.save();ctx.translate(x,y);
  if(effects&&state)wake(ctx,s,size,nozzles,travel??{x,y,travel:s.time*size*2.6});
  ctx.scale(unit,unit);
  if(effects&&state)jets(ctx,s,nozzles);
  // Match the nozzle transform while retaining old wake samples in world
  // coordinates. Changing the pitch dial cannot spin the wake's history.
  ctx.rotate(pitch);
  ctx.translate(REGISTRATION[0],REGISTRATION[1]+p.heave);ctx.rotate(p.body*DEG);
  tail(ctx,art.arcflash,s);
  part(ctx,art.arcflash,8,FH,j.farKnee);part(ctx,art.arcflash,9,j.farKnee,j.farBoot);
  part(ctx,art.arcflash,4,FS,j.farElbow);part(ctx,art.arcflash,5,j.farElbow,j.farWrist);
  part(ctx,art.arcflash,1,NECK,HIP);
  part(ctx,art.arcflash,6,NH,j.nearKnee);part(ctx,art.arcflash,7,j.nearKnee,j.nearBoot);
  part(ctx,art.arcflash,2,NS,j.nearElbow);part(ctx,art.arcflash,3,j.nearElbow,j.nearWrist);
  // The head's painted collar overlaps the torso's open collar. Fixed head
  // registration plus local counter-roll keeps the face above that seam.
  part(ctx,art.arcflash,0,NECK,add(NECK,rotate([0,-120],-54+p.head)));
  ctx.restore();
}
