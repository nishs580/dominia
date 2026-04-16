import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
// Toggle to preview the two states.
const isMember = true;

const BG = '#0f0f14';
const ORANGE = '#ED9332';

function HeaderKicker({ children }) {
  return <Text style={styles.headerKicker}>{children}</Text>;
}

function AllianceCard({ dotColor, nameLine, metaLine, members }) {
  return (
    <View style={styles.allianceCard}>
      <View style={[styles.allianceDot, { backgroundColor: dotColor }]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.allianceCardName}>{nameLine}</Text>
        <Text style={styles.allianceCardMeta}>{metaLine}</Text>
      </View>
      <Text style={styles.allianceCardMembers}>{members}</Text>
    </View>
  );
}

function StatCard({ value, label, valueColor }) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, valueColor && { color: valueColor }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function RosterRow({ initials, name, role, steps, showBorder }) {
  return (
    <View style={[styles.rosterRow, showBorder && styles.rosterRowBorder]}>
      <View style={styles.rosterLeft}>
        <View style={styles.rosterAvatar}>
          <Text style={styles.rosterInitials}>{initials}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.rosterName}>{name}</Text>
          <Text style={styles.rosterRole}>{role}</Text>
        </View>
      </View>
      <Text style={styles.rosterSteps}>{steps}</Text>
    </View>
  );
}

function NonMemberContent({ navigation }) {
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyEmoji}>🏴</Text>
        <Text style={styles.emptyTitle}>Join an alliance</Text>
        <Text style={styles.emptySubtitle}>
          Alliance warfare unlocks at Level 6. Coordinate with others, share resources, and dominate the map together.
        </Text>
        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [styles.btnPrimary, pressed && { opacity: 0.9 }]}
        >
          <Text style={styles.btnPrimaryText}>Find an alliance</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [styles.btnMuted, pressed && { opacity: 0.9 }]}
        >
          <Text style={styles.btnMutedText}>Found your own</Text>
        </Pressable>
      </View>

      <HeaderKicker>ALLIANCES IN YOUR CITY</HeaderKicker>
      <View style={{ marginTop: 10, gap: 10 }}>
        <AllianceCard
          dotColor="#ED9332"
          nameLine="Iron Wolves [INW]"
          metaLine="Jordaan · Founded 2024"
          members="14/20"
        />
        <AllianceCard
          dotColor="#7F77DD"
          nameLine="Fire Blazers [FBM]"
          metaLine="Leidseplein · Founded 2024"
          members="8/20"
        />
        <TouchableOpacity
          style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: 10, alignItems: 'center', marginTop: 12 }}
          onPress={() => navigation.navigate('AllianceJoined')}
        >
          <Text style={{ fontSize: 12, color: '#555' }}>Test Alliance Joined screen</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function MemberContent() {
  return (
    <>
      <View style={styles.accentBar} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.memberScrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.statRow}>
          <StatCard value="47" label="Territories" />
          <StatCard value="340" label="Morale" valueColor={ORANGE} />
          <StatCard value="#2" label="Realm rank" />
        </View>

        <View style={styles.warChest}>
          <View style={{ flex: 1 }}>
            <Text style={styles.warChestLabel}>War Chest</Text>
            <Text style={styles.warChestValue}>340 Morale</Text>
            <Text style={styles.warChestDonor}>Top donor: nishs580</Text>
          </View>
          <Text style={styles.warChestIcon}>⚔️</Text>
        </View>

        <Text style={styles.sectionLabel}>ACTIVE MISSION</Text>
        <View style={styles.missionCard}>
          <Text style={styles.missionTitle}>Collective Fitness — 500,000 steps</Text>
          <Text style={styles.missionSub}>300,000 / 500,000 steps · 4 days left</Text>
          <View style={styles.progressTrack}>
            <View style={styles.progressFill} />
          </View>
        </View>

        <Text style={[styles.sectionLabel, { marginTop: 18 }]}>ROSTER</Text>
        <View>
          <RosterRow initials="NS" name="nishs580" role="Founder" steps="12,400 steps" showBorder />
          <RosterRow initials="AS" name="Alena.S" role="Officer" steps="9,200 steps" showBorder />
          <RosterRow initials="EV" name="Erik.V" role="Soldier" steps="6,100 steps" showBorder={false} />
        </View>
      </ScrollView>
    </>
  );
}

export default function AllianceScreen() {
  const navigation = useNavigation();
  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <HeaderKicker>ALLIANCE</HeaderKicker>
        {isMember ? (
          <>
            <Text style={styles.headerTitle}>Iron Wolves</Text>
            <Text style={styles.headerSubtitle}>[INW] · Jordaan · 14 members</Text>
          </>
        ) : (
          <>
            <Text style={styles.headerTitle}>No Alliance</Text>
            <Text style={styles.headerSubtitle}>You are unaffiliated</Text>
          </>
        )}
      </View>

      {isMember ? <MemberContent /> : <NonMemberContent navigation={navigation} />}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BG,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerKicker: {
    color: '#555',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  headerTitle: {
    marginTop: 8,
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '600',
  },
  headerSubtitle: {
    marginTop: 6,
    color: '#666',
    fontSize: 11,
    fontWeight: '600',
  },
  accentBar: {
    height: 4,
    width: '100%',
    backgroundColor: ORANGE,
    borderRadius: 2,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 28,
  },
  memberScrollContent: {
    padding: 16,
    paddingBottom: 28,
  },
  emptyWrap: {
    alignItems: 'center',
    marginBottom: 28,
  },
  emptyEmoji: {
    fontSize: 56,
    marginBottom: 12,
  },
  emptyTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptySubtitle: {
    marginTop: 10,
    color: '#555',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 16.5,
    paddingHorizontal: 8,
  },
  btnPrimary: {
    marginTop: 18,
    width: '100%',
    backgroundColor: ORANGE,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  btnMuted: {
    marginTop: 10,
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnMutedText: {
    color: '#aaa',
    fontSize: 15,
    fontWeight: '700',
  },
  allianceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 8,
    padding: 10,
    gap: 10,
  },
  allianceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  allianceCardName: {
    color: '#ccc',
    fontSize: 12,
    fontWeight: '500',
  },
  allianceCardMeta: {
    marginTop: 4,
    color: '#555',
    fontSize: 9,
    fontWeight: '600',
  },
  allianceCardMembers: {
    color: '#666',
    fontSize: 10,
    fontWeight: '600',
  },
  statRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  statValue: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  statLabel: {
    marginTop: 6,
    color: '#555',
    fontSize: 9,
    fontWeight: '600',
  },
  warChest: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(237,147,50,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(237,147,50,0.2)',
    borderRadius: 8,
    padding: 10,
  },
  warChestLabel: {
    color: '#555',
    fontSize: 9,
    fontWeight: '700',
  },
  warChestValue: {
    marginTop: 4,
    color: ORANGE,
    fontSize: 18,
    fontWeight: '700',
  },
  warChestDonor: {
    marginTop: 4,
    color: '#555',
    fontSize: 9,
    fontWeight: '600',
  },
  warChestIcon: {
    fontSize: 20,
  },
  sectionLabel: {
    marginTop: 16,
    color: '#555',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  missionCard: {
    marginTop: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 8,
    padding: 10,
    borderLeftWidth: 3,
    borderLeftColor: ORANGE,
  },
  missionTitle: {
    color: '#ccc',
    fontSize: 12,
    fontWeight: '500',
  },
  missionSub: {
    marginTop: 6,
    color: '#555',
    fontSize: 10,
    fontWeight: '600',
  },
  progressTrack: {
    marginTop: 10,
    width: '100%',
    height: 3,
    backgroundColor: '#222',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    width: '60%',
    height: '100%',
    backgroundColor: ORANGE,
    borderRadius: 2,
  },
  rosterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  rosterRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  rosterLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  rosterAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(237,147,50,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rosterInitials: {
    color: ORANGE,
    fontSize: 10,
    fontWeight: '600',
  },
  rosterName: {
    color: '#ccc',
    fontSize: 12,
    fontWeight: '600',
  },
  rosterRole: {
    marginTop: 2,
    color: '#555',
    fontSize: 9,
    fontWeight: '600',
  },
  rosterSteps: {
    color: '#666',
    fontSize: 11,
    fontWeight: '600',
  },
});
