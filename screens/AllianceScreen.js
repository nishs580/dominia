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

function NonMemberContent({
  alliances,
  userId,
  onRefreshAfterJoin,
  navigation,
  playerRow,
  confirmAlliance,
  setConfirmAlliance,
  joinSaving,
  setJoinSaving,
}) {

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

  // Confirm-join view (unchanged behaviour, restyled)
  if (confirmAlliance) {
    return (
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.confirmWrap}>
          <Text style={styles.confirmKicker}>Join alliance</Text>
          <Text style={styles.confirmTitle}>{confirmAlliance.name}</Text>
          <Text style={styles.confirmTag}>[{confirmAlliance.short_name}]</Text>
          <Text style={styles.confirmBody}>
            Your Alliance territories will display in Alliance green. This decision is permanent until you leave the alliance.
          </Text>

          <Pressable
            accessibilityRole="button"
            disabled={joinSaving}
            onPress={handleConfirmJoin}
            style={({ pressed }) => [
              styles.cta,
              joinSaving && styles.ctaDisabled,
              pressed && !joinSaving && { opacity: 0.9 },
            ]}
          >
            {joinSaving ? (
              <ActivityIndicator color={BONE} />
            ) : (
              <>
                <Text style={styles.ctaStep}>Confirm</Text>
                <Text style={styles.ctaAction}>Join {confirmAlliance.name} →</Text>
              </>
            )}
          </Pressable>

          <Pressable
            accessibilityRole="button"
            disabled={joinSaving}
            onPress={() => setConfirmAlliance(null)}
            style={({ pressed }) => [styles.cancelLink, pressed && { opacity: 0.6 }]}
          >
            <Text style={styles.cancelLinkText}>← Back to list</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  // Empty list state
  if (!alliances?.length) {
    return (
      <View style={styles.scroll}>
        <View style={styles.sectionRow}>
          <Text style={styles.sectionLabelText}>Alliances in</Text>
          <Text style={styles.sectionLabelAccent}> Amsterdam</Text>
          <View style={styles.sectionHairline} />
        </View>
        <View style={styles.emptyListWrap}>
          <Text style={styles.emptyListText}>No alliances in your city yet.</Text>
        </View>
        <View style={styles.footerRow}>
          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.navigate('CreateAlliance')}
            style={({ pressed }) => [pressed && { opacity: 0.6 }]}
          >
            <Text style={styles.createLink}>
              Found the first one — <Text style={styles.createLinkStrong}>create alliance →</Text>
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // Default — list view
  return (
    <View style={styles.scroll}>
      <View style={styles.sectionRow}>
        <Text style={styles.sectionLabelText}>Alliances in</Text>
        <Text style={styles.sectionLabelAccent}> Amsterdam</Text>
        <View style={styles.sectionHairline} />
      </View>

      <Text style={styles.directiveText}>Tap to join</Text>

      <ScrollView
        style={styles.allianceListScroll}
        contentContainerStyle={styles.allianceListContent}
        showsVerticalScrollIndicator={true}
      >
        {alliances.map((a, i) => (
          <Pressable
            key={a.id}
            accessibilityRole="button"
            onPress={() => setConfirmAlliance(a)}
            style={({ pressed }) => [
              styles.aRow,
              i === 0 && styles.aRowFirst,
              pressed && styles.aRowPressed,
            ]}
          >
            <View style={styles.aInfo}>
              <Text style={styles.aNameLine}>
                <Text style={styles.aName}>{a.name}</Text>
                <Text style={styles.aTag}>  [{a.short_name}]</Text>
              </Text>
              <Text style={styles.aMeta}>
                {(a.city ?? '—')}
                {a.founder_username ? ` · Founded by ${a.founder_username.toUpperCase()}` : ''}
              </Text>
            </View>
            <Text style={styles.aMembers}>{a.memberCount} / 20</Text>
            <Text style={styles.aChev}>→</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.footerRow}>
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.navigate('CreateAlliance')}
          style={({ pressed }) => [pressed && { opacity: 0.6 }]}
        >
          <Text style={styles.createLink}>
            Or <Text style={styles.createLinkStrong}>create your own alliance →</Text>
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function MemberContent({ myAlliance, playerId, territoryCount }) {
  const navigation = useNavigation();
  const [roster, setRoster] = useState([]);
  const TOP_CONTRIBUTORS = [
    { rank: '1.', name: 'NISH_S', role: 'FOUNDR', streak: 'UNBROKEN 30D', steps: '24,210' },
    { rank: '2.', name: 'RUBIK', role: 'MEMBER', streak: 'RELIABLE 14D', steps: '18,432' },
    { rank: '3.', name: 'MAYA-K', role: 'MEMBER', streak: 'COMMITTED 6D', steps: '12,104' },
  ];

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
        <View style={styles.sectionLabelRow}>
          <Text style={styles.sectionLabelText}>THIS WEEK</Text>
          <Text style={styles.sectionLabelAccent}> · COLLECTIVE MISSION</Text>
          <View style={styles.sectionHairline} />
        </View>
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

        <View style={styles.sectionLabelRow}>
          <Text style={styles.sectionLabelText}>TOP CONTRIBUTORS</Text>
          <Text style={styles.sectionLabelAccent}> · THIS WEEK</Text>
          <View style={styles.sectionHairline} />
        </View>

        {TOP_CONTRIBUTORS.map((c, i) => (
          <React.Fragment key={c.name}>
            <View style={styles.contributorRow}>
              <Text style={styles.contributorRank}>{c.rank}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.contributorName}>{c.name}</Text>
                <Text style={styles.contributorMeta}>
                  {c.role} · {c.streak}
                </Text>
              </View>
              <Text style={styles.contributorSteps}>{c.steps}</Text>
            </View>
            {i < TOP_CONTRIBUTORS.length - 1 && <View style={styles.rowDivider} />}
          </React.Fragment>
        ))}

        <View style={styles.sectionLabelRow}>
          <Text style={styles.sectionLabelText}>ROSTER</Text>
          <Text style={styles.sectionLabelAccent}> · {roster.length} ACTIVE</Text>
          <View style={styles.sectionHairline} />
          <Text style={styles.sectionLabelRight}>RESETS MON 00:00</Text>
        </View>
        {roster.map((m, i) => (
          <RosterRow
            key={m.id}
            initials={m.username ? m.username.slice(0, 2).toUpperCase() : '??'}
            name={m.username ?? '—'}
            role={m.id === myAlliance.founder_id ? 'FOUNDR' : 'MEMBER'}
            steps="—"
            showBorder={i < roster.length - 1}
          />
        ))}

        <Pressable
          style={({ pressed }) => [styles.warRoomBtn, pressed && { opacity: 0.7 }]}
          onPress={() => navigation.navigate('WarRoom')}
        >
          <Text style={styles.warRoomBtnText}>ENTER WAR ROOM →</Text>
        </Pressable>
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
  const [confirmAlliance, setConfirmAlliance] = useState(null);
  const [joinSaving, setJoinSaving] = useState(false);

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
          let alliances = null;
          let listError = null;

          const relRes = await supabase
            .from('alliances')
            .select('id, name, short_name, city, founder_id, founder:founder_id(username)');
          alliances = relRes.data;
          listError = relRes.error;

          // If relation select fails (FK name mismatch), fall back to a batch founders query.
          if (listError) {
            const baseRes = await supabase
              .from('alliances')
              .select('id, name, short_name, city, founder_id');
            alliances = baseRes.data;
            listError = baseRes.error;

            if (!listError && alliances?.length) {
              const founderIds = Array.from(
                new Set((alliances ?? []).map((a) => a.founder_id).filter(Boolean)),
              );
              if (founderIds.length) {
                const foundersRes = await supabase
                  .from('players')
                  .select('id, username')
                  .in('id', founderIds);
                if (!foundersRes.error && foundersRes.data?.length) {
                  const founderById = new Map(foundersRes.data.map((f) => [f.id, f.username]));
                  alliances = (alliances ?? []).map((a) => ({
                    ...a,
                    founder: { username: founderById.get(a.founder_id) ?? null },
                  }));
                }
              }
            }
          }

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
              return {
                ...a,
                memberCount: count ?? 0,
                founder_username: a.founder?.username ?? null,
              };
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
      {isMember && (
        <View style={styles.header}>
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
        </View>
      )}
      {!isMember && !confirmAlliance && (
        <View style={styles.header}>
          <HeaderKicker>ALLIANCE</HeaderKicker>
          <Text style={styles.headerTitle}>NO ALLIANCE</Text>
          <Text style={styles.headerSubtitle}>You are unaffiliated</Text>
        </View>
      )}

      {isMember ? (
        <MemberContent myAlliance={myAlliance} playerId={playerRow?.id} territoryCount={territoryCount} />
      ) : (
        <NonMemberContent
          alliances={allianceList}
          userId={userId}
          onRefreshAfterJoin={() => fetchPlayerAndContext({ silent: true })}
          navigation={navigation}
          playerRow={playerRow}
          confirmAlliance={confirmAlliance}
          setConfirmAlliance={setConfirmAlliance}
          joinSaving={joinSaving}
          setJoinSaving={setJoinSaving}
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
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
  },
  sectionLabelText: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 9,
    letterSpacing: 1.6,
    color: SLATE2,
    textTransform: 'uppercase',
  },
  sectionLabelAccent: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 9,
    letterSpacing: 1.6,
    color: BONE,
    textTransform: 'uppercase',
  },
  sectionHairline: {
    flex: 1,
    height: 1,
    backgroundColor: HAIRLINE_STRONG,
    marginLeft: 8,
  },
  directiveText: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 10,
    letterSpacing: 1.6,
    color: SLATE,
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    marginTop: 6,
    marginBottom: 6,
  },

  allianceListScroll: {
    maxHeight: 320,
    marginHorizontal: 16,
  },
  allianceListContent: {
    paddingBottom: 8,
  },

  aRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: HAIRLINE,
  },
  aRowFirst: {
    borderTopWidth: 1,
    borderTopColor: HAIRLINE,
  },
  aRowPressed: {
    backgroundColor: 'rgba(242,238,230,0.03)',
  },
  aInfo: {
    flex: 1,
  },
  aNameLine: {
    fontFamily: 'Inter_500Medium',
    fontSize: 15,
    color: BONE,
  },
  aName: {
    fontFamily: 'Inter_500Medium',
    fontSize: 15,
    color: BONE,
  },
  aTag: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 13,
    color: SLATE2,
    letterSpacing: 1,
  },
  aMeta: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 9,
    color: SLATE,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  aMembers: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 13,
    color: BONE,
    marginRight: 8,
  },
  aChev: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 13,
    color: SLATE,
  },

  footerRow: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 18,
    borderTopWidth: 1,
    borderTopColor: HAIRLINE,
    marginTop: 4,
  },
  createLink: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 11,
    letterSpacing: 1.6,
    color: SLATE2,
    textTransform: 'uppercase',
  },
  createLinkStrong: {
    fontFamily: 'GeistMono_500Medium',
    color: BONE,
  },

  emptyListWrap: {
    paddingHorizontal: 16,
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyListText: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 11,
    letterSpacing: 1.4,
    color: SLATE,
    textTransform: 'uppercase',
  },

  confirmWrap: {
    paddingTop: (StatusBar.currentHeight ?? 0) + 24,
  },
  confirmKicker: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 10,
    letterSpacing: 1.8,
    color: SLATE2,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  confirmTitle: {
    fontFamily: 'Archivo_900Black',
    fontSize: 32,
    color: BONE,
    textTransform: 'uppercase',
    letterSpacing: -0.3,
    lineHeight: 34,
    marginBottom: 6,
  },
  confirmTag: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 14,
    letterSpacing: 2,
    color: SLATE2,
    textTransform: 'uppercase',
    marginBottom: 24,
  },
  confirmBody: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: SLATE2,
    lineHeight: 21,
    marginBottom: 32,
  },

  cta: {
    backgroundColor: CLAIM,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'flex-start',
  },
  ctaDisabled: {
    opacity: 0.7,
  },
  ctaStep: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 9,
    letterSpacing: 1.6,
    color: BONE,
    opacity: 0.75,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  ctaAction: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 16,
    letterSpacing: 1.6,
    color: BONE,
    textTransform: 'uppercase',
  },

  cancelLink: {
    marginTop: 18,
    alignItems: 'center',
  },
  cancelLinkText: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 11,
    letterSpacing: 1.6,
    color: SLATE,
    textTransform: 'uppercase',
  },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
  },
  sectionLabelText: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 9,
    color: SLATE2,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  sectionLabelAccent: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 9,
    color: BONE,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  sectionHairline: {
    flex: 1,
    height: 1,
    backgroundColor: HAIRLINE_STRONG,
    marginLeft: 8,
  },
  sectionLabelRight: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 9,
    color: SLATE2,
    letterSpacing: 1.4,
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
  contributorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 12,
  },
  contributorRank: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 11,
    color: CLAIM,
    width: 20,
  },
  contributorName: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: BONE,
    textTransform: 'uppercase',
  },
  contributorMeta: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 9,
    color: SLATE2,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: 3,
  },
  contributorSteps: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 13,
    color: BONE,
  },
  rowDivider: {
    height: 1,
    backgroundColor: HAIRLINE,
  },
  rosterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 12,
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
    textTransform: 'uppercase',
  },
  rosterRole: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 9,
    color: CLAIM,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    width: 52,
  },
  rosterSteps: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 13,
    color: BONE,
  },
  warRoomBtn: {
    marginTop: 32,
    borderWidth: 1,
    borderColor: '#D64525',
    borderRadius: 0,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  warRoomBtnText: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 12,
    color: '#D64525',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
});
