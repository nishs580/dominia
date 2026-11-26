// Screen: LeaderboardsScreen — Power, Territory, Battles boards (players + alliances)
// Surface: Ink #101010 background. M2 Phase 1: state, strips, 4-state branches, placeholder rows.
// Typography: Geist Mono 500 11px labels, Instrument Sans 500 14px names — mirrors ActivityLogScreen patterns.
// Brand rule applied: text-only header with hairline-strong; strips always visible; retry is sole CTA on error.
//
// legacy_tabs ON (default): the Power / Territory / Battles board above, unchanged.
// legacy_tabs OFF: the Figma layout (plan U17; G6/G7 parity in plan
// 2026-11-27 U13) — TERRITORIES | DISTANCE tab, city + season label with the
// SOLO / ALLIANCE toggle, numbered top-three podium, list, and a pinned
// "Your position" row from the response's `self`. View logic lives in
// lib/leaderboardView.js.

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
import { getLeaderboard, parseLeaderboard } from '../lib/leaderboardApi';
import { useFlag } from '../lib/flags';
import { useUnits } from '../lib/units';
import {
  SCOPES,
  DEFAULT_BOARD,
  DEFAULT_SCOPE,
  apiParamsFor,
  boardTabs,
  buildLeaderboardView,
  seasonLabel,
} from '../lib/leaderboardView';
import AllianceEmblem from '../components/AllianceEmblem';
import BackTitleHeader from '../components/BackTitleHeader';
import { colors, fonts } from '../lib/theme';
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

function LegacyLeaderboards() {
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
          <ActivityIndicator size="large" color="#6C6C69" />
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
            tintColor="#F5F4EF"
            colors={['#F5F4EF']}
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

// ─── Figma layout (legacy_tabs OFF) ───────────────────────────────────────
// G6 / G7 (plan 2026-11-27 U13): back arrow + LEADERBOARDS, a TERRITORIES |
// DISTANCE segmented tab, "{CITY} · THIS SEASON" beside the SOLO / ALLIANCE
// toggle, numbered podium blocks with a lime #1, "04" rows with the value on
// the right, and the pinned YOUR POSITION row built from `self`.

function tc(t, copy) {
  if (!copy) return '';
  if (copy.key == null) return copy.text ?? '';
  return t(copy.key, { defaultValue: copy.defaultValue, ...(copy.params || {}) });
}

function entryName(t, entry) {
  return entry.name || t('leaderboards.you', { defaultValue: 'You' });
}

function entryLine(t, entry) {
  return [entryName(t, entry), tc(t, entry.tag), tc(t, entry.valueCopy), tc(t, entry.placeCopy)]
    .filter((part) => part)
    .join(' · ');
}

function EntryMark({ entry, scope, size }) {
  if (scope === 'alliance') {
    return <AllianceEmblem emblem={entry.emblem} size={size} />;
  }
  const thumb = avatarThumb(entry.avatarUrl, size);
  const box = { width: size, height: size };
  if (thumb) {
    return <Image source={{ uri: thumb }} style={[figma.avatar, box]} />;
  }
  return (
    <View style={[figma.avatar, figma.avatarPlaceholder, box]}>
      <Text style={figma.avatarInitials}>{avatarInitials(entry.name || '')}</Text>
    </View>
  );
}

// Player entries open the public profile; alliance entries do not navigate.
function EntryPressable({ entry, style, accessibilityLabel, children }) {
  const navigation = useNavigation();
  if (entry.playerId) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={() =>
          navigation.navigate('PublicProfile', {
            playerId: entry.playerId,
            username: entry.name,
            avatarUrl: entry.avatarUrl,
          })
        }
        style={({ pressed }) => [style, pressed && { opacity: 0.6 }]}
      >
        {children}
      </Pressable>
    );
  }
  return (
    <View accessible accessibilityLabel={accessibilityLabel} style={style}>
      {children}
    </View>
  );
}

// "21" in bone + " TERR." / " KM" muted.
function ValueText({ t, parts, style }) {
  if (!parts) return null;
  const unit = tc(t, parts.unit);
  return (
    <Text style={style} numberOfLines={1}>
      <Text style={figma.valueNumber}>{parts.number}</Text>
      {unit ? <Text style={figma.valueUnit}>{` ${unit}`}</Text> : null}
    </Text>
  );
}

const PODIUM_BLOCK = { 1: 126, 2: 94, 3: 70 };

function Podium({ t, entries, scope }) {
  return (
    <View style={figma.podium}>
      {entries.map((entry) => {
        const first = entry.slot === 1;
        return (
          <EntryPressable
            key={entry.key}
            entry={entry}
            accessibilityLabel={entryLine(t, entry)}
            style={figma.podiumCol}
          >
            <View style={[figma.podiumMarkWrap, entry.isSelf && figma.podiumMarkSelf]}>
              <EntryMark entry={entry} scope={scope} size={first ? 52 : 44} />
            </View>
            <Text style={[figma.podiumName, entry.isSelf && figma.selfText]} numberOfLines={1}>
              {entryName(t, entry)}
            </Text>
            <ValueText t={t} parts={entry.valueParts} style={figma.podiumValue} />
            <View
              style={[
                figma.podiumBlock,
                first && figma.podiumBlockFirst,
                { height: PODIUM_BLOCK[entry.slot] || 70 },
              ]}
            >
              <Text style={[figma.podiumNum, first && figma.podiumNumFirst]} maxFontSizeMultiplier={1.1}>
                {entry.slot}
              </Text>
            </View>
          </EntryPressable>
        );
      })}
    </View>
  );
}

function EntryRow({ t, entry, scope, pinned }) {
  const self = entry.isSelf || pinned;
  const name = pinned && entry.youCopy ? tc(t, entry.youCopy) : entryName(t, entry);
  return (
    <EntryPressable
      entry={entry}
      accessibilityLabel={entryLine(t, entry)}
      style={[figma.row, self && figma.rowSelf, pinned && figma.rowPinned]}
    >
      <Text style={[figma.rowRank, self && figma.rowRankSelf]} maxFontSizeMultiplier={1.2}>
        {entry.rankLabel}
      </Text>
      <EntryMark entry={entry} scope={scope} size={36} />
      <Text style={figma.rowName} numberOfLines={2}>{name}</Text>
      <ValueText t={t} parts={entry.valueParts} style={figma.rowValue} />
    </EntryPressable>
  );
}

function FigmaLeaderboards() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { userId, getToken } = useAuth();
  const unit = useUnits();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const fetchSeqRef = useRef(0);

  const [board, setBoard] = useState(DEFAULT_BOARD);
  const [scope, setScope] = useState(DEFAULT_SCOPE);
  const [status, setStatus] = useState('loading');
  const [data, setData] = useState({ rows: [], self: null });
  const [refreshing, setRefreshing] = useState(false);
  const [viewer, setViewer] = useState({ username: null, city: null });

  // The caller's name (pinned "You · name") and home city (season label).
  useEffect(() => {
    if (!userId) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const { data: row } = await supabase
          .from('players')
          .select('username, home_city')
          .eq('clerk_id', userId)
          .maybeSingle();
        if (!cancelled && row) setViewer({ username: row.username ?? null, city: row.home_city ?? null });
      } catch (_) {
        /* the label falls back to THIS SEASON and the pinned row to "You" */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const fetchBoard = useCallback(async () => {
    const seq = ++fetchSeqRef.current;
    const { board: apiBoard, subject } = apiParamsFor(board, scope);
    const result = await getLeaderboard({
      clerkGetToken: () => getTokenRef.current(),
      board: apiBoard,
      subject,
    });
    if (seq !== fetchSeqRef.current) return;
    if (result.ok) {
      setData(parseLeaderboard(result.data));
      setStatus('ready');
    } else {
      setData({ rows: [], self: null });
      setStatus('error');
    }
    setRefreshing(false);
  }, [board, scope]);

  useEffect(() => {
    setStatus('loading');
    setData({ rows: [], self: null });
    fetchBoard();
  }, [fetchBoard]);

  const retry = useCallback(() => {
    setStatus('loading');
    fetchBoard();
  }, [fetchBoard]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchBoard();
  }, [fetchBoard]);

  const view = useMemo(
    () => buildLeaderboardView({
      status, rows: data.rows, self: data.self, board, scope, unit, selfName: viewer.username,
    }),
    [status, data, board, scope, unit, viewer.username],
  );

  const renderBody = () => {
    if (view.state === 'loading') {
      return (
        <View style={styles.centered} accessibilityLiveRegion="polite">
          <ActivityIndicator size="large" color={colors.slate} />
          <Text style={styles.loadingText}>{t('common.loading')}</Text>
        </View>
      );
    }
    if (view.state === 'error') {
      return (
        <View style={styles.centered}>
          <Text style={styles.errorBody}>{t('leaderboards.failedToLoad')}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={retry}
            style={({ pressed }) => [figma.retryBtn, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.retryBtnText}>{t('common.retry')}</Text>
          </Pressable>
        </View>
      );
    }
    if (view.state === 'empty') {
      return (
        <View style={styles.centered}>
          <Text style={styles.emptyLabel}>{t('leaderboards.noRankingsTitle')}</Text>
          <Text style={styles.emptyBody}>{t('leaderboards.noRankingsBody')}</Text>
        </View>
      );
    }
    return (
      <FlatList
        data={view.list}
        keyExtractor={(item) => item.key}
        ListHeaderComponent={<Podium t={t} entries={view.podium} scope={scope} />}
        renderItem={({ item }) => <EntryRow t={t} entry={item} scope={scope} />}
        contentContainerStyle={{ paddingBottom: 16 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.bone}
            colors={[colors.bone]}
          />
        }
      />
    );
  };

  const showPinned = view.pinned != null && (view.state === 'ready' || view.state === 'empty');

  return (
    <View style={styles.screen}>
      <BackTitleHeader
        title={t('leaderboards.figmaTitle', { defaultValue: 'Leaderboards' })}
        onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined}
      />

      <View style={figma.boardTabs} accessibilityRole="tablist">
        {boardTabs(board).map((tab) => (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab.active }}
            onPress={() => {
              if (!tab.active) setBoard(tab.key);
            }}
            style={({ pressed }) => [figma.boardTab, tab.active && figma.boardTabActive, pressed && { opacity: 0.7 }]}
          >
            <Text style={[figma.boardTabText, tab.active && figma.boardTabTextActive]} maxFontSizeMultiplier={1.3}>
              {tc(t, tab.label)}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={figma.seasonRow}>
        <Text style={figma.seasonLabel} numberOfLines={2} maxFontSizeMultiplier={1.3}>
          {tc(t, seasonLabel(viewer.city))}
        </Text>
        <View style={figma.toggle} accessibilityRole="tablist">
          {SCOPES.map((s) => {
            const selected = s.key === scope;
            return (
              <Pressable
                key={s.key}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                hitSlop={{ top: 6, bottom: 6 }}
                onPress={() => {
                  if (s.key !== scope) setScope(s.key);
                }}
                style={({ pressed }) => [figma.toggleCell, selected && figma.toggleCellActive, pressed && { opacity: 0.7 }]}
              >
                <Text style={[figma.toggleText, selected && figma.toggleTextActive]} maxFontSizeMultiplier={1.3}>
                  {t(s.labelKey, { defaultValue: s.labelDefault })}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={{ flex: 1 }}>{renderBody()}</View>

      {showPinned ? (
        <View style={[figma.pinned, { paddingBottom: insets.bottom + 8 }]}>
          <Text style={figma.pinnedLabel}>
            {t('leaderboards.yourPosition', { defaultValue: 'YOUR POSITION' })}
          </Text>
          <EntryRow t={t} entry={view.pinned} scope={scope} pinned />
        </View>
      ) : null}
    </View>
  );
}

export default function LeaderboardsScreen() {
  const legacyTabs = useFlag('legacy_tabs');
  return legacyTabs ? <LegacyLeaderboards /> : <FigmaLeaderboards />;
}

const figma = StyleSheet.create({
  // TERRITORIES | DISTANCE: the active half is raised with a lime underline.
  boardTabs: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 4,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
  },
  boardTab: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  boardTabActive: {
    backgroundColor: colors.raised,
    borderBottomColor: colors.lime,
  },
  boardTabText: {
    fontFamily: fonts.mono,
    fontSize: 13,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.muted,
  },
  boardTabTextActive: {
    fontFamily: fonts.monoMedium,
    color: colors.bone,
  },
  seasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 14,
    gap: 12,
  },
  seasonLabel: {
    flex: 1,
    fontFamily: fonts.mono,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.muted2,
  },
  toggle: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
  },
  toggleCell: {
    minWidth: 72,
    minHeight: 32,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // SOLO / ALLIANCE: the active option is a Signal Lime fill.
  toggleCellActive: {
    backgroundColor: colors.lime,
  },
  toggleText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.muted,
  },
  toggleTextActive: {
    fontFamily: fonts.monoMedium,
    color: colors.onLime,
  },
  podium: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingTop: 20,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  podiumCol: {
    flex: 1,
    alignItems: 'center',
  },
  podiumMarkWrap: {
    padding: 2,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  podiumMarkSelf: {
    borderColor: colors.lime,
  },
  podiumName: {
    marginTop: 8,
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.bone,
  },
  selfText: {
    color: colors.lime,
  },
  podiumValue: {
    marginTop: 2,
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.muted2,
  },
  podiumBlock: {
    alignSelf: 'stretch',
    marginTop: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.raised,
    borderTopWidth: 2,
    borderTopColor: colors.hairlineStrong,
  },
  podiumBlockFirst: {
    backgroundColor: 'rgba(200,255,61,0.16)',
    borderTopColor: colors.lime,
  },
  podiumNum: {
    fontFamily: fonts.monoLight,
    fontSize: 48,
    color: colors.muted2,
  },
  podiumNumFirst: {
    color: colors.lime,
  },
  avatar: {
    backgroundColor: colors.ink2,
    borderWidth: 2,
    borderColor: colors.self,
  },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontFamily: fonts.monoMedium,
    fontSize: 11,
    color: colors.bone2,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 64,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  rowSelf: {
    backgroundColor: colors.limeSoft,
  },
  rowPinned: {
    borderLeftWidth: 3,
    borderLeftColor: colors.lime,
    borderBottomWidth: 0,
  },
  rowRank: {
    width: 44,
    fontFamily: fonts.monoLight,
    fontSize: 22,
    color: colors.muted2,
  },
  rowRankSelf: {
    color: colors.lime,
  },
  rowName: {
    flex: 1,
    paddingHorizontal: 12,
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.bone,
  },
  rowValue: {
    fontFamily: fonts.mono,
    fontSize: 13,
  },
  valueNumber: {
    fontFamily: fonts.mono,
    color: colors.bone,
  },
  valueUnit: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.muted,
  },
  pinned: {
    paddingHorizontal: 16,
    backgroundColor: colors.ink,
    borderTopWidth: 1,
    borderTopColor: colors.hairlineStrong,
  },
  pinnedLabel: {
    paddingTop: 12,
    paddingBottom: 6,
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.lime,
  },
  retryBtn: {
    backgroundColor: colors.claimButton,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 24,
    marginTop: 16,
  },
});

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#101010',
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
    color: '#A3A29F',
    marginTop: 12,
  },
  errorBody: {
    fontFamily: 'InstrumentSans_400Regular',
    fontSize: 14,
    color: '#F5F4EF',
  },
  retryBtn: {
    backgroundColor: '#3155FF',
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
    color: '#F5F4EF',
  },
  emptyLabel: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 11,
    letterSpacing: 1.76,
    textTransform: 'uppercase',
    color: '#A3A29F',
  },
  emptyBody: {
    fontFamily: 'InstrumentSans_400Regular',
    fontSize: 14,
    color: '#E4E3DE',
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
    color: '#A3A29F',
  },
  hairlineStrong: {
    height: 1,
    backgroundColor: 'rgba(245,244,239,0.16)',
    marginTop: 4,
  },
  hairline: {
    height: 1,
    backgroundColor: 'rgba(245,244,239,0.08)',
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
    color: '#A3A29F',
  },
  tabLabelActive: {
    color: '#F5F4EF',
  },
  tabMarkBoard: {
    height: 1,
    width: 32,
    backgroundColor: '#C8FF3D',
    marginTop: 6,
  },
  tabMarkSubject: {
    height: 1,
    width: 28,
    backgroundColor: '#C8FF3D',
    marginTop: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(245,244,239,0.08)',
  },
  rowSelf: {
    backgroundColor: 'rgba(200,255,61,0.14)',
  },
  rankCell: {
    width: 32,
  },
  rankText: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 13,
    color: '#A3A29F',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 4,
    marginLeft: 8,
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: 'rgba(245,244,239,0.16)',
  },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 11,
    letterSpacing: 0.4,
    color: '#A3A29F',
  },
  nameCell: {
    flex: 1,
    paddingLeft: 12,
  },
  nameText: {
    fontFamily: 'InstrumentSans_500Medium',
    fontSize: 14,
    color: '#F5F4EF',
  },
  subtitleText: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: '#A3A29F',
    marginTop: 2,
  },
  valueText: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 14,
    color: '#F5F4EF',
  },
});
