/** Presentation-only High Orbit identities; ownership and gameplay stay in catalog/sim. */
export const HIGH_ORBIT_IDS = ['cinderforge','groveguard','cosmic','sunforged','abyssal'] as const;
export const PREMIUM_SUIT_IDS = ['porcelain','nacre','origamist'] as const;
export type PremiumSuitId = typeof PREMIUM_SUIT_IDS[number];
export const isPremiumSuit = (id:string): id is PremiumSuitId => (PREMIUM_SUIT_IDS as readonly string[]).includes(id);
/** Only these five use cut-part articulation. The premium trio use whole frames. */
export const HIGH_ORBIT_RIG_IDS = HIGH_ORBIT_IDS;
export type HighOrbitRigId = typeof HIGH_ORBIT_RIG_IDS[number];
export const ORBIT_PILOT_IDS = [...HIGH_ORBIT_IDS,...PREMIUM_SUIT_IDS] as const;
/** Shared cosmetic clock/wake identity; this type does not imply a cut rig. */
export type HighOrbitId = typeof ORBIT_PILOT_IDS[number];
export const isHighOrbit = (id:string): id is HighOrbitId => (ORBIT_PILOT_IDS as readonly string[]).includes(id);
/** The five High Orbit suits now fly rendered tap/dive banks (owner, 26 Oct 2026: direct
 * replacements from the 3D squirrels). Their identities and wakes stay; the cut-part rig
 * no longer draws them. The parts data is kept, unused, until it is retired for good. */
export const CUT_RIG_RETIRED = new Set<string>(HIGH_ORBIT_IDS);
/** Patriot flies a rendered tap/dive bank too (owner, 26 Oct 2026) and wears the pilot's
 * helmet: its premium identity and Foldspace Ribbon wake stay; its painted 9/9 frames and
 * integrated head retire. Percy and Envoy keep both. */
// Percy followed (owner, 27 Oct 2026: "I never replaced Percy ... use number 2 (moon tail)")
// and Envoy, on a new twin-tailed model (owner, 27 Oct 2026: "ok use the new one")
export const PREMIUM_FRAMES_RETIRED = new Set<string>(['origamist', 'porcelain', 'nacre']);
export const isPremiumFrames = (id:string): id is PremiumSuitId => isPremiumSuit(id) && !PREMIUM_FRAMES_RETIRED.has(id);
export const isHighOrbitRig = (id:string): id is HighOrbitRigId => (HIGH_ORBIT_RIG_IDS as readonly string[]).includes(id) && !CUT_RIG_RETIRED.has(id);
export const HIGH_ORBIT_HEAD_RADIUS = 36;
export const HIGH_ORBIT_DISPLAY_SPAN = 192;
export const HIGH_ORBIT_PROFILES = {
  cinderforge: {name:'Cinderforge',trail:'cinderforgewake',wake:'Molten Mantle',colors:['#fff4bb','#ff951f','#cb2718'],period:1.72,inertia:1.10,whip:1.02,seed:.2},
  groveguard: {name:'Groveguard',trail:'groveguardwake',wake:'Verdant Slipstream',colors:['#fff5b4','#91e89c','#247c55'],period:2.03,inertia:1.00,whip:1.06,seed:1.1},
  cosmic: {name:'Cupcake',trail:'cosmicwake',wake:'Astral Veil',colors:['#f3d9ff','#b382ed','#556dec'],period:2.20,inertia:1.08,whip:1.02,seed:2.4},
  sunforged: {name:'Sunforged',trail:'sunforgedwake',wake:'Solar Corona',colors:['#fff8d1','#ffd06c','#e68521'],period:1.90,inertia:1.15,whip:.97,seed:3.6},
  abyssal: {name:'Abyssal',trail:'abyssalwake',wake:'Abyssal Current',colors:['#d8ffff','#58dfe9','#1676a1'],period:2.10,inertia:1.04,whip:1.12,seed:4.7},
  porcelain: {name:'Percy',trail:'porcelainwake',wake:'Cobalt Filigree',colors:['#fff9ef','#b9d8ff','#325cba'],period:2.12,inertia:1.12,whip:.84,seed:5.8},
  nacre: {name:'Envoy',trail:'nacrewake',wake:'Pearl Tide',colors:['#fff0df','#e5a8ed','#7771c7'],period:2.28,inertia:1.04,whip:1.08,seed:6.9},
  origamist: {name:'Patriot',trail:'origamistwake',wake:'Foldspace Ribbon',colors:['#fff4dc','#f5bb75','#717aca'],period:1.94,inertia:1.07,whip:.62,seed:8.0},
} as const;
export const highOrbitTrailSuit = (trail:string): HighOrbitId|undefined =>
  ORBIT_PILOT_IDS.find(id=>HIGH_ORBIT_PROFILES[id].trail===trail);
