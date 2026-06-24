import { useSignIn, useSignUp, useSSO } from '@clerk/clerk-expo';
import { useFonts, Archivo_900Black } from '@expo-google-fonts/archivo';
import { GeistMono_400Regular } from '@expo-google-fonts/geist-mono';
import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { logDebug } from '../lib/debug';

// Required for the OAuth redirect to close the in-app browser and hand control
// back to the app once Google completes.
WebBrowser.maybeCompleteAuthSession();

// Warming the browser up front makes the Android OAuth tab open noticeably
// faster — Clerk's recommended pattern for Expo.
function useWarmUpBrowser() {
  useEffect(() => {
    void WebBrowser.warmUpAsync();
    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);
}

export default function SignInScreen({ navigation, route }) {
  useWarmUpBrowser();
  const { signIn, setActive: setActiveSignIn, isLoaded: signInLoaded } = useSignIn();
  const { signUp, setActive: setActiveSignUp, isLoaded: signUpLoaded } = useSignUp();
  const { startSSOFlow } = useSSO();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  // Welcome routes here with mode 'signup' (Get started) or 'signin' (the
  // returning-user shortcut); default to sign-in for any direct entry.
  const [mode, setMode] = useState(route?.params?.mode === 'signup' ? 'signup' : 'signin');
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [pendingVerification, setPendingVerification] = useState(false);
  const [code, setCode] = useState('');
  const [resending, setResending] = useState(false);

  const [fontsLoaded] = useFonts({ Archivo_900Black, GeistMono_400Regular });
  if (!fontsLoaded) return null;

  // After auth, hand off to AuthGate — the single source of truth for routing.
  // It bootstraps the player (idempotent) and sends them to Username, Onboarding
  // or MainTabs based on the authoritative server record, so this screen never
  // has to guess and the two paths can't disagree.
  const goToGate = () => navigation.replace('AuthGate');

  const handleGoogle = async () => {
    if (oauthLoading) return;
    setOauthLoading(true);
    setError('');
    logDebug(null, 'onboarding_signup_started', { method: 'google' });
    try {
      // Clerk handles both sign-in and sign-up through one OAuth flow: a new
      // Google account creates the Clerk user, an existing one signs in. Either
      // way AuthGate bootstraps the player row afterwards.
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: 'oauth_google',
        redirectUrl: AuthSession.makeRedirectUri(),
      });
      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
        logDebug(null, 'onboarding_auth_completed', { method: 'google' });
        goToGate();
      }
      // No session and no throw means the user dismissed the browser — stay put,
      // no error.
    } catch (err) {
      setError(err.errors?.[0]?.message ?? 'Google sign-in failed. Try again.');
    } finally {
      setOauthLoading(false);
    }
  };

  const handleSignIn = async () => {
    if (!signInLoaded) return;
    setLoading(true);
    setError('');
    try {
      const result = await signIn.create({ identifier: email, password });
      if (result.status !== 'complete') {
        setError('Additional verification is required. Please try again.');
        return;
      }
      await setActiveSignIn({ session: result.createdSessionId });
      goToGate();
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
    logDebug(null, 'onboarding_signup_started', { method: 'email' });
    try {
      const result = await signUp.create({ emailAddress: email, password });
      if (result.status === 'complete') {
        // Email verification is disabled on this Clerk instance — straight in.
        await setActiveSignUp({ session: result.createdSessionId });
        logDebug(null, 'onboarding_auth_completed', { method: 'email' });
        goToGate();
        return;
      }
      // Verification required: send the code and switch to the code-entry view.
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      logDebug(null, 'onboarding_email_verification_sent', {});
      setPendingVerification(true);
    } catch (err) {
      setError(err.errors?.[0]?.message ?? 'Sign up failed. Try a different email.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!signUpLoaded) return;
    if (code.trim().length < 6) {
      setError('Enter the 6-digit code from your email.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await signUp.attemptEmailAddressVerification({ code: code.trim() });
      if (result.status !== 'complete') {
        setError('That code didn’t work. Check your email and try again.');
        return;
      }
      await setActiveSignUp({ session: result.createdSessionId });
      logDebug(null, 'onboarding_auth_completed', { method: 'email' });
      goToGate();
    } catch (err) {
      setError(err.errors?.[0]?.message ?? 'That code didn’t work. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!signUpLoaded || resending) return;
    setResending(true);
    setError('');
    try {
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
    } catch (err) {
      setError(err.errors?.[0]?.message ?? 'Could not resend the code. Try again.');
    } finally {
      setResending(false);
    }
  };

  const resetToForm = () => {
    setPendingVerification(false);
    setCode('');
    setError('');
  };

  const isSignIn = mode === 'signin';

  if (pendingVerification) {
    return (
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Text style={styles.title}>DOMINIA <Text style={styles.claimMark}>■</Text></Text>
        <Text style={styles.subtitle}>Verify your email</Text>

        <Text style={styles.hint}>
          We sent a 6-digit code to {email || 'your email'}.
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Verification code"
          placeholderTextColor="#6B7280"
          keyboardType="number-pad"
          autoCapitalize="none"
          textContentType="oneTimeCode"
          maxLength={6}
          value={code}
          onChangeText={setCode}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          style={[styles.button, loading && { opacity: 0.7 }]}
          onPress={handleVerify}
          disabled={loading}
        >
          <Text style={styles.buttonText}>{loading ? 'Verifying...' : 'Verify'}</Text>
        </Pressable>

        <Pressable style={styles.toggleButton} onPress={handleResend} disabled={resending}>
          <Text style={styles.toggleText}>
            {resending ? 'Sending...' : 'Didn’t get it? '}
            {!resending ? <Text style={styles.toggleLink}>Resend code</Text> : null}
          </Text>
        </Pressable>

        <Pressable style={styles.toggleButton} onPress={resetToForm}>
          <Text style={styles.toggleText}>
            <Text style={styles.toggleLink}>Use a different email</Text>
          </Text>
        </Pressable>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Text style={styles.title}>DOMINIA <Text style={styles.claimMark}>■</Text></Text>
      <Text style={styles.subtitle}>Walk. Claim. Conquer. Defend.</Text>

      <Pressable
        style={[styles.googleButton, oauthLoading && { opacity: 0.7 }]}
        onPress={handleGoogle}
        disabled={oauthLoading || loading}
      >
        <Text style={styles.googleMark}>G</Text>
        <Text style={styles.googleButtonText}>
          {oauthLoading ? 'Connecting...' : 'Continue with Google'}
        </Text>
      </Pressable>

      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>or</Text>
        <View style={styles.dividerLine} />
      </View>

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
        disabled={loading || oauthLoading}
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
  hint: {
    fontFamily: 'GeistMono_400Regular',
    color: '#9CA3AF',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: 24,
  },
  googleButton: {
    width: '100%',
    backgroundColor: '#F2F0EB',
    borderRadius: 0,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  googleMark: {
    fontFamily: 'Archivo_900Black',
    color: '#1C1C1C',
    fontSize: 16,
  },
  googleButtonText: {
    fontFamily: 'Archivo_900Black',
    color: '#1C1C1C',
    fontSize: 15,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  divider: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#2A2A2A',
  },
  dividerText: {
    fontFamily: 'GeistMono_400Regular',
    color: '#6B7280',
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
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
