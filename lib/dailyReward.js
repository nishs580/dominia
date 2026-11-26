/**
 * lib/dailyReward.js
 *
 * View-model for the Daily Reward screen (Updated UX A6): DAY n, today's Gold,
 * the D1–D7 strip and the "Come back tomorrow" day. Pure CommonJS so the plain
 * node jest suite can load it; the screen stays thin.
 *
 * Ladder source, first that is usable:
 *   1. `reward.ladder` from GET /me/daily-reward (7 amounts),
 *   2. the economy config `daily_reward_ladder`,
 *   3. the flat `daily_reward_gold` repeated for all seven days.
 */

'use strict';

const LADDER_DAYS = 7;
const FLAT_FALLBACK_GOLD = 60;

function isAmount(v) {
  return Number.isInteger(v) && v >= 0;
}

function usableLadder(ladder) {
  return Array.isArray(ladder) && ladder.length === LADDER_DAYS && ladder.every(isAmount) ? ladder.slice() : null;
}

/** The seven daily amounts, from the server, the config, or the flat amount. */
function rewardLadder({ reward, economy } = {}) {
  const fromServer = usableLadder(reward && reward.ladder);
  if (fromServer) return fromServer;
  const fromConfig = usableLadder(economy && economy.daily_reward_ladder);
  if (fromConfig) return fromConfig;
  const flat = economy && isAmount(economy.daily_reward_gold) ? economy.daily_reward_gold : FLAT_FALLBACK_GOLD;
  return new Array(LADDER_DAYS).fill(flat);
}

/** Streak day 1–7. The server counts 1..7; anything past 7 wraps. */
function ladderDay(day) {
  const n = Math.floor(Number(day));
  if (!Number.isFinite(n) || n < 1) return 1;
  return ((n - 1) % LADDER_DAYS) + 1;
}

/**
 * @param {object} args
 * @param {{day?:number, amount?:number, ladder?:number[]}|null} args.reward
 * @param {object|null} [args.economy] getEconomy() snapshot
 * @returns {{
 *   day: number, amount: number, nextDay: number,
 *   strip: Array<{ day: number, label: string, amount: number, state: 'collected'|'today'|'upcoming' }>
 * }}
 */
function dailyRewardView({ reward = null, economy = null } = {}) {
  const ladder = rewardLadder({ reward, economy });
  const day = ladderDay(reward && reward.day);
  const serverAmount = reward ? Number(reward.amount) : NaN;
  const amount = Number.isInteger(serverAmount) && serverAmount > 0 ? serverAmount : ladder[day - 1];
  const strip = ladder.map((gold, i) => {
    const d = i + 1;
    return {
      day: d,
      label: `D${d}`,
      amount: d === day ? amount : gold,
      state: d < day ? 'collected' : d === day ? 'today' : 'upcoming',
    };
  });
  return { day, amount, nextDay: day === LADDER_DAYS ? 1 : day + 1, strip };
}

module.exports = { LADDER_DAYS, rewardLadder, ladderDay, dailyRewardView };
