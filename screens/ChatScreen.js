// Screen: ChatScreen — City + Alliance chat (M2: composer + Ably + push deep link + error banner)
// Surface: Ink #000000 background, rows transparent, 1px hairline-standard rgba(253,253,253,0.08) divider
// Typography: section label Geist Mono 500 11px, body Instrument Sans 400 14px Bone, timestamps Geist Mono 400 9px Slate-2, error banner Instrument Sans 400 13px on Claim/red or amber surface
// Territory colors: delegated to none — chat is a neutral surface
// Brand rule applied: Send button is the single Claim CTA on the screen. Inverted FlatList for chat-app convention (newest at bottom). KeyboardAvoidingView wraps composer with platform-appropriate behavior.
//
// legacy_tabs off (Dominia-Temp board 41, plan 2026-11-28 U11): "‹ Chat",
// GLOBAL / ALLIANCE slanted tabs, messages as cut-corner cards (avatar tile,
// name + role/tag, "4D ago", body), a lime row for an @mention of you, and a
// Message field with a blue send tile. Opens on ALLIANCE for alliance
// members, else GLOBAL. GLOBAL is a coming-soon empty state (the city room
// stays reachable in legacy mode); ALLIANCE without an alliance prompts to
// join or create one. Realtime, paging and read-state are shared by both
// modes.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Pressable,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@clerk/clerk-expo';
import { useIsFocused, useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import Svg, { Path } from 'react-native-svg';
import {
  getMessages,
  getRooms,
  patchReadState,
  postMessage,
} from '../lib/chatApi';
import { useFirstTapTips, rectFromRef } from '../components/FirstTapTips';
import {
  connectChatRealtime,
  disconnectChatRealtime,
  subscribeToChannel,
} from '../lib/chatRealtime';
import {
  setVisibleChatRoom,
  clearVisibleChatRoom,
} from '../lib/notifications/chatPresence';
import { timeAgo } from '../lib/timeAgo';
import { avatarThumb, avatarInitials } from '../lib/avatar';
import { useFlag } from '../lib/flags';
import { supabase } from '../lib/supabase';
import { chatAgo, chatSenderParts, defaultChatTab, mentionsName } from '../lib/chatSender';
import { colors, fonts } from '../lib/theme';
import { CutField, LinkText, SlantButton, SlantTabs, SlantTile } from '../components/ui';
import {
  BackLinkHeader,
  GlobeGlyph,
  PeopleGlyph,
  PersonGlyph,
  SendGlyph,
  ToneCutCard,
} from '../components/SocialGlyphs';

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
  const insets = useSafeAreaInsets();
  const { userId, getToken } = useAuth();
  // Figma labels the city room "Global"; the room itself stays city-scoped.
  const legacyTabs = useFlag('legacy_tabs');
  const figma = !legacyTabs;
  const cityTabLabel = legacyTabs
    ? t('chat.tabCity')
    : t('chat.tabGlobal', { defaultValue: 'GLOBAL' });
  // The viewer's player id (own messages), alliance tag (allies) and
  // username (@mentions of you turn the row lime).
  const [viewer, setViewer] = useState({ playerId: null, tag: null, username: null });

  // First-tap tip on the room tabs.
  const walkthroughTabsRef = useRef(null);
  const chatTips = useMemo(
    () => [
      { key: 'room', text: t('walkthrough.chat.roomNoCity'), getRect: () => rectFromRef(walkthroughTabsRef) },
    ],
    [t],
  );
  const tips = useFirstTapTips({ screenKey: 'chat', userId, tips: chatTips });
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const navigation = useNavigation();
  const route = useRoute();
  const isFocused = useIsFocused();
  const requestedTab = route?.params?.initialTab;
  // Legacy opens on the requested room or city. Dominia-Temp waits for the
  // rooms (null = not chosen yet) unless a tab was requested explicitly.
  let initialTab = requestedTab === 'alliance' ? 'alliance' : 'city';
  if (figma && requestedTab !== 'alliance' && requestedTab !== 'city' && requestedTab !== 'global') {
    initialTab = null;
  }

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
  // Dominia-Temp GLOBAL has no room yet (coming soon), so nothing loads there.
  let activeRoom = null;
  if (activeTab === 'alliance') activeRoom = allianceRoom;
  else if (activeTab === 'city' && !figma) activeRoom = cityRoom;

  useEffect(() => {
    if (!figma || !userId) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const { data: player } = await supabase
          .from('players')
          .select('id, alliance_id, username')
          .eq('clerk_id', userId)
          .maybeSingle();
        if (!player || cancelled) return;
        let tag = null;
        if (player.alliance_id) {
          const { data: alliance } = await supabase
            .from('alliances')
            .select('short_name')
            .eq('id', player.alliance_id)
            .maybeSingle();
          tag = alliance?.short_name ?? null;
        }
        if (!cancelled) setViewer({ playerId: player.id ?? null, tag, username: player.username ?? null });
      } catch (_) {
        /* names fall back to neutral; your own optimistic echo still reads YOU */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [figma, userId]);

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
    // Legacy hides the alliance tab without an alliance; Dominia-Temp shows it
    // with a join/create prompt instead.
    if (!figma && activeTab === 'alliance' && allianceRoom == null && roomsLoaded) {
      setActiveTab('city');
    }
  }, [figma, activeTab, allianceRoom, roomsLoaded]);

  // Dominia-Temp default tab: ALLIANCE for alliance members, else GLOBAL.
  useEffect(() => {
    if (!figma || activeTab != null || !roomsLoaded) return;
    const tab = defaultChatTab({ requested: requestedTab, hasAlliance: allianceRoom != null });
    setActiveTab(tab === 'alliance' ? 'alliance' : 'city');
  }, [figma, activeTab, roomsLoaded, requestedTab, allianceRoom]);

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

  // Publish which room is on screen so FcmLifecycle can suppress the chat push
  // toast for it — the live Ably message already rendered in the list, and a
  // toast on top of it duplicates the same message.
  useEffect(() => {
    const roomId = activeRoom?.id ?? null;
    if (!isFocused || !roomId) {
      clearVisibleChatRoom(roomId);
      return undefined;
    }
    setVisibleChatRoom(roomId);
    return () => clearVisibleChatRoom(roomId);
  }, [isFocused, activeRoom?.id]);

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
    if (!roomsLoaded || activeTab == null) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator color="rgba(253,253,253,0.30)" />
        </View>
      );
    }

    if (figma && activeTab === 'city' && !(error && rooms.length === 0)) {
      return (
        <View style={styles.centered} accessibilityLiveRegion="polite">
          <GlobeGlyph size={32} color={colors.muted2} />
          <Text style={[styles.emptyBody, figmaStyles.emptyGap]}>
            {t('chat.globalComingSoon', { defaultValue: 'Global chat is coming soon.' })}
          </Text>
        </View>
      );
    }

    if (figma && activeTab === 'alliance' && allianceRoom == null && !(error && rooms.length === 0)) {
      return (
        <View style={styles.centered}>
          <PeopleGlyph size={32} color={colors.muted2} />
          <Text style={[styles.emptyBody, figmaStyles.emptyGap]}>
            {t('chat.noAllianceJoinBody', { defaultValue: 'Join or create an alliance to chat with your allies.' })}
          </Text>
          <SlantButton
            label={t('chat.findAlliance', { defaultValue: 'Find an alliance' })}
            onPress={() => navigation.navigate('MainTabs', { screen: 'Alliance' })}
            size="md"
            style={figmaStyles.promptBtn}
          />
          <LinkText
            chevron="right"
            onPress={() => navigation.navigate('CreateAlliance')}
            style={figmaStyles.promptLink}
          >
            {t('chat.createAlliance', { defaultValue: 'Create one' })}
          </LinkText>
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
          <ActivityIndicator color="rgba(253,253,253,0.30)" />
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
        contentContainerStyle={figma ? figmaStyles.listContent : undefined}
        renderItem={({ item }) =>
          figma ? (
            <FigmaMessageRow
              row={item}
              t={t}
              parts={chatSenderParts(item, {
                channel: activeTab === 'alliance' ? 'alliance' : 'global',
                selfPlayerId: viewer.playerId,
                selfTag: viewer.tag,
                t,
              })}
              mentioned={mentionsName(item.content, viewer.username)}
            />
          ) : (
            <ChatMessageRow row={item} />
          )
        }
        onEndReached={() => fetchNextPageForRoom(activeRoom.id)}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#FDFDFD"
            colors={['#FDFDFD']}
          />
        }
        ListFooterComponent={
          isLoadingMore ? (
            <ActivityIndicator color="rgba(253,253,253,0.30)" style={{ paddingVertical: 12 }} />
          ) : null
        }
      />
    );
  };

  const canCompose = activeRoom != null;
  const placeholder = t('chat.messagePlaceholder', { defaultValue: 'Message' });
  const remainingChars = MAX_CONTENT_LENGTH - draft.length;
  const sendDisabled =
    sending || draft.trim().length === 0 || draft.length > MAX_CONTENT_LENGTH;

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior="padding"
      onTouchStart={tips.onTouchStart}
    >
      {figma ? (
        <BackLinkHeader
          label={t('chat.figmaTitle', { defaultValue: 'Chat' })}
          backLabel={t('common.back', { defaultValue: 'Back' })}
          onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined}
        />
      ) : (
        <View style={styles.header}>
          <Text style={styles.sectionLabel}>{t('chat.title')}</Text>
          <View style={styles.hairlineStrong} />
        </View>
      )}

      {figma ? (
        <View ref={walkthroughTabsRef} collapsable={false} style={figmaStyles.tabsWrap}>
          <SlantTabs
            tabs={[
              {
                key: 'city',
                label: cityTabLabel,
                icon: ({ color }) => <GlobeGlyph size={16} color={color} />,
              },
              {
                key: 'alliance',
                label: t('chat.tabAlliance', { defaultValue: 'ALLIANCE' }),
                icon: ({ color }) => <PeopleGlyph size={16} color={color} />,
              },
            ]}
            value={activeTab}
            onChange={setActiveTab}
            height={40}
          />
          <View style={figmaStyles.tabsRule} />
        </View>
      ) : (
        <View ref={walkthroughTabsRef} collapsable={false} style={styles.tabStrip}>
          {(
            [
              { key: 'city', label: cityTabLabel, visible: true },
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
                    maxFontSizeMultiplier={1.3}
                    style={[styles.tabLabel, selected && styles.tabLabelActive]}
                  >
                    {label}
                  </Text>
                  {selected ? <View style={styles.tabMarkBoard} /> : null}
                </Pressable>
              );
            })}
        </View>
      )}
      {figma ? null : <View style={styles.hairline} />}

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

      {canCompose && figma ? (
        <View style={[figmaStyles.composer, { paddingBottom: insets.bottom + 12 }]}>
          <CutField
            containerStyle={figmaStyles.inputWrap}
            keyboardAppearance="dark"
            placeholder={placeholder}
            value={draft}
            onChangeText={setDraft}
            maxLength={MAX_CONTENT_LENGTH}
            editable={!sending}
            returnKeyType="send"
            blurOnSubmit={false}
            onSubmitEditing={handleSend}
            accessibilityLabel={placeholder}
          />
          <SlantTile
            size={54}
            width={64}
            selected
            onPress={handleSend}
            disabled={sendDisabled}
            accessibilityLabel={t('chat.send')}
          >
            <SendGlyph size={18} />
          </SlantTile>
        </View>
      ) : null}

      {canCompose && !figma ? (
        <View style={[styles.composer, { paddingBottom: insets.bottom + 10 }]}>
          <TextInput
            style={styles.composerInput}
            keyboardAppearance="dark"
            placeholder={t('chat.messagePlaceholder')}
            placeholderTextColor="rgba(253,253,253,0.30)"
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
              accessibilityLabel={t('chat.send')}
              onPress={handleSend}
              disabled={sendDisabled}
              style={({ pressed }) => [
                styles.sendBtn,
                sendDisabled && { opacity: 0.4 },
                pressed && !sendDisabled && { opacity: 0.7 },
              ]}
            >
              <Svg width={18} height={18} viewBox="0 0 24 24">
                <Path d="M3 20.5v-6l9-2.5-9-2.5v-6l19 8.5-19 8.5z" fill="#FDFDFD" />
              </Svg>
            </Pressable>
          </View>
        </View>
      ) : null}

      {tips.tipElement}
    </KeyboardAvoidingView>
  );
}

// Dominia-Temp row (board 41): a cut-corner card with the avatar tile, the
// name + role/tag, the relative time and the body. A message that @mentions
// you gets a lime border and lime text. Tapping a real sender's avatar opens
// their profile.
function FigmaMessageRow({ row, t, parts, mentioned }) {
  const navigation = useNavigation();
  const canOpenProfile = !parts.isSelf && !row._optimistic && row.sender_id && row.sender_id !== 'self';
  const ago = chatAgo(row.created_at);
  const agoText = ago ? t(ago.key, { defaultValue: ago.defaultValue, ...ago.params }) : '';
  const lime = mentioned && !parts.isSelf;
  const thumb = avatarThumb(row.sender_avatar_url, 36);
  const openProfile = canOpenProfile
    ? () =>
        navigation.navigate('PublicProfile', {
          playerId: row.sender_id,
          username: row.sender_name,
          avatarUrl: row.sender_avatar_url,
        })
    : undefined;
  const avatar = (
    <SlantTile size={36} square tone="raised">
      {thumb ? <Image source={{ uri: thumb }} style={figmaStyles.avatarImg} /> : <PersonGlyph size={18} />}
    </SlantTile>
  );
  return (
    <ToneCutCard
      stroke={lime ? colors.lime : colors.surfaceLine}
      from={lime ? 'rgba(132,255,68,0.08)' : undefined}
      style={[figmaStyles.message, row._optimistic && styles.messageRowPending]}
    >
      {openProfile ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={parts.name}
          onPress={openProfile}
          style={({ pressed }) => [figmaStyles.avatarCell, pressed && { opacity: 0.6 }]}
        >
          {avatar}
        </Pressable>
      ) : (
        <View style={figmaStyles.avatarCell}>{avatar}</View>
      )}
      <View style={figmaStyles.messageBody}>
        <View style={figmaStyles.metaRow}>
          <Text style={figmaStyles.name} numberOfLines={1} maxFontSizeMultiplier={1.3}>
            {parts.name}
          </Text>
          {parts.detail ? (
            <Text style={figmaStyles.detail} numberOfLines={1} maxFontSizeMultiplier={1.3}>
              {parts.detail}
            </Text>
          ) : null}
          <Text style={figmaStyles.ago} maxFontSizeMultiplier={1.3}>{agoText}</Text>
        </View>
        <Text style={[figmaStyles.content, lime && figmaStyles.contentLime]}>{row.content}</Text>
      </View>
    </ToneCutCard>
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

const figmaStyles = StyleSheet.create({
  tabsWrap: {
    marginHorizontal: 16,
    marginTop: 4,
  },
  tabsRule: {
    height: 1,
    marginTop: 12,
    backgroundColor: colors.surfaceLine,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  emptyGap: {
    marginTop: 12,
  },
  promptBtn: {
    marginTop: 20,
  },
  promptLink: {
    marginTop: 16,
    alignSelf: 'center',
  },
  message: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    paddingLeft: 12,
    paddingRight: 14,
    marginVertical: 4,
  },
  avatarCell: {
    paddingTop: 2,
  },
  avatarImg: {
    width: 26,
    height: 26,
  },
  messageBody: {
    flex: 1,
    marginLeft: 10,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  name: {
    flexShrink: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    color: colors.white,
  },
  detail: {
    flexShrink: 1,
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.muted2,
  },
  ago: {
    marginLeft: 'auto',
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.muted2,
  },
  content: {
    marginTop: 4,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.white,
  },
  contentLime: {
    color: colors.lime,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceLine,
  },
  inputWrap: {
    flex: 1,
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
    paddingHorizontal: 16,
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
    textAlign: 'center',
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
    backgroundColor: 'rgba(253,253,253,0.16)',
    marginTop: 6,
  },
  messageRow: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(253,253,253,0.08)',
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
    backgroundColor: '#0E0E10',
    borderWidth: 1,
    borderColor: 'rgba(253,253,253,0.16)',
  },
  messageAvatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageAvatarInitials: {
    fontFamily: 'IBMPlexSans_600SemiBold',
    fontSize: 11,
    letterSpacing: 0.5,
    color: 'rgba(253,253,253,0.62)',
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
    fontFamily: 'IBMPlexSans_600SemiBold',
    fontSize: 11,
    letterSpacing: 1.32,
    textTransform: 'uppercase',
    color: '#FDFDFD',
  },
  timeText: {
    fontFamily: 'IBMPlexSans_700Bold',
    fontSize: 11,
    color: 'rgba(253,253,253,0.62)',
    marginLeft: 8,
  },
  contentText: {
    fontFamily: 'IBMPlexSans_500Medium',
    fontSize: 14,
    color: '#FDFDFD',
    lineHeight: 20,
  },
  banner: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  bannerRed: {
    backgroundColor: 'rgba(227,66,52,0.85)',
  },
  bannerAmber: {
    backgroundColor: 'rgba(212,160,40,0.85)',
  },
  bannerText: {
    fontFamily: 'IBMPlexSans_500Medium',
    fontSize: 13,
    color: '#FDFDFD',
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(253,253,253,0.16)',
    backgroundColor: '#0E0E10',
  },
  composerInput: {
    flex: 1,
    minHeight: 36,
    maxHeight: 96,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontFamily: 'IBMPlexSans_500Medium',
    fontSize: 14,
    color: '#FDFDFD',
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: 'rgba(253,253,253,0.16)',
    borderRadius: 0,
  },
  composerSideCol: {
    marginLeft: 8,
    alignItems: 'center',
  },
  counterText: {
    fontFamily: 'IBMPlexSans_700Bold',
    fontSize: 11,
    color: 'rgba(253,253,253,0.30)',
    marginBottom: 4,
  },
  sendBtn: {
    backgroundColor: colors.action,
    width: 44,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
