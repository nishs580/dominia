// Feature explainer card (Figma E2, F1, F2): a once-per-player modal card
// with a lime top edge, a display title, body copy, optional detail rows and
// footer, and a blue primary button. Used for "Missions type" on Missions and
// the alliance explainers.
//
// Usage:
//   <FeatureExplainer
//     userId={userId}
//     name="explainer:missionsType"            // walkthroughFlags name
//     pages={[{
//       title: 'MISSIONS TYPE',
//       body: '...',
//       icon: <AllianceGlyph />,               // optional, top-left (F1/F2)
//       rows: [{ icon, title: 'MARCH', body: '...' }],   // optional (E2)
//       footer: '...',                         // optional (E2)
//     }]}
//     reopen={infoTapCount}                    // bump to show it again
//     placement="center"                       // or 'bottom'; default: one page
//                                              // centred, several at the bottom
//   />
//
// Buttons: the primary (blue) reads NEXT on every page but the last, which
// reads GOT IT. Multi-page explainers add a SKIP text button and a "01 / 02"
// counter top-right (F1/F2); a one-page explainer is GOT IT alone (E2).
// It shows on first mount for a player who has not seen it. SKIP, or GOT IT,
// closes it and marks it fired (lib/walkthroughFlags.js).

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { hasFired, markFired } from '../lib/walkthroughFlags';
import { colors, fonts } from '../lib/theme';

function pad2(n) {
  return String(n).padStart(2, '0');
}

export default function FeatureExplainer({ userId, name, pages, reopen = 0, onClose, placement }) {
  const { t } = useTranslation();
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
  const where = placement ?? (multi ? 'bottom' : 'center');

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
      <View style={[styles.scrim, where === 'bottom' ? styles.scrimBottom : styles.scrimCenter]}>
        <View style={styles.card} accessibilityViewIsModal>
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
          {page.body ? <Text style={styles.body}>{page.body}</Text> : null}
          {page.rows?.length ? (
            <View style={styles.rows}>
              {page.rows.map((row, i) => (
                <View key={`${row.title}-${i}`} style={styles.row} accessible accessibilityLabel={`${row.title}. ${row.body}`}>
                  <View style={styles.rowIcon}>{row.icon ?? null}</View>
                  <View style={styles.rowText}>
                    <Text style={styles.rowTitle} maxFontSizeMultiplier={1.3}>{row.title}</Text>
                    <Text style={styles.rowBody}>{row.body}</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : null}
          {page.footer ? <Text style={styles.footer}>{page.footer}</Text> : null}
          <View style={styles.actions}>
            {multi ? (
              <Pressable
                onPress={close}
                accessibilityRole="button"
                accessibilityLabel={t('explainer.skipA11y', { defaultValue: 'Skip explanation' })}
                style={({ pressed }) => [styles.btn, styles.btnSkip, pressed && styles.skipPressed]}
              >
                <Text style={styles.btnText} maxFontSizeMultiplier={1.3}>
                  {t('explainer.skip', { defaultValue: 'SKIP' })}
                </Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={next}
              accessibilityRole="button"
              accessibilityLabel={isLast
                ? t('explainer.gotItA11y', { defaultValue: 'Got it, close explanation' })
                : t('explainer.nextA11y', { defaultValue: 'Next' })}
              style={({ pressed }) => [styles.btn, styles.btnPrimary, multi && styles.btnPrimaryWide, pressed && styles.primaryPressed]}
            >
              <Text style={styles.btnText} maxFontSizeMultiplier={1.3}>
                {primaryLabel}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(16,16,16,0.82)', // Ink, dimmed — no blur
    padding: 24,
  },
  scrimCenter: { justifyContent: 'center' },
  scrimBottom: { justifyContent: 'flex-end', paddingBottom: 88 },
  card: {
    backgroundColor: colors.ink2,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    borderTopWidth: 3,
    borderTopColor: colors.lime, // Figma: Signal Lime top edge
    borderRadius: 0,
    padding: 24,
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
    color: colors.slate2,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 30,
    color: colors.bone,
    lineHeight: 32,
    textTransform: 'uppercase',
  },
  body: {
    marginTop: 12,
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
    color: colors.bone2,
  },
  rows: { marginTop: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.hairlineStrong,
  },
  rowIcon: { width: 32 },
  rowText: { flex: 1 },
  rowTitle: {
    fontFamily: fonts.monoMedium,
    fontSize: 13,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.bone,
  },
  rowBody: {
    marginTop: 2,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
    color: colors.bone2,
  },
  footer: {
    marginTop: 12,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
    color: colors.bone2,
  },
  actions: {
    marginTop: 20,
    flexDirection: 'row',
    gap: 8,
  },
  btn: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 0,
    paddingHorizontal: 16,
  },
  // Figma F1/F2: SKIP is a bare text button beside the blue primary.
  btnSkip: { backgroundColor: 'transparent' },
  skipPressed: { backgroundColor: colors.ink3 },
  btnPrimary: { backgroundColor: colors.action },
  btnPrimaryWide: { flex: 2 },
  primaryPressed: { backgroundColor: colors.actionPressed },
  btnText: {
    fontFamily: fonts.mono,
    fontSize: 13,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.bone,
  },
});
