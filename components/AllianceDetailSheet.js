/**
 * components/AllianceDetailSheet.js
 *
 * Figma alliance detail pop-up (F4; alliance_hq_create off). Opens from a row
 * in the alliance list: emblem beside the name with [TAG] below, description,
 * a 2×2 grid (LOCATION / TERRITORIES / TYPE / MEMBERS), JOIN or REQUEST TO
 * JOIN by join_type (with a Request sent state), and the member list ranked
 * by territories held.
 *
 * Also exports the pieces the member view (F5) in screens/AllianceScreen.js
 * reuses so both read the same way: AllianceEmblemTile, AllianceStatsGrid and
 * AllianceMemberRow.
 *
 * Description and rules render as plain <Text> — no link detection.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import AllianceEmblem from './AllianceEmblem';
import { colors, fonts } from '../lib/theme';
import { avatarThumb } from '../lib/avatar';
import { getAllianceById, joinAlliance, normalizeAllianceDetail } from '../lib/allianceApi';
import { ALLIANCE_MAX_MEMBERS, isAllianceFull, joinErrorKey } from '../lib/allianceValidation';
import {
  hasPendingRequest, joinButtonState, joinOutcome, joinTypeLabelKey, memberInitials, padRank,
} from '../lib/allianceJoin';
import { displayRole, roleLabel, roleLabelKey } from '../lib/allianceRoles';

/** Name only, upper-cased (the tag sits on its own line in Figma). */
export function allianceName(alliance) {
  return (alliance?.name ?? '').toUpperCase();
}

/** "[TAG]" or '' when there is no tag. */
export function allianceTag(alliance) {
  const tag = (alliance?.short_name ?? '').toUpperCase();
  return tag ? `[${tag}]` : '';
}

/**
 * The text shown under the alliance name. Figma's create form only collects
 * Rules, so an alliance founded there has rules but no description; fall back
 * to rules so the founder's text still appears. Plain text, no link detection.
 */
export function allianceBlurb(alliance) {
  const d = typeof alliance?.description === 'string' ? alliance.description.trim() : '';
  if (d) return d;
  return typeof alliance?.rules === 'string' ? alliance.rules.trim() : '';
}

/** Emblem on the alliance-blue tile used by F4 and F5. */
export function AllianceEmblemTile({ emblem, size = 64 }) {
  return (
    <View style={[styles.emblemTile, { width: size, height: size }]}>
      <AllianceEmblem emblem={emblem} size={Math.round(size * 0.56)} />
    </View>
  );
}

/** F4/F5 2×2 grid: LOCATION / TERRITORIES on top, TYPE / MEMBERS below. */
export function AllianceStatsGrid({ location, territories, joinType, memberCount }) {
  const { t } = useTranslation();
  const typeKey = joinTypeLabelKey(joinType);
  const cells = [
    { key: 'loc', label: t('allianceFigma.location', { defaultValue: 'LOCATION' }), value: location || '—' },
    { key: 'terr', label: t('allianceFigma.territories', { defaultValue: 'TERRITORIES' }), value: territories ?? '—' },
    {
      key: 'type',
      label: t('allianceFigma.type', { defaultValue: 'TYPE' }),
      value: t(typeKey, { defaultValue: typeKey.endsWith('InviteOnly') ? 'INVITE ONLY' : 'OPEN' }),
    },
    {
      key: 'members',
      label: t('allianceFigma.members', { defaultValue: 'MEMBERS' }),
      value: `${memberCount ?? '—'} / ${ALLIANCE_MAX_MEMBERS}`,
    },
  ];
  return (
    <View style={styles.grid}>
      {[cells.slice(0, 2), cells.slice(2)].map((row, r) => (
        <View key={r} style={[styles.gridRow, r === 0 && styles.gridRowTop]}>
          {row.map((c, i) => (
            <View
              key={c.key}
              style={[styles.gridCell, i === 0 && styles.gridCellLeft]}
              accessible
              accessibilityLabel={`${c.label} ${c.value}`}
            >
              <Text style={styles.gridLabel}>{c.label}</Text>
              <Text style={styles.gridValue} numberOfLines={1}>{String(c.value).toUpperCase()}</Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

/** "01  [KA]  Moksh   CAPTAIN  16 TERR." */
export function AllianceMemberRow({ rank, member, onPress, showBorder }) {
  const { t } = useTranslation();
  const name = member?.username ?? '—';
  const role = displayRole(member?.role);
  const roleText = t(roleLabelKey(member?.role), { defaultValue: roleLabel(member?.role) });
  const held = t('allianceFigma.terrShort', {
    count: padRank(member?.territories_held ?? 0),
    defaultValue: '{{count}} TERR.',
  });
  const a11y = `${rank}. ${name}, ${roleText}, ${held}`;
  const avatarUrl = member?.avatar_url ?? null;
  const body = (
    <>
      <Text style={styles.memberRank}>{padRank(rank)}</Text>
      <View style={styles.memberTile}>
        {avatarUrl ? (
          <Image source={{ uri: avatarThumb(avatarUrl, 32) }} style={styles.memberTileImg} />
        ) : (
          <Text style={styles.memberInitials}>{memberInitials(name)}</Text>
        )}
      </View>
      <Text style={styles.memberName} numberOfLines={1}>{name}</Text>
      <Text
        style={[styles.memberRole, (role === 'captain' || role === 'commander') && styles.memberRoleLead]}
        numberOfLines={1}
      >
        {roleText}
      </Text>
      <Text style={styles.memberHeld}>{held}</Text>
    </>
  );
  const rowStyle = [styles.memberRow, showBorder && styles.memberRowBorder];
  if (!onPress) {
    return (
      <View style={rowStyle} accessible accessibilityLabel={a11y}>
        {body}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      onPress={onPress}
      style={({ pressed }) => [...rowStyle, pressed && { opacity: 0.7 }]}
    >
      {body}
    </Pressable>
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
  const tag = allianceTag(alliance);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={joining ? undefined : onClose}
          accessibilityRole="button"
          accessibilityLabel={t('allianceFigma.close', { defaultValue: 'Close' })}
        />
        <View style={styles.card} accessibilityViewIsModal>
          <ScrollView contentContainerStyle={styles.cardContent} showsVerticalScrollIndicator={false}>
            <View style={styles.headRow}>
              <AllianceEmblemTile emblem={alliance.emblem} size={64} />
              <View style={styles.headText}>
                <Text
                  style={styles.title}
                  accessibilityRole="header"
                  maxFontSizeMultiplier={1.2}
                  numberOfLines={2}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                >
                  {allianceName(alliance)}
                </Text>
                {tag ? <Text style={styles.tag}>{tag}</Text> : null}
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('allianceFigma.close', { defaultValue: 'Close' })}
                onPress={onClose}
                disabled={joining}
                hitSlop={12}
                style={styles.closeBtn}
              >
                <Text style={styles.closeText}>✕</Text>
              </Pressable>
            </View>
            {allianceBlurb(alliance) ? (
              <Text style={styles.description}>{allianceBlurb(alliance)}</Text>
            ) : null}

            <AllianceStatsGrid
              location={alliance.city}
              territories={territories}
              joinType={joinType}
              memberCount={memberCount}
            />

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={joinLabel}
              accessibilityState={{ disabled: button.disabled, busy: joining }}
              disabled={button.disabled}
              onPress={handleJoin}
              style={({ pressed }) => [
                styles.joinBtn,
                button.disabled && !joining && styles.joinBtnDisabled,
                pressed && !button.disabled && { opacity: 0.9 },
              ]}
            >
              {joining ? (
                <ActivityIndicator color={colors.bone} />
              ) : (
                <Text style={[styles.joinText, button.disabled && styles.joinTextDisabled]}>{joinLabel}</Text>
              )}
            </Pressable>
            {joinError ? (
              <Text style={styles.joinError} accessibilityLiveRegion="polite">{joinError}</Text>
            ) : null}

            <Text style={styles.sectionLabel}>
              {t('allianceFigma.membersByTerritories', { defaultValue: 'MEMBERS · BY TERRITORIES HELD' })}
            </Text>

            {loading && !detail ? (
              <ActivityIndicator color={colors.slate2} style={{ marginTop: 20 }} />
            ) : loadError && !detail ? (
              <View style={styles.loadError}>
                <Text style={styles.loadErrorText}>{t('alliance.couldNotLoad')}</Text>
                <Pressable accessibilityRole="button" onPress={load} style={styles.retryBtn}>
                  <Text style={styles.retryText}>{t('common.retry')}</Text>
                </Pressable>
              </View>
            ) : (
              members.map((m, i) => (
                <AllianceMemberRow
                  key={m.player_id ?? i}
                  rank={i + 1}
                  member={m}
                  showBorder={i < members.length - 1}
                />
              ))
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
    backgroundColor: 'rgba(0,0,0,0.82)',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 48,
  },
  card: {
    backgroundColor: colors.ink2,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    maxHeight: '100%',
  },
  cardContent: {
    padding: 20,
  },
  headRow: { flexDirection: 'row', alignItems: 'center' },
  headText: { flex: 1, marginLeft: 14 },
  emblemTile: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.alliance,
    backgroundColor: colors.allianceSoft,
  },
  closeBtn: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -10,
  },
  closeText: { color: colors.slate2, fontSize: 18 },
  title: {
    fontFamily: fonts.display,
    fontSize: 27,
    lineHeight: 29,
    color: colors.bone,
    textTransform: 'uppercase',
  },
  tag: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.2,
    color: colors.slate2,
    marginTop: 2,
  },
  description: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 21,
    color: colors.slate2,
    marginTop: 14,
  },
  grid: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
  },
  gridRow: { flexDirection: 'row' },
  gridRowTop: { borderBottomWidth: 1, borderBottomColor: colors.hairlineStrong },
  gridCell: { flex: 1, paddingVertical: 12, paddingHorizontal: 12 },
  gridCellLeft: { borderRightWidth: 1, borderRightColor: colors.hairlineStrong },
  gridLabel: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.slate2,
    textTransform: 'uppercase',
  },
  gridValue: {
    fontFamily: fonts.mono,
    fontSize: 13,
    letterSpacing: 0.8,
    color: colors.bone,
    marginTop: 6,
  },
  sectionLabel: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.slate2,
    textTransform: 'uppercase',
    marginTop: 18,
    marginBottom: 4,
  },
  joinBtn: {
    backgroundColor: colors.action,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  joinBtnDisabled: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
  },
  joinText: {
    fontFamily: fonts.monoMedium,
    fontSize: 13,
    letterSpacing: 1.6,
    color: colors.bone,
    textTransform: 'uppercase',
  },
  joinTextDisabled: { color: colors.slate2 },
  joinError: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.2,
    color: colors.danger,
    textTransform: 'uppercase',
    marginTop: 8,
    lineHeight: 15,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingVertical: 10,
  },
  memberRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.hairline },
  memberRank: {
    fontFamily: fonts.mono,
    fontSize: 13,
    color: colors.slate,
    width: 28,
  },
  memberTile: {
    width: 32,
    height: 32,
    borderWidth: 1.5,
    borderColor: colors.self,
    backgroundColor: colors.ink3,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  memberTileImg: { width: 32, height: 32 },
  memberInitials: { fontFamily: fonts.monoMedium, fontSize: 11, color: colors.bone },
  memberName: {
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: 16,
    color: colors.bone,
  },
  memberRole: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.slate2,
    textTransform: 'uppercase',
    marginLeft: 8,
  },
  memberRoleLead: { color: colors.lime },
  memberHeld: {
    fontFamily: fonts.mono,
    fontSize: 13,
    letterSpacing: 0.6,
    color: colors.slate2,
    marginLeft: 10,
    minWidth: 64,
    textAlign: 'right',
  },
  loadError: { alignItems: 'center', marginTop: 16 },
  loadErrorText: { fontFamily: fonts.mono, fontSize: 11, color: colors.slate2, textTransform: 'uppercase' },
  retryBtn: {
    marginTop: 10,
    minHeight: 44,
    paddingHorizontal: 20,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    backgroundColor: colors.ink3,
  },
  retryText: { fontFamily: fonts.monoMedium, fontSize: 13, color: colors.bone, textTransform: 'uppercase' },
});
