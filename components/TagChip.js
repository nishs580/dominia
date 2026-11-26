// Component: TagChip — the small ownership/status chip on the Figma territory
// card and search rows (Updated UX C3–C5): ENEMY in vermillion, ALLIANCE in
// electric blue, YOURS in smash green, UNCLAIMED / SOLO / [TAG] neutral,
// FIRST CLAIM in signal lime. Tinted fill, mono caps, 0 radius.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../lib/theme';

const TONES = {
  enemy: { bg: colors.enemySoft, fg: colors.enemy },
  alliance: { bg: colors.allianceSoft, fg: '#7D95FF' },
  yours: { bg: colors.selfSoft, fg: colors.self },
  own: { bg: colors.selfSoft, fg: colors.self },
  firstClaim: { bg: colors.limeSoft, fg: colors.lime },
  neutral: { bg: colors.ink3, fg: colors.slate2 },
};

export function toneFor(kind) {
  return TONES[kind] ?? TONES.neutral;
}

export default function TagChip({ kind, children }) {
  const tone = toneFor(kind);
  return (
    <View style={[styles.chip, { backgroundColor: tone.bg }]}>
      <Text style={[styles.text, { color: tone.fg }]} numberOfLines={1} maxFontSizeMultiplier={1.2}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 0,
  },
  text: {
    fontFamily: fonts.monoMedium,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
});
