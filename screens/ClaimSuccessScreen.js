import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '@clerk/clerk-expo';
import { supabase } from '../lib/supabase';

const BG = '#0f0f14';
const CARD = '#1a1a24';
const ORANGE = '#ff6e3c';
const WHITE = '#ffffff';
const MUTED = '#8b8b9a';
const GREEN = '#4ade80';

function formatMeters(m) {
  const v = Math.max(0, Math.round(Number(m) || 0));
  return `${v}m`;
}

export default function ClaimSuccessScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { userId } = useAuth();

  const { territoryName = 'Territory', perimeterDistance = 0, territoryId } = route?.params ?? {};

  const fade = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0.96)).current;

  useEffect(() => {
    if (!territoryId || !userId) return;

    (async () => {
      const { data: player, error: playerError } = await supabase
        .from('players')
        .select('id')
        .eq('clerk_id', userId)
        .maybeSingle();

      if (playerError || !player?.id) {
        if (playerError) console.error('ClaimSuccess player fetch:', playerError);
        return;
      }

      const { error: updateError } = await supabase
        .from('territories')
        .update({ owner_id: player.id })
        .eq('id', territoryId);

      if (updateError) {
        console.error('ClaimSuccess territory update:', updateError);
      }
    })();
  }, [territoryId, userId]);

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
        <View style={styles.iconCircle}>
          <View style={styles.tickLong} />
          <View style={styles.tickShort} />
        </View>

        <Text style={styles.title}>Territory Claimed!</Text>
        <Text style={styles.territory}>{territoryName}</Text>
        <Text style={styles.message}>You now control this territory. Defend it well.</Text>

        <View style={styles.cardsRow}>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>PERIMETER</Text>
            <Text style={styles.cardValue}>{formatMeters(perimeterDistance)}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>STATUS</Text>
            <Text style={[styles.cardValue, { color: GREEN }]}>Owned</Text>
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
    backgroundColor: BG,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 18,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 150,
    height: 150,
    borderRadius: 999,
    borderWidth: 6,
    borderColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  tickLong: {
    position: 'absolute',
    width: 12,
    height: 70,
    borderRadius: 10,
    backgroundColor: ORANGE,
    transform: [{ rotate: '45deg' }],
    left: 82,
    top: 40,
  },
  tickShort: {
    position: 'absolute',
    width: 12,
    height: 38,
    borderRadius: 10,
    backgroundColor: ORANGE,
    transform: [{ rotate: '-45deg' }],
    left: 58,
    top: 66,
  },
  title: {
    color: WHITE,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  territory: {
    marginTop: 10,
    color: ORANGE,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.1,
    textAlign: 'center',
  },
  message: {
    marginTop: 12,
    color: MUTED,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    textAlign: 'center',
    paddingHorizontal: 18,
  },
  cardsRow: {
    marginTop: 22,
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  card: {
    flex: 1,
    backgroundColor: CARD,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  cardLabel: {
    color: MUTED,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  cardValue: {
    marginTop: 10,
    color: WHITE,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  cta: {
    backgroundColor: ORANGE,
    borderRadius: 18,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    color: WHITE,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: -0.1,
  },
  testSection: {
    marginBottom: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  testTitle: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.0,
    textTransform: 'uppercase',
  },
  testButtonsRow: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 10,
  },
  testBtn: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  testBtnText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: -0.1,
  },
});

