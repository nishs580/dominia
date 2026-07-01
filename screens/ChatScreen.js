// Screen: ChatScreen — City + Alliance chat (M2: composer + Ably + push deep link + error banner)
// Surface: Ink #0E1014 background, rows transparent, 1px hairline-standard rgba(242,238,230,0.08) divider
// Typography: section label Geist Mono 500 11px, body Inter 400 14px Bone, timestamps Geist Mono 400 9px Slate-2, error banner Inter 400 13px on Claim/red or amber surface
// Territory colors: delegated to none — chat is a neutral surface
// Brand rule applied: Send button is the single Claim CTA on the screen. Inverted FlatList for chat-app convention (newest at bottom). KeyboardAvoidingView wraps composer with platform-appropriate behavior.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import {
  getMessages,
  getRooms,
  patchReadState,
  postMessage,
} from '../lib/chatApi';
import {
  connectChatRealtime,
  disconnectChatRealtime,
  subscribeToChannel,
} from '../lib/chatRealtime';
import { timeAgo } from '../lib/timeAgo';
import { avatarThumb, avatarInitials } from '../lib/avatar';

const MAX_CONTENT_LENGTH = 500;
const BANNER_AUTO_DISMISS_MS = 5000;

function genClientTempId() {
  return (
    'tmp-' +
    Date.now().toString(36) +
    '-' +
    Math.random().toString(36).slice(2, 10)
  );
}

export default function ChatScreen() {
  const { t } = useTranslation();
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const navigation = useNavigation();
  const route = useRoute();
  const initialTab = route?.params?.initialTab === 'alliance' ? 'alliance' : 'city';

  const [rooms, setRooms] = useState([]);
  const [roomsLoaded, setRoomsLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState(initialTab);
  const [messagesByRoom, setMessagesByRoom] = useState({});
  const [nextCursorByRoom, setNextCursorByRoom] = useState({});
  const [endReachedByRoom, setEndReachedByRoom] = useState({});
  const [loadingFirstPageByRoom, setLoadingFirstPageByRoom] = useState({});
  const [loadingMoreByRoom, setLoadingMoreByRoom] = useState({});
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Composer state
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [banner, setBanner] = useState(null); // { kind: 'muted'|'rate_limited'|'filtered'|'error', text }
  const bannerTimerRef = useRef(null);

  const cityRoom = useMemo(
    () => rooms.find((r) => r.room_type === 'city') ?? null,
    [rooms],
  );
  const allianceRoom = useMemo(
    () => rooms.find((r) => r.room_type === 'alliance') ?? null,
    [rooms],
  );
  const activeRoom = activeTab === 'city' ? cityRoom : allianceRoom;

  const lastObservedByRoom = useRef({});

  const showBanner = useCallback((kind, text) => {
    setBanner({ kind, text });
    if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    bannerTimerRef.current = setTimeout(() => setBanner(null), BANNER_AUTO_DISMISS_MS);
  }, []);

  const clearBanner = useCallback(() => {
    if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    setBanner(null);
  }, []);

  const fetchRooms = useCallback(async () => {
    const result = await getRooms({
      clerkGetToken: () => getTokenRef.current(),
    });
    if (result.ok) {
      setRooms(result.data.rooms || []);
      setError(null);
    } else {
      setError(result.code || 'rooms_load_failed');
    }
    setRoomsLoaded(true);
  }, []);

  const fetchFirstPageForRoom = useCallback(async (roomId) => {
    setLoadingFirstPageByRoom((prev) => ({ ...prev, [roomId]: true }));
    const result = await getMessages({
      clerkGetToken: () => getTokenRef.current(),
      roomId,
    });
    if (result.ok) {
      const list = result.data.messages || [];
      setMessagesByRoom((prev) => ({ ...prev, [roomId]: list }));
      setNextCursorByRoom((prev) => ({
        ...prev,
        [roomId]: result.data.next_cursor || null,
      }));
      setEndReachedByRoom((prev) => ({
        ...prev,
        [roomId]: !result.data.next_cursor,
      }));
      if (list.length > 0) {
        lastObservedByRoom.current[roomId] = {
          lastReadMessageId: list[0].id,
          observedAt: new Date().toISOString(),
        };
      }
    }
    setLoadingFirstPageByRoom((prev) => ({ ...prev, [roomId]: false }));
  }, []);

  const fetchNextPageForRoom = useCallback(
    async (roomId) => {
      const cursor = nextCursorByRoom[roomId];
      if (loadingMoreByRoom[roomId] || endReachedByRoom[roomId] || !cursor) {
        return;
      }
      setLoadingMoreByRoom((prev) => ({ ...prev, [roomId]: true }));
      const result = await getMessages({
        clerkGetToken: () => getTokenRef.current(),
        roomId,
        beforeCursor: cursor,
      });
      if (result.ok) {
        const more = result.data.messages || [];
        setMessagesByRoom((prev) => ({
          ...prev,
          [roomId]: [...(prev[roomId] || []), ...more],
        }));
        setNextCursorByRoom((prev) => ({
          ...prev,
          [roomId]: result.data.next_cursor || null,
        }));
        setEndReachedByRoom((prev) => ({
          ...prev,
          [roomId]: !result.data.next_cursor,
        }));
      }
      setLoadingMoreByRoom((prev) => ({ ...prev, [roomId]: false }));
    },
    [nextCursorByRoom, loadingMoreByRoom, endReachedByRoom],
  );

  const onRefresh = useCallback(() => {
    if (!activeRoom) return;
    setRefreshing(true);
    setNextCursorByRoom((prev) => ({ ...prev, [activeRoom.id]: null }));
    setEndReachedByRoom((prev) => ({ ...prev, [activeRoom.id]: false }));
    fetchFirstPageForRoom(activeRoom.id).finally(() => setRefreshing(false));
  }, [activeRoom, fetchFirstPageForRoom]);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  useEffect(() => {
    if (!activeRoom) return;
    if (messagesByRoom[activeRoom.id] !== undefined) return;
    fetchFirstPageForRoom(activeRoom.id);
  }, [activeRoom, messagesByRoom, fetchFirstPageForRoom]);

  useEffect(() => {
    if (activeTab === 'alliance' && allianceRoom == null && roomsLoaded) {
      setActiveTab('city');
    }
  }, [activeTab, allianceRoom, roomsLoaded]);

  // Ably realtime — connect when rooms known; subscribe per accessible room.
  useEffect(() => {
    if (!roomsLoaded || rooms.length === 0) return undefined;

    let cancelled = false;
    let unsubFns = [];
    let realtimeHandle = null;

    (async () => {
      const result = await connectChatRealtime({
        clerkGetToken: () => getTokenRef.current(),
      });
      if (cancelled) return;
      if (!result.ok) {
        console.warn('[ChatScreen] realtime connect failed', result.code);
        return;
      }
      realtimeHandle = result.realtime;
      for (const room of rooms) {
        const channelName = `chat:${room.id}`;
        const unsub = subscribeToChannel(
          realtimeHandle,
          channelName,
          (payload) => {
            // Dedupe: skip if id already in list (server echo of optimistic) or
            // if there's a matching client_temp_id in messages.
            setMessagesByRoom((prev) => {
              const existing = prev[room.id] || [];
              if (existing.some((m) => m.id === payload.id)) return prev;
              const merged = [
                payload,
                ...existing.filter(
                  (m) => m.client_temp_id !== payload.client_temp_id,
                ),
              ];
              return { ...prev, [room.id]: merged };
            });
          },
        );
        unsubFns.push(unsub);
      }
    })();

    return () => {
      cancelled = true;
      unsubFns.forEach((u) => u && u());
      disconnectChatRealtime();
    };
  }, [roomsLoaded, rooms]);

  // PATCH read-state on blur per Q-S81-K.
  useEffect(() => {
    const unsubscribe = navigation.addListener('blur', () => {
      const observed = lastObservedByRoom.current;
      Object.entries(observed).forEach(([roomId, snapshot]) => {
        if (!snapshot) return;
        patchReadState({
          clerkGetToken: () => getTokenRef.current(),
          roomId,
          lastReadMessageId: snapshot.lastReadMessageId,
          lastReadAt: snapshot.observedAt,
        }).catch(() => {});
      });
    });
    return unsubscribe;
  }, [navigation]);

  // Cleanup banner timer on unmount.
  useEffect(() => {
    return () => {
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    };
  }, []);

  const handleSend = useCallback(async () => {
    if (!activeRoom) return;
    const content = draft.trim();
    if (content.length === 0) return;
    if (sending) return;

    const clientTempId = genClientTempId();
    const optimisticMessage = {
      id: clientTempId,
      client_temp_id: clientTempId,
      room_id: activeRoom.id,
      sender_id: 'self',
      sender_name: t('chat.you'),
      sender_level: null,
      sender_alliance_short_name: null,
      content,
      created_at: new Date().toISOString(),
      _optimistic: true,
    };

    setMessagesByRoom((prev) => ({
      ...prev,
      [activeRoom.id]: [optimisticMessage, ...(prev[activeRoom.id] || [])],
    }));
    setDraft('');
    setSending(true);
    clearBanner();

    const result = await postMessage({
      clerkGetToken: () => getTokenRef.current(),
      roomId: activeRoom.id,
      content,
    });

    setSending(false);

    if (result.ok) {
      const serverMessage = result.data.message;
      setMessagesByRoom((prev) => {
        const list = prev[activeRoom.id] || [];
        return {
          ...prev,
          [activeRoom.id]: list.map((m) =>
            m.id === clientTempId
              ? { ...serverMessage, client_temp_id: clientTempId }
              : m,
          ),
        };
      });
    } else {
      // Roll back optimistic and surface banner.
      setMessagesByRoom((prev) => {
        const list = prev[activeRoom.id] || [];
        return {
          ...prev,
          [activeRoom.id]: list.filter((m) => m.id !== clientTempId),
        };
      });
      setDraft(content); // restore so user can edit / retry
      if (result.code === 'chat_muted') {
        const until = result.context?.muted_until;
        showBanner('muted', until ? t('chat.mutedUntil', { time: timeAgo(until) }) : t('chat.muted'));
      } else if (result.code === 'rate_limited') {
        const secs = result.context?.retry_after_seconds ?? 30;
        showBanner('rate_limited', t('chat.rateLimited', { secs }));
      } else if (result.code === 'message_filtered') {
        showBanner('filtered', t('chat.filtered'));
      } else if (result.code === 'room_access_forbidden') {
        showBanner('error', t('chat.roomForbidden'));
      } else {
        showBanner('error', t('chat.sendFailed'));
      }
    }
  }, [activeRoom, draft, sending, clearBanner, showBanner, t]);

  const renderBody = () => {
    if (!roomsLoaded) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator color="#5C6068" />
        </View>
      );
    }

    if (error && rooms.length === 0) {
      return (
        <View style={styles.centered}>
          <Text style={styles.errorBody}>{t('chat.failedToLoad')}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={fetchRooms}
            style={({ pressed }) => [styles.retryBtn, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.retryBtnText}>{t('common.retry')}</Text>
          </Pressable>
        </View>
      );
    }

    if (activeTab === 'city' && cityRoom == null) {
      return (
        <View style={styles.centered}>
          <Text style={styles.emptyLabel}>{t('chat.noCityTitle')}</Text>
          <Text style={styles.emptyBody}>
            {t('chat.noCityBody')}
          </Text>
        </View>
      );
    }

    if (activeTab === 'alliance' && allianceRoom == null) {
      return (
        <View style={styles.centered}>
          <Text style={styles.emptyLabel}>{t('chat.noAllianceTitle')}</Text>
          <Text style={styles.emptyBody}>
            {t('chat.noAllianceBody')}
          </Text>
        </View>
      );
    }

    if (!activeRoom) return null;
    const messages = messagesByRoom[activeRoom.id];
    const isLoadingFirst = loadingFirstPageByRoom[activeRoom.id];
    const isLoadingMore = loadingMoreByRoom[activeRoom.id];

    if (isLoadingFirst && messages === undefined) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator color="#5C6068" />
        </View>
      );
    }

    if (messages && messages.length === 0) {
      return (
        <View style={styles.centered}>
          <Text style={styles.emptyLabel}>{t('chat.noMessagesTitle')}</Text>
          <Text style={styles.emptyBody}>{t('chat.noMessagesBody')}</Text>
        </View>
      );
    }

    return (
      <FlatList
        data={messages || []}
        inverted
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => <ChatMessageRow row={item} />}
        onEndReached={() => fetchNextPageForRoom(activeRoom.id)}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#F2EEE6"
            colors={['#F2EEE6']}
          />
        }
        ListFooterComponent={
          isLoadingMore ? (
            <ActivityIndicator color="#5C6068" style={{ paddingVertical: 12 }} />
          ) : null
        }
      />
    );
  };

  const canCompose = activeRoom != null;
  const remainingChars = MAX_CONTENT_LENGTH - draft.length;
  const sendDisabled =
    sending || draft.trim().length === 0 || draft.length > MAX_CONTENT_LENGTH;

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <Text style={styles.sectionLabel}>{t('chat.title')}</Text>
        <View style={styles.hairlineStrong} />
      </View>

      <View style={styles.tabStrip}>
        {(
          [
            { key: 'city', label: t('chat.tabCity'), visible: true },
            { key: 'alliance', label: t('chat.tabAlliance'), visible: allianceRoom != null },
          ]
        )
          .filter((tab) => tab.visible)
          .map(({ key, label }) => {
            const selected = activeTab === key;
            return (
              <Pressable
                key={key}
                accessibilityRole="button"
                onPress={() => setActiveTab(key)}
                style={({ pressed }) => [
                  styles.tabCell,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text
                  style={[styles.tabLabel, selected && styles.tabLabelActive]}
                >
                  {label}
                </Text>
                {selected ? <View style={styles.tabMarkBoard} /> : null}
              </Pressable>
            );
          })}
      </View>
      <View style={styles.hairline} />

      <View style={{ flex: 1 }}>{renderBody()}</View>

      {banner != null ? (
        <View
          style={[
            styles.banner,
            banner.kind === 'rate_limited'
              ? styles.bannerAmber
              : styles.bannerRed,
          ]}
        >
          <Text style={styles.bannerText}>{banner.text}</Text>
        </View>
      ) : null}

      {canCompose ? (
        <View style={styles.composer}>
          <TextInput
            style={styles.composerInput}
            placeholder={t('chat.messagePlaceholder')}
            placeholderTextColor="#5C6068"
            value={draft}
            onChangeText={setDraft}
            multiline
            maxLength={MAX_CONTENT_LENGTH}
            editable={!sending}
          />
          <View style={styles.composerSideCol}>
            <Text style={styles.counterText}>{remainingChars}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={handleSend}
              disabled={sendDisabled}
              style={({ pressed }) => [
                styles.sendBtn,
                sendDisabled && { opacity: 0.4 },
                pressed && !sendDisabled && { opacity: 0.7 },
              ]}
            >
              <Text style={styles.sendBtnText}>{t('chat.send')}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

function ChatMessageRow({ row }) {
  const navigation = useNavigation();
  const senderLine =
    row.sender_alliance_short_name != null
      ? `${row.sender_name} · ${row.sender_alliance_short_name}`
      : row.sender_name;
  const thumb = avatarThumb(row.sender_avatar_url, 32);

  // Avatar/name open the sender's profile — except for our own optimistic echo
  // (sender_id 'self') or rows missing a real player id.
  const canOpenProfile = !row._optimistic && row.sender_id && row.sender_id !== 'self';
  const openProfile = canOpenProfile
    ? () =>
        navigation.navigate('PublicProfile', {
          playerId: row.sender_id,
          username: row.sender_name,
          avatarUrl: row.sender_avatar_url,
        })
    : undefined;

  const avatar = thumb ? (
    <Image source={{ uri: thumb }} style={styles.messageAvatar} />
  ) : (
    <View style={[styles.messageAvatar, styles.messageAvatarPlaceholder]}>
      <Text style={styles.messageAvatarInitials}>
        {avatarInitials(row.sender_name)}
      </Text>
    </View>
  );

  return (
    <View style={[styles.messageRow, row._optimistic && styles.messageRowPending]}>
      <View style={styles.messageRowInner}>
        {openProfile ? (
          <Pressable
            accessibilityRole="button"
            onPress={openProfile}
            style={({ pressed }) => pressed && { opacity: 0.6 }}
          >
            {avatar}
          </Pressable>
        ) : (
          avatar
        )}
        <View style={styles.messageBody}>
          <View style={styles.messageMetaRow}>
            {openProfile ? (
              <Pressable
                accessibilityRole="button"
                onPress={openProfile}
                style={({ pressed }) => [{ flex: 1 }, pressed && { opacity: 0.6 }]}
              >
                <Text style={styles.senderText} numberOfLines={1}>
                  {senderLine}
                </Text>
              </Pressable>
            ) : (
              <Text style={styles.senderText} numberOfLines={1}>
                {senderLine}
              </Text>
            )}
            <Text style={styles.timeText}>{timeAgo(row.created_at)}</Text>
          </View>
          <Text style={styles.contentText}>{row.content}</Text>
        </View>
      </View>
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
    paddingHorizontal: 16,
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
    textAlign: 'center',
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
  tabStrip: {
    flexDirection: 'row',
    height: 44,
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
  messageRow: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(242,238,230,0.08)',
  },
  messageRowInner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  messageBody: {
    flex: 1,
  },
  messageAvatar: {
    width: 32,
    height: 32,
    borderRadius: 4,
    backgroundColor: '#1A1D24',
    borderWidth: 1,
    borderColor: 'rgba(242,238,230,0.16)',
  },
  messageAvatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageAvatarInitials: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 11,
    letterSpacing: 0.5,
    color: '#8B8F98',
  },
  messageRowPending: {
    opacity: 0.55,
  },
  messageMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  senderText: {
    flex: 1,
    fontFamily: 'GeistMono_500Medium',
    fontSize: 11,
    letterSpacing: 1.32,
    textTransform: 'uppercase',
    color: '#F2EEE6',
  },
  timeText: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 9,
    color: '#8B8F98',
    marginLeft: 8,
  },
  contentText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: '#F2EEE6',
    lineHeight: 20,
  },
  banner: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  bannerRed: {
    backgroundColor: 'rgba(214,69,37,0.85)',
  },
  bannerAmber: {
    backgroundColor: 'rgba(212,160,40,0.85)',
  },
  bannerText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: '#F2EEE6',
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(242,238,230,0.16)',
    backgroundColor: '#1A1D24',
  },
  composerInput: {
    flex: 1,
    minHeight: 36,
    maxHeight: 96,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: '#F2EEE6',
    backgroundColor: '#0E1014',
    borderWidth: 1,
    borderColor: 'rgba(242,238,230,0.16)',
    borderRadius: 0,
  },
  composerSideCol: {
    marginLeft: 8,
    alignItems: 'center',
  },
  counterText: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 10,
    color: '#5C6068',
    marginBottom: 4,
  },
  sendBtn: {
    backgroundColor: '#D64525',
    paddingHorizontal: 12,
    paddingVertical: 10,
    minWidth: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnText: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 11,
    letterSpacing: 1.76,
    textTransform: 'uppercase',
    color: '#F2EEE6',
  },
});
