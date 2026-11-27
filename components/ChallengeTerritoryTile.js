// components/ChallengeTerritoryTile.js
// The big rotated territory square of the Dominia-Temp challenge flow (plan
// 2026-11-28 U7; boards "Challenge flow", "Victory", "Defeat").
//
//   blue     Dominia-blue gradient square (ready countdown, securing,
//            cancelling). Children (the "59") sit centred, unrotated.
//   victory  lime-outlined square with a soft lime glow and a shield-check.
//   defeat   red-outlined square, red glow, a black crack through it and a
//            broken shield.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Polygon, Polyline, RadialGradient, Stop } from 'react-native-svg';
import { colors } from '../lib/theme';
import { useSvgId } from './ui/shared';

const ANGLE_DEG = -27;

// Corners of a square of half-side h rotated by ANGLE_DEG about (c, c).
function squarePoints(c, h) {
  const a = (ANGLE_DEG * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  return [[-h, -h], [h, -h], [h, h], [-h, h]]
    .map(([x, y]) => `${(c + x * cos - y * sin).toFixed(2)},${(c + x * sin + y * cos).toFixed(2)}`)
    .join(' ');
}

// A point on the rotated square in its own (unrotated) frame.
function rot(c, x, y) {
  const a = (ANGLE_DEG * Math.PI) / 180;
  return [c + x * Math.cos(a) - y * Math.sin(a), c + x * Math.sin(a) + y * Math.cos(a)];
}

function ShieldGlyph({ c, broken, color }) {
  // 24-unit shield path, scaled about the tile centre.
  const s = 1.1;
  const ox = c - 12 * s;
  const oy = c - 12 * s;
  return (
    <>
      <Circle cx={c} cy={c} r={22} fill="#000000" opacity={0.85} />
      <Path
        d="M12 3 L19 6 V11.5 C19 15.8 16 19.2 12 21 C8 19.2 5 15.8 5 11.5 V6 Z"
        fill="none"
        stroke={colors.white}
        strokeWidth={1.8}
        strokeLinejoin="round"
        transform={`translate(${ox} ${oy}) scale(${s})`}
      />
      {broken ? (
        <Path
          d="M13 7 L10 12 H13.5 L11 17"
          fill="none"
          stroke={color}
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          transform={`translate(${ox} ${oy}) scale(${s})`}
        />
      ) : (
        <Path
          d="M9 12 L11.2 14.2 L15.2 9.8"
          fill="none"
          stroke={colors.white}
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          transform={`translate(${ox} ${oy}) scale(${s})`}
        />
      )}
    </>
  );
}

/**
 * @param {object} props
 * @param {number} props.size              Outer box (the rotated square's bounding box).
 * @param {'blue'|'victory'|'defeat'} [props.variant]
 * @param {React.ReactNode} [props.children]  Centred over the tile (blue only).
 */
export default function ChallengeTerritoryTile({ size = 220, variant = 'blue', children, style }) {
  const gradId = useSvgId('chtile');
  const glowId = useSvgId('chglow');
  const c = size / 2;
  const a = (Math.abs(ANGLE_DEG) * Math.PI) / 180;
  // Half-side that fits the rotated square inside the box (with room for glow).
  const pad = variant === 'blue' ? 0 : 10;
  const h = (c - pad) / (Math.cos(a) + Math.sin(a));
  const points = squarePoints(c, h);

  if (variant === 'blue') {
    return (
      <View style={[{ width: size, height: size }, styles.center, style]}>
        <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#2A55FF" />
              <Stop offset="0.55" stopColor={colors.action} />
              <Stop offset="1" stopColor={colors.actionPressed} />
            </LinearGradient>
          </Defs>
          <Polygon points={points} fill={`url(#${gradId})`} />
        </Svg>
        {children}
      </View>
    );
  }

  const tone = variant === 'victory' ? colors.lime : colors.danger;
  // Crack: from the top edge down to the bottom edge, zig-zagging.
  const crack = variant === 'defeat'
    ? [rot(c, -h * 0.05, -h), rot(c, h * 0.08, -h * 0.55), rot(c, -h * 0.12, -h * 0.2),
      rot(c, h * 0.05, h * 0.15), rot(c, -h * 0.08, h * 0.55), rot(c, h * 0.04, h)]
      .map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
    : null;

  return (
    <View style={[{ width: size, height: size }, style]} importantForAccessibility="no-hide-descendants">
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={glowId} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={tone} stopOpacity={0.45} />
            <Stop offset="0.7" stopColor={tone} stopOpacity={0.12} />
            <Stop offset="1" stopColor={tone} stopOpacity={0.04} />
          </RadialGradient>
        </Defs>
        {/* Outer glow: a wide, faint stroke behind the outline. */}
        <Polygon points={points} fill="none" stroke={tone} strokeOpacity={0.18} strokeWidth={14} strokeLinejoin="round" />
        <Polygon points={points} fill={`url(#${glowId})`} stroke={tone} strokeWidth={2.5} />
        {crack ? (
          <Polyline points={crack} fill="none" stroke="#000000" strokeWidth={6} strokeLinejoin="miter" />
        ) : null}
        <ShieldGlyph c={c} broken={variant === 'defeat'} color={tone} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
});
