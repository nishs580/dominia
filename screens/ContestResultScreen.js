import React, { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '../lib/supabase';

const BG = '#0f0f14';
const WHITE = '#ffffff';
const MUTED = '#666';

const STATE_CONFIG = {
  attack_won: {
    icon: '🏆',
    accent: '#ED9332',
    label: 'Territory captured',
    title: 'You won!',
    opponentRoleLabel: 'Defender',
    footnote: '+120 XP earned',
    isWin: true,
    showContext: false,
  },
  attack_lost: {
    icon: '⚔️',
    accent: '#E24B4A',
    label: 'Attack failed',
    title: 'You lost',
    opponentRoleLabel: 'Defender',
    footnote: 'Better luck next time',
    isWin: false,
    showContext: false,
  },
  defend_lost: {
    icon: '💔',
    accent: '#E24B4A',
    label: 'Territory lost',
    title: 'Taken!',
    opponentRoleLabel: 'Attacker',
    footnote: 'Territory removed from your profile',
    isWin: false,
    showContext: true,
  },
  defend_won: {
    icon: '🛡️',
    accent: '#61C459',
    label: 'Territory defended',
    title: 'You held!',
    opponentRoleLabel: 'Attacker',
    footnote: '+60 XP for defending',
    isWin: true,
    showContext: true,
  },
};

function clampNumber(n, fallback = 0) {
  const v = Number(n);
  return Number.isFinite(v) ? v : fallback;
}

function formatMetersNumber(m) {
  const v = Math.max(0, Math.round(clampNumber(m, 0)));
  return v.toLocaleString();
}

export default function ContestResultScreen() {
  const navigation = useNavigation();
  const route = useRoute();

  const {
    contestState = 'attack_won',
    territoryName = 'Territory',
    myDistance = 0,
    opponentDistance = 0,
    opponentName = 'opponent',
    territoryId,
    playerId,
    attackerAlliance,
  } = route?.params ?? {};

  useEffect(() => {
    if (contestState === 'attack_won' && territoryId && playerId) {
      supabase
        .from('territories')
        .update({ owner_id: playerId, alliance_id: attackerAlliance ?? null })
        .eq('id', territoryId)
        .then(({ error }) => {
          if (error) console.error('Contest win write failed:', error);
        });
    }
  }, []);

  const cfg = STATE_CONFIG[contestState] ?? STATE_CONFIG.attack_won;
  const accent = cfg.accent;

  const myM = clampNumber(myDistance, 0);
  const oppM = clampNumber(opponentDistance, 0);

  const winner = useMemo(() => {
    if (myM === oppM) return 'tie';
    return myM > oppM ? 'me' : 'opponent';
  }, [myM, oppM]);

  const myIsWinner = winner === 'me' || (winner === 'tie' && cfg.isWin);
  const oppIsWinner = winner === 'opponent';

  return (
    <View style={styles.screen}>
      <View style={styles.content}>
        <View style={[styles.iconWrap, { borderColor: accent, backgroundColor: `${accent}14` }]}>
          <Text style={styles.icon}>{cfg.icon}</Text>
        </View>

        <Text style={[styles.label, { color: accent }]}>{cfg.label}</Text>
        <Text style={styles.title}>{cfg.title}</Text>
        <Text style={styles.territory}>{territoryName}</Text>

        {cfg.showContext && (
          <View style={styles.contextPill}>
            <Text style={styles.contextText}>{`${opponentName} challenged you`}</Text>
          </View>
        )}

        <View style={styles.cardsRow}>
          <View
            style={[
              styles.playerCard,
              myIsWinner && { backgroundColor: `${accent}10`, borderColor: `${accent}35` },
            ]}
          >
            <Text style={styles.playerTopLabel}>You</Text>
            <Text style={styles.playerName}>You</Text>
            <Text style={[styles.distanceNumber, myIsWinner ? { color: accent } : styles.distanceMuted]}>
              {formatMetersNumber(myM)}
            </Text>
            <Text style={styles.distanceUnit}>metres</Text>
          </View>

          <View
            style={[
              styles.playerCard,
              oppIsWinner && { backgroundColor: `${accent}10`, borderColor: `${accent}35` },
            ]}
          >
            <Text style={styles.playerTopLabel}>{cfg.opponentRoleLabel}</Text>
            <Text style={styles.playerName}>{opponentName}</Text>
            <Text style={[styles.distanceNumber, oppIsWinner ? { color: accent } : styles.distanceMuted]}>
              {formatMetersNumber(oppM)}
            </Text>
            <Text style={styles.distanceUnit}>metres</Text>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to map"
          onPress={() => navigation.navigate('MainTabs')}
          style={({ pressed }) => [
            styles.cta,
            cfg.isWin ? styles.ctaWin : styles.ctaLose,
            pressed && { opacity: 0.9 },
          ]}
        >
          <Text style={[styles.ctaText, cfg.isWin ? styles.ctaTextWin : styles.ctaTextLose]}>
            Back to map
          </Text>
        </Pressable>
      </View>

      <Text style={styles.footnote}>{cfg.footnote}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BG,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 18,
    justifyContent: 'space-between',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    width: 92,
    height: 92,
    borderRadius: 999,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  icon: {
    fontSize: 38,
  },
  label: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    marginTop: 6,
  },
  title: {
    marginTop: 10,
    color: WHITE,
    fontSize: 34,
    fontWeight: '600',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  territory: {
    marginTop: 10,
    color: MUTED,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  contextPill: {
    marginTop: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  contextText: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: -0.1,
  },
  cardsRow: {
    marginTop: 18,
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  playerCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  playerTopLabel: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  playerName: {
    marginTop: 10,
    color: WHITE,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.1,
  },
  distanceNumber: {
    marginTop: 10,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  distanceMuted: {
    color: '#555',
  },
  distanceUnit: {
    marginTop: 6,
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12,
    fontWeight: '800',
  },
  cta: {
    marginTop: 18,
    width: '100%',
    borderRadius: 18,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaWin: {
    backgroundColor: '#ED9332',
  },
  ctaLose: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  ctaText: {
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: -0.1,
  },
  ctaTextWin: {
    color: WHITE,
  },
  ctaTextLose: {
    color: 'rgba(255,255,255,0.70)',
  },
  footnote: {
    color: 'rgba(255,255,255,0.40)',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    paddingTop: 10,
  },
});

