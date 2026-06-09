// Component: NotificationCard — foreground push card
// Brand rule applied: 0px radius on card and buttons (non-negotiable), no shadow/glow. DISMISS uses ghost-button treatment. Card body itself is tappable (no decorative chrome).

import { useEffect, useState } from 'react';
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import { subscribe, hideCard, getCurrentCard } from '../../lib/notifications/cardController';
import { navigateTo } from '../../lib/navigation';

const DEFAULT_TITLES = {
  streak_milestone: 'Proven streak.',
  streak_broken: 'Your streak reset.',
  contest_won: 'Territory held.',
  contest_lost: 'Territory lost.',
  streak_break_warning: 'Streak at risk.',
  alliance_kicked: 'Removed from alliance.',
  alliance_demoted: 'Role updated.',
  level_up_4: 'The map just got real.',
  level_up_5: 'The city knows your name.',
  level_up_6: 'Level 6. Alliance phase begins.',
  level_up_10: 'Dominator.',
  first_claim: 'First claim.',
  first_contest_win: 'First conquest.',
  first_reconquest: 'First reconquest.',
  first_alliance_mission: 'First alliance mission complete.',
};

export default function NotificationCard() {
  const [card, setCard] = useState(getCurrentCard());
  useEffect(() => subscribe(setCard), []);

  if (!card) return null;

  const { kind, data, target } = card;
  const title = data?.title || DEFAULT_TITLES[kind] || 'Notification';
  const body = data?.body || '';

  return (
    <Modal visible transparent animationType="fade" onRequestClose={hideCard}>
      <Pressable style={styles.backdrop} onPress={hideCard}>
        <Pressable
          style={styles.card}
          onPress={() => {
            if (target) navigateTo(target);
            hideCard();
          }}
        >
          <Text style={styles.title}>{title}</Text>
          {body ? <Text style={styles.body}>{body}</Text> : null}
          <Pressable style={styles.dismiss} onPress={hideCard} hitSlop={8}>
            <Text style={styles.dismissText}>DISMISS</Text>
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
    color: '#FF6B35',
  },
});
