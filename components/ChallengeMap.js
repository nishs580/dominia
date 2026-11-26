// components/ChallengeMap.js
// The live map under a claim, attack or defence (plan U13).
//
// One territory, the player and nothing else: the polygon's outline, a fill
// that rises with walk progress (lib/challengeFill.js), the player dot with
// its ring, and a recenter control that appears once the player pans away.
//
// Borrows MapScreen's board language (basemap config, ink scrim, owner plate
// opacity, puck seat/core) rather than mounting MapScreen, which is built for
// a whole city of parcels.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MapboxGL from '@rnmapbox/maps';
import * as Location from 'expo-location';
import { useTranslation } from 'react-i18next';
import { BOARD_BASEMAP_CONFIG, BOARD_SCRIM_STYLE } from '../lib/mapBoard';
import { challengeFill, geometryBounds } from '../lib/challengeFill';
import { colors } from '../lib/theme';

MapboxGL.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '');

const INK = colors.ink;
const INK2 = colors.ink2;
const BONE = colors.bone;
const CLAIM = colors.claim;
const HAIRLINE_STRONG = colors.hairlineStrong;

const FIT_PADDING = 56;
const FIT_DURATION_MS = 280; // sanctioned UI-transition duration
const FALLBACK_ZOOM = 15;

// Same values as MapScreen's held-ground styles: Claim Red plate at 0.60, a
// full-strength owner border over an ink seam.
const OUTLINE_CASING_STYLE = { lineColor: INK, lineWidth: 5.6, lineOpacity: 0.55, lineEmissiveStrength: 1.0 };
const OUTLINE_STYLE = { lineColor: '#C8FF3D', lineWidth: 3.2, lineOpacity: 1, lineEmissiveStrength: 1.0 };
const FILL_STYLE = { fillColor: CLAIM, fillOpacity: 0.6, fillEmissiveStrength: 1.0 };
const PUCK_SEAT_STYLE = {
  circleRadius: 15,
  circleColor: INK,
  circleOpacity: 0.88,
  circleStrokeColor: BONE,
  circleStrokeWidth: 1,
  circleStrokeOpacity: 0.4,
  circlePitchAlignment: 'map',
  circleEmissiveStrength: 1.0,
};
const PUCK_CORE_STYLE = {
  circleRadius: 7,
  circleColor: '#C8FF3D', // Signal Lime: the player dot
  circleOpacity: 1,
  circleStrokeColor: INK,
  circleStrokeWidth: 2.5,
  circleStrokeOpacity: 1,
  circlePitchAlignment: 'map',
  circleEmissiveStrength: 1.0,
};

function feature(geometry) {
  return { type: 'Feature', properties: {}, geometry };
}

// [ne, sw] covering the territory and, when known, the player.
function frameBounds(geometry, coord) {
  const b = geometryBounds(geometry);
  if (!b && !coord) return null;
  let [[minLng, minLat], [maxLng, maxLat]] = b ?? [[coord[0], coord[1]], [coord[0], coord[1]]];
  if (coord) {
    minLng = Math.min(minLng, coord[0]); maxLng = Math.max(maxLng, coord[0]);
    minLat = Math.min(minLat, coord[1]); maxLat = Math.max(maxLat, coord[1]);
  }
  return { ne: [maxLng, maxLat], sw: [minLng, minLat] };
}

/**
 * @param {object}  props
 * @param {object}  props.geometry   Territory Polygon/MultiPolygon (route's territoryGeojson).
 * @param {number}  props.progress   0..1 walk fraction; values outside clamp.
 * @param {number}  [props.bottomInset]  Space the overlaid chrome takes at the bottom.
 * @param {number}  [props.topInset]     Space the overlaid header takes at the top.
 */
export default function ChallengeMap({ geometry, progress, topInset = 0, bottomInset = 0 }) {
  const { t } = useTranslation();
  const cameraRef = useRef(null);
  const [coord, setCoord] = useState(null);
  const [panned, setPanned] = useState(false);

  // Foreground position for the player dot. ActiveClaim's background task owns
  // the walk's GPS; this watch is display-only and stops with the screen.
  useEffect(() => {
    let sub = null;
    let cancelled = false;
    (async () => {
      try {
        const perm = await Location.getForegroundPermissionsAsync();
        if (perm.status !== 'granted' || cancelled) return;
        sub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, timeInterval: 2000, distanceInterval: 2 },
          (loc) => {
            const { longitude, latitude } = loc?.coords ?? {};
            if (Number.isFinite(longitude) && Number.isFinite(latitude)) setCoord([longitude, latitude]);
          },
        );
        if (cancelled) sub.remove();
      } catch (err) {
        console.warn('[challengeMap] position watch failed:', err?.message);
      }
    })();
    return () => {
      cancelled = true;
      if (sub) sub.remove();
    };
  }, []);

  // Fill geometry is recomputed only when the displayed percentage moves.
  const pctStep = Math.round(Math.max(0, Math.min(1, Number(progress) || 0)) * 100);
  const fillShape = useMemo(() => {
    const g = challengeFill(geometry, pctStep / 100);
    return g ? feature(g) : null;
  }, [geometry, pctStep]);
  const outlineShape = useMemo(() => (geometry ? feature(geometry) : null), [geometry]);
  const playerShape = useMemo(
    () => (coord ? feature({ type: 'Point', coordinates: coord }) : null),
    [coord],
  );

  const padding = useMemo(() => ({
    paddingTop: FIT_PADDING + topInset,
    paddingBottom: FIT_PADDING + bottomInset,
    paddingLeft: FIT_PADDING,
    paddingRight: FIT_PADDING,
  }), [topInset, bottomInset]);

  const frame = useCallback((animated) => {
    const b = frameBounds(geometry, coord);
    if (!b || !cameraRef.current) return;
    cameraRef.current.setCamera({
      bounds: { ne: b.ne, sw: b.sw },
      padding,
      animationDuration: animated ? FIT_DURATION_MS : 0,
      animationMode: animated ? 'easeTo' : 'none',
    });
  }, [geometry, coord, padding]);

  // Keep the territory and the player in frame until the player takes the
  // camera; after a pan, only the recenter control brings it back.
  const firstFrameRef = useRef(true);
  useEffect(() => {
    if (panned) return;
    frame(!firstFrameRef.current);
    firstFrameRef.current = false;
  }, [frame, panned]);

  const onCameraChanged = useCallback((state) => {
    if (state?.gestures?.isGestureActive === true) setPanned(true);
  }, []);

  const recenter = () => {
    setPanned(false);
    frame(true);
  };

  const initialBounds = frameBounds(geometry, null);

  return (
    <View style={StyleSheet.absoluteFill}>
      <MapboxGL.MapView
        style={StyleSheet.absoluteFill}
        styleURL="mapbox://styles/mapbox/standard"
        onCameraChanged={onCameraChanged}
        scaleBarEnabled={false}
        pitchEnabled={false}
        rotateEnabled={false}
      >
        <MapboxGL.StyleImport id="basemap" existing config={BOARD_BASEMAP_CONFIG} />
        <MapboxGL.Camera
          ref={cameraRef}
          defaultSettings={initialBounds
            ? { bounds: { ne: initialBounds.ne, sw: initialBounds.sw }, padding }
            : { zoomLevel: FALLBACK_ZOOM }}
          animationMode="none"
          animationDuration={0}
        />
        <MapboxGL.BackgroundLayer id="challenge-scrim" style={BOARD_SCRIM_STYLE} />

        {fillShape ? (
          <MapboxGL.ShapeSource id="challenge-fill" shape={fillShape}>
            <MapboxGL.FillLayer id="challenge-fill-plate" style={FILL_STYLE} />
          </MapboxGL.ShapeSource>
        ) : null}

        {outlineShape ? (
          <MapboxGL.ShapeSource id="challenge-outline" shape={outlineShape}>
            <MapboxGL.LineLayer id="challenge-outline-casing" style={OUTLINE_CASING_STYLE} />
            <MapboxGL.LineLayer id="challenge-outline-line" style={OUTLINE_STYLE} />
          </MapboxGL.ShapeSource>
        ) : null}

        {playerShape ? (
          <MapboxGL.ShapeSource id="challenge-player" shape={playerShape}>
            <MapboxGL.CircleLayer id="challenge-player-seat" style={PUCK_SEAT_STYLE} />
            <MapboxGL.CircleLayer id="challenge-player-core" style={PUCK_CORE_STYLE} />
          </MapboxGL.ShapeSource>
        ) : null}
      </MapboxGL.MapView>

      {panned ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('activeClaim.recenter', { defaultValue: 'Recenter map' })}
          onPress={recenter}
          hitSlop={8}
          style={({ pressed }) => [
            styles.recenter,
            { top: topInset + 12 },
            pressed && { opacity: 0.85 },
          ]}
        >
          <Text style={styles.recenterText}>
            {t('activeClaim.recenterShort', { defaultValue: 'Recenter' })}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // A labelled instrument, not an icon (DESIGN.md: no icons).
  recenter: {
    position: 'absolute',
    right: 16,
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
    // Signal Lime: the recenter control is one of the sanctioned lime accents.
    backgroundColor: '#C8FF3D',
    borderRadius: 0,
  },
  recenterText: {
    fontFamily: 'GeistMono_500Medium',
    color: '#101010',
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
});
