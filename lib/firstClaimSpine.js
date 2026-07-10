// First-claim onboarding spine — pure state machine (4th iteration).
//
// The spine is the entire onboarding: Beat 1 camera hook → Beat 2 pulsing
// objective → Beat 3 territory sheet with CLAIM IT / LATER. It runs once per
// account, is resumable mid-run (an app kill resumes at the current beat,
// except the camera flight, which replays only if Beat 1 never completed),
// and never renders again after any exit: CLAIM IT, a completed claim, or
// the LATER couch close.
//
// Pure and dependency-free by design; persistence lives in
// lib/firstClaimSpineStore.js. CommonJS (like lib/formulas.js) so the
// plain-node jest suite can load it; Metro interops it into screen imports.

const SPINE_BEATS = ['flight', 'objective', 'sheet'];

const SPINE_EVENTS = {
  FLIGHT_SETTLED: 'flight_settled',
  SHEET_OPENED: 'sheet_opened',
  SHEET_DISMISSED: 'sheet_dismissed', // the D6 couch close
  CLAIM_STARTED: 'claim_started', // CLAIM IT pressed
  CLAIM_COMPLETED: 'claim_completed', // held_count > 0 observed
  NO_OBJECTIVE: 'no_objective', // no claimable target — route to standard map
};

function initialSpineState() {
  return {
    beat: 'flight',
    flightDone: false,
    complete: false,
    completedVia: null,
  };
}

function completedState(via, previous) {
  return {
    beat: previous?.beat ?? 'flight',
    flightDone: previous?.flightDone ?? false,
    complete: true,
    completedVia: via,
  };
}

/**
 * Pure transition. Unknown events and transitions that make no sense for the
 * current beat return the state unchanged — the machine can only move
 * forward, and a completed spine absorbs everything.
 */
function spineReduce(state, event) {
  const s = state ?? initialSpineState();
  if (s.complete) return s;

  switch (event) {
    case SPINE_EVENTS.FLIGHT_SETTLED:
      if (s.beat !== 'flight') return s;
      return { ...s, beat: 'objective', flightDone: true };
    case SPINE_EVENTS.SHEET_OPENED:
      if (s.beat !== 'objective' && s.beat !== 'sheet') return s;
      return { ...s, beat: 'sheet' };
    case SPINE_EVENTS.SHEET_DISMISSED:
      if (s.beat !== 'sheet') return s;
      return completedState('later', s);
    case SPINE_EVENTS.CLAIM_STARTED:
      return completedState('claim', s);
    case SPINE_EVENTS.CLAIM_COMPLETED:
      return completedState('claimed', s);
    case SPINE_EVENTS.NO_OBJECTIVE:
      return completedState('no_objective', s);
    default:
      return s;
  }
}

function isSpineComplete(state) {
  return state?.complete === true;
}

/**
 * Which beat to render when the map mounts with this persisted state.
 * null = the spine never renders (completed, or never valid).
 * Camera-replay rule: the flight replays only if Beat 1 never completed;
 * any later beat resumes in place with no second flight.
 */
function resumeBeat(state) {
  if (!state || state.complete) return null;
  if (!state.flightDone) return 'flight';
  return SPINE_BEATS.includes(state.beat) && state.beat !== 'flight'
    ? state.beat
    : 'objective';
}

/** JSON-safe snapshot for AsyncStorage. */
function serialiseSpineState(state) {
  const s = state ?? initialSpineState();
  return JSON.stringify({
    beat: s.beat,
    flightDone: s.flightDone === true,
    complete: s.complete === true,
    completedVia: s.completedVia ?? null,
  });
}

/** Parse a stored snapshot. Garbage in → null (caller starts fresh). */
function deserialiseSpineState(raw) {
  if (typeof raw !== 'string' || raw.length === 0) return null;
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  if (!SPINE_BEATS.includes(parsed.beat)) return null;
  return {
    beat: parsed.beat,
    flightDone: parsed.flightDone === true,
    complete: parsed.complete === true,
    completedVia:
      typeof parsed.completedVia === 'string' ? parsed.completedVia : null,
  };
}

module.exports = {
  SPINE_BEATS,
  SPINE_EVENTS,
  initialSpineState,
  spineReduce,
  isSpineComplete,
  resumeBeat,
  serialiseSpineState,
  deserialiseSpineState,
};
