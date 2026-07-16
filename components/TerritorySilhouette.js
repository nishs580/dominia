// Component: TerritorySilhouette — the real shape of a territory as the mark
// on reward screens, replacing the generic square when geometry is available.
// variant "fill": hairline outline with the fill fading in over 280ms (won /
// claimed). variant "outline": stroke only, no fill (lost / held against you).
// Renders null when the geometry cannot be silhouetted — callers keep their
// legacy square mark as the fallback.

import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { territorySvgPath } from '../lib/territoryShape';

const VIEWBOX = 100;

export default function TerritorySilhouette({
  geojson,
  size = 96,
  color,
  variant = 'fill',
  animate = true,
}) {
  const path = useMemo(() => territorySvgPath(geojson, VIEWBOX, 4), [geojson]);
  const fillOpacity = useRef(new Animated.Value(animate ? 0 : 1)).current;

  useEffect(() => {
    if (!animate || variant !== 'fill' || !path) return;
    Animated.timing(fillOpacity, {
      toValue: 1,
      duration: 280,
      easing: Easing.bezier(0.2, 0, 0, 1),
      useNativeDriver: true,
    }).start();
  }, [animate, variant, path, fillOpacity]);

  if (!path) return null;

  if (variant === 'outline') {
    return (
      <Svg width={size} height={size} viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}>
        <Path d={path} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="miter" />
      </Svg>
    );
  }

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`} style={{ position: 'absolute' }}>
        <Path d={path} fill="none" stroke={color} strokeWidth={1} strokeLinejoin="miter" />
      </Svg>
      <Animated.View style={{ opacity: fillOpacity }}>
        <Svg width={size} height={size} viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}>
          <Path d={path} fill={color} />
        </Svg>
      </Animated.View>
    </View>
  );
}
