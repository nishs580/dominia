// Component: NotificationCard — foreground push card
// Brand rule applied: 0px radius on card and buttons (non-negotiable), no shadow/glow. DISMISS uses ghost-button treatment. Card body itself is tappable (no decorative chrome).

import { useEffect, useState } from 'react';
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { subscribe, hideCard, getCurrentCard } from '../../lib/notifications/cardController';
import { navigateTo } from '../../lib/navigation';
import MedalEarnTakeover from '../medals/MedalEarnTakeover';

const isMedalKind = (kind) =>
  typeof kind === 'string' && kind.startsWith('legacy_medal_');

export default function NotificationCard() {
  const { t, i18n } = useTranslation();
  const [card, setCard] = useState(getCurrentCard());
  useEffect(() => subscribe(setCard), []);

  if (!card) return null;

  const { kind, data, target, params } = card;
  // Server-provided title wins; otherwise fall back to a localized default per
  // kind, then a generic label.
  const titleKey = `notif.titles.${kind}`;
  const title = data?.title || (i18n.exists(titleKey) ? t(titleKey) : '') || t('notif.fallbackTitle');
  const body = data?.body || '';

  const goToTarget = () => {
    if (target) navigateTo(target, params || {});
    hideCard();
  };

  // Medal earns are milestone moments — full-ceremony takeover, explicit CTAs
  // only (no backdrop-tap dismissal). Every other kind keeps the dialog card.
  if (isMedalKind(kind)) {
    return (
      <Modal visible animationType="none" statusBarTranslucent onRequestClose={hideCard}>
        <MedalEarnTakeover data={data} onViewMedal={goToTarget} onDismiss={hideCard} />
      </Modal>
    );
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={hideCard}>
      <Pressable style={styles.backdrop} onPress={hideCard}>
        <Pressable style={styles.card} onPress={goToTarget}>
          <Text style={styles.title}>{title}</Text>
          {body ? <Text style={styles.body}>{body}</Text> : null}
          <Pressable style={styles.dismiss} onPress={hideCard} hitSlop={8}>
            <Text style={styles.dismissText}>{t('notif.dismiss')}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#0E1014',
    borderWidth: 1,
    borderColor: 'rgba(242,238,230,0.16)',
    borderRadius: 0,
    padding: 24,
    alignItems: 'flex-start',
  },
  title: {
    fontFamily: 'Archivo_700Bold',
    fontSize: 22,
    color: '#F2EEE6',
    marginBottom: 8,
  },
  body: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: 'rgba(242,238,230,0.7)',
    marginBottom: 24,
  },
  dismiss: {
    alignSelf: 'flex-end',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  dismissText: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 12,
    letterSpacing: 1.6,
    color: '#D64525',
  },
});
