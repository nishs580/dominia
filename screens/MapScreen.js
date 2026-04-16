import React, { useMemo, useRef } from 'react';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MapboxGL from '@rnmapbox/maps';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';

MapboxGL.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '');

const AMSTERDAM_CENTER = [4.9041, 52.3676];
const INITIAL_ZOOM = 14;

const ACCENT = '#1D9E75';
const ALLIANCE = '#534AB7';
const ENEMY = '#993C1D';
const UNCLAIMED = '#444441';

function TerritorySheet({ territory, onClose }) {
  const navigation = useNavigation();
  if (!territory) return null;

  const name = territory.properties?.name ?? 'Territory';
  const ownerRaw = territory.properties?.owner;
  const isUnclaimed = ownerRaw == null || ownerRaw === 'Unclaimed';
  const owner = !isUnclaimed ? ownerRaw : null;

  const tier = territory.properties?.tier ?? 'Medium';
  const level = territory.properties?.level ?? 'D0';
  const alliance = territory.properties?.alliance ?? (!isUnclaimed ? 'INW' : null);

  const perimeterDistanceRaw = territory.properties?.perimeterDistance ?? territory.properties?.perimeter ?? 0;
  const perimeterDistance =
    typeof perimeterDistanceRaw === 'number'
      ? perimeterDistanceRaw
      : Number(String(perimeterDistanceRaw).replace(/[^\d.]/g, '')) || 0;
  const perimeterDistanceLabel = `${Math.round(perimeterDistance)}m`;

  const selectedTerritory = {
    name,
    perimeter: perimeterDistance,
  };

  const isYours = owner === 'You';
  const isAlliance = owner === 'Iron Wolves';
  const isOwned = !isUnclaimed;

  const ownerTone = isUnclaimed ? UNCLAIMED : (territory.properties?.color ?? ENEMY);

  return (
    <View style={styles.sheet}>
      <View style={styles.sheetHandle} />
      <View style={styles.sheetTopRow}>
        <View style={{ flex: 1 }}>
          <View style={styles.sheetTitleRow}>
            <Text style={styles.sheetTitle}>{name}</Text>
            <View style={styles.sheetTierBadge}>
              <Text style={styles.sheetTierBadgeText}>{tier}</Text>
            </View>
          </View>

          <Text style={styles.sheetSubtitle}>
            Level <Text style={styles.sheetSubtitleStrong}>{level}</Text>
          </Text>

          <Text style={styles.sheetSubtitle}>
            Owner{' '}
            {isUnclaimed ? (
              <Text style={styles.sheetOwnerUnclaimed}>Unclaimed</Text>
            ) : (
              <>
                <Text style={[styles.sheetSubtitleStrong, { color: ownerTone }]}>{owner ?? 'defender_x'}</Text>
                <Text style={styles.sheetAllianceTag}>{` [${alliance ?? 'INW'}]`}</Text>
              </>
            )}
          </Text>

          <Text style={styles.sheetPerimeter}>
            {isOwned ? 'Walk to contest' : 'Walk to claim'}: {perimeterDistanceLabel}
          </Text>
        </View>
        <Pressable accessibilityRole="button" onPress={onClose} style={styles.sheetClose}>
          <Text style={styles.sheetCloseText}>×</Text>
        </Pressable>
      </View>

      {isUnclaimed && (
        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [styles.sheetAction, pressed && { opacity: 0.92 }]}
          onPress={() => {
            navigation.navigate('ActiveClaim', {
              territoryName: selectedTerritory.name,
              perimeterDistance: selectedTerritory.perimeter,
            });
          }}
        >
          <Text style={styles.sheetActionText}>Claim</Text>
        </Pressable>
      )}

      {isOwned && (
        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.sheetAction,
            { backgroundColor: '#E24B4A' },
            pressed && { opacity: 0.92 },
          ]}
          onPress={() => {
            navigation.navigate('ActiveClaim', {
              territoryName: selectedTerritory.name,
              perimeterDistance: selectedTerritory.perimeter,
            });
          }}
        >
          <Text style={styles.sheetActionText}>Contest</Text>
        </Pressable>
      )}
    </View>
  );
}

export default function MapScreen() {
  const navigation = useNavigation();
  const cameraRef = useRef(null);
  const [lastUserCoord, setLastUserCoord] = useState(null);
  const [selected, setSelected] = useState(null);
  const [territories, setTerritories] = useState({ type: 'FeatureCollection', features: [] });

  useEffect(() => {
    async function fetchTerritories() {
      const { data, error } = await supabase.from('territories').select('*');
      if (error) {
        console.error('Error fetching territories:', error);
        return;
      }
      const features = data.map((t) => ({
        type: 'Feature',
        id: t.id,
        properties: {
          name: t.territory_name,
          owner: t.owner_id ?? 'Unclaimed',
          tier: t.tier ?? 'Medium',
          level: `D${t.development_level ?? 0}`,
          perimeter: t.perimeter_distance,
          color: t.owner_id ? '#993C1D' : '#444441',
        },
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [t.longitude - 0.003, t.latitude + 0.002],
            [t.longitude + 0.003, t.latitude + 0.002],
            [t.longitude + 0.003, t.latitude - 0.002],
            [t.longitude - 0.003, t.latitude - 0.002],
            [t.longitude - 0.003, t.latitude + 0.002],
          ]],
        },
      }));
      setTerritories({ type: 'FeatureCollection', features });
    }
    fetchTerritories();
  }, []);

  const fillStyle = useMemo(
    () => ({
      fillColor: ['get', 'color'],
      fillOpacity: 0.22,
    }),
    [],
  );

  const lineStyle = useMemo(
    () => ({
      lineColor: ['get', 'color'],
      lineWidth: 2,
      lineOpacity: 0.95,
    }),
    [],
  );

  const labelStyle = useMemo(
    () => ({
      textField: ['get', 'name'],
      textSize: 12,
      textColor: '#0F172A',
      textHaloColor: '#FFFFFF',
      textHaloWidth: 1.25,
      textAllowOverlap: false,
      textAnchor: 'top',
    }),
    [],
  );

  const recenter = () => {
    if (!cameraRef.current) return;
    const centerCoordinate = lastUserCoord ?? AMSTERDAM_CENTER;
    cameraRef.current.setCamera({
      centerCoordinate,
      zoomLevel: INITIAL_ZOOM,
      animationDuration: 600,
    });
  };

  return (
    <View style={styles.screen}>
      <MapboxGL.MapView style={styles.map} styleURL={MapboxGL.StyleURL.Street}>
        <MapboxGL.Camera ref={cameraRef} zoomLevel={INITIAL_ZOOM} centerCoordinate={AMSTERDAM_CENTER} />

        <MapboxGL.UserLocation
          visible
          onUpdate={(loc) => {
            const c = loc?.coords;
            if (c?.longitude != null && c?.latitude != null) {
              setLastUserCoord([c.longitude, c.latitude]);
            }
          }}
        />

        <MapboxGL.ShapeSource
          id="territories"
          shape={territories}
          onPress={(e) => {
            const f = e?.features?.[0];
            if (f) setSelected(f);
          }}
        >
          <MapboxGL.FillLayer id="territories-fill" style={fillStyle} />
          <MapboxGL.LineLayer id="territories-line" style={lineStyle} />
          <MapboxGL.SymbolLayer id="territories-labels" style={labelStyle} />
        </MapboxGL.ShapeSource>
      </MapboxGL.MapView>

      <View style={styles.hudLeft}>
        <Text style={styles.hudValue}>6,240 steps</Text>
        <Text style={styles.hudLabel}>today</Text>
      </View>

      <View style={styles.hudRight}>
        <View style={styles.allianceBadge}>
          <Text style={styles.allianceBadgeText}>Iron Wolves</Text>
        </View>
      </View>

      <Pressable accessibilityRole="button" style={styles.locateButton} onPress={recenter}>
        <Text style={styles.locateIcon}>⌖</Text>
        <Text style={styles.locateText}>Locate me</Text>
      </Pressable>

      <TerritorySheet territory={selected} onClose={() => setSelected(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F6F8F7',
  },
  map: {
    flex: 1,
  },

  hudLeft: {
    position: 'absolute',
    top: 16,
    left: 16,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(229,231,235,0.9)',
  },
  hudValue: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.1,
  },
  hudLabel: {
    marginTop: 2,
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700',
  },

  hudRight: {
    position: 'absolute',
    top: 16,
    right: 16,
    alignItems: 'flex-end',
  },
  allianceBadge: {
    backgroundColor: 'rgba(83,74,183,0.12)',
    borderColor: 'rgba(83,74,183,0.28)',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  allianceBadgeText: {
    color: ALLIANCE,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: -0.1,
  },

  locateButton: {
    position: 'absolute',
    left: 16,
    bottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(229,231,235,0.95)',
  },
  locateIcon: {
    color: ACCENT,
    fontSize: 16,
    fontWeight: '900',
    marginTop: -1,
  },
  locateText: {
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: -0.1,
  },

  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderColor: '#E5E7EB',
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 46,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
    marginBottom: 10,
  },
  sheetTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  sheetTitle: {
    color: '#0F172A',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  sheetTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sheetTierBadge: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 1,
  },
  sheetTierBadgeText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: -0.1,
  },
  sheetSubtitle: {
    marginTop: 6,
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700',
  },
  sheetSubtitleStrong: {
    fontWeight: '900',
  },
  sheetOwnerUnclaimed: {
    color: '#64748B',
    fontWeight: '700',
  },
  sheetAllianceTag: {
    color: '#64748B',
    fontWeight: '700',
  },
  sheetPerimeter: {
    marginTop: 6,
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700',
  },
  sheetClose: {
    width: 34,
    height: 34,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetCloseText: {
    color: '#0F172A',
    fontSize: 22,
    fontWeight: '700',
    marginTop: -2,
  },
  sheetAction: {
    marginTop: 12,
    backgroundColor: ACCENT,
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetActionContest: {
    backgroundColor: '#EA580C',
  },
  sheetActionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: -0.1,
  },
});
