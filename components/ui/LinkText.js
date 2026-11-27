// LinkText — Dominia-Temp text link (plan U2; Figma "SIGN UP »",
// "FORGOT PASSWORD?", "RESEND CODE"). IBM Plex Sans Condensed Bold Italic
// caps, lime by default, with an optional » / « chevron. Hit area padded to
// 44pt.

import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, fonts } from '../../lib/theme';
import { hitSlopFor, warnMissingLabel } from './shared';

const TONES = {
  lime: colors.lime,
  muted: colors.muted2,
  white: colors.white,
};

export default function LinkText({
  children,
  onPress,
  chevron = null,
  tone = 'lime',
  size = 14,
  disabled = false,
  style,
  textStyle,
  accessibilityLabel,
  accessibilityHint,
  testID,
}) {
  const color = TONES[tone] ?? TONES.lime;
  const hasText = typeof children === 'string' && children.length > 0;
  warnMissingLabel('LinkText', hasText, accessibilityLabel);
  const lineHeight = Math.round(size * 1.3);
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      hitSlop={hitSlopFor(lineHeight)}
      accessibilityRole="link"
      accessibilityLabel={accessibilityLabel ?? (hasText ? children : undefined)}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!disabled }}
      testID={testID}
      style={({ pressed }) => [styles.base, (pressed || disabled) && styles.dim, style]}
    >
      <Text
        style={[styles.text, { color, fontSize: size, lineHeight, letterSpacing: size * 0.04 }, textStyle]}
        maxFontSizeMultiplier={1.4}
      >
        {hasText
          ? `${chevron === 'left' ? '« ' : ''}${children}${chevron === 'right' ? ' »' : ''}`
          : children}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
  },
  dim: {
    opacity: 0.6,
  },
  // One string child (not nested spans) and a little right padding: Android
  // measures italic letter-spaced spans too narrow and wraps or clips them.
  text: {
    fontFamily: fonts.action,
    textTransform: 'uppercase',
    includeFontPadding: false,
    paddingRight: 2,
  },
});
