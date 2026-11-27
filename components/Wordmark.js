// Wordmark — the Dominia-Temp "DOMINIA." lockup (plan U3; Figma splash,
// sign-up and sign-in boards). Archivo Black Italic in white with the full
// stop in Dominia blue, and optionally the "WALK. CLAIM. CONQUER. DEFEND."
// tagline underneath in tracked Plex Sans Bold.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, fonts } from '../lib/theme';

export default function Wordmark({ size = 40, tagline = true, style }) {
  const { t } = useTranslation();
  return (
    <View style={[styles.wrap, style]} accessible accessibilityRole="header" accessibilityLabel="Dominia">
      <Text
        style={[styles.word, { fontSize: size, lineHeight: Math.round(size * 1.15), letterSpacing: size * 0.02 }]}
        maxFontSizeMultiplier={1.15}
      >
        DOMINIA<Text style={styles.dot}>.</Text>
      </Text>
      {tagline ? (
        <Text style={styles.tagline} maxFontSizeMultiplier={1.3}>
          {t('auth.tagline', { defaultValue: 'WALK. CLAIM. CONQUER. DEFEND.' })}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  word: {
    fontFamily: fonts.display,
    color: colors.white,
    textTransform: 'uppercase',
    includeFontPadding: false,
    // Archivo Black Italic overhangs its advance; keep the last glyph whole.
    paddingRight: 4,
  },
  dot: { color: colors.action },
  tagline: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 3.3,
    color: colors.muted2,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginTop: 10,
  },
});
