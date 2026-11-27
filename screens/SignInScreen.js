import { useSignIn, useSignUp, useAuth, useSSO } from '@clerk/clerk-expo';
import { useFonts, Archivo_900Black_Italic } from '@expo-google-fonts/archivo';
import { IBMPlexSans_700Bold } from '@expo-google-fonts/ibm-plex-sans';
import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { ensurePlayer } from '../lib/auth';
import { logDebug } from '../lib/debug';
import { PASSWORD_MIN, PASSWORD_MAX } from '../lib/passwordPolicy';
import { useFlag } from '../lib/flags';
import { usesFigmaOnboarding } from '../lib/onboardingFlow';
import { colors, fonts } from '../lib/theme';
import OnboardingHeader from '../components/OnboardingHeader';

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
  const { t } = useTranslation();
  const { signIn, setActive: setActiveSignIn, isLoaded: signInLoaded } = useSignIn();
  const { signUp, setActive: setActiveSignUp, isLoaded: signUpLoaded } = useSignUp();
  const { getToken } = useAuth();
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
  const insets = useSafeAreaInsets();
  // Figma onboarding (plan U10) restyles this screen; the handlers are shared
  // and with legacy_tabs on the screen renders exactly as before.
  const legacyTabs = useFlag('legacy_tabs');
  const figma = usesFigmaOnboarding(() => legacyTabs);

  const [fontsLoaded] = useFonts({ Archivo_900Black_Italic, IBMPlexSans_700Bold });
  if (!fontsLoaded) return null;

  // New accounts (Google or verified email) may still need a username; anyone
  // else goes through AuthGate, which decides Onboarding vs MainTabs.
  const routeAfterAuth = async () => {
    const { needsUsername, player } = await ensurePlayer({ clerkGetToken: getToken, email });
    if (needsUsername) {
      navigation.replace('Username', { playerId: player?.id });
    } else {
      navigation.replace('AuthGate');
    }
  };

  const handleGoogle = async () => {
    if (oauthLoading) return;
    setOauthLoading(true);
    setError('');
    logDebug(getToken, 'onboarding_signup_started', { method: 'google' });
    try {
      // Clerk handles both sign-in and sign-up through one OAuth flow: a new
      // Google account creates the Clerk user, an existing one signs in.
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: 'oauth_google',
        redirectUrl: AuthSession.makeRedirectUri(),
      });
      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
        logDebug(getToken, 'onboarding_auth_completed', { method: 'google' });
        await routeAfterAuth();
      }
      // No session and no throw means the user dismissed the browser — stay put,
      // no error.
    } catch (err) {
      setError(err.errors?.[0]?.message ?? t('signIn.googleFailed'));
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
        setError(t('signIn.extraVerification'));
        return;
      }
      await setActiveSignIn({ session: result.createdSessionId });
      const { needsUsername } = await ensurePlayer({ clerkGetToken: getToken, email });
      // Figma mode goes through AuthGate so a returning player gets the
      // Daily Rewards check (and an unfinished one resumes onboarding).
      navigation.replace(needsUsername ? 'Username' : figma ? 'AuthGate' : 'MainTabs');
    } catch (err) {
      setError(err.errors?.[0]?.message ?? t('signIn.signInFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (!signUpLoaded) return;
    if (password.length < PASSWORD_MIN) {
      setError(t('signIn.passwordTooShort', { min: PASSWORD_MIN }));
      return;
    }
    setLoading(true);
    setError('');
    logDebug(getToken, 'onboarding_signup_started', { method: 'email' });
    try {
      const result = await signUp.create({ emailAddress: email, password });
      if (result.status === 'complete') {
        // Email verification is disabled on this Clerk instance — straight in.
        await setActiveSignUp({ session: result.createdSessionId });
        logDebug(getToken, 'onboarding_auth_completed', { method: 'email' });
        const { needsUsername, player } = await ensurePlayer({ clerkGetToken: getToken, email });
        navigation.replace(needsUsername ? 'Username' : 'Onboarding', { playerId: player?.id });
        return;
      }
      // Verification required: send the code and switch to the code-entry view.
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      logDebug(getToken, 'onboarding_email_verification_sent', {});
      setPendingVerification(true);
    } catch (err) {
      setError(err.errors?.[0]?.message ?? t('signIn.signUpFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!signUpLoaded) return;
    if (code.trim().length < 6) {
      setError(t('signIn.codeTooShort'));
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await signUp.attemptEmailAddressVerification({ code: code.trim() });
      if (result.status !== 'complete') {
        setError(t('signIn.codeFailed'));
        return;
      }
      await setActiveSignUp({ session: result.createdSessionId });
      logDebug(getToken, 'onboarding_auth_completed', { method: 'email' });
      await routeAfterAuth();
    } catch (err) {
      setError(err.errors?.[0]?.message ?? t('signIn.codeFailed'));
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
      setError(err.errors?.[0]?.message ?? t('signIn.resendFailed'));
    } finally {
      setResending(false);
    }
  };

  const resetToForm = () => {
    setPendingVerification(false);
    setCode('');
    setError('');
  };

  // ---- Figma frames (legacy_tabs off) -------------------------------------
  function renderFigma() {
    const goBack = () => {
      if (navigation.canGoBack()) navigation.goBack();
      else navigation.replace('Welcome');
    };

    if (pendingVerification) {
      return (
        <KeyboardAvoidingView
          style={[figmaStyles.screen, screenPadding]}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Text style={figmaStyles.wordmark} maxFontSizeMultiplier={1.2}>DOMINIA</Text>
          <Text style={figmaStyles.heading} accessibilityRole="header">{t('signIn.verifyTitle')}</Text>
          <Text style={figmaStyles.hint}>
            {email ? t('signIn.codeSentTo', { email }) : t('signIn.codeSent')}
          </Text>
          <TextInput
            style={figmaStyles.input}
            keyboardAppearance="dark"
            placeholder={t('signIn.codePlaceholder')}
            placeholderTextColor={colors.slate}
            keyboardType="number-pad"
            autoCapitalize="none"
            textContentType="oneTimeCode"
            maxLength={6}
            value={code}
            onChangeText={setCode}
          />
          {error ? <Text style={figmaStyles.error}>{error}</Text> : null}
          <Pressable
            accessibilityRole="button"
            style={[figmaStyles.primary, loading && figmaStyles.dim]}
            onPress={handleVerify}
            disabled={loading}
          >
            <Text style={figmaStyles.primaryText}>{loading ? t('signIn.verifying') : t('signIn.verify')}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" style={figmaStyles.toggle} onPress={handleResend} disabled={resending}>
            <Text style={figmaStyles.toggleText}>
              {resending ? t('signIn.sending') : t('signIn.noCode')}
              {!resending ? <Text style={figmaStyles.toggleLink}>{t('signIn.resendCode')}</Text> : null}
            </Text>
          </Pressable>
          <Pressable accessibilityRole="button" style={figmaStyles.toggle} onPress={resetToForm}>
            <Text style={figmaStyles.toggleLink}>{t('signIn.differentEmail')}</Text>
          </Pressable>
        </KeyboardAvoidingView>
      );
    }

    const primaryLabel = loading
      ? t('signIn.pleaseWait')
      : isSignIn
        ? t('signIn.figmaSignBackIn', { defaultValue: 'Sign back in' })
        : t('signIn.figmaSignUp', { defaultValue: 'Sign up' });

    // Updated UX A3: ← SIGN UP header, subtitle, EMAIL / PASSWORD (8+
    // CHARACTERS) labels, the 8+ helper and a mono-caps toggle. Email only:
    // Apple and Google live on the landing, so there is no SSO button here.
    return (
      <KeyboardAvoidingView
        style={[figmaStyles.screen, figmaStyles.formScreen, screenPadding]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <OnboardingHeader
          title={
            isSignIn
              ? t('signIn.figmaSignInTitle', { defaultValue: 'Sign in' })
              : t('signIn.figmaSignUpTitle', { defaultValue: 'Sign up' })
          }
          onBack={goBack}
        />
        {isSignIn ? null : (
          <Text style={figmaStyles.subtitle}>
            {t('signIn.figmaSignUpSubtitle', {
              defaultValue: 'Create your account. You’ll choose your commander name next.',
            })}
          </Text>
        )}

        <Text style={figmaStyles.fieldLabel}>{t('signIn.figmaEmailLabel', { defaultValue: 'Email' })}</Text>
        <TextInput
          style={figmaStyles.input}
          keyboardAppearance="dark"
          placeholder={t('signIn.figmaEmailPlaceholder', { defaultValue: 'you@domain.com' })}
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          keyboardType="email-address"
          textContentType="emailAddress"
          value={email}
          onChangeText={setEmail}
        />
        <Text style={figmaStyles.fieldLabel}>
          {isSignIn
            ? t('signIn.figmaPasswordLabel', { defaultValue: 'Password' })
            : t('signIn.figmaPasswordLabelNew', { min: PASSWORD_MIN, defaultValue: 'Password ({{min}}+ characters)' })}
        </Text>
        <TextInput
          style={[figmaStyles.input, figmaStyles.inputLast]}
          keyboardAppearance="dark"
          placeholder="••••••••"
          placeholderTextColor={colors.muted}
          secureTextEntry
          textContentType={isSignIn ? 'password' : 'newPassword'}
          maxLength={PASSWORD_MAX}
          value={password}
          onChangeText={setPassword}
        />

        {isSignIn ? (
          <Pressable
            accessibilityRole="button"
            style={figmaStyles.forgot}
            onPress={() => navigation.navigate('ForgotPassword')}
            hitSlop={{ top: 8, bottom: 8 }}
          >
            <Text style={figmaStyles.forgotText}>{t('signIn.forgotPassword')}</Text>
          </Pressable>
        ) : (
          <Text style={figmaStyles.helper}>
            {t('signIn.figmaPasswordHelper', { min: PASSWORD_MIN, defaultValue: '{{min}}+ characters' })}
          </Text>
        )}

        {error ? <Text style={figmaStyles.formError}>{error}</Text> : null}

        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [
            figmaStyles.primary,
            figmaStyles.primarySpaced,
            loading && figmaStyles.dim,
            pressed && !loading && figmaStyles.primaryPressed,
          ]}
          onPress={isSignIn ? handleSignIn : handleSignUp}
          disabled={loading || oauthLoading}
        >
          <Text style={figmaStyles.primaryText}>{primaryLabel}</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          style={figmaStyles.capsToggle}
          onPress={() => { setMode(isSignIn ? 'signup' : 'signin'); setError(''); }}
        >
          <Text style={figmaStyles.capsToggleText}>
            {isSignIn
              ? t('signIn.figmaNotStarted', { defaultValue: "Haven't started yet? " })
              : t('landing.alreadyPlaying', { defaultValue: 'Already playing? ' })}
            {isSignIn
              ? t('signIn.figmaSignUpLink', { defaultValue: 'SIGN UP' })
              : t('landing.signIn', { defaultValue: 'SIGN IN' })}
          </Text>
        </Pressable>
      </KeyboardAvoidingView>
    );
  }

  const isSignIn = mode === 'signin';
  const screenPadding = { paddingTop: Math.max(insets.top, 24), paddingBottom: Math.max(insets.bottom, 24) };

  if (figma) {
    return renderFigma();
  }

  if (pendingVerification) {
    return (
      <KeyboardAvoidingView
        style={[styles.screen, screenPadding]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Text style={styles.title} maxFontSizeMultiplier={1.2}>DOMINIA <Text style={styles.claimMark}>■</Text></Text>
        <Text style={styles.subtitle}>{t('signIn.verifyTitle')}</Text>

        <Text style={styles.hint}>
          {email ? t('signIn.codeSentTo', { email }) : t('signIn.codeSent')}
        </Text>

        <TextInput
          style={styles.input}
          keyboardAppearance="dark"
          placeholder={t('signIn.codePlaceholder')}
          placeholderTextColor="rgba(253,253,253,0.30)"
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
          <Text style={styles.buttonText}>{loading ? t('signIn.verifying') : t('signIn.verify')}</Text>
        </Pressable>

        <Pressable style={styles.toggleButton} onPress={handleResend} disabled={resending}>
          <Text style={styles.toggleText}>
            {resending ? t('signIn.sending') : t('signIn.noCode')}
            {!resending ? <Text style={styles.toggleLink}>{t('signIn.resendCode')}</Text> : null}
          </Text>
        </Pressable>

        <Pressable style={styles.toggleButton} onPress={resetToForm}>
          <Text style={styles.toggleText}>
            <Text style={styles.toggleLink}>{t('signIn.differentEmail')}</Text>
          </Text>
        </Pressable>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.screen, screenPadding]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Text style={styles.title} maxFontSizeMultiplier={1.2}>DOMINIA <Text style={styles.claimMark}>■</Text></Text>
      <Text style={styles.subtitle}>{t('signIn.tagline')}</Text>

      <Pressable
        style={[styles.googleButton, oauthLoading && { opacity: 0.7 }]}
        onPress={handleGoogle}
        disabled={oauthLoading || loading}
      >
        <Text style={styles.googleMark}>G</Text>
        <Text style={styles.googleButtonText}>
          {oauthLoading ? t('signIn.connecting') : t('signIn.continueWithGoogle')}
        </Text>
      </Pressable>

      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>{t('signIn.or')}</Text>
        <View style={styles.dividerLine} />
      </View>

      <TextInput
        style={styles.input}
        keyboardAppearance="dark"
        placeholder={t('signIn.emailPlaceholder')}
        placeholderTextColor="rgba(253,253,253,0.30)"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        keyboardAppearance="dark"
        placeholder={t('signIn.passwordPlaceholder')}
        placeholderTextColor="rgba(253,253,253,0.30)"
        secureTextEntry
        maxLength={PASSWORD_MAX}
        value={password}
        onChangeText={setPassword}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {isSignIn ? (
        <Pressable
          style={styles.forgotButton}
          onPress={() => navigation.navigate('ForgotPassword')}
        >
          <Text style={styles.forgotText}>{t('signIn.forgotPassword')}</Text>
        </Pressable>
      ) : null}

      <Pressable
        style={[styles.button, loading && { opacity: 0.7 }]}
        onPress={isSignIn ? handleSignIn : handleSignUp}
        disabled={loading || oauthLoading}
      >
        <Text style={styles.buttonText}>
          {loading ? t('signIn.pleaseWait') : isSignIn ? t('signIn.signIn') : t('signIn.createAccount')}
        </Text>
      </Pressable>

      <Pressable
        style={styles.toggleButton}
        onPress={() => { setMode(isSignIn ? 'signup' : 'signin'); setError(''); }}
      >
        <Text style={styles.toggleText}>
          {isSignIn ? t('signIn.noAccount') : t('signIn.haveAccount')}
          <Text style={styles.toggleLink}>{isSignIn ? t('signIn.signUpLink') : t('signIn.signInLink')}</Text>
        </Text>
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontFamily: 'Archivo_900Black_Italic',
    color: '#FDFDFD',
    fontSize: 26,
    letterSpacing: -1,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  claimMark: {
    color: '#E34234',
    fontSize: 11,
  },
  subtitle: {
    fontFamily: 'IBMPlexSans_700Bold',
    color: 'rgba(253,253,253,0.30)',
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 48,
  },
  hint: {
    fontFamily: 'IBMPlexSans_700Bold',
    color: '#9CA3AF',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: 24,
  },
  googleButton: {
    width: '100%',
    backgroundColor: '#FDFDFD',
    borderRadius: 0,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  googleMark: {
    fontFamily: 'Archivo_900Black_Italic',
    color: '#0E0E10',
    fontSize: 16,
    textTransform: 'uppercase',
  },
  googleButtonText: {
    fontFamily: 'Archivo_900Black_Italic',
    color: '#0E0E10',
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
    backgroundColor: '#1A1A1D',
  },
  dividerText: {
    fontFamily: 'IBMPlexSans_700Bold',
    color: 'rgba(253,253,253,0.30)',
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  input: {
    width: '100%',
    backgroundColor: '#0E0E10',
    borderRadius: 0,
    borderWidth: 1,
    borderColor: '#1A1A1D',
    color: '#FDFDFD',
    fontSize: 15,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
  },
  error: {
    color: '#E34234',
    fontSize: 13,
    marginBottom: 12,
    textAlign: 'center',
  },
  button: {
    width: '100%',
    backgroundColor: '#E34234',
    borderRadius: 0,
    paddingVertical: 16,
  },
  buttonText: {
    fontFamily: 'Archivo_900Black_Italic',
    color: '#FDFDFD',
    fontSize: 15,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  forgotButton: {
    alignSelf: 'flex-end',
    marginBottom: 12,
  },
  forgotText: {
    color: 'rgba(253,253,253,0.30)',
    fontSize: 13,
  },
  toggleButton: {
    marginTop: 24,
  },
  toggleText: {
    color: 'rgba(253,253,253,0.30)',
    fontSize: 13,
  },
  toggleLink: {
    color: '#E34234',
    fontFamily: 'Archivo_900Black_Italic',
    textTransform: 'uppercase',
  },
});

// Figma frames (plan U10), on DESIGN.md tokens: square, mono labels, one
// Claim Red Button per screen.
const figmaStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink, justifyContent: 'center', paddingHorizontal: 24 },
  back: { position: 'absolute', left: 24, paddingVertical: 8 },
  backText: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.4, color: colors.slate2, textTransform: 'uppercase' },
  wordmark: {
    fontFamily: fonts.display,
    fontSize: 26,
    color: colors.bone,
    letterSpacing: -1,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  heading: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.8,
    color: colors.slate2,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 32,
  },
  hint: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.slate2, textAlign: 'center', marginBottom: 20 },
  fieldLabel: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.6,
    color: colors.slate2,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  input: {
    width: '100%',
    backgroundColor: colors.ink2,
    borderWidth: 0.5,
    borderColor: colors.hairlineStrong,
    color: colors.bone,
    fontFamily: fonts.mono,
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 48,
    marginBottom: 14,
  },
  forgot: { alignSelf: 'flex-end', marginTop: 12 },
  forgotText: { fontFamily: fonts.body, fontSize: 13, color: colors.slate2 },
  error: { fontFamily: fonts.body, fontSize: 13, color: colors.bone, textAlign: 'center', marginBottom: 12 },
  primary: {
    width: '100%',
    backgroundColor: colors.claimButton,
    minHeight: 48,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { fontFamily: fonts.monoMedium, fontSize: 14, letterSpacing: 2, color: colors.bone, textTransform: 'uppercase' },
  secondary: {
    width: '100%',
    backgroundColor: colors.ink2,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    minHeight: 48,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: { fontFamily: fonts.monoMedium, fontSize: 14, letterSpacing: 2, color: colors.bone, textTransform: 'uppercase' },
  dim: { opacity: 0.7 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 16 },
  dividerLine: { flex: 1, height: 0.5, backgroundColor: colors.hairlineStrong },
  dividerText: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.6, color: colors.slate2, textTransform: 'uppercase' },
  toggle: { marginTop: 20, alignItems: 'center', paddingVertical: 6 },
  toggleText: { fontFamily: fonts.body, fontSize: 13, color: colors.slate2, textAlign: 'center' },
  toggleLink: { fontFamily: fonts.monoMedium, fontSize: 13, letterSpacing: 1.4, color: colors.bone },
  // Updated UX A3 form: top-aligned under the ← title header.
  formScreen: { justifyContent: 'flex-start' },
  subtitle: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: colors.muted2, marginTop: 4, marginBottom: 16 },
  inputLast: { marginBottom: 0 },
  helper: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.muted, marginTop: 16 },
  formError: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.danger, marginTop: 12 },
  primaryPressed: { backgroundColor: colors.actionPressed },
  primarySpaced: { marginTop: 16, minHeight: 52 },
  capsToggle: { marginTop: 16, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  capsToggleText: {
    fontFamily: fonts.monoMedium,
    fontSize: 13,
    letterSpacing: 1.8,
    color: colors.white2,
    textTransform: 'uppercase',
  },
});
