// lib/chatRealtime.js
// Ably realtime client connection helpers for chat. Pure JS (no native module
// addition; no EAS rebuild required). Token-auth via backend POST /chat/ably-token.

import * as Ably from 'ably';
import { getAblyToken } from './chatApi';

let activeRealtime = null;

export async function connectChatRealtime({ clerkGetToken }) {
  if (activeRealtime) {
    return activeRealtime;
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
  return { ok: true, realtime, channels: tokenResult.data.channels };
}

export function subscribeToChannel(realtime, channelName, onMessage) {
  if (!realtime) return () => undefined;
  const channel = realtime.channels.get(channelName);
  const handler = (message) => {
    try {
      onMessage(message.data);
    } catch (err) {
      console.warn('[chatRealtime] onMessage threw', err?.message ?? err);
    }
  };
  channel.subscribe('chat:message', handler);
  return () => {
    try {
      channel.unsubscribe('chat:message', handler);
    } catch (err) {
      console.warn('[chatRealtime] unsubscribe failed', err?.message ?? err);
    }
  };
}

export function disconnectChatRealtime() {
  if (activeRealtime) {
    try {
      activeRealtime.close();
    } catch (err) {
      console.warn('[chatRealtime] close failed', err?.message ?? err);
    }
    activeRealtime = null;
  }
}
