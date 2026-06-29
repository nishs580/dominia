// BRAND
// - Geist Mono only (terminal coherence)
// - All uppercase
// - 2px left accent bar per family color
// - 0px corners (no rounded anywhere)
// - No icons, no shadows
// Family colors:
//   CLAIM red   #D64525 → alliance_founded (significant ownership moment)
//   ALLIANCE_GREEN #3F8F4E → alliance_joined, alliance_promoted (positive)
//   SLATE       #5C6068 → alliance_left, alliance_demoted (neutral/voluntary)
//   ENEMY red   #B83E2B → alliance_kicked (involuntary removal)

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { getMeta } from '../lib/activityLogMeta';
import { timeAgo } from '../lib/timeAgo';

const CLAIM = '#D64525';
const ALLIANCE_GREEN = '#3F8F4E';
const SLATE = '#5C6068';
const ENEMY = '#B83E2B';
const BONE = '#F2EEE6';
const SLATE2 = '#8B8F98';

function subjectName(t, event) {
  return (event.subject_username ?? t('allianceEvent.formerMember')).toUpperCase();
}

function actorName(t, event) {
  return (event.actor_username ?? t('allianceEvent.formerMember')).toUpperCase();
}

function AllianceFoundedRow({ event }) {
  const { t } = useTranslation();
  const subject = subjectName(t, event);
  const shortName = getMeta(event, 'short_name') ?? '—';
  const fullName = getMeta(event, 'full_name');

  return (
    <View style={[styles.row, { borderLeftColor: CLAIM }]}>
      <View style={styles.topRow}>
        <Text style={styles.headline}>{t('allianceEvent.founded', { subject, name: shortName })}</Text>
        <Text style={styles.timeAgo}>{timeAgo(event.occurred_at)}</Text>
      </View>
      {fullName ? (
        <Text style={styles.body}>{t('allianceEvent.foundedBody', { name: String(fullName).toUpperCase() })}</Text>
      ) : null}
    </View>
  );
}

function AllianceJoinedRow({ event }) {
  const { t } = useTranslation();
  const subject = subjectName(t, event);
  const role = (getMeta(event, 'role') ?? 'MEMBER').toUpperCase();

  return (
    <View style={[styles.row, { borderLeftColor: ALLIANCE_GREEN }]}>
      <View style={styles.topRow}>
        <Text style={styles.headline}>{t('allianceEvent.joined', { subject })}</Text>
        <Text style={styles.timeAgo}>{timeAgo(event.occurred_at)}</Text>
      </View>
      <Text style={styles.body}>{t('allianceEvent.joinedBody', { role })}</Text>
    </View>
  );
}

function AllianceLeftRow({ event }) {
  const { t } = useTranslation();
  const subject = subjectName(t, event);

  return (
    <View style={[styles.row, { borderLeftColor: SLATE }]}>
      <View style={styles.topRow}>
        <Text style={styles.headline}>{t('allianceEvent.left', { subject })}</Text>
        <Text style={styles.timeAgo}>{timeAgo(event.occurred_at)}</Text>
      </View>
    </View>
  );
}

function AlliancePromotedRow({ event }) {
  const { t } = useTranslation();
  const actor = actorName(t, event);
  const subject = subjectName(t, event);
  const prev = (getMeta(event, 'previous_role') ?? '?').toUpperCase();
  const next = (getMeta(event, 'new_role') ?? '?').toUpperCase();

  return (
    <View style={[styles.row, { borderLeftColor: ALLIANCE_GREEN }]}>
      <View style={styles.topRow}>
        <Text style={styles.headline}>{t('allianceEvent.promoted', { actor, subject })}</Text>
        <Text style={styles.timeAgo}>{timeAgo(event.occurred_at)}</Text>
      </View>
      <Text style={styles.body}>{t('allianceEvent.roleChange', { prev, next })}</Text>
    </View>
  );
}

function AllianceDemotedRow({ event }) {
  const { t } = useTranslation();
  const actor = actorName(t, event);
  const subject = subjectName(t, event);
  const prev = (getMeta(event, 'previous_role') ?? '?').toUpperCase();
  const next = (getMeta(event, 'new_role') ?? '?').toUpperCase();

  return (
    <View style={[styles.row, { borderLeftColor: SLATE }]}>
      <View style={styles.topRow}>
        <Text style={styles.headline}>{t('allianceEvent.demoted', { actor, subject })}</Text>
        <Text style={styles.timeAgo}>{timeAgo(event.occurred_at)}</Text>
      </View>
      <Text style={styles.body}>{t('allianceEvent.roleChange', { prev, next })}</Text>
    </View>
  );
}

function AllianceKickedRow({ event }) {
  const { t } = useTranslation();
  const actor = actorName(t, event);
  const subject = subjectName(t, event);
  const prevRole = (getMeta(event, 'previous_role') ?? 'MEMBER').toUpperCase();

  return (
    <View style={[styles.row, { borderLeftColor: ENEMY }]}>
      <View style={styles.topRow}>
        <Text style={styles.headline}>{t('allianceEvent.kicked', { actor, subject })}</Text>
        <Text style={styles.timeAgo}>{timeAgo(event.occurred_at)}</Text>
      </View>
      <Text style={styles.body}>{t('allianceEvent.kickedBody', { role: prevRole })}</Text>
    </View>
  );
}

export default function AllianceLogEvent({ event }) {
  switch (event.event_type) {
    case 'alliance_founded':
      return <AllianceFoundedRow event={event} />;
    case 'alliance_joined':
      return <AllianceJoinedRow event={event} />;
    case 'alliance_left':
      return <AllianceLeftRow event={event} />;
    case 'alliance_promoted':
      return <AlliancePromotedRow event={event} />;
    case 'alliance_demoted':
      return <AllianceDemotedRow event={event} />;
    case 'alliance_kicked':
      return <AllianceKickedRow event={event} />;
    default:
      return null;
  }
}

const styles = StyleSheet.create({
  row: {
    borderLeftWidth: 2,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(242,238,230,0.05)',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  headline: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 11,
    color: BONE,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    flex: 1,
    marginRight: 8,
  },
  body: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 9,
    color: SLATE2,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  timeAgo: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 9,
    color: SLATE,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    flexShrink: 0,
  },
});
