import { useAuth } from '@clerk/clerk-expo';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator, Pressable, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';

// Onboarding check is a trivial indexed lookup, so a slow response means the
// network path (e.g. a Cloudflare 522 to the Supabase origin) is stalling, not
// the query. Bound each attempt and retry transient failures a few times before
// falling through to the manual retry screen.
const MAX_ATTEMPTS = 3;
const ATTEMPT_TIMEOUT_MS = 8000;
const RETRY_BACKOFF_MS = [500, 1500];

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function isTransient(error) {
  if (!error) return false;
  if (error.name === 'AbortError') return true;
  const msg = String(error.message || error).toLowerCase();
  return (
    msg.includes('abort') ||
    msg.includes('timeout') ||
    msg.includes('timed out') ||
    msg.includes('network') ||
    msg.includes('fetch failed') ||
    msg.includes('failed to fetch') ||
    msg.includes('gateway') ||
    // Cloudflare edge/origin errors: 502 Bad Gateway, 503, 504, 520-524
    /\b(50[234]|52[0-4])\b/.test(msg)
  );
}

export default function AuthGate({ navigation }) {
  const { t } = useTranslation();
  const { isSignedIn, isLoaded, userId, getToken } = useAuth();
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);
  const [gateError, setGateError] = useState(null);
  const [retryNonce, setRetryNonce] = useState(0);

  const showSpinner = !isLoaded || (isSignedIn && (!userId || checkingOnboarding));

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      navigation.replace('SignIn');
    }
  }, [isLoaded, isSignedIn]);

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
      navigation.replace('SignIn');
      return;
    }

    if (!userId) return;

    let cancelled = false;

    async function runGate() {
      setCheckingOnboarding(true);
      setGateError(null);

      let lastError = null;

      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        if (cancelled) return;
        if (attempt > 0) {
          await delay(RETRY_BACKOFF_MS[attempt - 1] ?? 1500);
          if (cancelled) return;
        }

        let data = null;
        let error = null;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), ATTEMPT_TIMEOUT_MS);
        try {
          const res = await supabase
            .from('players')
            .select('id, has_onboarded')
            .eq('clerk_id', userId)
            .abortSignal(controller.signal)
            .maybeSingle();
          data = res.data;
          error = res.error;
        } catch (e) {
          error = e;
        } finally {
          clearTimeout(timer);
        }

        if (cancelled) return;

        if (!error) {
          setCheckingOnboarding(false);
          if (!data) {
            navigation.replace('SessionMismatch');
            return;
          }
          if (data.has_onboarded === true) {
            navigation.replace('MainTabs');
          } else {
            navigation.replace('Onboarding', { playerId: data.id });
          }
          return;
        }

        lastError = error;
        // Non-transient errors (e.g. auth/permission) won't fix themselves —
        // fail fast to the retry screen instead of burning attempts.
        if (!isTransient(error)) break;
        console.warn(
          `AuthGate onboarding check attempt ${attempt + 1}/${MAX_ATTEMPTS} failed (transient), retrying:`,
          error?.message || error,
        );
      }

      if (cancelled) return;
      setCheckingOnboarding(false);
      console.error('AuthGate runGate failed after retries:', lastError);
      setGateError(lastError);
    }

    runGate();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, userId, navigation, retryNonce]);

  return (
    <View style={{ flex: 1, backgroundColor: '#0D0D0D', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
      {gateError ? (
        <>
          <Text style={{ fontFamily: 'GeistMono_400Regular', fontSize: 9, letterSpacing: 1.6, color: '#8B8F98', textTransform: 'uppercase', marginBottom: 12 }}>
            {t('authGate.connectionError')}
          </Text>
          <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 14, color: '#F2EEE6', textAlign: 'center', marginBottom: 24 }}>
            {t('authGate.couldNotCheckSession')}
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
              {t('common.retry')}
            </Text>
          </Pressable>
        </>
      ) : showSpinner ? (
        <ActivityIndicator color="#D64525" />
      ) : null}
    </View>
  );
}
