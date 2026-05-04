import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import * as F from '../lib/formulas';

const INK = '#0E1014';
const INK2 = '#1A1D24';
const BONE = '#F2EEE6';
const SLATE2 = '#8B8F98';
const CLAIM = '#D64525';
const CLAIM_SOFT = 'rgba(214,69,37,0.14)';
const ALLIANCE = '#3F8F4E';
const HAIRLINE_STRONG = 'rgba(242,238,230,0.16)';

function formatMeters(m) {
  const v = Math.max(0, Math.round(Number(m) || 0));
  return `${v}m`;
}

export default function ClaimSuccessScreen() {
  const navigation = useNavigation();
  const route = useRoute();

  const { territoryName = 'Territory', perimeterDistance = 0, territoryId, playerId } = route?.params ?? {};

  const fade = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0.96)).current;
  const [goldEarned, setGoldEarned] = useState(null);
  const [xpEarned, setXpEarned] = useState(null);

  useEffect(() => {
    if (!territoryId || !playerId) return;

    (async () => {
      const { data: updatedTerritory, error: updateError } = await supabase
        .from('territories')
        .update({ owner_id: playerId })
        .eq('id', territoryId)
        .select('tier')
        .single();

      if (updateError) {
        console.error('ClaimSuccess territory update:', updateError);
        return;
      }

      const { data: playerForHistory } = await supabase
        .from('players')
        .select('alliance_id')
        .eq('id', playerId)
        .maybeSingle();

      const { error: historyInsertError } = await supabase
        .from('territory_history')
        .insert([
          {
            territory_id: territoryId,
            owner_id: playerId,
            alliance_id: playerForHistory?.alliance_id ?? null,
          },
        ])
        .select();

      if (historyInsertError) {
        console.warn('[territory_history] claim insert failed:', historyInsertError);
      }

      try {
        const tier = F.normaliseTier(updatedTerritory?.tier);
        const goldEarned = F.CLAIM_GOLD_REWARD[tier];
        const xpEarned = F.calcClaimXp(tier);

        const { data: playerRow, error: playerFetchError } = await supabase
          .from('players')
          .select('gold, xp')
          .eq('id', playerId)
          .single();
        if (playerFetchError) throw playerFetchError;

        const currentGold = Number(playerRow?.gold) || 0;
        const currentXp = Number(playerRow?.xp) || 0;

        const { error: writeRewardError } = await supabase
          .from('players')
          .update({
            gold: currentGold + goldEarned,
            xp: currentXp + xpEarned,
          })
          .eq('id', playerId)
          .select();
        if (writeRewardError) throw writeRewardError;

        setGoldEarned(goldEarned);
        setXpEarned(xpEarned);
      } catch (goldError) {
        // TODO: make ownership + reward writes transactional in phase 4.
        console.error('[ClaimSuccess] gold reward update failed:', goldError);
      }

      const { data: playerFull } = await supabase
        .from('players')
        .select('alliance_id')
        .eq('id', playerId)
        .maybeSingle();

      if (playerFull?.alliance_id) {
        await supabase
          .from('territories')
          .update({ alliance_id: playerFull.alliance_id })
          .eq('id', territoryId);
      }
    })();
  }, [territoryId, playerId]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 520,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(pop, {
        toValue: 1,
        duration: 520,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [fade, pop]);

  const animatedStyle = useMemo(
    () => ({
      opacity: fade,
      transform: [{ scale: pop }],
    }),
    [fade, pop],
  );

  return (
    <View style={styles.screen}>
      <View style={{ flex: 1 }} />

      <Animated.View style={[styles.center, animatedStyle]}>
        <View style={styles.iconSquare} />

        <Text style={styles.territory}>{territoryName}</Text>
        <Text style={styles.territoryCaption}>is yours.</Text>
        {xpEarned != null ? (
          <Text style={styles.goldEarnedBeat}>+{xpEarned} SIEGE XP EARNED</Text>
        ) : null}
        {goldEarned != null ? (
          <Text style={styles.goldEarnedBeat}>+{goldEarned} GOLD EARNED</Text>
        ) : null}
        <Text style={styles.message}>Defend it.</Text>

        <View style={styles.cardsRow}>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>PERIMETER</Text>
            <Text style={styles.cardValue}>{formatMeters(perimeterDistance)}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>STATUS</Text>
            <Text style={[styles.cardValue, { color: ALLIANCE }]}>Owned</Text>
          </View>
        </View>
      </Animated.View>

      <View style={{ flex: 1 }} />

      <View style={styles.testSection}>
        <Text style={styles.testTitle}>Test contest result</Text>
        <View style={styles.testButtonsRow}>
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              navigation.navigate('ContestResultScreen', {
                contestState: 'attack_won',
                territoryName: 'Vondelpark West',
                myDistance: 1240,
                opponentDistance: 890,
                opponentName: 'attacker_x',
              })
            }
            style={({ pressed }) => [styles.testBtn, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.testBtnText}>attack_won</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              navigation.navigate('ContestResultScreen', {
                contestState: 'attack_lost',
                territoryName: 'Vondelpark West',
                myDistance: 890,
                opponentDistance: 1240,
                opponentName: 'attacker_x',
              })
            }
            style={({ pressed }) => [styles.testBtn, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.testBtnText}>attack_lost</Text>
          </Pressable>
        </View>

        <View style={styles.testButtonsRow}>
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              navigation.navigate('ContestResultScreen', {
                contestState: 'defend_won',
                territoryName: 'Vondelpark West',
                myDistance: 1240,
                opponentDistance: 890,
                opponentName: 'attacker_x',
              })
            }
            style={({ pressed }) => [styles.testBtn, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.testBtnText}>defend_won</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              navigation.navigate('ContestResultScreen', {
                contestState: 'defend_lost',
                territoryName: 'Vondelpark West',
                myDistance: 890,
                opponentDistance: 1240,
                opponentName: 'attacker_x',
              })
            }
            style={({ pressed }) => [styles.testBtn, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.testBtnText}>defend_lost</Text>
          </Pressable>
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back to Map"
        onPress={() => navigation.navigate('MainTabs')}
        style={({ pressed }) => [styles.cta, pressed && { opacity: 0.9 }]}
      >
        <Text style={styles.ctaText}>Back to Map</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: INK,
    paddingHorizontal: 18,
    paddingTop: 48,
    paddingBottom: 24,
  },

  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  iconSquare: {
    width: 64,
    height: 64,
    backgroundColor: '#D64525',
    marginBottom: 24,
  },

  territory: {
    fontFamily: 'Archivo_900Black',
    color: BONE,
    fontSize: 28,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    textAlign: 'center',
    lineHeight: 32,
  },

  territoryCaption: {
    fontFamily: 'GeistMono_400Regular',
    color: CLAIM,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 12,
  },

  message: {
    fontFamily: 'Inter_400Regular',
    marginTop: 8,
    color: SLATE2,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    paddingHorizontal: 18,
  },
  goldEarnedBeat: {
    fontFamily: 'GeistMono_400Regular',
    color: BONE,
    fontSize: 9,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginTop: 2,
    marginBottom: 12,
  },

  cardsRow: {
    marginTop: 24,
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },

  card: {
    flex: 1,
    backgroundColor: INK2,
    borderWidth: 1,
    borderColor: HAIRLINE_STRONG,
    borderRadius: 0,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },

  cardLabel: {
    fontFamily: 'GeistMono_400Regular',
    color: SLATE2,
    fontSize: 9,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },

  cardValue: {
    fontFamily: 'GeistMono_500Medium',
    color: BONE,
    fontSize: 20,
    letterSpacing: -0.2,
    marginTop: 8,
  },
  cta: {
    backgroundColor: CLAIM,
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

  testSection: {
    marginBottom: 12,
    backgroundColor: INK2,
    borderRadius: 0,
    padding: 12,
    borderWidth: 1,
    borderColor: HAIRLINE_STRONG,
  },

  testTitle: {
    fontFamily: 'GeistMono_400Regular',
    color: SLATE2,
    fontSize: 9,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },

  testButtonsRow: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 10,
  },

  testBtn: {
    flex: 1,
    backgroundColor: INK,
    borderRadius: 0,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: HAIRLINE_STRONG,
    alignItems: 'center',
    justifyContent: 'center',
  },

  testBtnText: {
    fontFamily: 'GeistMono_400Regular',
    color: SLATE2,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
});

