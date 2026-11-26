// Figma screen header (G1, G5–G10): a left arrow back button beside a large
// Sofia Sans display title, with an optional right-hand action (the Profile
// pencil). Used by the Figma-mode Profile, Edit Profile, Leaderboards,
// History and Chat screens (plan 2026-11-27 U13).

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Polyline } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { colors, fonts } from '../lib/theme';

export function BackArrowGlyph({ size = 24, color = colors.bone }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Line x1="20" y1="12" x2="4.5" y2="12" stroke={color} strokeWidth={2} />
      <Polyline points="11,5 4,12 11,19" stroke={color} strokeWidth={2} fill="none" />
    </Svg>
  );
}

export default function BackTitleHeader({ title, onBack, right, bordered = false }) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  return (
    <View style={[styles.header, bordered && styles.bordered, { paddingTop: insets.top + 8 }]}>
      {onBack ? (
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel={t('common.back', { defaultValue: 'Back' })}
          hitSlop={8}
          style={({ pressed }) => [styles.back, pressed && { opacity: 0.6 }]}
        >
          <BackArrowGlyph />
        </Pressable>
      ) : (
        <View style={styles.spacer} />
      )}
      <Text
        style={styles.title}
        accessibilityRole="header"
        maxFontSizeMultiplier={1.2}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
      >
        {title}
      </Text>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingBottom: 8,
  },
  bordered: {
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  back: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spacer: {
    width: 12,
  },
  title: {
    flex: 1,
    marginLeft: 4,
    fontFamily: fonts.display,
    fontSize: 32,
    lineHeight: 36,
    color: colors.bone,
    textTransform: 'uppercase',
  },
  right: {
    marginLeft: 8,
    marginRight: 4,
  },
});
