import { useSignIn, useSignUp } from '@clerk/clerk-expo';
import { useFonts, Archivo_900Black } from '@expo-google-fonts/archivo';
import { GeistMono_400Regular } from '@expo-google-fonts/geist-mono';
import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { ensurePlayer } from '../lib/auth';

export default function SignInScreen({ navigation }) {
  const { signIn, setActive: setActiveSignIn, isLoaded: signInLoaded } = useSignIn();
  const { signUp, setActive: setActiveSignUp, isLoaded: signUpLoaded } = useSignUp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [mode, setMode] = useState('signin');
  const [loading, setLoading] = useState(false);

  const [fontsLoaded] = useFonts({ Archivo_900Black, GeistMono_400Regular });
  if (!fontsLoaded) return null;

  const handleSignIn = async () => {
    if (!signInLoaded) return;
    setLoading(true);
    setError('');
    try {
      const result = await signIn.create({ identifier: email, password });
      await setActiveSignIn({ session: result.createdSessionId });
      const userId = result.createdSessionId ? signIn.createdUserId : null;
      const { needsUsername } = await ensurePlayer(userId, email);
      navigation.replace(needsUsername ? 'Username' : 'MainTabs');
    } catch (err) {
      setError(err.errors?.[0]?.message ?? 'Sign in failed. Check your email and password.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (!signUpLoaded) return;
    setLoading(true);
    setError('');
    try {
      const result = await signUp.create({ emailAddress: email, password });
      await setActiveSignUp({ session: result.createdSessionId });
      const { needsUsername, player } = await ensurePlayer(result.createdUserId, email);
      navigation.replace(needsUsername ? 'Username' : 'Onboarding', { playerId: player?.id });
    } catch (err) {
      setError(err.errors?.[0]?.message ?? 'Sign up failed. Try a different email.');
    } finally {
      setLoading(false);
    }
  };

  const isSignIn = mode === 'signin';

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Text style={styles.title}>DOMINIA <Text style={styles.claimMark}>■</Text></Text>
      <Text style={styles.subtitle}>Walk. Claim. Conquer. Defend.</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#6B7280"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor="#6B7280"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        style={[styles.button, loading && { opacity: 0.7 }]}
        onPress={isSignIn ? handleSignIn : handleSignUp}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Please wait...' : isSignIn ? 'Sign In' : 'Create Account'}
        </Text>
      </Pressable>

      <Pressable
        style={styles.toggleButton}
        onPress={() => { setMode(isSignIn ? 'signup' : 'signin'); setError(''); }}
      >
        <Text style={styles.toggleText}>
          {isSignIn ? "Don't have an account? " : 'Already have an account? '}
          <Text style={styles.toggleLink}>{isSignIn ? 'Sign Up' : 'Sign In'}</Text>
        </Text>
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0D0D0D',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontFamily: 'Archivo_900Black',
    color: '#F2F0EB',
    fontSize: 32,
    letterSpacing: -1,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  claimMark: {
    color: '#E83B3B',
    fontSize: 9,
  },
  subtitle: {
    fontFamily: 'GeistMono_400Regular',
    color: '#6B7280',
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 48,
  },
  input: {
    width: '100%',
    backgroundColor: '#1C1C1C',
    borderRadius: 0,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    color: '#F2F0EB',
    fontSize: 15,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
  },
  error: {
    color: '#E83B3B',
    fontSize: 13,
    marginBottom: 12,
    textAlign: 'center',
  },
  button: {
    width: '100%',
    backgroundColor: '#E83B3B',
    borderRadius: 0,
    paddingVertical: 16,
  },
  buttonText: {
    fontFamily: 'Archivo_900Black',
    color: '#F2F0EB',
    fontSize: 15,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  toggleButton: {
    marginTop: 24,
  },
  toggleText: {
    color: '#6B7280',
    fontSize: 13,
  },
  toggleLink: {
    color: '#E83B3B',
    fontFamily: 'Archivo_900Black',
  },
});
