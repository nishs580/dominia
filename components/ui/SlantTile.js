// SlantTile — small Dominia-Temp parallelogram (plan U2): map rail buttons,
// the avatar initials tile, resource pills, emblem and logo picker cells.
// Dark fill by default, Dominia-blue fill when `selected`.
//
// `size` is the minimum height; width follows the content plus padding unless
// `width` is given (`square` makes it size + slant inset, so the visible face
// reads square). Pass `onPress` for a button; without it the tile is static.

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';
import { colors } from '../../lib/theme';
import { parallelogramPoints, slantInset } from '../../lib/slantGeometry';
import { hitSlopFor, useLayoutSize, warnMissingLabel } from './shared';

const FILLS = {
  solid: colors.surface,
  glass: 'rgba(255,255,255,0.06)',
  raised: colors.raised,
};

export default function SlantTile({
  size = 44,
  width,
  square = false,
  selected = false,
  tone = 'solid',
  slant = 14,
  paddingHorizontal,
  onPress,
  disabled = false,
  style,
  children,
  accessibilityLabel,
  accessibilityRole,
  accessibilityHint,
  testID,
}) {
  const [box, onLayout] = useLayoutSize();
  const inset = slantInset(size, slant);
  const fixedWidth = width ?? (square ? Math.round(size + inset) : undefined);
  const padX = paddingHorizontal ?? Math.ceil(inset + 6);
  const fill = selected ? colors.action : FILLS[tone] ?? FILLS.solid;

  const boxStyle = [
    styles.base,
    { minHeight: size, paddingHorizontal: fixedWidth ? 0 : padX },
    fixedWidth ? { width: fixedWidth } : null,
  ];
  const background = (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Polygon points={parallelogramPoints(box.w, box.h, slant)} fill={fill} />
    </Svg>
  );

  if (onPress) {
    warnMissingLabel('SlantTile', false, accessibilityLabel);
    return (
      <Pressable
        onPress={disabled ? undefined : onPress}
        disabled={disabled}
        onLayout={onLayout}
        hitSlop={hitSlopFor(size)}
        accessibilityRole={accessibilityRole ?? 'button'}
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ selected: !!selected, disabled: !!disabled }}
        testID={testID}
        style={({ pressed }) => [boxStyle, pressed && !disabled && styles.pressed, disabled && styles.disabled, style]}
      >
        {background}
        {children}
      </Pressable>
    );
  }

  return (
    <View
      onLayout={onLayout}
      accessible={accessibilityLabel ? true : undefined}
      accessibilityRole={accessibilityRole ?? (accessibilityLabel ? 'text' : undefined)}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={selected ? { selected: true } : undefined}
      testID={testID}
      style={[boxStyle, style]}
    >
      {background}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.8,
  },
  disabled: {
    opacity: 0.45,
  },
});
