import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

// Toggle to preview the two states.
const isMember = false;

const ACCENT = '#1D9E75';
const ALLIANCE = '#534AB7';
const BG = '#F6F8F7';
const CARD = '#FFFFFF';
const TEXT = '#0F172A';
const MUTED = '#64748B';
const BORDER = '#E5E7EB';

function Badge({ text, tone }) {
  const isOpen = tone === 'open';
  const isFull = tone === 'full';

  const bg = isFull ? '#F1F5F9' : isOpen ? '#E8F6F1' : '#F6F5FF';
  const border = isFull ? '#E2E8F0' : isOpen ? '#C7EADF' : '#DAD7FF';
  const color = isFull ? '#64748B' : isOpen ? ACCENT : ALLIANCE;

  return (
    <View style={[styles.badge, { backgroundColor: bg, borderColor: border }]}>
      <Text style={[styles.badgeText, { color }]}>{text}</Text>
    </View>
  );
}

function Pill({ label, value, variant }) {
  const isPurple = variant === 'purple';
  return (
    <View
      style={[
        styles.pill,
        isPurple
          ? { backgroundColor: '#F0EFFF', borderColor: '#DAD7FF' }
          : { backgroundColor: CARD, borderColor: BORDER },
      ]}
    >
      <Text style={[styles.pillValue, isPurple && { color: ALLIANCE }]}>{value}</Text>
      <Text style={styles.pillLabel}>{label}</Text>
    </View>
  );
}

function Button({ label, variant }) {
  const isPrimary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        isPrimary ? styles.buttonPrimary : styles.buttonOutline,
        pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] },
      ]}
    >
      <Text style={[styles.buttonText, isPrimary ? styles.buttonTextPrimary : styles.buttonTextOutline]}>
        {label}
      </Text>
    </Pressable>
  );
}

function PeopleIcon() {
  return (
    <View style={styles.peopleIcon}>
      <View style={styles.peopleHeadRow}>
        <View style={[styles.peopleHead, { opacity: 0.85 }]} />
        <View style={[styles.peopleHead, { opacity: 1 }]} />
      </View>
      <View style={styles.peopleBodyRow}>
        <View style={[styles.peopleBody, { opacity: 0.85 }]} />
        <View style={[styles.peopleBody, { opacity: 1 }]} />
      </View>
    </View>
  );
}

function AllianceRow({ name, members, territories, status }) {
  const isFull = status === 'Full';
  return (
    <View style={styles.allianceRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.allianceName}>{name}</Text>
        <Text style={styles.allianceMeta}>
          {members} members • {territories} territories
        </Text>
      </View>
      <Badge text={status} tone={isFull ? 'full' : 'open'} />
    </View>
  );
}

function FeedRow({ text, time }) {
  return (
    <View style={styles.feedRow}>
      <View style={styles.feedDot} />
      <View style={{ flex: 1 }}>
        <Text style={styles.feedText}>{text}</Text>
        <Text style={styles.feedTime}>{time}</Text>
      </View>
    </View>
  );
}

function MemberRow({ name, role, territories }) {
  return (
    <View style={styles.memberRow}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{name[0]}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.memberName}>{name}</Text>
        <Text style={styles.memberMeta}>
          {role} • {territories} territories
        </Text>
      </View>
    </View>
  );
}

function TerritoryTile({ name, status, isMore }) {
  if (isMore) {
    return (
      <View style={[styles.territoryTile, styles.territoryMore]}>
        <Text style={styles.moreValue}>+59</Text>
        <Text style={styles.moreLabel}>more</Text>
      </View>
    );
  }

  const lower = status.toLowerCase();
  const isContest = lower.includes('contest');
  const pillBg = isContest ? '#FEF3C7' : '#E8F6F1';
  const pillBorder = isContest ? '#FDE68A' : '#C7EADF';
  const pillText = isContest ? '#92400E' : ACCENT;

  return (
    <View style={styles.territoryTile}>
      <Text style={styles.territoryName}>{name}</Text>
      <View style={[styles.statusPill, { backgroundColor: pillBg, borderColor: pillBorder }]}>
        <Text style={[styles.statusText, { color: pillText }]}>{status}</Text>
      </View>
    </View>
  );
}

function NoAllianceState() {
  return (
    <>
      <View style={[styles.card, styles.emptyCard]}>
        <PeopleIcon />
        <Text style={styles.emptyTitle}>You&apos;re fighting alone</Text>
        <Text style={styles.emptySubtitle}>
          Alliance members defend each other&apos;s territories. Solo players are easier to contest.
        </Text>

        <View style={styles.buttonRow}>
          <Button label="Found an alliance" variant="primary" />
          <Button label="Browse open alliances" variant="outline" />
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Open alliances near you</Text>
      </View>

      <View style={styles.card}>
        <AllianceRow name="Iron Wolves" members={14} territories={62} status="Open" />
        <View style={styles.divider} />
        <AllianceRow name="Northern Pact" members={8} territories={31} status="Open" />
        <View style={styles.divider} />
        <AllianceRow name="Canal Saints" members={20} territories={88} status="Full" />
      </View>
    </>
  );
}

function MemberState() {
  return (
    <>
      <View style={[styles.card, styles.allianceHeaderCard]}>
        <View style={styles.allianceHeaderTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.allianceHeaderName}>Iron Wolves</Text>
            <Text style={styles.allianceHeaderMeta}>Founded by Erik V.</Text>
          </View>
          <Badge text="Realm #2" tone="purple" />
        </View>

        <View style={styles.pillsRow}>
          <Pill label="Members" value="14" variant="purple" />
          <Pill label="Territories" value="62" variant="purple" />
          <Pill label="Realm Rank" value="#2" variant="purple" />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Activity</Text>
        <View style={styles.feed}>
          <FeedRow text="Erik V. claimed Rembrandtplein" time="2m ago" />
          <View style={styles.divider} />
          <FeedRow text="Sara R. defended Dam Square" time="14m ago" />
          <View style={styles.divider} />
          <FeedRow text="Mia K. walked 8240 steps" time="1h ago" />
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.cardTopRow}>
          <Text style={styles.cardTitle}>Members</Text>
          <Text style={styles.cardHint}>14 total</Text>
        </View>
        <View style={styles.list}>
          <MemberRow name="Erik V." role="Founder" territories={18} />
          <View style={styles.divider} />
          <MemberRow name="Sara R." role="Officer" territories={12} />
          <View style={styles.divider} />
          <MemberRow name="You" role="Member" territories={3} />
          <View style={styles.divider} />
          <Text style={styles.moreMembers}>+11 more members</Text>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.cardTopRow}>
          <Text style={styles.cardTitle}>Territories</Text>
          <Text style={styles.cardHint}>Owned</Text>
        </View>
        <View style={styles.territoryGrid}>
          <TerritoryTile name="Dam Square" status="Under contest" />
          <TerritoryTile name="Jordaan" status="Secured" />
          <TerritoryTile name="Prinsengracht" status="Secured" />
          <TerritoryTile isMore />
        </View>
      </View>
    </>
  );
}

export default function AllianceScreen() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Alliance</Text>
        <Text style={styles.headerSubtitle}>{isMember ? 'Your squad overview' : 'Find allies nearby'}</Text>
      </View>

      {isMember ? <MemberState /> : <NoAllianceState />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BG,
  },
  content: {
    padding: 16,
    paddingBottom: 28,
  },
  header: {
    paddingVertical: 10,
    paddingHorizontal: 2,
    marginBottom: 10,
  },
  headerTitle: {
    color: TEXT,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    marginTop: 4,
    color: MUTED,
    fontSize: 14,
    fontWeight: '600',
  },
  card: {
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: BORDER,
    marginTop: 12,
  },
  cardTitle: {
    color: TEXT,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.1,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardHint: {
    color: MUTED,
    fontSize: 12,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: BORDER,
    marginVertical: 10,
  },

  // Empty state
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 18,
  },
  peopleIcon: {
    width: 64,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  peopleHeadRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 6,
  },
  peopleHead: {
    width: 18,
    height: 18,
    borderRadius: 999,
    backgroundColor: '#CBD5E1',
  },
  peopleBodyRow: {
    flexDirection: 'row',
    gap: 10,
  },
  peopleBody: {
    width: 24,
    height: 16,
    borderRadius: 10,
    backgroundColor: '#CBD5E1',
  },
  emptyTitle: {
    marginTop: 6,
    color: TEXT,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  emptySubtitle: {
    marginTop: 8,
    color: MUTED,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 8,
  },
  buttonRow: {
    marginTop: 14,
    width: '100%',
    gap: 10,
  },
  button: {
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  buttonPrimary: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  buttonOutline: {
    backgroundColor: CARD,
    borderColor: BORDER,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: -0.1,
  },
  buttonTextPrimary: {
    color: '#FFFFFF',
  },
  buttonTextOutline: {
    color: TEXT,
  },
  sectionHeader: {
    marginTop: 16,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    color: TEXT,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: -0.1,
  },

  // Open alliances list rows
  allianceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  allianceName: {
    color: TEXT,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: -0.1,
  },
  allianceMeta: {
    marginTop: 4,
    color: MUTED,
    fontSize: 12,
    fontWeight: '700',
  },

  // Badges
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeText: {
    fontWeight: '900',
    fontSize: 12,
  },

  // Member state header
  allianceHeaderCard: {
    backgroundColor: '#F6F5FF',
    borderColor: '#DAD7FF',
  },
  allianceHeaderTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  allianceHeaderName: {
    color: TEXT,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  allianceHeaderMeta: {
    marginTop: 6,
    color: MUTED,
    fontSize: 12,
    fontWeight: '700',
  },
  pillsRow: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 10,
  },
  pill: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  pillValue: {
    color: TEXT,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  pillLabel: {
    marginTop: 4,
    color: MUTED,
    fontSize: 12,
    fontWeight: '700',
  },

  // Feed
  feed: {
    marginTop: 12,
  },
  feedRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  feedDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: ACCENT,
    marginTop: 4,
  },
  feedText: {
    color: TEXT,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  feedTime: {
    marginTop: 4,
    color: MUTED,
    fontSize: 12,
    fontWeight: '700',
  },

  // Members list
  list: {
    marginTop: 12,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: '#E8F6F1',
    borderColor: '#C7EADF',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: ACCENT,
    fontWeight: '900',
  },
  memberName: {
    color: TEXT,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: -0.1,
  },
  memberMeta: {
    marginTop: 3,
    color: MUTED,
    fontSize: 12,
    fontWeight: '700',
  },
  moreMembers: {
    color: ALLIANCE,
    fontSize: 12,
    fontWeight: '900',
  },

  // Territories grid
  territoryGrid: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  territoryTile: {
    width: '48.5%',
    backgroundColor: CARD,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: 14,
    paddingHorizontal: 12,
    minHeight: 84,
    justifyContent: 'space-between',
  },
  territoryMore: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  territoryName: {
    color: TEXT,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: -0.1,
  },
  statusPill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '900',
  },
  moreValue: {
    color: TEXT,
    fontSize: 18,
    fontWeight: '900',
  },
  moreLabel: {
    color: MUTED,
    fontSize: 12,
    fontWeight: '700',
  },
});

