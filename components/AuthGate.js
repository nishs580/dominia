import { useAuth } from '@clerk/clerk-expo';
import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';

export default function AuthGate({ navigation }) {
  const { isSignedIn, isLoaded } = useAuth();

  useEffect(() => {
    if (!isLoaded) return;
    if (isSignedIn) {
      navigation.replace('MainTabs');
    } else {
      navigation.replace('SignIn');
    }
  }, [isLoaded, isSignedIn]);

  return (
    <View style={{ flex: 1, backgroundColor: '#0D0D0D', alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color="#FF6B35" />
    </View>
  );
}
