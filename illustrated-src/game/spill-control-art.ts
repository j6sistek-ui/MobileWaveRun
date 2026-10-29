/** Vector flight pads. Geometry is shared with the mounted hit targets and QA render.
 *  The centre disc is THRUST: one tap, one kick skyward, the same as a tap on the
 *  field itself (owner, 10 Sep 2026 - the Throttle hold it replaced is retired). */
export type SpillControl = "dive" | "thrust" | "lunge";
export const SPILL_CONTROL_LAYOUT = {
  width: 360, height: 112,
  dive: { x: 0, y: 16, width: 144, height: 80 },
  thrust: { x: 130, y: 6, width: 100, height: 100 },
  lunge: { x: 216, y: 16, width: 144, height: 80 },
};
/** THE PADS' OWN COLOURS, in one place because two places now read them.
 *  The flight pads are painted below; the Help panel's Debris Field cards
 *  are tinted from the same values (spill-workshop.ts, drawSpillFlightHelp)
 *  so the card a pilot reads and the pad they press are the same colour.
 *  Owner, 10 Sep 2026: "the debris field buttons in help are too generic".
 *  The centre pad is THRUST, not the retired Throttle hold - tap to rise. */
export const SPILL_CONTROL_COLORS: Record<SpillControl, { light: string; edge: string; top: string; base: string }> = {
  thrust:   { light: "#bdffe4", edge: "#559e90", top: "#315956", base: "#112e2d" },
  lunge:    { light: "#b4edff", edge: "#559fc1", top: "#2e4254", base: "#0c1422" },
  dive:     { light: "#ffcead", edge: "#c58366", top: "#413b45", base: "#0c1422" },
};

export function spillControlArt(kind: SpillControl) {
  const center = kind === "thrust", right = kind === "lunge";
  const id = `ac-flight-${kind}`, w = center ? 100 : 144, h = center ? 100 : 80;
  const { light, edge, top, base } = SPILL_CONTROL_COLORS[kind];
  // The inner arc follows the central disc with a 7px gutter. Each wing's
  // content centers in its remaining pad (x=63), not its full 144px box.
  const wing = "M28 3H113Q125 3 133 8A57 57 0 0 0 133 72Q125 77 113 77H28Q3 77 3 52V28Q3 3 28 3Z";
  const shape = center ? '<circle cx="50" cy="50" r="47"/>' : `<path d="${wing}"${right ? ' transform="translate(144 0) scale(-1 1)"' : ""}/>`;
  const x = right ? 81 : 63;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="${id}-face" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0" stop-color="${top}"/><stop offset=".56" stop-color="${base}"/><stop offset="1" stop-color="#080f1c"/></linearGradient>
      <linearGradient id="${id}-edge" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0" stop-color="${light}"/><stop offset="1" stop-color="${edge}"/></linearGradient>
      <clipPath id="${id}-clip">${shape}</clipPath>
    </defs>
    <g class="ac-pad-face" fill="url(#${id}-face)" stroke="url(#${id}-edge)" stroke-width="2.6">${shape}</g>
    <g clip-path="url(#${id}-clip)">
      <ellipse cx="${center ? 40 : 60}" cy="${center ? 13 : 0}" rx="${center ? 58 : 88}" ry="${center ? 41 : 40}" fill="#ffffff" opacity="0.08"/>
      ${center ? '<circle cx="50" cy="50" r="42.5" fill="none" stroke="#d6fff0" stroke-opacity=".14"/>' : '<path d="M8 69H136" stroke="#000" stroke-opacity=".35" stroke-width="3"/>'}
    </g>
    ${center
      ? `<path d="M50 24 32 48H68Z" fill="${light}"/><text x="50" y="68" text-anchor="middle" fill="${light}" font-family="Figtree, sans-serif" font-size="11" font-weight="800" letter-spacing=".7">THRUST</text>`
      : `<path d="${right ? "M74 20 90 30 74 40 78 30Z" : "M49 21H77L63 38Z"}" fill="${light}"/><text x="${x}" y="61" text-anchor="middle" fill="${light}" font-family="Figtree, sans-serif" font-size="11" font-weight="800" letter-spacing=".7">${right ? "LUNGE" : "DIVE"}</text>`}
  </svg>`;
}
