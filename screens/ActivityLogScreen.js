// Component: ActivityLogScreen — unified activity feed
// Surface: Ink #0E1014 background, rows transparent on Ink, 1px hairline-standard rgba(242,238,230,0.08) divider between rows
// Typography: section label Geist Mono 500 11px, body Inter 400 14px Bone, timestamps Geist Mono 400 9px Slate-2
// Territory colors: delegated to ActivityLogEvent row accent bars (Claim, Alliance, Enemy, Slate)
// Brand rule applied: text-only header with hairline-strong, retry button is the single Claim CTA on the screen, end-of-list signaled by hairline + Geist Mono label (grids are visible — brand rule).

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { useTranslation } from 'react-i18next';
import ActivityLogEvent from '../components/ActivityLogEvent';
import { getActivityLog, markActivityLogRead } from '../lib/activityLogApi';
import WalkthroughOverlay, { rectFromRef } from '../components/WalkthroughOverlay';

export default function ActivityLogScreen() {
  const { t } = useTranslation();
  const { userId, getToken } = useAuth();

  // First-view walkthrough — single step over the header.
  const walkthroughHeaderRef = useRef(null);
  const walkthroughSteps = useMemo(
    () => [
      { key: 'feed', text: t('walkthrough.activityLog.feed'), getRect: () => rectFromRef(walkthroughHeaderRef) },
    ],
    [t],
  );
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
      return <ActivityIndicator color="#5C6068" style={{ paddingVertical: 16 }} />;
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

  if (initialLoading) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator size="large" color="#5C6068" />
        <Text style={styles.loadingText}>{t('common.loading')}</Text>
      </View>
    );
  }

  if (error && events.length === 0) {
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

  if (events.length === 0 && !error && !initialLoading) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Text style={styles.emptyLabel}>{t('activityLog.emptyTitle')}</Text>
        <Text style={styles.emptyBody}>{t('activityLog.emptyBody')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View ref={walkthroughHeaderRef} collapsable={false} style={styles.header}>
        <Text style={styles.sectionLabel}>{t('activityLog.title')}</Text>
        <View style={styles.hairlineStrong} />
      </View>
      <FlatList
        data={events}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => <ActivityLogEvent event={item} />}
        onEndReached={fetchNextPage}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#F2EEE6"
            colors={['#F2EEE6']}
          />
        }
      />

      <WalkthroughOverlay screenKey="activityLog" userId={userId} steps={walkthroughSteps} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0E1014',
  },
  centered: {
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
  endDivider: {
    height: 1,
    backgroundColor: 'rgba(242,238,230,0.16)',
    marginHorizontal: 16,
  },
  endLabel: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 10,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: '#8B8F98',
    textAlign: 'center',
    paddingVertical: 16,
  },
});
