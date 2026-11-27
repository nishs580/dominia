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

// ─── Dominia-Temp challenge flow (plan 2026-11-28 U7; boards "Challenge
// flow", "Challenge cases 1–6") ───────────────────────────────────────────

const FIGMA_HEADERS = Object.freeze({
  claim: {
    eyebrow: { key: 'activeClaim.figma.eyebrowClaiming', defaultValue: 'CLAIMING' },
    cancel: { key: 'activeClaim.figma.cancelClaim', defaultValue: 'CANCEL CLAIM' },
    prompt: { key: 'activeClaim.figma.cancelPromptClaim', defaultValue: 'Are you sure that you want to cancel the claim?' },
    cancelling: { key: 'activeClaim.figma.cancellingClaimLine', defaultValue: 'Cancelling the Claim…' },
  },
  attack: {
    eyebrow: { key: 'activeClaim.figma.eyebrowAttacking', defaultValue: 'ATTACKING' },
    cancel: { key: 'activeClaim.figma.cancelAttack', defaultValue: 'CANCEL ATTACK' },
    prompt: { key: 'activeClaim.figma.cancelPromptAttack', defaultValue: 'Are you sure that you want to cancel the attack?' },
    cancelling: { key: 'activeClaim.figma.cancellingAttackLine', defaultValue: 'Cancelling the Attack…' },
  },
  defend: {
    eyebrow: { key: 'activeClaim.figma.eyebrowDefending', defaultValue: 'DEFENDING' },
    cancel: { key: 'activeClaim.figma.cancelDefend', defaultValue: 'CANCEL DEFEND' },
    prompt: { key: 'activeClaim.figma.cancelPromptDefend', defaultValue: 'Are you sure that you want to cancel the defend?' },
    cancelling: { key: 'activeClaim.figma.cancellingDefendLine', defaultValue: 'Cancelling the Defend…' },
  },
});

const CONTINUE_CHALLENGE = Object.freeze({ key: 'activeClaim.figma.continueChallenge', defaultValue: 'CONTINUE CHALLENGE' });
const IN_PROGRESS = Object.freeze({ key: 'activeClaim.figma.inProgressChip', defaultValue: 'IN PROGRESS' });
const FILL_HINT = Object.freeze({ key: 'activeClaim.figma.fillHint', defaultValue: 'Walk anywhere, The territory fills as your distance adds up' });
const SECURING = Object.freeze({ key: 'activeClaim.figma.securingLine', defaultValue: 'Securing the Claim…' });

/**
 * In-progress chrome for a challenge kind: the CLAIMING / ATTACKING /
 * DEFENDING eyebrow, the IN PROGRESS chip, the instruction line, the cancel
 * button, the bottom confirm panel and the full-screen status lines.
 */
function challengeHeaderModel(kind) {
  const h = FIGMA_HEADERS[kind] ?? FIGMA_HEADERS.claim;
  return {
    eyebrow: h.eyebrow,
    chip: IN_PROGRESS,
    fillHint: FILL_HINT,
    cancel: h.cancel,
    dialog: { prompt: h.prompt, keep: CONTINUE_CHALLENGE, confirm: h.cancel },
    cancelling: h.cancelling,
    securing: SECURING,
  };
}

function wholeMetres(n) {
  return Math.max(0, Math.round(Number(n) || 0));
}

/**
 * Line under the big percentage: "2 / 5m". Null when the requirement is not
 * known yet (a direct defend before the attacker has moved carries 0).
 */
function progressCaption(kind, { walkedM = 0, requiredM = 0 } = {}) {
  const required = wholeMetres(requiredM);
  if (required <= 0) return null;
  return {
    key: 'activeClaim.figma.progressCaption',
    defaultValue: '{{walked}} / {{required}}m',
    params: { walked: Math.min(wholeMetres(walkedM), required), required },
  };
}

/**
 * The opponent's perimeter line on attacks and defends, as a 0..1 fraction.
 * Null on claims and whenever the contest status has not carried
 * `opponent_pct` (or it is 0) — the line never guesses at the other walker.
 */
function opponentProgress(kind, opponentPct) {
  if (kind !== 'attack' && kind !== 'defend') return null;
  if (typeof opponentPct !== 'number' || !Number.isFinite(opponentPct)) return null;
  if (opponentPct <= 0) return null;
  return Math.min(100, opponentPct) / 100;
}

/** TIME LEFT value: "09 : 32", or "1 : 02 : 05" from an hour. */
function formatClock(ms) {
  const total = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
  const h = Math.floor(total / 3600);
  const mm = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
  const ss = String(total % 60).padStart(2, '0');
  return h > 0 ? `${h} : ${mm} : ${ss}` : `${mm} : ${ss}`;
}

/**
 * Ready screen (board "Ready to claim"): the seconds-to-start tile, the walk
 * line, the window line, the Gold stake, and whether START WALK is live.
 * Same rule as the territory card: when the server says the player is short
 * of Gold, START is disabled with a "Not enough gold" hint.
 */
function readyScreenModel({
  secondsLeft,
  perimeterM,
  walkWindowMinutes,
  goldPaid,
  freeClaim = false,
  armError = null,
} = {}) {
  const seconds = Math.max(0, Math.ceil(Number(secondsLeft) || 0));
  const minutes = Number(walkWindowMinutes);
  const gold = Number(goldPaid);
  const insufficient = armError === 'insufficient_gold';
  let hint = null;
  if (insufficient) hint = { key: 'activeClaim.figma.notEnoughGold', defaultValue: 'Not enough gold' };
  else if (armError) hint = { key: 'activeClaim.arm.error', defaultValue: 'Could not start the walk. Tap to try again.' };
  return {
    countdown: String(seconds),
    countdownLabel: { key: 'activeClaim.arm.countdownLabel', defaultValue: 'SECONDS TO START' },
    title: {
      key: 'activeClaim.figma.readyTitle',
      defaultValue: 'WALK {{metres}}M TO CLAIM IT.',
      params: { metres: wholeMetres(perimeterM) },
    },
    body: Number.isFinite(minutes) && minutes > 0
      ? {
          key: 'activeClaim.figma.readyBody',
          defaultValue: 'Start when you are ready to move. You get {{minutes}} minutes to cover it, walk anywhere',
          params: { minutes },
        }
      : { key: 'activeClaim.figma.readyBodyNoWindow', defaultValue: 'Start when you are ready to move. Walk anywhere' },
    stake: !freeClaim && Number.isFinite(gold) && gold > 0
      ? { key: 'activeClaim.figma.readyStake', defaultValue: '{{gold}} Gold is used once you start', params: { gold } }
      : null,
    start: { key: 'activeClaim.figma.startWalk', defaultValue: 'START WALK' },
    notYet: { key: 'activeClaim.figma.notYet', defaultValue: 'NOT YET' },
    startDisabled: insufficient,
    hint,
  };
}

// ─── Perimeter trace (the lime / red progress lines on the territory) ────

function signedArea(ring) {
  if (!Array.isArray(ring)) return 0;
  let a = 0;
  for (let i = 0; i < ring.length - 1; i += 1) {
    a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  }
  return a / 2;
}

function outerRing(geometry) {
  if (!geometry) return null;
  let ring = null;
  if (geometry.type === 'Polygon') ring = geometry.coordinates?.[0];
  else if (geometry.type === 'MultiPolygon') {
    // The largest polygon's outer ring carries the trace.
    let best = -1;
    for (const poly of geometry.coordinates ?? []) {
      const r = poly?.[0];
      const a = Math.abs(signedArea(r));
      if (Array.isArray(r) && a > best) { best = a; ring = r; }
    }
  }
  if (!Array.isArray(ring)) return null;
  const pts = ring.filter((p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]));
  if (pts.length < 3) return null;
  const first = pts[0];
  const last = pts[pts.length - 1];
  // Closed, so the trace goes all the way round.
  return first[0] === last[0] && first[1] === last[1] ? pts : [...pts, first];
}

/**
 * The first `fraction` of the territory's perimeter, walked from the ring's
 * first vertex, as a LineString plus the head point where the dot sits.
 * Lengths use a local equirectangular scale (fine at territory size).
 * `inward` is the Mapbox lineOffset sign that pushes a line inside the
 * polygon (a positive offset is to the right of the drawing direction).
 *
 * -> { line: LineString | null, head: [lng, lat] | null, inward: 1 | -1 }
 */
function perimeterTrace(geometry, fraction) {
  const ring = outerRing(geometry);
  if (!ring) return { line: null, head: null, inward: -1 };
  const f = Math.max(0, Math.min(1, Number(fraction) || 0));
  // Counter-clockwise ring: the inside is on the left, so offset negative.
  const inward = signedArea(ring) >= 0 ? -1 : 1;
  const k = Math.cos((ring[0][1] * Math.PI) / 180);
  const segs = [];
  let total = 0;
  for (let i = 0; i < ring.length - 1; i += 1) {
    const len = Math.hypot((ring[i + 1][0] - ring[i][0]) * k, ring[i + 1][1] - ring[i][1]);
    segs.push(len);
    total += len;
  }
  if (total <= 0) return { line: null, head: ring[0], inward };
  const target = f * total;
  const coords = [ring[0]];
  let run = 0;
  let head = ring[0];
  for (let i = 0; i < segs.length; i += 1) {
    const len = segs[i];
    if (run + len >= target) {
      const tt = len > 0 ? (target - run) / len : 0;
      head = [
        ring[i][0] + (ring[i + 1][0] - ring[i][0]) * tt,
        ring[i][1] + (ring[i + 1][1] - ring[i][1]) * tt,
      ];
      coords.push(head);
      break;
    }
    run += len;
    coords.push(ring[i + 1]);
    head = ring[i + 1];
  }
  return {
    line: target > 0 ? { type: 'LineString', coordinates: coords } : null,
    head,
    inward,
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
  opponentProgress,
  formatClock,
  readyScreenModel,
  perimeterTrace,
  showsConnectionBanner,
  challengeKind,
  showsChallengeMap,
  challengeHeaderCopy,
  challengeResult,
  continueToMap,
  securedClaimToMap,
};
