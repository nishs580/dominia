// Figma splash (Dominia-Temp "Splash", plan U3): the radar with its rotating
// blue sweep over a faint grid and blue glow, then the DOMINIA. wordmark,
// "WALK. CLAIM. CONQUER. DEFEND.", three progress dashes and "Finding your
// ground…". Rendered by AuthGate while it resolves the session when Figma
// onboarding is on (legacy_tabs off); with it on, AuthGate keeps today's
// spinner. Not a route of its own.

import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { AuthBackdrop } from '../components/AuthParts';
import RadarMark from '../components/RadarMark';
import Wordmark from '../components/Wordmark';
import { colors, fonts } from '../lib/theme';

const DASH_STEP_MS = 600;

function ProgressDashes() {
  const [active, setActive] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setActive((i) => (i + 1) % 3), DASH_STEP_MS);
    return () => clearInterval(id);
  }, []);
  return (
    <View style={styles.dashes} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {[0, 1, 2].map((i) => (
        <View key={i} style={[styles.dash, i === active && styles.dashActive]} />
      ))}
    </View>
  );
}

export default function SplashScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const loading = t('auth.findingGround', { defaultValue: 'Finding your ground…' });
  return (
    <View style={styles.screen} accessible accessibilityLabel={`Dominia. ${loading}`} accessibilityRole="progressbar">
      <AuthBackdrop grid />
      <View style={styles.radarArea}>
        <RadarMark size={260} />
      </View>
      <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, 24) + 72 }]}>
        <Wordmark size={34} />
        <ProgressDashes />
        <Text style={styles.loading} maxFontSizeMultiplier={1.4}>
          {loading}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.obsidian },
  radarArea: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 40 },
  bottom: { alignItems: 'center', paddingHorizontal: 24 },
  dashes: { flexDirection: 'row', gap: 5, marginTop: 22 },
  dash: { width: 7, height: 3, backgroundColor: 'rgba(253,253,253,0.3)', transform: [{ skewX: '-14deg' }] },
  dashActive: { width: 22, backgroundColor: colors.action },
  loading: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.muted2,
    marginTop: 14,
  },
});
