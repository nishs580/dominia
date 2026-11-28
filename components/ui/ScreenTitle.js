// ScreenTitle — Dominia-Temp screen heading (plan U2). Archivo Black Italic
// caps in white, with an optional eyebrow above (a 14×3 Dominia-blue bar and
// a tracked Plex Sans Bold caps label, e.g. "ACCOUNT", "UNCLAIMED") and an
// optional muted subtitle below.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../../lib/theme';

export default function ScreenTitle({
  eyebrow,
  title,
  subtitle,
  align = 'left',
  size = 36,
  style,
  titleStyle,
  testID,
}) {
  const centered = align === 'center';
  const textAlign = centered ? 'center' : 'left';
  return (
    <View style={[styles.wrap, centered && styles.centered, style]} testID={testID}>
      {eyebrow ? (
        <View style={[styles.eyebrowRow, centered && styles.centeredRow]}>
          <View style={styles.bar} />
          <Text style={styles.eyebrow} maxFontSizeMultiplier={1.3} numberOfLines={1}>
            {eyebrow}
          </Text>
        </View>
      ) : null}
      <Text
        accessibilityRole="header"
        style={[styles.title, { fontSize: size, lineHeight: Math.round(size * 1.12), textAlign }, titleStyle]}
        maxFontSizeMultiplier={1.3}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text style={[styles.subtitle, { textAlign }]} maxFontSizeMultiplier={1.4}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'stretch',
  },
  centered: {
    alignItems: 'center',
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  centeredRow: {
    justifyContent: 'center',
  },
  bar: {
    width: 14,
    height: 3,
    backgroundColor: colors.action,
  },
  eyebrow: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: colors.muted2,
  },
  title: {
    fontFamily: fonts.display,
    color: colors.white,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    includeFontPadding: false,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.muted2,
    marginTop: 6,
  },
});
