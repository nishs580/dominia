import { useSignIn, useSignUp, useAuth, useSSO } from '@clerk/clerk-expo';
import { useFonts, Archivo_900Black_Italic } from '@expo-google-fonts/archivo';
import { IBMPlexSans_700Bold } from '@expo-google-fonts/ibm-plex-sans';
import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { ensurePlayer } from '../lib/auth';
import { emptyAuthErrors, mapAuthError } from '../lib/authErrors';
import { logDebug } from '../lib/debug';
import { PASSWORD_MIN, PASSWORD_MAX } from '../lib/passwordPolicy';
import { useFlag } from '../lib/flags';
import { usesFigmaOnboarding } from '../lib/onboardingFlow';
import { colors, fonts } from '../lib/theme';
import { AuthBackdrop, FormError, GoogleGlyph, OrDivider } from '../components/AuthParts';
import Wordmark from '../components/Wordmark';
import { CutField, LinkText, ScreenTitle, SlantButton } from '../components/ui';

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
  // Legacy layout: one error line. Figma layout: per-field errors routed by
  // lib/authErrors (plan U3), plus a form-level line above the primary.
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState(emptyAuthErrors);
  // Welcome routes here with mode 'signup' (Get started) or 'signin' (the
  // returning-user shortcut); default to sign-in for any direct entry.
  const [mode, setMode] = useState(route?.params?.mode === 'signup' ? 'signup' : 'signin');
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [pendingVerification, setPendingVerification] = useState(false);
  const [code, setCode] = useState('');
  const [resending, setResending] = useState(false);
  const [info, setInfo] = useState('');
  const insets = useSafeAreaInsets();
  // Figma onboarding restyles this screen; the handlers are shared and with
  // legacy_tabs on the screen renders exactly as before.
  const legacyTabs = useFlag('legacy_tabs');
  const figma = usesFigmaOnboarding(() => legacyTabs);

  const [fontsLoaded] = useFonts({ Archivo_900Black_Italic, IBMPlexSans_700Bold });
  if (!fontsLoaded) return null;

  const clearErrors = () => {
    setError('');
    setFieldErrors(emptyAuthErrors());
    setInfo('');
  };

  // A Clerk failure: the legacy layout keeps Clerk's own message; the Figma
  // layout puts a translated line on the field it belongs to.
  const fail = (err, fallbackKey, fallbackDefault) => {
    if (!figma) {
      setError(err?.errors?.[0]?.message ?? t(fallbackKey, { defaultValue: fallbackDefault }));
      return;
    }
    const mapped = mapAuthError(err, { fallback: { key: fallbackKey, defaultValue: fallbackDefault } });
    setFieldErrors({ ...emptyAuthErrors(), [mapped.field]: t(mapped.key, { defaultValue: mapped.defaultValue }) });
  };

  // A client-side check that failed before any network call.
  const failLocal = (field, message) => {
    if (!figma) setError(message);
    else setFieldErrors({ ...emptyAuthErrors(), [field]: message });
  };

  // Typing into a field clears its own error and the form-level line.
  const edit = (field, setter) => (value) => {
    setter(value);
    if (fieldErrors[field] || fieldErrors.form) {
      setFieldErrors((prev) => ({ ...prev, [field]: '', form: '' }));
    }
  };

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
    clearErrors();
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
      fail(err, 'signIn.googleFailed', 'Google sign-in failed. Try again.');
    } finally {
      setOauthLoading(false);
    }
  };

  const handleSignIn = async () => {
    if (!signInLoaded) return;
    setLoading(true);
    clearErrors();
    try {
      const result = await signIn.create({ identifier: email.trim(), password });
      if (result.status !== 'complete') {
        failLocal('form', t('signIn.extraVerification'));
        return;
      }
      await setActiveSignIn({ session: result.createdSessionId });
      const { needsUsername } = await ensurePlayer({ clerkGetToken: getToken, email });
      // Figma mode goes through AuthGate so a returning player gets the
      // Daily Rewards check (and an unfinished one resumes onboarding).
      navigation.replace(needsUsername ? 'Username' : figma ? 'AuthGate' : 'MainTabs');
    } catch (err) {
      fail(err, 'signIn.signInFailed', 'Sign in failed. Check your email and password.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (!signUpLoaded) return;
    if (password.length < PASSWORD_MIN) {
      failLocal('password', t('signIn.passwordTooShort', { min: PASSWORD_MIN }));
      return;
    }
    setLoading(true);
    clearErrors();
    logDebug(getToken, 'onboarding_signup_started', { method: 'email' });
    try {
      const result = await signUp.create({ emailAddress: email.trim(), password });
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
      fail(err, 'signIn.signUpFailed', 'Sign up failed. Try a different email.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!signUpLoaded) return;
    if (code.trim().length < 6) {
      failLocal('code', t('signIn.codeTooShort'));
      return;
    }
    setLoading(true);
    clearErrors();
    try {
      const result = await signUp.attemptEmailAddressVerification({ code: code.trim() });
      if (result.status !== 'complete') {
        failLocal('code', t('signIn.codeFailed'));
        return;
      }
      await setActiveSignUp({ session: result.createdSessionId });
      logDebug(getToken, 'onboarding_auth_completed', { method: 'email' });
      await routeAfterAuth();
    } catch (err) {
      fail(err, 'signIn.codeFailed', 'That code didn’t work. Check your email and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!signUpLoaded || resending) return;
    setResending(true);
    clearErrors();
    try {
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      if (figma) setInfo(t('forgotPassword.codeResent'));
    } catch (err) {
      fail(err, 'signIn.resendFailed', 'Could not resend the code. Try again.');
    } finally {
      setResending(false);
    }
  };

  const resetToForm = () => {
    setPendingVerification(false);
    setCode('');
    clearErrors();
  };

  // ---- Figma frames (legacy_tabs off; Dominia-Temp boards, plan U3) -------
  function renderFigma() {
    const scrollProps = {
      contentContainerStyle: [
        figmaStyles.content,
        { paddingTop: Math.max(insets.top, 24) + 24, paddingBottom: Math.max(insets.bottom, 24) + 24 },
      ],
      keyboardShouldPersistTaps: 'handled',
      bounces: false,
    };
    const wrap = (children) => (
      <View style={figmaStyles.screen}>
        <AuthBackdrop />
        <KeyboardAvoidingView style={figmaStyles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView {...scrollProps}>{children}</ScrollView>
        </KeyboardAvoidingView>
      </View>
    );

    if (pendingVerification) {
      return wrap(
        <>
          <Wordmark size={34} tagline={false} style={figmaStyles.wordmarkSmall} />
          <ScreenTitle
            eyebrow={t('auth.accountEyebrow', { defaultValue: 'ACCOUNT' })}
            title={t('signIn.verifyTitle')}
            subtitle={email ? t('signIn.codeSentTo', { email: email.trim() }) : t('signIn.codeSent')}
            align="center"
            size={28}
            style={figmaStyles.title}
          />
          <CutField
            label={t('auth.verificationCodeLabel', { defaultValue: 'VERIFICATION CODE' })}
            placeholder={t('signIn.codePlaceholder')}
            keyboardType="number-pad"
            keyboardAppearance="dark"
            autoCapitalize="none"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChangeText={edit('code', setCode)}
            error={fieldErrors.code}
            helper={info}
            rightAccessory={
              <LinkText size={12} onPress={handleResend} disabled={resending}>
                {resending ? t('signIn.sending') : t('auth.resendCode', { defaultValue: 'RESEND CODE' })}
              </LinkText>
            }
            testID="signin-code"
          />
          <View style={figmaStyles.primaryBlock}>
            <FormError>{fieldErrors.form || fieldErrors.email || fieldErrors.password}</FormError>
            <SlantButton
              label={t('auth.verify', { defaultValue: 'VERIFY' })}
              onPress={handleVerify}
              loading={loading}
              testID="signin-verify"
            />
          </View>
          <View style={figmaStyles.linkRow}>
            <LinkText chevron="left" size={13} onPress={resetToForm}>
              {t('signIn.differentEmail')}
            </LinkText>
          </View>
        </>,
      );
    }

    const goBack = () => {
      if (navigation.canGoBack()) navigation.goBack();
      else navigation.replace('Welcome');
    };
    // "SIGN UP »" leads to the sign-up chooser (Google or email).
    const toChooser = () => {
      if (typeof navigation.popTo === 'function') navigation.popTo('Welcome');
      else navigation.navigate('Welcome');
    };

    const emailField = (
      <CutField
        label={
          isSignIn
            ? t('auth.emailLabel', { defaultValue: 'EMAIL' })
            : t('auth.emailAddressLabel', { defaultValue: 'EMAIL ADDRESS' })
        }
        placeholder={
          isSignIn
            ? t('auth.emailPlaceholder', { defaultValue: 'Email' })
            : t('auth.emailAddressPlaceholder', { defaultValue: 'Email address' })
        }
        keyboardAppearance="dark"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType={isSignIn ? 'username' : 'emailAddress'}
        autoComplete="email"
        value={email}
        onChangeText={edit('email', setEmail)}
        error={fieldErrors.email}
        testID="signin-email"
      />
    );
    const passwordField = (
      <CutField
        label={t('auth.passwordLabel', { defaultValue: 'PASSWORD' })}
        placeholder={
          isSignIn
            ? t('auth.passwordPlaceholder', { defaultValue: 'Password' })
            : t('auth.passwordNewPlaceholder', { min: PASSWORD_MIN, defaultValue: 'Password ({{min}}+ characters)' })
        }
        keyboardAppearance="dark"
        secureTextEntry
        textContentType={isSignIn ? 'password' : 'newPassword'}
        autoComplete={isSignIn ? 'current-password' : 'new-password'}
        maxLength={PASSWORD_MAX}
        value={password}
        onChangeText={edit('password', setPassword)}
        onSubmitEditing={isSignIn ? handleSignIn : handleSignUp}
        returnKeyType="go"
        error={fieldErrors.password}
        containerStyle={figmaStyles.fieldGap}
        testID="signin-password"
      />
    );

    if (!isSignIn) {
      // Board "Sign up with email": EMAIL ADDRESS, PASSWORD (8+ characters),
      // SIGN UP », « BACK.
      return wrap(
        <>
          <Wordmark size={40} style={figmaStyles.wordmark} />
          {emailField}
          {passwordField}
          <View style={figmaStyles.primaryBlock}>
            <FormError>{fieldErrors.form}</FormError>
            <SlantButton
              label={t('auth.signUp', { defaultValue: 'SIGN UP' })}
              onPress={handleSignUp}
              loading={loading}
              disabled={oauthLoading}
              testID="signin-submit"
            />
          </View>
          <View style={figmaStyles.linkRow}>
            <LinkText chevron="left" size={13} onPress={goBack}>
              {t('auth.back', { defaultValue: 'BACK' })}
            </LinkText>
          </View>
        </>,
      );
    }

    // Board "Sign in": EMAIL, PASSWORD, FORGOT PASSWORD?, SIGN IN », OR,
    // CONTINUE WITH GOOGLE, "Don't have an account? SIGN UP »".
    return wrap(
      <>
        <Wordmark size={40} style={figmaStyles.wordmark} />
        {emailField}
        {passwordField}
        <LinkText
          tone="muted"
          size={13}
          onPress={() => navigation.navigate('ForgotPassword', { email: email.trim() })}
          style={figmaStyles.forgot}
          testID="signin-forgot"
        >
          {t('auth.forgotPassword', { defaultValue: 'FORGOT PASSWORD?' })}
        </LinkText>
        <View style={figmaStyles.primaryBlockTight}>
          <FormError>{fieldErrors.form}</FormError>
          <SlantButton
            label={t('auth.signIn', { defaultValue: 'SIGN IN' })}
            onPress={handleSignIn}
            loading={loading}
            disabled={oauthLoading}
            testID="signin-submit"
          />
        </View>
        <OrDivider style={figmaStyles.or} />
        <SlantButton
          variant="outline"
          size="md"
          label={t('landing.continueWithGoogle', { defaultValue: 'Continue with Google' })}
          leading={<GoogleGlyph />}
          trailingChevron={false}
          loading={oauthLoading}
          disabled={loading}
          onPress={handleGoogle}
          testID="signin-google"
        />
        <View style={figmaStyles.promptRow}>
          <Text style={figmaStyles.prompt} maxFontSizeMultiplier={1.4}>
            {t('auth.noAccount', { defaultValue: 'Don’t have an account?' })}
          </Text>
          <LinkText chevron="right" size={13} onPress={toChooser} testID="signin-to-signup">
            {t('auth.signUp', { defaultValue: 'SIGN UP' })}
          </LinkText>
        </View>
      </>,
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

// Figma frames (Dominia-Temp auth boards, plan U3). Shapes come from the
// components/ui primitives; this only lays them out.
const figmaStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.obsidian },
  flex: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24 },
  wordmark: { marginBottom: 36 },
  wordmarkSmall: { marginBottom: 28 },
  title: { marginBottom: 24 },
  fieldGap: { marginTop: 18 },
  forgot: { alignSelf: 'flex-end', marginTop: 16 },
  primaryBlock: { marginTop: 22, alignSelf: 'stretch' },
  primaryBlockTight: { marginTop: 18, alignSelf: 'stretch' },
  or: { marginVertical: 16 },
  linkRow: { marginTop: 20, alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  promptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
    minHeight: 44,
  },
  prompt: { fontFamily: fonts.body, fontSize: 12, color: colors.muted2 },
});
