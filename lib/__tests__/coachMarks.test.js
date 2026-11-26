/**
 * lib/__tests__/coachMarks.test.js
 *
 * One-shot map coach marks (Updated UX B1–B3, plan U8).
 */

const {
  COACH_STEPS,
  COACH_EVENTS,
  COACH_FLAG_NAMES,
  initialCoachState,
  coachReduce,
  isCoachActive,
} = require('../coachMarks');

const run = (state, ...events) => events.reduce(coachReduce, state);

describe('coach marks state machine', () => {
  test('start → sidePanel, next → tapTerritory, territorySelected → card, next → done', () => {
    let s = initialCoachState();
    expect(s.step).toBe(COACH_STEPS.IDLE);
    expect(isCoachActive(s)).toBe(false);
    s = coachReduce(s, COACH_EVENTS.START);
    expect(s.step).toBe(COACH_STEPS.SIDE_PANEL);
    expect(isCoachActive(s)).toBe(true);
    s = coachReduce(s, COACH_EVENTS.NEXT);
    expect(s.step).toBe(COACH_STEPS.TAP_TERRITORY);
    expect(s.seen).toEqual(['sidePanel']);
    s = coachReduce(s, COACH_EVENTS.TERRITORY_SELECTED);
    expect(s.step).toBe(COACH_STEPS.CARD);
    s = coachReduce(s, COACH_EVENTS.NEXT);
    expect(s.step).toBe(COACH_STEPS.DONE);
    expect(s.seen).toEqual(['sidePanel', 'tapTerritory', 'card']);
    expect(isCoachActive(s)).toBe(false);
  });

  test('tapTerritory ignores unrelated events until the territory is tapped', () => {
    const s = run(initialCoachState(), 'start', 'next', 'start');
    expect(s.step).toBe(COACH_STEPS.TAP_TERRITORY);
  });

  test('tapping the territory during the side panel step jumps to the card', () => {
    const s = run(initialCoachState(), 'start', 'territorySelected');
    expect(s.step).toBe(COACH_STEPS.CARD);
  });

  test.each([
    ['sidePanel', ['start']],
    ['tapTerritory', ['start', 'next']],
    ['card', ['start', 'next', 'territorySelected']],
  ])('skip from %s goes to done and marks every step seen', (_, events) => {
    const s = coachReduce(run(initialCoachState(), ...events), COACH_EVENTS.SKIP);
    expect(s.step).toBe(COACH_STEPS.DONE);
    expect(s.seen).toEqual(['sidePanel', 'tapTerritory', 'card']);
  });

  test('once done it never starts again', () => {
    const done = run(initialCoachState(), 'start', 'skip');
    expect(coachReduce(done, 'start').step).toBe(COACH_STEPS.DONE);
    // A relaunch with all three flags fired starts done.
    const relaunched = initialCoachState({ sidePanel: true, tapTerritory: true, card: true });
    expect(relaunched.step).toBe(COACH_STEPS.DONE);
    expect(coachReduce(relaunched, 'start').step).toBe(COACH_STEPS.DONE);
  });

  test('a relaunch resumes at the first unseen step', () => {
    const s = coachReduce(initialCoachState({ sidePanel: true }), 'start');
    expect(s.step).toBe(COACH_STEPS.TAP_TERRITORY);
  });

  test('resuming at the card step without an open card resumes at tap-territory', () => {
    const relaunched = initialCoachState({ sidePanel: true, tapTerritory: true });
    const s = coachReduce(relaunched, 'start');
    expect(s.step).toBe(COACH_STEPS.TAP_TERRITORY);
    // Tapping the territory then shows the card coach mark (not done).
    const t = coachReduce(s, 'territorySelected');
    expect(t.step).toBe(COACH_STEPS.CARD);
    expect(coachReduce(t, 'next').step).toBe(COACH_STEPS.DONE);
  });

  test('resuming at the card step with the card already open shows it', () => {
    const relaunched = initialCoachState({ sidePanel: true, tapTerritory: true });
    expect(coachReduce(relaunched, { type: 'start', cardOpen: true }).step).toBe(COACH_STEPS.CARD);
  });

  test('skip before start does nothing', () => {
    expect(coachReduce(initialCoachState(), 'skip').step).toBe(COACH_STEPS.IDLE);
  });

  test('flag names are distinct walkthrough keys', () => {
    expect(new Set(Object.values(COACH_FLAG_NAMES)).size).toBe(3);
  });
});
