// CutCard — the Dominia-Temp card / row (plan U2; Figma missions, alliance,
// leaderboard rows). Rectangle with an 8pt diagonal cut on the bottom-right,
// a dark-blue-to-black left-to-right gradient and a #2A2A2A border.
//
//   default   surfaceLine border
//   selected  Dominia-blue border, stronger blue gradient
//   danger    red border over a faint red tint
//
// Static by default; pass `onPress` to make the whole card a button.

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Polygon, Stop } from 'react-native-svg';
import { colors } from '../../lib/theme';
import { cutCornerPoints } from '../../lib/slantGeometry';
import { useLayoutSize, useSvgId, warnMissingLabel } from './shared';

const VARIANTS = {
  default: { from: 'rgba(3,20,90,0.55)', to: '#000000', stroke: colors.surfaceLine },
  selected: { from: 'rgba(7,49,209,0.45)', to: 'rgba(3,20,90,0.35)', stroke: colors.action },
  danger: { from: 'rgba(227,66,52,0.12)', to: 'rgba(227,66,52,0.06)', stroke: colors.danger },
};

export default function CutCard({
  variant = 'default',
  padding = 16,
  cut = 8,
  onPress,
  disabled = false,
  style,
  children,
  accessibilityLabel,
  accessibilityRole,
  accessibilityHint,
  testID,
}) {
  const v = VARIANTS[variant] ?? VARIANTS.default;
  const [box, onLayout] = useLayoutSize();
  const gradId = useSvgId('cutcard');
  const points = cutCornerPoints(box.w, box.h, cut, 'br', 0.5);

  const background = (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <LinearGradient id={gradId} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={v.from} />
          <Stop offset="1" stopColor={v.to} />
        </LinearGradient>
      </Defs>
      <Polygon points={points} fill={`url(#${gradId})`} stroke={v.stroke} strokeWidth={1} />
    </Svg>
  );

  if (onPress) {
    warnMissingLabel('CutCard', false, accessibilityLabel);
    return (
      <Pressable
        onPress={disabled ? undefined : onPress}
        disabled={disabled}
        onLayout={onLayout}
        accessibilityRole={accessibilityRole ?? 'button'}
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled: !!disabled, selected: variant === 'selected' }}
        testID={testID}
        style={({ pressed }) => [
          styles.base,
          { padding },
          pressed && !disabled && styles.pressed,
          disabled && styles.disabled,
          style,
        ]}
      >
        {background}
        {children}
      </Pressable>
    );
  }

  return (
    <View
      onLayout={onLayout}
      accessibilityRole={accessibilityRole ?? (accessibilityLabel ? 'summary' : undefined)}
      accessible={accessibilityLabel ? true : undefined}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={variant === 'selected' ? { selected: true } : undefined}
      testID={testID}
      style={[styles.base, { padding }, style]}
    >
      {background}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'stretch',
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.45,
  },
});
