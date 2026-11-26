/**
 * lib/__tests__/onboardingFlow.test.js
 *
 * Figma onboarding reducer (plan U10): screen order, side-effect order and the
 * age, pin and daily-reward rules.
 */

const flags = require('../flags');
const {
  STEPS,
  TUTORIAL_CARDS,
  TUTORIAL_NAMES,
  FALLBACK_CENTRES,
  fallbackCentreForLocale,
  ageBandFor,
  parseTypedAge,
  roundPin,
  usesFigmaOnboarding,
  shouldShowReturningReward,
  initialState,
  onboardingReducer,
} = require('../onboardingFlow');

// Feeds events in order, collecting the step after each and every effect.
function run(events, start = initialState()) {
  let state = start;
  const steps = [state.step];
  const effects = [];
  for (const ev of events) {
    const prev = state;
    state = onboardingReducer(state, ev);
    if (state === prev) continue; // ignored event: no transition, no effects
    if (steps[steps.length - 1] !== state.step) steps.push(state.step);
    for (const fx of state.effects) effects.push({ after: ev.type, ...fx });
  }
  return { state, steps, effects };
}

const RAW = { lat: 12.97194, lng: 77.59369 };

// Haversine distance in metres.
function distanceM(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const UNTIL_REWARD = [
  { type: 'SPLASH_DONE' },
  { type: 'CHOOSE_EMAIL' },
  { type: 'EMAIL_SUBMITTED', codeRequired: false, needsUsername: true },
  { type: 'USERNAME_SET' },
  { type: 'AGE_SUBMITTED', age: 24 },
];

describe('fresh sign-up', () => {
  test('email walks splash → landing → form → name → age → reward → city → welcome → cards', () => {
    const { steps, state } = run([
      ...UNTIL_REWARD,
      { type: 'REWARD_COLLECT' },
      { type: 'LOCATION_RESULT', granted: true, coords: RAW, fallback: FALLBACK_CENTRES.bengaluru },
      { type: 'PIN_SAVED', homeCity: 'Bengaluru' },
      { type: 'CITY_NEXT' },
      { type: 'FINISHED' },
      { type: 'WELCOME_TAP' },
      { type: 'TUTORIAL_NEXT' },
      { type: 'TUTORIAL_NEXT' },
      { type: 'TUTORIAL_NEXT' },
      { type: 'TUTORIAL_NEXT' },
      { type: 'TUTORIAL_NEXT' },
    ]);
    expect(steps).toEqual([
      STEPS.SPLASH,
      STEPS.LANDING,
      STEPS.EMAIL_FORM,
      STEPS.USERNAME,
      STEPS.AGE,
      STEPS.DAILY_REWARD,
      STEPS.LOCATION,
      STEPS.CITY_INTRO,
      STEPS.FINISHING,
      STEPS.WELCOME,
      STEPS.TUTORIAL,
      STEPS.DONE,
    ]);
    expect(state.homeCity).toBe('Bengaluru');
    expect(state.authMode).toBe('signup');
  });

  test('email sign-up with a required code goes through the 6-digit step', () => {
    const { steps } = run([
      { type: 'SPLASH_DONE' },
      { type: 'CHOOSE_EMAIL' },
      { type: 'EMAIL_SUBMITTED', codeRequired: true },
      { type: 'CODE_VERIFIED', needsUsername: true },
    ]);
    expect(steps).toEqual([STEPS.SPLASH, STEPS.LANDING, STEPS.EMAIL_FORM, STEPS.VERIFY_CODE, STEPS.USERNAME]);
  });

  test('Google sign-up skips the email form and code', () => {
    const { steps, state } = run([
      { type: 'SPLASH_DONE' },
      { type: 'GOOGLE_AUTH_SUCCESS', needsUsername: true },
      { type: 'USERNAME_SET' },
    ]);
    expect(steps).toEqual([STEPS.SPLASH, STEPS.LANDING, STEPS.USERNAME, STEPS.AGE]);
    expect(steps).not.toContain(STEPS.EMAIL_FORM);
    expect(steps).not.toContain(STEPS.VERIFY_CODE);
    expect(state.authMethod).toBe('google');
  });

  test('existing account signing in hands over to AuthGate', () => {
    const { steps, state } = run([
      { type: 'SPLASH_DONE' },
      { type: 'CHOOSE_SIGN_IN' },
      { type: 'EMAIL_SUBMITTED', codeRequired: false, needsUsername: false },
    ]);
    expect(state.authMode).toBe('signin');
    expect(steps[steps.length - 1]).toBe(STEPS.GATE);
  });
});

describe('tutorial cards', () => {
  test('there are five cards', () => {
    expect(TUTORIAL_CARDS.map((c) => c.id)).toEqual([
      'territories',
      'howToStart',
      'claiming',
      'attackDefend',
      'endGoal',
    ]);
  });

  test.each([0, 1, 2, 3, 4])('Skip on card %i jumps to the map and marks all five seen', (index) => {
    const events = [{ type: 'WELCOME_TAP' }];
    for (let i = 0; i < index; i += 1) events.push({ type: 'TUTORIAL_NEXT' });
    events.push({ type: 'TUTORIAL_SKIP' });
    const { state, effects } = run(events, initialState({ entry: STEPS.WELCOME }));
    expect(state.step).toBe(STEPS.DONE);
    expect(effects).toEqual([{ after: 'TUTORIAL_SKIP', type: 'markSeen', names: TUTORIAL_NAMES }]);
    expect(TUTORIAL_NAMES).toHaveLength(5);
  });

  test('Next through the last card marks all five seen', () => {
    const events = [{ type: 'WELCOME_TAP' }, ...Array(5).fill({ type: 'TUTORIAL_NEXT' })];
    const { state, effects } = run(events, initialState({ entry: STEPS.WELCOME }));
    expect(state.step).toBe(STEPS.DONE);
    expect(effects.filter((f) => f.type === 'markSeen')).toHaveLength(1);
  });
});

describe('location', () => {
  test('denied falls back to the locale city centre and continues', () => {
    const fallback = fallbackCentreForLocale('ru-RU');
    const { state, effects } = run([
      ...UNTIL_REWARD,
      { type: 'REWARD_SKIP' },
      { type: 'LOCATION_RESULT', granted: false, fallback },
      { type: 'PIN_SAVED', homeCity: 'Saint Petersburg' },
      { type: 'CITY_NEXT' },
    ]);
    expect(state.usedFallback).toBe(true);
    expect(state.pin).toEqual(roundPin(FALLBACK_CENTRES.saintPetersburg));
    expect(effects.find((f) => f.type === 'saveHomePin')).toMatchObject(roundPin(FALLBACK_CENTRES.saintPetersburg));
    expect(state.step).toBe(STEPS.FINISHING);
  });

  test('granted with no fix also falls back', () => {
    const { state } = run([
      ...UNTIL_REWARD,
      { type: 'REWARD_SKIP' },
      { type: 'LOCATION_RESULT', granted: true, coords: null, fallback: fallbackCentreForLocale('en') },
    ]);
    expect(state.usedFallback).toBe(true);
    expect(state.pin).toEqual(roundPin(FALLBACK_CENTRES.bengaluru));
  });

  test('locale fallback: ru → Saint Petersburg, anything else → Bengaluru', () => {
    expect(fallbackCentreForLocale('ru')).toBe(FALLBACK_CENTRES.saintPetersburg);
    expect(fallbackCentreForLocale('en-GB')).toBe(FALLBACK_CENTRES.bengaluru);
    expect(fallbackCentreForLocale(undefined)).toBe(FALLBACK_CENTRES.bengaluru);
  });

  test('a failed pin save never blocks onboarding, and sends no claim', () => {
    const { state, effects } = run([
      ...UNTIL_REWARD,
      { type: 'REWARD_COLLECT' },
      { type: 'LOCATION_RESULT', granted: true, coords: RAW },
      { type: 'PIN_SAVE_FAILED' },
      { type: 'CITY_NEXT' },
    ]);
    expect(state.step).toBe(STEPS.FINISHING);
    expect(effects.some((f) => f.type === 'claimReward')).toBe(false);
  });

  test('City NEXT waits while the pin is saving', () => {
    const { state } = run([
      ...UNTIL_REWARD,
      { type: 'REWARD_SKIP' },
      { type: 'LOCATION_RESULT', granted: true, coords: RAW },
      { type: 'CITY_NEXT' },
    ]);
    expect(state.step).toBe(STEPS.CITY_INTRO);
  });
});

describe('age', () => {
  test('age 12 routes to the blocked screen and no PATCH /me is sent', () => {
    const { state, effects } = run([
      { type: 'SPLASH_DONE' },
      { type: 'CHOOSE_EMAIL' },
      { type: 'EMAIL_SUBMITTED', needsUsername: true },
      { type: 'USERNAME_SET' },
      { type: 'AGE_SUBMITTED', age: 12 },
    ]);
    expect(state.step).toBe(STEPS.AGE_BLOCKED);
    expect(state.ageBand).toBeNull();
    expect(effects).toEqual([]);
  });

  test('blocked player cannot reach Daily Rewards by any later event', () => {
    const start = run([{ type: 'AGE_SUBMITTED', age: 9 }], initialState({ entry: STEPS.AGE })).state;
    const { state, effects } = run(
      [{ type: 'REWARD_COLLECT' }, { type: 'LOCATION_RESULT', granted: true, coords: RAW }, { type: 'CITY_NEXT' }],
      start,
    );
    expect(state.step).toBe(STEPS.AGE_BLOCKED);
    expect(effects).toEqual([]);
  });

  test('age 13 continues with band 13_17', () => {
    const { state, effects } = run([{ type: 'AGE_SUBMITTED', age: 13 }], initialState({ entry: STEPS.AGE }));
    expect(state.step).toBe(STEPS.DAILY_REWARD);
    expect(effects).toEqual([{ after: 'AGE_SUBMITTED', type: 'patchAge', ageBand: '13_17' }]);
  });

  test('bands', () => {
    expect(ageBandFor(12)).toBeNull();
    expect(ageBandFor(13)).toBe('13_17');
    expect(ageBandFor(17)).toBe('13_17');
    expect(ageBandFor(18)).toBe('18_plus');
    expect(ageBandFor(80)).toBe('18_plus');
    expect(ageBandFor('x')).toBeNull();
  });
});

describe('silent home pin', () => {
  test('is rounded to 2 decimal places and within about 1 km of the raw position', () => {
    const { effects } = run([
      ...UNTIL_REWARD,
      { type: 'REWARD_SKIP' },
      { type: 'LOCATION_RESULT', granted: true, coords: RAW },
    ]);
    const save = effects.find((f) => f.type === 'saveHomePin');
    expect(save).toMatchObject({ lat: 12.97, lng: 77.59 });
    for (const v of [save.lat, save.lng]) {
      expect(Math.round(v * 100) / 100).toBe(v);
    }
    expect(distanceM(RAW, save)).toBeLessThanOrEqual(1000);
  });

  test('worst-case rounding stays within about 1 km', () => {
    const raw = { lat: 0.005, lng: 0.005 };
    expect(distanceM(raw, roundPin(raw))).toBeLessThan(1000);
    expect(roundPin({ lat: 'a', lng: 1 })).toBeNull();
    expect(roundPin({ lat: 91, lng: 1 })).toBeNull();
  });
});

describe('daily reward claim', () => {
  test('is sent after the home pin is saved, not when the reward screen appears or is tapped', () => {
    const { effects } = run([
      ...UNTIL_REWARD,
      { type: 'REWARD_COLLECT' },
      { type: 'LOCATION_RESULT', granted: true, coords: RAW },
      { type: 'PIN_SAVED', homeCity: 'Bengaluru' },
    ]);
    const types = effects.map((f) => f.type);
    expect(types).toEqual(['patchAge', 'requestLocation', 'saveHomePin', 'claimReward']);
    expect(effects.find((f) => f.type === 'claimReward').after).toBe('PIN_SAVED');
  });

  test('is sent once even if the pin is saved again', () => {
    const { effects } = run([
      ...UNTIL_REWARD,
      { type: 'REWARD_COLLECT' },
      { type: 'LOCATION_RESULT', granted: true, coords: RAW },
      { type: 'PIN_SAVE_FAILED' },
      { type: 'PIN_RETRY' },
      { type: 'PIN_SAVED' },
      { type: 'PIN_SAVED' },
    ]);
    expect(effects.filter((f) => f.type === 'claimReward')).toHaveLength(1);
  });

  test('is not sent when the player skipped the reward', () => {
    const { effects } = run([
      ...UNTIL_REWARD,
      { type: 'REWARD_SKIP' },
      { type: 'LOCATION_RESULT', granted: true, coords: RAW },
      { type: 'PIN_SAVED' },
    ]);
    expect(effects.some((f) => f.type === 'claimReward')).toBe(false);
  });
});

describe('returning player', () => {
  test('finished onboarding with an unclaimed reward sees Daily Rewards', () => {
    expect(shouldShowReturningReward({ figma: true, hasOnboarded: true, reward: { available: true, day: 3, amount: 60 } })).toBe(true);
  });

  test('goes straight to the map when today is already claimed or the check failed', () => {
    expect(shouldShowReturningReward({ figma: true, hasOnboarded: true, reward: { available: false } })).toBe(false);
    expect(shouldShowReturningReward({ figma: true, hasOnboarded: true, reward: null })).toBe(false);
  });

  test('never shows with legacy onboarding or before onboarding is finished', () => {
    expect(shouldShowReturningReward({ figma: false, hasOnboarded: true, reward: { available: true } })).toBe(false);
    expect(shouldShowReturningReward({ figma: true, hasOnboarded: false, reward: { available: true } })).toBe(false);
  });
});

describe('home_bases on', () => {
  test('the set-your-base step replaces the silent pin save', () => {
    const start = initialState({ entry: STEPS.AGE, homeBases: true });
    const { steps, effects, state } = run(
      [
        { type: 'AGE_SUBMITTED', age: 30 },
        { type: 'REWARD_COLLECT' },
        { type: 'LOCATION_RESULT', granted: true, coords: RAW },
      ],
      start,
    );
    expect(state.step).toBe(STEPS.SET_BASE);
    expect(effects.some((f) => f.type === 'saveHomePin')).toBe(false);
    expect(state.suggestedCentre).toEqual(RAW);

    const placed = { lat: 12.981234, lng: 77.601234 };
    const after = run(
      [{ type: 'BASE_CONFIRMED', coords: placed }, { type: 'PIN_SAVED', homeCity: 'Bengaluru' }, { type: 'CITY_NEXT' }],
      state,
    );
    expect(after.effects.map((f) => f.type)).toEqual(['saveHomePin', 'claimReward', 'finishOnboarding']);
    // The deliberate pin keeps today's precision.
    expect(after.effects[0]).toMatchObject(placed);
    expect([...steps, ...after.steps]).toContain(STEPS.CITY_INTRO);
  });
});

describe('flag choice', () => {
  beforeEach(() => {
    delete process.env.EXPO_PUBLIC_FLAG_OVERRIDES;
    flags._resetForTests();
  });
  afterAll(() => {
    delete process.env.EXPO_PUBLIC_FLAG_OVERRIDES;
    flags._resetForTests();
  });

  test('legacy_tabs on (default) keeps today onboarding', () => {
    expect(usesFigmaOnboarding(flags.getFlag)).toBe(false);
  });

  test('legacy_tabs off runs Figma onboarding', () => {
    process.env.EXPO_PUBLIC_FLAG_OVERRIDES = JSON.stringify({ legacy_tabs: false });
    flags._resetForTests();
    expect(usesFigmaOnboarding(flags.getFlag)).toBe(true);
  });
});


describe('parseTypedAge (typed age field)', () => {
  test('whole numbers inside the slider range pass through', () => {
    expect(parseTypedAge('25')).toBe(25);
    expect(parseTypedAge(' 13 ')).toBe(13);
  });

  test('values outside the range clamp to the slider ends', () => {
    expect(parseTypedAge('4')).toBe(5);
    expect(parseTypedAge('0')).toBe(5);
    expect(parseTypedAge('120')).toBe(80);
  });

  test('empty or non-whole-number input returns null', () => {
    for (const bad of ['', '   ', 'abc', '-3', '2.5', '1e2', '1000', null, undefined]) {
      expect(parseTypedAge(bad)).toBeNull();
    }
  });

  test('a typed age under 13 still routes to the blocked step', () => {
    let s = initialState();
    s = onboardingReducer(s, { type: 'SPLASH_DONE' });
    s = onboardingReducer(s, { type: 'CHOOSE_EMAIL' });
    s = onboardingReducer(s, { type: 'EMAIL_SUBMITTED', needsUsername: true });
    s = onboardingReducer(s, { type: 'USERNAME_SET' });
    s = onboardingReducer(s, { type: 'AGE_SUBMITTED', age: parseTypedAge('12') });
    expect(s.step).toBe(STEPS.AGE_BLOCKED);
    expect(s.effects).toEqual([]);
  });
});

describe('after sign-up the FTUE starts at choose-name', () => {
  const landing = () => onboardingReducer(onboardingReducer(initialState(), { type: 'SPLASH_DONE' }), { type: 'CHOOSE_EMAIL' });

  test('a verified code for a new account opens the username step', () => {
    let s = onboardingReducer(landing(), { type: 'EMAIL_SUBMITTED', codeRequired: true });
    s = onboardingReducer(s, { type: 'CODE_VERIFIED', needsUsername: true });
    expect(s.step).toBe(STEPS.USERNAME);
  });

  test('Google sign-up for a new account opens the username step', () => {
    const s = onboardingReducer(landing(), { type: 'GOOGLE_AUTH_SUCCESS', needsUsername: true });
    expect(s.step).toBe(STEPS.USERNAME);
  });

  test('an existing account goes to the gate instead', () => {
    const s = onboardingReducer(landing(), { type: 'GOOGLE_AUTH_SUCCESS', needsUsername: false });
    expect(s.step).toBe(STEPS.GATE);
  });
});
