/** Vanguard's post-touchdown spare-pants gag. Whole registered drawings,
 * sampled from the simulation clock; no live video or limb deformation. */
export const VANGUARD_DEPOT_SECONDS = 3.8;
export const VANGUARD_DEPOT_CELL = 320;

export const depotEase = (value: number) => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
};

export function vanguardDepotEligible(suit: string, motionOff: boolean, ready: boolean) {
  return suit === "vanguard" && !motionOff && ready;
}

export function vanguardDepotPose(elapsed: number) {
  const t = Math.max(0, Math.min(VANGUARD_DEPOT_SECONDS, elapsed));
  if (t < .65) return { beat: "walk" as const, frame: Math.floor(t * 12) % 4,
    walk: depotEase(t / .65), enter: 0, opacity: depotEase(t / .09) };
  if (t < 1.35) return { beat: "unpack" as const, frame: 4 + Math.min(3, Math.floor((t - .65) / .175)),
    walk: 1, enter: 0, opacity: 1 };
  if (t < 2.6) {
    const laugh = [8, 9, 10, 11, 9, 10, 11, 9, 10, 11];
    return { beat: "laugh" as const, frame: laugh[Math.min(9, Math.floor((t - 1.35) * 8))],
      walk: 1, enter: 0, opacity: 1 };
  }
  if (t < 3.25) return { beat: "stow" as const, frame: 12 + Math.min(3, Math.floor((t - 2.6) / .1625)),
    walk: 1, enter: 0, opacity: 1 };
  return { beat: "enter" as const, frame: Math.floor((t - 3.25) * 12) % 4,
    walk: 1, enter: depotEase((t - 3.25) / .55), opacity: 1 - depotEase((t - 3.53) / .27) };
}

/** Every exported cell has the same scale and foot/hip origin. Moving
 * pants and tail bounds never determine the actor's position or size. */
export function paintVanguardDepot(ctx: CanvasRenderingContext2D, sheet: HTMLImageElement,
  x: number, y: number, height: number, elapsed: number) {
  const pose = vanguardDepotPose(elapsed), cell = VANGUARD_DEPOT_CELL;
  const scale = height / 280;
  ctx.save(); ctx.globalAlpha *= pose.opacity;
  ctx.fillStyle = "rgba(4,3,13,.3)"; ctx.beginPath();
  ctx.ellipse(x, y, height * .21, height * .027, 0, 0, Math.PI * 2); ctx.fill();
  ctx.drawImage(sheet, pose.frame % 4 * cell, Math.floor(pose.frame / 4) * cell, cell, cell,
    x - 180 * scale, y - 296 * scale, cell * scale, cell * scale);
  ctx.restore();
}
