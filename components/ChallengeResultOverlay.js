// components/ChallengeResultOverlay.js
// VICTORY / DEFEAT over the challenge map once a contest resolves (plan U13,
// contest_result_screen off). One action: CONTINUE, back to the map.
//
// Content comes from lib/challengeScreen.js challengeResult(); this component
// only lays it out and announces it.

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

/**
 * @param {object}   props
 * @param {object}   props.result     challengeResult() output.
 * @param {Function} props.onContinue
 * @param {number}   [props.bottomInset]
 */
export default function ChallengeResultOverlay({ result, onContinue, bottomInset = 0 }) {
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
    backgroundColor: 'rgba(16,16,16,0.72)', // Ink at 72% — the map stays visible beneath
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
  label: { fontFamily: 'SofiaSansExtraCondensed_800ExtraBold', fontSize: 48, letterSpacing: -1.4, textTransform: 'uppercase' },
  title: { fontFamily: 'InstrumentSans_500Medium', color: BONE, fontSize: 15, lineHeight: 21 },
  body: { fontFamily: 'InstrumentSans_400Regular', color: SLATE2, fontSize: 13, lineHeight: 19 },
  continueBtn: {
    backgroundColor: CLAIM_BUTTON,
    borderRadius: 0,
    paddingVertical: 16,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueText: { fontFamily: 'GeistMono_500Medium', color: BONE, fontSize: 12, letterSpacing: 1.6, textTransform: 'uppercase' },
});
