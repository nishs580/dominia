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
import { colors } from '../lib/theme';
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
import ResourceDeltaValue from '../components/ResourceDeltaValue';
import SitrepCard from '../components/SitrepCard';
import DevGlyph from '../components/DevGlyph';
import { geojsonBboxCenter } from '../lib/territoryShape';
import { SvgXml } from 'react-native-svg';
import AllianceEmblem from '../components/AllianceEmblem';
import { ALLIANCE_EMBLEMS, emblemXml } from '../lib/allianceEmblems';
import { BASE_TIERS, baseTierForLevel, baseXml } from '../lib/homeBases';
import { battleChipFor } from '../lib/battleChips';
import {
  BOARD_BASEMAP_CONFIG,
  BOARD_SCRIM_STYLE,
  HATCH_PATTERNS,
  HATCH_PATTERN_EXPRESSION,
  HATCH_TILE,
  PUCK_HEADING_IMAGE,
  PUCK_HEADING_SIZE,
  puckHeadingXml,
  TERRITORY_FLAG_ICONS,
  TERRITORY_FLAG_SIZE,
  territoryMarkerIcon,
  territoryNodeFeatures,
} from '../lib/mapBoard';
import { useFirstTapTips, rectFromRef } from '../components/FirstTapTips';
import NotifPrimeModal from '../components/NotifPrimeModal';
import { hasFired, markFired, onWalkthroughFired } from '../lib/walkthroughFlags';
import { fetchFirstClaimObjective, formatWalkDistance } from '../lib/firstClaimApi';
import { SPINE_EVENTS, gateSpineState, isSpineComplete, resumeBeat, spineReduce } from '../lib/firstClaimSpine';
import { getFlag, useFlag } from '../lib/flags';
import { navigateTo } from '../lib/navigation';
import MapTopBar from '../components/MapTopBar';
import TerritoryCard from '../components/TerritoryCard';
import { territoryOwnership, territoryOwnershipFor } from '../lib/territoryCard';
import DefendPopup, { useDefendPopupFeed } from '../components/DefendPopup';
import { defendPopupModel, defendStartParams } from '../lib/defendPopup';
import { getDefendPreview, postDefend } from '../lib/contestDefendApi';
import RelocateSheet from '../components/RelocateSheet';
import CoachMark from '../components/CoachMark';
import { COACH_EVENTS, COACH_FLAG_NAMES, COACH_STEPS, coachReduce, initialCoachState } from '../lib/coachMarks';
import { TUTORIAL_NAMES } from '../lib/onboardingFlow';
import { relocateTarget } from '../lib/relocate';
import { PinIcon } from '../components/MapIcons';
import { visibleMapLayers } from '../lib/mapLayers';
import { loadSpineState, saveSpineState } from '../lib/firstClaimSpineStore';
import { selectFirstClaimTarget } from '../lib/firstClaimTarget';
import { centredFlightCamera, flightBounds } from '../lib/mapFlight';
import { loadHomePin, peekHomePin, saveHomePin } from '../lib/homePinCache';
import { getMe } from '../lib/meApi';
import {
  connectChatRealtime,
  disconnectChatRealtime,
  subscribeToEvent,
} from '../lib/chatRealtime';

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

// Fallback map centres for the two beta cities, used only until the camera can
// settle on the player's home pin or live position. The ru locale cohort plays
// in Saint Petersburg; everyone else starts in Bengaluru.
const FALLBACK_CENTRE_BENGALURU = [77.5946, 12.9716];
const FALLBACK_CENTRE_SAINT_PETERSBURG = [30.3158, 59.9343];
// home_city is still anon-readable (unlike home_pin_*), so it beats the locale
// guess whenever the player row has loaded but the pin hasn't.
const CITY_CENTRES = {
  Bengaluru: FALLBACK_CENTRE_BENGALURU,
  'Saint Petersburg': FALLBACK_CENTRE_SAINT_PETERSBURG,
};
const INITIAL_ZOOM = 14;

// Beat 1 camera hook (first-claim spine): city-wide open, a beat of stillness,
// then one flight down to the home pin + objective. No copy over the move.
const FLIGHT_CITY_ZOOM = 10.5;
const FLIGHT_HOLD_MS = 1500;
const FLIGHT_MS = 2600;
const FLIGHT_SETTLE_BUFFER_MS = 250;
// How long the hold may stretch waiting for the objective to resolve (backend
// cold starts) before the flight gives up and settles on the home pin alone.
const FLIGHT_TARGET_TIMEOUT_MS = 10000;

const INK = colors.ink;
const INK2 = colors.ink2;
const BONE = colors.bone;
const SLATE = colors.slate;
const SLATE2 = colors.slate2;
const CLAIM = colors.claim;
const ALLIANCE = colors.alliance;
const ENEMY = colors.enemy;
const UNCLAIMED = 'transparent';
const HAIRLINE = colors.hairline;
const HAIRLINE_STRONG = colors.hairlineStrong;
const CLAIM_SOFT = colors.claimSoft;

// Ownership is data, not colour (Dominia-Temp plan U1). Every territory
// feature carries `ownership` ('yours' | 'alliance' | 'enemy' | 'unclaimed')
// and its `color` is derived from it here, so retuning the palette can never
// misclassify ground. Layer expressions read `ownership` too.
const OWNERSHIP_COLOR = {
  yours: colors.self,
  alliance: colors.alliance,
  enemy: colors.enemy,
  unclaimed: UNCLAIMED,
};
const ownershipColourExpression = (fallback) => [
  'match',
  ['get', 'ownership'],
  'yours', colors.self,
  'alliance', colors.alliance,
  'enemy', colors.enemy,
  fallback,
];

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
    case 'insufficient_gold':
      // Gold-only economy (402): same body and copy as the claim flow.
      return t('map.startErr.insufficientGold', { n: context.required_gold - context.player_gold });
    default:
      return null;
  }
}

// Claim/contest start, shared by TerritorySheet and TerritoryCard (Figma
// parity plan U11) so the start flow lives in one place. Each resolves to
// { ok: true } after navigating to ActiveClaim, or a failure the caller
// renders in its own surface.
function claimStartErrorMessage(t, startError, tier) {
  const { code, context = {} } = startError;
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
    case 'claim_cooldown':
      return t('map.startErr.cooldown', { countdown: liveCountdown(t, context.cooldown_until) });
    case 'network_error':
      return t('map.startErr.network');
    case 'no_token':
    case 'unauthorized':
      return t('map.startErr.signIn');
    default:
      return t('map.startErr.generic');
  }
}

// -> { ok: true } | { ok: false, error: { code, context, status } }
async function beginClaim({ territory, name, perimeter, getTokenRef, myPlayer, setMyPlayer, navigation, onClose }) {
  const result = await startClaim({
    clerkGetToken: () => getTokenRef.current(),
    territoryId: territory.id,
  });
  if (!result.ok) {
    return { ok: false, error: { code: result.code, context: result.context, status: result.status } };
  }
  setMyPlayer((prev) => (prev ? { ...prev, gold: result.data.gold_balance_after } : prev));
  onClose?.();
  navigation.navigate('ActiveClaim', {
    territoryName: name,
    perimeterDistance: perimeter,
    territoryId: territory.id,
    territoryGeojson: territory?.geometry ?? null,
    playerId: myPlayer?.id,
    goldPaid: result.data.gold_paid,
    freeClaim: result.data.free_claim,
    intentExpiresAt: result.data.expires_at ?? null,
    armExpiresAt: result.data.arm_expires_at ?? null,
    walkWindowMinutes: result.data.walk_window_minutes ?? null,
  });
  return { ok: true };
}

// -> { ok: true } | { ok: false, code, context }
async function beginContest({ territory, name, getTokenRef, myPlayer, setMyPlayer, navigation, onClose }) {
  const result = await startContest({
    clerkGetToken: () => getTokenRef.current(),
    territoryId: territory.id,
  });
  if (!result.ok) return { ok: false, code: result.code, context: result.context };
  const env = result.data;
  // Gold-only economy: the start charged Gold; the balance after is echoed.
  if (typeof env?.gold_balance_after === 'number' && Number.isFinite(env.gold_balance_after)) {
    setMyPlayer?.((prev) => (prev ? { ...prev, gold: env.gold_balance_after } : prev));
  }
  onClose?.();
  navigation.navigate('ActiveClaim', {
    mode: 'contest',
    territoryName: name,
    territoryId: territory.id,
    territoryGeojson: territory?.geometry ?? null,
    contestId: env.contest_id,
    contestExpiresAt: env.expires_at ?? null,
    requiredWalkM: env.required_walk_m,
    attackerAllianceId: env.attacker_alliance_id,
    playerId: myPlayer?.id,
    // A LOST result shows GOLD −n for what the start charged.
    goldPaid: env.gold_cost_paid,
  });
  return { ok: true };
}

function TerritorySheet({ territory, onClose, userId, onTerritoriesRefetched, onResourceBannerRefresh, myPlayer, setMyPlayer, getTokenRef, showTopBanner, allFeatures = [], objectiveTerritoryId = null, spineActive = false, onSpineClaim }) {
  const navigation = useNavigation();
  const { t } = useTranslation();
  // App-only sheet rows and actions (Figma parity plan U3).
  const developmentOn = useFlag('territory_development');
  const legacyOn = useFlag('territory_legacy');
  const streaksOn = useFlag('streaks');
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

  const territoryOwner = territoryOwnership(territory.properties);
  const isYours = territoryOwner === 'yours' || territoryOwner === 'alliance';
  const isOwnTerritory = territoryOwner === 'yours';
  const isAllianceTerritory = territoryOwner === 'alliance';
  const isOwned = !isUnclaimed;

  // Top border colour reflects territory state
  let topBorderColour = 'rgba(253,253,253,0.30)'; // unclaimed default (Slate)
  if (isOwnTerritory) topBorderColour = colors.self;
  else if (isAllianceTerritory) topBorderColour = colors.alliance;
  else if (isOwned) topBorderColour = colors.enemy;

  // Label above territory name
  let stateLabel = t('map.stateUnclaimed');
  if (isOwnTerritory) stateLabel = t('map.stateYours');
  else if (isAllianceTerritory) stateLabel = t('map.stateAlliance');
  else if (isOwned) stateLabel = t('map.stateEnemy');

  const playerXp = Math.max(0, Math.floor(Number(myPlayer?.xp) || 0));
  const cap = territoryCapForLevel(F.calcLevel(playerXp));
  const heldCount = allFeatures.filter(f => territoryOwnership(f.properties) === 'yours').length;
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

  const startErrorMessage = startError ? claimStartErrorMessage(t, startError, tier) : null;

  const startErrorAllowsRetry = startError
    && !['level_too_low', 'insufficient_gold', 'territory_already_claimed', 'active_claim_in_progress', 'claim_cooldown', 'no_token', 'unauthorized'].includes(startError.code);

  // Beat 3 of the first-claim spine: the objective's sheet in its focused
  // state — perimeter distance as the single highlighted number, one
  // supporting line, CLAIM IT / LATER. CLAIM IT is the existing confirm
  // action (handleAcceptClaim → startClaim) relabelled; one tap starts the
  // claim. LATER is the existing dismiss path, labelled. Everywhere else the
  // sheet is completely standard.
  const spineFocus =
    spineActive &&
    sheetState === 'info' &&
    isUnclaimed &&
    !isAtCap &&
    objectiveTerritoryId != null &&
    territory.id === objectiveTerritoryId;

  const handleAcceptClaim = async () => {
    setIsDeducting(true);
    setStartError(null);
    try {
      const result = await beginClaim({
        territory,
        name: selectedTerritory.name,
        perimeter: selectedTerritory.perimeter,
        getTokenRef,
        myPlayer,
        setMyPlayer,
        navigation,
        onClose,
      });
      if (!result.ok) {
        setStartError(result.error);
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
      const result = await beginContest({
        territory,
        name: selectedTerritory.name,
        getTokenRef,
        myPlayer,
        setMyPlayer,
        navigation,
        onClose,
      });
      if (!result.ok) {
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
            <Text style={[styles.sheetTitle, { flexShrink: 1 }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{name}</Text>
            <View style={styles.sheetTierBadge}>
              <Text style={styles.sheetTierBadgeText}>{tier}</Text>
            </View>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={onClose}
          style={styles.sheetClose}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.sheetCloseText}>×</Text>
        </Pressable>
      </View>

      {spineFocus && (
        <>
          <View style={styles.spineHeroBlock}>
            <Text style={styles.spineHeroLabel}>{t('map.walkToClaim')}</Text>
            <Text style={styles.spineHeroValue}>
              {t('map.walkDistanceValue', { metres: walkDistance.toLocaleString() })}
            </Text>
            <Text style={styles.spineSupportLine}>
              {t('firstClaim.sheetLine', { distance: formatWalkDistance(walkDistance) })}
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            disabled={isDeducting}
            style={({ pressed }) => [
              styles.sheetAction,
              pressed && { opacity: 0.92 },
              isDeducting && { opacity: 0.6 },
            ]}
            onPress={() => {
              onSpineClaim?.();
              setSheetState('confirm');
              handleAcceptClaim();
            }}
          >
            <Text style={styles.sheetActionText}>
              {isDeducting ? t('map.processing') : t('firstClaim.claimIt')}
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [styles.sheetCancel, pressed && { opacity: 0.92 }]}
            onPress={onClose}
          >
            <Text style={styles.sheetCancelText}>{t('firstClaim.later')}</Text>
          </Pressable>
        </>
      )}

      {sheetState === 'info' && !spineFocus && (
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
                      glyph={isAllianceTerritory ? colors.alliance : colors.enemy}
                    />
                  ) : null}
                  <Text style={styles.sheetRowValue}>
                    {owner}
                    {alliance ? <Text style={styles.sheetAllianceTag}> [{alliance}]</Text> : null}
                  </Text>
                </View>
              </View>
            )}
            {streaksOn && !isUnclaimed && (
              <View style={styles.sheetRow}>
                <Text style={styles.sheetRowLabel}>{t('map.streak')}</Text>
                <Text style={styles.sheetRowValue}>{streakTierName(ownerStreakTier.tier)}</Text>
              </View>
            )}
            <View style={styles.sheetRow}>
              <Text style={styles.sheetRowLabel}>{walkLabel}</Text>
              <Text style={styles.sheetRowValue}>{t('map.walkDistanceValue', { metres: walkDistance.toLocaleString() })}</Text>
            </View>
          </View>

          {/* Influence hero row */}
          {developmentOn && (
            <>
          <View style={styles.sheetInfluenceRow}>
            <View>
              <Text style={styles.sheetInfluenceLabel}>{t('map.generates')}</Text>
              <Text style={styles.sheetInfluenceSub}>{t('map.influencePerDay')}</Text>
            </View>
            <Text style={styles.sheetInfluenceValue}>{t('map.influenceValue', { n: influence })}</Text>
          </View>
          <Text style={styles.sheetGloss}>{t('map.influenceGloss')}</Text>
            </>
          )}

          {/* Expanded detail */}
          {expanded && (
            <View style={styles.sheetExpandedBlock}>
              {developmentOn && (
              <View style={styles.sheetRow}>
                <Text style={styles.sheetRowLabel}>{t('map.development')}</Text>
                <Text style={styles.sheetRowValue}>
                  D{developmentLevel} · {developmentName(developmentLevel)}
                </Text>
              </View>
              )}
              {legacyOn && (
                <>
              <View style={styles.sheetRow}>
                <Text style={styles.sheetRowLabel}>{t('map.legacy')}</Text>
                <Text style={styles.sheetRowValue}>
                  {legacyRank == null ? '—' : `R${legacyRank} · ${F.legacyRankName(legacyRank)}`}
                </Text>
              </View>
              <Text style={styles.sheetGloss}>{t('map.legacyGloss')}</Text>
                </>
              )}
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
                  {legacyOn && (
                  <View style={styles.sheetRow}>
                    <Text style={styles.sheetRowLabel}>{t('map.hallOfHolders')}</Text>
                    <Text style={styles.sheetRowValue}>{formatHolderCount(historyStats.holderCount)}</Text>
                  </View>
                  )}
                </>
              )}

              {/* Your walk block — only when it's an attackable territory */}
              {isOwned && !isYours && (
                <View style={styles.sheetYourWalk}>
                  <Text style={styles.sheetYourWalkLabel}>{t('map.yourWalk')}</Text>
                  <Text style={styles.sheetYourWalkValue}>
                    {t('map.yourWalkValue', { metres: walkDistance.toLocaleString(), iron: ironCost })}
                  </Text>
                  {streaksOn && reductionPct > 0 && (
                    <Text style={styles.sheetYourWalkSub}>
                      {t('map.streakReduces', { days: myStreak, pct: reductionPct })}
                    </Text>
                  )}
                </View>
              )}
            </View>
          )}

          {/* Expand toggle — text only per brand rules */}
          <Pressable
            accessibilityRole="button"
            onPress={() => setExpanded(e => !e)}
            style={styles.sheetToggle}
            hitSlop={{ top: 10, bottom: 10, left: 24, right: 24 }}
          >
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

          {developmentOn && isOwnTerritory && !isMaxDev && (
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

          {developmentOn && isOwnTerritory && isMaxDev && (
            <View style={styles.sheetActionDisabled}>
              <Text style={styles.sheetActionDisabledText}>{t('map.devCitadelComplete')}</Text>
            </View>
          )}

          {legacyOn && isOwnTerritory && !isAllianceTerritory && (
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [styles.sheetActionSecondary, pressed && { opacity: 0.92 }]}
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

          {/* CONTEST is the primary action of this sheet and now looks like it.
              It previously shared sheetActionSecondary with ABANDON, so taking
              ground off another player was styled identically to giving your own
              away — the whole purpose of the screen rendered as an afterthought.
              DESIGN.md reserves Claim Red for the Inspect Sheet primary CTA on
              Map, so this is where the screen's one red belongs. */}
          {isOwned && !isYours && !isAllianceTerritory && (
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [styles.sheetAction, pressed && { opacity: 0.92 }]}
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
                  // Carry the resource the player came to earn so Activity can
                  // name it and pre-select a paying axis (challenges pay iron/
                  // stone; gold has no paying axis, so that banner stays hidden).
                  navigateTo('Activity', { needResource: contestMode ? 'iron' : 'gold' });
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
                  <View style={styles.devValueRow}>
                    <DevGlyph level={4} />
                    <Text style={styles.sheetConfirmValue}>D4 · {devLevelName(4)}</Text>
                  </View>
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
                  <View style={styles.devValueRow}>
                    <DevGlyph level={developmentLevel} />
                    <Text style={styles.sheetConfirmValue}>
                      D{developmentLevel} · {devLevelName(developmentLevel)}
                    </Text>
                  </View>
                </View>
                <View style={styles.sheetConfirmDataRow}>
                  <Text style={styles.sheetConfirmLabel}>
                    {sheetState === 'developConfirm' ? t('map.devBecomes') : t('map.devNext')}
                  </Text>
                  <View style={styles.devValueRow}>
                    <DevGlyph level={devTarget} />
                    <Text style={styles.sheetConfirmValue}>
                      D{devTarget} · {devLevelName(devTarget)}
                    </Text>
                  </View>
                </View>
                {devRows.map((r) => (
                  <View key={r.key} style={styles.sheetConfirmDataRow}>
                    <Text style={styles.sheetConfirmLabel}>{t(`map.devResource.${r.key}`)}</Text>
                    <Text
                      style={[
                        styles.sheetConfirmValue,
                        // Affordability is weight-and-tone, never territory colour:
                        // Bone when covered, Slate when short (Locked Meaning Rule).
                        r.have < r.cost && { color: SLATE2 },
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
// Cadence is the brand's ambient 2000ms on the brand curve.
function ObjectivePulse() {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 2000,
          easing: Easing.bezier(0.2, 0, 0, 1),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, { toValue: 0, duration: 0, useNativeDriver: true }),
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
  // Read before the flight effects below; mirrors `figmaChrome` further down.
  const figmaModeEarly = !useFlag('legacy_tabs');
  const figmaChromeRef = useRef(figmaModeEarly);
  figmaChromeRef.current = figmaModeEarly;
  const navigation = useNavigation();
  const route = useRoute();
  const { t, i18n } = useTranslation();
  // Last resort only — a guess from the UI language, used when we know nothing
  // about this player yet. fallbackCentre (below) prefers real signals.
  const localeCentre = i18n.language?.startsWith('ru')
    ? FALLBACK_CENTRE_SAINT_PETERSBURG
    : FALLBACK_CENTRE_BENGALURU;
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
  // the map opens on the locale fallback centre (the Camera's static prop) instead
  // of where the player placed their home pin during onboarding.
  const didInitialCenterRef = useRef(false);
  // True once the map opened straight onto the home pin (i.e. not via the
  // one-time spine flight, which frames the objective itself).
  const plainOpenRef = useRef(false);
  // Set the moment the player touches the map. Any automatic reframe must
  // stand down after this — yanking the camera out from under a pan is worse
  // than leaving the objective off-screen.
  const userMovedCameraRef = useRef(false);
  // One-shot: the outstanding objective has been framed, don't do it again.
  const objectiveFramedRef = useRef(false);
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
  // Territory-fetch failure surfaced to the player (offline, flaky data). A
  // successful fetch clears it; Retry re-fires the last viewport.
  const [mapError, setMapError] = useState(false);
  // Colour-key panel toggled from the KEY control beside LOCATE.
  const [legendOpen, setLegendOpen] = useState(false);
  // While territory search is open its results drop down the right edge, so
  // the side rail steps aside (it would otherwise sit on top of them).
  const [searchActive, setSearchActive] = useState(false);
  // The key is a glance aid: picking a territory closes it so it never sits
  // over the search bar or the sheet.
  useEffect(() => {
    if (selected != null) setLegendOpen(false);
  }, [selected]);
  // True after a successful fetch that left the feature cache empty — the
  // player is looking at unmapped ground and deserves a line saying so.
  const [emptyViewport, setEmptyViewport] = useState(false);
  const [myAllianceName, setMyAllianceName] = useState(null);
  const [myPlayer, setMyPlayer] = useState(null);
  const [topBannerMessage, setTopBannerMessage] = useState(null);
  const topBannerTimerRef = useRef(null);
  const { userId, getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  useEffect(() => { getTokenRef.current = getToken; }, [getToken]);

  // Home pin cached on this device. The authoritative copy only reaches us
  // through GET /me — territories come from Supabase, so a slow or unreachable
  // backend used to leave the map fully rendered but centred on the locale
  // fallback city instead of home. peek() covers a warm remount with no await
  // at all; the effect covers a cold start.
  const [cachedHomePin, setCachedHomePin] = useState(() => peekHomePin(userId));
  const cachedHomePinRef = useRef(cachedHomePin);
  useEffect(() => { cachedHomePinRef.current = cachedHomePin; }, [cachedHomePin]);
  useEffect(() => {
    if (!userId) return undefined;
    let cancelled = false;
    loadHomePin(userId).then((coord) => {
      if (!cancelled && coord) setCachedHomePin(coord);
    });
    return () => { cancelled = true; };
  }, [userId]);

  // The player's home pin as [lng, lat]: the authoritative value from /me when
  // we have it, otherwise the one cached on this device. Every consumer below
  // (camera, own base marker, LOCATE, first-claim target) reads this, so none
  // of them silently lose home when the backend is unreachable.
  const homePin = useMemo(() => {
    const lat = Number(myPlayer?.home_pin_lat);
    const lng = Number(myPlayer?.home_pin_lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return cachedHomePin;
    // Keep the cached array's identity when /me confirms what we already had —
    // the value is a dependency of the bases fetch and the centering effect.
    if (cachedHomePin && cachedHomePin[0] === lng && cachedHomePin[1] === lat) return cachedHomePin;
    return [lng, lat];
  }, [myPlayer?.home_pin_lat, myPlayer?.home_pin_lng, cachedHomePin]);

  // Where the map should open, best signal first: the pin, then the player's
  // home city, then the language guess.
  const fallbackCentre = useMemo(
    () => homePin ?? CITY_CENTRES[myPlayer?.home_city] ?? localeCentre,
    [homePin, myPlayer?.home_city, localeCentre],
  );

  // ── First-tap tips + persistent first-claim objective ─────────────────────
  const { width: winW, height: winH } = useWindowDimensions();
  const mapWrapRef = useRef(null);
  const [objective, setObjective] = useState(null);
  const [heldCount, setHeldCount] = useState(null);
  // Server confirmed held_count 0 with no small/medium target — the client
  // fallback (nearest unclaimed of any tier, from loaded features) may apply.
  const [serverHadNoTarget, setServerHadNoTarget] = useState(false);
  const [showNotifPrime, setShowNotifPrime] = useState(false);

  // ── First-claim spine (Beats 1–3, once per account) ───────────────────────
  // spine is null until the persisted state loads; spineRef mirrors it
  // synchronously so same-tick handlers (claim → close) see the transition.
  const [spine, setSpine] = useState(null);
  const spineRef = useRef(null);
  const [flightPhase, setFlightPhase] = useState('idle'); // idle | hold | await-target | flying
  // Flag off: the spine loads as complete (not persisted) and the objective
  // banner, layers and pulse never mount.
  const firstClaimObjectiveOn = useFlag('first_claim_objective');

  useEffect(() => {
    if (!userId) return undefined;
    let cancelled = false;
    loadSpineState(userId).then((state) => {
      if (cancelled) return;
      const gated = gateSpineState(state, { objectiveEnabled: firstClaimObjectiveOn });
      spineRef.current = gated;
      setSpine(gated);
    });
    return () => {
      cancelled = true;
    };
  }, [userId, firstClaimObjectiveOn]);

  const dispatchSpine = useCallback(
    (event) => {
      const current = spineRef.current;
      if (!current) return;
      const next = spineReduce(current, event, { objectiveEnabled: firstClaimObjectiveOn });
      if (next === current) return;
      spineRef.current = next;
      setSpine(next);
      saveSpineState(userId, next);
    },
    [userId, firstClaimObjectiveOn],
  );

  const spineActive = spine != null && !isSpineComplete(spine);
  const flightActive = flightPhase !== 'idle';
  // True from mount until Beat 1 settles (covers the wait before the
  // choreography starts) — no objective copy or pulse may show before it.
  const spineFlightPending = spineActive && spine.beat === 'flight';

  // Position is resolved server-side from the home pin — deterministic and
  // matches where the first claim should feel grounded.
  const fetchObjective = useCallback(async () => {
    const res = await fetchFirstClaimObjective({ clerkGetToken: () => getTokenRef.current() });
    if (!res.ok) {
      // Never block the spine on a failed objective fetch — the banner
      // surfaces on a later successful refetch.
      setHeldCount((prev) => (prev == null ? 0 : prev));
      return;
    }
    setHeldCount(res.data.held_count ?? 0);
    setObjective(res.data.target ?? null);
    setServerHadNoTarget((res.data.held_count ?? 0) === 0 && res.data.target == null);
  }, []);

  // D2 fallback: when no unclaimed small/medium exists realm-wide, target the
  // nearest unclaimed territory of any tier among the features already loaded.
  const fallbackObjective = useMemo(() => {
    if (!serverHadNoTarget || heldCount !== 0) return null;
    const sel = selectFirstClaimTarget({
      homeLat: homePin?.[1],
      homeLng: homePin?.[0],
      features: territories.features,
    });
    if (!sel) return null;
    const props = sel.feature.properties ?? {};
    return {
      id: sel.feature.id,
      name: props.name,
      tier: props.tier,
      perimeter_distance: props.perimeter,
      longitude: sel.longitude,
      latitude: sel.latitude,
      distance_m: sel.distance_m,
      geojson: sel.feature.geometry,
    };
  }, [serverHadNoTarget, heldCount, homePin, territories.features]);

  const target = objective ?? fallbackObjective;

  // Spine exits that arrive from data rather than taps: a landed player
  // (held_count > 0, e.g. claimed on another device or pre-spine) never sees
  // it; no claimable target at all routes to the standard map.
  useEffect(() => {
    if (spine == null || isSpineComplete(spine)) return;
    if (heldCount == null) return;
    if (heldCount > 0) {
      dispatchSpine(SPINE_EVENTS.CLAIM_COMPLETED);
      return;
    }
    if (serverHadNoTarget && fallbackObjective == null && territories.features.length > 0) {
      dispatchSpine(SPINE_EVENTS.NO_OBJECTIVE);
    }
  }, [spine, heldCount, serverHadNoTarget, fallbackObjective, territories.features.length, dispatchSpine]);

  const objectiveFeature = useMemo(() => {
    if (!target?.geojson) return null;
    return {
      type: 'Feature',
      id: target.id,
      properties: {
        id: target.id,
        name: target.name,
        owner: 'Unclaimed',
        alliance: null,
        tier: target.tier ?? 'Small',
        level: 'D0',
        ownerStreak: 0,
        streakBand: 'base',
        developmentLevel: 0,
        labelSub: '',
        emblemIcon: '',
        contested: false,
        battleChip: '',
        chipColor: SLATE2,
        perimeter: target.perimeter_distance,
        ownership: 'unclaimed',
        color: OWNERSHIP_COLOR.unclaimed,
      },
      geometry: target.geojson,
    };
  }, [target]);

  const objectiveActive = firstClaimObjectiveOn && heldCount === 0 && objectiveFeature != null;

  const openObjectiveSheet = useCallback(() => {
    if (!objectiveFeature) return;
    const cached = featureCacheRef.current.get(objectiveFeature.id);
    setSelected({ feature: cached ?? objectiveFeature, allFeatures: territories.features });
  }, [objectiveFeature, territories.features]);

  const flyToObjective = useCallback(() => {
    if (!target) return;
    if (cameraRef.current) {
      cameraRef.current.setCamera({
        centerCoordinate: [target.longitude, target.latitude],
        zoomLevel: 15,
        animationDuration: 650,
      });
    }
    setTimeout(openObjectiveSheet, 700);
  }, [target, openObjectiveSheet]);

  // Layered map-area tips: the first three touches anywhere on the map fire
  // intro → colours → card, one per touch. The resource strip has its own
  // tip. Tab bar and side rail have no observable tap here (navigation
  // swallows them) — those screens teach themselves on arrival instead.
  const resourceBannerRef = useRef(null);
  const mapTips = useMemo(() => {
    const mapRect = async () => {
      const wrap = await rectFromRef(mapWrapRef);
      if (!wrap) return { x: 16, y: winH * 0.2, width: winW - 32, height: winH * 0.4 };
      return { x: wrap.x, y: wrap.y, width: wrap.width, height: wrap.height };
    };
    const city = myPlayer?.home_city;
    return [
      { key: 'resources', text: t('walkthrough.map.resources'), getRect: () => rectFromRef(resourceBannerRef) },
      {
        key: 'intro',
        kicker: t('walkthrough.map.kicker'),
        text: city ? t('walkthrough.map.intro', { city }) : t('walkthrough.map.introNoCity'),
        getRect: mapRect,
      },
      { key: 'colours', text: t('walkthrough.map.colours'), getRect: mapRect },
      // Figma mode drops "tap any territory": the objective ring and its card
      // already say it (review comment on the coach mark).
      ...(figmaModeEarly
        ? []
        : [{ key: 'card', text: t('walkthrough.map.card'), getRect: mapRect }]),
    ];
  }, [myPlayer?.home_city, t, winH, winW, figmaModeEarly]);

  // ── Coach marks (Updated UX B1–B3, plan U8), Figma mode only ─────────────
  // One-shot: side panel → tap the first territory → its card. They run once
  // after the tutorial cards are finished or skipped, alongside the
  // first-claim objective, and never during the Beat 1 flight. Progress is
  // three walkthrough flags (lib/coachMarks COACH_FLAG_NAMES).
  const [coach, setCoach] = useState(() => initialCoachState());
  const [coachReady, setCoachReady] = useState(false);
  const [tutorialDone, setTutorialDone] = useState(false);
  const dispatchCoach = useCallback((event) => setCoach((s) => coachReduce(s, event)), []);
  const coachActive = coach.step === COACH_STEPS.SIDE_PANEL
    || coach.step === COACH_STEPS.TAP_TERRITORY
    || coach.step === COACH_STEPS.CARD;
  useEffect(() => {
    if (!userId || !figmaModeEarly) return undefined;
    let cancelled = false;
    const lastTutorial = TUTORIAL_NAMES[TUTORIAL_NAMES.length - 1];
    (async () => {
      const [sidePanel, tapTerritory, card, tutorial] = await Promise.all([
        hasFired(userId, COACH_FLAG_NAMES.sidePanel),
        hasFired(userId, COACH_FLAG_NAMES.tapTerritory),
        hasFired(userId, COACH_FLAG_NAMES.card),
        hasFired(userId, lastTutorial),
      ]);
      if (cancelled) return;
      setCoach(initialCoachState({ sidePanel, tapTerritory, card }));
      setTutorialDone(tutorial);
      setCoachReady(true);
    })();
    const unsubscribe = onWalkthroughFired(({ userId: who, name }) => {
      if (who === userId && name === lastTutorial) setTutorialDone(true);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [userId, figmaModeEarly]);
  useEffect(() => {
    if (!userId) return;
    coach.seen.forEach((step) => markFired(userId, COACH_FLAG_NAMES[step]));
  }, [coach.seen, userId]);

  // Tips stay quiet during the Beat 1 flight — nothing may compete with it —
  // and while a coach mark is up.
  const tips = useFirstTapTips({ screenKey: 'map', userId, tips: mapTips, enabled: !flightActive && !coachActive });

  // Beat 2 → Beat 3: the spine advances when the objective's sheet opens.
  useEffect(() => {
    const selId = selected?.feature?.id ?? selected?.feature?.properties?.id;
    if (selId && target && selId === target.id) {
      dispatchSpine(SPINE_EVENTS.SHEET_OPENED);
    }
  }, [selected, target, dispatchSpine]);

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

  // The prime follows the spine (any exit). Later sessions where the spine is
  // already done but the prime was never answered get it shortly after the
  // map settles. hasFired inside maybeShowNotifPrime keeps it once-ever, and
  // the focus check keeps it off ActiveClaim after a CLAIM IT exit.
  useEffect(() => {
    if (heldCount === null || !userId) return undefined;
    if (spine == null || !isSpineComplete(spine)) return undefined;
    const timer = setTimeout(() => {
      if (navigation.isFocused()) maybeShowNotifPrime();
    }, 1200);
    return () => clearTimeout(timer);
  }, [heldCount, spine, maybeShowNotifPrime, navigation, userId]);

  const objectiveFillStyle = useMemo(
    () => ({ fillColor: '#FDFDFD', fillOpacity: 0.06, fillEmissiveStrength: 1.0 }),
    [],
  );
  const objectiveLineStyle = useMemo(
    () => ({ lineColor: '#FDFDFD', lineWidth: 2.6, lineDasharray: [2, 1.6], lineOpacity: 1, lineEmissiveStrength: 1.0 }),
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

  // Map capture celebration — result screens pass { geojson, mode } via the
  // same nested-params channel as topBannerMessage. Fly to the ground, flood
  // it in the outcome colour, hold, then fade over the ambient 2000ms. The
  // flight's viewport refetch repaints the territory in its authoritative
  // colour beneath the overlay.
  const [celebration, setCelebration] = useState(null);
  useEffect(() => {
    const c = route?.params?.celebration;
    if (!c) return undefined;
    navigation.setParams({ celebration: undefined });
    const centre = geojsonBboxCenter(c.geojson);
    if (!centre || !c.mode) return undefined;
    setCelebration({ geojson: c.geojson, mode: c.mode, fading: false });
    cameraRef.current?.setCamera({
      centerCoordinate: centre,
      zoomLevel: 14.5,
      animationDuration: 600,
    });
    const fadeTimer = setTimeout(() => {
      setCelebration((prev) => (prev ? { ...prev, fading: true } : prev));
    }, 1000);
    const clearTimer = setTimeout(() => setCelebration(null), 3200);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(clearTimer);
    };
  }, [route?.params?.celebration]);

  const celebrationStyles = useMemo(() => {
    if (!celebration) return null;
    const color =
      celebration.mode === 'held' ? ALLIANCE : celebration.mode === 'lost' ? ENEMY : CLAIM;
    return {
      fill: {
        fillColor: color,
        fillOpacity: celebration.fading ? 0 : celebration.mode === 'lost' ? 0.12 : 0.3,
        fillOpacityTransition: { duration: 2000, delay: 0 },
        fillEmissiveStrength: 1.0,
      },
      line: {
        lineColor: color,
        lineWidth: 3,
        lineOpacity: celebration.fading ? 0 : 1,
        lineOpacityTransition: { duration: 2000, delay: 0 },
        lineEmissiveStrength: 1.0,
      },
    };
  }, [celebration]);

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
    // Non-sensitive game state is still readable from the players table…
    const { data: playerRow } = await supabase
      .from('players')
      .select('id, username, alliance_id, xp, current_streak, iron, stone, gold, morale, influence, home_city')
      .eq('clerk_id', userId)
      .maybeSingle();

    // …but home_pin_lat/lng are no longer anon-readable. Fetch them for our own
    // row via the authenticated backend and merge them in. The backend is the
    // only source, so cache every answer on the device: a later launch that
    // can't reach it still opens the map at home instead of a fallback city
    // half a world away.
    let homePinFields = {};
    const meRes = await getMe({ clerkGetToken: () => getTokenRef.current() });
    const mePin = meRes.ok && meRes.data?.player ? meRes.data.player : null;
    const meLat = Number(mePin?.home_pin_lat);
    const meLng = Number(mePin?.home_pin_lng);
    if (Number.isFinite(meLat) && Number.isFinite(meLng)) {
      homePinFields = { home_pin_lat: meLat, home_pin_lng: meLng };
      saveHomePin(userId, meLng, meLat);
      setCachedHomePin((prev) =>
        prev && prev[0] === meLng && prev[1] === meLat ? prev : [meLng, meLat],
      );
    } else if (!meRes.ok) {
      // /me unreachable — keep the cached pin rather than reporting no home.
      console.log('[map] /me failed, using cached home pin', meRes.status, meRes.error);
      const cached = cachedHomePinRef.current ?? (await loadHomePin(userId));
      if (cached) homePinFields = { home_pin_lat: cached[1], home_pin_lng: cached[0] };
    }
    // Level pill in the map header (plan U5): /me's level when it has one;
    // null hides the pill (lib/mapTopBar showLevelPill).
    const meLevelFields = meRes.ok ? { level: meRes.data?.player?.level ?? null } : {};
    const merged = playerRow ? { ...playerRow, ...homePinFields, ...meLevelFields } : playerRow;
    setMyPlayer(merged);

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
        settle();
        return;
      }
      console.error('[vp fetch] threw:', err?.message ?? err);
      setMapError(true);
      settle();
      return;
    }

    if (
      error?.name === 'AbortError' ||
      error?.code === '20' ||
      error?.code === 20
    ) {
      settle();
      return;
    }

    if (error) {
      console.error('[vp fetch] error:', error.message);
      setMapError(true);
      settle();
      return;
    }
    setMapError(false);
    const rows = data ?? [];

    const features = rows.map((row) => {
      const developmentLevel = row.development_level ?? 0;
      const allianceTag = row.alliance_short_name ?? null;
      const ownership = territoryOwnershipFor(
        { ownerClerkId: row.owner_clerk_id, ownerId: row.owner_id, allianceId: row.alliance_id },
        { userId, myAllianceId: myPlayer?.alliance_id ?? null },
      );
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
      let chipColor = 'rgba(253,253,253,0.62)';
      if (chip?.key === 'contested') {
        battleChip = t('map.chip.contested');
        chipColor = '#84FF44';
      } else if (chip) {
        const ago = chip.minutes < 60
          ? t('map.agoMin', { n: chip.minutes })
          : t('map.agoHr', { n: Math.floor(chip.minutes / 60) });
        battleChip = t(chip.key === 'fell' ? 'map.chip.fell' : 'map.chip.held', { ago });
        chipColor = chip.key === 'fell' ? colors.self : colors.alliance;
      }

      return {
        type: 'Feature',
        id: row.id,
        properties: {
          id: row.id,
          name: row.territory_name,
          owner: row.owner_username ?? 'Unclaimed',
          alliance: allianceTag,
          // Full alliance name for the Figma card's ally explainer, when the
          // viewport RPC provides it.
          allianceName: row.alliance_name ?? null,
          tier: row.tier ?? 'Medium',
          level: `D${developmentLevel}`,
          ownerStreak: row.owner_streak_days ?? 0,
          streakBand: row.owner_id != null ? streakBandForDays(row.owner_streak_days) : 'base',
          emblem: row.alliance_emblem ?? null,
          developmentLevel,
          labelSub: labelParts.join(' · '),
          // Centre marker (plan U5): a flag on solo-held ground (yours /
          // an enemy's), the alliance emblem on your alliance's ground.
          emblemIcon: territoryMarkerIcon(
            ownership,
            row.alliance_id != null ? emblemIconName(row.alliance_emblem, true) : '',
          ),
          contested,
          battleChip,
          chipColor,
          perimeter: row.perimeter_distance,
          ownership,
          color: OWNERSHIP_COLOR[ownership],
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

    setEmptyViewport(cache.size === 0);
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
    if (!getFlag('home_bases')) return;
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
      console.error('[bases fetch] error:', error.message);
      return;
    }

    const homeLng = homePin?.[0];
    const homeLat = homePin?.[1];
    const hasOwnPin = homePin != null;

    let sawSelf = false;
    const features = (data ?? []).map((b) => {
      const isSelf = myPlayer?.id != null && b.player_id === myPlayer.id;
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
  }, [userId, myPlayer?.alliance_id, homePin, myPlayer?.xp, myPlayer?.id]);

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

  // Live map: repaint a territory the moment somebody claims it, instead of
  // waiting for the next viewport fetch. The payload carries everything the
  // fill and label need; richer decoration (emblems, streak bands) catches up
  // on the next fetch.
  useEffect(() => {
    if (!userId) return undefined;
    let cancelled = false;
    let unsub = null;
    let connected = false;

    (async () => {
      const result = await connectChatRealtime({
        clerkGetToken: () => getTokenRef.current(),
      });
      if (cancelled || !result.ok) {
        if (result?.ok) disconnectChatRealtime();
        if (!result?.ok) console.warn('[map] realtime connect failed', result?.code);
        return;
      }
      connected = true;
      if (!result.mapChannel) return;

      unsub = subscribeToEvent(
        result.realtime,
        result.mapChannel,
        'territory_claimed',
        (payload) => {
          const id = payload?.territory_id;
          if (!id) return;
          const cache = featureCacheRef.current;
          const existing = cache.get(id);
          // Only patch what is already on screen — an event for a territory
          // outside the viewport will arrive complete on its next fetch.
          if (!existing) return;

          const allianceTag = payload.alliance_short_name ?? null;
          const labelParts = [];
          if (existing.properties.developmentLevel >= 1) {
            labelParts.push(`D${existing.properties.developmentLevel}`);
          }
          if (allianceTag) labelParts.push(`[${allianceTag}]`);
          // A territory_claimed event always has an owner, so never 'unclaimed'.
          const claimedOwnership = territoryOwnershipFor(
            { ownerClerkId: payload.owner_clerk_id, ownerId: payload.owner_id, allianceId: payload.alliance_id, claimed: true },
            { userId, myAllianceId: myPlayer?.alliance_id ?? null },
          );

          cache.set(id, {
            ...existing,
            properties: {
              ...existing.properties,
              owner: payload.owner_username ?? existing.properties.owner,
              alliance: allianceTag,
              labelSub: labelParts.join(' · '),
              ownership: claimedOwnership,
              color: OWNERSHIP_COLOR[claimedOwnership],
              emblemIcon: territoryMarkerIcon(
                claimedOwnership,
                payload.alliance_id != null
                  ? emblemIconName(payload.alliance_emblem ?? existing.properties.emblem, true)
                  : '',
              ),
            },
          });
          setTerritories({
            type: 'FeatureCollection',
            features: Array.from(cache.values()),
          });
        },
      );
    })();

    return () => {
      cancelled = true;
      if (unsub) unsub();
      if (connected) disconnectChatRealtime();
    };
  }, [userId, myPlayer?.alliance_id]);

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
      userMovedCameraRef.current = true;
      // Panning the map is a sign the player is done with the colour key.
      setLegendOpen(false);
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
        if (!bounds) return;
        fetchTerritoriesForViewport(bounds, zoom);
        // Bases layer is hidden below zoom 12 — skip the query when zoomed out.
        if (zoom >= 11.5) fetchBasesForViewport(bounds);
      } catch (err) {
        console.error('[viewport fetch] getVisibleBounds threw:', err?.message);
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
  // The Camera's centerCoordinate prop tracks the best centre we can name at
  // mount (cached pin → home city → locale), which is only a guess until the
  // pin resolves — so we imperatively snap to the pin once we have it. Guarded
  // by didInitialCenterRef so later player refetches (e.g. resource-banner
  // updates) don't yank the camera back while the user is panning; a home pin
  // moved on another device therefore lands on the next launch, not mid-session.
  //
  // First-ever mount (spine flight pending) opens city-wide instead: Beat 1
  // holds there, then flies down once. Every other open snaps straight to the
  // home pin, unchanged.
  const flightHomeRef = useRef(null);
  useEffect(() => {
    if (didInitialCenterRef.current) return;
    if (spine == null) return; // camera waits for the persisted spine state
    if (!homePin) return;
    if (!cameraRef.current) return;
    didInitialCenterRef.current = true;
    if (resumeBeat(spine) === 'flight') {
      flightHomeRef.current = homePin;
      cameraRef.current.setCamera({
        centerCoordinate: homePin,
        zoomLevel: FLIGHT_CITY_ZOOM,
        animationDuration: 0,
      });
      setFlightPhase('hold');
    } else {
      plainOpenRef.current = true;
      cameraRef.current.setCamera({
        centerCoordinate: homePin,
        zoomLevel: INITIAL_ZOOM,
        animationDuration: 0,
      });
    }
  }, [homePin, spine]);

  // Frame an outstanding first-claim objective, not just the home pin.
  //
  // The spine flight (Beat 1) already frames home + objective together, but it
  // runs exactly once. Every launch after that took the plain path above and
  // snapped to the home pin at INITIAL_ZOOM — and measured on device, the
  // objective usually falls outside that viewport. The result was a banner
  // saying "walk 562m to claim проспект Тореза" while the only parcel drawn was
  // a different one the player cannot claim: a dead end in the first thirty
  // seconds, and the reason earlier design rounds wrongly concluded the
  // objective had no marker at all. It always had one — the marching-dash
  // outline was simply off-screen.
  //
  // This runs at most once per mount, only on the plain path, and stands down
  // the instant the player touches the map.
  useEffect(() => {
    if (objectiveFramedRef.current) return;
    if (!plainOpenRef.current) return;
    if (userMovedCameraRef.current) return;
    if (!target || !homePin || !cameraRef.current) return;
    objectiveFramedRef.current = true;
    // Figma mode centres the objective itself; legacy frames home + objective.
    const centred = figmaChromeRef.current ? centredFlightCamera(target) : null;
    if (centred) {
      cameraRef.current.setCamera({ ...centred, animationMode: 'easeTo', animationDuration: 600 });
      return;
    }
    const { ne, sw } = flightBounds(homePin[0], homePin[1], target);
    cameraRef.current.setCamera({
      bounds: { ne, sw },
      padding: { paddingTop: 140, paddingBottom: 120, paddingLeft: 60, paddingRight: 60 },
      animationMode: 'easeTo',
      animationDuration: 600,
    });
  }, [target, homePin]);

  // Beat 1, hold: ~1.5s of stillness at city scale before the flight.
  useEffect(() => {
    if (flightPhase !== 'hold') return undefined;
    const timer = setTimeout(() => setFlightPhase('await-target'), FLIGHT_HOLD_MS);
    return () => clearTimeout(timer);
  }, [flightPhase]);

  // Beat 1, flight: one smooth flyTo framing the home pin and the objective.
  // If the objective hasn't resolved yet the hold stretches (bounded) — a
  // cold backend gets the whole hold to answer; past the bound the flight
  // settles on the home pin neighbourhood alone.
  useEffect(() => {
    if (flightPhase !== 'await-target') return undefined;
    const home = flightHomeRef.current;
    const fly = (frameTarget) => {
      if (cameraRef.current && home) {
        const centred = frameTarget && figmaChromeRef.current ? centredFlightCamera(frameTarget) : null;
        if (centred) {
          cameraRef.current.setCamera({ ...centred, animationMode: 'flyTo', animationDuration: FLIGHT_MS });
        } else if (frameTarget) {
          const { ne, sw } = flightBounds(home[0], home[1], frameTarget);
          cameraRef.current.setCamera({
            bounds: { ne, sw },
            padding: { paddingTop: 140, paddingBottom: 120, paddingLeft: 60, paddingRight: 60 },
            animationMode: 'flyTo',
            animationDuration: FLIGHT_MS,
          });
        } else {
          cameraRef.current.setCamera({
            centerCoordinate: home,
            zoomLevel: INITIAL_ZOOM,
            animationMode: 'flyTo',
            animationDuration: FLIGHT_MS,
          });
        }
      }
      setFlightPhase('flying');
    };
    if (target) {
      fly(target);
      return undefined;
    }
    const timer = setTimeout(() => fly(null), FLIGHT_TARGET_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [flightPhase, target]);

  // Beat 1, settle: the flight ends, the spine advances, the HUD returns.
  useEffect(() => {
    if (flightPhase !== 'flying') return undefined;
    const timer = setTimeout(() => {
      setFlightPhase('idle');
      dispatchSpine(SPINE_EVENTS.FLIGHT_SETTLED);
    }, FLIGHT_MS + FLIGHT_SETTLE_BUFFER_MS);
    return () => clearTimeout(timer);
  }, [flightPhase, dispatchSpine]);

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

  // ─── BOARD LAYERS ────────────────────────────────────────────────────────
  // Ownership has to be readable three ways at once: by colour (yours / ours /
  // theirs), by ground texture (hatch lean), and by edge treatment (solid and
  // cased when held, dashed hairline when open, marching red when contested).
  // Any one of the three alone is enough to tell held ground from open ground.

  const claimedFilter = useMemo(() => ['!=', ['get', 'ownership'], 'unclaimed'], []);
  const openFilter = useMemo(() => ['==', ['get', 'ownership'], 'unclaimed'], []);

  // Held ground is a PLATE of the owner's colour, not a tint over the map.
  // Round 1 kept the fill translucent enough that the parcel read as the
  // basemap seen through weather — measured, it was the same brightness as
  // before the change. The ground beneath is now scrimmed down to near-ink, so
  // these can be near-solid without turning the board to mud, and ownership is
  // the loudest thing about a held parcel. Enemy Slate-Blue is the darkest and
  // lowest-chroma of the three, so it is pushed hardest.
  const fillStyle = useMemo(
    () => ({
      fillColor: ['get', 'color'],
      // Dominia-Temp (plan U5): a tinted pane, not a solid plate — the
      // owner-coloured outline and its inner glow carry the identity, as on
      // the Figma Main screen.
      fillOpacity: [
        'case',
        ['==', ['get', 'ownership'], 'yours'], 0.16,
        ['==', ['get', 'ownership'], 'alliance'], 0.16,
        ['==', ['get', 'ownership'], 'enemy'], 0.16,
        0,
      ],
      fillEmissiveStrength: 1.0,
    }),
    [],
  );

  // Bone tick engraved into the plate. Adds luminance rather than removing it
  // (round 1's owner-coloured tick did the opposite), and the lean carries the
  // side without relying on hue at all.
  const hatchStyle = useMemo(
    () => ({
      fillPattern: HATCH_PATTERN_EXPRESSION,
      // Eased off at city scale, where a parcel is only a few tiles wide and a
      // full-strength tick would read as noise.
      fillOpacity: [
        'interpolate', ['linear'], ['zoom'],
        11, 0.10,
        13.5, 0.20,
      ],
      fillEmissiveStrength: 1.0,
    }),
    [],
  );

  // A siege is carried entirely on the border, never on the fill. Washing
  // Claim Red across a near-solid plate turns Alliance Green to olive — a
  // sixth colour, and the owner's identity destroyed at exactly the moment it
  // matters most. The plate always states who holds the ground; the border
  // states that someone is taking it.
  //
  // Dark band under the marching dashes so the siege reads on any plate,
  // including a Claim Red one where red-on-red would otherwise disappear.
  const contestedCasingStyle = useMemo(
    () => ({
      lineColor: INK,
      lineWidth: 8,
      lineOpacity: 0.85,
      lineEmissiveStrength: 1.0,
    }),
    [],
  );

  // Ink seam under every held edge. It exists only to hold two adjacent
  // parcels apart so a run of same-owner ground does not merge into one blob —
  // it must never out-weigh the owner colour on top of it, which is exactly
  // what went wrong in round 1 (a 2px colour line riding a 4.4px black one
  // read as a black outline).
  const casingStyle = useMemo(
    () => ({
      lineColor: INK,
      lineWidth: [
        'match', ['get', 'streakBand'],
        'hardened', 7.2,
        'fortified', 7.2,
        5.6,
      ],
      lineOpacity: 0.55,
      lineEmissiveStrength: 1.0,
    }),
    [],
  );

  // Soft owner-coloured glow along held edges (plan U5): wide and blurred
  // under the crisp outline, so a held territory reads as lit from within.
  const ownedGlowStyle = useMemo(
    () => ({
      lineColor: ownershipColourExpression('rgba(253,253,253,0.30)'),
      lineWidth: 12,
      lineBlur: 9,
      lineOpacity: 0.45,
      lineEmissiveStrength: 1.0,
    }),
    [],
  );

  const lineStyle = useMemo(
    () => ({
      lineColor: ownershipColourExpression('rgba(253,253,253,0.30)'),
      // Border weight encodes the owner's streak band (deterrence at a glance):
      // base <7d, hardened 7–20d, fortified 21+d (which also gets the inner line).
      // Full opacity and heavy enough that the owner's colour, not the seam
      // beneath it, is what you see at the parcel's edge.
      lineWidth: [
        'match', ['get', 'streakBand'],
        'hardened', 3.4,
        'fortified', 3.4,
        2.6,
      ],
      lineOpacity: 1,
      lineEmissiveStrength: 1.0,
    }),
    [],
  );

  // Open ground: surveyed, not held. A dashed slate hairline that fades out
  // above city scale so a board of unclaimed parcels never becomes a mesh.
  const unclaimedLineStyle = useMemo(
    () => ({
      // Slate 2 rather than Slate: against a scrimmed near-ink ground this is
      // the difference between a lattice you can see and one you cannot. The
      // board has to imply a game — neighbouring ground you could take — or a
      // single held parcel just looks like a shape on a map.
      // Solid, not dashed, and deliberately heavier than any road casing.
      //
      // Two critics independently reported that only one polygon existed on the
      // whole screen. They were right and the earlier read here was wrong: at
      // 1.7px slate, a parcel edge was the same visual species as the road it
      // runs along — same hue, same weight — so boundaries vanished into the
      // street network and the board never tiled.
      //
      // The brand permits only greys for unowned ground (the three saturated
      // colours have locked ownership meanings), so hue cannot carry the
      // difference. Weight does: at 2.6px this is thicker than any road on the
      // board, and the road web has been taken down to open the value gap.
      // Held ground stays unmistakable — casing, hatch and a near-solid plate
      // that open ground never has.
      lineColor: SLATE2,
      lineWidth: 2.6,
      // Full strength by the default opening zoom (14) — in a city where
      // nothing is held yet the parcel grid is the board. Gone by the
      // city-wide pull-back (10.5), where only ownership should read.
      lineOpacity: [
        'interpolate', ['linear'], ['zoom'],
        11.5, 0,
        12.5, 0.55,
        14, 0.92,
      ],
      lineEmissiveStrength: 1.0,
    }),
    [],
  );

  // Open ground gets a face AND an edge. Neither works alone.
  //
  // Two failed experiments got us here, both worth recording so they are not
  // repeated. A fill with the old thin dashed edges flooded the viewport into
  // one structureless grey mass — verified by ramping the layer to 55%, where
  // the whole screen went grey and no parcel emerged. Strong edges with no fill
  // then read as more road network: territories are road-bounded, so a parcel
  // edge literally runs along a street, and a line there is a street until
  // something tells you it encloses an area.
  //
  // The face is what says "area", the edge is what says "this area ends here".
  // Together they tessellate. theme.js says "unclaimed = no fill, slate hairline
  // only"; this is a deliberate, documented departure under the DESIGN.md
  // Map-Layer Exception, held far below owned ground (36–44%) so it can never
  // be mistaken for ownership.
  const openFillStyle = useMemo(
    () => ({
      fillColor: SLATE2,
      fillOpacity: [
        'interpolate', ['linear'], ['zoom'],
        11.5, 0,
        12.5, 0.05,
        14, 0.10,
      ],
      fillEmissiveStrength: 1.0,
    }),
    [],
  );

  // Corner marks on held parcels — the board's control points. Bone, not the
  // owner colour: on a near-solid owner-coloured plate an owner-coloured node
  // is invisible, and the plate already says who holds it.
  const nodeStyle = useMemo(
    () => ({
      circleRadius: [
        'interpolate', ['linear'], ['zoom'],
        14, 1.6,
        16, 2.6,
        18, 3.4,
      ],
      circleColor: BONE,
      circleOpacity: 0.95,
      circleStrokeColor: INK,
      circleStrokeWidth: 1,
      circleStrokeOpacity: 0.8,
      circlePitchAlignment: 'map',
      circleEmissiveStrength: 1.0,
    }),
    [],
  );

  // ─── PLAYER PUCK ─────────────────────────────────────────────────────────
  // The commander is the brightest mark on the board: Signal Lime on an
  // obsidian seat, a colour no owner uses, so it can't be mistaken for ground.
  const puckSeatStyle = useMemo(
    () => ({
      circleRadius: 15,
      circleColor: INK,
      circleOpacity: 0.88,
      circleStrokeColor: BONE,
      circleStrokeWidth: 1,
      circleStrokeOpacity: 0.4,
      circlePitchAlignment: 'map',
      circleEmissiveStrength: 1.0,
    }),
    [],
  );

  const puckCoreStyle = useMemo(
    () => ({
      circleRadius: 7,
      circleColor: '#84FF44', // Signal Lime: the player dot (Figma)
      circleOpacity: 1,
      circleStrokeColor: INK,
      circleStrokeWidth: 2.5,
      circleStrokeOpacity: 1,
      circlePitchAlignment: 'map',
      circleEmissiveStrength: 1.0,
    }),
    [],
  );

  // Course over ground, not compass: it only appears once the player is
  // actually moving, which is the only time a heading means anything here.
  const [userHeading, setUserHeading] = useState(null);
  const puckHeadingStyle = useMemo(
    () => ({
      iconImage: PUCK_HEADING_IMAGE,
      iconRotate: userHeading ?? 0,
      iconRotationAlignment: 'map',
      iconPitchAlignment: 'map',
      iconAllowOverlap: true,
      iconIgnorePlacement: true,
      // 1.0 keeps the wedge at its drawn size: tip 31px out, base 17px out,
      // so it clears the 15px seat ring instead of sitting inside it.
      iconSize: 1,
      iconOpacity: 0.95,
    }),
    [userHeading],
  );

  // Derived once per viewport fetch; the layer itself is zoom-gated so this
  // never renders at city scale even though it is always computed.
  const territoryNodes = useMemo(() => territoryNodeFeatures(territories), [territories]);

  // Inner second wall for fortified (21+ day streak) owners.
  const streakInnerStyle = useMemo(
    () => ({
      lineColor: ownershipColourExpression('rgba(253,253,253,0.30)'),
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
      lineColor: ownershipColourExpression('rgba(253,253,253,0.30)'),
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
        { 'font-scale': 0.85, 'text-color': 'rgba(253,253,253,0.62)' },
      ],
      // Territory names are the only words on the board. Graded by ownership:
      // a held parcel's name is bone, open ground's is slate. Round 1 set them
      // all in bone, which made an unclaimed hospital the highest-contrast
      // text on screen while the owned parcel whispered.
      textSize: [
        'interpolate', ['linear'], ['zoom'],
        12, 9.5,
        15, 11,
        18, 12.5,
      ],
      textColor: [
        'case',
        ['==', ['get', 'ownership'], 'unclaimed'], 'rgba(253,253,253,0.62)',
        '#FDFDFD',
      ],
      textHaloColor: 'rgba(0,0,0,0.92)',
      textHaloWidth: 1.8,
      textMaxWidth: 8,
      textLineHeight: 1.15,
      textLetterSpacing: 0.02,
      // Held ground wins label collisions against open ground.
      symbolSortKey: ['case', ['==', ['get', 'ownership'], 'unclaimed'], 2, 1],
      textAllowOverlap: false,
      textAnchor: 'center',
      textFont: ['DIN Offc Pro Medium', 'Arial Unicode MS Regular'],
    }),
    [],
  );

  // Centre marker on held ground (plan U5): owner-coloured flag on solo-held
  // territory, the alliance emblem on your alliance's. Shown from city scale
  // (z11), where held fills read, growing with the zoom.
  const emblemStyle = useMemo(
    () => ({
      iconImage: ['get', 'emblemIcon'],
      iconSize: [
        'interpolate', ['linear'], ['zoom'],
        11, 0.32,
        14, 0.5,
        17, 0.62,
      ],
      iconAllowOverlap: false,
      iconOpacity: 0.95,
      iconEmissiveStrength: 1.0,
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
      fillExtrusionColor: ownershipColourExpression('rgba(253,253,253,0.30)'),
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
      lineColor: '#E34234',
      lineWidth: 4.6,
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
      textHaloColor: 'rgba(0,0,0,0.9)',
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
        ['==', ['get', 'ownership'], 'unclaimed'], '#FDFDFD',
        ['get', 'color'],
      ],
      fillOpacity: [
        'case',
        ['==', ['get', 'ownership'], 'unclaimed'], 0.06,
        // Dominia-Temp pop-up states: the selected parcel keeps a light
        // tint and is carried by its glowing outline, not a flood fill.
        figmaModeEarly ? 0.12 : 0.55,
      ],
      fillEmissiveStrength: 1.0,
    }),
    [figmaModeEarly],
  );

  // Soft bone halo rendered under the crisp outline for a glow / pop-out effect.
  // Tuned for the dark `night` basemap — wider and more opaque so the glow reads
  // clearly against the dark ground (it was washing out on the old light style).
  const selectedGlowStyle = useMemo(
    () => ({
      lineColor: ownershipColourExpression('#FDFDFD'),
      lineWidth: 9,
      lineOpacity: ['case', ['==', ['get', 'ownership'], 'unclaimed'], 0.12, 0.45],
      lineBlur: 6,
      lineEmissiveStrength: 1.0,
    }),
    [],
  );

  // Crisp bright outline on top of the glow. Dominia-Temp (plan U5): held
  // ground keeps its owner colour, open ground gets a dashed white edge
  // (Figma Main screen). Dash arrays are not data-driven, hence two layers.
  const selectedLineStyle = useMemo(
    () => ({
      lineColor: ownershipColourExpression('#FDFDFD'),
      lineWidth: 3.2,
      lineOpacity: 1,
      lineEmissiveStrength: 1.0,
    }),
    [],
  );
  const selectedOpenLineStyle = useMemo(
    () => ({
      lineColor: '#FDFDFD',
      lineWidth: 2.4,
      lineDasharray: [2, 1.6],
      lineOpacity: 1,
      lineEmissiveStrength: 1.0,
    }),
    [],
  );
  const selectedHeldFilter = useMemo(
    () => ['all', highlightFilter, claimedFilter],
    [highlightFilter, claimedFilter],
  );
  const selectedOpenFilter = useMemo(
    () => ['all', highlightFilter, openFilter],
    [highlightFilter, openFilter],
  );

  // D6 — the couch close. Any dismissal of the Beat 3 sheet without claiming
  // completes the spine: the objective stays pinned (existing behaviour), the
  // camera pulls back up to city view, and one line shows once, auto-dismissing.
  // pullBack is skipped when the player dismissed by opening another territory
  // — yanking the camera away from what they chose to look at breaks the
  // "always doing or seeing something" rule.
  const couchClose = useCallback(
    ({ pullBack }) => {
      dispatchSpine(SPINE_EVENTS.SHEET_DISMISSED);
      if (pullBack && cameraRef.current) {
        const centerCoordinate = homePin ?? flightHomeRef.current;
        if (centerCoordinate) {
          cameraRef.current.setCamera({
            centerCoordinate,
            zoomLevel: FLIGHT_CITY_ZOOM,
            animationMode: 'flyTo',
            animationDuration: 1600,
          });
        }
      }
      showTopBanner(t('firstClaim.couchClose'));
    },
    [dispatchSpine, homePin, showTopBanner, t],
  );

  // Sheet close routed through the spine: while Beat 3 is live and the
  // objective's sheet is the one closing, a plain close is the LATER fork.
  const handleSheetClose = useCallback(() => {
    const wasObjectiveSheet =
      target != null && (selected?.feature?.id ?? selected?.feature?.properties?.id) === target.id;
    setSelected(null);
    const s = spineRef.current;
    if (wasObjectiveSheet && s && !s.complete && s.beat === 'sheet') {
      couchClose({ pullBack: true });
    }
  }, [couchClose, selected, target]);

  // App-only map surfaces (Figma parity plan U3). Defaults are on, so today's
  // map is unchanged until Remote Config turns a surface off.
  const multiResourceOn = useFlag('multi_resource_economy');
  const sitrepOn = useFlag('sitrep_card');
  const battleChipsOn = useFlag('battle_chips');
  const homeBasesOn = useFlag('home_bases');
  const streaksOn = useFlag('streaks');
  const developmentOn = useFlag('territory_development');
  const mapLayers = useMemo(
    () => new Set(visibleMapLayers({
      battle_chips: battleChipsOn,
      home_bases: homeBasesOn,
      streaks: streaksOn,
      territory_development: developmentOn,
      first_claim_objective: firstClaimObjectiveOn,
      legacy_tabs: !figmaModeEarly,
    })),
    [battleChipsOn, homeBasesOn, streaksOn, developmentOn, firstClaimObjectiveOn, figmaModeEarly],
  );

  const recenter = () => {
    if (!cameraRef.current) return;
    const centerCoordinate = lastUserCoord ?? homePin ?? fallbackCentre;
    cameraRef.current.setCamera({
      centerCoordinate,
      zoomLevel: INITIAL_ZOOM,
      animationDuration: 600,
    });
  };

  // Figma map chrome and compact card (plan U11). legacy_tabs off mounts the
  // top bar, search and five-control rail; full_territory_sheet off mounts
  // TerritoryCard in place of TerritorySheet. Both on is today's map.
  const figmaChrome = !useFlag('legacy_tabs');
  const fullSheetOn = useFlag('full_territory_sheet');
  const selectedFeature = selected?.feature ?? selected ?? null;

  // Defend pop-ups (plan U12), Figma mode only. One at a time; it takes
  // priority over the territory card (hidden while it shows) and covers the
  // search results, and never shows during a challenge or the spine flight.
  const defendFeed = useDefendPopupFeed({ enabled: figmaChrome, getTokenRef });
  const defendModel = useMemo(
    () => (flightActive ? null : defendPopupModel({
      attacks: defendFeed.attacks,
      figmaMode: figmaChrome,
      challengeActive: defendFeed.challengeActive,
      gold: myPlayer ? (myPlayer.gold ?? 0) : null,
      multiResource: multiResourceOn,
      selfUsername: myPlayer?.username ?? null,
    })),
    // dismissTick re-runs selection after a dismissal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [defendFeed.attacks, defendFeed.challengeActive, defendFeed.dismissTick, figmaChrome, flightActive, myPlayer?.gold, myPlayer?.username, multiResourceOn],
  );
  // Figma mode (D1/D6): DEFEND starts the defence straight from the pop-up,
  // with the same preview + POST /defend calls DefenderAccept makes (no Stone
  // boost). Any failure falls back to DefenderAccept, which owns the error and
  // terminal states (already defended, window closed, insufficient Gold) —
  // except a lost response (network error / timeout): POST /defend may have
  // committed, so the preview is read again and, if the caller is now the
  // defender, the walk starts anyway.
  const defendInFlightRef = useRef(false);
  const handleDefendFromPopup = useCallback(async (model) => {
    if (defendInFlightRef.current) return;
    defendInFlightRef.current = true;
    const contestId = model.contestId;
    const clerkGetToken = () => getTokenRef.current();
    const fallback = () => navigation.navigate('DefenderAccept', { contestId });
    try {
      const preview = await getDefendPreview({ clerkGetToken, contestId });
      if (!preview.ok || !myPlayer?.id) {
        fallback();
        return;
      }
      const res = await postDefend({ clerkGetToken, contestId, spendStone: false, defenderStartingWalkM: 0 });
      if (!res.ok) {
        if (res.code === 'network_error') {
          const again = await getDefendPreview({ clerkGetToken, contestId });
          if (again.ok && again.data?.defender_player_id != null
            && String(again.data.defender_player_id) === String(myPlayer.id)) {
            navigation.navigate('ActiveClaim', defendStartParams(again.data, myPlayer.id));
            return;
          }
        }
        fallback();
        return;
      }
      const goldSpent = Number(res.data?.goldSpent);
      if (Number.isFinite(goldSpent) && goldSpent > 0) {
        setMyPlayer((prev) => (prev && Number.isFinite(Number(prev.gold))
          ? { ...prev, gold: Math.max(0, Number(prev.gold) - goldSpent) }
          : prev));
      }
      navigation.navigate('ActiveClaim', defendStartParams(preview.data, myPlayer.id, { goldSpent: res.data?.goldSpent }));
    } catch (_) {
      fallback();
    } finally {
      defendInFlightRef.current = false;
    }
  }, [navigation, myPlayer?.id]);

  const cardAtCap = useMemo(() => {
    const xp = Math.max(0, Math.floor(Number(myPlayer?.xp) || 0));
    const held = (selected?.allFeatures ?? []).filter((f) => territoryOwnership(f.properties) === 'yours').length;
    return held >= territoryCapForLevel(F.calcLevel(xp));
  }, [myPlayer?.xp, selected?.allFeatures]);

  const handleCardClaim = useCallback(async (model) => {
    if (!selectedFeature) return { ok: false };
    if (spineActive && objectiveActive && target?.id === selectedFeature.id) {
      dispatchSpine(SPINE_EVENTS.CLAIM_STARTED);
    }
    const res = await beginClaim({
      territory: selectedFeature,
      name: model.name ?? t('common.territoryFallback'),
      perimeter: model.perimeterM,
      getTokenRef,
      myPlayer,
      setMyPlayer,
      navigation,
      onClose: handleSheetClose,
    });
    if (res.ok) return res;
    return {
      ok: false,
      message: claimStartErrorMessage(t, res.error, selectedFeature.properties?.tier ?? 'Medium'),
    };
  }, [selectedFeature, spineActive, objectiveActive, target, dispatchSpine, t, myPlayer, navigation, handleSheetClose]);

  const handleCardContest = useCallback(async (model) => {
    if (!selectedFeature) return { ok: false };
    const res = await beginContest({
      territory: selectedFeature,
      name: model.name ?? t('common.territoryFallback'),
      getTokenRef,
      myPlayer,
      setMyPlayer,
      navigation,
      onClose: handleSheetClose,
    });
    if (res.ok) return res;
    if (res.code === 'contest_already_active') {
      return {
        ok: false,
        message: t('map.contestActiveCard', {
          attacker: res.context?.attacker_username ?? 'someone',
          date: res.context?.attack_day_date ?? '',
        }),
      };
    }
    return {
      ok: false,
      message: contestStartErrorMessage(t, res) ?? topBannerMessageForContestCode(t, res.code),
    };
  }, [selectedFeature, t, myPlayer, navigation, handleSheetClose]);

  // Search result: fly to its bbox (padding clears the top bar, rail and
  // card), then open it the same way a focusTerritory deep link does.
  const handleSearchSelect = useCallback((result) => {
    if (cameraRef.current) {
      if (result.bbox) {
        const [minLng, minLat, maxLng, maxLat] = result.bbox;
        cameraRef.current.fitBounds([maxLng, maxLat], [minLng, minLat], [140, 64, 240, 24], 800);
      } else if (result.centroid) {
        cameraRef.current.setCamera({ centerCoordinate: result.centroid, zoomLevel: 15.5, animationDuration: 800 });
      }
    }
    const cached = featureCacheRef.current.get(result.id);
    if (cached) {
      pendingFocusIdRef.current = null;
      setSelected({ feature: cached, allFeatures: territories.features });
    } else {
      pendingFocusIdRef.current = result.id;
    }
  }, [territories.features]);

  // ── Coach marks: when they start and what moves them (Figma mode) ────────
  const coachSelectedId = selectedFeature?.id ?? selectedFeature?.properties?.id ?? null;
  const objectiveSelected = coachSelectedId != null && objectiveFeature?.id != null && coachSelectedId === objectiveFeature.id;
  useEffect(() => {
    if (!figmaChrome || !coachReady || !tutorialDone) return;
    if (coach.step !== COACH_STEPS.IDLE) return;
    if (!objectiveActive || flightActive || spineFlightPending || defendModel) return;
    dispatchCoach({ type: COACH_EVENTS.START, cardOpen: objectiveSelected });
  }, [figmaChrome, coachReady, tutorialDone, coach.step, objectiveActive, objectiveSelected, flightActive, spineFlightPending, defendModel, dispatchCoach]);
  useEffect(() => {
    if (coach.step === COACH_STEPS.TAP_TERRITORY && objectiveSelected) {
      dispatchCoach(COACH_EVENTS.TERRITORY_SELECTED);
    } else if (coach.step === COACH_STEPS.CARD && !objectiveSelected) {
      // The card closed (or another territory replaced it): B3 is over.
      dispatchCoach(COACH_EVENTS.NEXT);
    } else if (coach.step === COACH_STEPS.TAP_TERRITORY && !objectiveActive) {
      // The objective went away (claimed elsewhere): nothing left to point at.
      dispatchCoach(COACH_EVENTS.SKIP);
    }
  }, [coach.step, objectiveSelected, objectiveActive, dispatchCoach]);

  // ── Relocate (Updated UX C9/C10, plan U8), Figma mode only ───────────────
  const [relocateOpen, setRelocateOpen] = useState(false);
  const ownFeatures = useMemo(
    () => (relocateOpen ? territories.features.filter((f) => territoryOwnership(f.properties) === 'yours') : []),
    [relocateOpen, territories.features],
  );
  const handleRelocateGo = useCallback((row) => {
    setRelocateOpen(false);
    const camera = centredFlightCamera(relocateTarget(row));
    if (camera && cameraRef.current) {
      cameraRef.current.setCamera({ ...camera, animationMode: 'flyTo', animationDuration: 800 });
    }
  }, []);
  const handleRelocateFindNearby = () => {
    setRelocateOpen(false);
    recenter();
  };
  const handleViewAlliance = useCallback(() => {
    handleSheetClose();
    navigateTo('Alliance');
  }, [handleSheetClose]);

  return (
    <View style={styles.screen} onTouchStart={tips.onTouchStart}>
      {/* Beat 1 suppresses the HUD visually (opacity, not layout — no reflow
          when it returns). The flight plays clean; everything comes back on
          settle. */}
      {multiResourceOn ? (
      <View
        ref={resourceBannerRef}
        collapsable={false}
        style={[styles.resourceBanner, flightActive && { opacity: 0 }]}
      >
        <View style={styles.resourceBannerItem}>
          <IronGlyph size={12} color="#FDFDFD" />
          <ResourceDeltaValue value={myPlayer ? (myPlayer.iron ?? 0) : null} style={styles.resourceBannerValue} />
        </View>
        <View style={styles.resourceBannerDivider} />
        <View style={styles.resourceBannerItem}>
          <StoneGlyph size={12} color="#FDFDFD" />
          <ResourceDeltaValue value={myPlayer ? (myPlayer.stone ?? 0) : null} style={styles.resourceBannerValue} />
        </View>
        <View style={styles.resourceBannerDivider} />
        <View style={styles.resourceBannerItem}>
          <GoldGlyph size={12} color="#FDFDFD" />
          <ResourceDeltaValue value={myPlayer ? (myPlayer.gold ?? 0) : null} style={styles.resourceBannerValue} />
        </View>
        <View style={styles.resourceBannerDivider} />
        <View style={styles.resourceBannerItem}>
          <MoraleGlyph size={12} color="#FDFDFD" />
          <ResourceDeltaValue value={myPlayer ? (myPlayer.morale ?? 0) : null} style={styles.resourceBannerValue} />
        </View>
      </View>
      ) : null}
      {sitrepOn ? (
        <SitrepCard
          suppressed={objectiveActive || spineActive || flightActive || spineFlightPending}
        />
      ) : null}
      {objectiveActive && !flightActive && !spineFlightPending ? (
        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [styles.objectiveBanner, pressed && { opacity: 0.9 }]}
          onPress={flyToObjective}
        >
          <Text style={styles.objectiveBannerKicker}>{t('firstClaim.kicker')}</Text>
          <Text style={styles.objectiveBannerText}>
            {spineActive
              ? t('firstClaim.objectiveLine', { name: target.name })
              : t('firstClaim.instruction', {
                  distance: formatWalkDistance(target.distance_m),
                  name: target.name,
                })}
          </Text>
        </Pressable>
      ) : null}
      {topBannerMessage ? (
        <View style={styles.topBanner}>
          <Text style={styles.topBannerText} maxFontSizeMultiplier={1.3}>{topBannerMessage}</Text>
        </View>
      ) : null}
      {showLoading && !topBannerMessage && !flightActive ? (
        <View pointerEvents="none" style={styles.loadingWrap}>
          <View style={styles.loadingPill}>
            <ActivityIndicator size="small" color="#FDFDFD" />
            <Text style={styles.loadingText}>{t('map.loadingTerritories')}</Text>
          </View>
        </View>
      ) : null}
      {mapError && !showLoading && !topBannerMessage && !flightActive ? (
        <View style={styles.loadingWrap}>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setMapError(false);
              handleTerritoriesRefetched();
            }}
            style={({ pressed }) => [styles.mapErrorPill, pressed && { opacity: 0.92 }]}
          >
            <Text style={styles.mapErrorText} maxFontSizeMultiplier={1.3}>{t('map.loadError')}</Text>
            <Text style={styles.mapErrorRetry}>{t('common.retry')}</Text>
          </Pressable>
        </View>
      ) : null}
      {emptyViewport && !mapError && !showLoading && !topBannerMessage && !flightActive ? (
        <View pointerEvents="none" style={styles.loadingWrap}>
          <View style={styles.loadingPill}>
            <Text style={styles.loadingText}>{t('map.emptyRegion')}</Text>
          </View>
        </View>
      ) : null}
      <View ref={mapWrapRef} collapsable={false} style={styles.map}>
      <MapboxGL.MapView
        ref={mapRef}
        style={styles.map}
        styleURL="mapbox://styles/mapbox/standard"
        onCameraChanged={onCameraChanged}
        // Mapbox's scale bar rendered as pure white on near-black: measured,
        // the highest-contrast object on the whole screen, above every game
        // object. A game board does not need a cartographic scale — distances
        // that matter are stated in the claim copy, in metres.
        // Note: the logo and (i) attribution stay. Mapbox's terms require them
        // to remain visible; they are repositioned with the control stack
        // rather than removed.
        scaleBarEnabled={false}
      >
        {/* The basemap is the desk, not the subject. BOARD_BASEMAP_CONFIG
            strips Mapbox's POI pictograms, place/road names and every hue out
            of the ground so the territory layers are the only voices on the
            board. See lib/mapBoard.js. */}
        <MapboxGL.StyleImport
          id="basemap"
          existing
          config={BOARD_BASEMAP_CONFIG}
        />
        {/* animationMode/animationDuration apply to declarative updates only —
            when fallbackCentre resolves from a guess to the real pin the camera
            snaps rather than easing across half a continent. Imperative
            setCamera calls carry their own timing. */}
        <MapboxGL.Camera
          ref={cameraRef}
          zoomLevel={INITIAL_ZOOM}
          centerCoordinate={fallbackCentre}
          animationMode="none"
          animationDuration={0}
        />

        {/* Ink wash over the finished basemap. Declared before every other
            layer, so it sits under all of them and above the basemap — the
            single knob that sets how quiet the ground is. See lib/mapBoard.js. */}
        <MapboxGL.BackgroundLayer id="board-scrim" style={BOARD_SCRIM_STYLE} />

        <MapboxGL.Images>
          {/* Ground tick tiles — the lean is the colour-blind-safe half of
              the ownership signal (ours leans one way, theirs the other). */}
          {HATCH_PATTERNS.map(({ name, xml }) => (
            <MapboxGL.Image key={name} name={name}>
              <View style={{ width: HATCH_TILE, height: HATCH_TILE }} collapsable={false}>
                <SvgXml xml={xml} width={HATCH_TILE} height={HATCH_TILE} />
              </View>
            </MapboxGL.Image>
          ))}
          <MapboxGL.Image key={PUCK_HEADING_IMAGE} name={PUCK_HEADING_IMAGE}>
            <View style={{ width: PUCK_HEADING_SIZE, height: PUCK_HEADING_SIZE }} collapsable={false}>
              <SvgXml xml={puckHeadingXml} width={PUCK_HEADING_SIZE} height={PUCK_HEADING_SIZE} />
            </View>
          </MapboxGL.Image>
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
          {TERRITORY_FLAG_ICONS.map(({ name, xml }) => (
            <MapboxGL.Image key={name} name={name}>
              <View style={{ width: TERRITORY_FLAG_SIZE, height: TERRITORY_FLAG_SIZE }} collapsable={false}>
                <SvgXml xml={xml} width={TERRITORY_FLAG_SIZE} height={TERRITORY_FLAG_SIZE} />
              </View>
            </MapboxGL.Image>
          ))}
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
            if (!f) return;
            // Opening a different territory while the Beat 3 sheet is up is a
            // dismissal without claiming — the LATER fork, minus the camera
            // pull-back (the player is mid-exploration).
            const s = spineRef.current;
            const prevId = selected?.feature?.id ?? selected?.feature?.properties?.id;
            if (s && !s.complete && s.beat === 'sheet' && target && prevId === target.id && f.id !== target.id) {
              couchClose({ pullBack: false });
            }
            setSelected({ feature: f, allFeatures: territories.features });
          }}
        >
          {/* Open ground first, underneath everything: it is the board surface,
              not an object sitting on it. */}
          <MapboxGL.FillLayer id="territories-open-fill" filter={openFilter} style={openFillStyle} />
          <MapboxGL.FillLayer id="territories-fill" style={fillStyle} />
          {mapLayers.has('territories-hatch') ? (
            <MapboxGL.FillLayer id="territories-hatch" filter={claimedFilter} style={hatchStyle} />
          ) : null}
          {mapLayers.has('territories-d4-walls') ? (
            <MapboxGL.FillExtrusionLayer id="territories-d4-walls" filter={d4WallFilter} style={d4WallStyle} />
          ) : null}
          <MapboxGL.LineLayer id="territories-casing" filter={claimedFilter} style={casingStyle} />
          <MapboxGL.LineLayer id="territories-glow" filter={claimedFilter} style={ownedGlowStyle} />
          <MapboxGL.LineLayer id="territories-line" filter={claimedFilter} style={lineStyle} />
          <MapboxGL.LineLayer id="territories-open" filter={openFilter} style={unclaimedLineStyle} />
          {mapLayers.has('territories-streak-inner') ? (
            <MapboxGL.LineLayer id="territories-streak-inner" filter={streakInnerFilter} style={streakInnerStyle} />
          ) : null}
          {mapLayers.has('territories-rampart') ? (
            <MapboxGL.LineLayer id="territories-rampart" filter={rampartFilter} style={rampartStyle} />
          ) : null}
          <MapboxGL.LineLayer id="territories-contested-casing" filter={contestedFilter} style={contestedCasingStyle} />
          <MapboxGL.LineLayer id="territories-contested" filter={contestedFilter} style={contestedLineStyle} />
          <MapboxGL.FillLayer id="territories-selected-fill" filter={highlightFilter} style={selectedFillStyle} />
          <MapboxGL.LineLayer id="territories-selected-glow" filter={highlightFilter} style={selectedGlowStyle} />
          <MapboxGL.LineLayer id="territories-selected-line" filter={selectedHeldFilter} style={selectedLineStyle} />
          <MapboxGL.LineLayer id="territories-selected-open-line" filter={selectedOpenFilter} style={selectedOpenLineStyle} />
          {/* No `slot` on these. A slotted layer is placed inside the basemap
              import, which puts it BELOW our own unslotted fills — measured on
              the round-1 capture, the held parcel's name came back as bone
              seen through a 0.44 slate-blue fill (#a9b4be), while unclaimed
              names next to it were full bone. That inverted the hierarchy the
              critic called out. Unslotted, plain declaration order applies and
              names sit on top of their plate, where they belong. The slot was
              only ever there to clear Mapbox's own labels, which are now off. */}
          <MapboxGL.SymbolLayer id="territories-labels" style={labelStyle} />
          <MapboxGL.SymbolLayer id="territories-emblems" minZoomLevel={11} filter={emblemFilter} style={emblemStyle} />
          {mapLayers.has('territories-battle-chips') ? (
            <MapboxGL.SymbolLayer id="territories-battle-chips" minZoomLevel={12} filter={chipFilter} style={chipStyle} />
          ) : null}
        </MapboxGL.ShapeSource>

        {/* Survey nodes on the corners of held parcels. */}
        <MapboxGL.ShapeSource id="territory-nodes" shape={territoryNodes}>
          <MapboxGL.CircleLayer id="territory-nodes-circles" minZoomLevel={14} style={nodeStyle} />
        </MapboxGL.ShapeSource>

        {mapLayers.has('bases-icons') ? (
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
          <MapboxGL.SymbolLayer id="bases-icons" minZoomLevel={12} style={baseIconStyle} />
          <MapboxGL.SymbolLayer id="bases-pennants" minZoomLevel={13} filter={pennantFilter} style={pennantStyle} />
        </MapboxGL.ShapeSource>
        ) : null}

        {objectiveActive && mapLayers.has('objective-fill') ? (
          <MapboxGL.ShapeSource id="first-claim-objective" shape={objectiveFeature} onPress={openObjectiveSheet}>
            <MapboxGL.FillLayer id="objective-fill" style={objectiveFillStyle} />
            <MapboxGL.LineLayer id="objective-line" style={objectiveLineStyle} />
          </MapboxGL.ShapeSource>
        ) : null}
        {objectiveActive && selected == null && !flightActive && !spineFlightPending ? (
          <MapboxGL.MarkerView
            coordinate={[target.longitude, target.latitude]}
            anchor={{ x: 0.5, y: 0.5 }}
            allowOverlap
          >
            <ObjectivePulse />
          </MapboxGL.MarkerView>
        ) : null}
        {celebration && celebrationStyles ? (
          <MapboxGL.ShapeSource
            id="celebration"
            shape={{ type: 'Feature', properties: {}, geometry: celebration.geojson }}
          >
            <MapboxGL.FillLayer id="celebration-fill" style={celebrationStyles.fill} />
            <MapboxGL.LineLayer id="celebration-line" style={celebrationStyles.line} />
          </MapboxGL.ShapeSource>
        ) : null}
      </MapboxGL.MapView>
      {/* Figma top bar: avatar, Gold panel, territory search (legacy_tabs
          off). Inside the map wrap so it sits below the in-flow banners. */}
      {figmaChrome && !flightActive ? (
        <MapTopBar
          gold={myPlayer ? (myPlayer.gold ?? 0) : null}
          level={myPlayer?.level ?? null}
          playerName={myPlayer?.username ?? ''}
          onSelectSearchResult={handleSearchSelect}
          onSearchActiveChange={setSearchActive}
        />
      ) : null}
      </View>

      {flightActive || figmaChrome ? null : (
        <Pressable
          accessibilityRole="button"
          style={styles.locateButton}
          onPress={recenter}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.locateIcon}>⌖</Text>
          <Text style={styles.locateText}>{t('map.locateMe')}</Text>
        </Pressable>
      )}

      {/* Colour key — recognition over recall for the territory colours. */}
      {flightActive || figmaChrome ? null : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('map.legendKey')}
          style={styles.legendButton}
          onPress={() => setLegendOpen((o) => !o)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.locateText}>{t('map.legendKey')}</Text>
        </Pressable>
      )}
      {legendOpen && !flightActive ? (
        <View style={figmaChrome ? styles.legendPanelFigma : styles.legendPanel}>
          {(figmaChrome
            // Dominia-Temp key (plan U5, Figma case 6): outlined squares,
            // no header.
            ? [
                { key: 'yours', fill: 'transparent', border: colors.self, label: t('map.legendTemp.yours', { defaultValue: 'Your Territory' }) },
                { key: 'alliance', fill: 'transparent', border: colors.alliance, label: t('map.legendTemp.alliance', { defaultValue: 'Alliance Territory' }) },
                { key: 'theirs', fill: 'transparent', border: colors.enemy, label: t('map.legendTemp.enemy', { defaultValue: "Enemy's Territory" }) },
              ]
            : [
            { key: 'yours', fill: CLAIM_SOFT, border: CLAIM, label: t('map.legendYours') },
            { key: 'alliance', fill: colors.allianceSoft, border: ALLIANCE, label: t('map.legendAlliance') },
            { key: 'theirs', fill: 'rgba(227,66,52,0.14)', border: ENEMY, label: t('map.legendTheirs') },
            { key: 'unclaimed', fill: 'transparent', border: SLATE, label: t('map.legendUnclaimed') },
            { key: 'siege', fill: 'transparent', border: '#E34234', label: t('map.legendSiege') },
          ]).map((row) => (
            <View key={row.key} style={styles.legendRow}>
              <View style={[figmaChrome ? styles.legendSwatchFigma : styles.legendSwatch, { backgroundColor: row.fill, borderColor: row.border }]} />
              <Text style={figmaChrome ? styles.legendLabelFigma : styles.legendLabel}>{row.label}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {fullSheetOn ? (
      <TerritorySheet
        territory={selected?.feature ?? selected}
        allFeatures={selected?.allFeatures ?? []}
        userId={userId}
        onClose={handleSheetClose}
        onTerritoriesRefetched={handleTerritoriesRefetched}
        onResourceBannerRefresh={fetchResourceBanner}
        myPlayer={myPlayer}
        setMyPlayer={setMyPlayer}
        getTokenRef={getTokenRef}
        showTopBanner={showTopBanner}
        objectiveTerritoryId={objectiveActive ? target.id : null}
        spineActive={spineActive}
        onSpineClaim={() => dispatchSpine(SPINE_EVENTS.CLAIM_STARTED)}
      />
      ) : (
        <TerritoryCard
          territory={defendModel ? null : selectedFeature}
          myPlayer={myPlayer}
          multiResource={multiResourceOn}
          streaksOn={streaksOn}
          atCap={cardAtCap}
          onClose={handleSheetClose}
          onStartClaim={handleCardClaim}
          onStartContest={handleCardContest}
          onViewAlliance={handleViewAlliance}
          firstClaim={objectiveActive && selectedFeature?.id != null && selectedFeature.id === objectiveFeature?.id}
          onCoachBubblePress={coach.step === COACH_STEPS.CARD && objectiveSelected
            ? () => dispatchCoach(COACH_EVENTS.NEXT)
            : null}
        />
      )}
      {/* Figma C1: RELOCATE (bottom-left) opens the Relocate sheet (C9/C10). */}
      {figmaChrome && !flightActive && selected == null && !coachActive ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('map.relocate.buttonA11y', { defaultValue: 'Jump the map to one of your territories' })}
          onPress={() => setRelocateOpen(true)}
          style={({ pressed }) => [styles.relocateButton, pressed && { opacity: 0.9 }]}
        >
          <PinIcon size={16} color="#84FF44" />
          <Text style={styles.relocateText} maxFontSizeMultiplier={1.3}>
            {t('map.relocate.button', { defaultValue: 'RELOCATE' })}
          </Text>
        </Pressable>
      ) : null}
      {figmaChrome ? (
        <MapSideRail
          figma
          // The full territory sheet grows past the rail when expanded (MORE),
          // and the rail would cover its close button, so step aside while it
          // is open. The compact Figma card sits below the rail and keeps it.
          hidden={flightActive || searchActive || (fullSheetOn && selected != null)}
          keyOpen={legendOpen}
          onToggleKey={() => setLegendOpen((o) => !o)}
          onLocate={recenter}
          coach={coach.step === COACH_STEPS.SIDE_PANEL}
          onCoachContinue={() => dispatchCoach(COACH_EVENTS.NEXT)}
        />
      ) : (
        <MapSideRail hidden={selected != null || flightActive} />
      )}

      {figmaChrome ? (
        <RelocateSheet
          visible={relocateOpen && !flightActive}
          playerId={myPlayer?.id ?? null}
          homePin={homePin}
          fallbackFeatures={ownFeatures}
          onClose={() => setRelocateOpen(false)}
          onGo={handleRelocateGo}
          onFindNearby={handleRelocateFindNearby}
        />
      ) : null}

      {figmaChrome && (coach.step === COACH_STEPS.SIDE_PANEL || coach.step === COACH_STEPS.TAP_TERRITORY) && !defendModel ? (
        <CoachMark
          step={coach.step}
          onContinue={() => dispatchCoach(COACH_EVENTS.NEXT)}
          onSkip={() => dispatchCoach(COACH_EVENTS.SKIP)}
        />
      ) : null}

      {defendModel ? (
        <DefendPopup
          model={defendModel}
          onDefend={handleDefendFromPopup}
          onDismiss={defendFeed.dismiss}
        />
      ) : null}

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
    backgroundColor: '#000000',
    paddingTop: StatusBar.currentHeight ?? 0,
  },
  map: {
    flex: 1,
  },

  // The objective banner is information that points somewhere, not the action
  // itself — so it no longer wears the action colour. A full Claim Red
  // perimeter plus red kicker text made it the loudest thing on the map and,
  // once CONTEST became the sheet's red primary, put two reds on one screen.
  // What is left is a single 2px Claim Red edge: enough to mark an objective,
  // not enough to compete with the button that actually takes ground.
  objectiveBanner: {
    backgroundColor: INK2,
    borderWidth: 1,
    borderColor: HAIRLINE_STRONG,
    borderLeftWidth: 2,
    borderLeftColor: '#84FF44',
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginHorizontal: 0,
  },
  objectiveBannerKicker: {
    fontFamily: 'IBMPlexSans_600SemiBold',
    fontSize: 11,
    color: SLATE2,
    letterSpacing: 1.4,
    marginBottom: 2,
  },
  objectiveBannerText: {
    fontFamily: 'IBMPlexSans_700Bold',
    fontSize: 11,
    color: BONE,
    letterSpacing: 0.4,
  },
  // Beat 3 focused sheet — the perimeter distance is the largest element on
  // the sheet (Archivo), with one Instrument Sans supporting line under it.
  spineHeroBlock: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(253,253,253,0.08)',
  },
  spineHeroLabel: {
    fontFamily: 'IBMPlexSans_700Bold',
    fontSize: 11,
    color: 'rgba(253,253,253,0.62)',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  spineHeroValue: {
    fontFamily: 'IBMPlexSans_600SemiBold',
    fontSize: 40,
    color: '#FDFDFD',
    letterSpacing: -0.4,
    textTransform: 'uppercase',
  },
  spineSupportLine: {
    fontFamily: 'IBMPlexSans_500Medium',
    fontSize: 13,
    color: 'rgba(253,253,253,0.85)',
    lineHeight: 19,
    marginTop: 10,
  },
  sheetObjectiveHint: {
    fontFamily: 'IBMPlexSans_600SemiBold',
    fontSize: 11,
    // Bone, not Claim — the red CLAIM CTA below is this sheet's one red element.
    color: BONE,
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
    borderColor: '#84FF44',
  },
  objectivePulseCore: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#84FF44',
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
    fontFamily: 'IBMPlexSans_700Bold',
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
    fontFamily: 'IBMPlexSans_700Bold',
    fontSize: 11,
    color: BONE,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  // Fetch-failure pill — same instrument shape as the loading pill, but
  // pressable: the whole pill is the Retry target (≥48dp with padding).
  mapErrorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: INK2,
    borderWidth: 1,
    borderColor: HAIRLINE_STRONG,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  mapErrorText: {
    fontFamily: 'IBMPlexSans_500Medium',
    fontSize: 13,
    color: BONE,
  },
  mapErrorRetry: {
    fontFamily: 'IBMPlexSans_600SemiBold',
    fontSize: 11,
    color: BONE,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    textDecorationLine: 'underline',
  },

  resourceBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(253,253,253,0.16)',
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
    backgroundColor: 'rgba(253,253,253,0.12)',
  },
  resourceBannerValue: {
    fontFamily: 'IBMPlexSans_700Bold',
    fontSize: 12,
    color: '#FDFDFD',
    letterSpacing: 0.5,
  },
  hudLeft: {
    position: 'absolute',
    top: (StatusBar.currentHeight ?? 0) + 76,
    left: 16,
    backgroundColor: '#0E0E10',
    borderRadius: 0,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: 'rgba(253,253,253,0.16)',
  },
  hudValue: {
    fontFamily: 'IBMPlexSans_700Bold',
    fontSize: 12,
    color: '#FDFDFD',
    letterSpacing: 0.5,
  },
  hudLabel: {
    marginTop: 2,
    fontFamily: 'IBMPlexSans_700Bold',
    fontSize: 11,
    color: 'rgba(253,253,253,0.62)',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },

  hudRight: {
    position: 'absolute',
    top: (StatusBar.currentHeight ?? 0) + 76,
    right: 16,
    alignItems: 'flex-end',
  },
  allianceBadge: {
    backgroundColor: colors.allianceSoft,
    borderColor: 'rgba(253,253,253,0.16)',
    borderWidth: 1,
    borderRadius: 0,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  allianceBadgeText: {
    fontFamily: 'IBMPlexSans_600SemiBold',
    fontSize: 11,
    color: colors.alliance,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },

  // KEY and LOCATE ME are one control stack, not two unrelated boxes. They
  // previously sized to their own text, so they shared a left edge and nothing
  // else — different widths, different optical weight. A shared width and a
  // shared surface treatment (matching the side rail's translucent ink) makes
  // the map's chrome speak one language instead of three. minHeight lifts them
  // towards a proper touch target; both also carry hitSlop.
  locateButton: {
    position: 'absolute',
    left: 16,
    bottom: 20,
    width: 136,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.86)',
    borderRadius: 0,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(253,253,253,0.08)',
  },
  locateIcon: {
    fontFamily: 'IBMPlexSans_700Bold',
    color: '#FDFDFD',
    fontSize: 14,
  },
  locateText: {
    fontFamily: 'IBMPlexSans_700Bold',
    fontSize: 11,
    // Bone, not slate — these controls are read in direct sunlight.
    color: BONE,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  legendButton: {
    position: 'absolute',
    left: 16,
    bottom: 72,
    width: 136,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.86)',
    borderRadius: 0,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(253,253,253,0.08)',
  },
  legendPanel: {
    position: 'absolute',
    left: 16,
    bottom: 108,
    backgroundColor: INK2,
    borderWidth: 1,
    borderColor: HAIRLINE_STRONG,
    borderRadius: 0,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 8,
  },
  // Figma mode: the key opens beside the rail's Key control, top right.
  // Dominia-Temp key (plan U5): a dark card left of the rail's key tile
  // (MapSideRail figma: right 16, top 124, tiles ~50pt wide).
  legendPanelFigma: {
    position: 'absolute',
    right: 74,
    top: 116,
    backgroundColor: 'rgba(14,14,16,0.94)',
    borderWidth: 1,
    borderColor: colors.surfaceLine,
    borderRadius: 0,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 10,
    zIndex: 11,
  },
  legendSwatchFigma: {
    width: 14,
    height: 14,
    borderWidth: 2,
  },
  legendLabelFigma: {
    fontFamily: 'IBMPlexSans_600SemiBold',
    fontSize: 13,
    color: BONE,
  },
  // Figma C2 key header.
  legendHeaderFigma: {
    fontFamily: 'IBMPlexSans_700Bold',
    fontSize: 11,
    color: 'rgba(253,253,253,0.62)',
    letterSpacing: 1.76,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  // Figma C1: RELOCATE, bottom-left above the tab bar, lifted clear of the
  // Mapbox logo and (i) attribution in that corner (both must stay visible
  // under Mapbox's terms; together they reach ~32pt up).
  relocateButton: {
    position: 'absolute',
    left: 12,
    bottom: 44,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(0,0,0,0.86)',
    borderWidth: 1,
    borderColor: '#84FF44',
    borderRadius: 0,
    zIndex: 12,
  },
  relocateText: {
    fontFamily: 'IBMPlexSans_600SemiBold',
    fontSize: 13,
    letterSpacing: 1.4,
    color: BONE,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendSwatch: {
    width: 12,
    height: 12,
    borderWidth: 1,
  },
  legendLabel: {
    fontFamily: 'IBMPlexSans_700Bold',
    fontSize: 11,
    color: BONE,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },

  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0E0E10',
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderColor: 'rgba(253,253,253,0.16)',
    paddingTop: 12,
    paddingBottom: 24,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 32,
    height: 1,
    borderRadius: 0,
    backgroundColor: 'rgba(253,253,253,0.16)',
    marginBottom: 14,
  },
  sheetTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  sheetTitle: {
    fontFamily: 'IBMPlexSans_600SemiBold',
    fontSize: 20,
    color: '#FDFDFD',
    letterSpacing: -0.015,
  },
  sheetTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sheetStateLabel: {
    fontFamily: 'IBMPlexSans_700Bold',
    fontSize: 11,
    color: 'rgba(253,253,253,0.62)',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  sheetTierBadge: {
    borderRadius: 0,
    borderWidth: 1,
    borderColor: 'rgba(253,253,253,0.16)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 1,
  },
  sheetTierBadgeText: {
    fontFamily: 'IBMPlexSans_700Bold',
    fontSize: 11,
    color: 'rgba(253,253,253,0.62)',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  sheetSubtitle: {
    fontFamily: 'IBMPlexSans_700Bold',
    fontSize: 11,
    color: 'rgba(253,253,253,0.62)',
    marginTop: 6,
    letterSpacing: 0.5,
  },
  sheetSubtitleStrong: {
    fontFamily: 'IBMPlexSans_600SemiBold',
    color: '#FDFDFD',
  },
  sheetOwnerUnclaimed: {
    fontFamily: 'IBMPlexSans_700Bold',
    color: 'rgba(253,253,253,0.30)',
  },
  sheetAllianceTag: {
    fontFamily: 'IBMPlexSans_700Bold',
    color: 'rgba(253,253,253,0.62)',
  },
  sheetIntelBlock: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(253,253,253,0.08)',
  },
  sheetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  sheetRowLabel: {
    fontFamily: 'IBMPlexSans_700Bold',
    fontSize: 11,
    color: 'rgba(253,253,253,0.62)',
    letterSpacing: 0.5,
  },
  sheetRowValue: {
    fontFamily: 'IBMPlexSans_600SemiBold',
    fontSize: 11,
    color: '#FDFDFD',
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
    borderTopColor: 'rgba(253,253,253,0.16)',
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(253,253,253,0.16)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sheetInfluenceLabel: {
    fontFamily: 'IBMPlexSans_700Bold',
    fontSize: 11,
    color: 'rgba(253,253,253,0.62)',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  sheetInfluenceSub: {
    fontFamily: 'IBMPlexSans_700Bold',
    fontSize: 11,
    color: 'rgba(253,253,253,0.62)',
    letterSpacing: 0.5,
  },
  sheetInfluenceValue: {
    fontFamily: 'IBMPlexSans_700Bold',
    fontSize: 26,
    color: '#FDFDFD',
    letterSpacing: -0.3,
    textTransform: 'uppercase',
  },
  sheetExpandedBlock: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(253,253,253,0.08)',
  },
  sheetYourWalk: {
    marginTop: 10,
    backgroundColor: INK,
    borderWidth: 0.5,
    borderColor: HAIRLINE_STRONG,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  sheetYourWalkLabel: {
    fontFamily: 'IBMPlexSans_700Bold',
    fontSize: 11,
    color: SLATE2,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  sheetYourWalkValue: {
    fontFamily: 'IBMPlexSans_600SemiBold',
    fontSize: 13,
    color: '#FDFDFD',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  sheetYourWalkSub: {
    fontFamily: 'IBMPlexSans_700Bold',
    fontSize: 11,
    color: 'rgba(253,253,253,0.62)',
    letterSpacing: 0.3,
    lineHeight: 14,
  },
  // One-line plain-language gloss under a data row — Instrument Sans, quiet but readable.
  sheetGloss: {
    fontFamily: 'IBMPlexSans_500Medium',
    fontSize: 11,
    color: 'rgba(253,253,253,0.62)',
    lineHeight: 16,
    marginTop: 2,
  },
  sheetToggle: {
    marginTop: 12,
    paddingVertical: 8,
    alignItems: 'center',
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(253,253,253,0.08)',
  },
  // Slate 2, not Slate. At 9px/rgba(253,253,253,0.30) this control was ~2.7:1 on the sheet and
  // read as a caption rather than the only way to reach development, legacy and
  // walk detail. It stays text-only per the brand's no-icon rule for toggles.
  sheetToggleText: {
    fontFamily: 'IBMPlexSans_700Bold',
    fontSize: 11,
    color: 'rgba(253,253,253,0.62)',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  sheetClose: {
    width: 32,
    height: 32,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: 'rgba(253,253,253,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetCloseText: {
    fontFamily: 'IBMPlexSans_700Bold',
    color: '#FDFDFD',
    fontSize: 20,
    marginTop: -2,
  },
  sheetAction: {
    marginTop: 16,
    backgroundColor: '#84FF44',
    borderRadius: 0,
    paddingVertical: 14,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetActionDisabled: {
    marginTop: 16,
    backgroundColor: '#0E0E10',
    borderRadius: 0,
    borderWidth: 1,
    borderColor: 'rgba(253,253,253,0.16)',
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Secondary sheet action — contest and abandon. Ink instrument with a strong
  // hairline; the single Claim-Red action per sheet stays with the constructive
  // primary (Claim / Develop) per the One Claim Rule.
  sheetActionSecondary: {
    marginTop: 16,
    backgroundColor: INK2,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: HAIRLINE_STRONG,
    paddingVertical: 14,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetActionText: {
    fontFamily: 'IBMPlexSans_600SemiBold',
    color: '#FDFDFD',
    fontSize: 12,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  sheetActionDisabledText: {
    fontFamily: 'IBMPlexSans_700Bold',
    fontSize: 12,
    color: 'rgba(253,253,253,0.30)',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  sheetActionDisabledSub: {
    fontFamily: 'IBMPlexSans_700Bold',
    fontSize: 11,
    color: 'rgba(253,253,253,0.30)',
    marginTop: 4,
    letterSpacing: 0.5,
  },
  sheetConfirmDataBlock: {
    marginTop: 12,
    paddingTop: 16,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(253,253,253,0.08)',
  },
  sheetConfirmDataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 10,
  },
  devValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sheetConfirmLabel: {
    fontFamily: 'IBMPlexSans_700Bold',
    fontSize: 11,
    color: 'rgba(253,253,253,0.62)',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  sheetConfirmValue: {
    // Measurements and balances — mono per the Controlling Rule.
    fontFamily: 'IBMPlexSans_600SemiBold',
    fontSize: 14,
    color: '#FDFDFD',
    letterSpacing: 0.3,
  },
  sheetConfirmHelpText: {
    fontFamily: 'IBMPlexSans_500Medium',
    fontSize: 13,
    color: 'rgba(253,253,253,0.7)',
    lineHeight: 18,
    marginTop: 6,
  },
  // Errors are sentences a player reads — Instrument Sans in Bone, never Claim Red
  // (the Locked Meaning Rule keeps red for "yours").
  sheetConfirmError: {
    fontFamily: 'IBMPlexSans_500Medium',
    fontSize: 13,
    color: BONE,
    lineHeight: 18,
    textAlign: 'center',
    paddingVertical: 10,
  },
  sheetContestActiveCard: {
    marginTop: 12,
    paddingTop: 16,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(253,253,253,0.08)',
    gap: 12,
  },
  sheetContestActiveText: {
    fontFamily: 'IBMPlexSans_500Medium',
    fontSize: 13,
    color: 'rgba(253,253,253,0.85)',
    lineHeight: 18,
    textAlign: 'center',
  },
  sheetCancel: {
    marginTop: 8,
    backgroundColor: 'transparent',
    borderRadius: 0,
    borderWidth: 1,
    borderColor: 'rgba(253,253,253,0.16)',
    paddingVertical: 13,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetCancelText: {
    fontFamily: 'IBMPlexSans_600SemiBold',
    fontSize: 12,
    color: 'rgba(253,253,253,0.6)',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
});
