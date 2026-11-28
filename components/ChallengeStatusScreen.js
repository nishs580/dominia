// components/ChallengeStatusScreen.js
// Full-screen status of the Dominia-Temp challenge flow (plan 2026-11-28 U7;
// boards "Securing the claim", "Cancelling the claim"): a black-to-deep-blue
// screen, the big blue territory square, the territory name in the display
// face and one quiet line — "Securing the Claim…" / "Cancelling the Claim…".
// Optional children (error actions) sit at the bottom.

import React, { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { colors, fonts } from '../lib/theme';
import ChallengeTerritoryTile from './ChallengeTerritoryTile';
import { useSvgId } from './ui/shared';

/**
 * @param {object} props
 * @param {string} props.name          territory name (display face).
 * @param {string} [props.caption]     "Securing the Claim…".
 * @param {string} [props.alert]       red line for a failure (e.g. CLAIM NOT SECURED).
 * @param {boolean} [props.pulse]      breathe the square while work is pending.
 * @param {React.ReactNode} [props.children]
 * @param {number} [props.bottomInset]
 */
export default function ChallengeStatusScreen({ name, caption, alert, pulse = true, children, bottomInset = 0 }) {
  const scale = useRef(new Animated.Value(1)).current;
  const { width } = useWindowDimensions();
  const bgId = useSvgId('chstatus');
  const tileSize = Math.min(260, Math.round(width * 0.62));

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility?.([alert, name, caption].filter(Boolean).join('. '));
  }, [alert, name, caption]);

  useEffect(() => {
    if (!pulse) return undefined;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.04, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, scale]);

  return (
    <View style={styles.screen} accessibilityViewIsModal>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id={bgId} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#000000" />
              <Stop offset="0.45" stopColor="#020A2E" />
              <Stop offset="1" stopColor={colors.actionDeep} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${bgId})`} />
        </Svg>
      </View>
      <View style={styles.center} accessibilityLiveRegion="polite">
        <Animated.View style={{ transform: [{ scale }] }}>
          <ChallengeTerritoryTile size={tileSize} variant="blue" />
        </Animated.View>
        {alert ? <Text style={styles.alert}>{alert}</Text> : null}
        {name ? (
          <Text style={[styles.name, alert ? { marginTop: 4 } : null]} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.6} accessibilityRole="header">
            {name}
          </Text>
        ) : null}
        {caption ? <Text style={styles.caption}>{caption}</Text> : null}
      </View>
      {children ? <View style={[styles.actions, { bottom: bottomInset + 24 }]}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.obsidian,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  center: { alignItems: 'center', gap: 10 },
  alert: {
    fontFamily: fonts.mono,
    color: colors.danger,
    fontSize: 12,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginTop: 28,
  },
  name: {
    fontFamily: fonts.display,
    color: colors.white,
    fontSize: 30,
    lineHeight: 36,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginTop: 28,
  },
  caption: { fontFamily: fonts.body, color: colors.muted2, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  actions: { position: 'absolute', left: 24, right: 24, gap: 10 },
});
