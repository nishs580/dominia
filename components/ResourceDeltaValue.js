// Component: ResourceDeltaValue — a map-banner resource value that ticks to
// its new amount (280ms count-up) and floats a +N/−N chip above itself,
// fading linear over 2000ms (sanctioned ambient duration, linear per brand).
// A null value means "player not loaded yet": the first real value sets the
// baseline silently — no chip on initial load.

import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import CountUpText from './CountUpText';

const BONE = '#F2EEE6';

export default function ResourceDeltaValue({ value, style }) {
  const settled = value != null;
  const num = Math.round(Number(value) || 0);
  const prevRef = useRef(null);
  const [delta, setDelta] = useState(null);
  const chipOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!settled) return;
    const prev = prevRef.current;
    prevRef.current = num;
    if (prev == null || prev === num) return;
    setDelta(num - prev);
    chipOpacity.stopAnimation();
    chipOpacity.setValue(1);
    Animated.timing(chipOpacity, {
      toValue: 0,
      duration: 2000,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setDelta(null);
    });
  }, [settled, num, chipOpacity]);

  if (!settled) {
    return <Text style={style}>0</Text>;
  }

  return (
    <View style={styles.wrap}>
      {delta != null ? (
        <Animated.Text style={[styles.chip, { opacity: chipOpacity }]}>
          {delta > 0 ? `+${delta.toLocaleString()}` : `−${Math.abs(delta).toLocaleString()}`}
        </Animated.Text>
      ) : null}
      <CountUpText value={num} style={style} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
  },
  chip: {
    position: 'absolute',
    top: -12,
    alignSelf: 'center',
    fontFamily: 'GeistMono_500Medium',
    fontSize: 8,
    lineHeight: 10,
    letterSpacing: 0.5,
    color: BONE,
  },
});
