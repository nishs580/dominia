// Component: LeaderboardsSideRail — floating shortcut on Map screen to LeaderboardsScreen
// Surface: Ink-2 #1A1D24 button on Map content (Ink-base map underneath)
// Typography: Geist Mono 500, 11px (letterSpacing 1.76 = 11 × 0.16em), uppercase, color Bone #F2EEE6
// Territory colors: none
// Brand rule applied: Claim red is reserved for Inspect Sheet primary CTA on Map. Side-rail uses neutral Ink-2 surface. Static label at launch — no dynamic suffix (rank-change push deferred to Phase 2).
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';

export default function LeaderboardsSideRail({ hidden = false }) {
  const navigation = useNavigation();
  const tabBarHeight = useBottomTabBarHeight();

  if (hidden) return null;

  return (
    <View style={[styles.container, { bottom: tabBarHeight + 72 }]}>
      <Pressable
        accessibilityRole="button"
        onPress={() => navigation.navigate('Leaderboards')}
        style={({ pressed }) => [styles.button, pressed && { opacity: 0.6 }]}
      >
        <Text style={styles.label}>BOARDS</Text>
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
