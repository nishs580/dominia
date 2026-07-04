import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StatusBar, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import AllianceEmblem from '../components/AllianceEmblem';
import AllianceLogEvent from '../components/AllianceLogEvent';
import { getAllianceById, getMyAlliance, joinAlliance, leaveAlliance, kickMember, promoteMember, demoteMember, transferFounder } from '../lib/allianceApi';
import { getAllianceActivityLog, markAllianceActivityLogRead } from '../lib/allianceActivityLogApi';
import { getAvailableActions } from '../lib/alliancePermissions';
import { supabase } from '../lib/supabase';
import { colors, fonts, fontSize, spacing, radius, borders, text } from '../lib/theme';
import WalkthroughOverlay, { rectFromRef } from '../components/WalkthroughOverlay';

const CLAIM = '#D64525';
const INK = '#0E1014';
const INK2 = '#1A1D24';
const INK3 = '#252932';
const BONE = '#F2EEE6';
const SLATE = '#5C6068';
const SLATE2 = '#8B8F98';
const ALLIANCE_GREEN = '#3F8F4E';
const HAIRLINE = 'rgba(242,238,230,0.08)';
const HAIRLINE_STRONG = 'rgba(242,238,230,0.16)';

function formatAllianceRole(t, role) {
  if (!role) return t('alliance.roleMember');
  if (role === 'founder') return t('alliance.roleFounder');
  return role.toUpperCase();
}

function mapJoinAllianceError(t, error) {
  const code = error?.code ?? null;
  switch (code) {
    case 'already_in_alliance':
      return t('alliance.errAlreadyInAlliance');
    case 'not_same_city':
      return t('alliance.errNotSameCity');
    case 'level_too_low':
      return t('alliance.errLevelTooLowJoin');
    case 'alliance_full':
      return t('alliance.errAllianceFull');
    case 'alliance_disbanded':
      return t('alliance.errAllianceDisbanded');
    case 'alliance_not_found':
      return t('alliance.errAllianceNotFound');
    case 'player_not_found':
      return t('alliance.errAccount');
    default:
      return t('alliance.errCouldNotJoin');
  }
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

function RosterRow({ initials, name, role, steps, showBorder, onPress, onLongPress }) {
  const inner = (
    <>
      <View style={styles.rosterLeft}>
        <View style={styles.rosterAvatar}>
          <Text style={styles.rosterInitials}>{initials}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.rosterName}>{name}</Text>
          <Text style={styles.rosterRole}>{role}</Text>
        </View>
      </View>
      <Text style={styles.rosterSteps}>{steps}</Text>
    </>
  );

  if (onPress || onLongPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={350}
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
          <Text style={styles.confirmTitle}>{t('alliance.joinTitle', { name: confirmAlliance.name })}</Text>
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
            style={({ pressed }) => [pressed && { opacity: 0.6 }]}
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
          style={({ pressed }) => [pressed && { opacity: 0.6 }]}
        >
          <Text style={styles.createLink}>
            {t('alliance.orCreate')}<Text style={styles.createLinkStrong}>{t('alliance.createYourOwn')}</Text>
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function MemberContent({ myAlliance, playerId, roster, getToken, onRefreshAfterLeave }) {
  const navigation = useNavigation();
  const { t } = useTranslation();
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
  const [manageError, setManageError] = useState('');
  const [showTransferConfirm, setShowTransferConfirm] = useState(false);
  const [transferConfirmInput, setTransferConfirmInput] = useState('');
  const [transferSaving, setTransferSaving] = useState(false);
  const [transferError, setTransferError] = useState('');

  const myMember = roster.find((m) => m.player_id === playerId);
  const myRole = myMember?.role ?? null;
  const myPlayerId = playerId;
  const isFounder = myMember?.role === 'founder';
  const rosterSize = roster.length;

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
    setTransferConfirmInput('');
    setTransferError('');
    setManageTarget({ player_id: member.player_id, username: member.username, role: member.role });
  };

  const closeManage = () => {
    if (manageActionInFlight || transferSaving) return;
    setManageError('');
    setShowTransferConfirm(false);
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
          <Text style={styles.confirmTitle}>{t('alliance.transferTitle')}</Text>
          <Text style={styles.confirmBody}>{transferBody}</Text>

          <TextInput
            accessibilityLabel={t('alliance.typeTransfer')}
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
          <Text style={styles.confirmTitle}>{(manageTarget.username ?? '—').toUpperCase()}</Text>
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
                onPress={isTransfer ? openTransferConfirm : () => submitManageAction(action)}
                style={({ pressed }) => [
                  isTransfer ? styles.ctaDestructive : styles.cta,
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

  if (leaveConfirmCase) {
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
          <Text style={styles.confirmTitle}>{title}</Text>
          {leaveConfirmCase !== 'blocked' && myAlliance?.short_name ? (
            <Text style={styles.confirmTag}>[{myAlliance.short_name}]</Text>
          ) : null}
          <Text style={styles.confirmBody}>{body}</Text>

          <Pressable
            accessibilityRole="button"
            disabled={leaveSaving}
            onPress={leaveConfirmCase === 'blocked' ? closeLeaveConfirm : handleLeaveSubmit}
            style={({ pressed }) => [
              styles.cta,
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

  const TOP_CONTRIBUTORS = [
    { rank: '1.', name: 'NISH_S', role: 'FOUNDR', streak: 'UNBROKEN 30D', steps: '24,210' },
    { rank: '2.', name: 'RUBIK', role: 'MEMBER', streak: 'RELIABLE 14D', steps: '18,432' },
    { rank: '3.', name: 'MAYA-K', role: 'MEMBER', streak: 'COMMITTED 6D', steps: '12,104' },
  ];

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
        <View style={styles.missionCard}>
          <View style={styles.missionTopRow}>
            <Text style={styles.missionStatusLabel}>MISSION IN PROGRESS</Text>
            <Text style={styles.missionTimer}>RESETS IN 4D</Text>
          </View>
          <Text style={styles.missionTitle}>Collective Fitness — 500,000 steps</Text>
          <Text style={styles.missionDesc}>Every member's daily step count contributes.</Text>
          <View style={styles.missionProgressRow}>
            <Text style={styles.missionProgressValue}>300,000 steps</Text>
            <Text style={styles.missionProgressTotal}>/ 500,000</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: '60%' }]} />
          </View>
          <Text style={styles.missionReward}>REWARD — +40 GOLD EACH · +300 XP</Text>
        </View>

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

        <View style={styles.sectionLabelRow}>
          <Text style={styles.sectionLabelText}>{t('alliance.topContributors')}</Text>
          <Text style={styles.sectionLabelAccent}>{t('alliance.thisWeekAccent')}</Text>
          <View style={styles.sectionHairline} />
        </View>

        {TOP_CONTRIBUTORS.map((c, i) => (
          <React.Fragment key={c.name}>
            <View style={styles.contributorRow}>
              <Text style={styles.contributorRank}>{c.rank}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.contributorName}>{c.name}</Text>
                <Text style={styles.contributorMeta}>
                  {c.role} · {c.streak}
                </Text>
              </View>
              <Text style={styles.contributorSteps}>{c.steps}</Text>
            </View>
            {i < TOP_CONTRIBUTORS.length - 1 && <View style={styles.rowDivider} />}
          </React.Fragment>
        ))}

        <View style={styles.sectionLabelRow}>
          <Text style={styles.sectionLabelText}>{t('alliance.roster')}</Text>
          <Text style={styles.sectionLabelAccent}>{t('alliance.activeAccent', { n: roster.length })}</Text>
          <View style={styles.sectionHairline} />
          <Text style={styles.sectionLabelRight}>{t('alliance.resetsMon')}</Text>
        </View>
        {roster.map((m, i) => {
          // Tap any row → that member's profile. Long-press a member you can
          // manage → the kick/promote/demote modal (handleRosterRowTap).
          const actions =
            myRole && myPlayerId
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
              initials={m.username ? m.username.slice(0, 2).toUpperCase() : '??'}
              name={m.username ?? '—'}
              role={formatAllianceRole(t, m.role)}
              steps="—"
              showBorder={i < roster.length - 1}
              onPress={() =>
                navigation.navigate('PublicProfile', {
                  playerId: m.player_id,
                  username: m.username,
                })
              }
              onLongPress={actions.length > 0 ? () => handleRosterRowTap(m) : undefined}
            />
          );
        })}

        {isFounder ? (
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

        <Pressable
          style={({ pressed }) => [styles.warRoomBtn, isFounder && { marginTop: 12 }, pressed && { opacity: 0.7 }]}
          onPress={() => navigation.navigate('WarRoom', {
            allianceId: myAlliance?.id,
            allianceName: myAlliance?.name,
            shortName: myAlliance?.short_name,
            currentPlayerId: playerId,
          })}
        >
          <Text style={styles.warRoomBtnText}>{t('alliance.enterWarRoom')}</Text>
        </Pressable>

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

export default function AllianceScreen() {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const { userId, getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
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

  const loadAllianceList = useCallback(async (playerHomeCity) => {
    console.log('[loadAllianceList] fetched at', Date.now());

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
          setFetchError(t('alliance.couldNotLoad'));
          setMyAlliance(null);
          setRoster([]);
          setTerritoryCount(null);
          return;
        }

        if (myResult.data === null) {
          setMyAlliance(null);
          setRoster([]);
          setTerritoryCount(null);
          await loadAllianceList(playerResult.data?.home_city ?? null);
          return;
        }

        const detailResult = await getAllianceById({
          clerkGetToken,
          allianceId: myResult.data.alliance_id,
        });

        if (!detailResult.ok) {
          setFetchError(t('alliance.couldNotLoad'));
          setMyAlliance(null);
          setRoster([]);
          setTerritoryCount(null);
          return;
        }

        const { alliance, members } = detailResult.data;
        const nextAlliance = { ...alliance, memberCount: members.length };
        setMyAlliance((prev) =>
          prev?.id === nextAlliance.id &&
          prev?.memberCount === nextAlliance.memberCount &&
          prev?.name === nextAlliance.name &&
          prev?.short_name === nextAlliance.short_name &&
          prev?.emblem === nextAlliance.emblem
            ? prev
            : nextAlliance,
        );
        setRoster((prev) => {
          if (
            prev.length === members.length &&
            prev.every((m, i) => m.player_id === members[i].player_id && m.role === members[i].role)
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
    [userId, loadAllianceList, t],
  );

  useFocusEffect(
    useCallback(() => {
      fetchAllianceData({ silent: hasLoadedOnceRef.current });
    }, [fetchAllianceData]),
  );

  const isMember = Boolean(myAlliance?.id);

  // First-view walkthrough (unaffiliated state only — both targets are absent
  // for members, so every step self-skips and the tour simply never runs).
  const walkthroughHeaderRef = useRef(null);
  const walkthroughListRef = useRef(null);
  const walkthroughSteps = useMemo(
    () => [
      { key: 'solo', text: t('walkthrough.alliance.solo'), getRect: () => rectFromRef(walkthroughHeaderRef) },
      { key: 'list', text: t('walkthrough.alliance.list'), getRect: () => rectFromRef(walkthroughListRef) },
    ],
    [t],
  );

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
    <View style={styles.screen}>
      {isMember && (
        <View style={styles.header}>
          <View style={styles.headerTopRow}>
            <AllianceEmblem emblem={myAlliance?.emblem} size={40} />
            <View style={{ flex: 1 }} />
            <View style={styles.shortNameBox}>
              <Text style={styles.shortNameText}>{myAlliance?.short_name ?? '—'}</Text>
            </View>
          </View>

          <Text style={styles.headerTitle}>{myAlliance?.name ?? t('alliance.allianceFallback')}</Text>

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
      {!isMember && !confirmAlliance && (
        <View ref={walkthroughHeaderRef} collapsable={false} style={styles.header}>
          <HeaderKicker>{t('alliance.kicker')}</HeaderKicker>
          <Text style={styles.headerTitle}>{t('alliance.noAllianceTitle')}</Text>
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
          />
        )
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

      <WalkthroughOverlay
        screenKey="alliance"
        userId={userId}
        enabled={!loading && !isMember}
        steps={walkthroughSteps}
      />
    </View>
  );
}

const styles = StyleSheet.create({
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
    fontFamily: 'GeistMono_400Regular',
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
    fontFamily: 'GeistMono_400Regular',
    fontSize: 11,
    letterSpacing: 1.4,
    color: SLATE2,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  retryBtn: {
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: CLAIM,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  retryBtnText: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 11,
    letterSpacing: 1.6,
    color: CLAIM,
    textTransform: 'uppercase',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: (StatusBar.currentHeight ?? 0) + 12,
    paddingBottom: 12,
  },
  headerKicker: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 1.6,
    color: SLATE2,
  },
  headerTitle: {
    fontFamily: 'Archivo_900Black',
    fontSize: 40,
    color: BONE,
    textTransform: 'uppercase',
    letterSpacing: -0.02,
    marginTop: 8,
    lineHeight: 44,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  shortNameBox: {
    borderWidth: 1,
    borderColor: CLAIM,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 0,
  },
  shortNameText: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 11,
    color: CLAIM,
    letterSpacing: 1.4,
  },
  headerCity: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 10,
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
    fontFamily: 'GeistMono_400Regular',
    fontSize: 11,
    color: SLATE2,
  },
  headerStatLabel: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 11,
    color: SLATE2,
    letterSpacing: 1.4,
  },
  headerStatValue: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 11,
    color: BONE,
  },
  headerSubtitle: {
    marginTop: 6,
    fontFamily: 'GeistMono_400Regular',
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
  sectionLabelText: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 9,
    letterSpacing: 1.6,
    color: SLATE2,
    textTransform: 'uppercase',
  },
  sectionLabelAccent: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 9,
    letterSpacing: 1.6,
    color: BONE,
    textTransform: 'uppercase',
  },
  sectionHairline: {
    flex: 1,
    height: 1,
    backgroundColor: HAIRLINE_STRONG,
    marginLeft: 8,
  },
  directiveText: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 10,
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
    backgroundColor: 'rgba(242,238,230,0.03)',
  },
  aInfo: {
    flex: 1,
  },
  aNameLine: {
    fontFamily: 'Inter_500Medium',
    fontSize: 15,
    color: BONE,
  },
  aName: {
    fontFamily: 'Inter_500Medium',
    fontSize: 15,
    color: BONE,
  },
  aTag: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 13,
    color: SLATE2,
    letterSpacing: 1,
  },
  aMeta: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 9,
    color: SLATE,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  aMembers: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 13,
    color: BONE,
    marginRight: 8,
  },
  aChev: {
    fontFamily: 'GeistMono_400Regular',
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
  createLink: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 11,
    letterSpacing: 1.6,
    color: SLATE2,
    textTransform: 'uppercase',
  },
  createLinkStrong: {
    fontFamily: 'GeistMono_500Medium',
    color: BONE,
  },

  emptyListWrap: {
    paddingHorizontal: 16,
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyListText: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 11,
    letterSpacing: 1.4,
    color: SLATE,
    textTransform: 'uppercase',
  },

  confirmWrap: {
    paddingTop: (StatusBar.currentHeight ?? 0) + 24,
  },
  confirmKicker: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 10,
    letterSpacing: 1.8,
    color: SLATE2,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  confirmTitle: {
    fontFamily: 'Archivo_900Black',
    fontSize: 32,
    color: BONE,
    textTransform: 'uppercase',
    letterSpacing: -0.3,
    lineHeight: 34,
    marginBottom: 6,
  },
  confirmTag: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 14,
    letterSpacing: 2,
    color: SLATE2,
    textTransform: 'uppercase',
    marginBottom: 24,
  },
  confirmBody: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: SLATE2,
    lineHeight: 21,
    marginBottom: 32,
  },

  cta: {
    backgroundColor: CLAIM,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'flex-start',
  },
  ctaDisabled: {
    opacity: 0.7,
  },
  ctaDestructive: {
    backgroundColor: CLAIM,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: CLAIM,
  },
  transferConfirmInput: {
    fontFamily: 'GeistMono_500Medium',
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
  ctaStep: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 9,
    letterSpacing: 1.6,
    color: BONE,
    opacity: 0.75,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  ctaAction: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 16,
    letterSpacing: 1.6,
    color: BONE,
    textTransform: 'uppercase',
  },

  cancelLink: {
    marginTop: 18,
    alignItems: 'center',
  },
  cancelLinkText: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 11,
    letterSpacing: 1.6,
    color: SLATE,
    textTransform: 'uppercase',
  },
  joinError: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 10,
    letterSpacing: 1.4,
    color: CLAIM,
    textTransform: 'uppercase',
    marginTop: 16,
    lineHeight: 14,
  },
  leaveLink: {
    marginTop: 24,
    marginBottom: 32,
    alignItems: 'center',
    paddingVertical: 8,
  },
  leaveLinkText: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 10,
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
    fontFamily: 'GeistMono_400Regular',
    fontSize: 9,
    color: SLATE2,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  sectionLabelAccent: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 9,
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
  sectionLabelRight: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 9,
    color: SLATE2,
    letterSpacing: 1.4,
    marginLeft: 8,
  },
  missionCard: {
    marginTop: 16,
    backgroundColor: INK2,
    borderWidth: 1,
    borderColor: HAIRLINE_STRONG,
    borderRadius: 0,
    padding: 16,
    borderLeftWidth: 2,
    borderLeftColor: ALLIANCE_GREEN,
  },
  missionTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  missionStatusLabel: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 9,
    color: ALLIANCE_GREEN,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  missionTimer: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 9,
    color: SLATE2,
    letterSpacing: 1.4,
  },
  missionTitle: {
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
    color: BONE,
    lineHeight: 22,
  },
  missionDesc: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 10,
    color: SLATE2,
    marginTop: 6,
    lineHeight: 16,
  },
  missionProgressRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginTop: 12,
  },
  missionProgressValue: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 13,
    color: BONE,
  },
  missionProgressTotal: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 11,
    color: SLATE2,
  },
  progressTrack: {
    marginTop: 8,
    height: 2,
    backgroundColor: HAIRLINE_STRONG,
    borderRadius: 0,
  },
  progressFill: {
    height: '100%',
    backgroundColor: ALLIANCE_GREEN,
    borderRadius: 0,
  },
  missionReward: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 9,
    color: SLATE2,
    letterSpacing: 1.4,
    marginTop: 12,
    textTransform: 'uppercase',
  },
  contributorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 12,
  },
  contributorRank: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 11,
    color: CLAIM,
    width: 20,
  },
  contributorName: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: BONE,
    textTransform: 'uppercase',
  },
  contributorMeta: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 9,
    color: SLATE2,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: 3,
  },
  contributorSteps: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 13,
    color: BONE,
  },
  rowDivider: {
    height: 1,
    backgroundColor: HAIRLINE,
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
    width: 0,
    height: 0,
    opacity: 0,
  },
  rosterInitials: {
    width: 0,
    height: 0,
    opacity: 0,
  },
  rosterName: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: BONE,
    textTransform: 'uppercase',
  },
  rosterRole: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 9,
    color: CLAIM,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    width: 52,
  },
  rosterSteps: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 13,
    color: BONE,
  },
  commandPostBtn: {
    marginTop: 32,
    borderWidth: 1,
    borderColor: ALLIANCE_GREEN,
    borderRadius: 0,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(63,143,78,0.10)',
  },
  commandPostBtnText: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 12,
    color: ALLIANCE_GREEN,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  warRoomBtn: {
    marginTop: 32,
    borderWidth: 1,
    borderColor: '#D64525',
    borderRadius: 0,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  warRoomBtnText: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 12,
    color: '#D64525',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  wireContainer: {
    marginTop: 12,
    height: 320,
    borderWidth: 1,
    borderColor: HAIRLINE_STRONG,
    backgroundColor: '#08090C',
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
    fontFamily: 'GeistMono_500Medium',
    fontSize: 9,
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
    fontFamily: 'GeistMono_400Regular',
    fontSize: 10,
    letterSpacing: 1.4,
    color: SLATE,
    textTransform: 'uppercase',
  },
  wireLoadingMore: {
    paddingVertical: 16,
  },
  wireEndOfList: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 9,
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
    backgroundColor: '#08090C',
  },
  wireErrorText: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 10,
    letterSpacing: 1.4,
    color: SLATE2,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  wireRetryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  wireRetryText: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 10,
    letterSpacing: 1.6,
    color: SLATE2,
    textTransform: 'uppercase',
  },
});
