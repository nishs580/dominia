/**
 * lib/__tests__/chatSender.test.js
 *
 * Figma Chat sender line (plan 2026-11-27 U13, G9/G10).
 */

const { roleCopy, chatSenderLine, chatSubheader } = require('../chatSender');

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

describe('chatSenderLine — Global', () => {
  test('a player with a tag and role reads "RAVI · JIC TROOP"', () => {
    const line = chatSenderLine({ sender_id: 'p2', sender_name: 'Ravi', sender_alliance_short_name: 'JIC', role: 'MEMBER' });
    expect(line.text).toBe('RAVI · JIC TROOP');
    expect(line.tone).toBe('other');
  });

  test('a player with no alliance reads SOLO PLAYER', () => {
    const line = chatSenderLine({ sender_id: 'p3', sender_name: 'neha_p', sender_alliance_short_name: null, role: null });
    expect(line.text).toBe('NEHA_P · SOLO PLAYER');
  });

  test('a tag without a role (older backend) shows the tag alone', () => {
    expect(chatSenderLine({ sender_name: 'Mr_ABC', sender_alliance_short_name: 'OP' }).text).toBe('MR_ABC · OP');
  });

  test('your own message reads YOU and is lime', () => {
    const line = chatSenderLine(
      { sender_id: 'me', sender_name: 'kausthubh', sender_alliance_short_name: 'JIC', role: 'member' },
      { selfPlayerId: 'me' },
    );
    expect(line).toEqual({ text: 'YOU', tone: 'self', isSelf: true });
  });

  test('a player in your alliance is an ally (blue)', () => {
    const line = chatSenderLine(
      { sender_id: 'p9', sender_name: 'Ravi', sender_alliance_short_name: 'jic', role: 'founder' },
      { selfPlayerId: 'me', selfTag: 'JIC' },
    );
    expect(line.tone).toBe('ally');
    expect(line.text).toBe('RAVI · JIC CAPTAIN');
  });

  test('translations flow through t', () => {
    const t = (key, opts) => ({ 'chat.roleTroop': 'Боец', 'chat.soloPlayer': 'Одиночка' }[key] || opts.defaultValue);
    expect(chatSenderLine({ sender_name: 'Ravi', sender_alliance_short_name: 'JIC', role: 'member' }, { t }).text).toBe('RAVI · JIC БОЕЦ');
    expect(chatSenderLine({ sender_name: 'Neha' }, { t }).text).toBe('NEHA · ОДИНОЧКА');
  });
});

describe('chatSenderLine — Alliance', () => {
  test('allies show name and role, no tag, in blue', () => {
    const line = chatSenderLine(
      { sender_id: 'p2', sender_name: 'Ravi_K', sender_alliance_short_name: 'JIC', role: 'FOUNDER' },
      { channel: 'alliance', selfPlayerId: 'me' },
    );
    expect(line).toEqual({ text: 'RAVI_K · CAPTAIN', tone: 'ally', isSelf: false });
  });

  test('your optimistic echo reads "YOU · TROOP" from your own role', () => {
    const line = chatSenderLine(
      { sender_id: 'self', sender_name: 'You', _optimistic: true },
      { channel: 'alliance', selfRole: 'member' },
    );
    expect(line).toEqual({ text: 'YOU · TROOP', tone: 'self', isSelf: true });
  });
});

describe('chatSubheader', () => {
  test('name and online count', () => {
    expect(chatSubheader({ display_name: 'Bengaluru', online_count: 312 })).toBe('BENGALURU · 312 ONLINE');
  });

  test('name alone without a count; null without a name', () => {
    expect(chatSubheader({ display_name: 'Jalahalli Cult' })).toBe('JALAHALLI CULT');
    expect(chatSubheader({ online_count: 4 })).toBeNull();
    expect(chatSubheader(null)).toBeNull();
  });
});
