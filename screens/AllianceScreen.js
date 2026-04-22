import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { colors, fonts, fontSize, spacing, radius, borders, text } from '../lib/theme';

const CLAIM = '#D64525';
const INK = '#0E1014';
const INK2 = '#1A1D24';
const INK3 = '#252932';
const BONE = '#F2EEE6';
const SLATE = '#5C6068';
const SLATE2 = '#8B8F98';
const ALLIANCE_GREEN = '#3F8F4E';
const HAIRLINE = 'rgba(242,238,230,0.08)';
const HAIRLINE_STRONG = 'rgba(242,238,230,0.16)';

function HeaderKicker({ children }) {
  return <Text style={styles.headerKicker}>{children}</Text>;
}

function AllianceCard({ dotColor, nameLine, metaLine, members, onPress }) {
  const inner = (
    <>
      <View style={[styles.allianceDot, { backgroundColor: dotColor }]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.allianceCardName}>{nameLine}</Text>
        <Text style={styles.allianceCardMeta}>{metaLine}</Text>
      </View>
      <Text style={styles.allianceCardMembers}>{members}</Text>
    </>
  );
  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [styles.allianceCard, pressed && { opacity: 0.92 }]}
      >
        {inner}
      </Pressable>
    );
  }
  return <View style={styles.allianceCard}>{inner}</View>;
}

function RosterRow({ initials, name, role, steps, showBorder }) {
  return (
    <View style={[styles.rosterRow, showBorder && styles.rosterRowBorder]}>
      <View style={styles.rosterLeft}>
        <View style={styles.rosterAvatar}>
          <Text style={styles.rosterInitials}>{initials}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.rosterName}>{name}</Text>
          <Text style={styles.rosterRole}>{role}</Text>
        </View>
      </View>
      <Text style={styles.rosterSteps}>{steps}</Text>
    </View>
  );
}

function NonMemberContent({ alliances, userId, onRefreshAfterJoin, navigation, playerRow }) {
  const [confirmAlliance, setConfirmAlliance] = useState(null);
  const [joinSaving, setJoinSaving] = useState(false);

  const dotColors = [CLAIM, ALLIANCE_GREEN];

  const handleConfirmJoin = async () => {
    if (!userId || !confirmAlliance) return;
    setJoinSaving(true);
    try {
      const { error } = await supabase
        .from('players')
        .update({ alliance_id: confirmAlliance.id })
        .eq('clerk_id', userId);
      if (error) throw error;

      await supabase
        .from('territories')
        .update({ alliance_id: confirmAlliance.id })
        .eq('owner_id', playerRow.id);

      setConfirmAlliance(null);
      await onRefreshAfterJoin();
    } catch (err) {
      console.error('Join alliance failed:', err);
      Alert.alert('Could not join', err?.message ?? 'Please try again.');
    } finally {
      setJoinSaving(false);
    }
  };

  if (confirmAlliance) {
    return (
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>{confirmAlliance.name}</Text>
          <Pressable
            accessibilityRole="button"
            disabled={joinSaving}
            onPress={handleConfirmJoin}
            style={({ pressed }) => [styles.btnPrimary, pressed && !joinSaving && { opacity: 0.9 }, joinSaving && { opacity: 0.7 }]}
          >
            <Text style={styles.btnPrimaryText}>Join {confirmAlliance.name}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={joinSaving}
            onPress={() => setConfirmAlliance(null)}
            style={({ pressed }) => [styles.btnMuted, pressed && !joinSaving && { opacity: 0.9 }]}
          >
            <Text style={styles.btnMutedText}>Cancel</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyEmoji}></Text>
        <Text style={styles.emptyTitle}>Join an alliance</Text>
        <Text style={styles.emptySubtitle}>
          Alliance warfare unlocks at Level 6. Coordinate with others, share resources, and dominate the map together.
        </Text>
        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [styles.btnPrimary, pressed && { opacity: 0.9 }]}
        >
          <Text style={styles.btnPrimaryText}>Find an alliance</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.navigate('CreateAlliance')}
          style={({ pressed }) => [styles.btnMuted, pressed && { opacity: 0.9 }]}
        >
          <Text style={styles.btnMutedText}>Create your alliance</Text>
        </Pressable>
      </View>

      <HeaderKicker>ALLIANCES IN YOUR CITY</HeaderKicker>
      <View style={{ marginTop: 10, gap: 10 }}>
        {alliances.map((a, index) => (
          <AllianceCard
            key={a.id}
            dotColor={dotColors[index % dotColors.length]}
            nameLine={`${a.name} [${a.short_name}]`}
            metaLine={a.city ?? '—'}
            members={`${a.memberCount}/20`}
            onPress={() => setConfirmAlliance(a)}
          />
        ))}
      </View>
    </ScrollView>
  );
}

function MemberContent({ myAlliance, playerId, territoryCount }) {
  const [roster, setRoster] = useState([]);

  useEffect(() => {
    if (!myAlliance?.id) {
      setRoster([]);
      return;
    }

    let cancelled = false;

    async function loadMemberData() {
      const playersRes = await supabase
        .from('players')
        .select('id, username, level')
        .eq('alliance_id', myAlliance.id);

      if (playersRes.error) {
        console.error('AllianceScreen roster:', playersRes.error);
      }

      if (cancelled) return;

      setRoster(playersRes.error ? [] : playersRes.data ?? []);
    }

    loadMemberData();

    return () => {
      cancelled = true;
    };
  }, [myAlliance?.id]);

  return (
    <>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.memberScrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.missionCard}>
          <View style={styles.missionTopRow}>
            <Text style={styles.missionStatusLabel}>MISSION IN PROGRESS</Text>
            <Text style={styles.missionTimer}>RESETS IN 4D</Text>
          </View>
          <Text style={styles.missionTitle}>Collective Fitness — 500,000 steps</Text>
          <Text style={styles.missionDesc}>Every member's daily step count contributes.</Text>
          <View style={styles.missionProgressRow}>
            <Text style={styles.missionProgressValue}>300,000 steps</Text>
            <Text style={styles.missionProgressTotal}>/ 500,000</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: '60%' }]} />
          </View>
          <Text style={styles.missionReward}>REWARD — +40 GOLD EACH · +300 XP</Text>
        </View>

        <View style={[styles.sectionLabelRow, { marginTop: 18 }]}>
          <Text style={styles.sectionLabel}>ROSTER</Text>
          <View style={styles.sectionRule} />
        </View>
        <View style={styles.rosterWrap}>
          {roster.map((m, i) => (
            <RosterRow
              key={m.id}
              initials={m.username ? m.username.slice(0, 2).toUpperCase() : '??'}
              name={m.username ?? '—'}
              role={m.id === myAlliance.founder_id ? 'Founder' : 'Member'}
              steps="—"
              showBorder={i < roster.length - 1}
            />
          ))}
        </View>
      </ScrollView>
    </>
  );
}

export default function AllianceScreen() {
  const navigation = useNavigation();
  const { userId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [playerRow, setPlayerRow] = useState(null);
  const [myAlliance, setMyAlliance] = useState(null);
  const [allianceList, setAllianceList] = useState([]);
  const [territoryCount, setTerritoryCount] = useState(null);

  const fetchPlayerAndContext = useCallback(
    async ({ silent = false } = {}) => {
      if (!userId) {
        setPlayerRow(null);
        setMyAlliance(null);
        setAllianceList([]);
        setTerritoryCount(null);
        if (!silent) setLoading(false);
        return;
      }
      if (!silent) setLoading(true);
      try {
        const { data: player, error: playerError } = await supabase
          .from('players')
          .select('id, alliance_id')
          .eq('clerk_id', userId)
          .maybeSingle();

        if (playerError) {
          console.error('AllianceScreen player fetch:', playerError);
          setPlayerRow(null);
          setMyAlliance(null);
          setAllianceList([]);
          return;
        }

        setPlayerRow(player);

        if (player?.alliance_id) {
          const { data: allianceRow, error: allianceError } = await supabase
            .from('alliances')
            .select('id, name, short_name, city, founder_id')
            .eq('id', player.alliance_id)
            .maybeSingle();

          const { count, error: countError } = await supabase
            .from('players')
            .select('*', { count: 'exact', head: true })
            .eq('alliance_id', player.alliance_id);

          if (allianceError || countError || !allianceRow) {
            if (allianceError || countError) {
              console.error('AllianceScreen alliance detail:', allianceError || countError);
            }
            setMyAlliance(null);
            setTerritoryCount(null);
          } else {
            setMyAlliance({
              ...allianceRow,
              memberCount: count ?? 0,
            });

            const { count: terrCount, error: terrError } = await supabase
              .from('territories')
              .select('*', { count: 'exact', head: true })
              .eq('alliance_id', player.alliance_id);
            if (terrError) {
              console.error('AllianceScreen territory count:', terrError);
              setTerritoryCount(null);
            } else {
              setTerritoryCount(terrCount ?? 0);
            }
          }
          setAllianceList([]);
        } else {
          setMyAlliance(null);
          setTerritoryCount(null);
          const { data: alliances, error: listError } = await supabase
            .from('alliances')
            .select('id, name, short_name, city');

          if (listError || !alliances?.length) {
            if (listError) console.error('AllianceScreen alliances list:', listError);
            setAllianceList([]);
            return;
          }

          const withCounts = await Promise.all(
            alliances.map(async (a) => {
              const { count } = await supabase
                .from('players')
                .select('*', { count: 'exact', head: true })
                .eq('alliance_id', a.id);
              return { ...a, memberCount: count ?? 0 };
            }),
          );
          setAllianceList(withCounts);
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [userId],
  );

  useEffect(() => {
    fetchPlayerAndContext();
  }, [fetchPlayerAndContext]);

  const isMember = Boolean(playerRow?.alliance_id);

  if (loading) {
    return (
      <View style={[styles.screen, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={SLATE2} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        {isMember ? (
          <>
            <View style={styles.headerTopRow}>
              <View style={{ flex: 1 }} />
              <View style={styles.shortNameBox}>
                <Text style={styles.shortNameText}>{myAlliance?.short_name ?? '—'}</Text>
              </View>
            </View>

            <Text style={styles.headerTitle}>{myAlliance?.name ?? 'Alliance'}</Text>

            <Text style={styles.headerCity}>
              {'OF ' + (myAlliance?.city ?? '—').toUpperCase() + ' · REALM 01'}
            </Text>

            <View style={styles.headerDivider} />

            <View style={styles.headerStatsRow}>
              <Text style={styles.headerStat}>
                <Text style={styles.headerStatLabel}>ROSTER </Text>
                <Text style={styles.headerStatValue}>{myAlliance?.memberCount ?? '—'} / 20</Text>
              </Text>
              <Text style={styles.headerStat}>
                <Text style={styles.headerStatLabel}>TERRITORIES </Text>
                <Text style={styles.headerStatValue}>
                  {territoryCount !== null ? String(territoryCount) : '—'}
                </Text>
              </Text>
            </View>
          </>
        ) : (
          <>
            <HeaderKicker>ALLIANCE</HeaderKicker>
            <Text style={styles.headerTitle}>NO ALLIANCE</Text>
            <Text style={styles.headerSubtitle}>You are unaffiliated</Text>
          </>
        )}
      </View>

      {isMember ? (
        <MemberContent myAlliance={myAlliance} playerId={playerRow?.id} territoryCount={territoryCount} />
      ) : (
        <NonMemberContent
          alliances={allianceList}
          userId={userId}
          onRefreshAfterJoin={() => fetchPlayerAndContext({ silent: true })}
          navigation={navigation}
          playerRow={playerRow}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: INK,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: (StatusBar.currentHeight ?? 0) + 12,
    paddingBottom: 12,
  },
  headerKicker: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 1.6,
    color: SLATE2,
  },
  headerTitle: {
    fontFamily: 'Archivo_900Black',
    fontSize: 40,
    color: BONE,
    textTransform: 'uppercase',
    letterSpacing: -0.02,
    marginTop: 8,
    lineHeight: 44,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  shortNameBox: {
    borderWidth: 1,
    borderColor: CLAIM,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 0,
  },
  shortNameText: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 11,
    color: CLAIM,
    letterSpacing: 1.4,
  },
  headerCity: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 10,
    color: SLATE2,
    letterSpacing: 1.4,
    marginTop: 6,
  },
  headerDivider: {
    height: 1,
    backgroundColor: HAIRLINE_STRONG,
    marginTop: 14,
    marginBottom: 14,
  },
  headerStatsRow: {
    flexDirection: 'row',
    gap: 24,
  },
  headerStat: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 11,
    color: SLATE2,
  },
  headerStatLabel: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 11,
    color: SLATE2,
    letterSpacing: 1.4,
  },
  headerStatValue: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 11,
    color: BONE,
  },
  headerSubtitle: {
    marginTop: 6,
    fontFamily: 'GeistMono_400Regular',
    fontSize: 11,
    color: SLATE2,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 28,
  },
  memberScrollContent: {
    padding: 16,
    paddingBottom: 28,
  },
  emptyWrap: {
    alignItems: 'center',
    marginBottom: 28,
  },
  emptyEmoji: {
    height: 0,
    opacity: 0,
  },
  emptyTitle: {
    fontFamily: 'Archivo_900Black',
    fontSize: 28,
    color: BONE,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  emptySubtitle: {
    marginTop: 10,
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: SLATE2,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  btnPrimary: {
    marginTop: 18,
    width: '100%',
    backgroundColor: CLAIM,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryText: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 12,
    color: BONE,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
  },
  btnMuted: {
    marginTop: 10,
    width: '100%',
    backgroundColor: INK2,
    borderWidth: 1,
    borderColor: HAIRLINE_STRONG,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnMutedText: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 12,
    color: SLATE2,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
  },
  allianceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: INK2,
    borderWidth: 1,
    borderColor: HAIRLINE_STRONG,
    padding: 10,
    gap: 10,
  },
  allianceDot: {
    width: 0,
    height: 0,
    opacity: 0,
  },
  allianceCardName: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: BONE,
  },
  allianceCardMeta: {
    marginTop: 4,
    fontFamily: 'GeistMono_400Regular',
    fontSize: 9,
    color: SLATE2,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
  },
  allianceCardMembers: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 10,
    color: SLATE2,
  },
  sectionLabelRow: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionLabel: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 9,
    color: SLATE2,
    textTransform: 'uppercase',
    letterSpacing: 1.6,
  },
  sectionRule: {
    flex: 1,
    height: 1,
    backgroundColor: HAIRLINE_STRONG,
    alignSelf: 'center',
    marginLeft: 8,
  },
  missionCard: {
    marginTop: 16,
    backgroundColor: INK2,
    borderWidth: 1,
    borderColor: HAIRLINE_STRONG,
    borderRadius: 0,
    padding: 16,
    borderLeftWidth: 2,
    borderLeftColor: ALLIANCE_GREEN,
  },
  missionTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  missionStatusLabel: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 9,
    color: ALLIANCE_GREEN,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  missionTimer: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 9,
    color: SLATE2,
    letterSpacing: 1.4,
  },
  missionTitle: {
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
    color: BONE,
    lineHeight: 22,
  },
  missionDesc: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 10,
    color: SLATE2,
    marginTop: 6,
    lineHeight: 16,
  },
  missionProgressRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginTop: 12,
  },
  missionProgressValue: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 13,
    color: BONE,
  },
  missionProgressTotal: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 11,
    color: SLATE2,
  },
  progressTrack: {
    marginTop: 8,
    height: 2,
    backgroundColor: HAIRLINE_STRONG,
    borderRadius: 0,
  },
  progressFill: {
    height: '100%',
    backgroundColor: ALLIANCE_GREEN,
    borderRadius: 0,
  },
  missionReward: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 9,
    color: SLATE2,
    letterSpacing: 1.4,
    marginTop: 12,
    textTransform: 'uppercase',
  },
  rosterWrap: {
    marginTop: 10,
    backgroundColor: INK2,
    borderWidth: 1,
    borderColor: HAIRLINE_STRONG,
    padding: 16,
  },
  rosterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  rosterRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: HAIRLINE,
  },
  rosterLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  rosterAvatar: {
    width: 0,
    height: 0,
    opacity: 0,
  },
  rosterInitials: {
    width: 0,
    height: 0,
    opacity: 0,
  },
  rosterName: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: BONE,
  },
  rosterRole: {
    marginTop: 2,
    fontFamily: 'GeistMono_400Regular',
    fontSize: 9,
    color: SLATE2,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
  },
  rosterSteps: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 11,
    color: SLATE2,
  },
});
