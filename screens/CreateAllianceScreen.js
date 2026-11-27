import React, { useEffect, useRef, useState } from 'react';
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
import { SvgXml } from 'react-native-svg';
import AllianceEmblem from '../components/AllianceEmblem';
import { CutField, ScreenTitle, SlantButton, SlantTile } from '../components/ui';
import {
  ALLIANCE_EMBLEM_LABELS,
  ALLIANCE_LOGO_EMBLEMS,
  DEFAULT_ALLIANCE_EMBLEM,
  DEFAULT_ALLIANCE_LOGO,
  LEGACY_ALLIANCE_EMBLEMS,
} from '../lib/allianceEmblems';
import { useFlag } from '../lib/flags';
import {
  ALLIANCE_NAME_MAX,
  ALLIANCE_TEXT_MAX,
  createFieldError,
  foundErrorFields,
  foundSubmitErrorKey,
  FOUND_SUBMIT_ERROR_DEFAULTS,
  sanitizeShortName,
  validateAllianceForm,
} from '../lib/allianceValidation';

const INK = THEME.colors.ink;
const INK_2 = THEME.colors.ink2;
const BONE = THEME.colors.bone;
const BONE_2 = THEME.colors.bone2;
const SLATE = THEME.colors.slate;
const SLATE_2 = THEME.colors.slate2;
const CLAIM = THEME.colors.claim;
const CLAIM_BUTTON = THEME.colors.claimButton; // AA-safe button fill under Bone text
const HAIRLINE = THEME.colors.hairline;
const HAIRLINE_STRONG = THEME.colors.hairlineStrong;

function mapFoundAllianceError(t, error) {
  const submitKey = foundSubmitErrorKey(error);
  if (submitKey) return t(submitKey, { defaultValue: FOUND_SUBMIT_ERROR_DEFAULTS[submitKey] });
  const code = error?.code ?? error?.error ?? null;
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

// alliance_hq_create on keeps today's 3-step create with an HQ territory;
// off mounts the Figma single-page create with Rules and no HQ.
export default function CreateAllianceScreen() {
  const hqCreateOn = useFlag('alliance_hq_create');
  return hqCreateOn ? <LegacyCreateAllianceScreen /> : <FigmaCreateAllianceScreen />;
}

function fieldErrorText(t, code) {
  const err = createFieldError(code);
  return err ? t(err.key, { defaultValue: err.defaultValue }) : '';
}

const PENCIL_XML = `<svg viewBox="0 0 16 16" fill="none" stroke="${BONE}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.5 2.5l3 3L5.5 13.5H2.5v-3z"/><path d="M9 4l3 3"/></svg>`;
const BACK_ARROW_XML = `<svg viewBox="0 0 16 16" fill="none" stroke="${BONE}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M13 8H3M7 4L3 8l4 4"/></svg>`;

/** "Alliance Full Name ............ 3 - 24 characters" */
function FieldLabel({ label, hint }) {
  return (
    <View style={styles.tempLabelRow}>
      <Text style={styles.tempLabel} maxFontSizeMultiplier={1.4}>{label}</Text>
      {hint ? <Text style={styles.tempLabelHint} maxFontSizeMultiplier={1.4}>{hint}</Text> : null}
    </View>
  );
}

// Dominia-Temp create (cases 5–6): BACK, CREATE ALLIANCE / ALLIANCE TYPE,
// full + short name with inline errors (empty, length, taken), the 10-logo
// picker and Rules. Both names are permanent; there is no type picker, so
// every alliance is founded Open.
function FigmaCreateAllianceScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { getToken: clerkGetToken } = useAuth();
  // Clerk's getToken is not referentially stable; read it through a ref.
  const getTokenRef = useRef(clerkGetToken);
  getTokenRef.current = clerkGetToken;

  const [fullName, setFullName] = useState('');
  const [shortName, setShortName] = useState('');
  const [emblem, setEmblem] = useState(DEFAULT_ALLIANCE_LOGO);
  const [rules, setRules] = useState('');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const handleCreate = async () => {
    if (saving) return;
    const v = validateAllianceForm({ fullName, shortName, rules });
    setErrors(v.errors);
    setSubmitError('');
    if (!v.ok) return;
    setSaving(true);
    try {
      const result = await foundAlliance({
        clerkGetToken: (...args) => getTokenRef.current(...args),
        fullName: v.values.fullName,
        shortName: v.values.shortName,
        emblem,
        joinType: 'open',
        ...(v.values.rules ? { rules: v.values.rules } : {}),
      });
      if (result.ok) {
        navigation.navigate('AllianceJoined', { allianceId: result.data.alliance.id });
        return;
      }
      const fields = foundErrorFields(result.error);
      if (fields) setErrors(fields);
      else setSubmitError(mapFoundAllianceError(t, result.error));
    } catch (err) {
      console.error('Create alliance failed:', err);
      setSubmitError(t('createAlliance.errGeneric'));
    } finally {
      setSaving(false);
    }
  };

  const nameErr = fieldErrorText(t, errors.fullName);
  const shortErr = fieldErrorText(t, errors.shortName);
  const rulesErr = fieldErrorText(t, errors.rules);
  const fullNameLabel = t('allianceFigma.fullNameLabel', { defaultValue: 'Alliance Full Name' });
  const shortNameLabel = t('allianceFigma.shortNameLabel', { defaultValue: 'Alliance Short Name' });
  const logoLabel = t('allianceFigma.logoLabel', { defaultValue: 'Alliance Logo' });
  const rulesLabel = t('allianceFigma.rulesLabel', { defaultValue: 'Alliance Rules' });
  const logoRows = [ALLIANCE_LOGO_EMBLEMS.slice(0, 5), ALLIANCE_LOGO_EMBLEMS.slice(5)];

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('allianceFigma.back', { defaultValue: 'Back' })}
          onPress={() => navigation.goBack()}
          hitSlop={12}
          style={({ pressed }) => [styles.tempBack, pressed && { opacity: 0.6 }]}
        >
          <SvgXml xml={BACK_ARROW_XML} width={14} height={14} />
          <Text style={styles.tempBackText}>{t('allianceFigma.backCaps', { defaultValue: 'BACK' })}</Text>
        </Pressable>

        <ScreenTitle
          eyebrow={t('allianceFigma.createTitle', { defaultValue: 'CREATE ALLIANCE' })}
          title={t('allianceFigma.allianceType', { defaultValue: 'ALLIANCE TYPE' })}
          subtitle={t('allianceFigma.namesPermanentNote', {
            defaultValue: "Both names are permanent. The name's cannot be changed after founding.",
          })}
          size={32}
          style={styles.tempTitle}
        />

        <FieldLabel
          label={fullNameLabel}
          hint={t('allianceFigma.fullNameRange', { defaultValue: '3 - 24 characters' })}
        />
        <CutField
          value={fullName}
          onChangeText={(v) => {
            setFullName(v);
            if (errors.fullName) setErrors((e) => ({ ...e, fullName: undefined }));
          }}
          placeholder={t('createAlliance.namePlaceholder', { defaultValue: 'Alliance Name' })}
          maxLength={ALLIANCE_NAME_MAX + 8}
          autoCapitalize="words"
          keyboardAppearance="dark"
          error={nameErr || undefined}
          accessibilityLabel={fullNameLabel}
          containerStyle={styles.tempField}
        />

        <FieldLabel
          label={shortNameLabel}
          hint={t('allianceFigma.shortNameRange', { defaultValue: '3 Letters' })}
        />
        <CutField
          value={shortName}
          onChangeText={(v) => {
            setShortName(sanitizeShortName(v));
            if (errors.shortName) setErrors((e) => ({ ...e, shortName: undefined }));
          }}
          placeholder={t('createAlliance.shortNamePlaceholder', { defaultValue: 'eg. SNW' })}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={3}
          keyboardAppearance="dark"
          error={shortErr || undefined}
          accessibilityLabel={shortNameLabel}
          containerStyle={styles.tempField}
        />

        <FieldLabel label={logoLabel} />
        <View style={styles.tempLogoGrid} accessibilityRole="radiogroup" accessibilityLabel={logoLabel}>
          {logoRows.map((row, r) => (
            <View key={r} style={styles.tempLogoRow}>
              {row.map((key) => {
                const isSelected = key === emblem;
                return (
                  <SlantTile
                    key={key}
                    size={42}
                    tone="raised"
                    selected={isSelected}
                    onPress={() => setEmblem(key)}
                    accessibilityRole="radio"
                    accessibilityLabel={t(`emblems.${key}`, { defaultValue: ALLIANCE_EMBLEM_LABELS[key] })}
                    style={styles.tempLogoTile}
                  >
                    <AllianceEmblem emblem={key} variant="glyph" size={20} />
                  </SlantTile>
                );
              })}
            </View>
          ))}
        </View>

        <FieldLabel label={rulesLabel} />
        <CutField
          value={rules}
          onChangeText={(v) => {
            setRules(v);
            if (errors.rules) setErrors((e) => ({ ...e, rules: undefined }));
          }}
          placeholder={t('allianceFigma.rulesPlaceholderTemp', { defaultValue: 'Custom alliance rule 1' })}
          multiline
          textAlignVertical="top"
          maxLength={ALLIANCE_TEXT_MAX}
          keyboardAppearance="dark"
          error={rulesErr || undefined}
          accessibilityLabel={rulesLabel}
          style={styles.tempTextarea}
          containerStyle={styles.tempField}
        />

        <SlantButton
          label={t('allianceFigma.createCta', { defaultValue: 'CREATE ALLIANCE' })}
          onPress={handleCreate}
          loading={saving}
          trailingChevron={false}
          leading={<SvgXml xml={PENCIL_XML} width={16} height={16} />}
          style={styles.tempCta}
        />
        {submitError ? (
          <Text style={styles.submitError} accessibilityLiveRegion="polite">{submitError}</Text>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function LegacyCreateAllianceScreen() {
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
            keyboardAppearance="dark"
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
              { fontFamily: 'IBMPlexSans_600SemiBold', letterSpacing: 4, fontSize: 18 },
            ]}
            keyboardAppearance="dark"
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
            {LEGACY_ALLIANCE_EMBLEMS.map((key) => {
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
              <ActivityIndicator color={'#84FF44'} />
            </View>
          ) : !playerId ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptySubtitle}>{t('createAlliance.couldNotLoadProfile')}</Text>
            </View>
          ) : territoriesLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator color={'#84FF44'} />
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
  // ── Dominia-Temp create (cases 5–6) ──
  tempBack: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    minHeight: 32,
    marginBottom: 8,
  },
  tempBackText: {
    fontFamily: THEME.fonts.mono,
    fontSize: 11,
    letterSpacing: 1.8,
    color: BONE,
  },
  tempTitle: {
    marginBottom: 16,
  },
  tempLabelRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  tempLabel: {
    flexShrink: 1,
    fontFamily: THEME.fonts.bodyMedium,
    fontSize: 14,
    color: BONE,
  },
  tempLabelHint: {
    fontFamily: THEME.fonts.body,
    fontSize: 12,
    color: SLATE_2,
    marginLeft: 12,
  },
  tempField: {
    marginBottom: 14,
  },
  tempLogoGrid: {
    gap: 8,
    marginBottom: 16,
  },
  tempLogoRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tempLogoTile: {
    flex: 1,
  },
  tempTextarea: {
    minHeight: 140,
  },
  tempCta: {
    marginTop: 12,
  },
  textarea: {
    minHeight: 120,
  },
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
    fontFamily: 'IBMPlexSans_700Bold',
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
    fontFamily: 'IBMPlexSans_700Bold',
    fontSize: 11,
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
    fontFamily: 'Archivo_900Black_Italic',
    fontSize: 22,
    color: BONE,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    lineHeight: 24,
    marginTop: 0,
    marginBottom: 24,
  },
  stepTitleSmall: {
    fontSize: 24,
  },
  bodyText: {
    fontFamily: 'IBMPlexSans_500Medium',
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
    fontFamily: 'IBMPlexSans_700Bold',
    fontSize: 11,
    letterSpacing: 1.8,
    color: SLATE_2,
    textTransform: 'uppercase',
  },
  labelHint: {
    fontFamily: 'IBMPlexSans_700Bold',
    fontSize: 11,
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
    fontFamily: 'IBMPlexSans_600SemiBold',
    fontSize: 16,
    marginBottom: 18,
  },
  fieldError: {
    fontFamily: 'IBMPlexSans_700Bold',
    fontSize: 11,
    letterSpacing: 1.4,
    color: SLATE_2,
    textTransform: 'uppercase',
    marginTop: -10,
    marginBottom: 18,
  },
  submitError: {
    fontFamily: 'IBMPlexSans_700Bold',
    fontSize: 11,
    letterSpacing: 1.4,
    color: '#E34234',
    textTransform: 'uppercase',
    marginTop: 12,
    lineHeight: 14,
  },
  micro: {
    fontFamily: 'IBMPlexSans_700Bold',
    fontSize: 11,
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
    backgroundColor: 'rgba(253,253,253,0.04)',
  },
  cta: {
    backgroundColor: CLAIM_BUTTON,
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
    fontFamily: 'IBMPlexSans_700Bold',
    fontSize: 11,
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
    fontFamily: 'IBMPlexSans_600SemiBold',
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
    fontFamily: 'IBMPlexSans_700Bold',
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
    backgroundColor: 'rgba(253,253,253,0.04)',
    borderLeftWidth: 1,
    borderLeftColor: BONE_2,
    paddingLeft: 11,
  },
  tInfo: {
    flex: 1,
  },
  tName: {
    fontFamily: 'Archivo_900Black_Italic',
    fontSize: 20,
    color: BONE,
    lineHeight: 22,
    textTransform: 'uppercase',
  },
  tMeta: {
    fontFamily: 'IBMPlexSans_700Bold',
    fontSize: 11,
    letterSpacing: 1,
    color: SLATE_2,
    textTransform: 'uppercase',
    marginTop: 3,
  },
  tTag: {
    fontFamily: 'IBMPlexSans_600SemiBold',
    fontSize: 11,
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
    fontFamily: 'IBMPlexSans_700Bold',
    fontSize: 11,
    letterSpacing: 1.6,
    color: SLATE_2,
    textTransform: 'uppercase',
    width: 100,
  },
  sumValue: {
    flex: 1,
    fontFamily: 'IBMPlexSans_600SemiBold',
    fontSize: 16,
    color: BONE,
  },
  sumValueMono: {
    fontFamily: 'IBMPlexSans_600SemiBold',
    letterSpacing: 2,
  },
  sumHomeTag: {
    fontFamily: 'IBMPlexSans_600SemiBold',
    fontSize: 11,
    letterSpacing: 1.5,
    color: BONE,
    textTransform: 'uppercase',
    paddingHorizontal: 7,
    paddingVertical: 3,
    backgroundColor: 'rgba(253,253,253,0.06)',
    marginLeft: 8,
  },
});
