import { FLIGHT_GRAVITY, QUICK_DROP_VY } from './control-constants';

/** Arcflash's own presentation controller. Degrees are measured in the
 * canonical upright rig; a positive limb angle reaches toward screen-right.
 * Elbows/knees are relative angles. Bone lengths and head scale never animate.
 * No controller value is a gameplay force or consumes the simulation RNG. */
export type ArcflashPose = {
  body: number; head: number; heave: number;
  nearArm: number; nearElbow: number; farArm: number; farElbow: number;
  nearThigh: number; nearKnee: number; farThigh: number; farKnee: number;
};

export type ArcflashMotion = {
  pose: ArcflashPose;
  rates: ArcflashPose;
  time: number;
  pressure: number;
  drive: number;
  /** Powered ascent is independent of the tap accent and joint springs. */
  boosting: boolean;
  boost: number;
  diving: boolean;
  phase: 'cruise' | 'rise' | 'fall' | 'dive';
  filteredVy: number;
  previousVy: number;
  velocityReset: boolean;
  tapAge: number;
  contactAge: number;
  contactStrength: number;
  contactNormalY: number;
  /** Local tail deflections from its authored rest curve, in degrees.
   * Root reacts first; the remaining two sections retain their momentum.
   * Render with arcflashTailAngles() to bound inter-section curvature. */
  tailRoot: number; tailMid: number; tailTip: number;
  tailRootRate: number; tailMidRate: number; tailTipRate: number;
};

export const ARCFLASH_CONTACT_SECONDS = .68;
export const ARCFLASH_PREVIEW_SECONDS = 7.2;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (t: number) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const poseKeys: (keyof ArcflashPose)[] = ['body', 'head', 'heave', 'nearArm',
  'nearElbow', 'farArm', 'farElbow', 'nearThigh', 'nearKnee', 'farThigh', 'farKnee'];

const CRUISE: ArcflashPose = {
  body: 54, head: 0, heave: 0,
  nearArm: 34, nearElbow: 72, farArm: 44, farElbow: 84,
  nearThigh: 12, nearKnee: -24, farThigh: 6, farKnee: -18,
};
const CLIMB: ArcflashPose = {
  body: 12, head: 23.1, heave: -2,
  nearArm: 7, nearElbow: 9, farArm: 3, farElbow: 13,
  nearThigh: 18, nearKnee: -32, farThigh: 12, farKnee: -26,
};
const FALL: ArcflashPose = {
  body: 74, head: -11, heave: 1,
  nearArm: 48, nearElbow: 74, farArm: 56, farElbow: 94,
  nearThigh: 6, nearKnee: -16, farThigh: 0, farKnee: -12,
};

export function createArcflashMotion(): ArcflashMotion {
  const rates = {} as ArcflashPose;
  for (const key of poseKeys) rates[key] = 0;
  return {
    pose: { ...CRUISE }, rates, time: 0, pressure: 0, drive: 0, boosting: false, boost: 0,
    diving: false, phase: 'cruise', filteredVy: 0, previousVy: 0,
    velocityReset: true, tapAge: 10, contactAge: 10,
    contactStrength: 0, contactNormalY: -1,
    tailRoot: 0, tailMid: 0, tailTip: 0,
    tailRootRate: 0, tailMidRate: 0, tailTipRate: 0,
  };
}

/** Only accepted acceleration reaches this hook. Fast refresh taps add jet
 * pressure, preserving every displayed joint, tail position, rate and clock.
 * A fall arrest produces a stronger flash than refreshing a steady climb. */
export function arcflashTap(s: ArcflashMotion, acceptedImpulse = 450) {
  if (!Number.isFinite(acceptedImpulse) || acceptedImpulse <= 0) return;
  const power = .18 + .82 * (1 - Math.exp(-acceptedImpulse / 360));
  s.pressure = Math.max(s.pressure, power);
  s.tapAge = 0;
  s.diving = false;
  s.boosting = true;
  s.velocityReset = true;
}

export function arcflashDive(s: ArcflashMotion) {
  s.diving = true;
  s.boosting = false;
  s.velocityReset = true;
}

/** The impact overlay has an independent clock, so a subsequent boost cannot
 * erase compression and release. Positive normalY is an overhead contact. */
export function arcflashContact(s: ArcflashMotion, normalY: number, strength: number) {
  if (!Number.isFinite(normalY) || !Number.isFinite(strength)) return;
  s.contactAge = 0;
  s.contactNormalY = clamp(normalY, -1, 1);
  s.contactStrength = clamp(strength, 0, 1);
  s.diving = false;
  s.boosting = false;
  s.velocityReset = true;
}

/** Exact critically damped spring at a fixed target, followed by a speed
 * bound. Targets change at 120 Hz; 30/60/120 Hz callers share that cadence. */
function spring(value: number, rate: number, target: number, dt: number,
  omega: number, maxRate: number): [number, number] {
  const error = value - target, c = rate + omega * error;
  const decay = Math.exp(-omega * dt);
  const next = target + (error + c * dt) * decay;
  const nextRate = clamp((rate - omega * c * dt) * decay, -maxRate, maxRate);
  const distance = clamp(next - value, -maxRate * dt, maxRate * dt);
  return [value + distance, nextRate];
}

export function stepArcflash(s: ArcflashMotion, dt: number, vy: number, ready = false) {
  if (!Number.isFinite(dt) || !Number.isFinite(vy) || dt <= 0) return;
  dt = Math.min(dt, .25);
  const endVy = ready ? 0 : vy;
  // Interpolate ordinary gravity inside each visual step, but never invent
  // intermediate velocities across an instantaneous accepted impulse.
  const startVy = s.velocityReset || ready ? endVy : s.previousVy;
  s.velocityReset = false;
  for (let left = dt; left > 1e-8;) {
    const h = Math.min(left, 1 / 120); left -= h;
    const stepVy = mix(startVy, endVy, (dt - left) / dt);
    s.time += h; s.tapAge += h; s.contactAge += h;
    s.filteredVy += (stepVy - s.filteredVy) * (1 - Math.exp(-h / .028));
    s.pressure *= Math.exp(-h / .18);
    s.drive += (s.pressure - s.drive) * (1 - Math.exp(-h / .075));
    // The reference holds its jets through the climb. As in the repaired
    // AcorNut booster, actual vy ends powered ascent; a fading tap pulse
    // alone would go weak before the short arc reaches its apex.
    if (ready || stepVy >= 0) s.boosting = false;
    s.boost += ((s.boosting ? .74 : 0) - s.boost) * (1 - Math.exp(-h / (s.boosting ? .04 : .07)));

    // Read an actual short gravity arc, including release and descent.
    // These blends never restart an authored clip when a tap arrives.
    const lift = ready ? 0 : smooth((-s.filteredVy - 18) / 335);
    const fall = ready ? 0 : smooth((s.filteredVy - 12) / 360);
    const dive = !ready && s.diving ? smooth(Math.max(0, s.filteredVy) / 300) : 0;
    s.phase = dive > .3 ? 'dive' : lift > .12 ? 'rise' : fall > .12 ? 'fall' : 'cruise';
    const target = {} as ArcflashPose;
    for (const key of poseKeys) {
      target[key] = mix(CRUISE[key], CLIMB[key], lift);
      target[key] = mix(target[key], FALL[key], fall);
    }
    target.body = Math.min(78, target.body + dive * 4) - s.drive * 1.3;
    target.head = -(target.body - CRUISE.body) * .55;
    target.heave -= s.drive * 1.2;
    // Almost still within a sustained attitude: no pedaling or arm pumping.
    // Small, phase-offset balance adjustments keep the body alive on hold.
    const breathe = s.time * Math.PI * 2 / 2.8;
    target.nearArm += Math.sin(breathe) * .75;
    target.farArm += Math.sin(breathe - .9) * .55;
    target.nearElbow += Math.sin(breathe - .35) * .6;
    target.farElbow += Math.sin(breathe - 1.3) * .45;
    target.nearThigh += Math.sin(breathe - 1.8) * .38;
    target.farThigh += Math.sin(breathe - 2.2) * .3;
    target.heave += Math.sin(breathe - .6) * 1.05;

    if (s.contactAge < ARCFLASH_CONTACT_SECONDS) {
      const age = s.contactAge;
      const appear = smooth(age / .026);
      const fade = 1 - smooth((age - .45) / .23);
      const compression = Math.exp(-(((age - .08) / .063) ** 2)) * appear * fade * s.contactStrength;
      const release = Math.exp(-(((age - .25) / .12) ** 2)) * fade * s.contactStrength;
      const feet = Math.max(0, -s.contactNormalY);
      const ceiling = Math.max(0, s.contactNormalY);
      target.heave += (compression * 12 - release * 5) * feet;
      target.body += (compression * 5 - release * 3) * feet;
      target.nearThigh += (compression * 31 - release * 9) * feet;
      target.farThigh += (compression * 26 - release * 7) * feet;
      target.nearKnee -= (compression * 44 - release * 7) * feet;
      target.farKnee -= (compression * 37 - release * 5) * feet;
      target.nearArm += compression * (9 * feet + 33 * ceiling);
      target.farArm += compression * (7 * feet + 28 * ceiling);
      target.nearElbow -= compression * 12 * ceiling;
      target.farElbow -= compression * 10 * ceiling;
    }

    for (const key of poseKeys) {
      // Torso begins steering ahead of hands, then the legs follow through.
      // Speeds allow a useful change inside the game's ~346 ms ascent.
      const omega = key === 'body' ? 22 : key === 'head' ? 24 : key === 'heave' ? 21 :
        /Thigh|Knee/.test(key) ? 17 : /far/.test(key) ? 18 : 20;
      const maxRate = key === 'body' ? 225 : key === 'head' ? 155 : key === 'heave' ? 100 :
        /Thigh|Knee/.test(key) ? 235 : 330;
      [s.pose[key], s.rates[key]] = spring(s.pose[key], s.rates[key], target[key], h, omega, maxRate);
    }

    const sway = 3.2 * Math.sin(s.time * Math.PI * 2 / 2.35);
    const tailTarget = -48 * lift + 17 * fall - s.drive * 5 + sway;
    [s.tailRoot, s.tailRootRate] = spring(s.tailRoot, s.tailRootRate, tailTarget, h, 12, 190);
    [s.tailMid, s.tailMidRate] = spring(s.tailMid, s.tailMidRate,
      s.tailRoot + 2.2 * Math.sin(breathe - .7), h, 8.5, 150);
    [s.tailTip, s.tailTipRate] = spring(s.tailTip, s.tailTipRate,
      s.tailMid + 2.9 * Math.sin(breathe - 1.3), h, 6, 115);
  }
  s.previousVy = endVy;
}

/** Keep the physical lag while smoothly limiting the displayed curvature.
 * No hard angular clip can snap the tip when flight reverses. The mesh still
 * needs its own positive-triangle-area guard for its particular artwork. */
export function arcflashTailAngles(s: ArcflashMotion) {
  const root = s.tailRoot;
  const mid = root + 19 * Math.tanh((s.tailMid - root) / 19);
  const tip = mid + 15 * Math.tanh((s.tailTip - s.tailMid) / 15);
  return { root, mid, tip };
}

type Preview = { time: number; vy: number; state: ArcflashMotion };
const previews = new WeakMap<object, Preview>();
// Long enough to see acceleration, a sustained climb, genuine ordinary
// descent, a down swipe, and a contact that persists through the next boost.
const previewEvents = [
  [.08, 'tap'], [.26, 'tap'], [.44, 'tap'], [.62, 'tap'], [.80, 'tap'],
  [1.45, 'tap'], [1.75, 'tap'], [2.05, 'tap'],
  [2.75, 'dive'], [3.25, 'contact'], [3.30, 'tap'], [3.48, 'tap'],
  [4.30, 'tap'], [4.40, 'tap'], [4.50, 'tap'], [4.60, 'tap'], [4.70, 'tap'],
  [5.35, 'tap'], [5.65, 'tap'], [6.20, 'contact'], [6.28, 'tap'],
] as const;

export function arcflashPreview(key: object, time: number): ArcflashMotion {
  const t = Number.isFinite(time) ? Math.max(0, time) % ARCFLASH_PREVIEW_SECONDS : 0;
  let preview = previews.get(key);
  if (!preview || t < preview.time) {
    preview = { time: 0, vy: 0, state: createArcflashMotion() };
    previews.set(key, preview);
  }
  while (preview.time < t - 1e-8) {
    const end = Math.min(t, preview.time + 1 / 120);
    for (const [at, event] of previewEvents) {
      if (at <= preview.time || at > end) continue;
      if (event === 'tap') {
        arcflashTap(preview.state, Math.max(1, preview.vy + 450));
        preview.vy = -450;
      } else if (event === 'dive') {
        arcflashDive(preview.state); preview.vy = QUICK_DROP_VY;
      } else {
        arcflashContact(preview.state, -1, .85); preview.vy = -350;
      }
    }
    preview.vy = Math.min(820, preview.vy + FLIGHT_GRAVITY * (end - preview.time));
    stepArcflash(preview.state, end - preview.time, preview.vy);
    preview.time = end;
  }
  return preview.state;
}
