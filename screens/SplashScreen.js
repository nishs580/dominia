// Figma splash (plan U10): the DOMINIA wordmark on Ink. Rendered by AuthGate
// while it resolves the session when Figma onboarding is on (legacy_tabs off);
// with it on, AuthGate keeps today's spinner. Not a route of its own.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../lib/theme';

export default function SplashScreen() {
  return (
    <View style={styles.screen} accessibilityLabel="Dominia">
      <View style={styles.row}>
        <Text style={styles.wordmark} maxFontSizeMultiplier={1.2}>
          DOMINIA
        </Text>
        <Text style={styles.mark}>▪</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'flex-end' },
  wordmark: {
    fontFamily: fonts.display,
    fontSize: 48,
    color: colors.bone,
    letterSpacing: -1.4,
    textTransform: 'uppercase',
  },
  mark: { fontFamily: fonts.display, fontSize: 13, color: colors.claim, marginLeft: 4, marginBottom: 10 },
});
