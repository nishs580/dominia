// Under-13 stop (plan U10). Reached from AgeScreen when the slider reads
// under 13. Nothing about the age is sent or stored; the player can go back
// (a mis-set slider) or sign out.

import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { colors, fonts } from '../lib/theme';

export default function AgeBlockedScreen({ onBack, onSignOut }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [signingOut, setSigningOut] = useState(false);

  const signOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await onSignOut?.();
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.body}>
        <Text style={styles.title} accessibilityRole="header" maxFontSizeMultiplier={1.2}>
          {t('ageBlocked.title', { defaultValue: 'Not yet' })}
        </Text>
        <Text style={styles.text}>
          {t('ageBlocked.body', {
            defaultValue: 'Dominia is for players aged 13 and over. Nothing you entered has been saved.',
          })}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={signOut}
        disabled={signingOut}
        style={({ pressed }) => [styles.secondary, (pressed || signingOut) && styles.pressed]}
      >
        <Text style={styles.secondaryText}>{t('ageBlocked.signOut', { defaultValue: 'Sign out' })}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={onBack} style={styles.back} hitSlop={8}>
        <Text style={styles.backText}>{t('common.back')}</Text>
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
    marginBottom: 12,
  },
  text: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.bone },
  secondary: {
    backgroundColor: colors.ink2,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: { fontFamily: fonts.monoMedium, fontSize: 14, letterSpacing: 2, color: colors.bone, textTransform: 'uppercase' },
  pressed: { backgroundColor: colors.ink3 },
  back: { alignSelf: 'center', minHeight: 48, justifyContent: 'center', paddingHorizontal: 24, marginTop: 8 },
  backText: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.4, color: colors.slate2, textTransform: 'uppercase' },
});
