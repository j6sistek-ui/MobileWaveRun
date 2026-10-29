import type {HighOrbitId,PremiumSuitId} from './high-orbit-config';
import type {HighOrbitMotion} from './high-orbit-motion';
import {paintHighOrbitEffect} from './high-orbit-effects';
import {CYBER_TRIO_REGISTRATION} from './cyber-trio-registration';

export type PremiumBankWake={state:HighOrbitMotion;travel:number};
/** Place the existing signature wake at the selected painting's boots.
 * Resolve the painter's full transform before drawing the wake in screen
 * coordinates, so previously emitted samples do not bank with the pilot. */
export function paintPremiumBankWake(ctx:CanvasRenderingContext2D,id:PremiumSuitId,
 bank:'asc'|'desc',index:number,ref:{x:number;y:number;w:number;h:number},
 x:number,y:number,size:number,wake:PremiumBankWake){
  paintBootWake(ctx,id,CYBER_TRIO_REGISTRATION[id][bank][index].emitters,ref,x,y,size,wake);
}
/** The same wake from any frame's emitters, in that frame's own pixel space - the
 * rendered 3D banks measure theirs at the hind feet (rig3d-boots.ts). */
export function paintBootWake(ctx:CanvasRenderingContext2D,id:HighOrbitId,
 boots:readonly (readonly [number,number])[],ref:{x:number;y:number;w:number;h:number},
 x:number,y:number,size:number,wake:PremiumBankWake){
  // a context without getTransform (a recording stub in the harness, an
  // old WebView) paints the wake in the painter's own space rather than
  // crashing the preview (exposed 13 Sep 2026 when the cheaper trio reached
  // the shop preview in test-shop-visuals)
  const got=typeof ctx.getTransform==="function"?ctx.getTransform():undefined;
  const m=got&&typeof got.a==="number"?got:{a:1,b:0,c:0,d:1,e:0,f:0};
  const unit=size/Math.max(1,ref.w,ref.h);
  const scale=Math.hypot(m.a,m.b),effectSize=size*scale;
  if(effectSize<=0)return;
  const cx=m.a*x+m.c*y+m.e,cy=m.b*x+m.d*y+m.f;
  // the wake runs two lanes; a rig that found one hind foot lends it a twin a few pixels below
  const lanes=boots.length>1?boots:[boots[0],[boots[0][0]-2,boots[0][1]+4] as const];
  const emitters=lanes.map(([ex,ey]):readonly [number,number]=>{
    const bx=(ex-ref.x-ref.w/2)*unit,by=(ey-ref.y-ref.h/2)*unit;
    return [128+(m.a*bx+m.c*by)*192/effectSize,128+(m.b*bx+m.d*by)*192/effectSize];
  });
  ctx.save();ctx.setTransform(1,0,0,1,cx,cy);
  paintHighOrbitEffect(ctx,id,wake.state,effectSize,emitters,{x:cx,y:cy,travel:wake.travel*scale});
  ctx.restore();
}
