// Screen: LeaderboardsScreen — Power, Territory, Battles boards (players + alliances)
// Surface: Ink #0E1014 background. M2 Phase 1: state, strips, 4-state branches, placeholder rows.
// Typography: Geist Mono 500 11px labels, Inter 500 14px names — mirrors ActivityLogScreen patterns.
// Brand rule applied: text-only header with hairline-strong; strips always visible; retry is sole CTA on error.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { getLeaderboard } from '../lib/leaderboardApi';
import { supabase } from '../lib/supabase';

function primaryValueForRow(row, board, subject) {
  if (board === 'power' && subject === 'players') return row.total_power;
  if (board === 'power' && subject === 'alliances') return row.alliance_power;
  if (board === 'territory') return row.territory_count;
  if (board === 'battles') return row.battles;
  return 0;
}

function PlaceholderRow({ row, board, subject }) {
  const primaryValue = primaryValueForRow(row, board, subject) ?? 0;
  const name = subject === 'players' ? row.username : row.alliance_name;

  return (
    <View style={styles.row}>
      <View style={styles.rankCell}>
        <Text style={styles.rankText}>{String(row.rank).padStart(2, '0')}</Text>
      </View>
      <View style={styles.nameCell}>
        <Text style={styles.nameText}>{name}</Text>
      </View>
      <Text style={styles.valueText}>{primaryValue.toLocaleString()}</Text>
    </View>
  );
}

export default function LeaderboardsScreen() {
  const { userId, getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

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
    setError(null);
    const result = await getLeaderboard({
      clerkGetToken: () => getTokenRef.current(),
      board,
      subject,
    });
    if (result.ok) {
      setRows(result.data.rows ?? []);
    } else {
      setError(true);
      setRows([]);
    }
    setLoading(false);
    setRefreshing(false);
  }, [board, subject]);

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
          <Text style={styles.loadingText}>LOADING…</Text>
        </View>
      );
    }

    if (error && rows.length === 0) {
      return (
        <View style={styles.centered}>
          <Text style={styles.errorBody}>Failed to load leaderboard.</Text>
          <Pressable
            accessibilityRole="button"
            onPress={fetchLeaderboard}
            style={({ pressed }) => [styles.retryBtn, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.retryBtnText}>RETRY</Text>
          </Pressable>
        </View>
      );
    }

    if (rows.length === 0 && !error) {
      return (
        <View style={styles.centered}>
          <Text style={styles.emptyLabel}>NO RANKINGS YET</Text>
          <Text style={styles.emptyBody}>Boards open soon.</Text>
        </View>
      );
    }

    return (
      <FlatList
        data={rows}
        keyExtractor={(item) =>
          subject === 'players' ? String(item.player_id) : String(item.alliance_id)
        }
        renderItem={({ item }) => (
          <PlaceholderRow row={item} board={board} subject={subject} />
        )}
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
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.sectionLabel}>LEADERBOARDS</Text>
        <View style={styles.hairlineStrong} />
      </View>

      <View style={styles.boardStrip}>
        {(
          [
            { key: 'power', label: 'POWER' },
            { key: 'territory', label: 'TERRITORY' },
            { key: 'battles', label: 'BATTLES' },
          ]
        ).map(({ key, label }) => {
          const selected = board === key;
          return (
            <Pressable
              key={key}
              accessibilityRole="button"
              onPress={() => setBoard(key)}
              style={({ pressed }) => [styles.tabCell, pressed && { opacity: 0.7 }]}
            >
              <Text style={[styles.tabLabel, selected && styles.tabLabelActive]}>{label}</Text>
              {selected ? <View style={styles.tabMarkBoard} /> : null}
            </Pressable>
          );
        })}
      </View>
      <View style={styles.hairline} />

      <View style={styles.subjectStrip}>
        {(
          [
            { key: 'players', label: 'PLAYERS' },
            { key: 'alliances', label: 'ALLIANCES' },
          ]
        ).map(({ key, label }) => {
          const selected = subject === key;
          return (
            <Pressable
              key={key}
              accessibilityRole="button"
              onPress={() => setSubject(key)}
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
  rankCell: {
    width: 32,
  },
  rankText: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 13,
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
  valueText: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 14,
    color: '#F2EEE6',
  },
});
