import { useSignIn, useAuth } from '@clerk/clerk-expo';
import { useFonts, Archivo_900Black_Italic } from '@expo-google-fonts/archivo';
import { IBMPlexSans_700Bold } from '@expo-google-fonts/ibm-plex-sans';
import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { ensurePlayer } from '../lib/auth';
import { emptyAuthErrors, mapAuthError } from '../lib/authErrors';
import { PASSWORD_MIN, PASSWORD_MAX } from '../lib/passwordPolicy';
import { useFlag } from '../lib/flags';
import { usesFigmaOnboarding } from '../lib/onboardingFlow';
import { colors, fonts } from '../lib/theme';
import { AuthBackdrop, FormError } from '../components/AuthParts';
import { CutField, LinkText, ScreenTitle, SlantButton } from '../components/ui';

// Clerk custom reset flow: request an email code, then trade code + new
// password for a fresh session. Clerk sends the email itself — there is no
// backend involvement here.
//
// With Figma onboarding on (legacy_tabs off) the two steps are the
// Dominia-Temp boards (plan U3): "LOCKED OUT?" (EMAIL, SEND RESET LINK »,
// BACK TO SIGN IN) and "GET BACK IN" (VERIFICATION CODE with RESEND CODE,
// NEW PASSWORD, CREATE NEW PASSWORD »), errors inline per field via
// lib/authErrors. With legacy_tabs on it renders exactly as before.
export default function ForgotPasswordScreen({ navigation, route }) {
  const { t } = useTranslation();
  const { signIn, setActive, isLoaded } = useSignIn();
  const { getToken } = useAuth();
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState(typeof route?.params?.email === 'string' ? route.params.email : '');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState(emptyAuthErrors);
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const insets = useSafeAreaInsets();
  const legacyTabs = useFlag('legacy_tabs');
  const figma = usesFigmaOnboarding(() => legacyTabs);

  const [fontsLoaded] = useFonts({ Archivo_900Black_Italic, IBMPlexSans_700Bold });
  if (!fontsLoaded) return null;

  const clearErrors = () => {
    setError('');
    setFieldErrors(emptyAuthErrors());
    setInfo('');
  };

  const fail = (err, fallbackKey, fallbackDefault) => {
    if (!figma) {
      setError(err?.errors?.[0]?.message ?? t(fallbackKey, { defaultValue: fallbackDefault }));
      return;
    }
    const mapped = mapAuthError(err, { fallback: { key: fallbackKey, defaultValue: fallbackDefault } });
    setFieldErrors({ ...emptyAuthErrors(), [mapped.field]: t(mapped.key, { defaultValue: mapped.defaultValue }) });
  };

  const failLocal = (field, message) => {
    if (!figma) setError(message);
    else setFieldErrors({ ...emptyAuthErrors(), [field]: message });
  };

  const edit = (field, setter) => (value) => {
    setter(value);
    if (fieldErrors[field] || fieldErrors.form) {
      setFieldErrors((prev) => ({ ...prev, [field]: '', form: '' }));
    }
  };

  const sendCode = async ({ isResend = false } = {}) => {
    if (!isLoaded) return;
    if (isResend) setResending(true);
    else setLoading(true);
    clearErrors();
    try {
      await signIn.create({ strategy: 'reset_password_email_code', identifier: email.trim() });
      setStep('reset');
      if (isResend) setInfo(t('forgotPassword.codeResent'));
    } catch (err) {
      fail(err, 'forgotPassword.sendFailed', 'Couldn’t send the code. Check the email and try again.');
    } finally {
      setLoading(false);
      setResending(false);
    }
  };

  const resetPassword = async () => {
    if (!isLoaded) return;
    if (password.length < PASSWORD_MIN) {
      failLocal('password', t('signIn.passwordTooShort', { min: PASSWORD_MIN }));
      return;
    }
    setLoading(true);
    clearErrors();
    try {
      const result = await signIn.attemptFirstFactor({
        strategy: 'reset_password_email_code',
        code: code.trim(),
        password,
      });
      if (result.status !== 'complete') {
        // No 2FA is configured for this app, so anything short of a full
        // session is unexpected — surface it rather than guessing.
        failLocal('form', t('forgotPassword.resetFailed'));
        return;
      }
      await setActive({ session: result.createdSessionId });
      const { needsUsername } = await ensurePlayer({ clerkGetToken: getToken, email: email.trim() });
      // Figma mode goes through AuthGate, as SignIn does, so a returning
      // player gets the Daily Rewards check.
      navigation.replace(needsUsername ? 'Username' : figma ? 'AuthGate' : 'MainTabs');
    } catch (err) {
      fail(err, 'forgotPassword.resetFailed', 'Reset failed. Check the code and try again.');
    } finally {
      setLoading(false);
    }
  };

  const isEmailStep = step === 'email';

  if (figma) {
    const backToSignIn = (
      <View style={figmaStyles.linkRow}>
        <LinkText size={13} onPress={() => navigation.goBack()} disabled={loading} testID="reset-back">
          {t('auth.backToSignIn', { defaultValue: 'BACK TO SIGN IN' })}
        </LinkText>
      </View>
    );
    return (
      <View style={figmaStyles.screen}>
        <AuthBackdrop />
        <KeyboardAvoidingView style={figmaStyles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={[
              figmaStyles.content,
              { paddingTop: Math.max(insets.top, 24) + 24, paddingBottom: Math.max(insets.bottom, 24) + 24 },
            ]}
            keyboardShouldPersistTaps="handled"
            bounces={false}
          >
            {isEmailStep ? (
              <>
                <ScreenTitle
                  eyebrow={t('auth.accountEyebrow', { defaultValue: 'ACCOUNT' })}
                  title={t('reset.lockedOutTitle', { defaultValue: 'LOCKED OUT?' })}
                  align="center"
                  size={34}
                  style={figmaStyles.title}
                />
                <CutField
                  label={t('auth.emailLabel', { defaultValue: 'EMAIL' })}
                  placeholder={t('auth.emailPlaceholder', { defaultValue: 'Email' })}
                  keyboardAppearance="dark"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  autoComplete="email"
                  value={email}
                  onChangeText={edit('email', setEmail)}
                  onSubmitEditing={() => sendCode()}
                  returnKeyType="send"
                  error={fieldErrors.email}
                  testID="reset-email"
                />
                <View style={figmaStyles.primaryBlock}>
                  <FormError>{fieldErrors.form}</FormError>
                  <SlantButton
                    label={t('reset.sendLink', { defaultValue: 'SEND RESET LINK' })}
                    onPress={() => sendCode()}
                    loading={loading}
                    testID="reset-send"
                  />
                </View>
                {backToSignIn}
              </>
            ) : (
              <>
                <ScreenTitle
                  eyebrow={t('auth.accountEyebrow', { defaultValue: 'ACCOUNT' })}
                  title={t('reset.getBackInTitle', { defaultValue: 'GET BACK IN' })}
                  subtitle={t('reset.getBackInSubtitle', { defaultValue: 'Enter your code. Set a new password.' })}
                  align="center"
                  size={34}
                  style={figmaStyles.title}
                />
                <CutField
                  label={t('auth.verificationCodeLabel', { defaultValue: 'VERIFICATION CODE' })}
                  placeholder={t('reset.codePlaceholder', { defaultValue: 'Verification code' })}
                  keyboardAppearance="dark"
                  keyboardType="number-pad"
                  textContentType="oneTimeCode"
                  autoComplete="one-time-code"
                  value={code}
                  onChangeText={edit('code', setCode)}
                  error={fieldErrors.code || fieldErrors.email}
                  helper={info}
                  rightAccessory={
                    <LinkText
                      size={12}
                      onPress={() => sendCode({ isResend: true })}
                      disabled={loading || resending}
                      testID="reset-resend"
                    >
                      {resending ? t('signIn.sending') : t('auth.resendCode', { defaultValue: 'RESEND CODE' })}
                    </LinkText>
                  }
                  testID="reset-code"
                />
                <CutField
                  label={t('reset.newPasswordLabel', { defaultValue: 'NEW PASSWORD' })}
                  placeholder={t('reset.newPasswordPlaceholder', {
                    min: PASSWORD_MIN,
                    defaultValue: 'New password ({{min}}+ characters)',
                  })}
                  keyboardAppearance="dark"
                  secureTextEntry
                  textContentType="newPassword"
                  autoComplete="new-password"
                  maxLength={PASSWORD_MAX}
                  value={password}
                  onChangeText={edit('password', setPassword)}
                  onSubmitEditing={resetPassword}
                  returnKeyType="go"
                  error={fieldErrors.password}
                  containerStyle={figmaStyles.fieldGap}
                  testID="reset-password"
                />
                <View style={figmaStyles.primaryBlock}>
                  <FormError>{fieldErrors.form}</FormError>
                  <SlantButton
                    label={t('reset.createNewPassword', { defaultValue: 'CREATE NEW PASSWORD' })}
                    onPress={resetPassword}
                    loading={loading}
                    disabled={resending}
                    testID="reset-submit"
                  />
                </View>
                {backToSignIn}
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { paddingTop: Math.max(insets.top, 24), paddingBottom: Math.max(insets.bottom, 24) }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Text style={styles.title}>{t('forgotPassword.title')}</Text>
      <Text style={styles.subtitle}>
        {isEmailStep ? t('forgotPassword.emailSubtitle') : t('forgotPassword.resetSubtitle', { email: email.trim() })}
      </Text>

      {isEmailStep ? (
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
      ) : (
        <>
          <TextInput
            style={styles.input}
            keyboardAppearance="dark"
            placeholder={t('forgotPassword.codePlaceholder')}
            placeholderTextColor="rgba(253,253,253,0.30)"
            keyboardType="number-pad"
            value={code}
            onChangeText={setCode}
          />
          <TextInput
            style={styles.input}
            keyboardAppearance="dark"
            placeholder={t('forgotPassword.newPasswordPlaceholder')}
            placeholderTextColor="rgba(253,253,253,0.30)"
            secureTextEntry
            maxLength={PASSWORD_MAX}
            value={password}
            onChangeText={setPassword}
          />
        </>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {info ? <Text style={styles.info}>{info}</Text> : null}

      <Pressable
        style={[styles.button, loading && { opacity: 0.7 }]}
        onPress={isEmailStep ? () => sendCode() : resetPassword}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading
            ? t('signIn.pleaseWait')
            : isEmailStep
              ? t('forgotPassword.sendCode')
              : t('forgotPassword.resetPassword')}
        </Text>
      </Pressable>

      {!isEmailStep ? (
        <Pressable style={styles.linkButton} onPress={() => sendCode({ isResend: true })} disabled={loading}>
          <Text style={styles.linkText}>{t('forgotPassword.resendCode')}</Text>
        </Pressable>
      ) : null}

      <Pressable style={styles.linkButton} onPress={() => navigation.goBack()} disabled={loading}>
        <Text style={styles.linkText}>{t('forgotPassword.backToSignIn')}</Text>
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
    fontSize: 24,
    letterSpacing: -1,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  subtitle: {
    fontFamily: 'IBMPlexSans_700Bold',
    color: 'rgba(253,253,253,0.30)',
    fontSize: 11,
    letterSpacing: 1,
    textAlign: 'center',
    marginBottom: 48,
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
  info: {
    color: 'rgba(253,253,253,0.30)',
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
  linkButton: {
    marginTop: 24,
  },
  linkText: {
    color: 'rgba(253,253,253,0.30)',
    fontSize: 13,
  },
});

// Figma frames (Dominia-Temp "Forgot password" board, plan U3).
const figmaStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.obsidian },
  flex: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24 },
  title: { marginBottom: 28 },
  fieldGap: { marginTop: 18 },
  primaryBlock: { marginTop: 22, alignSelf: 'stretch' },
  linkRow: { marginTop: 20, alignItems: 'center', minHeight: 44, justifyContent: 'center' },
});
