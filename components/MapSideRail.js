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
import { BubbleIcon, CrosshairIcon, LayersIcon, ListIcon, TrophyIcon } from './MapIcons';
import { colors, fonts } from '../lib/theme';

const ICON_SIZE = 14;
const FIGMA_ICON_SIZE = 18;
// Figma C1: five separate square tiles stacked with a gap.
const FIGMA_TILE = 44;
const FIGMA_GAP = 8;

function withCount(base, count) {
  if (count == null || count === 0) return base;
  if (count > 99) return `${base} · 99+`;
  return `${base} · ${count}`;
}

// figma (legacy_tabs off, plan U11; Updated UX C1/C2, plan U8): five
// separate square tiles — Territories key (layers) · Locate me (crosshair) ·
// Leaderboard (trophy) · Log (list) · Chat (bubble) — under the top bar. The
// key tile wears a lime border while the key is open. Key and Locate act on
// the map, so MapScreen passes their handlers in.
//
// coach (B1 side-panel coach mark): the rail lifts above the coach scrim,
// gains a lime frame and a label beside each tile, and any tile tap just
// continues the coach mark (onCoachContinue) instead of navigating.
// Without `figma` the rail renders exactly as before.
export default function MapSideRail({
  hidden = false,
  figma = false,
  keyOpen = false,
  onToggleKey,
  onLocate,
  coach = false,
  onCoachContinue,
}) {
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
        Icon: LayersIcon,
        label: t('map.rail.keyA11y', { defaultValue: 'Territory colours key' }),
        coachLabel: t('map.coach.railKey', { defaultValue: 'TERRITORIES COLOURING' }),
        onPress: onToggleKey,
        expanded: keyOpen,
      },
      {
        key: 'locate',
        Icon: CrosshairIcon,
        label: t('map.locateMe'),
        coachLabel: t('map.coach.railLocate', { defaultValue: 'LOCATE ME' }),
        onPress: onLocate,
      },
      {
        key: 'boards',
        Icon: TrophyIcon,
        label: t('map.rail.leaderboardA11y', { defaultValue: 'Leaderboard' }),
        coachLabel: t('map.coach.railLeaderboard', { defaultValue: 'LEADERBOARD' }),
        onPress: () => navigation.navigate('Leaderboards'),
      },
      {
        key: 'log',
        Icon: ListIcon,
        label: withCount(t('map.rail.logA11y', { defaultValue: 'Log' }), logUnread),
        coachLabel: t('map.coach.railLog', { defaultValue: 'LOG' }),
        count: logUnread,
        onPress: () => navigation.navigate('ActivityLog'),
      },
      {
        key: 'chat',
        Icon: BubbleIcon,
        label: withCount(t('map.rail.chatA11y', { defaultValue: 'Chat' }), chatUnread),
        coachLabel: t('map.coach.railChat', { defaultValue: 'CHAT' }),
        count: chatUnread,
        onPress: () => navigation.navigate('Chat'),
      },
    ];
    return (
      <View style={[styles.figmaContainer, coach && styles.figmaContainerCoach]} pointerEvents="box-none">
        {figmaItems.map((item) => (
          <View key={item.key} style={styles.figmaRow} pointerEvents="box-none">
            {coach ? (
              <View style={styles.coachLabel} pointerEvents="none">
                <Text style={styles.coachLabelText} numberOfLines={1} maxFontSizeMultiplier={1.2}>
                  {item.coachLabel}
                </Text>
              </View>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={item.label}
              accessibilityState={item.expanded != null ? { expanded: item.expanded } : undefined}
              onPress={coach ? onCoachContinue : item.onPress}
              style={({ pressed }) => [
                styles.figmaItem,
                item.expanded && !coach && styles.figmaItemActive,
                pressed && styles.itemPressed,
              ]}
            >
              <item.Icon size={FIGMA_ICON_SIZE} color={colors.bone} />
              {item.count && !coach ? (
                <View style={styles.figmaCountBadge} pointerEvents="none">
                  <Text style={styles.figmaCount} maxFontSizeMultiplier={1.2}>
                    {item.count > 99 ? '99+' : item.count}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          </View>
        ))}
        {coach ? <View style={styles.coachFrame} pointerEvents="none" /> : null}
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
    alignItems: 'flex-end',
    gap: FIGMA_GAP,
    zIndex: 10,
  },
  // Above the coach scrim (CoachMark zIndex 70) so the rail reads as the
  // highlighted subject of B1.
  figmaContainerCoach: {
    zIndex: 80,
    elevation: 80,
  },
  figmaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  figmaItem: {
    width: FIGMA_TILE,
    height: FIGMA_TILE,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(16,16,16,0.86)',
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    borderRadius: 0,
  },
  figmaItemActive: {
    borderColor: colors.lime,
  },
  // Inside the tile's top-right corner, clear of the centred icon and the map.
  figmaCountBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 16,
    paddingHorizontal: 3,
    backgroundColor: colors.ink3,
    borderWidth: 0.5,
    borderColor: colors.hairlineStrong,
    alignItems: 'center',
  },
  figmaCount: {
    fontFamily: fonts.monoMedium,
    fontSize: 11,
    color: colors.bone,
  },
  coachLabel: {
    backgroundColor: colors.ink2,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  coachLabelText: {
    fontFamily: fonts.monoMedium,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.bone,
  },
  coachFrame: {
    position: 'absolute',
    top: -5,
    bottom: -5,
    right: -5,
    width: FIGMA_TILE + 10,
    borderWidth: 2,
    borderColor: colors.lime,
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
