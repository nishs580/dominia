import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@clerk/clerk-expo';
import { supabase } from '../lib/supabase';
import { registerFcmToken } from '../lib/fcm';

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

    return () => {
      unsubscribe();
    };
  }, [isLoaded, isSignedIn, userId, hasOnboarded]);

  return null;
}
