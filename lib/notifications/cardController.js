// Imperative API for NotificationCard. Pattern mirrors react-native-toast-message:
// callers anywhere in the app can `showCard({...})` without needing context or refs.

let currentCard = null;
const subscribers = new Set();

function notify() {
  for (const fn of subscribers) {
    try { fn(currentCard); } catch (e) {}
  }
}

export function showCard(card) {
  // card shape: { kind, data?, target?, onDismiss?: () => void }
  currentCard = card;
  notify();
}

export function hideCard() {
  const onDismiss = currentCard?.onDismiss;
  currentCard = null;
  notify();
  if (typeof onDismiss === 'function') {
    onDismiss();
  }
}

export function getCurrentCard() {
  return currentCard;
}

export function subscribe(fn) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}
