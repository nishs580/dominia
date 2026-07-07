import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { colors, fonts } from '../lib/theme';
import { getWeeklyTask } from '../lib/weeklyTaskApi';
import { formatTaskValue } from '../lib/weeklyTaskFormat';

/**
 * Top contributors to the alliance's weekly collective mission — the dynamic
 * counterpart to the two-bar WeeklyTaskCard, shown lower on the Alliance tab.
 *
 * Reads the same GET /alliances/:id/weekly-task payload (the `top_contributors`
 * field, which the backend exposes to every member — unlike the founder-only
 * breakdown). Ranks by contribution to the current week's task; the metric and
 * unit follow whatever task is active, so "steps" here is really "distance /
 * calories / claims / drill days" depending on the week.
 */

function formatRole(t, role) {
  if (!role) return t('alliance.roleMember');
  if (role === 'founder') return t('alliance.roleFounder');
  return role.toUpperCase();
}

export default function WeeklyTopContributors({ allianceId, getToken }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const hasLoadedRef = useRef(false);

  const fetchList = useCallback(async () => {
    if (!allianceId) return;
    if (!hasLoadedRef.current) setLoading(true);
    const res = await getWeeklyTask({
      clerkGetToken: () => getTokenRef.current(),
      allianceId,
    });
    if (res.ok) setData(res.data);
    hasLoadedRef.current = true;
    setLoading(false);
  }, [allianceId]);

  useFocusEffect(
    useCallback(() => {
      fetchList();
    }, [fetchList]),
  );

  if (loading) {
    return (
      <View style={styles.stateBlock}>
        <ActivityIndicator color={colors.slate2} />
      </View>
    );
  }

  const contributors = data?.top_contributors ?? [];
  const unit = data?.task?.unit;

  if (contributors.length === 0 || !unit) {
    return <Text style={styles.emptyText}>{t('alliance.topContributorsEmpty')}</Text>;
  }

  return (
    <>
      {contributors.map((c, i) => (
        <React.Fragment key={c.player_id}>
          <View style={styles.contributorRow}>
            <Text style={styles.contributorRank}>{i + 1}.</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.contributorName}>{c.username}</Text>
              <Text style={styles.contributorMeta}>{formatRole(t, c.role)}</Text>
            </View>
            <Text style={styles.contributorSteps}>
              {formatTaskValue(t, unit, c.contribution)}
            </Text>
          </View>
          {i < contributors.length - 1 && <View style={styles.rowDivider} />}
        </React.Fragment>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  stateBlock: { paddingVertical: 20, alignItems: 'center' },
  emptyText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.slate2,
    paddingVertical: 16,
  },
  contributorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 12,
  },
  contributorRank: {
    fontFamily: fonts.monoMedium,
    fontSize: 11,
    color: colors.claim,
    width: 20,
  },
  contributorName: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.bone,
    textTransform: 'uppercase',
  },
  contributorMeta: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.slate2,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: 3,
  },
  contributorSteps: {
    fontFamily: fonts.monoMedium,
    fontSize: 13,
    color: colors.bone,
  },
  rowDivider: {
    height: 1,
    backgroundColor: colors.hairline,
  },
});
