// Component: MapSideRail — unified floating navigation rail on the Map screen
// Surface: single Ink-2 #1A1A1A segmented control on Map content, square corners
// Typography: Geist Mono 500, 11px (letterSpacing 1.76 = 11 × 0.16em), uppercase, Bone #F5F4EF
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
import { colors } from '../lib/theme';

const ICON_SIZE = 14;
const FIGMA_ICON_SIZE = 18;

// Three swatches in the territory colours — the key's own legend in miniature.
function KeyGlyph() {
  return (
    <View style={styles.keyGlyph}>
      {[colors.claim, colors.alliance, colors.enemy].map((c) => (
        <View key={c} style={[styles.keySwatch, { borderColor: c }]} />
      ))}
    </View>
  );
}

function withCount(base, count) {
  if (count == null || count === 0) return base;
  if (count > 99) return `${base} · 99+`;
  return `${base} · ${count}`;
}

// figma (legacy_tabs off, plan U11): a vertical rail of five icon controls —
// Territories key · Locate me · Leaderboard · Log · Chat — under the top bar.
// Key and Locate act on the map, so MapScreen passes their handlers in.
// Without `figma` the rail renders exactly as before.
export default function MapSideRail({ hidden = false, figma = false, keyOpen = false, onToggleKey, onLocate }) {
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

  if (figma) {
    const figmaItems = [
      {
        key: 'key',
        render: () => <KeyGlyph />,
        label: t('map.rail.keyA11y', { defaultValue: 'Territory colours key' }),
        onPress: onToggleKey,
        expanded: keyOpen,
      },
      {
        key: 'locate',
        render: (c) => <Text style={[styles.locateGlyph, { color: c }]}>⌖</Text>,
        label: t('map.locateMe'),
        onPress: onLocate,
      },
      {
        key: 'boards',
        render: (c) => <BoardsGlyph size={FIGMA_ICON_SIZE} color={c} />,
        label: t('map.rail.leaderboardA11y', { defaultValue: 'Leaderboard' }),
        onPress: () => navigation.navigate('Leaderboards'),
      },
      {
        key: 'log',
        render: (c) => <LogGlyph size={FIGMA_ICON_SIZE} color={c} />,
        label: withCount(t('map.rail.logA11y', { defaultValue: 'Log' }), logUnread),
        count: logUnread,
        onPress: () => navigation.navigate('ActivityLog'),
      },
      {
        key: 'chat',
        render: (c) => <ChatGlyph size={FIGMA_ICON_SIZE} color={c} />,
        label: withCount(t('map.rail.chatA11y', { defaultValue: 'Chat' }), chatUnread),
        count: chatUnread,
        onPress: () => navigation.navigate('Chat'),
      },
    ];
    return (
      <View style={styles.figmaContainer}>
        {figmaItems.map((item, i) => (
          <Pressable
            key={item.key}
            accessibilityRole="button"
            accessibilityLabel={item.label}
            accessibilityState={item.expanded != null ? { expanded: item.expanded } : undefined}
            onPress={item.onPress}
            style={({ pressed }) => [
              styles.figmaItem,
              i > 0 && styles.itemDivider,
              (pressed || item.expanded) && styles.itemPressed,
            ]}
          >
            {item.render(colors.bone)}
            {item.count ? (
              <Text style={styles.figmaCount} maxFontSizeMultiplier={1.2}>
                {item.count > 99 ? '99+' : item.count}
              </Text>
            ) : null}
          </Pressable>
        ))}
      </View>
    );
  }

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
          <item.Icon size={ICON_SIZE} color={colors.bone} />
          <Text style={styles.label} maxFontSizeMultiplier={1.3}>{item.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  // This rail was a 124x144 opaque Ink-2 plate with a full border, sitting over
  // roughly a third of the lower board and directly above a tab bar that
  // already handles navigation. On a screen whose entire subject is the board,
  // secondary destinations should not be the second-heaviest object on it.
  //
  // It is now a translucent ink panel rather than a plate — flat, no blur, no
  // gradient, just the ink ramp at reduced alpha so the board stays partly
  // legible beneath it. Narrower and shorter, with the 48dp touch target kept
  // intact: the row height is unchanged, the padding around it is not.
  container: {
    position: 'absolute',
    right: 12,
    bottom: 20,
    // 110, not 104: labels moved from 10 to 11pt (HIG floor); the extra 6
    // keeps what fit on one line at 10pt fitting at 11.
    width: 110,
    backgroundColor: 'rgba(16,16,16,0.86)',
    borderWidth: 0.5,
    borderColor: colors.hairline,
    borderRadius: 0,
    overflow: 'hidden',
    zIndex: 10,
  },
  item: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    gap: 8,
  },
  itemDivider: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(245,244,239,0.10)',
  },
  itemPressed: {
    backgroundColor: 'rgba(245,244,239,0.06)',
  },
  // Figma rail: icon-only, 44pt square targets (plan Accessibility), sits
  // under the top bar and search field on the right edge.
  figmaContainer: {
    position: 'absolute',
    right: 12,
    top: 112,
    width: 44,
    backgroundColor: 'rgba(16,16,16,0.86)',
    borderWidth: 0.5,
    borderColor: colors.hairline,
    borderRadius: 0,
    overflow: 'hidden',
    zIndex: 10,
  },
  figmaItem: {
    width: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  figmaCount: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 11,
    color: colors.bone,
  },
  locateGlyph: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 18,
  },
  keyGlyph: {
    gap: 2,
  },
  keySwatch: {
    width: 14,
    height: 4,
    borderWidth: 1,
  },
  label: {
    fontFamily: 'GeistMono_500Medium',
    fontWeight: '500',
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.bone,
  },
});
