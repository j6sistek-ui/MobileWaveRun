import assert from 'node:assert/strict';
import { createNamespacedStorage } from '../dist/js/storage.js';

const data = new Map([['acornaut_illust_v1', 'original-game-save']]);
let fail = false;
const backing = {
  getItem(key) { if (fail) throw new Error('storage unavailable'); return data.get(key) ?? null; },
  setItem(key, value) { if (fail) throw new Error('quota'); data.set(key, value); },
  removeItem(key) { if (fail) throw new Error('storage unavailable'); data.delete(key); },
};
const storage = createNamespacedStorage(backing);
assert.equal(storage.getItem('acornaut_illust_v1'), null, 'the original game cannot seed this game');
storage.setItem('acornaut_illust_v1', 'standalone-save');
assert.equal(data.get('mobilewaverun:acornaut_illust_v1'), 'standalone-save');
assert.equal(data.get('acornaut_illust_v1'), 'original-game-save');
assert.equal(createNamespacedStorage(backing).getItem('acornaut_illust_v1'), 'standalone-save', 'a fresh instance loads its own persisted save');
storage.removeItem('acornaut_illust_v1');
assert.equal(storage.getItem('acornaut_illust_v1'), null);
assert.equal(data.get('acornaut_illust_v1'), 'original-game-save', 'erase only removes this game\'s slot');

storage.setItem('checkpoint', 'old-durable-checkpoint');
fail = true;
storage.setItem('checkpoint', 'new-memory-checkpoint');
assert.equal(storage.getItem('checkpoint'), 'new-memory-checkpoint', 'failed persistence must not revive older state');
storage.removeItem('checkpoint');
assert.equal(storage.getItem('checkpoint'), null, 'failed removal keeps a tombstone');
fail = false;
assert.equal(storage.getItem('checkpoint'), null, 'restored storage access cannot resurrect a removed checkpoint');
storage.setItem('checkpoint', 'replacement');
assert.equal(storage.getItem('checkpoint'), 'replacement');
assert.equal(data.get('mobilewaverun:checkpoint'), 'replacement');
assert.equal(data.get('acornaut_illust_v1'), 'original-game-save');
console.log('storage: namespacing, fresh-instance persistence, quota fallback and removal tombstones passed');
