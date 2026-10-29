// Whole regenerated helmet paintings contain continuous glass. There are no
// rear-collar cutouts: only the glass is made translucent when worn.
// These source registrations also drive export-visor-glass.mjs. The entire
// artwork is uniformly resized/translated, including crowns and neck guards.
export const NORMALIZED_GLASS = [128, 136, 80] as const;
export const SOURCE_GLASS = {
  "royal": [124, 156, 98],
  "chronarch": [127.1, 120.5, 125.6],
  "sammie": [138, 103, 108.2],
  "princess": [127.3, 96.8, 126],
  "phoenix": [130, 116, 129.2],
  "seraph": [125, 151, 110],
  "cryostar": [126, 121, 134.6],
  "verdant": [141, 116, 126.6],
  "eclipse": [127, 129, 138.4],
  "leviathan": [129.8, 110.6, 103.6]
} as const;

// Paths follow the interior pane of each new painting; lacquer, flowers,
// jewels, gears, halo, crown and chin guard keep their original painted alpha.
const PANES: Record<string, number[]> = {
  royal: [75,180, 62,142,82,85,125,81, 180,63,220,101,220,159, 220,193,200,222,174,231, 129,226,90,211,75,180],
  chronarch: [63,154, 49,108,70,43,124,24, 183,6,235,40,249,102, 262,159,224,215,189,229, 140,235,76,196,63,154],
  sammie: [66,140, 62,121,76,108,68,99, 98,81,163,67,215,75, 242,101,247,170,185,198, 131,199,72,178,66,140],
  princess: [137,127, 128,102,147,55,179,52, 221,47,247,72,245,115, 245,140,228,162,222,175, 184,171,151,153,137,127],
  phoenix: [60,152, 50,129,68,111,57,101, 64,58,98,24,141,20, 204,8,246,62,249,110, 258,159,225,215,191,231, 145,232,77,194,60,152],
  seraph: [78,174, 69,129,95,78,133,66, 180,55,211,85,226,126, 239,171,211,216,185,230, 143,232,90,204,78,174],
  cryostar: [81,163, 60,117,76,49,123,38, 175,23,224,48,237,98, 251,143,229,189,194,208, 158,212,105,193,81,163],
  verdant: [67,157, 64,106,94,51,135,34, 182,13,222,41,237,87, 253,134,230,186,189,207, 151,212,87,184,67,157],
  eclipse: [66,157, 58,108,84,60,132,38, 180,19,221,51,235,97, 253,145,229,193,187,214, 143,210,85,187,66,157],
  leviathan: [104,115, 90,80,103,35,138,25, 172,10,210,38,225,76, 244,107,221,148,196,165, 164,169,116,144,104,115],
};

export function clipHelmetGlass(ctx: CanvasRenderingContext2D, id: string): void {
  const p=PANES[id],g=SOURCE_GLASS[id as keyof typeof SOURCE_GLASS];
  if (!p || !g) return;
  ctx.save();
  ctx.translate(NORMALIZED_GLASS[0],NORMALIZED_GLASS[1]);
  ctx.scale(NORMALIZED_GLASS[2]/g[2],NORMALIZED_GLASS[2]/g[2]);
  ctx.translate(-g[0],-g[1]);
  ctx.beginPath();ctx.moveTo(p[0],p[1]);
  for(let i=2;i<p.length;i+=6)ctx.bezierCurveTo(p[i],p[i+1],p[i+2],p[i+3],p[i+4],p[i+5]);
  ctx.closePath();ctx.restore();ctx.clip();
}
