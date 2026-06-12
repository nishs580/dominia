import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '@clerk/clerk-expo';
import { completeClaim } from '../lib/claimApi';

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

function completeErrorShowsRetry(code) {
  return !['intent_expired', 'territory_already_claimed', 'no_token', 'unauthorized'].includes(code);
}

export default function ClaimSuccessScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  useEffect(() => { getTokenRef.current = getToken; }, [getToken]);

  const {
    territoryName = 'Territory',
    perimeterDistance = 0,
    territoryId,
    playerId,
    goldPaid = 0,
    freeClaim = false,
  } = route?.params ?? {};

  const fade = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0.96)).current;
  const [envelope, setEnvelope] = useState(null);
  const [completeError, setCompleteError] = useState(null);
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    if (!territoryId || !playerId) return;
    let cancelled = false;
    (async () => {
      const result = await completeClaim({
        clerkGetToken: () => getTokenRef.current(),
        territoryId,
      });
      if (cancelled) return;
      if (result.ok) {
        setEnvelope(result.data);
      } else {
        setCompleteError({ code: result.code, context: result.context, status: result.status });
      }
    })();
    return () => { cancelled = true; };
  }, [territoryId, playerId]);

  const handleRetry = async () => {
    setCompleteError(null);
    setEnvelope(null);
    setIsRetrying(true);
    try {
      const result = await completeClaim({
        clerkGetToken: () => getTokenRef.current(),
        territoryId,
      });
      if (result.ok) {
        setEnvelope(result.data);
      } else {
        setCompleteError({ code: result.code, context: result.context, status: result.status });
      }
    } finally {
      setIsRetrying(false);
    }
  };

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

  const showRewardBeats = envelope != null && envelope.already_completed === false;

  const completeErrorMessage = completeError
    ? (() => {
        const { code } = completeError;
        switch (code) {
          case 'intent_expired':
            return freeClaim
              ? 'Your claim expired.'
              : `Your claim expired. ${goldPaid} gold has been forfeited.`;
          case 'territory_already_claimed':
            return freeClaim
              ? 'Another player claimed this territory while you walked.'
              : `Another player claimed this territory while you walked. ${goldPaid} gold forfeited.`;
          case 'intent_not_found':
            return "Couldn't find your claim. Tap to retry.";
          case 'network_error':
            return 'Lost connection — your claim may have completed. Tap to retry.';
          case 'no_token':
          case 'unauthorized':
            return 'Please sign in again.';
          case 'player_not_found':
          case 'territory_not_found':
          case 'unknown_error':
          default:
            return 'Something went wrong. Tap to retry.';
        }
      })()
    : null;

  const completeErrorRetry = completeError && completeErrorShowsRetry(completeError.code);

  return (
    <View style={styles.screen}>
      <View style={{ flex: 1 }} />

      {completeError ? (
        <Animated.View style={[styles.center, animatedStyle]}>
          <Text style={styles.errorMessage}>{completeErrorMessage}</Text>
          {completeErrorRetry ? (
            <Pressable
              accessibilityRole="button"
              disabled={isRetrying}
              onPress={handleRetry}
              style={({ pressed }) => [
                styles.retryBtn,
                pressed && { opacity: 0.9 },
                isRetrying && { opacity: 0.6 },
              ]}
            >
              <Text style={styles.retryBtnText}>{isRetrying ? 'Retrying…' : 'Retry'}</Text>
            </Pressable>
          ) : null}
        </Animated.View>
      ) : (
        <Animated.View style={[styles.center, animatedStyle]}>
          <View style={styles.iconSquare} />

          <Text style={styles.territory}>{territoryName}</Text>
          <Text style={styles.territoryCaption}>is yours.</Text>
          {showRewardBeats ? (
            <>
              <Text style={styles.goldEarnedBeat}>+{envelope.xp_awarded} SIEGE XP EARNED</Text>
              <Text style={styles.goldEarnedBeat}>+{envelope.resources_awarded.gold} GOLD EARNED</Text>
              {envelope.leveled_up === true ? (
                // TODO: level-up celebration card when design is ready
                null
              ) : null}
            </>
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
      )}

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

  errorMessage: {
    fontFamily: 'Inter_400Regular',
    color: BONE,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    paddingHorizontal: 18,
    marginBottom: 20,
  },

  retryBtn: {
    backgroundColor: CLAIM,
    borderRadius: 0,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },

  retryBtnText: {
    fontFamily: 'GeistMono_500Medium',
    color: BONE,
    fontSize: 12,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
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
