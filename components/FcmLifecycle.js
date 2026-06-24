import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@clerk/clerk-expo';
import { bootstrapPlayer } from '../lib/meApi';
import Toast from 'react-native-toast-message';
import {
  registerFcmToken,
  onForegroundMessage,
  onBackgroundTap,
  getInitialPushPayload,
} from '../lib/fcm';
import { routeForPush, SURFACES } from '../lib/notifications/route';
import { showCard } from '../lib/notifications/cardController';
import { navigateTo, navigateToAfterAuthGate } from '../lib/navigation';

export default function FcmLifecycle() {
  const { isLoaded, isSignedIn, userId, getToken } = useAuth();
  const [hasOnboarded, setHasOnboarded] = useState(null);

  const getTokenRef = useRef(getToken);
  useEffect(() => {
    getTokenRef.current = getToken;
  }, [getToken]);

  useEffect(() => {
    let cancelled = false;

    if (!isLoaded || !isSignedIn || !userId) {
      setHasOnboarded(null);
      return;
    }

    (async () => {
      // Gate on the authoritative backend (idempotent /me/bootstrap) rather than
      // a direct Supabase read, which can fail under the RLS lockdown and would
      // silently disable push registration for a legitimate onboarded player.
      const res = await bootstrapPlayer({ clerkGetToken: () => getTokenRef.current() });

      if (cancelled) return;

      if (!res.ok) {
        console.error('FcmLifecycle onboarding check failed:', res.status, res.error);
        setHasOnboarded(false);
        return;
      }

      setHasOnboarded(res.data?.player?.has_onboarded === true);
    })();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, userId]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !userId || hasOnboarded !== true) {
      return;
    }

    let unsubscribe = () => {};

    registerFcmToken({ clerkGetToken: () => getTokenRef.current() })
      .then((unsub) => {
        unsubscribe = unsub;
      })
      .catch((err) => {
        console.warn('[fcm] lifecycle register failed:', err?.message);
      });

    return () => {
      unsubscribe();
    };
  }, [isLoaded, isSignedIn, userId, hasOnboarded]);

  // Effect 3 — foreground push (app open).
  useEffect(() => {
    const unsubscribe = onForegroundMessage((remoteMessage) => {
      const kind = remoteMessage?.data?.kind;
      const route = routeForPush(kind, remoteMessage?.data);
      const title = remoteMessage?.notification?.title || remoteMessage?.data?.title || '';
      const body = remoteMessage?.notification?.body || remoteMessage?.data?.body || '';
      const cardData = { ...(remoteMessage?.data || {}), title, body };

      if (route.surface === SURFACES.CARD) {
        showCard({ kind, data: cardData, target: route.target });
      } else if (route.surface === SURFACES.TOAST) {
        Toast.show({
          type: 'info',
          text1: title,
          text2: body,
          position: 'top',
          onPress: () => navigateTo(route.target, route.params),
        });
      } else if (route.surface === SURFACES.BANNER_ROUTE) {
        // Banner component not yet built; interim is a longer toast with tap-route.
        Toast.show({
          type: 'info',
          text1: title,
          text2: body,
          position: 'top',
          visibilityTime: 8000,
          onPress: () => navigateTo(route.target, route.params),
        });
      }
    });
    return unsubscribe;
  }, []);

  // Effect 4 — background tap (app backgrounded, user taps the OS notification).
  useEffect(() => {
    const unsubscribe = onBackgroundTap((remoteMessage) => {
      const kind = remoteMessage?.data?.kind;
      const route = routeForPush(kind, remoteMessage?.data);
      navigateTo(route.target, route.params);
    });
    return unsubscribe;
  }, []);

  // Effect 5 — killed-state cold-start (app launched by tapping notification).
  useEffect(() => {
    let cancelled = false;
    getInitialPushPayload().then((remoteMessage) => {
      if (cancelled || !remoteMessage) return;
      const kind = remoteMessage?.data?.kind;
      const route = routeForPush(kind, remoteMessage?.data);
      navigateToAfterAuthGate(route.target, route.params); // navigateToAfterAuthGate defers until current route is MainTabs (race-safe vs AuthGate.replace)
    });
    return () => { cancelled = true; };
  }, []);

  return null;
}
