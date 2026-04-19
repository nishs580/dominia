import { useAuth } from '@clerk/clerk-expo';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { supabase } from '../lib/supabase';

export default function AuthGate({ navigation }) {
  const { isSignedIn, isLoaded, userId } = useAuth();
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);

  const showSpinner = !isLoaded || (isSignedIn && (!userId || checkingOnboarding));

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      navigation.replace('SignIn');
    }
  }, [isLoaded, isSignedIn]);

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
      const { data, error } = await supabase
        .from('players')
        .select('has_onboarded')
        .eq('clerk_id', userId)
        .maybeSingle();

      if (cancelled) return;

      setCheckingOnboarding(false);

      if (error) {
        console.error('AuthGate has_onboarded check failed:', error);
        navigation.replace('Onboarding');
        return;
      }

      if (data?.has_onboarded === true) {
        navigation.replace('MainTabs');
      } else {
        navigation.replace('Onboarding');
      }
    }

    runGate();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, userId, navigation]);

  return (
    <View style={{ flex: 1, backgroundColor: '#0D0D0D', alignItems: 'center', justifyContent: 'center' }}>
      {showSpinner ? <ActivityIndicator color="#FF6B35" /> : null}
    </View>
  );
}
