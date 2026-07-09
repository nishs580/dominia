// Component: MapSideRail — unified floating navigation rail on the Map screen
// Surface: single Ink-2 #1A1D24 segmented control on Map content, square corners
// Typography: Geist Mono 500, 11px (letterSpacing 1.76 = 11 × 0.16em), uppercase, Bone #F2EEE6
// Territory colors: none
// Brand rule applied: Claim red is reserved for the Inspect Sheet primary CTA on Map.
// The rail uses a neutral Ink-2 surface. Unread counts (Chat, Log) surface inline via the
// permitted "·" separator — no corner badge. Boards has no unread suffix at launch.

import React, { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { getRooms } from '../lib/chatApi';
import { getActivityLog } from '../lib/activityLogApi';
import { ChatGlyph, BoardsGlyph, LogGlyph } from './ResourceGlyphs';

const ICON_SIZE = 15;

function withCount(base, count) {
  if (count == null || count === 0) return base;
  if (count > 99) return `${base} · 99+`;
  return `${base} · ${count}`;
}

export default function MapSideRail({ hidden = false }) {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const [chatUnread, setChatUnread] = useState(null);
  const [logUnread, setLogUnread] = useState(null);

  const fetchUnread = useCallback(async () => {
    const [rooms, log] = await Promise.all([
      getRooms({ clerkGetToken: () => getTokenRef.current() }),
      getActivityLog({ clerkGetToken: () => getTokenRef.current(), limit: 1 }),
    ]);
    if (rooms.ok) {
      const total = (rooms.data.rooms || []).reduce(
        (sum, r) => sum + (r.unread_count || 0),
        0,
      );
      setChatUnread(total);
    }
    if (log.ok) {
      setLogUnread(log.data.unreadCount);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchUnread();
    }, [fetchUnread]),
  );

  if (hidden) return null;

  const items = [
    { key: 'chat', Icon: ChatGlyph, label: withCount(t('sideRail.chat'), chatUnread), onPress: () => navigation.navigate('Chat') },
    { key: 'boards', Icon: BoardsGlyph, label: t('sideRail.boards'), onPress: () => navigation.navigate('Leaderboards') },
    { key: 'log', Icon: LogGlyph, label: withCount(t('sideRail.log'), logUnread), onPress: () => navigation.navigate('ActivityLog') },
  ];

  return (
    <View style={styles.container}>
      {items.map((item, i) => (
        <Pressable
          key={item.key}
          accessibilityRole="button"
          onPress={item.onPress}
          style={({ pressed }) => [
            styles.item,
            i > 0 && styles.itemDivider,
            pressed && styles.itemPressed,
          ]}
        >
          <item.Icon size={ICON_SIZE} color="#F2EEE6" />
          <Text style={styles.label} maxFontSizeMultiplier={1.3}>{item.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 12,
    bottom: 20,
    width: 124,
    backgroundColor: '#1A1D24',
    borderWidth: 1,
    borderColor: 'rgba(242,238,230,0.16)',
    borderRadius: 0,
    overflow: 'hidden',
    zIndex: 10,
  },
  item: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 9,
  },
  itemDivider: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(242,238,230,0.10)',
  },
  itemPressed: {
    backgroundColor: 'rgba(242,238,230,0.06)',
  },
  label: {
    fontFamily: 'GeistMono_500Medium',
    fontWeight: '500',
    fontSize: 11,
    letterSpacing: 1.76,
    textTransform: 'uppercase',
    color: '#F2EEE6',
  },
});
