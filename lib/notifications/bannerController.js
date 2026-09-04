// Imperative API for NotificationBanner. Same pattern as cardController —
// callers anywhere (FcmLifecycle) can showBanner({...}) with no context or refs.
//
// A banner is the surface for time-critical pushes that must survive being
// ignored for a moment: it does not auto-dismiss, and it sits above the app
// chrome without blocking it (unlike a card, which is modal). Only one banner
// is held at a time — a newer one replaces the standing one, because the newer
// event is always the more urgent.

let currentBanner = null;
const subscribers = new Set();

function notify() {
  for (const fn of subscribers) {
    try { fn(currentBanner); } catch (e) {}
  }
}

export function showBanner(banner) {
  // banner shape: { kind, title, body, target, params, onDismiss?: () => void }
  currentBanner = banner;
  notify();
}

export function hideBanner() {
  const onDismiss = currentBanner?.onDismiss;
  currentBanner = null;
  notify();
  if (typeof onDismiss === 'function') {
    onDismiss();
  }
}

export function getCurrentBanner() {
  return currentBanner;
}

export function subscribe(fn) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}
