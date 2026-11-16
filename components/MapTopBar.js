// Component: MapTopBar — Figma map chrome (parity plan U11), mounted only
// with `legacy_tabs` off. Profile avatar on the left, the Gold Economy Panel
// on the right, the territory search bar full-width below.
// Surface: translucent ink panels matching the side rail, square corners,
// hairline borders. Typography: Geist Mono data for the balance.
//
// The balance is MapScreen's myPlayer.gold, so it follows every spend or
// reward response that updates the player. null = still loading: the panel
// shows a placeholder dash rather than a misleading 0.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import ProfileAvatarButton from './ProfileAvatarButton';
import ResourceDeltaValue from './ResourceDeltaValue';
import TerritorySearch from './TerritorySearch';
import { GoldGlyph } from './ResourceGlyphs';
import { colors, fonts } from '../lib/theme';

export default function MapTopBar({ gold, onSelectSearchResult }) {
  const { t } = useTranslation();
  const loaded = gold != null;
  const balanceA11y = loaded
    ? t('map.topBar.goldA11y', { defaultValue: 'Gold balance: {{n}}', n: Math.round(Number(gold) || 0) })
    : t('map.topBar.goldLoadingA11y', { defaultValue: 'Gold balance loading' });

  return (
    <View pointerEvents="box-none" style={styles.wrap}>
      <View pointerEvents="box-none" style={styles.row}>
        <ProfileAvatarButton />
        <View
          accessible
          accessibilityRole="text"
          accessibilityLabel={balanceA11y}
          style={styles.economyPanel}
        >
          <GoldGlyph size={14} color={colors.bone} />
          {loaded ? (
            <ResourceDeltaValue value={gold} style={styles.economyValue} />
          ) : (
            <Text style={styles.economyValue}>—</Text>
          )}
        </View>
      </View>
      <TerritorySearch onSelect={onSelectSearchResult} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    gap: 8,
    zIndex: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  economyPanel: {
    minHeight: 36,
    minWidth: 88,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(14,16,20,0.86)',
    borderWidth: 0.5,
    borderColor: colors.hairlineStrong,
    borderRadius: 0,
  },
  economyValue: {
    fontFamily: fonts.mono,
    fontSize: 13,
    color: colors.bone,
  },
});
