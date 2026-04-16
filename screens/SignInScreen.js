import { useSignIn, useSignUp } from '@clerk/clerk-expo';
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

  const handleSignIn = async () => {
    if (!signInLoaded) return;
    setLoading(true);
    setError('');
    try {
      const result = await signIn.create({ identifier: email, password });
      await setActiveSignIn({ session: result.createdSessionId });
      const { needsUsername } = await ensurePlayer(result.createdUserId, email);
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
      const { needsUsername } = await ensurePlayer(result.createdUserId, email);
      navigation.replace(needsUsername ? 'Username' : 'MainTabs');
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
      <Text style={styles.title}>Dominia</Text>
      <Text style={styles.subtitle}>Walk. Claim. Conquer. Defend.</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#64748B"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor="#64748B"
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
    color: '#F2F0EB',
    fontSize: 48,
    fontWeight: '900',
    letterSpacing: -1,
    marginBottom: 8,
  },
  subtitle: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 48,
    letterSpacing: 0.5,
  },
  input: {
    width: '100%',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2E2E2E',
    color: '#F2F0EB',
    fontSize: 15,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
  },
  error: {
    color: '#E84040',
    fontSize: 13,
    marginBottom: 12,
    textAlign: 'center',
  },
  button: {
    width: '100%',
    backgroundColor: '#FF6B35',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  toggleButton: {
    marginTop: 24,
  },
  toggleText: {
    color: '#64748B',
    fontSize: 13,
  },
  toggleLink: {
    color: '#FF6B35',
    fontWeight: '900',
  },
});
