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

// ─── Figma in-progress chrome (plan U9; frames B5–B7, C6, D2) ────────────

const FIGMA_HEADERS = Object.freeze({
  claim: {
    tone: 'lime',
    icon: 'flag',
    eyebrow: { key: 'activeClaim.figma.eyebrowClaim', defaultValue: 'CLAIMING · IN PROGRESS' },
    cancel: { key: 'activeClaim.figma.cancelClaim', defaultValue: 'CANCEL CLAIM' },
    dialogTitle: { key: 'activeClaim.figma.cancelClaimTitle', defaultValue: 'CANCEL THE CLAIM?' },
    dialogBody: { key: 'activeClaim.figma.cancelClaimBody', defaultValue: 'Are you sure you want to cancel the claim? Your progress will be lost.' },
    cancellingTitle: { key: 'activeClaim.figma.cancellingClaim', defaultValue: 'CANCELLING THE CLAIM…' },
  },
  attack: {
    tone: 'red',
    icon: 'sword',
    eyebrow: { key: 'activeClaim.figma.eyebrowAttack', defaultValue: 'ATTACKING · DEFENDED BY {{name}}' },
    eyebrowNoName: { key: 'activeClaim.figma.eyebrowAttackNoName', defaultValue: 'ATTACKING · IN PROGRESS' },
    cancel: { key: 'activeClaim.figma.cancelAttack', defaultValue: 'CANCEL ATTACK' },
    dialogTitle: { key: 'activeClaim.figma.cancelAttackTitle', defaultValue: 'CANCEL THE ATTACK?' },
    dialogBody: { key: 'activeClaim.figma.cancelAttackBody', defaultValue: 'Are you sure you want to cancel the attack? Your progress will be lost.' },
    cancellingTitle: { key: 'activeClaim.figma.cancellingAttack', defaultValue: 'CANCELLING THE ATTACK…' },
  },
  defend: {
    tone: 'blue',
    icon: 'shield',
    eyebrow: { key: 'activeClaim.figma.eyebrowDefend', defaultValue: 'DEFENDING · ATTACKED BY {{name}}' },
    eyebrowNoName: { key: 'activeClaim.figma.eyebrowDefendNoName', defaultValue: 'DEFENDING · IN PROGRESS' },
    cancel: { key: 'activeClaim.figma.cancelDefend', defaultValue: 'CANCEL DEFEND' },
    dialogTitle: { key: 'activeClaim.figma.cancelDefendTitle', defaultValue: 'CANCEL THE DEFENCE?' },
    dialogBody: { key: 'activeClaim.figma.cancelDefendBody', defaultValue: 'Are you sure you want to cancel the defence? Your progress will be lost.' },
    cancellingTitle: { key: 'activeClaim.figma.cancellingDefend', defaultValue: 'CANCELLING THE DEFENCE…' },
  },
});

const CONTINUE_CHALLENGE = Object.freeze({ key: 'activeClaim.figma.continueChallenge', defaultValue: 'CONTINUE CHALLENGE' });
const CANCELLING_BODY = Object.freeze({ key: 'activeClaim.figma.cancellingBody', defaultValue: 'Taking you back to the map.' });

/**
 * Figma header + cancel flow copy for a challenge kind: coloured eyebrow
 * (lime claim, red attack, blue defend), its icon, the cancel button, the
 * confirm dialog and the "Cancelling…" state. `opponentName` fills the
 * attack/defend eyebrow; without one the eyebrow reads "· IN PROGRESS".
 */
function challengeHeaderModel(kind, { opponentName } = {}) {
  const h = FIGMA_HEADERS[kind] ?? FIGMA_HEADERS.claim;
  const name = typeof opponentName === 'string' ? opponentName.trim() : '';
  const eyebrow = kind === 'claim' || !FIGMA_HEADERS[kind]
    ? h.eyebrow
    : (name ? { ...h.eyebrow, params: { name } } : h.eyebrowNoName);
  return {
    tone: h.tone,
    icon: h.icon,
    eyebrow,
    cancel: h.cancel,
    // Cancel is a red outline on contests; the claim's is a quiet text button.
    cancelOutlined: h.tone !== 'lime',
    dialog: {
      title: h.dialogTitle,
      body: h.dialogBody,
      keep: CONTINUE_CHALLENGE,
      confirm: h.cancel,
    },
    cancelling: { title: h.cancellingTitle, body: CANCELLING_BODY },
  };
}

/**
 * Caption beside the big percentage: "2 / 5 M · WALK ANYWHERE" for claims,
 * "OF LOOP WALKED" for contests.
 */
function progressCaption(kind, { walkedM = 0, requiredM = 0 } = {}) {
  if (kind === 'claim') {
    return {
      key: 'activeClaim.figma.captionClaim',
      defaultValue: '{{walked}} / {{required}} M · WALK ANYWHERE',
      params: {
        walked: Math.max(0, Math.round(Number(walkedM) || 0)),
        required: Math.max(0, Math.round(Number(requiredM) || 0)),
      },
    };
  }
  return { key: 'activeClaim.figma.captionContest', defaultValue: 'OF LOOP WALKED' };
}

function clampPct(n) {
  return Math.round(Math.max(0, Math.min(100, n)));
}

/**
 * YOU vs OPPONENT progress bars on attacks and defends. Null on claims and
 * whenever the contest status response has not carried `opponent_pct` — the
 * bars never guess at the other walker.
 */
function opponentBars(kind, { myPct, opponentPct, opponentName } = {}) {
  if (kind !== 'attack' && kind !== 'defend') return null;
  if (typeof opponentPct !== 'number' || !Number.isFinite(opponentPct)) return null;
  const name = (typeof opponentName === 'string' && opponentName.trim())
    || null;
  const opponentLabel = name
    ? (kind === 'attack'
        ? { key: 'activeClaim.figma.barOpponentDefending', defaultValue: '{{name}} · DEFENDING', params: { name } }
        : { key: 'activeClaim.figma.barOpponentAttacking', defaultValue: '{{name}} · ATTACKING', params: { name } })
    : { key: 'activeClaim.figma.barOpponent', defaultValue: 'OPPONENT' };
  return {
    you: {
      label: kind === 'defend'
        ? { key: 'activeClaim.figma.barYouDefending', defaultValue: 'YOU · DEFENDING' }
        : { key: 'activeClaim.figma.barYou', defaultValue: 'YOU' },
      pct: clampPct(Number(myPct) || 0),
    },
    opponent: { label: opponentLabel, pct: clampPct(opponentPct) },
  };
}

/**
 * "CONNECTION LOST · RECONNECTING" shows only while a challenge is active and
 * the device is offline. NetInfo's `isInternetReachable` is null while
 * unknown — unknown is not offline.
 */
function showsConnectionBanner({ isConnected, isInternetReachable, challengeActive } = {}) {
  if (!challengeActive) return false;
  return isConnected === false || isInternetReachable === false;
}

/**
 * Whether ActiveClaim starts the contest sample producer. An attacker needs a
 * positive requirement; a defender always walks, because a direct defend
 * made before the attacker has moved carries requiredWalkM 0 (ratio × 0) and
 * the server resolves the contest off what both sides post.
 */
function startsContestWalk({ mode, contestId, playerId, requiredWalkM, role } = {}) {
  if (mode !== 'contest' || !contestId || !playerId) return false;
  const required = Math.max(0, Number(requiredWalkM) || 0);
  return required > 0 || role === 'defender';
}

module.exports = {
  startsContestWalk,
  challengeHeaderModel,
  progressCaption,
  opponentBars,
  showsConnectionBanner,
  challengeKind,
  showsChallengeMap,
  challengeHeaderCopy,
  challengeResult,
  continueToMap,
  securedClaimToMap,
};
