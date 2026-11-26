// "WELCOME TO / DOMINIA" overlay on the map (Updated UX A8). A full-screen
// scrim over the map with a two-line title, the body and a lime bordered
// "TAP ON THE SCREEN TO CONTINUE" chip; tapping anywhere continues to the
// tutorial cards. Rendered by OnboardingTutorialLifecycle, inside its Modal.

import React, { useEffect } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, fonts } from '../lib/theme';

export default function WelcomeOverlay({ onContinue }) {
  const { t } = useTranslation();
  const titleTop = t('welcomeOverlay.titleTop', { defaultValue: 'Welcome to' });
  const titleMain = t('welcomeOverlay.titleMain', { defaultValue: 'Dominia' });
  const body = t('welcomeOverlay.body', { defaultValue: 'Let us start understanding how the game works.' });
  const hint = t('welcomeOverlay.tapToContinue', { defaultValue: 'Tap on the screen to continue' });
  const title = `${titleTop} ${titleMain}`;

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
        <Text style={styles.titleTop} maxFontSizeMultiplier={1.2}>
          {titleTop}
        </Text>
        <Text style={styles.titleMain} maxFontSizeMultiplier={1.2}>
          {titleMain}
        </Text>
        <Text style={styles.body}>{body}</Text>
        <View style={styles.chip}>
          <Text style={styles.chipText} maxFontSizeMultiplier={1.3}>
            {hint}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(16,16,16,0.78)',
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  center: { alignItems: 'center' },
  titleTop: {
    fontFamily: fonts.displayBold,
    fontSize: 24,
    lineHeight: 26,
    color: colors.white2,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  titleMain: {
    fontFamily: fonts.display,
    fontSize: 52,
    lineHeight: 54,
    letterSpacing: -1,
    color: colors.white,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginTop: 12,
  },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: colors.muted2, textAlign: 'center', marginTop: 16 },
  chip: {
    borderWidth: 1,
    borderColor: colors.lime,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 16,
  },
  chipText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.lime,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
});
