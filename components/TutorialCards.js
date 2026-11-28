// The five core-loop cards over the map (Dominia-Temp core-loop boards): a
// bottom sheet with a dark-blue gradient, a lime display title, the body, and
// SKIP (muted) + NEXT » on every card. SKIP or NEXT on the last card ends the
// deck. Card order and walkthrough names live in lib/onboardingFlow
// TUTORIAL_CARDS. Rendered by OnboardingTutorialLifecycle inside its Modal.

import React, { useEffect } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { SlantButton } from './ui';
import { TUTORIAL_CARDS } from '../lib/onboardingFlow';
import { colors, fonts } from '../lib/theme';

// English defaults (board copy). Titles and the territories body keep their
// existing keys; bodies whose copy changed use `<id>.text`.
const COPY = {
  territories: {
    title: 'WHAT ARE TERRITORIES?',
    bodyKey: 'body',
    body: 'Territories are areas that players can claim by walking around their perimeter, from anywhere in the world.',
  },
  howToStart: {
    title: 'HOW TO START?',
    bodyKey: 'text',
    body:
      'Click on a territory on the map to view its challenge details, including the steps required and time limit. Start the challenge with gold or iron and complete the challenge to claim the territory.',
  },
  claiming: {
    title: 'CLAIMING TERRITORY',
    bodyKey: 'text',
    body:
      'Walk the required number of steps within the given time limit to claim the territory as your own. If you fail to do so, the territory will remain unclaimed.',
  },
  attackDefend: {
    title: 'ATTACK OR DEFEND',
    bodyKey: 'text',
    body:
      'You can attack other player’s territories and make it as your own using Gold and also defend your territory from others attack by bypassing them in the challenge',
  },
  endGoal: {
    title: 'END GOAL',
    bodyKey: 'text',
    body: 'Claim the most territories before the season ends to top the leaderboard and earn gold.',
  },
};

export function tutorialCardCopy(t, id) {
  const c = COPY[id];
  return {
    title: t(`tutorialCards.${id}.title`, { defaultValue: c.title }),
    body: t(`tutorialCards.${id}.${c.bodyKey}`, { defaultValue: c.body }),
  };
}

function PanelBackground() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id="coreLoopPanel" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.actionDeep} stopOpacity="1" />
            <Stop offset="1" stopColor="#01040F" stopOpacity="1" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#coreLoopPanel)" />
      </Svg>
    </View>
  );
}

export default function TutorialCards({ index, onNext, onSkip }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const safeIndex = TUTORIAL_CARDS[index] ? index : 0;
  const card = TUTORIAL_CARDS[safeIndex];
  const { title, body } = tutorialCardCopy(t, card.id);
  const total = TUTORIAL_CARDS.length;

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility?.(`${title}. ${body}`);
  }, [title, body]);

  return (
    <View style={styles.scrim}>
      <View
        style={[styles.panel, { paddingBottom: insets.bottom + 20 }]}
        accessibilityViewIsModal
        accessibilityLabel={`${safeIndex + 1} / ${total}`}
      >
        <PanelBackground />
        <Text style={styles.title} accessibilityRole="header" maxFontSizeMultiplier={1.3}>
          {title}
        </Text>
        <Text style={styles.body} maxFontSizeMultiplier={1.4}>
          {body}
        </Text>

        <View style={styles.actions}>
          <Pressable accessibilityRole="button" onPress={onSkip} style={styles.skip} hitSlop={8}>
            <Text style={styles.skipText} maxFontSizeMultiplier={1.3}>
              {t('tutorialCards.skip', { defaultValue: 'SKIP' })}
            </Text>
          </Pressable>
          <SlantButton label={t('tutorialCards.next', { defaultValue: 'NEXT' })} onPress={onNext} style={styles.next} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.25)', justifyContent: 'flex-end' },
  panel: {
    paddingHorizontal: 20,
    paddingTop: 28,
    borderTopWidth: 1,
    borderTopColor: 'rgba(7,49,209,0.45)',
    overflow: 'hidden',
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 24,
    lineHeight: 28,
    color: colors.lime,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  body: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.muted2, textAlign: 'center', marginTop: 12 },
  actions: { flexDirection: 'row', alignItems: 'center', marginTop: 24, gap: 16 },
  skip: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 16 },
  skipText: {
    fontFamily: fonts.action,
    fontSize: 17,
    letterSpacing: 0.8,
    color: colors.muted2,
    textTransform: 'uppercase',
  },
  next: { flex: 1 },
});
