import { createNamespacedStorage } from "./storage";
import type { PlatformAdapter } from "./platform";

async function main() {
  let backing: Storage | undefined;
  try { backing = window.localStorage; } catch { /* private browsing */ }
  const scoped = createNamespacedStorage(backing);
  const adapter: PlatformAdapter = {
    kind: "web", links: false, devDoors: false,
    storage: { get: scoped.getItem, set: scoped.setItem, remove: scoped.removeItem },
  };
  (window as unknown as { __acornautPlatform: PlatformAdapter }).__acornautPlatform = adapter;
  window.__ACORNAUT_ART__ = "./art";
  // Platform and save modules read the adapter at import time.
  const { bootStandalone } = await import("./standalone");
  const root = document.getElementById("app");
  if (!root) throw new Error("Missing game root");
  await bootStandalone(root);
}

void main().catch((error) => {
  console.error("MobileWaveRun could not start", error);
  const root = document.getElementById("app");
  if (root) {
    root.replaceChildren();
    const message = document.createElement("p");
    message.className = "mwr-boot-error";
    message.textContent = "The game could not start. Reload this page, or run npm run build again and launch through the local server.";
    root.append(message);
  }
});
