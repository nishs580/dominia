// Daily Reward (Updated UX A6): DAILY REWARD eyebrow, DAY n, the gold icon
// with today's amount and GOLD, the D1–D7 strip with today in lime, "Come
// back tomorrow to collect Day n+1." and a full-width lime TAP TO COLLECT, on
// plain Ink. The strip comes from lib/dailyReward (GET ladder → economy
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
import { AccessibilityInfo, ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@clerk/clerk-expo';
import { GoldGlyph } from '../components/ResourceGlyphs';
import { claimDailyReward, isAlreadyClaimed } from '../lib/dailyRewardApi';
import { dailyRewardView } from '../lib/dailyReward';
import { getEconomy } from '../lib/flags';
import { colors, fonts } from '../lib/theme';

const CLOSE_AFTER_CLAIM_MS = 1200;

function StripCell({ cell }) {
  const today = cell.state === 'today';
  const collected = cell.state === 'collected';
  return (
    <View style={[styles.cell, today && styles.cellToday, collected && styles.cellCollected]}>
      <Text style={[styles.cellDay, today && styles.cellDayToday]} maxFontSizeMultiplier={1.2}>
        {cell.label}
      </Text>
      <Text style={[styles.cellAmount, today && styles.cellAmountToday]} maxFontSizeMultiplier={1.2}>
        {cell.amount}
      </Text>
    </View>
  );
}

/**
 * @param {object} props
 * @param {'loading'|'ready'|'error'|'claiming'|'claimed'} props.status
 * @param {{day:number, amount:number, ladder?:number[]|null}|null} props.reward
 * @param {number|null} [props.claimedAmount]
 * @param {string} [props.background] ignored; kept for callers (A6 is plain Ink)
 */
// eslint-disable-next-line no-unused-vars
export function DailyRewardView({ status, reward, claimedAmount = null, onCollect, onRetry, onSkip, background }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const view = dailyRewardView({ reward, economy: getEconomy() });
  const { day, amount, nextDay, strip } = view;

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
        <Text style={styles.eyebrow}>{t('dailyReward.eyebrow', { defaultValue: 'Daily reward' })}</Text>
        <Text style={styles.title} accessibilityRole="header" maxFontSizeMultiplier={1.2}>
          {t('dailyReward.dayTitle', { day, defaultValue: 'Day {{day}}' })}
        </Text>

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
            <View
              style={styles.amountRow}
              accessible
              accessibilityLabel={`${amount} ${t('dailyReward.gold', { defaultValue: 'Gold' })}`}
            >
              <GoldGlyph size={40} color={colors.lime} strokeWidth={2} />
              <Text style={styles.amount} maxFontSizeMultiplier={1.2}>
                {amount}
              </Text>
              <Text style={styles.goldLabel}>{t('dailyReward.gold', { defaultValue: 'Gold' })}</Text>
            </View>

            <View style={styles.strip} importantForAccessibility="no-hide-descendants">
              {strip.map((cell) => (
                <StripCell key={cell.day} cell={cell} />
              ))}
            </View>

            <Text style={styles.comeBack}>
              {t('dailyReward.comeBack', {
                day: nextDay,
                defaultValue: 'Come back tomorrow to collect Day {{day}}.',
              })}
            </Text>
          </>
        )}
      </View>

      {status !== 'error' ? (
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
          style={({ pressed }) => [styles.collect, !canCollect && styles.collectDim, pressed && canCollect && styles.collectPressed]}
        >
          <Text style={styles.collectText}>{ctaLabel}</Text>
        </Pressable>
      ) : null}
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
  eyebrow: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.8,
    color: colors.lime,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 29,
    lineHeight: 32,
    letterSpacing: -0.6,
    color: colors.white,
    textTransform: 'uppercase',
    marginTop: 12,
  },
  loading: { marginVertical: 48 },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16 },
  amount: { fontFamily: fonts.monoLight, fontSize: 56, lineHeight: 64, letterSpacing: -1.6, color: colors.white },
  goldLabel: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.8,
    color: colors.muted2,
    textTransform: 'uppercase',
  },
  strip: { flexDirection: 'row', gap: 6, width: '100%', marginTop: 16 },
  cell: {
    flex: 1,
    minHeight: 52,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  cellToday: { borderColor: colors.lime, backgroundColor: colors.limeSoft },
  cellCollected: { opacity: 0.5 },
  cellDay: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 0.8, color: colors.muted },
  cellDayToday: { color: colors.lime },
  cellAmount: { fontFamily: fonts.mono, fontSize: 13, color: colors.muted2, marginTop: 2 },
  cellAmountToday: { color: colors.white },
  comeBack: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.muted, marginTop: 16, textAlign: 'center' },
  collect: {
    backgroundColor: colors.lime,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  collectDim: { opacity: 0.6 },
  collectPressed: { opacity: 0.85 },
  collectText: {
    fontFamily: fonts.monoMedium,
    fontSize: 13,
    letterSpacing: 1.8,
    color: colors.onLime,
    textTransform: 'uppercase',
  },
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
