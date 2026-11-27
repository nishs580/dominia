// Screen: LeaderboardsScreen — Power, Territory, Battles boards (players + alliances)
// Surface: Ink #000000 background. M2 Phase 1: state, strips, 4-state branches, placeholder rows.
// Typography: Geist Mono 500 11px labels, Instrument Sans 500 14px names — mirrors ActivityLogScreen patterns.
// Brand rule applied: text-only header with hairline-strong; strips always visible; retry is sole CTA on error.
//
// legacy_tabs ON (default): the Power / Territory / Battles board above, unchanged.
// legacy_tabs OFF: the Dominia-Temp layout (board 39, plan 2026-11-28 U11) —
// Territories / Distance dropdown, SOLO / ALLIANCE tabs, name search, podium,
// ranked rows and a pinned YOUR POSITION row from the response's `self`.
// View logic lives in lib/leaderboardView.js.

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
import { getLeaderboard, parseLeaderboard, shouldRetryWithoutQuery } from '../lib/leaderboardApi';
import { useFlag } from '../lib/flags';
import { useUnits } from '../lib/units';
import Svg, { Polygon } from 'react-native-svg';
import {
  SCOPES,
  DEFAULT_BOARD,
  DEFAULT_SCOPE,
  apiParamsFor,
  boardTabs,
  buildLeaderboardView,
} from '../lib/leaderboardView';
import AllianceEmblem from '../components/AllianceEmblem';
import {
  ChevronDownGlyph,
  CrownGlyph,
  PeopleGlyph,
  PersonGlyph,
  SearchGlyph,
} from '../components/SocialGlyphs';
import { BackHeader, CutCard, CutField, SlantButton, SlantTabs, SlantTile } from '../components/ui';
import { parallelogramPoints } from '../lib/slantGeometry';
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
          <ActivityIndicator size="large" color="rgba(253,253,253,0.30)" />
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
            tintColor="#FDFDFD"
            colors={['#FDFDFD']}
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

// ─── Dominia-Temp layout (legacy_tabs OFF) ───────────────────────────────
// Board 39 (plan 2026-11-28 U11): "‹ Leaderboards" with a Territories /
// Distance dropdown chip, SOLO / ALLIANCE slanted tabs, a Search chip that
// opens a name field, a three-tile podium (3rd · 1st · 2nd), cut-corner rows
// with gold / bronze / silver rank tiles, and the pinned YOUR POSITION row
// built from `self`.

// Rank tile fills (board 39): 1st gold, 2nd bronze, 3rd silver.
const RANK_TONES = {
  gold: { fill: '#F5B700', text: colors.obsidian, border: 'rgba(245,183,0,0.55)' },
  bronze: { fill: '#D9772B', text: colors.obsidian, border: 'rgba(217,119,43,0.55)' },
  silver: { fill: '#E6E6E6', text: colors.obsidian, border: 'rgba(230,230,230,0.55)' },
  neutral: { fill: colors.raised, text: colors.white, border: colors.surfaceLine },
  self: { fill: colors.actionDeep, text: colors.white, border: colors.action },
};

function tc(t, copy) {
  if (!copy) return '';
  if (copy.key == null) return copy.text ?? '';
  return t(copy.key, { defaultValue: copy.defaultValue, ...(copy.params || {}) });
}

function entryName(t, entry) {
  return entry.name || t('leaderboards.you', { defaultValue: 'You' });
}

function entryLine(t, entry) {
  return [entry.rankLabel, entryName(t, entry), tc(t, entry.kind), tc(t, entry.valueCopy), tc(t, entry.placeCopy)]
    .filter((part) => part)
    .join(' · ');
}

// Avatar or emblem inside a slanted tile: the player's photo when there is
// one, else the person glyph; an alliance's emblem.
function EntryMark({ entry, scope, size, color = colors.white }) {
  if (scope === 'alliance') {
    return <AllianceEmblem emblem={entry.emblem} size={Math.round(size * 0.62)} />;
  }
  const thumb = avatarThumb(entry.avatarUrl, size);
  if (thumb) {
    const s = Math.round(size * 0.7);
    return <Image source={{ uri: thumb }} style={{ width: s, height: s }} />;
  }
  return <PersonGlyph size={Math.round(size * 0.5)} color={color} />;
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
        style={({ pressed }) => [style, pressed && { opacity: 0.7 }]}
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

// A parallelogram with a fill and an outline (podium tiles).
function SlantFrame({ width, height, fill, stroke, children }) {
  return (
    <View style={{ width, height, alignItems: 'center', justifyContent: 'center' }}>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
        <Polygon points={parallelogramPoints(width, height, 14, 1)} fill={fill} stroke={stroke} strokeWidth={2} />
      </Svg>
      {children}
    </View>
  );
}

function PodiumSlot({ t, entry, scope }) {
  const first = entry.slot === 1;
  const tone = RANK_TONES[entry.tone] || RANK_TONES.neutral;
  const w = first ? 64 : 48;
  const h = first ? 72 : 54;
  return (
    <EntryPressable entry={entry} accessibilityLabel={entryLine(t, entry)} style={figma.podiumCol}>
      <View style={figma.crownSlot}>{first ? <CrownGlyph size={18} color={RANK_TONES.gold.fill} /> : null}</View>
      <View>
        <SlantFrame
          width={w}
          height={h}
          fill={first ? colors.action : colors.raised}
          stroke={first ? RANK_TONES.gold.fill : tone.fill}
        >
          <EntryMark entry={entry} scope={scope} size={first ? 44 : 34} />
        </SlantFrame>
        <View style={[figma.podiumBadge, { backgroundColor: tone.fill }]}>
          <Text style={[figma.podiumBadgeText, { color: tone.text }]} maxFontSizeMultiplier={1.1}>
            {entry.slot}
          </Text>
        </View>
      </View>
      <Text style={[figma.podiumName, first && figma.podiumNameFirst]} numberOfLines={1} maxFontSizeMultiplier={1.3}>
        {entryName(t, entry)}
      </Text>
      <Text style={figma.podiumKind} numberOfLines={1} maxFontSizeMultiplier={1.3}>
        {tc(t, entry.kind)}
      </Text>
    </EntryPressable>
  );
}

function Podium({ t, entries, scope }) {
  if (!entries.length) return null;
  return (
    <View style={figma.podium}>
      {entries.map((entry) => (
        <PodiumSlot key={entry.key} t={t} entry={entry} scope={scope} />
      ))}
    </View>
  );
}

function EntryRow({ t, entry, scope }) {
  const tone = RANK_TONES[entry.isSelf && entry.key === 'self' ? 'self' : entry.tone] || RANK_TONES.neutral;
  return (
    <EntryPressable entry={entry} accessibilityLabel={entryLine(t, entry)} style={figma.rowWrap}>
      <CutCard
        padding={0}
        stroke={tone.border}
        from={tone === RANK_TONES.self ? 'rgba(7,49,209,0.35)' : undefined}
        style={figma.rowCard}
      >
        <View style={[figma.rankTile, { backgroundColor: tone.fill }]}>
          <Text style={[figma.rankText, { color: tone.text }]} numberOfLines={1} maxFontSizeMultiplier={1.2}>
            {entry.rankLabel}
          </Text>
        </View>
        <SlantTile size={30} square tone="raised" style={figma.rowMark}>
          <EntryMark entry={entry} scope={scope} size={30} />
        </SlantTile>
        <View style={figma.rowText}>
          <Text style={figma.rowName} numberOfLines={1} maxFontSizeMultiplier={1.3}>{entryName(t, entry)}</Text>
          <Text style={figma.rowSub} numberOfLines={1} maxFontSizeMultiplier={1.3}>{tc(t, entry.kind)}</Text>
        </View>
        <View style={figma.rowRight}>
          <Text style={figma.rowValue} numberOfLines={1} maxFontSizeMultiplier={1.3}>{tc(t, entry.valueCopy)}</Text>
          <Text style={figma.rowSub} numberOfLines={1} maxFontSizeMultiplier={1.3}>{tc(t, entry.placeCopy)}</Text>
        </View>
      </CutCard>
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
  const [selfName, setSelfName] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');

  // The caller's name: the pinned solo row's fallback when `self` has none.
  useEffect(() => {
    if (!userId) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const { data: row } = await supabase
          .from('players')
          .select('username')
          .eq('clerk_id', userId)
          .maybeSingle();
        if (!cancelled && row) setSelfName(row.username ?? null);
      } catch (_) {
        /* the pinned row falls back to "You" */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Search (plan U13): the trimmed query is debounced 300ms and sent as `q`,
  // so the server filters the full ranking and keeps true ranks. The view
  // still filters rows by name, which covers a backend that ignores `q`; a
  // 400 (old backend rejecting the param) retries once without it.
  const [searchQ, setSearchQ] = useState('');
  useEffect(() => {
    const next = query.trim();
    const id = setTimeout(() => setSearchQ(next), 300);
    return () => clearTimeout(id);
  }, [query]);

  const fetchBoard = useCallback(async () => {
    const seq = ++fetchSeqRef.current;
    const { board: apiBoard, subject } = apiParamsFor(board, scope);
    const clerkGetToken = () => getTokenRef.current();
    let result = await getLeaderboard({ clerkGetToken, board: apiBoard, subject, q: searchQ });
    // The q the returned rows were filtered by ('' after the no-q retry).
    let rowsQ = searchQ;
    if (shouldRetryWithoutQuery(result, searchQ)) {
      result = await getLeaderboard({ clerkGetToken, board: apiBoard, subject });
      rowsQ = '';
    }
    if (seq !== fetchSeqRef.current) return;
    if (result.ok) {
      setData({ ...parseLeaderboard(result.data), q: rowsQ });
      setStatus('ready');
    } else {
      setData({ rows: [], self: null });
      setStatus('error');
    }
    setRefreshing(false);
  }, [board, scope, searchQ]);

  // A board or scope switch clears the list; a search change keeps the
  // current rows on screen while the filtered set loads.
  useEffect(() => {
    setStatus('loading');
    setData({ rows: [], self: null });
  }, [board, scope]);

  useEffect(() => {
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

  // Closing search drops the server-filtered rows at once and shows loading
  // until the unfiltered board arrives, so they never fill the podium.
  const closeSearch = useCallback(() => {
    setQuery('');
    setSearchOpen(false);
    if (searchQ) {
      setSearchQ('');
      setStatus('loading');
      setData({ rows: [], self: null });
    }
  }, [searchQ]);

  // While the rows on screen still belong to a non-empty q (e.g. the field
  // was just cleared and the debounce has not fired), stay in search mode.
  const viewQuery = query.trim() !== '' ? query : (data.q || '');
  const view = useMemo(
    () => buildLeaderboardView({
      status, rows: data.rows, self: data.self, board, scope, unit, selfName, query: viewQuery,
    }),
    [status, data, board, scope, unit, selfName, viewQuery],
  );

  const boardOptions = boardTabs(board);
  const activeBoardLabel = tc(t, boardOptions.find((b) => b.active)?.label);

  const scopeTabs = SCOPES.map((s) => ({
    key: s.key,
    label: t(s.labelKey, { defaultValue: s.labelDefault }),
    icon: ({ color }) => (s.key === 'alliance' ? <PeopleGlyph size={16} color={color} /> : <PersonGlyph size={16} color={color} />),
  }));

  const renderBody = () => {
    if (view.state === 'loading') {
      return (
        <View style={styles.centered} accessibilityLiveRegion="polite">
          <ActivityIndicator size="large" color={colors.muted} />
          <Text style={styles.loadingText}>{t('common.loading')}</Text>
        </View>
      );
    }
    if (view.state === 'error') {
      return (
        <View style={[styles.centered, figma.centeredPad]}>
          <Text style={styles.errorBody}>{t('leaderboards.failedToLoad')}</Text>
          <SlantButton label={t('common.retry')} onPress={retry} size="md" style={figma.retryBtn} />
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
    if (view.state === 'noResults') {
      return (
        <View style={styles.centered} accessibilityLiveRegion="polite">
          <Text style={styles.emptyBody}>{t('leaderboards.noResults', { defaultValue: 'No results' })}</Text>
        </View>
      );
    }
    return (
      <FlatList
        data={view.list}
        keyExtractor={(item) => item.key}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={<Podium t={t} entries={view.podium} scope={scope} />}
        renderItem={({ item }) => <EntryRow t={t} entry={item} scope={scope} />}
        contentContainerStyle={figma.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.white}
            colors={[colors.white]}
          />
        }
      />
    );
  };

  const showPinned = view.pinned != null && view.state !== 'loading' && view.state !== 'error';

  return (
    <View style={styles.screen}>
      <BackHeader
        label={t('leaderboards.figmaTitle', { defaultValue: 'Leaderboards' })}
        accessibilityLabel={t('common.back', { defaultValue: 'Back' })}
        onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined}
        right={(
          <SlantTile
            size={32}
            tone="raised"
            onPress={() => setMenuOpen((v) => !v)}
            accessibilityLabel={t('leaderboards.boardPicker', { defaultValue: 'Board: {{board}}', board: activeBoardLabel })}
            style={figma.dropChip}
          >
            <Text style={figma.chipText} maxFontSizeMultiplier={1.3}>{activeBoardLabel}</Text>
            <ChevronDownGlyph size={14} />
          </SlantTile>
        )}
      />

      {menuOpen ? (
        <>
          <Pressable
            style={[StyleSheet.absoluteFill, { zIndex: 3 }]}
            onPress={() => setMenuOpen(false)}
            accessibilityRole="button"
            accessibilityLabel={t('common.close', { defaultValue: 'Close' })}
          />
          <View style={[figma.menu, { top: insets.top + 52 }]} accessibilityRole="menu">
            {boardOptions.map((opt) => (
              <Pressable
                key={opt.key}
                accessibilityRole="menuitem"
                accessibilityState={{ selected: opt.active }}
                onPress={() => {
                  setMenuOpen(false);
                  if (!opt.active) setBoard(opt.key);
                }}
                style={({ pressed }) => [figma.menuItem, opt.active && figma.menuItemActive, pressed && { opacity: 0.7 }]}
              >
                <Text style={[figma.menuText, opt.active && figma.menuTextActive]} maxFontSizeMultiplier={1.3}>
                  {tc(t, opt.label)}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}

      <SlantTabs tabs={scopeTabs} value={scope} onChange={setScope} height={40} style={figma.tabs} />

      <View style={figma.searchRow}>
        {searchOpen ? (
          <CutField
            value={query}
            onChangeText={setQuery}
            placeholder={t('leaderboards.search', { defaultValue: 'Search' })}
            accessibilityLabel={t('leaderboards.search', { defaultValue: 'Search' })}
            autoFocus
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            keyboardAppearance="dark"
            containerStyle={figma.searchField}
            rightAccessory={(
              <Pressable
                onPress={closeSearch}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={t('leaderboards.closeSearch', { defaultValue: 'Close search' })}
              >
                <Text style={figma.searchClose}>✕</Text>
              </Pressable>
            )}
          />
        ) : (
          <SlantTile
            size={30}
            tone="raised"
            onPress={() => setSearchOpen(true)}
            accessibilityLabel={t('leaderboards.search', { defaultValue: 'Search' })}
            style={figma.searchChip}
          >
            <SearchGlyph size={12} />
            <Text style={figma.chipText} maxFontSizeMultiplier={1.3}>
              {t('leaderboards.search', { defaultValue: 'Search' })}
            </Text>
          </SlantTile>
        )}
      </View>

      <View style={{ flex: 1 }}>{renderBody()}</View>

      {showPinned ? (
        <View style={[figma.pinned, { paddingBottom: insets.bottom + 8 }]}>
          <Text style={figma.pinnedLabel} maxFontSizeMultiplier={1.3}>
            {t('leaderboards.yourPosition', { defaultValue: 'YOUR POSITION' })}
          </Text>
          <EntryRow t={t} entry={view.pinned} scope={scope} />
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
  dropChip: {
    gap: 6,
  },
  chipText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.white,
  },
  menu: {
    position: 'absolute',
    right: 16,
    zIndex: 4,
    minWidth: 150,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceLine,
  },
  menuItem: {
    minHeight: 44,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  menuItemActive: {
    backgroundColor: colors.actionDeep,
  },
  menuText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.muted2,
  },
  menuTextActive: {
    color: colors.white,
  },
  tabs: {
    marginHorizontal: 16,
    marginTop: 4,
  },
  searchRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginHorizontal: 16,
    marginTop: 10,
  },
  searchChip: {
    gap: 6,
  },
  searchField: {
    flex: 1,
  },
  searchClose: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.muted2,
    paddingHorizontal: 4,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  podium: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingTop: 8,
    paddingBottom: 16,
    gap: 12,
  },
  podiumCol: {
    flex: 1,
    maxWidth: 120,
    alignItems: 'center',
  },
  crownSlot: {
    height: 22,
    justifyContent: 'flex-end',
    marginBottom: 2,
  },
  podiumBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  podiumBadgeText: {
    fontFamily: fonts.mono,
    fontSize: 11,
  },
  podiumName: {
    marginTop: 8,
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.white,
  },
  podiumNameFirst: {
    fontSize: 15,
  },
  podiumKind: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.muted2,
  },
  rowWrap: {
    marginBottom: 8,
  },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    paddingVertical: 8,
    paddingLeft: 10,
    paddingRight: 14,
  },
  rankTile: {
    minWidth: 24,
    height: 24,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    fontFamily: fonts.mono,
    fontSize: 12,
  },
  rowMark: {
    marginLeft: 10,
  },
  rowText: {
    flex: 1,
    paddingHorizontal: 10,
  },
  rowName: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.white,
  },
  rowSub: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.muted2,
    textAlign: 'left',
  },
  rowRight: {
    alignItems: 'flex-end',
  },
  rowValue: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.white,
  },
  pinned: {
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: colors.obsidian,
  },
  pinnedLabel: {
    paddingBottom: 8,
    textAlign: 'center',
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.white,
  },
  centeredPad: {
    paddingHorizontal: 24,
  },
  retryBtn: {
    marginTop: 16,
    alignSelf: 'center',
  },
});

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#000000',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontFamily: 'IBMPlexSans_600SemiBold',
    fontSize: 11,
    letterSpacing: 1.76,
    textTransform: 'uppercase',
    color: 'rgba(253,253,253,0.62)',
    marginTop: 12,
  },
  errorBody: {
    fontFamily: 'IBMPlexSans_500Medium',
    fontSize: 14,
    color: '#FDFDFD',
  },
  retryBtn: {
    backgroundColor: colors.action,
    borderRadius: 0,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 16,
  },
  retryBtnText: {
    fontFamily: 'IBMPlexSans_600SemiBold',
    fontSize: 11,
    letterSpacing: 1.76,
    textTransform: 'uppercase',
    color: '#FDFDFD',
  },
  emptyLabel: {
    fontFamily: 'IBMPlexSans_600SemiBold',
    fontSize: 11,
    letterSpacing: 1.76,
    textTransform: 'uppercase',
    color: 'rgba(253,253,253,0.62)',
  },
  emptyBody: {
    fontFamily: 'IBMPlexSans_500Medium',
    fontSize: 14,
    color: 'rgba(253,253,253,0.85)',
    marginTop: 8,
  },
  header: {
    paddingTop: (StatusBar.currentHeight ?? 0) + 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  sectionLabel: {
    fontFamily: 'IBMPlexSans_600SemiBold',
    fontSize: 11,
    letterSpacing: 1.76,
    textTransform: 'uppercase',
    color: 'rgba(253,253,253,0.62)',
  },
  hairlineStrong: {
    height: 1,
    backgroundColor: 'rgba(253,253,253,0.16)',
    marginTop: 4,
  },
  hairline: {
    height: 1,
    backgroundColor: 'rgba(253,253,253,0.08)',
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
    fontFamily: 'IBMPlexSans_600SemiBold',
    fontSize: 11,
    letterSpacing: 1.76,
    textTransform: 'uppercase',
    color: 'rgba(253,253,253,0.62)',
  },
  tabLabelActive: {
    color: '#FDFDFD',
  },
  tabMarkBoard: {
    height: 1,
    width: 32,
    backgroundColor: '#84FF44',
    marginTop: 6,
  },
  tabMarkSubject: {
    height: 1,
    width: 28,
    backgroundColor: '#84FF44',
    marginTop: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(253,253,253,0.08)',
  },
  rowSelf: {
    backgroundColor: 'rgba(132,255,68,0.14)',
  },
  rankCell: {
    width: 32,
  },
  rankText: {
    fontFamily: 'IBMPlexSans_600SemiBold',
    fontSize: 13,
    color: 'rgba(253,253,253,0.62)',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 4,
    marginLeft: 8,
    backgroundColor: '#0E0E10',
    borderWidth: 1,
    borderColor: 'rgba(253,253,253,0.16)',
  },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontFamily: 'IBMPlexSans_600SemiBold',
    fontSize: 11,
    letterSpacing: 0.4,
    color: 'rgba(253,253,253,0.62)',
  },
  nameCell: {
    flex: 1,
    paddingLeft: 12,
  },
  nameText: {
    fontFamily: 'IBMPlexSans_600SemiBold',
    fontSize: 14,
    color: '#FDFDFD',
  },
  subtitleText: {
    fontFamily: 'IBMPlexSans_700Bold',
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: 'rgba(253,253,253,0.62)',
    marginTop: 2,
  },
  valueText: {
    fontFamily: 'IBMPlexSans_600SemiBold',
    fontSize: 14,
    color: '#FDFDFD',
  },
});
