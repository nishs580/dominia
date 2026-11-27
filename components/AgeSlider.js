// AgeSlider — Dominia-Temp "SELECT YOUR AGE" slider (plan U4). A thin dark
// track, Dominia-blue fill left of a slanted white thumb, and tick labels at
// 1 / 25 / 50 / 75 / 100. There is no thumb until the first touch; tapping
// the track jumps there and dragging adjusts. Screen readers get an
// adjustable control with increment / decrement. Maths in lib/ageSlider.

import React, { useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';
import { AGE_SLIDER_MAX, AGE_SLIDER_MIN } from '../lib/onboardingFlow';
import { AGE_TICKS, ageFromOffset, ratioForAge, stepAge } from '../lib/ageSlider';
import { colors, fonts } from '../lib/theme';

const HIT_HEIGHT = 44;
const TRACK_HEIGHT = 4;
const THUMB_W = 12;
const THUMB_H = 24;
const THUMB_SLANT = 4;

function Thumb() {
  return (
    <Svg width={THUMB_W} height={THUMB_H}>
      <Polygon
        points={`${THUMB_SLANT},0 ${THUMB_W},0 ${THUMB_W - THUMB_SLANT},${THUMB_H} 0,${THUMB_H}`}
        fill={colors.white}
      />
    </Svg>
  );
}

export default function AgeSlider({ value, onChange, label }) {
  const [width, setWidth] = useState(0);
  const widthRef = useRef(0);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const responder = useMemo(() => {
    const emit = (e) => {
      const v = ageFromOffset(e.nativeEvent.locationX, widthRef.current);
      if (v != null) onChangeRef.current?.(v);
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: emit,
      onPanResponderMove: emit,
    });
  }, []);

  const hasValue = value != null;
  const x = hasValue ? ratioForAge(value) * width : 0;
  const thumbLeft = Math.min(Math.max(0, x - THUMB_W / 2), Math.max(0, width - THUMB_W));

  return (
    <View>
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={
          hasValue ? { min: AGE_SLIDER_MIN, max: AGE_SLIDER_MAX, now: value } : { min: AGE_SLIDER_MIN, max: AGE_SLIDER_MAX }
        }
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === 'increment') onChange?.(stepAge(value, 1));
          if (e.nativeEvent.actionName === 'decrement') onChange?.(stepAge(value, -1));
        }}
        onLayout={(e) => {
          widthRef.current = e.nativeEvent.layout.width;
          setWidth(e.nativeEvent.layout.width);
        }}
        style={styles.hit}
        {...responder.panHandlers}
      >
        <View style={styles.track} pointerEvents="none">
          {hasValue ? <View style={[styles.fill, { width: x }]} /> : null}
        </View>
        {hasValue ? (
          <View style={[styles.thumb, { left: thumbLeft }]} pointerEvents="none">
            <Thumb />
          </View>
        ) : null}
      </View>
      <View style={styles.ticks} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {AGE_TICKS.map((tick) => (
          <Text key={tick} style={styles.tick} maxFontSizeMultiplier={1.2}>
            {tick}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hit: { height: HIT_HEIGHT, justifyContent: 'center' },
  track: { height: TRACK_HEIGHT, backgroundColor: colors.raised, overflow: 'hidden' },
  fill: { height: TRACK_HEIGHT, backgroundColor: colors.action },
  thumb: { position: 'absolute', top: (HIT_HEIGHT - THUMB_H) / 2 },
  ticks: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  tick: { fontFamily: fonts.mono, fontSize: 11, color: colors.muted2 },
});
