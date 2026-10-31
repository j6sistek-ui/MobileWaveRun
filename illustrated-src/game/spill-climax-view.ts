import type { SpillState } from "./spill";

/** Paint the actual frozen volley paths and timed shield, with no camera motion. */
export function drawSpillClimax(ctx: CanvasRenderingContext2D, s: SpillState) {
  if (s.phase !== "wave" && s.phase !== "drain") return;
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, s.W, s.H); ctx.clip();
  for (const e of s.combat.enemies) {
    if (e.dead || !e.elite) continue;
    const elite = e.elite, exposed = elite.stage === "exposed";
    const color = exposed ? "#97ffe0" : "#ffd09a";
    ctx.strokeStyle = color; ctx.lineWidth = exposed ? 2 : 3;
    ctx.setLineDash(exposed ? [3, 6] : []);
    ctx.beginPath(); ctx.ellipse(e.x, e.y, e.r + 15, e.r + 9, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    if (elite.stage === "warning") {
      ctx.lineWidth = 1.5; ctx.setLineDash([6, 5]);
      for (const y of elite.aims) {
        const dx = e.aimX - e.x;
        const endY = Math.abs(dx) > .01 ? e.y + (y - e.y) * -e.x / dx : y;
        ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(0, endY); ctx.stroke();
      }
      ctx.setLineDash([]);
    }
    const label = exposed ? `CORE OPEN · ${elite.timer.toFixed(1)}s`
      : elite.stage === "warning" ? `${elite.pattern === "fork" ? "FORK · keep the gap" : "LOCK · leave the line"} · ${elite.timer.toFixed(1)}s`
      : elite.stage === "exit" ? "WARDEN RETREATING" : "WARDEN · SHIELDED";
    ctx.font = "800 10px Rajdhani,sans-serif"; ctx.textAlign = "center";
    const width = Math.min(s.W - 20, ctx.measureText(label).width + 14);
    const x = Math.max(width / 2 + 8, Math.min(s.W - width / 2 - 8, e.x));
    const y = Math.max(112, Math.min(s.H - 30, e.y - e.r - 24));
    ctx.fillStyle = "rgba(6,12,26,.9)"; ctx.fillRect(x - width / 2, y - 12, width, 19);
    ctx.fillStyle = color; ctx.fillText(label, x, y + 1, width - 12);
  }
  ctx.restore();
}
