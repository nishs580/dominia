/**
 * lib/__tests__/activityHistory.test.js
 *
 * Dominia-Temp History view-model (plan 2026-11-28 U11, board 40).
 */

const {
  FINAL_TYPES,
  finalTypeOf,
  historyLabel,
  historyItem,
  isVisibleInFigma,
  formatDayStamp,
  formatClock,
  formatTime,
  buildHistoryRows,
} = require('../activityHistory');

// Local-time dates so the tests hold in any timezone.
const NOW = new Date(2026, 10, 27, 15, 0); // 27 Nov 2026, 15:00

function ev(id, type, occurredAt, metadata) {
  return { id, event_type: type, occurred_at: occurredAt.toISOString(), metadata: metadata || null };
}

describe('day stamp and clock', () => {
  test.each([
    [27, '27th Oct'], [1, '1st Oct'], [2, '2nd Oct'], [3, '3rd Oct'], [11, '11th Oct'],
    [12, '12th Oct'], [13, '13th Oct'], [21, '21st Oct'], [22, '22nd Oct'], [31, '31st Oct'],
  ])('day %i → %s', (day, text) => {
    expect(formatDayStamp(new Date(2026, 9, day, 18, 56), { locale: 'en', now: NOW })).toBe(text);
  });

  test('another year carries the year', () => {
    expect(formatDayStamp(new Date(2025, 11, 31, 9, 0), { locale: 'en', now: NOW })).toBe('31st Dec 2025');
  });

  test('a non-English locale drops the English suffix', () => {
    expect(formatDayStamp(new Date(2026, 9, 27, 9, 0), { locale: 'ru', now: NOW })).toMatch(/^27 \S+$/);
  });

  test('clock is "06:56 PM" in English, 24-hour elsewhere', () => {
    expect(formatClock(new Date(2026, 9, 27, 18, 56), 'en')).toBe('06:56 PM');
    expect(formatClock(new Date(2026, 9, 27, 0, 5), 'en')).toBe('12:05 AM');
    expect(formatClock(new Date(2026, 9, 27, 12, 0), 'en')).toBe('12:00 PM');
    expect(formatClock(new Date(2026, 9, 27, 18, 56), 'ru')).toBe('18:56');
    expect(formatClock(null, 'en')).toBe('');
  });

  test('formatTime stays local 24-hour HH:MM', () => {
    expect(formatTime(new Date(2026, 10, 27, 9, 2).toISOString())).toBe('09:02');
    expect(formatTime(null)).toBe('');
  });
});

describe('Final event labels', () => {
  const cases = [
    ['territory_claimed', null, 'EMPTY_CLAIMED', 'Empty territory claimed', 'flag', 'success'],
    ['claim_failed', null, 'EMPTY_CLAIM_FAILED', 'Empty territory claim failed', 'flag', 'failure'],
    ['contest_won', { outcome: 'attacker_won' }, 'ENEMY_CLAIMED', 'Enemy territory claimed', 'swords', 'success'],
    ['contest_lost', { outcome: 'defender_won' }, 'ENEMY_CLAIM_FAILED', 'Enemy territory claim failed', 'swords', 'failure'],
    ['contest_expired', { attackerWalkedM: 300, requiredWalkM: 900 }, 'ENEMY_CLAIM_FAILED', 'Enemy territory claim failed', 'swords', 'failure'],
    ['contest_held', { outcome: 'defender_won' }, 'DEFENDED', 'Territory defended', 'shield', 'success'],
    ['defence_held', null, 'DEFENDED', 'Territory defended', 'shield', 'success'],
    ['contest_expired', { defenderWalkedM: 120 }, 'DEFENDED', 'Territory defended', 'shield', 'success'],
    ['contest_lost', { outcome: 'attacker_won' }, 'DEFEND_FAILED', 'Territory defending failed', 'shield', 'failure'],
  ];

  test.each(cases)('%s %j → %s', (type, metadata, finalType, text, icon, tone) => {
    const e = { id: 1, event_type: type, metadata };
    expect(finalTypeOf(e)).toBe(finalType);
    const label = historyLabel(e);
    expect(label.defaultValue).toBe(text);
    expect(label.key).toBe(FINAL_TYPES[finalType].key);
    expect(label.icon).toBe(icon);
    expect(label.tone).toBe(tone);
  });

  test('every Final type has a distinct activityLog.* key', () => {
    const keys = Object.values(FINAL_TYPES).map((f) => f.key);
    expect(new Set(keys).size).toBe(6);
    keys.forEach((k) => expect(k.startsWith('activityLog.')).toBe(true));
  });

  test('non-Final types keep their stub copy with a neutral tile', () => {
    expect(historyLabel({ event_type: 'alliance_joined' })).toEqual({
      finalType: null,
      key: 'activityEvent.stub.alliance_joined',
      defaultValue: 'ALLIANCE JOINED',
      icon: 'dot',
      tone: 'neutral',
    });
  });
});

describe('buildHistoryRows', () => {
  const events = [
    ev('a', 'territory_claimed', new Date(2026, 9, 27, 18, 56), { territory_name: 'Cubbon Park' }),
    ev('s', 'streak_milestone', new Date(2026, 9, 27, 9, 0), { streak_days: 7 }),
    ev('b', 'contest_held', new Date(2026, 9, 26, 8, 40), { outcome: 'defender_won' }),
    ev('l', 'leveled_up', new Date(2026, 9, 26, 20, 0), { level_after: 4 }),
    ev('i', 'influence_milestone', new Date(2026, 9, 26, 10, 0), { milestone: 1000 }),
    ev('d', 'contest_defended', new Date(2026, 9, 22, 10, 0), {}),
    ev('f', 'streak_broken', new Date(2026, 9, 21, 7, 0), {}),
  ];

  test('hides streak, level, influence and defence-started rows, keeps feed order', () => {
    const rows = buildHistoryRows(events, { locale: 'en', now: NOW });
    expect(rows.map((r) => r.id)).toEqual(['a', 'b']);
    ['streak_milestone', 'streak_broken', 'leveled_up', 'influence_milestone', 'contest_defended'].forEach((type) =>
      expect(isVisibleInFigma({ event_type: type })).toBe(false),
    );
  });

  test('rows carry the territory headline, label, day stamp and clock', () => {
    const [first, second] = buildHistoryRows(events, { locale: 'en', now: NOW });
    expect(first).toMatchObject({
      headline: 'Cubbon Park',
      date: '27th Oct',
      time: '06:56 PM',
      label: { defaultValue: 'Empty territory claimed', icon: 'flag', tone: 'success' },
    });
    expect(second.headline).toBeNull(); // contest rows carry no name yet
  });

  test('figma: false keeps every row', () => {
    expect(buildHistoryRows(events, { figma: false })).toHaveLength(events.length);
  });

  test('historyItem works as a map callback (index ignored)', () => {
    const [item] = [events[0]].map(historyItem);
    expect(item.id).toBe('a');
    expect(item.time).toBe('06:56 PM');
  });

  test('tolerates junk input', () => {
    expect(buildHistoryRows(null)).toEqual([]);
    expect(buildHistoryRows([null, 3])).toEqual([]);
  });
});
