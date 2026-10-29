/** Only MobileWaveRun keys are visible, including old upstream migration keys. */
export function createNamespacedStorage(backing?: Pick<Storage, "getItem" | "setItem" | "removeItem">) {
  const memory = new Map<string, string | null>();
  const keyOf = (key: string) => `mobilewaverun:${key}`;
  return {
    getItem(key: string): string | null {
      const scoped = keyOf(key);
      if (memory.has(scoped)) return memory.get(scoped)!;
      try { return backing?.getItem(scoped) ?? null; } catch { return null; }
    },
    setItem(key: string, value: string): void {
      const scoped = keyOf(key);
      memory.set(scoped, value);
      try { if (backing) { backing.setItem(scoped, value); memory.delete(scoped); } } catch { /* session fallback */ }
    },
    removeItem(key: string): void {
      const scoped = keyOf(key);
      memory.set(scoped, null);
      try { if (backing) { backing.removeItem(scoped); memory.delete(scoped); } } catch { /* retain tombstone */ }
    },
  };
}
