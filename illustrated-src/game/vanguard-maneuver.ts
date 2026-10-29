import { VANGUARD_PARTS } from './vanguard-parts';

/** Authored poses in joint space. Degrees turn a down-pointing bone toward
 * screen-right. Elbows/knees are relative to the upper bone. The artist's
 * whole-silhouette poses survive interpolation; physics chooses their bank.
 * Head scale and bone lengths NEVER vary with a pose or accepted tap. */
export type ManeuverPose = {
  body: number; head: number; heave: number;
  nearArm: number; nearElbow: number; farArm: number; farElbow: number;
  nearThigh: number; nearKnee: number; farThigh: number; farKnee: number;
};
export type ManeuverBank = 'float' | 'rise' | 'apex' | 'fall' | 'dive' | 'land' | 'thrust';
type Key = readonly [number, ManeuverPose];
type Bank = { seconds: number; loop: boolean; keys: readonly Key[] };
const pose=(body:number,head:number,heave:number,na:number,ne:number,fa:number,fe:number,
  nt:number,nk:number,ft:number,fk:number):ManeuverPose=>({body,head,heave,
    nearArm:na,nearElbow:ne,farArm:fa,farElbow:fe,nearThigh:nt,nearKnee:nk,farThigh:ft,farKnee:fk});
// Each row is a pose, not another tilt of the same drawing. Keep separate
// recoveries for the driving and trailing sides; no synchronized arm pump.
export const VANGUARD_MANEUVERS: Record<ManeuverBank,Bank> = {
  thrust:{seconds:.34,loop:false,keys:[
    [0,pose(0,0,0,0,0,0,0,0,0,0,0)],
    [.20,pose(-7,3,-8,-24,24,14,-8,-18,-14,12,-26)],
    [.55,pose(-3,1,-5,18,7,-8,15,8,-20,-15,8)],
    [1,pose(0,0,0,0,0,0,0,0,0,0,0)],
  ]},
  float:{seconds:2.4,loop:true,keys:[
    [0,pose(5,-3,0,25,55,45,45,22,-47,-8,-22)],
    [.5,pose(2,0,-5,45,45,23,60,8,-30,25,-55)],
    [1,pose(5,-3,0,25,55,45,45,22,-47,-8,-22)],
  ]},
  rise:{seconds:.9,loop:true,keys:[
    [0,pose(-7,1,-5,-25,95,95,30,-25,-20,45,-112)],
    [.32,pose(-11,5,-8,10,105,130,5,-12,-38,-38,-10)],
    [.7,pose(-3,-2,-3,55,65,48,70,20,-60,15,-100)],
    [1,pose(-7,1,-5,-25,95,95,30,-25,-20,45,-112)],
  ]},
  apex:{seconds:1.4,loop:true,keys:[
    [0,pose(2,-4,-3,65,50,35,65,48,-70,2,-30)],
    [.5,pose(7,-7,1,40,65,72,30,20,-45,36,-62)],
    [1,pose(2,-4,-3,65,50,35,65,48,-70,2,-30)],
  ]},
  fall:{seconds:1.25,loop:true,keys:[
    [0,pose(-6,-2,2,103,28,126,-15,76,-75,32,-10)],
    [.45,pose(-10,2,6,128,12,82,38,44,-25,70,-72)],
    [1,pose(-6,-2,2,103,28,126,-15,76,-75,32,-10)],
  ]},
  dive:{seconds:.6,loop:false,keys:[
    [0,pose(12,-6,0,30,65,82,12,30,-55,-15,-15)],
    [.5,pose(31,-15,0,-38,45,140,-20,-38,-3,-12,-20)],
    [1,pose(38,-20,-2,-52,50,145,-18,-55,15,-33,-5)],
  ]},
  land:{seconds:.66,loop:false,keys:[
    [0,pose(12,-5,5,65,42,85,12,65,-95,50,-80)],
    [.16,pose(21,-13,23,85,22,110,-8,83,-124,68,-106)],
    [.40,pose(-10,4,-9,-48,78,60,45,-20,-5,-32,8)],
    [.72,pose(-13,8,-5,15,90,110,18,10,-56,-17,-8)],
    [1,pose(1,-2,0,43,60,58,52,32,-58,-8,-18)],
  ]},
};
const DEG=Math.PI/180;
const clamp=(x:number,a:number,b:number)=>Math.max(a,Math.min(b,x));
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
const smooth=(t:number)=>t*t*(3-2*t);
const keys=Object.keys(VANGUARD_MANEUVERS.float.keys[0][1]) as (keyof ManeuverPose)[];
export function sampleManeuver(bank:ManeuverBank,seconds:number):ManeuverPose {
  const spec=VANGUARD_MANEUVERS[bank];
  let t=Math.max(0,seconds)/spec.seconds;t=spec.loop?t%1:Math.min(1,t);
  let i=0;while(i+2<spec.keys.length&&spec.keys[i+1][0]<t)i++;
  const [ta,a]=spec.keys[i],[tb,b]=spec.keys[i+1],w=smooth(clamp((t-ta)/(tb-ta),0,1));
  const result={} as ManeuverPose;for(const k of keys)result[k]=mix(a[k],b[k],w);
  return result;
}
export type ManeuverMotion = {
  pose:ManeuverPose; rates:ManeuverPose; bank:ManeuverBank; bankAge:number;
  time:number; tapAge:number; gestureAge:number; tapEnergy:number; drive:number; contactAge:number;
  contactStrength:number; contactNormalY:number; previousVy:number; velocityReset:boolean;
  tailBase:number; tailTip:number; tailBaseRate:number; tailTipRate:number;
  tailBend:number; tailBendRate:number; pressure:number;
};
function stylePose(p:ManeuverPose,upright:boolean,diving=false){
  if(!upright){
    p.body+=diving?12:24;p.farArm+=22;p.farElbow-=20;
    p.nearArm-=16;p.nearThigh-=12;p.farKnee+=12;
  }
}
export function createManeuverMotion(upright=true):ManeuverMotion {
  const p=sampleManeuver('float',0),rates={} as ManeuverPose;
  stylePose(p,upright);
  for(const k of keys)rates[k]=0;
  return {pose:p,rates,bank:'float',bankAge:0,time:0,tapAge:10,gestureAge:10,tapEnergy:0,drive:0,
    contactAge:10,contactStrength:0,contactNormalY:-1,previousVy:0,velocityReset:true,
    tailBase:0,tailTip:8,tailBaseRate:0,tailTipRate:0,tailBend:0,tailBendRate:0,pressure:0};
}
export function maneuverTap(s:ManeuverMotion,impulse:number) {
  // Only the short additive thrust accent is rearmed. Locomotion bank phase,
  // pose and all angular velocities survive arbitrarily frequent input.
  if(s.gestureAge>=.34)s.gestureAge=0;
  s.tapAge=0;s.tapEnergy=Math.max(s.tapEnergy,clamp(impulse/620,.38,1));s.velocityReset=true;
}
export function maneuverContact(s:ManeuverMotion,normalY:number,strength:number) {
  s.contactAge=0;s.contactNormalY=normalY;s.contactStrength=clamp(strength,.45,1);s.velocityReset=true;
}
function spring(value:number,rate:number,target:number,dt:number,omega:number,limit:number):[number,number] {
  rate=clamp(rate+(omega*omega*(target-value)-2*omega*rate)*dt,-limit,limit);
  return [value+rate*dt,rate];
}
export function stepManeuver(s:ManeuverMotion,dt:number,vy:number,diving:boolean,upright:boolean) {
  if(!Number.isFinite(dt)||!Number.isFinite(vy)||dt<=0)return;
  dt=Math.min(dt,.25);
  // The simulation supplies velocity after its tick. Interpolate continuous
  // travel inside the visual substeps so threshold timing also survives a
  // slower display. Never interpolate across a tap/contact impulse.
  const startVy=s.velocityReset?vy:s.previousVy;s.velocityReset=false;
  for(let left=dt;left>1e-8;){
    const h=Math.min(left,1/120);left-=h;
    const stepVy=mix(startVy,vy,(dt-left)/dt);
    // Separate entry/exit thresholds prevent apex chatter. Sustained taps
    // never rewind the rise bank; a real direction reversal selects a bank.
    const wanted:ManeuverBank=diving?'dive':
      stepVy<-95||(s.bank==='rise'&&stepVy<-40)?'rise':
      stepVy>115||(s.bank==='fall'&&stepVy>55)?'fall':
      Math.abs(stepVy)<(s.bank==='float'?45:22)&&s.tapAge>1.2?'float':'apex';
    if(wanted!==s.bank){s.bank=wanted;s.bankAge=0;}
    s.time+=h;s.bankAge+=h;s.tapAge+=h;s.gestureAge+=h;s.contactAge+=h;
    const target=sampleManeuver(s.bank,s.bankAge);
    const pulse=s.tapEnergy*Math.exp(-s.tapAge/.16);
    s.pressure+=(pulse-s.pressure)*(1-Math.exp(-h/.032));
    s.drive+=(pulse-s.drive)*(1-Math.exp(-h/.075));
    s.tapEnergy*=Math.exp(-h/1.2);
    // Authored tap bank accent: shoulders load, hands gather, legs kick back.
    // Small asymmetry stays even under100ms refreshes, rather than freezing
    // both hands in one repeated boost pose.
    const accent=sampleManeuver('thrust',s.gestureAge);
    for(const k of keys)target[k]+=accent[k]*s.tapEnergy;
    target.body-=s.drive*3;target.heave-=s.drive*3;
    // The contact bank is an overlay, retaining its compression/push-off
    // through the next accepted tap. Ceiling contacts brace the arms only.
    if(s.contactAge<.66){
      const land=sampleManeuver('land',s.contactAge);
      const weight=s.contactStrength*Math.min(1,s.contactAge/.022)*
        (1-smooth(clamp((s.contactAge-.40)/.26,0,1)));
      for(const k of keys){
        if(s.contactNormalY>0&&(/Thigh|Knee|heave/.test(k)))continue;
        const value=s.contactNormalY>0&&/Arm/.test(k)?150:land[k];
        target[k]=mix(target[k],value,weight);
      }
    }
    // Flight has an asymmetric forward reach. Upright has its own neutral
    // hip/arm placement as well as a different attitude, not a rotated clone.
    stylePose(target,upright,s.bank==='dive');
    for(const k of keys){
      const omega=k==='head'?17:k==='body'?15:k==='heave'?18:
        /far/.test(k)?19:/Knee|Elbow/.test(k)?22:21;
      const limit=k==='body'||k==='head'?145:k==='heave'?155:420;
      [s.pose[k],s.rates[k]]=spring(s.pose[k],s.rates[k],target[k],h,omega,limit);
    }
    // Screen-space velocity drives tail drag: down/back during ascent,
    // up/back during descent. Root reacts first, heavy plume tip later.
    // This intentionally exaggerates the game's gravity; it is not a
    // claim that a real vacuum produces aerodynamic drag.
    const direction=clamp(stepVy/420,-1,1);
    const tailTarget=direction<0?mix(-10,-109,-direction):mix(-10,16,direction);
    [s.tailBase,s.tailBaseRate]=spring(s.tailBase,s.tailBaseRate,tailTarget-s.drive*15-s.pose.body*.45,h,11,235);
    [s.tailTip,s.tailTipRate]=spring(s.tailTip,s.tailTipRate,s.tailBase,h,6.5,205);
    [s.tailBend,s.tailBendRate]=spring(s.tailBend,s.tailBendRate,clamp((s.tailBase-s.tailTip)*.38,-19,19),h,7,100);
  }
  s.previousVy=vy;
}

type Point=readonly [number,number];
const point=(p:Point,length:number,angle:number):Point=>[p[0]+Math.sin(angle*DEG)*length,p[1]+Math.cos(angle*DEG)*length];
const NECK:Point=[10,-94],HIP:Point=[6,40],HEAD:Point=[15,-102];
const NS:Point=[-36,-63],FS:Point=[47,-59],NH:Point=[-14,32],FH:Point=[32,31],TAIL:Point=[-46,37];
export function maneuverLandmarks(p:ManeuverPose){
  const ne=point(NS,57,p.nearArm),fe=point(FS,52,p.farArm);
  const nk=point(NH,68,p.nearThigh),fk=point(FH,64,p.farThigh);
  return {nearElbow:ne,farElbow:fe,nearHand:point(ne,61,p.nearArm+p.nearElbow),
    farHand:point(fe,55,p.farArm+p.farElbow),nearKnee:nk,farKnee:fk,
    nearFoot:point(nk,66,p.nearThigh+p.nearKnee),farFoot:point(fk,63,p.farThigh+p.farKnee)};
}
function part(ctx:CanvasRenderingContext2D,atlas:CanvasImageSource,index:number,a:Point,b:Point){
  const spec=VANGUARD_PARTS[index],dx=spec.b[0]-spec.a[0],dy=spec.b[1]-spec.a[1];
  const tx=b[0]-a[0],ty=b[1]-a[1],scale=Math.hypot(tx,ty)/Math.hypot(dx,dy);
  // Static anatomical calibration: source pieces were normalized separately
  // in the atlas. Their width is fixed here, never animated or stretched by a
  // gesture. Bone-axis length still maps its two attachment points exactly.
  const width=index>=2&&index<=5?1.55:index>=6&&index<=9?1.28:1;
  ctx.save();ctx.translate(a[0],a[1]);ctx.rotate(Math.atan2(ty,tx));ctx.scale(scale,scale*width);ctx.rotate(-Math.atan2(dy,dx));
  ctx.drawImage(atlas,index%4*256,Math.floor(index/4)*256,256,256,-spec.a[0],-spec.a[1],256,256);ctx.restore();
}
// A free tail patch has no pinned torso boundary. Its vertices can follow a
// long sweeping arc while the texture keeps the original stripe pattern.
const tailVertices:Point[]=[];
const tailTriangles:number[][]=[];
for(let y=0;y<=4;y++)for(let x=0;x<=4;x++)tailVertices.push([x*64,y*64]);
for(let y=0;y<4;y++)for(let x=0;x<4;x++){const a=y*5+x;tailTriangles.push([a,a+1,a+6],[a,a+6,a+5]);}
export function maneuverTailVertices(s:ManeuverMotion):Point[]{
  const root=VANGUARD_PARTS[10].a,tip=VANGUARD_PARTS[10].b;
  const ax=tip[0]-root[0],ay=tip[1]-root[1],len=ax*ax+ay*ay;
  // A velocity reversal can leave the physical tip >50° behind the root.
  // Compress only the displayed curvature, continuously, before that wide
  // furry patch pinches. The independent spring states keep their momentum.
  const tipAngle=s.tailBase+28*Math.tanh((s.tailTip-s.tailBase)/28);
  const bend=9*Math.tanh(s.tailBend/9);
  return tailVertices.map(([x,y])=>{
    const t=clamp(((x-root[0])*ax+(y-root[1])*ay)/len,0,1);
    const angle=(mix(s.tailBase,tipAngle,smooth(t))+bend*Math.sin(t*Math.PI))*DEG;
    const dx=x-root[0],dy=y-root[1];
    return [TAIL[0]+(dx*Math.cos(angle)-dy*Math.sin(angle))*1.03,
      TAIL[1]+(dx*Math.sin(angle)+dy*Math.cos(angle))*1.03] as Point;
  });
}
function paintTail(ctx:CanvasRenderingContext2D,atlas:CanvasImageSource,s:ManeuverMotion){
  const vertices=maneuverTailVertices(s);
  for(const [a,b,c] of tailTriangles){
    const [sx,sy]=tailVertices[a],[bx,by]=tailVertices[b],[cx,cy]=tailVertices[c];
    const [x0,y0]=vertices[a],[x1,y1]=vertices[b],[x2,y2]=vertices[c];
    const det=(bx-sx)*(cy-sy)-(cx-sx)*(by-sy);
    const m00=((x1-x0)*(cy-sy)-(x2-x0)*(by-sy))/det;
    const m01=((x2-x0)*(bx-sx)-(x1-x0)*(cx-sx))/det;
    const m10=((y1-y0)*(cy-sy)-(y2-y0)*(by-sy))/det;
    const m11=((y2-y0)*(bx-sx)-(y1-y0)*(cx-sx))/det;
    // Extend shared triangle edges just enough to hide Canvas antialias
    // seams. The isolated texture cannot double an adjacent body region.
    const center:Point=[(x0+x1+x2)/3,(y0+y1+y2)/3];
    ctx.save();ctx.beginPath();
    for(const [i,v] of [vertices[a],vertices[b],vertices[c]].entries()){
      const dx=v[0]-center[0],dy=v[1]-center[1],l=Math.max(1,Math.hypot(dx,dy));
      const x=v[0]+dx/l*1.5,y=v[1]+dy/l*1.5;
      if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
    }
    ctx.closePath();ctx.clip();ctx.transform(m00,m10,m01,m11,x0-m00*sx-m01*sy,y0-m10*sx-m11*sy);
    ctx.drawImage(atlas,512,512,256,256,0,0,256,256);ctx.restore();
  }
}
function paintExhaust(ctx:CanvasRenderingContext2D,s:ManeuverMotion){
  const power=s.pressure;if(power<.012)return;
  for(const [x,y,m] of [[-84,5,1],[-66,-1,.72]]){
    const length=(35+power*130)*m;
    const grad=ctx.createLinearGradient(x,y,x-48,y+length);
    grad.addColorStop(0,`rgba(224,252,255,${power*.95})`);
    grad.addColorStop(.24,`rgba(91,232,255,${power*.8})`);
    grad.addColorStop(.7,`rgba(232,172,81,${power*.35})`);grad.addColorStop(1,'rgba(232,172,81,0)');
    ctx.fillStyle=grad;ctx.beginPath();ctx.moveTo(x-6,y);ctx.bezierCurveTo(x-13,y+24,x-46,y+length*.6,x-48,y+length);
    ctx.bezierCurveTo(x-23,y+length*.56,x+9,y+20,x+6,y);ctx.closePath();ctx.fill();
  }
}
/** One stable head/torso, articulated complete limbs and a separately lagged
 * tail. All render costs are bounded:10 sprite draws plus32 tail triangles. */
export function paintManeuver(ctx:CanvasRenderingContext2D,atlas:CanvasImageSource,
  x:number,y:number,size:number,s:ManeuverMotion,trim=0){
  const p=s.pose,l=maneuverLandmarks(p),scale=size/400;
  ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);ctx.translate(0,60+p.heave);ctx.rotate(p.body*DEG+trim);
  // The pack is in front of the tail. Its plume must emerge from the visible
  // nozzle, without being cut into a rectangular sliver by the furry layer.
  paintTail(ctx,atlas,s);paintExhaust(ctx,s);
  part(ctx,atlas,8,FH,l.farKnee);part(ctx,atlas,9,l.farKnee,l.farFoot);
  part(ctx,atlas,4,FS,l.farElbow);part(ctx,atlas,5,l.farElbow,l.farHand);
  part(ctx,atlas,1,NECK,HIP);
  part(ctx,atlas,6,NH,l.nearKnee);part(ctx,atlas,7,l.nearKnee,l.nearFoot);
  part(ctx,atlas,2,NS,l.nearElbow);part(ctx,atlas,3,l.nearElbow,l.nearHand);
  const angle=(p.head-p.body*.35)*DEG,dx=27,dy=-76;
  part(ctx,atlas,0,HEAD,[HEAD[0]+dx*Math.cos(angle)-dy*Math.sin(angle),HEAD[1]+dx*Math.sin(angle)+dy*Math.cos(angle)]);
  ctx.restore();
}
