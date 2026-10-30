import type { SpillState } from "./spill";
import type { SpillRiskId } from "./spill-expeditions";

export type SpillChassisId = "standard" | "interceptor" | "bulwark";
export type SpillWeaponModuleId = "standard" | "focus" | "wide";
export type SpillLoadout = { chassis: SpillChassisId; module: SpillWeaponModuleId };
export type SpillCareer = SpillLoadout & { version: 1 };
export const SPILL_CHASSIS: { id: SpillChassisId; name: string; detail: string; unlock: number }[] = [
  { id: "standard", name: "Scout", detail: "Balanced hull and steering. The original ship.", unlock: 0 },
  { id: "interceptor", name: "Interceptor", detail: "12% quicker steering; one less hull pip. Same dodge charges.", unlock: 5 },
  { id: "bulwark", name: "Bulwark", detail: "One extra hull pip; 12% slower steering. Same collision size.", unlock: 10 },
];
export const SPILL_WEAPON_MODULES: { id: SpillWeaponModuleId; name: string; detail: string; unlock: number }[] = [
  { id: "standard", name: "Standard targeting", detail: "Original projectile speed and forward aim assistance.", unlock: 0 },
  { id: "focus", name: "Focus lens", detail: "20% faster shots; 15% narrower aim assistance. Line targets up carefully.", unlock: 15 },
  { id: "wide", name: "Tracking lens", detail: "30% wider aim assistance; 15% slower shots. Damage and fire rate stay unchanged.", unlock: 20 },
];
export const createSpillLoadout = (): SpillLoadout => ({ chassis: "standard", module: "standard" });
export const createSpillCareer = (): SpillCareer => ({ version: 1, ...createSpillLoadout() });
export function spillChassisStats(id: SpillChassisId = "standard") {
  return id === "interceptor" ? { steer: 1.12, hull: -1 } : id === "bulwark" ? { steer: .88, hull: 1 } : { steer: 1, hull: 0 };
}
export function spillWeaponModuleStats(id: SpillWeaponModuleId = "standard") {
  return id === "focus" ? { speed: 1.2, aim: .85 } : id === "wide" ? { speed: .85, aim: 1.3 } : { speed: 1, aim: 1 };
}
export function restoreSpillLoadout(value: unknown): SpillLoadout | null {
  if (value === undefined) return createSpillLoadout();
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as SpillLoadout;
  if (!SPILL_CHASSIS.some(c => c.id === v.chassis) || !SPILL_WEAPON_MODULES.some(m => m.id === v.module)) return null;
  return { chassis: v.chassis, module: v.module };
}
/** Milestones are derived from earned best-wave records, never a grant list. */
export function restoreSpillCareer(value: unknown, best: number): SpillCareer {
  const v = value as SpillCareer | undefined;
  const loadout = v?.version === 1 ? restoreSpillLoadout(v) : null;
  if (!loadout) return createSpillCareer();
  return { version: 1,
    chassis: SPILL_CHASSIS.some(c => c.id === loadout.chassis && c.unlock <= best) ? loadout.chassis : "standard",
    module: SPILL_WEAPON_MODULES.some(m => m.id === loadout.module && m.unlock <= best) ? loadout.module : "standard" };
}

export type SpillTrialId = "comet" | "mines" | "ion" | "gravity" | "flare" | "wreck" | "climax" | "advanced" | "volatile" | "patrol";
export type SpillTrialBuildId = "stock" | "salvage" | "evasive" | "heavy";
export const SPILL_TRIALS: { id: SpillTrialId; name: string; detail: string; wave: number; endWave?: number; risk?: SpillRiskId; seed: number }[] = [
  { id: "comet", name: "Comet crossing", detail: "Read the committed path, evade it or shoot the core.", wave: 4, seed: 7104 },
  { id: "mines", name: "Mine tactics", detail: "Disarm or leave the fuse radius. Watch enemies meet the same danger.", wave: 7, seed: 7107 },
  { id: "ion", name: "Ion timing", detail: "Leave a charging band before it fires.", wave: 11, seed: 7111 },
  { id: "gravity", name: "Gravity and salvage", detail: "Countersteer and read bent debris; valuable salvage is optional.", wave: 16, seed: 7116 },
  { id: "flare", name: "Solar cover", detail: "Use cover or the escape lane before the flare fires.", wave: 22, seed: 7122 },
  { id: "wreck", name: "Fracturing wreck", detail: "Break the weak point and read the released fragments.", wave: 27, seed: 7127 },
  { id: "climax", name: "Wave climax", detail: "Try a fifth-wave event and its elite encounter.", wave: 20, seed: 7120 },
  { id: "advanced", name: "Late combinations", detail: "Try later patterns with the same warnings and pressure ceiling.", wave: 41, seed: 7141 },
  { id: "volatile", name: "Volatile route", detail: "A full five-wave route: harder warned patterns, then a 45-coin completion bonus.", wave: 6, endWave: 10, risk: "volatile", seed: 7206 },
  { id: "patrol", name: "Patrol route", detail: "A full five-wave route: extra guards within the pressure cap, then a 60-coin bonus.", wave: 6, endWave: 10, risk: "bounty", seed: 7306 },
];
export const SPILL_TRIAL_BUILDS: { id: SpillTrialBuildId; name: string; detail: string }[] = [
  { id: "stock", name: "Stock ship", detail: "3 hull, original handling, both tier-I weapons; no artifact or utilities." },
  { id: "salvage", name: "Salvager", detail: "Reclaimer, tier-II systems and laser, Magnet + Scanner, salvage specialties." },
  { id: "evasive", name: "Evasive", detail: "Slipstream Relay, tier-II systems and laser, Brake + Scanner, precision specialties." },
  { id: "heavy", name: "Heavy combat", detail: "Siege Core, tier-II systems and cannon, Capacitor + Magnet, combat specialties." },
];
/** A repeatable build in ordinary rule state; no health immunity or director bypass. */
export function applySpillTrialBuild(s: SpillState, id: SpillTrialBuildId) {
  s.ore = 0; s.oreMined = 0;
  if (id === "stock") return;
  s.up = { plating: 2, thrusters: 2, pulse: 2 };
  s.maxHull = s.hull = 5;
  s.shield = s.canopyLevel = 1; s.charge = 1; s.lungeCharges = 2;
  s.combat.levels = { laser: 2, cannon: 2 };
  const b = s.combat.build;
  b.artifact = id === "salvage" ? "reclaimer" : id === "evasive" ? "slipstream" : "siege";
  b.owned = [b.artifact];
  if (id === "salvage") {
    s.utilities = ["magnet", "scanner"]; s.specialties = { plating: "salvage", pulse: "yield" };
  } else if (id === "evasive") {
    s.utilities = ["brake", "scanner"]; s.specialties = { plating: "brace", thrusters: "precision" };
  } else {
    s.combat.weapon = "cannon"; s.utilities = ["capacitor", "magnet"];
    s.specialties = { plating: "brace", pulse: "efficient" };
  }
  s.ownedUtilities = [...s.utilities];
}
