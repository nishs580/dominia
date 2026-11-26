/**
 * lib/__tests__/activityHistory.test.js
 *
 * Figma History view-model (plan 2026-11-27 U13, G8).
 */

const {
  FINAL_TYPES,
  finalTypeOf,
  historyLabel,
  isVisibleInFigma,
  dayGroupLabel,
  formatTime,
  buildHistorySections,
} = require('../activityHistory');

// Local-time dates so the tests hold in any timezone.
const NOW = new Date(2026, 10, 27, 15, 0); // 27 Nov 2026, 15:00

function ev(id, type, occurredAt, metadata) {
  return { id, event_type: type, occurred_at: occurredAt.toISOString(), metadata: metadata || null };
}

describe('day grouping', () => {
  test('an entry from today groups under TODAY', () => {
    expect(dayGroupLabel(new Date(2026, 10, 27, 0, 5), NOW)).toMatchObject({ kind: 'today', key: 'activityLog.today' });
  });

  test('an entry from yesterday groups under YESTERDAY', () => {
    expect(dayGroupLabel(new Date(2026, 10, 26, 23, 59), NOW)).toMatchObject({
      kind: 'yesterday',
      key: 'activityLog.yesterday',
    });
  });

  test('an older entry groups under its formatted date', () => {
    expect(dayGroupLabel(new Date(2026, 10, 21, 18, 22), NOW, 'en')).toMatchObject({ kind: 'date', key: null, text: '21 NOV' });
  });

  test('another year carries the year', () => {
    expect(dayGroupLabel(new Date(2025, 11, 31, 9, 0), NOW, 'en').text).toBe('31 DEC 2025');
  });

  test('yesterday across a month boundary', () => {
    expect(dayGroupLabel(new Date(2026, 10, 30, 8, 0), new Date(2026, 11, 1, 8, 0)).kind).toBe('yesterday');
  });

  test('time renders as local 24-hour HH:MM', () => {
    expect(formatTime(new Date(2026, 10, 27, 9, 2).toISOString())).toBe('09:02');
    expect(formatTime(null)).toBe('');
  });
});

describe('Final event labels', () => {
  const cases = [
    ['territory_claimed', null, 'EMPTY_CLAIMED', 'EMPTY TERRITORY CLAIMED', 'flag', 'self'],
    ['contest_won', { outcome: 'attacker_won' }, 'ENEMY_CLAIMED', 'ENEMY TERRITORY CLAIMED', 'swords', 'enemy'],
    ['contest_held', { outcome: 'defender_won' }, 'DEFENDED', 'TERRITORY DEFENDED', 'shield', 'alliance'],
    ['defence_held', null, 'DEFENDED', 'TERRITORY DEFENDED', 'shield', 'alliance'],
    ['contest_lost', { outcome: 'attacker_won' }, 'DEFEND_FAILED', 'TERRITORY DEFENDING FAILED', 'swords', 'enemy'],
    ['contest_lost', { outcome: 'defender_won' }, 'ENEMY_CLAIM_FAILED', 'ENEMY TERRITORY CLAIM FAILED', 'shield', 'alliance'],
    ['contest_expired', { attackerWalkedM: 300, requiredWalkM: 900 }, 'ENEMY_CLAIM_FAILED', 'ENEMY TERRITORY CLAIM FAILED', 'shield', 'alliance'],
    ['contest_expired', { defenderWalkedM: 120 }, 'DEFENDED', 'TERRITORY DEFENDED', 'shield', 'alliance'],
    ['claim_failed', null, 'EMPTY_CLAIM_FAILED', 'EMPTY TERRITORY CLAIM FAILED', 'flag', 'self'],
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

describe('buildHistorySections', () => {
  const events = [
    ev('a', 'territory_claimed', new Date(2026, 10, 27, 9, 12), { territory_name: 'Cubbon Park' }),
    ev('s', 'streak_milestone', new Date(2026, 10, 27, 9, 0), { streak_days: 7 }),
    ev('b', 'contest_held', new Date(2026, 10, 27, 8, 40), { outcome: 'defender_won' }),
    ev('l', 'leveled_up', new Date(2026, 10, 26, 20, 0), { level_after: 4 }),
    ev('c', 'contest_won', new Date(2026, 10, 26, 19, 5), { outcome: 'attacker_won' }),
    ev('i', 'influence_milestone', new Date(2026, 10, 26, 10, 0), { milestone: 1000 }),
    ev('d', 'contest_defended', new Date(2026, 10, 22, 10, 0), {}),
    ev('e', 'territory_claimed', new Date(2026, 10, 21, 18, 22), { territory_name: 'Domlur Layout' }),
    ev('f', 'streak_broken', new Date(2026, 10, 21, 7, 0), {}),
  ];

  test('Figma mode hides streak, level, influence and defence-started rows', () => {
    const sections = buildHistorySections(events, { now: NOW, locale: 'en' });
    const ids = sections.flatMap((s) => s.data.map((r) => r.id));
    expect(ids).toEqual(['a', 'b', 'c', 'e']);
    ['streak_milestone', 'streak_broken', 'leveled_up', 'influence_milestone', 'contest_defended'].forEach((type) =>
      expect(isVisibleInFigma({ event_type: type })).toBe(false),
    );
    expect(isVisibleInFigma({ event_type: 'territory_claimed' })).toBe(true);
  });

  test('groups into TODAY, YESTERDAY and dated sections in feed order', () => {
    const sections = buildHistorySections(events, { now: NOW, locale: 'en' });
    expect(sections.map((s) => s.title.kind)).toEqual(['today', 'yesterday', 'date']);
    expect(sections[2].title.text).toBe('21 NOV');
    expect(sections[0].data.map((r) => r.id)).toEqual(['a', 'b']);
  });

  test('rows carry the territory headline, label and time', () => {
    const [today] = buildHistorySections(events, { now: NOW, locale: 'en' });
    expect(today.data[0]).toMatchObject({
      headline: 'Cubbon Park',
      time: '09:12',
      label: { defaultValue: 'EMPTY TERRITORY CLAIMED' },
    });
    expect(today.data[1].headline).toBeNull(); // contest rows carry no name yet
  });

  test('figma: false keeps every row (legacy)', () => {
    const sections = buildHistorySections(events, { now: NOW, figma: false });
    expect(sections.flatMap((s) => s.data)).toHaveLength(events.length);
  });

  test('tolerates junk input', () => {
    expect(buildHistorySections(null)).toEqual([]);
    expect(buildHistorySections([null, 3])).toEqual([]);
  });
});
