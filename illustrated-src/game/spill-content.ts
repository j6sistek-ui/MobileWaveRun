// Shared descriptions and progression for Debris Field (mode id "spill"). No DOM or persistence.
export type SpillUtility = "magnet" | "scanner" | "brake" | "capacitor";
export const SPILL_UTILITIES: Record<SpillUtility, { name: string; short: string; guide: string; price: number; desc: string; detail: string; unlock: number; icon: string }> = {
  magnet: { name: "Salvage Magnet", short: "Magnet", guide: "Pull Acorn Coins", price: 40, desc: "Pulls in nearby Acorn Coins and gold.", detail: "Health pickups still need a direct hit.", unlock: 5, icon: "◎" },
  scanner: { name: "Debris Scanner", short: "Scanner", guide: "Spot debris", price: 35, desc: "Shows incoming debris sooner.", detail: "Keeps debris outlines visible in Blackout.", unlock: 10, icon: "⌁" },
  brake: { name: "Emergency Brake", short: "Brake", guide: "Edge recovery", price: 35, desc: "Helps recover near the edges.", detail: "Automatic recovery every 12 seconds. Dashing also slows a fast dive.", unlock: 10, icon: "↟" },
  capacitor: { name: "Pulse Battery", short: "Battery", guide: "Extra Pulse", price: 45, desc: "Stores a second Pulse charge.", detail: "Needs the Impact pulse upgrade. Collect gold to charge it.", unlock: 20, icon: "ϟ" },
};
export const SPILL_UTILITY_IDS = Object.keys(SPILL_UTILITIES) as SpillUtility[];
export type SpillSpecialty = "brace" | "salvage" | "precision" | "sweep" | "efficient" | "yield";
export const SPILL_SPECIALTIES: Record<SpillSpecialty, { axis: "plating" | "thrusters" | "pulse"; name: string; desc: string }> = {
  brace: { axis: "plating", name: "Impact Bracing", desc: "Half the knockback; 0.4 seconds more protection after a hit." },
  salvage: { axis: "plating", name: "Salvage Armor", desc: "Collect 30 Acorn Coins to restore 1 health, at most twice per wave." },
  precision: { axis: "thrusters", name: "Precision Jets", desc: "Lunges brake vertical motion; burst strength stays at tier I." },
  sweep: { axis: "thrusters", name: "Wide Sweep", desc: "Lunges clear shards in a wider path, including at tier II." },
  efficient: { axis: "pulse", name: "Efficient Coil", desc: "Gold charges 65% of a Pulse instead of 50%." },
  yield: { axis: "pulse", name: "Salvage Coil", desc: "Shattered debris yields Acorn Coins at tier II; tier III yields double." },
};
export type SpillContractKind = "salvage" | "clean" | "shards";
export type SpillContract = { kind: SpillContractKind; target: number; reward: number; startWave: number; endWave: number; startOre: number; startHits: number; startShards: number };
export function spillContractOffers(wave: number): { kind: SpillContractKind; name: string; target: number; reward: number; desc: string }[] {
  const target = 35 + Math.min(40, Math.floor(wave / 5) * 5);
  return [
    { kind: "salvage", name: "Salvage Run", target, reward: 35, desc: `Collect ${target} Acorn Coins across the next five waves.` },
    { kind: "clean", name: "Clean Passage", target: 0, reward: 50, desc: "Clear the next five waves without losing health." },
    { kind: "shards", name: "Clear a Path", target: 8, reward: 45, desc: "Break 8 small debris pieces across the next five waves. Use Impact pulse or upgraded dashes." },
  ];
}
export type SpillEvent = "none" | "cargo" | "vein" | "lanes" | "rig";
export const SPILL_EVENTS: Record<SpillEvent, { name: string; hint: string }> = {
  none: { name: "", hint: "" },
  cargo: { name: "CARGO RUPTURE", hint: "CARGO RUPTURE: marked lanes fill in bursts · salvage follows" },
  vein: { name: "GOLD VEIN", hint: "GOLD VEIN: a rich moving stream · follow it when the lane is clear" },
  lanes: { name: "CONVOY CROSSING", hint: "CONVOY: alternating marked lanes · move through the opening" },
  rig: { name: "RIG BREAKUP", hint: "RIG BREAKUP: successive marked debris sweeps · fly the open corridor" },
};
export function spillEventFor(wave: number, seed: number): SpillEvent {
  if (wave % 20 === 0 || wave === 10) return "rig";
  if (wave % 5) return "none";
  if (wave === 5) return "cargo";
  return (["cargo", "vein", "lanes"] as const)[((seed >>> 0) + Math.floor(wave / 5)) % 3];
}
export const SPILL_ENGINE_COLORS = [
  { id: "stock", at: 0, name: "Purple", title: "New Arrival", finish: "Stock", color: "#c99bff" },
  { id: "copper", at: 5, name: "Copper", title: "Salvager", finish: "Copper", color: "#efb07a" },
  { id: "cobalt", at: 10, name: "Blue", title: "Surveyor", finish: "Blue", color: "#79cfff" },
  { id: "corelight", at: 20, name: "Gold", title: "Fieldbreaker", finish: "Gold", color: "#ffe27a" },
  { id: "void", at: 30, name: "Soft violet", title: "Deep Diver", finish: "Soft violet", color: "#c1a5ff" },
] as const;
export type SpillEngineColor = typeof SPILL_ENGINE_COLORS[number]["id"];
export function spillMastery(best: number) {
  const reached = SPILL_ENGINE_COLORS.filter(t => best >= t.at);
  return { current: reached[reached.length - 1] ?? SPILL_ENGINE_COLORS[0], next: SPILL_ENGINE_COLORS.find(t => t.at > best) ?? null };
}
/** Legacy switches retain the color they previously displayed. A chosen
 * color stays selected as later milestones are earned; locked colors fall back. */
export function spillEngineColor(save: { spillBest: number; spillEngineColor?: string; spillSignal?: boolean }) {
  if (save.spillEngineColor === undefined && save.spillSignal) return spillMastery(save.spillBest).current;
  return SPILL_ENGINE_COLORS.find(c => c.id === save.spillEngineColor && save.spillBest >= c.at) ?? SPILL_ENGINE_COLORS[0];
}
