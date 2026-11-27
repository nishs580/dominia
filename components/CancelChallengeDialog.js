// components/CancelChallengeDialog.js
// Cancel confirm of the Dominia-Temp challenge flow (plan 2026-11-28 U7;
// board "Cancel claim?", Challenge case 2): a dark-blue gradient panel at the
// bottom of the dimmed challenge screen — "Are you sure that you want to
// cancel the claim?" — with CONTINUE CHALLENGE (primary) and CANCEL CLAIM
// (ghost) side by side. Copy comes from lib/challengeScreen.js
// challengeHeaderModel().dialog, so attacks and defends read their own words.

import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { colors, fonts } from '../lib/theme';
import { SlantButton } from './ui';
import { useSvgId } from './ui/shared';

function tr(t, copy) {
  return t(copy.key, { defaultValue: copy.defaultValue, ...(copy.params || {}) });
}

/**
 * @param {object}   props
 * @param {boolean}  props.visible
 * @param {object}   props.dialog     challengeHeaderModel().dialog
 * @param {Function} props.onKeep     CONTINUE CHALLENGE / back gesture / tap outside.
 * @param {Function} props.onConfirm  cancel the challenge.
 */
export default function CancelChallengeDialog({ visible, dialog, onKeep, onConfirm }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const gradId = useSvgId('chcancel');
  if (!dialog) return null;
  const prompt = tr(t, dialog.prompt);
  const keep = tr(t, dialog.keep);
  const confirm = tr(t, dialog.confirm);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onKeep}>
      <View style={styles.root}>
        <Pressable
          style={styles.scrim}
          onPress={onKeep}
          accessibilityRole="button"
          accessibilityLabel={keep}
        />
        <View
          style={[styles.panel, { paddingBottom: insets.bottom + 20 }]}
          accessibilityViewIsModal
          accessibilityRole="alert"
        >
          <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
            <Defs>
              <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={colors.actionDeep} />
                <Stop offset="1" stopColor="#000000" />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${gradId})`} />
          </Svg>
          <Text style={styles.prompt} accessibilityRole="header">{prompt}</Text>
          <View style={styles.row}>
            <SlantButton
              label={keep}
              variant="primary"
              size="md"
              trailingChevron={false}
              onPress={onKeep}
              style={styles.btn}
            />
            <SlantButton
              label={confirm}
              variant="ghost"
              size="md"
              onPress={onConfirm}
              style={styles.btn}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  panel: {
    paddingTop: 22,
    paddingHorizontal: 18,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceLine,
    overflow: 'hidden',
    gap: 18,
  },
  prompt: {
    fontFamily: fonts.bodyMedium,
    color: colors.white,
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  row: { flexDirection: 'row', gap: 10 },
  btn: { flex: 1 },
});
