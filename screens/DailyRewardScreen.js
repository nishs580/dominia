// Daily Rewards (Dominia-Temp core-loop board): the DAILY REWARDS title, the
// gold-biscuit art on a blue glow, "Day n: amount" and a lime TAP TO COLLECT,
// on black. Day and amount come from lib/dailyReward (GET ladder → economy
// daily_reward_ladder → flat daily_reward_gold).
//
// Two uses:
//   - DailyRewardView: a step inside FigmaOnboardingScreen. Collect only
//     records the intent; the claim is sent after City intro saves the home
//     pin (lib/onboardingFlow), so the first claim is dated in the player's
//     real timezone.
//   - default export: the 'DailyReward' route, a modal over the map that
//     AuthGate opens for a returning player whose reward for today is
//     unclaimed. Collect claims at once.
// Failures show retry / skip and never block the player.

import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@clerk/clerk-expo';
import { claimDailyReward, isAlreadyClaimed } from '../lib/dailyRewardApi';
import { dailyRewardView } from '../lib/dailyReward';
import { getEconomy } from '../lib/flags';
import { colors, fonts } from '../lib/theme';

const CLOSE_AFTER_CLAIM_MS = 1200;

const BISCUITS = require('../assets/figma/gold-biscuits.png');
const ART = 220;
const GLOW = Math.round(ART * 1.4);

// Soft Dominia-blue glow behind the biscuits.
function Glow() {
  return (
    <Svg width={GLOW} height={GLOW} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <RadialGradient id="dailyRewardGlow" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={colors.action} stopOpacity="0.75" />
          <Stop offset="0.55" stopColor={colors.action} stopOpacity="0.25" />
          <Stop offset="1" stopColor={colors.action} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Circle cx={GLOW / 2} cy={GLOW / 2} r={GLOW / 2} fill="url(#dailyRewardGlow)" />
    </Svg>
  );
}

/**
 * @param {object} props
 * @param {'loading'|'ready'|'error'|'claiming'|'claimed'} props.status
 * @param {{day:number, amount:number, ladder?:number[]|null}|null} props.reward
 * @param {number|null} [props.claimedAmount]
 * @param {string} [props.background] ignored; kept for callers (the board is plain black)
 */
// eslint-disable-next-line no-unused-vars
export function DailyRewardView({ status, reward, claimedAmount = null, onCollect, onRetry, onSkip, background }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const view = dailyRewardView({ reward, economy: getEconomy() });
  const { day, amount } = view;

  useEffect(() => {
    if (status === 'claimed') {
      AccessibilityInfo.announceForAccessibility?.(
        t('dailyReward.collected', { amount: claimedAmount ?? amount, defaultValue: '+{{amount}} Gold collected' }),
      );
    }
  }, [status, claimedAmount, amount, t]);

  const canCollect = status === 'ready';
  const ctaLabel =
    status === 'claiming'
      ? t('dailyReward.collecting', { defaultValue: 'Collecting…' })
      : status === 'claimed'
        ? t('dailyReward.collected', { amount: claimedAmount ?? amount, defaultValue: '+{{amount}} Gold collected' })
        : t('dailyReward.tapToCollect', { defaultValue: 'Tap to Collect' });

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.content}>
        <Text style={styles.title} accessibilityRole="header" maxFontSizeMultiplier={1.2}>
          {t('dailyReward.title', { defaultValue: 'DAILY REWARDS' })}
        </Text>

        <View style={styles.art} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <Glow />
          <Image source={BISCUITS} style={styles.biscuits} resizeMode="contain" />
        </View>

        {status === 'loading' ? (
          <ActivityIndicator color={colors.white} style={styles.loading} />
        ) : status === 'error' ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>
              {t('dailyReward.loadFailed', { defaultValue: "Couldn't load today's reward." })}
            </Text>
            <View style={styles.row}>
              <Pressable accessibilityRole="button" onPress={onRetry} style={styles.textButton} hitSlop={8}>
                <Text style={styles.textButtonLabel}>{t('common.retry')}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={onSkip} style={styles.textButton} hitSlop={8}>
                <Text style={styles.textButtonLabel}>{t('dailyReward.skip', { defaultValue: 'Skip' })}</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <>
            <Text style={styles.dayAmount} maxFontSizeMultiplier={1.3}>
              {t('dailyReward.dayAmount', { day, amount, defaultValue: 'Day {{day}}: {{amount}}' })}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('dailyReward.collectA11y', {
                day,
                amount,
                defaultValue: 'Day {{day}}: {{amount}} Gold. Tap to collect',
              })}
              accessibilityState={{ disabled: !canCollect, busy: status === 'claiming' }}
              disabled={!canCollect}
              onPress={onCollect}
              hitSlop={12}
              style={({ pressed }) => [styles.collect, pressed && canCollect && styles.collectPressed]}
            >
              <Text style={[styles.collectText, !canCollect && styles.collectDim]} maxFontSizeMultiplier={1.3}>
                {ctaLabel}
              </Text>
            </Pressable>
          </>
        )}
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
  screen: { flex: 1, backgroundColor: colors.obsidian, paddingHorizontal: 24 },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: {
    fontFamily: fonts.display,
    fontSize: 32,
    lineHeight: 36,
    color: colors.white,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  art: { width: GLOW, height: GLOW, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  biscuits: { width: ART, height: ART },
  loading: { marginVertical: 24 },
  dayAmount: { fontFamily: fonts.bodyMedium, fontSize: 28, lineHeight: 34, color: colors.white, textAlign: 'center' },
  collect: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 16, marginTop: 40 },
  collectPressed: { opacity: 0.7 },
  collectText: {
    fontFamily: fonts.action,
    fontSize: 16,
    letterSpacing: 0.8,
    color: colors.lime,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  collectDim: { opacity: 0.6 },
  errorBox: { alignItems: 'center', marginTop: 24 },
  errorText: { fontFamily: fonts.body, fontSize: 13, color: colors.white, textAlign: 'center' },
  row: { flexDirection: 'row', gap: 24, marginTop: 16 },
  textButton: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 12 },
  textButtonLabel: {
    fontFamily: fonts.monoMedium,
    fontSize: 11,
    letterSpacing: 1.6,
    color: colors.white,
    textTransform: 'uppercase',
    textDecorationLine: 'underline',
  },
});
