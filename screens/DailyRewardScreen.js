// Daily Rewards (plan U10, Figma "DAILY REWARDS"): the gold bar, "Day N: 60"
// and "Tap to Collect" over a dark map.
//
// Two uses:
//   - DailyRewardView: a step inside FigmaOnboardingScreen. Collect only
//     records the intent; the claim is sent after City intro saves the home
//     pin (lib/onboardingFlow), so the first claim is dated in the player's
//     real timezone.
//   - default export: the 'DailyReward' route, a transparent modal over the
//     map that AuthGate opens for a returning player whose reward for today is
//     unclaimed. Collect claims at once.
// Failures show retry / skip and never block the player.

import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@clerk/clerk-expo';
import { Camera, MapView, setAccessToken } from '@rnmapbox/maps';
import { GoldGlyph } from '../components/ResourceGlyphs';
import { claimDailyReward, isAlreadyClaimed } from '../lib/dailyRewardApi';
import { getEconomy } from '../lib/flags';
import { fallbackCentreForLocale } from '../lib/onboardingFlow';
import { colors, fonts } from '../lib/theme';

setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '');

const CLOSE_AFTER_CLAIM_MS = 1200;

function DarkMapBackground() {
  const { i18n } = useTranslation();
  const centre = fallbackCentreForLocale(i18n.language);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" importantForAccessibility="no-hide-descendants">
      <MapView
        style={StyleSheet.absoluteFill}
        styleURL="mapbox://styles/mapbox/dark-v11"
        scrollEnabled={false}
        zoomEnabled={false}
        pitchEnabled={false}
        rotateEnabled={false}
        logoEnabled={false}
        attributionEnabled={false}
        scaleBarEnabled={false}
      >
        <Camera defaultSettings={{ centerCoordinate: [centre.lng, centre.lat], zoomLevel: 11 }} />
      </MapView>
    </View>
  );
}

/**
 * @param {object} props
 * @param {'loading'|'ready'|'error'|'claiming'|'claimed'} props.status
 * @param {{day:number, amount:number}|null} props.reward
 * @param {number|null} [props.claimedAmount]
 * @param {'map'|'scrim'} [props.background]
 */
export function DailyRewardView({ status, reward, claimedAmount = null, onCollect, onRetry, onSkip, background = 'map' }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const day = reward?.day ?? 1;
  const amount = reward?.amount ?? getEconomy().daily_reward_gold;

  useEffect(() => {
    if (status === 'claimed') {
      AccessibilityInfo.announceForAccessibility?.(
        t('dailyReward.collected', { amount: claimedAmount ?? amount, defaultValue: '+{{amount}} Gold collected' }),
      );
    }
  }, [status, claimedAmount, amount, t]);

  const canCollect = status === 'ready';

  return (
    <View style={styles.screen}>
      {background === 'map' ? <DarkMapBackground /> : null}
      <View style={[StyleSheet.absoluteFill, styles.scrim]} pointerEvents="none" />

      <View style={[styles.content, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
        <Text style={styles.title} accessibilityRole="header" maxFontSizeMultiplier={1.2}>
          {t('dailyReward.title', { defaultValue: 'DAILY REWARDS' })}
        </Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('dailyReward.collectA11y', {
            day,
            amount,
            defaultValue: 'Day {{day}}: {{amount}} Gold. Tap to collect',
          })}
          accessibilityState={{ disabled: !canCollect }}
          disabled={!canCollect}
          onPress={onCollect}
          style={({ pressed }) => [styles.card, pressed && canCollect && styles.cardPressed]}
        >
          <View style={styles.bar}>
            <GoldGlyph size={56} color={colors.bone} strokeWidth={2} />
          </View>
          {status === 'loading' ? (
            <ActivityIndicator color={colors.bone} style={styles.loading} />
          ) : status === 'error' ? (
            <Text style={styles.errorText}>
              {t('dailyReward.loadFailed', { defaultValue: "Couldn't load today's reward." })}
            </Text>
          ) : (
            <>
              <Text style={styles.dayLine} maxFontSizeMultiplier={1.3}>
                {t('dailyReward.dayAmount', { day, amount, defaultValue: 'Day {{day}}: {{amount}}' })}
              </Text>
              <Text style={styles.cta}>
                {status === 'claiming'
                  ? t('dailyReward.collecting', { defaultValue: 'Collecting…' })
                  : status === 'claimed'
                    ? t('dailyReward.collected', {
                        amount: claimedAmount ?? amount,
                        defaultValue: '+{{amount}} Gold collected',
                      })
                    : t('dailyReward.tapToCollect', { defaultValue: 'Tap to Collect' })}
              </Text>
            </>
          )}
        </Pressable>

        {status === 'error' ? (
          <View style={styles.row}>
            <Pressable accessibilityRole="button" onPress={onRetry} style={styles.textButton} hitSlop={8}>
              <Text style={styles.textButtonLabel}>{t('common.retry')}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={onSkip} style={styles.textButton} hitSlop={8}>
              <Text style={styles.textButtonLabel}>{t('dailyReward.skip', { defaultValue: 'Skip' })}</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );
}

// Route: returning player, opened by AuthGate with { reward } when today's
// reward is unclaimed. Claims immediately on tap.
export default function DailyRewardScreen({ navigation, route }) {
  const { getToken } = useAuth();
  const [status, setStatus] = useState('ready');
  const [claimedAmount, setClaimedAmount] = useState(null);
  const closeTimer = useRef(null);
  const reward = route?.params?.reward ?? null;

  useEffect(() => () => clearTimeout(closeTimer.current), []);

  const close = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.replace('MainTabs');
  };

  const collect = async () => {
    if (status !== 'ready') return;
    setStatus('claiming');
    const res = await claimDailyReward({ clerkGetToken: getToken });
    if (res.ok || isAlreadyClaimed(res)) {
      setClaimedAmount(res.ok ? res.data.gold_awarded : null);
      setStatus('claimed');
      closeTimer.current = setTimeout(close, CLOSE_AFTER_CLAIM_MS);
      return;
    }
    setStatus('error');
  };

  return (
    <DailyRewardView
      status={status}
      reward={reward}
      claimedAmount={claimedAmount}
      background="scrim"
      onCollect={collect}
      onRetry={() => setStatus('ready')}
      onSkip={close}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  scrim: { backgroundColor: 'rgba(14,16,20,0.72)' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  title: {
    fontFamily: fonts.display,
    fontSize: 32,
    letterSpacing: -0.9,
    color: colors.bone,
    textTransform: 'uppercase',
    marginBottom: 24,
  },
  card: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: colors.ink2,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  cardPressed: { backgroundColor: colors.ink3 },
  bar: {
    width: '100%',
    height: 88,
    backgroundColor: colors.ink3,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  loading: { marginVertical: 12 },
  dayLine: { fontFamily: fonts.displayMedium, fontSize: 26, color: colors.bone },
  cta: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.8,
    color: colors.slate2,
    textTransform: 'uppercase',
    marginTop: 8,
  },
  errorText: { fontFamily: fonts.body, fontSize: 13, color: colors.bone, textAlign: 'center' },
  row: { flexDirection: 'row', gap: 24, marginTop: 16 },
  textButton: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 12 },
  textButtonLabel: {
    fontFamily: fonts.monoMedium,
    fontSize: 11,
    letterSpacing: 1.6,
    color: colors.bone,
    textTransform: 'uppercase',
    textDecorationLine: 'underline',
  },
});
