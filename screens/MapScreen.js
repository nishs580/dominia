import React, { useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MapboxGL from '@rnmapbox/maps';

MapboxGL.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '');

const AMSTERDAM_CENTER = [4.9041, 52.3676];
const INITIAL_ZOOM = 14;

const ACCENT = '#1D9E75';
const ALLIANCE = '#534AB7';
const ENEMY = '#993C1D';
const UNCLAIMED = '#444441';

const TERRITORIES = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      id: 'keizersgracht',
      properties: {
        name: 'Keizersgracht',
        owner: 'You',
        perimeter: '320m',
        color: ACCENT,
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [4.8885, 52.3728],
            [4.8933, 52.3728],
            [4.8933, 52.3695],
            [4.8885, 52.3695],
            [4.8885, 52.3728],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      id: 'prinsengracht',
      properties: {
        name: 'Prinsengracht',
        owner: 'Iron Wolves',
        perimeter: '480m',
        color: ALLIANCE,
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [4.8952, 52.3715],
            [4.9002, 52.3715],
            [4.9002, 52.3684],
            [4.8952, 52.3684],
            [4.8952, 52.3715],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      id: 'leidseplein',
      properties: {
        name: 'Leidseplein',
        owner: 'Erik V.',
        perimeter: '610m',
        color: ENEMY,
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [4.8808, 52.3658],
            [4.8862, 52.3658],
            [4.8862, 52.3629],
            [4.8808, 52.3629],
            [4.8808, 52.3658],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      id: 'vondelpark',
      properties: {
        name: 'Vondelpark',
        owner: 'Unclaimed',
        perimeter: '890m',
        color: UNCLAIMED,
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [4.8675, 52.3606],
            [4.8746, 52.3606],
            [4.8746, 52.3575],
            [4.8675, 52.3575],
            [4.8675, 52.3606],
          ],
        ],
      },
    },
  ],
};

function TerritorySheet({ territory, onClose }) {
  if (!territory) return null;

  const name = territory.properties?.name ?? 'Territory';
  const owner = territory.properties?.owner ?? 'Unknown';
  const perimeter = territory.properties?.perimeter ?? '-';

  const isYours = owner === 'You';
  const isAlliance = owner === 'Iron Wolves';
  const isUnclaimed = owner === 'Unclaimed';

  const ownerTone =
    owner === 'Iron Wolves'
      ? ALLIANCE
      : owner === 'You'
        ? ACCENT
        : owner === 'Unclaimed'
          ? UNCLAIMED
          : ENEMY;

  return (
    <View style={styles.sheet}>
      <View style={styles.sheetHandle} />
      <View style={styles.sheetTopRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sheetTitle}>{name}</Text>
          <Text style={styles.sheetSubtitle}>
            Owner <Text style={[styles.sheetSubtitleStrong, { color: ownerTone }]}>{owner}</Text>
          </Text>
          <Text style={styles.sheetPerimeter}>Perimeter: {perimeter}</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={onClose} style={styles.sheetClose}>
          <Text style={styles.sheetCloseText}>×</Text>
        </Pressable>
      </View>

      {isAlliance && (
        <Text style={styles.sheetAllianceNote}>Alliance territory — defended collectively</Text>
      )}

      {isYours && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Abandon territory"
          onPress={() => {}}
          style={({ pressed }) => [styles.sheetAbandon, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.sheetAbandonText}>Abandon territory</Text>
        </Pressable>
      )}

      {isUnclaimed && (
        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [styles.sheetAction, pressed && { opacity: 0.92 }]}
          onPress={() => {}}
        >
          <Text style={styles.sheetActionText}>{`Claim · ${perimeter}`}</Text>
        </Pressable>
      )}

      {!isAlliance && !isYours && !isUnclaimed && (
        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [styles.sheetAction, styles.sheetActionContest, pressed && { opacity: 0.92 }]}
          onPress={() => {}}
        >
          <Text style={styles.sheetActionText}>{`Contest · ${perimeter}`}</Text>
        </Pressable>
      )}
    </View>
  );
}

export default function MapScreen() {
  const cameraRef = useRef(null);
  const [lastUserCoord, setLastUserCoord] = useState(null);
  const [selected, setSelected] = useState(null);

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
          shape={TERRITORIES}
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
  sheetSubtitle: {
    marginTop: 6,
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700',
  },
  sheetSubtitleStrong: {
    fontWeight: '900',
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
  sheetAllianceNote: {
    marginTop: 12,
    color: ACCENT,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  sheetAbandon: {
    marginTop: 14,
    alignSelf: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  sheetAbandonText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
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
