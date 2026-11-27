// lib/challengeResult.js
// Pure model behind the Dominia-Temp result overlay (plan 2026-11-28 U7;
// boards "Victory", "Defeat", "Challenge cases 5–6"): VICTORY in lime or
// DEFEAT in red over the dimmed challenge screen, the glowing or cracked
// territory tile, a shield glyph, a headline and an owner line.
//
//   claim won    VICTORY  "Territory claimed"                   "<Name> is yours now"
//   attack won   VICTORY  "Attack won, territory is yours"      "<Name> now belongs to you"
//   attack lost  DEFEAT   "Attack lost, better luck next time!" "<Name> stays with <Owner>"
//   defend won   VICTORY  "Defend won, territory is saved"      "<Name> territory stays with you"
//   defend lost  DEFEAT   "Defend lost, better luck next time!" "<Name> now belongs to <Owner>"
//
// Supersedes the TAKEN / HELD / LOST moment (Figma is the source of truth).
// Copy is returned as { key, defaultValue, params } so the component calls
// t(key, { defaultValue, ...params }); `emphasisSegments` then bolds the
// territory and owner names inside the translated owner line.
//
// CJS, no React — jest-testable via plain require().

const { mobileStateFromOutcome } = require('./contestResultHelpers');
const { formatDistance } = require('./units');

const WORDS = Object.freeze({
  victory: { key: 'challengeResult.victory', defaultValue: 'VICTORY' },
  defeat: { key: 'challengeResult.defeat', defaultValue: 'DEFEAT' },
});

const COPY = Object.freeze({
  claim_won: {
    variant: 'victory',
    title: { key: 'challengeResult.figma.claimWonTitle', defaultValue: 'Territory claimed' },
    body: { key: 'challengeResult.figma.claimWonBody', defaultValue: '{{territory}} is yours now' },
  },
  attack_won: {
    variant: 'victory',
    title: { key: 'challengeResult.figma.attackWonTitle', defaultValue: 'Attack won, territory is yours' },
    body: { key: 'challengeResult.figma.attackWonBody', defaultValue: '{{territory}} now belongs to you' },
  },
  attack_lost: {
    variant: 'defeat',
    title: { key: 'challengeResult.figma.attackLostTitle', defaultValue: 'Attack lost, better luck next time!' },
    body: { key: 'challengeResult.figma.attackLostBody', defaultValue: '{{territory}} stays with {{owner}}' },
  },
  defend_won: {
    variant: 'victory',
    title: { key: 'challengeResult.figma.defendWonTitle', defaultValue: 'Defend won, territory is saved' },
    body: { key: 'challengeResult.figma.defendWonBody', defaultValue: '{{territory}} territory stays with you' },
  },
  defend_lost: {
    variant: 'defeat',
    title: { key: 'challengeResult.figma.defendLostTitle', defaultValue: 'Defend lost, better luck next time!' },
    body: { key: 'challengeResult.figma.defendLostBody', defaultValue: '{{territory}} now belongs to {{owner}}' },
  },
});

const VARIANTS = Object.freeze({
  // Glowing lime-outlined tile with a shield-check.
  victory: { color: 'lime', art: 'glow', icon: 'shieldCheck' },
  // Cracked red tile with a broken shield.
  defeat: { color: 'red', art: 'cracked', icon: 'shieldBroken' },
});

const CONTINUE = Object.freeze({ key: 'challengeResult.figma.tapToContinue', defaultValue: 'TAP TO CONTINUE' });

/**
 * Result overlay content.
 *
 * @param {object}  args
 * @param {'claim'|'attack'|'defend'} args.kind
 * @param {string}  [args.outcome]       contest outcome ('attacker_won' | 'defender_won'); ignored for claims.
 * @param {string}  [args.territoryName]
 * @param {string}  [args.opponentName]  the other walker: the new owner when a defend is lost,
 *                                       the owner who keeps it when an attack is lost.
 */
function challengeResultModel({ kind, outcome, territoryName = '', opponentName = '' } = {}) {
  const state = kind === 'claim'
    ? 'claim_won'
    : mobileStateFromOutcome(outcome, kind === 'defend' ? 'defender' : 'attacker');
  const copy = COPY[state] ?? COPY.attack_lost;
  const v = VARIANTS[copy.variant];
  const params = { territory: territoryName, owner: opponentName };
  return {
    state,
    variant: copy.variant,
    word: WORDS[copy.variant],
    color: v.color,
    art: v.art,
    icon: v.icon,
    title: copy.title,
    body: { ...copy.body, params },
    // Names the owner line bolds, in order of preference.
    emphasis: [territoryName, opponentName].filter((s) => typeof s === 'string' && s.trim()),
    continue: CONTINUE,
  };
}

/**
 * Splits a translated line into [{ text, bold }] so the names inside it can
 * be bolded without markup in the locale strings. Each name is bolded at its
 * first occurrence; longer names are matched first so "Park" never steals
 * from "Cubbon Park".
 */
function emphasisSegments(text, names = []) {
  const src = String(text ?? '');
  const wanted = [...new Set(names.filter((n) => typeof n === 'string' && n.length))]
    .sort((a, b) => b.length - a.length);
  const spans = [];
  for (const name of wanted) {
    let from = 0;
    while (from <= src.length) {
      const at = src.indexOf(name, from);
      if (at < 0) break;
      const end = at + name.length;
      if (!spans.some((s) => at < s.end && end > s.start)) {
        spans.push({ start: at, end });
        break;
      }
      from = at + 1;
    }
  }
  spans.sort((a, b) => a.start - b.start);
  const out = [];
  let i = 0;
  for (const s of spans) {
    if (s.start > i) out.push({ text: src.slice(i, s.start), bold: false });
    out.push({ text: src.slice(s.start, s.end), bold: true });
    i = s.end;
  }
  if (i < src.length) out.push({ text: src.slice(i), bold: false });
  return out;
}

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

module.exports = {
  challengeResultModel,
  emphasisSegments,
  formatWalked,
  formatElapsed,
};
