// Screen: ChatScreen — City + Alliance chat (M1: read-only, no composer)
// Surface: Ink #0E1014 background, rows transparent, 1px hairline-standard rgba(242,238,230,0.08) divider
// Typography: section label Geist Mono 500 11px, body Inter 400 14px Bone, timestamps Geist Mono 400 9px Slate-2
// Territory colors: delegated to none — chat is neutral surface
// Brand rule applied: text-only header with hairline-strong, retry button is the single Claim CTA on the screen. Tab strip mirrors LeaderboardsScreen L14 pattern. Inverted FlatList for chat-app convention (newest at bottom) — no KeyboardAvoidingView so inverted insets are inert at M1.

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
import { useNavigation } from '@react-navigation/native';
import {
  getMessages,
  getRooms,
  patchReadState,
} from '../lib/chatApi';
import { timeAgo } from '../lib/timeAgo';

export default function ChatScreen() {
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const navigation = useNavigation();

  const [rooms, setRooms] = useState([]);
  const [roomsLoaded, setRoomsLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState('city');
  const [messagesByRoom, setMessagesByRoom] = useState({});
  const [nextCursorByRoom, setNextCursorByRoom] = useState({});
  const [endReachedByRoom, setEndReachedByRoom] = useState({});
  const [loadingFirstPageByRoom, setLoadingFirstPageByRoom] = useState({});
  const [loadingMoreByRoom, setLoadingMoreByRoom] = useState({});
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const cityRoom = useMemo(
    () => rooms.find((r) => r.room_type === 'city') ?? null,
    [rooms],
  );
  const allianceRoom = useMemo(
    () => rooms.find((r) => r.room_type === 'alliance') ?? null,
    [rooms],
  );
  const activeRoom = activeTab === 'city' ? cityRoom : allianceRoom;

  // For PATCHing read-state on blur, we need to know the newest visible message
  // and the timestamp at which we observed it.
  const lastObservedByRoom = useRef({});

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
      if (
        loadingMoreByRoom[roomId] ||
        endReachedByRoom[roomId] ||
        !cursor
      ) {
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

  // When the active room becomes known and we haven't loaded its first page yet, load it.
  useEffect(() => {
    if (!activeRoom) return;
    if (messagesByRoom[activeRoom.id] !== undefined) return;
    fetchFirstPageForRoom(activeRoom.id);
  }, [activeRoom, messagesByRoom, fetchFirstPageForRoom]);

  // If solo player landed on alliance tab without an alliance, snap back to city.
  useEffect(() => {
    if (activeTab === 'alliance' && allianceRoom == null && roomsLoaded) {
      setActiveTab('city');
    }
  }, [activeTab, allianceRoom, roomsLoaded]);

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
          <Text style={styles.errorBody}>Failed to load chat.</Text>
          <Pressable
            accessibilityRole="button"
            onPress={fetchRooms}
            style={({ pressed }) => [styles.retryBtn, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.retryBtnText}>RETRY</Text>
          </Pressable>
        </View>
      );
    }

    if (activeTab === 'city' && cityRoom == null) {
      return (
        <View style={styles.centered}>
          <Text style={styles.emptyLabel}>NO CITY YET</Text>
          <Text style={styles.emptyBody}>
            Set your home pin to join your city chat.
          </Text>
        </View>
      );
    }

    if (activeTab === 'alliance' && allianceRoom == null) {
      return (
        <View style={styles.centered}>
          <Text style={styles.emptyLabel}>NO ALLIANCE</Text>
          <Text style={styles.emptyBody}>
            Join an alliance to chat with your alliance.
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
          <Text style={styles.emptyLabel}>NO MESSAGES YET</Text>
          <Text style={styles.emptyBody}>Be the first to say hi.</Text>
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

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.sectionLabel}>CHAT</Text>
        <View style={styles.hairlineStrong} />
      </View>

      <View style={styles.tabStrip}>
        {(
          [
            { key: 'city', label: 'CITY', visible: true },
            { key: 'alliance', label: 'ALLIANCE', visible: allianceRoom != null },
          ]
        )
          .filter((t) => t.visible)
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

      {renderBody()}
    </View>
  );
}

function ChatMessageRow({ row }) {
  const senderLine =
    row.sender_alliance_short_name != null
      ? `${row.sender_name} · ${row.sender_alliance_short_name}`
      : row.sender_name;
  return (
    <View style={styles.messageRow}>
      <View style={styles.messageMetaRow}>
        <Text style={styles.senderText} numberOfLines={1}>
          {senderLine}
        </Text>
        <Text style={styles.timeText}>{timeAgo(row.created_at)}</Text>
      </View>
      <Text style={styles.contentText}>{row.content}</Text>
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
});
