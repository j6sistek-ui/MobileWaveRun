// The retro renderer: the live game's vector art, ported so a shift
// genuinely lands you in the OTHER game rather than a filtered version of
// this one. Everything below draws the same simulation — same planets,
// same rocks, same pickups — in the shipped game's own hand.
//
// The bodies of retroPlanet, retroObstacle, retroAcorn and drawRays are
// carried across from index.html unchanged, so a fix there ports straight
// here. Only three things were adapted: `ctx` arrives as a parameter
// instead of a module global, the environment table is namespaced, and
// planet kinds wrap into live's sixteen.

type Ctx = CanvasRenderingContext2D;

export const RETRO_OB_TYPES = ['asteroid', 'debris', 'satellite', 'ufo', 'crystal', 'rock', 'junk'];

const _rgba: Record<string, string> = {};
function withAlpha(hex: string, a: number) {
  const key = hex + '|' + a;
  const v = _rgba[key];
  if (v) return v;
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h[0] + h[0] + h[1] + h[1] + h[2] + h[2] : h;
  const n = parseInt(full, 16);
  return (_rgba[key] = 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')');
}

export const RETRO_ENVS: any[] = [
  { name: 'DEEP SPACE',     top: [7, 11, 24],  bot: [12, 18, 40],
    wash: [40, 60, 110, 0.12],  wash2: [70, 90, 160, 0.05],
    obTypes: ['asteroid', 'debris', 'satellite', 'ufo', 'crystal', 'rock', 'junk'],
    obAccent: null, crystal: null },
  { name: 'NEBULA NURSERY', top: [18, 9, 38],  bot: [30, 14, 54],
    wash: [150, 70, 210, 0.13], wash2: [255, 110, 180, 0.07],
    obTypes: ['crystal', 'crystal', 'debris', 'ufo', 'asteroid'],
    obAccent: '#c060ff',
    crystal: ['rgba(255,190,250,0.95)', 'rgba(210,80,235,0.9)', 'rgba(110,25,150,0.85)'] },
  { name: 'ICE MOON',       top: [5, 16, 28],  bot: [10, 28, 44],
    obTypes: ['crystal', 'crystal', 'rock', 'asteroid', 'satellite'],
    wash: [90, 180, 220, 0.1],  wash2: [160, 230, 255, 0.05],
    obAccent: '#9ad8ee',
    crystal: ['rgba(235,250,255,0.95)', 'rgba(140,210,240,0.9)', 'rgba(40,110,160,0.85)'] },
  { name: 'SOLAR FURNACE',  top: [26, 11, 6],  bot: [40, 16, 8],
    wash: [255, 120, 40, 0.09], wash2: [255, 80, 60, 0.06],
    obTypes: ['asteroid', 'rock', 'rock', 'junk', 'debris'],
    obAccent: '#ff7a30',
    crystal: ['rgba(255,230,170,0.95)', 'rgba(255,140,50,0.9)', 'rgba(150,40,10,0.85)'] },
  { name: 'CRYSTAL BELT',   top: [13, 10, 32], bot: [16, 26, 48],
    wash: [140, 220, 255, 0.09], wash2: [200, 140, 255, 0.06],
    obTypes: ['crystal', 'crystal', 'crystal', 'satellite', 'asteroid'],
    obAccent: '#8fd0ff',
    crystal: ['rgba(220,245,255,0.95)', 'rgba(130,180,255,0.9)', 'rgba(60,70,180,0.85)'] },
  { name: 'TIME FRACTURE',  top: [6, 20, 16],  bot: [10, 30, 24],
    wash: [90, 255, 180, 0.07], wash2: [200, 255, 120, 0.04],
    obTypes: ['junk', 'satellite', 'ufo', 'crystal', 'debris'],
    obAccent: '#5dffa0',
    crystal: ['rgba(220,255,230,0.95)', 'rgba(90,230,160,0.9)', 'rgba(20,110,70,0.85)'] },
  // ——— gates 120+ · the deep run (every 20, up to 500 and beyond) ———
  { name: 'MONOCHROME VOID', top: [10, 10, 12], bot: [26, 26, 30],
    wash: [255, 255, 255, 0.07], wash2: [140, 140, 150, 0.05],
    obTypes: ['asteroid', 'rock', 'debris', 'satellite', 'crystal'],
    obAccent: '#cfcfd6',
    crystal: ['rgba(250,250,252,0.95)', 'rgba(170,170,180,0.9)', 'rgba(70,70,80,0.85)'] },
  { name: 'EMERALD EXPANSE', top: [3, 20, 10],  bot: [6, 36, 18],
    wash: [40, 255, 120, 0.1],  wash2: [140, 255, 80, 0.05],
    obTypes: ['crystal', 'crystal', 'rock', 'asteroid', 'debris'],
    obAccent: '#4dff88',
    crystal: ['rgba(220,255,225,0.95)', 'rgba(80,240,140,0.9)', 'rgba(12,110,50,0.85)'] },
  { name: 'CRIMSON STORM',   top: [26, 4, 6],   bot: [44, 8, 10],
    wash: [255, 50, 50, 0.11],  wash2: [255, 110, 60, 0.06],
    obTypes: ['asteroid', 'rock', 'junk', 'debris', 'crystal'],
    obAccent: '#ff5548',
    crystal: ['rgba(255,220,215,0.95)', 'rgba(245,90,75,0.9)', 'rgba(120,18,20,0.85)'] },
  { name: 'SAPPHIRE ABYSS',  top: [3, 8, 30],   bot: [6, 16, 52],
    wash: [50, 110, 255, 0.12], wash2: [90, 180, 255, 0.06],
    obTypes: ['crystal', 'satellite', 'asteroid', 'debris', 'ufo'],
    obAccent: '#4d8cff',
    crystal: ['rgba(215,235,255,0.95)', 'rgba(80,140,250,0.9)', 'rgba(18,40,140,0.85)'] },
  { name: 'VIOLET REALM',    top: [16, 4, 30],  bot: [28, 8, 50],
    wash: [170, 60, 255, 0.12], wash2: [220, 120, 255, 0.06],
    obTypes: ['crystal', 'crystal', 'ufo', 'satellite', 'asteroid'],
    obAccent: '#b45cff',
    crystal: ['rgba(240,220,255,0.95)', 'rgba(180,95,250,0.9)', 'rgba(70,20,130,0.85)'] },
  { name: 'GOLDEN HOUR',     top: [30, 18, 4],  bot: [48, 30, 8],
    wash: [255, 190, 60, 0.1],  wash2: [255, 150, 40, 0.06],
    rays: [255, 210, 110],
    obTypes: ['asteroid', 'rock', 'satellite', 'debris', 'crystal'],
    obAccent: '#ffc95c',
    crystal: ['rgba(255,242,205,0.95)', 'rgba(250,185,70,0.9)', 'rgba(140,90,15,0.85)'] },
  { name: 'SOLAR CORONA',    top: [34, 22, 10], bot: [20, 10, 4],
    wash: [255, 240, 180, 0.12], wash2: [255, 180, 80, 0.07],
    rays: [255, 245, 200], pulse: 0.5,
    obTypes: ['rock', 'rock', 'asteroid', 'junk', 'debris'],
    obAccent: '#ffe9a8',
    crystal: ['rgba(255,252,235,0.95)', 'rgba(255,215,120,0.9)', 'rgba(160,110,30,0.85)'] },
  { name: 'HYPERVIVID',      top: [20, 0, 40],  bot: [0, 40, 44],
    wash: [255, 0, 150, 0.16],  wash2: [0, 255, 200, 0.12], pulse: 0.35,
    obTypes: ['crystal', 'crystal', 'ufo', 'satellite', 'junk'],
    obAccent: '#ff4fd8',
    crystal: ['rgba(255,225,250,0.95)', 'rgba(255,60,190,0.9)', 'rgba(0,150,140,0.85)'] },
  { name: 'NEON BAZAAR',     top: [12, 2, 24],  bot: [4, 20, 34],
    wash: [0, 229, 255, 0.14],  wash2: [255, 60, 190, 0.1],
    obTypes: ['ufo', 'satellite', 'junk', 'crystal', 'debris'],
    obAccent: '#39e6ff',
    crystal: ['rgba(220,250,255,0.95)', 'rgba(60,225,255,0.9)', 'rgba(160,20,120,0.85)'] },
  { name: 'ALIEN JUNGLE',    top: [4, 18, 6],   bot: [10, 32, 14],
    wash: [90, 255, 60, 0.09],  wash2: [200, 90, 255, 0.06],
    obTypes: ['crystal', 'rock', 'rock', 'asteroid', 'debris'],
    obAccent: '#7dff4d',
    crystal: ['rgba(230,255,215,0.95)', 'rgba(130,240,80,0.9)', 'rgba(90,30,140,0.85)'] },
  { name: 'ACID SWAMP',      top: [14, 18, 2],  bot: [24, 30, 6],
    wash: [190, 255, 40, 0.1],  wash2: [90, 200, 30, 0.06], dim: 0.25,
    obTypes: ['rock', 'junk', 'junk', 'debris', 'crystal'],
    obAccent: '#c8f03c',
    crystal: ['rgba(245,255,210,0.95)', 'rgba(190,235,60,0.9)', 'rgba(80,110,10,0.85)'] },
  { name: 'CORAL SHALLOWS',  top: [2, 16, 24],  bot: [4, 30, 40],
    wash: [40, 220, 210, 0.11], wash2: [255, 120, 110, 0.07],
    obTypes: ['crystal', 'crystal', 'rock', 'asteroid', 'satellite'],
    obAccent: '#3fe0cf',
    crystal: ['rgba(225,255,250,0.95)', 'rgba(70,225,205,0.9)', 'rgba(190,80,70,0.85)'] },
  { name: 'BONE DESERT',     top: [22, 20, 16], bot: [38, 34, 26],
    wash: [230, 220, 190, 0.08], wash2: [180, 150, 110, 0.05], dim: 0.3,
    obTypes: ['rock', 'rock', 'asteroid', 'debris', 'junk'],
    obAccent: '#d9cfae',
    crystal: ['rgba(250,246,232,0.95)', 'rgba(215,200,160,0.9)', 'rgba(110,95,60,0.85)'] },
  { name: 'PULSAR FIELD',    top: [6, 8, 22],   bot: [10, 14, 36],
    wash: [120, 160, 255, 0.14], wash2: [200, 220, 255, 0.08], pulse: 1.0,
    obTypes: ['satellite', 'satellite', 'crystal', 'debris', 'asteroid'],
    obAccent: '#9db8ff',
    crystal: ['rgba(235,242,255,0.95)', 'rgba(150,180,255,0.9)', 'rgba(50,60,150,0.85)'] },
  { name: 'BLACKOUT ZONE',   top: [2, 2, 4],    bot: [6, 6, 10],
    wash: [60, 70, 110, 0.08],  wash2: [30, 34, 60, 0.05],
    dim: 0.85, pulse: 0.6,
    obTypes: ['debris', 'junk', 'asteroid', 'satellite', 'rock'],
    obAccent: '#5a6a9a',
    crystal: ['rgba(200,210,235,0.95)', 'rgba(90,105,160,0.9)', 'rgba(25,30,55,0.85)'] },
  { name: 'AURORA CROWN',    top: [3, 12, 20],  bot: [8, 24, 30],
    wash: [60, 255, 190, 0.12], wash2: [140, 120, 255, 0.07],
    rays: [110, 255, 200],
    obTypes: ['crystal', 'crystal', 'satellite', 'asteroid', 'ufo'],
    obAccent: '#5affc8',
    crystal: ['rgba(225,255,245,0.95)', 'rgba(90,240,195,0.9)', 'rgba(80,60,180,0.85)'] },
  { name: 'RUST BELT',       top: [20, 10, 6],  bot: [34, 18, 10],
    wash: [200, 110, 50, 0.09], wash2: [140, 70, 40, 0.06],
    obTypes: ['junk', 'junk', 'satellite', 'debris', 'rock'],
    obAccent: '#cf7a3a',
    crystal: ['rgba(250,230,210,0.95)', 'rgba(205,125,60,0.9)', 'rgba(95,50,25,0.85)'] },
  { name: 'GHOST NEBULA',    top: [12, 14, 20], bot: [20, 24, 32],
    wash: [200, 210, 235, 0.07], wash2: [150, 160, 200, 0.05], dim: 0.45,
    obTypes: ['debris', 'crystal', 'asteroid', 'satellite', 'ufo'],
    obAccent: '#c4ccdf',
    crystal: ['rgba(240,244,252,0.95)', 'rgba(185,195,225,0.9)', 'rgba(85,95,130,0.85)'] },
  { name: 'PRISM STORM',     top: [10, 6, 24],  bot: [24, 6, 30],
    wash: [255, 220, 0, 0.1],   wash2: [0, 190, 255, 0.1], pulse: 0.4,
    obTypes: ['crystal', 'crystal', 'crystal', 'ufo', 'satellite'],
    obAccent: '#ffd23f',
    crystal: ['rgba(255,250,220,0.95)', 'rgba(80,200,255,0.9)', 'rgba(200,40,180,0.85)'] },
  { name: 'EVENT HORIZON',   top: [4, 2, 8],    bot: [10, 4, 18],
    wash: [140, 40, 255, 0.12], wash2: [40, 0, 80, 0.08],
    dim: 0.6, pulse: 0.8, rays: [170, 90, 255],
    obTypes: ['debris', 'asteroid', 'crystal', 'junk', 'ufo'],
    obAccent: '#9a4dff',
    crystal: ['rgba(235,220,255,0.95)', 'rgba(155,80,250,0.9)', 'rgba(50,10,95,0.85)'] },
];

function drawRays(ctx: Ctx, W: number, H: number, env: any, weight: number) {
  if (!env.rays || weight <= 0.01) return;
  const t = performance.now() / 1000;
  const [r, gc, b] = env.rays;
  ctx.save();
  const sx = W * 0.82, sy = -H * 0.06;
  for (let i = 0; i < 5; i++) {
    const ang = 1.55 + i * 0.22 + Math.sin(t * 0.13 + i * 1.7) * 0.05;
    const halfW = 0.045 + (i % 2) * 0.02;
    const len = H * 1.25;
    ctx.fillStyle = 'rgba(' + r + ',' + gc + ',' + b + ',' +
                    (weight * (0.05 + 0.02 * Math.sin(t * 0.4 + i))).toFixed(3) + ')';
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + Math.cos(ang - halfW) * len, sy + Math.sin(ang - halfW) * len);
    ctx.lineTo(sx + Math.cos(ang + halfW) * len, sy + Math.sin(ang + halfW) * len);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

export function retroObstacle(ctx: Ctx, x: number, y: number, b: any) {
  const r = b.r;
  const type = b.type || 'asteroid';
  const seed = b.seed || 0;
  const rot = (b.rot || 0) + (b.spin || 0) * (performance.now() / 1000);
  const bEnv = RETRO_ENVS[(b.env || 0) % RETRO_ENVS.length];

  // environment aura behind the obstacle — the region's colour signature
  if (bEnv.obAccent) {
    const ag = ctx.createRadialGradient(x, y, r * 0.5, x, y, r * 1.6);
    ag.addColorStop(0, withAlpha(bEnv.obAccent, 0.16));
    ag.addColorStop(1, withAlpha(bEnv.obAccent, 0));
    ctx.fillStyle = ag;
    ctx.beginPath();
    ctx.arc(x, y, r * 1.6, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);

  // soft contact shadow under every obstacle
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(2, r * 0.55, r * 0.7, r * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();

  if (type === 'asteroid') {
    // irregular body
    const pts = 8;
    ctx.beginPath();
    for (let i = 0; i <= pts; i++) {
      const a = (i / pts) * Math.PI * 2;
      const jitter = 0.72 + ((seed * (i + 3)) % 9) / 22;
      const px = Math.cos(a) * r * jitter;
      const py = Math.sin(a) * r * jitter;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    const grd = ctx.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.08, 0, 0, r);
    grd.addColorStop(0, '#c8b8a0');
    grd.addColorStop(0.45, '#8a7a64');
    grd.addColorStop(1, '#3a3028');
    ctx.fillStyle = grd;
    ctx.fill();
    // rim
    ctx.strokeStyle = 'rgba(255,230,200,0.18)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // craters with rims
    for (let i = 0; i < 4; i++) {
      const a = (seed * 0.7 + i * 1.7) % (Math.PI * 2);
      const d = r * (0.2 + (i % 3) * 0.15);
      const cr = r * (0.1 + (i % 3) * 0.05);
      const cx = Math.cos(a) * d, cy = Math.sin(a) * d;
      ctx.fillStyle = 'rgba(25,20,15,0.5)';
      ctx.beginPath(); ctx.arc(cx, cy, cr, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(180,160,130,0.25)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  } else if (type === 'debris') {
    // main plate
    const grd = ctx.createLinearGradient(-r, -r, r, r);
    grd.addColorStop(0, '#9aa2aa');
    grd.addColorStop(0.5, '#5a626c');
    grd.addColorStop(1, '#2a3038');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.moveTo(-r * 0.95, -r * 0.25);
    ctx.lineTo(r * 0.55, -r * 0.85);
    ctx.lineTo(r * 0.95, r * 0.15);
    ctx.lineTo(-r * 0.35, r * 0.8);
    ctx.closePath();
    ctx.fill();
    // secondary shard
    ctx.fillStyle = '#4a525c';
    ctx.beginPath();
    ctx.moveTo(-r * 0.55, r * 0.05);
    ctx.lineTo(r * 0.25, -r * 0.3);
    ctx.lineTo(r * 0.1, r * 0.6);
    ctx.closePath();
    ctx.fill();
    // heat edge
    ctx.strokeStyle = 'rgba(255,100,30,0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-r * 0.95, -r * 0.25);
    ctx.lineTo(r * 0.55, -r * 0.85);
    ctx.stroke();
    // rivets
    ctx.fillStyle = '#c0c8d0';
    [[-0.4,-0.1],[0.2,-0.4],[0.4,0.05],[-0.15,0.4]].forEach(([dx,dy]) => {
      ctx.beginPath(); ctx.arc(dx * r, dy * r, 1.6, 0, Math.PI * 2); ctx.fill();
    });
  } else if (type === 'satellite') {
    // body
    const bg = ctx.createLinearGradient(-r * 0.4, -r * 0.5, r * 0.4, r * 0.5);
    bg.addColorStop(0, '#e8eef4');
    bg.addColorStop(1, '#687480');
    ctx.fillStyle = bg;
    ctx.fillRect(-r * 0.38, -r * 0.45, r * 0.76, r * 0.9);
    // window
    ctx.fillStyle = 'rgba(80,180,255,0.55)';
    ctx.fillRect(-r * 0.18, -r * 0.25, r * 0.36, r * 0.28);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(-r * 0.18, -r * 0.25, r * 0.36, r * 0.28);
    // solar panels
    const panel = (x0: number) => {
      const pg = ctx.createLinearGradient(x0, 0, x0 + r * 0.55, 0);
      pg.addColorStop(0, '#1a4a7a');
      pg.addColorStop(0.5, '#3a8ad0');
      pg.addColorStop(1, '#1a4a7a');
      ctx.fillStyle = pg;
      ctx.fillRect(x0, -r * 0.3, r * 0.55, r * 0.6);
      ctx.strokeStyle = 'rgba(120,200,255,0.45)';
      ctx.lineWidth = 1;
      for (let i = 1; i < 4; i++) {
        const py = -r * 0.3 + i * r * 0.15;
        ctx.beginPath(); ctx.moveTo(x0 + 2, py); ctx.lineTo(x0 + r * 0.53, py); ctx.stroke();
      }
      for (let i = 1; i < 3; i++) {
        const px = x0 + i * r * 0.18;
        ctx.beginPath(); ctx.moveTo(px, -r * 0.28); ctx.lineTo(px, r * 0.28); ctx.stroke();
      }
    };
    panel(-r * 1.1);
    panel(r * 0.55);
    // dish / antenna
    ctx.strokeStyle = '#d0d8e0';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -r * 0.45); ctx.lineTo(0, -r * 0.95); ctx.stroke();
    ctx.fillStyle = '#ff5050';
    ctx.beginPath(); ctx.arc(0, -r * 1.0, r * 0.12, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(0, -r * 0.7, r * 0.22, -2.2, -0.6); ctx.stroke();
  } else if (type === 'ufo') {
    // hull
    const hull = ctx.createRadialGradient(0, -r * 0.15, r * 0.1, 0, 0, r * 1.1);
    hull.addColorStop(0, '#f0f4f8');
    hull.addColorStop(0.4, '#90a0b8');
    hull.addColorStop(1, '#303848');
    ctx.fillStyle = hull;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 1.15, r * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    // rim ring
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 1.05, r * 0.32, 0, 0, Math.PI * 2);
    ctx.stroke();
    // dome
    const dome = ctx.createRadialGradient(-r * 0.1, -r * 0.35, r * 0.05, 0, -r * 0.15, r * 0.5);
    dome.addColorStop(0, 'rgba(180,240,255,0.85)');
    dome.addColorStop(0.6, 'rgba(60,160,220,0.55)');
    dome.addColorStop(1, 'rgba(20,60,100,0.35)');
    ctx.fillStyle = dome;
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.18, r * 0.5, r * 0.4, 0, Math.PI, 0);
    ctx.fill();
    ctx.strokeStyle = 'rgba(200,240,255,0.5)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // underglow lights
    for (let i = 0; i < 6; i++) {
      const a = -1.0 + i * 0.4;
      ctx.fillStyle = i % 2 ? '#ffd040' : '#40f0ff';
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * r * 0.75, Math.sin(a) * r * 0.22 + r * 0.05, r * 0.09, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
  } else if (type === 'crystal') {
    // outer crystal, cut in the environment's colours
    const cc = bEnv.crystal || ['rgba(220,180,255,0.95)', 'rgba(140,70,230,0.9)', 'rgba(60,20,120,0.85)'];
    const cg = ctx.createLinearGradient(0, -r, 0, r);
    cg.addColorStop(0, cc[0]);
    cg.addColorStop(0.45, cc[1]);
    cg.addColorStop(1, cc[2]);
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.moveTo(0, -r * 1.05);
    ctx.lineTo(r * 0.6, -r * 0.1);
    ctx.lineTo(r * 0.35, r * 0.9);
    ctx.lineTo(-r * 0.4, r * 0.75);
    ctx.lineTo(-r * 0.65, -r * 0.15);
    ctx.closePath();
    ctx.fill();
    // inner highlight facet
    ctx.fillStyle = 'rgba(255,240,255,0.45)';
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.75);
    ctx.lineTo(r * 0.28, -r * 0.05);
    ctx.lineTo(0, r * 0.35);
    ctx.lineTo(-r * 0.28, -r * 0.05);
    ctx.closePath();
    ctx.fill();
    // edge shine
    ctx.strokeStyle = 'rgba(255,255,255,0.65)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-r * 0.2, -r * 0.55);
    ctx.lineTo(r * 0.15, r * 0.25);
    ctx.stroke();
    // glow
    ctx.strokeStyle = 'rgba(180,100,255,0.35)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, -r * 1.05);
    ctx.lineTo(r * 0.6, -r * 0.1);
    ctx.stroke();
  } else if (type === 'rock') {
    const rg = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
    rg.addColorStop(0, '#9a9080');
    rg.addColorStop(0.5, '#5a5048');
    rg.addColorStop(1, '#2a2420');
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.98, r * 0.82, 0.35, 0, Math.PI * 2);
    ctx.fill();
    // lumps
    ctx.fillStyle = '#7a7060';
    ctx.beginPath();
    ctx.ellipse(-r * 0.25, -r * 0.28, r * 0.4, r * 0.32, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(20,16,12,0.45)';
    ctx.beginPath(); ctx.arc(r * 0.3, r * 0.2, r * 0.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(-r * 0.35, r * 0.28, r * 0.14, 0, Math.PI * 2); ctx.fill();
    // highlight
    ctx.strokeStyle = 'rgba(220,200,170,0.25)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(-r * 0.15, -r * 0.35, r * 0.35, r * 0.2, -0.4, 0, Math.PI * 2);
    ctx.stroke();
  } else { // junk
    // barrel body
    const jg = ctx.createLinearGradient(-r * 0.7, 0, r * 0.7, 0);
    jg.addColorStop(0, '#5a3a20');
    jg.addColorStop(0.4, '#c08040');
    jg.addColorStop(1, '#4a3018');
    ctx.fillStyle = jg;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.72, r * 0.95, 0, 0, Math.PI * 2);
    ctx.fill();
    // bands
    ctx.strokeStyle = '#e0a860';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.ellipse(0, -r * 0.35, r * 0.72, r * 0.22, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, r * 0.35, r * 0.72, r * 0.22, 0, 0, Math.PI * 2); ctx.stroke();
    // rust spots
    ctx.fillStyle = 'rgba(80,40,10,0.4)';
    ctx.beginPath(); ctx.arc(-r * 0.25, r * 0.1, r * 0.15, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(r * 0.3, -r * 0.15, r * 0.1, 0, Math.PI * 2); ctx.fill();
    // metal strut
    ctx.strokeStyle = '#b0b8c0';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(r * 0.45, -r * 0.7);
    ctx.lineTo(r * 1.15, r * 0.35);
    ctx.stroke();
    // joint ball
    const bg2 = ctx.createRadialGradient(r * 1.1, r * 0.3, 1, r * 1.15, r * 0.35, r * 0.2);
    bg2.addColorStop(0, '#e0e8f0');
    bg2.addColorStop(1, '#505860');
    ctx.fillStyle = bg2;
    ctx.beginPath();
    ctx.arc(r * 1.15, r * 0.35, r * 0.18, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

export function retroPlanet(ctx: Ctx, x: number, y: number, r: number, kind0: number) {
  const kind = ((kind0 % 16) + 16) % 16;
  const palettes = [
    // 0 ocean earth
    ['#2a6aa8', '#1a4068', '#6eb8e8', '#3a9a5a', '#1a5a38'],
    // 1 golden ringed
    ['#d4a84a', '#a07828', '#f0d88a', '#c9a04a', '#8a6020'],
    // 2 icy moon
    ['#b0c0d0', '#788898', '#e8f0f8', '#a0b0c0', '#606878'],
    // 3 lava / mars
    ['#c04020', '#701808', '#e87040', '#a03018', '#ff9040'],
    // 4 teal gas
    ['#1a9080', '#0c5848', '#5ad0b8', '#2a8070', '#0a4038'],
    // 5 rock grey
    ['#6a6e78', '#3c4048', '#a0a4ac', '#5a5e66', '#2a2c30'],
    // 6 desert
    ['#b07030', '#704018', '#e0a060', '#986028', '#503010'],
    // 7 deep blue gas
    ['#142850', '#081830', '#3a68a0', '#1e4070', '#0a1830'],
    // 8 pink alien
    ['#c06078', '#782840', '#e8a0b0', '#a04858', '#501828'],
    // 9 jungle canopy
    ['#3f8f3a', '#245c1e', '#8ed17a', '#5cae4e', '#173d12'],
    // 10 amethyst crystal
    ['#8f6fd0', '#5a3f96', '#cbb2ff', '#a98fe8', '#3a2668'],
    // 11 night city
    ['#2e3a52', '#18202e', '#5a739c', '#3d4f70', '#0e131c'],
    // 12 watcher (eyeball)
    ['#d8cfc0', '#a89a88', '#f4efe4', '#c7bcab', '#6e6353'],
    // 13 candy stripe
    ['#e86a8a', '#b03a58', '#ffb6c8', '#f090a8', '#7c2340'],
    // 14 shattered core
    ['#7a6a5a', '#4a3e32', '#b0a08c', '#93816d', '#2c241c'],
    // 15 aurora ice giant
    ['#3a7fa8', '#1e4e70', '#8fd4f0', '#5aa8cc', '#12324a'],
  ];
  const [c1, c2, c3, c4, c5] = palettes[kind % palettes.length];

  // soft outer atmosphere glow
  const atmo = ctx.createRadialGradient(x, y, r * 0.9, x, y, r * 1.25);
  atmo.addColorStop(0, 'rgba(0,0,0,0)');
  atmo.addColorStop(0.7, 'rgba(160,200,255,0.04)');
  atmo.addColorStop(1, 'rgba(160,200,255,0)');
  ctx.fillStyle = atmo;
  ctx.beginPath();
  ctx.arc(x, y, r * 1.25, 0, Math.PI * 2);
  ctx.fill();

  // base sphere with richer lighting
  const grd = ctx.createRadialGradient(x - r * 0.4, y - r * 0.4, r * 0.04, x + r * 0.15, y + r * 0.2, r * 1.05);
  grd.addColorStop(0, c3);
  grd.addColorStop(0.35, c1);
  grd.addColorStop(0.75, c2);
  grd.addColorStop(1, c5 || c2);
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  // surface detail (clipped)
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();

  if (kind === 0) { // earth continents + clouds
    ctx.fillStyle = c4;
    ctx.globalAlpha = 0.65;
    [[-0.2,-0.15,0.5,0.32,-0.5],[0.28,0.18,0.35,0.22,0.4],[-0.05,0.35,0.28,0.18,0.1]].forEach(([dx,dy,rx,ry,rot]) => {
      ctx.beginPath();
      ctx.ellipse(x+dx*r, y+dy*r, r*rx, r*ry, rot, 0, Math.PI*2);
      ctx.fill();
    });
    // cloud wisps
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.22;
    [[0.1,-0.3,0.3,0.1],[ -0.3,0.1,0.25,0.08],[0.25,0.3,0.2,0.07]].forEach(([dx,dy,rx,ry]) => {
      ctx.beginPath();
      ctx.ellipse(x+dx*r, y+dy*r, r*rx, r*ry, 0, 0, Math.PI*2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  } else if (kind === 1 || kind === 7) { // gas bands
    for (let i = -3; i <= 3; i++) {
      ctx.strokeStyle = i % 2 === 0 ? c4 : c5;
      ctx.globalAlpha = 0.28 + (i % 2) * 0.1;
      ctx.lineWidth = r * (0.1 + Math.abs(i) * 0.02);
      ctx.beginPath();
      ctx.ellipse(x, y + i * r * 0.18, r * 0.96, r * 0.16, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    // storm oval
    ctx.fillStyle = c3;
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.ellipse(x + r * 0.25, y + r * 0.1, r * 0.22, r * 0.14, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  } else if (kind === 2 || kind === 5) { // craters + maria
    ctx.fillStyle = c5;
    ctx.globalAlpha = 0.35;
    [[-0.3,-0.25,0.22],[0.25,0.1,0.18],[-0.05,0.35,0.15],[0.35,-0.3,0.12],[-0.35,0.15,0.1],[0.1,-0.05,0.08]].forEach(([dx,dy,s]) => {
      ctx.beginPath();
      ctx.arc(x + dx * r, y + dy * r, r * s, 0, Math.PI * 2);
      ctx.fill();
      // rim highlight
      ctx.strokeStyle = c3;
      ctx.globalAlpha = 0.25;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = c5;
    });
    ctx.globalAlpha = 1;
  } else if (kind === 3) { // lava + cracks
    ctx.fillStyle = c5;
    ctx.globalAlpha = 0.55;
    [[-0.15,-0.2,0.2],[0.2,0.15,0.18],[-0.25,0.25,0.12]].forEach(([dx,dy,s]) => {
      ctx.beginPath();
      ctx.arc(x + dx * r, y + dy * r, r * s, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.strokeStyle = '#ff9040';
    ctx.globalAlpha = 0.6;
    ctx.lineWidth = 2.2;
    [[-0.45,-0.2,0.1,0.15,0.4,-0.1],[-0.2,0.3,0.15,0.05,0.45,0.2],[0.1,-0.35,0.0,-0.1,0.3,0.05]].forEach(([x1,y1,cx,cy,x2,y2]) => {
      ctx.beginPath();
      ctx.moveTo(x + x1 * r, y + y1 * r);
      ctx.quadraticCurveTo(x + cx * r, y + cy * r, x + x2 * r, y + y2 * r);
      ctx.stroke();
    });
    ctx.globalAlpha = 1;
  } else if (kind === 4 || kind === 8) { // soft spots + haze
    ctx.fillStyle = c4;
    ctx.globalAlpha = 0.3;
    [[0.15,-0.2,0.4,0.28],[ -0.25,0.15,0.3,0.22]].forEach(([dx,dy,rx,ry]) => {
      ctx.beginPath();
      ctx.ellipse(x + dx * r, y + dy * r, r * rx, r * ry, 0.2, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  } else if (kind === 6) { // desert dunes
    ctx.strokeStyle = c5;
    ctx.globalAlpha = 0.4;
    ctx.lineWidth = 2;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(x - r * 0.8, y + i * r * 0.22);
      ctx.quadraticCurveTo(x, y + i * r * 0.22 - r * 0.08, x + r * 0.8, y + i * r * 0.22);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  } else if (kind === 9) { // jungle canopy: vine spirals + mist banks
    ctx.strokeStyle = c5;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 1.8;
    [[-0.25,-0.15],[0.2,0.1],[-0.05,0.32]].forEach(([dx,dy], k) => {
      ctx.beginPath();
      for (let i = 0; i <= 14; i++) {
        const th = i * 0.5 + k * 2;
        const rr = r * 0.05 + i * r * 0.018;
        const px = x + dx * r + Math.cos(th) * rr;
        const py = y + dy * r + Math.sin(th) * rr * 0.75;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
    });
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.14;
    [[0.05,-0.35,0.4,0.09],[-0.3,0.05,0.3,0.08]].forEach(([dx,dy,rx,ry]) => {
      ctx.beginPath();
      ctx.ellipse(x+dx*r, y+dy*r, r*rx, r*ry, 0.1, 0, Math.PI*2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  } else if (kind === 10) { // amethyst: geodesic facets with a glint
    ctx.globalAlpha = 0.4;
    [[-0.4,-0.3,0.15,-0.55,0.3,-0.2,c3],[-0.1,0.05,0.4,-0.15,0.35,0.35,c5],
     [-0.55,0.2,-0.15,0.1,-0.25,0.5,c4],[0.15,-0.6,0.5,-0.45,0.45,-0.1,c5]].forEach((f) => {
      const [x1,y1,x2,y2,x3,y3] = f as number[];
      const cc = f[6] as string;
      ctx.fillStyle = cc;
      ctx.beginPath();
      ctx.moveTo(x + x1*r, y + y1*r);
      ctx.lineTo(x + x2*r, y + y2*r);
      ctx.lineTo(x + x3*r, y + y3*r);
      ctx.closePath();
      ctx.fill();
    });
    ctx.strokeStyle = '#ffffff';
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x - r * 0.5, y - r * 0.42);
    ctx.lineTo(x + r * 0.15, y - r * 0.1);
    ctx.lineTo(x - r * 0.1, y + r * 0.45);
    ctx.stroke();
    ctx.globalAlpha = 1;
  } else if (kind === 11) { // night city: light grids on the dark side
    ctx.fillStyle = '#ffd76a';
    ctx.globalAlpha = 0.75;
    for (let gx = -4; gx <= 4; gx++) {
      for (let gy = -4; gy <= 4; gy++) {
        const px = gx * r * 0.16 + ((gy % 2) * r * 0.05);
        const py = gy * r * 0.15;
        if (px * px + py * py > r * r * 0.72) continue;
        if ((gx * 7 + gy * 13 + 5) % 4 === 0) continue; // dark blocks
        ctx.fillRect(x + px, y + py, Math.max(1, r * 0.035), Math.max(1, r * 0.028));
      }
    }
    // a glowing river of light
    ctx.strokeStyle = '#ffb84d';
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(x - r * 0.7, y + r * 0.25);
    ctx.quadraticCurveTo(x - r * 0.1, y - r * 0.15, x + r * 0.65, y + r * 0.1);
    ctx.stroke();
    ctx.globalAlpha = 1;
  } else if (kind === 12) { // the watcher: a great planetary eye
    ctx.fillStyle = '#3aa8a0';
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.ellipse(x, y, r * 0.52, r * 0.52, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a6a64';
    ctx.beginPath();
    ctx.ellipse(x, y, r * 0.4, r * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0a0e12';
    ctx.beginPath();
    ctx.ellipse(x, y, r * 0.2, r * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath();
    ctx.arc(x - r * 0.08, y - r * 0.14, r * 0.07, 0, Math.PI * 2);
    ctx.fill();
    // bloodshot veins reaching in from the limb
    ctx.strokeStyle = '#b05a4a';
    ctx.globalAlpha = 0.4;
    ctx.lineWidth = 1;
    [[-0.85,-0.25,-0.6,-0.1],[-0.8,0.35,-0.58,0.18],[0.82,-0.3,0.58,-0.14],[0.85,0.28,0.6,0.15]].forEach(([x1,y1,x2,y2]) => {
      ctx.beginPath();
      ctx.moveTo(x + x1*r, y + y1*r);
      ctx.quadraticCurveTo(x + (x1+x2)/2*r, y + y1*r*0.6, x + x2*r, y + y2*r);
      ctx.stroke();
    });
    ctx.globalAlpha = 1;
  } else if (kind === 13) { // candy stripes, rolled at an angle
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.5);
    for (let i = -3; i <= 3; i++) {
      ctx.fillStyle = i % 2 === 0 ? c3 : c5;
      ctx.globalAlpha = i % 2 === 0 ? 0.4 : 0.3;
      ctx.fillRect(-r, i * r * 0.28 - r * 0.11, r * 2, r * 0.22);
    }
    ctx.restore();
    // sugar glints
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.5;
    [[-0.3,-0.2],[0.25,0.05],[-0.05,0.38]].forEach(([dx,dy]) => {
      ctx.beginPath();
      ctx.arc(x + dx*r, y + dy*r, r * 0.035, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  } else if (kind === 14) { // shattered core: fissures glowing from inside
    ctx.strokeStyle = '#ff7a30';
    ctx.globalAlpha = 0.75;
    ctx.lineWidth = 2;
    [[-0.7,-0.3,-0.2,-0.1,0.15,-0.45],[-0.2,-0.1,0.1,0.25,0.6,0.1],
     [-0.2,-0.1,-0.35,0.4],[0.1,0.25,-0.05,0.65]].forEach((seg) => {
      ctx.beginPath();
      ctx.moveTo(x + seg[0]*r, y + seg[1]*r);
      for (let i = 2; i < seg.length; i += 2) ctx.lineTo(x + seg[i]*r, y + seg[i+1]*r);
      ctx.stroke();
    });
    ctx.strokeStyle = '#ffd76a';
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(x - r * 0.7, y - r * 0.3);
    ctx.lineTo(x - r * 0.2, y - r * 0.1);
    ctx.lineTo(x + r * 0.6, y + r * 0.1);
    ctx.stroke();
    // dark shadow plates between the cracks
    ctx.fillStyle = c5;
    ctx.globalAlpha = 0.35;
    [[0.3,-0.35,0.25],[-0.4,0.25,0.2]].forEach(([dx,dy,s]) => {
      ctx.beginPath();
      ctx.arc(x + dx*r, y + dy*r, r*s, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  } else if (kind === 15) { // aurora ice giant: polar light curtains
    for (let i = 0; i < 3; i++) {
      ctx.strokeStyle = i === 1 ? '#c58aff' : '#5dffc8';
      ctx.globalAlpha = 0.4 - i * 0.08;
      ctx.lineWidth = r * (0.07 - i * 0.015);
      ctx.beginPath();
      ctx.ellipse(x, y - r * 0.55, r * (0.55 + i * 0.14), r * (0.16 + i * 0.05), 0.06, Math.PI * 1.05, Math.PI * 1.95);
      ctx.stroke();
    }
    // frost bands
    ctx.strokeStyle = c3;
    ctx.globalAlpha = 0.25;
    ctx.lineWidth = r * 0.1;
    for (let i = 0; i <= 2; i++) {
      ctx.beginPath();
      ctx.ellipse(x, y + (i + 0.5) * r * 0.25, r * 0.94, r * 0.15, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // terminator / night side soft shadow
  const night = ctx.createLinearGradient(x - r, y, x + r, y);
  night.addColorStop(0, 'rgba(0,0,0,0)');
  night.addColorStop(0.55, 'rgba(0,0,0,0)');
  night.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = night;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  // rings (drawn outside clip)
  if (kind === 1) {
    ctx.strokeStyle = 'rgba(212,175,55,0.8)';
    ctx.lineWidth = Math.max(2.5, r * 0.08);
    ctx.beginPath();
    ctx.ellipse(x, y, r * 1.45, r * 0.28, -0.28, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(212,175,55,0.35)';
    ctx.lineWidth = Math.max(1.2, r * 0.04);
    ctx.beginPath();
    ctx.ellipse(x, y, r * 1.62, r * 0.32, -0.28, 0, Math.PI * 2);
    ctx.stroke();
    // ring shadow on planet
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(x, y, r * 0.95, r * 0.2, -0.28, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  } else if (kind === 4) {
    ctx.strokeStyle = 'rgba(100,220,200,0.5)';
    ctx.lineWidth = Math.max(2, r * 0.06);
    ctx.beginPath();
    ctx.ellipse(x, y, r * 1.35, r * 0.22, 0.18, 0, Math.PI * 2);
    ctx.stroke();
  } else if (kind === 7) {
    ctx.strokeStyle = 'rgba(100,140,220,0.45)';
    ctx.lineWidth = Math.max(1.8, r * 0.05);
    ctx.beginPath();
    ctx.ellipse(x, y, r * 1.3, r * 0.2, -0.12, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(100,140,220,0.25)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(x, y, r * 1.42, r * 0.24, -0.12, 0, Math.PI * 2);
    ctx.stroke();
  } else if (kind === 2) {
    // thin icy ring
    ctx.strokeStyle = 'rgba(200,220,240,0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(x, y, r * 1.25, r * 0.15, 0.1, 0, Math.PI * 2);
    ctx.stroke();
  } else if (kind === 15) {
    // broad double ice ring
    ctx.strokeStyle = 'rgba(143,212,240,0.5)';
    ctx.lineWidth = Math.max(2.5, r * 0.09);
    ctx.beginPath();
    ctx.ellipse(x, y, r * 1.5, r * 0.26, -0.22, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(197,138,255,0.3)';
    ctx.lineWidth = Math.max(1.2, r * 0.04);
    ctx.beginPath();
    ctx.ellipse(x, y, r * 1.68, r * 0.3, -0.22, 0, Math.PI * 2);
    ctx.stroke();
  } else if (kind === 14) {
    // orbiting shards blasted off the shattered surface
    ctx.fillStyle = 'rgba(176,160,140,0.7)';
    [[1.28,0.12,-0.4],[1.38,-0.06,0.9],[1.32,0.2,2.2],[1.45,0.02,3.6]].forEach(([rr,tilt,th]) => {
      const px = x + Math.cos(th) * r * rr;
      const py = y + Math.sin(th) * r * rr * 0.32 + tilt * r;
      ctx.beginPath();
      ctx.arc(px, py, Math.max(1.2, r * 0.06), 0, Math.PI * 2);
      ctx.fill();
    });
  } else if (kind === 10) {
    // a scatter of glinting crystal motes
    ctx.fillStyle = 'rgba(203,178,255,0.8)';
    [[1.3,0.4],[1.35,2.1],[1.28,4.2]].forEach(([rr,th]) => {
      const px = x + Math.cos(th) * r * rr;
      const py = y + Math.sin(th) * r * rr * 0.3;
      ctx.beginPath();
      ctx.moveTo(px, py - 2.4); ctx.lineTo(px + 1.6, py);
      ctx.lineTo(px, py + 2.4); ctx.lineTo(px - 1.6, py);
      ctx.closePath();
      ctx.fill();
    });
  }

  // crisp limb highlight
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y, r - 0.5, 0, Math.PI * 2);
  ctx.stroke();
}

export function retroAcorn(ctx: Ctx, x: number, y: number, power: any) {
  const shield = power === 'shield';
  const hole = power === 'blackhole';
  const golden = power === 'golden';
  const worm = power === 'wormhole';
  ctx.save();
  ctx.translate(x, y);
  if (golden) {
    // radiant star-ring
    const t = performance.now() / 1000;
    const glow = ctx.createRadialGradient(0, 0, 3, 0, 0, 26);
    glow.addColorStop(0, 'rgba(255,230,120,0.55)');
    glow.addColorStop(0.55, 'rgba(255,190,40,0.2)');
    glow.addColorStop(1, 'rgba(255,190,40,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,240,170,0.95)';
    for (let i = 0; i < 5; i++) {
      const a = t * 1.2 + (i / 5) * Math.PI * 2;
      const px = Math.cos(a) * 18, py = Math.sin(a) * 18 * 0.8;
      ctx.beginPath();
      ctx.moveTo(px, py - 2.6);
      ctx.lineTo(px + 1, py - 0.8);
      ctx.lineTo(px + 2.8, py);
      ctx.lineTo(px + 1, py + 0.8);
      ctx.lineTo(px, py + 2.6);
      ctx.lineTo(px - 1, py + 0.8);
      ctx.lineTo(px - 2.8, py);
      ctx.lineTo(px - 1, py - 0.8);
      ctx.closePath();
      ctx.fill();
    }
  }
  if (worm) {
    // teal portal — two counter-rotating rings, the mirror made visible
    const t = performance.now() / 1000;
    const glow = ctx.createRadialGradient(0, 0, 3, 0, 0, 26);
    glow.addColorStop(0, 'rgba(0,45,40,0.9)');
    glow.addColorStop(0.5, 'rgba(45,220,200,0.3)');
    glow.addColorStop(1, 'rgba(45,220,200,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(110,240,220,0.9)';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.ellipse(0, 0, 19, 6.5, (t * 0.9) % (Math.PI * 2), 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(190,255,245,0.55)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(0, 0, 14, 4.6, (-t * 0.9 - 0.9) % (Math.PI * 2), 0, Math.PI * 2);
    ctx.stroke();
  } else if (hole) {
    // dark core with a swirling accretion ring
    const t = performance.now() / 1000;
    const glow = ctx.createRadialGradient(0, 0, 3, 0, 0, 26);
    glow.addColorStop(0, 'rgba(20,0,40,0.9)');
    glow.addColorStop(0.5, 'rgba(120,40,200,0.28)');
    glow.addColorStop(1, 'rgba(120,40,200,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(200,130,255,0.85)';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.ellipse(0, 0, 19, 6.5, t * 0.8 % (Math.PI * 2), 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,190,90,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(0, 0, 14, 4.6, (t * 0.8 + 0.9) % (Math.PI * 2), 0, Math.PI * 2);
    ctx.stroke();
  } else if (shield) {
    // protective bubble around the nut
    const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, 24);
    glow.addColorStop(0, 'rgba(110,255,170,0.4)');
    glow.addColorStop(0.55, 'rgba(60,220,130,0.16)');
    glow.addColorStop(1, 'rgba(60,220,130,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(140,255,190,0.85)';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(0, 0, 17, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, 17, -2.3, -1.2);
    ctx.stroke();
  } else if (power) {
    const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, 22);
    glow.addColorStop(0, 'rgba(100,230,255,0.45)');
    glow.addColorStop(0.5, 'rgba(60,180,255,0.18)');
    glow.addColorStop(1, 'rgba(60,180,255,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.fill();
  }
  // soft shadow
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(1, 12, 8, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  // nut body with gradient
  const nut = ctx.createRadialGradient(-3, 0, 2, 0, 4, 12);
  if (golden) {
    nut.addColorStop(0, '#fff3c0');
    nut.addColorStop(0.5, '#ffce45');
    nut.addColorStop(1, '#a06a08');
  } else if (worm) {
    nut.addColorStop(0, '#bffff2');
    nut.addColorStop(0.5, '#2ec4ad');
    nut.addColorStop(1, '#0a4a40');
  } else if (hole) {
    nut.addColorStop(0, '#3a2a55');
    nut.addColorStop(0.5, '#1a1030');
    nut.addColorStop(1, '#05020c');
  } else if (shield) {
    nut.addColorStop(0, '#c8ffde');
    nut.addColorStop(0.5, '#4ade80');
    nut.addColorStop(1, '#14683a');
  } else if (power) {
    nut.addColorStop(0, '#c0f0ff');
    nut.addColorStop(0.5, '#5ad0f0');
    nut.addColorStop(1, '#1a70a0');
  } else {
    nut.addColorStop(0, '#e8b060');
    nut.addColorStop(0.5, '#c47a28');
    nut.addColorStop(1, '#6a3a10');
  }
  ctx.fillStyle = nut;
  ctx.beginPath();
  ctx.ellipse(0, 3, 9, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  // stem notch line
  ctx.strokeStyle = power ? 'rgba(20,80,120,0.35)' : 'rgba(60,30,10,0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, -2); ctx.lineTo(0, 10);
  ctx.stroke();
  // cap
  const cap = ctx.createRadialGradient(0, -6, 1, 0, -4, 12);
  if (golden) {
    cap.addColorStop(0, '#ffe27a');
    cap.addColorStop(1, '#b07c10');
  } else if (worm) {
    cap.addColorStop(0, '#39a08c');
    cap.addColorStop(1, '#0c3a32');
  } else if (hole) {
    cap.addColorStop(0, '#6a3aa8');
    cap.addColorStop(1, '#241040');
  } else if (shield) {
    cap.addColorStop(0, '#3fbf74');
    cap.addColorStop(1, '#0c4a28');
  } else if (power) {
    cap.addColorStop(0, '#6ec8e8');
    cap.addColorStop(1, '#1a6088');
  } else {
    cap.addColorStop(0, '#8a5a28');
    cap.addColorStop(1, '#3a2010');
  }
  ctx.fillStyle = cap;
  ctx.beginPath();
  ctx.ellipse(0, -5, 11.5, 7.5, 0, Math.PI, 0);
  ctx.fill();
  ctx.fillRect(-11, -6, 22, 4);
  // cap texture ridges
  ctx.strokeStyle = power ? 'rgba(255,255,255,0.2)' : 'rgba(255,200,120,0.2)';
  ctx.lineWidth = 1;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 4, -8); ctx.lineTo(i * 3.2, -3);
    ctx.stroke();
  }
  // shine
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.beginPath();
  ctx.ellipse(-3.5, 1, 2.8, 4.5, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// The live backdrop: a graded space gradient in the zone's own colours,
// two nebula washes, sun rays, a breathing vignette and hard white
// stars. Live reads these off module globals; here the crossfade state
// travels in explicitly.
export function retroBackdrop(
  ctx: Ctx, W: number, H: number, envA: number, envB: number, envBlend: number,
  stars: { x: number; y: number; r: number; a: number; tw: number; bright?: boolean }[],
) {
  const A = RETRO_ENVS[envA % RETRO_ENVS.length];
  const B = RETRO_ENVS[envB % RETRO_ENVS.length];
  const mix = (key: string, i: number) => {
    const a = A[key], b = B[key];
    return a[i] + (b[i] - a[i]) * envBlend;
  };
  const rgb = (key: string) =>
    'rgb(' + (mix(key, 0) | 0) + ',' + (mix(key, 1) | 0) + ',' + (mix(key, 2) | 0) + ')';
  const rgba = (key: string) =>
    'rgba(' + (mix(key, 0) | 0) + ',' + (mix(key, 1) | 0) + ',' + (mix(key, 2) | 0) +
    ',' + mix(key, 3).toFixed(3) + ')';
  const scalar = (key: string) => {
    const a = A[key] || 0, b = B[key] || 0;
    return a + (b - a) * envBlend;
  };

  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, rgb('top'));
  g.addColorStop(1, rgb('bot'));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  const throb = scalar('pulse');
  if (throb > 0) {
    ctx.globalAlpha = Math.max(0.25, 1 + Math.sin((performance.now() / 1000) * 2.1) * 0.55 * throb);
  }
  ctx.fillStyle = rgba('wash');
  ctx.beginPath();
  ctx.ellipse(W * 0.7, H * 0.3, W * 0.5, H * 0.25, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = rgba('wash2');
  ctx.beginPath();
  ctx.ellipse(W * 0.24, H * 0.68, W * 0.42, H * 0.2, -0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  drawRays(ctx, W, H, A, 1 - envBlend);
  drawRays(ctx, W, H, B, envBlend);

  const dim = scalar('dim');
  if (dim > 0.01) {
    const breathe = dim * (0.55 + 0.45 * Math.sin((performance.now() / 1000) * 0.7));
    const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.22, W / 2, H / 2, H * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,' + (breathe * 0.55).toFixed(3) + ')');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
  }

  for (const s of stars) {
    const pulse = 0.55 + 0.45 * Math.sin(s.tw);
    ctx.globalAlpha = s.a * pulse;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
    if (s.bright) {
      ctx.globalAlpha = s.a * pulse * 0.5;
      ctx.beginPath();
      ctx.moveTo(s.x - s.r * 2.5, s.y);
      ctx.lineTo(s.x + s.r * 2.5, s.y);
      ctx.moveTo(s.x, s.y - s.r * 2.5);
      ctx.lineTo(s.x, s.y + s.r * 2.5);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 0.7;
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}

// A painted rock carries an index into 27 illustrations; a vector one
// carries a type name out of its zone's own seven. Same rock, same seed,
// so it looks like the same object rendered by the other engine.
export function retroBlocker(env: number, debris: number, y: number) {
  const pool = RETRO_ENVS[env % RETRO_ENVS.length].obTypes || RETRO_OB_TYPES;
  return {
    type: pool[Math.abs(debris) % pool.length],
    seed: Math.abs((debris * 733 + Math.round(y) * 97) % 1000),
    rot: ((debris * 1.7 + y * 0.031) % (Math.PI * 2)),
    spin: (((debris * 37 + Math.round(y)) % 100) / 100 - 0.5) * 0.8,
    env,
  };
}
