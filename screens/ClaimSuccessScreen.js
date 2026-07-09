import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '@clerk/clerk-expo';
import { useTranslation } from 'react-i18next';
import { completeClaim } from '../lib/claimApi';
import { fetchFirstClaimObjective } from '../lib/firstClaimApi';
import { markFired } from '../lib/walkthroughFlags';
import { maybeExplainResources } from '../lib/resourceIntro';

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
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { userId, getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  useEffect(() => { getTokenRef.current = getToken; }, [getToken]);
  const [isFirstClaim, setIsFirstClaim] = useState(false);

  const {
    territoryName = t('common.territoryFallback'),
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
        if (result.data?.already_completed === false) {
          // First-earn education: gold + XP land on every claim; one lesson max.
          maybeExplainResources(userId, {
            xp: result.data?.xp_awarded,
            gold: result.data?.resources_awarded?.gold,
          });
          // held_count === 1 right after completion means this was the first
          // claim ever — switch the screen to its first-claim variant.
          const objective = await fetchFirstClaimObjective({
            clerkGetToken: () => getTokenRef.current(),
          });
          if (!cancelled && objective.ok && objective.data?.held_count === 1) {
            setIsFirstClaim(true);
            // The first-claim copy already teaches Influence — flag it so the
            // earn-moment toast never repeats the lesson (shared fires-once).
            markFired(userId, 'resource:influence');
          }
        }
      } else {
        setCompleteError({ code: result.code, context: result.context, status: result.status });
      }
    })();
    return () => { cancelled = true; };
  }, [territoryId, playerId, userId]);

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
              ? t('claimSuccess.errIntentExpiredFree')
              : t('claimSuccess.errIntentExpiredPaid', { gold: goldPaid });
          case 'territory_already_claimed':
            return freeClaim
              ? t('claimSuccess.errAlreadyClaimedFree')
              : t('claimSuccess.errAlreadyClaimedPaid', { gold: goldPaid });
          case 'intent_not_found':
            return t('claimSuccess.errIntentNotFound');
          case 'network_error':
            return t('claimSuccess.errNetwork');
          case 'no_token':
          case 'unauthorized':
            return t('claimSuccess.errSignIn');
          case 'player_not_found':
          case 'territory_not_found':
          case 'unknown_error':
          default:
            return t('claimSuccess.errGeneric');
        }
      })()
    : null;

  const completeErrorRetry = completeError && completeErrorShowsRetry(completeError.code);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: INK }}
      contentContainerStyle={[styles.screen, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}
      showsVerticalScrollIndicator={false}
    >
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
              <Text style={styles.retryBtnText}>{isRetrying ? t('claimSuccess.retrying') : t('common.retry')}</Text>
            </Pressable>
          ) : null}
        </Animated.View>
      ) : (
        <Animated.View style={[styles.center, animatedStyle]}>
          <View style={styles.iconSquare} />

          {isFirstClaim ? (
            <Text style={styles.firstClaimKicker}>{t('firstClaim.successKicker')}</Text>
          ) : null}
          <Text style={styles.territory} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.65}>{territoryName}</Text>
          <Text style={styles.territoryCaption}>{t('claimSuccess.isYours')}</Text>
          {showRewardBeats ? (
            <>
              <Text style={styles.goldEarnedBeat}>{t('claimSuccess.xpEarned', { xp: envelope.xp_awarded })}</Text>
              <Text style={styles.goldEarnedBeat}>{t('claimSuccess.goldEarned', { gold: envelope.resources_awarded.gold })}</Text>
              {envelope.leveled_up === true ? (
                // TODO: level-up celebration card when design is ready
                null
              ) : null}
            </>
          ) : null}
          <Text style={styles.message}>
            {isFirstClaim ? t('firstClaim.successBody') : t('claimSuccess.defendIt')}
          </Text>

          <View style={styles.cardsRow}>
            <View style={styles.card}>
              <Text style={styles.cardLabel}>{t('claimSuccess.perimeterLabel')}</Text>
              <Text style={styles.cardValue}>{formatMeters(perimeterDistance)}</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.cardLabel}>{t('claimSuccess.statusLabel')}</Text>
              <Text style={[styles.cardValue, { color: ALLIANCE }]}>{t('claimSuccess.owned')}</Text>
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
                outcome: 'attacker_won',
                role: 'attacker',
                territoryName: 'Test Territory',
                territoryId: 'test-id',
                playerId: 'test-player',
                opponentName: 'Test Opponent',
                attackerAlliance: null,
                myDistance: 1000,
                opponentDistance: 0,
                resourcesAwarded: { iron: 15, stone: 0, gold: 25, morale: 8 },
                xpGained: 300,
                balances: {
                  iron_after: 100,
                  stone_after: 50,
                  gold_after: 200,
                  morale_after: 50,
                  xp_after: 1500,
                  level_after: 5,
                },
                leveledUp: false,
                firstContestWin: false,
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
                outcome: 'defender_won',
                role: 'attacker',
                territoryName: 'Test Territory',
                territoryId: 'test-id',
                playerId: 'test-player',
                opponentName: 'Test Opponent',
                attackerAlliance: null,
                myDistance: 890,
                opponentDistance: 1240,
                resourcesAwarded: { iron: 0, stone: 0, gold: 0, morale: 0 },
                xpGained: 0,
                balances: {
                  iron_after: 100,
                  stone_after: 50,
                  gold_after: 200,
                  morale_after: 50,
                  xp_after: 1500,
                  level_after: 5,
                },
                leveledUp: false,
                firstContestWin: false,
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
                outcome: 'defender_won',
                role: 'defender',
                territoryName: 'Test Territory',
                territoryId: 'test-id',
                playerId: 'test-player',
                opponentName: 'Test Opponent',
                attackerAlliance: null,
                myDistance: 1240,
                opponentDistance: 890,
                resourcesAwarded: { iron: 0, stone: 20, gold: 15, morale: 8 },
                xpGained: 200,
                balances: {
                  iron_after: 100,
                  stone_after: 50,
                  gold_after: 200,
                  morale_after: 50,
                  xp_after: 1500,
                  level_after: 5,
                },
                leveledUp: false,
                firstContestWin: false,
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
                outcome: 'attacker_won',
                role: 'defender',
                territoryName: 'Test Territory',
                territoryId: 'test-id',
                playerId: 'test-player',
                opponentName: 'Test Opponent',
                attackerAlliance: null,
                myDistance: 890,
                opponentDistance: 1240,
                resourcesAwarded: { iron: 0, stone: 0, gold: 0, morale: 0 },
                xpGained: 0,
                balances: {
                  iron_after: 100,
                  stone_after: 50,
                  gold_after: 200,
                  morale_after: 50,
                  xp_after: 1500,
                  level_after: 5,
                },
                leveledUp: false,
                firstContestWin: false,
              })
            }
            style={({ pressed }) => [styles.testBtn, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.testBtnText}>defend_lost</Text>
          </Pressable>
        </View>
      </View>

      {isFirstClaim && !completeError ? (
        // Expansion nudge (spec step 9): claims 2 and 3 stay optional.
        <View style={styles.nudgeCard}>
          <Text style={styles.nudgeTitle}>{t('firstClaim.nudgeTitle')}</Text>
          <View style={styles.nudgeButtonsRow}>
            <Pressable
              accessibilityRole="button"
              onPress={() => navigation.navigate('MainTabs')}
              style={({ pressed }) => [styles.nudgePrimary, pressed && { opacity: 0.9 }]}
            >
              <Text style={styles.ctaText}>{t('firstClaim.claimAnother')}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => navigation.navigate('MainTabs')}
              style={({ pressed }) => [styles.nudgeSecondary, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.nudgeSecondaryText}>{t('firstClaim.enough')}</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('claimSuccess.backToMap')}
          onPress={() => navigation.navigate('MainTabs')}
          style={({ pressed }) => [styles.cta, pressed && { opacity: 0.9 }]}
        >
          <Text style={styles.ctaText}>{t('claimSuccess.backToMap')}</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flexGrow: 1,
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

  firstClaimKicker: {
    fontFamily: 'GeistMono_500Medium',
    color: CLAIM,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    marginBottom: 8,
  },

  nudgeCard: {
    backgroundColor: INK2,
    borderWidth: 1,
    borderColor: HAIRLINE_STRONG,
    borderRadius: 0,
    padding: 14,
  },

  nudgeTitle: {
    fontFamily: 'Inter_500Medium',
    color: BONE,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 12,
  },

  nudgeButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },

  nudgePrimary: {
    flex: 1,
    backgroundColor: CLAIM,
    borderRadius: 0,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  nudgeSecondary: {
    flex: 1,
    backgroundColor: INK,
    borderWidth: 1,
    borderColor: HAIRLINE_STRONG,
    borderRadius: 0,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  nudgeSecondaryText: {
    fontFamily: 'GeistMono_500Medium',
    color: SLATE2,
    fontSize: 12,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
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
