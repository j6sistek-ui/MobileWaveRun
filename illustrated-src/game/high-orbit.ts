import type {ArtBank} from './art';
import {HIGH_ORBIT_PARTS} from './high-orbit-parts';
import {HIGH_ORBIT_HEAD_RADIUS,HIGH_ORBIT_DISPLAY_SPAN,isPremiumSuit,type HighOrbitId,type HighOrbitRigId} from './high-orbit-config';
import {createHighOrbitMotion,type HighOrbitMotion,type HighOrbitPose} from './high-orbit-motion';
import {paintHighOrbitEffect,type HighOrbitTravel} from './high-orbit-effects';
import {rigLimbFit,rigPartMatrix} from './rig-limb-fit';
import {paintPremiumFlight,paintPremiumFlightCockpit} from './premium-flight';

export type OrbitPoint=readonly [number,number];
const DEG=Math.PI/180;
const add=(a:OrbitPoint,b:OrbitPoint):OrbitPoint=>[a[0]+b[0],a[1]+b[1]];
const rotate=(p:OrbitPoint,a:number):OrbitPoint=>[p[0]*Math.cos(a*DEG)-p[1]*Math.sin(a*DEG),p[0]*Math.sin(a*DEG)+p[1]*Math.cos(a*DEG)];
const along=(p:OrbitPoint,length:number,angle:number):OrbitPoint=>add(p,[Math.sin(angle*DEG)*length,Math.cos(angle*DEG)*length]);
export const HIGH_ORBIT_ANATOMY={headRadius:HIGH_ORBIT_HEAD_RADIUS,displaySpan:HIGH_ORBIT_DISPLAY_SPAN,
 torso:62,nearArm:25,nearForearm:23,farArm:24,farForearm:22,nearThigh:28,nearShin:29,farThigh:27,farShin:28,tail:79} as const;
const NS:OrbitPoint=[-19,18],FS:OrbitPoint=[13,14],NH:OrbitPoint=[-12,56],FH:OrbitPoint=[12,51],TAIL:OrbitPoint=[-26,57];
const skull:OrbitPoint=[181,88];
/** The skull center is registered independently of the torso. The neck follows
 * the underside of the fixed-size head as it nods; no stretchy neck or fitting by alpha. */
export function highOrbitLandmarks(id:HighOrbitRigId,p:HighOrbitPose,pitch=0){
 const h=HIGH_ORBIT_PARTS[id][0],scale=HIGH_ORBIT_HEAD_RADIUS/h.skull[2];
 const head:OrbitPoint=[skull[0],skull[1]+p.heave];
 const neck=add(head,rotate([(h.a[0]-h.skull[0])*scale,(h.a[1]-h.skull[1])*scale],p.head));
 const world=(q:OrbitPoint)=>add(neck,rotate(q,p.body));
 const ne=along(NS,25,p.nearArm),fe=along(FS,24,p.farArm),nk=along(NH,28,p.nearThigh),fk=along(FH,27,p.farThigh);
 const raw={head,neck,hip:world([0,62]),tail:world(TAIL),nearShoulder:world(NS),farShoulder:world(FS),
   nearElbow:world(ne),farElbow:world(fe),nearWrist:world(along(ne,23,p.nearArm+p.nearElbow)),
   farWrist:world(along(fe,22,p.farArm+p.farElbow)),nearHip:world(NH),farHip:world(FH),
   nearKnee:world(nk),farKnee:world(fk),nearBoot:world(along(nk,29,p.nearThigh+p.nearKnee)),
   farBoot:world(along(fk,28,p.farThigh+p.farKnee))};
 return Object.fromEntries(Object.entries(raw).map(([k,q])=>[k,add([128,128],rotate([q[0]-128,q[1]-128],pitch/DEG))])) as typeof raw;
}
function part(ctx:CanvasRenderingContext2D,atlas:CanvasImageSource,id:HighOrbitRigId,index:number,a:OrbitPoint,b:OrbitPoint){
 const spec=HIGH_ORBIT_PARTS[id][index],fit=rigLimbFit(id,index);
 ctx.save();ctx.transform(...rigPartMatrix(spec,a,b,fit.breadth,fit.facing));
 ctx.drawImage(atlas,index%4*256,Math.floor(index/4)*256,256,256,0,0,256,256);ctx.restore();
}
export const HIGH_ORBIT_TAIL_TRIANGLES:number[][]=[];
for(let y=0;y<6;y++)for(let x=0;x<4;x++){const a=y*5+x;HIGH_ORBIT_TAIL_TRIANGLES.push([a,a+1,a+6],[a,a+6,a+5]);}
/** Bone-aligned strips retain their longitudinal position and width. Bending
 * adds only a lateral offset per strip, making every triangle area invariant:
 * no self-fold, volume pumping, discrete guard step, or repeated tail drawing. */
export function highOrbitTailMesh(id:HighOrbitRigId,p:HighOrbitPose,pitch=0){
 const spec=HIGH_ORBIT_PARTS[id][10],dx=spec.b[0]-spec.a[0],dy=spec.b[1]-spec.a[1],length=Math.hypot(dx,dy);
 const ux=dx/length,uy=dy/length,vx=-uy,vy=ux,scale=79/length;
 const projected=[[0,0],[256,0],[0,256],[256,256]].map(([x,y])=>[(x-spec.a[0])*ux+(y-spec.a[1])*uy,(x-spec.a[0])*vx+(y-spec.a[1])*vy]);
 const lo=Math.min(...projected.map(q=>q[0])),hi=Math.max(...projected.map(q=>q[0]));
 const left=Math.min(...projected.map(q=>q[1])),right=Math.max(...projected.map(q=>q[1]));
 const source:OrbitPoint[]=[],points:OrbitPoint[]=[],root=highOrbitLandmarks(id,p).tail;
 for(let y=0;y<=6;y++)for(let x=0;x<=4;x++){
   const u=lo+(hi-lo)*y/6,v=left+(right-left)*x/4;
   source.push([spec.a[0]+ux*u+vx*v,spec.a[1]+uy*u+vy*v]);
   const t=Math.max(0,Math.min(1,u/length)),bend=(p.tailMid-p.tailRoot)*Math.sin(t*Math.PI/2)*.26+
     (p.tailTip-p.tailMid)*t*t*.38;
   const q=rotate([(ux*u+vx*(v+bend))*scale,(uy*u+vy*(v+bend))*scale],p.body-49+p.tailRoot*.8);
   const a=add(root,q);points.push(add([128,128],rotate([a[0]-128,a[1]-128],pitch/DEG)));
 }
 return {source,points};
}
export function paintHighOrbitTail(ctx:CanvasRenderingContext2D,atlas:CanvasImageSource,id:HighOrbitRigId,p:HighOrbitPose,pitch=0){
 const {source,points}=highOrbitTailMesh(id,p,pitch);
 for(const [a,b,c] of HIGH_ORBIT_TAIL_TRIANGLES){
   const [sx,sy]=source[a],[bx,by]=source[b],[cx,cy]=source[c],[x0,y0]=points[a],[x1,y1]=points[b],[x2,y2]=points[c];
   const det=(bx-sx)*(cy-sy)-(cx-sx)*(by-sy);
   const m00=((x1-x0)*(cy-sy)-(x2-x0)*(by-sy))/det,m01=((x2-x0)*(bx-sx)-(x1-x0)*(cx-sx))/det;
   const m10=((y1-y0)*(cy-sy)-(y2-y0)*(by-sy))/det,m11=((y2-y0)*(bx-sx)-(y1-y0)*(cx-sx))/det;
   const center:OrbitPoint=[(x0+x1+x2)/3,(y0+y1+y2)/3];
   ctx.save();ctx.beginPath();
   [points[a],points[b],points[c]].forEach(([x,y],i)=>{const d=Math.max(1,Math.hypot(x-center[0],y-center[1])),ex=x+(x-center[0])/d*.24,ey=y+(y-center[1])/d*.24;i?ctx.lineTo(ex,ey):ctx.moveTo(ex,ey);});
   ctx.closePath();ctx.clip();ctx.transform(m00,m10,m01,m11,x0-m00*sx-m01*sy,y0-m10*sx-m11*sy);
   ctx.drawImage(atlas,512,512,256,256,0,0,256,256);ctx.restore();
 }
}
const stills=new Map<HighOrbitId,HighOrbitMotion>();
export function highOrbitStill(id:HighOrbitId){let s=stills.get(id);if(!s){s=createHighOrbitMotion(id);stills.set(id,s);}return s;}
export type HighOrbitHelmet=(x:number,y:number,r:number,angle:number)=>void;
/** Shared live/preview/portrait painter. size is a 192px body reference, not
 * this pose's alpha bounds. Each named skull is exactly 36px in that space. */
export function paintHighOrbit(ctx:CanvasRenderingContext2D,art:ArtBank|null|undefined,id:HighOrbitId,
 x:number,y:number,size:number,state?:HighOrbitMotion,travel?:HighOrbitTravel,effects=true,pitch=0,helmet?:HighOrbitHelmet,sealedHead=false){
 if(isPremiumSuit(id)){
   paintPremiumFlight(ctx,art,id,x,y,size,state,travel,effects,pitch);
   return;
 }
 const s=state??highOrbitStill(id),p=s.pose,j=highOrbitLandmarks(id,p,pitch),unit=size/HIGH_ORBIT_DISPLAY_SPAN;
 const atlas=art?.highOrbit?.[id];
 ctx.save();ctx.translate(x,y);
 if(effects&&state)paintHighOrbitEffect(ctx,id,s,size,[j.farBoot,j.nearBoot],travel??{x,y,travel:s.time*size*2.5});
 ctx.scale(unit,unit);ctx.translate(-128,-128);
 if(atlas){
   paintHighOrbitTail(ctx,atlas,id,p,pitch);
   part(ctx,atlas,id,8,j.farHip,j.farKnee);part(ctx,atlas,id,9,j.farKnee,j.farBoot);
   part(ctx,atlas,id,4,j.farShoulder,j.farElbow);part(ctx,atlas,id,5,j.farElbow,j.farWrist);
   part(ctx,atlas,id,1,j.neck,j.hip);
   part(ctx,atlas,id,6,j.nearHip,j.nearKnee);part(ctx,atlas,id,7,j.nearKnee,j.nearBoot);
   part(ctx,atlas,id,2,j.nearShoulder,j.nearElbow);part(ctx,atlas,id,3,j.nearElbow,j.nearWrist);
   const head=HIGH_ORBIT_PARTS[id][0],scale=HIGH_ORBIT_HEAD_RADIUS/head.skull[2];
   // A complete opaque helmet replaces the bare head. Drawing both leaves
   // ear tips peeking through the helmet's transparent exterior corners.
   if(!sealedHead){
     ctx.save();ctx.translate(...j.head);ctx.rotate(p.head*DEG+pitch);ctx.scale(scale,scale);
     ctx.drawImage(atlas,0,0,256,256,-head.skull[0],-head.skull[1],256,256);ctx.restore();
   }
   helmet?.(j.head[0],j.head[1],HIGH_ORBIT_HEAD_RADIUS,p.head+pitch/DEG);
 }else{
   const fallback=art?.suits?.[id];
   if(fallback){ctx.save();ctx.translate(128,128);ctx.rotate(pitch);ctx.drawImage(fallback,-128,-128,256,256);ctx.restore();
     const center=add([128,128],rotate([skull[0]-128,skull[1]-128],pitch/DEG));
     helmet?.(center[0],center[1],HIGH_ORBIT_HEAD_RADIUS,pitch/DEG);}
 }
 ctx.restore();
}
export function paintHighOrbitCockpit(ctx:CanvasRenderingContext2D,art:ArtBank,id:HighOrbitId,x:number,y:number,rx:number,ry:number){
 if(isPremiumSuit(id)){
   paintPremiumFlightCockpit(ctx,art,id,x,y,rx,ry);
   return;
 }
 const atlas=art.highOrbit?.[id],image=atlas??art.suits[id];if(!image)return;
 const h=HIGH_ORBIT_PARTS[id][0],center=atlas?h.skull:[...skull,HIGH_ORBIT_HEAD_RADIUS],scale=rx*.96/center[2];
 ctx.save();ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.clip();
 ctx.drawImage(image,0,0,256,256,x-center[0]*scale,y-center[1]*scale,256*scale,256*scale);ctx.restore();
}
