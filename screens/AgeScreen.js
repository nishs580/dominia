// "Select your Age" (plan U10): a slider, the selected age and NEXT. The app
// only ever sends the derived band (13_17 / 18_plus) — never the age itself —
// and under 13 routes to AgeBlockedScreen with nothing saved. A step inside
// FigmaOnboardingScreen; it reports the chosen age through onNext.

import React, { useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { AGE_SLIDER_DEFAULT, AGE_SLIDER_MAX, AGE_SLIDER_MIN } from '../lib/onboardingFlow';
import { colors, fonts } from '../lib/theme';

const THUMB = 28;

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

export default function AgeScreen({ onNext }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [age, setAge] = useState(AGE_SLIDER_DEFAULT);
  const display = age >= AGE_SLIDER_MAX ? `${AGE_SLIDER_MAX}+` : String(age);

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.body}>
        <Text style={styles.title} accessibilityRole="header" maxFontSizeMultiplier={1.2}>
          {t('age.title', { defaultValue: 'Select your Age' })}
        </Text>
        <Text style={styles.subtitle}>
          {t('age.subtitle', { defaultValue: 'Select the appropriate option to where your age lies' })}
        </Text>

        <View style={styles.readout}>
          <Text style={styles.readoutLabel}>{t('age.selectedAge', { defaultValue: 'Selected age' })}</Text>
          <Text style={styles.readoutValue} maxFontSizeMultiplier={1.2}>
            {display}
          </Text>
        </View>

        <AgeSlider value={age} onChange={setAge} label={t('age.selectedAge', { defaultValue: 'Selected age' })} />
        <View style={styles.scale} importantForAccessibility="no-hide-descendants">
          <Text style={styles.scaleText}>{AGE_SLIDER_MIN}</Text>
          <Text style={styles.scaleText}>{`${AGE_SLIDER_MAX}+`}</Text>
        </View>
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
  screen: { flex: 1, backgroundColor: colors.ink, paddingHorizontal: 24 },
  body: { flex: 1, justifyContent: 'center' },
  title: {
    fontFamily: fonts.display,
    fontSize: 32,
    letterSpacing: -0.9,
    color: colors.bone,
    textTransform: 'uppercase',
  },
  subtitle: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.slate2, marginTop: 8 },
  readout: { marginTop: 40, marginBottom: 24 },
  readoutLabel: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.8,
    color: colors.slate2,
    textTransform: 'uppercase',
  },
  readoutValue: { fontFamily: 'GeistMono_300Light', fontSize: 48, letterSpacing: -1.4, color: colors.bone, marginTop: 4, textTransform: 'uppercase' },
  slider: { height: 48, justifyContent: 'center' },
  track: { height: 2, backgroundColor: colors.hairlineStrong, marginHorizontal: 0 },
  fill: { height: 2, backgroundColor: colors.lime },
  thumb: {
    position: 'absolute',
    top: (48 - THUMB) / 2,
    width: THUMB,
    height: THUMB,
    backgroundColor: colors.lime,
  },
  scale: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  scaleText: { fontFamily: fonts.mono, fontSize: 11, color: colors.slate2 },
  next: {
    backgroundColor: colors.claimButton,
    minHeight: 48,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextText: { fontFamily: fonts.monoMedium, fontSize: 14, letterSpacing: 2, color: colors.bone, textTransform: 'uppercase' },
  pressed: { opacity: 0.9 },
});
