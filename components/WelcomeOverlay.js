// "WELCOME TO DOMINIA" overlay on the map (plan U10). A full-screen scrim
// over the map; tapping anywhere continues to the tutorial cards. Rendered by
// OnboardingTutorialLifecycle, inside its Modal.

import React, { useEffect } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, fonts } from '../lib/theme';

export default function WelcomeOverlay({ onContinue }) {
  const { t } = useTranslation();
  const title = t('welcomeOverlay.title', { defaultValue: 'WELCOME TO DOMINIA' });
  const body = t('welcomeOverlay.body', { defaultValue: 'Let us start understanding how the Game works' });
  const hint = t('welcomeOverlay.tapToContinue', { defaultValue: 'Tap on the screen to Continue' });

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility?.(`${title}. ${body}`);
  }, [title, body]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${body}. ${hint}`}
      onPress={onContinue}
      style={styles.scrim}
    >
      <View style={styles.center}>
        <Text style={styles.title} maxFontSizeMultiplier={1.2}>
          {title}
        </Text>
        <View style={styles.rule} />
        <Text style={styles.body}>{body}</Text>
      </View>
      <Text style={styles.hint}>{hint}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(16,16,16,0.78)',
    paddingHorizontal: 24,
    paddingBottom: 64,
    justifyContent: 'center',
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: {
    fontFamily: fonts.display,
    fontSize: 32,
    letterSpacing: -0.9,
    color: colors.bone,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  rule: { width: 48, height: 1, backgroundColor: colors.hairlineStrong, marginVertical: 16 },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.bone, textAlign: 'center' },
  hint: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.8,
    color: colors.slate2,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
});
