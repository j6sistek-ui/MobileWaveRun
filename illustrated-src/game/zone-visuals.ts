import { ENVS } from "./catalog";
import { artUrl } from "./art";
import type { LevelDef } from "./campaign";
export const ZONE_VISUALS = [
  {
    "id": "deep-space",
    "env": 0,
    "from": 1,
    "to": 10,
    "pan": 0.25,
    "painted": "zone-scenes/deep-space.png"
  },
  {
    "id": "nebula-nursery",
    "env": 1,
    "from": 11,
    "to": 20,
    "pan": 0.5,
    "painted": "skies/magenta.jpg"
  },
  {
    "id": "ice-moon",
    "env": 2,
    "from": 21,
    "to": 30,
    "pan": 0.5,
    "painted": "skies/ice.jpg"
  },
  {
    "id": "solar-furnace",
    "env": 3,
    "from": 31,
    "to": 40,
    "pan": 0.5,
    "painted": "skies/inferno.jpg"
  },
  {
    "id": "sapphire-abyss",
    "env": 9,
    "from": 41,
    "to": 50,
    "pan": 0.5,
    "painted": "skies/indigo.jpg"
  },
  {
    "id": "crystal-belt",
    "env": 4,
    "from": 51,
    "to": 60,
    "pan": 0.27,
    "painted": "zone-scenes/crystal-belt.png"
  },
  {
    "id": "crimson-storm",
    "env": 8,
    "from": 61,
    "to": 70,
    "pan": 0.5,
    "painted": "skies/inferno.jpg"
  },
  {
    "id": "violet-realm",
    "env": 10,
    "from": 71,
    "to": 80,
    "pan": 0.5,
    "painted": "skies/vortex.jpg"
  },
  {
    "id": "monochrome-void",
    "env": 6,
    "from": 81,
    "to": 90,
    "pan": 0.5,
    "painted": "skies/mono.jpg"
  },
  {
    "id": "hypervivid",
    "env": 13,
    "from": 91,
    "to": 100,
    "pan": 0.6,
    "painted": "zone-scenes/hypervivid.png"
  },
  {
    "id": "rust-belt",
    "env": 22,
    "from": 101,
    "to": 110,
    "pan": 0.76,
    "painted": "zone-scenes/rust-belt.png"
  },
  {
    "id": "bone-desert",
    "env": 18,
    "from": 111,
    "to": 120,
    "pan": 0.5,
    "painted": "skies/gold.jpg"
  },
  {
    "id": "golden-hour",
    "env": 11,
    "from": 121,
    "to": 130,
    "pan": 0.5,
    "painted": "skies/gold.jpg"
  },
  {
    "id": "solar-corona",
    "env": 12,
    "from": 131,
    "to": 140,
    "pan": 0.5,
    "painted": "skies/gold.jpg"
  },
  {
    "id": "coral-shallows",
    "env": 17,
    "from": 141,
    "to": 150,
    "pan": 0.5,
    "painted": "skies/magenta.jpg"
  },
  {
    "id": "emerald-expanse",
    "env": 7,
    "from": 151,
    "to": 160,
    "pan": 0.5,
    "painted": "skies/verdant.jpg"
  },
  {
    "id": "alien-jungle",
    "env": 15,
    "from": 161,
    "to": 170,
    "pan": 0.5,
    "painted": "skies/verdant.jpg"
  },
  {
    "id": "acid-swamp",
    "env": 16,
    "from": 171,
    "to": 180,
    "pan": 0.5,
    "painted": "skies/verdant.jpg"
  },
  {
    "id": "aurora-crown",
    "env": 21,
    "from": 181,
    "to": 190,
    "pan": 0.5,
    "painted": "skies/verdant.jpg"
  },
  {
    "id": "pulsar-field",
    "env": 19,
    "from": 191,
    "to": 200,
    "pan": 0.5,
    "painted": "skies/ice.jpg"
  },
  {
    "id": "time-fracture",
    "env": 5,
    "from": 201,
    "to": 210,
    "pan": 0.5,
    "painted": "skies/verdant.jpg"
  },
  {
    "id": "neon-bazaar",
    "env": 14,
    "from": 211,
    "to": 220,
    "pan": 0.28,
    "painted": "zone-scenes/neon-bazaar.png"
  },
  {
    "id": "prism-storm",
    "env": 24,
    "from": 221,
    "to": 230,
    "pan": 0.8,
    "painted": "zone-scenes/prism-storm.png"
  },
  {
    "id": "ghost-nebula",
    "env": 23,
    "from": 231,
    "to": 240,
    "pan": 0.5,
    "painted": "skies/ghost.jpg"
  },
  {
    "id": "blackout-zone",
    "env": 20,
    "from": 241,
    "to": 250,
    "pan": 0.3,
    "painted": "zone-scenes/blackout-zone.png"
  },
  {
    "id": "event-horizon",
    "env": 25,
    "from": 251,
    "to": 260,
    "pan": 0.83,
    "painted": "zone-scenes/event-horizon.png"
  }
] as const;
export const zoneVisual = (env: number) => ZONE_VISUALS.find(z => z.env === env) ?? ZONE_VISUALS[0];
export function visualHash(id: string) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return h >>> 0;
}
export function mapPlanetIndex(def: LevelDef) {
  const family = ENVS[def.fx.env ?? 0].planetBias;
  // The mission's stable local slot shows all five worlds twice per zone.
  // Display-order changes cannot swap its art.
  return family[Math.max(0, def.n - 1) % family.length];
}
export function mapDebrisIndex(env: number, salt: number) {
  const family = ENVS[env].debrisBias;
  return family[(salt >>> 0) % family.length];
}
const images = new Map<string, HTMLImageElement>();
const failed = new Set<string>();
/** Lazy bounded cache; a failed remaster falls back to the existing sky. */
export function zonePainting(env: number): HTMLImageElement | null {
  if (typeof Image === "undefined") return null;
  const z = zoneVisual(env);
  const path = failed.has(z.painted) ? `skies/${ENVS[env].sky}.jpg` : z.painted;
  let img = images.get(path);
  if (!img) {
    img = new Image(); img.crossOrigin = "anonymous";
    img.onerror = () => { failed.add(path); };
    img.src = artUrl(path); images.set(path, img);
    if (images.size > 6) images.delete(images.keys().next().value);
  } else { images.delete(path); images.set(path, img); }
  return img.complete && img.naturalWidth > 0 ? img : null;
}
export const hasZoneRemaster = (env: number) => zoneVisual(env).painted.startsWith("zone-scenes/");
