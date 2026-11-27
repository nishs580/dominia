// "SELECT YOUR AGE" (Dominia-Temp core-loop board): the display title, a
// lime-tinted subtitle, the 1–100 AgeSlider (no thumb until the first touch),
// a SELECTED AGE box and NEXT », disabled until an age is chosen. The app
// only ever sends the derived band (13_17 / 18_plus) — never the age itself —
// and under 13 routes to AgeBlockedScreen with nothing saved. A step inside
// FigmaOnboardingScreen; it reports the chosen age through onNext. The board
// has no back control, so going back to choose-name is the Android back
// gesture only.

import React, { useEffect, useState } from 'react';
import { BackHandler, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import AgeSlider from '../components/AgeSlider';
import { SlantButton } from '../components/ui';
import { colors, fonts } from '../lib/theme';

const LIME_TINT = 'rgba(132,255,68,0.7)';

export default function AgeScreen({ onNext, onBack }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [age, setAge] = useState(null);

  useEffect(() => {
    if (!onBack) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack]);

  const selectedLabel = t('age.selectedAgeLabel', { defaultValue: 'Selected age:' });

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.body}>
        <Text style={styles.title} accessibilityRole="header" maxFontSizeMultiplier={1.2}>
          {t('age.title', { defaultValue: 'Select your age' })}
        </Text>
        <Text style={styles.subtitle} maxFontSizeMultiplier={1.4}>
          {t('age.figmaSubtitle', { defaultValue: 'Select the appropriate option to where your age lies' })}
        </Text>

        <View style={styles.slider}>
          <AgeSlider value={age} onChange={setAge} label={t('age.selectedAge', { defaultValue: 'Selected age' })} />
        </View>

        <View
          style={styles.selectedRow}
          accessible
          accessibilityLabel={`${selectedLabel} ${age ?? t('age.notSet', { defaultValue: 'not set' })}`}
        >
          <Text style={styles.selectedLabel} maxFontSizeMultiplier={1.3}>
            {selectedLabel}
          </Text>
          <View style={styles.selectedBox}>
            <Text style={[styles.selectedValue, age == null && styles.selectedEmpty]} maxFontSizeMultiplier={1.2}>
              {age ?? '—'}
            </Text>
          </View>
        </View>

        <SlantButton
          label={t('age.next', { defaultValue: 'NEXT' })}
          onPress={() => age != null && onNext?.(age)}
          disabled={age == null}
          style={styles.next}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.obsidian, paddingHorizontal: 20 },
  body: { flex: 1, justifyContent: 'center' },
  title: {
    fontFamily: fonts.display,
    fontSize: 32,
    lineHeight: 36,
    color: colors.white,
    textTransform: 'uppercase',
  },
  subtitle: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: LIME_TINT, marginTop: 8 },
  slider: { marginTop: 20 },
  selectedRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16 },
  selectedLabel: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.6,
    color: colors.muted2,
    textTransform: 'uppercase',
  },
  selectedBox: {
    minWidth: 60,
    minHeight: 32,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.action,
    backgroundColor: 'rgba(7,49,209,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedValue: { fontFamily: fonts.mono, fontSize: 18, color: colors.white },
  selectedEmpty: { color: colors.muted },
  next: { marginTop: 40 },
});
