// components/CancelChallengeDialog.js
// "CANCEL THE CLAIM?" confirm (plan U9, Figma B6). CONTINUE CHALLENGE keeps
// walking; the red-outline button confirms. Copy comes from
// lib/challengeScreen.js challengeHeaderModel().dialog, so attacks and
// defends read "CANCEL THE ATTACK?" / "CANCEL THE DEFENCE?".

import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors } from '../lib/theme';

function tr(t, copy) {
  return t(copy.key, { defaultValue: copy.defaultValue, ...(copy.params || {}) });
}

/**
 * @param {object}   props
 * @param {boolean}  props.visible
 * @param {object}   props.dialog     challengeHeaderModel().dialog
 * @param {Function} props.onKeep     CONTINUE CHALLENGE / back gesture.
 * @param {Function} props.onConfirm  cancel the challenge.
 */
export default function CancelChallengeDialog({ visible, dialog, onKeep, onConfirm }) {
  const { t } = useTranslation();
  if (!dialog) return null;
  const title = tr(t, dialog.title);
  const body = tr(t, dialog.body);
  const keep = tr(t, dialog.keep);
  const confirm = tr(t, dialog.confirm);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onKeep}>
      <View style={styles.scrim}>
        <View style={styles.card} accessibilityViewIsModal accessibilityRole="alert">
          <Text style={styles.title} accessibilityRole="header">{title}</Text>
          <Text style={styles.body}>{body}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={keep}
            onPress={onKeep}
            style={({ pressed }) => [styles.keepBtn, pressed && { backgroundColor: colors.actionPressed }]}
          >
            <Text style={styles.keepText}>{keep}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={confirm}
            onPress={onConfirm}
            style={({ pressed }) => [styles.confirmBtn, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.confirmText}>{confirm}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(16,16,16,0.72)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    borderRadius: 0,
    padding: 20,
    gap: 14,
  },
  title: {
    fontFamily: 'SofiaSansExtraCondensed_800ExtraBold',
    color: colors.bone,
    fontSize: 30,
    lineHeight: 32,
    textTransform: 'uppercase',
  },
  body: { fontFamily: 'InstrumentSans_400Regular', color: colors.bone, fontSize: 14, lineHeight: 20 },
  keepBtn: {
    marginTop: 6,
    backgroundColor: colors.action,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keepText: { fontFamily: 'GeistMono_500Medium', color: colors.bone, fontSize: 12, letterSpacing: 1.6, textTransform: 'uppercase' },
  confirmBtn: {
    borderWidth: 1,
    borderColor: colors.danger,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmText: { fontFamily: 'GeistMono_500Medium', color: colors.danger, fontSize: 12, letterSpacing: 1.6, textTransform: 'uppercase' },
});
