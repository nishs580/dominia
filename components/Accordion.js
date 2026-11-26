// One collapsible section: a full-width header row (optional glyph, mono
// label, + / − marker) over its content. Sections are independent, so any
// number can be open at once. Starts closed.
//
// Controlled when `expanded` is passed (with `onToggle`), otherwise it keeps
// its own state. The header exposes its expanded/collapsed state to screen
// readers (plan: Accessibility).

import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../lib/theme';

export default function Accordion({ title, icon, expanded, onToggle, children, testID }) {
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
        accessibilityLabel={title}
        accessibilityState={{ expanded: open }}
        style={({ pressed }) => [styles.header, pressed && styles.headerPressed]}
      >
        {icon ? <View style={styles.icon} importantForAccessibility="no-hide-descendants">{icon}</View> : null}
        <Text style={styles.title} maxFontSizeMultiplier={1.3} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.marker} importantForAccessibility="no" accessibilityElementsHidden>
          {open ? '−' : '+'}
        </Text>
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
  marker: {
    fontFamily: fonts.mono,
    fontSize: 20,
    color: colors.slate2,
    width: 20,
    textAlign: 'center',
  },
  body: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
});
