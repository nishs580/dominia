/**
 * lib/coachMarks.js
 *
 * One-shot coach marks on the Figma map (Updated UX B1–B3, plan U8):
 *
 *   sidePanel     B1 the side rail, labelled, "TAP TO CONTINUE"
 *   tapTerritory  B2 "YOUR FIRST TERRITORY", waits for the highlighted
 *                 territory to be tapped
 *   card          B3 a bubble above the territory card
 *   done          never shows again
 *
 * Any step can be skipped straight to done. Each step's name is a
 * walkthrough flag (lib/walkthroughFlags hasFired/markFired); a step is
 * marked seen as it is left, so a relaunch resumes at the first unseen step
 * and, once all three are seen, the coach marks never start again.
 *
 * Pure and CommonJS so the plain-node jest suite can test it; MapScreen owns
 * the persistence and when to send START.
 */

'use strict';

const COACH_STEPS = Object.freeze({
  IDLE: 'idle',
  SIDE_PANEL: 'sidePanel',
  TAP_TERRITORY: 'tapTerritory',
  CARD: 'card',
  DONE: 'done',
});

const COACH_EVENTS = Object.freeze({
  START: 'start',
  NEXT: 'next',
  TERRITORY_SELECTED: 'territorySelected',
  SKIP: 'skip',
});

// Walkthrough flag per step, in order.
const COACH_FLAG_NAMES = Object.freeze({
  sidePanel: 'coachSidePanel',
  tapTerritory: 'coachTapTerritory',
  card: 'coachCard',
});

const ORDER = Object.freeze([COACH_STEPS.SIDE_PANEL, COACH_STEPS.TAP_TERRITORY, COACH_STEPS.CARD]);

/**
 * @param {object} [seen] { sidePanel, tapTerritory, card } booleans from
 *                        hasFired on the three flag names
 */
function initialCoachState(seen = {}) {
  const done = ORDER.every((s) => seen[s] === true);
  return {
    step: done ? COACH_STEPS.DONE : COACH_STEPS.IDLE,
    seen: ORDER.filter((s) => seen[s] === true),
  };
}

function markSeen(state, ...steps) {
  const set = new Set(state.seen);
  steps.forEach((s) => set.add(s));
  return ORDER.filter((s) => set.has(s));
}

function firstUnseen(seen) {
  return ORDER.find((s) => !seen.includes(s)) ?? COACH_STEPS.DONE;
}

function coachReduce(state, event) {
  const s = state || initialCoachState();
  const type = typeof event === 'string' ? event : event?.type;

  if (s.step === COACH_STEPS.DONE) return s;

  if (type === COACH_EVENTS.SKIP) {
    if (s.step === COACH_STEPS.IDLE) return s;
    return { step: COACH_STEPS.DONE, seen: [...ORDER] };
  }

  switch (s.step) {
    case COACH_STEPS.IDLE:
      if (type === COACH_EVENTS.START) {
        // The card bubble (B3) needs an open card. Resuming there without
        // one goes back to B2, so tapping the territory brings B3 back
        // instead of the closed-card rule ending the coach marks unseen.
        const next = firstUnseen(s.seen);
        const cardOpen = typeof event === 'object' && event?.cardOpen === true;
        if (next === COACH_STEPS.CARD && !cardOpen) return { ...s, step: COACH_STEPS.TAP_TERRITORY };
        return { ...s, step: next };
      }
      return s;
    case COACH_STEPS.SIDE_PANEL:
      if (type === COACH_EVENTS.NEXT) {
        const seen = markSeen(s, COACH_STEPS.SIDE_PANEL);
        return { step: firstUnseen(seen), seen };
      }
      if (type === COACH_EVENTS.TERRITORY_SELECTED) {
        const seen = markSeen(s, COACH_STEPS.SIDE_PANEL, COACH_STEPS.TAP_TERRITORY);
        return { step: firstUnseen(seen), seen };
      }
      return s;
    case COACH_STEPS.TAP_TERRITORY:
      if (type === COACH_EVENTS.TERRITORY_SELECTED || type === COACH_EVENTS.NEXT) {
        const seen = markSeen(s, COACH_STEPS.TAP_TERRITORY);
        return { step: firstUnseen(seen), seen };
      }
      return s;
    case COACH_STEPS.CARD:
      if (type === COACH_EVENTS.NEXT) {
        return { step: COACH_STEPS.DONE, seen: markSeen(s, COACH_STEPS.CARD) };
      }
      return s;
    default:
      return s;
  }
}

/** True while a coach mark is on screen. */
function isCoachActive(state) {
  const step = state?.step;
  return step === COACH_STEPS.SIDE_PANEL || step === COACH_STEPS.TAP_TERRITORY || step === COACH_STEPS.CARD;
}

module.exports = {
  COACH_STEPS,
  COACH_EVENTS,
  COACH_FLAG_NAMES,
  initialCoachState,
  coachReduce,
  isCoachActive,
};
