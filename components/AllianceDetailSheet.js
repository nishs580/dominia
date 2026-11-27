/**
 * components/AllianceDetailSheet.js
 *
 * Dominia-Temp alliance detail modal (Alliance case 3; alliance_hq_create
 * off). Opens from a row in the alliance list: a centred dark panel titled
 * ALLIANCE with ×, the blue shield emblem beside "NAME - TAG" and the
 * description, a LOCATION | TERRITORIES | TYPE grid, MEMBERS n / 20 with JOIN
 * (or REQUEST TO JOIN by join_type, with the Request sent / full states), and
 * the member list ranked by territories held.
 *
 * Also exports the pieces the member view (case 4) in screens/AllianceScreen.js
 * reuses so both read the same way: AllianceEmblemTile, AllianceStatsGrid,
 * AllianceMembersCount and AllianceMemberRow.
 *
 * Description and rules render as plain <Text> — no link detection.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import AllianceEmblem from './AllianceEmblem';
import { CutCard, SlantButton, SlantTile } from './ui';
import { colors, fonts } from '../lib/theme';
import { avatarThumb } from '../lib/avatar';
import { getAllianceById, joinAlliance, normalizeAllianceDetail } from '../lib/allianceApi';
import { ALLIANCE_MAX_MEMBERS, isAllianceFull, joinErrorKey } from '../lib/allianceValidation';
import {
  hasPendingRequest, joinButtonState, joinOutcome, joinTypeLabelKey, padRank,
} from '../lib/allianceJoin';
import { displayRole } from '../lib/allianceRoles';

const PERSON_XML = `<svg viewBox="0 0 16 16" fill="none" stroke="${colors.white}" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="5.5" r="2.75"/><path d="M3 13.5c.6-2.4 2.6-3.75 5-3.75s4.4 1.35 5 3.75"/></svg>`;

/** Name only, upper-cased. */
export function allianceName(alliance) {
  return (alliance?.name ?? '').toUpperCase();
}

/** "[TAG]" or '' when there is no tag. */
export function allianceTag(alliance) {
  const tag = (alliance?.short_name ?? '').toUpperCase();
  return tag ? `[${tag}]` : '';
}

/** "Name - TAG" (list rows and headers); just the name when there is no tag. */
export function allianceTitle(alliance) {
  const name = alliance?.name ?? '';
  const tag = (alliance?.short_name ?? '').toUpperCase();
  return tag ? `${name} - ${tag}` : name;
}

/**
 * The text shown under the alliance name. The create form only collects
 * Rules, so an alliance founded there has rules but no description; fall back
 * to rules so the founder's text still appears. Plain text, no link detection.
 */
export function allianceBlurb(alliance) {
  const d = typeof alliance?.description === 'string' ? alliance.description.trim() : '';
  if (d) return d;
  return typeof alliance?.rules === 'string' ? alliance.rules.trim() : '';
}

/** Blue shield emblem (case 3 / case 4 headers). */
export function AllianceEmblemTile({ emblem, size = 64 }) {
  return (
    <View style={{ width: size, height: size }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <AllianceEmblem emblem={emblem} size={size} glyph={colors.white} shield={colors.white} field={colors.action} />
    </View>
  );
}

/** Mixed-case role title: Captain / Commander / Lieutenant / Troop. */
export function useRoleTitle() {
  const { t } = useTranslation();
  return (storedRole) => {
    const role = displayRole(storedRole);
    const cap = role.charAt(0).toUpperCase() + role.slice(1);
    return t(`allianceFigma.roleName${cap}`, { defaultValue: cap });
  };
}

/** LOCATION | TERRITORIES | TYPE in one row of three cells. */
export function AllianceStatsGrid({ location, territories, joinType }) {
  const { t } = useTranslation();
  const invite = joinTypeLabelKey(joinType).endsWith('InviteOnly');
  const cells = [
    { key: 'loc', label: t('allianceFigma.location', { defaultValue: 'LOCATION' }), value: location || '—' },
    { key: 'terr', label: t('allianceFigma.territories', { defaultValue: 'TERRITORIES' }), value: territories ?? '—' },
    {
      key: 'type',
      label: t('allianceFigma.type', { defaultValue: 'TYPE' }),
      value: invite
        ? t('allianceFigma.typeInviteOnlyTitle', { defaultValue: 'Invite Only' })
        : t('allianceFigma.typeOpenTitle', { defaultValue: 'Open' }),
    },
  ];
  return (
    <View style={styles.grid}>
      {cells.map((c, i) => (
        <View
          key={c.key}
          style={[styles.gridCell, i < cells.length - 1 && styles.gridCellDivider]}
          accessible
          accessibilityLabel={`${c.label} ${c.value}`}
        >
          <Text style={styles.gridLabel} maxFontSizeMultiplier={1.3}>{c.label}</Text>
          <Text style={styles.gridValue} numberOfLines={1} maxFontSizeMultiplier={1.3}>{String(c.value)}</Text>
        </View>
      ))}
    </View>
  );
}

/** "MEMBERS  16 / 20" — stacked (case 3) or inline (case 4). */
export function AllianceMembersCount({ count, inline = false }) {
  const { t } = useTranslation();
  const label = t('allianceFigma.members', { defaultValue: 'MEMBERS' });
  const value = `${padRank(count ?? 0)} / ${ALLIANCE_MAX_MEMBERS}`;
  return (
    <View
      style={inline ? styles.countInline : null}
      accessible
      accessibilityLabel={`${label} ${count ?? 0} / ${ALLIANCE_MAX_MEMBERS}`}
    >
      <Text style={styles.gridLabel} maxFontSizeMultiplier={1.3}>{label}</Text>
      <Text style={[styles.countValue, inline && styles.countValueInline]} maxFontSizeMultiplier={1.3}>{value}</Text>
    </View>
  );
}

/** [1] [avatar] Moksh / Captain ............ 16 Territories */
export function AllianceMemberRow({ rank, member, onPress }) {
  const { t } = useTranslation();
  const roleTitle = useRoleTitle();
  const name = member?.username ?? '—';
  const roleText = roleTitle(member?.role);
  const held = t('allianceFigma.territoriesHeld', {
    count: padRank(member?.territories_held ?? 0),
    defaultValue: '{{count}} Territories',
  });
  const a11y = `${rank}. ${name}, ${roleText}, ${held}`;
  const avatarUrl = member?.avatar_url ?? null;
  return (
    <CutCard
      padding={8}
      onPress={onPress}
      accessibilityLabel={a11y}
      style={styles.memberCard}
    >
      <View style={styles.memberRow}>
        <View style={styles.rankTile}>
          <Text style={styles.rankText} maxFontSizeMultiplier={1.3}>{rank}</Text>
        </View>
        <SlantTile size={34} square tone="raised" slant={8} style={styles.avatarTile}>
          {avatarUrl ? (
            <Image source={{ uri: avatarThumb(avatarUrl, 32) }} style={styles.avatarImg} />
          ) : (
            <SvgXml xml={PERSON_XML} width={16} height={16} />
          )}
        </SlantTile>
        <View style={styles.memberText}>
          <Text style={styles.memberName} numberOfLines={1} maxFontSizeMultiplier={1.3}>{name}</Text>
          <Text style={styles.memberRole} numberOfLines={1} maxFontSizeMultiplier={1.3}>{roleText}</Text>
        </View>
        <Text style={styles.memberHeld} maxFontSizeMultiplier={1.3}>{held}</Text>
      </View>
    </CutCard>
  );
}

export default function AllianceDetailSheet({ alliance: listItem, getToken, onClose, onJoined }) {
  const { t } = useTranslation();
  const visible = Boolean(listItem?.id);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState('');
  const [requested, setRequested] = useState(false);

  const load = useCallback(async () => {
    if (!listItem?.id) return;
    setLoading(true);
    setLoadError(false);
    const res = await getAllianceById({ clerkGetToken: getToken, allianceId: listItem.id });
    if (res.ok) setDetail(normalizeAllianceDetail(res.data));
    else setLoadError(true);
    setLoading(false);
  }, [listItem?.id, getToken]);

  useEffect(() => {
    setDetail(null);
    setJoinError('');
    setJoining(false);
    setRequested(false);
    if (listItem?.id) load();
  }, [listItem?.id, load]);

  const alliance = detail?.alliance ?? listItem ?? {};
  const members = detail?.members ?? [];
  const memberCount = detail ? members.length : listItem?.member_count ?? 0;
  const full = isAllianceFull({ member_count: memberCount });
  const territories = Number.isFinite(listItem?.territory_count)
    ? listItem.territory_count
    : members.reduce((sum, m) => sum + m.territories_held, 0);
  const joinType = detail?.alliance?.join_type ?? listItem?.join_type;
  const isRequested = requested || hasPendingRequest(detail?.alliance);
  const button = joinButtonState({ joinType, requested: isRequested, full, joining });

  const handleJoin = async () => {
    if (!listItem?.id || button.disabled) return;
    setJoining(true);
    setJoinError('');
    try {
      const res = await joinAlliance({ clerkGetToken: getToken, allianceId: listItem.id });
      if (res.ok) {
        if (joinOutcome(res.data) === 'requested') {
          setRequested(true);
          return;
        }
        await onJoined?.(listItem.id);
        return;
      }
      setJoinError(t(joinErrorKey(res.error)));
    } catch (err) {
      console.error('Join alliance failed:', err);
      setJoinError(t('alliance.errCouldNotJoin'));
    } finally {
      setJoining(false);
    }
  };

  const joinLabel = t(button.labelKey, { defaultValue: button.defaultValue });
  const blurb = allianceBlurb(alliance);
  const closeLabel = t('allianceFigma.close', { defaultValue: 'Close' });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={joining ? undefined : onClose}
          accessibilityRole="button"
          accessibilityLabel={closeLabel}
        />
        <View style={styles.card} accessibilityViewIsModal>
          <View style={styles.panelHead}>
            <Text style={styles.panelTitle} accessibilityRole="header" maxFontSizeMultiplier={1.2}>
              {t('allianceFigma.detailTitle', { defaultValue: 'ALLIANCE' })}
            </Text>
            <SlantTile
              size={32}
              square
              slant={8}
              tone="raised"
              onPress={joining ? undefined : onClose}
              disabled={joining}
              accessibilityLabel={closeLabel}
              style={styles.closeTile}
            >
              <Text style={styles.closeText}>×</Text>
            </SlantTile>
          </View>
          <ScrollView contentContainerStyle={styles.cardContent} showsVerticalScrollIndicator={false}>
            <View style={styles.headRow}>
              <AllianceEmblemTile emblem={alliance.emblem} size={60} />
              <View style={styles.headText}>
                <Text
                  style={styles.title}
                  maxFontSizeMultiplier={1.2}
                  numberOfLines={2}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                >
                  {allianceTitle(alliance).toUpperCase()}
                </Text>
                {blurb ? <Text style={styles.description}>{blurb}</Text> : null}
              </View>
            </View>

            <AllianceStatsGrid location={alliance.city} territories={territories} joinType={joinType} />

            <View style={styles.joinRow}>
              <AllianceMembersCount count={memberCount} />
              <SlantButton
                label={joinLabel}
                onPress={handleJoin}
                disabled={button.disabled}
                loading={joining}
                trailingChevron={false}
                size="md"
                style={styles.joinBtn}
              />
            </View>
            {joinError ? (
              <Text style={styles.joinError} accessibilityLiveRegion="polite">{joinError}</Text>
            ) : null}

            {loading && !detail ? (
              <ActivityIndicator color={colors.muted2} style={{ marginTop: 20 }} />
            ) : loadError && !detail ? (
              <View style={styles.loadError}>
                <Text style={styles.loadErrorText}>{t('alliance.couldNotLoad')}</Text>
                <SlantButton
                  label={t('common.retry')}
                  onPress={load}
                  variant="ghost"
                  size="sm"
                  style={styles.retryBtn}
                />
              </View>
            ) : (
              <View style={styles.memberList}>
                {members.map((m, i) => (
                  <AllianceMemberRow key={m.player_id ?? i} rank={i + 1} member={m} />
                ))}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 48,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceLine,
    maxHeight: '100%',
  },
  panelHead: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.actionDeep,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceLine,
  },
  panelTitle: {
    fontFamily: fonts.display,
    fontSize: 18,
    letterSpacing: 0.6,
    color: colors.white,
    textTransform: 'uppercase',
  },
  closeTile: {
    position: 'absolute',
    right: 10,
    top: 10,
  },
  closeText: { color: colors.white, fontSize: 18, lineHeight: 20 },
  cardContent: {
    padding: 16,
  },
  headRow: { flexDirection: 'row', alignItems: 'flex-start' },
  headText: { flex: 1, marginLeft: 14 },
  title: {
    fontFamily: fonts.display,
    fontSize: 20,
    lineHeight: 24,
    color: colors.white,
    textTransform: 'uppercase',
  },
  description: {
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 17,
    color: colors.muted2,
    marginTop: 6,
  },
  grid: {
    flexDirection: 'row',
    marginTop: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.surfaceLine,
  },
  gridCell: { flex: 1, paddingVertical: 10, paddingHorizontal: 6, alignItems: 'center' },
  gridCellDivider: { borderRightWidth: 1, borderRightColor: colors.surfaceLine },
  gridLabel: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.6,
    color: colors.muted2,
    textTransform: 'uppercase',
  },
  gridValue: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.white,
    marginTop: 4,
  },
  countInline: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  countValue: {
    fontFamily: fonts.bodyMedium,
    fontSize: 16,
    color: colors.white,
    marginTop: 4,
  },
  countValueInline: { marginTop: 0 },
  joinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  joinBtn: { alignSelf: 'auto', minWidth: 96 },
  joinError: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.danger,
    marginTop: 8,
    lineHeight: 16,
  },
  memberList: { marginTop: 14, gap: 8 },
  memberCard: {},
  memberRow: { flexDirection: 'row', alignItems: 'center' },
  rankTile: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.raised,
  },
  rankText: { fontFamily: fonts.monoMedium, fontSize: 12, color: colors.white },
  avatarTile: { marginLeft: 10, overflow: 'hidden' },
  avatarImg: { width: 26, height: 26 },
  memberText: { flex: 1, marginLeft: 10 },
  memberName: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.white },
  memberRole: { fontFamily: fonts.body, fontSize: 11, color: colors.muted2, marginTop: 1 },
  memberHeld: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.white,
    marginLeft: 10,
  },
  loadError: { alignItems: 'center', marginTop: 16 },
  loadErrorText: { fontFamily: fonts.body, fontSize: 12, color: colors.muted2 },
  retryBtn: { alignSelf: 'center', marginTop: 10 },
});
