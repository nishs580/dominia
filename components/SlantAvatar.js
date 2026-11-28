// Dominia-Temp avatar tile (plan U10; boards 33 and 38): a Dominia-blue
// parallelogram showing the player's photo clipped to the slant, or a person
// glyph when there is no photo. Used by the Profile identity row and the
// Edit Profile MY DETAILS block.

import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Svg, {
  Circle,
  ClipPath,
  Defs,
  Image as SvgImage,
  LinearGradient,
  Path,
  Polygon,
  Stop,
} from 'react-native-svg';
import { colors } from '../lib/theme';
import { parallelogramPoints, slantInset } from '../lib/slantGeometry';
import { useSvgId } from './ui/shared';

export function PersonGlyph({ size = 28, color = colors.white, strokeWidth = 2 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx="12" cy="8" r="4" stroke={color} strokeWidth={strokeWidth} fill="none" />
      <Path d="M4 21 C4 16.6 7.6 14 12 14 C16.4 14 20 16.6 20 21" stroke={color} strokeWidth={strokeWidth} fill="none" />
    </Svg>
  );
}

/**
 * @param {object} props
 * @param {string|null} props.uri photo URL (already sized, e.g. avatarThumb)
 * @param {number} props.height tile height; width adds the slant inset
 * @param {number} [props.slant] slant in degrees
 * @param {boolean} [props.busy] overlays a spinner (upload in progress)
 * @param {string} [props.accessibilityLabel]
 */
export default function SlantAvatar({ uri, height = 64, slant = 14, busy = false, accessibilityLabel, style }) {
  const gradId = useSvgId('avatar-grad');
  const clipId = useSvgId('avatar-clip');
  const inset = slantInset(height, slant);
  const width = Math.round(height + inset);
  const points = parallelogramPoints(width, height, slant);
  return (
    <View
      style={[{ width, height }, style]}
      accessible={!!accessibilityLabel}
      accessibilityRole={accessibilityLabel ? 'image' : undefined}
      accessibilityLabel={accessibilityLabel}
    >
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={colors.action} />
            <Stop offset="1" stopColor={colors.actionDeep} />
          </LinearGradient>
          <ClipPath id={clipId}>
            <Polygon points={points} />
          </ClipPath>
        </Defs>
        <Polygon points={points} fill={`url(#${gradId})`} />
        {uri ? (
          <SvgImage
            href={{ uri }}
            x={0}
            y={0}
            width={width}
            height={height}
            preserveAspectRatio="xMidYMid slice"
            clipPath={`url(#${clipId})`}
          />
        ) : null}
      </Svg>
      {!uri ? (
        <View style={styles.center} pointerEvents="none">
          <PersonGlyph size={Math.round(height * 0.42)} />
        </View>
      ) : null}
      {busy ? (
        <View style={[styles.center, styles.busy]} pointerEvents="none">
          <ActivityIndicator color={colors.white} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  busy: {
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
});
