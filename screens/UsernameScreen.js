import { useFonts, Archivo_900Black } from '@expo-google-fonts/archivo';
import { GeistMono_400Regular, GeistMono_500Medium } from '@expo-google-fonts/geist-mono';
import { Inter_400Regular } from '@expo-google-fonts/inter';
import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@clerk/clerk-expo';
import { useTranslation } from 'react-i18next';
import { checkUsernameAvailable, patchMe } from '../lib/meApi';

// Client-side validation mirrors the backend's normalizeUsername rules.
// Returns an i18n error key, or null when the shape is valid.
function validateUsername(name) {
  const v = name.trim();
  if (!v) return 'errorEmpty';
  if (v.length < 2) return 'errorTooShort';
  if (v.length > 20) return 'errorTooLong';
  if (!/^[a-zA-Z0-9._]+$/.test(v)) return 'errorInvalidChars';
  return null;
}

export default function UsernameScreen({ navigation, route }) {
  const playerId = route.params?.playerId;
  const { t } = useTranslation();
  const { getToken } = useAuth();
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // 'idle' | 'checking' | 'available' | 'taken'
  const [status, setStatus] = useState('idle');
  const insets = useSafeAreaInsets();

  const [fontsLoaded] = useFonts({ Archivo_900Black, GeistMono_400Regular, GeistMono_500Medium, Inter_400Regular });

  // Debounced availability check: only fires once the name is well-formed.
  // Advisory only — PATCH /me re-checks authoritatively on submit.
  useEffect(() => {
    if (validateUsername(username) !== null) {
      setStatus('idle');
      return;
    }
    setStatus('checking');
    let cancelled = false;
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
  }, [username, getToken]);

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

  const disabled =
    loading ||
    validateUsername(username) !== null ||
    status === 'checking' ||
    status === 'taken';

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <Text style={styles.title}>{t('username.title')}</Text>
        <Text style={styles.subtitle}>{t('username.subtitle')}</Text>

        <TextInput
          style={styles.input}
          placeholder={t('username.placeholder')}
          placeholderTextColor="#5C6068"
          autoCapitalize="none"
          value={username}
          onChangeText={(text) => { setUsername(text); setError(''); }}
          maxLength={20}
        />

        {error ? (
          <Text style={styles.error}>{error}</Text>
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
              backgroundColor: '#D64525',
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
              color: '#F2EEE6',
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
    backgroundColor: '#0E1014',
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
    fontFamily: 'Archivo_900Black',
    color: '#F2EEE6',
    fontSize: 24,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    textAlign: 'left',
  },
  subtitle: {
    fontFamily: 'Inter_400Regular',
    color: '#8B8F98',
    fontSize: 13,
    marginBottom: 32,
    textAlign: 'left',
    lineHeight: 20,
  },
  input: {
    width: '100%',
    backgroundColor: '#1A1D24',
    borderRadius: 0,
    borderWidth: 1,
    borderColor: 'rgba(242,238,230,0.16)',
    color: '#F2EEE6',
    fontSize: 15,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
  },
  error: {
    fontFamily: 'Inter_400Regular',
    color: '#D64525',
    fontSize: 13,
    marginBottom: 12,
    textAlign: 'left',
  },
  hint: {
    fontFamily: 'Inter_400Regular',
    color: '#8B8F98',
    fontSize: 13,
    marginBottom: 12,
    textAlign: 'left',
  },
  available: {
    fontFamily: 'Inter_400Regular',
    color: '#4CAF50',
    fontSize: 13,
    marginBottom: 12,
    textAlign: 'left',
  },
});
