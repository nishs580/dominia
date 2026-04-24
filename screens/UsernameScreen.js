import { useFonts, Archivo_900Black } from '@expo-google-fonts/archivo';
import { GeistMono_400Regular, GeistMono_500Medium } from '@expo-google-fonts/geist-mono';
import { Inter_400Regular } from '@expo-google-fonts/inter';
import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { supabase } from '../lib/supabase';

export default function UsernameScreen({ navigation, route }) {
  const playerId = route.params?.playerId;
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [fontsLoaded] = useFonts({ Archivo_900Black, GeistMono_400Regular, GeistMono_500Medium, Inter_400Regular });
  if (!fontsLoaded) return null;

  const handleConfirm = async () => {
    if (!username.trim()) {
      setError('Please enter a username.');
      return;
    }
    if (username.length < 2) {
      setError('Username must be at least 2 characters.');
      return;
    }
    if (username.length > 20) {
      setError('Username must be 20 characters or less.');
      return;
    }
    if (!/^[a-zA-Z0-9._]+$/.test(username)) {
      setError('Only letters, numbers, dots and underscores allowed.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { error: updateError } = await supabase
        .from('players')
        .update({ username: username.trim() })
        .eq('id', playerId);
      if (updateError) throw updateError;
      navigation.replace('Onboarding', { playerId });
    } catch (err) {
      setError('Username already taken. Try another.');
    } finally {
      setLoading(false);
    }
  };

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
          autoCapitalize="none"
          value={username}
          onChangeText={setUsername}
          maxLength={20}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>

      <View style={styles.buttonContainer}>
        <Pressable
          onPress={handleConfirm}
          disabled={loading || username.trim().length < 2}
          style={({ pressed }) => [
            {
              backgroundColor: '#D64525',
              paddingVertical: 14,
              width: '100%',
              alignItems: 'center',
            },
            (loading || username.trim().length < 2) && { opacity: 0.5 },
            pressed && username.trim().length >= 2 && !loading && { opacity: 0.9 },
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
