/**
 * lib/__tests__/chatSender.test.js
 *
 * Dominia-Temp Chat helpers (plan 2026-11-28 U11, board 41).
 */

const { roleCopy, chatSenderParts, mentionsName, chatAgo, defaultChatTab } = require('../chatSender');

describe('role mapping', () => {
  test.each([
    ['FOUNDER', 'Captain'],
    ['founder', 'Captain'],
    ['MARSHAL', 'Commander'],
    ['officer', 'Lieutenant'],
    ['MEMBER', 'Troop'],
    ['recruit', 'Troop'],
  ])('%s → %s', (stored, label) => {
    expect(roleCopy(stored).defaultValue).toBe(label);
  });

  test('no role or an unknown one maps to null', () => {
    expect(roleCopy(null)).toBeNull();
    expect(roleCopy('emperor')).toBeNull();
  });
});

describe('chatSenderParts — Global', () => {
  test('a player with a tag and role reads "Rakesh" + "JCI - Troop"', () => {
    const p = chatSenderParts({ sender_id: 'p2', sender_name: 'Rakesh', sender_alliance_short_name: 'JCI', role: 'MEMBER' });
    expect(p).toEqual({ name: 'Rakesh', detail: 'JCI - Troop', tone: 'other', isSelf: false });
  });

  test('a player with no alliance reads Solo Player', () => {
    expect(chatSenderParts({ sender_id: 'p3', sender_name: 'Moksh' }).detail).toBe('Solo Player');
  });

  test('a tag without a role (older backend) shows the tag alone', () => {
    expect(chatSenderParts({ sender_name: 'Ritika', sender_alliance_short_name: 'GP' }).detail).toBe('GP');
  });

  test('your own message reads You, no detail', () => {
    const p = chatSenderParts(
      { sender_id: 'me', sender_name: 'kausthubh', sender_alliance_short_name: 'JIC', role: 'member' },
      { selfPlayerId: 'me' },
    );
    expect(p).toEqual({ name: 'You', detail: null, tone: 'self', isSelf: true });
  });

  test('a player in your alliance is an ally', () => {
    const p = chatSenderParts(
      { sender_id: 'p9', sender_name: 'Ravi', sender_alliance_short_name: 'jic', role: 'founder' },
      { selfPlayerId: 'me', selfTag: 'JIC' },
    );
    expect(p.tone).toBe('ally');
    expect(p.detail).toBe('jic - Captain');
  });

  test('translations flow through t', () => {
    const t = (key, opts) => ({ 'chat.roleTroop': 'Боец', 'chat.soloPlayerTag': 'Одиночка' }[key] || opts.defaultValue);
    expect(chatSenderParts({ sender_name: 'Ravi', sender_alliance_short_name: 'JIC', role: 'member' }, { t }).detail).toBe('JIC - Боец');
    expect(chatSenderParts({ sender_name: 'Neha' }, { t }).detail).toBe('Одиночка');
  });
});

describe('chatSenderParts — Alliance', () => {
  test('allies show name and role, no tag', () => {
    const p = chatSenderParts(
      { sender_id: 'p2', sender_name: 'Nishan', sender_alliance_short_name: 'JIC', role: 'MARSHAL' },
      { channel: 'alliance', selfPlayerId: 'me' },
    );
    expect(p).toEqual({ name: 'Nishan', detail: 'Commander', tone: 'ally', isSelf: false });
  });

  test('your optimistic echo reads You + your own role', () => {
    const p = chatSenderParts(
      { sender_id: 'self', sender_name: 'You', _optimistic: true },
      { channel: 'alliance', selfRole: 'member' },
    );
    expect(p).toEqual({ name: 'You', detail: 'Troop', tone: 'self', isSelf: true });
  });
});

describe('mentionsName', () => {
  test('"@Moksh" mentions Moksh but not Moksha', () => {
    expect(mentionsName('@Moksh, want to join our alliance?', 'Moksh')).toBe(true);
    expect(mentionsName('@Moksh, want to join our alliance?', 'Moksha')).toBe(false);
    expect(mentionsName('@Moksha hi', 'Moksh')).toBe(false);
  });

  test('case-insensitive, anywhere in the message, at the end', () => {
    expect(mentionsName('hey @moksh', 'Moksh')).toBe(true);
    expect(mentionsName('ping @MOKSH', 'Moksh')).toBe(true);
    expect(mentionsName('first @Moksha then @Moksh!', 'Moksh')).toBe(true);
  });

  test('a name glued to a word before the @ is not a mention', () => {
    expect(mentionsName('mail a@Moksh', 'Moksh')).toBe(false);
    expect(mentionsName('@Moksh_2 hi', 'Moksh')).toBe(false);
  });

  test('no name or no content → false', () => {
    expect(mentionsName('@Moksh', null)).toBe(false);
    expect(mentionsName('@Moksh', '  ')).toBe(false);
    expect(mentionsName(null, 'Moksh')).toBe(false);
  });
});

describe('chatAgo', () => {
  const now = new Date('2026-11-28T12:00:00Z');

  test.each([
    ['2026-11-28T11:59:30Z', 'chat.agoNow', {}],
    ['2026-11-28T11:48:00Z', 'chat.agoMinutes', { n: 12 }],
    ['2026-11-28T09:00:00Z', 'chat.agoHours', { n: 3 }],
    ['2026-11-24T12:00:00Z', 'chat.agoDays', { n: 4 }],
  ])('%s → %s', (at, key, params) => {
    const copy = chatAgo(at, now);
    expect(copy.key).toBe(key);
    expect(copy.params).toEqual(params);
  });

  test('days read "{{n}}D ago"', () => {
    expect(chatAgo('2026-11-24T12:00:00Z', now).defaultValue).toBe('{{n}}D ago');
  });

  test('missing timestamp → null', () => {
    expect(chatAgo(null, now)).toBeNull();
    expect(chatAgo('nope', now)).toBeNull();
  });
});

describe('defaultChatTab', () => {
  test('alliance members open on ALLIANCE, others on GLOBAL', () => {
    expect(defaultChatTab({ hasAlliance: true })).toBe('alliance');
    expect(defaultChatTab({ hasAlliance: false })).toBe('global');
  });

  test('an explicit request wins; legacy "city" reads as global', () => {
    expect(defaultChatTab({ requested: 'alliance', hasAlliance: false })).toBe('alliance');
    expect(defaultChatTab({ requested: 'city', hasAlliance: true })).toBe('global');
    expect(defaultChatTab({ requested: 'global', hasAlliance: true })).toBe('global');
  });
});
