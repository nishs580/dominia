import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@clerk/clerk-expo';
import { supabase } from '../lib/supabase';
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
import { patchMe } from '../lib/meApi';
import i18n from '../i18n';

export default function FcmLifecycle() {
  const { isLoaded, isSignedIn, userId, getToken } = useAuth();
  const [hasOnboarded, setHasOnboarded] = useState(null);

  useEffect(() => {
    let cancelled = false;

    if (!isLoaded || !isSignedIn || !userId) {
      setHasOnboarded(null);
      return;
    }

    (async () => {
      const { data, error } = await supabase
        .from('players')
        .select('has_onboarded')
        .eq('clerk_id', userId)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        console.error('AuthGate has_onboarded check failed:', error);
        setHasOnboarded(false);
        return;
      }

      setHasOnboarded(data?.has_onboarded === true);
    })();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, userId]);

  const getTokenRef = useRef(getToken);
  useEffect(() => {
    getTokenRef.current = getToken;
  }, [getToken]);

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

    // Sync the device language to the backend so server-composed push
    // notifications are translated to the player's locale. Fire-and-forget —
    // patchMe never throws and resolves to an { ok } discriminant we ignore.
    patchMe({
      clerkGetToken: () => getTokenRef.current(),
      fields: { locale: i18n.language },
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
        showCard({ kind, data: cardData, target: route.target, params: route.params });
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
