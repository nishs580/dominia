// The two welcome frames over the map (Dominia-Temp boards), rendered by
// OnboardingTutorialLifecycle inside its Modal:
//
//   FtueWelcome    — "WELCOME, <NAME> · FTUE 1 OF 4" / "WALK IT TO OWN IT." with
//                    the city body copy, progress dashes top-left, a lime SKIP
//                    top-right and LET'S GO » at the bottom, over a fade to black.
//   WelcomeOverlay — the white slanted "WELCOME TO DOMINIA" card with "Let us
//                    start understanding how the game works" and a lime "TAP
//                    ON THE SCREEN TO CONTINUE"; tapping anywhere continues to
//                    the core-loop cards.

import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Polygon, Rect, Stop } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { SlantButton } from './ui';
import { colors, fonts } from '../lib/theme';

const FTUE_STEPS = 4;

function ProgressDashes({ active = 0, total = FTUE_STEPS }) {
  return (
    <View style={styles.dashes} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={[styles.dash, i === active && styles.dashActive]} />
      ))}
    </View>
  );
}

// Map stays visible at the top and fades to black behind the copy.
function BottomFade() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id="ftueFade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#000000" stopOpacity="0.15" />
            <Stop offset="0.45" stopColor="#000000" stopOpacity="0.55" />
            <Stop offset="0.68" stopColor="#000000" stopOpacity="1" />
            <Stop offset="1" stopColor="#000000" stopOpacity="1" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#ftueFade)" />
      </Svg>
    </View>
  );
}

export function FtueWelcome({ name, city, onGo, onSkip }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const who = name || t('ftue.nameFallback', { defaultValue: 'Commander' });
  const where = city || t('ftue.cityFallback', { defaultValue: 'your city' });
  const eyebrow = t('ftue.eyebrow', { name: who, defaultValue: 'Welcome, {{name}} · FTUE 1 of 4' });
  const title = t('ftue.title', { defaultValue: 'Walk it\nto own it.' });
  const body = t('ftue.body', {
    city: where,
    defaultValue:
      'Every block of {{city}} is territory. Walk its distance within the time window and the block is yours — until someone walks it back.',
  });

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility?.(`${title.replace('\n', ' ')}. ${body}`);
  }, [title, body]);

  return (
    <View style={styles.fill} accessibilityViewIsModal>
      <BottomFade />
      <View style={[styles.topRow, { paddingTop: insets.top + 16 }]}>
        <ProgressDashes active={0} />
        <Pressable accessibilityRole="button" onPress={onSkip} hitSlop={12} style={styles.skipTop}>
          <Text style={styles.skipTopText} maxFontSizeMultiplier={1.3}>
            {t('ftue.skip', { defaultValue: 'Skip' })}
          </Text>
        </Pressable>
      </View>

      <View style={[styles.ftueBottom, { paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.eyebrowRow}>
          <View style={styles.eyebrowBar} />
          <Text style={styles.eyebrow} numberOfLines={1} maxFontSizeMultiplier={1.3}>
            {eyebrow}
          </Text>
        </View>
        <Text style={styles.ftueTitle} accessibilityRole="header" maxFontSizeMultiplier={1.2}>
          {title}
        </Text>
        <Text style={styles.ftueBody} maxFontSizeMultiplier={1.4}>
          {body}
        </Text>
        <SlantButton label={t('ftue.letsGo', { defaultValue: 'Let’s go' })} onPress={onGo} style={styles.go} />
      </View>
    </View>
  );
}

// White parallelogram behind the WELCOME TO DOMINIA card.
function SlantedCard({ children }) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const slant = 14;
  return (
    <View
      style={styles.card}
      onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      {box.w > 0 ? (
        <Svg width={box.w} height={box.h} style={StyleSheet.absoluteFill}>
          <Polygon points={`${slant},0 ${box.w},0 ${box.w - slant},${box.h} 0,${box.h}`} fill={colors.white} />
        </Svg>
      ) : null}
      {children}
    </View>
  );
}

export default function WelcomeOverlay({ onContinue }) {
  const { t } = useTranslation();
  const title = t('welcomeOverlay.title', { defaultValue: 'WELCOME TO DOMINIA' });
  const lead = t('welcomeOverlay.lead', { defaultValue: 'Let us start understanding how the game works' });
  const hint = t('welcomeOverlay.tapToContinue', { defaultValue: 'Tap on the screen to continue' });

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility?.(`${title}. ${lead}`);
  }, [title, lead]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${lead}. ${hint}`}
      onPress={onContinue}
      style={styles.scrim}
    >
      <SlantedCard>
        <Text style={styles.cardTitle} maxFontSizeMultiplier={1.2}>
          {title}
        </Text>
        <Text style={styles.cardLead} maxFontSizeMultiplier={1.4}>
          {lead}
        </Text>
      </SlantedCard>
      <Text style={styles.tapHint} maxFontSizeMultiplier={1.3}>
        {hint}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: 'space-between' },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 },
  dashes: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dash: { width: 6, height: 3, backgroundColor: colors.muted2, transform: [{ skewX: '-20deg' }] },
  dashActive: { width: 20, backgroundColor: colors.action },
  skipTop: { minHeight: 44, minWidth: 44, alignItems: 'flex-end', justifyContent: 'center' },
  skipTopText: {
    fontFamily: fonts.action,
    fontSize: 14,
    letterSpacing: 0.6,
    color: colors.lime,
    textTransform: 'uppercase',
  },
  ftueBottom: { paddingHorizontal: 20 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  eyebrowBar: { width: 14, height: 3, backgroundColor: colors.action },
  eyebrow: {
    flexShrink: 1,
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.54,
    color: colors.muted2,
    textTransform: 'uppercase',
  },
  ftueTitle: {
    fontFamily: fonts.display,
    fontSize: 36,
    lineHeight: 40,
    color: colors.white,
    textTransform: 'uppercase',
  },
  ftueBody: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.muted2, marginTop: 16, maxWidth: 300 },
  go: { marginTop: 24 },

  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  card: { paddingHorizontal: 28, paddingVertical: 16 },
  cardTitle: {
    fontFamily: fonts.display,
    fontSize: 22,
    lineHeight: 26,
    color: colors.obsidian,
    textTransform: 'uppercase',
  },
  cardLead: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16, color: colors.obsidian, marginTop: 4 },
  tapHint: {
    fontFamily: fonts.action,
    fontSize: 15,
    letterSpacing: 0.6,
    color: colors.lime,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginTop: 120,
  },
});
