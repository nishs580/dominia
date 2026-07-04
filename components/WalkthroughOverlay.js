import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { colors, fonts } from '../lib/theme';
import { hasFired, markFired } from '../lib/walkthroughFlags';

const GLIDE_MS = 850;
const IDLE_WIGGLE_AFTER_MS = 6000;
const POINTER_SIZE = 30;

/** Measure a mounted view ref into a window-coordinate rect. */
export function rectFromRef(ref) {
  return new Promise((resolve) => {
    const node = ref?.current;
    if (!node?.measureInWindow) {
      resolve(null);
      return;
    }
    node.measureInWindow((x, y, width, height) => {
      if ([x, y, width, height].some((v) => !Number.isFinite(v)) || width <= 0) {
        resolve(null);
        return;
      }
      resolve({ x, y, width, height });
    });
  });
}

/**
 * Per-screen first-view walkthrough.
 *
 * An animated pointer glides between the screen's elements; a coach bubble
 * explains each one. Advancing is always player-driven (tap anywhere) — the
 * pointer never moves on a timer, it only wiggles after ~6s idle as a nudge.
 * Fires once per screen per player (lib/walkthroughFlags); completing OR
 * skipping marks it fired, backgrounding mid-tour does not.
 *
 * steps: [{ key, kicker?, text, getRect: async () => rect|null, cta? }]
 * The overlay silently drops steps whose target cannot be measured, so a
 * conditional element (e.g. a permission card already granted) never leaves
 * a dangling explanation.
 */
export default function WalkthroughOverlay({ screenKey, userId, steps, enabled = true, onStart, onDone }) {
  const { t } = useTranslation();
  const { width: screenW, height: screenH } = useWindowDimensions();

  const [stepIndex, setStepIndex] = useState(-1);
  const [rect, setRect] = useState(null);
  const [bubbleVisible, setBubbleVisible] = useState(false);

  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const bubbleOpacity = useRef(new Animated.Value(0)).current;
  const pointerXY = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const wiggle = useRef(new Animated.Value(0)).current;

  const startedRef = useRef(false);
  const finishedRef = useRef(false);
  const idleTimerRef = useRef(null);
  const wiggleLoopRef = useRef(null);

  const active = stepIndex >= 0;

  const stopWiggle = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
    if (wiggleLoopRef.current) {
      wiggleLoopRef.current.stop();
      wiggleLoopRef.current = null;
      wiggle.setValue(0);
    }
  }, [wiggle]);

  const armWiggle = useCallback(() => {
    stopWiggle();
    idleTimerRef.current = setTimeout(() => {
      wiggleLoopRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(wiggle, { toValue: 1, duration: 260, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(wiggle, { toValue: -1, duration: 260, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(wiggle, { toValue: 0, duration: 260, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.delay(1400),
        ]),
      );
      wiggleLoopRef.current.start();
    }, IDLE_WIGGLE_AFTER_MS);
  }, [stopWiggle, wiggle]);

  // Resolve the first measurable step at `from` or later; -1 when exhausted.
  const resolveStep = useCallback(
    async (from) => {
      for (let i = from; i < steps.length; i += 1) {
        try {
          const r = await steps[i].getRect();
          if (r) return { index: i, rect: r };
        } catch {
          // Unmeasurable target — treat as absent and move on.
        }
      }
      return null;
    },
    [steps],
  );

  const pointerTargetFor = useCallback((r) => {
    const cx = r.x + r.width / 2;
    const cy = r.y + Math.min(r.height / 2, screenH * 0.4);
    return {
      x: Math.min(Math.max(cx, 24), screenW - POINTER_SIZE - 8),
      y: Math.min(Math.max(cy, 24), screenH - POINTER_SIZE - 8),
    };
  }, [screenH, screenW]);

  const showStep = useCallback(
    (index, r, firstShow) => {
      setStepIndex(index);
      setRect(r);
      setBubbleVisible(false);
      bubbleOpacity.setValue(0);
      stopWiggle();

      const target = pointerTargetFor(r);
      const glide = Animated.timing(pointerXY, {
        toValue: target,
        duration: firstShow ? 0 : GLIDE_MS,
        easing: Easing.bezier(0.45, 0, 0.2, 1),
        useNativeDriver: true,
      });

      if (firstShow) {
        pointerXY.setValue(target);
        Animated.timing(overlayOpacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      }

      glide.start(() => {
        setBubbleVisible(true);
        Animated.timing(bubbleOpacity, { toValue: 1, duration: 250, useNativeDriver: true }).start();
        armWiggle();
      });
    },
    [armWiggle, bubbleOpacity, overlayOpacity, pointerTargetFor, pointerXY, stopWiggle],
  );

  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    stopWiggle();
    markFired(userId, screenKey);
    Animated.timing(overlayOpacity, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => {
      setStepIndex(-1);
      setRect(null);
      if (onDone) onDone();
    });
  }, [onDone, overlayOpacity, screenKey, stopWiggle, userId]);

  const advance = useCallback(async () => {
    const next = await resolveStep(stepIndex + 1);
    if (!next) {
      finish();
      return;
    }
    showStep(next.index, next.rect, false);
  }, [finish, resolveStep, showStep, stepIndex]);

  useEffect(() => {
    if (!enabled || startedRef.current || !steps?.length) return;
    let cancelled = false;
    (async () => {
      const fired = await hasFired(userId, screenKey);
      if (fired || cancelled || startedRef.current) return;
      const first = await resolveStep(0);
      if (!first || cancelled || startedRef.current) return;
      startedRef.current = true;
      if (onStart) onStart();
      showStep(first.index, first.rect, true);
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, resolveStep, screenKey, showStep, steps, userId]);

  useEffect(() => () => stopWiggle(), [stopWiggle]);

  const step = active ? steps[stepIndex] : null;

  const bubbleLayout = useMemo(() => {
    if (!rect) return null;
    const targetCenterY = rect.y + rect.height / 2;
    const below = targetCenterY < screenH * 0.48;
    if (below) {
      return { top: Math.min(rect.y + rect.height + 14, screenH - 180), left: 16, right: 16 };
    }
    return { bottom: Math.max(screenH - rect.y + 14, 96), left: 16, right: 16 };
  }, [rect, screenH]);

  if (!active || !step || !rect || !bubbleLayout) return null;

  const isLast = stepIndex === steps.length - 1;
  const scrim = 'rgba(14,16,20,0.72)';

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, { opacity: overlayOpacity }]} pointerEvents="box-none">
      <View style={[styles.scrim, { backgroundColor: scrim, left: 0, right: 0, top: 0, height: Math.max(rect.y, 0) }]} pointerEvents="none" />
      <View style={[styles.scrim, { backgroundColor: scrim, left: 0, right: 0, top: rect.y + rect.height, bottom: 0 }]} pointerEvents="none" />
      <View style={[styles.scrim, { backgroundColor: scrim, left: 0, width: Math.max(rect.x, 0), top: rect.y, height: rect.height }]} pointerEvents="none" />
      <View style={[styles.scrim, { backgroundColor: scrim, left: rect.x + rect.width, right: 0, top: rect.y, height: rect.height }]} pointerEvents="none" />

      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={advance}
        accessibilityRole="button"
        accessibilityLabel={t('walkthrough.nextA11y')}
      />

      <Animated.View
        pointerEvents="none"
        style={[
          styles.pointer,
          {
            transform: [
              ...pointerXY.getTranslateTransform(),
              { translateX: wiggle.interpolate({ inputRange: [-1, 1], outputRange: [-4, 4] }) },
            ],
          },
        ]}
      >
        <Svg width={POINTER_SIZE} height={POINTER_SIZE} viewBox="0 0 24 24">
          <Path
            d="M4 2 L4 20 L9 15.5 L12.5 22.5 L15.5 21 L12 14 L18.5 13.5 Z"
            fill={colors.bone}
            stroke={colors.ink}
            strokeWidth={1.4}
          />
        </Svg>
      </Animated.View>

      {bubbleVisible ? (
        <Animated.View style={[styles.bubble, bubbleLayout, { opacity: bubbleOpacity }]} pointerEvents="box-none">
          {step.kicker ? <Text style={styles.kicker}>{step.kicker}</Text> : null}
          <Text style={styles.body} accessibilityLiveRegion="polite">
            {step.text}
          </Text>
          <View style={styles.bubbleFooter}>
            <View style={styles.dots}>
              {steps.map((s, i) => (
                <View key={s.key} style={[styles.dot, i === stepIndex && styles.dotActive]} />
              ))}
            </View>
            {isLast ? (
              <Pressable onPress={advance} style={styles.cta} accessibilityRole="button">
                <Text style={styles.ctaText}>{step.cta ?? t('walkthrough.gotIt')}</Text>
              </Pressable>
            ) : (
              <Pressable onPress={finish} hitSlop={10} accessibilityRole="button">
                <Text style={styles.skip}>{t('walkthrough.skip')}</Text>
              </Pressable>
            )}
          </View>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    zIndex: 1000,
    elevation: 12,
  },
  scrim: {
    position: 'absolute',
  },
  pointer: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: POINTER_SIZE,
    height: POINTER_SIZE,
  },
  bubble: {
    position: 'absolute',
    backgroundColor: colors.ink2,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  kicker: {
    fontFamily: fonts.monoMedium,
    fontSize: 10,
    color: colors.claim,
    letterSpacing: 1.6,
    marginBottom: 6,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
    color: colors.bone,
  },
  bubbleFooter: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 5,
    height: 5,
    backgroundColor: colors.slate,
  },
  dotActive: {
    backgroundColor: colors.claim,
  },
  skip: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.slate2,
    letterSpacing: 1.2,
  },
  cta: {
    backgroundColor: colors.claim,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  ctaText: {
    fontFamily: fonts.monoMedium,
    fontSize: 11,
    color: colors.bone,
    letterSpacing: 1.2,
  },
});
