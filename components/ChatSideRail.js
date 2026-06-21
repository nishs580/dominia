// Component: ChatSideRail — floating shortcut on Map screen to ChatScreen
// Surface: Ink-2 #1A1D24 button on Map content (Ink-base map underneath)
// Typography: Geist Mono 500, 11px (letterSpacing 1.76 = 11 × 0.16em), uppercase, color Bone #F2EEE6
// Territory colors: none
// Brand rule applied: Claim red is reserved for Inspect Sheet primary CTA on Map. Side-rail uses neutral Ink-2 surface. Unread count surfaces inline via the permitted "·" separator — no corner badge. Sum of unread across visible chat tabs.

import React, { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { getRooms } from '../lib/chatApi';

function formatLabel(unreadCount) {
  if (unreadCount == null || unreadCount === 0) return 'CHAT';
  if (unreadCount > 99) return 'CHAT · 99+';
  return `CHAT · ${unreadCount}`;
}

export default function ChatSideRail({ hidden = false }) {
  const navigation = useNavigation();
  const tabBarHeight = useBottomTabBarHeight();
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const [unreadCount, setUnreadCount] = useState(null);

  const fetchUnread = useCallback(async () => {
    const result = await getRooms({
      clerkGetToken: () => getTokenRef.current(),
    });
    if (result.ok) {
      const total = (result.data.rooms || []).reduce(
        (sum, r) => sum + (r.unread_count || 0),
        0,
      );
      setUnreadCount(total);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchUnread();
    }, [fetchUnread]),
  );

  if (hidden) return null;

  return (
    <View style={[styles.container, { bottom: tabBarHeight + 132 }]}>
      <Pressable
        accessibilityRole="button"
        onPress={() => navigation.navigate('Chat')}
        style={({ pressed }) => [styles.button, pressed && { opacity: 0.6 }]}
      >
        <Text style={styles.label}>{formatLabel(unreadCount)}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 12,
    flexDirection: 'column',
    zIndex: 10,
  },
  button: {
    height: 48,
    minWidth: 48,
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1A1D24',
    borderWidth: 1,
    borderColor: 'rgba(242,238,230,0.16)',
    borderRadius: 0,
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
