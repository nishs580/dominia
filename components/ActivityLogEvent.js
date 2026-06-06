// Component: ActivityLogEvent — per-event_type renderer (17 event_types: 7 styled, 10 stubs)
// Surfaces: transparent rows on Ink #0E1014, 1px hairline-standard divider between rows
// Typography: Geist Mono 500 10px labels, Inter 500 16px headlines, Geist Mono 400 11px metadata, Archivo 700 32px streak hero number
// Territory colors used (one per row max — accent bar only, never fills):
//   Claim #D64525: contest_won, streak_milestone (Claim underline per brand "Streak display")
//   Alliance #3F8F4E: contest_held, contest_defended
//   Enemy #4A6B8A: contest_lost
//   Slate #5C6068: contest_expired, streak_broken, all stub rows
// Brand rules applied: meaning-locked colors (Claim=yours, Alliance=ours, Enemy=theirs), 0px radius, no icons, type-driven hierarchy, hairlines visible

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { getMeta } from '../lib/activityLogMeta';
import { timeAgo } from '../lib/timeAgo';

const CLAIM = '#D64525';
const ALLIANCE = '#3F8F4E';
const ENEMY = '#4A6B8A';
const SLATE = '#5C6068';
const BONE = '#F2EEE6';
const SLATE2 = '#8B8F98';

function RowHeader({ label, labelColor, event }) {
  return (
    <View style={styles.rowHeader}>
      <Text style={[styles.label, { color: labelColor }]}>{label}</Text>
      <Text style={styles.timestamp}>{timeAgo(event.occurred_at)}</Text>
    </View>
  );
}

function RowShell({ accentColor, label, labelColor, event, children }) {
  return (
    <View style={styles.row}>
      <View style={[styles.accentBar, { backgroundColor: accentColor }]} />
      <View style={styles.content}>
        <RowHeader label={label} labelColor={labelColor} event={event} />
        {children ? <View style={styles.rowBody}>{children}</View> : null}
      </View>
    </View>
  );
}

function Headline({ children }) {
  return <Text style={styles.headline}>{children}</Text>;
}

function DistanceBody({ text }) {
  if (!text) return null;
  return <Text style={styles.distanceBody}>{text}</Text>;
}

function StreakMilestoneRow({ event }) {
  const days = getMeta(event, 'streakDays', 'streak_days') ?? '—';
  return (
    <RowShell accentColor={CLAIM} label="STREAK MILESTONE" labelColor={CLAIM} event={event}>
      <Text style={styles.heroNumber}>{days}</Text>
      <Text style={styles.supporting}>DAY STREAK</Text>
    </RowShell>
  );
}

function StreakBrokenRow({ event }) {
  const days = getMeta(event, 'previous_streak', 'previousStreak', 'streak_days', 'streakDays') ?? '—';
  const graceDayUsed = getMeta(event, 'grace_day_used', 'graceDayUsed') === true;
  return (
    <RowShell accentColor={SLATE} label="STREAK BROKEN" labelColor={SLATE2} event={event}>
      <Headline>{days}-day streak ended</Headline>
      {graceDayUsed ? <Text style={styles.graceDayLine}>GRACE DAY USED</Text> : null}
    </RowShell>
  );
}

function ContestWonRow({ event }) {
  const attackerWalked = getMeta(event, 'attacker_walked_m', 'attackerWalkedM');
  const required = getMeta(event, 'required_walk_m', 'requiredWalkM');
  const bodyText =
    attackerWalked != null && required != null
      ? `${attackerWalked}m of ${required}m walked`
      : null;
  return (
    <RowShell accentColor={CLAIM} label="TERRITORY WON" labelColor={CLAIM} event={event}>
      {bodyText ? <DistanceBody text={bodyText} /> : null}
    </RowShell>
  );
}

function ContestLostRow({ event }) {
  const attackerWalked = getMeta(event, 'attacker_walked_m', 'attackerWalkedM');
  const required = getMeta(event, 'required_walk_m', 'requiredWalkM');
  const bodyText =
    attackerWalked != null && required != null
      ? `${attackerWalked}m of ${required}m walked`
      : null;
  return (
    <RowShell accentColor={ENEMY} label="TERRITORY LOST" labelColor={ENEMY} event={event}>
      {bodyText ? <DistanceBody text={bodyText} /> : null}
    </RowShell>
  );
}

function ContestHeldRow({ event }) {
  const attackerWalked = getMeta(event, 'attacker_walked_m', 'attackerWalkedM');
  const required = getMeta(event, 'required_walk_m', 'requiredWalkM');
  const bodyText =
    attackerWalked != null && required != null
      ? `${attackerWalked}m of ${required}m attempted`
      : null;
  return (
    <RowShell accentColor={ALLIANCE} label="TERRITORY HELD" labelColor={ALLIANCE} event={event}>
      {bodyText ? <DistanceBody text={bodyText} /> : null}
    </RowShell>
  );
}

function ContestExpiredRow({ event }) {
  const attackerWalked = getMeta(event, 'attackerWalkedM', 'attacker_walked_m');
  const required = getMeta(event, 'requiredWalkM', 'required_walk_m');
  const bodyText =
    attackerWalked != null && required != null
      ? `${attackerWalked}m of ${required}m attempted`
      : null;
  return (
    <RowShell accentColor={SLATE} label="CONTEST EXPIRED" labelColor={SLATE2} event={event}>
      {bodyText ? <DistanceBody text={bodyText} /> : null}
    </RowShell>
  );
}

function ContestDefendedRow({ event }) {
  const defenderWalked = getMeta(event, 'defender_walked_m', 'defenderWalkedM');
  const bodyText = defenderWalked != null ? `${defenderWalked}m walked in defence` : null;
  return (
    <RowShell accentColor={ALLIANCE} label="TERRITORY DEFENDED" labelColor={ALLIANCE} event={event}>
      {bodyText ? <DistanceBody text={bodyText} /> : null}
    </RowShell>
  );
}

const STUB_TITLES = {
  challenge_completed: 'CHALLENGE COMPLETED',
  territory_claimed: 'TERRITORY CLAIMED',
  territory_abandoned: 'TERRITORY ABANDONED',
  alliance_founded: 'ALLIANCE FOUNDED',
  alliance_joined: 'JOINED ALLIANCE',
  alliance_left: 'LEFT ALLIANCE',
  alliance_kicked: 'REMOVED FROM ALLIANCE',
  alliance_promoted: 'PROMOTED',
  alliance_demoted: 'DEMOTED',
  alliance_role_changed: 'ROLE CHANGED',
};

function GenericRow({ event, title }) {
  return (
    <RowShell accentColor={SLATE} label={title} labelColor={SLATE2} event={event} />
  );
}

export default function ActivityLogEvent({ event }) {
  switch (event.event_type) {
    case 'streak_milestone':
      return <StreakMilestoneRow event={event} />;
    case 'streak_broken':
      return <StreakBrokenRow event={event} />;
    case 'contest_won':
      return <ContestWonRow event={event} />;
    case 'contest_lost':
      return <ContestLostRow event={event} />;
    case 'contest_held':
      return <ContestHeldRow event={event} />;
    case 'contest_expired':
      return <ContestExpiredRow event={event} />;
    case 'contest_defended':
      return <ContestDefendedRow event={event} />;
    default: {
      const title = STUB_TITLES[event.event_type] ?? 'ACTIVITY';
      return <GenericRow event={event} title={title} />;
    }
  }
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(242,238,230,0.08)',
    paddingVertical: 14,
    paddingRight: 16,
  },
  accentBar: {
    width: 2,
    alignSelf: 'stretch',
    marginRight: 14,
  },
  content: {
    flex: 1,
    flexDirection: 'column',
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  label: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 10,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  timestamp: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 9,
    letterSpacing: 1.26,
    textTransform: 'uppercase',
    color: SLATE2,
  },
  rowBody: {
    marginTop: 6,
  },
  headline: {
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
    color: BONE,
    letterSpacing: -0.24,
  },
  supporting: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 11,
    letterSpacing: 0.22,
    textTransform: 'uppercase',
    color: SLATE2,
    marginTop: 4,
  },
  graceDayLine: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 10,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: SLATE2,
    marginTop: 4,
  },
  distanceBody: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 13,
    letterSpacing: 0.26,
    color: BONE,
  },
  heroNumber: {
    fontFamily: 'Archivo_700Bold',
    fontSize: 32,
    color: BONE,
    letterSpacing: -0.96,
    borderBottomWidth: 2,
    borderBottomColor: CLAIM,
    alignSelf: 'flex-start',
  },
});
