// BackHeader — the Dominia-Temp "‹ Title" back row (boards 33, 38–41):
// a chevron and the screen name in IBM Plex Sans, with an optional node on
// the right (the Leaderboards board dropdown). The chevron and label together
// are the back button; without `onBack` the label stands alone. `bordered`
// draws the hairline under the row.

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '../../lib/theme';

export function ChevronLeftGlyph({ size = 18, color = colors.white }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Polyline points="15,5 8,12 15,19" stroke={color} strokeWidth={2.2} fill="none" />
    </Svg>
  );
}

export default function BackHeader({ label, onBack, right, bordered = false, accessibilityLabel }) {
  const insets = useSafeAreaInsets();
  const content = (
    <>
      {onBack ? <ChevronLeftGlyph size={18} /> : null}
      <Text style={styles.label} numberOfLines={1} maxFontSizeMultiplier={1.4} accessibilityRole="header">
        {label}
      </Text>
    </>
  );
  return (
    <View style={[styles.header, bordered && styles.bordered, { paddingTop: insets.top + 6 }]}>
      {onBack ? (
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel || label}
          hitSlop={6}
          style={({ pressed }) => [styles.back, pressed && { opacity: 0.6 }]}
        >
          {content}
        </Pressable>
      ) : (
        <View style={styles.back}>{content}</View>
      )}
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
    zIndex: 2,
  },
  bordered: {
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceLine,
  },
  back: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
  },
  label: {
    fontFamily: fonts.bodyMedium,
    fontSize: 16,
    color: colors.white,
  },
  right: {
    marginLeft: 'auto',
  },
});
