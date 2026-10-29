/** Pointer geometry is measured in CSS pixels, independent of canvas resolution. */
export type SpillStick = {
  owner: number; x0: number; y0: number; x: number; y: number;
  samples: { x: number; y: number; at: number }[]; dodgeAt: number;
};
export function createSpillStick(owner: number, x: number, y: number, now: number): SpillStick {
  return { owner, x0: x, y0: y, x, y, samples: [{ x, y, at: now }], dodgeAt: -Infinity };
}
export function sampleSpillStick(stick: SpillStick, now: number) {
  stick.samples = stick.samples.filter(p => now - p.at <= 120);
  const last = stick.samples[stick.samples.length - 1];
  if (!last || last.at !== now) stick.samples.push({ x: stick.x, y: stick.y, at: now });
}
export function spillStickAxis(stick: SpillStick) {
  const dy = stick.y - stick.y0;
  return Math.abs(dy) <= 4 ? 0 : Math.sign(dy) * Math.min(1, (Math.abs(dy) - 4) / 40);
}
export function moveSpillStick(stick: SpillStick, x: number, y: number, now: number): -1 | 0 | 1 {
  const recent = stick.samples.filter(p => now - p.at <= 120);
  stick.x = x; stick.y = y;
  sampleSpillStick(stick, now);
  if (now - stick.dodgeAt < 240) return 0;
  // Use the recent moving segment, not the idle time before it began.
  const from = recent.slice().reverse().find(p => {
    const dx = x - p.x, dy = y - p.y, elapsed = Math.max(1, now - p.at);
    return Math.abs(dx) >= 30 && Math.abs(dx) > Math.abs(dy) * 1.8 && Math.abs(dx) / elapsed >= .45;
  });
  if (!from) return 0;
  stick.dodgeAt = now;
  stick.samples = [{ x, y, at: now }];
  return x < from.x ? -1 : 1;
}
