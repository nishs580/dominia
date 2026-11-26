// Component: RelocateSheet — Updated UX C9/C10 (plan U8), Figma mode only.
// Opened by the RELOCATE button on the map; lists the player's own
// territories nearest the home pin first ("HELD 6 DAYS · 2.1 KM AWAY",
// GO →). GO hands the row to onGo, which flies the camera there. With no
// territories it shows the empty state and FIND A TERRITORY NEARBY.
//
// Client-only: the list is the player's own rows from `territories`
// (owner_id = player), with the open territory_history row for the held
// time. If that read fails, the owned territories already on the map
// (fallbackFeatures) stand in. Logic lives in lib/relocate.js.
//
// Surface: ink scrim over the map, Ink 2 sheet with a hairline top edge,
// 0 radius; rows carry a smash-green flag thumb.

import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { relocateModel, withClaimedAt } from '../lib/relocate';
import { geojsonBboxCenter } from '../lib/territoryShape';
import { FlagIcon, PinIcon } from './MapIcons';
import { colors, fonts } from '../lib/theme';

// Owned features already on the map, in the relocate input shape.
function rowsFromFeatures(features) {
  return (Array.isArray(features) ? features : []).map((f) => {
    let longitude = null;
    let latitude = null;
    try {
      const c = geojsonBboxCenter(f.geometry);
      if (Array.isArray(c)) [longitude, latitude] = c;
    } catch (_) {
      /* ignore */
    }
    return {
      id: f.id ?? f.properties?.id,
      territory_name: f.properties?.name ?? '',
      latitude,
      longitude,
      geojson: f.geometry ?? null,
    };
  });
}

async function loadOwnTerritories(playerId) {
  const [owned, history] = await Promise.all([
    supabase
      .from('territories')
      .select('id, territory_name, latitude, longitude, geojson')
      .eq('owner_id', playerId),
    supabase
      .from('territory_history')
      .select('territory_id, claimed_at')
      .eq('owner_id', playerId)
      .is('lost_at', null),
  ]);
  if (owned.error) throw owned.error;
  return withClaimedAt(owned.data ?? [], history.error ? [] : history.data ?? []);
}

export default function RelocateSheet({
  visible,
  playerId,
  homePin,
  fallbackFeatures,
  onClose,
  onGo,
  onFindNearby,
}) {
  const { t } = useTranslation();
  const [territories, setTerritories] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return undefined;
    let cancelled = false;
    setLoading(true);
    (async () => {
      let rows;
      try {
        rows = playerId ? await loadOwnTerritories(playerId) : rowsFromFeatures(fallbackFeatures);
      } catch (_) {
        rows = rowsFromFeatures(fallbackFeatures);
      }
      if (!cancelled) {
        setTerritories(rows);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Load once per opening; fallbackFeatures changes on every map pan.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, playerId]);

  const model = useMemo(
    () => relocateModel({ territories: territories ?? [], homePin }),
    [territories, homePin],
  );

  if (!visible) return null;

  const showLoading = loading && territories == null;

  return (
    <Pressable style={styles.scrim} onPress={onClose} accessibilityViewIsModal accessible={false}>
      <Pressable style={styles.sheet} onPress={() => {}}>
        <View style={styles.header}>
          <Text style={styles.title} accessibilityRole="header" maxFontSizeMultiplier={1.3}>
            {t('map.relocate.title', { defaultValue: 'RELOCATE' })}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('map.relocate.closeA11y', { defaultValue: 'Close relocate' })}
            onPress={onClose}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.close}
          >
            <Text style={styles.closeText}>×</Text>
          </Pressable>
        </View>

        {showLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="small" color={colors.bone} />
          </View>
        ) : model.empty ? (
          <View style={styles.empty}>
            <PinIcon size={24} color={colors.slate2} />
            <Text style={styles.emptyBody} maxFontSizeMultiplier={1.3}>
              {t('map.relocate.emptyBody', {
                defaultValue: "You don't own any territories yet. Claim one and you can jump back to it from here.",
              })}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={onFindNearby}
              style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
            >
              <Text style={styles.ctaText}>
                {t('map.relocate.findNearby', { defaultValue: 'FIND A TERRITORY NEARBY' })}
              </Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Text style={styles.subtitle} maxFontSizeMultiplier={1.3}>
              {t('map.relocate.subtitle', { defaultValue: 'Jump the map to one of your territories.' })}
            </Text>
            <ScrollView style={styles.list} bounces={false}>
              {model.rows.map((row) => {
                const parts = [];
                if (row.heldDays != null) {
                  parts.push(t('map.relocate.held', { defaultValue: 'HELD {{count}} DAYS', count: row.heldDays }));
                }
                if (row.distanceKm != null) {
                  parts.push(t('map.relocate.away', { defaultValue: '{{km}} KM AWAY', km: row.distanceKm }));
                }
                return (
                  <Pressable
                    key={String(row.id)}
                    accessibilityRole="button"
                    accessibilityLabel={t('map.relocate.goA11y', { defaultValue: 'Go to {{name}}', name: row.name })}
                    onPress={() => onGo?.(row)}
                    style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                  >
                    <View style={styles.thumb}>
                      <FlagIcon size={16} color={colors.self} />
                    </View>
                    <View style={styles.rowText}>
                      <Text style={styles.rowName} numberOfLines={1} maxFontSizeMultiplier={1.3}>{row.name}</Text>
                      {parts.length > 0 ? (
                        <Text style={styles.rowMeta} numberOfLines={1} maxFontSizeMultiplier={1.3}>
                          {parts.join(' · ')}
                        </Text>
                      ) : null}
                    </View>
                    <Text style={styles.go}>{t('map.relocate.go', { defaultValue: 'GO →' })}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </>
        )}
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(16,16,16,0.6)',
    justifyContent: 'flex-end',
    zIndex: 50,
    elevation: 50,
  },
  sheet: {
    backgroundColor: colors.ink2,
    borderTopWidth: 1,
    borderTopColor: colors.hairlineStrong,
    borderRadius: 0,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
    gap: 12,
    maxHeight: '70%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 26,
    lineHeight: 28,
    color: colors.bone,
    textTransform: 'uppercase',
  },
  close: {
    width: 44,
    height: 44,
    marginVertical: -10,
    marginRight: -10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontFamily: fonts.mono,
    fontSize: 20,
    color: colors.bone,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.slate2,
  },
  loading: {
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    flexGrow: 0,
  },
  row: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  rowPressed: {
    backgroundColor: colors.ink3,
  },
  thumb: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.selfSoft,
    borderWidth: 1,
    borderColor: 'rgba(34,214,94,0.4)',
  },
  rowText: {
    flex: 1,
    gap: 4,
  },
  rowName: {
    fontFamily: fonts.displayBold,
    fontSize: 18,
    color: colors.bone,
    textTransform: 'uppercase',
  },
  rowMeta: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: colors.self,
  },
  go: {
    fontFamily: fonts.monoMedium,
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.slate2,
  },
  empty: {
    alignItems: 'center',
    gap: 16,
    paddingTop: 8,
  },
  emptyBody: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 21,
    color: colors.slate2,
    textAlign: 'center',
  },
  cta: {
    alignSelf: 'stretch',
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: colors.claimButton,
    borderRadius: 0,
  },
  pressed: {
    opacity: 0.92,
  },
  ctaText: {
    fontFamily: fonts.monoMedium,
    fontSize: 13,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.bone,
  },
});
