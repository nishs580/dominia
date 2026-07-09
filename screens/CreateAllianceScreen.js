import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@clerk/clerk-expo';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { foundAlliance } from '../lib/allianceApi';
import { supabase } from '../lib/supabase';
import THEME from '../lib/theme';
import AllianceEmblem from '../components/AllianceEmblem';
import { ALLIANCE_EMBLEMS, DEFAULT_ALLIANCE_EMBLEM } from '../lib/allianceEmblems';

const INK = THEME.colors.ink;
const INK_2 = THEME.colors.ink2;
const BONE = THEME.colors.bone;
const BONE_2 = THEME.colors.bone2;
const SLATE = THEME.colors.slate;
const SLATE_2 = THEME.colors.slate2;
const CLAIM = THEME.colors.claim;
const HAIRLINE = THEME.colors.hairline;
const HAIRLINE_STRONG = THEME.colors.hairlineStrong;

function mapFoundAllianceError(t, error) {
  const code = error?.code ?? null;
  switch (code) {
    case 'short_name_taken':
      return t('createAlliance.errShortNameTaken');
    case 'invalid_short_name':
      return t('createAlliance.errInvalidShortName');
    case 'invalid_full_name':
      return t('createAlliance.errInvalidFullName');
    case 'already_in_alliance':
      return t('createAlliance.errAlreadyInAlliance');
    case 'hq_not_owned':
      return t('createAlliance.errHqNotOwned');
    case 'hq_city_mismatch':
      return t('createAlliance.errHqCityMismatch');
    case 'level_too_low':
      return t('createAlliance.errLevelTooLow');
    case 'player_not_found':
      return t('createAlliance.errPlayerNotFound');
    default:
      return t('createAlliance.errGeneric');
  }
}

export default function CreateAllianceScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { userId, getToken } = useAuth();

  const [step, setStep] = useState(1);
  const [playerId, setPlayerId] = useState(null);
  const [homeCity, setHomeCity] = useState(null);
  const [playerLoading, setPlayerLoading] = useState(true);

  const [allianceName, setAllianceName] = useState('');
  const [code, setCode] = useState('');
  const [emblem, setEmblem] = useState(DEFAULT_ALLIANCE_EMBLEM);
  const [nameError, setNameError] = useState('');
  const [codeError, setCodeError] = useState('');

  const [territories, setTerritories] = useState([]);
  const [territoriesLoading, setTerritoriesLoading] = useState(false);
  const [selectedTerritoryId, setSelectedTerritoryId] = useState(null);

  const [createSaving, setCreateSaving] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function loadPlayer() {
      if (!userId) {
        setPlayerId(null);
        setHomeCity(null);
        setPlayerLoading(false);
        return;
      }
      setPlayerLoading(true);
      try {
        const { data, error } = await supabase.from('players').select('id, home_city').eq('clerk_id', userId).maybeSingle();
        if (cancelled) return;
        if (error) {
          console.error('CreateAllianceScreen player fetch:', error);
          setPlayerId(null);
          setHomeCity(null);
        } else {
          setPlayerId(data?.id ?? null);
          setHomeCity(data?.home_city ?? null);
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
      nErr = t('createAlliance.errEnterName');
    } else if (nameTrim.length < 3) {
      nErr = t('createAlliance.errNameTooShort');
    }
    if (!codeUpper) {
      cErr = t('createAlliance.errEnterCode');
    } else if (codeUpper.length !== 3) {
      cErr = t('createAlliance.errCodeLength');
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
    } else if (data) {
      setCodeError(t('createAlliance.errCodeTaken'));
      return;
    }
    setAllianceName(nameTrim);
    setCode(codeUpper);
    setStep(2);
  };

  const selectedTerritory = territories.find((t) => t.id === selectedTerritoryId);

  const handleCreate = async () => {
    if (!userId || !playerId || !selectedTerritory || createSaving) return;
    setCreateSaving(true);
    setSubmitError('');
    try {
      const result = await foundAlliance({
        clerkGetToken: getToken,
        fullName: allianceName.trim(),
        shortName: code.trim().toUpperCase(),
        hqTerritoryId: selectedTerritory.id,
        emblem,
      });

      if (result.ok) {
        navigation.navigate('AllianceJoined', { allianceId: result.data.alliance.id });
        return;
      }

      setSubmitError(mapFoundAllianceError(t, result.error));
    } catch (err) {
      console.error('Create alliance failed:', err);
      setSubmitError(t('createAlliance.errGeneric'));
    } finally {
      setCreateSaving(false);
    }
  };

  const renderBackRow = () => (
    <View style={[styles.backRow, { paddingTop: insets.top + 16 }]}>
      <Pressable
        accessibilityRole="button"
        onPress={handleBack}
        hitSlop={12}
        style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.75 }]}
      >
        <Text style={styles.backBtnText}>{t('createAlliance.back')}</Text>
      </Pressable>
    </View>
  );

  const formatTierLabel = (tier) => {
    if (tier === null || tier === undefined || tier === '') return '—';
    if (typeof tier === 'string') return tier.charAt(0).toUpperCase() + tier.slice(1);
    return t('createAlliance.tierN', { n: tier });
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {renderBackRow()}

      {step === 1 && (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.kickerRow}>
            <Text style={styles.kickerText}>{t('createAlliance.kicker', { step: '01' })}</Text>
            <View style={styles.kickerRule} />
          </View>

          <Text style={styles.stepTitle}>{t('createAlliance.step1Title')}</Text>
          <Text style={styles.bodyText}>
            {t('createAlliance.step1Body')}
          </Text>

          <View style={styles.labelRow}>
            <Text style={styles.labelText}>{t('createAlliance.fullName')}</Text>
            <Text style={styles.labelHint}>{t('createAlliance.fullNameHint')}</Text>
          </View>
          {nameError ? <Text style={styles.fieldError}>{nameError}</Text> : null}
          <TextInput
            style={styles.input}
            placeholder={t('createAlliance.namePlaceholder')}
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
            <Text style={styles.labelText}>{t('createAlliance.shortName')}</Text>
            <Text style={styles.labelHint}>{t('createAlliance.shortNameHint')}</Text>
          </View>
          <TextInput
            style={[
              styles.input,
              { fontFamily: 'GeistMono_500Medium', letterSpacing: 4, fontSize: 18 },
            ]}
            placeholder={t('createAlliance.shortNamePlaceholder')}
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
            <Text style={styles.micro}>{t('createAlliance.displayedInBrackets', { code: code || 'XXX' })}</Text>
          )}

          <View style={styles.labelRow}>
            <Text style={styles.labelText}>{t('createAlliance.emblem')}</Text>
            <Text style={styles.labelHint}>{t('createAlliance.emblemHint')}</Text>
          </View>
          <View style={styles.emblemGrid}>
            {ALLIANCE_EMBLEMS.map((key) => {
              const isSelected = key === emblem;
              return (
                <Pressable
                  key={key}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => setEmblem(key)}
                  style={({ pressed }) => [
                    styles.emblemCell,
                    isSelected && styles.emblemCellSelected,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <AllianceEmblem emblem={key} size={44} />
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.micro}>{t(`emblems.${emblem}`)}</Text>

          <Pressable
            accessibilityRole="button"
            onPress={handleStep1Next}
            disabled={false}
            style={({ pressed }) => [
              styles.cta,
              pressed && { opacity: 0.9 },
            ]}
          >
            <Text style={styles.ctaStep}>{t('createAlliance.stepOf', { n: '01' })}</Text>
            <Text style={styles.ctaAction}>{t('createAlliance.continue')}</Text>
          </Pressable>
        </ScrollView>
      )}

      {step === 2 && (
        <ScrollView style={styles.scroll} contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]} showsVerticalScrollIndicator={false}>
          <View style={styles.kickerRow}>
            <Text style={styles.kickerText}>{t('createAlliance.kicker', { step: '02' })}</Text>
            <View style={styles.kickerRule} />
          </View>

          <Text style={[styles.stepTitle, styles.stepTitleSmall]}>{t('createAlliance.step2Title')}</Text>
          <Text style={styles.bodyText}>
            {t('createAlliance.step2Body')}
          </Text>

          {playerLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator color={CLAIM} />
            </View>
          ) : !playerId ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptySubtitle}>{t('createAlliance.couldNotLoadProfile')}</Text>
            </View>
          ) : territoriesLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator color={CLAIM} />
            </View>
          ) : territories.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptySubtitle}>{t('createAlliance.noTerritories')}</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setStep(1)}
                style={({ pressed }) => [
                  styles.cta,
                  styles.ctaDisabled,
                  pressed && { opacity: 0.9 },
                ]}
              >
                <Text style={[styles.ctaStep, styles.ctaStepDisabled]}>{t('createAlliance.noTerritoriesStep')}</Text>
                <Text style={[styles.ctaAction, styles.ctaActionDisabled]}>{t('createAlliance.backAction')}</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={styles.tList}>
                {territories.map((terr) => {
                  const selected = terr.id === selectedTerritoryId;
                  const tierLabel = formatTierLabel(terr.tier);
                  const perimeter = terr?.perimeter_distance;
                  const meta =
                    perimeter === null || perimeter === undefined || perimeter === ''
                      ? tierLabel
                      : t('createAlliance.tierPerimeter', { tier: tierLabel, m: perimeter });
                  return (
                    <Pressable
                      key={terr.id}
                      accessibilityRole="button"
                      onPress={() => setSelectedTerritoryId(terr.id)}
                      style={({ pressed }) => [styles.tRow, selected && styles.tRowSelected, pressed && { opacity: 0.92 }]}
                    >
                      <View style={styles.tInfo}>
                        <Text style={styles.tName}>{terr.territory_name ?? '—'}</Text>
                        <Text style={styles.tMeta}>{meta}</Text>
                      </View>
                      {selected ? <Text style={styles.tTag}>{t('createAlliance.selected')}</Text> : null}
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
                <Text style={[styles.ctaStep, !selectedTerritoryId && styles.ctaStepDisabled]}>{t('createAlliance.stepOf', { n: '02' })}</Text>
                <Text style={[styles.ctaAction, !selectedTerritoryId && styles.ctaActionDisabled]}>{t('createAlliance.continue')}</Text>
              </Pressable>
            </>
          )}
        </ScrollView>
      )}

      {step === 3 && (
        <ScrollView style={styles.scroll} contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]} showsVerticalScrollIndicator={false}>
          <View style={styles.kickerRow}>
            <Text style={styles.kickerText}>{t('createAlliance.kicker', { step: '03' })}</Text>
            <View style={styles.kickerRule} />
          </View>

          <Text style={[styles.stepTitle, styles.stepTitleSmall]}>{t('createAlliance.step3Title')}</Text>
          <Text style={styles.bodyText}>{t('createAlliance.step3Body')}</Text>

          <View style={styles.sumList}>
            <View style={styles.sumRow}>
              <Text style={styles.sumLabel}>{t('createAlliance.sumAlliance')}</Text>
              <Text style={styles.sumValue}>{allianceName.trim()}</Text>
            </View>
            <View style={styles.sumRow}>
              <Text style={styles.sumLabel}>{t('createAlliance.sumTag')}</Text>
              <Text style={[styles.sumValue, styles.sumValueMono]}>[{code.trim().toUpperCase()}]</Text>
            </View>
            <View style={styles.sumRow}>
              <Text style={styles.sumLabel}>{t('createAlliance.sumEmblem')}</Text>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <AllianceEmblem emblem={emblem} size={28} />
                <Text style={styles.sumValue}>{t(`emblems.${emblem}`)}</Text>
              </View>
            </View>
            <View style={styles.sumRow}>
              <Text style={styles.sumLabel}>{t('createAlliance.sumHQ')}</Text>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                <Text style={styles.sumValue}>{selectedTerritory?.territory_name ?? '—'}</Text>
                <Text style={styles.sumHomeTag}>{t('createAlliance.home')}</Text>
              </View>
            </View>
            <View style={styles.sumRow}>
              <Text style={styles.sumLabel}>{t('createAlliance.city')}</Text>
              <Text style={styles.sumValue}>{homeCity ?? '—'}</Text>
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
                <Text style={[styles.ctaStep, createSaving && styles.ctaStepDisabled]}>{t('createAlliance.finalStep')}</Text>
                <Text style={[styles.ctaAction, createSaving && styles.ctaActionDisabled]}>
                  {t('createAlliance.createName', { name: allianceName.trim() })}
                </Text>
              </>
            )}
          </Pressable>
          {submitError ? <Text style={styles.submitError}>{submitError}</Text> : null}
        </ScrollView>
      )}
    </KeyboardAvoidingView>
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
  submitError: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 10,
    letterSpacing: 1.4,
    color: CLAIM,
    textTransform: 'uppercase',
    marginTop: 12,
    lineHeight: 14,
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
  emblemGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 18,
  },
  emblemCell: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: INK_2,
    borderWidth: 1,
    borderColor: HAIRLINE,
    borderRadius: 0,
  },
  emblemCellSelected: {
    borderColor: BONE_2,
    backgroundColor: 'rgba(242,238,230,0.04)',
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
