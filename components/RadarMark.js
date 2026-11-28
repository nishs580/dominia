// RadarMark — the splash radar (plan U3; Figma "Splash"). Concentric rings
// and a crosshair in SVG, a Dominia-blue sweep wedge that rotates on a loop,
// and the blue centre dot. Under Reduce Motion the sweep holds still.

import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Line, Path, RadialGradient, Stop } from 'react-native-svg';
import { colors } from '../lib/theme';

const SWEEP_MS = 3200;
const WEDGE_DEG = 62;

// Pie slice from 12 o'clock clockwise by `deg`, centred at (c, c).
function wedgePath(c, r, deg) {
  const a = ((deg - 90) * Math.PI) / 180;
  const x = c + r * Math.cos(a);
  const y = c + r * Math.sin(a);
  return `M${c} ${c} L${c} ${c - r} A${r} ${r} 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Z`;
}

export default function RadarMark({ size = 220 }) {
  const spin = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((v) => alive && setReduceMotion(!!v))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (v) => setReduceMotion(!!v));
    return () => {
      alive = false;
      sub?.remove?.();
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      spin.stopAnimation();
      spin.setValue(0);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: SWEEP_MS, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [reduceMotion, spin]);

  const c = size / 2;
  const r = c * 0.86;
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={{ width: size, height: size }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="radarCore" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={colors.action} stopOpacity="0.35" />
            <Stop offset="1" stopColor={colors.action} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx={c} cy={c} r={r * 0.5} fill="url(#radarCore)" />
        <Line x1={c} y1={0} x2={c} y2={size} stroke="rgba(253,253,253,0.22)" strokeWidth={1} />
        <Line x1={0} y1={c} x2={size} y2={c} stroke="rgba(253,253,253,0.22)" strokeWidth={1} />
        <Circle cx={c} cy={c} r={r} stroke={colors.white} strokeWidth={1.5} fill="none" />
        <Circle cx={c} cy={c} r={r * 0.78} stroke="rgba(253,253,253,0.22)" strokeWidth={1} fill="none" />
        <Circle cx={c} cy={c} r={r * 0.44} stroke={colors.white} strokeWidth={1.5} fill="none" />
        <Circle cx={c} cy={c} r={r * 0.2} stroke="rgba(253,253,253,0.22)" strokeWidth={1} fill="none" />
        <Circle cx={c - r * 0.3} cy={c + r * 0.43} r={2.5} fill={colors.white} />
      </Svg>
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ rotate }] }]}>
        <Svg width={size} height={size}>
          <Defs>
            <RadialGradient id="radarSweep" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={colors.action} stopOpacity="0.15" />
              <Stop offset="1" stopColor={colors.action} stopOpacity="0.85" />
            </RadialGradient>
          </Defs>
          <Path d={wedgePath(c, r, WEDGE_DEG)} fill="url(#radarSweep)" />
          <Line
            x1={c}
            y1={c}
            x2={c + r * Math.cos(((WEDGE_DEG - 90) * Math.PI) / 180)}
            y2={c + r * Math.sin(((WEDGE_DEG - 90) * Math.PI) / 180)}
            stroke={colors.action}
            strokeWidth={2}
          />
        </Svg>
      </Animated.View>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Circle cx={c} cy={c} r={6} fill={colors.white} />
        <Circle cx={c} cy={c} r={3.5} fill={colors.action} />
      </Svg>
    </View>
  );
}
