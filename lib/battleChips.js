// Battle report chips — Living Map Phase 3.
//
// Classifies a territory's war state into a map chip. Three time horizons:
//   contested — an active contest is burning right now (no age)
//   fell      — attacker won a contest within the last 24 h
//   held      — defender won a contest within the last 24 h
//
// Pure and side-effect free; MapScreen translates the result
// (map.chip.* + map.agoMin/agoHr) at feature-mapping time.
// CommonJS (like lib/formulas.js) so the plain-node jest suite can load it.

const CHIP_DECAY_MS = 24 * 60 * 60 * 1000;

/**
 * @param {object} opts
 * @param {boolean} opts.contested          active contest on the territory
 * @param {string|null} opts.lastBattleOutcome 'fell' | 'held' | null
 * @param {string|Date|null} opts.lastBattleAt  when that contest resolved
 * @param {number} [opts.now]               epoch ms, injectable for tests
 * @returns {{key:'contested'}|{key:'fell'|'held', minutes:number}|null}
 */
function battleChipFor({ contested, lastBattleOutcome, lastBattleAt, now = Date.now() }) {
  if (contested) return { key: 'contested' };
  if (lastBattleOutcome !== 'fell' && lastBattleOutcome !== 'held') return null;
  if (!lastBattleAt) return null;

  const resolvedMs = new Date(lastBattleAt).getTime();
  if (!Number.isFinite(resolvedMs)) return null;

  const ageMs = now - resolvedMs;
  // Clock skew can put resolved_at slightly in the future — still show it.
  if (ageMs > CHIP_DECAY_MS) return null;

  const minutes = Math.max(1, Math.floor(Math.max(0, ageMs) / 60000));
  return { key: lastBattleOutcome, minutes };
}

module.exports = { CHIP_DECAY_MS, battleChipFor };
