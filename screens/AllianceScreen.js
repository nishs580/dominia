import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StatusBar, StyleSheet, Text, TextInput, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { useAuth } from '@clerk/clerk-expo';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AllianceEmblem from '../components/AllianceEmblem';
import AllianceLogEvent from '../components/AllianceLogEvent';
import WeeklyTaskCard from '../components/WeeklyTaskCard';
import WeeklyTopContributors from '../components/WeeklyTopContributors';
import { getAllianceById, getMyAlliance, joinAlliance, leaveAlliance, kickMember, promoteMember, demoteMember, transferFounder, listAlliances, normalizeAllianceDetail, listJoinRequests, acceptJoinRequest, declineJoinRequest } from '../lib/allianceApi';
import { ALLIANCE_MAX_MEMBERS, allianceListState, joinErrorKey, joinRequestErrorKey } from '../lib/allianceValidation';
import AllianceDetailSheet, { AllianceEmblemTile, AllianceMemberRow, AllianceMembersCount, AllianceStatsGrid, allianceBlurb, allianceTitle } from '../components/AllianceDetailSheet';
import { CutCard, CutField, SlantButton, SlantTile } from '../components/ui';
import { isAllianceLeader } from '../lib/allianceRoles';
import { memberInitials, normalizeJoinRequests, padRank } from '../lib/allianceJoin';
import FeatureExplainer from '../components/FeatureExplainer';
import { getAllianceActivityLog, markAllianceActivityLogRead } from '../lib/allianceActivityLogApi';
import { getAvailableActions } from '../lib/alliancePermissions';
import { supabase } from '../lib/supabase';
import { avatarThumb } from '../lib/avatar';
import { useFirstTapTips, rectFromRef } from '../components/FirstTapTips';
import { useFlag } from '../lib/flags';
import ProfileAvatarButton from '../components/ProfileAvatarButton';

const CLAIM = '#84FF44';
const CLAIM_BUTTON = '#0731D1'; // = colors.action (primary button blue)
const INK = '#000000';
const INK2 = '#0E0E10';
const INK3 = '#1A1A1D';
const BONE = '#FDFDFD';
const SLATE = 'rgba(253,253,253,0.30)';
const SLATE2 = 'rgba(253,253,253,0.62)';
const ALLIANCE_GREEN = '#5B7BF5'; // = colors.alliance
const HAIRLINE = 'rgba(253,253,253,0.08)';
const HAIRLINE_STRONG = 'rgba(253,253,253,0.16)';
const LIME = '#84FF44';
const DANGER = '#E34234';

// Dominia-Temp line icons (list header, row chips, footer, member view).
const INFO_ICON_XML = `<svg viewBox="0 0 24 24" fill="none" stroke="${SLATE2}" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v1"/></svg>`;
const MEMBERS_ICON_XML = `<svg viewBox="0 0 24 24" fill="none" stroke="${BONE}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.4 3.2-5.5 6.5-5.5s5.9 2.1 6.5 5.5"/><path d="M15.5 4.8a3.5 3.5 0 0 1 0 6.4M18 14.8c1.9.8 3.1 2.6 3.5 5.2"/></svg>`;
const MAP_ICON_XML = `<svg viewBox="0 0 24 24" fill="none" stroke="${BONE}" stroke-width="1.8" stroke-linejoin="round"><path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/></svg>`;
const PENCIL_ICON_XML = `<svg viewBox="0 0 16 16" fill="none" stroke="${BONE}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.5 2.5l3 3L5.5 13.5H2.5v-3z"/><path d="M9 4l3 3"/></svg>`;
const LEAVE_ICON_XML = `<svg viewBox="0 0 16 16" fill="none" stroke="${SLATE2}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2.5H3v11h3"/><path d="M10 5l-3 3 3 3M7 8h7"/></svg>`;
const CHAT_ICON_XML = `<svg viewBox="0 0 24 24" fill="none" stroke="${SLATE2}" stroke-width="1.6" stroke-linejoin="round"><path d="M12 4a8 8 0 0 0-6.9 12L4 20l4.1-1.1A8 8 0 1 0 12 4z"/></svg>`;

function formatAllianceRole(t, role) {
  if (!role) return t('alliance.roleMember');
  if (role === 'founder') return t('alliance.roleFounder');
  return role.toUpperCase();
}

function mapJoinAllianceError(t, error) {
  // Keys shared with the Figma detail pop-up (lib/allianceValidation.js).
  return t(joinErrorKey(error));
}

function mapLeaveAllianceError(t, error) {
  const code = error?.code ?? error?.error ?? null;
  switch (code) {
    case 'founder_must_transfer_first':
      return t('alliance.errFounderMustTransfer');
    case 'player_not_found':
      return t('alliance.errAccount');
    case 'not_in_alliance':
      return t('alliance.errNotInAlliance');
    default:
      return t('alliance.errCouldNotLeave');
  }
}

function capitalizeRole(role) {
  if (!role) return '';
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function mapTransferFounderError(t, error, targetName) {
  const code = error?.error ?? error?.code ?? null;
  switch (code) {
    case 'not_founder':
      return t('alliance.errNotFounder');
    case 'target_role_ineligible':
      return t('alliance.errTargetIneligible');
    case 'target_not_member':
      return t('alliance.errTargetNotMember', { target: targetName });
    case 'cannot_transfer_to_self':
      return t('alliance.errTransferSelf');
    default:
      return t('alliance.errTransferGeneric');
  }
}

function mapManageError(t, error) {
  const code = error?.error ?? error?.code ?? null;
  switch (code) {
    case 'role_slots_full': return t('alliance.errRoleSlotsFull');
    case 'insufficient_permission': return t('alliance.errInsufficientPermission');
    case 'only_founder_can_demote': return t('alliance.errOnlyFounderDemote');
    case 'cannot_kick_founder': return t('alliance.errCannotKickFounder');
    case 'cannot_promote_founder': return t('alliance.errCannotPromoteFounder');
    case 'cannot_demote_self': return t('alliance.errCannotDemoteSelf');
    case 'cannot_promote_self': return t('alliance.errCannotPromoteSelf');
    case 'cannot_kick_self': return t('alliance.errCannotKickSelf');
    case 'invalid_target_role': return t('alliance.errInvalidTargetRole');
    case 'new_role_not_higher': return t('alliance.errNewRoleNotHigher');
    case 'new_role_not_lower': return t('alliance.errNewRoleNotLower');
    case 'actor_not_in_alliance': return t('alliance.errActorNotInAlliance');
    case 'target_not_in_alliance': return t('alliance.errTargetNotInAlliance');
    default: return t('alliance.errActionFailed');
  }
}

function actionLabel(t, action) {
  if (action.type === 'kick') return t('alliance.actionKick');
  if (action.type === 'transfer_founder') return t('alliance.actionTransfer');
  if (action.type === 'promote') return t('alliance.actionPromoteTo', { role: action.toRole.toUpperCase() });
  if (action.type === 'demote') return t('alliance.actionDemoteTo', { role: action.toRole.toUpperCase() });
  return '';
}

function actionLoadingLabel(t, action) {
  if (action.type === 'kick') return t('alliance.loadingKick');
  if (action.type === 'promote') return t('alliance.loadingPromote');
  if (action.type === 'demote') return t('alliance.loadingDemote');
  return t('alliance.loadingWork');
}

function HeaderKicker({ children }) {
  return <Text style={styles.headerKicker}>{children}</Text>;
}

function RosterRow({
  avatarUrl, initials, name, role, isFounder, levelLabel,
  manageLabel, onManage, showBorder, onPress,
}) {
  const inner = (
    <>
      <View style={styles.rosterLeft}>
        <View style={styles.rosterAvatar}>
          {avatarUrl ? (
            <Image source={{ uri: avatarThumb(avatarUrl, 32) }} style={styles.rosterAvatarImg} />
          ) : (
            <Text style={styles.rosterInitials}>{initials}</Text>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.rosterName} numberOfLines={1}>{name}</Text>
          <Text style={[styles.rosterRole, isFounder && styles.rosterRoleFounder]}>{role}</Text>
        </View>
      </View>
      {levelLabel ? <Text style={styles.rosterLevel}>{levelLabel}</Text> : null}
      {onManage ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={manageLabel}
          onPress={onManage}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={({ pressed }) => [styles.rosterManageBtn, pressed && { opacity: 0.6 }]}
        >
          <Text style={styles.rosterManageText}>{manageLabel}</Text>
        </Pressable>
      ) : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [
          styles.rosterRow,
          showBorder && styles.rosterRowBorder,
          pressed && { opacity: 0.6 },
        ]}
      >
        {inner}
      </Pressable>
    );
  }

  return (
    <View style={[styles.rosterRow, showBorder && styles.rosterRowBorder]}>
      {inner}
    </View>
  );
}

function NonMemberContent({
  alliances,
  playerHomeCity,
  onRefreshAfterJoin,
  navigation,
  confirmAlliance,
  setConfirmAlliance,
  joinSaving,
  setJoinSaving,
  getToken,
  listWrapRef,
}) {
  const { t } = useTranslation();
  const [joinError, setJoinError] = useState('');

  const handleConfirmJoin = async () => {
    if (!confirmAlliance || joinSaving) return;
    setJoinSaving(true);
    setJoinError('');
    try {
      const result = await joinAlliance({
        clerkGetToken: getToken,
        allianceId: confirmAlliance.id,
      });

      if (result.ok) {
        const joinedAllianceId = confirmAlliance.id;
        setConfirmAlliance(null);
        await onRefreshAfterJoin();
        navigation.navigate('AllianceJoined', { allianceId: joinedAllianceId, context: 'joined' });
        return;
      }

      setJoinError(mapJoinAllianceError(t, result.error));
    } catch (err) {
      console.error('Join alliance failed:', err);
      setJoinError(t('alliance.errCouldNotJoin'));
    } finally {
      setJoinSaving(false);
    }
  };

  // Confirm-join view (unchanged behaviour, restyled)
  if (confirmAlliance) {
    return (
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.confirmWrap}>
          <Text style={styles.confirmKicker}>{t('alliance.joinKicker')}</Text>
          <Text style={styles.confirmTitle} maxFontSizeMultiplier={1.2} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.65}>{t('alliance.joinTitle', { name: confirmAlliance.name })}</Text>
          <Text style={styles.confirmTag}>[{confirmAlliance.short_name}]</Text>

          <Pressable
            accessibilityRole="button"
            disabled={joinSaving}
            onPress={handleConfirmJoin}
            style={({ pressed }) => [
              styles.cta,
              joinSaving && styles.ctaDisabled,
              pressed && !joinSaving && { opacity: 0.9 },
            ]}
          >
            {joinSaving ? (
              <>
                <ActivityIndicator color={BONE} />
                <Text style={[styles.ctaAction, { marginTop: 8 }]}>{t('alliance.joining')}</Text>
              </>
            ) : (
              <Text style={styles.ctaAction}>{t('alliance.join')}</Text>
            )}
          </Pressable>

          <Pressable
            accessibilityRole="button"
            disabled={joinSaving}
            onPress={() => {
              setJoinError('');
              setConfirmAlliance(null);
            }}
            style={({ pressed }) => [styles.cancelLink, pressed && { opacity: 0.6 }]}
          >
            <Text style={styles.cancelLinkText}>{t('alliance.cancel')}</Text>
          </Pressable>

          {joinError ? <Text style={styles.joinError}>{joinError}</Text> : null}
        </View>
      </ScrollView>
    );
  }

  // Empty list state
  if (!alliances?.length) {
    return (
      <View ref={listWrapRef} collapsable={false} style={styles.scroll}>
        <View style={styles.sectionRow}>
          <Text style={styles.sectionLabelText}>{t('alliance.alliancesIn')}</Text>
          <Text style={styles.sectionLabelAccent}> {playerHomeCity ?? '—'}</Text>
          <View style={styles.sectionHairline} />
        </View>
        <View style={styles.emptyListWrap}>
          <Text style={styles.emptyListText}>{t('alliance.noAlliancesInCity')}</Text>
        </View>
        <View style={styles.footerRow}>
          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.navigate('CreateAlliance')}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={({ pressed }) => [styles.footerCreateBtn, pressed && { opacity: 0.6 }]}
          >
            <Text style={styles.createLink}>
              {t('alliance.foundFirst')}<Text style={styles.createLinkStrong}>{t('alliance.createAllianceLink')}</Text>
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // Default — list view
  return (
    <View ref={listWrapRef} collapsable={false} style={styles.scroll}>
      <View style={styles.sectionRow}>
        <Text style={styles.sectionLabelText}>{t('alliance.alliancesIn')}</Text>
        <Text style={styles.sectionLabelAccent}> {playerHomeCity ?? '—'}</Text>
        <View style={styles.sectionHairline} />
      </View>

      <Text style={styles.directiveText}>{t('alliance.tapToJoin')}</Text>

      <ScrollView
        style={styles.allianceListScroll}
        contentContainerStyle={styles.allianceListContent}
        showsVerticalScrollIndicator={true}
      >
        {alliances.map((a, i) => (
          <Pressable
            key={a.id}
            accessibilityRole="button"
            onPress={() => {
              setJoinError('');
              setConfirmAlliance(a);
            }}
            style={({ pressed }) => [
              styles.aRow,
              i === 0 && styles.aRowFirst,
              pressed && styles.aRowPressed,
            ]}
          >
            <View style={styles.aInfo}>
              <Text style={styles.aNameLine}>
                <Text style={styles.aName}>{a.name}</Text>
                <Text style={styles.aTag}>  [{a.short_name}]</Text>
              </Text>
              <Text style={styles.aMeta}>
                {(a.city ?? '—')}
                {a.founder_username ? t('alliance.foundedBy', { founder: a.founder_username.toUpperCase() }) : ''}
              </Text>
            </View>
            <Text style={styles.aMembers}>{t('alliance.slash20', { n: a.memberCount })}</Text>
            <Text style={styles.aChev}>→</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.footerRow}>
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.navigate('CreateAlliance')}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={({ pressed }) => [styles.footerCreateBtn, pressed && { opacity: 0.6 }]}
        >
          <Text style={styles.createLink}>
            {t('alliance.orCreate')}<Text style={styles.createLinkStrong}>{t('alliance.createYourOwn')}</Text>
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function MemberContent({ myAlliance, playerId, roster, getToken, onRefreshAfterLeave, figma = false, territoryCount = null, onInfo = null }) {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  // App-only surfaces (Remote Config). Off leaves a read-only member list
  // with no top contributors, manage tools, Command Post or War Room entry.
  const rosterToolsOn = useFlag('alliance_roster_tools');
  const commandPostOn = useFlag('command_post');
  const warRoomOn = useFlag('war_room');
  const allianceId = myAlliance?.id;
  const [events, setEvents] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [feedError, setFeedError] = useState(null);
  const hasFetchedOnce = useRef(false);
  const [leaveConfirmCase, setLeaveConfirmCase] = useState(null);
  const [leaveSaving, setLeaveSaving] = useState(false);
  const [leaveError, setLeaveError] = useState('');
  const [manageTarget, setManageTarget] = useState(null); // { player_id, username, role }
  const [manageActionInFlight, setManageActionInFlight] = useState(null); // the action object currently submitting
  const [kickConfirm, setKickConfirm] = useState(null); // the kick action awaiting confirmation
  const [manageError, setManageError] = useState('');
  const [showTransferConfirm, setShowTransferConfirm] = useState(false);
  const [transferConfirmInput, setTransferConfirmInput] = useState('');
  const [transferSaving, setTransferSaving] = useState(false);
  const [transferError, setTransferError] = useState('');
  // Figma member view: the leader's pending join requests (U6).
  const [requests, setRequests] = useState([]);
  const [requestBusy, setRequestBusy] = useState(null); // request id in flight
  const [requestError, setRequestError] = useState('');

  const myMember = roster.find((m) => m.player_id === playerId);
  const myRole = myMember?.role ?? null;
  const myPlayerId = playerId;
  const isFounder = myMember?.role === 'founder';
  const rosterSize = roster.length;
  const leader = figma && isAllianceLeader(myRole);

  const openChat = useCallback(() => {
    navigation.navigate('Chat', { initialTab: 'alliance' });
  }, [navigation]);

  // Any failure (route not deployed yet, 403) reads as "no requests".
  const loadRequests = useCallback(async () => {
    if (!leader || !allianceId) {
      setRequests([]);
      return;
    }
    const res = await listJoinRequests({ clerkGetToken: getToken, allianceId });
    setRequests(res.ok ? normalizeJoinRequests(res.data) : []);
  }, [leader, allianceId, getToken]);

  useFocusEffect(
    useCallback(() => {
      loadRequests();
    }, [loadRequests]),
  );

  const resolveRequest = async (request, action) => {
    if (requestBusy) return;
    setRequestBusy(request.id);
    setRequestError('');
    try {
      const call = action === 'accept' ? acceptJoinRequest : declineJoinRequest;
      const res = await call({ clerkGetToken: getToken, allianceId, requestId: request.id });
      if (res.ok) {
        setRequests((prev) => prev.filter((r) => r.id !== request.id));
        if (action === 'accept') await onRefreshAfterLeave();
        return;
      }
      // Backend error body is { error: '<code>' }.
      const errKey = joinRequestErrorKey(res.error);
      if (errKey === 'allianceFigma.errRequestNotPending') {
        // Another leader already handled it: drop the stale row.
        setRequests((prev) => prev.filter((r) => r.id !== request.id));
      }
      setRequestError(t(errKey, {
        defaultValue: errKey === 'allianceFigma.errRequestNotPending'
          ? 'This request was already handled.'
          : 'Could not update the request. Try again.',
      }));
    } catch (err) {
      console.error('Resolve join request failed:', err);
      setRequestError(t('allianceFigma.errRequestAction', { defaultValue: 'Could not update the request. Try again.' }));
    } finally {
      setRequestBusy(null);
    }
  };

  const fetchFirstPage = useCallback(async () => {
    setIsLoading(true);
    setFeedError(null);
    const result = await getAllianceActivityLog({
      clerkGetToken: getToken,
      allianceId,
      limit: 30,
    });
    if (result.ok) {
      setEvents(result.data.events);
      setNextCursor(result.data.nextCursor);
    } else {
      setFeedError(result.error || 'unknown_error');
    }
    setIsLoading(false);
  }, [getToken, allianceId]);

  const fetchNextPage = useCallback(async () => {
    if (!nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    const result = await getAllianceActivityLog({
      clerkGetToken: getToken,
      allianceId,
      limit: 30,
      cursor: nextCursor,
    });
    if (result.ok) {
      setEvents((prev) => [...prev, ...result.data.events]);
      setNextCursor(result.data.nextCursor);
    }
    setIsLoadingMore(false);
  }, [getToken, allianceId, nextCursor, isLoadingMore]);

  const handleWireScroll = useCallback((e) => {
    if (isLoadingMore || !nextCursor) return;
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    const distanceFromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);
    if (distanceFromBottom < 80) {
      fetchNextPage();
    }
  }, [isLoadingMore, nextCursor, fetchNextPage]);

  useFocusEffect(
    useCallback(() => {
      markAllianceActivityLogRead({ clerkGetToken: getToken, allianceId }).catch(() => {});

      if (!hasFetchedOnce.current) {
        hasFetchedOnce.current = true;
        fetchFirstPage();
      }
    }, [getToken, allianceId, fetchFirstPage]),
  );

  const openLeaveConfirm = () => {
    setLeaveError('');
    if (isFounder && rosterSize > 1) {
      setLeaveConfirmCase('blocked');
    } else if (isFounder && rosterSize === 1) {
      setLeaveConfirmCase('disband');
    } else {
      setLeaveConfirmCase('leave');
    }
  };

  const closeLeaveConfirm = () => {
    if (leaveSaving) return;
    setLeaveError('');
    setLeaveConfirmCase(null);
  };

  const handleLeaveSubmit = async () => {
    if (leaveSaving || leaveConfirmCase === 'blocked') return;
    setLeaveSaving(true);
    setLeaveError('');
    try {
      const result = await leaveAlliance({ clerkGetToken: getToken });
      if (result.ok) {
        setLeaveConfirmCase(null);
        await onRefreshAfterLeave();
        return;
      }
      setLeaveError(mapLeaveAllianceError(t, result.error));
    } catch (err) {
      console.error('Leave alliance failed:', err);
      setLeaveError(t('alliance.errCouldNotLeave'));
    } finally {
      setLeaveSaving(false);
    }
  };

  const handleRosterRowTap = (member) => {
    if (!myRole || !myPlayerId) return;
    const actions = getAvailableActions({
      actorRole: myRole,
      actorPlayerId: myPlayerId,
      targetRole: member.role,
      targetPlayerId: member.player_id,
    });
    if (actions.length === 0) return; // not tappable
    setManageError('');
    setManageActionInFlight(null);
    setShowTransferConfirm(false);
    setKickConfirm(null);
    setTransferConfirmInput('');
    setTransferError('');
    setManageTarget({ player_id: member.player_id, username: member.username, role: member.role });
  };

  const closeManage = () => {
    if (manageActionInFlight || transferSaving) return;
    setManageError('');
    setShowTransferConfirm(false);
    setKickConfirm(null);
    setTransferConfirmInput('');
    setTransferError('');
    setManageTarget(null);
  };

  const openTransferConfirm = () => {
    if (manageActionInFlight || transferSaving) return;
    setTransferError('');
    setTransferConfirmInput('');
    setShowTransferConfirm(true);
  };

  const closeTransferConfirm = () => {
    if (transferSaving) return;
    setTransferError('');
    setTransferConfirmInput('');
    setShowTransferConfirm(false);
  };

  const handleTransferSubmit = async () => {
    if (!manageTarget || transferSaving || transferConfirmInput !== 'TRANSFER') return;
    setTransferSaving(true);
    setTransferError('');
    try {
      const result = await transferFounder({
        clerkGetToken: getToken,
        allianceId: myAlliance.id,
        targetPlayerId: manageTarget.player_id,
      });

      if (result.ok) {
        setShowTransferConfirm(false);
        setTransferConfirmInput('');
        setManageTarget(null);
        setTransferError('');
        await onRefreshAfterLeave();
        return;
      }

      const targetName = (manageTarget.username ?? 'Member').toUpperCase();
      if (result.status === 0 || result.error === 'network_error') {
        setTransferError(t('alliance.errTransferGeneric'));
      } else {
        setTransferError(mapTransferFounderError(t, result.error, targetName));
      }
    } catch (err) {
      console.error('Transfer founder failed:', err);
      setTransferError(t('alliance.errTransferGeneric'));
    } finally {
      setTransferSaving(false);
    }
  };

  const submitManageAction = async (action) => {
    if (!manageTarget || manageActionInFlight) return;
    setManageActionInFlight(action);
    setManageError('');
    try {
      let result;
      if (action.type === 'kick') {
        result = await kickMember({
          clerkGetToken: getToken,
          allianceId: myAlliance.id,
          playerId: manageTarget.player_id,
        });
      } else if (action.type === 'promote') {
        result = await promoteMember({
          clerkGetToken: getToken,
          allianceId: myAlliance.id,
          playerId: manageTarget.player_id,
          toRole: action.toRole,
        });
      } else if (action.type === 'demote') {
        result = await demoteMember({
          clerkGetToken: getToken,
          allianceId: myAlliance.id,
          playerId: manageTarget.player_id,
          toRole: action.toRole,
        });
      }

      if (result?.ok) {
        setManageTarget(null);
        setKickConfirm(null);
        setManageError('');
        await onRefreshAfterLeave(); // existing refetch prop — reuse, do not rename
        return;
      }
      setManageError(mapManageError(t, result?.error));
    } catch (err) {
      console.error('Manage action failed:', err);
      setManageError(t('alliance.errActionFailed'));
    } finally {
      setManageActionInFlight(null);
    }
  };

  if (manageTarget && showTransferConfirm) {
    const targetName = manageTarget.username ?? '—';
    const allianceName = myAlliance?.name ?? t('alliance.allianceFallback');
    const demotedRole = capitalizeRole(manageTarget.role);
    const transferBody = t('alliance.transferBody', { target: targetName, alliance: allianceName, role: demotedRole });
    const transferEnabled = transferConfirmInput === 'TRANSFER';

    return (
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.confirmWrap}>
          <Text style={styles.confirmKicker}>{t('alliance.allianceKicker')}</Text>
          <Text style={styles.confirmTitle} maxFontSizeMultiplier={1.2} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.65}>{t('alliance.transferTitle')}</Text>
          <Text style={styles.confirmBody}>{transferBody}</Text>

          <TextInput
            accessibilityLabel={t('alliance.typeTransfer')}
            keyboardAppearance="dark"
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!transferSaving}
            placeholder={t('alliance.typeTransfer')}
            placeholderTextColor={SLATE}
            style={styles.transferConfirmInput}
            value={transferConfirmInput}
            onChangeText={setTransferConfirmInput}
          />

          {transferError ? <Text style={styles.joinError}>{transferError}</Text> : null}

          <Pressable
            accessibilityRole="button"
            disabled={!transferEnabled || transferSaving}
            onPress={handleTransferSubmit}
            style={({ pressed }) => [
              styles.cta,
              (!transferEnabled || transferSaving) && styles.ctaDisabled,
              pressed && transferEnabled && !transferSaving && { opacity: 0.9 },
            ]}
          >
            {transferSaving ? (
              <>
                <ActivityIndicator color={BONE} />
                <Text style={[styles.ctaAction, { marginTop: 8 }]}>{t('alliance.transferring')}</Text>
              </>
            ) : (
              <Text style={styles.ctaAction}>{t('alliance.transfer')}</Text>
            )}
          </Pressable>

          <Pressable
            accessibilityRole="button"
            disabled={transferSaving}
            onPress={closeTransferConfirm}
            style={({ pressed }) => [styles.cancelLink, pressed && { opacity: 0.6 }]}
          >
            <Text style={styles.cancelLinkText}>{t('alliance.cancel')}</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  if (manageTarget && kickConfirm) {
    const targetName = manageTarget.username ?? '—';
    const inFlight = manageActionInFlight !== null;
    return (
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.confirmWrap}>
          <Text style={styles.confirmKicker}>{t('alliance.manageKicker')}</Text>
          <Text style={styles.confirmTitle} maxFontSizeMultiplier={1.2} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.65}>{t('alliance.kickConfirmTitle', { name: targetName.toUpperCase() })}</Text>
          <Text style={styles.confirmBody}>{t('alliance.kickConfirmBody', { name: targetName })}</Text>
          {manageError ? <Text style={styles.joinError}>{manageError}</Text> : null}
          <Pressable
            accessibilityRole="button"
            disabled={inFlight}
            onPress={() => submitManageAction(kickConfirm)}
            style={({ pressed }) => [styles.ctaDestructive, inFlight && styles.ctaDisabled, pressed && !inFlight && { opacity: 0.9 }]}
          >
            {inFlight ? (
              <>
                <ActivityIndicator color={BONE} />
                <Text style={[styles.ctaAction, { marginTop: 8 }]}>{t('alliance.loadingKick')}</Text>
              </>
            ) : (
              <Text style={styles.ctaAction}>{t('alliance.kickConfirmCta')}</Text>
            )}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={inFlight}
            onPress={() => setKickConfirm(null)}
            style={({ pressed }) => [styles.cancelLink, pressed && { opacity: 0.6 }]}
          >
            <Text style={styles.cancelLinkText}>{t('alliance.cancel')}</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  if (manageTarget) {
    const availableActions = getAvailableActions({
      actorRole: myRole,
      actorPlayerId: myPlayerId,
      targetRole: manageTarget.role,
      targetPlayerId: manageTarget.player_id,
    });

    return (
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.confirmWrap}>
          <Text style={styles.confirmKicker}>{t('alliance.manageKicker')}</Text>
          <Text style={styles.confirmTitle} maxFontSizeMultiplier={1.2} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.65}>{(manageTarget.username ?? '—').toUpperCase()}</Text>
          <Text style={styles.confirmTag}>{formatAllianceRole(t, manageTarget.role)}</Text>

          {availableActions.map((action, idx) => {
            const isTransfer = action.type === 'transfer_founder';
            const isThisInFlight =
              manageActionInFlight &&
              manageActionInFlight.type === action.type &&
              manageActionInFlight.toRole === action.toRole;
            const isAnyInFlight = manageActionInFlight !== null;
            return (
              <Pressable
                key={`${action.type}-${action.toRole ?? 'x'}`}
                accessibilityRole="button"
                disabled={isAnyInFlight}
                onPress={
                  isTransfer
                    ? openTransferConfirm
                    : action.type === 'kick'
                      ? () => setKickConfirm(action)
                      : () => submitManageAction(action)
                }
                style={({ pressed }) => [
                  // Red only for destructive actions; promote/demote are neutral.
                  isTransfer || action.type === 'kick' ? styles.ctaDestructive : styles.ctaSecondary,
                  idx > 0 && { marginTop: 10 },
                  isAnyInFlight && styles.ctaDisabled,
                  pressed && !isAnyInFlight && { opacity: 0.9 },
                ]}
              >
                {isThisInFlight ? (
                  <>
                    <ActivityIndicator color={BONE} />
                    <Text style={[styles.ctaAction, { marginTop: 8 }]}>{actionLoadingLabel(t, action)}</Text>
                  </>
                ) : (
                  <Text style={styles.ctaAction}>{actionLabel(t, action)}</Text>
                )}
              </Pressable>
            );
          })}

          <Pressable
            accessibilityRole="button"
            disabled={manageActionInFlight !== null}
            onPress={closeManage}
            style={({ pressed }) => [styles.cancelLink, pressed && { opacity: 0.6 }]}
          >
            <Text style={styles.cancelLinkText}>{t('alliance.cancel')}</Text>
          </Pressable>

          {manageError ? <Text style={styles.joinError}>{manageError}</Text> : null}
        </View>
      </ScrollView>
    );
  }

  if (leaveConfirmCase && !figma) {
    const allianceName = myAlliance?.name ?? t('alliance.allianceFallback');
    const title =
      leaveConfirmCase === 'blocked'
        ? t('alliance.cannotLeaveYet')
        : leaveConfirmCase === 'disband'
          ? t('alliance.disbandTitle', { name: allianceName })
          : t('alliance.leaveTitle', { name: allianceName });
    const body =
      leaveConfirmCase === 'blocked'
        ? t('alliance.blockedBody')
        : leaveConfirmCase === 'disband'
          ? t('alliance.disbandBody')
          : t('alliance.leaveBody');
    const primaryLabel =
      leaveConfirmCase === 'disband' ? t('alliance.disband') : leaveConfirmCase === 'leave' ? t('alliance.leave') : t('alliance.gotIt');
    const loadingLabel = leaveConfirmCase === 'disband' ? t('alliance.disbanding') : t('alliance.leaving');

    return (
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.confirmWrap}>
          <Text style={styles.confirmKicker}>{t('alliance.allianceKicker')}</Text>
          <Text style={styles.confirmTitle} maxFontSizeMultiplier={1.2} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.65}>{title}</Text>
          {leaveConfirmCase !== 'blocked' && myAlliance?.short_name ? (
            <Text style={styles.confirmTag}>[{myAlliance.short_name}]</Text>
          ) : null}
          <Text style={styles.confirmBody}>{body}</Text>

          <Pressable
            accessibilityRole="button"
            disabled={leaveSaving}
            onPress={leaveConfirmCase === 'blocked' ? closeLeaveConfirm : handleLeaveSubmit}
            style={({ pressed }) => [
              // "Got it" (blocked) is a neutral dismiss; leave/disband are red.
              leaveConfirmCase === 'blocked' ? styles.ctaSecondary : styles.cta,
              leaveSaving && styles.ctaDisabled,
              pressed && !leaveSaving && { opacity: 0.9 },
            ]}
          >
            {leaveSaving ? (
              <>
                <ActivityIndicator color={BONE} />
                <Text style={[styles.ctaAction, { marginTop: 8 }]}>{loadingLabel}</Text>
              </>
            ) : (
              <Text style={styles.ctaAction}>{primaryLabel}</Text>
            )}
          </Pressable>

          {leaveConfirmCase !== 'blocked' ? (
            <Pressable
              accessibilityRole="button"
              disabled={leaveSaving}
              onPress={closeLeaveConfirm}
              style={({ pressed }) => [styles.cancelLink, pressed && { opacity: 0.6 }]}
            >
              <Text style={styles.cancelLinkText}>{t('alliance.cancel')}</Text>
            </Pressable>
          ) : null}

          {leaveError ? <Text style={styles.joinError}>{leaveError}</Text> : null}
        </View>
      </ScrollView>
    );
  }

  // Dominia-Temp member view (Alliance case 4) with the leave confirm as a
  // modal over it.
  if (figma) {
    const blurb = allianceBlurb(myAlliance);
    const fallbackName = myAlliance?.name ?? t('alliance.allianceFallback');
    const leaveTitleText =
      leaveConfirmCase === 'blocked'
        ? t('alliance.cannotLeaveYet')
        : leaveConfirmCase === 'disband'
          ? t('alliance.disbandTitle', { name: fallbackName })
          : t('allianceFigma.leaveTitle', { defaultValue: 'LEAVE ALLIANCE?' });
    const leaveBodyText =
      leaveConfirmCase === 'blocked'
        ? t('alliance.blockedBody')
        : leaveConfirmCase === 'disband'
          ? t('alliance.disbandBody')
          : t('allianceFigma.leaveBody', {
              defaultValue: "You'll lose alliance missions and alliance chat. You can join or create another alliance later.",
            });
    const leaveCtaText =
      leaveConfirmCase === 'disband'
        ? t('alliance.disband')
        : t('allianceFigma.leaveAlliance', { defaultValue: 'LEAVE ALLIANCE' });
    const chatLabel = t('allianceFigma.chatCta', { defaultValue: 'CHAT' });
    const latest = events[0] ?? null;

    return (
      <>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.figmaMemberContent, { paddingTop: insets.top + 12 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.tempMemberHead}>
            <AllianceEmblemTile emblem={myAlliance?.emblem} size={56} />
            <View style={styles.tempMemberHeadText}>
              <Text
                style={styles.tempMemberTitle}
                accessibilityRole="header"
                maxFontSizeMultiplier={1.2}
                numberOfLines={2}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
              >
                {(myAlliance ? allianceTitle(myAlliance) : '').toUpperCase() || fallbackName}
              </Text>
              {blurb ? <Text style={styles.tempMemberBlurb}>{blurb}</Text> : null}
            </View>
            {onInfo ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('allianceFigma.about', { defaultValue: 'About alliances' })}
                onPress={onInfo}
                hitSlop={12}
                style={({ pressed }) => [styles.tempInfoBtn, pressed && { opacity: 0.6 }]}
              >
                <SvgXml xml={INFO_ICON_XML} width={18} height={18} />
              </Pressable>
            ) : null}
          </View>

          <AllianceStatsGrid
            location={myAlliance?.city}
            territories={territoryCount !== null ? territoryCount : '—'}
            joinType={myAlliance?.join_type}
          />
          <View style={styles.tempMembersCount}>
            <AllianceMembersCount count={roster.length} inline />
          </View>

          <Text style={styles.tempSectionTitle} accessibilityRole="header">
            {t('allianceFigma.allianceMissions', { defaultValue: 'ALLIANCE MISSIONS' })}
          </Text>
          <WeeklyTaskCard allianceId={allianceId} getToken={getToken} />

          <View style={styles.tempDivider} />
          <Text style={styles.tempSectionTitle} accessibilityRole="header">
            {t('allianceFigma.allianceMessages', { defaultValue: 'ALLIANCE MESSAGES' })}
          </Text>
          <View style={styles.tempMessagesBox}>
            <View style={styles.tempMessagesHead}>
              <Text style={styles.tempMessagesLive} maxFontSizeMultiplier={1.3}>
                {t('allianceFigma.liveTitle', { defaultValue: 'Live' })}
              </Text>
              <SlantButton
                label={chatLabel}
                onPress={openChat}
                variant="ghost"
                size="sm"
                trailingChevron={false}
                leading={<SvgXml xml={CHAT_ICON_XML} width={14} height={14} />}
                accessibilityLabel={t('allianceFigma.openChat', { defaultValue: 'OPEN CHAT' })}
                style={styles.tempChatBtn}
              />
            </View>
            <View style={styles.tempMessagesBody}>
              {latest ? (
                <AllianceLogEvent event={latest} />
              ) : isLoading ? (
                <ActivityIndicator color={SLATE2} style={{ marginVertical: 4 }} />
              ) : (
                <Text style={styles.tempEmptyMessages}>
                  {feedError
                    ? t('alliance.wireLost')
                    : t('allianceFigma.noTransmissionsShort', { defaultValue: 'No transmissions' })}
                </Text>
              )}
            </View>
          </View>

          {leader && requests.length > 0 ? (
            <>
              <View style={styles.tempDivider} />
              <Text style={styles.tempSectionTitle} accessibilityRole="header">
                {t('allianceFigma.joinRequests', { defaultValue: 'JOIN REQUESTS' })}
              </Text>
              {requests.map((r, i) => {
                const busy = requestBusy === r.id;
                return (
                  <View
                    key={r.id}
                    style={[styles.figmaRequestRow, i < requests.length - 1 && styles.figmaRequestRowBorder]}
                  >
                    <View style={styles.figmaRequestTile}>
                      <Text style={styles.figmaRequestInitials}>{memberInitials(r.username)}</Text>
                    </View>
                    <Text style={styles.figmaRequestName} numberOfLines={1}>{r.username ?? '—'}</Text>
                    {busy ? (
                      <ActivityIndicator color={SLATE2} />
                    ) : (
                      <>
                        <SlantButton
                          label={t('allianceFigma.decline', { defaultValue: 'DECLINE' })}
                          accessibilityLabel={`${t('allianceFigma.decline', { defaultValue: 'DECLINE' })} ${r.username ?? ''}`}
                          disabled={requestBusy !== null}
                          onPress={() => resolveRequest(r, 'decline')}
                          variant="ghost"
                          size="sm"
                          trailingChevron={false}
                          style={styles.tempRequestBtn}
                        />
                        <SlantButton
                          label={t('allianceFigma.accept', { defaultValue: 'ACCEPT' })}
                          accessibilityLabel={`${t('allianceFigma.accept', { defaultValue: 'ACCEPT' })} ${r.username ?? ''}`}
                          disabled={requestBusy !== null}
                          onPress={() => resolveRequest(r, 'accept')}
                          size="sm"
                          trailingChevron={false}
                          style={styles.tempRequestBtn}
                        />
                      </>
                    )}
                  </View>
                );
              })}
              {requestError ? (
                <Text style={styles.joinError} accessibilityLiveRegion="polite">{requestError}</Text>
              ) : null}
            </>
          ) : null}

          <View style={styles.tempDivider} />
          <Text style={styles.tempSectionTitle} accessibilityRole="header">
            {t('allianceFigma.allianceMembers', { defaultValue: 'ALLIANCE MEMBERS' })}
          </Text>
          <View style={styles.tempMemberList}>
            {roster.map((m, i) => (
              <AllianceMemberRow
                key={m.player_id}
                rank={i + 1}
                member={m}
                onPress={() =>
                  navigation.navigate('PublicProfile', { playerId: m.player_id, username: m.username })
                }
              />
            ))}
          </View>

          <View style={styles.tempLeaveRow}>
            <Text style={styles.tempLeavePrompt} maxFontSizeMultiplier={1.3}>
              {t('allianceFigma.leavePrompt', { defaultValue: 'Leave Alliance' })}
            </Text>
            <SlantButton
              label={t('allianceFigma.leaveCta', { defaultValue: 'LEAVE' })}
              onPress={openLeaveConfirm}
              variant="ghost"
              size="md"
              trailingChevron={false}
              leading={<SvgXml xml={LEAVE_ICON_XML} width={14} height={14} />}
              accessibilityLabel={t('allianceFigma.leaveAlliance', { defaultValue: 'LEAVE ALLIANCE' })}
              style={styles.tempLeaveBtn}
            />
          </View>
        </ScrollView>

        <Modal
          visible={Boolean(leaveConfirmCase)}
          transparent
          animationType="fade"
          onRequestClose={closeLeaveConfirm}
          statusBarTranslucent
        >
          <View style={styles.figmaModalBackdrop}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={closeLeaveConfirm}
              accessibilityRole="button"
              accessibilityLabel={t('allianceFigma.stay', { defaultValue: 'STAY' })}
            />
            <View style={styles.figmaModalCard} accessibilityViewIsModal>
              <Text style={styles.figmaModalTitle} accessibilityRole="header" maxFontSizeMultiplier={1.2}>
                {leaveTitleText}
              </Text>
              <Text style={styles.figmaModalBody}>{leaveBodyText}</Text>
              <SlantButton
                label={t('allianceFigma.stay', { defaultValue: 'STAY' })}
                onPress={closeLeaveConfirm}
                disabled={leaveSaving}
                size="md"
                trailingChevron={false}
                style={styles.tempModalBtn}
              />
              {leaveConfirmCase !== 'blocked' ? (
                <SlantButton
                  label={leaveCtaText}
                  onPress={handleLeaveSubmit}
                  loading={leaveSaving}
                  variant="outline"
                  size="md"
                  trailingChevron={false}
                  style={styles.tempModalBtn}
                />
              ) : null}
              {leaveError ? (
                <Text style={styles.joinError} accessibilityLiveRegion="polite">{leaveError}</Text>
              ) : null}
            </View>
          </View>
        </Modal>
      </>
    );
  }

  return (
    <>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.memberScrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.sectionLabelRow}>
          <Text style={styles.sectionLabelText}>{t('alliance.thisWeek')}</Text>
          <Text style={styles.sectionLabelAccent}>{t('alliance.collectiveMission')}</Text>
          <View style={styles.sectionHairline} />
        </View>
        <WeeklyTaskCard allianceId={allianceId} getToken={getToken} />

        <View style={styles.sectionLabelRow}>
          <Text style={styles.sectionLabelText}>{t('alliance.allianceMessages')}</Text>
          <Text style={styles.sectionLabelAccent}>{t('alliance.wire')}</Text>
          <View style={styles.sectionHairline} />
        </View>

        <View style={styles.wireContainer}>
          <View style={styles.wireHeaderStrip}>
            <Text style={styles.wireStatusText}>{t('alliance.wireLive')}</Text>
          </View>
          <ScrollView
            style={styles.wireScroll}
            contentContainerStyle={events.length === 0 ? styles.wireEmptyContent : null}
            onScroll={handleWireScroll}
            scrollEventThrottle={400}
            showsVerticalScrollIndicator={true}
            nestedScrollEnabled={true}
          >
            {events.length === 0 && !isLoading && !feedError && (
              <Text style={styles.wireEmptyText}>{t('alliance.noTransmissions')}</Text>
            )}
            {events.map((item) => (
              <AllianceLogEvent key={item.id} event={item} />
            ))}
            {isLoadingMore && (
              <ActivityIndicator style={styles.wireLoadingMore} color={SLATE} />
            )}
            {!isLoadingMore && !nextCursor && events.length > 0 && (
              <Text style={styles.wireEndOfList}>{t('alliance.endOfWire')}</Text>
            )}
          </ScrollView>
          {isLoading && (
            <View style={styles.wireOverlay}>
              <ActivityIndicator color={SLATE2} />
            </View>
          )}
          {!isLoading && feedError && (
            <View style={styles.wireOverlay}>
              <Text style={styles.wireErrorText}>{t('alliance.wireLost')}</Text>
              <Pressable onPress={fetchFirstPage} style={styles.wireRetryButton}>
                <Text style={styles.wireRetryText}>{t('common.retry')}</Text>
              </Pressable>
            </View>
          )}
        </View>

        {rosterToolsOn ? (
          <>
        <View style={styles.sectionLabelRow}>
          <Text style={styles.sectionLabelText}>{t('alliance.topContributors')}</Text>
          <Text style={styles.sectionLabelAccent}>{t('alliance.thisWeekAccent')}</Text>
          <View style={styles.sectionHairline} />
        </View>

        <WeeklyTopContributors allianceId={allianceId} getToken={getToken} />
          </>
        ) : null}

        {/* Legacy roster (the Figma member view returns above). */}
        <>
        <View style={styles.sectionLabelRow}>
          <Text style={styles.sectionLabelText}>{t('alliance.roster')}</Text>
          <Text style={styles.sectionLabelAccent}>{t('alliance.memberCount', { n: roster.length })}</Text>
          <View style={styles.sectionHairline} />
        </View>
        {roster.map((m, i) => {
          // Tap any row → that member's profile. Long-press a member you can
          // manage → the kick/promote/demote modal (handleRosterRowTap).
          const actions =
            rosterToolsOn && myRole && myPlayerId
              ? getAvailableActions({
                  actorRole: myRole,
                  actorPlayerId: myPlayerId,
                  targetRole: m.role,
                  targetPlayerId: m.player_id,
                })
              : [];
          return (
            <RosterRow
              key={m.player_id}
              avatarUrl={m.avatar_url ?? null}
              initials={m.username ? m.username.slice(0, 2).toUpperCase() : '??'}
              name={m.username ?? '—'}
              role={formatAllianceRole(t, m.role)}
              isFounder={m.role === 'founder'}
              levelLabel={Number.isFinite(m.level) ? t('alliance.levelShort', { n: m.level }) : ''}
              manageLabel={t('alliance.manage')}
              onManage={actions.length > 0 ? () => handleRosterRowTap(m) : undefined}
              showBorder={i < roster.length - 1}
              onPress={() =>
                navigation.navigate('PublicProfile', {
                  playerId: m.player_id,
                  username: m.username,
                })
              }
            />
          );
        })}
        </>

        {isFounder && commandPostOn ? (
          <Pressable
            style={({ pressed }) => [styles.commandPostBtn, pressed && { opacity: 0.7 }]}
            onPress={() => navigation.navigate('CommandPost', {
              allianceId: myAlliance?.id,
              allianceName: myAlliance?.name,
              shortName: myAlliance?.short_name,
            })}
          >
            <Text style={styles.commandPostBtnText}>{t('alliance.enterCommandPost')}</Text>
          </Pressable>
        ) : null}

        {warRoomOn ? (
        <Pressable
          style={({ pressed }) => [styles.warRoomBtn, isFounder && commandPostOn && { marginTop: 12 }, pressed && { opacity: 0.7 }]}
          onPress={() => navigation.navigate('WarRoom', {
            allianceId: myAlliance?.id,
            allianceName: myAlliance?.name,
            shortName: myAlliance?.short_name,
            currentPlayerId: playerId,
          })}
        >
          <Text style={styles.warRoomBtnText}>{t('alliance.enterWarRoom')}</Text>
        </Pressable>
        ) : null}

        <Pressable
          accessibilityRole="button"
          onPress={openLeaveConfirm}
          style={({ pressed }) => [styles.leaveLink, pressed && { opacity: 0.6 }]}
        >
          <Text style={styles.leaveLinkText}>{t('alliance.leaveAlliance')}</Text>
        </Pressable>
      </ScrollView>
    </>
  );
}

// Dominia-Temp browse (Alliance cases 1–2; alliance_hq_create off): server
// list and search from GET /alliances?q= (caller's city only). Search row
// (CutField + SEARCH), CutCard rows with the emblem glyph tile, "Name - TAG",
// a territories chip and a members chip, and a sticky "Create your own
// Alliance / CREATE" footer. A row opens the case-3 detail modal.
function FigmaBrowse({ getToken, navigation, onJoined, listWrapRef }) {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [alliances, setAlliances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState(null);
  const requestSeq = useRef(0);

  const load = useCallback(async (q) => {
    const seq = ++requestSeq.current;
    setLoading(true);
    setError(false);
    const res = await listAlliances({ clerkGetToken: getToken, query: q });
    if (seq !== requestSeq.current) return; // a newer search superseded this one
    if (res.ok) {
      setAlliances(res.data.alliances);
    } else {
      setAlliances([]);
      setError(true);
    }
    setLoading(false);
  }, [getToken]);

  useFocusEffect(
    useCallback(() => {
      load(query);
    }, [load, query]),
  );

  const submitSearch = () => setQuery(input.trim());

  const onChangeInput = (text) => {
    setInput(text);
    // Clearing the field restores the full list without pressing Search.
    if (!text.trim() && query) setQuery('');
  };

  const state = allianceListState({ loading, error, alliances, query });
  const goCreate = () => navigation.navigate('CreateAlliance');
  const searchLabel = t('allianceFigma.search', { defaultValue: 'Search' });

  let body;
  if (state === 'loading') {
    body = (
      <View style={styles.figmaCentered}>
        <ActivityIndicator color={SLATE2} />
      </View>
    );
  } else if (state === 'error') {
    body = (
      <View style={styles.figmaCentered}>
        <Text style={styles.errorText}>{t('alliance.couldNotLoad')}</Text>
        <SlantButton
          label={t('common.retry')}
          onPress={() => load(query)}
          variant="ghost"
          size="sm"
          style={styles.tempRetry}
        />
      </View>
    );
  } else {
    body = (
      <ScrollView
        style={styles.figmaListScroll}
        contentContainerStyle={styles.tempListContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {state === 'empty' ? (
          <Text style={[styles.emptyListText, styles.figmaEmptyText]}>
            {t('allianceFigma.emptyCity', { defaultValue: 'No alliances in your city yet' })}
          </Text>
        ) : state === 'no_results' ? (
          <Text style={[styles.emptyListText, styles.figmaEmptyText]} accessibilityLiveRegion="polite">
            {t('allianceFigma.noResults', { defaultValue: 'No alliances match "{{query}}"', query })}
          </Text>
        ) : (
          alliances.map((a) => {
            const territories = padRank(a.territory_count ?? 0);
            const members = `${padRank(a.member_count ?? 0)} / ${ALLIANCE_MAX_MEMBERS}`;
            const meta = t('allianceFigma.rowMeta', {
              territories: a.territory_count ?? 0,
              members: a.member_count ?? 0,
              max: ALLIANCE_MAX_MEMBERS,
              defaultValue: '{{territories}} TERRITORIES · {{members}}/{{max}} MEMBERS',
            });
            return (
              <CutCard
                key={a.id}
                padding={10}
                onPress={() => setSelected(a)}
                accessibilityLabel={`${allianceTitle(a)}, ${meta}`}
              >
                <View style={styles.tempRow}>
                  <SlantTile size={34} square tone="raised" slant={8}>
                    <AllianceEmblem emblem={a.emblem} variant="glyph" size={16} />
                  </SlantTile>
                  <Text style={styles.tempRowName} numberOfLines={2} maxFontSizeMultiplier={1.3}>
                    {allianceTitle(a)}
                  </Text>
                  <SlantTile size={26} tone="raised" slant={6} paddingHorizontal={10} style={styles.tempChip}>
                    <SvgXml xml={MAP_ICON_XML} width={12} height={12} />
                    <Text style={styles.tempChipText} maxFontSizeMultiplier={1.2}>{territories}</Text>
                  </SlantTile>
                  <SlantTile size={26} tone="raised" slant={6} paddingHorizontal={10} style={styles.tempChip}>
                    <SvgXml xml={MEMBERS_ICON_XML} width={12} height={12} />
                    <Text style={styles.tempChipText} maxFontSizeMultiplier={1.2}>{members}</Text>
                  </SlantTile>
                </View>
              </CutCard>
            );
          })
        )}
      </ScrollView>
    );
  }

  return (
    <View ref={listWrapRef} collapsable={false} style={styles.scroll}>
      <View style={styles.tempSearchRow}>
        <CutField
          value={input}
          onChangeText={onChangeInput}
          onSubmitEditing={submitSearch}
          placeholder={t('allianceFigma.searchPlaceholderTemp', { defaultValue: 'Alliance name, Alliance tag...' })}
          keyboardAppearance="dark"
          returnKeyType="search"
          autoCorrect={false}
          maxLength={50}
          accessibilityLabel={t('allianceFigma.searchLabel', { defaultValue: 'Search alliances' })}
          containerStyle={styles.tempSearchField}
        />
        <SlantButton
          label={searchLabel}
          onPress={submitSearch}
          variant="ghost"
          size="lg"
          trailingChevron={false}
          style={styles.tempSearchBtn}
        />
      </View>

      <View style={{ flex: 1 }}>{body}</View>

      <View style={styles.tempFooter}>
        <Text style={styles.tempFooterText} maxFontSizeMultiplier={1.3}>
          {t('allianceFigma.createPrompt', { defaultValue: 'Create your own Alliance' })}
        </Text>
        <SlantButton
          label={t('allianceFigma.create', { defaultValue: 'Create' })}
          onPress={goCreate}
          size="md"
          trailingChevron={false}
          leading={<SvgXml xml={PENCIL_ICON_XML} width={14} height={14} />}
          style={styles.tempFooterBtn}
        />
      </View>

      <AllianceDetailSheet
        alliance={selected}
        getToken={getToken}
        onClose={() => setSelected(null)}
        onJoined={async (allianceId) => {
          setSelected(null);
          await onJoined(allianceId);
        }}
      />
    </View>
  );
}

export default function AllianceScreen() {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { userId, getToken: clerkGetToken } = useAuth();
  const getTokenRef = useRef(clerkGetToken);
  getTokenRef.current = clerkGetToken;
  // Clerk's getToken changes identity between renders. Everything below (and
  // every child that takes it as a prop) uses this stable wrapper, so focus
  // effects and loaders keyed on it run once per focus instead of looping.
  const getToken = useCallback((...args) => getTokenRef.current(...args), []);
  const hasLoadedOnceRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [playerRow, setPlayerRow] = useState(null);
  const [myAlliance, setMyAlliance] = useState(null);
  const [roster, setRoster] = useState([]);
  const [allianceList, setAllianceList] = useState([]);
  const [territoryCount, setTerritoryCount] = useState(null);
  const [confirmAlliance, setConfirmAlliance] = useState(null);
  const [joinSaving, setJoinSaving] = useState(false);
  // alliance_hq_create off = Figma alliance screens (server list/search,
  // detail pop-up, header stats, territories per member, explainers).
  const figma = !useFlag('alliance_hq_create');
  // Bumped by the (i) buttons to show the alliance explainers again.
  const [explainerReopen, setExplainerReopen] = useState(0);
  const openExplainer = useCallback(() => setExplainerReopen((n) => n + 1), []);

  const loadAllianceList = useCallback(async (playerHomeCity) => {

    if (!playerHomeCity) {
      setAllianceList([]);
      return;
    }

    const { data: alliances, error: listError } = await supabase
      .from('alliances')
      .select('id, name, short_name, city, founder_id')
      .is('disbanded_at', null)
      .eq('city', playerHomeCity);

    if (listError) {
      console.error('AllianceScreen alliances list:', listError);
      setAllianceList([]);
      return;
    }

    if (!alliances?.length) {
      setAllianceList([]);
      return;
    }

    const founderIds = Array.from(
      new Set(alliances.map((a) => a.founder_id).filter(Boolean)),
    );
    let founderById = new Map();
    if (founderIds.length) {
      const foundersRes = await supabase
        .from('players')
        .select('id, username')
        .in('id', founderIds);
      if (!foundersRes.error && foundersRes.data?.length) {
        founderById = new Map(foundersRes.data.map((f) => [f.id, f.username]));
      }
    }

    const allianceIds = alliances.map((a) => a.id);
    const { data: allMembers } = await supabase
      .from('players')
      .select('alliance_id')
      .in('alliance_id', allianceIds);

    const countById = {};
    for (const m of allMembers ?? []) {
      countById[m.alliance_id] = (countById[m.alliance_id] ?? 0) + 1;
    }

    const nextList = alliances.map((a) => ({
      ...a,
      memberCount: countById[a.id] ?? 0,
      founder_username: founderById.get(a.founder_id) ?? null,
    }));

    setAllianceList(nextList);
  }, []);

  const fetchAllianceData = useCallback(
    async ({ silent = false } = {}) => {
      const clerkGetToken = () => getTokenRef.current();

      if (!userId) {
        hasLoadedOnceRef.current = false;
        setPlayerRow(null);
        setMyAlliance(null);
        setRoster([]);
        setAllianceList([]);
        setTerritoryCount(null);
        setFetchError(null);
        if (!silent) setLoading(false);
        return;
      }

      if (!silent) setLoading(true);
      setFetchError(null);

      try {
        const [myResult, playerResult] = await Promise.all([
          getMyAlliance({ clerkGetToken }),
          supabase.from('players').select('id, alliance_id, home_city').eq('clerk_id', userId).maybeSingle(),
        ]);

        if (playerResult.error) {
          console.error('AllianceScreen player fetch:', playerResult.error);
          setPlayerRow(null);
        } else {
          setPlayerRow((prev) =>
            prev?.id === playerResult.data?.id &&
            prev?.alliance_id === playerResult.data?.alliance_id &&
            prev?.home_city === playerResult.data?.home_city
              ? prev
              : playerResult.data,
          );
        }

        if (!myResult.ok) {
          // Keep last-good member data: a refresh blip shows an inline banner
          // rather than ejecting the member to the browse list. On the initial
          // load there is nothing to retain, so the full-screen error still shows.
          setFetchError(t('alliance.couldNotLoad'));
          return;
        }

        if (myResult.data === null) {
          setMyAlliance(null);
          setRoster([]);
          setTerritoryCount(null);
          // Figma browse loads its own list from GET /alliances.
          if (!figma) await loadAllianceList(playerResult.data?.home_city ?? null);
          return;
        }

        const detailResult = await getAllianceById({
          clerkGetToken,
          allianceId: myResult.data.alliance_id,
        });

        if (!detailResult.ok) {
          // Retain last-good roster/alliance; the inline error banner renders
          // over the existing content instead of throwing the member to browse.
          setFetchError(t('alliance.couldNotLoad'));
          return;
        }

        const { alliance, members } = figma
          ? normalizeAllianceDetail(detailResult.data)
          : detailResult.data;
        const nextAlliance = { ...alliance, memberCount: members.length };
        setMyAlliance((prev) =>
          prev?.id === nextAlliance.id &&
          prev?.memberCount === nextAlliance.memberCount &&
          prev?.name === nextAlliance.name &&
          prev?.short_name === nextAlliance.short_name &&
          prev?.emblem === nextAlliance.emblem &&
          prev?.description === nextAlliance.description &&
          prev?.rules === nextAlliance.rules
            ? prev
            : nextAlliance,
        );
        setRoster((prev) => {
          if (
            prev.length === members.length &&
            prev.every(
              (m, i) =>
                m.player_id === members[i].player_id &&
                m.role === members[i].role &&
                m.territories_held === members[i].territories_held,
            )
          ) {
            return prev;
          }
          return members;
        });
        setAllianceList((prev) => (prev.length === 0 ? prev : []));

        const { count: terrCount, error: terrError } = await supabase
          .from('territories')
          .select('*', { count: 'exact', head: true })
          .eq('alliance_id', alliance.id);
        const nextTerritoryCount = terrError ? null : terrCount ?? 0;
        setTerritoryCount((prev) => (prev === nextTerritoryCount ? prev : nextTerritoryCount));
      } finally {
        if (!silent) setLoading(false);
        hasLoadedOnceRef.current = true;
      }
    },
    [userId, loadAllianceList, t, figma],
  );

  useFocusEffect(
    useCallback(() => {
      fetchAllianceData({ silent: hasLoadedOnceRef.current });
    }, [fetchAllianceData]),
  );

  const isMember = Boolean(myAlliance?.id);

  // First-tap tips (unaffiliated state only — both targets are absent for
  // members, so no touch can ever match and nothing fires).
  const walkthroughHeaderRef = useRef(null);
  const walkthroughListRef = useRef(null);
  const allianceTips = useMemo(
    () => [
      { key: 'solo', text: t('walkthrough.alliance.solo'), getRect: () => rectFromRef(walkthroughHeaderRef) },
      { key: 'list', text: t('walkthrough.alliance.list'), getRect: () => rectFromRef(walkthroughListRef) },
    ],
    [t],
  );
  const tips = useFirstTapTips({ screenKey: 'alliance', userId, tips: allianceTips });

  if (loading) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator size="large" color={SLATE2} />
        <Text style={styles.loadingText}>{t('common.loading')}</Text>
      </View>
    );
  }

  if (fetchError && !isMember) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Text style={styles.errorText}>{fetchError}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => fetchAllianceData()}
          style={({ pressed }) => [styles.retryBtn, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.retryBtnText}>{t('common.retry')}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen} onTouchStart={tips.onTouchStart}>
      {isMember && !figma && (
        <View style={styles.header}>
          <View style={styles.headerTopRow}>
            <AllianceEmblem emblem={myAlliance?.emblem} size={40} />
            <View style={{ flex: 1 }} />
            <View style={styles.shortNameBox}>
              <Text style={styles.shortNameText}>{myAlliance?.short_name ?? '—'}</Text>
            </View>
            {/* legacy_tabs off only; renders nothing with it on. */}
            <ProfileAvatarButton style={styles.headerAvatar} />
          </View>

          <Text style={styles.headerTitle} maxFontSizeMultiplier={1.2} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.65}>{myAlliance?.name ?? t('alliance.allianceFallback')}</Text>

          <Text style={styles.headerCity}>
            {t('alliance.headerCity', { city: (myAlliance?.city ?? '—').toUpperCase() })}
          </Text>

          <View style={styles.headerDivider} />

          <View style={styles.headerStatsRow}>
            <Text style={styles.headerStat}>
              <Text style={styles.headerStatLabel}>{t('alliance.rosterLabel')}</Text>
              <Text style={styles.headerStatValue}>{t('alliance.slash20', { n: myAlliance?.memberCount ?? '—' })}</Text>
            </Text>
            <Text style={styles.headerStat}>
              <Text style={styles.headerStatLabel}>{t('alliance.territoriesLabel')}</Text>
              <Text style={styles.headerStatValue}>
                {territoryCount !== null ? String(territoryCount) : '—'}
              </Text>
            </Text>
          </View>
        </View>
      )}
      {!isMember && figma && (
        <View ref={walkthroughHeaderRef} collapsable={false} style={[styles.tempHeader, { paddingTop: insets.top + 12 }]}>
          <View style={styles.tempHeaderText}>
            <Text style={styles.tempHeaderTitle} accessibilityRole="header" maxFontSizeMultiplier={1.2}>
              {t('allianceFigma.titleSingular', { defaultValue: 'ALLIANCE' })}
            </Text>
            <Text style={styles.tempHeaderSubtitle} maxFontSizeMultiplier={1.4}>
              {t('allianceFigma.subtitle', { defaultValue: 'Join or Create a Alliance to be a part of it.' })}
            </Text>
          </View>
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <SlantTile size={40} square selected slant={10}>
              <SvgXml xml={MEMBERS_ICON_XML} width={20} height={20} />
            </SlantTile>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('allianceFigma.about', { defaultValue: 'About alliances' })}
            onPress={openExplainer}
            hitSlop={12}
            style={({ pressed }) => [styles.tempInfoBtn, pressed && { opacity: 0.6 }]}
          >
            <SvgXml xml={INFO_ICON_XML} width={18} height={18} />
          </Pressable>
        </View>
      )}
      {!isMember && !figma && !confirmAlliance && (
        <View ref={walkthroughHeaderRef} collapsable={false} style={styles.header}>
          <View style={styles.headerTopRow}>
            <HeaderKicker>{t('alliance.kicker')}</HeaderKicker>
            {/* legacy_tabs off only; renders nothing with it on. */}
            <ProfileAvatarButton style={styles.headerAvatar} />
          </View>
          <Text style={styles.headerTitle} maxFontSizeMultiplier={1.2}>{t('alliance.noAllianceTitle')}</Text>
          <Text style={styles.headerSubtitle}>{t('alliance.unaffiliated')}</Text>
        </View>
      )}

      {isMember ? (
        fetchError ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{fetchError}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => fetchAllianceData()}
              style={({ pressed }) => [styles.retryBtn, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.retryBtnText}>{t('common.retry')}</Text>
            </Pressable>
          </View>
        ) : (
          <MemberContent
            myAlliance={myAlliance}
            playerId={playerRow?.id}
            roster={roster}
            getToken={getToken}
            onRefreshAfterLeave={() => fetchAllianceData({ silent: true })}
            figma={figma}
            territoryCount={territoryCount}
            onInfo={openExplainer}
          />
        )
      ) : figma ? (
        <FigmaBrowse
          getToken={getToken}
          navigation={navigation}
          listWrapRef={walkthroughListRef}
          onJoined={async (allianceId) => {
            await fetchAllianceData({ silent: true });
            navigation.navigate('AllianceJoined', { allianceId, context: 'joined' });
          }}
        />
      ) : (
        <NonMemberContent
          alliances={allianceList}
          playerHomeCity={playerRow?.home_city}
          onRefreshAfterJoin={() => fetchAllianceData({ silent: true })}
          navigation={navigation}
          confirmAlliance={confirmAlliance}
          setConfirmAlliance={setConfirmAlliance}
          joinSaving={joinSaving}
          setJoinSaving={setJoinSaving}
          getToken={getToken}
          listWrapRef={walkthroughListRef}
        />
      )}

      {tips.tipElement}

      {figma ? (
        <FeatureExplainer
          userId={userId}
          name="explainer:allianceIntro"
          pages={[
            {
              title: t('allianceFigma.explainerWhatTitle', { defaultValue: 'WHAT ARE ALLIANCES?' }),
              body: t('allianceFigma.explainerWhatBodyTemp', {
                defaultValue: 'Alliances are teams where members can work together to claim more territories as a group.',
              }),
            },
            {
              title: t('allianceFigma.explainerJoinTitle', { defaultValue: 'JOIN OR CREATE' }),
              body: t('allianceFigma.explainerJoinBodyTemp', {
                defaultValue: 'Join an existing alliance or create your own and recruit members to work together.',
              }),
            },
          ]}
          reopen={explainerReopen}
          placement="bottom"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // ── Dominia-Temp list (cases 1–2) ──
  tempHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 16,
    marginHorizontal: 0,
    borderBottomWidth: 1,
    borderBottomColor: HAIRLINE_STRONG,
    marginBottom: 16,
  },
  tempHeaderText: { flex: 1 },
  tempHeaderTitle: {
    fontFamily: 'Archivo_900Black_Italic',
    fontSize: 34,
    lineHeight: 40,
    color: BONE,
    textTransform: 'uppercase',
  },
  tempHeaderSubtitle: {
    fontFamily: 'IBMPlexSans_500Medium',
    fontSize: 12,
    lineHeight: 16,
    color: SLATE2,
    marginTop: 4,
  },
  tempInfoBtn: {
    minWidth: 28,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tempSearchRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  tempSearchField: { flex: 1 },
  tempSearchBtn: { alignSelf: 'auto', minHeight: 54 },
  tempListContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 8,
  },
  tempRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tempRowName: {
    flex: 1,
    marginLeft: 4,
    fontFamily: 'IBMPlexSans_600SemiBold',
    fontSize: 13,
    lineHeight: 17,
    color: BONE,
  },
  tempChip: { gap: 5 },
  tempChipText: {
    fontFamily: 'IBMPlexSans_600SemiBold',
    fontSize: 12,
    color: BONE,
  },
  tempRetry: { alignSelf: 'center', marginTop: 12 },
  tempFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: HAIRLINE,
    backgroundColor: INK,
  },
  tempFooterText: {
    flex: 1,
    fontFamily: 'IBMPlexSans_600SemiBold',
    fontSize: 14,
    color: BONE,
  },
  tempFooterBtn: { alignSelf: 'auto', minWidth: 120 },
  // ── Dominia-Temp member view (case 4) ──
  tempMemberHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  tempMemberHeadText: { flex: 1 },
  tempMemberTitle: {
    fontFamily: 'Archivo_900Black_Italic',
    fontSize: 20,
    lineHeight: 24,
    color: BONE,
    textTransform: 'uppercase',
  },
  tempMemberBlurb: {
    fontFamily: 'IBMPlexSans_500Medium',
    fontSize: 12,
    lineHeight: 17,
    color: SLATE2,
    marginTop: 4,
  },
  tempMembersCount: { marginTop: 12 },
  tempSectionTitle: {
    fontFamily: 'Archivo_900Black_Italic',
    fontSize: 15,
    letterSpacing: 0.6,
    color: BONE,
    textTransform: 'uppercase',
    marginTop: 16,
    marginBottom: 10,
  },
  tempDivider: {
    height: 1,
    backgroundColor: HAIRLINE_STRONG,
    marginTop: 16,
  },
  tempMessagesBox: {
    borderWidth: 1,
    borderColor: HAIRLINE_STRONG,
    backgroundColor: INK2,
  },
  tempMessagesHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 12,
    borderBottomWidth: 1,
    borderBottomColor: HAIRLINE_STRONG,
  },
  tempMessagesLive: {
    fontFamily: 'IBMPlexSans_600SemiBold',
    fontSize: 13,
    color: BONE,
  },
  tempChatBtn: { alignSelf: 'auto' },
  tempMessagesBody: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tempEmptyMessages: {
    fontFamily: 'IBMPlexSans_500Medium',
    fontSize: 12,
    color: SLATE2,
    textAlign: 'center',
  },
  tempRequestBtn: { alignSelf: 'auto', marginLeft: 6 },
  tempMemberList: { gap: 8 },
  tempLeaveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  tempLeavePrompt: {
    fontFamily: 'IBMPlexSans_600SemiBold',
    fontSize: 14,
    color: BONE,
  },
  tempLeaveBtn: { alignSelf: 'auto', minWidth: 110 },
  tempModalBtn: { marginTop: 12 },
  // ── Figma F3 list ──
  figmaListContent: {
    paddingBottom: 28,
  },
  figmaCityLine: {
    fontFamily: 'IBMPlexSans_700Bold',
    fontSize: 11,
    letterSpacing: 1.4,
    color: SLATE2,
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  figmaEmptyText: {
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  figmaRowLast: {
    borderBottomWidth: 0,
  },
  figmaTagTile: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: ALLIANCE_GREEN,
    backgroundColor: 'rgba(91,123,245,0.18)',
  },
  figmaTagTileText: {
    fontFamily: 'IBMPlexSans_600SemiBold',
    fontSize: 11,
    letterSpacing: 1,
    color: BONE,
  },
  figmaRowTag: {
    fontFamily: 'IBMPlexSans_700Bold',
    fontSize: 11,
    letterSpacing: 1,
    color: SLATE,
  },
  figmaRowMeta: {
    fontFamily: 'IBMPlexSans_700Bold',
    fontSize: 11,
    letterSpacing: 1.2,
    color: SLATE2,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  figmaChevron: {
    fontFamily: 'IBMPlexSans_700Bold',
    fontSize: 22,
    color: SLATE2,
    marginLeft: 8,
  },
  figmaNoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    marginTop: 16,
  },
  figmaNoteText: {
    flex: 1,
    fontFamily: 'IBMPlexSans_500Medium',
    fontSize: 13,
    lineHeight: 18,
    color: SLATE2,
  },
  figmaCreateFull: {
    minHeight: 52,
    marginHorizontal: 16,
    marginTop: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CLAIM_BUTTON,
  },
  // ── Figma F5 member view / F8 leave modal ──
  figmaMemberContent: {
    paddingHorizontal: 16,
    paddingBottom: 28,
  },
  figmaMemberTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  figmaMemberTitle: {
    flex: 1,
    marginTop: 0,
  },
  figmaIconBtn: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -10,
  },
  figmaIdentityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  figmaIdentityText: {
    flex: 1,
    marginLeft: 12,
  },
  figmaMemberTag: {
    fontFamily: 'IBMPlexSans_700Bold',
    fontSize: 11,
    letterSpacing: 1.2,
    color: ALLIANCE_GREEN,
    textTransform: 'uppercase',
  },
  figmaMemberBlurb: {
    fontFamily: 'IBMPlexSans_500Medium',
    fontSize: 13,
    lineHeight: 18,
    color: SLATE2,
    marginTop: 4,
  },
  figmaSectionTitle: {
    fontFamily: 'Archivo_900Black_Italic',
    fontSize: 22,
    lineHeight: 26,
    color: BONE,
    textTransform: 'uppercase',
    marginTop: 24,
    marginBottom: 12,
  },
  figmaSectionTitleInline: {
    marginTop: 0,
    marginBottom: 0,
    flex: 1,
  },
  figmaSectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 12,
  },
  figmaLiveChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(132,255,68,0.14)',
  },
  figmaLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: LIME,
  },
  figmaLiveText: {
    fontFamily: 'IBMPlexSans_600SemiBold',
    fontSize: 11,
    letterSpacing: 1.2,
    color: LIME,
  },
  figmaMessagesBox: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: HAIRLINE_STRONG,
    backgroundColor: INK2,
  },
  figmaWireScroll: {
    alignSelf: 'stretch',
    maxHeight: 220,
  },
  figmaEmptyMessages: {
    fontFamily: 'IBMPlexSans_500Medium',
    fontSize: 15,
    color: SLATE2,
    marginTop: 10,
  },
  figmaOpenChatBtn: {
    minHeight: 44,
    paddingHorizontal: 48,
    marginTop: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: HAIRLINE_STRONG,
    backgroundColor: INK,
  },
  figmaOpenChatText: {
    fontFamily: 'IBMPlexSans_600SemiBold',
    fontSize: 13,
    letterSpacing: 1.6,
    color: BONE,
    textTransform: 'uppercase',
  },
  figmaRequestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingVertical: 8,
    gap: 8,
  },
  figmaRequestRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: HAIRLINE,
  },
  figmaRequestTile: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: HAIRLINE_STRONG,
    backgroundColor: INK3,
    marginRight: 4,
  },
  figmaRequestInitials: {
    fontFamily: 'IBMPlexSans_600SemiBold',
    fontSize: 11,
    color: BONE,
  },
  figmaRequestName: {
    flex: 1,
    fontFamily: 'IBMPlexSans_600SemiBold',
    fontSize: 16,
    color: BONE,
  },
  figmaRequestBtn: {
    minHeight: 44,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: HAIRLINE_STRONG,
  },
  figmaRequestAccept: {
    backgroundColor: CLAIM_BUTTON,
    borderColor: CLAIM_BUTTON,
  },
  figmaRequestDeclineText: {
    fontFamily: 'IBMPlexSans_600SemiBold',
    fontSize: 11,
    letterSpacing: 1.2,
    color: SLATE2,
  },
  figmaRequestAcceptText: {
    fontFamily: 'IBMPlexSans_600SemiBold',
    fontSize: 11,
    letterSpacing: 1.2,
    color: BONE,
  },
  figmaLeaveBtn: {
    minHeight: 52,
    marginTop: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: DANGER,
  },
  figmaLeaveText: {
    fontFamily: 'IBMPlexSans_600SemiBold',
    fontSize: 13,
    letterSpacing: 1.6,
    color: DANGER,
    textTransform: 'uppercase',
  },
  figmaModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.82)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  figmaModalCard: {
    backgroundColor: INK2,
    borderWidth: 1,
    borderColor: HAIRLINE_STRONG,
    padding: 20,
  },
  figmaModalTitle: {
    fontFamily: 'Archivo_900Black_Italic',
    fontSize: 26,
    lineHeight: 29,
    color: BONE,
    textTransform: 'uppercase',
  },
  figmaModalBody: {
    fontFamily: 'IBMPlexSans_500Medium',
    fontSize: 15,
    lineHeight: 21,
    color: SLATE2,
    marginTop: 10,
  },
  figmaModalPrimary: {
    minHeight: 48,
    marginTop: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CLAIM_BUTTON,
  },
  figmaModalPrimaryText: {
    fontFamily: 'IBMPlexSans_600SemiBold',
    fontSize: 13,
    letterSpacing: 1.6,
    color: BONE,
    textTransform: 'uppercase',
  },
  figmaModalDanger: {
    minHeight: 48,
    marginTop: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: DANGER,
  },
  figmaModalDangerText: {
    fontFamily: 'IBMPlexSans_600SemiBold',
    fontSize: 13,
    letterSpacing: 1.6,
    color: DANGER,
    textTransform: 'uppercase',
  },
  figmaListScroll: {
    flex: 1,
  },
  figmaSearchRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  figmaSearchInput: {
    flex: 1,
    minHeight: 44,
    backgroundColor: INK2,
    borderWidth: 1,
    borderColor: HAIRLINE,
    paddingHorizontal: 12,
    color: BONE,
    fontFamily: 'IBMPlexSans_500Medium',
    fontSize: 15,
  },
  figmaSearchBtn: {
    minHeight: 44,
    paddingHorizontal: 16,
    justifyContent: 'center',
    backgroundColor: INK3,
    borderWidth: 1,
    borderColor: HAIRLINE_STRONG,
  },
  figmaSearchBtnText: {
    fontFamily: 'IBMPlexSans_600SemiBold',
    fontSize: 13,
    letterSpacing: 1.2,
    color: BONE,
    textTransform: 'uppercase',
  },
  figmaCentered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  figmaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: HAIRLINE,
  },
  figmaRowInfo: {
    flex: 1,
  },
  figmaCreateBtnText: {
    fontFamily: 'IBMPlexSans_600SemiBold',
    fontSize: 13,
    letterSpacing: 1.4,
    color: BONE,
    textTransform: 'uppercase',
  },
  screen: {
    flex: 1,
    backgroundColor: INK,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontFamily: 'IBMPlexSans_700Bold',
    fontSize: 11,
    letterSpacing: 1.6,
    color: SLATE2,
    textTransform: 'uppercase',
  },
  errorBanner: {
    margin: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: HAIRLINE_STRONG,
    gap: 12,
  },
  errorText: {
    fontFamily: 'IBMPlexSans_700Bold',
    fontSize: 11,
    letterSpacing: 1.4,
    color: SLATE2,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  retryBtn: {
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: '#84FF44',
    paddingVertical: 14,
    paddingHorizontal: 24,
    minHeight: 48,
    justifyContent: 'center',
  },
  retryBtnText: {
    fontFamily: 'IBMPlexSans_600SemiBold',
    fontSize: 11,
    letterSpacing: 1.6,
    color: '#84FF44',
    textTransform: 'uppercase',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: (StatusBar.currentHeight ?? 0) + 12,
    paddingBottom: 12,
  },
  headerKicker: {
    fontFamily: 'IBMPlexSans_700Bold',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.6,
    color: SLATE2,
  },
  headerTitle: {
    fontFamily: 'Archivo_900Black_Italic',
    fontSize: 32,
    color: BONE,
    textTransform: 'uppercase',
    letterSpacing: -0.02,
    marginTop: 8,
    lineHeight: 35,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  headerAvatar: {
    marginLeft: 12,
  },
  // The [TAG] chip is an identifier, not ownership — neutral hairline + Bone.
  shortNameBox: {
    borderWidth: 1,
    borderColor: HAIRLINE_STRONG,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 0,
  },
  shortNameText: {
    fontFamily: 'IBMPlexSans_600SemiBold',
    fontSize: 11,
    color: BONE,
    letterSpacing: 1.4,
  },
  headerCity: {
    fontFamily: 'IBMPlexSans_700Bold',
    fontSize: 11,
    color: SLATE2,
    letterSpacing: 1.4,
    marginTop: 6,
  },
  headerDivider: {
    height: 1,
    backgroundColor: HAIRLINE_STRONG,
    marginTop: 14,
    marginBottom: 14,
  },
  headerStatsRow: {
    flexDirection: 'row',
    gap: 24,
  },
  headerStat: {
    fontFamily: 'IBMPlexSans_700Bold',
    fontSize: 11,
    color: SLATE2,
  },
  headerStatLabel: {
    fontFamily: 'IBMPlexSans_700Bold',
    fontSize: 11,
    color: SLATE2,
    letterSpacing: 1.4,
  },
  headerStatValue: {
    fontFamily: 'IBMPlexSans_600SemiBold',
    fontSize: 11,
    color: BONE,
  },
  headerSubtitle: {
    marginTop: 6,
    fontFamily: 'IBMPlexSans_700Bold',
    fontSize: 11,
    color: SLATE2,
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
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
  },
  directiveText: {
    fontFamily: 'IBMPlexSans_700Bold',
    fontSize: 11,
    letterSpacing: 1.6,
    color: SLATE,
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    marginTop: 6,
    marginBottom: 6,
  },

  allianceListScroll: {
    maxHeight: 320,
    marginHorizontal: 16,
  },
  allianceListContent: {
    paddingBottom: 8,
  },

  aRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: HAIRLINE,
  },
  aRowFirst: {
    borderTopWidth: 1,
    borderTopColor: HAIRLINE,
  },
  aRowPressed: {
    backgroundColor: 'rgba(253,253,253,0.03)',
  },
  aInfo: {
    flex: 1,
  },
  aNameLine: {
    fontFamily: 'Archivo_900Black_Italic',
    fontSize: 20,
    color: BONE,
    lineHeight: 22,
    textTransform: 'uppercase',
  },
  aName: {
    fontFamily: 'Archivo_900Black_Italic',
    fontSize: 20,
    color: BONE,
    lineHeight: 22,
    textTransform: 'uppercase',
  },
  aTag: {
    fontFamily: 'IBMPlexSans_600SemiBold',
    fontSize: 13,
    color: SLATE2,
    letterSpacing: 1,
  },
  aMeta: {
    fontFamily: 'IBMPlexSans_700Bold',
    fontSize: 11,
    color: SLATE,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  aMembers: {
    fontFamily: 'IBMPlexSans_600SemiBold',
    fontSize: 13,
    color: BONE,
    marginRight: 8,
  },
  aChev: {
    fontFamily: 'IBMPlexSans_700Bold',
    fontSize: 13,
    color: SLATE,
  },

  footerRow: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 18,
    borderTopWidth: 1,
    borderTopColor: HAIRLINE,
    marginTop: 4,
  },
  footerCreateBtn: {
    minHeight: 48,
    justifyContent: 'center',
  },
  createLink: {
    fontFamily: 'IBMPlexSans_700Bold',
    fontSize: 11,
    letterSpacing: 1.6,
    color: SLATE2,
    textTransform: 'uppercase',
  },
  createLinkStrong: {
    fontFamily: 'IBMPlexSans_600SemiBold',
    color: BONE,
  },

  emptyListWrap: {
    paddingHorizontal: 16,
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyListText: {
    fontFamily: 'IBMPlexSans_700Bold',
    fontSize: 11,
    letterSpacing: 1.4,
    color: SLATE,
    textTransform: 'uppercase',
  },

  confirmWrap: {
    paddingTop: (StatusBar.currentHeight ?? 0) + 24,
  },
  confirmKicker: {
    fontFamily: 'IBMPlexSans_700Bold',
    fontSize: 11,
    letterSpacing: 1.8,
    color: SLATE2,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  confirmTitle: {
    fontFamily: 'Archivo_900Black_Italic',
    fontSize: 26,
    color: BONE,
    textTransform: 'uppercase',
    letterSpacing: -0.3,
    lineHeight: 27,
    marginBottom: 6,
  },
  confirmTag: {
    fontFamily: 'IBMPlexSans_600SemiBold',
    fontSize: 14,
    letterSpacing: 2,
    color: SLATE2,
    textTransform: 'uppercase',
    marginBottom: 24,
  },
  confirmBody: {
    fontFamily: 'IBMPlexSans_500Medium',
    fontSize: 14,
    color: SLATE2,
    lineHeight: 21,
    marginBottom: 32,
  },

  cta: {
    backgroundColor: CLAIM_BUTTON,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'flex-start',
  },
  ctaDisabled: {
    opacity: 0.7,
  },
  ctaDestructive: {
    backgroundColor: '#E34234',
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: '#E34234',
  },
  // Constructive/neutral action (promote, demote, acknowledge) — no red.
  // Red is reserved for destructive actions (kick, transfer, leave, disband).
  ctaSecondary: {
    backgroundColor: INK2,
    borderWidth: 1,
    borderColor: HAIRLINE_STRONG,
    paddingVertical: 14,
    paddingHorizontal: 20,
    minHeight: 48,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  transferConfirmInput: {
    fontFamily: 'IBMPlexSans_600SemiBold',
    fontSize: 14,
    letterSpacing: 1.4,
    color: BONE,
    borderWidth: 1,
    borderColor: HAIRLINE_STRONG,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 24,
    textTransform: 'uppercase',
  },
  ctaAction: {
    fontFamily: 'IBMPlexSans_600SemiBold',
    fontSize: 16,
    letterSpacing: 1.6,
    color: BONE,
    textTransform: 'uppercase',
  },

  cancelLink: {
    marginTop: 18,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  cancelLinkText: {
    fontFamily: 'IBMPlexSans_700Bold',
    fontSize: 11,
    letterSpacing: 1.6,
    color: SLATE,
    textTransform: 'uppercase',
  },
  // Errors read as sentences in Bone (Instrument Sans), never Claim red (Locked Meaning).
  joinError: {
    fontFamily: 'IBMPlexSans_500Medium',
    fontSize: 13,
    color: BONE,
    marginTop: 16,
    lineHeight: 18,
  },
  leaveLink: {
    marginTop: 24,
    marginBottom: 32,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    minHeight: 48,
  },
  leaveLinkText: {
    fontFamily: 'IBMPlexSans_700Bold',
    fontSize: 11,
    letterSpacing: 1.6,
    color: SLATE,
    textTransform: 'uppercase',
  },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
  },
  sectionLabelText: {
    fontFamily: 'IBMPlexSans_700Bold',
    fontSize: 11,
    color: SLATE2,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  sectionLabelAccent: {
    fontFamily: 'IBMPlexSans_600SemiBold',
    fontSize: 11,
    color: BONE,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  sectionHairline: {
    flex: 1,
    height: 1,
    backgroundColor: HAIRLINE_STRONG,
    marginLeft: 8,
  },
  rosterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 12,
  },
  rosterRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: HAIRLINE,
  },
  rosterLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  rosterAvatar: {
    width: 32,
    height: 32,
    backgroundColor: INK3,
    borderWidth: 1,
    borderColor: HAIRLINE_STRONG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rosterAvatarImg: {
    width: 32,
    height: 32,
  },
  rosterInitials: {
    fontFamily: 'IBMPlexSans_600SemiBold',
    fontSize: 11,
    color: BONE,
    letterSpacing: 0.5,
  },
  rosterName: {
    fontFamily: 'IBMPlexSans_600SemiBold',
    fontSize: 14,
    color: BONE,
  },
  // Role is a label, not ownership — Slate 2. Founder carries alliance identity.
  rosterRole: {
    fontFamily: 'IBMPlexSans_700Bold',
    fontSize: 11,
    color: SLATE2,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  rosterRoleFounder: {
    color: ALLIANCE_GREEN,
  },
  rosterLevel: {
    fontFamily: 'IBMPlexSans_600SemiBold',
    fontSize: 13,
    color: BONE,
    letterSpacing: 0.5,
  },
  rosterManageBtn: {
    marginLeft: 12,
    borderWidth: 1,
    borderColor: HAIRLINE_STRONG,
    paddingVertical: 8,
    paddingHorizontal: 12,
    minHeight: 48,
    justifyContent: 'center',
  },
  rosterManageText: {
    fontFamily: 'IBMPlexSans_600SemiBold',
    fontSize: 11,
    color: BONE,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  commandPostBtn: {
    marginTop: 32,
    borderWidth: 1,
    borderColor: ALLIANCE_GREEN,
    borderRadius: 0,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(91,123,245,0.10)',
  },
  commandPostBtnText: {
    fontFamily: 'IBMPlexSans_600SemiBold',
    fontSize: 12,
    color: ALLIANCE_GREEN,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  // Neutral secondary nav button — red is not spent on the alliance hub.
  warRoomBtn: {
    marginTop: 32,
    borderWidth: 1,
    borderColor: HAIRLINE_STRONG,
    borderRadius: 0,
    paddingVertical: 16,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: INK2,
  },
  warRoomBtnText: {
    fontFamily: 'IBMPlexSans_600SemiBold',
    fontSize: 12,
    color: BONE,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  wireContainer: {
    marginTop: 12,
    height: 320,
    borderWidth: 1,
    borderColor: HAIRLINE_STRONG,
    backgroundColor: INK,
    borderRadius: 0,
  },
  wireHeaderStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: HAIRLINE,
    backgroundColor: INK,
  },
  wireStatusText: {
    fontFamily: 'IBMPlexSans_600SemiBold',
    fontSize: 11,
    letterSpacing: 1.6,
    color: ALLIANCE_GREEN,
    textTransform: 'uppercase',
  },
  wireScroll: {
    flex: 1,
  },
  wireEmptyContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  wireEmptyText: {
    fontFamily: 'IBMPlexSans_700Bold',
    fontSize: 11,
    letterSpacing: 1.4,
    color: SLATE,
    textTransform: 'uppercase',
  },
  wireLoadingMore: {
    paddingVertical: 16,
  },
  wireEndOfList: {
    fontFamily: 'IBMPlexSans_700Bold',
    fontSize: 11,
    letterSpacing: 1.8,
    color: SLATE,
    textTransform: 'uppercase',
    textAlign: 'center',
    paddingVertical: 14,
  },
  wireOverlay: {
    position: 'absolute',
    top: 35,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: INK,
  },
  wireErrorText: {
    fontFamily: 'IBMPlexSans_700Bold',
    fontSize: 11,
    letterSpacing: 1.4,
    color: SLATE2,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  wireRetryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 48,
    justifyContent: 'center',
  },
  wireRetryText: {
    fontFamily: 'IBMPlexSans_600SemiBold',
    fontSize: 11,
    letterSpacing: 1.6,
    color: SLATE2,
    textTransform: 'uppercase',
  },
});
