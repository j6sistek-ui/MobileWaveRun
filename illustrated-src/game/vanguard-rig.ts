/**
 * Small, presentation-only canvas rig for Vanguard's registered 512px art.
 * The existing frames still supply ALL tail movement. This does not repaint,
 * recolour, resize, or substitute the character/helmet/tail artwork.
 *
 * The flattened drawing cannot expose the hidden tail behind the rear boot.
 * Accordingly that leg articulates inside its white trouser/knee area; its
 * tail-adjacent silhouette stays registered. The near leg has room to settle.
 */
export type VanguardRigPose = {
  nearArm: number; farArm: number; nearLeg: number; farLeg: number;
  /** Source pixels: positive draws the feet toward the hips for a soft tuck. */
  settle: number;
};

type Point = readonly [number, number];
type Row = readonly [number, number, number]; // y, left, right
type Patch = {
  part: 'nearArm' | 'farArm' | 'nearLeg' | 'farLeg';
  source: Float64Array; target: Float64Array;
  // influence, elbow/knee blend, wrist/ankle blend, settle blend
  weights: Float64Array;
  edges: number[];
  triangles: { a: number; b: number; c: number; det: number }[];
  shoulder: Point; elbow: Point; wrist: Point;
  upper: number; lower: number; tip: number;
  tuck: Point;
};

const clamp = (v: number, low: number, high: number) =>
  Math.max(low, Math.min(high, Number.isFinite(v) ? v : 0));
function smooth(low: number, high: number, value: number) {
  const t = clamp((value-low)/(high-low), 0, 1);
  return t*t*(3-2*t);
}
function along(x: number, y: number, a: Point, b: Point) {
  const dx=b[0]-a[0], dy=b[1]-a[1];
  return ((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy);
}
function distance(x: number, y: number, a: Point, b: Point) {
  const t=clamp(along(x,y,a,b),0,1);
  return Math.hypot(x-a[0]-(b[0]-a[0])*t,y-a[1]-(b[1]-a[1])*t);
}

function makePatch(part: Patch['part'], rows: readonly Row[], columns: number,
  shoulder: Point, elbow: Point, wrist: Point,
  upper: number, lower: number, tip: number, tuck: Point,
  innerRadius: number, outerRadius: number): Patch {
  const count=rows.length*columns;
  const source=new Float64Array(count*2), target=new Float64Array(count*2);
  const weights=new Float64Array(count*4), edges: number[]=[];
  const triangles: Patch['triangles']=[];
  for(let r=0;r<rows.length;r++) {
    const [y,left,right]=rows[r];
    for(let c=0;c<columns;c++) {
      const i=r*columns+c, x=left+(right-left)*c/(columns-1);
      source[i*2]=x; source[i*2+1]=y;
      // Every outer vertex is fixed. Thus all adjacent triangles share the
      // same boundary with the rigid drawing: no cut-out/doubled shoulders.
      const edge=r===0||r===rows.length-1||c===0||c===columns-1;
      const d=Math.min(distance(x,y,shoulder,elbow),distance(x,y,elbow,wrist));
      let influence=edge ? 0 : 1-smooth(innerRadius,outerRadius,d);
      // The near glove overlaps the torso in the flattened art. Keep the
      // chest/waist side of the cage still instead of dragging its seam.
      if(part==='nearArm') influence*=1-smooth(266,291,x);
      weights[i*4]=influence;
      weights[i*4+1]=smooth(-.08,.68,along(x,y,elbow,wrist));
      weights[i*4+2]=smooth(.62,1.14,along(x,y,elbow,wrist));
      weights[i*4+3]=smooth(.05,1.05,along(x,y,shoulder,wrist));
    }
  }
  for(let c=0;c<columns;c++) edges.push(c);
  for(let r=1;r<rows.length;r++) edges.push(r*columns+columns-1);
  for(let c=columns-2;c>=0;c--) edges.push((rows.length-1)*columns+c);
  for(let r=rows.length-2;r>0;r--) edges.push(r*columns);
  function triangle(a: number,b: number,c: number) {
    const ax=source[a*2],ay=source[a*2+1];
    triangles.push({a,b,c,det:(source[b*2]-ax)*(source[c*2+1]-ay)
      -(source[b*2+1]-ay)*(source[c*2]-ax)});
  }
  for(let r=0;r<rows.length-1;r++) for(let c=0;c<columns-1;c++) {
    const a=r*columns+c,b=a+1,d=a+columns,e=d+1;
    // Alternating diagonals avoid a single prominent shearing direction.
    if((r+c)%2) { triangle(a,b,d); triangle(b,e,d); }
    else { triangle(a,b,e); triangle(a,e,d); }
  }
  return {part,source,target,weights,edges,triangles,shoulder,elbow,wrist,
    upper,lower,tip,tuck};
}

/** Source anchors were registered against frames 1, 9 and 16. Mesh boundaries
 * deliberately avoid the helmet, pack, chest emblem and swept-tail pixels.
 * The total bound is 128 small triangle draws plus one rigid image draw;
 * topology/weights are cached, and rendering allocates no canvases or pixels.
 */
const PATCHES: readonly Patch[] = [
  makePatch('nearArm',[
    [225,244,291],[247,231,297],[271,217,301],
    [285,209,295],[300,184,288],[325,206,282],
  ],5,[272,246],[232,270],[238,298],-.90,-.76,-.18,[0,0],21,48),
  makePatch('farArm',[
    [262,337,398],[282,338,459],[309,343,478],
    [340,368,477],[370,396,465],
  ],5,[344,269],[382,292],[422,303],.40,.84,.16,[0,0],18,36),
  makePatch('nearLeg',[
    [325,223,299],[348,193,281],[376,151,258],
    [405,110,233],[434,112,208],
  ],5,[239,328],[215,369],[151,390],.27,.63,.08,[.90,-.52],23,49),
  makePatch('farLeg',[
    [290,184,198],[300,167,181],[314,149,194],[341,134,191],
    [367,144,170],
  ],4,[213,306],[166,336],[146,354],.22,.40,0,[.42,-.32],13,31),
];

function boundary(ctx: CanvasRenderingContext2D, patch: Patch, inset=0) {
  const s=patch.source,e=patch.edges;
  for(let n=0;n<e.length;n++) {
    const x=s[e[n]*2],y=s[e[n]*2+1];
    if(inset) {
      const previous=e[(n+e.length-1)%e.length],next=e[(n+1)%e.length];
      expandedCorner(ctx,n===0,s[previous*2],s[previous*2+1],x,y,
        s[next*2],s[next*2+1],-inset);
    } else if(n===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
  }
  ctx.closePath();
}

function posePatch(p: Patch, angle: number, settle: number) {
  const s=p.source,d=p.target,w=p.weights;
  const ca=Math.cos(angle*p.upper),sa=Math.sin(angle*p.upper);
  const cb=Math.cos(angle*p.lower),sb=Math.sin(angle*p.lower);
  const cc=Math.cos(angle*p.tip),sc=Math.sin(angle*p.tip);
  const [sx,sy]=p.shoulder,[ex,ey]=p.elbow,[wx,wy]=p.wrist;
  for(let i=0;i<s.length/2;i++) {
    const x=s[i*2],y=s[i*2+1],weight=w[i*4];
    if(!weight) { d[i*2]=x;d[i*2+1]=y;continue; }
    // A glove/boot can lag its forearm/shin without scaling the drawn part.
    const tip=w[i*4+2],tx=x+(wx+cc*(x-wx)-sc*(y-wy)-x)*tip;
    const ty=y+(wy+sc*(x-wx)+cc*(y-wy)-y)*tip;
    const lower=w[i*4+1];
    const bx=tx+(ex+cb*(tx-ex)-sb*(ty-ey)-tx)*lower;
    const by=ty+(ey+sb*(tx-ex)+cb*(ty-ey)-ty)*lower;
    const rx=sx+ca*(bx-sx)-sa*(by-sy),ry=sy+sa*(bx-sx)+ca*(by-sy);
    const tuck=settle*w[i*4+3];
    d[i*2]=x+(rx-x+p.tuck[0]*tuck)*weight;
    d[i*2+1]=y+(ry-y+p.tuck[1]*tuck)*weight;
  }
  // Find a CONTINUOUS non-folding limit. The former .68-step retry produced
  // a visible pop whenever one crowded cell crossed its area threshold.
  // Triangle area is quadratic in the neutral-to-posed interpolation, so
  // its first positive root gives the maximum safe motion without retries.
  let amount=1;
  for(const t of p.triangles) {
    const a=t.a*2,b=t.b*2,c=t.c*2;
    const ux=s[b]-s[a],uy=s[b+1]-s[a+1],vx=s[c]-s[a],vy=s[c+1]-s[a+1];
    const dux=d[b]-d[a]-ux,duy=d[b+1]-d[a+1]-uy;
    const dvx=d[c]-d[a]-vx,dvy=d[c+1]-d[a+1]-vy;
    const A=(dux*dvy-duy*dvx)/t.det;
    const B=(dux*vy-duy*vx+ux*dvy-uy*dvx)/t.det;
    if(Math.abs(A)<1e-8) {
      if(B<0)amount=Math.min(amount,-.76/B);
    } else {
      const discriminant=B*B-4*A*.76;
      if(discriminant>=0) {
        const root=Math.sqrt(discriminant);
        const r1=(-B-root)/(2*A),r2=(-B+root)/(2*A);
        if(r1>0)amount=Math.min(amount,r1);
        if(r2>0)amount=Math.min(amount,r2);
      }
    }
  }
  if(amount<1)for(let i=0;i<d.length;i++)d[i]=s[i]+(d[i]-s[i])*amount;
}

function expandedCorner(ctx: CanvasRenderingContext2D, first: boolean,
  px:number,py:number,x:number,y:number,nx:number,ny:number,pad:number,bevel=false) {
  const previousLength=Math.max(1,Math.hypot(x-px,y-py));
  const nextLength=Math.max(1,Math.hypot(nx-x,ny-y));
  // Source triangles use a consistent positive winding. Offset both edge
  // lines outward by the same perpendicular distance, then intersect them.
  const ax=(y-py)/previousLength,ay=(px-x)/previousLength;
  const bx=(ny-y)/nextLength,by=(x-nx)/nextLength;
  if(bevel) {
    // A bevel keeps both shifted edge lines parallel, even for thin cells.
    // Capping an acute miter shortens those offsets and reopens a hairline.
    if(first)ctx.moveTo(x+ax*pad,y+ay*pad);else ctx.lineTo(x+ax*pad,y+ay*pad);
    ctx.lineTo(x+bx*pad,y+by*pad);return;
  }
  const miter=pad/Math.max(.06,1+ax*bx+ay*by);
  const ox=x+(ax+bx)*miter,oy=y+(ay+by)*miter;
  if(first)ctx.moveTo(ox,oy);else ctx.lineTo(ox,oy);
}

function paintPatch(ctx: CanvasRenderingContext2D, frame: CanvasImageSource,
  p: Patch, overlap: number) {
  const s=p.source,d=p.target;
  ctx.save();ctx.beginPath();boundary(ctx,p);ctx.clip();
  for(const t of p.triangles) {
    const ax=s[t.a*2],ay=s[t.a*2+1],bx=s[t.b*2],by=s[t.b*2+1];
    const cx=s[t.c*2],cy=s[t.c*2+1];
    const x0=d[t.a*2],y0=d[t.a*2+1],x1=d[t.b*2],y1=d[t.b*2+1];
    const x2=d[t.c*2],y2=d[t.c*2+1];
    const m00=((x1-x0)*(cy-ay)-(x2-x0)*(by-ay))/t.det;
    const m01=((x2-x0)*(bx-ax)-(x1-x0)*(cx-ax))/t.det;
    const m10=((y1-y0)*(cy-ay)-(y2-y0)*(by-ay))/t.det;
    const m11=((y2-y0)*(bx-ax)-(y1-y0)*(cx-ax))/t.det;
    // Slightly overdraw only shared interior seams. The enclosing fixed
    // patch clip contains the overdraw so the rigid art cannot be doubled.
    ctx.save();ctx.beginPath();
    expandedCorner(ctx,true,x2,y2,x0,y0,x1,y1,overlap,true);
    expandedCorner(ctx,false,x0,y0,x1,y1,x2,y2,overlap,true);
    expandedCorner(ctx,false,x1,y1,x2,y2,x0,y0,overlap,true);
    ctx.closePath();ctx.clip();
    ctx.transform(m00,m10,m01,m11,x0-m00*ax-m01*ay,y0-m10*ax-m11*ay);
    ctx.drawImage(frame,0,0,512,512);ctx.restore();
  }
  ctx.restore();
}

type RigTexture = {
  canvas: HTMLCanvasElement | OffscreenCanvas;
  ctx: CanvasRenderingContext2D;
  frame?: CanvasImageSource;
  time?: number;
  mode?: string;
  pose: VanguardRigPose;
};
type RigTextures = { small?: RigTexture; large?: RigTexture; unavailable?: boolean };
const textures=new WeakMap<VanguardRigPose,RigTextures>();

function createTexture(size: number): RigTexture | undefined {
  try {
    const canvas=typeof OffscreenCanvas!=='undefined' ? new OffscreenCanvas(size,size)
      : typeof document!=='undefined' ? document.createElement('canvas') : undefined;
    if(!canvas) return;
    canvas.width=size;canvas.height=size;
    const ctx=canvas.getContext('2d') as CanvasRenderingContext2D | null;
    // Tests and older embedded canvases may not provide a real 2D surface.
    if(!ctx||typeof ctx.drawImage!=='function'||typeof ctx.clip!=='function'
      ||typeof ctx.transform!=='function'||typeof ctx.clearRect!=='function') return;
    return {canvas,ctx,pose:{nearArm:0,farArm:0,nearLeg:0,farLeg:0,settle:0}};
  } catch { return; }
}

function renderRig(ctx: CanvasRenderingContext2D,frame:CanvasImageSource,scale:number,
  nearArm:number,farArm:number,nearLeg:number,farLeg:number,settle:number) {
  ctx.save();ctx.translate(-280*scale,-280*scale);ctx.scale(scale,scale);
  const overlap=Math.min(3,1.4/Math.max(.05,scale));
  // Draw the body/head/pack/tail exactly once, excluding only rigged patches.
  ctx.save();ctx.beginPath();ctx.rect(0,0,512,512);
  for(const p of PATCHES) boundary(ctx,p,overlap*1.5);
  ctx.clip('evenodd');ctx.drawImage(frame,0,0,512,512);ctx.restore();
  for(const p of PATCHES) {
    const angle=p.part==='nearArm'?nearArm:p.part==='farArm'?farArm:
      p.part==='nearLeg'?nearLeg:farLeg;
    posePatch(p,angle,p.part==='nearLeg'||p.part==='farLeg'?settle:0);
    paintPatch(ctx,frame,p,overlap);
  }
  ctx.restore();
}

/** Same origin/scale as drawImage(frame,-280*scale,-280*scale,512*scale,512*scale).
 * Parameters are radians, independent of the sprite/tail clock. The intended
 * gameplay range is nearArm +/- .40, farArm -.15..+.45, legs +/- .25 and tuck
 * +/- 6px; hard limits also protect developer controls and saved preferences.
 * Positive farArm brings the forward hand down into a relaxed jetpack pose.
 * A zero pose is an exact single drawImage, useful for reduced motion/tests.
 * Pass the stable motion-state object to reuse at most two textures (192px
 * gameplay / 512px close-up). Optional state.time sets a 30Hz joint cadence;
 * sprite frame changes always render immediately, and outer body pitch is
 * still painted at the display cadence. Untimed poses refresh on any change.
 */
export function paintVanguardRig(ctx: CanvasRenderingContext2D,
  frame: CanvasImageSource, scale: number, pose: VanguardRigPose): void {
  if(!Number.isFinite(scale)||scale<=0) return;
  const nearArm=clamp(pose.nearArm,-.55,.55);
  const farArm=clamp(pose.farArm,-.40,.70);
  const nearLeg=clamp(pose.nearLeg,-.40,.40);
  const farLeg=clamp(pose.farLeg,-.35,.35);
  const settle=clamp(pose.settle,-8,8);
  if(Math.max(Math.abs(nearArm),Math.abs(farArm),Math.abs(nearLeg),
    Math.abs(farLeg),Math.abs(settle))<1e-6) {
    ctx.drawImage(frame,-280*scale,-280*scale,512*scale,512*scale);return;
  }
  let bank=textures.get(pose);
  if(!bank) { bank={};textures.set(pose,bank); }
  if(!bank.unavailable) {
    let density=1;
    if(typeof ctx.getTransform==='function') {
      const m=ctx.getTransform();
      if(m&&Number.isFinite(m.a)&&Number.isFinite(m.b)&&Number.isFinite(m.c)
        &&Number.isFinite(m.d)) density=Math.max(Math.hypot(m.a,m.b),Math.hypot(m.c,m.d))||1;
    }
    // 192px covers the ~67px game sprite at phone device-pixel densities;
    // a second 512px texture serves enlarged hangar/review canvases.
    const key=512*scale*density>256?'large':'small';
    const size=key==='large'?512:192;
    let texture=bank[key];
    if(!texture) { texture=createTexture(size);bank[key]=texture; }
    if(texture) {
      const state=pose as VanguardRigPose & {time?:number;mode?:string};
      const time=Number.isFinite(state.time)?state.time:undefined;
      const previous=texture.pose;
      const changed=nearArm!==previous.nearArm||farArm!==previous.farArm
        ||nearLeg!==previous.nearLeg||farLeg!==previous.farLeg||settle!==previous.settle;
      const due=time===undefined||texture.time===undefined||time<texture.time
        ||time-texture.time>=1/30-1e-5;
      if(texture.frame!==frame||texture.mode!==state.mode||(changed&&due)) {
        const g=texture.ctx,s=size/512;
        g.clearRect(0,0,size,size);g.save();g.translate(280*s,280*s);
        renderRig(g,frame,s,nearArm,farArm,nearLeg,farLeg,settle);g.restore();
        texture.frame=frame;texture.time=time;texture.mode=state.mode;
        previous.nearArm=nearArm;previous.farArm=farArm;
        previous.nearLeg=nearLeg;previous.farLeg=farLeg;previous.settle=settle;
      }
      ctx.drawImage(texture.canvas,-280*scale,-280*scale,512*scale,512*scale);
      return;
    }
    bank.unavailable=true;
  }
  // Functional fallback for environments without an offscreen 2D surface.
  renderRig(ctx,frame,scale,nearArm,farArm,nearLeg,farLeg,settle);
}
