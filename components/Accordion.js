// One collapsible Profile section (plan U10; boards 33, 36, 37): a cut-corner
// card whose header row has a slanted icon tile, the title (Plex SemiBold 16),
// optional right-hand meta such as a count, and a + / − marker. Open sections
// take a Dominia-blue border and show their content under a hairline.
// Sections are independent, so any number can be open at once. Starts closed.
//
// Controlled when `expanded` is passed (with `onToggle`), otherwise it keeps
// its own state. The header exposes its expanded/collapsed state to screen
// readers.

import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, Line, LinearGradient, Polygon, Stop } from 'react-native-svg';
import { colors, fonts } from '../lib/theme';
import { cutCornerPoints } from '../lib/slantGeometry';
import { SlantTile } from './ui';
import { useLayoutSize, useSvgId } from './ui/shared';

function PlusMinus({ open, color = colors.white }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16">
      <Line x1="2" y1="8" x2="14" y2="8" stroke={color} strokeWidth={1.6} />
      {open ? null : <Line x1="8" y1="2" x2="8" y2="14" stroke={color} strokeWidth={1.6} />}
    </Svg>
  );
}

export default function Accordion({ title, icon, meta, expanded, onToggle, children, testID, style }) {
  const [ownOpen, setOwnOpen] = useState(false);
  const controlled = typeof expanded === 'boolean';
  const open = controlled ? expanded : ownOpen;
  const [box, onLayout] = useLayoutSize();
  const gradId = useSvgId('accordion');

  const toggle = () => {
    if (!controlled) setOwnOpen((v) => !v);
    onToggle?.(!open);
  };

  return (
    <View style={[styles.section, style]} testID={testID} onLayout={onLayout}>
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <LinearGradient id={gradId} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="rgba(3,20,90,0.55)" />
            <Stop offset="1" stopColor="#000000" />
          </LinearGradient>
        </Defs>
        <Polygon
          points={cutCornerPoints(box.w, box.h, 8, 'br', 0.5)}
          fill={`url(#${gradId})`}
          stroke={open ? colors.action : colors.surfaceLine}
          strokeWidth={1}
        />
      </Svg>
      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityLabel={meta != null && meta !== '' ? `${title}, ${meta}` : title}
        accessibilityState={{ expanded: open }}
        style={({ pressed }) => [styles.header, pressed && styles.headerPressed]}
      >
        <SlantTile size={36} square tone="raised" style={styles.iconTile}>
          {icon ? <View importantForAccessibility="no-hide-descendants">{icon}</View> : null}
        </SlantTile>
        <Text style={styles.title} maxFontSizeMultiplier={1.3} numberOfLines={1}>
          {title}
        </Text>
        {meta != null && meta !== '' ? (
          <Text style={styles.meta} maxFontSizeMultiplier={1.3} importantForAccessibility="no" accessibilityElementsHidden>
            {meta}
          </Text>
        ) : null}
        <View style={styles.marker} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <PlusMinus open={open} />
        </View>
      </Pressable>
      {open ? (
        <View style={styles.body}>
          <View style={styles.bodyRule} />
          {children}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginHorizontal: 16,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 58,
    paddingLeft: 10,
    paddingRight: 16,
    gap: 12,
  },
  headerPressed: {
    opacity: 0.8,
  },
  iconTile: {
    marginRight: 2,
  },
  title: {
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: 16,
    lineHeight: 20,
    color: colors.white,
  },
  meta: {
    fontFamily: fonts.monoMedium,
    fontSize: 13,
    color: colors.muted2,
  },
  marker: {
    width: 20,
    alignItems: 'center',
  },
  body: {
    paddingHorizontal: 14,
    paddingBottom: 6,
  },
  bodyRule: {
    height: 1,
    backgroundColor: colors.hairlineStrong,
  },
});
