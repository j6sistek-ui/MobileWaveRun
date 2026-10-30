import type { SpillState } from "./spill";

export type SpillRiskId = "standard" | "volatile" | "bounty";
export const SPILL_RISKS: Record<SpillRiskId, { name: string; detail: string; reward: number }> = {
  standard: { name: "Standard route", detail: "The normal five-wave route. No added risk or bonus.", reward: 0 },
  volatile: { name: "Volatile route", detail: "Known anomalies use advanced patterns. Full warnings and escape routes remain. Clear all five waves for 45 bonus coins.", reward: 45 },
  bounty: { name: "Patrol route", detail: "More enemy patrols replace some ordinary debris. Clear all five waves for 60 bonus coins.", reward: 60 },
};
export type SpillExpedition = {
  version: 1; selected: SpillRiskId; active: SpillRiskId;
  startWave: number; endWave: number; rewarded: boolean;
};
export const createSpillExpedition = (): SpillExpedition => ({
  version: 1, selected: "standard", active: "standard", startWave: 0, endWave: 0, rewarded: true,
});
const valid = (id: unknown): id is SpillRiskId => id === "standard" || id === "volatile" || id === "bounty";

/** Opt in at a Depot; changing the selection never pays or charges anything. */
export function spillSelectRisk(s: SpillState, id: SpillRiskId) {
  if (!valid(id) || s.phase !== "depot" || !s.depot || s.depot.arm > 0 || s.welcome || s.wave < 5) return false;
  s.expedition.selected = id;
  s.cues.push("buy");
  return true;
}
export function beginSpillExpedition(s: SpillState) {
  if (s.wave < 5 || s.welcome) return;
  const selected = s.expedition.selected;
  s.expedition = { version: 1, selected: "standard", active: selected,
    startWave: s.wave + 1, endWave: s.wave + 5, rewarded: selected === "standard" };
}
export function spillRiskActive(s: SpillState, id: Exclude<SpillRiskId, "standard">) {
  const e = s.expedition;
  return !!e && !e.rewarded && e.active === id && s.wave >= e.startWave && s.wave <= e.endWave;
}
/** A one-time completion stipend, separate from mined coins and collection contracts. */
export function settleSpillExpedition(s: SpillState) {
  const e = s.expedition;
  if (e.rewarded || e.active === "standard" || s.cleared !== e.endWave) return 0;
  const reward = SPILL_RISKS[e.active].reward;
  e.rewarded = true;
  s.ore += reward; s.stipend += reward;
  s.contractMessage = `${SPILL_RISKS[e.active].name} cleared · +${reward} coins`;
  s.cues.push("contract");
  return reward;
}
/** Only settled previous blocks can appear at a checkpoint. */
export function restoreSpillExpedition(raw: unknown, wave: number): SpillExpedition | null {
  if (raw === undefined) return createSpillExpedition();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const e = raw as SpillExpedition;
  if (e.version !== 1 || !valid(e.selected) || !valid(e.active) || e.rewarded !== true
    || !Number.isInteger(e.startWave) || !Number.isInteger(e.endWave)) return null;
  const empty = e.startWave === 0 && e.endWave === 0 && e.active === "standard";
  if (!empty && (e.startWave < 6 || e.endWave !== e.startWave + 4 || e.endWave > wave || e.endWave % 5)) return null;
  if (wave < 5 && e.selected !== "standard") return null;
  return { version: 1, selected: e.selected, active: e.active, startWave: e.startWave, endWave: e.endWave, rewarded: true };
}
