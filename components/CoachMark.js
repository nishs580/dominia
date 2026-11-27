// Component: CoachMark — the map's one-shot coach marks (Updated UX B1–B3,
// plan U8), Figma mode only. State lives in lib/coachMarks.js; MapScreen
// decides when they run and persists them.
//
//   sidePanel     B1: dims the map; the side rail (lifted above the scrim by
//                 MapSideRail `coach`) is framed in lime with labels. A card
//                 at the bottom: THE SIDE PANEL / body / TAP TO CONTINUE.
//                 A tap anywhere continues.
//   tapTerritory  B2: no scrim (the map stays tappable); a card at the bottom:
//                 YOUR FIRST TERRITORY / "Let's capture your first territory.
//                 Tap the highlighted territory to see its details."
//   card          B3: CoachBubble, rendered by TerritoryCard just above it.
//
// Every card carries SKIP, which ends the coach marks for good.
// Surface: Ink 2 card, 2px signal-lime top edge, 0 radius; lime mono kicker.

import React, { useEffect } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, fonts } from '../lib/theme';

function SkipButton({ onSkip }) {
  const { t } = useTranslation();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('map.coach.skipA11y', { defaultValue: 'Skip the map guide' })}
      onPress={onSkip}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
    >
      <Text style={styles.skip}>{t('map.coach.skip', { defaultValue: 'SKIP' })}</Text>
    </Pressable>
  );
}

export default function CoachMark({ step, onContinue, onSkip }) {
  const { t } = useTranslation();

  const copy = step === 'sidePanel'
    ? {
      kicker: t('map.coach.sidePanelTitle', { defaultValue: 'THE SIDE PANEL' }),
      body: t('map.coach.sidePanelBody', {
        defaultValue: 'Use the side panel to explore territories, find your location, check the leaderboard, view your challenge history, and chat with your alliance members.',
      }),
    }
    : step === 'tapTerritory'
      ? {
        kicker: t('map.coach.firstTerritoryTitle', { defaultValue: 'YOUR FIRST TERRITORY' }),
        body: t('map.coach.firstTerritoryBody', {
          defaultValue: "Let's capture your first territory. Tap the highlighted territory to see its details.",
        }),
      }
      : null;

  useEffect(() => {
    if (copy) AccessibilityInfo.announceForAccessibility?.(`${copy.kicker}. ${copy.body}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  if (!copy) return null;

  const card = (
    <View style={styles.card} accessibilityLiveRegion="polite">
      <View style={styles.cardHeader}>
        <Text style={styles.kicker} maxFontSizeMultiplier={1.3}>{copy.kicker}</Text>
        <SkipButton onSkip={onSkip} />
      </View>
      <Text style={styles.body} maxFontSizeMultiplier={1.3}>{copy.body}</Text>
      {step === 'sidePanel' ? (
        <Text style={styles.continue} maxFontSizeMultiplier={1.3}>
          {t('map.coach.tapToContinue', { defaultValue: 'TAP TO CONTINUE' })}
        </Text>
      ) : null}
    </View>
  );

  if (step === 'sidePanel') {
    return (
      <Pressable
        style={styles.scrim}
        onPress={onContinue}
        accessibilityRole="button"
        accessibilityLabel={t('map.coach.tapToContinue', { defaultValue: 'TAP TO CONTINUE' })}
      >
        {card}
      </Pressable>
    );
  }

  return (
    <View style={styles.passThrough} pointerEvents="box-none">
      {card}
    </View>
  );
}

// B3: the bubble above the territory card. Tapping it ends the coach marks.
export function CoachBubble({ onPress }) {
  const { t } = useTranslation();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={styles.bubble}
      accessibilityLiveRegion="polite"
    >
      <Text style={styles.bubbleText} maxFontSizeMultiplier={1.3}>
        {t('map.coach.cardBubble', {
          defaultValue: 'Tap Start claiming to begin the challenge, or close this to explore the app and other territories.',
        })}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 16,
    zIndex: 70,
    elevation: 70,
  },
  passThrough: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 16,
    zIndex: 70,
    elevation: 70,
  },
  card: {
    backgroundColor: colors.ink2,
    borderTopWidth: 2,
    borderTopColor: colors.lime,
    borderRadius: 0,
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  kicker: {
    fontFamily: fonts.monoMedium,
    fontSize: 11,
    letterSpacing: 1.76,
    textTransform: 'uppercase',
    color: colors.lime,
  },
  skip: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.slate2,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 21,
    color: colors.bone,
  },
  continue: {
    fontFamily: fonts.monoMedium,
    fontSize: 13,
    letterSpacing: 1.4,
    color: colors.lime,
  },
  bubble: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: '100%',
    marginBottom: 12,
    backgroundColor: colors.ink2,
    borderTopWidth: 2,
    borderTopColor: colors.lime,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  bubbleText: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
    color: colors.bone,
  },
});
