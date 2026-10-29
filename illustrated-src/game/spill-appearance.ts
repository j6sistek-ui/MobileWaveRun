import { STAR_MAP_PREVIEW } from "./catalog";
import type { SaveData } from "./save";

export type SpillAppearance = { finish: "stock" | "rust-runner"; trail: "stock" | "rust-wake" };
export const stockSpillAppearance = (): SpillAppearance => ({ finish: "stock", trail: "stock" });
/** Sample cosmetics are not published rewards. The separate sample save is
 * their only equip surface until the extension's reward ladder is activated. */
export function spillAppearance(save: SaveData): SpillAppearance {
  if (!STAR_MAP_PREVIEW) return stockSpillAppearance();
  return {
    finish: save.spillAppearance?.finish === "rust-runner" ? "rust-runner" : "stock",
    trail: save.spillAppearance?.trail === "rust-wake" ? "rust-wake" : "stock",
  };
}
