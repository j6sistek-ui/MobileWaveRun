// DOM event integration only: this canvas stub does not prove layout, artwork or device feel.
import { Window } from 'happy-dom';

export function createDom({ holdImages = false } = {}) {
  const win = new Window({ url: 'http://local/' });
  let now = 0, frameId = 0, width = 390, paints = 0;
  const frames = new Map();
  for (const key of ['window', 'document', 'localStorage', 'navigator', 'HTMLElement', 'HTMLCanvasElement',
    'Event', 'PointerEvent', 'KeyboardEvent', 'ResizeObserver', 'Audio']) {
    Object.defineProperty(globalThis, key, { value: key === 'window' ? win : win[key], configurable: true, writable: true });
  }
  Object.defineProperty(globalThis, 'performance', { value: { now: () => now }, configurable: true });
  globalThis.requestAnimationFrame = fn => { frames.set(++frameId, fn); return frameId; };
  globalThis.cancelAnimationFrame = id => frames.delete(id);
  win.requestAnimationFrame = globalThis.requestAnimationFrame;
  win.cancelAnimationFrame = globalThis.cancelAnimationFrame;
  const pendingImages = [];
  globalThis.Image = class {
    set src(value) {
      const finish = () => this.onerror?.();
      if (holdImages) pendingImages.push(finish);
      else queueMicrotask(finish);
    }
  };
  globalThis.fetch = async () => ({ ok: false, json: async () => ({}) });
  const context = new Proxy({
    canvas: null, clearRect() { paints++; }, measureText: text => ({ width: text.length * 7 }),
    createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }),
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
    getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
  }, { get: (object, key) => key in object ? object[key] : () => {} });
  win.HTMLCanvasElement.prototype.getContext = function () { return context; };
  win.HTMLElement.prototype.getBoundingClientRect = function () {
    return { x: 0, y: 0, left: 0, top: 0, width, height: 760, right: width, bottom: 760 };
  };
  win.HTMLCanvasElement.prototype.setPointerCapture = function () {};
  win.HTMLCanvasElement.prototype.releasePointerCapture = function () {};
  return {
    win,
    tick(count = 1, hz = 60) {
      for (let index = 0; index < count; index++) {
        now += 1000 / hz;
        const batch = [...frames.values()];
        frames.clear();
        batch.forEach(fn => fn(now));
      }
    },
    touch(target, type, id, x = 100, y = 300, primary = true) {
      target.dispatchEvent(new win.PointerEvent(type, {
        pointerId: id, pointerType: 'touch', isPrimary: primary, clientX: x, clientY: y,
        bubbles: true, cancelable: true,
      }));
    },
    advanceClock(ms) { now += ms; },
    releaseImages() {
      holdImages = false;
      for (const finish of pendingImages.splice(0)) queueMicrotask(finish);
    },
    setWidth(value) { width = value; },
    paints: () => paints,
  };
}
