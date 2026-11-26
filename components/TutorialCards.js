// The five tutorial cards on the map (Updated UX A9–A13): a lime icon and a
// grey "01 / 05" counter, the title and body, five progress dashes, then
// SKIP + NEXT on cards 1–4 and BACK + START PLAYING on the last card.
// Card order and walkthrough names live in lib/onboardingFlow TUTORIAL_CARDS.
// Rendered by OnboardingTutorialLifecycle inside its Modal.

import React, { useEffect } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { TUTORIAL_CARDS } from '../lib/onboardingFlow';
import { colors, fonts } from '../lib/theme';

// English defaults (Updated UX copy); locales carry the translations under
// tutorialCards.*.
const COPY = {
  territories: {
    title: 'WHAT ARE TERRITORIES?',
    body: 'Territories are areas that players can claim by walking around their perimeter, from anywhere in the world.',
  },
  howToStart: {
    title: 'HOW TO START?',
    body:
      'Tap a territory on the map to see its challenge: the steps required and the time limit. Start with Gold, finish the challenge, and it’s yours.',
  },
  claiming: {
    title: 'CLAIMING TERRITORY',
    body:
      'Walk the required steps within the time limit to claim the territory. If you don’t make it, the territory stays unclaimed.',
  },
  attackDefend: {
    title: 'ATTACK OR DEFEND',
    body:
      'Attack other players’ territories with Gold to make them yours, and defend your own by out-walking anyone who attacks.',
  },
  endGoal: {
    title: 'END GOAL',
    body: 'Claim the most territories before the season ends to top the leaderboard and earn Gold.',
  },
};

export function tutorialCardCopy(t, id) {
  return {
    title: t(`tutorialCards.${id}.title`, { defaultValue: COPY[id].title }),
    body: t(`tutorialCards.${id}.body`, { defaultValue: COPY[id].body }),
  };
}

// Line icons in Signal Lime, one per card: pin, target, flag, sword, trophy.
function CardIcon({ id, size = 24 }) {
  const stroke = { stroke: colors.lime, strokeWidth: 2, fill: 'none', strokeLinecap: 'square', strokeLinejoin: 'miter' };
  let shape;
  switch (id) {
    case 'territories':
      shape = (
        <>
          <Path d="M12 21s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12z" {...stroke} />
          <Circle cx="12" cy="9" r="2.5" {...stroke} />
        </>
      );
      break;
    case 'howToStart':
      shape = (
        <>
          <Circle cx="12" cy="12" r="9" {...stroke} />
          <Circle cx="12" cy="12" r="4.5" {...stroke} />
        </>
      );
      break;
    case 'claiming':
      shape = <Path d="M6 21V3h12l-3 4.5 3 4.5H6" {...stroke} />;
      break;
    case 'attackDefend':
      shape = (
        <>
          <Path d="M20 4l-9.5 9.5M20 4h-4M20 4v4" {...stroke} />
          <Path d="M8 12l4 4M5 19l3.5-3.5M4 20l1-1" {...stroke} />
        </>
      );
      break;
    case 'endGoal':
    default:
      shape = (
        <>
          <Path d="M7 4h10v5a5 5 0 0 1-10 0V4z" {...stroke} />
          <Path d="M7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3M12 14v4M8 20h8" {...stroke} />
        </>
      );
      break;
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no">
      {shape}
    </Svg>
  );
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

export default function TutorialCards({ index, onNext, onSkip, onBack }) {
  const { t } = useTranslation();
  const safeIndex = TUTORIAL_CARDS[index] ? index : 0;
  const card = TUTORIAL_CARDS[safeIndex];
  const { title, body } = tutorialCardCopy(t, card.id);
  const total = TUTORIAL_CARDS.length;
  const isLast = safeIndex === total - 1;
  const counter = `${pad2(safeIndex + 1)} / ${pad2(total)}`;

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility?.(`${title}. ${body}`);
  }, [title, body]);

  return (
    <View style={styles.scrim}>
      <View style={styles.card} accessibilityViewIsModal>
        <View style={styles.headRow}>
          <CardIcon id={card.id} />
          <Text style={styles.counter} accessibilityLabel={`${safeIndex + 1} / ${total}`}>
            {counter}
          </Text>
        </View>
        <Text style={styles.title} accessibilityRole="header" maxFontSizeMultiplier={1.3}>
          {title}
        </Text>
        <Text style={styles.body}>{body}</Text>

        <View style={styles.dashes} importantForAccessibility="no-hide-descendants">
          {TUTORIAL_CARDS.map((c, i) => (
            <View key={c.id} style={[styles.dash, i === safeIndex && styles.dashActive]} />
          ))}
        </View>

        <View style={styles.actions}>
          {isLast ? (
            <Pressable accessibilityRole="button" onPress={onBack} style={styles.ghost} hitSlop={8}>
              <Text style={styles.ghostText}>{t('tutorialCards.back', { defaultValue: 'BACK' })}</Text>
            </Pressable>
          ) : (
            <Pressable accessibilityRole="button" onPress={onSkip} style={styles.ghost} hitSlop={8}>
              <Text style={styles.ghostText}>{t('tutorialCards.skip', { defaultValue: 'SKIP' })}</Text>
            </Pressable>
          )}
          <Pressable
            accessibilityRole="button"
            onPress={onNext}
            style={({ pressed }) => [styles.next, pressed && styles.pressed]}
          >
            <Text style={styles.nextText}>
              {isLast
                ? t('tutorialCards.startPlaying', { defaultValue: 'START PLAYING' })
                : t('tutorialCards.next', { defaultValue: 'NEXT' })}
            </Text>
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
    backgroundColor: colors.surface,
    borderTopWidth: 3,
    borderTopColor: colors.lime,
    padding: 24,
  },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  counter: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.6, color: colors.muted },
  title: {
    fontFamily: fonts.display,
    fontSize: 34,
    lineHeight: 36,
    color: colors.white,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: colors.muted2 },
  dashes: { flexDirection: 'row', gap: 6, marginTop: 16 },
  dash: { width: 8, height: 3, backgroundColor: colors.raised },
  dashActive: { width: 22, backgroundColor: colors.lime },
  actions: { flexDirection: 'row', alignItems: 'center', marginTop: 16, gap: 12 },
  ghost: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 24 },
  ghostText: { fontFamily: fonts.monoMedium, fontSize: 13, letterSpacing: 1.8, color: colors.white2, textTransform: 'uppercase' },
  next: {
    flex: 1,
    backgroundColor: colors.action,
    minHeight: 48,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextText: { fontFamily: fonts.monoMedium, fontSize: 13, letterSpacing: 1.8, color: colors.white, textTransform: 'uppercase' },
  pressed: { backgroundColor: colors.actionPressed },
});
