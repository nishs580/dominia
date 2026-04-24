import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import MapboxGL from '@rnmapbox/maps';
import { useAuth } from '@clerk/clerk-expo';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { getLevelForXp } from '../lib/level.js';
import {
  streakTier,
  developmentName,
  legacyRankName,
  influencePerDay,
  contestWalkDistance,
  streakReductionPercent,
} from '../lib/territory';

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

function TerritorySheet({ territory, onClose, userId, onTerritoriesRefetched, myPlayer, allFeatures = [] }) {
  const navigation = useNavigation();
  const [expanded, setExpanded] = useState(false);
  if (!territory) return null;

  const name = territory.properties?.name ?? 'Territory';
  const ownerRaw = territory.properties?.owner;
  const isUnclaimed = ownerRaw == null || ownerRaw === 'Unclaimed';
  const owner = !isUnclaimed ? ownerRaw : null;

  const tier = territory.properties?.tier ?? 'Medium';
  const developmentLevel = territory.properties?.developmentLevel ?? 0;
  const alliance = territory.properties?.alliance ?? null;
  const ownerStreakDays = territory.properties?.ownerStreak ?? 0;

  // Placeholder values for data not yet in DB
  const legacyRank = 1; // Unproven — no column yet
  const heldDays = 14; // Placeholder
  const changedHands = 6; // Placeholder
  const hallOfHoldersCount = 12; // Placeholder

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

  const playerXp = myPlayer?.xp ?? 0;
  const levelData = getLevelForXp(playerXp);
  const cap = levelData?.territoryCap ?? 1;
  const heldCount = allFeatures.filter(f => f.properties?.color === '#D64525').length;
  const isAtCap = heldCount >= cap;

  // Owner's streak tier (deterrent signal)
  const ownerTier = streakTier(ownerStreakDays);

  // Your streak
  const myStreak = myPlayer?.current_streak ?? 0;

  // Influence per day
  const influence = influencePerDay({ tier, developmentLevel, legacyRank, upkeepActive: true });

  // Walk distance for contest
  const walkDistance = isOwned
    ? contestWalkDistance({
        perimeter: perimeterDistance,
        attackerStreakDays: myStreak,
        defenderStreakDays: ownerStreakDays,
        tier,
        developmentLevel,
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

  return (
    <View style={[styles.sheet, { borderTopColor: topBorderColour, borderTopWidth: 1 }]}>
      <View style={styles.sheetHandle} />

      <View style={styles.sheetTopRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sheetStateLabel}>{stateLabel}</Text>
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
              {ownerTier.name}
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
              R{legacyRank} · {legacyRankName(legacyRank)}
            </Text>
          </View>
          {!isUnclaimed && (
            <>
              <View style={styles.sheetRow}>
                <Text style={styles.sheetRowLabel}>Held</Text>
                <Text style={styles.sheetRowValue}>{heldDays} days</Text>
              </View>
              <View style={styles.sheetRow}>
                <Text style={styles.sheetRowLabel}>Changed hands</Text>
                <Text style={styles.sheetRowValue}>{changedHands} times</Text>
              </View>
            </>
          )}
          <View style={styles.sheetRow}>
            <Text style={styles.sheetRowLabel}>Hall of Holders</Text>
            <Text style={styles.sheetRowValue}>{hallOfHoldersCount} commanders</Text>
          </View>

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
          onPress={() => {
            navigation.navigate('ActiveClaim', {
              territoryName: selectedTerritory.name,
              perimeterDistance: selectedTerritory.perimeter,
              territoryId: territory.id,
              playerId: myPlayer?.id,
            });
          }}
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
                  onTerritoriesRefetched?.();
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
            navigation.navigate('ActiveClaim', {
              territoryName: selectedTerritory.name,
              perimeterDistance: selectedTerritory.perimeter,
              territoryId: territory.id,
              playerId: myPlayer?.id,
              mode: 'contest',
            });
          }}
        >
          <Text style={styles.sheetActionText}>Contest</Text>
        </Pressable>
      )}
    </View>
  );
}

export default function MapScreen() {
  const navigation = useNavigation();
  const cameraRef = useRef(null);
  const [lastUserCoord, setLastUserCoord] = useState(null);
  const [selected, setSelected] = useState(null);
  const [territories, setTerritories] = useState({ type: 'FeatureCollection', features: [] });
  const [myAllianceName, setMyAllianceName] = useState(null);
  const [myPlayer, setMyPlayer] = useState(null);
  const { userId } = useAuth();

  const fetchTerritories = useCallback(async () => {
    const { data: playerRow } = await supabase
      .from('players')
      .select('id, alliance_id, xp, current_streak')
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

    const { data, error } = await supabase
      .from('territories')
      .select('*, players(username, clerk_id, current_streak), alliances(short_name)');
    if (error) {
      console.error('Error fetching territories:', error);
      return;
    }
    const features = data.map((t) => {
      return {
        type: 'Feature',
        id: t.id,
        properties: {
          name: t.territory_name,
          owner: t.players?.username ?? 'Unclaimed',
          alliance: t.alliances?.short_name ?? null,
          tier: t.tier ?? 'Medium',
          level: `D${t.development_level ?? 0}`,
          ownerStreak: t.players?.current_streak ?? 0,
          developmentLevel: t.development_level ?? 0,
          perimeter: t.perimeter_distance,
          color: t.players?.clerk_id === userId ? '#D64525' :
            (playerRow?.alliance_id && t.alliance_id === playerRow.alliance_id) ? '#3F8F4E' :
            t.owner_id != null ? '#4A6B8A' : 'transparent',
        },
        geometry: {
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
    setTerritories({ type: 'FeatureCollection', features });
  }, [userId]);

  useEffect(() => {
    fetchTerritories();
  }, [fetchTerritories]);

  const fillStyle = useMemo(
    () => ({
      fillColor: ['get', 'color'],
      fillOpacity: 0.22,
    }),
    [],
  );

  const lineStyle = useMemo(
    () => ({
      lineColor: ['case', ['==', ['get', 'color'], UNCLAIMED], SLATE, ['get', 'color']],
      lineWidth: ['case', ['==', ['get', 'color'], UNCLAIMED], 0.6, 1],
      lineOpacity: ['case', ['==', ['get', 'color'], UNCLAIMED], 0.5, 0.9],
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
      <MapboxGL.MapView style={styles.map} styleURL="mapbox://styles/mapbox/dark-v11">
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
          <MapboxGL.SymbolLayer id="territories-labels" style={labelStyle} />
        </MapboxGL.ShapeSource>
      </MapboxGL.MapView>

      <View style={styles.hudLeft}>
        <Text style={styles.hudValue}>6,240 steps</Text>
        <Text style={styles.hudLabel}>today</Text>
      </View>

      <View style={styles.hudRight}>
        <View style={styles.allianceBadge}>
          <Text style={styles.allianceBadgeText} numberOfLines={1} ellipsizeMode="tail">
            {myAllianceName ?? 'No Alliance'}
          </Text>
        </View>
      </View>

      <Pressable accessibilityRole="button" style={styles.locateButton} onPress={recenter}>
        <Text style={styles.locateIcon}>⌖</Text>
        <Text style={styles.locateText}>Locate me</Text>
      </Pressable>

      <TerritorySheet
        territory={selected?.feature ?? selected}
        allFeatures={selected?.allFeatures ?? []}
        userId={userId}
        onClose={() => setSelected(null)}
        onTerritoriesRefetched={fetchTerritories}
        myPlayer={myPlayer}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0E1014',
  },
  map: {
    flex: 1,
  },

  hudLeft: {
    position: 'absolute',
    top: 52,
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
    top: 52,
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
});
