// Shared pieces of the Dominia-Temp auth boards (plan U3): the backdrop
// (black with a soft Dominia-blue radial glow, optional splash grid), the
// Google "G" glyph, the "OR" divider and the form-level error line.

import React from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Svg, { Defs, Ellipse, Line, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { colors, fonts } from '../lib/theme';

const GRID = 46;

/** Absolutely fills its parent; ignores touches. */
export function AuthBackdrop({ grid = false }) {
  const { width, height } = useWindowDimensions();
  const lines = [];
  if (grid) {
    for (let x = GRID / 2; x < width; x += GRID) {
      lines.push(<Line key={`v${x}`} x1={x} y1={0} x2={x} y2={height} stroke="rgba(91,123,245,0.12)" strokeWidth={1} />);
    }
    for (let y = GRID; y < height; y += GRID) {
      lines.push(<Line key={`h${y}`} x1={0} y1={y} x2={width} y2={y} stroke="rgba(91,123,245,0.12)" strokeWidth={1} />);
    }
  }
  return (
    <Svg style={StyleSheet.absoluteFill} width={width} height={height} pointerEvents="none">
      <Defs>
        <RadialGradient id="authGlowTop" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={colors.action} stopOpacity="0.42" />
          <Stop offset="0.55" stopColor={colors.actionDeep} stopOpacity="0.28" />
          <Stop offset="1" stopColor={colors.obsidian} stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id="authGlowBottom" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={colors.actionDeep} stopOpacity="0.55" />
          <Stop offset="1" stopColor={colors.obsidian} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={width} height={height} fill={colors.obsidian} />
      <Ellipse cx={width / 2} cy={0} rx={width * 0.95} ry={height * 0.42} fill="url(#authGlowTop)" />
      <Ellipse cx={width / 2} cy={height} rx={width * 0.9} ry={height * 0.22} fill="url(#authGlowBottom)" />
      {lines}
    </Svg>
  );
}

/** Monochrome Google "G" for the outline CONTINUE WITH GOOGLE button. */
export function GoogleGlyph({ size = 16, color = colors.white }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 18 18" accessibilityElementsHidden importantForAccessibility="no">
      <Path
        d="M14.6 4.6A7 7 0 1 0 16 9.6H9.4"
        stroke={color}
        strokeWidth={2.4}
        strokeLinecap="square"
        fill="none"
      />
    </Svg>
  );
}

/** Hairline — OR — hairline. */
export function OrDivider({ style }) {
  const { t } = useTranslation();
  return (
    <View style={[styles.orRow, style]}>
      <View style={styles.orLine} />
      <Text style={styles.orText} maxFontSizeMultiplier={1.3}>
        {t('auth.or', { defaultValue: 'OR' })}
      </Text>
      <View style={styles.orLine} />
    </View>
  );
}

/** The single form-level error line above a primary button. */
export function FormError({ children }) {
  if (!children) return null;
  return (
    <Text style={styles.formError} accessibilityRole="alert" accessibilityLiveRegion="polite" maxFontSizeMultiplier={1.4}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  orRow: { flexDirection: 'row', alignItems: 'center', gap: 12, alignSelf: 'stretch' },
  orLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.hairlineStrong },
  orText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.5,
    color: colors.muted2,
    textTransform: 'uppercase',
  },
  formError: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
    color: colors.danger,
    marginBottom: 12,
    alignSelf: 'stretch',
  },
});
