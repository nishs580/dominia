/**
 * lib/__tests__/ageSlider.test.js — Dominia-Temp age slider maths (plan U4).
 */

const { AGE_TICKS, ageFromOffset, ageFromRatio, ratioForAge, stepAge, clampAge } = require('../ageSlider');
const { STEPS, initialState, onboardingReducer } = require('../onboardingFlow');

describe('ageFromOffset', () => {
  test('0%, 50% and 100% of the track map to 1, 51 and 100', () => {
    expect(ageFromOffset(0, 300)).toBe(1);
    expect(ageFromOffset(150, 300)).toBe(51); // round(1 + 0.5 × 99)
    expect(ageFromOffset(300, 300)).toBe(100);
  });

  test('offsets outside the track clamp to 1 or 100', () => {
    expect(ageFromOffset(-40, 300)).toBe(1);
    expect(ageFromOffset(900, 300)).toBe(100);
    expect(ageFromRatio(-1)).toBe(1);
    expect(ageFromRatio(2)).toBe(100);
  });

  test('no value before the track has a width', () => {
    expect(ageFromOffset(10, 0)).toBeNull();
    expect(ageFromOffset(10, undefined)).toBeNull();
  });
});

describe('stepAge (adjustable actions)', () => {
  test('increment at 100 stays 100 and decrement at 1 stays 1', () => {
    expect(stepAge(100, 1)).toBe(100);
    expect(stepAge(1, -1)).toBe(1);
  });

  test('steps by one inside the range', () => {
    expect(stepAge(20, 1)).toBe(21);
    expect(stepAge(20, -1)).toBe(19);
  });

  test('the first action with no value sets 1', () => {
    expect(stepAge(null, 1)).toBe(1);
    expect(stepAge(null, -1)).toBe(1);
  });
});

describe('ticks and positions', () => {
  test('ticks are 1 / 25 / 50 / 75 / 100', () => {
    expect(AGE_TICKS).toEqual([1, 25, 50, 75, 100]);
  });

  test('ratioForAge round-trips through ageFromRatio', () => {
    for (const age of [1, 13, 25, 50, 75, 100]) {
      expect(ageFromRatio(ratioForAge(age))).toBe(age);
    }
    expect(ratioForAge(1)).toBe(0);
    expect(ratioForAge(100)).toBe(1);
    expect(clampAge(140)).toBe(100);
  });
});

describe('the chosen age still gates the flow', () => {
  const atAge = () => initialState({ entry: STEPS.AGE });

  test('12 routes to AgeBlocked; 13 continues', () => {
    expect(onboardingReducer(atAge(), { type: 'AGE_SUBMITTED', age: 12 }).step).toBe(STEPS.AGE_BLOCKED);
    expect(onboardingReducer(atAge(), { type: 'AGE_SUBMITTED', age: 13 }).step).toBe(STEPS.DAILY_REWARD);
  });
});
