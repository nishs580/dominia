import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Easing, PermissionsAndroid, Platform, Pressable, StatusBar, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import MapboxGL from '@rnmapbox/maps';
import { useAuth } from '@clerk/clerk-expo';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { startClaim } from '../lib/claimApi';
import { startContest } from '../lib/contestWalkApi';
import { abandonTerritory } from '../lib/territoryApi';
import { developTerritory } from '../lib/developApi';
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
import MapSideRail from '../components/MapSideRail';
import { SvgXml } from 'react-native-svg';
import AllianceEmblem from '../components/AllianceEmblem';
import { ALLIANCE_EMBLEMS, emblemXml } from '../lib/allianceEmblems';
import { BASE_TIERS, baseTierForLevel, baseXml } from '../lib/homeBases';
import { battleChipFor } from '../lib/battleChips';
import { useFirstTapTips, rectFromRef } from '../components/FirstTapTips';
import NotifPrimeModal from '../components/NotifPrimeModal';
import { hasFired, markFired } from '../lib/walkthroughFlags';
import { emitDemoEvent, onDemoEvent, registerDemoAction, registerDemoRect } from '../lib/demoRegistry';
import { fetchFirstClaimObjective, formatWalkDistance } from '../lib/firstClaimApi';

// Marching-dash sequence for the siege border (Mapbox animated-dash pattern:
// stepping through these dasharrays reads as the border crawling).
const SIEGE_DASH_SEQUENCE = [
  [0, 4, 3], [0.5, 4, 2.5], [1, 4, 2], [1.5, 4, 1.5], [2, 4, 1], [2.5, 4, 0.5], [3, 4, 0],
  [0, 0.5, 3, 3.5], [0, 1, 3, 3], [0, 1.5, 3, 2.5], [0, 2, 3, 2], [0, 2.5, 3, 1.5], [0, 3, 3, 1], [0, 3.5, 3, 0.5],
];

// Streak deterrence bands — collapses the 7 formula tiers (lib/formulas.js
// STREAK_TIER_THRESHOLDS) into 3 readable border treatments.
function streakBandForDays(days) {
  const d = Number(days) || 0;
  if (d >= 21) return 'fortified';
  if (d >= 7) return 'hardened';
  return 'base';
}

// Map image name for a territory's alliance emblem, tinted by relationship.
// Unknown keys fall back to the plain shield so a stale client never breaks.
function emblemIconName(emblemKey, isOwnAlliance) {
  const key = ALLIANCE_EMBLEMS.includes(emblemKey) ? emblemKey : 'unknown';
  return `emblem-${key}-${isOwnAlliance ? 'ally' : 'enemy'}`;
}

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

function liveCountdown(t, expiresAtIso) {
  const remainingMs = Math.max(0, new Date(expiresAtIso).getTime() - Date.now());
  const totalSec = Math.floor(remainingMs / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min > 0) return t('map.countdownMin', { n: min });
  return t('map.countdownSec', { n: sec });
}

function topBannerMessageForContestCode(t, code) {
  switch (code) {
    case 'player_not_found':
      return t('map.topBannerErr.playerNotFound');
    case 'territory_not_found':
      return t('map.topBannerErr.territoryNotFound');
    case 'invalid_tier':
      return t('map.topBannerErr.invalidTier');
    case 'defender_not_found':
    case 'no_perimeter':
    case 'owner_level_unavailable':
      return t('map.topBannerErr.contestData');
    case 'network_error':
    case 'no_token':
      return t('map.topBannerErr.network');
    default:
      return t('map.topBannerErr.generic');
  }
}

function contestStartErrorMessage(t, error) {
  if (!error) return null;
  const { code, context = {} } = error;
  switch (code) {
    case 'no_territory_owner':
      return t('map.contestErr.noOwner');
    case 'cannot_contest_own':
      return t('map.contestErr.cannotContestOwn');
    case 'territory_protected':
      switch (context.reason) {
        case 'new_owner_protection':
          return t('map.contestErr.newOwnerProtection');
        case 'defense_protection':
          return t('map.contestErr.defenseProtection');
        case 'alliance_protection':
          return t('map.contestErr.allianceProtection');
        default:
          return t('map.contestErr.protected');
      }
    case 'level_too_low':
      return t('map.contestErr.levelTooLow', { level: context.required_level, tier: context.tier });
    case 'outside_contest_hours':
      return t('map.contestErr.outsideHours');
    case 'insufficient_iron':
      return t('map.contestErr.insufficientIron');
    default:
      return null;
  }
}

function TerritorySheet({ territory, onClose, userId, onTerritoriesRefetched, onResourceBannerRefresh, myPlayer, setMyPlayer, getTokenRef, showTopBanner, allFeatures = [], objectiveTerritoryId = null }) {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [sheetState, setSheetState] = useState('info'); // 'info' | 'confirm' | 'develop' | 'developConfirm'
  const [contestMode, setContestMode] = useState(false);
  const [startError, setStartError] = useState(null);
  const [contestStartError, setContestStartError] = useState(null);
  const [contestAlreadyActiveInfo, setContestAlreadyActiveInfo] = useState(null);
  const [isDeducting, setIsDeducting] = useState(false);
  const [isAttacking, setIsAttacking] = useState(false);
  const [isDeveloping, setIsDeveloping] = useState(false);
  const [developError, setDevelopError] = useState(null);
  // Development level after an in-sheet develop — the feature object under the
  // sheet is a snapshot, so the sheet tracks its own copy until the refetch.
  const [localDevLevel, setLocalDevLevel] = useState(null);
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
    setIsDeveloping(false);
    setDevelopError(null);
    setLocalDevLevel(null);
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

  const name = territory.properties?.name ?? t('common.territoryFallback');
  const ownerRaw = territory.properties?.owner;
  const isUnclaimed = ownerRaw == null || ownerRaw === 'Unclaimed';
  const owner = !isUnclaimed ? ownerRaw : null;

  const tier = territory.properties?.tier ?? 'Medium';
  const developmentLevel = localDevLevel ?? territory.properties?.developmentLevel ?? 0;
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
  let stateLabel = t('map.stateUnclaimed');
  if (isOwnTerritory) stateLabel = t('map.stateYours');
  else if (isAllianceTerritory) stateLabel = t('map.stateAlliance');
  else if (isOwned) stateLabel = t('map.stateEnemy');

  const playerXp = Math.max(0, Math.floor(Number(myPlayer?.xp) || 0));
  const cap = territoryCapForLevel(F.calcLevel(playerXp));
  const heldCount = allFeatures.filter(f => f.properties?.color === '#D64525').length;
  const isAtCap = heldCount >= cap;

  // Owner's streak tier (deterrent signal)
  const ownerStreakTier = F.getStreakTier(ownerStreakDays);

  // Your streak
  const myStreak = myPlayer?.current_streak ?? 0;

  // Influence per day (upkeep removed — §5.3.1 retired)
  const influence = Math.round(
    F.calcDailyInfluence({
      tier: F.normaliseTier(tier),
      developmentLevel,
      legacyRank: legacyRank ?? 1,
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

  const walkLabel = isOwned ? t('map.walkToContest') : t('map.walkToClaim');

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

  // --- Development (own territory only) ---------------------------------
  // One atomic spend per level; influence wallet is fixed-point ×10.
  const devLevelName = (n) => t(`map.devLevelName.${n}`);
  const myLevel = F.calcLevel(playerXp);
  const isMaxDev = developmentLevel >= 4;
  const devTarget = isMaxDev ? null : developmentLevel + 1;
  const devCost = devTarget ? F.calcDevCost(developmentLevel, devTarget) : null;
  const devGateLevel = devTarget === 4 ? 9 : devTarget === 3 ? 8 : 1;
  const devGateOk = devTarget != null && myLevel >= devGateLevel;
  const devWallet = {
    stone: myPlayer?.stone ?? 0,
    iron: myPlayer?.iron ?? 0,
    gold: myPlayer?.gold ?? 0,
    influence: F.influenceToDisplay(myPlayer?.influence ?? 0),
  };
  const devRows = devCost
    ? [
        { key: 'stone', cost: devCost.stone, have: devWallet.stone },
        { key: 'iron', cost: devCost.iron, have: devWallet.iron },
        { key: 'gold', cost: devCost.gold, have: devWallet.gold },
        { key: 'influence', cost: devCost.influence, have: devWallet.influence },
      ]
    : [];
  const canAffordDev = devRows.length > 0 && devRows.every((r) => r.have >= r.cost);

  const developErrorMessage = developError
    ? (() => {
        switch (developError.code) {
          case 'insufficient_resources':
            return t('map.devErr.insufficient');
          case 'level_gate':
            return t('map.devErr.levelGate', {
              level: developError.context?.required_player_level ?? devGateLevel,
            });
          case 'level_changed':
          case 'develop_conflict':
            return t('map.devErr.changed');
          case 'not_owner':
            return t('map.devErr.notOwner');
          case 'network_error':
            return t('map.startErr.network');
          case 'no_token':
          case 'unauthorized':
            return t('map.startErr.signIn');
          default:
            return t('map.startErr.generic');
        }
      })()
    : null;

  const handleConfirmDevelop = async () => {
    if (!devTarget) return;
    setIsDeveloping(true);
    setDevelopError(null);
    try {
      const result = await developTerritory({
        clerkGetToken: () => getTokenRef.current(),
        territoryId: territory.id,
        confirmLevel: devTarget,
      });
      if (result.ok) {
        const data = result.data;
        setLocalDevLevel(data.development_level);
        setMyPlayer((prev) =>
          prev
            ? {
                ...prev,
                stone: data.balances.stone,
                iron: data.balances.iron,
                gold: data.balances.gold,
                influence: data.balances.influence,
                xp: data.total_xp,
              }
            : prev,
        );
        setSheetState('develop');
        showTopBanner?.(
          t('map.devDone', { name, levelName: devLevelName(data.development_level) }),
        );
        onTerritoriesRefetched?.(territory.id);
        onResourceBannerRefresh?.();
      } else {
        const code = result.error?.error ?? (result.status === 0 ? 'network_error' : 'generic');
        setDevelopError({ code, context: result.error });
      }
    } finally {
      setIsDeveloping(false);
    }
  };

  const startErrorMessage = startError
    ? (() => {
        const { code, context } = startError;
        switch (code) {
          case 'level_too_low':
            return t('map.startErr.levelTooLow', { level: context.required_level, tier });
          case 'insufficient_gold':
            return t('map.startErr.insufficientGold', { n: context.required_gold - context.player_gold });
          case 'territory_already_claimed':
            return t('map.startErr.alreadyClaimed');
          case 'territory_being_claimed':
            return t('map.startErr.beingClaimed', { countdown: liveCountdown(t, context.expires_at) });
          case 'active_claim_in_progress':
            return t('map.startErr.activeInProgress', { countdown: liveCountdown(t, context.expires_at) });
          case 'network_error':
            return t('map.startErr.network');
          case 'no_token':
          case 'unauthorized':
            return t('map.startErr.signIn');
          default:
            return t('map.startErr.generic');
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
        } else if (contestStartErrorMessage(t, { code, context })) {
          setContestStartError({ code, context });
        } else {
          showTopBanner?.(topBannerMessageForContestCode(t, code));
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
            {sheetState === 'confirm'
              ? (contestMode ? t('map.confirmContest') : t('map.confirmClaim'))
              : sheetState === 'develop' || sheetState === 'developConfirm'
                ? t('map.developTitle')
                : stateLabel}
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
                <Text style={styles.sheetRowLabel}>{t('map.owner')}</Text>
                <View style={styles.sheetRowValueRow}>
                  {alliance ? (
                    <AllianceEmblem
                      emblem={territory.properties?.emblem}
                      size={16}
                      glyph={isAllianceTerritory ? '#3F8F4E' : '#4A6B8A'}
                    />
                  ) : null}
                  <Text style={styles.sheetRowValue}>
                    {owner}
                    {alliance ? <Text style={styles.sheetAllianceTag}> [{alliance}]</Text> : null}
                  </Text>
                </View>
              </View>
            )}
            {!isUnclaimed && (
              <View style={styles.sheetRow}>
                <Text style={styles.sheetRowLabel}>{t('map.streak')}</Text>
                <Text style={[styles.sheetRowValue, ownerStreakDays >= 30 && { color: '#D64525' }]}>
                  {streakTierName(ownerStreakTier.tier)}
                </Text>
              </View>
            )}
            <View style={styles.sheetRow}>
              <Text style={styles.sheetRowLabel}>{walkLabel}</Text>
              <Text style={styles.sheetRowValue}>{t('map.walkDistanceValue', { metres: walkDistance.toLocaleString() })}</Text>
            </View>
          </View>

          {/* Influence hero row */}
          <View style={styles.sheetInfluenceRow}>
            <View>
              <Text style={styles.sheetInfluenceLabel}>{t('map.generates')}</Text>
              <Text style={styles.sheetInfluenceSub}>{t('map.influencePerDay')}</Text>
            </View>
            <Text style={styles.sheetInfluenceValue}>{t('map.influenceValue', { n: influence })}</Text>
          </View>

          {/* Expanded detail */}
          {expanded && (
            <View style={styles.sheetExpandedBlock}>
              <View style={styles.sheetRow}>
                <Text style={styles.sheetRowLabel}>{t('map.development')}</Text>
                <Text style={styles.sheetRowValue}>
                  D{developmentLevel} · {developmentName(developmentLevel)}
                </Text>
              </View>
              <View style={styles.sheetRow}>
                <Text style={styles.sheetRowLabel}>{t('map.legacy')}</Text>
                <Text style={styles.sheetRowValue}>
                  {legacyRank == null ? '—' : `R${legacyRank} · ${F.legacyRankName(legacyRank)}`}
                </Text>
              </View>
              {!isUnclaimed && (
                <>
                  {formatHeldDays(historyStats.heldDays) !== null && (
                    <View style={styles.sheetRow}>
                      <Text style={styles.sheetRowLabel}>{t('map.held')}</Text>
                      <Text style={styles.sheetRowValue}>{formatHeldDays(historyStats.heldDays)}</Text>
                    </View>
                  )}
                  <View style={styles.sheetRow}>
                    <Text style={styles.sheetRowLabel}>{t('map.changedHands')}</Text>
                    <Text style={styles.sheetRowValue}>{formatChangedHands(historyStats.changedHands)}</Text>
                  </View>
                  <View style={styles.sheetRow}>
                    <Text style={styles.sheetRowLabel}>{t('map.hallOfHolders')}</Text>
                    <Text style={styles.sheetRowValue}>{formatHolderCount(historyStats.holderCount)}</Text>
                  </View>
                </>
              )}

              {/* Your walk block — only when it's an attackable territory */}
              {isOwned && !isYours && (
                <View style={styles.sheetYourWalk}>
                  <Text style={styles.sheetYourWalkLabel}>{t('map.yourWalk')}</Text>
                  <Text style={styles.sheetYourWalkValue}>
                    {t('map.yourWalkValue', { metres: walkDistance.toLocaleString(), iron: ironCost })}
                  </Text>
                  {reductionPct > 0 && (
                    <Text style={styles.sheetYourWalkSub}>
                      {t('map.streakReduces', { days: myStreak, pct: reductionPct })}
                    </Text>
                  )}
                </View>
              )}
            </View>
          )}

          {/* Expand toggle — text only per brand rules */}
          <Pressable accessibilityRole="button" onPress={() => setExpanded(e => !e)} style={styles.sheetToggle}>
            <Text style={styles.sheetToggleText}>{expanded ? t('map.less') : t('map.more')}</Text>
          </Pressable>

          {/* Action buttons — kept from original logic */}
          {isUnclaimed && !isAtCap && territory.id === objectiveTerritoryId && (
            <Text style={styles.sheetObjectiveHint}>{t('firstClaim.tapClaim')}</Text>
          )}
          {isUnclaimed && !isAtCap && (
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [styles.sheetAction, pressed && { opacity: 0.92 }]}
              onPress={() => setSheetState('confirm')}
            >
              <Text style={styles.sheetActionText}>{t('map.claim')}</Text>
            </Pressable>
          )}

          {isUnclaimed && isAtCap && (
            <View style={styles.sheetActionDisabled}>
              <Text style={styles.sheetActionDisabledText}>{t('map.capReached')}</Text>
              <Text style={styles.sheetActionDisabledSub}>{t('map.capReachedSub')}</Text>
            </View>
          )}

          {isOwnTerritory && !isMaxDev && (
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [styles.sheetAction, pressed && { opacity: 0.92 }]}
              onPress={() => {
                setDevelopError(null);
                setSheetState('develop');
              }}
            >
              <Text style={styles.sheetActionText}>{t('map.develop')}</Text>
            </Pressable>
          )}

          {isOwnTerritory && isMaxDev && (
            <View style={styles.sheetActionDisabled}>
              <Text style={styles.sheetActionDisabledText}>{t('map.devCitadelComplete')}</Text>
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
                Alert.alert(t('map.abandonAlertTitle', { name }), t('map.abandonAlertBody'), [
                  { text: t('map.abandonCancel'), style: 'cancel' },
                  {
                    text: t('map.abandonConfirm'),
                    style: 'destructive',
                    onPress: async () => {
                      const res = await abandonTerritory({
                        clerkGetToken: () => getTokenRef.current(),
                        territoryId: territory.id,
                      });
                      if (!res.ok) {
                        console.error('Abandon territory failed:', res.status, res.error);
                        return;
                      }
                      onClose();
                      onTerritoriesRefetched?.(territory.id);
                    },
                  },
                ]);
              }}
            >
              <Text style={styles.sheetActionText}>{t('map.abandon')}</Text>
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
              <Text style={styles.sheetActionText}>{t('map.contest')}</Text>
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
                  <Text style={styles.sheetConfirmLabel}>{t('map.cost')}</Text>
                  <Text style={styles.sheetConfirmValue}>
                    {contestMode ? t('map.amountIron', { n: ironCost }) : t('map.amountGold', { n: goldCost })}
                  </Text>
                </View>
                <View style={styles.sheetConfirmDataRow}>
                  <Text style={styles.sheetConfirmLabel}>{t('map.balanceAfter')}</Text>
                  <Text style={styles.sheetConfirmValue}>
                    {contestMode ? t('map.amountIron', { n: ironBalanceAfter }) : t('map.amountGold', { n: balanceAfter })}
                  </Text>
                </View>
              </View>

              {contestMode && contestStartError && (
                <Text style={styles.sheetConfirmError}>
                  {contestStartErrorMessage(t, contestStartError)}
                </Text>
              )}

              {!contestMode && startError && (
                <Text style={styles.sheetConfirmError}>{startErrorMessage}</Text>
              )}

              {contestMode && contestAlreadyActiveInfo && (
                <View style={styles.sheetContestActiveCard}>
                  <Text style={styles.sheetContestActiveText}>
                    {t('map.contestActiveCard', { attacker: contestAlreadyActiveInfo.attacker_username, date: contestAlreadyActiveInfo.attack_day_date })}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    style={({ pressed }) => [
                      styles.sheetAction,
                      pressed && { opacity: 0.92 },
                    ]}
                    onPress={() => setContestAlreadyActiveInfo(null)}
                  >
                    <Text style={styles.sheetActionText}>{t('map.gotIt')}</Text>
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
                  <Text style={styles.sheetActionText}>{isDeducting ? t('map.processing') : t('common.retry')}</Text>
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
                    {(contestMode ? isAttacking : isDeducting) ? t('map.processing') : t('map.acceptAndContinue')}
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
                <Text style={styles.sheetCancelText}>{t('map.cancel')}</Text>
              </Pressable>
            </>
          ) : (
            <>
              <View style={styles.sheetConfirmDataBlock}>
                <View style={styles.sheetConfirmDataRow}>
                  <Text style={styles.sheetConfirmLabel}>{t('map.shortBy')}</Text>
                  <Text style={styles.sheetConfirmValue}>
                    {contestMode ? t('map.amountIron', { n: ironCost - currentIron }) : t('map.amountGold', { n: goldCost - currentGold })}
                  </Text>
                </View>
                <Text style={styles.sheetConfirmHelpText}>
                  {contestMode
                    ? t('map.earnIron')
                    : t('map.earnGold')}
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
                <Text style={styles.sheetActionText}>{t('map.goToActivity')}</Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                style={({ pressed }) => [styles.sheetCancel, pressed && { opacity: 0.92 }]}
                onPress={() => setSheetState('info')}
              >
                <Text style={styles.sheetCancelText}>{t('map.cancel')}</Text>
              </Pressable>
            </>
          )}
        </>
      )}

      {(sheetState === 'develop' || sheetState === 'developConfirm') && (
        <>
          {isMaxDev ? (
            <>
              <View style={styles.sheetConfirmDataBlock}>
                <View style={styles.sheetConfirmDataRow}>
                  <Text style={styles.sheetConfirmLabel}>{t('map.development')}</Text>
                  <Text style={styles.sheetConfirmValue}>D4 · {devLevelName(4)}</Text>
                </View>
                <Text style={styles.sheetConfirmHelpText}>{t('map.devCitadelComplete')}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                style={({ pressed }) => [styles.sheetCancel, pressed && { opacity: 0.92 }]}
                onPress={() => setSheetState('info')}
              >
                <Text style={styles.sheetCancelText}>{t('map.cancel')}</Text>
              </Pressable>
            </>
          ) : (
            <>
              <View style={styles.sheetConfirmDataBlock}>
                <View style={styles.sheetConfirmDataRow}>
                  <Text style={styles.sheetConfirmLabel}>{t('map.development')}</Text>
                  <Text style={styles.sheetConfirmValue}>
                    D{developmentLevel} · {devLevelName(developmentLevel)}
                  </Text>
                </View>
                <View style={styles.sheetConfirmDataRow}>
                  <Text style={styles.sheetConfirmLabel}>
                    {sheetState === 'developConfirm' ? t('map.devBecomes') : t('map.devNext')}
                  </Text>
                  <Text style={styles.sheetConfirmValue}>
                    D{devTarget} · {devLevelName(devTarget)}
                  </Text>
                </View>
                {devRows.map((r) => (
                  <View key={r.key} style={styles.sheetConfirmDataRow}>
                    <Text style={styles.sheetConfirmLabel}>{t(`map.devResource.${r.key}`)}</Text>
                    <Text
                      style={[
                        styles.sheetConfirmValue,
                        { color: r.have >= r.cost ? '#3F8F4E' : '#D64525' },
                      ]}
                    >
                      {sheetState === 'developConfirm'
                        ? t('map.devCostAfter', {
                            cost: r.cost.toLocaleString(),
                            after: (r.key === 'influence'
                              ? Math.round((r.have - r.cost) * 10) / 10
                              : r.have - r.cost
                            ).toLocaleString(),
                          })
                        : t('map.devCostHave', {
                            cost: r.cost.toLocaleString(),
                            have: r.have.toLocaleString(),
                          })}
                    </Text>
                  </View>
                ))}
              </View>

              {!devGateOk && (
                <Text style={styles.sheetConfirmHelpText}>
                  {t('map.devGate', { levelName: devLevelName(devTarget), level: devGateLevel })}
                </Text>
              )}

              {sheetState === 'developConfirm' && devTarget === 4 && (
                <Text style={styles.sheetConfirmHelpText}>
                  {t('map.devD4Weight', { name })}
                </Text>
              )}

              {developErrorMessage && (
                <Text style={styles.sheetConfirmError}>{developErrorMessage}</Text>
              )}

              {sheetState === 'develop' ? (
                <Pressable
                  accessibilityRole="button"
                  disabled={!canAffordDev || !devGateOk}
                  style={({ pressed }) => [
                    styles.sheetAction,
                    pressed && { opacity: 0.92 },
                    (!canAffordDev || !devGateOk) && { opacity: 0.4 },
                  ]}
                  onPress={() => {
                    setDevelopError(null);
                    setSheetState('developConfirm');
                  }}
                >
                  <Text style={styles.sheetActionText}>
                    {t('map.developTo', { levelName: devLevelName(devTarget) })}
                  </Text>
                </Pressable>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  disabled={isDeveloping || !canAffordDev || !devGateOk}
                  style={({ pressed }) => [
                    styles.sheetAction,
                    pressed && { opacity: 0.92 },
                    (isDeveloping || !canAffordDev || !devGateOk) && { opacity: 0.6 },
                  ]}
                  onPress={handleConfirmDevelop}
                >
                  <Text style={styles.sheetActionText}>
                    {isDeveloping
                      ? t('map.processing')
                      : t('map.devConfirmCta', { levelName: devLevelName(devTarget) })}
                  </Text>
                </Pressable>
              )}

              <Pressable
                accessibilityRole="button"
                style={({ pressed }) => [styles.sheetCancel, pressed && { opacity: 0.92 }]}
                onPress={() => {
                  setDevelopError(null);
                  setSheetState(sheetState === 'developConfirm' ? 'develop' : 'info');
                }}
              >
                <Text style={styles.sheetCancelText}>
                  {sheetState === 'developConfirm' ? t('map.back') : t('map.cancel')}
                </Text>
              </Pressable>
            </>
          )}
        </>
      )}
    </View>
  );
}

// Pulsing claim-red ring anchored over the first-claim objective territory.
// Pure attention device — taps fall through to the territory polygon below.
function ObjectivePulse() {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1100, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 0, useNativeDriver: true }),
        Animated.delay(500),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View pointerEvents="none" style={styles.objectivePulseWrap}>
      <Animated.View
        style={[
          styles.objectivePulseRing,
          {
            opacity: pulse.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.9, 0] }),
            transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }) }],
          },
        ]}
      />
      <View style={styles.objectivePulseCore} />
    </View>
  );
}

export default function MapScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { t } = useTranslation();
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
  // Latest viewport requested while a fetch was in flight — fired once it settles
  // (trailing edge) so the area the player lands on always loads.
  const pendingFetchRef = useRef(null);
  // Always points at the latest fetchTerritoriesForViewport so settle() can re-invoke it.
  const fetchRef = useRef(null);
  // Guards the one-time camera centering on the player's home pin. Without this,
  // the map opens on AMSTERDAM_CENTER (the Camera's static prop) instead of where
  // the player placed their home pin during onboarding.
  const didInitialCenterRef = useRef(false);
  // Focus-from-profile: fly to a territory the player tapped in their profile.
  // lastFocusNonceRef dedupes repeated navigations; pendingFocusIdRef opens the
  // detail sheet once the target loads into the feature cache.
  const lastFocusNonceRef = useRef(null);
  const pendingFocusIdRef = useRef(null);
  const [lastUserCoord, setLastUserCoord] = useState(null);
  const [selected, setSelected] = useState(null);
  const [territories, setTerritories] = useState({ type: 'FeatureCollection', features: [] });
  const [bases, setBases] = useState({ type: 'FeatureCollection', features: [] });
  // Monotonic sequence — a slow bases response never overwrites a newer one.
  const basesFetchSeqRef = useRef(0);
  const [isFetchingTerritories, setIsFetchingTerritories] = useState(false);
  const [showLoading, setShowLoading] = useState(false);
  const [myAllianceName, setMyAllianceName] = useState(null);
  const [myPlayer, setMyPlayer] = useState(null);
  const [topBannerMessage, setTopBannerMessage] = useState(null);
  const topBannerTimerRef = useRef(null);
  const { userId, getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  useEffect(() => { getTokenRef.current = getToken; }, [getToken]);

  // ── First-tap tips + persistent first-claim objective ─────────────────────
  const { width: winW, height: winH } = useWindowDimensions();
  const mapWrapRef = useRef(null);
  const [objective, setObjective] = useState(null);
  const [heldCount, setHeldCount] = useState(null);
  const [showNotifPrime, setShowNotifPrime] = useState(false);

  // Position is resolved server-side from the home pin — deterministic and
  // matches where the first claim should feel grounded.
  const fetchObjective = useCallback(async () => {
    const res = await fetchFirstClaimObjective({ clerkGetToken: () => getTokenRef.current() });
    if (!res.ok) {
      // Never block the tour on a failed objective fetch — run it without the
      // finale; the banner surfaces on a later successful refetch.
      setHeldCount((prev) => (prev == null ? 0 : prev));
      return;
    }
    setHeldCount(res.data.held_count ?? 0);
    setObjective(res.data.target ?? null);
  }, []);

  const objectiveFeature = useMemo(() => {
    if (!objective?.geojson) return null;
    return {
      type: 'Feature',
      id: objective.id,
      properties: {
        id: objective.id,
        name: objective.name,
        owner: 'Unclaimed',
        alliance: null,
        tier: objective.tier ?? 'Small',
        level: 'D0',
        ownerStreak: 0,
        streakBand: 'base',
        developmentLevel: 0,
        labelSub: '',
        emblemIcon: '',
        contested: false,
        battleChip: '',
        chipColor: SLATE2,
        perimeter: objective.perimeter_distance,
        color: 'transparent',
      },
      geometry: objective.geojson,
    };
  }, [objective]);

  const objectiveActive = heldCount === 0 && objectiveFeature != null;

  const openObjectiveSheet = useCallback(() => {
    if (!objectiveFeature) return;
    const cached = featureCacheRef.current.get(objectiveFeature.id);
    setSelected({ feature: cached ?? objectiveFeature, allFeatures: territories.features });
  }, [objectiveFeature, territories.features]);

  const flyToObjective = useCallback(() => {
    if (!objective) return;
    if (cameraRef.current) {
      cameraRef.current.setCamera({
        centerCoordinate: [objective.longitude, objective.latitude],
        zoomLevel: 15,
        animationDuration: 650,
      });
    }
    setTimeout(openObjectiveSheet, 700);
  }, [objective, openObjectiveSheet]);

  // Layered map-area tips: the first three touches anywhere on the map fire
  // intro → colours → card, one per touch. Tab bar and side rail have no
  // observable tap here (navigation swallows them) — those screens teach
  // themselves on arrival instead.
  const mapTips = useMemo(() => {
    const mapRect = async () => {
      const wrap = await rectFromRef(mapWrapRef);
      if (!wrap) return { x: 16, y: winH * 0.2, width: winW - 32, height: winH * 0.4 };
      return { x: wrap.x, y: wrap.y, width: wrap.width, height: wrap.height };
    };
    const city = myPlayer?.home_city;
    return [
      {
        key: 'intro',
        kicker: t('walkthrough.map.kicker'),
        text: city ? t('walkthrough.map.intro', { city }) : t('walkthrough.map.introNoCity'),
        getRect: mapRect,
      },
      { key: 'colours', text: t('walkthrough.map.colours'), getRect: mapRect },
      { key: 'card', text: t('walkthrough.map.card'), getRect: mapRect },
    ];
  }, [myPlayer?.home_city, t, winH, winW]);

  const tips = useFirstTapTips({ screenKey: 'map', userId, tips: mapTips });

  // ── Guided demo wiring ─────────────────────────────────────────────────
  // Rect provider for the demo's territory step: fly the camera to the
  // objective, then project its centre into window coordinates.
  useEffect(() => {
    return registerDemoRect('map.objectiveRect', async () => {
      if (!objective || !mapRef.current || !cameraRef.current) return null;
      cameraRef.current.setCamera({
        centerCoordinate: [objective.longitude, objective.latitude],
        zoomLevel: 15,
        animationDuration: 700,
      });
      await new Promise((resolve) => setTimeout(resolve, 900));
      let pt = null;
      try {
        pt = await mapRef.current.getPointInView([objective.longitude, objective.latitude]);
      } catch {
        return null;
      }
      const px = Array.isArray(pt) ? pt[0] : pt?.x;
      const py = Array.isArray(pt) ? pt[1] : pt?.y;
      if (!Number.isFinite(px) || !Number.isFinite(py)) return null;
      const wrap = await rectFromRef(mapWrapRef);
      return {
        x: (wrap?.x ?? 0) + px - 70,
        y: (wrap?.y ?? 0) + py - 70,
        width: 140,
        height: 140,
      };
    });
  }, [objective]);

  useEffect(() => registerDemoAction('map.closeObjectiveSheet', () => setSelected(null)), []);

  // Tell the demo the first-claim data is settled (it waits on this to build
  // its step list — with or without the claim beats).
  useEffect(() => {
    if (heldCount === null || myPlayer == null) return;
    emitDemoEvent('map.objectiveResolved', { objective, city: myPlayer?.home_city ?? null });
  }, [heldCount, objective, myPlayer]);

  // The demo's territory step advances when the objective's sheet opens.
  useEffect(() => {
    const selId = selected?.feature?.id ?? selected?.feature?.properties?.id;
    if (selId && objective && selId === objective.id) {
      emitDemoEvent('map.objectiveSheetOpened');
    }
  }, [selected, objective]);

  // Prime for the notification permission early in the first map session —
  // but never show it to someone who already granted the OS permission.
  const maybeShowNotifPrime = useCallback(async () => {
    if (!userId) return;
    if (await hasFired(userId, 'notifPrime')) return;
    if (Platform.OS === 'android' && Platform.Version >= 33) {
      try {
        const granted = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
        );
        if (granted) {
          markFired(userId, 'notifPrime');
          markFired(userId, 'notifAllow');
          return;
        }
      } catch {
        // Fall through to priming.
      }
      setShowNotifPrime(true);
    } else {
      // No runtime notification prompt to prime for on this platform.
      markFired(userId, 'notifPrime');
      markFired(userId, 'notifAllow');
    }
  }, [userId]);

  // The prime follows the guided demo (completed or skipped). Later sessions
  // where the demo is already done but the prime was never answered get it
  // shortly after the map settles. hasFired inside maybeShowNotifPrime keeps
  // it once-ever.
  useEffect(() => {
    if (heldCount === null || !userId) return undefined;
    let timer = null;
    const unsubscribe = onDemoEvent((name) => {
      if (name === 'demo.ended') {
        timer = setTimeout(() => maybeShowNotifPrime(), 600);
      }
    });
    (async () => {
      if (await hasFired(userId, 'demo')) {
        timer = setTimeout(() => maybeShowNotifPrime(), 1200);
      }
    })();
    return () => {
      unsubscribe();
      if (timer) clearTimeout(timer);
    };
  }, [heldCount, maybeShowNotifPrime, userId]);

  const objectiveFillStyle = useMemo(
    () => ({ fillColor: CLAIM, fillOpacity: 0.16, fillEmissiveStrength: 1.0 }),
    [],
  );
  const objectiveLineStyle = useMemo(
    () => ({ lineColor: CLAIM, lineWidth: 3, lineDasharray: [2, 1.2], lineOpacity: 1, lineEmissiveStrength: 1.0 }),
    [],
  );

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
      .select('iron, stone, gold, morale, influence')
      .eq('id', resourcePlayerId)
      .single();
    if (error) {
      return;
    }
    setMyPlayer(prev => (prev ? { ...prev, ...data } : prev));
  }, [resourcePlayerId]);

  const fetchPlayer = useCallback(async () => {
    const { data: playerRow } = await supabase
      .from('players')
      .select('id, alliance_id, xp, current_streak, iron, stone, gold, morale, influence, home_pin_lat, home_pin_lng, home_city')
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

    // If a recent fetch is still in flight, don't start a new one — but remember
    // this viewport so settle() can fetch it once the in-flight request finishes.
    // Without this, a quick pan/zoom could leave the area the player lands on blank.
    if (abortControllerRef.current) {
      console.log('[vp fetch] DEFER (recent in-flight, age', inFlightAge, 'ms)');
      pendingFetchRef.current = { bounds, zoom };
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    abortControllerStartRef.current = now;
    setIsFetchingTerritories(true);

    // Clears this fetch's controller and either fires the deferred viewport
    // (trailing edge) or, if nothing is queued and nothing else is loading,
    // ends the loading state. Guarded so a superseded fetch never clobbers a
    // newer in-flight controller's ref or loading state.
    const settle = () => {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
      const pending = pendingFetchRef.current;
      if (pending) {
        pendingFetchRef.current = null;
        fetchRef.current?.(pending.bounds, pending.zoom);
      } else if (!abortControllerRef.current) {
        setIsFetchingTerritories(false);
      }
    };

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
        settle();
        return;
      }
      console.log('[vp fetch] THREW', err?.message);
      settle();
      throw err;
    }

    if (
      error?.name === 'AbortError' ||
      error?.code === '20' ||
      error?.code === 20
    ) {
      console.log('[vp fetch] ABORTED (returned as error)');
      settle();
      return;
    }

    if (error) {
      console.log('[vp fetch] ERROR', error.message);
      settle();
      return;
    }
    const rows = data ?? [];

    if (rows.length > 0) {
      const sample = rows[0];
    }

    const features = rows.map((row) => {
      const developmentLevel = row.development_level ?? 0;
      const allianceTag = row.alliance_short_name ?? null;
      const isOwnAlliance = Boolean(myPlayer?.alliance_id && row.alliance_id === myPlayer.alliance_id);
      // Second label line: development badge + alliance tag ("D3 · [VLK]").
      const labelParts = [];
      if (developmentLevel >= 1) labelParts.push(`D${developmentLevel}`);
      if (allianceTag) labelParts.push(`[${allianceTag}]`);

      // War state: burning border while contested, report chip for 24h after.
      const contested = row.contest_active === true;
      const chip = battleChipFor({
        contested,
        lastBattleOutcome: row.last_battle_outcome ?? null,
        lastBattleAt: row.last_battle_at ?? null,
      });
      let battleChip = '';
      let chipColor = '#8B8F98';
      if (chip?.key === 'contested') {
        battleChip = t('map.chip.contested');
        chipColor = '#D64525';
      } else if (chip) {
        const ago = chip.minutes < 60
          ? t('map.agoMin', { n: chip.minutes })
          : t('map.agoHr', { n: Math.floor(chip.minutes / 60) });
        battleChip = t(chip.key === 'fell' ? 'map.chip.fell' : 'map.chip.held', { ago });
        chipColor = chip.key === 'fell' ? '#D64525' : '#3F8F4E';
      }

      return {
        type: 'Feature',
        id: row.id,
        properties: {
          id: row.id,
          name: row.territory_name,
          owner: row.owner_username ?? 'Unclaimed',
          alliance: allianceTag,
          tier: row.tier ?? 'Medium',
          level: `D${developmentLevel}`,
          ownerStreak: row.owner_streak_days ?? 0,
          streakBand: row.owner_id != null ? streakBandForDays(row.owner_streak_days) : 'base',
          emblem: row.alliance_emblem ?? null,
          developmentLevel,
          labelSub: labelParts.join(' · '),
          emblemIcon: row.alliance_id != null ? emblemIconName(row.alliance_emblem, isOwnAlliance) : '',
          contested,
          battleChip,
          chipColor,
          perimeter: row.perimeter_distance,
          color: row.owner_clerk_id === userId ? '#D64525' :
            isOwnAlliance ? '#3F8F4E' :
            row.owner_id != null ? '#4A6B8A' : 'transparent',
        },
        // Winding order already normalised server-side via ST_ForcePolygonCCW.
        geometry: row.geojson ?? {
          type: 'Polygon',
          coordinates: [[
            [row.longitude - 0.003, row.latitude + 0.002],
            [row.longitude + 0.003, row.latitude + 0.002],
            [row.longitude + 0.003, row.latitude - 0.002],
            [row.longitude - 0.003, row.latitude - 0.002],
            [row.longitude - 0.003, row.latitude + 0.002],
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
    setTerritories({
      type: 'FeatureCollection',
      features: Array.from(cache.values()),
    });
    settle();
  }, [userId, myPlayer?.alliance_id, t]);

  // Home bases in viewport (Living Map Phase 2). Coordinates arrive snapped
  // to a ~250m grid server-side (privacy); the player's own base is
  // re-anchored to their exact pin, which the client already holds.
  const fetchBasesForViewport = useCallback(async (bounds) => {
    if (!bounds || !Array.isArray(bounds) || bounds.length < 2) return;
    const [ne, sw] = bounds;
    const seq = ++basesFetchSeqRef.current;

    const { data, error } = await supabase.rpc('get_home_bases_in_viewport', {
      min_lon: sw[0],
      min_lat: sw[1],
      max_lon: ne[0],
      max_lat: ne[1],
    });
    if (seq !== basesFetchSeqRef.current) return;
    if (error) {
      console.log('[bases fetch] ERROR', error.message);
      return;
    }

    const homeLat = Number(myPlayer?.home_pin_lat);
    const homeLng = Number(myPlayer?.home_pin_lng);
    const hasOwnPin = Number.isFinite(homeLat) && Number.isFinite(homeLng);

    let sawSelf = false;
    const features = (data ?? []).map((b) => {
      const isSelf = b.clerk_id === userId;
      if (isSelf) sawSelf = true;
      const isOwnAlliance = Boolean(myPlayer?.alliance_id && b.alliance_id === myPlayer.alliance_id);
      return {
        type: 'Feature',
        id: `base-${b.player_id}`,
        properties: {
          playerId: b.player_id,
          username: b.username,
          baseIcon: `base-${baseTierForLevel(b.level)}-${isSelf ? 'own' : 'other'}`,
          pennantIcon: b.alliance_id != null ? emblemIconName(b.alliance_emblem, isOwnAlliance) : '',
        },
        geometry: {
          type: 'Point',
          coordinates: isSelf && hasOwnPin ? [homeLng, homeLat] : [b.longitude, b.latitude],
        },
      };
    });

    // The RPC drops dormant players; the owner should still see their own base.
    if (!sawSelf && hasOwnPin && myPlayer?.id) {
      features.push({
        type: 'Feature',
        id: `base-${myPlayer.id}`,
        properties: {
          playerId: myPlayer.id,
          username: null,
          baseIcon: `base-${baseTierForLevel(F.calcLevel(Math.max(0, Math.floor(Number(myPlayer?.xp) || 0))))}-own`,
          pennantIcon: '',
        },
        geometry: { type: 'Point', coordinates: [homeLng, homeLat] },
      });
    }

    setBases({ type: 'FeatureCollection', features });
  }, [userId, myPlayer?.alliance_id, myPlayer?.home_pin_lat, myPlayer?.home_pin_lng, myPlayer?.xp, myPlayer?.id]);

  // Keep fetchRef pointing at the latest fetch so settle() can re-invoke it
  // for the deferred (trailing-edge) viewport.
  useEffect(() => {
    fetchRef.current = fetchTerritoriesForViewport;
  }, [fetchTerritoriesForViewport]);

  // Delay showing the loading indicator by 250ms so quick fetches don't flicker.
  useEffect(() => {
    if (!isFetchingTerritories) {
      setShowLoading(false);
      return undefined;
    }
    const t = setTimeout(() => setShowLoading(true), 250);
    return () => clearTimeout(t);
  }, [isFetchingTerritories]);

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
          fetchBasesForViewport(lastBoundsRef.current);
        })();
      }
    }
    previousAllianceIdRef.current = currentAllianceId;
  }, [myPlayer?.alliance_id, fetchTerritoriesForViewport, fetchBasesForViewport]);

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
        // Bases layer is hidden below zoom 12 — skip the query when zoomed out.
        if (zoom >= 11.5) fetchBasesForViewport(bounds);
      } catch (err) {
        console.log('[viewport fetch] getVisibleBounds threw:', err?.message);
      }
    }, 150);
  }, [fetchTerritoriesForViewport, fetchBasesForViewport]);

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
      // Re-check on every focus: the objective clears itself the moment the
      // first claim lands (held_count > 0) and persists across sessions until.
      fetchObjective();
    }, [fetchResourceBanner, fetchPlayer, fetchObjective])
  );

  // Center the map on the player's home pin the first time it becomes available.
  // The Camera's centerCoordinate prop is static (AMSTERDAM_CENTER) and only used
  // at mount — before myPlayer has loaded — so we imperatively fly to the home pin
  // once it arrives. Guarded by didInitialCenterRef so later player refetches (e.g.
  // resource-banner updates) don't yank the camera back while the user is panning.
  useEffect(() => {
    if (didInitialCenterRef.current) return;
    const lat = Number(myPlayer?.home_pin_lat);
    const lng = Number(myPlayer?.home_pin_lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    if (!cameraRef.current) return;
    didInitialCenterRef.current = true;
    cameraRef.current.setCamera({
      centerCoordinate: [lng, lat],
      zoomLevel: INITIAL_ZOOM,
      animationDuration: 0,
    });
  }, [myPlayer?.home_pin_lat, myPlayer?.home_pin_lng]);

  // Fly to a territory tapped in the profile's "Your Territories" list. The
  // caller passes a fresh focusNonce each tap so re-selecting the same
  // territory still fires. Marks didInitialCenter so the home-centering effect
  // above never yanks the camera back afterwards.
  useEffect(() => {
    const target = route.params?.focusTerritory;
    const nonce = route.params?.focusNonce;
    if (!target || nonce == null || nonce === lastFocusNonceRef.current) return;
    lastFocusNonceRef.current = nonce;
    const lat = Number(target.latitude);
    const lng = Number(target.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    didInitialCenterRef.current = true;
    if (cameraRef.current) {
      cameraRef.current.setCamera({
        centerCoordinate: [lng, lat],
        zoomLevel: 15.5,
        animationDuration: 650,
      });
    }
    // Open the detail sheet: use the cached feature if it's already loaded,
    // otherwise defer until the viewport fetch (triggered by the fly) delivers it.
    const cached = target.id ? featureCacheRef.current.get(target.id) : null;
    if (cached) {
      pendingFocusIdRef.current = null;
      setSelected({ feature: cached, allFeatures: territories.features });
    } else {
      pendingFocusIdRef.current = target.id ?? null;
    }
  }, [route.params?.focusTerritory, route.params?.focusNonce, territories.features]);

  // Once the focused territory arrives in the feature cache (from the viewport
  // fetch the fly triggered), open its detail sheet.
  useEffect(() => {
    const id = pendingFocusIdRef.current;
    if (!id) return;
    const feat = featureCacheRef.current.get(id);
    if (feat) {
      pendingFocusIdRef.current = null;
      setSelected({ feature: feat, allFeatures: territories.features });
    }
  }, [territories]);

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
      // Border weight encodes the owner's streak band (deterrence at a glance):
      // base <7d, hardened 7–20d, fortified 21+d (which also gets the inner line).
      lineWidth: [
        'match', ['get', 'streakBand'],
        'hardened', 2.2,
        'fortified', 2.2,
        1.2,
      ],
      lineOpacity: 0.9,
      lineEmissiveStrength: 1.0,
    }),
    [],
  );

  // Inner second wall for fortified (21+ day streak) owners.
  const streakInnerStyle = useMemo(
    () => ({
      lineColor: [
        'case',
        ['==', ['get', 'color'], '#D64525'], '#D64525',
        ['==', ['get', 'color'], '#3F8F4E'], '#3F8F4E',
        ['==', ['get', 'color'], '#4A6B8A'], '#4A6B8A',
        '#5C6068',
      ],
      lineWidth: 1.2,
      lineOpacity: 0.6,
      lineOffset: 3,
      lineEmissiveStrength: 1.0,
    }),
    [],
  );

  const streakInnerFilter = useMemo(
    () => ['==', ['get', 'streakBand'], 'fortified'],
    [],
  );

  // Development rampart — inset ring for D2+, heavier and brighter at D4.
  const rampartStyle = useMemo(
    () => ({
      lineColor: [
        'case',
        ['==', ['get', 'color'], '#D64525'], '#D64525',
        ['==', ['get', 'color'], '#3F8F4E'], '#3F8F4E',
        ['==', ['get', 'color'], '#4A6B8A'], '#4A6B8A',
        '#5C6068',
      ],
      lineWidth: ['case', ['>=', ['get', 'developmentLevel'], 4], 2.4, 1.4],
      lineOpacity: ['case', ['>=', ['get', 'developmentLevel'], 4], 0.95, 0.65],
      lineOffset: 7,
      lineEmissiveStrength: 1.0,
    }),
    [],
  );

  const rampartFilter = useMemo(
    () => ['>=', ['get', 'developmentLevel'], 2],
    [],
  );

  const labelStyle = useMemo(
    () => ({
      // Two-line label: territory name, then "D3 · [VLK]" (development badge +
      // alliance tag) when either applies. labelSub is precomputed per feature.
      textField: [
        'format',
        ['get', 'name'], {},
        [
          'case',
          ['==', ['to-string', ['get', 'labelSub']], ''],
          '',
          ['concat', '\n', ['to-string', ['get', 'labelSub']]],
        ],
        { 'font-scale': 0.85, 'text-color': '#8B8F98' },
      ],
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

  // Alliance emblem shields above alliance-held territories (zoom-gated).
  const emblemStyle = useMemo(
    () => ({
      iconImage: ['get', 'emblemIcon'],
      iconSize: 0.5,
      iconAllowOverlap: false,
      iconOffset: [0, -30],
      iconOpacity: 0.95,
    }),
    [],
  );

  const emblemFilter = useMemo(
    () => ['!=', ['to-string', ['get', 'emblemIcon']], ''],
    [],
  );

  // D4 strongholds rise as extruded walls (visible when the map is tilted;
  // the Phase 1 rampart line still carries the signal top-down).
  const d4WallStyle = useMemo(
    () => ({
      fillExtrusionColor: [
        'case',
        ['==', ['get', 'color'], '#D64525'], '#D64525',
        ['==', ['get', 'color'], '#3F8F4E'], '#3F8F4E',
        ['==', ['get', 'color'], '#4A6B8A'], '#4A6B8A',
        '#5C6068',
      ],
      fillExtrusionHeight: 14,
      fillExtrusionBase: 0,
      fillExtrusionOpacity: 0.55,
    }),
    [],
  );

  const d4WallFilter = useMemo(
    () => ['>=', ['get', 'developmentLevel'], 4],
    [],
  );

  // Home base structures, anchored to their map point like buildings.
  // Sized up with zoom so closing in on a base makes it grow; always placed
  // (allowOverlap) so labels/emblems can never collision-hide a base.
  const baseIconStyle = useMemo(
    () => ({
      iconImage: ['get', 'baseIcon'],
      iconSize: [
        'interpolate', ['linear'], ['zoom'],
        12, 0.4,
        14, 0.55,
        16, 0.85,
        18, 1.15,
      ],
      iconAnchor: 'bottom',
      iconAllowOverlap: true,
      iconOpacity: 1.0,
    }),
    [],
  );

  // Alliance pennant beside the base — reuses the Phase 1 emblem images.
  // Scales by the same zoom factor as the base (0.28/0.55 of its size at
  // every stop); iconOffset is measured in icon px, so it scales with
  // iconSize and the pennant stays pinned to the base's top-right corner.
  const pennantStyle = useMemo(
    () => ({
      iconImage: ['get', 'pennantIcon'],
      iconSize: [
        'interpolate', ['linear'], ['zoom'],
        12, 0.2,
        14, 0.28,
        16, 0.43,
        18, 0.59,
      ],
      iconOffset: [28, -92],
      iconAllowOverlap: true,
      iconOpacity: 0.95,
    }),
    [],
  );

  const pennantFilter = useMemo(
    () => ['!=', ['to-string', ['get', 'pennantIcon']], ''],
    [],
  );

  // Siege border animation — the interval only runs while a contested
  // territory is actually in the viewport, so the idle map does zero work.
  const [siegeDashStep, setSiegeDashStep] = useState(0);
  const hasContested = useMemo(
    () => territories.features.some((f) => f.properties?.contested === true),
    [territories],
  );
  useEffect(() => {
    if (!hasContested) return undefined;
    const id = setInterval(
      () => setSiegeDashStep((s) => (s + 1) % SIEGE_DASH_SEQUENCE.length),
      200,
    );
    return () => clearInterval(id);
  }, [hasContested]);

  const contestedLineStyle = useMemo(
    () => ({
      lineColor: '#D64525',
      lineWidth: 3,
      lineOpacity: 1,
      lineDasharray: SIEGE_DASH_SEQUENCE[siegeDashStep],
      lineEmissiveStrength: 1.0,
    }),
    [siegeDashStep],
  );

  const contestedFilter = useMemo(
    () => ['==', ['get', 'contested'], true],
    [],
  );

  // Battle report chips — always placed (war news outranks label collision).
  const chipStyle = useMemo(
    () => ({
      textField: ['get', 'battleChip'],
      textSize: 9,
      textColor: ['get', 'chipColor'],
      textHaloColor: 'rgba(14,16,20,0.9)',
      textHaloWidth: 1.5,
      textAnchor: 'top',
      textOffset: [0, 2.4],
      textAllowOverlap: true,
      textFont: ['DIN Offc Pro Medium', 'Arial Unicode MS Regular'],
    }),
    [],
  );

  const chipFilter = useMemo(
    () => ['!=', ['to-string', ['get', 'battleChip']], ''],
    [],
  );

  const selectedId = selected?.feature?.id ?? null;

  // Matches only the currently selected territory; a sentinel that no real
  // territory id can equal keeps the highlight layers empty when nothing is tapped.
  const highlightFilter = useMemo(
    () => ['==', ['get', 'id'], selectedId == null ? '__none__' : selectedId],
    [selectedId],
  );

  // Brighten the selected territory's fill so it stands out from neighbours.
  // Unclaimed (transparent) territories get a faint bone wash instead.
  const selectedFillStyle = useMemo(
    () => ({
      fillColor: [
        'case',
        ['==', ['get', 'color'], 'transparent'], '#F2EEE6',
        ['get', 'color'],
      ],
      fillOpacity: [
        'case',
        ['==', ['get', 'color'], 'transparent'], 0.12,
        0.68,
      ],
      fillEmissiveStrength: 1.0,
    }),
    [],
  );

  // Soft bone halo rendered under the crisp outline for a glow / pop-out effect.
  // Tuned for the dark `night` basemap — wider and more opaque so the glow reads
  // clearly against the dark ground (it was washing out on the old light style).
  const selectedGlowStyle = useMemo(
    () => ({
      lineColor: '#F2EEE6',
      lineWidth: 9,
      lineOpacity: 0.4,
      lineBlur: 6,
      lineEmissiveStrength: 1.0,
    }),
    [],
  );

  // Crisp bright outline on top of the glow.
  const selectedLineStyle = useMemo(
    () => ({
      lineColor: '#FFFFFF',
      lineWidth: 3,
      lineOpacity: 1,
      lineEmissiveStrength: 1.0,
    }),
    [],
  );

  const recenter = () => {
    if (!cameraRef.current) return;
    const homeLat = Number(myPlayer?.home_pin_lat);
    const homeLng = Number(myPlayer?.home_pin_lng);
    const homeCoord =
      Number.isFinite(homeLat) && Number.isFinite(homeLng) ? [homeLng, homeLat] : null;
    const centerCoordinate = lastUserCoord ?? homeCoord ?? AMSTERDAM_CENTER;
    cameraRef.current.setCamera({
      centerCoordinate,
      zoomLevel: INITIAL_ZOOM,
      animationDuration: 600,
    });
  };

  return (
    <View style={styles.screen} onTouchStart={tips.onTouchStart}>
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
      {objectiveActive ? (
        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [styles.objectiveBanner, pressed && { opacity: 0.9 }]}
          onPress={flyToObjective}
        >
          <Text style={styles.objectiveBannerKicker}>{t('firstClaim.kicker')}</Text>
          <Text style={styles.objectiveBannerText}>
            {t('firstClaim.instruction', {
              distance: formatWalkDistance(objective.distance_m),
              name: objective.name,
            })}
          </Text>
        </Pressable>
      ) : null}
      {topBannerMessage ? (
        <View style={styles.topBanner}>
          <Text style={styles.topBannerText}>{topBannerMessage}</Text>
        </View>
      ) : null}
      {showLoading && !topBannerMessage ? (
        <View pointerEvents="none" style={styles.loadingWrap}>
          <View style={styles.loadingPill}>
            <ActivityIndicator size="small" color="#F2EEE6" />
            <Text style={styles.loadingText}>{t('map.loadingTerritories')}</Text>
          </View>
        </View>
      ) : null}
      <View ref={mapWrapRef} collapsable={false} style={styles.map}>
      <MapboxGL.MapView
        ref={mapRef}
        style={styles.map}
        styleURL="mapbox://styles/mapbox/standard"
        onCameraChanged={onCameraChanged}
      >
        <MapboxGL.StyleImport
          id="basemap"
          existing
          config={{ lightPreset: 'night' }}
        />
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

        <MapboxGL.Images>
          {BASE_TIERS.flatMap((tier) => [
            <MapboxGL.Image key={`base-${tier}-own`} name={`base-${tier}-own`}>
              <View style={{ width: 40, height: 40 }} collapsable={false}>
                <SvgXml xml={baseXml(tier, { tint: CLAIM })} width={40} height={40} />
              </View>
            </MapboxGL.Image>,
            <MapboxGL.Image key={`base-${tier}-other`} name={`base-${tier}-other`}>
              <View style={{ width: 40, height: 40 }} collapsable={false}>
                <SvgXml xml={baseXml(tier, { tint: BONE })} width={40} height={40} />
              </View>
            </MapboxGL.Image>,
          ])}
          {ALLIANCE_EMBLEMS.concat('unknown').flatMap((key) => [
            <MapboxGL.Image key={`${key}-ally`} name={`emblem-${key}-ally`}>
              <View style={{ width: 40, height: 40 }} collapsable={false}>
                <SvgXml xml={emblemXml(key, { glyph: ALLIANCE })} width={40} height={40} />
              </View>
            </MapboxGL.Image>,
            <MapboxGL.Image key={`${key}-enemy`} name={`emblem-${key}-enemy`}>
              <View style={{ width: 40, height: 40 }} collapsable={false}>
                <SvgXml xml={emblemXml(key, { glyph: ENEMY })} width={40} height={40} />
              </View>
            </MapboxGL.Image>,
          ])}
        </MapboxGL.Images>

        <MapboxGL.ShapeSource
          id="territories"
          shape={territories}
          onPress={(e) => {
            const f = e?.features?.[0];
            if (f) setSelected({ feature: f, allFeatures: territories.features });
          }}
        >
          <MapboxGL.FillLayer id="territories-fill" style={fillStyle} />
          <MapboxGL.FillExtrusionLayer id="territories-d4-walls" filter={d4WallFilter} style={d4WallStyle} />
          <MapboxGL.LineLayer id="territories-line" style={lineStyle} />
          <MapboxGL.LineLayer id="territories-streak-inner" filter={streakInnerFilter} style={streakInnerStyle} />
          <MapboxGL.LineLayer id="territories-rampart" filter={rampartFilter} style={rampartStyle} />
          <MapboxGL.LineLayer id="territories-contested" filter={contestedFilter} style={contestedLineStyle} />
          <MapboxGL.FillLayer id="territories-selected-fill" filter={highlightFilter} style={selectedFillStyle} />
          <MapboxGL.LineLayer id="territories-selected-glow" filter={highlightFilter} style={selectedGlowStyle} />
          <MapboxGL.LineLayer id="territories-selected-line" filter={highlightFilter} style={selectedLineStyle} />
          <MapboxGL.SymbolLayer id="territories-labels" slot="top" style={labelStyle} />
          <MapboxGL.SymbolLayer id="territories-emblems" slot="top" minZoomLevel={13} filter={emblemFilter} style={emblemStyle} />
          <MapboxGL.SymbolLayer id="territories-battle-chips" slot="top" minZoomLevel={12} filter={chipFilter} style={chipStyle} />
        </MapboxGL.ShapeSource>

        <MapboxGL.ShapeSource
          id="bases"
          shape={bases}
          onPress={(e) => {
            const f = e?.features?.[0];
            const playerId = f?.properties?.playerId;
            if (!playerId || playerId === myPlayer?.id) return;
            navigation.navigate('PublicProfile', {
              playerId,
              username: f?.properties?.username ?? undefined,
            });
          }}
        >
          <MapboxGL.SymbolLayer id="bases-icons" slot="top" minZoomLevel={12} style={baseIconStyle} />
          <MapboxGL.SymbolLayer id="bases-pennants" slot="top" minZoomLevel={13} filter={pennantFilter} style={pennantStyle} />
        </MapboxGL.ShapeSource>

        {objectiveActive ? (
          <MapboxGL.ShapeSource id="first-claim-objective" shape={objectiveFeature} onPress={openObjectiveSheet}>
            <MapboxGL.FillLayer id="objective-fill" style={objectiveFillStyle} />
            <MapboxGL.LineLayer id="objective-line" style={objectiveLineStyle} />
          </MapboxGL.ShapeSource>
        ) : null}
        {objectiveActive && selected == null ? (
          <MapboxGL.MarkerView
            coordinate={[objective.longitude, objective.latitude]}
            anchor={{ x: 0.5, y: 0.5 }}
            allowOverlap
          >
            <ObjectivePulse />
          </MapboxGL.MarkerView>
        ) : null}
      </MapboxGL.MapView>
      </View>

      <Pressable accessibilityRole="button" style={styles.locateButton} onPress={recenter}>
        <Text style={styles.locateIcon}>⌖</Text>
        <Text style={styles.locateText}>{t('map.locateMe')}</Text>
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
        objectiveTerritoryId={objectiveActive ? objective.id : null}
      />
      <MapSideRail hidden={selected != null} />

      {tips.tipElement}
      <NotifPrimeModal
        visible={showNotifPrime}
        onAllow={() => {
          setShowNotifPrime(false);
          markFired(userId, 'notifPrime');
          markFired(userId, 'notifAllow');
        }}
        onLater={() => {
          setShowNotifPrime(false);
          markFired(userId, 'notifPrime');
        }}
      />
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

  objectiveBanner: {
    backgroundColor: INK2,
    borderWidth: 1,
    borderColor: CLAIM,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginHorizontal: 0,
  },
  objectiveBannerKicker: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 9,
    color: CLAIM,
    letterSpacing: 1.4,
    marginBottom: 2,
  },
  objectiveBannerText: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 11,
    color: BONE,
    letterSpacing: 0.4,
  },
  sheetObjectiveHint: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 10,
    color: CLAIM,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  objectivePulseWrap: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  objectivePulseRing: {
    position: 'absolute',
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: CLAIM,
  },
  objectivePulseCore: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: CLAIM,
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

  loadingWrap: {
    position: 'absolute',
    top: (StatusBar.currentHeight ?? 0) + 48,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 90,
  },
  loadingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: INK2,
    borderWidth: 1,
    borderColor: HAIRLINE_STRONG,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  loadingText: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 10,
    color: BONE,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
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
  sheetRowValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
