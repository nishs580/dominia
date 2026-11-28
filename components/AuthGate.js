import { useAuth } from '@clerk/clerk-expo';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator, Pressable, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { getFlag, useFlag } from '../lib/flags';
import { usesFigmaOnboarding, shouldShowReturningReward } from '../lib/onboardingFlow';
import { getDailyReward } from '../lib/dailyRewardApi';
import { navigationRef } from '../lib/navigation';
import SplashScreen from '../screens/SplashScreen';

// Onboarding check is a trivial indexed lookup, so a slow response means the
// network path (e.g. a Cloudflare 522 to the Supabase origin) is stalling, not
// the query. Bound each attempt and retry transient failures a few times before
// falling through to the manual retry screen.
const MAX_ATTEMPTS = 3;
const ATTEMPT_TIMEOUT_MS = 8000;
const RETRY_BACKOFF_MS = [500, 1500];

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Figma mode (plan U10): a returning player who finished onboarding sees
// Daily Rewards over the map when today's reward is unclaimed. Runs after the
// map is up, so a slow or failing reward check never delays launch; any
// failure means "don't show".
async function offerDailyReward(getToken) {
  const res = await getDailyReward({ clerkGetToken: getToken });
  if (!res.ok) return;
  if (!shouldShowReturningReward({ figma: usesFigmaOnboarding(getFlag), hasOnboarded: true, reward: res.data })) return;
  if (!navigationRef.isReady()) return;
  const state = navigationRef.getRootState();
  // Only over the map: a push deep link or another flow may have moved on.
  if (state?.routes?.[state.index]?.name !== 'MainTabs') return;
  navigationRef.navigate('DailyReward', { reward: res.data });
}

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
  const legacyTabs = useFlag('legacy_tabs');
  const figma = usesFigmaOnboarding(() => legacyTabs);

  const showSpinner = !isLoaded || (isSignedIn && (!userId || checkingOnboarding));

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      navigation.replace('Welcome');
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
      navigation.replace('Welcome');
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
            if (usesFigmaOnboarding(getFlag)) {
              offerDailyReward(getToken).catch(() => {});
            }
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
    <View style={{ flex: 1, backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
      {gateError ? (
        <>
          <Text style={{ fontFamily: 'IBMPlexSans_700Bold', fontSize: 11, letterSpacing: 1.6, color: 'rgba(253,253,253,0.62)', textTransform: 'uppercase', marginBottom: 12 }}>
            {t('authGate.connectionError')}
          </Text>
          <Text style={{ fontFamily: 'IBMPlexSans_500Medium', fontSize: 14, color: '#FDFDFD', textAlign: 'center', marginBottom: 24 }}>
            {t('authGate.couldNotCheckSession')}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => setRetryNonce((n) => n + 1)}
            style={({ pressed }) => [
              { backgroundColor: '#0731D1', paddingVertical: 14, paddingHorizontal: 32 },
              pressed && { opacity: 0.9 },
            ]}
          >
            <Text style={{ fontFamily: 'IBMPlexSans_600SemiBold', fontSize: 14, letterSpacing: 2.4, color: '#FDFDFD', textTransform: 'uppercase' }}>
              {t('common.retry')}
            </Text>
          </Pressable>
        </>
      ) : showSpinner ? (
        figma ? (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
            <SplashScreen />
          </View>
        ) : (
          <ActivityIndicator color="#84FF44" />
        )
      ) : null}
    </View>
  );
}
