// lib/challengeScreen.js
// Pure decisions behind the Figma challenge screen (plan U13): which surface
// mounts, what the header and cancel button say, how a resolved contest maps
// to VICTORY / DEFEAT, and where CONTINUE goes.
//
// Copy is returned as { key, defaultValue, params } so the screen calls
// t(key, { defaultValue, ...params }) — the English default renders until the
// key lands in locales/*.json.
//
// CJS, no React — jest-testable via plain require().

const { mobileStateFromOutcome } = require('./contestResultHelpers');

/** 'claim' | 'attack' | 'defend', from ActiveClaim's route params. */
function challengeKind({ mode, role } = {}) {
  if (mode === 'defend') return 'defend';
  if (mode === 'attack') return 'attack';
  if (mode === 'contest') return role === 'defender' ? 'defend' : 'attack';
  return 'claim';
}

/**
 * Ring vs map. Each challenge's Figma surface ships as one unit with its
 * ending, so the flag that owns the ending owns the surface:
 *   claim          -> claim_celebration     (map + "Securing the claim…")
 *   attack/defend  -> contest_result_screen (map + VICTORY/DEFEAT overlay)
 * Flag ON restores today's ring and result screens.
 */
function showsChallengeMap(kind, getFlag) {
  return kind === 'claim'
    ? !getFlag('claim_celebration')
    : !getFlag('contest_result_screen');
}

const HEADERS = Object.freeze({
  claim: {
    header: { key: 'activeClaim.claiming', defaultValue: 'CLAIMING' },
    cancel: { key: 'activeClaim.cancelClaim', defaultValue: 'Cancel claim' },
  },
  attack: {
    header: { key: 'activeClaim.attacking', defaultValue: 'ATTACKING' },
    cancel: { key: 'activeClaim.cancelAttack', defaultValue: 'Cancel attack' },
  },
  defend: {
    header: { key: 'activeClaim.defending', defaultValue: 'DEFENDING' },
    cancel: { key: 'activeClaim.cancelDefense', defaultValue: 'Cancel defense' },
  },
});

/** Header label and cancel label for a challenge kind. */
function challengeHeaderCopy(kind) {
  return HEADERS[kind] ?? HEADERS.claim;
}

const RESULT_COPY = Object.freeze({
  defend_won: {
    variant: 'victory',
    title: { key: 'challengeResult.defendWonTitle', defaultValue: 'Defend won, territory is saved.' },
    body: { key: 'challengeResult.defendWonBody', defaultValue: '{{territory}} territory stays with you' },
  },
  defend_lost: {
    variant: 'defeat',
    title: { key: 'challengeResult.defendLostTitle', defaultValue: 'Defend lost, better luck next time!' },
    body: { key: 'challengeResult.defendLostBody', defaultValue: '{{territory}} now belongs to {{owner}}' },
  },
  attack_won: {
    variant: 'victory',
    title: { key: 'challengeResult.attackWonTitle', defaultValue: 'Attack won, territory is yours.' },
    body: { key: 'challengeResult.attackWonBody', defaultValue: '{{territory}} now belongs to you' },
  },
  attack_lost: {
    variant: 'defeat',
    title: { key: 'challengeResult.attackLostTitle', defaultValue: 'Attack lost, better luck next time!' },
    body: { key: 'challengeResult.attackLostBody', defaultValue: '{{territory}} stays with {{owner}}' },
  },
});

const VARIANT_LABEL = Object.freeze({
  victory: { key: 'challengeResult.victory', defaultValue: 'VICTORY' },
  defeat: { key: 'challengeResult.defeat', defaultValue: 'DEFEAT' },
});

/**
 * Overlay content for a resolved contest.
 *
 * `opponentName` is the other side: for a defender the attacker (who becomes
 * the owner on a loss), for an attacker the territory's owner (who keeps it on
 * a loss).
 */
function challengeResult({ outcome, role, territoryName, opponentName }) {
  const state = mobileStateFromOutcome(outcome, role);
  const copy = RESULT_COPY[state];
  const params = { territory: territoryName, owner: opponentName };
  return {
    state,
    variant: copy.variant,
    label: VARIANT_LABEL[copy.variant],
    title: copy.title,
    body: { ...copy.body, params },
  };
}

/**
 * navigation.navigate(name, params) arguments for CONTINUE. The map celebrates
 * ground taken (claim red), held (alliance green) or lost (enemy blue), as
 * ContestResultScreen does; a failed attack changes nothing on the board.
 */
function continueToMap({ state, geojson }) {
  const mode =
    state === 'attack_won' || state === 'claim_won' ? 'captured'
    : state === 'defend_won' ? 'held'
    : state === 'defend_lost' ? 'lost'
    : null;
  if (mode && geojson) {
    return ['MainTabs', { screen: 'Map', params: { celebration: { geojson, mode } } }];
  }
  return ['MainTabs', { screen: 'Map' }];
}

/** Where a secured claim goes: the map, with the capture celebration when fresh. */
function securedClaimToMap({ envelope, geojson }) {
  return continueToMap({
    state: envelope?.already_completed === false ? 'claim_won' : null,
    geojson,
  });
}

module.exports = {
  challengeKind,
  showsChallengeMap,
  challengeHeaderCopy,
  challengeResult,
  continueToMap,
  securedClaimToMap,
};
