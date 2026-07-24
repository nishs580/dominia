// lib/chatRealtime.js
// Ably realtime client connection helpers for chat. Pure JS (no native module
// addition; no EAS rebuild required). Token-auth via backend POST /chat/ably-token.

import * as Ably from 'ably';
import { getAblyToken } from './chatApi';

let activeRealtime = null;
let activeResult = null;
// The connection is shared by chat and the live map. It is reference counted
// so that whichever screen unmounts first does not close the socket out from
// under the other — leaving ChatScreen used to take the map's subscription
// with it.
let refCount = 0;

export async function connectChatRealtime({ clerkGetToken }) {
  if (activeRealtime && activeResult) {
    refCount += 1;
    return activeResult;
  }

  const tokenResult = await getAblyToken({ clerkGetToken });
  if (!tokenResult.ok) {
    return { ok: false, code: tokenResult.code, context: tokenResult.context };
  }

  const realtime = new Ably.Realtime({
    authCallback: async (_tokenParams, callback) => {
      const refreshed = await getAblyToken({ clerkGetToken });
      if (refreshed.ok) {
        callback(null, refreshed.data.token_request);
      } else {
        callback(new Error('token_refresh_failed'), null);
      }
    },
    // Seed initial token so the connection establishes without a first-fetch round-trip.
    tokenDetails: undefined,
  });

  activeRealtime = realtime;
  refCount += 1;
  activeResult = {
    ok: true,
    realtime,
    channels: tokenResult.data.channels,
    // Live map channel for this player's city, named and authorised
    // server-side. Null when the city has no row yet — the map then simply
    // gets no live updates.
    mapChannel: tokenResult.data.map_channel ?? null,
  };
  return activeResult;
}

/**
 * Subscribe to one named event on a channel. Returns an unsubscribe function.
 * The connection itself is shared — chat and the live map ride the same
 * Ably client and the same token.
 */
export function subscribeToEvent(realtime, channelName, eventName, onMessage) {
  if (!realtime || !channelName) return () => undefined;
  const channel = realtime.channels.get(channelName);
  const handler = (message) => {
    try {
      onMessage(message.data);
    } catch (err) {
      console.warn('[chatRealtime] onMessage threw', err?.message ?? err);
    }
  };
  channel.subscribe(eventName, handler);
  return () => {
    try {
      channel.unsubscribe(eventName, handler);
    } catch (err) {
      console.warn('[chatRealtime] unsubscribe failed', err?.message ?? err);
    }
  };
}

export function subscribeToChannel(realtime, channelName, onMessage) {
  return subscribeToEvent(realtime, channelName, 'chat:message', onMessage);
}

export function disconnectChatRealtime() {
  refCount = Math.max(0, refCount - 1);
  if (refCount > 0) return;

  if (activeRealtime) {
    try {
      activeRealtime.close();
    } catch (err) {
      console.warn('[chatRealtime] close failed', err?.message ?? err);
    }
    activeRealtime = null;
    activeResult = null;
  }
}
