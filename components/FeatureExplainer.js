// Feature explainer card (plan U10/U14/U15): a once-per-player modal card with
// a mono kicker, a sentence of body copy, and Skip / Next. Used for "Missions
// type" on Missions and, later, the alliance explainers.
//
// Usage:
//   <FeatureExplainer
//     userId={userId}
//     name="explainer:missionsType"            // walkthroughFlags name
//     pages={[{ title: 'MISSIONS TYPE', body: '...' }]}
//     reopen={infoTapCount}                    // bump to show it again
//   />
//
// It shows on first mount for a player who has not seen it. Skip, or Next on
// the last page, closes it and marks it fired (lib/walkthroughFlags.js). The
// card is flat Ink 2 with a hairline over a dimmed Ink scrim, per DESIGN.md.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { hasFired, markFired } from '../lib/walkthroughFlags';
import { colors, fonts } from '../lib/theme';

export default function FeatureExplainer({ userId, name, pages, reopen = 0, onClose }) {
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

  useEffect(() => {
    if (visible && page) {
      AccessibilityInfo.announceForAccessibility?.(`${page.title}. ${page.body}`);
    }
  }, [visible, page]);

  const close = useCallback(() => {
    setVisible(false);
    if (userId && name) markFired(userId, name);
    onClose?.();
  }, [userId, name, onClose]);

  const next = useCallback(() => {
    if (index < (pages?.length ?? 0) - 1) setIndex(index + 1);
    else close();
  }, [index, pages, close]);

  if (!page) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
      <View style={styles.scrim}>
        <View style={styles.card} accessibilityViewIsModal>
          <Text style={styles.title} accessibilityRole="header" maxFontSizeMultiplier={1.3}>
            {page.title}
          </Text>
          <Text style={styles.body}>{page.body}</Text>
          {pages.length > 1 ? (
            <Text style={styles.pager} maxFontSizeMultiplier={1.3}>
              {t('explainer.pager', { defaultValue: '{{n}} / {{total}}', n: index + 1, total: pages.length })}
            </Text>
          ) : null}
          <View style={styles.actions}>
            <Pressable
              onPress={close}
              accessibilityRole="button"
              accessibilityLabel={t('explainer.skipA11y', { defaultValue: 'Skip explanation' })}
              style={({ pressed }) => [styles.btn, styles.btnSecondary, pressed && styles.pressed]}
            >
              <Text style={styles.btnText} maxFontSizeMultiplier={1.3}>
                {t('explainer.skip', { defaultValue: 'Skip' })}
              </Text>
            </Pressable>
            <Pressable
              onPress={next}
              accessibilityRole="button"
              accessibilityLabel={t('explainer.nextA11y', { defaultValue: 'Next' })}
              style={({ pressed }) => [styles.btn, styles.btnPrimary, pressed && styles.pressed]}
            >
              <Text style={styles.btnText} maxFontSizeMultiplier={1.3}>
                {t('explainer.next', { defaultValue: 'Next' })}
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
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    backgroundColor: colors.ink2,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    borderRadius: 0,
    padding: 16,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 30,
    color: colors.slate2,
    lineHeight: 32,
    textTransform: 'uppercase',
  },
  body: {
    marginTop: 12,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
    color: colors.bone,
  },
  pager: {
    marginTop: 12,
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.slate2,
  },
  actions: {
    marginTop: 16,
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
  btnSecondary: {
    backgroundColor: colors.ink2,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
  },
  // Not Claim Red: the screen beneath owns its one red element.
  btnPrimary: {
    backgroundColor: colors.ink3,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
  },
  pressed: {
    backgroundColor: colors.ink3,
  },
  btnText: {
    fontFamily: fonts.mono,
    fontSize: 13,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.bone,
  },
});
