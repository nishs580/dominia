/**
 * lib/__tests__/dailyReward.test.js
 *
 * Daily Reward view-model (Updated UX A6): DAY n, the D1–D7 strip and the
 * ladder fallbacks (server → economy config → flat amount).
 */

const flags = require('../flags');
const { rewardLadder, ladderDay, dailyRewardView } = require('../dailyReward');

const LADDER = [60, 70, 80, 90, 100, 120, 200];

describe('dailyRewardView', () => {
  test('day 3 marks D3 as today and D1–D2 as collected', () => {
    const v = dailyRewardView({ reward: { day: 3, amount: 80, ladder: LADDER } });
    expect(v.day).toBe(3);
    expect(v.amount).toBe(80);
    expect(v.nextDay).toBe(4);
    expect(v.strip.map((s) => s.state)).toEqual([
      'collected', 'collected', 'today', 'upcoming', 'upcoming', 'upcoming', 'upcoming',
    ]);
    expect(v.strip.map((s) => s.label)).toEqual(['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7']);
    expect(v.strip.map((s) => s.amount)).toEqual(LADDER);
  });

  test('day 7 marks D7 as today and the next day wraps to 1', () => {
    const v = dailyRewardView({ reward: { day: 7, amount: 200, ladder: LADDER } });
    expect(v.strip[6].state).toBe('today');
    expect(v.strip.slice(0, 6).every((s) => s.state === 'collected')).toBe(true);
    expect(v.amount).toBe(200);
    expect(v.nextDay).toBe(1);
  });

  test('a missing ladder falls back to the economy config ladder', () => {
    const v = dailyRewardView({
      reward: { day: 2, amount: 0 },
      economy: { daily_reward_ladder: LADDER, daily_reward_gold: 60 },
    });
    expect(v.amount).toBe(70);
    expect(v.strip.map((s) => s.amount)).toEqual(LADDER);
  });

  test('with no ladder anywhere every day shows the flat amount', () => {
    const v = dailyRewardView({ reward: { day: 1, amount: 100 }, economy: { daily_reward_gold: 100 } });
    expect(v.strip.map((s) => s.amount)).toEqual([100, 100, 100, 100, 100, 100, 100]);
    expect(v.amount).toBe(100);
  });

  test('the server amount wins over the ladder rung for today', () => {
    const v = dailyRewardView({ reward: { day: 1, amount: 65, ladder: LADDER } });
    expect(v.amount).toBe(65);
    expect(v.strip[0].amount).toBe(65);
  });

  test('no reward at all renders day 1 from the config', () => {
    const v = dailyRewardView({ reward: null, economy: { daily_reward_ladder: LADDER } });
    expect(v.day).toBe(1);
    expect(v.amount).toBe(60);
  });

  test('the default economy config carries the Figma ladder', () => {
    flags._resetForTests();
    expect(Array.from(flags.getEconomy().daily_reward_ladder)).toEqual(LADDER);
    const v = dailyRewardView({ reward: { day: 4 }, economy: flags.getEconomy() });
    expect(v.amount).toBe(90);
  });
});

describe('rewardLadder', () => {
  test('a malformed server ladder is ignored', () => {
    expect(rewardLadder({ reward: { ladder: [1, 2, 3] }, economy: { daily_reward_ladder: LADDER } })).toEqual(LADDER);
    expect(
      rewardLadder({ reward: { ladder: [60, 70, 80, 90, 100, 120, -1] }, economy: { daily_reward_gold: 50 } }),
    ).toEqual(new Array(7).fill(50));
  });

  test('nothing at all falls back to 60 a day', () => {
    expect(rewardLadder()).toEqual(new Array(7).fill(60));
  });
});

describe('ladderDay', () => {
  test('clamps and wraps the streak day', () => {
    expect(ladderDay(undefined)).toBe(1);
    expect(ladderDay(0)).toBe(1);
    expect(ladderDay(7)).toBe(7);
    expect(ladderDay(8)).toBe(1);
    expect(ladderDay(14)).toBe(7);
  });
});
