/**
 * Tiny bridge between the guided demo overlay (mounted above the tab
 * navigator) and the screens it walks through. Screens register rect
 * providers (async () => {x,y,width,height}|null in window coordinates),
 * actions (imperative callbacks like closing the territory sheet), and emit
 * events the demo advances on. Everything is module-level — the demo and the
 * screens live in different subtrees, so context is not an option.
 */

const rectProviders = new Map();
const actions = new Map();
const listeners = new Set();
const lastEvents = new Map();
let demoActive = false;

export function registerDemoRect(key, getRect) {
  rectProviders.set(key, getRect);
  return () => {
    if (rectProviders.get(key) === getRect) rectProviders.delete(key);
  };
}

export function getDemoRectProvider(key) {
  return rectProviders.get(key) ?? null;
}

export function registerDemoAction(key, fn) {
  actions.set(key, fn);
  return () => {
    if (actions.get(key) === fn) actions.delete(key);
  };
}

export function runDemoAction(key) {
  const fn = actions.get(key);
  if (fn) {
    try {
      fn();
    } catch {
      // Demo actions must never throw into the machine.
    }
  }
}

export function emitDemoEvent(name, payload) {
  lastEvents.set(name, payload);
  listeners.forEach((fn) => {
    try {
      fn(name, payload);
    } catch {
      // Listener errors must not break emitters.
    }
  });
}

/** Latest payload for an event name, for subscribers that arrive late.
 * Returns undefined when the event has never fired. */
export function getLastDemoEvent(name) {
  return lastEvents.get(name);
}

export function onDemoEvent(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function setDemoActive(value) {
  demoActive = value === true;
  emitDemoEvent('demo.active', demoActive);
}

export function isDemoActive() {
  return demoActive;
}

/** Poll a registered rect provider until it yields, for targets on screens
 * that mount mid-demo (tab screens mount on first focus). */
export async function resolveDemoRect(key, { tries = 10, delayMs = 150 } = {}) {
  for (let i = 0; i < tries; i += 1) {
    const provider = rectProviders.get(key);
    if (provider) {
      try {
        const rect = await provider();
        if (rect) return rect;
      } catch {
        // Treat as not ready yet.
      }
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return null;
}
