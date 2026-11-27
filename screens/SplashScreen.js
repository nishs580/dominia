// Figma splash (Updated UX A1): a short lime bar, the DOMINIA wordmark and
// "WALK · CLAIM · CONQUER", centred on Ink. Rendered by AuthGate while it
// resolves the session when Figma onboarding is on (legacy_tabs off); with it
// on, AuthGate keeps today's spinner. Not a route of its own.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, fonts } from '../lib/theme';

export default function SplashScreen() {
  const { t } = useTranslation();
  return (
    <View style={styles.screen} accessibilityLabel="Dominia">
      <View style={styles.bar} />
      <Text style={styles.wordmark} maxFontSizeMultiplier={1.2}>
        DOMINIA
      </Text>
      <Text style={styles.tagline} maxFontSizeMultiplier={1.3}>
        {t('landing.splashTagline', { defaultValue: 'WALK · CLAIM · CONQUER' })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  bar: { width: 38, height: 4, backgroundColor: colors.lime, marginBottom: 12 },
  wordmark: {
    fontFamily: fonts.display,
    fontSize: 38,
    color: colors.bone,
    letterSpacing: -1.4,
    textTransform: 'uppercase',
  },
  tagline: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.8,
    color: colors.slate2,
    textTransform: 'uppercase',
    marginTop: 12,
  },
});
