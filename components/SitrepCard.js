// Component: SitrepCard — the once-per-session daily brief on the Map screen.
// One glance on open: streak, whether today's challenge is done, Attack Day.
// Field-note voice, no spinner, no retry — if the fetch fails there is simply
// no card. Tap → Activity tab; DISMISS hides it until the next cold start.
//
// At-risk state (challenge day, nothing completed, streak > 0, after 17:00
// device-local): the streak line swaps to the warning copy and the marker
// pulses at the ambient 2000ms cadence (linear, per brand).

import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { fetchChallengesToday } from '../lib/challengesTodayApi';

const INK2 = '#1A1D24';
const BONE = '#F2EEE6';
const SLATE2 = '#8B8F98';
const HAIRLINE_STRONG = 'rgba(242,238,230,0.16)';

const AT_RISK_HOUR = 17;

// One brief per app session, across remounts of the Map screen.
let shownThisSession = false;

export function resetSitrepForSession() {
  shownThisSession = false;
}

export default function SitrepCard({ suppressed = false }) {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const [brief, setBrief] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const claimedRef = useRef(false);
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (suppressed || shownThisSession || claimedRef.current) return undefined;
    claimedRef.current = true;
    shownThisSession = true;
    let cancelled = false;
    (async () => {
      const res = await fetchChallengesToday({ clerkGetToken: () => getTokenRef.current() });
      if (cancelled || !res.ok) {
        // Failure keeps the no-card silence, but releases the session claim so
        // a transient network blip doesn't burn the brief for the whole session.
        if (!res?.ok) {
          claimedRef.current = false;
          shownThisSession = false;
        }
        return;
      }
      const d = res.data;
      const streak = Math.max(0, Number(d?.streak?.current) || 0);
      const done = Array.isArray(d?.completed) && d.completed.length > 0;
      const isChallengeDay = d?.is_challenge_day === true;
      const atRisk =
        isChallengeDay && !done && streak > 0 && new Date().getHours() >= AT_RISK_HOUR;
      setBrief({ streak, done, isChallengeDay, atRisk });
    })();
    return () => { cancelled = true; };
  }, [suppressed]);

  useEffect(() => {
    if (!brief?.atRisk) return undefined;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.15, duration: 2000, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 2000, easing: Easing.linear, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [brief?.atRisk, pulse]);

  if (suppressed || dismissed || !brief) return null;

  const streakLine = brief.streak > 0
    ? (brief.atRisk
        ? t('sitrep.streakAtRisk', { count: brief.streak })
        : t('sitrep.streak', { count: brief.streak }))
    : null;

  const dayLine = brief.isChallengeDay
    ? (brief.done ? t('sitrep.challengeDone') : t('sitrep.challengeOpen'))
    : t('sitrep.attackDay');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('sitrep.kicker')}
      onPress={() => navigation.navigate('Activity')}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }]}
    >
      <View style={styles.kickerRow}>
        <Animated.View style={[styles.marker, { opacity: pulse }]} />
        <Text style={styles.kicker}>{t('sitrep.kicker')}</Text>
        <View style={{ flex: 1 }} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('sitrep.dismiss')}
          onPress={() => setDismissed(true)}
          hitSlop={10}
        >
          <Text style={styles.dismiss}>{t('sitrep.dismiss')}</Text>
        </Pressable>
      </View>
      {streakLine ? <Text style={styles.line}>{streakLine}</Text> : null}
      <Text style={styles.line}>{dayLine}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: INK2,
    borderWidth: 1,
    borderColor: HAIRLINE_STRONG,
    borderRadius: 0,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  marker: {
    width: 6,
    height: 6,
    backgroundColor: BONE,
  },
  kicker: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 9,
    color: SLATE2,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  dismiss: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 9,
    color: SLATE2,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  line: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 19,
    color: BONE,
  },
});
