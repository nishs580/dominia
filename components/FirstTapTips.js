import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { colors, fonts } from '../lib/theme';
import { hasFired, markFired } from '../lib/walkthroughFlags';

const AUTO_DISMISS_MS = 7000;

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
 * Reactive first-tap tips (replaces the pointer-driven walkthrough tour).
 *
 * Nothing auto-plays. The host screen forwards raw touches from its root View
 * (`onTouchStart`); when a touch lands inside a registered element's rect and
 * that element's tip hasn't fired for this player, the tip shows as a light
 * bubble anchored to the element — no scrim, no pointer, and the touch still
 * reaches the element (tips never block the action). Each tip fires once per
 * player, ever. A visible tip is dismissed by the next touch anywhere or
 * after ~7s.
 *
 * tips: [{ key, kicker?, text, getRect: async () => rect|null }]
 * Order matters only when rects overlap (e.g. layered map-area tips): the
 * first unfired hit wins, so repeated touches on the same area walk through
 * its tips one per touch.
 *
 * Usage:
 *   const tips = useFirstTapTips({ screenKey, userId, tips: [...] });
 *   <View style={styles.screen} onTouchStart={tips.onTouchStart}>
 *     ...
 *     {tips.tipElement}
 *   </View>
 */
export function useFirstTapTips({ screenKey, userId, tips, enabled = true }) {
  const { height: winH } = useWindowDimensions();
  const [visibleTip, setVisibleTip] = useState(null);
  const visibleTipRef = useRef(null);
  const busyRef = useRef(false);
  const dismissTimerRef = useRef(null);
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    visibleTipRef.current = visibleTip;
  }, [visibleTip]);

  useEffect(
    () => () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    },
    [],
  );

  const dismiss = useCallback(() => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
    visibleTipRef.current = null;
    Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => {
      setVisibleTip(null);
    });
  }, [opacity]);

  const show = useCallback(
    (tip, rect) => {
      setVisibleTip({ tip, rect });
      visibleTipRef.current = { tip, rect };
      opacity.setValue(0);
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }).start();
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = setTimeout(dismiss, AUTO_DISMISS_MS);
    },
    [dismiss, opacity],
  );

  const onTouchStart = useCallback(
    (e) => {
      const pageX = e?.nativeEvent?.pageX;
      const pageY = e?.nativeEvent?.pageY;

      // A touch while a tip is up only dismisses it — predictable, and the
      // same touch never both dismisses one tip and raises the next.
      if (visibleTipRef.current) {
        dismiss();
        return;
      }
      if (!enabled || busyRef.current || !Number.isFinite(pageX) || !Number.isFinite(pageY)) {
        return;
      }

      busyRef.current = true;
      (async () => {
        try {
          for (const tip of tips) {
            const flag = `tip:${screenKey}:${tip.key}`;
            if (await hasFired(userId, flag)) continue;
            let rect = null;
            try {
              rect = await tip.getRect();
            } catch {
              rect = null;
            }
            if (!rect) continue;
            const hit =
              pageX >= rect.x &&
              pageX <= rect.x + rect.width &&
              pageY >= rect.y &&
              pageY <= rect.y + rect.height;
            if (hit) {
              markFired(userId, flag);
              show(tip, rect);
              return;
            }
          }
        } finally {
          busyRef.current = false;
        }
      })();
    },
    [dismiss, enabled, screenKey, show, tips, userId],
  );

  const tipElement = useMemo(() => {
    if (!visibleTip) return null;
    const { tip, rect } = visibleTip;
    const targetCenterY = rect.y + rect.height / 2;
    const below = targetCenterY < winH * 0.48;
    const placement = below
      ? { top: Math.min(rect.y + rect.height + 10, winH - 160), left: 16, right: 16 }
      : { bottom: Math.max(winH - rect.y + 10, 90), left: 16, right: 16 };

    return (
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.layer]}>
        <Animated.View style={[styles.bubble, placement, { opacity }]}>
          {tip.kicker ? <Text style={styles.kicker}>{tip.kicker}</Text> : null}
          <Text style={styles.body} accessibilityLiveRegion="polite">
            {tip.text}
          </Text>
        </Animated.View>
      </View>
    );
  }, [opacity, visibleTip, winH]);

  return { onTouchStart, tipElement };
}

const styles = StyleSheet.create({
  layer: {
    zIndex: 1000,
    elevation: 12,
  },
  bubble: {
    position: 'absolute',
    backgroundColor: colors.ink2,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    paddingVertical: 12,
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
});
