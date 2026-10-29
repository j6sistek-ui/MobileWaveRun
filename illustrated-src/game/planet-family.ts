import { ENVS } from "./catalog";

export type PlanetBag = { env: number; remaining: number[]; last: number };

/** Cosmetic shuffle only: each family appears once before the bag refills.
 * Keep the refill seam varied without consuming the mission geometry RNG. */
export function nextFamilyPlanet(bag: PlanetBag, env: number, random: () => number) {
  if (bag.env !== env) {
    bag.env = env;
    bag.remaining = [];
    bag.last = -1;
  }
  if (!bag.remaining.length) {
    bag.remaining = ENVS[env].planetBias.slice();
    for (let i = bag.remaining.length - 1; i > 0; i--) {
      const j = Math.min(i, Math.floor(random() * (i + 1)));
      [bag.remaining[i], bag.remaining[j]] = [bag.remaining[j], bag.remaining[i]];
    }
    const end = bag.remaining.length - 1;
    if (end > 0 && bag.remaining[end] === bag.last)
      [bag.remaining[0], bag.remaining[end]] = [bag.remaining[end], bag.remaining[0]];
  }
  bag.last = bag.remaining.pop()!;
  return bag.last;
}
