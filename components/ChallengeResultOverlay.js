// components/ChallengeResultOverlay.js
// VICTORY / DEFEAT over the challenge map once a contest resolves (plan U13,
// contest_result_screen off). One action: CONTINUE, back to the map.
//
// Content comes from lib/challengeScreen.js challengeResult(); this component
// only lays it out and announces it.
//
// Dominia-Temp mode (plan 2026-11-28 U7) passes `moment` instead: VICTORY in
// lime or DEFEAT in red over the dimmed challenge screen, the glowing or
// cracked territory tile, a headline and the owner line with the names in
// bold. Tapping anywhere continues. Content comes from lib/challengeResult.js
// challengeResultModel().

import React, { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, fonts } from '../lib/theme';
import { emphasisSegments } from '../lib/challengeResult';
import ChallengeTerritoryTile from './ChallengeTerritoryTile';

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
  const { width } = useWindowDimensions();
  const fade = useRef(new Animated.Value(0)).current;

  const word = tr(t, moment.word);
  const title = tr(t, moment.title);
  const body = tr(t, moment.body);
  const continueLabel = tr(t, moment.continue);
  const accent = MOMENT_COLORS[moment.color] ?? BONE;
  const segments = emphasisSegments(body, moment.emphasis);
  const tileSize = Math.min(220, Math.round(width * 0.52));

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility?.(`${word}. ${title}. ${body}`);
  }, [word, title, body]);

  useEffect(() => {
    Animated.timing(fade, {
      toValue: 1,
      duration: 280,
      easing: Easing.bezier(0.2, 0, 0, 1),
      useNativeDriver: true,
    }).start();
  }, [fade]);

  // The whole dimmed screen is the CONTINUE target (the board has no button).
  return (
    <Animated.View style={[styles.momentScrim, { opacity: fade }]} accessibilityViewIsModal>
      <Pressable
        onPress={onContinue}
        accessibilityRole="button"
        accessibilityLabel={`${word}. ${title}. ${body}`}
        accessibilityHint={continueLabel}
        style={[styles.momentPress, { paddingTop: topInset + 24, paddingBottom: bottomInset + 24 }]}
      >
        <View style={styles.momentCenter}>
          <Text style={[styles.momentWord, { color: accent }]} maxFontSizeMultiplier={1.1}>{word}</Text>
          <ChallengeTerritoryTile
            size={tileSize}
            variant={moment.variant === 'victory' ? 'victory' : 'defeat'}
            style={styles.momentTile}
          />
          <Text style={styles.momentTitle}>{title}</Text>
          <Text style={styles.momentBody}>
            {segments.map((s, i) => (
              <Text key={i} style={s.bold ? styles.momentBold : null}>{s.text}</Text>
            ))}
          </Text>
        </View>
        <Text style={styles.momentContinue}>{continueLabel}</Text>
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

  // Dominia-Temp result overlay (plan 2026-11-28 U7): VICTORY / DEFEAT over
  // the dimmed challenge screen.
  momentScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  momentPress: { flex: 1, paddingHorizontal: 24, justifyContent: 'center' },
  momentCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // Ceremony moment: the display face at its largest.
  momentWord: {
    fontFamily: fonts.display,
    fontSize: 44,
    lineHeight: 50,
    letterSpacing: -0.5,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  momentTile: { marginTop: 8, marginBottom: 12 },
  momentTitle: { fontFamily: fonts.body, color: BONE, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  momentBody: { fontFamily: fonts.body, color: BONE, fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 10 },
  momentBold: { fontFamily: fonts.mono },
  momentContinue: {
    fontFamily: fonts.mono,
    color: colors.muted2,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
});
