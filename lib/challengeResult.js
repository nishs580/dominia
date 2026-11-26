// lib/challengeResult.js
// Pure model behind the Figma result moments (plan U9; frames B9, C7, C8, D4,
// D5): the moment word (TAKEN / HELD / LOST), its colour, the eyebrow, the
// body line and the three stats tiles.
//
//   claim / attack won  -> WALKED · TIME · REWARD
//   defend won          -> YOU % · OPPONENT % · REWARD
//   attack / defend lost -> YOU % · OPPONENT 100% · GOLD −n
//
// Copy is returned as { key, defaultValue, params } so the component calls
// t(key, { defaultValue, ...params }). Colours are semantic ('green' | 'red'
// | 'lime' | null); the component maps them to theme tokens.
//
// CJS, no React — jest-testable via plain require().

const { mobileStateFromOutcome } = require('./contestResultHelpers');
const { formatDistance } = require('./units');

const MINUS = '−';

const MOMENTS = Object.freeze({
  taken: { key: 'challengeResult.taken', defaultValue: 'TAKEN' },
  held: { key: 'challengeResult.held', defaultValue: 'HELD' },
  lost: { key: 'challengeResult.lost', defaultValue: 'LOST' },
});

const COPY = Object.freeze({
  claim_won: {
    moment: 'taken',
    color: 'green',
    eyebrow: { key: 'challengeResult.eyebrowClaimWon', defaultValue: '{{territory}} · CLAIMED' },
    body: { key: 'challengeResult.bodyClaimWon', defaultValue: 'Claim secured. {{territory}} is yours now.' },
  },
  attack_won: {
    moment: 'taken',
    color: 'green',
    eyebrow: { key: 'challengeResult.eyebrowAttackWon', defaultValue: '{{territory}} · ATTACK WON' },
    body: { key: 'challengeResult.bodyAttackWon', defaultValue: 'You out-walked {{opponent}}. {{territory}} is yours now.' },
  },
  attack_lost: {
    moment: 'lost',
    color: 'red',
    eyebrow: { key: 'challengeResult.eyebrowAttackLost', defaultValue: 'ATTACK FAILED · {{territory}}' },
    body: { key: 'challengeResult.bodyAttackLost', defaultValue: '{{opponent}} caught up in time. {{territory}} stays with them — try again later.' },
  },
  defend_won: {
    moment: 'held',
    color: 'green',
    eyebrow: { key: 'challengeResult.eyebrowDefendWon', defaultValue: 'DEFEND WON · {{territory}}' },
    body: { key: 'challengeResult.bodyDefendWon', defaultValue: 'Defend won, territory is saved. {{territory}} stays with you.' },
  },
  defend_lost: {
    moment: 'lost',
    color: 'red',
    eyebrow: { key: 'challengeResult.eyebrowDefendLost', defaultValue: 'DEFEND LOST · {{territory}}' },
    body: { key: 'challengeResult.bodyDefendLost', defaultValue: 'Defend lost, better luck next time! {{territory}} now belongs to {{opponent}}.' },
  },
});

const LABELS = Object.freeze({
  walked: { key: 'challengeResult.statWalked', defaultValue: 'WALKED' },
  time: { key: 'challengeResult.statTime', defaultValue: 'TIME' },
  reward: { key: 'challengeResult.statReward', defaultValue: 'REWARD' },
  you: { key: 'challengeResult.statYou', defaultValue: 'YOU' },
  gold: { key: 'challengeResult.statGold', defaultValue: 'GOLD' },
  opponent: { key: 'challengeResult.statOpponent', defaultValue: '{{name}}' },
  free: { key: 'challengeResult.free', defaultValue: 'FREE' },
});

function isNum(n) {
  return typeof n === 'number' && Number.isFinite(n);
}

/** Metres under a kilometre read as "450 m"; longer walks as "2.4 km" / "1.5 mi". */
function formatWalked(metres, unit) {
  if (!isNum(metres)) return '—';
  if (unit !== 'mi' && metres < 1000) return `${Math.max(0, Math.round(metres))} m`;
  return formatDistance(metres, unit);
}

/** Elapsed time as MM:SS, or H:MM:SS from an hour. */
function formatElapsed(ms) {
  if (!isNum(ms) || ms < 0) return '—';
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const mm = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
  const ss = String(total % 60).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function formatPct(pct) {
  return isNum(pct) ? `${Math.round(Math.max(0, Math.min(100, pct)))}%` : '—';
}

/**
 * Result moment content.
 *
 * @param {object}  args
 * @param {'claim'|'attack'|'defend'} args.kind
 * @param {string}  [args.outcome]       contest outcome ('attacker_won' | 'defender_won'); ignored for claims.
 * @param {string}  [args.territoryName]
 * @param {string}  [args.opponentName]  the other walker, already resolved to a display name.
 * @param {number}  [args.walkedM]
 * @param {number}  [args.elapsedMs]
 * @param {string}  [args.unit]          'km' | 'mi'
 * @param {boolean} [args.freeClaim]     the first (free) claim: reward reads FREE.
 * @param {number}  [args.goldAwarded]
 * @param {number}  [args.goldLost]      Gold spent on a challenge that was lost.
 * @param {number}  [args.myPct]         0–100
 * @param {number}  [args.opponentPct]   0–100
 */
function challengeResultModel({
  kind,
  outcome,
  territoryName = '',
  opponentName = '',
  walkedM,
  elapsedMs,
  unit,
  freeClaim = false,
  goldAwarded,
  goldLost,
  myPct,
  opponentPct,
} = {}) {
  const state = kind === 'claim'
    ? 'claim_won'
    : mobileStateFromOutcome(outcome, kind === 'defend' ? 'defender' : 'attacker');
  const copy = COPY[state];
  const params = { territory: territoryName, opponent: opponentName };
  const won = copy.color === 'green';

  const reward = {
    label: LABELS.reward,
    value: state === 'claim_won' && freeClaim
      ? null
      : (isNum(goldAwarded) ? `+${goldAwarded}` : '—'),
    valueCopy: state === 'claim_won' && freeClaim ? LABELS.free : null,
    color: 'lime',
  };
  const opponentLabel = { ...LABELS.opponent, params: { name: opponentName } };

  let stats;
  if (!won) {
    stats = [
      { label: LABELS.you, value: formatPct(myPct), color: null },
      // The winner walked the whole requirement.
      { label: opponentLabel, value: '100%', color: 'red' },
      {
        label: LABELS.gold,
        value: isNum(goldLost) && goldLost > 0 ? `${MINUS}${goldLost}` : '—',
        color: null,
      },
    ];
  } else if (state === 'defend_won') {
    stats = [
      { label: LABELS.you, value: '100%', color: 'green' },
      { label: opponentLabel, value: formatPct(opponentPct), color: null },
      reward,
    ];
  } else {
    stats = [
      { label: LABELS.walked, value: formatWalked(walkedM, unit), color: null },
      { label: LABELS.time, value: formatElapsed(elapsedMs), color: null },
      reward,
    ];
  }

  return {
    state,
    moment: MOMENTS[copy.moment],
    color: copy.color,
    eyebrow: { ...copy.eyebrow, params },
    body: { ...copy.body, params },
    stats,
    backToMap: { key: 'challengeResult.backToMap', defaultValue: 'BACK TO MAP' },
  };
}

module.exports = {
  challengeResultModel,
  formatWalked,
  formatElapsed,
};
