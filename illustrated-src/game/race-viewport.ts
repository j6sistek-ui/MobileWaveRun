import { RACE_HEIGHT, RACE_PILOT_X, RACE_WIDTH } from "./race";

export const RACE_MAX_VIRTUAL_WIDTH = 1440;

/** Uniform projection of Hyper Run's canonical-height side-view camera.
 * Portrait preserves the original 360 x 640 registration. Landscape reveals
 * more authored course without stretching it or changing authority. */
export type RaceViewport = Readonly<{
  scale: number;
  /** left edge of the active race camera; extreme-wide side bands sit outside */
  left: number;
  right: number;
  top: number;
  bottom: number;
  contentWidth: number;
  contentHeight: number;
  virtualWidth: number;
  pilotLocalX: number;
  pilotX: number;
  /** screen origin for canonical X; differs from active left in panorama */
  originLeft: number;
}>;

export function raceViewport(viewWidth: number, viewHeight: number): RaceViewport {
  const width = Number.isFinite(viewWidth) ? Math.max(0, viewWidth) : 0;
  const height = Number.isFinite(viewHeight) ? Math.max(0, viewHeight) : 0;
  const scale = Math.min(width / RACE_WIDTH, height / RACE_HEIGHT);
  const virtualWidth = scale > 0
    ? Math.min(width / scale, RACE_MAX_VIRTUAL_WIDTH)
    : RACE_WIDTH;
  const contentWidth = virtualWidth * scale;
  const contentHeight = RACE_HEIGHT * scale;
  const left = (width - contentWidth) / 2;
  const top = (height - contentHeight) / 2;
  const pilotLocalX = Math.max(RACE_PILOT_X, Math.min(288, virtualWidth * 0.2));
  const pilotX = left + pilotLocalX * scale;
  return {
    scale,
    left,
    right: left + contentWidth,
    top,
    bottom: top + contentHeight,
    contentWidth,
    contentHeight,
    virtualWidth,
    pilotLocalX,
    pilotX,
    originLeft: pilotX - RACE_PILOT_X * scale,
  };
}

export function raceViewportX(viewport: RaceViewport, canonicalX: number) {
  return viewport.originLeft + canonicalX * viewport.scale;
}

export function raceViewportY(viewport: RaceViewport, canonicalY: number) {
  return viewport.top + canonicalY * viewport.scale;
}
