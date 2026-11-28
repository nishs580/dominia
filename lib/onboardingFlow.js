/**
 * lib/onboardingFlow.js
 *
 * Figma onboarding (plan U10) as a pure reducer, so the order of screens and
 * the order of side effects can be tested without React or the network.
 *
 *   splash → landing → (email form → [6-digit code]) | Google | Apple → choose name
 *     → age → daily rewards → location permission → city intro (silent pin)
 *     → map, with the FTUE welcome ("WALK IT TO OWN IT.") over it → the
 *     "WELCOME TO DOMINIA" tap-to-continue card → five core-loop cards
 *
 * Which onboarding runs:
 *   legacy_tabs on  → today's OnboardingScreen, untouched.
 *   legacy_tabs off → this flow. Within it, home_bases on swaps the silent pin
 *                     save at city intro for the visible set-your-base step.
 *
 * The reducer never performs a side effect. Each transition returns the next
 * state with an `effects` list (only for that transition) and a bumped `seq`;
 * the host screen runs the effects and dispatches their results back:
 *
 *   { type: 'patchAge', ageBand }          PATCH /me { age_band }
 *   { type: 'requestLocation' }            OS location prompt + current fix
 *   { type: 'saveHomePin', lat, lng }      POST /me/home-pin
 *   { type: 'claimReward' }                POST /me/daily-reward/claim
 *   { type: 'finishOnboarding' }           PATCH /me { has_onboarded: true }
 *   { type: 'markSeen', names }            lib/walkthroughFlags markFired
 *
 * Rules the reducer enforces:
 *   - Under 13 routes to the blocked step and emits nothing: no PATCH, no save.
 *   - The silent home pin is rounded to 2 decimals (about 1 km).
 *   - The first daily-reward claim is emitted only once the home pin is saved,
 *     so the server dates it in the player's real timezone. Tapping collect
 *     only records the intent.
 *   - Location denied (or no fix) falls back to the locale's city centre.
 *
 * CommonJS (like lib/flags.js) so the plain-node jest suite can load it.
 */

'use strict';

const STEPS = Object.freeze({
  SPLASH: 'splash',
  LANDING: 'landing',
  EMAIL_FORM: 'emailForm',
  VERIFY_CODE: 'verifyCode',
  USERNAME: 'username',
  GATE: 'gate', // existing account: AuthGate decides
  AGE: 'age',
  AGE_BLOCKED: 'ageBlocked',
  DAILY_REWARD: 'dailyReward',
  LOCATION: 'location',
  SET_BASE: 'setBase',
  CITY_INTRO: 'cityIntro',
  FINISHING: 'finishing',
  FTUE: 'ftue', // "WALK IT TO OWN IT." welcome over the map
  WELCOME: 'welcome', // "WELCOME TO DOMINIA" tap-to-continue card
  TUTORIAL: 'tutorial',
  DONE: 'done',
});

const MIN_AGE = 13;
const ADULT_AGE = 18;

// Slider range on the age screen (Dominia-Temp: 1–100, no value until the
// first touch; see lib/ageSlider).
const AGE_SLIDER_MIN = 1;
const AGE_SLIDER_MAX = 100;

// The five tutorial cards, in order. `name` is the walkthroughFlags key that
// marks each one seen; Skip marks all five.
const TUTORIAL_CARDS = Object.freeze([
  Object.freeze({ id: 'territories', name: 'tutorial:territories' }),
  Object.freeze({ id: 'howToStart', name: 'tutorial:howToStart' }),
  Object.freeze({ id: 'claiming', name: 'tutorial:claiming' }),
  Object.freeze({ id: 'attackDefend', name: 'tutorial:attackDefend' }),
  Object.freeze({ id: 'endGoal', name: 'tutorial:endGoal' }),
]);
const TUTORIAL_NAMES = Object.freeze(TUTORIAL_CARDS.map((c) => c.name));

// Set when Figma onboarding finishes, so the welcome overlay and tutorial
// fire on the first map visit after it (and only then).
const TUTORIAL_PENDING_FLAG = 'onboarding:tutorialPending';

// Locale city centres, used when location is denied or unavailable. The ru
// cohort plays in Saint Petersburg; everyone else starts in Bengaluru (same
// centres as OnboardingScreen's fallback).
const FALLBACK_CENTRES = Object.freeze({
  bengaluru: Object.freeze({ lat: 12.9716, lng: 77.5946 }),
  saintPetersburg: Object.freeze({ lat: 59.9343, lng: 30.3158 }),
});

function fallbackCentreForLocale(language) {
  return String(language || '').toLowerCase().startsWith('ru')
    ? FALLBACK_CENTRES.saintPetersburg
    : FALLBACK_CENTRES.bengaluru;
}

/** Age band sent to PATCH /me, or null when the player is under 13. */
function ageBandFor(age) {
  const n = Math.floor(Number(age));
  if (!Number.isFinite(n) || n < MIN_AGE) return null;
  return n < ADULT_AGE ? '13_17' : '18_plus';
}

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

/** Rounds a position to 2 decimal places (about 1 km). null if invalid. */
function roundPin(coords) {
  const lat = Number(coords?.lat);
  const lng = Number(coords?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat: round2(lat), lng: round2(lng) };
}

/** Figma onboarding runs only with `legacy_tabs` off. */
function usesFigmaOnboarding(getFlag) {
  return !getFlag('legacy_tabs');
}

/**
 * Returning players: show Daily Rewards on launch when Figma mode is on, the
 * player has finished onboarding, and the server says today's reward is
 * unclaimed. Any failure resolves to "don't show".
 */
function shouldShowReturningReward({ figma, hasOnboarded, reward }) {
  return Boolean(figma && hasOnboarded && reward && reward.available === true);
}

function initialState({ entry = STEPS.SPLASH, homeBases = false } = {}) {
  return {
    step: entry,
    homeBases: Boolean(homeBases),
    authMode: null, // 'signup' | 'signin'
    authMethod: null, // 'email' | 'google'
    ageBand: null,
    rewardCollectRequested: false,
    rewardClaimSent: false,
    locationGranted: null,
    usedFallback: false,
    suggestedCentre: null, // set-your-base camera start
    pin: null, // { lat, lng } being or already saved
    pinStatus: 'none', // 'none' | 'saving' | 'saved' | 'failed'
    homeCity: null,
    finishError: false,
    tutorialIndex: 0,
    effects: [],
    seq: 0,
  };
}

// Typed age on the age screen: whole numbers only, clamped to the slider's
// range. Empty or anything not a plain whole number returns null, and the
// screen keeps the last valid age.
function parseTypedAge(text) {
  const v = String(text ?? '').trim();
  if (!/^\d{1,3}$/.test(v)) return null;
  const n = Number(v);
  return Math.min(AGE_SLIDER_MAX, Math.max(AGE_SLIDER_MIN, n));
}

function to(state, patch, effects = []) {
  return { ...state, ...patch, effects, seq: state.seq + 1 };
}

function afterAuth(state, needsUsername) {
  return to(state, { step: needsUsername ? STEPS.USERNAME : STEPS.GATE });
}

function savePinEffect(pin) {
  return { type: 'saveHomePin', lat: pin.lat, lng: pin.lng };
}

function onboardingReducer(state, event) {
  const s = state || initialState();
  const e = event || {};

  switch (e.type) {
    // ---- pre-auth -------------------------------------------------------
    case 'SPLASH_DONE':
      if (s.step !== STEPS.SPLASH) return s;
      return to(s, { step: STEPS.LANDING });

    case 'CHOOSE_EMAIL':
      if (s.step !== STEPS.LANDING) return s;
      return to(s, { step: STEPS.EMAIL_FORM, authMode: 'signup', authMethod: 'email' });

    case 'CHOOSE_SIGN_IN':
      if (s.step !== STEPS.LANDING) return s;
      return to(s, { step: STEPS.EMAIL_FORM, authMode: 'signin', authMethod: 'email' });

    case 'GOOGLE_AUTH_SUCCESS':
      if (s.step !== STEPS.LANDING && s.step !== STEPS.EMAIL_FORM) return s;
      return afterAuth({ ...s, authMethod: 'google' }, Boolean(e.needsUsername));

    case 'EMAIL_SUBMITTED':
      if (s.step !== STEPS.EMAIL_FORM) return s;
      if (e.codeRequired) return to(s, { step: STEPS.VERIFY_CODE });
      return afterAuth(s, Boolean(e.needsUsername));

    case 'CODE_VERIFIED':
      if (s.step !== STEPS.VERIFY_CODE) return s;
      return afterAuth(s, Boolean(e.needsUsername));

    case 'USERNAME_SET':
      if (s.step !== STEPS.USERNAME) return s;
      return to(s, { step: STEPS.AGE });

    // ---- age ------------------------------------------------------------
    case 'AGE_SUBMITTED': {
      if (s.step !== STEPS.AGE) return s;
      const ageBand = ageBandFor(e.age);
      if (!ageBand) return to(s, { step: STEPS.AGE_BLOCKED, ageBand: null });
      return to(s, { step: STEPS.DAILY_REWARD, ageBand }, [{ type: 'patchAge', ageBand }]);
    }

    case 'AGE_BACK':
      if (s.step !== STEPS.AGE_BLOCKED) return s;
      return to(s, { step: STEPS.AGE });

    // The back arrow / BACK button (Updated UX): age → choose name, blocked
    // → age, and tutorial card n → card n-1. The host navigates to the
    // Username route when the step becomes USERNAME.
    case 'BACK':
      if (s.step === STEPS.AGE) return to(s, { step: STEPS.USERNAME });
      if (s.step === STEPS.AGE_BLOCKED) return to(s, { step: STEPS.AGE });
      if (s.step === STEPS.TUTORIAL && s.tutorialIndex > 0) {
        return to(s, { tutorialIndex: s.tutorialIndex - 1 });
      }
      return s;

    // ---- daily reward ---------------------------------------------------
    // Collect records intent only; the claim waits for the saved home pin.
    case 'REWARD_COLLECT':
      if (s.step !== STEPS.DAILY_REWARD) return s;
      return to(s, { step: STEPS.LOCATION, rewardCollectRequested: true }, [{ type: 'requestLocation' }]);

    case 'REWARD_SKIP':
    case 'REWARD_UNAVAILABLE':
      if (s.step !== STEPS.DAILY_REWARD) return s;
      return to(s, { step: STEPS.LOCATION, rewardCollectRequested: false }, [{ type: 'requestLocation' }]);

    // ---- location + home pin -------------------------------------------
    case 'LOCATION_RESULT': {
      if (s.step !== STEPS.LOCATION) return s;
      const granted = Boolean(e.granted);
      const fix = granted ? roundPin(e.coords) : null;
      const fallback = roundPin(e.fallback) || roundPin(FALLBACK_CENTRES.bengaluru);
      const usedFallback = !fix;
      if (s.homeBases) {
        // Visible set-your-base: the player places the pin; nothing saved yet.
        const raw = granted && e.coords ? { lat: Number(e.coords.lat), lng: Number(e.coords.lng) } : null;
        return to(s, {
          step: STEPS.SET_BASE,
          locationGranted: granted,
          usedFallback,
          suggestedCentre: raw && Number.isFinite(raw.lat) && Number.isFinite(raw.lng) ? raw : fallback,
        });
      }
      const pin = fix || fallback;
      return to(
        s,
        { step: STEPS.CITY_INTRO, locationGranted: granted, usedFallback, pin, pinStatus: 'saving' },
        [savePinEffect(pin)],
      );
    }

    case 'BASE_CONFIRMED': {
      if (s.step !== STEPS.SET_BASE || s.pinStatus === 'saving') return s;
      const lat = Number(e.coords?.lat);
      const lng = Number(e.coords?.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return s;
      // A deliberate pin keeps today's precision (OnboardingScreen saves it raw).
      const pin = { lat, lng };
      return to(s, { pin, pinStatus: 'saving' }, [savePinEffect(pin)]);
    }

    case 'PIN_SAVED': {
      if (s.pinStatus !== 'saving') return s;
      const effects = [];
      let { rewardClaimSent } = s;
      if (s.rewardCollectRequested && !rewardClaimSent) {
        effects.push({ type: 'claimReward' });
        rewardClaimSent = true;
      }
      return to(
        s,
        {
          step: s.step === STEPS.SET_BASE ? STEPS.CITY_INTRO : s.step,
          pinStatus: 'saved',
          homeCity: e.homeCity || null,
          rewardClaimSent,
        },
        effects,
      );
    }

    case 'PIN_SAVE_FAILED':
      if (s.pinStatus !== 'saving') return s;
      return to(s, { pinStatus: 'failed' });

    case 'PIN_RETRY':
      if (s.pinStatus !== 'failed' || !s.pin) return s;
      return to(s, { pinStatus: 'saving' }, [savePinEffect(s.pin)]);

    // City intro NEXT. A failed save never blocks onboarding: the player
    // continues without the claim, and the returning-player check offers the
    // reward on the next launch.
    case 'CITY_NEXT':
      if (s.step !== STEPS.CITY_INTRO || s.pinStatus === 'saving') return s;
      return to(s, { step: STEPS.FINISHING, finishError: false }, [{ type: 'finishOnboarding' }]);

    case 'FINISHED':
      if (s.step !== STEPS.FINISHING) return s;
      return to(s, { step: STEPS.FTUE, tutorialIndex: 0 });

    case 'FINISH_FAILED':
      if (s.step !== STEPS.FINISHING) return s;
      return to(s, { step: STEPS.CITY_INTRO, finishError: true });

    // ---- on the map -----------------------------------------------------
    // LET'S GO on the FTUE welcome opens the explainer deck.
    case 'FTUE_GO':
      if (s.step !== STEPS.FTUE) return s;
      return to(s, { step: STEPS.WELCOME, tutorialIndex: 0 });

    case 'WELCOME_TAP':
      if (s.step !== STEPS.WELCOME) return s;
      return to(s, { step: STEPS.TUTORIAL, tutorialIndex: 0 });

    // NEXT on cards 1–4; NEXT on the last card finishes.
    case 'TUTORIAL_NEXT':
      if (s.step !== STEPS.TUTORIAL) return s;
      if (s.tutorialIndex < TUTORIAL_CARDS.length - 1) {
        return to(s, { tutorialIndex: s.tutorialIndex + 1 });
      }
      return to(s, { step: STEPS.DONE }, [{ type: 'markSeen', names: TUTORIAL_NAMES.slice() }]);

    // SKIP on the FTUE welcome or any card ends the deck and marks it seen.
    case 'TUTORIAL_SKIP':
      if (s.step !== STEPS.TUTORIAL && s.step !== STEPS.WELCOME && s.step !== STEPS.FTUE) return s;
      return to(s, { step: STEPS.DONE }, [{ type: 'markSeen', names: TUTORIAL_NAMES.slice() }]);

    default:
      return s;
  }
}

module.exports = {
  STEPS,
  MIN_AGE,
  AGE_SLIDER_MIN,
  AGE_SLIDER_MAX,
  TUTORIAL_CARDS,
  TUTORIAL_NAMES,
  TUTORIAL_PENDING_FLAG,
  FALLBACK_CENTRES,
  fallbackCentreForLocale,
  ageBandFor,
  parseTypedAge,
  roundPin,
  usesFigmaOnboarding,
  shouldShowReturningReward,
  initialState,
  onboardingReducer,
};
