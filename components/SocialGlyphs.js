// Dominia-Temp glyphs and the "‹ Title" back header shared by the
// Leaderboards, History and Chat screens (plan 2026-11-28 U11, boards 39–41).
// Stroke icons on a 24-unit grid, drawn with react-native-svg.

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, Line, LinearGradient, Path, Polygon, Polyline, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '../lib/theme';
import { cutCornerPoints } from '../lib/slantGeometry';
import { useLayoutSize, useSvgId } from './ui/shared';

const SW = 1.8;

export function PersonGlyph({ size = 18, color = colors.white }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx="12" cy="8" r="4" stroke={color} strokeWidth={SW} fill="none" />
      <Path d="M4.5 20.5c0-4 3.4-6 7.5-6s7.5 2 7.5 6" stroke={color} strokeWidth={SW} fill="none" />
    </Svg>
  );
}

export function PeopleGlyph({ size = 18, color = colors.white }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx="9" cy="8.5" r="3.5" stroke={color} strokeWidth={SW} fill="none" />
      <Path d="M2.5 20c0-3.6 2.9-5.5 6.5-5.5s6.5 1.9 6.5 5.5" stroke={color} strokeWidth={SW} fill="none" />
      <Path d="M15.5 5.2a3.5 3.5 0 0 1 0 6.6" stroke={color} strokeWidth={SW} fill="none" />
      <Path d="M17.5 14.8c2.4.6 4 2.3 4 5.2" stroke={color} strokeWidth={SW} fill="none" />
    </Svg>
  );
}

export function GlobeGlyph({ size = 18, color = colors.white }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth={SW} fill="none" />
      <Ellipse cx="12" cy="12" rx="4" ry="9" stroke={color} strokeWidth={SW} fill="none" />
      <Line x1="3" y1="12" x2="21" y2="12" stroke={color} strokeWidth={SW} />
    </Svg>
  );
}

export function SearchGlyph({ size = 14, color = colors.white }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx="10.5" cy="10.5" r="6.5" stroke={color} strokeWidth={2.2} fill="none" />
      <Line x1="15.5" y1="15.5" x2="21" y2="21" stroke={color} strokeWidth={2.2} />
    </Svg>
  );
}

export function ChevronDownGlyph({ size = 14, color = colors.white }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Polyline points="6,9 12,15 18,9" stroke={color} strokeWidth={2.2} fill="none" />
    </Svg>
  );
}

export function ChevronLeftGlyph({ size = 18, color = colors.white }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Polyline points="15,5 8,12 15,19" stroke={color} strokeWidth={2.2} fill="none" />
    </Svg>
  );
}

export function CrownGlyph({ size = 16, color = '#F5B700' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z" stroke={color} strokeWidth={SW} fill="none" strokeLinejoin="round" />
    </Svg>
  );
}

export function SendGlyph({ size = 16, color = colors.white }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M7 4.5L19.5 12 7 19.5z" fill={color} />
    </Svg>
  );
}

export function FlagGlyph({ size = 18, color = colors.white }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Line x1="6" y1="3" x2="6" y2="21" stroke={color} strokeWidth={SW} />
      <Path d="M6 4h11l-2.5 4L17 12H6" stroke={color} strokeWidth={SW} fill="none" strokeLinejoin="round" />
    </Svg>
  );
}

export function SwordsGlyph({ size = 18, color = colors.white }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Line x1="4" y1="4" x2="16" y2="16" stroke={color} strokeWidth={SW} />
      <Line x1="20" y1="4" x2="8" y2="16" stroke={color} strokeWidth={SW} />
      <Line x1="13.5" y1="18.5" x2="18.5" y2="13.5" stroke={color} strokeWidth={SW} />
      <Line x1="5.5" y1="13.5" x2="10.5" y2="18.5" stroke={color} strokeWidth={SW} />
      <Line x1="16.5" y1="16.5" x2="20" y2="20" stroke={color} strokeWidth={SW} />
      <Line x1="7.5" y1="16.5" x2="4" y2="20" stroke={color} strokeWidth={SW} />
    </Svg>
  );
}

export function ShieldGlyph({ size = 18, color = colors.white }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 3l7 2.8V11c0 4.6-3 8-7 10-4-2-7-5.4-7-10V5.8z" stroke={color} strokeWidth={SW} fill="none" strokeLinejoin="round" />
    </Svg>
  );
}

/**
 * CutCard look (dark-blue-to-black gradient, 8pt bottom-right cut) with any
 * border colour: the gold / bronze / silver leaderboard rows and the lime
 * @mention chat row, which components/ui/CutCard's variants don't cover.
 */
export function ToneCutCard({ stroke = colors.surfaceLine, from = 'rgba(3,20,90,0.55)', style, children }) {
  const [box, onLayout] = useLayoutSize();
  const gradId = useSvgId('tonecut');
  return (
    <View onLayout={onLayout} style={style}>
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <LinearGradient id={gradId} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={from} />
            <Stop offset="1" stopColor="#000000" />
          </LinearGradient>
        </Defs>
        <Polygon points={cutCornerPoints(box.w, box.h, 8, 'br', 0.5)} fill={`url(#${gradId})`} stroke={stroke} strokeWidth={1} />
      </Svg>
      {children}
    </View>
  );
}

/**
 * "‹ Leaderboards" header (boards 39–41): a chevron and the screen name in
 * IBM Plex Sans SemiBold, with an optional node on the right (the board
 * dropdown). The whole label is the back button.
 */
export function BackLinkHeader({ label, onBack, right, bordered = false, backLabel }) {
  const insets = useSafeAreaInsets();
  const content = (
    <>
      <ChevronLeftGlyph size={18} />
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
          accessibilityLabel={backLabel || label}
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
