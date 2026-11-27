// The Figma onboarding header (Updated UX A3, A4, A5): an optional ← back
// arrow and a big display title on one row, top-aligned under the status bar.

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, fonts } from '../lib/theme';

export default function OnboardingHeader({ title, onBack }) {
  const { t } = useTranslation();
  return (
    <View style={styles.row}>
      {onBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          onPress={onBack}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.back}
        >
          <Text style={styles.arrow} maxFontSizeMultiplier={1.2}>
            ←
          </Text>
        </Pressable>
      ) : null}
      <Text style={styles.title} accessibilityRole="header" maxFontSizeMultiplier={1.2} numberOfLines={2}>
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 56 },
  back: { width: 44, height: 44, marginLeft: -12, alignItems: 'center', justifyContent: 'center' },
  arrow: { fontFamily: fonts.body, fontSize: 24, color: colors.white },
  title: {
    flex: 1,
    fontFamily: fonts.display,
    fontSize: 27,
    lineHeight: 30,
    letterSpacing: -0.6,
    color: colors.white,
    textTransform: 'uppercase',
  },
});
