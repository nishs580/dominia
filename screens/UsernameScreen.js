import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { supabase } from '../lib/supabase';

export default function UsernameScreen({ navigation }) {
  const { userId } = useAuth();
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (!username.trim()) {
      setError('Please enter a username.');
      return;
    }
    if (username.length < 3) {
      setError('Username must be at least 3 characters.');
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
        .eq('clerk_id', userId);
      if (updateError) throw updateError;
      navigation.replace('MainTabs');
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
      <Text style={styles.title}>Choose your name</Text>
      <Text style={styles.subtitle}>This is how other Commanders will know you.</Text>

      <TextInput
        style={styles.input}
        placeholder="Commander name"
        placeholderTextColor="#64748B"
        autoCapitalize="none"
        value={username}
        onChangeText={setUsername}
        maxLength={20}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        style={[styles.button, loading && { opacity: 0.7 }]}
        onPress={handleConfirm}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Please wait...' : 'Enter the map'}
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
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -1,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 48,
    textAlign: 'center',
    lineHeight: 22,
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
});
