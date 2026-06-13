import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useAuth } from '@clerk/clerk-expo';

const INK = '#0E1014';
const BONE = '#F2EEE6';
const SLATE = '#5C6068';
const SLATE2 = '#8B8F98';
const CLAIM = '#D64525';
const HAIRLINE_STRONG = 'rgba(242,238,230,0.16)';

export default function SessionMismatchScreen({ navigation }) {
  const { signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  const onSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut();
      navigation.replace('AuthGate');
    } catch (err) {
      console.error('SessionMismatch signOut failed:', err);
      setSigningOut(false);
    }
  };

  const onRetry = () => {
    navigation.replace('AuthGate');
  };

  return (
    <View style={{ flex: 1, backgroundColor: INK, paddingHorizontal: 18, paddingTop: 48, paddingBottom: 24 }}>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Text style={{ fontFamily: 'GeistMono_400Regular', fontSize: 9, letterSpacing: 1.6, color: SLATE2, textTransform: 'uppercase', marginBottom: 8 }}>
          Session error
        </Text>
        <Text style={{ fontFamily: 'Archivo_900Black', fontSize: 32, color: BONE, textTransform: 'uppercase', letterSpacing: 0.7, lineHeight: 36 }}>
          {'Account\nnot found'}
        </Text>
        <View style={{ height: 0.5, backgroundColor: HAIRLINE_STRONG, marginTop: 18, marginBottom: 18 }} />
        <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 14, color: BONE, lineHeight: 22, marginBottom: 8 }}>
          Your sign-in does not match a player on this device.
        </Text>
        <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 14, color: SLATE2, lineHeight: 22 }}>
          Sign out to recover, or retry if you just signed up.
        </Text>
      </View>
      <View style={{ gap: 12 }}>
        <Pressable
          accessibilityRole="button"
          onPress={onSignOut}
          disabled={signingOut}
          style={({ pressed }) => [
            { backgroundColor: CLAIM, paddingVertical: 14, width: '100%', alignItems: 'center' },
            signingOut && { opacity: 0.5 },
            pressed && !signingOut && { opacity: 0.9 },
          ]}
        >
          <Text style={{ fontFamily: 'GeistMono_500Medium', fontSize: 14, letterSpacing: 2.4, color: BONE, textTransform: 'uppercase' }}>
            Sign out
          </Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onRetry}>
          <Text style={{ fontFamily: 'GeistMono_400Regular', fontSize: 11, color: SLATE, textTransform: 'uppercase', letterSpacing: 1.4, textAlign: 'center' }}>
            Retry
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
