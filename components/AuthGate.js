import { useAuth } from '@clerk/clerk-expo';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator, Pressable, Text } from 'react-native';
import { bootstrapPlayer } from '../lib/meApi';
import { logDebug } from '../lib/debug';

export default function AuthGate({ navigation }) {
  const { isSignedIn, isLoaded, userId, getToken } = useAuth();
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);
  const [gateError, setGateError] = useState(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const [slowConnect, setSlowConnect] = useState(false);

  const showSpinner = !isLoaded || (isSignedIn && (!userId || checkingOnboarding));

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      navigation.replace('Welcome');
    }
  }, [isLoaded, isSignedIn]);

  // The first authenticated request hits the backend's bootstrap, which can be
  // a Railway cold start (several seconds). After a short wait, reassure the
  // player the app isn't stuck rather than leaving a bare spinner.
  useEffect(() => {
    if (!showSpinner) {
      setSlowConnect(false);
      return;
    }
    const t = setTimeout(() => setSlowConnect(true), 4000);
    return () => clearTimeout(t);
  }, [showSpinner]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    (async () => {
      const token = await getToken();
      if (cancelled) return;
      if (__DEV__) {
        console.log('[DEV JWT]', token);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, getToken]);

  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      setCheckingOnboarding(false);
      navigation.replace('Welcome');
      return;
    }

    if (!userId) return;

    let cancelled = false;

    async function runGate() {
      setCheckingOnboarding(true);
      setGateError(null);

      // Gate on the backend bootstrap rather than a direct Supabase read.
      // /me/bootstrap is idempotent: it creates the player row if missing and
      // returns the existing one otherwise, so a freshly-signed-up user can
      // never fall into the "account not found" dead-end on the new-signup race
      // (and it stays correct under the RLS lockdown, which removes client reads).
      const res = await bootstrapPlayer({ clerkGetToken: getToken });

      if (cancelled) return;

      setCheckingOnboarding(false);

      if (!res.ok) {
        console.error('AuthGate bootstrap failed:', res.status, res.error);
        setGateError(res.error || 'bootstrap_failed');
        return;
      }

      const { player, needsUsername } = res.data;

      const destination = needsUsername
        ? 'username'
        : player?.has_onboarded === true
          ? 'maintabs'
          : 'onboarding';
      logDebug(player?.id, 'onboarding_gate_resolved', { destination, needsUsername });

      if (needsUsername) {
        navigation.replace('Username', { playerId: player?.id });
        return;
      }

      if (player?.has_onboarded === true) {
        navigation.replace('MainTabs');
      } else {
        navigation.replace('Onboarding', { playerId: player?.id });
      }
    }

    runGate();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, userId, navigation, retryNonce, getToken]);

  return (
    <View style={{ flex: 1, backgroundColor: '#0D0D0D', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
      {gateError ? (
        <>
          <Text style={{ fontFamily: 'GeistMono_400Regular', fontSize: 9, letterSpacing: 1.6, color: '#8B8F98', textTransform: 'uppercase', marginBottom: 12 }}>
            Connection error
          </Text>
          <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 14, color: '#F2EEE6', textAlign: 'center', marginBottom: 24 }}>
            Could not check your session. Please retry.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => setRetryNonce((n) => n + 1)}
            style={({ pressed }) => [
              { backgroundColor: '#D64525', paddingVertical: 14, paddingHorizontal: 32 },
              pressed && { opacity: 0.9 },
            ]}
          >
            <Text style={{ fontFamily: 'GeistMono_500Medium', fontSize: 14, letterSpacing: 2.4, color: '#F2EEE6', textTransform: 'uppercase' }}>
              Retry
            </Text>
          </Pressable>
        </>
      ) : showSpinner ? (
        <>
          <ActivityIndicator color="#FF6B35" />
          {slowConnect ? (
            <Text style={{ fontFamily: 'GeistMono_400Regular', fontSize: 11, color: '#8B8F98', textTransform: 'uppercase', letterSpacing: 1.4, marginTop: 16, textAlign: 'center' }}>
              Waking the server…
            </Text>
          ) : null}
        </>
      ) : null}
    </View>
  );
}
