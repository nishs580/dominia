// Screen: LeaderboardsScreen — Power, Territory, Battles boards (players + alliances)
// Surface: Ink #0E1014 background. M2 Phase 1: state, strips, 4-state branches, placeholder rows.
// Typography: Geist Mono 500 11px labels, Inter 500 14px names — mirrors ActivityLogScreen patterns.
// Brand rule applied: text-only header with hairline-strong; strips always visible; retry is sole CTA on error.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@clerk/clerk-expo';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { getLeaderboard } from '../lib/leaderboardApi';
import { useFirstTapTips, rectFromRef } from '../components/FirstTapTips';
import { supabase } from '../lib/supabase';
import { avatarThumb, avatarInitials } from '../lib/avatar';

// Player rows open that player's profile; alliance rows stay non-navigating.
function RowContainer({ subject, row, isSelfRow, children }) {
  const navigation = useNavigation();
  if (subject === 'players' && row.player_id) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={() =>
          navigation.navigate('PublicProfile', {
            playerId: row.player_id,
            username: row.username,
            avatarUrl: row.avatar_url,
          })
        }
        style={({ pressed }) => [styles.row, isSelfRow && styles.rowSelf, pressed && { opacity: 0.6 }]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={[styles.row, isSelfRow && styles.rowSelf]}>{children}</View>;
}

function RowAvatar({ url, name }) {
  const thumb = avatarThumb(url, 28);
  if (thumb) {
    return <Image source={{ uri: thumb }} style={styles.avatar} />;
  }
  return (
    <View style={[styles.avatar, styles.avatarPlaceholder]}>
      <Text style={styles.avatarInitials}>{avatarInitials(name)}</Text>
    </View>
  );
}

function PowerRow({ t, row, subject, isSelfRow }) {
  let title;
  let subtitle;
  let rightValue;
  if (subject === 'players') {
    title = row.username;
    subtitle = t('leaderboards.subPowerPlayer', { lvl: row.level ?? '-', a: row.activity_power.toLocaleString(), t: row.territory_power.toLocaleString(), l: row.legacy_power.toLocaleString() });
    rightValue = row.total_power.toLocaleString();
  } else {
    title = row.alliance_name + (row.alliance_short_name ? ` [${row.alliance_short_name}]` : '');
    subtitle = t('leaderboards.subPowerAlliance', { m: row.member_count, b: row.base_power.toLocaleString(), p: Math.round(row.participation_rate * 100), c: row.coordination_mult.toFixed(2) });
    rightValue = row.alliance_power.toLocaleString();
  }

  return (
    <RowContainer subject={subject} row={row} isSelfRow={isSelfRow}>
      <View style={styles.rankCell}>
        <Text style={styles.rankText}>{String(row.rank).padStart(2, '0')}</Text>
      </View>
      {subject === 'players' ? <RowAvatar url={row.avatar_url} name={row.username} /> : null}
      <View style={styles.nameCell}>
        <Text style={styles.nameText} numberOfLines={1}>{title}</Text>
        <Text style={styles.subtitleText} numberOfLines={1}>{subtitle}</Text>
      </View>
      <Text style={styles.valueText}>{rightValue}</Text>
    </RowContainer>
  );
}

function TerritoryRow({ t, row, subject, isSelfRow }) {
  let title;
  let subtitle;
  let rightValue;
  if (subject === 'players') {
    title = row.username;
    subtitle = t('leaderboards.subTerritoryPlayer', { lvl: row.level ?? '-' });
    rightValue = row.territory_count.toLocaleString();
  } else {
    title = row.alliance_name + (row.alliance_short_name ? ` [${row.alliance_short_name}]` : '');
    subtitle = t('leaderboards.subTerritoryAlliance', { m: row.member_count });
    rightValue = row.territory_count.toLocaleString();
  }

  return (
    <RowContainer subject={subject} row={row} isSelfRow={isSelfRow}>
      <View style={styles.rankCell}>
        <Text style={styles.rankText}>{String(row.rank).padStart(2, '0')}</Text>
      </View>
      {subject === 'players' ? <RowAvatar url={row.avatar_url} name={row.username} /> : null}
      <View style={styles.nameCell}>
        <Text style={styles.nameText} numberOfLines={1}>{title}</Text>
        <Text style={styles.subtitleText} numberOfLines={1}>{subtitle}</Text>
      </View>
      <Text style={styles.valueText}>{rightValue}</Text>
    </RowContainer>
  );
}

function BattlesRow({ t, row, subject, isSelfRow }) {
  let title;
  let subtitle;
  let rightValue;
  if (subject === 'players') {
    title = row.username;
    subtitle = t('leaderboards.subBattlesPlayer', { lvl: row.level ?? '-', w: row.wins.toLocaleString(), l: row.losses.toLocaleString() });
    rightValue = row.battles.toLocaleString();
  } else {
    title = row.alliance_name + (row.alliance_short_name ? ` [${row.alliance_short_name}]` : '');
    subtitle = t('leaderboards.subBattlesAlliance', { m: row.member_count, w: row.wins.toLocaleString(), l: row.losses.toLocaleString() });
    rightValue = row.battles.toLocaleString();
  }

  return (
    <RowContainer subject={subject} row={row} isSelfRow={isSelfRow}>
      <View style={styles.rankCell}>
        <Text style={styles.rankText}>{String(row.rank).padStart(2, '0')}</Text>
      </View>
      {subject === 'players' ? <RowAvatar url={row.avatar_url} name={row.username} /> : null}
      <View style={styles.nameCell}>
        <Text style={styles.nameText} numberOfLines={1}>{title}</Text>
        <Text style={styles.subtitleText} numberOfLines={1}>{subtitle}</Text>
      </View>
      <Text style={styles.valueText}>{rightValue}</Text>
    </RowContainer>
  );
}

export default function LeaderboardsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { userId, getToken } = useAuth();

  // First-tap tips (board strip + players/alliances strip).
  const walkthroughBoardsRef = useRef(null);
  const walkthroughSubjectRef = useRef(null);
  const boardTips = useMemo(
    () => [
      { key: 'boards', text: t('walkthrough.leaderboards.boards'), getRect: () => rectFromRef(walkthroughBoardsRef) },
      { key: 'toggle', text: t('walkthrough.leaderboards.toggle'), getRect: () => rectFromRef(walkthroughSubjectRef) },
    ],
    [t],
  );
  const tips = useFirstTapTips({ screenKey: 'leaderboards', userId, tips: boardTips });
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const fetchSeqRef = useRef(0);

  const [board, setBoard] = useState('power');
  const [subject, setSubject] = useState('players');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [viewerPlayerId, setViewerPlayerId] = useState(null);
  const [viewerAllianceId, setViewerAllianceId] = useState(null);

  const fetchViewer = useCallback(async () => {
    if (!userId) {
      setViewerPlayerId(null);
      setViewerAllianceId(null);
      return;
    }
    try {
      const { data } = await supabase
        .from('players')
        .select('id, alliance_id')
        .eq('clerk_id', userId)
        .maybeSingle();
      setViewerPlayerId(data?.id ?? null);
      setViewerAllianceId(data?.alliance_id ?? null);
    } catch (_) {
      /* silent — viewer ids used in Phase 2 self-row highlight */
    }
  }, [userId]);

  const fetchLeaderboard = useCallback(async () => {
    const seq = ++fetchSeqRef.current;
    setError(null);
    const result = await getLeaderboard({
      clerkGetToken: () => getTokenRef.current(),
      board,
      subject,
    });
    if (seq !== fetchSeqRef.current) {
      return;
    }
    if (result.ok) {
      setRows(result.data.rows ?? []);
    } else {
      setError(true);
      setRows([]);
    }
    setLoading(false);
    setRefreshing(false);
  }, [board, subject]);

  const onSelectBoard = (key) => {
    if (key === board) return;
    setRows([]);
    setError(null);
    setLoading(true);
    setBoard(key);
  };

  const onSelectSubject = (key) => {
    if (key === subject) return;
    setRows([]);
    setError(null);
    setLoading(true);
    setSubject(key);
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  useEffect(() => {
    fetchViewer();
  }, [fetchViewer]);

  useEffect(() => {
    setRows([]);
    setError(null);
    setLoading(true);
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const renderBody = () => {
    if (loading && rows.length === 0) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#5C6068" />
          <Text style={styles.loadingText}>{t('common.loading')}</Text>
        </View>
      );
    }

    if (error && rows.length === 0) {
      return (
        <View style={styles.centered}>
          <Text style={styles.errorBody}>{t('leaderboards.failedToLoad')}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={fetchLeaderboard}
            style={({ pressed }) => [styles.retryBtn, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.retryBtnText}>{t('common.retry')}</Text>
          </Pressable>
        </View>
      );
    }

    if (rows.length === 0 && !error) {
      return (
        <View style={styles.centered}>
          <Text style={styles.emptyLabel}>{t('leaderboards.noRankingsTitle')}</Text>
          <Text style={styles.emptyBody}>{t('leaderboards.noRankingsBody')}</Text>
        </View>
      );
    }

    return (
      <FlatList
        data={rows}
        contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
        keyExtractor={(item) =>
          subject === 'players' ? String(item.player_id) : String(item.alliance_id)
        }
        renderItem={({ item }) => {
          const isSelfRow =
            subject === 'players'
              ? viewerPlayerId !== null && item.player_id === viewerPlayerId
              : viewerAllianceId !== null && item.alliance_id === viewerAllianceId;
          if (board === 'power') {
            return <PowerRow t={t} row={item} subject={subject} isSelfRow={isSelfRow} />;
          }
          if (board === 'territory') {
            return <TerritoryRow t={t} row={item} subject={subject} isSelfRow={isSelfRow} />;
          }
          return <BattlesRow t={t} row={item} subject={subject} isSelfRow={isSelfRow} />;
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#F2EEE6"
            colors={['#F2EEE6']}
          />
        }
      />
    );
  };

  return (
    <View style={styles.screen} onTouchStart={tips.onTouchStart}>
      <View style={styles.header}>
        <Text style={styles.sectionLabel}>{t('leaderboards.title')}</Text>
        <View style={styles.hairlineStrong} />
      </View>

      <View ref={walkthroughBoardsRef} collapsable={false} style={styles.boardStrip}>
        {(
          [
            { key: 'power', label: t('leaderboards.boardPower') },
            { key: 'territory', label: t('leaderboards.boardTerritory') },
            { key: 'battles', label: t('leaderboards.boardBattles') },
          ]
        ).map(({ key, label }) => {
          const selected = board === key;
          return (
            <Pressable
              key={key}
              accessibilityRole="button"
              onPress={() => onSelectBoard(key)}
              style={({ pressed }) => [styles.tabCell, pressed && { opacity: 0.7 }]}
            >
              <Text style={[styles.tabLabel, selected && styles.tabLabelActive]}>{label}</Text>
              {selected ? <View style={styles.tabMarkBoard} /> : null}
            </Pressable>
          );
        })}
      </View>
      <View style={styles.hairline} />

      <View ref={walkthroughSubjectRef} collapsable={false} style={styles.subjectStrip}>
        {(
          [
            { key: 'players', label: t('leaderboards.subjectPlayers') },
            { key: 'alliances', label: t('leaderboards.subjectAlliances') },
          ]
        ).map(({ key, label }) => {
          const selected = subject === key;
          return (
            <Pressable
              key={key}
              accessibilityRole="button"
              onPress={() => onSelectSubject(key)}
              style={({ pressed }) => [styles.tabCell, pressed && { opacity: 0.7 }]}
            >
              <Text style={[styles.tabLabel, selected && styles.tabLabelActive]}>{label}</Text>
              {selected ? <View style={styles.tabMarkSubject} /> : null}
            </Pressable>
          );
        })}
      </View>
      <View style={styles.hairline} />

      {renderBody()}

      {tips.tipElement}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0E1014',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 11,
    letterSpacing: 1.76,
    textTransform: 'uppercase',
    color: '#8B8F98',
    marginTop: 12,
  },
  errorBody: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: '#F2EEE6',
  },
  retryBtn: {
    backgroundColor: '#D64525',
    borderRadius: 0,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 16,
  },
  retryBtnText: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 11,
    letterSpacing: 1.76,
    textTransform: 'uppercase',
    color: '#F2EEE6',
  },
  emptyLabel: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 11,
    letterSpacing: 1.76,
    textTransform: 'uppercase',
    color: '#8B8F98',
  },
  emptyBody: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: '#E8E3D8',
    marginTop: 8,
  },
  header: {
    paddingTop: (StatusBar.currentHeight ?? 0) + 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  sectionLabel: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 11,
    letterSpacing: 1.76,
    textTransform: 'uppercase',
    color: '#8B8F98',
  },
  hairlineStrong: {
    height: 1,
    backgroundColor: 'rgba(242,238,230,0.16)',
    marginTop: 4,
  },
  hairline: {
    height: 1,
    backgroundColor: 'rgba(242,238,230,0.08)',
  },
  boardStrip: {
    flexDirection: 'row',
    height: 44,
  },
  subjectStrip: {
    flexDirection: 'row',
    height: 36,
  },
  tabCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
  },
  tabLabel: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 11,
    letterSpacing: 1.76,
    textTransform: 'uppercase',
    color: '#8B8F98',
  },
  tabLabelActive: {
    color: '#F2EEE6',
  },
  tabMarkBoard: {
    height: 1,
    width: 32,
    backgroundColor: 'rgba(242,238,230,0.16)',
    marginTop: 6,
  },
  tabMarkSubject: {
    height: 1,
    width: 28,
    backgroundColor: 'rgba(242,238,230,0.16)',
    marginTop: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(242,238,230,0.08)',
  },
  rowSelf: {
    backgroundColor: 'rgba(214,69,37,0.14)',
  },
  rankCell: {
    width: 32,
  },
  rankText: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 13,
    color: '#8B8F98',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 4,
    marginLeft: 8,
    backgroundColor: '#1A1D24',
    borderWidth: 1,
    borderColor: 'rgba(242,238,230,0.16)',
  },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 10,
    letterSpacing: 0.4,
    color: '#8B8F98',
  },
  nameCell: {
    flex: 1,
    paddingLeft: 12,
  },
  nameText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: '#F2EEE6',
  },
  subtitleText: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: '#8B8F98',
    marginTop: 2,
  },
  valueText: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 14,
    color: '#F2EEE6',
  },
});
