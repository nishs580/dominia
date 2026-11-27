// Component: MapTopBar — map chrome header, mounted only with `legacy_tabs`
// off. Dominia-Temp (plan U5, Figma Main screen): a slanted initials tile on
// the left (opens Profile), two slanted glass pills on the right — gold
// (coin + balance) and level (bolt + /me level) — and the full-width
// territory search below.
//
// While the search is in use the map behind it dims (tap the dimmed map to
// close the search).
//
// The balance is MapScreen's myPlayer.gold, so it follows every spend or
// reward response that updates the player. null = still loading: the pill
// shows a placeholder dash rather than a misleading 0. The level pill is
// hidden while /me is loading or reports no numeric level (lib/mapTopBar).

import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import ProfileAvatarButton from './ProfileAvatarButton';
import ResourceDeltaValue from './ResourceDeltaValue';
import TerritorySearch from './TerritorySearch';
import { BoltIcon, CoinIcon } from './MapIcons';
import { SlantTile } from './ui';
import { formatGold, levelValue } from '../lib/mapTopBar';
import { colors, fonts } from '../lib/theme';

const PILL_HEIGHT = 36;

export default function MapTopBar({ gold, level, playerName, onSelectSearchResult, onSearchActiveChange }) {
  const { t } = useTranslation();
  const [searchActive, setSearchActive] = useState(false);
  const [dismissKey, setDismissKey] = useState(0);
  const onActiveChange = useCallback((active) => {
    setSearchActive(active);
    onSearchActiveChange?.(active);
  }, [onSearchActiveChange]);
  const loaded = gold != null;
  const balanceA11y = loaded
    ? t('map.topBar.goldA11y', { defaultValue: 'Gold balance: {{n}}', n: formatGold(gold) ?? '0' })
    : t('map.topBar.goldLoadingA11y', { defaultValue: 'Gold balance loading' });
  const lv = levelValue(level);

  return (
    <View pointerEvents="box-none" style={[styles.wrap, searchActive && styles.wrapActive]}>
      {searchActive ? (
        <Pressable
          style={styles.scrim}
          onPress={() => setDismissKey((k) => k + 1)}
          accessibilityRole="button"
          accessibilityLabel={t('map.search.clearA11y', { defaultValue: 'Clear search' })}
        />
      ) : null}
      <View pointerEvents="box-none" style={styles.row}>
        <ProfileAvatarButton variant="slant" name={playerName} />
        <View pointerEvents="box-none" style={styles.pills}>
          <SlantTile size={PILL_HEIGHT} tone="glass" accessibilityLabel={balanceA11y}>
            <View style={styles.pillInner}>
              <CoinIcon size={14} color={colors.white} />
              {loaded ? (
                <ResourceDeltaValue value={gold} style={styles.pillValue} />
              ) : (
                <Text style={styles.pillValue}>—</Text>
              )}
            </View>
          </SlantTile>
          {lv != null ? (
            <SlantTile
              size={PILL_HEIGHT}
              tone="glass"
              accessibilityLabel={t('map.topBar.levelA11y', { defaultValue: 'Level {{n}}', n: lv })}
            >
              <View style={styles.pillInner}>
                <BoltIcon size={14} color={colors.white} />
                <Text style={styles.pillValue} maxFontSizeMultiplier={1.2}>{lv}</Text>
              </View>
            </SlantTile>
          ) : null}
        </View>
      </View>
      <TerritorySearch
        onSelect={onSelectSearchResult}
        onActiveChange={onActiveChange}
        dismissKey={dismissKey}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 12,
    left: 16,
    right: 16,
    gap: 12,
    zIndex: 20,
  },
  // While searching the wrap reaches the bottom of the map so the scrim can
  // cover it.
  wrapActive: {
    bottom: 0,
  },
  scrim: {
    position: 'absolute',
    top: -12,
    left: -16,
    right: -16,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pills: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pillInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pillValue: {
    fontFamily: fonts.mono,
    fontSize: 14,
    color: colors.white,
  },
});
