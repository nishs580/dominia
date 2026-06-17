// Screen: LeaderboardsScreen — entry point to the three boards (Power, Territory, Battles)
// Surface: Ink #0E1014 background. M1 scaffold ships the empty-state branch only; M2 wires the board strip + rankings.
// Typography: Geist Mono 500 11px label, Inter 400 14px body — mirrors ActivityLogScreen empty branch.
// Brand rule applied: text-only empty state; no Claim CTA in this screen at launch.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function LeaderboardsScreen() {
  return (
    <View style={[styles.screen, styles.centered]}>
      <Text style={styles.emptyLabel}>NO RANKINGS YET</Text>
      <Text style={styles.emptyBody}>Boards open soon.</Text>
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
});
