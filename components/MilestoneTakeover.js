// Component: MilestoneTakeover — full-screen ceremonial surface for milestone
// unlocks (level-up, first contest win). Opaque Ink, 280ms fade-in, extended
// haptic on show, explicit CONTINUE dismiss. Claim red appears once — on the
// kicker; the CTA is a hairline outline.
//
// Screens pass a queue of items and pop on dismiss, so a result that both
// levels up and lands a first win plays two ceremonies in order.
//   item = { kicker: string, title: string, body?: string }

import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { milestoneHaptic } from '../lib/haptics';

const INK = '#0E1014';
const BONE = '#F2EEE6';
const SLATE2 = '#8B8F98';
const CLAIM = '#D64525';
const HAIRLINE_STRONG = 'rgba(242,238,230,0.16)';

export default function MilestoneTakeover({ item, onDismiss }) {
  const { t } = useTranslation();
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!item) return;
    fade.setValue(0);
    milestoneHaptic();
    Animated.timing(fade, {
      toValue: 1,
      duration: 280,
      easing: Easing.bezier(0.2, 0, 0, 1),
      useNativeDriver: true,
    }).start();
  }, [item, fade]);

  if (!item) return null;

  return (
    <Modal visible transparent={false} animationType="none" onRequestClose={onDismiss} statusBarTranslucent>
      <Animated.View style={[styles.screen, { opacity: fade }]}>
        <View style={styles.centre}>
          <Text style={styles.kicker}>{item.kicker}</Text>
          <Text
            style={styles.title}
            numberOfLines={2}
            adjustsFontSizeToFit
            minimumFontScale={0.5}
            maxFontSizeMultiplier={1.2}
          >
            {item.title}
          </Text>
          {item.body ? <Text style={styles.body}>{item.body}</Text> : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('milestone.continue')}
          onPress={onDismiss}
          style={({ pressed }) => [styles.cta, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.ctaText}>{t('milestone.continue')}</Text>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: INK,
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  centre: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kicker: {
    fontFamily: 'GeistMono_500Medium',
    color: CLAIM,
    fontSize: 11,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: 16,
  },
  title: {
    fontFamily: 'Archivo_900Black',
    color: BONE,
    fontSize: 48,
    lineHeight: 52,
    letterSpacing: -0.5,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  body: {
    fontFamily: 'Inter_400Regular',
    color: SLATE2,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 16,
    paddingHorizontal: 18,
  },
  cta: {
    borderWidth: 1,
    borderColor: HAIRLINE_STRONG,
    borderRadius: 0,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    fontFamily: 'GeistMono_500Medium',
    color: BONE,
    fontSize: 12,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
});
