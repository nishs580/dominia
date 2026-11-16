/**
 * components/AllianceDetailSheet.js
 *
 * Figma alliance detail pop-up (alliance_hq_create off). Opens from a row in
 * the alliance list: emblem, "NAME - TAG", description, LOCATION /
 * TERRITORIES / TYPE, member count, Join, and the member list ranked by
 * territories held.
 *
 * Also exports AllianceStatsRow and AllianceMemberRow, reused by the member
 * view header in screens/AllianceScreen.js so both read the same way.
 *
 * Description and rules render as plain <Text> — no link detection.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import AllianceEmblem from './AllianceEmblem';
import THEME from '../lib/theme';
import { getAllianceById, joinAlliance, normalizeAllianceDetail } from '../lib/allianceApi';
import { ALLIANCE_MAX_MEMBERS, isAllianceFull, joinErrorKey } from '../lib/allianceValidation';

const { ink2: INK2, ink3: INK3, bone: BONE, slate: SLATE, slate2: SLATE2,
  claimButton: CLAIM_BUTTON, claim: CLAIM, hairline: HAIRLINE, hairlineStrong: HAIRLINE_STRONG } = THEME.colors;

export function allianceTitle(alliance) {
  const name = (alliance?.name ?? '').toUpperCase();
  const tag = (alliance?.short_name ?? '').toUpperCase();
  return tag ? `${name} - ${tag}` : name;
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

/** LOCATION / TERRITORIES / TYPE. Type is "Open" until design defines invite-only. */
export function AllianceStatsRow({ location, territories }) {
  const { t } = useTranslation();
  const cells = [
    { label: t('allianceFigma.location', { defaultValue: 'LOCATION' }), value: location || '—' },
    { label: t('allianceFigma.territories', { defaultValue: 'TERRITORIES' }), value: territories ?? '—' },
    { label: t('allianceFigma.type', { defaultValue: 'TYPE' }), value: t('allianceFigma.typeOpen', { defaultValue: 'Open' }) },
  ];
  return (
    <View style={styles.statsRow}>
      {cells.map((c) => (
        <View key={c.label} style={styles.statCell} accessible accessibilityLabel={`${c.label} ${c.value}`}>
          <Text style={styles.statLabel}>{c.label}</Text>
          <Text style={styles.statValue} numberOfLines={1}>{String(c.value)}</Text>
        </View>
      ))}
    </View>
  );
}

export function AllianceMemberRow({ rank, member, onPress, showBorder }) {
  const { t } = useTranslation();
  const name = member?.username ?? '—';
  const held = t('allianceFigma.territoriesHeld', {
    count: member?.territories_held ?? 0,
    defaultValue: '{{count}} Territories',
  });
  const body = (
    <>
      <Text style={styles.memberRank}>{rank}</Text>
      <Text style={styles.memberName} numberOfLines={1}>{name}</Text>
      <Text style={styles.memberHeld}>{held}</Text>
    </>
  );
  const rowStyle = [styles.memberRow, showBorder && styles.memberRowBorder];
  if (!onPress) {
    return (
      <View style={rowStyle} accessible accessibilityLabel={`${rank}. ${name}, ${held}`}>
        {body}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${rank}. ${name}, ${held}`}
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
    if (listItem?.id) load();
  }, [listItem?.id, load]);

  const alliance = detail?.alliance ?? listItem ?? {};
  const members = detail?.members ?? [];
  const memberCount = detail ? members.length : listItem?.member_count ?? 0;
  const full = isAllianceFull({ member_count: memberCount });
  const territories = Number.isFinite(listItem?.territory_count)
    ? listItem.territory_count
    : members.reduce((sum, m) => sum + m.territories_held, 0);

  const handleJoin = async () => {
    if (!listItem?.id || joining || full) return;
    setJoining(true);
    setJoinError('');
    try {
      const res = await joinAlliance({ clerkGetToken: getToken, allianceId: listItem.id });
      if (res.ok) {
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

  const joinLabel = full
    ? t('allianceFigma.full', { defaultValue: 'Alliance full' })
    : t('alliance.join');

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

          <ScrollView contentContainerStyle={styles.cardContent} showsVerticalScrollIndicator={false}>
            <View style={styles.emblemWrap}>
              <AllianceEmblem emblem={alliance.emblem} size={64} />
            </View>
            <Text style={styles.title} accessibilityRole="header" maxFontSizeMultiplier={1.2}>
              {allianceTitle(alliance)}
            </Text>
            {allianceBlurb(alliance) ? (
              <Text style={styles.description}>{allianceBlurb(alliance)}</Text>
            ) : null}

            <AllianceStatsRow location={alliance.city} territories={territories} />

            <View style={styles.membersHead}>
              <Text style={styles.sectionLabel}>{t('allianceFigma.members', { defaultValue: 'Members' })}</Text>
              <Text style={styles.sectionValue}>{`${memberCount} / ${ALLIANCE_MAX_MEMBERS}`}</Text>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={joinLabel}
              accessibilityState={{ disabled: full || joining, busy: joining }}
              disabled={full || joining}
              onPress={handleJoin}
              style={({ pressed }) => [
                styles.joinBtn,
                (full || joining) && styles.joinBtnDisabled,
                pressed && !full && !joining && { opacity: 0.9 },
              ]}
            >
              {joining ? (
                <ActivityIndicator color={BONE} />
              ) : (
                <Text style={[styles.joinText, full && styles.joinTextDisabled]}>{joinLabel}</Text>
              )}
            </Pressable>
            {joinError ? (
              <Text style={styles.joinError} accessibilityLiveRegion="polite">{joinError}</Text>
            ) : null}

            {loading && !detail ? (
              <ActivityIndicator color={SLATE2} style={{ marginTop: 20 }} />
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
    backgroundColor: 'rgba(14,16,20,0.82)',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 48,
  },
  card: {
    backgroundColor: INK2,
    borderWidth: 1,
    borderColor: HAIRLINE_STRONG,
    maxHeight: '100%',
  },
  cardContent: {
    padding: 20,
    paddingTop: 28,
  },
  closeBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    zIndex: 2,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { color: SLATE2, fontSize: 16 },
  emblemWrap: { alignItems: 'center', marginBottom: 12 },
  title: {
    fontFamily: 'Archivo_800ExtraBold',
    fontSize: 22,
    color: BONE,
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  description: {
    fontFamily: 'InstrumentSans_400Regular',
    fontSize: 13,
    lineHeight: 20,
    color: SLATE2,
    textAlign: 'center',
    marginTop: 10,
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: 18,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: HAIRLINE,
  },
  statCell: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  statLabel: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 11,
    letterSpacing: 1.6,
    color: SLATE,
    textTransform: 'uppercase',
  },
  statValue: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 13,
    color: BONE,
    marginTop: 4,
  },
  membersHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: 18,
  },
  sectionLabel: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 11,
    letterSpacing: 1.6,
    color: SLATE2,
    textTransform: 'uppercase',
  },
  sectionValue: { fontFamily: 'GeistMono_500Medium', fontSize: 13, color: BONE },
  joinBtn: {
    backgroundColor: CLAIM_BUTTON,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    marginBottom: 6,
  },
  joinBtnDisabled: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: HAIRLINE_STRONG,
  },
  joinText: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 16,
    letterSpacing: 1.6,
    color: BONE,
    textTransform: 'uppercase',
  },
  joinTextDisabled: { color: SLATE },
  joinError: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 11,
    letterSpacing: 1.2,
    color: CLAIM,
    textTransform: 'uppercase',
    marginTop: 6,
    lineHeight: 15,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    paddingVertical: 10,
  },
  memberRowBorder: { borderBottomWidth: 1, borderBottomColor: HAIRLINE },
  memberRank: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 13,
    color: SLATE2,
    width: 28,
  },
  memberName: {
    flex: 1,
    fontFamily: 'InstrumentSans_500Medium',
    fontSize: 15,
    color: BONE,
  },
  memberHeld: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 11,
    letterSpacing: 1,
    color: SLATE2,
    marginLeft: 8,
  },
  loadError: { alignItems: 'center', marginTop: 16 },
  loadErrorText: { fontFamily: 'GeistMono_400Regular', fontSize: 11, color: SLATE2, textTransform: 'uppercase' },
  retryBtn: {
    marginTop: 10,
    minHeight: 44,
    paddingHorizontal: 20,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: HAIRLINE_STRONG,
    backgroundColor: INK3,
  },
  retryText: { fontFamily: 'GeistMono_500Medium', fontSize: 13, color: BONE, textTransform: 'uppercase' },
});
