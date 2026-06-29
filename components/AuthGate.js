import { useAuth } from '@clerk/clerk-expo';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator, Pressable, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';

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

      const { data, error } = await supabase
        .from('players')
        .select('id, has_onboarded')
        .eq('clerk_id', userId)
        .maybeSingle();

      if (cancelled) return;

      setCheckingOnboarding(false);

      if (error) {
        console.error('AuthGate runGate failed:', error);
        setGateError(error);
        return;
      }

      if (!data) {
        navigation.replace('SessionMismatch');
        return;
      }

      if (data.has_onboarded === true) {
        navigation.replace('MainTabs');
      } else {
        navigation.replace('Onboarding', { playerId: data.id });
      }
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
        <ActivityIndicator color="#FF6B35" />
      ) : null}
    </View>
  );
}
