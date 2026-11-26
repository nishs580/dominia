import { useFonts, SofiaSansExtraCondensed_800ExtraBold } from '@expo-google-fonts/sofia-sans-extra-condensed';
import { GeistMono_400Regular, GeistMono_500Medium } from '@expo-google-fonts/geist-mono';
import { InstrumentSans_400Regular } from '@expo-google-fonts/instrument-sans';
import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@clerk/clerk-expo';
import { useTranslation } from 'react-i18next';
import { checkUsernameAvailable, getMe, patchMe } from '../lib/meApi';
import { usernameProblem, visibleProblem } from '../lib/usernameRules';
import { useFlag } from '../lib/flags';
import { usesFigmaOnboarding } from '../lib/onboardingFlow';
import { colors, fonts } from '../lib/theme';
import OnboardingHeader from '../components/OnboardingHeader';

// i18n keys for each problem from lib/usernameRules.
const PROBLEM_KEYS = {
  empty: 'errorEmpty',
  tooShort: 'errorTooShort',
  tooLong: 'errorTooLong',
  symbol: 'errorInvalidChars',
};

// Returns an i18n error key, or null when the shape is valid.
function validateUsername(name) {
  const p = usernameProblem(name);
  return p === 'ok' ? null : PROBLEM_KEYS[p];
}

export default function UsernameScreen({ navigation, route }) {
  const playerId = route.params?.playerId;
  const { t } = useTranslation();
  const { getToken } = useAuth();
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  // 'idle' | 'checking' | 'available' | 'taken'
  const [status, setStatus] = useState('idle');
  const insets = useSafeAreaInsets();
  // Figma onboarding (Updated UX A4/A4b/A4c) restyles this screen; with
  // legacy_tabs on it renders exactly as before.
  const legacyTabs = useFlag('legacy_tabs');
  const figma = usesFigmaOnboarding(() => legacyTabs);
  // Back from the age step (Updated UX A5 ←): the name is already saved, so
  // prefill it and let NEXT keep it without a second PATCH.
  const editing = Boolean(route.params?.editing);
  const [savedName, setSavedName] = useState(null);
  useEffect(() => {
    if (!figma || !editing) return undefined;
    let cancelled = false;
    getMe({ clerkGetToken: getToken }).then((res) => {
      const name = res.ok ? res.data?.player?.username : null;
      if (cancelled || !name) return;
      setSavedName(name);
      setUsername((cur) => cur || name);
    });
    return () => { cancelled = true; };
  }, [figma, editing, getToken]);
  const keepsSavedName = Boolean(savedName) && username.trim() === savedName;

  const [fontsLoaded] = useFonts({ SofiaSansExtraCondensed_800ExtraBold, GeistMono_400Regular, GeistMono_500Medium, InstrumentSans_400Regular });

  // Debounced availability check: only fires once the name is well-formed.
  // Advisory only — PATCH /me re-checks authoritatively on submit.
  useEffect(() => {
    if (validateUsername(username) !== null) {
      setStatus('idle');
      return;
    }
    setStatus('checking');
    let cancelled = false;
    if (keepsSavedName) {
      setStatus('available');
      return;
    }
    const handle = setTimeout(async () => {
      const res = await checkUsernameAvailable({ clerkGetToken: getToken, username: username.trim() });
      if (cancelled) return;
      if (res.ok) {
        setStatus(res.data.available ? 'available' : 'taken');
      } else {
        // Network/other failure: don't block; submit will make the call that counts.
        setStatus('idle');
      }
    }, 400);
    return () => { cancelled = true; clearTimeout(handle); };
  }, [username, getToken, keepsSavedName]);

  if (!fontsLoaded) return null;

  const handleConfirm = async () => {
    const problem = validateUsername(username);
    if (problem) {
      setError(t(`username.${problem}`));
      return;
    }
    if (status === 'taken') {
      setError(t('username.errorTaken'));
      return;
    }
    if (keepsSavedName) {
      navigation.replace('Onboarding', { playerId });
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await patchMe({ clerkGetToken: getToken, fields: { username: username.trim() } });
      if (res.ok) {
        navigation.replace('Onboarding', { playerId });
        return;
      }
      if (res.status === 409) {
        setStatus('taken');
        setError(t('username.errorTaken'));
      } else if (res.status === 400) {
        setError(t('username.errorInvalidChars'));
      } else {
        setError(t('username.errorGeneric'));
      }
    } catch (err) {
      setError(t('username.errorGeneric'));
    } finally {
      setLoading(false);
    }
  };

  // The availability check is advisory — PATCH /me re-checks authoritatively on
  // submit — so a slow or failed check must never hard-block Next. Only an
  // explicit 'taken' (or an invalid shape) disables submission.
  // A symbol shows the moment it is typed (Figma A4c); NEXT stays disabled.
  const liveProblem = visibleProblem(username, { touched });
  const showErrorBorder = Boolean(error || liveProblem || status === 'taken');

  const disabled =
    loading ||
    validateUsername(username) !== null ||
    status === 'taken';

  if (figma) {
    const message = error
      || (liveProblem ? t(`username.${PROBLEM_KEYS[liveProblem]}`) : null)
      || (status === 'taken' ? t('username.errorTaken') : null);
    return (
      <KeyboardAvoidingView
        style={[figmaStyles.screen, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <OnboardingHeader title={t('username.title')} />
        <Text style={figmaStyles.subtitle}>
          {t('username.figmaSubtitle', { defaultValue: 'This is how the other Commanders will know you.' })}
        </Text>

        <Text style={figmaStyles.label}>{t('username.figmaLabel', { defaultValue: 'Commander name' })}</Text>
        <TextInput
          style={[figmaStyles.input, showErrorBorder && figmaStyles.inputError]}
          keyboardAppearance="dark"
          placeholder={t('username.placeholder')}
          placeholderTextColor={colors.muted}
          selectionColor={colors.lime}
          autoCapitalize="none"
          autoCorrect={false}
          value={username}
          onChangeText={(text) => { setUsername(text); setError(''); }}
          onBlur={() => setTouched(true)}
          maxLength={20}
          accessibilityLabel={t('username.figmaLabel', { defaultValue: 'Commander name' })}
          accessibilityHint={message || undefined}
        />
        {message ? (
          <Text style={figmaStyles.error} accessibilityLiveRegion="polite">{message}</Text>
        ) : null}
        <Text style={figmaStyles.helper}>
          {t('username.figmaHelper', { defaultValue: 'Names can’t contain symbols.' })}
        </Text>

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled }}
          onPress={handleConfirm}
          disabled={disabled}
          style={({ pressed }) => [
            figmaStyles.next,
            disabled && figmaStyles.nextDisabled,
            pressed && !disabled && figmaStyles.nextPressed,
          ]}
        >
          <Text style={[figmaStyles.nextText, disabled && figmaStyles.nextTextDisabled]}>
            {t('username.figmaNext', { defaultValue: 'Next' })}
          </Text>
        </Pressable>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <Text style={styles.title}>{t('username.title')}</Text>
        <Text style={styles.subtitle}>{t('username.subtitle')}</Text>

        <TextInput
          style={[styles.input, showErrorBorder && styles.inputError]}
          keyboardAppearance="dark"
          placeholder={t('username.placeholder')}
          placeholderTextColor="#6C6C69"
          autoCapitalize="none"
          value={username}
          onChangeText={(text) => { setUsername(text); setError(''); }}
          onBlur={() => setTouched(true)}
          maxLength={20}
        />

        {error ? (
          <Text style={styles.error}>{error}</Text>
        ) : liveProblem ? (
          <Text style={styles.error}>{t(`username.${PROBLEM_KEYS[liveProblem]}`)}</Text>
        ) : status === 'taken' ? (
          <Text style={styles.error}>{t('username.errorTaken')}</Text>
        ) : status === 'checking' ? (
          <Text style={styles.hint}>{t('username.checking')}</Text>
        ) : status === 'available' ? (
          <Text style={styles.available}>{t('username.available')}</Text>
        ) : null}
      </View>

      <View style={styles.buttonContainer}>
        <Pressable
          onPress={handleConfirm}
          disabled={disabled}
          style={({ pressed }) => [
            {
              backgroundColor: '#3155FF',
              paddingVertical: 14,
              width: '100%',
              alignItems: 'center',
            },
            disabled && { opacity: 0.5 },
            pressed && !disabled && { opacity: 0.9 },
          ]}
        >
          <Text
            style={{
              fontFamily: 'GeistMono_500Medium',
              fontSize: 14,
              letterSpacing: 2.4,
              color: '#F5F4EF',
              textTransform: 'uppercase',
            }}
          >
            {t('username.next')}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#101010',
    paddingHorizontal: 18,
    paddingTop: 48,
    paddingBottom: 24,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  buttonContainer: {
  },
  title: {
    fontFamily: 'SofiaSansExtraCondensed_800ExtraBold',
    color: '#F5F4EF',
    fontSize: 24,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    textAlign: 'left',
  },
  subtitle: {
    fontFamily: 'InstrumentSans_400Regular',
    color: '#A3A29F',
    fontSize: 13,
    marginBottom: 32,
    textAlign: 'left',
    lineHeight: 20,
  },
  input: {
    width: '100%',
    backgroundColor: '#1A1A1A',
    borderRadius: 0,
    borderWidth: 1,
    borderColor: 'rgba(245,244,239,0.16)',
    color: '#F5F4EF',
    fontSize: 15,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
  },
  inputError: { borderColor: '#E8432B' },
  error: {
    fontFamily: 'InstrumentSans_400Regular',
    color: '#E8432B',
    fontSize: 13,
    marginBottom: 12,
    textAlign: 'left',
  },
  hint: {
    fontFamily: 'InstrumentSans_400Regular',
    color: '#A3A29F',
    fontSize: 13,
    marginBottom: 12,
    textAlign: 'left',
  },
  available: {
    fontFamily: 'InstrumentSans_400Regular',
    color: '#4CAF50',
    fontSize: 13,
    marginBottom: 12,
    textAlign: 'left',
  },
});

// Updated UX A4: top-aligned, on lib/theme tokens.
const figmaStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.obsidian, paddingHorizontal: 24 },
  subtitle: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: colors.muted2, marginTop: 4, marginBottom: 16 },
  label: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.6,
    color: colors.muted2,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  input: {
    width: '100%',
    minHeight: 48,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    color: colors.white,
    fontFamily: fonts.mono,
    fontSize: 15,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  inputError: { borderColor: colors.danger },
  error: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.danger, marginTop: 8 },
  helper: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.muted, marginTop: 16 },
  next: {
    marginTop: 16,
    minHeight: 52,
    backgroundColor: colors.action,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextDisabled: { opacity: 0.45 },
  nextPressed: { backgroundColor: colors.actionPressed },
  nextText: { fontFamily: fonts.monoMedium, fontSize: 13, letterSpacing: 1.8, color: colors.white, textTransform: 'uppercase' },
  nextTextDisabled: { color: colors.muted2 },
});
