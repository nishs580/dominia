// Component: ActivityLogEvent — per-event_type renderer (17 event_types: 8 styled, 10 stubs)
// Surfaces: transparent rows on Ink #101010, 1px hairline-standard divider between rows
// Typography: Geist Mono 500 10px labels, Instrument Sans 500 16px headlines, Geist Mono 400 11px metadata, Archivo 700 32px streak hero number
// Territory colors used (one per row max — accent bar only, never fills):
//   Claim #22D65E: contest_won, streak_milestone (Claim underline per brand "Streak display")
//   Alliance #3155FF: contest_held, contest_defended
//   Enemy #E8432B: contest_lost
//   Slate #6C6C69: contest_expired, streak_broken, all stub rows
// Brand rules applied: meaning-locked colors (Claim=yours, Alliance=ours, Enemy=theirs), 0px radius, no icons, type-driven hierarchy, hairlines visible
//
// HistoryRow (named export) is the Figma-mode row (legacy_tabs off, G8): icon
// tile + territory name + Final event label + time, fed by lib/activityHistory.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Path, Rect } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { getMeta } from '../lib/activityLogMeta';
import { timeAgo } from '../lib/timeAgo';
import { colors, fonts } from '../lib/theme';

const CLAIM = '#22D65E';
const ALLIANCE = '#3155FF';
const ENEMY = '#E8432B';
const SLATE = '#6C6C69';
const BONE = '#F5F4EF';
const SLATE2 = '#A3A29F';

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

// ─── Figma History row (legacy_tabs off; plan 2026-11-27 U13, G8) ──────────
// An icon tile, the territory name as the headline, the Final event label
// under it and the time on the right. `item` comes from
// lib/activityHistory.historyItem.

const TONES = {
  self: { fg: colors.self, bg: 'rgba(34,214,94,0.24)' },
  alliance: { fg: colors.alliance, bg: 'rgba(49,85,255,0.24)' },
  enemy: { fg: colors.enemy, bg: 'rgba(232,67,43,0.24)' },
  neutral: { fg: colors.muted2, bg: colors.raised },
};

function TileGlyph({ icon, color }) {
  if (icon === 'flag') {
    return (
      <Svg width={18} height={18} viewBox="0 0 18 18">
        <Line x1="4" y1="2" x2="4" y2="16" stroke={color} strokeWidth={1.8} />
        <Path d="M4 3 H13 L11 6 L13 9 H4" stroke={color} strokeWidth={1.8} fill="none" strokeLinejoin="miter" />
      </Svg>
    );
  }
  if (icon === 'shield') {
    return (
      <Svg width={18} height={18} viewBox="0 0 18 18">
        <Path d="M9 2 L15 4.5 V9 C15 12.5 12.5 15 9 16 C5.5 15 3 12.5 3 9 V4.5 Z" stroke={color} strokeWidth={1.8} fill="none" />
      </Svg>
    );
  }
  if (icon === 'swords') {
    return (
      <Svg width={18} height={18} viewBox="0 0 18 18">
        <Line x1="3" y1="3" x2="13" y2="13" stroke={color} strokeWidth={1.8} />
        <Line x1="11" y1="15" x2="15" y2="11" stroke={color} strokeWidth={1.8} />
        <Line x1="13" y1="13" x2="15.5" y2="15.5" stroke={color} strokeWidth={1.8} />
        <Line x1="6" y1="8" x2="8" y2="6" stroke={color} strokeWidth={1.8} />
      </Svg>
    );
  }
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18">
      <Rect x="6" y="6" width="6" height="6" fill={color} />
    </Svg>
  );
}

export function HistoryRow({ item }) {
  const { t } = useTranslation();
  const tone = TONES[item.label.tone] || TONES.neutral;
  const label = t(item.label.key, { defaultValue: item.label.defaultValue });
  const headline = item.headline || t('activityLog.territoryFallback', { defaultValue: 'Territory' });
  return (
    <View style={styles.historyRow} accessible accessibilityLabel={`${headline}, ${label}, ${item.time}`}>
      <View style={[styles.historyTile, { backgroundColor: tone.bg }]}>
        <TileGlyph icon={item.label.icon} color={tone.fg} />
      </View>
      <View style={styles.historyText}>
        <Text style={styles.historyHeadline} numberOfLines={1} maxFontSizeMultiplier={1.3}>{headline}</Text>
        <Text style={[styles.historyLabel, { color: tone.fg }]} numberOfLines={1} maxFontSizeMultiplier={1.3}>
          {label}
        </Text>
      </View>
      <Text style={styles.historyTime} maxFontSizeMultiplier={1.3}>{item.time}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 68,
    paddingVertical: 14,
    paddingLeft: 16,
    paddingRight: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  historyTile: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyText: {
    flex: 1,
    paddingHorizontal: 12,
  },
  historyHeadline: {
    fontFamily: fonts.displayBold,
    fontSize: 20,
    lineHeight: 22,
    color: colors.bone,
    textTransform: 'uppercase',
  },
  historyLabel: {
    marginTop: 4,
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  historyTime: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 0.8,
    color: colors.muted2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(245,244,239,0.08)',
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
    fontSize: 11,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  timestamp: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 11,
    letterSpacing: 1.26,
    textTransform: 'uppercase',
    color: SLATE2,
  },
  rowBody: {
    marginTop: 6,
  },
  headline: {
    fontFamily: 'InstrumentSans_500Medium',
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
    fontSize: 11,
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
    fontFamily: 'GeistMono_300Light',
    fontSize: 32,
    color: BONE,
    letterSpacing: -0.96,
    borderBottomWidth: 2,
    borderBottomColor: CLAIM,
    alignSelf: 'flex-start',
    textTransform: 'uppercase',
  },
});
