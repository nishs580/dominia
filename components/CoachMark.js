// Component: CoachMark — the map's one-shot coach marks (Updated UX B1–B3,
// plan U8), Figma mode only. State lives in lib/coachMarks.js; MapScreen
// decides when they run and persists them.
//
// Dominia-Temp (plan U5, Figma Main screen explanation): a white rectangular
// bubble with black text and a small pointer, progress dashes bottom-left and
// a lime "TAP TO CONTINUE »" bottom-right.
//
//   sidePanel     B1: dims the map; the side rail (lifted above the scrim by
//                 MapSideRail `coach`) is framed and each tile labelled with a
//                 white slanted chip. The bubble sits below the rail, its
//                 pointer up at it. A tap anywhere continues.
//   tapTerritory  B2: no scrim (the map stays tappable — tapping the
//                 highlighted territory is how this step advances); the
//                 bubble and progress dashes only.
//   card          B3: CoachBubble, rendered by TerritoryCard just above it,
//                 pointer down at the card.
//
// SKIP (bottom-left, after the dashes) ends the coach marks for good.

import React, { useEffect } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, fonts } from '../lib/theme';

const STEP_ORDER = ['sidePanel', 'tapTerritory', 'card'];
const BUBBLE_BG = colors.white;
const POINTER = 8;

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

function ProgressDashes({ step }) {
  const index = STEP_ORDER.indexOf(step);
  return (
    <View style={styles.dashes} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {STEP_ORDER.map((s, i) => (
        <View key={s} style={[styles.dash, i === index && styles.dashActive]} />
      ))}
    </View>
  );
}

// White bubble with a pointer: 'up' sits on top (pointing at what is above),
// 'down' below. `align` places the pointer along the edge.
function Bubble({ children, pointer = 'up', align = 'right', style }) {
  const tip = (
    <View
      style={[
        styles.pointer,
        align === 'right' ? styles.pointerRight : align === 'left' ? styles.pointerLeft : styles.pointerCenter,
      ]}
    />
  );
  return (
    <View style={style}>
      {pointer === 'up' ? tip : null}
      <View style={styles.bubble}>{children}</View>
      {pointer === 'down' ? tip : null}
    </View>
  );
}

export default function CoachMark({ step, onContinue, onSkip }) {
  const { t } = useTranslation();

  const body = step === 'sidePanel'
    ? t('map.coach.sidePanelBody', {
      defaultValue: 'Use the side panel to explore territories, find your location, check the leaderboard, view your challenge history, and chat with your alliance members.',
    })
    : step === 'tapTerritory'
      ? t('map.coach.firstTerritoryBodyTemp', {
        defaultValue: "Let's capture your first territory. Tap on the territory to see its details.",
      })
      : null;

  useEffect(() => {
    if (body) AccessibilityInfo.announceForAccessibility?.(body);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  if (!body) return null;

  const footer = (
    <View style={styles.footer} pointerEvents="box-none">
      <View style={styles.footerLeft}>
        <ProgressDashes step={step} />
        <SkipButton onSkip={onSkip} />
      </View>
      {step === 'sidePanel' ? (
        <Text style={styles.continue} maxFontSizeMultiplier={1.3}>
          {t('map.coach.tapToContinueTemp', { defaultValue: 'TAP TO CONTINUE »' })}
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
        <Bubble pointer="up" align="right" style={styles.sidePanelBubble}>
          <Text style={styles.bubbleText} maxFontSizeMultiplier={1.3} accessibilityLiveRegion="polite">
            {body}
          </Text>
        </Bubble>
        {footer}
      </Pressable>
    );
  }

  return (
    <View style={styles.passThrough} pointerEvents="box-none">
      <Bubble pointer="up" align="center" style={styles.territoryBubble}>
        <Text style={styles.bubbleText} maxFontSizeMultiplier={1.3} accessibilityLiveRegion="polite">
          {body}
        </Text>
      </Bubble>
      {footer}
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
      style={styles.cardBubbleWrap}
      accessibilityLiveRegion="polite"
    >
      <Bubble pointer="down" align="center">
        <Text style={styles.bubbleText} maxFontSizeMultiplier={1.3}>
          {t('map.coach.cardBubble', {
            defaultValue: 'Tap Start claiming to begin the challenge, or close this to explore the app and other territories.',
          })}
        </Text>
      </Bubble>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.72)',
    zIndex: 70,
    elevation: 70,
  },
  passThrough: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 70,
    elevation: 70,
  },
  // Below the rail (MapSideRail figma: top 124, five 40pt tiles + gaps).
  sidePanelBubble: {
    position: 'absolute',
    top: 372,
    left: 16,
    right: 72,
  },
  territoryBubble: {
    position: 'absolute',
    left: 32,
    right: 32,
    bottom: 96,
  },
  bubble: {
    backgroundColor: BUBBLE_BG,
    borderRadius: 0,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  bubbleText: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
    color: colors.obsidian,
  },
  pointer: {
    width: POINTER * 2,
    height: POINTER,
    backgroundColor: BUBBLE_BG,
  },
  pointerRight: { alignSelf: 'flex-end', marginRight: 16 },
  pointerLeft: { alignSelf: 'flex-start', marginLeft: 16 },
  pointerCenter: { alignSelf: 'center' },
  footer: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  dashes: {
    flexDirection: 'row',
    gap: 4,
  },
  dash: {
    width: 8,
    height: 3,
    backgroundColor: colors.muted,
    transform: [{ skewX: '-20deg' }],
  },
  dashActive: {
    width: 22,
    backgroundColor: colors.action,
  },
  skip: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.muted2,
  },
  continue: {
    fontFamily: fonts.action,
    fontSize: 13,
    letterSpacing: 0.8,
    color: colors.lime,
  },
  cardBubbleWrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: '100%',
    marginBottom: 12,
  },
});
