/** Static fitting of the six armoured squirrel rigs. These values never vary
 * with a pose: breadth is perpendicular to the bone, leaving both joints and
 * the boot emitter in place. A reversed source boot is registered once, rather
 * than turning the leg or mirroring the entire character during animation. */
export function rigLimbFit(id:string,index:number) {
  const leg=index>=6&&index<=9;
  const breadth=leg?(id==='arcflash'?(index%2===0?1.28:1.22):(index%2===0?1.42:1.48)):1;
  const reversed=index===9&&['arcflash','cinderforge','groveguard','cosmic'].includes(id);
  return {breadth,facing:reversed?-1:1};
}

type Point=readonly [number,number];
type Anchors={a:Point;b:Point};
/** Canvas affine coefficients also locate measured toe/heel landmarks for
 * the anatomy review. Both ends of the source bone map exactly to a and b. */
export function rigPartMatrix(spec:Anchors,a:Point,b:Point,breadth=1,facing=1) {
  const sx=spec.b[0]-spec.a[0],sy=spec.b[1]-spec.a[1],length=Math.hypot(sx,sy);
  const ux=sx/length,uy=sy/length,tx=b[0]-a[0],ty=b[1]-a[1];
  const width=breadth*facing;
  const m00=(tx*ux+ty*uy*width)/length,m01=(tx*uy-ty*ux*width)/length;
  const m10=(ty*ux-tx*uy*width)/length,m11=(ty*uy+tx*ux*width)/length;
  return [m00,m10,m01,m11,a[0]-m00*spec.a[0]-m01*spec.a[1],a[1]-m10*spec.a[0]-m11*spec.a[1]] as const;
}
