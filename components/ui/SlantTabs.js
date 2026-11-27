// SlantTabs — Dominia-Temp segmented control (plan U2; Figma SOLO/ALLIANCE,
// MARCH/RANGE, GLOBAL/ALLIANCE). Side-by-side parallelograms of equal width;
// the active one is a blue gradient with a white label, the rest dark with a
// muted label. Labels in IBM Plex Sans Condensed Bold Italic caps.
//
// tabs: [{ key, label, icon?, accessibilityLabel? }] — `icon` is a node or a
// function ({ selected, color }) => node.

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Polygon, Stop } from 'react-native-svg';
import { colors, fonts } from '../../lib/theme';
import { parallelogramPoints } from '../../lib/slantGeometry';
import { hitSlopFor, useLayoutSize, useSvgId } from './shared';

function Tab({ tab, selected, onPress, height }) {
  const [box, onLayout] = useLayoutSize();
  const gradId = useSvgId('slanttab');
  const color = selected ? colors.white : colors.muted2;
  const icon = typeof tab.icon === 'function' ? tab.icon({ selected, color }) : tab.icon;
  return (
    <Pressable
      onPress={onPress}
      onLayout={onLayout}
      hitSlop={hitSlopFor(height)}
      accessibilityRole="tab"
      accessibilityLabel={tab.accessibilityLabel ?? (typeof tab.label === 'string' ? tab.label : undefined)}
      accessibilityState={{ selected }}
      testID={tab.testID}
      style={({ pressed }) => [styles.tab, { minHeight: height }, pressed && !selected && styles.pressed]}
    >
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <LinearGradient id={gradId} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#2F55E8" />
            <Stop offset="1" stopColor={colors.action} />
          </LinearGradient>
        </Defs>
        <Polygon
          points={parallelogramPoints(box.w, box.h)}
          fill={selected ? `url(#${gradId})` : colors.surface}
        />
      </Svg>
      {icon}
      <Text style={[styles.label, { color }]} numberOfLines={1} maxFontSizeMultiplier={1.4}>
        {tab.label}
      </Text>
    </Pressable>
  );
}

export default function SlantTabs({ tabs = [], value, onChange, height = 44, gap = 8, style, testID }) {
  return (
    <View accessibilityRole="tablist" style={[styles.row, { gap }, style]} testID={testID}>
      {tabs.map((tab) => (
        <Tab
          key={tab.key}
          tab={tab}
          height={height}
          selected={tab.key === value}
          onPress={() => {
            if (tab.key !== value) onChange?.(tab.key);
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignSelf: 'stretch',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  pressed: {
    opacity: 0.8,
  },
  label: {
    fontFamily: fonts.action,
    fontSize: 15,
    letterSpacing: 0.75,
    textTransform: 'uppercase',
    includeFontPadding: false,
  },
});
