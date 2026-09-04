// Component: NotificationBanner — the foreground surface for time-critical
// pushes (today: defender_notify).
//
// Why a banner and not a toast: a defence window is measured in minutes and a
// toast that fades after a few seconds can be missed entirely. This one holds
// until the player acts on it or dismisses it, and it never covers the app —
// it sits above the content, leaving the screen underneath usable.
//
// Brand rules applied: 0px radius, no shadow/glow, Claim red reserved for the
// active-contest signal, Geist Mono for chrome, the ambient 2000ms linear pulse
// for the urgency marker (never a faster "alarm" cadence — the brand does not
// panic).

import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { subscribe, hideBanner, getCurrentBanner } from '../../lib/notifications/bannerController';
import { navigateTo } from '../../lib/navigation';
import { colors, fonts, fontSize, letterSpacing, spacing } from '../../lib/theme';

const PULSE_MS = 2000;
const ENTER_MS = 220;

export default function NotificationBanner() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [banner, setBanner] = useState(getCurrentBanner());

  const slide = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => subscribe(setBanner), []);

  // Slide in on arrival. Reset to 0 first so a replacing banner re-plays the
  // entrance rather than appearing silently in place.
  useEffect(() => {
    if (!banner) return undefined;
    slide.setValue(0);
    const anim = Animated.timing(slide, {
      toValue: 1,
      duration: ENTER_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [banner, slide]);

  useEffect(() => {
    if (!banner) return undefined;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.25,
          duration: PULSE_MS / 2,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: PULSE_MS / 2,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [banner, pulse]);

  if (!banner) return null;

  const { title, body, target, params, eyebrowKey, ctaKey } = banner;

  const goToTarget = () => {
    if (target) navigateTo(target, params || {});
    hideBanner();
  };

  return (
    <Animated.View
      // pointerEvents="box-none" on the wrapper so the untouched area below the
      // banner stays interactive — the app keeps working behind it.
      pointerEvents="box-none"
      style={[styles.wrap, { paddingTop: insets.top }]}
    >
      <Animated.View
        style={{
          opacity: slide,
          transform: [
            { translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] }) },
          ],
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={title}
          onPress={goToTarget}
          style={({ pressed }) => [styles.banner, pressed && { opacity: 0.9 }]}
        >
          <View style={styles.eyebrowRow}>
            <Animated.View style={[styles.marker, { opacity: pulse }]} />
            <Text style={styles.eyebrow}>
              {t(eyebrowKey || 'notif.banner.underAttack')}
            </Text>
          </View>

          {title ? <Text style={styles.title}>{title}</Text> : null}
          {body ? <Text style={styles.body}>{body}</Text> : null}

          <View style={styles.actions}>
            <Text style={styles.cta}>{t(ctaKey || 'notif.banner.defend')}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={hideBanner}
              hitSlop={12}
              style={styles.dismissHit}
            >
              <Text style={styles.dismiss}>{t('notif.dismiss')}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    // Above the app and the toast host, below nothing — this is the most
    // urgent surface the app has.
    zIndex: 1000,
    elevation: 1000,
  },
  banner: {
    backgroundColor: colors.ink2,
    borderRadius: 0,
    // The Claim-red rule on the leading edge is the whole signal — no glow.
    borderLeftWidth: 3,
    borderLeftColor: colors.claim,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairlineStrong,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  marker: {
    width: 6,
    height: 6,
    backgroundColor: colors.claim,
    marginRight: spacing.sm,
  },
  eyebrow: {
    fontFamily: fonts.monoMedium,
    fontSize: fontSize.md,
    letterSpacing: letterSpacing.wider,
    color: colors.claim,
  },
  title: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.lg,
    color: colors.bone,
    marginBottom: spacing.xs,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: fontSize.base,
    color: colors.slate2,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  cta: {
    fontFamily: fonts.monoMedium,
    fontSize: fontSize.md,
    letterSpacing: letterSpacing.wider,
    color: colors.claim,
  },
  dismissHit: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  dismiss: {
    fontFamily: fonts.mono,
    fontSize: fontSize.md,
    letterSpacing: letterSpacing.wider,
    color: colors.slate2,
  },
});
