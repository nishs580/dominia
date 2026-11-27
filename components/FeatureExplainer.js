// Feature explainer (Dominia-Temp board 17, "MISSIONS TYPE"): a once-per-player
// bottom sheet over the dimmed screen. Blue-to-black sheet, centred Archivo
// title, centred body, optional detail rows and footer, then SKIP beside a
// slanted blue NEXT ». Used for "Missions type" on Missions and the alliance
// explainers.
//
// Usage:
//   <FeatureExplainer
//     userId={userId}
//     name="explainer:missionsType"            // walkthroughFlags name
//     pages={[{
//       title: 'MISSIONS TYPE',
//       body: '...',
//       icon: <AllianceGlyph />,               // optional, top-left
//       rows: [{ icon, title: 'MARCH', body: '...' }],   // optional
//       footer: '...',                         // optional
//     }]}
//     reopen={infoTapCount}                    // bump to show it again
//     placement="bottom"                       // default; 'center' floats a card
//   />
//
// Buttons: the primary reads NEXT » on every page but the last, which reads
// GOT IT. Multi-page explainers add SKIP and a "01 / 02" counter; a one-page
// explainer is GOT IT alone. It shows on first mount for a player who has not
// seen it. SKIP, GOT IT or the back gesture closes it and marks it fired
// (lib/walkthroughFlags.js).

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { SlantButton } from './ui';
import { hasFired, markFired } from '../lib/walkthroughFlags';
import { colors, fonts } from '../lib/theme';

function pad2(n) {
  return String(n).padStart(2, '0');
}

function SheetBackground() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id="explainerSheet" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.actionDeep} stopOpacity="0.95" />
            <Stop offset="0.55" stopColor={colors.obsidian} stopOpacity="1" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#explainerSheet)" />
      </Svg>
    </View>
  );
}

export default function FeatureExplainer({ userId, name, pages, reopen = 0, onClose, placement = 'bottom' }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);
  const [index, setIndex] = useState(0);
  const firstReopen = useRef(reopen);

  // First visit: show once per player.
  useEffect(() => {
    if (!userId || !name) return undefined;
    let cancelled = false;
    hasFired(userId, name).then((fired) => {
      if (!cancelled && !fired) {
        setIndex(0);
        setVisible(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [userId, name]);

  // Manual reopen (e.g. the (i) button).
  useEffect(() => {
    if (reopen === firstReopen.current) return;
    setIndex(0);
    setVisible(true);
  }, [reopen]);

  const page = pages?.[index] ?? null;
  const total = pages?.length ?? 0;
  const multi = total > 1;
  const isLast = index >= total - 1;
  const bottom = placement !== 'center';

  useEffect(() => {
    if (visible && page) {
      const rows = (page.rows ?? []).map((r) => `${r.title}. ${r.body}`).join(' ');
      const parts = [page.title, page.body, rows, page.footer].filter(Boolean);
      AccessibilityInfo.announceForAccessibility?.(parts.join('. '));
    }
  }, [visible, page]);

  const close = useCallback(() => {
    setVisible(false);
    if (userId && name) markFired(userId, name);
    onClose?.();
  }, [userId, name, onClose]);

  const next = useCallback(() => {
    if (index < total - 1) setIndex(index + 1);
    else close();
  }, [index, total, close]);

  if (!page) return null;

  const primaryLabel = isLast
    ? t('explainer.gotIt', { defaultValue: 'GOT IT' })
    : t('explainer.next', { defaultValue: 'NEXT' });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
      <View style={[styles.scrim, bottom ? styles.scrimBottom : styles.scrimCenter]}>
        <View
          style={[styles.sheet, bottom ? { paddingBottom: Math.max(insets.bottom, 16) + 8 } : styles.card]}
          accessibilityViewIsModal
        >
          <SheetBackground />
          {page.icon || multi ? (
            <View style={styles.headRow}>
              <View>{page.icon ?? null}</View>
              {multi ? (
                <Text
                  style={styles.pager}
                  maxFontSizeMultiplier={1.3}
                  accessibilityLabel={t('explainer.pagerA11y', {
                    defaultValue: 'Page {{n}} of {{total}}',
                    n: index + 1,
                    total,
                  })}
                >
                  {t('explainer.pager', { defaultValue: '{{n}} / {{total}}', n: pad2(index + 1), total: pad2(total) })}
                </Text>
              ) : null}
            </View>
          ) : null}
          <Text style={styles.title} accessibilityRole="header" maxFontSizeMultiplier={1.3}>
            {page.title}
          </Text>
          {page.body ? <Text style={styles.body} maxFontSizeMultiplier={1.5}>{page.body}</Text> : null}
          {page.rows?.length ? (
            <View style={styles.rows}>
              {page.rows.map((row, i) => (
                <View key={`${row.title}-${i}`} style={styles.row} accessible accessibilityLabel={`${row.title}. ${row.body}`}>
                  <View style={styles.rowIcon}>{row.icon ?? null}</View>
                  <View style={styles.rowText}>
                    <Text style={styles.rowTitle} maxFontSizeMultiplier={1.3}>{row.title}</Text>
                    <Text style={styles.rowBody} maxFontSizeMultiplier={1.5}>{row.body}</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : null}
          {page.footer ? <Text style={styles.footer} maxFontSizeMultiplier={1.5}>{page.footer}</Text> : null}
          <View style={styles.actions}>
            {multi ? (
              <Pressable
                onPress={close}
                accessibilityRole="button"
                accessibilityLabel={t('explainer.skipA11y', { defaultValue: 'Skip explanation' })}
                hitSlop={8}
                style={({ pressed }) => [styles.skip, pressed && styles.skipPressed]}
              >
                <Text style={styles.skipText} maxFontSizeMultiplier={1.3}>
                  {t('explainer.skip', { defaultValue: 'SKIP' })}
                </Text>
              </Pressable>
            ) : null}
            <SlantButton
              label={primaryLabel}
              onPress={next}
              variant="primary"
              size="lg"
              trailingChevron={!isLast}
              accessibilityLabel={isLast
                ? t('explainer.gotItA11y', { defaultValue: 'Got it, close explanation' })
                : t('explainer.nextA11y', { defaultValue: 'Next' })}
              style={styles.primary}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)', // the screen stays visible, dimmed
  },
  scrimCenter: { justifyContent: 'center', padding: 24 },
  scrimBottom: { justifyContent: 'flex-end' },
  sheet: {
    overflow: 'hidden',
    paddingHorizontal: 24,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceLine,
  },
  card: {
    paddingBottom: 24,
    borderWidth: 1,
    borderColor: colors.surfaceLine,
  },
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    minHeight: 24,
  },
  pager: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.6,
    color: colors.muted2,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 26,
    lineHeight: 32,
    color: colors.white,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  body: {
    marginTop: 10,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.muted2,
    textAlign: 'center',
  },
  rows: { marginTop: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surfaceLine,
  },
  rowIcon: { width: 32 },
  rowText: { flex: 1 },
  rowTitle: {
    fontFamily: fonts.action,
    fontSize: 15,
    letterSpacing: 0.75,
    textTransform: 'uppercase',
    color: colors.white,
  },
  rowBody: {
    marginTop: 2,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
    color: colors.muted2,
  },
  footer: {
    marginTop: 12,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
    color: colors.muted2,
    textAlign: 'center',
  },
  actions: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  skip: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipPressed: { opacity: 0.6 },
  skipText: {
    fontFamily: fonts.action,
    fontSize: 19,
    letterSpacing: 0.95,
    textTransform: 'uppercase',
    color: colors.muted2,
  },
  primary: { flex: 2 },
});
