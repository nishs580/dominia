import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '../lib/supabase';

const STATE_CONFIG = {
  attack_won: {
    role: 'attacker',
    outcome: 'won',
    eyebrow: '▪ TERRITORY TAKEN',
    headline: 'Yours.',
    opponentRoleLabel: 'DEFENDER',
    primaryCta: 'CLAIM & DEFEND',
  },
  attack_lost: {
    role: 'attacker',
    outcome: 'lost',
    eyebrow: '▪ ATTACK FAILED',
    headline: 'Held.',
    opponentRoleLabel: 'DEFENDER',
    primaryCta: 'RECONTEST WHEN READY',
  },
  defend_won: {
    role: 'defender',
    outcome: 'won',
    eyebrow: '▪ TERRITORY HELD',
    headline: 'Yours, still.',
    opponentRoleLabel: 'ATTACKER',
    primaryCta: 'FORTIFY FOR 24H',
  },
  defend_lost: {
    role: 'defender',
    outcome: 'lost',
    eyebrow: '▪ TERRITORY LOST',
    headline: 'Taken.',
    opponentRoleLabel: 'ATTACKER',
    primaryCta: 'RECONQUER',
  },
};

const INK = '#0E1014';
const INK_2 = '#1A1D24';
const BONE = '#F2EEE6';
const SLATE = '#5C6068';
const SLATE_2 = '#8B8F98';
const CLAIM = '#D64525';
const CLAIM_SOFT = 'rgba(214,69,37,0.14)';
const ALLIANCE = '#3F8F4E';
const ALLIANCE_SOFT = 'rgba(63,143,78,0.14)';
const HAIRLINE = 'rgba(242,238,230,0.08)';
const HAIRLINE_STRONG = 'rgba(242,238,230,0.16)';

function clampNumber(n, fallback = 0) {
  const v = Number(n);
  return Number.isFinite(v) ? v : fallback;
}

function formatMetres(m) {
  return Math.max(0, Math.round(clampNumber(m, 0))).toLocaleString();
}

function consequenceLine(cfg, myM, oppM, opponentName) {
  const diff = Math.abs(myM - oppM);
  if (cfg.outcome === 'won' && cfg.role === 'attacker') {
    return `${opponentName.toUpperCase()} HELD THIS GROUND.\nYOU ARE NOW IN THE HALL OF HOLDERS.`;
  }
  if (cfg.outcome === 'lost' && cfg.role === 'attacker') {
    return `${diff} METRES SHORT.\nSTREAK INTACT. RECONTEST WHEN READY.`;
  }
  if (cfg.outcome === 'won' && cfg.role === 'defender') {
    return `+60 XP · +12 SHIELD.\nYOUR HOLD CONTINUES.`;
  }
  return `RECONQUEST WINDOW OPEN: 72H.\nYOUR DEFENCE IS RECORDED.`;
}

export default function ContestResultScreen() {
  const navigation = useNavigation();
  const route = useRoute();

  const {
    contestState = 'attack_won',
    territoryName = 'Territory',
    territoryPerimeter,
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
  const markColor = cfg.role === 'attacker' ? CLAIM : ALLIANCE;
  const markSoftColor = cfg.role === 'attacker' ? CLAIM_SOFT : ALLIANCE_SOFT;

  const myM = clampNumber(myDistance, 0);
  const oppM = clampNumber(opponentDistance, 0);

  const winner = useMemo(() => {
    if (myM === oppM) return cfg.outcome === 'won' ? 'me' : 'opponent';
    return myM > oppM ? 'me' : 'opponent';
  }, [myM, oppM, cfg.outcome]);

  const myIsWinner = winner === 'me';
  const oppIsWinner = winner === 'opponent';

  const fillOpacity = useRef(new Animated.Value(0)).current;
  const borderAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (cfg.outcome === 'won') {
      Animated.timing(fillOpacity, {
        toValue: 1,
        duration: 280,
        easing: Easing.bezier(0.2, 0, 0, 1),
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(borderAnim, {
        toValue: 3,
        duration: 280,
        easing: Easing.bezier(0.2, 0, 0, 1),
        useNativeDriver: false,
      }).start();
    }
  }, [cfg.outcome]);

  return (
    <View style={styles.screen}>
      <View style={styles.statusSpacer} />

      <Text style={[styles.eyebrow, { color: markColor }]}>{cfg.eyebrow}</Text>

      <View style={styles.markWrap}>
        {cfg.outcome === 'won' ? (
          <Animated.View
            style={{
              width: 72,
              height: 72,
              backgroundColor: markColor,
              opacity: fillOpacity,
            }}
          />
        ) : (
          <Animated.View
            style={{
              width: 72,
              height: 72,
              borderColor: markColor,
              borderWidth: borderAnim,
              backgroundColor: 'transparent',
            }}
          />
        )}
      </View>

      <Text style={styles.territoryName}>{territoryName.toUpperCase()}</Text>
      <Text style={styles.headline}>{cfg.headline}</Text>

      {territoryPerimeter ? <Text style={styles.perimeter}>{`${territoryPerimeter} KM PERIMETER`}</Text> : null}

      <View style={styles.statsRow}>
        <View style={styles.statCell}>
          <Text style={styles.statLabel}>YOU</Text>
          <Text style={styles.statName}>You</Text>
          <Text style={[styles.statValue, myIsWinner ? { color: markColor } : { color: SLATE }]}>
            {formatMetres(myM)}
          </Text>
          <Text style={styles.statUnit}>METRES WALKED</Text>
        </View>
        <View style={styles.statCell}>
          <Text style={styles.statLabel}>{cfg.opponentRoleLabel}</Text>
          <Text style={styles.statName}>{opponentName}</Text>
          <Text style={[styles.statValue, oppIsWinner ? { color: markColor } : { color: SLATE }]}>
            {formatMetres(oppM)}
          </Text>
          <Text style={styles.statUnit}>METRES WALKED</Text>
        </View>
      </View>

      <View style={[styles.consequence, { backgroundColor: markSoftColor, borderLeftColor: markColor }]}>
        <Text style={styles.consequenceText}>{consequenceLine(cfg, myM, oppM, opponentName)}</Text>
      </View>

      <View style={styles.ctaStack}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={cfg.primaryCta}
          onPress={() => navigation.navigate('MainTabs')}
          style={({ pressed }) => [styles.ctaPrimary, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.ctaPrimaryText}>{cfg.primaryCta}</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to map"
          onPress={() => navigation.navigate('MainTabs')}
          style={({ pressed }) => [styles.ctaSecondary, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.ctaSecondaryText}>BACK TO MAP</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: INK,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  statusSpacer: {
    height: 60,
  },
  eyebrow: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 11,
    letterSpacing: 1.8,
    textAlign: 'center',
    marginBottom: 20,
  },
  markWrap: {
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  territoryName: {
    fontFamily: 'Archivo_900Black',
    fontSize: 36,
    color: BONE,
    letterSpacing: -1,
    textAlign: 'center',
    lineHeight: 38,
    marginBottom: 6,
  },
  headline: {
    fontFamily: 'Archivo_800ExtraBold',
    fontSize: 22,
    color: BONE,
    letterSpacing: -0.5,
    textAlign: 'center',
    marginBottom: 8,
  },
  perimeter: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 11,
    color: SLATE_2,
    letterSpacing: 1,
    textAlign: 'center',
    marginBottom: 28,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: HAIRLINE_STRONG,
    borderWidth: 1,
    borderColor: HAIRLINE_STRONG,
    marginBottom: 16,
  },
  statCell: {
    flex: 1,
    backgroundColor: INK,
    padding: 16,
    margin: 0.5,
  },
  statLabel: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 9,
    color: SLATE_2,
    letterSpacing: 1.4,
    marginBottom: 8,
  },
  statName: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 12,
    color: BONE,
    marginBottom: 12,
  },
  statValue: {
    fontFamily: 'Archivo_700Bold',
    fontSize: 26,
    letterSpacing: -1,
    lineHeight: 26,
  },
  statUnit: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 9,
    color: SLATE_2,
    letterSpacing: 0.6,
    marginTop: 6,
  },
  consequence: {
    borderLeftWidth: 2,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  consequenceText: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 11,
    color: BONE,
    lineHeight: 17,
    letterSpacing: 0.4,
  },
  ctaStack: {
    marginTop: 'auto',
    gap: 8,
  },
  ctaPrimary: {
    backgroundColor: CLAIM,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaPrimaryText: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 12,
    color: BONE,
    letterSpacing: 1.8,
  },
  ctaSecondary: {
    borderWidth: 1,
    borderColor: HAIRLINE_STRONG,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaSecondaryText: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 11,
    color: BONE,
    letterSpacing: 1.6,
  },
});

