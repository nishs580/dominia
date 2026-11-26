/**
 * lib/__tests__/allianceJoin.test.js
 *
 * U12: the detail pop-up's join button follows join_type (JOIN for Open,
 * REQUEST TO JOIN for Invite only), shows "Request sent" once requested, and
 * pending join requests normalise defensively.
 */

const en = require('../../locales/en.json');
const ru = require('../../locales/ru.json');
const {
  normalizeJoinType, hasPendingRequest, joinButtonState, joinOutcome,
  joinTypeLabelKey, padRank, normalizeJoinRequests, memberInitials,
} = require('../allianceJoin');

const lookup = (dict, key) => key.split('.').reduce((o, k) => (o == null ? o : o[k]), dict);

describe('joinButtonState', () => {
  test('Open alliance shows JOIN', () => {
    const s = joinButtonState({ joinType: 'open' });
    expect(s.state).toBe('join');
    expect(lookup(en, s.labelKey)).toBe('JOIN');
    expect(s.disabled).toBe(false);
  });

  test('Invite only alliance shows REQUEST TO JOIN', () => {
    const s = joinButtonState({ joinType: 'invite_only' });
    expect(s.state).toBe('request');
    expect(lookup(en, s.labelKey)).toBe('REQUEST TO JOIN');
    expect(s.disabled).toBe(false);
  });

  test('missing join_type behaves as Open (backend not deployed)', () => {
    expect(joinButtonState({}).state).toBe('join');
    expect(joinButtonState({ joinType: undefined }).state).toBe('join');
  });

  test('requested shows a disabled "Request sent"', () => {
    const s = joinButtonState({ joinType: 'invite_only', requested: true });
    expect(s.state).toBe('requested');
    expect(s.disabled).toBe(true);
    expect(lookup(en, s.labelKey)).toBe('Request sent');
  });

  test('a full alliance is disabled whatever the type', () => {
    expect(joinButtonState({ joinType: 'invite_only', full: true })).toMatchObject({ state: 'full', disabled: true });
    expect(joinButtonState({ joinType: 'open', full: true })).toMatchObject({ state: 'full', disabled: true });
  });

  test('joining disables the button', () => {
    expect(joinButtonState({ joinType: 'open', joining: true }).disabled).toBe(true);
  });

  test('every label key exists in both locales', () => {
    for (const args of [{ joinType: 'open' }, { joinType: 'invite_only' }, { requested: true }, { full: true }]) {
      const { labelKey } = joinButtonState(args);
      expect(typeof lookup(en, labelKey)).toBe('string');
      expect(typeof lookup(ru, labelKey)).toBe('string');
    }
  });
});

describe('joinOutcome / normalizeJoinType / hasPendingRequest', () => {
  test('{status: requested} is a request, anything else a join', () => {
    expect(joinOutcome({ status: 'requested' })).toBe('requested');
    expect(joinOutcome({ alliance_id: 'a1' })).toBe('joined');
    expect(joinOutcome(null)).toBe('joined');
  });

  test('join type normalises to open unless invite_only', () => {
    expect(normalizeJoinType('invite_only')).toBe('invite_only');
    expect(normalizeJoinType('INVITE_ONLY')).toBe('invite_only');
    expect(normalizeJoinType('open')).toBe('open');
    expect(normalizeJoinType(null)).toBe('open');
  });

  test('TYPE cell key follows join type', () => {
    expect(lookup(en, joinTypeLabelKey('invite_only'))).toBe('INVITE ONLY');
    expect(lookup(en, joinTypeLabelKey('open'))).toBe('OPEN');
  });

  test('pending request flags', () => {
    expect(hasPendingRequest({ my_request_status: 'pending' })).toBe(true);
    expect(hasPendingRequest({ has_pending_request: true })).toBe(true);
    expect(hasPendingRequest({})).toBe(false);
    expect(hasPendingRequest(null)).toBe(false);
  });
});

describe('normalizeJoinRequests', () => {
  test('reads { requests } with inline or nested player', () => {
    const out = normalizeJoinRequests({
      requests: [
        { id: 'r1', player_id: 'p1', username: 'moksh', territories_held: 4 },
        { id: 2, player: { id: 'p2', username: 'nishan', avatar_url: 'u' } },
        { player_id: 'no-id' },
      ],
    });
    expect(out).toEqual([
      { id: 'r1', player_id: 'p1', username: 'moksh', avatar_url: null, territories_held: 4, created_at: null },
      { id: '2', player_id: 'p2', username: 'nishan', avatar_url: 'u', territories_held: null, created_at: null },
    ]);
  });

  test('a bare array or junk is handled', () => {
    expect(normalizeJoinRequests([{ id: 'r' }])).toHaveLength(1);
    expect(normalizeJoinRequests(null)).toEqual([]);
    expect(normalizeJoinRequests({ requests: 'x' })).toEqual([]);
  });
});

describe('row formats', () => {
  test('ranks pad to two digits', () => {
    expect(padRank(1)).toBe('01');
    expect(padRank(12)).toBe('12');
  });
  test('initials', () => {
    expect(memberInitials('kaustav')).toBe('KA');
    expect(memberInitials('_x')).toBe('X');
    expect(memberInitials(null)).toBe('??');
  });
});
