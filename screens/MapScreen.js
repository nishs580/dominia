import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import MapboxGL from '@rnmapbox/maps';
import { useAuth } from '@clerk/clerk-expo';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { startClaim } from '../lib/claimApi';
import { startContest } from '../lib/contestWalkApi';
import { supabase } from '../lib/supabase';
import * as F from '../lib/formulas';
import {
  developmentName,
  formatChangedHands,
  formatHeldDays,
  formatHolderCount,
  getLegacyRankForTerritory,
  getTerritoryHistoryStats,
  streakReductionPercent,
  streakTierName,
} from '../lib/territory';
import {
  IronGlyph,
  StoneGlyph,
  GoldGlyph,
  MoraleGlyph,
} from '../components/ResourceGlyphs';
import ActivityLogSideRail from '../components/ActivityLogSideRail';
import LeaderboardsSideRail from '../components/LeaderboardsSideRail';
import ChatSideRail from '../components/ChatSideRail';

function territoryCapForLevel(level) {
  const lv = Math.min(10, Math.max(1, level | 0));
  return F.calcTerritoryCapForLevel(lv);
}

MapboxGL.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '');

const AMSTERDAM_CENTER = [4.9041, 52.3676];
const INITIAL_ZOOM = 14;

const INK = '#0E1014';
const INK2 = '#1A1D24';
const BONE = '#F2EEE6';
const SLATE = '#5C6068';
const SLATE2 = '#8B8F98';
const CLAIM = '#D64525';
const ALLIANCE = '#3F8F4E';
const ENEMY = '#4A6B8A';
const UNCLAIMED = 'transparent';
const HAIRLINE = 'rgba(242,238,230,0.08)';
const HAIRLINE_STRONG = 'rgba(242,238,230,0.16)';
const CLAIM_SOFT = 'rgba(214,69,37,0.14)';

function liveCountdown(expiresAtIso) {
  const remainingMs = Math.max(0, new Date(expiresAtIso).getTime() - Date.now());
  const totalSec = Math.floor(remainingMs / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min > 0) return `${min} min`;
  return `${sec} sec`;
}

function topBannerMessageForContestCode(code) {
  switch (code) {
    case 'player_not_found':
      return "Couldn't load your account. Try again.";
    case 'territory_not_found':
      return 'This territory no longer exists.';
    case 'invalid_tier':
      return "Couldn't load territory data. Try again.";
    case 'defender_not_found':
    case 'no_perimeter':
    case 'owner_level_unavailable':
      return "Couldn't load contest data. Try again.";
    case 'network_error':
    case 'no_token':
      return 'Network issue. Try again.';
    default:
      return 'Something went wrong. Try again.';
  }
}

function contestStartErrorMessage(error) {
  if (!error) return null;
  const { code, context = {} } = error;
  switch (code) {
    case 'no_territory_owner':
      return 'Territory is no longer owned. Try claiming it instead.';
    case 'cannot_contest_own':
      return "You can't contest your own territory.";
    case 'territory_protected':
      switch (context.reason) {
        case 'new_owner_protection':
          return 'Newly claimed — protected for 24 hours.';
        case 'defense_protection':
          return 'Recently defended — protected for 4 hours.';
        case 'alliance_protection':
          return 'Owner is in your alliance.';
        default:
          return 'This territory is protected.';
      }
    case 'level_too_low':
      return `Reach level ${context.required_level} to contest a ${context.tier} territory.`;
    case 'outside_contest_hours':
      return 'Contests run 05:00–22:59 in your local time.';
    case 'insufficient_iron':
      return 'Need more iron.';
    default:
      return null;
  }
}

function TerritorySheet({ territory, onClose, userId, onTerritoriesRefetched, onResourceBannerRefresh, myPlayer, setMyPlayer, getTokenRef, showTopBanner, allFeatures = [] }) {
  const navigation = useNavigation();
  const [expanded, setExpanded] = useState(false);
  const [sheetState, setSheetState] = useState('info'); // 'info' | 'confirm'
  const [contestMode, setContestMode] = useState(false);
  const [startError, setStartError] = useState(null);
  const [contestStartError, setContestStartError] = useState(null);
  const [contestAlreadyActiveInfo, setContestAlreadyActiveInfo] = useState(null);
  const [isDeducting, setIsDeducting] = useState(false);
  const [isAttacking, setIsAttacking] = useState(false);
  const [, tickClock] = useState(0);
  const [legacyRank, setLegacyRank] = useState(null);
  const [historyStats, setHistoryStats] = useState({
    heldDays: null,
    changedHands: 0,
    currentClaimedAt: null,
    holderCount: 0,
  });

  useEffect(() => {
    setSheetState('info');
    setContestMode(false);
    setStartError(null);
    setContestStartError(null);
    setContestAlreadyActiveInfo(null);
    setIsDeducting(false);
    setIsAttacking(false);
  }, [territory?.id]);

  useEffect(() => {
    if (startError?.code === 'territory_being_claimed' || startError?.code === 'active_claim_in_progress') {
      const id = setInterval(() => tickClock((n) => n + 1), 1000);
      return () => clearInterval(id);
    }
  }, [startError?.code]);

  useEffect(() => {
    if (!territory?.id) {
      setLegacyRank(null);
      setHistoryStats({ heldDays: null, changedHands: 0, currentClaimedAt: null, holderCount: 0 });
      return;
    }
    let cancelled = false;
    Promise.all([
      getLegacyRankForTerritory(territory.id),
      getTerritoryHistoryStats(territory.id),
    ]).then(([legacyRankResult, historyStatsResult]) => {
      if (!cancelled) {
        setLegacyRank(legacyRankResult);
        setHistoryStats(historyStatsResult);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [territory?.id]);

  if (!territory) return null;

  const name = territory.properties?.name ?? 'Territory';
  const ownerRaw = territory.properties?.owner;
  const isUnclaimed = ownerRaw == null || ownerRaw === 'Unclaimed';
  const owner = !isUnclaimed ? ownerRaw : null;

  const tier = territory.properties?.tier ?? 'Medium';
  const developmentLevel = territory.properties?.developmentLevel ?? 0;
  const alliance = territory.properties?.alliance ?? null;
  const ownerStreakDays = territory.properties?.ownerStreak ?? 0;

  const perimeterDistanceRaw = territory.properties?.perimeterDistance ?? territory.properties?.perimeter ?? 0;
  const perimeterDistance =
    typeof perimeterDistanceRaw === 'number'
      ? perimeterDistanceRaw
      : Number(String(perimeterDistanceRaw).replace(/[^\d.]/g, '')) || 0;

  const isYours = territory.properties?.color === '#D64525' || territory.properties?.color === '#3F8F4E';
  const isOwnTerritory = territory.properties?.color === '#D64525';
  const isAllianceTerritory = territory.properties?.color === '#3F8F4E';
  const isOwned = !isUnclaimed;

  // Top border colour reflects territory state
  let topBorderColour = '#5C6068'; // unclaimed default (Slate)
  if (isOwnTerritory) topBorderColour = '#D64525';
  else if (isAllianceTerritory) topBorderColour = '#3F8F4E';
  else if (isOwned) topBorderColour = '#4A6B8A';

  // Label above territory name
  let stateLabel = 'Unclaimed territory';
  if (isOwnTerritory) stateLabel = 'Your territory';
  else if (isAllianceTerritory) stateLabel = 'Alliance territory';
  else if (isOwned) stateLabel = 'Enemy territory';

  const playerXp = Math.max(0, Math.floor(Number(myPlayer?.xp) || 0));
  const cap = territoryCapForLevel(F.calcLevel(playerXp));
  const heldCount = allFeatures.filter(f => f.properties?.color === '#D64525').length;
  const isAtCap = heldCount >= cap;

  // Owner's streak tier (deterrent signal)
  const ownerStreakTier = F.getStreakTier(ownerStreakDays);

  // Your streak
  const myStreak = myPlayer?.current_streak ?? 0;

  // Influence per day (upkeepOverdue: false === former upkeepActive: true)
  const influence = Math.round(
    F.calcDailyInfluence({
      tier: F.normaliseTier(tier),
      developmentLevel,
      legacyRank: legacyRank ?? 1,
      upkeepOverdue: false,
    })
  );

  // Walk distance for contest
  const walkDistance = isOwned
    ? F.calcRequiredContestWalk({
        territory: {
          tier: F.normaliseTier(tier),
          perimeterMeters: perimeterDistance,
          developmentLevel,
        },
        attacker: {
          streakDays: myStreak,
          usedSiegeBoost: false,
          allianceBuffs: [],
        },
        defender: { streakDays: ownerStreakDays },
      })
    : Math.round(perimeterDistance);

  const reductionPct = streakReductionPercent(myStreak);

  // Iron cost by tier
  const ironCost = { small: 8, medium: 20, large: 45, epic: 80 }[tier.toLowerCase()] ?? 20;

  const walkLabel = isOwned ? 'Walk to contest' : 'Walk to claim';

  const selectedTerritory = {
    name,
    perimeter: perimeterDistance,
  };

  const goldCost = isUnclaimed ? F.CLAIM_GOLD_COST[F.normaliseTier(tier)] : 0;
  const currentGold = myPlayer?.gold ?? 0;
  const balanceAfter = currentGold - goldCost;
  const canAfford = currentGold >= goldCost;

  const currentIron = myPlayer?.iron ?? 0;
  const ironBalanceAfter = currentIron - ironCost;
  const canAffordContest = currentIron >= ironCost;

  const startErrorMessage = startError
    ? (() => {
        const { code, context } = startError;
        switch (code) {
          case 'level_too_low':
            return `Reach level ${context.required_level} to claim ${tier} territories`;
          case 'insufficient_gold':
            return `Need ${context.required_gold - context.player_gold} more gold`;
          case 'territory_already_claimed':
            return 'This territory was just claimed';
          case 'territory_being_claimed':
            return `Available in ${liveCountdown(context.expires_at)} - another player is claiming`;
          case 'active_claim_in_progress':
            return `You're walking for another territory. Finish or wait ${liveCountdown(context.expires_at)} for expiry.`;
          case 'network_error':
            return 'Lost connection. Tap to retry.';
          case 'no_token':
          case 'unauthorized':
            return 'Please sign in again.';
          default:
            return "Couldn't start claim. Tap to retry.";
        }
      })()
    : null;

  const startErrorAllowsRetry = startError
    && !['level_too_low', 'insufficient_gold', 'territory_already_claimed', 'active_claim_in_progress', 'no_token', 'unauthorized'].includes(startError.code);

  const handleAcceptClaim = async () => {
    setIsDeducting(true);
    setStartError(null);
    try {
      const result = await startClaim({
        clerkGetToken: () => getTokenRef.current(),
        territoryId: territory.id,
      });
      if (result.ok) {
        setMyPlayer((prev) => (prev ? { ...prev, gold: result.data.gold_balance_after } : prev));
        onClose?.();
        navigation.navigate('ActiveClaim', {
          territoryName: selectedTerritory.name,
          perimeterDistance: selectedTerritory.perimeter,
          territoryId: territory.id,
          playerId: myPlayer?.id,
          goldPaid: result.data.gold_paid,
          freeClaim: result.data.free_claim,
        });
      } else {
        setStartError({ code: result.code, context: result.context, status: result.status });
      }
    } finally {
      setIsDeducting(false);
    }
  };

  const handleAcceptContest = async () => {
    setIsAttacking(true);
    setContestStartError(null);
    setContestAlreadyActiveInfo(null);
    try {
      const result = await startContest({
        clerkGetToken: () => getTokenRef.current(),
        territoryId: territory.id,
      });
      if (result.ok) {
        const env = result.data;
        onClose();
        navigation.navigate('ActiveClaim', {
          mode: 'contest',
          territoryName: selectedTerritory.name,
          territoryId: territory.id,
          contestId: env.contest_id,
          requiredWalkM: env.required_walk_m,
          attackerAllianceId: env.attacker_alliance_id,
          playerId: myPlayer?.id,
        });
      } else {
        const { code, context } = result;
        if (code === 'contest_already_active') {
          setContestAlreadyActiveInfo({
            attacker_username: context?.attacker_username ?? 'someone',
            attack_day_date: context?.attack_day_date ?? '',
          });
        } else if (contestStartErrorMessage({ code, context })) {
          setContestStartError({ code, context });
        } else {
          showTopBanner?.(topBannerMessageForContestCode(code));
        }
      }
    } finally {
      setIsAttacking(false);
    }
  };

  return (
    <View style={[styles.sheet, { borderTopColor: topBorderColour, borderTopWidth: 1 }]}>
      <View style={styles.sheetHandle} />

      <View style={styles.sheetTopRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sheetStateLabel}>
            {sheetState === 'confirm' ? (contestMode ? 'Contest' : 'Claim') : stateLabel}
          </Text>
          <View style={styles.sheetTitleRow}>
            <Text style={styles.sheetTitle}>{name}</Text>
            <View style={styles.sheetTierBadge}>
              <Text style={styles.sheetTierBadgeText}>{tier}</Text>
            </View>
          </View>
        </View>
        <Pressable accessibilityRole="button" onPress={onClose} style={styles.sheetClose}>
          <Text style={styles.sheetCloseText}>×</Text>
        </Pressable>
      </View>

      {sheetState === 'info' && (
        <>
          {/* Primary intel rows */}
          <View style={styles.sheetIntelBlock}>
            {!isUnclaimed && (
              <View style={styles.sheetRow}>
                <Text style={styles.sheetRowLabel}>Owner</Text>
                <Text style={styles.sheetRowValue}>
                  {owner}
                  {alliance ? <Text style={styles.sheetAllianceTag}> [{alliance}]</Text> : null}
                </Text>
              </View>
            )}
            {!isUnclaimed && (
              <View style={styles.sheetRow}>
                <Text style={styles.sheetRowLabel}>Streak</Text>
                <Text style={[styles.sheetRowValue, ownerStreakDays >= 30 && { color: '#D64525' }]}>
                  {streakTierName(ownerStreakTier.tier)}
                </Text>
              </View>
            )}
            <View style={styles.sheetRow}>
              <Text style={styles.sheetRowLabel}>{walkLabel}</Text>
              <Text style={styles.sheetRowValue}>{walkDistance.toLocaleString()}m</Text>
            </View>
          </View>

          {/* Influence hero row */}
          <View style={styles.sheetInfluenceRow}>
            <View>
              <Text style={styles.sheetInfluenceLabel}>Generates</Text>
              <Text style={styles.sheetInfluenceSub}>Influence per day</Text>
            </View>
            <Text style={styles.sheetInfluenceValue}>+{influence}</Text>
          </View>

          {/* Expanded detail */}
          {expanded && (
            <View style={styles.sheetExpandedBlock}>
              <View style={styles.sheetRow}>
                <Text style={styles.sheetRowLabel}>Development</Text>
                <Text style={styles.sheetRowValue}>
                  D{developmentLevel} · {developmentName(developmentLevel)}
                </Text>
              </View>
              <View style={styles.sheetRow}>
                <Text style={styles.sheetRowLabel}>Legacy</Text>
                <Text style={styles.sheetRowValue}>
                  {legacyRank == null ? '—' : `R${legacyRank} · ${F.legacyRankName(legacyRank)}`}
                </Text>
              </View>
              {!isUnclaimed && (
                <>
                  {formatHeldDays(historyStats.heldDays) !== null && (
                    <View style={styles.sheetRow}>
                      <Text style={styles.sheetRowLabel}>Held</Text>
                      <Text style={styles.sheetRowValue}>{formatHeldDays(historyStats.heldDays)}</Text>
                    </View>
                  )}
                  <View style={styles.sheetRow}>
                    <Text style={styles.sheetRowLabel}>Changed hands</Text>
                    <Text style={styles.sheetRowValue}>{formatChangedHands(historyStats.changedHands)}</Text>
                  </View>
                  <View style={styles.sheetRow}>
                    <Text style={styles.sheetRowLabel}>Hall of Holders</Text>
                    <Text style={styles.sheetRowValue}>{formatHolderCount(historyStats.holderCount)}</Text>
                  </View>
                </>
              )}

              {/* Your walk block — only when it's an attackable territory */}
              {isOwned && !isYours && (
                <View style={styles.sheetYourWalk}>
                  <Text style={styles.sheetYourWalkLabel}>Your walk</Text>
                  <Text style={styles.sheetYourWalkValue}>
                    {walkDistance.toLocaleString()}m · {ironCost} Iron
                  </Text>
                  {reductionPct > 0 && (
                    <Text style={styles.sheetYourWalkSub}>
                      Your {myStreak}-day streak reduces this by {reductionPct}%.
                    </Text>
                  )}
                </View>
              )}
            </View>
          )}

          {/* Expand toggle — text only per brand rules */}
          <Pressable accessibilityRole="button" onPress={() => setExpanded(e => !e)} style={styles.sheetToggle}>
            <Text style={styles.sheetToggleText}>{expanded ? 'Less' : 'More'}</Text>
          </Pressable>

          {/* Action buttons — kept from original logic */}
          {isUnclaimed && !isAtCap && (
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [styles.sheetAction, pressed && { opacity: 0.92 }]}
              onPress={() => setSheetState('confirm')}
            >
              <Text style={styles.sheetActionText}>Claim</Text>
            </Pressable>
          )}

          {isUnclaimed && isAtCap && (
            <View style={styles.sheetActionDisabled}>
              <Text style={styles.sheetActionDisabledText}>Cap reached</Text>
              <Text style={styles.sheetActionDisabledSub}>Level up to claim more territories</Text>
            </View>
          )}

          {isOwnTerritory && !isAllianceTerritory && (
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.sheetAction,
                { backgroundColor: '#D64525', opacity: 0.7 },
                pressed && { opacity: 0.92 },
              ]}
              onPress={() => {
                Alert.alert(`Abandon ${name}?`, 'You will lose control of this territory. This cannot be undone.', [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Abandon',
                    style: 'destructive',
                    onPress: async () => {
                      const { error } = await supabase
                        .from('territories')
                        .update({ owner_id: null, alliance_id: null })
                        .eq('id', territory.id)
                        .select();
                      if (error) {
                        console.error('Abandon territory failed:', error);
                        return;
                      }
                      onClose();
                      onTerritoriesRefetched?.(territory.id);
                    },
                  },
                ]);
              }}
            >
              <Text style={styles.sheetActionText}>Abandon</Text>
            </Pressable>
          )}

          {isOwned && !isYours && !isAllianceTerritory && (
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [styles.sheetAction, { backgroundColor: '#4A6B8A' }, pressed && { opacity: 0.92 }]}
              onPress={() => {
                setContestMode(true);
                setSheetState('confirm');
              }}
            >
              <Text style={styles.sheetActionText}>Contest</Text>
            </Pressable>
          )}
        </>
      )}

      {sheetState === 'confirm' && (
        <>
          {(contestMode ? canAffordContest : canAfford) ? (
            <>
              <View style={styles.sheetConfirmDataBlock}>
                <View style={styles.sheetConfirmDataRow}>
                  <Text style={styles.sheetConfirmLabel}>Cost</Text>
                  <Text style={styles.sheetConfirmValue}>
                    {contestMode ? `${ironCost} Iron` : `${goldCost} Gold`}
                  </Text>
                </View>
                <View style={styles.sheetConfirmDataRow}>
                  <Text style={styles.sheetConfirmLabel}>Balance after</Text>
                  <Text style={styles.sheetConfirmValue}>
                    {contestMode ? `${ironBalanceAfter} Iron` : `${balanceAfter} Gold`}
                  </Text>
                </View>
              </View>

              {contestMode && contestStartError && (
                <Text style={styles.sheetConfirmError}>
                  {contestStartErrorMessage(contestStartError)}
                </Text>
              )}

              {!contestMode && startError && (
                <Text style={styles.sheetConfirmError}>{startErrorMessage}</Text>
              )}

              {contestMode && contestAlreadyActiveInfo && (
                <View style={styles.sheetContestActiveCard}>
                  <Text style={styles.sheetContestActiveText}>
                    {`@${contestAlreadyActiveInfo.attacker_username} is contesting this until ${contestAlreadyActiveInfo.attack_day_date}.`}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    style={({ pressed }) => [
                      styles.sheetAction,
                      pressed && { opacity: 0.92 },
                    ]}
                    onPress={() => setContestAlreadyActiveInfo(null)}
                  >
                    <Text style={styles.sheetActionText}>Got it</Text>
                  </Pressable>
                </View>
              )}

              {!contestMode && startError && startErrorAllowsRetry ? (
                <Pressable
                  accessibilityRole="button"
                  disabled={isDeducting}
                  style={({ pressed }) => [
                    styles.sheetAction,
                    pressed && { opacity: 0.92 },
                    isDeducting && { opacity: 0.6 },
                  ]}
                  onPress={handleAcceptClaim}
                >
                  <Text style={styles.sheetActionText}>{isDeducting ? 'Processing…' : 'Retry'}</Text>
                </Pressable>
              ) : !(!contestMode && startError && !startErrorAllowsRetry) && !(contestMode && contestAlreadyActiveInfo) ? (
                <Pressable
                  accessibilityRole="button"
                  disabled={contestMode ? isAttacking : isDeducting}
                  style={({ pressed }) => [
                    styles.sheetAction,
                    pressed && { opacity: 0.92 },
                    (contestMode ? isAttacking : isDeducting) && { opacity: 0.6 },
                  ]}
                  onPress={contestMode ? handleAcceptContest : handleAcceptClaim}
                >
                  <Text style={styles.sheetActionText}>
                    {(contestMode ? isAttacking : isDeducting) ? 'Processing…' : 'Accept and continue'}
                  </Text>
                </Pressable>
              ) : null}

              <Pressable
                accessibilityRole="button"
                style={({ pressed }) => [styles.sheetCancel, pressed && { opacity: 0.92 }]}
                onPress={() => {
                  setSheetState('info');
                  setStartError(null);
                  setContestStartError(null);
                  setContestAlreadyActiveInfo(null);
                }}
              >
                <Text style={styles.sheetCancelText}>Cancel</Text>
              </Pressable>
            </>
          ) : (
            <>
              <View style={styles.sheetConfirmDataBlock}>
                <View style={styles.sheetConfirmDataRow}>
                  <Text style={styles.sheetConfirmLabel}>Short by</Text>
                  <Text style={styles.sheetConfirmValue}>
                    {contestMode ? `${ironCost - currentIron} Iron` : `${goldCost - currentGold} Gold`}
                  </Text>
                </View>
                <Text style={styles.sheetConfirmHelpText}>
                  {contestMode
                    ? 'Earn Iron by completing daily challenges.'
                    : 'Earn Gold by completing daily challenges.'}
                </Text>
              </View>

              <Pressable
                accessibilityRole="button"
                style={({ pressed }) => [styles.sheetAction, pressed && { opacity: 0.92 }]}
                onPress={() => {
                  setSheetState('info');
                  onClose();
                  navigation.navigate('Activity');
                }}
              >
                <Text style={styles.sheetActionText}>Go to Activity</Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                style={({ pressed }) => [styles.sheetCancel, pressed && { opacity: 0.92 }]}
                onPress={() => setSheetState('info')}
              >
                <Text style={styles.sheetCancelText}>Cancel</Text>
              </Pressable>
            </>
          )}
        </>
      )}
    </View>
  );
}

export default function MapScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const cameraRef = useRef(null);
  const mapRef = useRef(null);
  const idleTimeoutRef = useRef(null);
  const abortControllerRef = useRef(null);
  const abortControllerStartRef = useRef(0);
  const lastBoundsRef = useRef(null);
  // Cache of all loaded territory features, keyed by id.
  // New fetches merge into this map; render derives FeatureCollection from it.
  // Bounded to ~3000 entries — when exceeded, evict features outside last viewport.
  const featureCacheRef = useRef(new Map());
  const previousAllianceIdRef = useRef(undefined);
  const [lastUserCoord, setLastUserCoord] = useState(null);
  const [selected, setSelected] = useState(null);
  const [territories, setTerritories] = useState({ type: 'FeatureCollection', features: [] });
  const [myAllianceName, setMyAllianceName] = useState(null);
  const [myPlayer, setMyPlayer] = useState(null);
  const [topBannerMessage, setTopBannerMessage] = useState(null);
  const topBannerTimerRef = useRef(null);
  const { userId, getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  useEffect(() => { getTokenRef.current = getToken; }, [getToken]);

  const showTopBanner = useCallback((message) => {
    setTopBannerMessage(message);
  }, []);

  useEffect(() => {
    if (!topBannerMessage) return undefined;
    if (topBannerTimerRef.current) clearTimeout(topBannerTimerRef.current);
    topBannerTimerRef.current = setTimeout(() => setTopBannerMessage(null), 5000);
    return () => {
      if (topBannerTimerRef.current) clearTimeout(topBannerTimerRef.current);
    };
  }, [topBannerMessage]);

  useEffect(() => {
    const msg = route?.params?.topBannerMessage;
    if (msg) {
      showTopBanner(msg);
      navigation.setParams({ topBannerMessage: undefined });
    }
  }, [route?.params?.topBannerMessage]);

  const resourcePlayerId = myPlayer?.id;

  const fetchResourceBanner = useCallback(async () => {
    if (!resourcePlayerId) return;
    const { data, error } = await supabase
      .from('players')
      .select('iron, stone, gold, morale')
      .eq('id', resourcePlayerId)
      .single();
    if (error) {
      return;
    }
    setMyPlayer(prev => (prev ? { ...prev, ...data } : prev));
  }, [resourcePlayerId]);

  const signedArea = (ring) => {
    let s = 0;
    for (let i = 0; i < ring.length - 1; i++) {
      s += (ring[i + 1][0] - ring[i][0]) * (ring[i + 1][1] + ring[i][1]);
    }
    return s;
  };

  const ensureCCWOuterRing = (geom) => {
    if (!geom || geom.type !== 'Polygon' || !geom.coordinates?.[0]) return geom;
    const outer = geom.coordinates[0];
    if (signedArea(outer) > 0) {
      // Clockwise — reverse to make it CCW
      return {
        ...geom,
        coordinates: [outer.slice().reverse(), ...geom.coordinates.slice(1)],
      };
    }
    return geom;
  };

  const fetchPlayer = useCallback(async () => {
    const { data: playerRow } = await supabase
      .from('players')
      .select('id, alliance_id, xp, current_streak, iron, stone, gold, morale')
      .eq('clerk_id', userId)
      .maybeSingle();
    setMyPlayer(playerRow);

    if (playerRow?.alliance_id) {
      const { data: allianceRow } = await supabase
        .from('alliances')
        .select('name')
        .eq('id', playerRow.alliance_id)
        .maybeSingle();
      setMyAllianceName(allianceRow?.name ?? null);
    } else {
      setMyAllianceName(null);
    }
  }, [userId]);

  const fetchTerritoriesForViewport = useCallback(async (bounds, zoomArg) => {
    if (!bounds || !Array.isArray(bounds) || bounds.length < 2) return;
    console.log('[vp fetch] START', { min_lon: bounds[1][0], min_lat: bounds[1][1], max_lon: bounds[0][0], max_lat: bounds[0][1], zoom: zoomArg });
    lastBoundsRef.current = bounds;

    const zoom =
      typeof zoomArg === 'number' && Number.isFinite(zoomArg) ? zoomArg : 14;

    // getVisibleBounds returns [[neLon, neLat], [swLon, swLat]]
    const [ne, sw] = bounds;
    const min_lon = sw[0];
    const min_lat = sw[1];
    const max_lon = ne[0];
    const max_lat = ne[1];

    // Only abort if the in-flight fetch is older than 1s. Recent fetches are
    // likely seconds from completing — let them populate the cache for areas
    // the user panned through, rather than unconditionally cancelling.
    const now = Date.now();
    const inFlightAge = now - abortControllerStartRef.current;
    if (abortControllerRef.current && inFlightAge > 1000) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // If a recent fetch is still in flight, do not start a new one — let it finish.
    if (abortControllerRef.current) {
      console.log('[vp fetch] SKIP (recent in-flight, age', inFlightAge, 'ms)');
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    abortControllerStartRef.current = now;

    let data;
    let error;
    try {
      const res = await supabase
        .rpc('get_territories_in_viewport', {
          min_lon,
          min_lat,
          max_lon,
          max_lat,
          zoom,
        })
        .abortSignal(controller.signal);
      data = res.data;
      error = res.error;
    } catch (err) {
      if (err?.name === 'AbortError' || err?.code === '20' || err?.code === 20) {
        console.log('[vp fetch] ABORTED (caught in catch)');
        abortControllerRef.current = null;
        return;
      }
      console.log('[vp fetch] THREW', err?.message);
      throw err;
    }

    if (
      error?.name === 'AbortError' ||
      error?.code === '20' ||
      error?.code === 20
    ) {
      console.log('[vp fetch] ABORTED (returned as error)');
      abortControllerRef.current = null;
      return;
    }

    if (error) {
      console.log('[vp fetch] ERROR', error.message);
      abortControllerRef.current = null;
      return;
    }
    const rows = data ?? [];

    if (rows.length > 0) {
      const sample = rows[0];
    }

    const features = rows.map((t) => {
      return {
        type: 'Feature',
        id: t.id,
        properties: {
          name: t.territory_name,
          owner: t.owner_username ?? 'Unclaimed',
          alliance: t.alliance_short_name ?? null,
          tier: t.tier ?? 'Medium',
          level: `D${t.development_level ?? 0}`,
          ownerStreak: t.owner_streak_days ?? 0,
          developmentLevel: t.development_level ?? 0,
          perimeter: t.perimeter_distance,
          color: t.owner_clerk_id === userId ? '#D64525' :
            (myPlayer?.alliance_id && t.alliance_id === myPlayer.alliance_id) ? '#3F8F4E' :
            t.owner_id != null ? '#4A6B8A' : 'transparent',
        },
        geometry: t.geojson ? ensureCCWOuterRing(t.geojson) : {
          type: 'Polygon',
          coordinates: [[
            [t.longitude - 0.003, t.latitude + 0.002],
            [t.longitude + 0.003, t.latitude + 0.002],
            [t.longitude + 0.003, t.latitude - 0.002],
            [t.longitude - 0.003, t.latitude - 0.002],
            [t.longitude - 0.003, t.latitude + 0.002],
          ]],
        },
      };
    });
    // Merge new features into cache by id (last write wins per feature)
    const cache = featureCacheRef.current;
    for (const feat of features) {
      cache.set(feat.id, feat);
    }

    // Bound cache size: if over 3000, evict features whose first vertex falls
    // outside the current viewport (keep what the player is looking at)
    if (cache.size > 3000) {
      for (const [id, feat] of cache) {
        const coords = feat.geometry?.coordinates?.[0];
        if (!coords || coords.length === 0) continue;
        const [lon, lat] = coords[0];
        const inView =
          lon >= min_lon && lon <= max_lon && lat >= min_lat && lat <= max_lat;
        if (!inView) cache.delete(id);
        if (cache.size <= 3000) break;
      }
    }

    console.log('[vp fetch] OK', { newRows: rows.length, cacheSize: cache.size });
    abortControllerRef.current = null;
    setTerritories({
      type: 'FeatureCollection',
      features: Array.from(cache.values()),
    });
  }, [userId, myPlayer?.alliance_id]);

  useEffect(() => {
    fetchPlayer();
  }, [fetchPlayer]);

  useEffect(() => {
    const currentAllianceId = myPlayer?.alliance_id ?? null;
    const previous = previousAllianceIdRef.current;
    if (previous !== undefined && previous !== currentAllianceId) {
      // Alliance affiliation changed (joined, left, or kicked). Invalidate full cache and refetch.
      featureCacheRef.current.clear();
      if (lastBoundsRef.current) {
        (async () => {
          let zoom = 14;
          if (mapRef.current) {
            try {
              const z = await mapRef.current.getZoom();
              if (z != null) zoom = z;
            } catch {}
          }
          fetchTerritoriesForViewport(lastBoundsRef.current, zoom);
        })();
      }
    }
    previousAllianceIdRef.current = currentAllianceId;
  }, [myPlayer?.alliance_id, fetchTerritoriesForViewport]);

  const onCameraChanged = useCallback((state) => {
    if (state?.gestures?.isGestureActive === true) {
      return;
    }
    if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
    idleTimeoutRef.current = setTimeout(async () => {
      try {
        if (!mapRef.current) return;
        const map = mapRef.current;
        const zoomSafe = async () => {
          try {
            const z = await map.getZoom();
            if (z == null || z === undefined) return 14;
            return z;
          } catch {
            return 14;
          }
        };
        const [bounds, zoom] = await Promise.all([
          map.getVisibleBounds(),
          zoomSafe(),
        ]);
        if (!bounds) {
          console.log('[viewport fetch] no bounds from getVisibleBounds');
          return;
        }
        fetchTerritoriesForViewport(bounds, zoom);
      } catch (err) {
        console.log('[viewport fetch] getVisibleBounds threw:', err?.message);
      }
    }, 150);
  }, [fetchTerritoriesForViewport]);

  const handleTerritoriesRefetched = useCallback(async (territoryId) => {
    if (territoryId) {
      featureCacheRef.current.delete(territoryId);
    }
    if (!lastBoundsRef.current) return;
    let zoom = 14;
    if (mapRef.current) {
      try {
        const z = await mapRef.current.getZoom();
        if (z != null && z !== undefined) zoom = z;
      } catch {
        zoom = 14;
      }
    }
    fetchTerritoriesForViewport(lastBoundsRef.current, zoom);
  }, [fetchTerritoriesForViewport]);

  useFocusEffect(
    useCallback(() => {
      fetchResourceBanner();
      fetchPlayer();
    }, [fetchResourceBanner, fetchPlayer])
  );

  const fillStyle = useMemo(
    () => ({
      fillColor: ['get', 'color'],
      fillOpacity: [
        'case',
        ['==', ['get', 'color'], '#D64525'], 0.42,
        ['==', ['get', 'color'], '#3F8F4E'], 0.55,
        ['==', ['get', 'color'], '#4A6B8A'], 0.50,
        0,
      ],
      fillEmissiveStrength: 1.0,
    }),
    [],
  );

  const lineStyle = useMemo(
    () => ({
      lineColor: [
        'case',
        ['==', ['get', 'color'], '#D64525'], '#D64525',
        ['==', ['get', 'color'], '#3F8F4E'], '#3F8F4E',
        ['==', ['get', 'color'], '#4A6B8A'], '#4A6B8A',
        '#5C6068',
      ],
      lineWidth: 1.2,
      lineOpacity: 0.9,
      lineEmissiveStrength: 1.0,
    }),
    [],
  );

  const labelStyle = useMemo(
    () => ({
      textField: ['get', 'name'],
      textSize: 11,
      textColor: '#F2EEE6',
      textHaloColor: 'rgba(14,16,20,0.85)',
      textHaloWidth: 1.5,
      textAllowOverlap: false,
      textAnchor: 'center',
      textFont: ['DIN Offc Pro Medium', 'Arial Unicode MS Regular'],
    }),
    [],
  );

  const recenter = () => {
    if (!cameraRef.current) return;
    const centerCoordinate = lastUserCoord ?? AMSTERDAM_CENTER;
    cameraRef.current.setCamera({
      centerCoordinate,
      zoomLevel: INITIAL_ZOOM,
      animationDuration: 600,
    });
  };

  return (
    <View style={styles.screen}>
      <View style={styles.resourceBanner}>
        <View style={styles.resourceBannerItem}>
          <IronGlyph size={12} color="#F2EEE6" />
          <Text style={styles.resourceBannerValue}>{myPlayer?.iron ?? 0}</Text>
        </View>
        <View style={styles.resourceBannerDivider} />
        <View style={styles.resourceBannerItem}>
          <StoneGlyph size={12} color="#F2EEE6" />
          <Text style={styles.resourceBannerValue}>{myPlayer?.stone ?? 0}</Text>
        </View>
        <View style={styles.resourceBannerDivider} />
        <View style={styles.resourceBannerItem}>
          <GoldGlyph size={12} color="#F2EEE6" />
          <Text style={styles.resourceBannerValue}>{myPlayer?.gold ?? 0}</Text>
        </View>
        <View style={styles.resourceBannerDivider} />
        <View style={styles.resourceBannerItem}>
          <MoraleGlyph size={12} color="#F2EEE6" />
          <Text style={styles.resourceBannerValue}>{myPlayer?.morale ?? 0}</Text>
        </View>
      </View>
      {topBannerMessage ? (
        <View style={styles.topBanner}>
          <Text style={styles.topBannerText}>{topBannerMessage}</Text>
        </View>
      ) : null}
      <MapboxGL.MapView
        ref={mapRef}
        style={styles.map}
        styleURL="mapbox://styles/mapbox/light-v11"
        onCameraChanged={onCameraChanged}
      >
        <MapboxGL.Camera ref={cameraRef} zoomLevel={INITIAL_ZOOM} centerCoordinate={AMSTERDAM_CENTER} />

        <MapboxGL.UserLocation
          visible
          onUpdate={(loc) => {
            const c = loc?.coords;
            if (c?.longitude != null && c?.latitude != null) {
              setLastUserCoord([c.longitude, c.latitude]);
            }
          }}
        />

        <MapboxGL.ShapeSource
          id="territories"
          shape={territories}
          onPress={(e) => {
            const f = e?.features?.[0];
            if (f) setSelected({ feature: f, allFeatures: territories.features });
          }}
        >
          <MapboxGL.FillLayer id="territories-fill" style={fillStyle} />
          <MapboxGL.LineLayer id="territories-line" style={lineStyle} />
          <MapboxGL.SymbolLayer id="territories-labels" slot="top" style={labelStyle} />
        </MapboxGL.ShapeSource>
      </MapboxGL.MapView>

      <Pressable accessibilityRole="button" style={styles.locateButton} onPress={recenter}>
        <Text style={styles.locateIcon}>⌖</Text>
        <Text style={styles.locateText}>Locate me</Text>
      </Pressable>

      <TerritorySheet
        territory={selected?.feature ?? selected}
        allFeatures={selected?.allFeatures ?? []}
        userId={userId}
        onClose={() => setSelected(null)}
        onTerritoriesRefetched={handleTerritoriesRefetched}
        onResourceBannerRefresh={fetchResourceBanner}
        myPlayer={myPlayer}
        setMyPlayer={setMyPlayer}
        getTokenRef={getTokenRef}
        showTopBanner={showTopBanner}
      />
      <ChatSideRail hidden={selected != null} />
      <LeaderboardsSideRail hidden={selected != null} />
      <ActivityLogSideRail hidden={selected != null} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    flexDirection: 'column',
    backgroundColor: '#0E1014',
    paddingTop: StatusBar.currentHeight ?? 0,
  },
  map: {
    flex: 1,
  },

  topBanner: {
    position: 'absolute',
    top: (StatusBar.currentHeight ?? 0) + 48,
    left: 16,
    right: 16,
    zIndex: 100,
    backgroundColor: INK2,
    borderWidth: 1,
    borderColor: HAIRLINE_STRONG,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  topBannerText: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 11,
    color: BONE,
    letterSpacing: 0.5,
    textAlign: 'center',
  },

  resourceBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0E1014',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(242,238,230,0.16)',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  resourceBannerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 16,
  },
  resourceBannerDivider: {
    width: 1,
    height: 14,
    backgroundColor: 'rgba(242,238,230,0.12)',
  },
  resourceBannerValue: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 12,
    color: '#F2EEE6',
    letterSpacing: 0.5,
  },
  hudLeft: {
    position: 'absolute',
    top: 104,
    left: 16,
    backgroundColor: '#1A1D24',
    borderRadius: 0,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: 'rgba(242,238,230,0.16)',
  },
  hudValue: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 12,
    color: '#F2EEE6',
    letterSpacing: 0.5,
  },
  hudLabel: {
    marginTop: 2,
    fontFamily: 'GeistMono_400Regular',
    fontSize: 9,
    color: '#8B8F98',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },

  hudRight: {
    position: 'absolute',
    top: 104,
    right: 16,
    alignItems: 'flex-end',
  },
  allianceBadge: {
    backgroundColor: 'rgba(63,143,78,0.14)',
    borderColor: 'rgba(242,238,230,0.16)',
    borderWidth: 1,
    borderRadius: 0,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  allianceBadgeText: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 10,
    color: '#3F8F4E',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },

  locateButton: {
    position: 'absolute',
    left: 16,
    bottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1A1D24',
    borderRadius: 0,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(242,238,230,0.16)',
  },
  locateIcon: {
    color: '#F2EEE6',
    fontSize: 14,
  },
  locateText: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 10,
    color: '#8B8F98',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },

  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#1A1D24',
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderColor: 'rgba(242,238,230,0.16)',
    paddingTop: 12,
    paddingBottom: 24,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 32,
    height: 1,
    borderRadius: 0,
    backgroundColor: 'rgba(242,238,230,0.16)',
    marginBottom: 14,
  },
  sheetTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  sheetTitle: {
    fontFamily: 'Inter_500Medium',
    fontSize: 20,
    color: '#F2EEE6',
    letterSpacing: -0.015,
  },
  sheetTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sheetStateLabel: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 9,
    color: '#8B8F98',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  sheetTierBadge: {
    borderRadius: 0,
    borderWidth: 1,
    borderColor: 'rgba(242,238,230,0.16)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 1,
  },
  sheetTierBadgeText: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 10,
    color: '#8B8F98',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  sheetSubtitle: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 11,
    color: '#8B8F98',
    marginTop: 6,
    letterSpacing: 0.5,
  },
  sheetSubtitleStrong: {
    fontFamily: 'GeistMono_500Medium',
    color: '#F2EEE6',
  },
  sheetOwnerUnclaimed: {
    fontFamily: 'GeistMono_400Regular',
    color: '#5C6068',
  },
  sheetAllianceTag: {
    fontFamily: 'GeistMono_400Regular',
    color: '#8B8F98',
  },
  sheetIntelBlock: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(242,238,230,0.08)',
  },
  sheetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  sheetRowLabel: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 11,
    color: '#8B8F98',
    letterSpacing: 0.5,
  },
  sheetRowValue: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 11,
    color: '#F2EEE6',
    letterSpacing: 0.5,
  },
  sheetInfluenceRow: {
    marginTop: 10,
    paddingTop: 12,
    paddingBottom: 12,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(242,238,230,0.16)',
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(242,238,230,0.16)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sheetInfluenceLabel: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 9,
    color: '#8B8F98',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  sheetInfluenceSub: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 10,
    color: '#8B8F98',
    letterSpacing: 0.5,
  },
  sheetInfluenceValue: {
    fontFamily: 'Archivo_700Bold',
    fontSize: 26,
    color: '#F2EEE6',
    letterSpacing: -0.3,
  },
  sheetExpandedBlock: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(242,238,230,0.08)',
  },
  sheetYourWalk: {
    marginTop: 10,
    backgroundColor: 'rgba(214,69,37,0.14)',
    borderLeftWidth: 2,
    borderLeftColor: '#D64525',
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  sheetYourWalkLabel: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 8,
    color: '#D64525',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  sheetYourWalkValue: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 13,
    color: '#F2EEE6',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  sheetYourWalkSub: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 10,
    color: '#8B8F98',
    letterSpacing: 0.3,
    lineHeight: 14,
  },
  sheetToggle: {
    marginTop: 12,
    paddingVertical: 8,
    alignItems: 'center',
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(242,238,230,0.08)',
  },
  sheetToggleText: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 9,
    color: '#5C6068',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  sheetClose: {
    width: 32,
    height: 32,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: 'rgba(242,238,230,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetCloseText: {
    color: '#F2EEE6',
    fontSize: 20,
    marginTop: -2,
  },
  sheetAction: {
    marginTop: 16,
    backgroundColor: '#D64525',
    borderRadius: 0,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetActionDisabled: {
    marginTop: 16,
    backgroundColor: '#1A1D24',
    borderRadius: 0,
    borderWidth: 1,
    borderColor: 'rgba(242,238,230,0.16)',
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetActionContest: {
    backgroundColor: '#EA580C',
  },
  sheetActionText: {
    fontFamily: 'GeistMono_500Medium',
    color: '#F2EEE6',
    fontSize: 12,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  sheetActionDisabledText: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 12,
    color: '#5C6068',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  sheetActionDisabledSub: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 10,
    color: '#5C6068',
    marginTop: 4,
    letterSpacing: 0.5,
  },
  sheetConfirmDataBlock: {
    marginTop: 12,
    paddingTop: 16,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(242,238,230,0.08)',
  },
  sheetConfirmDataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 10,
  },
  sheetConfirmLabel: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 11,
    color: '#8B8F98',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  sheetConfirmValue: {
    fontFamily: 'Inter_500Medium',
    fontSize: 15,
    color: '#F2EEE6',
  },
  sheetConfirmHelpText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: 'rgba(242,238,230,0.7)',
    lineHeight: 18,
    marginTop: 6,
  },
  sheetConfirmError: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 10,
    color: '#D64525',
    letterSpacing: 1,
    textTransform: 'uppercase',
    textAlign: 'center',
    paddingVertical: 10,
  },
  sheetContestActiveCard: {
    marginTop: 12,
    paddingTop: 16,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(242,238,230,0.08)',
    gap: 12,
  },
  sheetContestActiveText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: 'rgba(242,238,230,0.85)',
    lineHeight: 18,
    textAlign: 'center',
  },
  sheetCancel: {
    marginTop: 8,
    backgroundColor: 'transparent',
    borderRadius: 0,
    borderWidth: 1,
    borderColor: 'rgba(242,238,230,0.16)',
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetCancelText: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 12,
    color: 'rgba(242,238,230,0.6)',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
});
