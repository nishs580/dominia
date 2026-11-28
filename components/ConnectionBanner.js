// components/ConnectionBanner.js
// "CONNECTION LOST · RECONNECTING" (plan U9, Figma D3). Shown at the top of
// the challenge screen while a challenge is active and the device is offline.
// Display only: sampling and syncing are unchanged — samples already queue
// offline and flush when the connection returns.

import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useTranslation } from 'react-i18next';
import { colors } from '../lib/theme';
import { showsConnectionBanner } from '../lib/challengeScreen';

/** { isConnected, isInternetReachable } from NetInfo, null fields while unknown. */
function useNetState() {
  const [net, setNet] = useState({ isConnected: null, isInternetReachable: null });
  useEffect(() => {
    let unsub = null;
    try {
      unsub = NetInfo.addEventListener((s) => {
        setNet({ isConnected: s?.isConnected ?? null, isInternetReachable: s?.isInternetReachable ?? null });
      });
    } catch (_) {
      // NetInfo unavailable (native module missing): no banner, nothing else changes.
    }
    return () => { if (typeof unsub === 'function') unsub(); };
  }, []);
  return net;
}

/** True while `active` (a challenge is being walked) and the device is offline. */
export function useConnectionLost(active) {
  const net = useNetState();
  return showsConnectionBanner({ ...net, challengeActive: active });
}

/**
 * @param {object}  props
 * @param {boolean} props.visible    useConnectionLost() result.
 * @param {number}  [props.topInset] safe-area top padding.
 */
export default function ConnectionBanner({ visible, topInset = 0 }) {
  const { t } = useTranslation();
  if (!visible) return null;

  const title = t('activeClaim.figma.connectionLostTitle', { defaultValue: 'CONNECTION LOST · RECONNECTING' });
  const body = t('activeClaim.figma.connectionLostBody', {
    defaultValue: "Keep walking — your steps are still being counted and will sync when you're back online.",
  });

  return (
    <View
      style={[styles.banner, { paddingTop: topInset + 10 }]}
      accessible
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      accessibilityLabel={`${title}. ${body}`}
    >
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: 'rgba(227,66,52,0.24)',
    borderBottomWidth: 1,
    borderBottomColor: colors.danger,
    paddingHorizontal: 18,
    paddingBottom: 10,
    gap: 4,
  },
  title: { fontFamily: 'IBMPlexSans_600SemiBold', color: colors.danger, fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase' },
  body: { fontFamily: 'IBMPlexSans_500Medium', color: colors.bone, fontSize: 13, lineHeight: 18 },
});
