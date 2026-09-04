const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(
  path.join(__dirname, '..', 'chatPresence.js'),
  'utf8',
).replace(/^export\s+/gm, '');

let setVisibleChatRoom, clearVisibleChatRoom, getVisibleChatRoom, isChatRoomVisible;

beforeEach(() => {
  const ctx = {};
  new Function(
    'ctx',
    SRC +
      '\nctx.setVisibleChatRoom = setVisibleChatRoom;' +
      '\nctx.clearVisibleChatRoom = clearVisibleChatRoom;' +
      '\nctx.getVisibleChatRoom = getVisibleChatRoom;' +
      '\nctx.isChatRoomVisible = isChatRoomVisible;',
  )(ctx);
  ({
    setVisibleChatRoom,
    clearVisibleChatRoom,
    getVisibleChatRoom,
    isChatRoomVisible,
  } = ctx);
});

describe('chatPresence', () => {
  test('starts with no visible room', () => {
    expect(getVisibleChatRoom()).toBeNull();
    expect(isChatRoomVisible('r-1')).toBe(false);
  });

  test('set then read', () => {
    setVisibleChatRoom('r-1');
    expect(getVisibleChatRoom()).toBe('r-1');
    expect(isChatRoomVisible('r-1')).toBe(true);
    expect(isChatRoomVisible('r-2')).toBe(false);
  });

  test('a falsy roomId clears rather than storing junk', () => {
    setVisibleChatRoom('r-1');
    setVisibleChatRoom(undefined);
    expect(getVisibleChatRoom()).toBeNull();
  });

  test('clear only clears the room that owns presence', () => {
    setVisibleChatRoom('r-1');
    // Late blur from a room the player already left must not wipe the new one.
    clearVisibleChatRoom('r-old');
    expect(getVisibleChatRoom()).toBe('r-1');
    clearVisibleChatRoom('r-1');
    expect(getVisibleChatRoom()).toBeNull();
  });

  test('clear with no roomId is an unconditional reset', () => {
    setVisibleChatRoom('r-1');
    clearVisibleChatRoom();
    expect(getVisibleChatRoom()).toBeNull();
  });

  test('isChatRoomVisible is false for a null/undefined roomId even when a room is visible', () => {
    setVisibleChatRoom('r-1');
    expect(isChatRoomVisible(null)).toBe(false);
    expect(isChatRoomVisible(undefined)).toBe(false);
  });
});
