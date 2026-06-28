import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  TIER_ORDER,
  TIER_COLOR,
  tierRank,
  singularBarLabel,
} from '../../lib/legacyMedals';

const BONE = '#F2EEE6';
// Higher tiers read wider — bar width grows per slot (bronze -> claim).
const BAR_WIDTHS = [7, 10, 13, 16];

/**
 * The tier ribbon. Tiered medals show accumulating colour bars (one per earned
 * tier, widening left-to-right); locked tiers show faint slots. Singular medals
 * show the Bone bar with their count (x N) or year stamp.
 */
export default function TierBars({ medal, height = 6 }) {
  if (medal.type === 'tiered') {
    const filled = tierRank(medal.currentTier) + 1; // 0 when unearned
    return (
      <View style={styles.row}>
        {TIER_ORDER.map((tier, i) => {
          const on = i < filled;
          return (
            <View
              key={tier}
              style={{
                width: BAR_WIDTHS[i],
                height,
                marginRight: 3,
                borderRadius: 1,
                backgroundColor: on ? TIER_COLOR[tier] : 'transparent',
                borderWidth: on ? 0 : StyleSheet.hairlineWidth,
                borderColor: 'rgba(242,238,230,0.18)',
              }}
            />
          );
        })}
      </View>
    );
  }

  // Singular: Bone bar with x N or year.
  return (
    <View style={styles.boneBar}>
      <Text style={styles.boneText}>{singularBarLabel(medal)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  boneBar: {
    alignSelf: 'flex-start',
    backgroundColor: BONE,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 2,
  },
  boneText: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 9,
    letterSpacing: 0.5,
    color: '#0E1014',
  },
});
