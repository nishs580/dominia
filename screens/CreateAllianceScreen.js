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
import THEME from '../lib/theme';

const INK = THEME.colors.ink;
const INK_2 = THEME.colors.ink2;
const BONE = THEME.colors.bone;
const BONE_2 = THEME.colors.bone2;
const SLATE = THEME.colors.slate;
const SLATE_2 = THEME.colors.slate2;
const CLAIM = THEME.colors.claim;
const HAIRLINE = THEME.colors.hairline;
const HAIRLINE_STRONG = THEME.colors.hairlineStrong;

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
        <Text style={styles.backBtnText}>← BACK</Text>
      </Pressable>
    </View>
  );

  const formatTierLabel = (tier) => {
    if (tier === null || tier === undefined || tier === '') return '—';
    if (typeof tier === 'string') return tier.charAt(0).toUpperCase() + tier.slice(1);
    return `Tier ${tier}`;
  };

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
          <View style={styles.kickerRow}>
            <Text style={styles.kickerText}>Create Alliance · 01 / 03</Text>
            <View style={styles.kickerRule} />
          </View>

          <Text style={styles.stepTitle}>Name{'\n'}your alliance</Text>
          <Text style={styles.bodyText}>
            Both names are permanent. The short name cannot be changed after founding.
          </Text>

          <View style={styles.labelRow}>
            <Text style={styles.labelText}>Full name</Text>
            <Text style={styles.labelHint}>3–24 characters</Text>
          </View>
          {nameError ? <Text style={styles.fieldError}>{nameError}</Text> : null}
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

          <View style={styles.labelRow}>
            <Text style={styles.labelText}>Short name</Text>
            <Text style={styles.labelHint}>3 letters · used in [TAG]</Text>
          </View>
          <TextInput
            style={[
              styles.input,
              { fontFamily: 'GeistMono_500Medium', letterSpacing: 4, fontSize: 18 },
            ]}
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
          {codeError ? (
            <Text style={styles.fieldError}>{codeError}</Text>
          ) : (
            <Text style={styles.micro}>Displayed in brackets — [{code || 'XXX'}]</Text>
          )}

          <Pressable
            accessibilityRole="button"
            onPress={handleStep1Next}
            disabled={false}
            style={({ pressed }) => [
              styles.cta,
              pressed && { opacity: 0.9 },
            ]}
          >
            <Text style={styles.ctaStep}>Step 01 of 03</Text>
            <Text style={styles.ctaAction}>Continue →</Text>
          </Pressable>
        </ScrollView>
      )}

      {step === 2 && (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.kickerRow}>
            <Text style={styles.kickerText}>Create Alliance · 02 / 03</Text>
            <View style={styles.kickerRule} />
          </View>

          <Text style={[styles.stepTitle, styles.stepTitleSmall]}>Choose your{'\n'}HQ territory</Text>
          <Text style={styles.bodyText}>
            Your HQ anchors the alliance on the map. Choose a territory you already hold.
          </Text>

          {playerLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator color={CLAIM} />
            </View>
          ) : !playerId ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptySubtitle}>Could not load your player profile. Try again later.</Text>
            </View>
          ) : territoriesLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator color={CLAIM} />
            </View>
          ) : territories.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptySubtitle}>You hold no territories yet. Claim one from the map before founding an alliance.</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setStep(1)}
                style={({ pressed }) => [
                  styles.cta,
                  styles.ctaDisabled,
                  pressed && { opacity: 0.9 },
                ]}
              >
                <Text style={[styles.ctaStep, styles.ctaStepDisabled]}>No territories</Text>
                <Text style={[styles.ctaAction, styles.ctaActionDisabled]}>← Back</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={styles.tList}>
                {territories.map((t) => {
                  const selected = t.id === selectedTerritoryId;
                  const tierLabel = formatTierLabel(t.tier);
                  const perimeter = t?.perimeter_distance;
                  const meta =
                    perimeter === null || perimeter === undefined || perimeter === ''
                      ? tierLabel
                      : `${tierLabel} · ${perimeter} m perimeter`;
                  return (
                    <Pressable
                      key={t.id}
                      accessibilityRole="button"
                      onPress={() => setSelectedTerritoryId(t.id)}
                      style={({ pressed }) => [styles.tRow, selected && styles.tRowSelected, pressed && { opacity: 0.92 }]}
                    >
                      <View style={styles.tInfo}>
                        <Text style={styles.tName}>{t.territory_name ?? '—'}</Text>
                        <Text style={styles.tMeta}>{meta}</Text>
                      </View>
                      {selected ? <Text style={styles.tTag}>Selected</Text> : null}
                    </Pressable>
                  );
                })}
              </View>
              <Pressable
                accessibilityRole="button"
                disabled={!selectedTerritoryId}
                onPress={() => setStep(3)}
                style={({ pressed }) => [
                  styles.cta,
                  !selectedTerritoryId && styles.ctaDisabled,
                  pressed && selectedTerritoryId && { opacity: 0.9 },
                ]}
              >
                <Text style={[styles.ctaStep, !selectedTerritoryId && styles.ctaStepDisabled]}>Step 02 of 03</Text>
                <Text style={[styles.ctaAction, !selectedTerritoryId && styles.ctaActionDisabled]}>Continue →</Text>
              </Pressable>
            </>
          )}
        </ScrollView>
      )}

      {step === 3 && (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.kickerRow}>
            <Text style={styles.kickerText}>Create Alliance · 03 / 03</Text>
            <View style={styles.kickerRule} />
          </View>

          <Text style={[styles.stepTitle, styles.stepTitleSmall]}>Confirm.{'\n'}Then create.</Text>
          <Text style={styles.bodyText}>Founding is permanent. The short name cannot be changed.</Text>

          <View style={styles.sumList}>
            <View style={styles.sumRow}>
              <Text style={styles.sumLabel}>Alliance</Text>
              <Text style={styles.sumValue}>{allianceName.trim()}</Text>
            </View>
            <View style={styles.sumRow}>
              <Text style={styles.sumLabel}>Tag</Text>
              <Text style={[styles.sumValue, styles.sumValueMono]}>[{code.trim().toUpperCase()}]</Text>
            </View>
            <View style={styles.sumRow}>
              <Text style={styles.sumLabel}>HQ</Text>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                <Text style={styles.sumValue}>{selectedTerritory?.territory_name ?? '—'}</Text>
                <Text style={styles.sumHomeTag}>Home</Text>
              </View>
            </View>
            <View style={styles.sumRow}>
              <Text style={styles.sumLabel}>City</Text>
              <Text style={styles.sumValue}>Amsterdam</Text>
            </View>
          </View>

          <Pressable
            accessibilityRole="button"
            disabled={createSaving}
            onPress={handleCreate}
            style={({ pressed }) => [
              styles.cta,
              createSaving && styles.ctaDisabled,
              pressed && !createSaving && { opacity: 0.9 },
            ]}
          >
            {createSaving ? (
              <ActivityIndicator color={BONE} />
            ) : (
              <>
                <Text style={[styles.ctaStep, createSaving && styles.ctaStepDisabled]}>Final step · permanent</Text>
                <Text style={[styles.ctaAction, createSaving && styles.ctaActionDisabled]}>
                  Create {allianceName.trim()} →
                </Text>
              </>
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
    backgroundColor: INK,
  },
  backRow: {
    paddingHorizontal: 20,
    paddingTop: 52,
    paddingBottom: 0,
    alignItems: 'flex-start',
  },
  backBtn: {
    paddingVertical: 4,
    marginBottom: 24,
  },
  backBtnText: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 11,
    letterSpacing: 1.6,
    color: SLATE,
    textTransform: 'uppercase',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  kickerText: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 10,
    letterSpacing: 1.8,
    color: SLATE_2,
    textTransform: 'uppercase',
  },
  kickerRule: {
    flex: 1,
    height: 1,
    backgroundColor: HAIRLINE_STRONG,
  },
  stepTitle: {
    fontFamily: 'Archivo_900Black',
    fontSize: 28,
    color: BONE,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    lineHeight: 30,
    marginTop: 0,
    marginBottom: 24,
  },
  stepTitleSmall: {
    fontSize: 24,
  },
  bodyText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: SLATE_2,
    lineHeight: 20,
    marginBottom: 20,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  labelText: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 10,
    letterSpacing: 1.8,
    color: SLATE_2,
    textTransform: 'uppercase',
  },
  labelHint: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 10,
    letterSpacing: 1.4,
    color: SLATE,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: INK_2,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: HAIRLINE,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: BONE,
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
    marginBottom: 18,
  },
  fieldError: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 10,
    letterSpacing: 1.4,
    color: SLATE_2,
    textTransform: 'uppercase',
    marginTop: -10,
    marginBottom: 18,
  },
  micro: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 10,
    letterSpacing: 1.4,
    color: SLATE,
    textTransform: 'uppercase',
    marginTop: -10,
    marginBottom: 18,
    lineHeight: 14,
  },
  cta: {
    backgroundColor: CLAIM,
    borderRadius: 0,
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginTop: 32,
    alignItems: 'flex-start',
  },
  ctaDisabled: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: HAIRLINE_STRONG,
  },
  ctaStep: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 9,
    letterSpacing: 1.6,
    color: BONE,
    opacity: 0.75,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  ctaStepDisabled: {
    color: SLATE,
    opacity: 1,
  },
  ctaAction: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 16,
    letterSpacing: 1.6,
    color: BONE,
    textTransform: 'uppercase',
  },
  ctaActionDisabled: {
    color: SLATE,
  },
  centered: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  emptyWrap: {
    marginTop: 16,
  },
  emptySubtitle: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 11,
    letterSpacing: 1.2,
    color: SLATE_2,
    textTransform: 'uppercase',
    lineHeight: 16,
    textAlign: 'left',
    marginBottom: 20,
  },
  tList: {
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: HAIRLINE,
  },
  tRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: HAIRLINE,
  },
  tRowSelected: {
    backgroundColor: 'rgba(242,238,230,0.04)',
    borderLeftWidth: 1,
    borderLeftColor: BONE_2,
    paddingLeft: 11,
  },
  tInfo: {
    flex: 1,
  },
  tName: {
    fontFamily: 'Inter_500Medium',
    fontSize: 15,
    color: BONE,
  },
  tMeta: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 10,
    letterSpacing: 1,
    color: SLATE_2,
    textTransform: 'uppercase',
    marginTop: 3,
  },
  tTag: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 9,
    letterSpacing: 1.4,
    color: BONE,
    textTransform: 'uppercase',
    marginLeft: 12,
  },
  sumList: {
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: HAIRLINE,
  },
  sumRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: HAIRLINE,
  },
  sumLabel: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 10,
    letterSpacing: 1.6,
    color: SLATE_2,
    textTransform: 'uppercase',
    width: 100,
  },
  sumValue: {
    flex: 1,
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
    color: BONE,
  },
  sumValueMono: {
    fontFamily: 'GeistMono_500Medium',
    letterSpacing: 2,
  },
  sumHomeTag: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 9,
    letterSpacing: 1.5,
    color: BONE,
    textTransform: 'uppercase',
    paddingHorizontal: 7,
    paddingVertical: 3,
    backgroundColor: 'rgba(242,238,230,0.06)',
    marginLeft: 8,
  },
});
