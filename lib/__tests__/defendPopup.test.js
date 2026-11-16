/**
 * lib/__tests__/defendPopup.test.js
 *
 * Defend pop-up decisions (Figma parity plan U12): variant, ordering, "+N
 * more", per-launch dismissal, the active-challenge hold, the legacy_tabs
 * gate, and the mandatory Gold defence fee shared with DefenderAccept.
 */

const flags = require('../flags');
const {
  COPY,
  POLL_INTERVAL_MS,
  MIN_FETCH_GAP_MS,
  defendPopupModel,
  defenceGoldGate,
  dismissContest,
  isDismissed,
  isRouteMounted,
  msUntilFetchAllowed,
  normaliseAttacks,
  orderedAttacks,
  _resetForTests,
} = require('../defendPopup');

const NOW = Date.parse('2026-11-16T10:03:00Z');
const ORIGINAL_OVERRIDES = process.env.EXPO_PUBLIC_FLAG_OVERRIDES;

function attack(overrides = {}) {
  return {
    contest_id: 'c1',
    territory_id: 't1',
    territory_name: 'Cubbon Park',
    attacker_username: 'Mr ABC',
    started_at: '2026-11-16T10:00:00Z',
    scope: 'own',
    owner_username: 'me',
    defend_window_ends_at: '2026-11-16T10:45:00Z',
    can_defend: true,
    defended_by: null,
    ...overrides,
  };
}

// Figma mode, flags off: Gold economy.
function model(opts = {}) {
  return defendPopupModel({
    attacks: [attack()],
    figmaMode: true,
    challengeActive: false,
    gold: 100,
    multiResource: false,
    now: NOW,
    ...opts,
  });
}

beforeEach(() => {
  delete process.env.EXPO_PUBLIC_FLAG_OVERRIDES;
  flags._resetForTests();
  _resetForTests();
});

afterAll(() => {
  if (ORIGINAL_OVERRIDES === undefined) delete process.env.EXPO_PUBLIC_FLAG_OVERRIDES;
  else process.env.EXPO_PUBLIC_FLAG_OVERRIDES = ORIGINAL_OVERRIDES;
});

describe('variants', () => {
  test('scope "own" renders the solo copy with the attacker name and minutes', () => {
    const m = model();
    expect(m.scope).toBe('solo');
    expect(m.state).toBe('open');
    expect(m.attacker).toBe('Mr ABC');
    expect(m.territoryName).toBe('Cubbon Park');
    expect(m.minutesAgo).toBe(3);
    expect(m.status).toBe(COPY.underAttack);
    expect(m.body).toBe(COPY.soloBody);
    expect(m.body.defaultValue).toContain('{{attacker}} started the attack {{minutes}} min ago');
    expect(m.note).toBeNull();
    expect(m.action.label.defaultValue).toBe('DEFEND TERRITORY');
  });

  test('an attack under a minute old says "just now"', () => {
    const m = model({ now: Date.parse('2026-11-16T10:00:20Z') });
    expect(m.body).toBe(COPY.soloBodyJustNow);
  });

  test('scope "alliance" renders the alliance copy naming the owner', () => {
    const m = model({ attacks: [attack({ scope: 'alliance', owner_username: 'Moksh' })] });
    expect(m.scope).toBe('alliance');
    expect(m.owner).toBe('Moksh');
    expect(m.body).toBe(COPY.allianceBody);
    expect(m.body.defaultValue).toContain('({{owner}}) territory is under attack');
    expect(m.action).not.toBeNull();
  });

  test('defended_by set renders the already-started state with no action', () => {
    const m = model({ attacks: [attack({ scope: 'alliance', defended_by: 'Riya' })] });
    expect(m.state).toBe('already_started');
    expect(m.defender).toBe('Riya');
    expect(m.note).toBe(COPY.alreadyStarted);
    expect(m.action).toBeNull();
  });

  test('can_defend false hides the action and explains the window closed', () => {
    const m = model({ attacks: [attack({ can_defend: false })] });
    expect(m.state).toBe('closed');
    expect(m.note).toBe(COPY.windowClosed);
    expect(m.action).toBeNull();
  });
});

describe('selection', () => {
  test('two open attacks: the one closing sooner shows, with +1 more', () => {
    const later = attack({ contest_id: 'late', defend_window_ends_at: '2026-11-16T11:00:00Z' });
    const sooner = attack({ contest_id: 'soon', defend_window_ends_at: '2026-11-16T10:20:00Z' });
    const m = model({ attacks: [later, sooner] });
    expect(m.contestId).toBe('soon');
    expect(m.moreCount).toBe(1);
  });

  test('a single attack has no "+N more"', () => {
    expect(model().moreCount).toBe(0);
  });

  test('a defendable attack outranks an already-started or closed one', () => {
    const closed = attack({ contest_id: 'closed', can_defend: false, defend_window_ends_at: '2026-11-16T10:05:00Z' });
    const started = attack({ contest_id: 'started', defended_by: 'Riya', defend_window_ends_at: '2026-11-16T10:06:00Z' });
    const open = attack({ contest_id: 'open', defend_window_ends_at: '2026-11-16T11:00:00Z' });
    const m = model({ attacks: [closed, started, open] });
    expect(m.contestId).toBe('open');
    expect(m.moreCount).toBe(2);
  });

  test('missing window end sorts last', () => {
    const ids = orderedAttacks([
      attack({ contest_id: 'none', defend_window_ends_at: null }),
      attack({ contest_id: 'soon', defend_window_ends_at: '2026-11-16T10:20:00Z' }),
    ]).map((a) => a.contest_id);
    expect(ids).toEqual(['soon', 'none']);
  });

  test('no attacks, or only malformed ones: nothing shows', () => {
    expect(model({ attacks: [] })).toBeNull();
    expect(model({ attacks: undefined })).toBeNull();
    expect(model({ attacks: [{ territory_name: 'x' }, null] })).toBeNull();
  });

  test('normaliseAttacks drops entries without a contest_id', () => {
    expect(normaliseAttacks({ attacks: [attack(), { contest_id: '' }, 5] })).toHaveLength(1);
    expect(normaliseAttacks(null)).toEqual([]);
  });
});

describe('dismissal', () => {
  test('dismissing suppresses that contest until the next launch', () => {
    dismissContest('c1');
    expect(isDismissed('c1')).toBe(true);
    expect(model()).toBeNull();
    // A fresh poll returning the same contest stays hidden.
    expect(model({ attacks: [attack()] })).toBeNull();
    // Next launch: module state starts empty.
    _resetForTests();
    expect(model().contestId).toBe('c1');
  });

  test('dismissing the shown attack reveals the next and drops the count', () => {
    const a = attack({ contest_id: 'a', defend_window_ends_at: '2026-11-16T10:10:00Z' });
    const b = attack({ contest_id: 'b', defend_window_ends_at: '2026-11-16T10:20:00Z' });
    expect(model({ attacks: [a, b] }).moreCount).toBe(1);
    dismissContest('a');
    const m = model({ attacks: [a, b] });
    expect(m.contestId).toBe('b');
    expect(m.moreCount).toBe(0);
  });

  test('numeric and string contest ids match', () => {
    dismissContest(42);
    expect(isDismissed('42')).toBe(true);
  });
});

describe('gates', () => {
  test('legacy_tabs on (not Figma mode): never shown', () => {
    expect(model({ figmaMode: false })).toBeNull();
  });

  test('an attack arriving during an active challenge waits until it ends', () => {
    expect(model({ challengeActive: true })).toBeNull();
    expect(model({ challengeActive: false }).contestId).toBe('c1');
  });

  test('isRouteMounted finds ActiveClaim in a nested navigation state', () => {
    const state = {
      routes: [
        { name: 'MainTabs', state: { routes: [{ name: 'Map' }, { name: 'Missions' }] } },
        { name: 'ActiveClaim' },
      ],
    };
    expect(isRouteMounted(state, 'ActiveClaim')).toBe(true);
    expect(isRouteMounted(state, 'Map')).toBe(true);
    expect(isRouteMounted({ routes: [{ name: 'MainTabs' }] }, 'ActiveClaim')).toBe(false);
    expect(isRouteMounted(undefined, 'ActiveClaim')).toBe(false);
  });
});

describe('Gold defence fee', () => {
  test('balance of 9 Gold: DEFEND TERRITORY is disabled, 1 Gold short', () => {
    const m = model({ gold: 9 });
    expect(m.action.price).toBe(10);
    expect(m.action.currency).toBe('gold');
    expect(m.action.disabled).toBe(true);
    expect(m.action.shortfall).toBe(1);
    expect(COPY.shortfall.defaultValue).toBe('{{n}} Gold short');
  });

  test('exactly 10 Gold can defend', () => {
    const m = model({ gold: 10 });
    expect(m.action.disabled).toBe(false);
    expect(m.action.shortfall).toBe(0);
  });

  test('unknown balance (loading) leaves the action enabled', () => {
    expect(model({ gold: null }).action.disabled).toBe(false);
  });

  test('multi_resource_economy on: no Gold fee, never disabled by Gold', () => {
    const m = model({ gold: 0, multiResource: true });
    expect(m.action.price).toBeNull();
    expect(m.action.currency).toBeNull();
    expect(m.action.disabled).toBe(false);
  });

  test('the fee follows the economy parameter', () => {
    process.env.EXPO_PUBLIC_FLAG_OVERRIDES = JSON.stringify({ economy_config: { defence_gold_cost: 15 } });
    flags._resetForTests();
    const g = defenceGoldGate({ gold: 12 });
    expect(g.price).toBe(15);
    expect(g.shortfall).toBe(3);
  });

  test('an explicit fee (from the defend preview) wins', () => {
    expect(defenceGoldGate({ gold: 9, fee: 5 })).toEqual({ applies: true, price: 5, disabled: false, shortfall: 0 });
  });

  test('DefenderAccept gate matches the pop-up', () => {
    expect(defenceGoldGate({ gold: 9 })).toEqual({ applies: true, price: 10, disabled: true, shortfall: 1 });
    expect(defenceGoldGate({ gold: 9, multiResource: true }).applies).toBe(false);
  });
});

describe('polling cadence', () => {
  test('polls every 30 s and spaces fetches 10 s apart', () => {
    expect(POLL_INTERVAL_MS).toBe(30000);
    expect(MIN_FETCH_GAP_MS).toBe(10000);
    expect(msUntilFetchAllowed(null, NOW)).toBe(0);
    expect(msUntilFetchAllowed(NOW - 4000, NOW)).toBe(6000);
    expect(msUntilFetchAllowed(NOW - 30000, NOW)).toBe(0);
  });
});
