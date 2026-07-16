const fs = require('fs');
const path = require('path');

const ROUTE_SRC = fs.readFileSync(
  path.join(__dirname, '..', 'route.js'),
  'utf8',
).replace(/^export\s+/gm, '');

let SURFACES, ROUTE_TABLE, DEFAULT_ROUTE, routeForPush;

beforeEach(() => {
  const ctx = {};
  new Function(
    'ctx',
    ROUTE_SRC +
      '\nctx.SURFACES = SURFACES;' +
      '\nctx.ROUTE_TABLE = ROUTE_TABLE;' +
      '\nctx.DEFAULT_ROUTE = DEFAULT_ROUTE;' +
      '\nctx.routeForPush = routeForPush;',
  )(ctx);
  ({ SURFACES, ROUTE_TABLE, DEFAULT_ROUTE, routeForPush } = ctx);
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
