import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '@clerk/clerk-expo';
import { supabase } from '../lib/supabase';
import { getDefendPreview, postDefend } from '../lib/contestDefendApi';

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

export default function DefenderAcceptScreen() {
  const { contestId } = useRoute().params ?? {};
  const navigation = useNavigation();
  const { userId, getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  useEffect(() => { getTokenRef.current = getToken; }, [getToken]);
  const navigatingRef = useRef(false);

  const [loadingPreview, setLoadingPreview] = useState(true);
  const [previewData, setPreviewData] = useState(null);
  const [previewError, setPreviewError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [spendStone, setSpendStone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [myPlayer, setMyPlayer] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchMyPlayer() {
      if (!userId) {
        if (!cancelled) setMyPlayer(null);
        return;
      }

      const { data, error } = await supabase
        .from('players')
        .select('id')
        .eq('clerk_id', userId)
        .maybeSingle();

      if (cancelled) return;
      if (error || !data) {
        setMyPlayer(null);
      } else {
        setMyPlayer(data);
      }
    }

    fetchMyPlayer();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    let cancelled = false;

    async function fetchPreview() {
      if (!contestId) {
        if (!cancelled) {
          setPreviewError({ code: 'missing_contest_id', context: {}, status: 0 });
          setLoadingPreview(false);
        }
        return;
      }

      if (!cancelled) {
        setLoadingPreview(true);
        setPreviewError(null);
      }

      try {
        const result = await getDefendPreview({
          clerkGetToken: () => getTokenRef.current(),
          contestId,
        });

        if (cancelled) return;

        if (result.ok) {
          setPreviewData(result.data);
          setLoadingPreview(false);
        } else {
          setPreviewError({
            code: result.code,
            context: result.context,
            status: result.status,
          });
          setLoadingPreview(false);
        }
      } catch (err) {
        console.error('DefenderAcceptScreen preview fetch:', err);
        if (!cancelled) {
          setPreviewError({ code: 'network_error', context: {}, status: 0 });
          setLoadingPreview(false);
        }
      }
    }

    fetchPreview();

    return () => {
      cancelled = true;
    };
  }, [contestId, retryCount]);

  const canAffordStone = previewData
    ? previewData.current_stone >= previewData.stone_defence_cost
    : false;
  const effectiveSpendStone = spendStone && canAffordStone;
  const selectedRatio = previewData
    ? (effectiveSpendStone
      ? previewData.defender_response_ratio_with_stone
      : previewData.defender_response_ratio_without_stone)
    : 0;
  const snapshotDefenderThreshold = previewData
    ? Math.floor(selectedRatio * previewData.attacker_walked_m)
    : 0;
  const canSubmit = !submitting && !!myPlayer?.id;

  const handleRetry = () => setRetryCount((c) => c + 1);

  const handleToggleStone = () => {
    if (canAffordStone) setSpendStone((s) => !s);
  };

  const handleSubmit = async () => {
    if (!canSubmit || !previewData) return;
    if (navigatingRef.current) return;
    setSubmitting(true);
    setSubmitError(null);
    const result = await postDefend({
      clerkGetToken: () => getTokenRef.current(),
      contestId,
      spendStone: effectiveSpendStone,
      defenderStartingWalkM: 0,
    });
    if (result.ok) {
      navigatingRef.current = true;
      navigation.replace('ActiveClaim', {
        mode: 'contest',
        role: 'defender',
        contestId: previewData.contest_id,
        territoryName: previewData.territory_name,
        playerId: myPlayer.id,
        requiredWalkM: snapshotDefenderThreshold,
        attackerUsername: previewData.attacker_username,
        spendStoneUsed: effectiveSpendStone,
      });
    } else {
      setSubmitError({
        code: result.code,
        context: result.context,
        status: result.status,
      });
      setSubmitting(false);
    }
  };

  const handleCancel = () => navigation.goBack();
  const handleTerminalGotIt = () => navigation.goBack();

  const renderTerminal = (eyebrow, headline, subline) => (
    <View style={styles.screen}>
      <View style={styles.terminalInner}>
        <Text style={[styles.eyebrow, { color: SLATE_2 }]}>{eyebrow}</Text>
        <Text style={styles.headline}>{headline}</Text>
        <Text style={styles.terminalSubline}>{subline}</Text>
      </View>
      <View style={styles.ctaStack}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Got it"
          onPress={handleTerminalGotIt}
          style={({ pressed }) => [styles.ctaPrimary, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.ctaPrimaryText}>GOT IT</Text>
        </Pressable>
      </View>
    </View>
  );

  if (loadingPreview) {
    return (
      <View style={styles.fullScreenCentered}>
        <ActivityIndicator size="large" color={ALLIANCE} />
      </View>
    );
  }

  if (previewError) {
    return (
      <View style={styles.fullScreenCentered}>
        <Text style={styles.errorMessage}>Couldn't load preview</Text>
        <Pressable
          accessibilityRole="button"
          onPress={handleRetry}
          style={({ pressed }) => [styles.retryBtn, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.retryBtnText}>RETRY</Text>
        </Pressable>
      </View>
    );
  }

  if (previewData.defender_player_id !== null) {
    return renderTerminal(
      '▪ ALREADY DEFENDED',
      `@${previewData.defender_username}`,
      'IS DEFENDING THIS.',
    );
  }

  if (previewData.already_past_cutoff) {
    return renderTerminal(
      '▪ DEFENSE CLOSED',
      'Window passed.',
      `Defense closes after ${Math.round(previewData.defend_cutoff_fraction * 100)}% attacker progress.`,
    );
  }

  const progressFraction = previewData.required_walk_m > 0
    ? Math.min(1, previewData.attacker_walked_m / previewData.required_walk_m)
    : 0;

  return (
    <View style={styles.screen}>
      <View style={styles.statusSpacer} />
      <Text style={[styles.eyebrow, { color: ALLIANCE }]}>▪ DEFEND</Text>
      <Text style={styles.territoryName}>{previewData.territory_name.toUpperCase()}</Text>
      <Text style={styles.tierSubtitle}>TIER {previewData.territory_tier}</Text>
      <Text style={styles.attackerLine}>@{previewData.attacker_username} attacking</Text>

      <View style={styles.progressBlock}>
        <View style={styles.progressBar}>
          <View style={[styles.progressBarFill, { flex: progressFraction }]} />
          <View style={[styles.progressBarBg, { flex: 1 - progressFraction }]} />
        </View>
        <Text style={styles.progressText}>
          {previewData.attacker_walked_m}m / {previewData.required_walk_m}m
        </Text>
      </View>

      <View style={[styles.previewRow, !effectiveSpendStone ? styles.previewRowActive : styles.previewRowInactive]}>
        <Text style={styles.previewRowLabel}>MATCH PACE</Text>
        <Text style={styles.previewRowDistance}>
          WALK {Math.floor(previewData.defender_response_ratio_without_stone * previewData.attacker_walked_m)}m
        </Text>
      </View>

      <View style={[styles.previewRow, effectiveSpendStone ? styles.previewRowActive : styles.previewRowInactive]}>
        <Text style={styles.previewRowLabel}>WITH STONE</Text>
        <Text style={styles.previewRowDistance}>
          WALK {Math.floor(previewData.defender_response_ratio_with_stone * previewData.attacker_walked_m)}m
        </Text>
      </View>

      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: effectiveSpendStone, disabled: !canAffordStone }}
        disabled={!canAffordStone}
        onPress={handleToggleStone}
        style={[styles.stoneToggleRow, !canAffordStone && styles.stoneToggleRowDisabled]}
      >
        <Text style={[styles.stoneToggleMarker, effectiveSpendStone && styles.stoneToggleMarkerActive]}>
          {effectiveSpendStone ? '\u25A0' : '\u25A1'}
        </Text>
        <Text style={styles.stoneToggleLabel}>
          SPEND {previewData.stone_defence_cost} STONE
        </Text>
        {!canAffordStone ? (
          <Text style={styles.stoneToggleHelper}>
            NEED {previewData.stone_defence_cost} · HAVE {previewData.current_stone}
          </Text>
        ) : null}
      </Pressable>

      {submitError ? (
        <Text style={styles.submitErrorText}>
          {submitError.code === 'contest_too_advanced' ? 'Defense window just closed.' :
            submitError.code === 'contest_already_defended' ? 'Someone else just accepted.' :
              submitError.code === 'insufficient_stone' ? "You don't have enough stone." :
                submitError.code === 'not_in_defender_alliance' ? "You're not in this alliance anymore." :
                  'Something went wrong. Try again.'}
        </Text>
      ) : null}

      <View style={styles.ctaStack}>
        <Pressable
          accessibilityRole="button"
          disabled={!canSubmit}
          onPress={handleSubmit}
          style={({ pressed }) => [
            styles.ctaPrimary,
            pressed && { opacity: 0.92 },
            !canSubmit && styles.ctaDisabled,
          ]}
        >
          {submitting ? (
            <ActivityIndicator size="small" color={BONE} />
          ) : (
            <Text style={styles.ctaPrimaryText}>ACCEPT DEFENSE</Text>
          )}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={submitting}
          onPress={handleCancel}
          style={({ pressed }) => [styles.ctaSecondary, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.ctaSecondaryText}>CANCEL</Text>
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
  fullScreenCentered: {
    flex: 1,
    backgroundColor: INK,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 24,
  },
  errorMessage: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 11,
    letterSpacing: 1.4,
    color: SLATE_2,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  retryBtn: {
    borderWidth: 1,
    borderColor: CLAIM,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  retryBtnText: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 11,
    letterSpacing: 1.6,
    color: CLAIM,
    textTransform: 'uppercase',
  },
  tierSubtitle: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 11,
    color: SLATE_2,
    letterSpacing: 1.4,
    textAlign: 'center',
    marginBottom: 8,
  },
  attackerLine: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 12,
    color: BONE,
    letterSpacing: 0.4,
    textAlign: 'center',
    marginBottom: 24,
  },
  progressBlock: {
    marginBottom: 24,
  },
  progressBar: {
    flexDirection: 'row',
    height: 6,
    marginBottom: 8,
  },
  progressBarFill: {
    backgroundColor: ALLIANCE,
  },
  progressBarBg: {
    backgroundColor: HAIRLINE_STRONG,
  },
  progressText: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 10,
    color: SLATE,
    letterSpacing: 1,
    textAlign: 'center',
  },
  previewRow: {
    borderLeftWidth: 2,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  previewRowActive: {
    backgroundColor: ALLIANCE_SOFT,
    borderLeftColor: ALLIANCE,
  },
  previewRowInactive: {
    backgroundColor: INK_2,
    borderLeftColor: HAIRLINE,
  },
  previewRowLabel: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 11,
    color: BONE,
    letterSpacing: 1.6,
  },
  previewRowDistance: {
    fontFamily: 'Archivo_700Bold',
    fontSize: 16,
    color: BONE,
    letterSpacing: -0.5,
  },
  stoneToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
    marginTop: 8,
    marginBottom: 16,
  },
  stoneToggleRowDisabled: {
    opacity: 0.4,
  },
  stoneToggleMarker: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 18,
    color: SLATE_2,
  },
  stoneToggleMarkerActive: {
    color: ALLIANCE,
  },
  stoneToggleLabel: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 11,
    color: BONE,
    letterSpacing: 1.6,
  },
  stoneToggleHelper: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 10,
    color: SLATE_2,
    letterSpacing: 1.2,
    marginLeft: 'auto',
  },
  submitErrorText: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 11,
    color: CLAIM,
    letterSpacing: 0.4,
    textAlign: 'center',
    marginBottom: 12,
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
  ctaDisabled: {
    opacity: 0.4,
  },
  terminalInner: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  terminalSubline: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 11,
    color: SLATE,
    letterSpacing: 0.4,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 24,
  },
});
