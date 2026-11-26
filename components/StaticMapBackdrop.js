// A still, non-interactive board map used as a backdrop behind the Figma
// onboarding frames (Updated UX A2 landing, A7 city intro). Same basemap and
// board scrim as ChallengeMap, every gesture off, hidden from accessibility.
// Callers lay their own gradient scrims on top.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import MapboxGL from '@rnmapbox/maps';
import { useTranslation } from 'react-i18next';
import { BOARD_BASEMAP_CONFIG, BOARD_SCRIM_STYLE } from '../lib/mapBoard';
import { fallbackCentreForLocale } from '../lib/onboardingFlow';
import { colors } from '../lib/theme';

MapboxGL.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '');

/**
 * @param {object} props
 * @param {{lat:number, lng:number}|null} [props.centre] defaults to the locale's city centre
 * @param {number} [props.zoom]
 */
export default function StaticMapBackdrop({ centre = null, zoom = 13 }) {
  const { i18n } = useTranslation();
  const c = centre && Number.isFinite(centre.lat) && Number.isFinite(centre.lng)
    ? centre
    : fallbackCentreForLocale(i18n.language);
  return (
    <View style={styles.fill} pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <MapboxGL.MapView
        style={StyleSheet.absoluteFill}
        styleURL="mapbox://styles/mapbox/standard"
        scrollEnabled={false}
        zoomEnabled={false}
        pitchEnabled={false}
        rotateEnabled={false}
        logoEnabled={false}
        attributionEnabled={false}
        scaleBarEnabled={false}
        compassEnabled={false}
      >
        <MapboxGL.StyleImport id="basemap" existing config={BOARD_BASEMAP_CONFIG} />
        <MapboxGL.Camera
          defaultSettings={{ centerCoordinate: [c.lng, c.lat], zoomLevel: zoom }}
          animationMode="none"
          animationDuration={0}
        />
        <MapboxGL.BackgroundLayer id="backdrop-scrim" style={BOARD_SCRIM_STYLE} />
      </MapboxGL.MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.ink },
});
