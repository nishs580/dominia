// Component: MedalEarnTakeover — full-ceremony surface for a medal earn,
// rendered as the medal branch inside NotificationCard's modal (replaces the
// old MedalEarnCard dialog). Full-bleed ink, 280ms fade, extended haptic on
// show. VIEW MEDAL deep-links to the earned medal's detail card on Profile;
// CONTINUE dismisses. Explicit CTAs only — no backdrop-tap dismissal for a
// milestone moment.

import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import MedalIcon from './MedalIcon';
import TierBars from './TierBars';
import { milestoneHaptic } from '../../lib/haptics';

const INK = '#0E1014';
const BONE = '#F2EEE6';
const SLATE2 = '#8B8F98';
const CLAIM = '#D64525';
const HAIRLINE_STRONG = 'rgba(242,238,230,0.16)';

// Reconstruct a minimal medal object from an FCM medal push so MedalIcon /
// TierBars can render it (the full state lives behind GET /legacy/medals).
export function medalFromPush(data) {
  const key = data?.medalKey ?? '';
  const category = key.split('.')[0] || 'combat';
  const kind = data?.kind;
  const type =
    kind === 'legacy_medal_count'
      ? 'singular_count'
      : kind === 'legacy_medal_one_off'
        ? 'singular_oneoff'
        : 'tiered';
  return {
    key,
    category,
    type,
    currentTier: data?.tier || null,
    count: data?.count != null ? Number(data.count) : 0,
    earned: type === 'singular_oneoff',
    earnedYear: data?.year != null ? Number(data.year) : null,
  };
}

function subline(t, medal) {
  if (medal.type === 'tiered') {
    return medal.currentTier ? t(`tierLabel.${medal.currentTier}`) : '';
  }
  if (medal.type === 'singular_count') return t('medal.countX', { count: medal.count });
  return medal.earnedYear ? t('medal.earnedYear', { year: medal.earnedYear }) : '';
}

export default function MedalEarnTakeover({ data, onViewMedal, onDismiss }) {
  const { t, i18n } = useTranslation();
  const medal = medalFromPush(data);
  const nameKey = `medalName.${medal.key}`;
  const name =
    (i18n.exists(nameKey) ? t(nameKey) : '') || data?.title || t('medal.medalEarnedFallback');
  const body = data?.body || '';
  const sub = subline(t, medal);
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    milestoneHaptic();
    Animated.timing(fade, {
      toValue: 1,
      duration: 280,
      easing: Easing.bezier(0.2, 0, 0, 1),
      useNativeDriver: true,
    }).start();
  }, [fade]);

  return (
    <Animated.View style={[styles.screen, { opacity: fade }]}>
      <View style={styles.centre}>
        <Text style={styles.kicker}>{t('medal.medalEarned')}</Text>
        <View style={styles.iconWrap}>
          <MedalIcon medal={medal} size={160} earned />
        </View>
        <Text
          style={styles.name}
          numberOfLines={2}
          adjustsFontSizeToFit
          minimumFontScale={0.5}
          maxFontSizeMultiplier={1.2}
        >
          {name}
        </Text>
        {sub ? <Text style={styles.sub}>{sub}</Text> : null}
        <View style={styles.ribbonWrap}>
          <TierBars medal={medal} height={8} />
        </View>
        {body ? <Text style={styles.body}>{body}</Text> : null}
      </View>

      <View style={styles.ctaStack}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('medal.viewMedal')}
          onPress={onViewMedal}
          style={({ pressed }) => [styles.ctaPrimary, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.ctaPrimaryText}>{t('medal.viewMedal')}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('milestone.continue')}
          onPress={onDismiss}
          style={({ pressed }) => [styles.ctaSecondary, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.ctaSecondaryText}>{t('milestone.continue')}</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignSelf: 'stretch',
    backgroundColor: INK,
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  centre: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kicker: {
    fontFamily: 'GeistMono_500Medium',
    color: CLAIM,
    fontSize: 11,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  iconWrap: {
    marginTop: 24,
    marginBottom: 24,
  },
  name: {
    fontFamily: 'Archivo_900Black',
    color: BONE,
    fontSize: 40,
    lineHeight: 44,
    letterSpacing: -0.5,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  sub: {
    fontFamily: 'GeistMono_500Medium',
    color: SLATE2,
    fontSize: 12,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginTop: 8,
  },
  ribbonWrap: {
    marginTop: 16,
    alignSelf: 'center',
  },
  body: {
    fontFamily: 'Inter_400Regular',
    color: SLATE2,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 16,
    paddingHorizontal: 18,
  },
  ctaStack: {
    gap: 8,
  },
  ctaPrimary: {
    borderWidth: 1,
    borderColor: HAIRLINE_STRONG,
    borderRadius: 0,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaPrimaryText: {
    fontFamily: 'GeistMono_500Medium',
    color: BONE,
    fontSize: 12,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  ctaSecondary: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaSecondaryText: {
    fontFamily: 'GeistMono_400Regular',
    color: SLATE2,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
});
