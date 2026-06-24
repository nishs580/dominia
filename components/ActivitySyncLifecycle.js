import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useAuth } from '@clerk/clerk-expo';
import { bootstrapPlayer } from '../lib/meApi';
import * as producer from '../lib/activity';

export default function ActivitySyncLifecycle() {
  const { isLoaded, isSignedIn, userId, getToken } = useAuth();
  const [playerId, setPlayerId] = useState(null);
  const [hasOnboarded, setHasOnboarded] = useState(false);
  const startedRef = useRef(false);
  const getTokenRef = useRef(getToken);

  useEffect(() => {
    getTokenRef.current = getToken;
  });

  useEffect(() => {
    let cancelled = false;
    if (!isLoaded || !isSignedIn || !userId) {
      setPlayerId(null);
      setHasOnboarded(false);
      return;
    }
    (async () => {
      // Gate on the authoritative backend (idempotent /me/bootstrap) rather than
      // a direct Supabase read, which can fail under the RLS lockdown and would
      // silently disable activity sync for a legitimate onboarded player.
      const res = await bootstrapPlayer({ clerkGetToken: () => getTokenRef.current() });
      if (cancelled) return;
      if (!res.ok || !res.data?.player?.id) {
        setPlayerId(null);
        setHasOnboarded(false);
        return;
      }
      setPlayerId(res.data.player.id);
      setHasOnboarded(res.data.player.has_onboarded === true);
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, userId]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !userId || !playerId || !hasOnboarded) {
      if (startedRef.current) {
        producer.stop();
        startedRef.current = false;
      }
      return;
    }

    let appStateSub = null;
    let netInfoUnsub = null;

    (async () => {
      await producer.start(playerId, () => getTokenRef.current());
      startedRef.current = true;

      try {
        const state = await NetInfo.fetch();
        producer.onNetworkChange({ isConnected: state.isConnected });
      } catch (_) {
        /* NetInfo optional until native dep wired in 3a-3 */
      }

      appStateSub = AppState.addEventListener('change', (next) => {
        producer.onAppStateChange(next);
      });
      netInfoUnsub = NetInfo.addEventListener((state) => {
        producer.onNetworkChange({ isConnected: state.isConnected });
      });
    })();

    return () => {
      if (appStateSub) appStateSub.remove();
      if (netInfoUnsub) netInfoUnsub();
      if (startedRef.current) {
        producer.stop();
        startedRef.current = false;
      }
    };
  }, [isLoaded, isSignedIn, userId, playerId, hasOnboarded]);

  return null;
}
