/**
 * lib/__tests__/leaderboardView.test.js
 *
 * Dominia-Temp Leaderboards view-model (plan 2026-11-28 U11, board 39).
 */

const {
  BOARDS,
  SCOPES,
  apiParamsFor,
  ordinal,
  rankTone,
  rowValue,
  valueCopy,
  formatBoardDistance,
  filterRowsByName,
  buildLeaderboardView,
  rankLabel,
  boardTabs,
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
  test('the board offers exactly Territories and Distance, SOLO and ALLIANCE', () => {
    expect(BOARDS.map((b) => b.key)).toEqual(['territories', 'distance']);
    expect(SCOPES.map((s) => s.key)).toEqual(['solo', 'alliance']);
  });

  test('subject × board selects the endpoint', () => {
    expect(apiParamsFor('territories', 'solo')).toEqual({ board: 'territory', subject: 'players' });
    expect(apiParamsFor('territories', 'alliance')).toEqual({ board: 'territory', subject: 'alliances' });
    expect(apiParamsFor('distance', 'solo')).toEqual({ board: 'distance', subject: 'players' });
    expect(apiParamsFor('distance', 'alliance')).toEqual({ board: 'distance', subject: 'alliances' });
  });

  test('unknown keys fall back to territories / solo', () => {
    expect(apiParamsFor('power', 'x')).toEqual({ board: 'territory', subject: 'players' });
  });

  test('dropdown options label Territories and Distance and mark the active one', () => {
    expect(boardTabs('distance')).toEqual([
      { key: 'territories', active: false, label: { key: 'leaderboards.boardTerritories', defaultValue: 'Territories', params: {} } },
      { key: 'distance', active: true, label: { key: 'leaderboards.boardDistance', defaultValue: 'Distance', params: {} } },
    ]);
    expect(boardTabs('nope').find((tab) => tab.active).key).toBe('territories');
  });
});

describe('copy helpers', () => {
  test.each([
    [1, '1st'], [2, '2nd'], [3, '3rd'], [4, '4th'], [11, '11th'], [12, '12th'],
    [13, '13th'], [14, '14th'], [21, '21st'], [22, '22nd'], [101, '101st'], [112, '112th'], [141, '141st'],
  ])('ordinal(%i) = %s', (n, s) => {
    expect(ordinal(n)).toBe(s);
  });

  test.each([
    [1, 'gold'], [2, 'bronze'], [3, 'silver'], [4, 'neutral'], [141, 'neutral'], ['1', 'gold'], [null, 'neutral'],
  ])('rankTone(%p) = %s', (rank, tone) => {
    expect(rankTone(rank)).toBe(tone);
  });

  test('territory value pads to two digits ("03 Territories")', () => {
    expect(valueCopy('territories', 3).params.n).toBe('03');
    expect(valueCopy('territories', 96).params.n).toBe('96');
    expect(valueCopy('territories', 96).defaultValue).toBe('{{n}} Territories');
    expect(valueCopy('territories', null).params.n).toBe('—');
  });

  test('distance value has two decimals in the player unit ("121.45 km")', () => {
    expect(valueCopy('distance', 121450, 'km').params.distance).toBe('121.45 km');
    expect(formatBoardDistance(70000, 'km')).toBe('70.00 km');
    expect(formatBoardDistance(1609.344, 'mi')).toBe('1.00 mi');
    expect(formatBoardDistance('x', 'km')).toBe('—');
  });

  test('rank label is the bare number', () => {
    expect(rankLabel(1)).toBe('1');
    expect(rankLabel(141)).toBe('141');
    expect(rankLabel(undefined)).toBe('—');
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

describe('search filter', () => {
  const rows = [
    playerRow(1, { username: 'Moksh' }),
    playerRow(2, { username: 'Nishan' }),
    playerRow(141, { username: 'Deepak' }),
  ];

  test('case-insensitive substring on the name; blank query keeps everything', () => {
    expect(filterRowsByName(rows, 'MOK', 'players').map((r) => r.username)).toEqual(['Moksh']);
    expect(filterRowsByName(rows, '  an ', 'players').map((r) => r.username)).toEqual(['Nishan']);
    expect(filterRowsByName(rows, '', 'players')).toHaveLength(3);
    expect(filterRowsByName(rows, '   ', 'players')).toHaveLength(3);
  });

  test('alliances match on alliance_name', () => {
    const al = [allianceRow(1, { alliance_name: 'Spade Pirates' }), allianceRow(2, { alliance_name: 'All Seein Eye' })];
    expect(filterRowsByName(al, 'pirate', 'alliances')).toHaveLength(1);
  });

  test('a search keeps global rank, hides the podium and lists every match', () => {
    const v = buildLeaderboardView({ ...base, rows, self: null, query: 'deep' });
    expect(v.state).toBe('ready');
    expect(v.podium).toEqual([]);
    expect(v.list.map((e) => [e.name, e.rank, e.placeCopy.params.ordinal])).toEqual([['Deepak', 141, '141st']]);
  });

  test('a search with zero matches is the no-results state; pinned row stays', () => {
    const self = { rank: 141, value: 3, player_id: 'p-141' };
    const v = buildLeaderboardView({ ...base, rows, self, query: 'zzz' });
    expect(v.state).toBe('noResults');
    expect(v.list).toEqual([]);
    expect(v.pinned.rank).toBe(141);
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

  test('empty board -> empty state, even with a query', () => {
    expect(buildLeaderboardView({ ...base, rows: [], self: null }).state).toBe('empty');
    expect(buildLeaderboardView({ ...base, rows: [], self: null, query: 'x' }).state).toBe('empty');
  });

  test.each(['territories', 'distance'])('%s board with rows -> ready', (board) => {
    const rows = [playerRow(1, { distance_m: 1000 })];
    expect(buildLeaderboardView({ ...base, board, rows, self: null }).state).toBe('ready');
  });
});

describe('buildLeaderboardView — podium and rows', () => {
  test('podium is ordered 3rd, 1st, 2nd and the list repeats every rank from 1st', () => {
    const rows = [1, 2, 3, 4, 5].map((r) => playerRow(r));
    const v = buildLeaderboardView({ ...base, rows, self: null });
    expect(v.podium.map((e) => e.slot)).toEqual([3, 1, 2]);
    expect(v.podium.map((e) => e.tone)).toEqual(['silver', 'gold', 'bronze']);
    expect(v.list.map((e) => e.rank)).toEqual([1, 2, 3, 4, 5]);
    expect(v.list.map((e) => e.tone)).toEqual(['gold', 'bronze', 'silver', 'neutral', 'neutral']);
  });

  test('rows out of order are sorted by rank', () => {
    const rows = [playerRow(3), playerRow(1), playerRow(2)];
    const v = buildLeaderboardView({ ...base, rows, self: null });
    expect(v.podium.map((e) => e.rank)).toEqual([3, 1, 2]);
  });

  test('one row -> a single first-place slot, no empty slots', () => {
    const v = buildLeaderboardView({ ...base, rows: [playerRow(1)], self: null });
    expect(v.podium).toHaveLength(1);
    expect(v.podium[0].slot).toBe(1);
    expect(v.podium.every(Boolean)).toBe(true);
  });

  test('two rows -> 1st and 2nd only, no empty slots', () => {
    const v = buildLeaderboardView({ ...base, rows: [playerRow(1), playerRow(2)], self: null });
    expect(v.podium.map((e) => e.slot)).toEqual([1, 2]);
    expect(v.podium.every(Boolean)).toBe(true);
  });

  test('player entry carries name, Solo subtext, value and place', () => {
    const v = buildLeaderboardView({ ...base, rows: [playerRow(1, { username: 'Moksh', territory_count: 96 })], self: null });
    const e = v.list[0];
    expect(e.name).toBe('Moksh');
    expect(e.kind).toEqual({ key: 'leaderboards.solo', defaultValue: 'Solo', params: {} });
    expect(e.valueCopy.params.n).toBe('96');
    expect(e.placeCopy).toEqual({ key: 'leaderboards.place', defaultValue: '{{ordinal}} Place', params: { ordinal: '1st', rank: 1 } });
    expect(e.playerId).toBe('p-1');
  });

  test('alliance entries carry name, Alliance subtext and emblem, no player id', () => {
    const v = buildLeaderboardView({
      ...base,
      scope: 'alliance',
      rows: [allianceRow(1, { emblem: 'lion' })],
      self: null,
    });
    const e = v.podium[0];
    expect(e.name).toBe('Alliance 1');
    expect(e.kind.defaultValue).toBe('Alliance');
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
    expect(v.list[0].valueCopy.params.distance).toBe('121.45 km');
  });
});

describe('buildLeaderboardView — self / pinned row', () => {
  test('self null hides YOUR POSITION and highlights nothing', () => {
    const rows = [1, 2, 3, 4].map((r) => playerRow(r));
    const v = buildLeaderboardView({ ...base, rows, self: null, selfName: 'kausthubh' });
    expect(v.pinned).toBeNull();
    expect([...v.podium, ...v.list].some((e) => e.isSelf)).toBe(false);
  });

  test('self inside the top three highlights the entry and still pins the row', () => {
    const rows = [1, 2, 3, 4].map((r) => playerRow(r));
    const self = { rank: 2, value: 98, player_id: 'p-2', username: 'player2' };
    const v = buildLeaderboardView({ ...base, rows, self });
    expect(v.podium.filter((e) => e.isSelf).map((e) => e.rank)).toEqual([2]);
    expect(v.pinned.rank).toBe(2);
    expect(v.pinned.isSelf).toBe(true);
  });

  test('self without ids matches by rank and borrows the row name', () => {
    const rows = [1, 2, 3].map((r) => playerRow(r));
    const v = buildLeaderboardView({ ...base, rows, self: { rank: 3, value: 97 } });
    expect(v.list.find((e) => e.isSelf).rank).toBe(3);
    expect(v.pinned.name).toBe('player3');
  });

  test('self outside the board pins "141 · Deepak · 03 Territories · 141st Place"', () => {
    const rows = [1, 2, 3, 4].map((r) => playerRow(r));
    const self = { rank: 141, value: 3, player_id: 'p-99', username: 'Deepak' };
    const v = buildLeaderboardView({ ...base, rows, self });
    expect([...v.podium, ...v.list].some((e) => e.isSelf)).toBe(false);
    expect(v.pinned.rankLabel).toBe('141');
    expect(v.pinned.name).toBe('Deepak');
    expect(v.pinned.kind.defaultValue).toBe('Solo');
    expect(v.pinned.valueCopy.params.n).toBe('03');
    expect(v.pinned.placeCopy.params.ordinal).toBe('141st');
  });

  test('pinned solo row falls back to selfName', () => {
    const v = buildLeaderboardView({ ...base, rows: [playerRow(1)], self: { rank: 14, value: 7 }, selfName: 'kausthubh' });
    expect(v.pinned.name).toBe('kausthubh');
  });

  test('alliance self matches by alliance_id', () => {
    const rows = [1, 2, 3].map((r) => allianceRow(r));
    const self = { rank: 1, value: 49, alliance_id: 'a-1', alliance_name: 'Alliance 1' };
    const v = buildLeaderboardView({ ...base, scope: 'alliance', rows, self });
    expect(v.podium.find((e) => e.isSelf).allianceId).toBe('a-1');
    expect(v.pinned.name).toBe('Alliance 1');
    expect(v.pinned.kind.defaultValue).toBe('Alliance');
  });

  test('distance self uses self.value in the player unit', () => {
    const rows = [playerRow(1, { distance_m: 9000 })];
    const self = { rank: 40, value: 1609.344 };
    const v = buildLeaderboardView({ ...base, board: 'distance', unit: 'mi', rows, self });
    expect(v.pinned.valueCopy.params.distance).toBe('1.00 mi');
  });
});
