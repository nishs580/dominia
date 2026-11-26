// "Select your Age" (Updated UX A5): ← back to choose-name, a centred readout
// with YEARS, a 1–100 slider starting at 24, a typed field and NEXT. The app
// only ever sends the derived band (13_17 / 18_plus) — never the age itself —
// and under 13 routes to AgeBlockedScreen with nothing saved. A step inside
// FigmaOnboardingScreen; it reports the chosen age through onNext.

import React, { useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { AGE_SLIDER_DEFAULT, AGE_SLIDER_MAX, AGE_SLIDER_MIN, parseTypedAge } from '../lib/onboardingFlow';
import { colors, fonts } from '../lib/theme';
import OnboardingHeader from '../components/OnboardingHeader';

const THUMB = 20;
const SLIDER_HEIGHT = 44;

function clampAge(n) {
  return Math.min(AGE_SLIDER_MAX, Math.max(AGE_SLIDER_MIN, Math.round(n)));
}

function AgeSlider({ value, onChange, label }) {
  const [width, setWidth] = useState(0);
  const widthRef = useRef(0);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const valueAt = (x) => {
    const w = widthRef.current - THUMB;
    if (w <= 0) return null;
    const ratio = Math.min(1, Math.max(0, (x - THUMB / 2) / w));
    return clampAge(AGE_SLIDER_MIN + ratio * (AGE_SLIDER_MAX - AGE_SLIDER_MIN));
  };

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => {
          const v = valueAt(e.nativeEvent.locationX);
          if (v != null) onChangeRef.current(v);
        },
        onPanResponderMove: (e) => {
          const v = valueAt(e.nativeEvent.locationX);
          if (v != null) onChangeRef.current(v);
        },
      }),
    [],
  );

  const ratio = (value - AGE_SLIDER_MIN) / (AGE_SLIDER_MAX - AGE_SLIDER_MIN);
  const left = Math.max(0, width - THUMB) * ratio;

  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min: AGE_SLIDER_MIN, max: AGE_SLIDER_MAX, now: value }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === 'increment') onChange(clampAge(value + 1));
        if (e.nativeEvent.actionName === 'decrement') onChange(clampAge(value - 1));
      }}
      onLayout={(e) => {
        widthRef.current = e.nativeEvent.layout.width;
        setWidth(e.nativeEvent.layout.width);
      }}
      style={styles.slider}
      {...responder.panHandlers}
    >
      <View style={styles.track} pointerEvents="none">
        <View style={[styles.fill, { width: left + THUMB / 2 }]} />
      </View>
      <View style={[styles.thumb, { left }]} pointerEvents="none" />
    </View>
  );
}

export default function AgeScreen({ onNext, onBack }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [age, setAge] = useState(AGE_SLIDER_DEFAULT);
  // Typed text is kept separately so a half-typed value (or an empty field)
  // doesn't fight the slider; a valid number moves the slider, the slider
  // rewrites the text.
  const [typed, setTyped] = useState(String(AGE_SLIDER_DEFAULT));
  const [typedFocused, setTypedFocused] = useState(false);
  const onSlide = (v) => {
    setAge(v);
    setTyped(String(v));
  };
  const onType = (text) => {
    const digits = text.replace(/[^0-9]/g, '').slice(0, 3);
    setTyped(digits);
    const v = parseTypedAge(digits);
    if (v != null) setAge(v);
  };
  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.body}>
        <OnboardingHeader title={t('age.title', { defaultValue: 'Select your age' })} onBack={onBack} />
        <Text style={styles.subtitle}>
          {t('age.subtitle', { defaultValue: 'Select the option where your age lies.' })}
        </Text>

        <View style={styles.readout} accessible accessibilityLabel={`${age} ${t('age.years', { defaultValue: 'Years' })}`}>
          <Text style={styles.readoutValue} maxFontSizeMultiplier={1.2}>
            {age}
          </Text>
          <Text style={styles.readoutLabel}>{t('age.years', { defaultValue: 'Years' })}</Text>
        </View>

        <AgeSlider value={age} onChange={onSlide} label={t('age.selectedAge', { defaultValue: 'Selected age' })} />
        <View style={styles.scale} importantForAccessibility="no-hide-descendants">
          <Text style={styles.scaleText}>{AGE_SLIDER_MIN}</Text>
          <Text style={styles.scaleText}>{AGE_SLIDER_MAX}</Text>
        </View>

        <Text style={styles.typeLabel}>{t('age.typeLabel', { defaultValue: 'Or type your age' })}</Text>
        <TextInput
          value={typed}
          onChangeText={onType}
          onFocus={() => setTypedFocused(true)}
          onBlur={() => {
            setTypedFocused(false);
            // Leaving the field snaps the text to the clamped age in use.
            setTyped(String(age));
          }}
          keyboardType="number-pad"
          inputMode="numeric"
          maxLength={3}
          returnKeyType="done"
          placeholder={t('age.typePlaceholder', { defaultValue: 'Age' })}
          placeholderTextColor={colors.slate}
          accessibilityLabel={t('age.typeLabel', { defaultValue: 'Or type your age' })}
          selectionColor={colors.lime}
          style={[styles.typeInput, typedFocused && styles.typeInputFocused]}
          maxFontSizeMultiplier={1.3}
        />
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() => onNext?.(age)}
        style={({ pressed }) => [styles.next, pressed && styles.pressed]}
      >
        <Text style={styles.nextText}>{t('age.next', { defaultValue: 'NEXT' })}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.obsidian, paddingHorizontal: 24 },
  body: { flex: 1 },
  subtitle: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: colors.muted2, marginTop: 4 },
  readout: { alignItems: 'center', marginTop: 48, marginBottom: 20 },
  readoutValue: {
    fontFamily: fonts.monoLight,
    fontSize: 56,
    lineHeight: 62,
    letterSpacing: -1.6,
    color: colors.white,
  },
  readoutLabel: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.8,
    color: colors.muted2,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  slider: { height: SLIDER_HEIGHT, justifyContent: 'center' },
  track: { height: 4, backgroundColor: colors.raised },
  fill: { height: 4, backgroundColor: colors.lime },
  thumb: {
    position: 'absolute',
    top: (SLIDER_HEIGHT - THUMB) / 2,
    width: THUMB,
    height: THUMB,
    backgroundColor: colors.lime,
  },
  scale: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  scaleText: { fontFamily: fonts.mono, fontSize: 11, color: colors.muted },
  typeLabel: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.6,
    color: colors.muted2,
    textTransform: 'uppercase',
    marginTop: 24,
    marginBottom: 8,
  },
  typeInput: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    fontFamily: fonts.mono,
    fontSize: 15,
    color: colors.white,
  },
  typeInputFocused: { borderColor: colors.lime },
  next: {
    backgroundColor: colors.action,
    minHeight: 52,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextText: { fontFamily: fonts.monoMedium, fontSize: 13, letterSpacing: 1.8, color: colors.white, textTransform: 'uppercase' },
  pressed: { backgroundColor: colors.actionPressed },
});
