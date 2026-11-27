// components/ChallengeResultOverlay.js
// VICTORY / DEFEAT over the challenge map once a contest resolves (plan U13,
// contest_result_screen off). One action: CONTINUE, back to the map.
//
// Content comes from lib/challengeScreen.js challengeResult(); this component
// only lays it out and announces it.
//
// Figma mode (plan U9) passes `moment` instead: a full-screen TAKEN / HELD /
// LOST moment with an eyebrow, body, three stats tiles and BACK TO MAP.
// Content comes from lib/challengeResult.js challengeResultModel().

import React, { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors } from '../lib/theme';

const INK2 = colors.ink2;
const BONE = colors.bone;
const SLATE2 = colors.slate2;
const CLAIM_BUTTON = colors.claimButton;
const ALLIANCE = colors.alliance;
const HAIRLINE_STRONG = colors.hairlineStrong;

function tr(t, copy) {
  return t(copy.key, { defaultValue: copy.defaultValue, ...(copy.params || {}) });
}

const MOMENT_COLORS = Object.freeze({
  green: colors.self,
  red: colors.enemy,
  lime: colors.lime,
});

/**
 * @param {object}   props
 * @param {object}   [props.result]   challengeResult() output (legacy overlay).
 * @param {object}   [props.moment]   challengeResultModel() output (Figma mode).
 * @param {Function} props.onContinue
 * @param {number}   [props.topInset]
 * @param {number}   [props.bottomInset]
 */
export default function ChallengeResultOverlay({ result, moment, onContinue, topInset = 0, bottomInset = 0 }) {
  if (moment) {
    return <ChallengeMoment moment={moment} onContinue={onContinue} topInset={topInset} bottomInset={bottomInset} />;
  }
  return <VictoryDefeatOverlay result={result} onContinue={onContinue} bottomInset={bottomInset} />;
}

function ChallengeMoment({ moment, onContinue, topInset, bottomInset }) {
  const { t } = useTranslation();
  const fade = useRef(new Animated.Value(0)).current;

  const eyebrow = tr(t, moment.eyebrow);
  const word = tr(t, moment.moment);
  const body = tr(t, moment.body);
  const backLabel = tr(t, moment.backToMap);
  const accent = MOMENT_COLORS[moment.color] ?? BONE;
  const stats = moment.stats.map((s) => ({
    label: tr(t, s.label),
    value: s.valueCopy ? tr(t, s.valueCopy) : s.value,
    color: MOMENT_COLORS[s.color] ?? BONE,
  }));

  useEffect(() => {
    const statLine = stats.map((s) => `${s.label} ${s.value}`).join(', ');
    AccessibilityInfo.announceForAccessibility?.(`${word}. ${eyebrow}. ${body} ${statLine}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [word, eyebrow, body]);

  useEffect(() => {
    Animated.timing(fade, {
      toValue: 1,
      duration: 280,
      easing: Easing.bezier(0.2, 0, 0, 1),
      useNativeDriver: true,
    }).start();
  }, [fade]);

  return (
    <Animated.View
      style={[styles.momentScrim, { opacity: fade, paddingTop: topInset + 120, paddingBottom: bottomInset + 24 }]}
      accessibilityViewIsModal
    >
      <View accessible accessibilityRole="alert" accessibilityLabel={`${word}. ${eyebrow}. ${body}`}>
        <Text style={[styles.momentEyebrow, { color: accent }]}>{eyebrow}</Text>
        <Text style={[styles.momentWord, { color: accent }]} maxFontSizeMultiplier={1.1}>{word}</Text>
        <Text style={styles.momentBody}>{body}</Text>
      </View>
      <View style={styles.statsRow}>
        {stats.map((s, i) => (
          <View
            key={i}
            style={[styles.statTile, i > 0 && styles.statTileDivider]}
            accessible
            accessibilityLabel={`${s.label} ${s.value}`}
          >
            <Text style={styles.statLabel} numberOfLines={1}>{s.label}</Text>
            <Text style={[styles.statValue, { color: s.color }]} numberOfLines={1} adjustsFontSizeToFit>{s.value}</Text>
          </View>
        ))}
      </View>
      <View style={{ flex: 1 }} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={backLabel}
        onPress={onContinue}
        style={({ pressed }) => [styles.continueBtn, pressed && { backgroundColor: colors.actionPressed }]}
      >
        <Text style={styles.continueText}>{backLabel}</Text>
      </Pressable>
    </Animated.View>
  );
}

function VictoryDefeatOverlay({ result, onContinue, bottomInset = 0 }) {
  const { t } = useTranslation();
  const fade = useRef(new Animated.Value(0)).current;

  const label = tr(t, result.label);
  const title = tr(t, result.title);
  const body = tr(t, result.body);
  const continueLabel = t('challengeResult.continue', { defaultValue: 'CONTINUE' });

  // Announced when it appears (plan: Accessibility).
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility?.(`${label}. ${title} ${body}`);
  }, [label, title, body]);

  useEffect(() => {
    Animated.timing(fade, {
      toValue: 1,
      duration: 280,
      easing: Easing.bezier(0.2, 0, 0, 1),
      useNativeDriver: true,
    }).start();
  }, [fade]);

  // CONTINUE is the screen's one Claim Red element. A held defence reads in
  // Alliance Green (ours, defensive); everything else stays Bone — territory
  // colours never stand in for generic success or error.
  const accent = result.state === 'defend_won' ? ALLIANCE : BONE;

  return (
    <Animated.View
      style={[styles.scrim, { opacity: fade, paddingBottom: bottomInset + 16 }]}
      accessibilityViewIsModal
    >
      <View style={styles.card} accessible accessibilityRole="alert" accessibilityLabel={`${label}. ${title} ${body}`}>
        <Text style={[styles.label, { color: accent }]} maxFontSizeMultiplier={1.2}>{label}</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={continueLabel}
        onPress={onContinue}
        style={({ pressed }) => [styles.continueBtn, pressed && { opacity: 0.9 }]}
      >
        <Text style={styles.continueText}>{continueLabel}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.72)', // Ink at 72% — the map stays visible beneath
    justifyContent: 'flex-end',
    paddingHorizontal: 18,
    gap: 12,
  },
  card: {
    backgroundColor: INK2,
    borderWidth: 1,
    borderColor: HAIRLINE_STRONG,
    borderRadius: 0,
    padding: 16,
    gap: 8,
  },
  // Ceremony moment: Archivo display is sanctioned here.
  label: { fontFamily: 'Archivo_900Black_Italic', fontSize: 38, letterSpacing: -1.4, textTransform: 'uppercase' },
  title: { fontFamily: 'IBMPlexSans_600SemiBold', color: BONE, fontSize: 15, lineHeight: 21 },
  body: { fontFamily: 'IBMPlexSans_500Medium', color: SLATE2, fontSize: 13, lineHeight: 19 },
  continueBtn: {
    backgroundColor: CLAIM_BUTTON,
    borderRadius: 0,
    paddingVertical: 16,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueText: { fontFamily: 'IBMPlexSans_600SemiBold', color: BONE, fontSize: 12, letterSpacing: 1.6, textTransform: 'uppercase' },

  // Figma result moment (plan U9): full screen over a dimmed map.
  momentScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.82)',
    paddingHorizontal: 20,
  },
  momentEyebrow: { fontFamily: 'IBMPlexSans_600SemiBold', fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase' },
  // Ceremony moment: the display face at its largest.
  momentWord: {
    fontFamily: 'Archivo_900Black_Italic',
    fontSize: 58,
    lineHeight: 61,
    letterSpacing: -1,
    textTransform: 'uppercase',
    marginTop: 10,
  },
  momentBody: { fontFamily: 'IBMPlexSans_500Medium', color: BONE, fontSize: 15, lineHeight: 22, marginTop: 8 },
  statsRow: {
    flexDirection: 'row',
    marginTop: 16,
    borderWidth: 1,
    borderColor: HAIRLINE_STRONG,
  },
  statTile: { flex: 1, paddingHorizontal: 10, paddingVertical: 10, gap: 4 },
  statTileDivider: { borderLeftWidth: 1, borderLeftColor: HAIRLINE_STRONG },
  statLabel: { fontFamily: 'IBMPlexSans_700Bold', color: SLATE2, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase' },
  statValue: { fontFamily: 'IBMPlexSans_700Bold', fontSize: 20, letterSpacing: 0.2, textTransform: 'uppercase' },
});
