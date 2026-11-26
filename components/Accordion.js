// One collapsible section: a full-width header row (optional glyph, display
// label, optional right-hand meta such as a count, chevron marker that turns
// lime when open; Figma G1) over its content. Sections are independent, so any
// number can be open at once. Starts closed.
//
// Controlled when `expanded` is passed (with `onToggle`), otherwise it keeps
// its own state. The header exposes its expanded/collapsed state to screen
// readers (plan: Accessibility).

import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import { colors, fonts } from '../lib/theme';

function Chevron({ open }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16">
      <Polyline
        points={open ? '3,10.5 8,5.5 13,10.5' : '3,5.5 8,10.5 13,5.5'}
        stroke={open ? colors.lime : colors.muted2}
        strokeWidth={1.8}
        fill="none"
      />
    </Svg>
  );
}

export default function Accordion({ title, icon, meta, expanded, onToggle, children, testID }) {
  const [ownOpen, setOwnOpen] = useState(false);
  const controlled = typeof expanded === 'boolean';
  const open = controlled ? expanded : ownOpen;

  const toggle = () => {
    if (!controlled) setOwnOpen((v) => !v);
    onToggle?.(!open);
  };

  return (
    <View style={styles.section} testID={testID}>
      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityLabel={meta != null && meta !== '' ? `${title}, ${meta}` : title}
        accessibilityState={{ expanded: open }}
        style={({ pressed }) => [styles.header, pressed && styles.headerPressed]}
      >
        {icon ? <View style={styles.icon} importantForAccessibility="no-hide-descendants">{icon}</View> : null}
        <Text style={styles.title} maxFontSizeMultiplier={1.3} numberOfLines={1}>
          {title}
        </Text>
        {meta != null && meta !== '' ? (
          <Text style={styles.meta} maxFontSizeMultiplier={1.3} importantForAccessibility="no" accessibilityElementsHidden>
            {meta}
          </Text>
        ) : null}
        <View style={styles.marker} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <Chevron open={open} />
        </View>
      </Pressable>
      {open ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingHorizontal: 16,
    gap: 12,
  },
  headerPressed: {
    backgroundColor: colors.ink2,
  },
  icon: {
    width: 20,
    alignItems: 'center',
  },
  title: {
    flex: 1,
    fontFamily: fonts.displayBold,
    fontSize: 22,
    color: colors.bone,
    lineHeight: 24,
    textTransform: 'uppercase',
  },
  meta: {
    fontFamily: fonts.mono,
    fontSize: 13,
    color: colors.muted2,
  },
  marker: {
    width: 20,
    alignItems: 'center',
  },
  body: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
});
