// components/ChallengeMap.js
// The live map under a claim, attack or defence (plan U13).
//
// One territory, the player and nothing else: the polygon's outline, a fill
// that rises with walk progress (lib/challengeFill.js), the player dot with
// its ring, and a recenter control that appears once the player pans away.
//
// `trace` (Dominia-Temp, plan 2026-11-28 U7; Challenge cases 1–5) swaps the
// rising fill for the board's language: a blue territory plate, the player's
// progress drawn along the perimeter in lime with a lime dot at its head, the
// opponent's progress (attack/defend, only when known) in red just inside
// it, and an always-on slanted recenter tile. The territory alone is framed;
// `onPannedChange` tells the screen when the player has moved the camera so
// the centred percentage can hide (case 5).
//
// Borrows MapScreen's board language (basemap config, ink scrim, owner plate
// opacity, puck seat/core) rather than mounting MapScreen, which is built for
// a whole city of parcels.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MapboxGL from '@rnmapbox/maps';
import * as Location from 'expo-location';
import Svg, { Circle, Line } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { BOARD_BASEMAP_CONFIG, BOARD_SCRIM_STYLE } from '../lib/mapBoard';
import { challengeFill, geometryBounds } from '../lib/challengeFill';
import { perimeterTrace } from '../lib/challengeScreen';
import { colors } from '../lib/theme';
import { SlantTile } from './ui';

MapboxGL.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '');

const INK = colors.ink;
const BONE = colors.bone;
const CLAIM = colors.claim;

const FIT_PADDING = 56;
const FIT_DURATION_MS = 280; // sanctioned UI-transition duration
const FALLBACK_ZOOM = 15;

// Same values as MapScreen's held-ground styles: Claim Red plate at 0.60, a
// full-strength owner border over an ink seam.
const OUTLINE_CASING_STYLE = { lineColor: INK, lineWidth: 5.6, lineOpacity: 0.55, lineEmissiveStrength: 1.0 };
const OUTLINE_STYLE = { lineColor: '#84FF44', lineWidth: 3.2, lineOpacity: 1, lineEmissiveStrength: 1.0 };
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
  circleColor: '#84FF44', // Signal Lime: the player dot
  circleOpacity: 1,
  circleStrokeColor: INK,
  circleStrokeWidth: 2.5,
  circleStrokeOpacity: 1,
  circlePitchAlignment: 'map',
  circleEmissiveStrength: 1.0,
};

// Trace mode (Dominia-Temp boards).
const TRACE_PLATE_STYLE = { fillColor: colors.action, fillOpacity: 0.32, fillEmissiveStrength: 1.0 };
const TRACE_EDGE_STYLE = { lineColor: BONE, lineWidth: 1, lineOpacity: 0.35, lineEmissiveStrength: 1.0 };
const TRACE_MINE_STYLE = {
  lineColor: colors.lime,
  lineWidth: 4,
  lineCap: 'round',
  lineJoin: 'miter',
  lineEmissiveStrength: 1.0,
};
const TRACE_HEAD_HALO_STYLE = {
  circleRadius: 12,
  circleColor: colors.lime,
  circleOpacity: 0.22,
  circlePitchAlignment: 'map',
  circleEmissiveStrength: 1.0,
};
const TRACE_HEAD_STYLE = {
  circleRadius: 6.5,
  circleColor: colors.lime,
  circleStrokeColor: INK,
  circleStrokeWidth: 1.5,
  circlePitchAlignment: 'map',
  circleEmissiveStrength: 1.0,
};
const TRACE_THEIRS_STYLE = {
  lineColor: colors.enemy,
  lineWidth: 3,
  lineCap: 'round',
  lineEmissiveStrength: 1.0,
};
const OPPONENT_INSET = 0.9; // fraction of the way from centre to perimeter
const TRACE_OPP_HEAD_STYLE = {
  circleRadius: 4.5,
  circleColor: colors.enemy,
  circleStrokeColor: INK,
  circleStrokeWidth: 1,
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

// Crosshair glyph for the recenter tile.
function RecenterGlyph({ size = 16, color = BONE }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16">
      <Circle cx="8" cy="8" r="4.5" stroke={color} strokeWidth="1.4" fill="none" />
      <Circle cx="8" cy="8" r="1.4" fill={color} />
      <Line x1="8" y1="0.5" x2="8" y2="3" stroke={color} strokeWidth="1.4" />
      <Line x1="8" y1="13" x2="8" y2="15.5" stroke={color} strokeWidth="1.4" />
      <Line x1="0.5" y1="8" x2="3" y2="8" stroke={color} strokeWidth="1.4" />
      <Line x1="13" y1="8" x2="15.5" y2="8" stroke={color} strokeWidth="1.4" />
    </Svg>
  );
}

/**
 * @param {object}  props
 * @param {object}  props.geometry   Territory Polygon/MultiPolygon (route's territoryGeojson).
 * @param {number}  props.progress   0..1 walk fraction; values outside clamp.
 * @param {number}  [props.bottomInset]  Space the overlaid chrome takes at the bottom.
 * @param {number}  [props.topInset]     Space the overlaid header takes at the top.
 * @param {boolean} [props.trace]        Dominia-Temp perimeter-trace drawing.
 * @param {number|null} [props.opponentProgress]  0..1 opponent fraction (trace only); null hides it.
 * @param {Function} [props.onPannedChange]  (panned: boolean) => void.
 */
export default function ChallengeMap({
  geometry,
  progress,
  topInset = 0,
  bottomInset = 0,
  trace = false,
  opponentProgress = null,
  onPannedChange,
}) {
  const { t } = useTranslation();
  const cameraRef = useRef(null);
  const [coord, setCoord] = useState(null);
  const [panned, setPanned] = useState(false);

  useEffect(() => {
    onPannedChange?.(panned);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panned]);

  // Foreground position for the player dot. ActiveClaim's background task owns
  // the walk's GPS; this watch is display-only and stops with the screen.
  // Trace mode draws progress on the perimeter instead, so it needs no watch.
  useEffect(() => {
    if (trace) return undefined;
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
  }, [trace]);

  // Geometry is recomputed only when the displayed percentage moves.
  const pctStep = Math.round(Math.max(0, Math.min(1, Number(progress) || 0)) * 100);
  const oppStep = opponentProgress == null
    ? null
    : Math.round(Math.max(0, Math.min(1, Number(opponentProgress) || 0)) * 100);
  const fillShape = useMemo(() => {
    if (trace) return null;
    const g = challengeFill(geometry, pctStep / 100);
    return g ? feature(g) : null;
  }, [geometry, pctStep, trace]);
  const outlineShape = useMemo(() => (geometry ? feature(geometry) : null), [geometry]);
  const playerShape = useMemo(
    () => (coord ? feature({ type: 'Point', coordinates: coord }) : null),
    [coord],
  );
  const mine = useMemo(
    () => (trace ? perimeterTrace(geometry, pctStep / 100) : null),
    [trace, geometry, pctStep],
  );
  // The opponent's line runs just inside the player's: the trace is pulled
  // a little toward the territory's centre so line and dot stay together.
  const theirs = useMemo(() => {
    if (!trace || oppStep == null || oppStep <= 0) return null;
    const tr = perimeterTrace(geometry, oppStep / 100);
    const b = geometryBounds(geometry);
    if (!tr.line || !b) return tr;
    const cx = (b[0][0] + b[1][0]) / 2;
    const cy = (b[0][1] + b[1][1]) / 2;
    const pull = ([x, y]) => [cx + (x - cx) * OPPONENT_INSET, cy + (y - cy) * OPPONENT_INSET];
    return {
      line: { type: 'LineString', coordinates: tr.line.coordinates.map(pull) },
      head: pull(tr.head),
    };
  }, [trace, geometry, oppStep]);

  const padding = useMemo(() => ({
    paddingTop: FIT_PADDING + topInset,
    paddingBottom: FIT_PADDING + bottomInset,
    paddingLeft: FIT_PADDING,
    paddingRight: FIT_PADDING,
  }), [topInset, bottomInset]);

  const framedCoord = trace ? null : coord;
  const frame = useCallback((animated) => {
    const b = frameBounds(geometry, framedCoord);
    if (!b || !cameraRef.current) return;
    cameraRef.current.setCamera({
      bounds: { ne: b.ne, sw: b.sw },
      padding,
      animationDuration: animated ? FIT_DURATION_MS : 0,
      animationMode: animated ? 'easeTo' : 'none',
    });
  }, [geometry, framedCoord, padding]);

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

        {outlineShape && trace ? (
          <MapboxGL.ShapeSource id="challenge-outline" shape={outlineShape}>
            <MapboxGL.FillLayer id="challenge-trace-plate" style={TRACE_PLATE_STYLE} />
            <MapboxGL.LineLayer id="challenge-trace-edge" style={TRACE_EDGE_STYLE} />
          </MapboxGL.ShapeSource>
        ) : null}

        {outlineShape && !trace ? (
          <MapboxGL.ShapeSource id="challenge-outline" shape={outlineShape}>
            <MapboxGL.LineLayer id="challenge-outline-casing" style={OUTLINE_CASING_STYLE} />
            <MapboxGL.LineLayer id="challenge-outline-line" style={OUTLINE_STYLE} />
          </MapboxGL.ShapeSource>
        ) : null}

        {theirs?.line ? (
          <MapboxGL.ShapeSource id="challenge-trace-theirs" shape={feature(theirs.line)}>
            <MapboxGL.LineLayer
              id="challenge-trace-theirs-line"
              style={TRACE_THEIRS_STYLE}
            />
          </MapboxGL.ShapeSource>
        ) : null}
        {theirs?.head && theirs.line ? (
          <MapboxGL.ShapeSource id="challenge-trace-theirs-head" shape={feature({ type: 'Point', coordinates: theirs.head })}>
            <MapboxGL.CircleLayer
              id="challenge-trace-theirs-dot"
              style={TRACE_OPP_HEAD_STYLE}
            />
          </MapboxGL.ShapeSource>
        ) : null}

        {mine?.line ? (
          <MapboxGL.ShapeSource id="challenge-trace-mine" shape={feature(mine.line)}>
            <MapboxGL.LineLayer id="challenge-trace-mine-line" style={TRACE_MINE_STYLE} />
          </MapboxGL.ShapeSource>
        ) : null}
        {mine?.head ? (
          <MapboxGL.ShapeSource id="challenge-trace-head" shape={feature({ type: 'Point', coordinates: mine.head })}>
            <MapboxGL.CircleLayer id="challenge-trace-head-halo" style={TRACE_HEAD_HALO_STYLE} />
            <MapboxGL.CircleLayer id="challenge-trace-head-dot" style={TRACE_HEAD_STYLE} />
          </MapboxGL.ShapeSource>
        ) : null}

        {playerShape && !trace ? (
          <MapboxGL.ShapeSource id="challenge-player" shape={playerShape}>
            <MapboxGL.CircleLayer id="challenge-player-seat" style={PUCK_SEAT_STYLE} />
            <MapboxGL.CircleLayer id="challenge-player-core" style={PUCK_CORE_STYLE} />
          </MapboxGL.ShapeSource>
        ) : null}
      </MapboxGL.MapView>

      {trace ? (
        <SlantTile
          size={36}
          square
          tone="solid"
          onPress={recenter}
          accessibilityLabel={t('activeClaim.recenter', { defaultValue: 'Recenter map' })}
          style={[styles.recenterTile, { top: topInset + 16 }]}
        >
          <RecenterGlyph />
        </SlantTile>
      ) : null}

      {!trace && panned ? (
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
    backgroundColor: '#84FF44',
    borderRadius: 0,
  },
  recenterText: {
    fontFamily: 'IBMPlexSans_600SemiBold',
    color: '#000000',
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  recenterTile: { position: 'absolute', right: 16 },
});
