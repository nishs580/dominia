import { useFonts, Archivo_900Black } from '@expo-google-fonts/archivo';
import { GeistMono_400Regular, GeistMono_500Medium } from '@expo-google-fonts/geist-mono';
import { Inter_400Regular } from '@expo-google-fonts/inter';
import { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { patchMe, checkUsernameAvailable } from '../lib/meApi';
import { logDebug } from '../lib/debug';

const USERNAME_RE = /^[a-zA-Z0-9._]+$/;

export default function UsernameScreen({ navigation, route }) {
  const playerId = route.params?.playerId;
  const { getToken } = useAuth();
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [availability, setAvailability] = useState('idle'); // idle | invalid | checking | available | taken
  const checkSeq = useRef(0);

  const [fontsLoaded] = useFonts({ Archivo_900Black, GeistMono_400Regular, GeistMono_500Medium, Inter_400Regular });

  // Debounced live availability check: validate format locally for instant
  // feedback, then ask the backend whether the name is free (the client can't
  // read `players` directly under RLS). A monotonic seq guards against a slow
  // earlier response landing after a newer keystroke.
  useEffect(() => {
    const value = username.trim();
    setError('');
    if (value.length === 0) {
      setAvailability('idle');
      return;
    }
    if (value.length < 2 || value.length > 20 || !USERNAME_RE.test(value)) {
      setAvailability('invalid');
      return;
    }
    setAvailability('checking');
    const seq = ++checkSeq.current;
    const timer = setTimeout(async () => {
      const res = await checkUsernameAvailable({ clerkGetToken: getToken, username: value });
      if (seq !== checkSeq.current) return; // a newer keystroke superseded this
      if (res.ok) {
        setAvailability(res.data?.available ? 'available' : 'taken');
      } else if (res.status === 400) {
        setAvailability('invalid');
      } else {
        // Network/unknown — don't hard-block; the submit path validates too.
        setAvailability('idle');
      }
    }, 450);
    return () => clearTimeout(timer);
  }, [username, getToken]);

  if (!fontsLoaded) return null;

  const canSubmit = availability === 'available' && !loading;

  const handleConfirm = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError('');
    try {
      const res = await patchMe({ clerkGetToken: getToken, fields: { username: username.trim().toUpperCase() } });
      if (!res.ok) {
        if (res.status === 409 || res.status === 400) {
          setAvailability('taken');
          setError('That name was just taken. Try another.');
        } else {
          setError('Couldn’t save. Check your connection and try again.');
        }
        return;
      }
      logDebug(playerId, 'onboarding_username_set', {});
      navigation.replace('Onboarding', { playerId });
    } catch (err) {
      setError('Couldn’t save. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const statusText =
    availability === 'checking' ? 'Checking…'
    : availability === 'available' ? 'Available'
    : availability === 'taken' ? 'Taken — try another.'
    : availability === 'invalid' ? 'Use 2–20 letters, numbers, dots or underscores.'
    : '';
  const statusColor =
    availability === 'available' ? '#5FA45A'
    : availability === 'checking' ? '#8B8F98'
    : '#D64525';

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <Text style={styles.title}>Choose your name</Text>
        <Text style={styles.subtitle}>This is how other Commanders will know you.</Text>

        <TextInput
          style={styles.input}
          placeholder="Commander name"
          placeholderTextColor="#5C6068"
          autoCapitalize="characters"
          autoCorrect={false}
          value={username}
          onChangeText={(t) => setUsername(t.toUpperCase())}
          maxLength={20}
        />

        {error ? (
          <Text style={styles.error}>{error}</Text>
        ) : statusText ? (
          <Text style={[styles.error, { color: statusColor }]}>{statusText}</Text>
        ) : null}
      </View>

      <View style={styles.buttonContainer}>
        <Pressable
          onPress={handleConfirm}
          disabled={!canSubmit}
          style={({ pressed }) => [
            {
              backgroundColor: '#D64525',
              paddingVertical: 14,
              width: '100%',
              alignItems: 'center',
            },
            !canSubmit && { opacity: 0.5 },
            pressed && canSubmit && { opacity: 0.9 },
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
            Next →
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
});
