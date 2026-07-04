import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, fonts } from '../lib/theme';

/**
 * Pre-permission prime shown once, right after the map walkthrough ends.
 * "Allow" flips the notifAllow flag (FcmLifecycle is listening and will run
 * FCM registration, which raises the OS permission dialog); "Not now" only
 * dismisses — the OS prompt is never wasted on an unprimed player.
 */
export default function NotifPrimeModal({ visible, onAllow, onLater }) {
  const { t } = useTranslation();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onLater}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{t('notifPrime.title')}</Text>
          <Pressable accessibilityRole="button" style={styles.allow} onPress={onAllow}>
            <Text style={styles.allowText}>{t('notifPrime.allow')}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" style={styles.later} onPress={onLater} hitSlop={8}>
            <Text style={styles.laterText}>{t('notifPrime.later')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(14,16,20,0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    alignSelf: 'stretch',
    backgroundColor: colors.ink2,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    paddingVertical: 20,
    paddingHorizontal: 18,
  },
  title: {
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    lineHeight: 22,
    color: colors.bone,
  },
  allow: {
    marginTop: 18,
    backgroundColor: colors.claim,
    paddingVertical: 12,
    alignItems: 'center',
  },
  allowText: {
    fontFamily: fonts.monoMedium,
    fontSize: 12,
    color: colors.bone,
    letterSpacing: 1.4,
  },
  later: {
    marginTop: 14,
    alignItems: 'center',
  },
  laterText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.slate2,
    letterSpacing: 1.2,
  },
});
