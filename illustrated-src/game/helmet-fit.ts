// Where a squirrel's full head seats inside each 256px helmet painting.
// This is independent of the GLASS transparency mask: crowns, flowers, chin
// guards and an off-centre window must not set the wearer's head size.
// x/y/r are the head cavity, angle compensates the artwork's authored tilt.
export const HELMET_SEATS: Record<string, readonly [number, number, number, number?]> = {
  clear: [134,128,95], ion: [135,128,95], solar: [134,128,95],
  nebula: [134,128,95], lunar: [134,128,95,-4], void: [132,128,95],
  comet: [134,128,95], cherry: [134,128,95], royal: [135,143,59],
  aurora: [134,128,95], meteor: [134,128,95], chrono: [136,128,95],
  gemmie: [135,130,99], phoenix: [135,149,63,-2], sammie: [132,149,63],
  seraph: [137,147,60], chronarch: [133,147,64], leviathan: [145,128,62,12],
  princess: [150,160,62], verdant: [132,145,61], cryostar: [134,145,61],
  eclipse: [132,148,61], cinderforge: [130,136,99], groveguard: [134,121,94],
  cosmic: [136,137,102], sunforged: [123,122,112], abyssal: [130,139,99],
  amethyst: [131,140,100], ivoryguard: [132,138,100], reactor: [143,119,82],
};

/** Uniform scaling only. Art and the fitted head rotate together about the
 * actual skull centre, so taps and dives cannot change the helmet/head ratio. */
export function paintFittedHelmet(ctx: CanvasRenderingContext2D, image: CanvasImageSource,
  id: string, width: number, height: number, x: number, y: number, radius: number, angle = 0): boolean {
  const seat=HELMET_SEATS[id];
  if(!seat)return false;
  const scale=radius/seat[2];
  ctx.save();ctx.translate(x,y);ctx.rotate((angle+(seat[3]||0))*Math.PI/180);
  ctx.drawImage(image,-seat[0]*scale,-seat[1]*scale,width*scale,height*scale);
  ctx.restore();return true;
}
