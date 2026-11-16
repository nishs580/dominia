/**
 * lib/__tests__/flags.test.js
 *
 * Covers the Remote Config flag module: registry defaults, value parsing,
 * the ActiveClaim hold, the legacy_tabs navigation reset, the env override,
 * failure handling and the economy parameter as read by lib/formulas.js.
 * The native module is replaced with an in-memory fake.
 */

const fs = require('fs');
const path = require('path');

const flags = require('../flags');
const F = require('../formulas');

// A fake with the same surface lib/flags.js builds from the native module.
// `activated` is what the device would hold after the last activate().
function fakeRemoteConfig({ activated = {}, fetched = activated, fetchError, initNeverResolves } = {}) {
  let current = activated;
  const toValue = (raw) => ({ asString: () => raw, getSource: () => 'remote' });
  return {
    ensureInitialized: jest.fn(() => (initNeverResolves ? new Promise(() => {}) : Promise.resolve())),
    fetchAndActivate: jest.fn(async () => {
      if (fetchError) throw fetchError;
      current = fetched;
      return true;
    }),
    getAll: () => Object.fromEntries(Object.entries(current).map(([k, v]) => [k, toValue(v)])),
  };
}

const ORIGINAL_OVERRIDES = process.env.EXPO_PUBLIC_FLAG_OVERRIDES;
let warnSpy;

beforeEach(() => {
  delete process.env.EXPO_PUBLIC_FLAG_OVERRIDES;
  flags._resetForTests();
  warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  warnSpy.mockRestore();
  if (ORIGINAL_OVERRIDES === undefined) delete process.env.EXPO_PUBLIC_FLAG_OVERRIDES;
  else process.env.EXPO_PUBLIC_FLAG_OVERRIDES = ORIGINAL_OVERRIDES;
});

// =============================================================================
// REGISTRY AND DEFAULTS
// =============================================================================

describe('registry defaults', () => {
  test('unknown flag name returns false', () => {
    expect(flags.getFlag('not_a_flag')).toBe(false);
    expect(flags.getFlag(undefined)).toBe(false);
  });

  test('with no fetched values, every registry flag returns its code default', () => {
    for (const [name, def] of Object.entries(flags.FLAG_DEFAULTS)) {
      expect(flags.getFlag(name)).toBe(def);
    }
  });

  test('build-out defaults are all true (today\'s app)', () => {
    expect(Object.values(flags.FLAG_DEFAULTS).every((v) => v === true)).toBe(true);
  });

  test('registry holds exactly the plan\'s 19 flags', () => {
    expect(Object.keys(flags.FLAG_DEFAULTS).sort()).toEqual([
      'alliance_hq_create', 'alliance_roster_tools', 'attack_day', 'battle_chips',
      'claim_celebration', 'command_post', 'contest_result_screen',
      'first_claim_objective', 'full_territory_sheet', 'home_bases',
      'honour_medals', 'legacy_tabs', 'multi_resource_economy', 'power_rank',
      'sitrep_card', 'streaks', 'territory_development', 'territory_legacy',
      'war_room',
    ]);
  });
});

// =============================================================================
// FETCH AND ACTIVATE
// =============================================================================

describe('refreshFlags', () => {
  test('a fetched false for war_room returns false after activation', async () => {
    flags._setRemoteConfigForTests(fakeRemoteConfig({ fetched: { war_room: 'false' } }));
    expect(flags.getFlag('war_room')).toBe(true);

    await flags.refreshFlags();

    expect(flags.getFlag('war_room')).toBe(false);
    expect(flags.getFlag('command_post')).toBe(true);
  });

  test('a fetched non-boolean string ("yes") resolves to false', async () => {
    flags._setRemoteConfigForTests(fakeRemoteConfig({ fetched: { streaks: 'yes', battle_chips: '1' } }));
    await flags.refreshFlags();
    expect(flags.getFlag('streaks')).toBe(false);
    expect(flags.getFlag('battle_chips')).toBe(false);
  });

  test('values from in-app defaults (non-remote source) are ignored', async () => {
    const rc = fakeRemoteConfig();
    rc.getAll = () => ({ war_room: { asString: () => 'false', getSource: () => 'default' } });
    flags._setRemoteConfigForTests(rc);
    await flags.refreshFlags();
    expect(flags.getFlag('war_room')).toBe(true);
  });

  test('a fetch failure leaves defaults in place and does not throw', async () => {
    flags._setRemoteConfigForTests(fakeRemoteConfig({ fetchError: new Error('network down') }));
    await expect(flags.refreshFlags()).resolves.toBeUndefined();
    for (const [name, def] of Object.entries(flags.FLAG_DEFAULTS)) {
      expect(flags.getFlag(name)).toBe(def);
    }
  });

  test('a fetch failure after a success keeps the last activated values', async () => {
    const rc = fakeRemoteConfig({ fetched: { war_room: 'false' } });
    flags._setRemoteConfigForTests(rc);
    await flags.refreshFlags();
    rc.fetchAndActivate.mockRejectedValueOnce(new Error('offline'));
    await flags.refreshFlags();
    expect(flags.getFlag('war_room')).toBe(false);
  });

  test('without the native module, init and refresh resolve on defaults', async () => {
    // No fake injected: the lazy require of the native module fails under jest.
    await expect(flags.ensureFlagsInitialized()).resolves.toBeUndefined();
    await expect(flags.refreshFlags()).resolves.toBeUndefined();
    expect(flags.getFlag('legacy_tabs')).toBe(true);
  });

  test('subscribers are notified on activation', async () => {
    const listener = jest.fn();
    flags.subscribe(listener);
    flags._setRemoteConfigForTests(fakeRemoteConfig({ fetched: { war_room: 'false' } }));
    await flags.refreshFlags();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

// =============================================================================
// FIRST-RENDER INITIALISATION
// =============================================================================

describe('ensureFlagsInitialized', () => {
  test('applies the last activated values before the first render', async () => {
    const rc = fakeRemoteConfig({ activated: { sitrep_card: 'false' } });
    flags._setRemoteConfigForTests(rc);
    await flags.ensureFlagsInitialized();
    expect(rc.ensureInitialized).toHaveBeenCalledTimes(1);
    expect(rc.fetchAndActivate).not.toHaveBeenCalled();
    expect(flags.getFlag('sitrep_card')).toBe(false);
  });

  test('times out and starts on defaults when the native call hangs', async () => {
    flags._setRemoteConfigForTests(
      fakeRemoteConfig({ activated: { sitrep_card: 'false' }, initNeverResolves: true }),
    );
    await expect(flags.ensureFlagsInitialized({ timeoutMs: 5 })).resolves.toBeUndefined();
    expect(flags.getFlag('sitrep_card')).toBe(true);
  });

  test('default timeout is 300 ms', () => {
    expect(flags.INIT_TIMEOUT_MS).toBe(300);
  });

  test('a rejected ensureInitialized does not throw', async () => {
    const rc = fakeRemoteConfig();
    rc.ensureInitialized.mockRejectedValueOnce(new Error('boom'));
    flags._setRemoteConfigForTests(rc);
    await expect(flags.ensureFlagsInitialized()).resolves.toBeUndefined();
  });
});

// =============================================================================
// ACTIVECLAIM HOLD
// =============================================================================

describe('holdFlagChanges', () => {
  test('a change activated while ActiveClaim is mounted applies only after it unmounts', async () => {
    flags._setRemoteConfigForTests(fakeRemoteConfig({ fetched: { war_room: 'false' } }));
    const listener = jest.fn();
    flags.subscribe(listener);

    const release = flags.holdFlagChanges(); // ActiveClaim mounts
    await flags.refreshFlags();
    expect(flags.getFlag('war_room')).toBe(true);
    expect(listener).not.toHaveBeenCalled();

    release(); // ActiveClaim unmounts
    expect(flags.getFlag('war_room')).toBe(false);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  test('nested holds apply only on the last release; release is idempotent', async () => {
    flags._setRemoteConfigForTests(fakeRemoteConfig({ fetched: { war_room: 'false' } }));
    const releaseA = flags.holdFlagChanges();
    const releaseB = flags.holdFlagChanges();
    await flags.refreshFlags();

    releaseA();
    releaseA(); // a double release must not drop B's hold
    expect(flags.getFlag('war_room')).toBe(true);

    releaseB();
    expect(flags.getFlag('war_room')).toBe(false);
  });

  test('only the latest of several held activations is applied', async () => {
    const rc = fakeRemoteConfig({ fetched: { war_room: 'false' } });
    flags._setRemoteConfigForTests(rc);
    const release = flags.holdFlagChanges();
    await flags.refreshFlags();
    rc.fetchAndActivate.mockImplementationOnce(async () => true);
    rc.getAll = () => ({ war_room: { asString: () => 'true', getSource: () => 'remote' } });
    await flags.refreshFlags();
    release();
    expect(flags.getFlag('war_room')).toBe(true);
  });
});

// =============================================================================
// LEGACY_TABS → NAVIGATION RESET
// =============================================================================

// lib/navigation.js imports @react-navigation/native (ESM); load it with a
// fake navigationRef, following the source-transform style used elsewhere.
function loadNavigation(fakeRef) {
  let source = fs.readFileSync(path.join(__dirname, '..', 'navigation.js'), 'utf8');
  source = source
    .replace(/^import .*$/gm, '')
    .replace(/export const navigationRef = createNavigationContainerRef\(\);/, 'const navigationRef = fakeRef;')
    .replace(/export function/g, 'function');
  source += '\nreturn { resetToMap };';
  // eslint-disable-next-line no-new-func
  return new Function('fakeRef', 'getFlag', 'resolveNavTarget', source)(
    fakeRef,
    flags.getFlag,
    require('../navLayout').resolveNavTarget,
  );
}

function fakeNavRef(routeNames) {
  return {
    isReady: () => true,
    getRootState: () => ({ index: routeNames.length - 1, routes: routeNames.map((name) => ({ name })) }),
    reset: jest.fn(),
    navigate: jest.fn(),
    addListener: jest.fn(),
    removeListener: jest.fn(),
  };
}

describe('legacy_tabs change', () => {
  test('a legacy_tabs change triggers a navigation reset to Map', async () => {
    const ref = fakeNavRef(['MainTabs', 'Leaderboards']);
    const { resetToMap } = loadNavigation(ref);
    flags.onLegacyTabsChange(() => resetToMap());

    flags._setRemoteConfigForTests(fakeRemoteConfig({ fetched: { legacy_tabs: 'false' } }));
    await flags.refreshFlags();

    expect(ref.reset).toHaveBeenCalledWith({
      index: 0,
      routes: [{ name: 'MainTabs', params: { screen: 'Map' } }],
    });
  });

  test('listener receives the new value and is not called when legacy_tabs is unchanged', async () => {
    const listener = jest.fn();
    flags.onLegacyTabsChange(listener);

    flags._setRemoteConfigForTests(fakeRemoteConfig({ fetched: { war_room: 'false' } }));
    await flags.refreshFlags();
    expect(listener).not.toHaveBeenCalled();

    flags._setRemoteConfigForTests(fakeRemoteConfig({ fetched: { legacy_tabs: 'false' } }));
    await flags.refreshFlags();
    expect(listener).toHaveBeenCalledWith(false);
  });

  test('a legacy_tabs change during a challenge resets only after the hold is released', async () => {
    const listener = jest.fn();
    flags.onLegacyTabsChange(listener);
    flags._setRemoteConfigForTests(fakeRemoteConfig({ fetched: { legacy_tabs: 'false' } }));

    const release = flags.holdFlagChanges();
    await flags.refreshFlags();
    expect(listener).not.toHaveBeenCalled();

    release();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  test('resetToMap leaves pre-auth stacks alone', () => {
    const ref = fakeNavRef(['AuthGate', 'SignIn']);
    const { resetToMap } = loadNavigation(ref);
    resetToMap();
    expect(ref.reset).not.toHaveBeenCalled();
  });
});

// =============================================================================
// ENV OVERRIDE
// =============================================================================

describe('EXPO_PUBLIC_FLAG_OVERRIDES', () => {
  test('the env override sets a flag true even when the fetched value is false', async () => {
    process.env.EXPO_PUBLIC_FLAG_OVERRIDES = '{"war_room":true}';
    flags._setRemoteConfigForTests(fakeRemoteConfig({ fetched: { war_room: 'false', command_post: 'false' } }));
    await flags.refreshFlags();
    expect(flags.getFlag('war_room')).toBe(true);
    expect(flags.getFlag('command_post')).toBe(false);
  });

  test('an override can turn a flag off', () => {
    process.env.EXPO_PUBLIC_FLAG_OVERRIDES = '{"legacy_tabs":false}';
    expect(flags.getFlag('legacy_tabs')).toBe(false);
  });

  test('non-boolean override values and unknown names are ignored', () => {
    process.env.EXPO_PUBLIC_FLAG_OVERRIDES = '{"war_room":"false","made_up":true}';
    expect(flags.getFlag('war_room')).toBe(true);
    expect(flags.getFlag('made_up')).toBe(false);
  });

  test('malformed override JSON is ignored', () => {
    process.env.EXPO_PUBLIC_FLAG_OVERRIDES = '{war_room:false';
    expect(flags.getFlag('war_room')).toBe(true);
  });

  test('an economy override changes prices', () => {
    process.env.EXPO_PUBLIC_FLAG_OVERRIDES = '{"economy_config":{"daily_reward_gold":100}}';
    expect(flags.getEconomy().daily_reward_gold).toBe(100);
    expect(F.DAILY_REWARD_GOLD).toBe(100);
  });
});

// =============================================================================
// ECONOMY PARAMETER → lib/formulas.js
// =============================================================================

const TODAY = {
  CLAIM_GOLD_COST: { Small: 10, Medium: 25, Large: 60, Epic: 120 },
  CLAIM_GOLD_REWARD: { Small: 10, Medium: 20, Large: 50, Epic: 100 },
  CONTEST_IRON_COST: { Small: 8, Medium: 20, Large: 45, Epic: 80 },
  DEFENCE_ACTIVATION_STONE_COST: 10,
  ATTACK_GOLD_COST: { Small: 8, Medium: 20, Large: 45, Epic: 80 },
  DEFENCE_GOLD_COST: 10,
  MISSION_GOLD_REWARD: { easy: 10, medium: 20, hard: 40 },
  DAILY_REWARD_GOLD: 60,
};

function expectTodaysConstants() {
  for (const [name, value] of Object.entries(TODAY)) {
    expect(F[name]).toEqual(value);
  }
}

describe('economy parameter', () => {
  test('missing parameter: lib/formulas.js returns today\'s constants', async () => {
    flags._setRemoteConfigForTests(fakeRemoteConfig({ fetched: { war_room: 'false' } }));
    await flags.refreshFlags();
    expectTodaysConstants();
  });

  test('malformed JSON: lib/formulas.js returns today\'s constants', async () => {
    flags._setRemoteConfigForTests(fakeRemoteConfig({ fetched: { economy_config: '{not json' } }));
    await flags.refreshFlags();
    expectTodaysConstants();
  });

  test('non-object JSON (array, number) falls back to defaults', async () => {
    flags._setRemoteConfigForTests(fakeRemoteConfig({ fetched: { economy_config: '[1,2]' } }));
    await flags.refreshFlags();
    expectTodaysConstants();
    flags._setRemoteConfigForTests(fakeRemoteConfig({ fetched: { economy_config: '42' } }));
    await flags.refreshFlags();
    expectTodaysConstants();
  });

  test('the parameter key is economy_config, shared with the backend', () => {
    expect(flags.ECONOMY_PARAM).toBe('economy_config');
  });

  test('a valid parameter overrides prices; missing keys take defaults', async () => {
    const economy = JSON.stringify({
      attack_gold_cost: { small: 12, medium: 20, large: 45, epic: 80 },
      stone_defence_cost: 15,
      unknown_key: 7,
    });
    flags._setRemoteConfigForTests(fakeRemoteConfig({ fetched: { economy_config: economy } }));
    await flags.refreshFlags();

    expect(flags.getEconomy().attack_gold_cost).toEqual({ small: 12, medium: 20, large: 45, epic: 80 });
    expect(F.ATTACK_GOLD_COST).toEqual({ Small: 12, Medium: 20, Large: 45, Epic: 80 });
    expect(F.DEFENCE_ACTIVATION_STONE_COST).toBe(15);
    expect(F.DEFENCE_GOLD_COST).toBe(10);
    expect(F.CLAIM_GOLD_COST).toEqual(TODAY.CLAIM_GOLD_COST);
    expect(flags.getEconomy().unknown_key).toBeUndefined();
  });

  test.each([
    ['a negative price', { defence_gold_cost: -5 }],
    ['a non-integer price', { daily_reward_gold: 60.5 }],
    ['a string price', { daily_reward_gold: '60' }],
    ['an incomplete tier table', { claim_gold_cost: { small: 10, medium: 30 } }],
    ['a non-object tier table', { mission_gold_reward: 40 }],
  ])('%s rejects the whole parameter', async (_label, bad) => {
    const economy = JSON.stringify({ attack_gold_cost: { small: 12, medium: 20, large: 45, epic: 80 }, ...bad });
    flags._setRemoteConfigForTests(fakeRemoteConfig({ fetched: { economy_config: economy } }));
    await flags.refreshFlags();
    expectTodaysConstants();
  });

  test('boolean true from the template counts as on', async () => {
    const rc = fakeRemoteConfig();
    rc.getAll = () => ({ war_room: { asString: () => true, getSource: () => 'remote' } });
    flags._setRemoteConfigForTests(rc);
    await flags.refreshFlags();
    expect(flags.getFlag('war_room')).toBe(true);
  });

  test('economy tables stay frozen', () => {
    expect(Object.isFrozen(F.CLAIM_GOLD_COST)).toBe(true);
    expect(Object.isFrozen(flags.getEconomy())).toBe(true);
  });

  test('formulas exports keep their names and are enumerable', () => {
    for (const name of Object.keys(TODAY).filter((n) => n !== 'CLAIM_GOLD_REWARD')) {
      expect(Object.keys(F)).toContain(name);
    }
  });
});
