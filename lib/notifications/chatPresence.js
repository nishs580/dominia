// Which chat room the player is looking at right now, if any.
//
// ChatScreen owns the answer (its room follows an internal tab that route
// params can't see), so it publishes here on focus / tab change and clears on
// blur. FcmLifecycle reads it to suppress the chat push toast for the room
// already on screen — the live Ably message has already rendered, and a toast
// over the top of it is pure noise.
//
// Module-level rather than context: FcmLifecycle mounts above NavigationContainer
// and must stay decoupled from the screen tree.

let visibleChatRoomId = null;

export function setVisibleChatRoom(roomId) {
  visibleChatRoomId = roomId || null;
}

export function clearVisibleChatRoom(roomId) {
  // Guarded clear: a blur that lands after another room has already claimed
  // presence must not wipe the newer value.
  if (!roomId || visibleChatRoomId === roomId) {
    visibleChatRoomId = null;
  }
}

export function getVisibleChatRoom() {
  return visibleChatRoomId;
}

export function isChatRoomVisible(roomId) {
  return Boolean(roomId) && visibleChatRoomId === roomId;
}
