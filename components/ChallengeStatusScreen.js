// components/ChallengeStatusScreen.js
// Full-screen status over the challenge map (plan U9, Figma B7 / B8): a lime
// target, a mono caps title and one body line — "SECURING THE CLAIM…" and
// "CANCELLING THE CLAIM…". Optional children (error actions) sit below.

import React, { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { colors } from '../lib/theme';
import { TargetIcon } from './ChallengeIcons';

/**
 * @param {object} props
 * @param {string} props.title
 * @param {string} [props.body]
 * @param {boolean} [props.pulse]  breathe the target while work is pending.
 * @param {React.ReactNode} [props.children]
 * @param {number} [props.bottomInset]
 */
export default function ChallengeStatusScreen({ title, body, pulse = true, children, bottomInset = 0 }) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility?.(body ? `${title} ${body}` : title);
  }, [title, body]);

  useEffect(() => {
    if (!pulse) return undefined;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.12, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, scale]);

  return (
    <View style={styles.scrim} accessibilityViewIsModal>
      <View style={styles.center} accessibilityLiveRegion="polite">
        <Animated.View style={{ transform: [{ scale }] }}>
          <TargetIcon size={36} color={colors.lime} strokeWidth={1.2} />
        </Animated.View>
        <Text style={styles.title}>{title}</Text>
        {body ? <Text style={styles.body}>{body}</Text> : null}
      </View>
      {children ? <View style={[styles.actions, { bottom: bottomInset + 24 }]}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  center: { alignItems: 'center', gap: 14 },
  title: {
    fontFamily: 'IBMPlexSans_600SemiBold',
    color: colors.bone,
    fontSize: 13,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginTop: 6,
  },
  body: { fontFamily: 'IBMPlexSans_500Medium', color: colors.slate2, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  actions: { position: 'absolute', left: 24, right: 24, gap: 10 },
});
