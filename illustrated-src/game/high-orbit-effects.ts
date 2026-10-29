import {HIGH_ORBIT_PROFILES,type HighOrbitId} from './high-orbit-config';
import type {HighOrbitMotion} from './high-orbit-motion';
import type {OrbitPoint} from './high-orbit';

export type HighOrbitTravel={x:number;y:number;travel:number};
type Sample={x:number;y:number;time:number;power:number};
type History={time:number;origin:HighOrbitTravel;lanes:Sample[][]};
type PlumePoint={x:number;y:number;u:number;power:number};
const history=new WeakMap<HighOrbitMotion,Map<number,History>>();
const TAU=Math.PI*2;
function glow(ctx:CanvasRenderingContext2D,x:number,y:number,r:number,color:string,alpha:number){
 if(r<=0)return;const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,color+'00');
 ctx.globalAlpha=alpha;ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);
}
function line(ctx:CanvasRenderingContext2D,points:OrbitPoint[],color:string,width:number,alpha:number){
 ctx.globalAlpha=alpha;ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();
 points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();
}
function leaf(ctx:CanvasRenderingContext2D,x:number,y:number,angle:number,length:number,color:string){
 ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(-length,0);
 ctx.bezierCurveTo(-length*.1,-length*.68,length*.65,-length*.38,length,0);
 ctx.bezierCurveTo(length*.2,length*.58,-length*.5,length*.58,-length,0);ctx.fill();
 ctx.strokeStyle='#ecffcc';ctx.lineWidth=Math.max(.2,length*.07);ctx.beginPath();ctx.moveTo(-length*.8,0);ctx.quadraticCurveTo(0,-length*.15,length*.85,0);ctx.stroke();ctx.restore();
}
/** Authored materials and silhouettes. These effects are painted from
 * the suit's private retained wake, never emitted through shop trail particles. */
function material(ctx:CanvasRenderingContext2D,id:HighOrbitId,points:PlumePoint[],time:number,size:number,lane:number){
 const [hot,mid,dark]=HIGH_ORBIT_PROFILES[id].colors,phase=time*3+lane*2.8;
 const shape=(offset:(p:PlumePoint)=>number):OrbitPoint[]=>points.map(p=>[p.x,p.y+offset(p)]);
 if(id==='cinderforge'){
   // Hot turbulent mantle, red cooled edges, individual angular cinders.
   for(let band=0;band<3;band++){
     const strip=shape(p=>Math.sin(p.u*15-phase*2+band*2)*Math.sin(p.u*Math.PI)*size*.035);
     for(let i=1;i<strip.length;i++){
       const fade=(1-points[i].u)**1.4,p=points[i];
       line(ctx,[strip[i-1],strip[i]],dark,size*.075*fade,.2*fade);
       line(ctx,[strip[i-1],strip[i]],mid,size*.025*fade,.5*fade);
       line(ctx,[strip[i-1],strip[i]],hot,size*.006*fade,(.45+p.power*.3)*fade);
     }
   }
   for(let i=3;i<points.length;i+=4){
     const p=points[i],fade=1-p.u;
     const x=p.x-size*.04*p.u,y=p.y+Math.sin(i*7.3+phase)*size*.1*p.u;
     glow(ctx,x,y,size*.04*fade,mid,.25*fade);
     ctx.globalAlpha=.9*fade;ctx.fillStyle=i%3?hot:mid;ctx.save();ctx.translate(x,y);ctx.rotate(i+phase*.2);
     const r=size*.012*fade;ctx.fillRect(-r,-r*.55,r*2,r*1.1);ctx.restore();
   }
 }else if(id==='groveguard'){
   // Living curling stems support individual lit leaves and drifting pollen.
   for(let strand=0;strand<2;strand++){
     const stem=shape(p=>Math.sin(p.u*11-phase*.7+strand*2.6)*Math.sin(p.u*Math.PI)*size*.065);
     for(let i=1;i<stem.length;i++){
       const fade=(1-points[i].u)**1.2;
       line(ctx,[stem[i-1],stem[i]],dark,size*.035*fade,.25*fade);
       line(ctx,[stem[i-1],stem[i]],mid,size*.008*fade,.7*fade);
       if(i%6===3){
         const side=(i+strand)%2?1:-1,dy=side*size*.034;
         line(ctx,[stem[i],[stem[i][0]-size*.02,stem[i][1]+dy]],mid,size*.003,.7*fade);
         glow(ctx,stem[i][0],stem[i][1]+dy,size*.065,mid,.12*fade);
         ctx.globalAlpha=.9*fade;leaf(ctx,stem[i][0]-size*.02,stem[i][1]+dy,side*.7+Math.sin(phase+i)*.25,size*.047*(.4+.6*fade),mid);
       }
     }
   }
   for(let i=2;i<points.length;i+=5){const p=points[i],fade=1-p.u;
     glow(ctx,p.x,p.y+Math.sin(phase+i*2.8)*size*.12*p.u,size*.02*fade,hot,.5*fade);
   }
 }else if(id==='cosmic'){
   // A layered gaseous wake: broad nebula volumes, fine ion strands, stars.
   for(let i=points.length-1;i>=1;i-=2){
     const p=points[i],fade=1-p.u,wave=Math.sin(p.u*9-phase)*size*.05*p.u;
     glow(ctx,p.x,p.y+wave,size*(.055+.10*p.u),i%4?mid:dark,.32*fade*(.4+p.power));
     glow(ctx,p.x-size*.022,p.y-wave*.8,size*(.025+.055*p.u),'#ce6dbe',.16*fade);
     if(i%6===3){const r=size*.015*fade;line(ctx,[[p.x-r,p.y],[p.x+r,p.y]],hot,size*.004,.8*fade);line(ctx,[[p.x,p.y-r],[p.x,p.y+r]],hot,size*.004,.8*fade);}
   }
   for(let strand=0;strand<3;strand++){
     const ribbon=shape(p=>Math.sin(p.u*10+strand*2-phase*.6)*size*.06*Math.sin(p.u*Math.PI));
     for(let i=1;i<ribbon.length;i++)line(ctx,[ribbon[i-1],ribbon[i]],strand===1?hot:mid,size*.005,(1-points[i].u)**2*.55);
   }
 }else if(id==='sunforged'){
   // Twin solar prominences curl around the hot core, opening into corona arcs.
   for(let side=-1;side<=1;side++){
     const corona=shape(p=>side*Math.sin(p.u*Math.PI*2.2-phase*.25)*size*.13*Math.sin(p.u*Math.PI));
     for(let i=1;i<corona.length;i++){
       const fade=(1-points[i].u)**1.4;
       line(ctx,[corona[i-1],corona[i]],dark,size*.05*fade,.2*fade);
       line(ctx,[corona[i-1],corona[i]],mid,size*.014*fade,.62*fade);
       line(ctx,[corona[i-1],corona[i]],hot,size*.004*fade,.8*fade);
     }
   }
   for(let i=5;i<points.length;i+=8){const p=points[i],fade=1-p.u,r=size*(.025+.03*p.u);
     ctx.globalAlpha=.55*fade;ctx.lineWidth=size*.004;ctx.strokeStyle=mid;ctx.beginPath();
     ctx.ellipse(p.x,p.y,r*.38,r,Math.sin(phase*.3)*.3,-Math.PI*.65,Math.PI*.65);ctx.stroke();
     glow(ctx,p.x,p.y,r,mid,.13*fade);
   }
 }else if(id==='porcelain'){
   // Fine cobalt scrollwork within a restrained porcelain-white slipstream.
   for(let side=-1;side<=1;side+=2){
     const ribbon=shape(p=>side*Math.sin(p.u*12-phase*.55)*Math.sin(p.u*Math.PI)*size*.06);
     for(let i=1;i<ribbon.length;i++){
       const fade=(1-points[i].u)**1.5;
       line(ctx,[ribbon[i-1],ribbon[i]],dark,size*.017*fade,.24*fade);
       line(ctx,[ribbon[i-1],ribbon[i]],side<0?hot:mid,size*.004*fade,.8*fade);
     }
   }
   for(let i=4;i<points.length;i+=7){
     const p=points[i],fade=1-p.u,r=size*.018*fade;
     glow(ctx,p.x,p.y,size*.046*fade,mid,.23*fade);
     ctx.globalAlpha=.85*fade;ctx.fillStyle=hot;ctx.beginPath();
     ctx.moveTo(p.x-r,p.y);ctx.lineTo(p.x,p.y-r*1.4);ctx.lineTo(p.x+r,p.y);ctx.lineTo(p.x,p.y+r*1.4);ctx.closePath();ctx.fill();
   }
 }else if(id==='nacre'){
   // Translucent nacre laminae drift through lilac and warm pearl light.
   for(let i=points.length-1;i>=1;i-=2){
     const p=points[i],fade=1-p.u,y=p.y+Math.sin(p.u*9-phase*.65)*size*.055*p.u;
     glow(ctx,p.x,y,size*(.035+.07*p.u),i%4?mid:dark,.2*fade);
     // Either parity of retained samples must paint the pearl laminae.
     if(i%4<2){
       // A half-pixel rim keeps the shell shape readable on small shelf icons.
       ctx.globalAlpha=.65*fade;ctx.strokeStyle=hot;ctx.lineWidth=Math.max(.5,size*.004);
       ctx.beginPath();ctx.ellipse(p.x,y,size*.028*fade,size*.05*fade,Math.sin(phase*.3+i)*.5,-Math.PI*.8,Math.PI*.35);ctx.stroke();
       glow(ctx,p.x-size*.009,y-size*.018*fade,size*.009*fade,hot,.6*fade);
     }
   }
   const thread=shape(p=>Math.sin(p.u*10-phase*.65)*size*.036*Math.sin(p.u*Math.PI));
   for(let i=1;i<thread.length;i++)line(ctx,[thread[i-1],thread[i]],mid,size*.004,(1-points[i].u)**1.5*.7);
 }else if(id==='origamist'){
   // Individually lit folded vanes and a fine angular crease line.
   for(let i=1;i<points.length;i++){
     const fade=(1-points[i].u)**1.5;
     line(ctx,[[points[i-1].x,points[i-1].y],[points[i].x,points[i].y]],dark,size*.018*fade,.35*fade);
   }
   for(let i=3;i<points.length;i+=5){
     const p=points[i],fade=1-p.u,r=size*(.025+.025*p.u),side=(i+lane)%2?1:-1;
     const y=p.y+side*size*.05*Math.sin(p.u*Math.PI);
     ctx.save();ctx.translate(p.x,y);ctx.rotate(side*(.28+Math.sin(phase*.4+i)*.12));
     ctx.globalAlpha=.8*fade;ctx.fillStyle=mid;ctx.beginPath();ctx.moveTo(-r,0);ctx.lineTo(r,-r*.65);ctx.lineTo(r*.45,r*.55);ctx.closePath();ctx.fill();
     ctx.fillStyle=dark;ctx.beginPath();ctx.moveTo(-r,0);ctx.lineTo(r*.45,r*.55);ctx.lineTo(-r*.1,r*.8);ctx.closePath();ctx.fill();
     line(ctx,[[-r,0],[r*.45,r*.55]],hot,size*.004,.85*fade);ctx.restore();
   }
 }else{
   // Fine fluid currents weave around clear bubbles with crescent highlights.
   for(let strand=0;strand<4;strand++){
     const current=shape(p=>Math.sin(p.u*12-phase*.8+strand*1.6)*size*.065*Math.sin(p.u*Math.PI));
     for(let i=1;i<current.length;i++){
       const fade=(1-points[i].u)**1.5;
       line(ctx,[current[i-1],current[i]],dark,size*.03*fade,.15*fade);
       line(ctx,[current[i-1],current[i]],strand%2?mid:hot,size*.0045*fade,.62*fade);
     }
   }
   for(let i=4;i<points.length;i+=6){const p=points[i],fade=1-p.u,r=size*(.014+.025*p.u);
     const y=p.y-Math.sin(i*2.4+phase*.3)*size*.095*p.u;
     glow(ctx,p.x,y,r*3,mid,.15*fade);
     ctx.globalAlpha=.78*fade;ctx.strokeStyle=mid;ctx.lineWidth=size*.0035;ctx.beginPath();ctx.arc(p.x,y,r,0,TAU);ctx.stroke();
     ctx.strokeStyle=hot;ctx.beginPath();ctx.arc(p.x,y,r*.72,-2.7,-1);ctx.stroke();
   }
 }
}
export function paintHighOrbitEffect(ctx:CanvasRenderingContext2D,id:HighOrbitId,s:HighOrbitMotion,size:number,boots:OrbitPoint[],origin:HighOrbitTravel){
 const unit=size/192;
 let map=history.get(s);if(!map){map=new Map();history.set(s,map);}
 let h=map.get(size);
 if(!h||s.time<h.time||Math.abs(origin.travel-h.origin.travel)>size*8||Math.hypot(origin.x-h.origin.x,origin.y-h.origin.y)>size*.6){
   h={time:-1,origin:{...origin},lanes:[[],[]]};if(map.size>=4)map.clear();map.set(size,h);
 }
 if(s.time>h.time+1/125){
   for(let lane=0;lane<2;lane++){
     const p=boots[lane];h.lanes[lane].unshift({x:origin.travel+origin.x+(p[0]-128)*unit,y:origin.y+(p[1]-128)*unit,time:s.time,power:s.power});
     h.lanes[lane]=h.lanes[lane].filter(p=>s.time-p.time<.65).slice(0,80);
   }
   h.time=s.time;h.origin={...origin};
 }
 ctx.save();ctx.globalCompositeOperation='lighter';ctx.lineCap='round';ctx.lineJoin='round';
 for(let lane=0;lane<2;lane++){
   // A repaint can occur before the next 1/125s emission sample. Expire the
   // previous history at paint time too, before age produces a negative fade
   // and a browser rejects the nacre shell's ellipse radius.
   const points=h.lanes[lane].filter(p=>s.time>=p.time&&s.time-p.time<.65).map(p=>{const age=s.time-p.time;return {x:p.x-origin.x-origin.travel-age*size*.6,y:p.y-origin.y+age*size*.24,u:age/.65,power:p.power};});
   material(ctx,id,points,s.time,size,lane);
   const p=boots[lane],x=(p[0]-128)*unit,y=(p[1]-128)*unit,[hot,mid]=HIGH_ORBIT_PROFILES[id].colors;
   glow(ctx,x,y,size*(.025+.025*s.power),mid,.45+s.power*.25);
   glow(ctx,x,y,size*.018,hot,.6+s.power*.3);
 }
 ctx.restore();
}
/** A complete first-paint card, independent of live state and emission history. */
export function paintHighOrbitWake(ctx:CanvasRenderingContext2D,id:HighOrbitId,x:number,y:number,time:number){
 ctx.save();ctx.translate(x+21,y);ctx.globalCompositeOperation='lighter';ctx.lineCap='round';ctx.lineJoin='round';
 for(let lane=0;lane<2;lane++){
   const points=Array.from({length:37},(_,i)=>({x:-i*1.25,y:(lane?3:-3)+Math.sin(i*.08)*2,u:i/37,power:.65}));
   material(ctx,id,points,time,48,lane);
 }
 ctx.restore();
}
