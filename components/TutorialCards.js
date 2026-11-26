// The five tutorial cards on the map (plan U10), each with SKIP and NEXT →.
// Card order and walkthrough names live in lib/onboardingFlow TUTORIAL_CARDS.
// Rendered by OnboardingTutorialLifecycle inside its Modal.

import React, { useEffect } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { TUTORIAL_CARDS } from '../lib/onboardingFlow';
import { colors, fonts } from '../lib/theme';

// English defaults; locales carry the translations under tutorialCards.*.
const COPY = {
  territories: {
    title: 'WHAT ARE TERRITORIES?',
    body: 'Territories are areas that players can claim by walking around their perimeter, from anywhere in the world.',
  },
  howToStart: {
    title: 'HOW TO START?',
    body:
      'Click on a territory on the map to view its challenge details, including the steps required and time limit. Start the challenge with gold or iron and complete the challenge to claim the territory.',
  },
  claiming: {
    title: 'CLAIMING TERRITORY',
    body:
      'Walk the required number of steps within the given time limit to claim the territory as your own. If you fail to do so, the territory will remain unclaimed.',
  },
  attackDefend: {
    title: 'ATTACK OR DEFEND',
    body:
      "You can attack other player's territories and make it as your own using Gold and also defend your territory from others attack by bypassing them in the challenge",
  },
  endGoal: {
    title: 'END GOAL',
    body: 'Claim the most territories before the season ends to top the leaderboard and earn gold.',
  },
};

export function tutorialCardCopy(t, id) {
  return {
    title: t(`tutorialCards.${id}.title`, { defaultValue: COPY[id].title }),
    body: t(`tutorialCards.${id}.body`, { defaultValue: COPY[id].body }),
  };
}

export default function TutorialCards({ index, onNext, onSkip }) {
  const { t } = useTranslation();
  const card = TUTORIAL_CARDS[index] ?? TUTORIAL_CARDS[0];
  const { title, body } = tutorialCardCopy(t, card.id);
  const position = `${index + 1}/${TUTORIAL_CARDS.length}`;

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility?.(`${title}. ${body}`);
  }, [title, body]);

  return (
    <View style={styles.scrim}>
      <View style={styles.card} accessibilityViewIsModal>
        <Text style={styles.position}>{position}</Text>
        <Text style={styles.title} accessibilityRole="header" maxFontSizeMultiplier={1.3}>
          {title}
        </Text>
        <Text style={styles.body}>{body}</Text>
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" onPress={onSkip} style={styles.skip} hitSlop={8}>
            <Text style={styles.skipText}>{t('tutorialCards.skip', { defaultValue: 'SKIP' })}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={onNext}
            style={({ pressed }) => [styles.next, pressed && styles.pressed]}
          >
            <Text style={styles.nextText}>{t('tutorialCards.next', { defaultValue: 'NEXT →' })}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(16,16,16,0.6)',
    justifyContent: 'flex-end',
    padding: 16,
    paddingBottom: 96,
  },
  card: {
    backgroundColor: colors.ink2,
    borderTopWidth: 3,
    borderTopColor: colors.lime,
    padding: 24,
  },
  position: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.6, color: colors.lime, marginBottom: 8 },
  title: {
    fontFamily: fonts.display,
    fontSize: 32,
    lineHeight: 34,
    color: colors.bone,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: colors.slate2 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
  skip: { minHeight: 48, justifyContent: 'center', paddingRight: 16 },
  skipText: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.6, color: colors.slate2, textTransform: 'uppercase' },
  next: {
    backgroundColor: colors.claimButton,
    minHeight: 48,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextText: { fontFamily: fonts.monoMedium, fontSize: 13, letterSpacing: 1.8, color: colors.bone, textTransform: 'uppercase' },
  pressed: { opacity: 0.9 },
});
