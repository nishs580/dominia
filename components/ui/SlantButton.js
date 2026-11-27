// SlantButton — the Dominia-Temp parallelogram button (plan U2; Figma sign-in,
// pop-ups, missions). 14° slant, label in IBM Plex Sans Condensed Bold Italic
// caps with a trailing "»".
//
//   primary  #0731D1 fill, white label (SIGN IN »)
//   outline  2pt white border, no fill (CONTINUE WITH GOOGLE)
//   ghost    dark #1A1A1D fill, muted label (NOT YET, CANCEL CLAIM, LOCK)
//
// `loading` keeps the label, swaps the "»" for a spinner, blocks presses and
// reports busy. `disabled` blocks presses and dims (primary turns deep blue).
// Heights are minimums: the shape is drawn from the measured size, so it grows
// with large text.

import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';
import { colors, fonts } from '../../lib/theme';
import { buttonState, parallelogramPoints } from '../../lib/slantGeometry';
import { hitSlopFor, useLayoutSize, warnMissingLabel, SHAPE_LAYER } from './shared';

const SIZES = {
  lg: { minHeight: 56, fontSize: 19, letterSpacing: 0.95, chevron: 20, padX: 28, gap: 10 },
  md: { minHeight: 44, fontSize: 16, letterSpacing: 0.8, chevron: 17, padX: 22, gap: 8 },
  sm: { minHeight: 36, fontSize: 14, letterSpacing: 0.56, chevron: 15, padX: 16, gap: 6 },
};

function paletteFor(variant, { disabled, pressed }) {
  switch (variant) {
    case 'outline':
      return {
        fill: pressed ? 'rgba(253,253,253,0.08)' : 'transparent',
        stroke: disabled ? colors.muted : colors.white,
        strokeWidth: 2,
        text: disabled ? colors.muted : colors.white,
        opacity: 1,
      };
    case 'ghost':
      return {
        fill: pressed ? '#232327' : colors.raised,
        stroke: null,
        strokeWidth: 0,
        text: colors.muted2,
        opacity: disabled ? 0.45 : 1,
      };
    case 'primary':
    default:
      if (disabled) {
        return { fill: colors.actionDeep, stroke: null, strokeWidth: 0, text: colors.muted2, opacity: 1 };
      }
      return {
        fill: pressed ? colors.actionPressed : colors.action,
        stroke: null,
        strokeWidth: 0,
        text: colors.white,
        opacity: 1,
      };
  }
}

export default function SlantButton({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  leading = null,
  trailingChevron,
  size = 'lg',
  style,
  accessibilityLabel,
  accessibilityHint,
  testID,
}) {
  const dims = SIZES[size] ?? SIZES.lg;
  const { pressable, busy } = buttonState({ disabled, loading });
  const [box, onLayout] = useLayoutSize();
  const showChevron = trailingChevron ?? variant !== 'ghost';
  const hasText = typeof label === 'string' && label.length > 0;
  warnMissingLabel('SlantButton', hasText, accessibilityLabel);

  return (
    <Pressable
      onPress={pressable ? onPress : undefined}
      disabled={!pressable}
      onLayout={onLayout}
      hitSlop={hitSlopFor(dims.minHeight)}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (hasText ? label : undefined)}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!disabled, busy }}
      testID={testID}
      style={[styles.base, { minHeight: dims.minHeight, paddingHorizontal: dims.padX }, style]}
    >
      {({ pressed }) => {
        const pal = paletteFor(variant, { disabled, pressed: pressed && pressable });
        const half = pal.strokeWidth / 2;
        return (
          <>
            <Svg style={SHAPE_LAYER} width={box.w || 0} height={box.h || 0} pointerEvents="none">
              <Polygon
                points={parallelogramPoints(box.w, box.h, 14, half)}
                fill={pal.fill}
                stroke={pal.stroke ?? undefined}
                strokeWidth={pal.strokeWidth || undefined}
                opacity={pal.opacity}
              />
            </Svg>
            <View style={[styles.row, { gap: dims.gap, opacity: pal.opacity }]}>
              {leading}
              {hasText ? (
                <Text
                  style={[
                    styles.label,
                    { fontSize: dims.fontSize, letterSpacing: dims.letterSpacing, color: pal.text },
                  ]}
                  maxFontSizeMultiplier={1.4}
                  numberOfLines={2}
                >
                  {label}
                </Text>
              ) : null}
              {busy ? (
                <ActivityIndicator size="small" color={pal.text} />
              ) : showChevron ? (
                <Text
                  style={[styles.chevron, { fontSize: dims.chevron, color: pal.text }]}
                  maxFontSizeMultiplier={1.4}
                  importantForAccessibility="no"
                  accessibilityElementsHidden
                >
                  »
                </Text>
              ) : null}
            </View>
          </>
        );
      }}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 1,
  },
  label: {
    fontFamily: fonts.action,
    textTransform: 'uppercase',
    textAlign: 'center',
    includeFontPadding: false,
    flexShrink: 1,
  },
  chevron: {
    fontFamily: fonts.action,
    letterSpacing: -2,
    includeFontPadding: false,
  },
});
