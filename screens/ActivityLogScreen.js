// Component: ActivityLogScreen — unified activity feed
// Surface: Ink #101010 background, rows transparent on Ink, 1px hairline-standard rgba(245,244,239,0.08) divider between rows
// Typography: section label Geist Mono 500 11px, body Instrument Sans 400 14px Bone, timestamps Geist Mono 400 9px Slate-2
// Territory colors: delegated to ActivityLogEvent row accent bars (Claim, Alliance, Enemy, Slate)
// Brand rule applied: text-only header with hairline-strong, retry button is the single Claim CTA on the screen, end-of-list signaled by hairline + Geist Mono label (grids are visible — brand rule).

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  SectionList,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@clerk/clerk-expo';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import ActivityLogEvent, { HistoryRow } from '../components/ActivityLogEvent';
import BackTitleHeader from '../components/BackTitleHeader';
import { getActivityLog, markActivityLogRead } from '../lib/activityLogApi';
import { buildHistorySections } from '../lib/activityHistory';
import { useFlag } from '../lib/flags';
import { colors, fonts } from '../lib/theme';
import { useFirstTapTips, rectFromRef } from '../components/FirstTapTips';

export default function ActivityLogScreen() {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { userId, getToken } = useAuth();
  // legacy_tabs off: Figma G8 History — back arrow + HISTORY title, rows
  // grouped TODAY / YESTERDAY / date, Final event labels (plan 2026-11-27 U13).
  const figma = !useFlag('legacy_tabs');

  // First-tap tip anywhere on the screen (header + feed are one surface).
  const walkthroughRootRef = useRef(null);
  const logTips = useMemo(
    () => [
      { key: 'feed', text: t('walkthrough.activityLog.feed'), getRect: () => rectFromRef(walkthroughRootRef) },
    ],
    [t],
  );
  const tips = useFirstTapTips({ screenKey: 'activityLog', userId, tips: logTips });
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const [events, setEvents] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [endReached, setEndReached] = useState(false);

  const fetchFirstPage = useCallback(async () => {
    setError(null);
    const result = await getActivityLog({
      clerkGetToken: () => getTokenRef.current(),
    });
    if (result.ok) {
      setEvents(result.data.events);
      setNextCursor(result.data.nextCursor);
      setEndReached(result.data.nextCursor === null);
    } else {
      setError(result.error);
    }
    setInitialLoading(false);
    setRefreshing(false);
  }, []);

  const fetchNextPage = useCallback(async () => {
    if (loadingMore || endReached || nextCursor == null) return;
    setLoadingMore(true);
    const result = await getActivityLog({
      clerkGetToken: () => getTokenRef.current(),
      cursor: nextCursor,
    });
    if (result.ok) {
      setEvents((prev) => [...prev, ...result.data.events]);
      setNextCursor(result.data.nextCursor);
      setEndReached(result.data.nextCursor === null);
    }
    setLoadingMore(false);
  }, [loadingMore, endReached, nextCursor]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setNextCursor(null);
    setEndReached(false);
    fetchFirstPage();
  }, [fetchFirstPage]);

  useEffect(() => {
    fetchFirstPage();
    markActivityLogRead({ clerkGetToken: () => getTokenRef.current() }).catch(() => {});
  }, [fetchFirstPage]);

  const renderFooter = () => {
    if (loadingMore) {
      return <ActivityIndicator color="#6C6C69" style={{ paddingVertical: 16 }} />;
    }
    if (endReached && events.length > 0) {
      return (
        <View>
          <View style={styles.endDivider} />
          <Text style={styles.endLabel}>{t('activityLog.endOfLog')}</Text>
        </View>
      );
    }
    return null;
  };

  const sections = useMemo(
    () => (figma ? buildHistorySections(events, { now: new Date(), locale: i18n.language }) : []),
    [figma, events, i18n.language],
  );

  // Figma mode keeps its header on every state so the back arrow is always there.
  const wrapFigma = (body) => (
    <View style={styles.screen}>
      <BackTitleHeader
        title={t('activityLog.historyTitle', { defaultValue: 'History' })}
        onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined}
      />
      <View style={[styles.figmaBody, styles.centered]}>{body}</View>
    </View>
  );

  if (initialLoading) {
    if (figma) {
      return wrapFigma(
        <>
          <ActivityIndicator size="large" color="#6C6C69" />
          <Text style={styles.loadingText}>{t('common.loading')}</Text>
        </>,
      );
    }
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator size="large" color="#6C6C69" />
        <Text style={styles.loadingText}>{t('common.loading')}</Text>
      </View>
    );
  }

  if (error && events.length === 0) {
    if (figma) {
      return wrapFigma(
        <>
          <Text style={styles.errorBody}>{t('activityLog.failedToLoad')}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={fetchFirstPage}
            style={({ pressed }) => [styles.retryBtn, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.retryBtnText}>{t('common.retry')}</Text>
          </Pressable>
        </>,
      );
    }
    return (
      <View style={[styles.screen, styles.centered]}>
        <Text style={styles.errorBody}>{t('activityLog.failedToLoad')}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={fetchFirstPage}
          style={({ pressed }) => [styles.retryBtn, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.retryBtnText}>{t('common.retry')}</Text>
        </Pressable>
      </View>
    );
  }

  // In Figma mode a page of only hidden rows (streaks, levels) still reads as
  // empty; keep paging in the list below once anything is visible.
  const figmaEmpty = figma && sections.length === 0 && endReached;
  if ((events.length === 0 && !error && !initialLoading) || figmaEmpty) {
    if (figma) {
      return wrapFigma(
        <>
          <Text style={styles.emptyLabel}>{t('activityLog.emptyTitle')}</Text>
          <Text style={styles.emptyBody}>{t('activityLog.emptyBody')}</Text>
        </>,
      );
    }
    return (
      <View style={[styles.screen, styles.centered]}>
        <Text style={styles.emptyLabel}>{t('activityLog.emptyTitle')}</Text>
        <Text style={styles.emptyBody}>{t('activityLog.emptyBody')}</Text>
      </View>
    );
  }

  if (figma) {
    return (
      <View ref={walkthroughRootRef} collapsable={false} style={styles.screen} onTouchStart={tips.onTouchStart}>
        <BackTitleHeader
          title={t('activityLog.historyTitle', { defaultValue: 'History' })}
          onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined}
        />
        <SectionList
          sections={sections}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
          keyExtractor={(item) => item.id}
          renderSectionHeader={({ section }) => (
            <Text style={styles.groupHeader} accessibilityRole="header">
              {section.title.key
                ? t(section.title.key, { defaultValue: section.title.defaultValue })
                : section.title.text}
            </Text>
          )}
          renderItem={({ item }) => <HistoryRow item={item} />}
          onEndReached={fetchNextPage}
          onEndReachedThreshold={0.5}
          ListFooterComponent={loadingMore ? renderFooter : null}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#F5F4EF"
              colors={['#F5F4EF']}
            />
          }
        />

        {tips.tipElement}
      </View>
    );
  }

  return (
    <View ref={walkthroughRootRef} collapsable={false} style={styles.screen} onTouchStart={tips.onTouchStart}>
      <View style={styles.header}>
        <Text style={styles.sectionLabel}>{t('activityLog.title')}</Text>
        <View style={styles.hairlineStrong} />
      </View>
      <FlatList
        data={events}
        contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => <ActivityLogEvent event={item} />}
        onEndReached={fetchNextPage}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#F5F4EF"
            colors={['#F5F4EF']}
          />
        }
      />

      {tips.tipElement}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#101010',
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  figmaBody: {
    flex: 1,
  },
  groupHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 4,
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.muted2,
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
  endDivider: {
    height: 1,
    backgroundColor: 'rgba(245,244,239,0.16)',
    marginHorizontal: 16,
  },
  endLabel: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 11,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: '#A3A29F',
    textAlign: 'center',
    paddingVertical: 16,
  },
});
