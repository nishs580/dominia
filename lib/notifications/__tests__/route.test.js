const fs = require('fs');
const path = require('path');
const flags = require('../../flags');
const navLayout = require('../../navLayout');

// route.js is an ES module and jest here has no ESM transform, so the source
// is evaluated directly. Its imports (lib/flags, lib/navLayout) are stripped
// and the real CommonJS modules are injected in their place.
const ROUTE_SRC = fs.readFileSync(
  path.join(__dirname, '..', 'route.js'),
  'utf8',
)
  .replace(/^import\s+\{\s*getFlag\s*\}\s+from\s+'\.\.\/flags';\s*$/m, '')
  .replace(/^import\s+\{\s*resolveNavTarget\s*\}\s+from\s+'\.\.\/navLayout';\s*$/m, '')
  .replace(/^export\s+/gm, '');

let SURFACES, ROUTE_TABLE, DEFAULT_ROUTE, GATED_TARGETS, routeForPush;

function setAllFlags(value) {
  const all = {};
  for (const name of Object.keys(flags.FLAG_DEFAULTS)) all[name] = value;
  setFlags(all);
}

function setFlags(map) {
  process.env.EXPO_PUBLIC_FLAG_OVERRIDES = JSON.stringify(map);
}

beforeEach(() => {
  delete process.env.EXPO_PUBLIC_FLAG_OVERRIDES;
  flags._resetForTests();
  const ctx = {};
  new Function(
    'ctx',
    'getFlag',
    'resolveNavTarget',
    ROUTE_SRC +
      '\nctx.SURFACES = SURFACES;' +
      '\nctx.ROUTE_TABLE = ROUTE_TABLE;' +
      '\nctx.DEFAULT_ROUTE = DEFAULT_ROUTE;' +
      '\nctx.GATED_TARGETS = GATED_TARGETS;' +
      '\nctx.routeForPush = routeForPush;',
  )(ctx, flags.getFlag, navLayout.resolveNavTarget);
  ({ SURFACES, ROUTE_TABLE, DEFAULT_ROUTE, GATED_TARGETS, routeForPush } = ctx);
});

afterAll(() => {
  delete process.env.EXPO_PUBLIC_FLAG_OVERRIDES;
  flags._resetForTests();
});

describe('routeForPush', () => {
  describe('invalid input', () => {
    test('null kind returns DEFAULT_ROUTE with kind=null and params={}', () => {
      const result = routeForPush(null);
      expect(result).toEqual({ ...DEFAULT_ROUTE, kind: null, params: {} });
    });

    test('empty string kind returns DEFAULT_ROUTE with kind=null and params={}', () => {
      const result = routeForPush('');
      expect(result).toEqual({ ...DEFAULT_ROUTE, kind: null, params: {} });
    });

    test('non-string kind returns DEFAULT_ROUTE with kind=null and params={}', () => {
      const result = routeForPush(123);
      expect(result).toEqual({ ...DEFAULT_ROUTE, kind: null, params: {} });
    });
  });

  describe('unknown kind', () => {
    test('returns DEFAULT_ROUTE with original kind and params={}', () => {
      const result = routeForPush('made_up_kind');
      expect(result).toEqual({ ...DEFAULT_ROUTE, kind: 'made_up_kind', params: {} });
    });
  });

  describe('known kind without extractParams', () => {
    test('alliance_kicked returns entry shape with kind and params={}', () => {
      const result = routeForPush('alliance_kicked');
      expect(result.surface).toBe(SURFACES.CARD);
      expect(result.target).toBe('Alliance');
      expect(result.kind).toBe('alliance_kicked');
      expect(result.params).toEqual({});
    });

    test('data argument is ignored for kinds without extractParams', () => {
      const result = routeForPush('alliance_kicked', { contestId: 'abc' });
      expect(result.params).toEqual({});
    });
  });

  describe('contest result pushes (role-aware payload)', () => {
    test('contest_won maps the enriched payload onto ContestResultScreen params', () => {
      const result = routeForPush('contest_won', {
        contestId: 'c-1',
        territoryId: 'terr-1',
        outcome: 'attacker_won',
        role: 'attacker',
        territoryName: 'Kolomna',
        opponentName: 'defender_dan',
        myDistance: '1240',
        opponentDistance: '890',
        xpGained: '300',
        resourcesAwarded: '{"iron":15,"stone":0,"gold":25,"morale":8}',
        leveledUp: 'true',
        levelAfter: '3',
        firstContestWin: 'true',
      });
      expect(result.surface).toBe(SURFACES.CARD);
      expect(result.target).toBe('ContestResultScreen');
      expect(result.params).toEqual({
        territoryId: 'terr-1',
        outcome: 'attacker_won',
        role: 'attacker',
        territoryName: 'Kolomna',
        opponentName: 'defender_dan',
        myDistance: 1240,
        opponentDistance: 890,
        xpGained: 300,
        resourcesAwarded: { iron: 15, stone: 0, gold: 25, morale: 8 },
        leveledUp: true,
        firstContestWin: true,
        balances: { level_after: 3 },
      });
    });

    test('pre-enrichment contest_won payload falls back to attacker semantics', () => {
      const result = routeForPush('contest_won', {
        contestId: 'c-1',
        territoryId: 'terr-1',
      });
      expect(result.params.outcome).toBe('attacker_won');
      expect(result.params.role).toBe('attacker');
      expect(result.params.territoryId).toBe('terr-1');
      expect(result.params.xpGained).toBe(0);
      expect(result.params.leveledUp).toBe(false);
      expect(result.params).not.toHaveProperty('territoryName');
      expect(result.params).not.toHaveProperty('opponentName');
      expect(result.params).not.toHaveProperty('balances');
    });

    test('pre-enrichment contest_lost payload falls back to defender semantics', () => {
      const result = routeForPush('contest_lost', { territoryId: 'terr-1' });
      expect(result.params.outcome).toBe('attacker_won');
      expect(result.params.role).toBe('defender');
    });

    test('malformed resourcesAwarded JSON is dropped, not thrown', () => {
      const result = routeForPush('contest_won', {
        territoryId: 'terr-1',
        resourcesAwarded: '{not json',
      });
      expect(result.params).not.toHaveProperty('resourcesAwarded');
    });
  });

  describe('defender_notify (extractParams pass-through)', () => {
    test('retargets to DefenderAccept (M3 retarget regression)', () => {
      const result = routeForPush('defender_notify', { contestId: 'abc' });
      expect(result.target).toBe('DefenderAccept');
    });

    test('extracts contestId from data', () => {
      const result = routeForPush('defender_notify', { contestId: 'contest-xyz' });
      expect(result.params).toEqual({ contestId: 'contest-xyz' });
    });

    test('extra fields in data are ignored', () => {
      const result = routeForPush('defender_notify', {
        contestId: 'contest-xyz',
        territoryId: 'terr-1',
        kind: 'defender_notify',
      });
      expect(result.params).toEqual({ contestId: 'contest-xyz' });
    });

    test('undefined data yields params with contestId=undefined', () => {
      const result = routeForPush('defender_notify', undefined);
      expect(result.params).toEqual({ contestId: undefined });
    });

    test('null data yields params with contestId=undefined', () => {
      const result = routeForPush('defender_notify', null);
      expect(result.params).toEqual({ contestId: undefined });
    });

    test('data missing contestId yields params with contestId=undefined', () => {
      const result = routeForPush('defender_notify', { territoryId: 'terr-1' });
      expect(result.params).toEqual({ contestId: undefined });
    });

    test('surface remains BANNER_ROUTE', () => {
      const result = routeForPush('defender_notify', { contestId: 'abc' });
      expect(result.surface).toBe(SURFACES.BANNER_ROUTE);
    });

    test('kind field preserved in return', () => {
      const result = routeForPush('defender_notify', { contestId: 'abc' });
      expect(result.kind).toBe('defender_notify');
    });
  });

  describe('chat_alliance_message (S82 M2)', () => {
    test('routes to Chat with initialTab=alliance', () => {
      const result = routeForPush('chat_alliance_message', { room_id: 'r-1' });
      expect(result.target).toBe('Chat');
      expect(result.surface).toBe(SURFACES.TOAST);
      expect(result.params).toEqual({ initialTab: 'alliance', roomId: 'r-1' });
    });

    test('missing room_id yields roomId=null', () => {
      const result = routeForPush('chat_alliance_message', {});
      expect(result.params).toEqual({ initialTab: 'alliance', roomId: null });
    });

    test('null data yields roomId=null', () => {
      const result = routeForPush('chat_alliance_message', null);
      expect(result.params).toEqual({ initialTab: 'alliance', roomId: null });
    });

    test('kind preserved in return', () => {
      const result = routeForPush('chat_alliance_message', { room_id: 'r-1' });
      expect(result.kind).toBe('chat_alliance_message');
    });
  });

  describe('alliance weekly tasks', () => {
    test('weekly_task_started toasts to the Alliance tab', () => {
      const result = routeForPush('weekly_task_started', {
        kind: 'weekly_task_started',
        task_type: 'long_march',
        alliance_id: 'a-1',
      });
      expect(result.surface).toBe(SURFACES.TOAST);
      expect(result.target).toBe('Alliance');
    });

    test('weekly_task_result cards to the Alliance tab', () => {
      const result = routeForPush('weekly_task_result', {
        kind: 'weekly_task_result',
        tier: 'full',
        alliance_id: 'a-1',
      });
      expect(result.surface).toBe(SURFACES.CARD);
      expect(result.target).toBe('Alliance');
    });

    test('pick reminder sends a founder to CommandPost with alliance params', () => {
      const result = routeForPush('weekly_task_pick_reminder', {
        kind: 'weekly_task_pick_reminder',
        alliance_id: 'a-1',
        alliance_name: 'Iron Vanguard',
        alliance_short_name: 'IVG',
        recipient_role: 'founder',
      });
      expect(result.surface).toBe(SURFACES.CARD);
      expect(result.target).toBe('CommandPost');
      expect(result.params).toEqual({
        allianceId: 'a-1',
        allianceName: 'Iron Vanguard',
        shortName: 'IVG',
      });
    });

    test('pick reminder sends a marshal to Alliance, not the founder-gated screen', () => {
      const result = routeForPush('weekly_task_pick_reminder', {
        kind: 'weekly_task_pick_reminder',
        alliance_id: 'a-1',
        recipient_role: 'marshal',
      });
      expect(result.target).toBe('Alliance');
      expect(result.params).toEqual({});
    });

    test('pick reminder with no role falls back to Alliance', () => {
      const result = routeForPush('weekly_task_pick_reminder', {});
      expect(result.target).toBe('Alliance');
    });

    test('pick reminder with null data falls back to Alliance', () => {
      const result = routeForPush('weekly_task_pick_reminder', null);
      expect(result.target).toBe('Alliance');
      expect(result.params).toEqual({});
    });

    test('founder pick reminder with blank names omits them so the screen defaults apply', () => {
      const result = routeForPush('weekly_task_pick_reminder', {
        alliance_id: 'a-1',
        alliance_name: '',
        alliance_short_name: '',
        recipient_role: 'founder',
      });
      expect(result.params.allianceId).toBe('a-1');
      expect(result.params.allianceName).toBeUndefined();
      expect(result.params.shortName).toBeUndefined();
    });

    test('none of the three fall through to the default ActivityLog route', () => {
      for (const kind of [
        'weekly_task_started',
        'weekly_task_result',
        'weekly_task_pick_reminder',
      ]) {
        expect(routeForPush(kind, {}).target).not.toBe(DEFAULT_ROUTE.target);
      }
    });
  });

  describe('return shape regression (Q-M3-B kind preservation)', () => {
    test('all returns include kind field', () => {
      expect(routeForPush(null)).toHaveProperty('kind');
      expect(routeForPush('unknown')).toHaveProperty('kind');
      expect(routeForPush('contest_won')).toHaveProperty('kind');
      expect(routeForPush('defender_notify', { contestId: 'x' })).toHaveProperty('kind');
    });

    test('all returns include params field', () => {
      expect(routeForPush(null)).toHaveProperty('params');
      expect(routeForPush('unknown')).toHaveProperty('params');
      expect(routeForPush('contest_won')).toHaveProperty('params');
      expect(routeForPush('defender_notify', { contestId: 'x' })).toHaveProperty('params');
    });
  });
});

const APP_SRC = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'App.js'), 'utf8');

// Keys of an object literal `const <name> = { ... };` in App.js.
function appObjectKeys(name) {
  const block = APP_SRC.match(new RegExp(`const ${name} = \\{([\\s\\S]*?)\\n\\};`));
  if (!block) throw new Error(`App.js has no ${name} map`);
  return new Set([...block[1].matchAll(/^\s{2}(\w+):/gm)].map((m) => m[1]));
}

// Routes mounted in App.js for one `legacy_tabs` mode: the literal root
// Stack.Screen names, plus the tabs and mode-only root screens App.js maps
// from lib/navLayout. Parsed rather than hard-coded so a removed screen fails
// here instead of on a device.
function registeredRoutes(legacyTabs = flags.getFlag('legacy_tabs')) {
  const names = new Set();
  const re = /<Stack\.Screen\s+name="([^"]+)"/g;
  let m;
  while ((m = re.exec(APP_SRC))) names.add(m[1]);
  navLayout.tabsFor(legacyTabs).forEach((n) => names.add(n));
  navLayout.rootRoutesFor(legacyTabs).forEach((n) => names.add(n));
  return names;
}

describe('App.js navigation registrations', () => {
  test('tabs and mode-only root screens come from lib/navLayout', () => {
    expect(APP_SRC).toMatch(/tabsFor\(legacyTabs\)\.map/);
    expect(APP_SRC).toMatch(/rootRoutesFor\(legacyTabs\)\.map/);
    expect(APP_SRC).not.toMatch(/<Tab\.Screen\s+name="/);
  });

  test('every tab in either layout has a component in TAB_SCREENS', () => {
    const keys = appObjectKeys('TAB_SCREENS');
    for (const name of [...navLayout.LEGACY_TABS, ...navLayout.FIGMA_TABS]) {
      expect(keys.has(name)).toBe(true);
    }
  });

  test('every mode-only root route has a component in ROOT_SCREENS', () => {
    const keys = appObjectKeys('ROOT_SCREENS');
    for (const name of navLayout.FIGMA_ROOT_ROUTES) expect(keys.has(name)).toBe(true);
  });

  test('no mode-only root route is also a literal root Stack.Screen', () => {
    for (const name of navLayout.FIGMA_ROOT_ROUTES) {
      expect(APP_SRC).not.toMatch(new RegExp(`<Stack\\.Screen\\s+name="${name}"`));
    }
  });
});

// Payload variants that drive every resolveTarget branch.
const PAYLOADS = [
  undefined,
  {},
  { recipient_role: 'founder', alliance_id: 'a-1' },
  { recipient_role: 'marshal', alliance_id: 'a-1' },
];

describe('flag-gated targets', () => {
  const FOUNDER_REMINDER = {
    kind: 'weekly_task_pick_reminder',
    alliance_id: 'a-1',
    alliance_name: 'Iron Vanguard',
    recipient_role: 'founder',
  };

  test('the push table has 27 kinds', () => {
    expect(Object.keys(ROUTE_TABLE)).toHaveLength(27);
  });

  test('CommandPost with command_post off resolves to Alliance with no params', () => {
    setFlags({ command_post: false });
    const result = routeForPush('weekly_task_pick_reminder', FOUNDER_REMINDER);
    expect(result.target).toBe('Alliance');
    expect(result.params).toEqual({});
    expect(result.kind).toBe('weekly_task_pick_reminder');
    expect(result.surface).toBe(SURFACES.CARD);
  });

  test('the same push with command_post on resolves to CommandPost', () => {
    setFlags({ command_post: true });
    const result = routeForPush('weekly_task_pick_reminder', FOUNDER_REMINDER);
    expect(result.target).toBe('CommandPost');
    expect(result.params.allianceId).toBe('a-1');
  });

  test('flags are read at call time, not when the module loads', () => {
    setFlags({ command_post: true });
    expect(routeForPush('weekly_task_pick_reminder', FOUNDER_REMINDER).target).toBe('CommandPost');
    setFlags({ command_post: false });
    expect(routeForPush('weekly_task_pick_reminder', FOUNDER_REMINDER).target).toBe('Alliance');
  });

  test('a WarRoom target with war_room off resolves to Alliance', () => {
    ROUTE_TABLE.__test_war_room = { surface: SURFACES.CARD, target: 'WarRoom' };
    setFlags({ war_room: false });
    expect(routeForPush('__test_war_room').target).toBe('Alliance');
    setFlags({ war_room: true });
    expect(routeForPush('__test_war_room').target).toBe('WarRoom');
  });

  test('every gated target names a registered screen and a registry flag', () => {
    const routes = registeredRoutes();
    for (const [target, flag] of Object.entries(GATED_TARGETS)) {
      expect(routes.has(target)).toBe(true);
      expect(flags.FLAG_DEFAULTS).toHaveProperty(flag);
    }
  });

  describe.each([
    ['every flag off', false],
    ['every flag on', true],
  ])('with %s', (_label, value) => {
    test('every push kind resolves to a registered route', () => {
      setAllFlags(value);
      const routes = registeredRoutes(value);
      expect(routes.has(DEFAULT_ROUTE.target)).toBe(true);
      for (const kind of Object.keys(ROUTE_TABLE)) {
        for (const data of PAYLOADS) {
          const { target } = routeForPush(kind, data);
          if (!routes.has(target)) throw new Error(`${kind} -> unregistered route ${target}`);
          if (!value) expect(Object.keys(GATED_TARGETS)).not.toContain(target);
        }
      }
    });
  });
});

describe('legacy_tabs', () => {
  const PROFILE_KINDS = ['level_up_5', 'level_up_6', 'level_up_10', 'legacy_medal_tier_up', 'legacy_medal_count', 'legacy_medal_one_off'];
  const ACTIVITY_KINDS = ['streak_break_warning', 'streak_milestone'];

  test.each([true, false])('legacy_tabs=%s alone: every push kind lands on a mounted route', (legacy) => {
    setFlags({ legacy_tabs: legacy });
    const routes = registeredRoutes(legacy);
    for (const kind of Object.keys(ROUTE_TABLE)) {
      for (const data of PAYLOADS) {
        const { target } = routeForPush(kind, data);
        if (!routes.has(target)) throw new Error(`${kind} -> unregistered route ${target}`);
      }
    }
  });

  test('legacy_tabs on keeps the Activity and Profile tabs as targets', () => {
    setFlags({ legacy_tabs: true });
    for (const kind of ACTIVITY_KINDS) expect(routeForPush(kind).target).toBe('Activity');
    for (const kind of PROFILE_KINDS) expect(routeForPush(kind).target).toBe('Profile');
  });

  test('legacy_tabs off sends Activity pushes to Missions and Profile pushes to the root Profile', () => {
    setFlags({ legacy_tabs: false });
    for (const kind of ACTIVITY_KINDS) expect(routeForPush(kind).target).toBe('Missions');
    for (const kind of PROFILE_KINDS) {
      const { target } = routeForPush(kind);
      expect(target).toBe('Profile');
      expect(navLayout.rootRoutesFor(false)).toContain(target);
      expect(navLayout.tabsFor(false)).not.toContain(target);
    }
  });

  test('medal params survive the legacy_tabs off remap', () => {
    setFlags({ legacy_tabs: false });
    expect(routeForPush('legacy_medal_tier_up', { medalKey: 'm-1' }).params).toEqual({ medalKey: 'm-1' });
  });

  test('read at call time', () => {
    setFlags({ legacy_tabs: true });
    expect(routeForPush('streak_milestone').target).toBe('Activity');
    setFlags({ legacy_tabs: false });
    expect(routeForPush('streak_milestone').target).toBe('Missions');
  });
});
