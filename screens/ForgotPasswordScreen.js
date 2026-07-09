import { useSignIn, useAuth } from '@clerk/clerk-expo';
import { useFonts, Archivo_900Black } from '@expo-google-fonts/archivo';
import { GeistMono_400Regular } from '@expo-google-fonts/geist-mono';
import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { ensurePlayer } from '../lib/auth';
import { PASSWORD_MIN, PASSWORD_MAX } from '../lib/passwordPolicy';

// Clerk custom reset flow: request an email code, then trade code + new
// password for a fresh session. Clerk sends the email itself — there is no
// backend involvement here.
export default function ForgotPasswordScreen({ navigation }) {
  const { t } = useTranslation();
  const { signIn, setActive, isLoaded } = useSignIn();
  const { getToken } = useAuth();
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const insets = useSafeAreaInsets();

  const [fontsLoaded] = useFonts({ Archivo_900Black, GeistMono_400Regular });
  if (!fontsLoaded) return null;

  const sendCode = async ({ isResend = false } = {}) => {
    if (!isLoaded) return;
    setLoading(true);
    setError('');
    setInfo('');
    try {
      await signIn.create({ strategy: 'reset_password_email_code', identifier: email.trim() });
      setStep('reset');
      if (isResend) setInfo(t('forgotPassword.codeResent'));
    } catch (err) {
      setError(err.errors?.[0]?.message ?? t('forgotPassword.sendFailed'));
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async () => {
    if (!isLoaded) return;
    if (password.length < PASSWORD_MIN) {
      setError(t('signIn.passwordTooShort', { min: PASSWORD_MIN }));
      return;
    }
    setLoading(true);
    setError('');
    setInfo('');
    try {
      const result = await signIn.attemptFirstFactor({
        strategy: 'reset_password_email_code',
        code: code.trim(),
        password,
      });
      if (result.status !== 'complete') {
        // No 2FA is configured for this app, so anything short of a full
        // session is unexpected — surface it rather than guessing.
        setError(t('forgotPassword.resetFailed'));
        return;
      }
      await setActive({ session: result.createdSessionId });
      const { needsUsername } = await ensurePlayer({ clerkGetToken: getToken, email: email.trim() });
      navigation.replace(needsUsername ? 'Username' : 'MainTabs');
    } catch (err) {
      setError(err.errors?.[0]?.message ?? t('forgotPassword.resetFailed'));
    } finally {
      setLoading(false);
    }
  };

  const isEmailStep = step === 'email';

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
          placeholder={t('signIn.emailPlaceholder')}
          placeholderTextColor="#6B7280"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
      ) : (
        <>
          <TextInput
            style={styles.input}
            placeholder={t('forgotPassword.codePlaceholder')}
            placeholderTextColor="#6B7280"
            keyboardType="number-pad"
            value={code}
            onChangeText={setCode}
          />
          <TextInput
            style={styles.input}
            placeholder={t('forgotPassword.newPasswordPlaceholder')}
            placeholderTextColor="#6B7280"
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
    backgroundColor: '#0D0D0D',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontFamily: 'Archivo_900Black',
    color: '#F2F0EB',
    fontSize: 24,
    letterSpacing: -1,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  subtitle: {
    fontFamily: 'GeistMono_400Regular',
    color: '#6B7280',
    fontSize: 11,
    letterSpacing: 1,
    textAlign: 'center',
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
  info: {
    color: '#6B7280',
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
  linkButton: {
    marginTop: 24,
  },
  linkText: {
    color: '#6B7280',
    fontSize: 13,
  },
});
