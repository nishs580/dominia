/**
 * lib/__tests__/leaderboardView.test.js
 *
 * Figma Leaderboards view-model (plan U17).
 */

const {
  BOARDS,
  SCOPES,
  apiParamsFor,
  ordinal,
  rowValue,
  valueCopy,
  buildLeaderboardView,
} = require('../leaderboardView');

function playerRow(rank, extra = {}) {
  return { rank, player_id: `p-${rank}`, username: `player${rank}`, territory_count: 100 - rank, ...extra };
}

function allianceRow(rank, extra = {}) {
  return {
    rank,
    alliance_id: `a-${rank}`,
    alliance_name: `Alliance ${rank}`,
    alliance_short_name: `A${rank}`,
    member_count: 5,
    territory_count: 50 - rank,
    ...extra,
  };
}

const base = { status: 'ready', board: 'territories', scope: 'solo', unit: 'km' };

describe('board and scope mapping', () => {
  test('Figma offers exactly Territories and Distance, SOLO and ALLIANCE', () => {
    expect(BOARDS.map((b) => b.key)).toEqual(['territories', 'distance']);
    expect(SCOPES.map((s) => s.key)).toEqual(['solo', 'alliance']);
  });

  test('maps onto the API board/subject', () => {
    expect(apiParamsFor('territories', 'solo')).toEqual({ board: 'territory', subject: 'players' });
    expect(apiParamsFor('territories', 'alliance')).toEqual({ board: 'territory', subject: 'alliances' });
    expect(apiParamsFor('distance', 'solo')).toEqual({ board: 'distance', subject: 'players' });
    expect(apiParamsFor('distance', 'alliance')).toEqual({ board: 'distance', subject: 'alliances' });
  });

  test('unknown keys fall back to territories / solo', () => {
    expect(apiParamsFor('power', 'x')).toEqual({ board: 'territory', subject: 'players' });
  });
});

describe('copy helpers', () => {
  test.each([
    [1, '1st'], [2, '2nd'], [3, '3rd'], [4, '4th'], [11, '11th'], [12, '12th'],
    [13, '13th'], [14, '14th'], [21, '21st'], [22, '22nd'], [101, '101st'], [112, '112th'],
  ])('ordinal(%i) = %s', (n, s) => {
    expect(ordinal(n)).toBe(s);
  });

  test('territory value pads to two digits ("03 Territories")', () => {
    expect(valueCopy('territories', 3).params.n).toBe('03');
    expect(valueCopy('territories', 96).params.n).toBe('96');
    expect(valueCopy('territories', 96).defaultValue).toBe('{{n}} Territories');
  });

  test('distance value uses lib/units formatDistance in the player unit', () => {
    expect(valueCopy('distance', 121450, 'km').params.distance).toBe('121.5 km');
    expect(valueCopy('distance', 1609.344, 'mi').params.distance).toBe('1.0 mi');
  });

  test('rowValue reads distance_m / territory_count, falling back to value', () => {
    expect(rowValue('distance', { distance_m: 500 })).toBe(500);
    expect(rowValue('distance', { weekly_distance_m: 700 })).toBe(700);
    expect(rowValue('distance', { value: '900' })).toBe(900);
    expect(rowValue('territories', { territory_count: 4 })).toBe(4);
    expect(rowValue('territories', { value: 6 })).toBe(6);
    expect(rowValue('territories', {})).toBeNull();
  });
});

describe('buildLeaderboardView — states', () => {
  test('loading -> loading state, nothing pinned', () => {
    const v = buildLeaderboardView({ ...base, status: 'loading', rows: [], self: { rank: 1, value: 2 } });
    expect(v).toEqual({ state: 'loading', podium: [], list: [], pinned: null });
  });

  test('failed request -> error state (screen shows retry)', () => {
    const v = buildLeaderboardView({ ...base, status: 'error', rows: [playerRow(1)], self: null });
    expect(v.state).toBe('error');
    expect(v.podium).toEqual([]);
    expect(v.pinned).toBeNull();
  });

  test('empty board -> empty state', () => {
    const v = buildLeaderboardView({ ...base, rows: [], self: null });
    expect(v.state).toBe('empty');
    expect(v.podium).toEqual([]);
    expect(v.list).toEqual([]);
  });

  test.each(['territories', 'distance'])('%s board with rows -> ready', (board) => {
    const rows = [playerRow(1, { distance_m: 1000 })];
    expect(buildLeaderboardView({ ...base, board, rows, self: null }).state).toBe('ready');
  });
});

describe('buildLeaderboardView — podium', () => {
  test('full podium is ordered 2nd, 1st, 3rd and the list starts at 4th', () => {
    const rows = [1, 2, 3, 4, 5].map((r) => playerRow(r));
    const v = buildLeaderboardView({ ...base, rows, self: null });
    expect(v.podium.map((e) => e.slot)).toEqual([2, 1, 3]);
    expect(v.podium.map((e) => e.rank)).toEqual([2, 1, 3]);
    expect(v.list.map((e) => e.rank)).toEqual([4, 5]);
  });

  test('rows out of order are sorted by rank', () => {
    const rows = [playerRow(3), playerRow(1), playerRow(2)];
    const v = buildLeaderboardView({ ...base, rows, self: null });
    expect(v.podium.map((e) => e.rank)).toEqual([2, 1, 3]);
  });

  test('one row -> a single first-place entry, no empty slots', () => {
    const v = buildLeaderboardView({ ...base, rows: [playerRow(1)], self: null });
    expect(v.podium).toHaveLength(1);
    expect(v.podium[0].slot).toBe(1);
    expect(v.podium.every(Boolean)).toBe(true);
    expect(v.list).toEqual([]);
  });

  test('two rows -> 2nd and 1st only, no empty slots', () => {
    const v = buildLeaderboardView({ ...base, rows: [playerRow(1), playerRow(2)], self: null });
    expect(v.podium.map((e) => e.slot)).toEqual([2, 1]);
    expect(v.podium.every(Boolean)).toBe(true);
  });

  test('player entry carries name, Solo tag, value and place', () => {
    const v = buildLeaderboardView({ ...base, rows: [playerRow(1, { username: 'Moksh', territory_count: 96 })], self: null });
    const e = v.podium[0];
    expect(e.name).toBe('Moksh');
    expect(e.tag).toEqual({ key: 'leaderboards.solo', defaultValue: 'Solo', params: {} });
    expect(e.valueCopy.params.n).toBe('96');
    expect(e.placeCopy.params.ordinal).toBe('1st');
    expect(e.playerId).toBe('p-1');
  });

  test('player in an alliance shows the alliance tag instead of Solo', () => {
    const v = buildLeaderboardView({ ...base, rows: [playerRow(1, { alliance_short_name: 'JC' })], self: null });
    expect(v.podium[0].tag).toEqual({ key: null, text: '[JC]' });
  });

  test('alliance entries carry name and emblem, no player id', () => {
    const v = buildLeaderboardView({
      ...base,
      scope: 'alliance',
      rows: [allianceRow(1, { emblem: 'lion' })],
      self: null,
    });
    const e = v.podium[0];
    expect(e.name).toBe('Alliance 1');
    expect(e.emblem).toBe('lion');
    expect(e.allianceId).toBe('a-1');
    expect(e.playerId).toBeNull();
  });

  test('distance rows format with the player unit', () => {
    const v = buildLeaderboardView({
      ...base,
      board: 'distance',
      unit: 'km',
      rows: [playerRow(1, { distance_m: 121450 })],
      self: null,
    });
    expect(v.podium[0].valueCopy.params.distance).toBe('121.5 km');
  });
});

describe('buildLeaderboardView — self / pinned row', () => {
  test('self null hides the pinned row and highlights nothing', () => {
    const rows = [1, 2, 3, 4].map((r) => playerRow(r));
    const v = buildLeaderboardView({ ...base, rows, self: null });
    expect(v.pinned).toBeNull();
    expect([...v.podium, ...v.list].some((e) => e.isSelf)).toBe(false);
  });

  test('self inside the top three highlights the podium entry and still pins the row', () => {
    const rows = [1, 2, 3, 4].map((r) => playerRow(r));
    const self = { rank: 2, value: 98, player_id: 'p-2', username: 'player2' };
    const v = buildLeaderboardView({ ...base, rows, self });
    const highlighted = v.podium.filter((e) => e.isSelf);
    expect(highlighted).toHaveLength(1);
    expect(highlighted[0].rank).toBe(2);
    expect(v.list.some((e) => e.isSelf)).toBe(false);
    expect(v.pinned).not.toBeNull();
    expect(v.pinned.rank).toBe(2);
    expect(v.pinned.isSelf).toBe(true);
  });

  test('self without ids matches by rank', () => {
    const rows = [1, 2, 3].map((r) => playerRow(r));
    const v = buildLeaderboardView({ ...base, rows, self: { rank: 3, value: 97 } });
    expect(v.podium.find((e) => e.isSelf).rank).toBe(3);
    expect(v.pinned.name).toBe('player3'); // borrowed from the board row
  });

  test('self outside the top 100 pins "Deepak · 03 Territories · 14th Place"', () => {
    const rows = [1, 2, 3, 4].map((r) => playerRow(r));
    const self = { rank: 14, value: 3, player_id: 'p-99', username: 'Deepak' };
    const v = buildLeaderboardView({ ...base, rows, self });
    expect([...v.podium, ...v.list].some((e) => e.isSelf)).toBe(false);
    expect(v.pinned.name).toBe('Deepak');
    expect(v.pinned.tag).toBeNull();
    expect(v.pinned.valueCopy.params.n).toBe('03');
    expect(v.pinned.placeCopy.params.ordinal).toBe('14th');
  });

  test('self in the list highlights that list row', () => {
    const rows = [1, 2, 3, 4, 5].map((r) => playerRow(r));
    const v = buildLeaderboardView({ ...base, rows, self: { rank: 5, value: 95, player_id: 'p-5' } });
    expect(v.list.find((e) => e.isSelf).rank).toBe(5);
  });

  test('alliance self matches by alliance_id', () => {
    const rows = [1, 2, 3].map((r) => allianceRow(r));
    const self = { rank: 1, value: 49, alliance_id: 'a-1', alliance_name: 'Alliance 1' };
    const v = buildLeaderboardView({ ...base, scope: 'alliance', rows, self });
    expect(v.podium.find((e) => e.isSelf).allianceId).toBe('a-1');
    expect(v.pinned.name).toBe('Alliance 1');
  });

  test('distance self uses self.value in the player unit', () => {
    const rows = [playerRow(1, { distance_m: 9000 })];
    const self = { rank: 40, value: 1609.344 };
    const v = buildLeaderboardView({ ...base, board: 'distance', unit: 'mi', rows, self });
    expect(v.pinned.valueCopy.params.distance).toBe('1.0 mi');
  });
});
