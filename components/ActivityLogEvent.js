// Component: ActivityLogEvent — per-event_type renderer (17 event_types: 8 styled, 10 stubs)
// Surfaces: transparent rows on Ink #000000, 1px hairline-standard divider between rows
// Typography: Geist Mono 500 10px labels, Instrument Sans 500 16px headlines, Geist Mono 400 11px metadata, Archivo 700 32px streak hero number
// Territory colors used (one per row max — accent bar only, never fills):
//   Claim #84FF44: contest_won, streak_milestone (Claim underline per brand "Streak display")
//   Alliance (colors.alliance): contest_held, contest_defended
//   Enemy #E34234: contest_lost
//   Slate rgba(253,253,253,0.30): contest_expired, streak_broken, all stub rows
// Brand rules applied: meaning-locked colors (Claim=yours, Alliance=ours, Enemy=theirs), 0px radius, no icons, type-driven hierarchy, hairlines visible
//
// HistoryRow (named export) is the Dominia-Temp row (legacy_tabs off, board
// 40): icon tile + territory name + Final event label + day and time, fed by
// lib/activityHistory.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { getMeta } from '../lib/activityLogMeta';
import { timeAgo } from '../lib/timeAgo';
import { colors, fonts } from '../lib/theme';
import { CutCard, SlantTile } from './ui';
import { FlagGlyph, ShieldGlyph, SwordsGlyph } from './SocialGlyphs';

const CLAIM = '#84FF44';
const ALLIANCE = colors.alliance;
const ENEMY = '#E34234';
const SLATE = 'rgba(253,253,253,0.30)';
const BONE = '#FDFDFD';
const SLATE2 = 'rgba(253,253,253,0.62)';

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
  const { t } = useTranslation();
  const days = getMeta(event, 'streakDays', 'streak_days') ?? '—';
  return (
    <RowShell accentColor={CLAIM} label={t('activityEvent.streakMilestone')} labelColor={CLAIM} event={event}>
      <Text style={styles.heroNumber} maxFontSizeMultiplier={1.2}>{days}</Text>
      <Text style={styles.supporting}>{t('activityEvent.dayStreak')}</Text>
    </RowShell>
  );
}

function LeveledUpRow({ event }) {
  const { t } = useTranslation();
  const levelAfter = getMeta(event, 'level_after', 'levelAfter') ?? '—';
  return (
    <RowShell accentColor={CLAIM} label={t('activityEvent.leveledUp')} labelColor={CLAIM} event={event}>
      <Text style={styles.heroNumber} maxFontSizeMultiplier={1.2}>{levelAfter}</Text>
      <Text style={styles.supporting}>{t('activityEvent.levelReached')}</Text>
    </RowShell>
  );
}

function StreakBrokenRow({ event }) {
  const { t } = useTranslation();
  const days = getMeta(event, 'previous_streak', 'previousStreak', 'streak_days', 'streakDays') ?? '—';
  const graceDayUsed = getMeta(event, 'grace_day_used', 'graceDayUsed') === true;
  return (
    <RowShell accentColor={SLATE} label={t('activityEvent.streakBroken')} labelColor={SLATE2} event={event}>
      <Headline>{t('activityEvent.streakEnded', { days })}</Headline>
      {graceDayUsed ? <Text style={styles.graceDayLine}>{t('activityEvent.graceDayUsed')}</Text> : null}
    </RowShell>
  );
}

function ContestWonRow({ event }) {
  const { t } = useTranslation();
  const attackerWalked = getMeta(event, 'attacker_walked_m', 'attackerWalkedM');
  const required = getMeta(event, 'required_walk_m', 'requiredWalkM');
  const bodyText =
    attackerWalked != null && required != null
      ? t('activityEvent.walkedOf', { walked: attackerWalked, required })
      : null;
  return (
    <RowShell accentColor={CLAIM} label={t('activityEvent.territoryWon')} labelColor={CLAIM} event={event}>
      {bodyText ? <DistanceBody text={bodyText} /> : null}
    </RowShell>
  );
}

function ContestLostRow({ event }) {
  const { t } = useTranslation();
  const attackerWalked = getMeta(event, 'attacker_walked_m', 'attackerWalkedM');
  const required = getMeta(event, 'required_walk_m', 'requiredWalkM');
  const bodyText =
    attackerWalked != null && required != null
      ? t('activityEvent.walkedOf', { walked: attackerWalked, required })
      : null;
  return (
    <RowShell accentColor={ENEMY} label={t('activityEvent.territoryLost')} labelColor={ENEMY} event={event}>
      {bodyText ? <DistanceBody text={bodyText} /> : null}
    </RowShell>
  );
}

function ContestHeldRow({ event }) {
  const { t } = useTranslation();
  const attackerWalked = getMeta(event, 'attacker_walked_m', 'attackerWalkedM');
  const required = getMeta(event, 'required_walk_m', 'requiredWalkM');
  const bodyText =
    attackerWalked != null && required != null
      ? t('activityEvent.attemptedOf', { walked: attackerWalked, required })
      : null;
  return (
    <RowShell accentColor={ALLIANCE} label={t('activityEvent.territoryHeld')} labelColor={ALLIANCE} event={event}>
      {bodyText ? <DistanceBody text={bodyText} /> : null}
    </RowShell>
  );
}

function ContestExpiredRow({ event }) {
  const { t } = useTranslation();
  const attackerWalked = getMeta(event, 'attackerWalkedM', 'attacker_walked_m');
  const required = getMeta(event, 'requiredWalkM', 'required_walk_m');
  const bodyText =
    attackerWalked != null && required != null
      ? t('activityEvent.attemptedOf', { walked: attackerWalked, required })
      : null;
  return (
    <RowShell accentColor={SLATE} label={t('activityEvent.contestExpired')} labelColor={SLATE2} event={event}>
      {bodyText ? <DistanceBody text={bodyText} /> : null}
    </RowShell>
  );
}

function ContestDefendedRow({ event }) {
  const { t } = useTranslation();
  const defenderWalked = getMeta(event, 'defender_walked_m', 'defenderWalkedM');
  const bodyText = defenderWalked != null ? t('activityEvent.walkedInDefence', { walked: defenderWalked }) : null;
  return (
    <RowShell accentColor={ALLIANCE} label={t('activityEvent.territoryDefended')} labelColor={ALLIANCE} event={event}>
      {bodyText ? <DistanceBody text={bodyText} /> : null}
    </RowShell>
  );
}

function TerritoryDevelopedRow({ event }) {
  const { t } = useTranslation();
  const territoryName = getMeta(event, 'territory_name', 'territoryName') ?? '—';
  const newLevel = getMeta(event, 'new_level', 'newLevel') ?? '—';
  // Backend metadata carries the English level_name; translate from the
  // numeric level when we can so ru renders localised names.
  const levelName = Number.isInteger(Number(newLevel))
    ? t(`map.devLevelName.${newLevel}`)
    : getMeta(event, 'level_name', 'levelName') ?? '';
  return (
    <RowShell accentColor={CLAIM} label={t('activityEvent.territoryDeveloped')} labelColor={CLAIM} event={event}>
      <Headline>{t('activityEvent.developedHeadline', { territory: territoryName, levelName })}</Headline>
      <Text style={styles.supporting}>{t('activityEvent.developedSub', { level: newLevel })}</Text>
    </RowShell>
  );
}

function InfluenceMilestoneRow({ event }) {
  const { t } = useTranslation();
  const milestone = getMeta(event, 'milestone') ?? '—';
  return (
    <RowShell accentColor={SLATE} label={t('activityEvent.influenceMilestone')} labelColor={SLATE2} event={event}>
      <Text style={styles.heroNumber} maxFontSizeMultiplier={1.2}>{Number(milestone).toLocaleString()}</Text>
      <Text style={styles.supporting}>{t('activityEvent.influenceAccumulated')}</Text>
    </RowShell>
  );
}

function GenericRow({ event, title }) {
  return (
    <RowShell accentColor={SLATE} label={title} labelColor={SLATE2} event={event} />
  );
}

export default function ActivityLogEvent({ event }) {
  const { t, i18n } = useTranslation();
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
    case 'leveled_up':
      return <LeveledUpRow event={event} />;
    case 'territory_developed':
      return <TerritoryDevelopedRow event={event} />;
    case 'influence_milestone':
      return <InfluenceMilestoneRow event={event} />;
    default: {
      const stubKey = `activityEvent.stub.${event.event_type}`;
      const title = (i18n.exists(stubKey) ? t(stubKey) : '') || t('activityEvent.fallback');
      return <GenericRow event={event} title={title} />;
    }
  }
}

// ─── Dominia-Temp History row (legacy_tabs off; board 40, plan 2026-11-28 U11)
// A cut-corner card: a slanted icon tile (flag / swords / shield, lime on
// success and red on failure), the territory name over the event label, and
// the day stamp over the time on the right. `item` comes from
// lib/activityHistory.historyItem.

const TONES = {
  success: colors.lime,
  failure: colors.danger,
  neutral: colors.muted2,
};

function TileGlyph({ icon, color }) {
  if (icon === 'flag') return <FlagGlyph size={18} color={color} />;
  if (icon === 'shield') return <ShieldGlyph size={18} color={color} />;
  if (icon === 'swords') return <SwordsGlyph size={18} color={color} />;
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18">
      <Rect x="6" y="6" width="6" height="6" fill={color} />
    </Svg>
  );
}

export function HistoryRow({ item }) {
  const { t } = useTranslation();
  const color = TONES[item.label.tone] || TONES.neutral;
  const raw = t(item.label.key, { defaultValue: item.label.defaultValue });
  // Legacy stub copy is shouted ("TERRITORY DEVELOPED"); the Figma history
  // rows are sentence case.
  const label = raw === raw.toUpperCase() ? raw.charAt(0) + raw.slice(1).toLowerCase() : raw;
  const headline = item.headline || t('activityLog.territoryFallback', { defaultValue: 'Territory' });
  return (
    <CutCard
      padding={0}
      style={styles.historyCard}
      accessibilityLabel={[headline, label, item.date, item.time].filter(Boolean).join(', ')}
    >
      <View style={styles.historyRow}>
        <SlantTile size={36} square tone="raised">
          <TileGlyph icon={item.label.icon} color={color} />
        </SlantTile>
        <View style={styles.historyText}>
          <Text style={styles.historyHeadline} numberOfLines={1} maxFontSizeMultiplier={1.3}>{headline}</Text>
          <Text style={styles.historyLabel} numberOfLines={1} maxFontSizeMultiplier={1.3}>{label}</Text>
        </View>
        <View style={styles.historyWhen}>
          {item.date ? (
            <Text style={styles.historyDate} maxFontSizeMultiplier={1.3}>{item.date}</Text>
          ) : null}
          <Text style={styles.historyTime} maxFontSizeMultiplier={1.3}>{item.time}</Text>
        </View>
      </View>
    </CutCard>
  );
}

const styles = StyleSheet.create({
  historyCard: {
    marginBottom: 8,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingVertical: 10,
    paddingLeft: 12,
    paddingRight: 14,
  },
  historyText: {
    flex: 1,
    paddingHorizontal: 12,
  },
  historyHeadline: {
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    color: colors.white,
  },
  historyLabel: {
    marginTop: 1,
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.muted2,
  },
  historyWhen: {
    alignItems: 'flex-end',
  },
  historyDate: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.white,
  },
  historyTime: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.muted2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(253,253,253,0.08)',
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
    fontFamily: 'IBMPlexSans_600SemiBold',
    fontSize: 11,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  timestamp: {
    fontFamily: 'IBMPlexSans_700Bold',
    fontSize: 11,
    letterSpacing: 1.26,
    textTransform: 'uppercase',
    color: SLATE2,
  },
  rowBody: {
    marginTop: 6,
  },
  headline: {
    fontFamily: 'IBMPlexSans_600SemiBold',
    fontSize: 16,
    color: BONE,
    letterSpacing: -0.24,
  },
  supporting: {
    fontFamily: 'IBMPlexSans_700Bold',
    fontSize: 11,
    letterSpacing: 0.22,
    textTransform: 'uppercase',
    color: SLATE2,
    marginTop: 4,
  },
  graceDayLine: {
    fontFamily: 'IBMPlexSans_700Bold',
    fontSize: 11,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: SLATE2,
    marginTop: 4,
  },
  distanceBody: {
    fontFamily: 'IBMPlexSans_600SemiBold',
    fontSize: 13,
    letterSpacing: 0.26,
    color: BONE,
  },
  heroNumber: {
    fontFamily: 'IBMPlexSans_600SemiBold',
    fontSize: 32,
    color: BONE,
    letterSpacing: -0.96,
    borderBottomWidth: 2,
    borderBottomColor: CLAIM,
    alignSelf: 'flex-start',
    textTransform: 'uppercase',
  },
});
