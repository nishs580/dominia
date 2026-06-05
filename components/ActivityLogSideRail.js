// Component: ActivityLogSideRail — floating shortcut on Map screen to ActivityLogScreen
// Surface: Ink-2 #1A1D24 button on Map content (Ink-base map underneath)
// Typography: Geist Mono 500, 11px (letterSpacing 1.76 = 11 × 0.16em), uppercase, color Bone #F2EEE6
// Territory colors: none
// Brand rule applied: Claim red is reserved for Inspect Sheet primary CTA on Map. Side-rail uses neutral Ink-2 surface. Unread count surfaces inline via the permitted "·" separator — no corner badge.

import React, { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { getActivityLog } from '../lib/activityLogApi';

function formatLabel(unreadCount) {
  if (unreadCount == null || unreadCount === 0) return 'LOG';
  if (unreadCount > 99) return 'LOG · 99+';
  return `LOG · ${unreadCount}`;
}

export default function ActivityLogSideRail({ hidden = false }) {
  const navigation = useNavigation();
  const tabBarHeight = useBottomTabBarHeight();
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const [unreadCount, setUnreadCount] = useState(null);

  const fetchUnread = useCallback(async () => {
    const result = await getActivityLog({
      clerkGetToken: () => getTokenRef.current(),
      limit: 1,
    });
    if (result.ok) {
      setUnreadCount(result.data.unreadCount);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchUnread();
    }, [fetchUnread]),
  );

  if (hidden) return null;

  return (
    <View style={[styles.container, { bottom: tabBarHeight + 12 }]}>
      <Pressable
        accessibilityRole="button"
        onPress={() => navigation.navigate('ActivityLog')}
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
