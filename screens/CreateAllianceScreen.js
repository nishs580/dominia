import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';

const BG = '#0f0f14';
const ORANGE = '#ED9332';

export default function CreateAllianceScreen() {
  const navigation = useNavigation();
  const { userId } = useAuth();

  const [step, setStep] = useState(1);
  const [playerId, setPlayerId] = useState(null);
  const [playerLoading, setPlayerLoading] = useState(true);

  const [allianceName, setAllianceName] = useState('');
  const [code, setCode] = useState('');
  const [nameError, setNameError] = useState('');
  const [codeError, setCodeError] = useState('');

  const [territories, setTerritories] = useState([]);
  const [territoriesLoading, setTerritoriesLoading] = useState(false);
  const [selectedTerritoryId, setSelectedTerritoryId] = useState(null);

  const [createSaving, setCreateSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadPlayer() {
      if (!userId) {
        setPlayerId(null);
        setPlayerLoading(false);
        return;
      }
      setPlayerLoading(true);
      try {
        const { data, error } = await supabase.from('players').select('id').eq('clerk_id', userId).maybeSingle();
        if (cancelled) return;
        if (error) {
          console.error('CreateAllianceScreen player fetch:', error);
          setPlayerId(null);
        } else {
          setPlayerId(data?.id ?? null);
        }
      } finally {
        if (!cancelled) setPlayerLoading(false);
      }
    }
    loadPlayer();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (step !== 2 || !playerId) return;
    let cancelled = false;
    async function loadTerritories() {
      setTerritoriesLoading(true);
      try {
        const { data, error } = await supabase
          .from('territories')
          .select('id, territory_name, tier')
          .eq('owner_id', playerId);
        if (cancelled) return;
        if (error) {
          console.error('CreateAllianceScreen territories:', error);
          setTerritories([]);
        } else {
          setTerritories(data ?? []);
        }
      } finally {
        if (!cancelled) setTerritoriesLoading(false);
      }
    }
    loadTerritories();
    return () => {
      cancelled = true;
    };
  }, [step, playerId]);

  const handleBack = () => {
    if (step === 1) {
      navigation.goBack();
    } else {
      setStep((s) => s - 1);
    }
  };

  const validateStep1Local = () => {
    const nameTrim = allianceName.trim();
    const codeUpper = code.trim().toUpperCase();
    let nErr = '';
    let cErr = '';
    if (!nameTrim) {
      nErr = 'Enter an alliance name.';
    } else if (nameTrim.length < 3) {
      nErr = 'Name must be at least 3 characters.';
    }
    if (!codeUpper) {
      cErr = 'Enter a 3-letter code.';
    } else if (codeUpper.length !== 3) {
      cErr = 'Code must be exactly 3 letters.';
    }
    setNameError(nErr);
    setCodeError(cErr);
    return { ok: !nErr && !cErr, nameTrim, codeUpper };
  };

  const handleStep1Next = async () => {
    const { ok, nameTrim, codeUpper } = validateStep1Local();
    if (!ok) return;

    const { data, error } = await supabase.from('alliances').select('id').eq('short_name', codeUpper).maybeSingle();
    if (error) {
      console.error('CreateAllianceScreen code check:', error);
      Alert.alert('Could not verify code', error.message ?? 'Please try again.');
      return;
    }
    if (data) {
      setCodeError('That code is taken.');
      return;
    }
    setAllianceName(nameTrim);
    setCode(codeUpper);
    setStep(2);
  };

  const selectedTerritory = territories.find((t) => t.id === selectedTerritoryId);

  const handleCreate = async () => {
    if (!userId || !playerId || !selectedTerritory) return;
    setCreateSaving(true);
    try {
      const { data: inserted, error: insertError } = await supabase
        .from('alliances')
        .insert({
          name: allianceName.trim(),
          short_name: code.trim().toUpperCase(),
          city: 'Amsterdam',
          founder_id: playerId,
        })
        .select('id')
        .single();

      if (insertError) throw insertError;
      const newAllianceId = inserted?.id;
      if (!newAllianceId) throw new Error('No alliance id returned');

      const { error: updateError } = await supabase
        .from('players')
        .update({ alliance_id: newAllianceId })
        .eq('clerk_id', userId);

      if (updateError) throw updateError;

      await supabase
        .from('territories')
        .update({ alliance_id: newAllianceId })
        .eq('owner_id', playerId);

      navigation.replace('AllianceJoined', {
        allianceName: allianceName.trim(),
        shortName: code.trim().toUpperCase(),
        city: 'Amsterdam',
        memberCount: 1,
      });
    } catch (err) {
      console.error('Create alliance failed:', err);
      Alert.alert('Could not create alliance', err?.message ?? 'Please try again.');
    } finally {
      setCreateSaving(false);
    }
  };

  const renderBackRow = () => (
    <View style={styles.backRow}>
      <Pressable
        accessibilityRole="button"
        onPress={handleBack}
        hitSlop={12}
        style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.75 }]}
      >
        <Text style={styles.backBtnText}>‹ Back</Text>
      </Pressable>
    </View>
  );

  return (
    <View style={styles.screen}>
      {renderBackRow()}

      {step === 1 && (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.headerKicker}>CREATE ALLIANCE</Text>
          <Text style={styles.stepTitle}>Alliance identity</Text>

          <Text style={styles.label}>Alliance name</Text>
          <TextInput
            style={styles.input}
            placeholder="Alliance name"
            placeholderTextColor="#555"
            value={allianceName}
            onChangeText={(t) => {
              setAllianceName(t);
              if (nameError) setNameError('');
            }}
            autoCapitalize="words"
            autoCorrect
          />
          {nameError ? <Text style={styles.fieldError}>{nameError}</Text> : null}

          <Text style={[styles.label, { marginTop: 14 }]}>3-letter code</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. SNW"
            placeholderTextColor="#555"
            value={code}
            onChangeText={(t) => {
              setCode(t.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3));
              if (codeError) setCodeError('');
            }}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={3}
          />
          {codeError ? <Text style={styles.fieldError}>{codeError}</Text> : null}

          <Pressable
            accessibilityRole="button"
            onPress={handleStep1Next}
            style={({ pressed }) => [styles.btnPrimary, pressed && { opacity: 0.9 }]}
          >
            <Text style={styles.btnPrimaryText}>Next</Text>
          </Pressable>
        </ScrollView>
      )}

      {step === 2 && (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.headerKicker}>CREATE ALLIANCE</Text>
          <Text style={styles.stepTitle}>HQ territory</Text>

          {playerLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator color={ORANGE} />
            </View>
          ) : !playerId ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptySubtitle}>Could not load your player profile. Try again later.</Text>
            </View>
          ) : territoriesLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator color={ORANGE} />
            </View>
          ) : territories.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptySubtitle}>
                You need to own at least one territory to place your HQ. Claim one from the map first.
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setStep(1)}
                style={({ pressed }) => [styles.btnMuted, pressed && { opacity: 0.9 }]}
              >
                <Text style={styles.btnMutedText}>Back</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={{ marginTop: 8, gap: 10 }}>
                {territories.map((t) => {
                  const selected = t.id === selectedTerritoryId;
                  return (
                    <Pressable
                      key={t.id}
                      accessibilityRole="button"
                      onPress={() => setSelectedTerritoryId(t.id)}
                      style={({ pressed }) => [
                        styles.territoryCard,
                        selected && styles.territoryCardSelected,
                        pressed && { opacity: 0.92 },
                      ]}
                    >
                      <Text style={styles.territoryName}>{t.territory_name ?? '—'}</Text>
                      <Text style={styles.territoryMeta}>Tier {t.tier ?? '—'}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Pressable
                accessibilityRole="button"
                disabled={!selectedTerritoryId}
                onPress={() => setStep(3)}
                style={({ pressed }) => [
                  styles.btnPrimary,
                  !selectedTerritoryId && { opacity: 0.5 },
                  pressed && selectedTerritoryId && { opacity: 0.9 },
                ]}
              >
                <Text style={styles.btnPrimaryText}>Next</Text>
              </Pressable>
            </>
          )}
        </ScrollView>
      )}

      {step === 3 && (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.headerKicker}>CREATE ALLIANCE</Text>
          <Text style={styles.stepTitle}>Confirm</Text>

          <View style={styles.summaryBlock}>
            <Text style={styles.summaryLabel}>Alliance</Text>
            <Text style={styles.summaryValue}>{allianceName.trim()}</Text>
            <Text style={[styles.summaryLabel, { marginTop: 12 }]}>Code</Text>
            <Text style={styles.summaryValue}>[{code.trim().toUpperCase()}]</Text>
            <Text style={[styles.summaryLabel, { marginTop: 12 }]}>HQ territory</Text>
            <Text style={styles.summaryValue}>{selectedTerritory?.territory_name ?? '—'}</Text>
          </View>

          <Pressable
            accessibilityRole="button"
            disabled={createSaving}
            onPress={handleCreate}
            style={({ pressed }) => [
              styles.btnPrimary,
              createSaving && { opacity: 0.7 },
              pressed && !createSaving && { opacity: 0.9 },
            ]}
          >
            {createSaving ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.btnPrimaryText}>Create {allianceName.trim()}</Text>
            )}
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BG,
  },
  backRow: {
    paddingHorizontal: 16,
    paddingTop: 52,
    paddingBottom: 4,
    alignItems: 'flex-start',
  },
  backBtn: {
    paddingVertical: 4,
  },
  backBtnText: {
    color: ORANGE,
    fontSize: 15,
    fontWeight: '700',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 28,
  },
  headerKicker: {
    color: '#555',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  stepTitle: {
    marginTop: 8,
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 16,
  },
  label: {
    color: '#666',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  fieldError: {
    marginTop: 6,
    color: '#c96',
    fontSize: 11,
    fontWeight: '600',
  },
  btnPrimary: {
    marginTop: 22,
    width: '100%',
    backgroundColor: ORANGE,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  btnPrimaryText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  btnMuted: {
    marginTop: 18,
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnMutedText: {
    color: '#aaa',
    fontSize: 15,
    fontWeight: '700',
  },
  centered: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyWrap: {
    alignItems: 'center',
    marginTop: 12,
  },
  emptySubtitle: {
    color: '#555',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 16.5,
    paddingHorizontal: 8,
  },
  territoryCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 8,
    padding: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  territoryCardSelected: {
    borderColor: ORANGE,
  },
  territoryName: {
    color: '#ccc',
    fontSize: 14,
    fontWeight: '600',
  },
  territoryMeta: {
    marginTop: 4,
    color: '#555',
    fontSize: 10,
    fontWeight: '600',
  },
  summaryBlock: {
    marginTop: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 8,
    padding: 14,
  },
  summaryLabel: {
    color: '#555',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  summaryValue: {
    marginTop: 4,
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
});
