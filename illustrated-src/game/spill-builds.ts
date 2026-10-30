import type { SpillState } from "./spill";
import type { SpillWeaponId } from "./spill-combat";
import type { SpillSpecialty, SpillUtility } from "./spill-content";

export type SpillArtifactId = "reclaimer" | "slipstream" | "siege";
export const SPILL_ARTIFACT_IDS: SpillArtifactId[] = ["reclaimer", "slipstream", "siege"];
export const SPILL_ARTIFACTS: Record<SpillArtifactId, {
  name: string; style: string; description: string; detail: string; color: string;
}> = {
  reclaimer: { name: "Reclaimer", style: "Salvage", color: "#a9e8a5",
    description: "Weapon-broken debris drops an extra Acorn Coin.",
    detail: "Up to 8 extra coins per wave. Collect them to earn them; Pulse and dodge breaks do not trigger it." },
  slipstream: { name: "Slipstream Relay", style: "Evasive", color: "#b3caff",
    description: "Dodge, then fire within 2 seconds to add an echo round.",
    detail: "The next manual volley adds one half-damage trailing round. Dodging never fires for you; echoes do not stack." },
  siege: { name: "Siege Core", style: "Heavy combat", color: "#ffd18a",
    description: "Weapon impacts blast nearby debris and enemies.",
    detail: "Nearby targets take half damage; shots take 30% longer to recharge. The direct target is hit once." },
};

export const SPILL_BUILD_RECIPES: {
  id: string; name: string; description: string; artifact: SpillArtifactId;
  weapon: SpillWeaponId; utilities: SpillUtility[]; specialties: SpillSpecialty[];
}[] = [
  { id: "salvage", name: "Salvager", description: "Break debris, pull in the salvage, and turn collected coins into repairs.",
    artifact: "reclaimer", weapon: "laser", utilities: ["magnet", "scanner"], specialties: ["salvage", "yield"] },
  { id: "evasive", name: "Evasive", description: "Dodge into an opening, brake cleanly, and answer with a primed shot.",
    artifact: "slipstream", weapon: "laser", utilities: ["brake", "scanner"], specialties: ["precision", "brace"] },
  { id: "heavy", name: "Heavy combat", description: "Break clustered threats with cannon blasts and keep a reserve impact Pulse.",
    artifact: "siege", weapon: "cannon", utilities: ["capacitor", "magnet"], specialties: ["brace", "efficient"] },
];

export type SpillBuildState = {
  artifact: SpillArtifactId | null; owned: SpillArtifactId[]; claimedWaves: number[];
  salvageDrops: number; echo: number; blasts: { x: number; y: number; r: number; life: number }[];
};
export function createSpillBuild(): SpillBuildState {
  return { artifact: null, owned: [], claimedWaves: [], salvageDrops: 0, echo: 0, blasts: [] };
}
const validId = (id: unknown): id is SpillArtifactId => SPILL_ARTIFACT_IDS.includes(id as SpillArtifactId);
const milestone = (wave: number) => Number.isInteger(wave) && wave >= 5 && wave % 10 === 5;
const depotOpen = (s: SpillState) => s.phase === "depot" && !!s.depot && !s.welcome && s.depot.arm <= 0;

/** A seed-local ordering, never a draw from the encounter or debris RNG. */
function choices(seed: number, wave: number, owned: SpillArtifactId[]) {
  const remaining = SPILL_ARTIFACT_IDS.filter(id => !owned.includes(id));
  if (!remaining.length) return [];
  const offset = ((seed >>> 0) ^ Math.imul(wave, 0x45d9f3b)) >>> 0;
  const start = offset % remaining.length;
  return [...remaining.slice(start), ...remaining.slice(0, start)].slice(0, 2);
}
/** Show the recovery while the Depot arms; only the transaction is gated. */
export function spillArtifactOffers(s: SpillState): SpillArtifactId[] {
  const build = s.combat.build;
  if (s.phase !== "depot" || !s.depot || s.welcome || !milestone(s.wave) || build.claimedWaves.includes(s.wave)) return [];
  return choices(s.seed, s.wave, build.owned);
}
export function spillClaimArtifact(s: SpillState, id: SpillArtifactId): boolean {
  if (!depotOpen(s) || !validId(id) || !spillArtifactOffers(s).includes(id)) return false;
  const build = s.combat.build;
  build.owned.push(id); build.claimedWaves.push(s.wave); build.artifact = id;
  build.echo = 0; build.blasts = [];
  s.cues.push("buy");
  return true;
}
export function spillEquipArtifact(s: SpillState, id: SpillArtifactId | null): boolean {
  const build = s.combat.build;
  if (!depotOpen(s) || (id !== null && (!validId(id) || !build.owned.includes(id)))) return false;
  build.artifact = id; build.echo = 0; build.blasts = [];
  s.cues.push("buy");
  return true;
}
export function spillPrimeEcho(s: SpillState) {
  if ((s.phase === "wave" || s.phase === "drain") && s.combat.build.artifact === "slipstream") s.combat.build.echo = 2;
}
export function clearSpillBuildEffects(s: SpillState) {
  s.combat.build.echo = 0; s.combat.build.blasts = [];
}

/** Original checkpoints have no build. New saves must prove each recovery was offered. */
export function restoreSpillBuild(value: unknown, seed: number, wave: number): SpillBuildState | null {
  if (value === undefined) return createSpillBuild();
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const b = value as SpillBuildState;
  if (!Array.isArray(b.owned) || b.owned.length > 3 || new Set(b.owned).size !== b.owned.length || !b.owned.every(validId)) return null;
  if (!Array.isArray(b.claimedWaves) || b.claimedWaves.length !== b.owned.length) return null;
  for (let i = 0; i < b.owned.length; i++) {
    const claimed = b.claimedWaves[i];
    if (!milestone(claimed) || claimed > wave || (i > 0 && claimed <= b.claimedWaves[i - 1])
      || !choices(seed, claimed, b.owned.slice(0, i)).includes(b.owned[i])) return null;
  }
  if (b.artifact !== null && (!validId(b.artifact) || !b.owned.includes(b.artifact))) return null;
  if (!Number.isInteger(b.salvageDrops) || b.salvageDrops < 0 || b.salvageDrops > 8 || b.echo !== 0
    || !Array.isArray(b.blasts) || b.blasts.length) return null;
  return { ...createSpillBuild(), artifact: b.artifact, owned: b.owned.slice(), claimedWaves: b.claimedWaves.slice(), salvageDrops: b.salvageDrops };
}
