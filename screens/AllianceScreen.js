import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StatusBar, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import AllianceLogEvent from '../components/AllianceLogEvent';
import { getAllianceById, getMyAlliance, joinAlliance, leaveAlliance, kickMember, promoteMember, demoteMember, transferFounder } from '../lib/allianceApi';
import { getAllianceActivityLog, markAllianceActivityLogRead } from '../lib/allianceActivityLogApi';
import { getAvailableActions } from '../lib/alliancePermissions';
import { supabase } from '../lib/supabase';
import { colors, fonts, fontSize, spacing, radius, borders, text } from '../lib/theme';

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

function formatAllianceRole(role) {
  if (!role) return 'MEMBER';
  if (role === 'founder') return 'FOUNDR';
  return role.toUpperCase();
}

function mapJoinAllianceError(error) {
  const code = error?.code ?? null;
  switch (code) {
    case 'already_in_alliance':
      return 'You are already in an alliance.';
    case 'not_same_city':
      return 'This alliance is in a different city.';
    case 'level_too_low':
      return 'You must be Level 6 to join an alliance.';
    case 'alliance_full':
      return 'This alliance is at full strength.';
    case 'alliance_disbanded':
      return 'This alliance has disbanded.';
    case 'alliance_not_found':
      return 'Alliance no longer exists.';
    case 'player_not_found':
      return 'Account error. Try signing out and back in.';
    default:
      return 'Could not join. Try again.';
  }
}

function mapLeaveAllianceError(error) {
  const code = error?.code ?? error?.error ?? null;
  switch (code) {
    case 'founder_must_transfer_first':
      return 'Transfer founder role first.';
    case 'player_not_found':
      return 'Account error. Try signing out and back in.';
    case 'not_in_alliance':
      return 'You are not in an alliance.';
    default:
      return 'Could not leave. Try again.';
  }
}

function capitalizeRole(role) {
  if (!role) return '';
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function mapTransferFounderError(error, targetName) {
  const code = error?.error ?? error?.code ?? null;
  switch (code) {
    case 'not_founder':
      return "You're no longer the Founder.";
    case 'target_role_ineligible':
      return 'Only Marshals and Officers can be promoted to Founder.';
    case 'target_not_member':
      return `${targetName} is no longer a member.`;
    case 'cannot_transfer_to_self':
      return 'You cannot transfer to yourself.';
    default:
      return "Couldn't complete transfer. Try again.";
  }
}

function mapManageError(error) {
  const code = error?.error ?? error?.code ?? null;
  switch (code) {
    case 'role_slots_full': return 'Role is at capacity.';
    case 'insufficient_permission': return 'You cannot perform that action.';
    case 'only_founder_can_demote': return 'Only the Founder can demote members.';
    case 'cannot_kick_founder': return 'The Founder cannot be removed.';
    case 'cannot_promote_founder': return 'The Founder cannot be promoted.';
    case 'cannot_demote_self': return 'You cannot demote yourself.';
    case 'cannot_promote_self': return 'You cannot promote yourself.';
    case 'cannot_kick_self': return 'You cannot kick yourself.';
    case 'invalid_target_role': return 'Invalid target role.';
    case 'new_role_not_higher': return 'New role must be higher.';
    case 'new_role_not_lower': return 'New role must be lower.';
    case 'actor_not_in_alliance': return 'You are not in this alliance.';
    case 'target_not_in_alliance': return 'Member not found in alliance.';
    default: return 'Action failed. Try again.';
  }
}

function actionLabel(action) {
  if (action.type === 'kick') return 'KICK';
  if (action.type === 'transfer_founder') return 'TRANSFER ALLIANCE';
  if (action.type === 'promote') return `PROMOTE TO ${action.toRole.toUpperCase()}`;
  if (action.type === 'demote') return `DEMOTE TO ${action.toRole.toUpperCase()}`;
  return '';
}

function actionLoadingLabel(action) {
  if (action.type === 'kick') return 'KICKING…';
  if (action.type === 'promote') return 'PROMOTING…';
  if (action.type === 'demote') return 'DEMOTING…';
  return 'WORKING…';
}

function HeaderKicker({ children }) {
  return <Text style={styles.headerKicker}>{children}</Text>;
}

function RosterRow({ initials, name, role, steps, showBorder, onPress }) {
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
}) {
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

      setJoinError(mapJoinAllianceError(result.error));
    } catch (err) {
      console.error('Join alliance failed:', err);
      setJoinError('Could not join. Try again.');
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
          <Text style={styles.confirmKicker}>Join alliance</Text>
          <Text style={styles.confirmTitle}>Join {confirmAlliance.name}?</Text>
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
                <Text style={[styles.ctaAction, { marginTop: 8 }]}>JOINING…</Text>
              </>
            ) : (
              <Text style={styles.ctaAction}>JOIN</Text>
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
            <Text style={styles.cancelLinkText}>CANCEL</Text>
          </Pressable>

          {joinError ? <Text style={styles.joinError}>{joinError}</Text> : null}
        </View>
      </ScrollView>
    );
  }

  // Empty list state
  if (!alliances?.length) {
    return (
      <View style={styles.scroll}>
        <View style={styles.sectionRow}>
          <Text style={styles.sectionLabelText}>Alliances in</Text>
          <Text style={styles.sectionLabelAccent}> {playerHomeCity ?? '—'}</Text>
          <View style={styles.sectionHairline} />
        </View>
        <View style={styles.emptyListWrap}>
          <Text style={styles.emptyListText}>No alliances in your city yet.</Text>
        </View>
        <View style={styles.footerRow}>
          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.navigate('CreateAlliance')}
            style={({ pressed }) => [pressed && { opacity: 0.6 }]}
          >
            <Text style={styles.createLink}>
              Found the first one — <Text style={styles.createLinkStrong}>create alliance →</Text>
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // Default — list view
  return (
    <View style={styles.scroll}>
      <View style={styles.sectionRow}>
        <Text style={styles.sectionLabelText}>Alliances in</Text>
        <Text style={styles.sectionLabelAccent}> {playerHomeCity ?? '—'}</Text>
        <View style={styles.sectionHairline} />
      </View>

      <Text style={styles.directiveText}>Tap to join</Text>

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
                {a.founder_username ? ` · Founded by ${a.founder_username.toUpperCase()}` : ''}
              </Text>
            </View>
            <Text style={styles.aMembers}>{a.memberCount} / 20</Text>
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
            Or <Text style={styles.createLinkStrong}>create your own alliance →</Text>
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function MemberContent({ myAlliance, playerId, roster, getToken, onRefreshAfterLeave }) {
  const navigation = useNavigation();
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
      setLeaveError(mapLeaveAllianceError(result.error));
    } catch (err) {
      console.error('Leave alliance failed:', err);
      setLeaveError('Could not leave. Try again.');
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
        setTransferError("Couldn't complete transfer. Try again.");
      } else {
        setTransferError(mapTransferFounderError(result.error, targetName));
      }
    } catch (err) {
      console.error('Transfer founder failed:', err);
      setTransferError("Couldn't complete transfer. Try again.");
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
      setManageError(mapManageError(result?.error));
    } catch (err) {
      console.error('Manage action failed:', err);
      setManageError('Action failed. Try again.');
    } finally {
      setManageActionInFlight(null);
    }
  };

  if (manageTarget && showTransferConfirm) {
    const targetName = manageTarget.username ?? '—';
    const allianceName = myAlliance?.name ?? 'this alliance';
    const demotedRole = capitalizeRole(manageTarget.role);
    const transferBody =
      `Make ${targetName} the Founder of ${allianceName}?\n\n` +
      `You will be demoted to ${demotedRole}.\n\n` +
      'This cannot be undone except by the new Founder.';
    const transferEnabled = transferConfirmInput === 'TRANSFER';

    return (
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.confirmWrap}>
          <Text style={styles.confirmKicker}>Alliance</Text>
          <Text style={styles.confirmTitle}>Transfer Alliance</Text>
          <Text style={styles.confirmBody}>{transferBody}</Text>

          <TextInput
            accessibilityLabel="Type TRANSFER to confirm"
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!transferSaving}
            placeholder="Type TRANSFER to confirm"
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
                <Text style={[styles.ctaAction, { marginTop: 8 }]}>TRANSFERRING…</Text>
              </>
            ) : (
              <Text style={styles.ctaAction}>TRANSFER</Text>
            )}
          </Pressable>

          <Pressable
            accessibilityRole="button"
            disabled={transferSaving}
            onPress={closeTransferConfirm}
            style={({ pressed }) => [styles.cancelLink, pressed && { opacity: 0.6 }]}
          >
            <Text style={styles.cancelLinkText}>CANCEL</Text>
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
          <Text style={styles.confirmKicker}>Manage member</Text>
          <Text style={styles.confirmTitle}>{(manageTarget.username ?? '—').toUpperCase()}</Text>
          <Text style={styles.confirmTag}>{formatAllianceRole(manageTarget.role)}</Text>

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
                    <Text style={[styles.ctaAction, { marginTop: 8 }]}>{actionLoadingLabel(action)}</Text>
                  </>
                ) : (
                  <Text style={styles.ctaAction}>{actionLabel(action)}</Text>
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
            <Text style={styles.cancelLinkText}>CANCEL</Text>
          </Pressable>

          {manageError ? <Text style={styles.joinError}>{manageError}</Text> : null}
        </View>
      </ScrollView>
    );
  }

  if (leaveConfirmCase) {
    const allianceName = myAlliance?.name ?? 'this alliance';
    const title =
      leaveConfirmCase === 'blocked'
        ? 'Cannot leave yet'
        : leaveConfirmCase === 'disband'
          ? `Disband ${allianceName}?`
          : `Leave ${allianceName}?`;
    const body =
      leaveConfirmCase === 'blocked'
        ? 'As Founder, transfer your role to another member before leaving. Use the alliance settings to promote a Marshal.'
        : leaveConfirmCase === 'disband'
          ? 'This alliance will be permanently disbanded. The HQ territory will become neutral and can be claimed by anyone. This cannot be undone.'
          : 'You will lose access to alliance chat, missions, and HQ. You can join another alliance later.';
    const primaryLabel =
      leaveConfirmCase === 'disband' ? 'DISBAND' : leaveConfirmCase === 'leave' ? 'LEAVE' : 'GOT IT';
    const loadingLabel = leaveConfirmCase === 'disband' ? 'DISBANDING…' : 'LEAVING…';

    return (
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.confirmWrap}>
          <Text style={styles.confirmKicker}>Alliance</Text>
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
              <Text style={styles.cancelLinkText}>CANCEL</Text>
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
          <Text style={styles.sectionLabelText}>THIS WEEK</Text>
          <Text style={styles.sectionLabelAccent}> · COLLECTIVE MISSION</Text>
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
          <Text style={styles.sectionLabelText}>ALLIANCE MESSAGES</Text>
          <Text style={styles.sectionLabelAccent}> · WIRE</Text>
          <View style={styles.sectionHairline} />
        </View>

        <View style={styles.wireContainer}>
          <View style={styles.wireHeaderStrip}>
            <Text style={styles.wireStatusText}>▌ LIVE</Text>
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
              <Text style={styles.wireEmptyText}>▸ NO TRANSMISSIONS.</Text>
            )}
            {events.map((item) => (
              <AllianceLogEvent key={item.id} event={item} />
            ))}
            {isLoadingMore && (
              <ActivityIndicator style={styles.wireLoadingMore} color={SLATE} />
            )}
            {!isLoadingMore && !nextCursor && events.length > 0 && (
              <Text style={styles.wireEndOfList}>—— END OF WIRE ——</Text>
            )}
          </ScrollView>
          {isLoading && (
            <View style={styles.wireOverlay}>
              <ActivityIndicator color={SLATE2} />
            </View>
          )}
          {!isLoading && feedError && (
            <View style={styles.wireOverlay}>
              <Text style={styles.wireErrorText}>▸ WIRE LOST.</Text>
              <Pressable onPress={fetchFirstPage} style={styles.wireRetryButton}>
                <Text style={styles.wireRetryText}>RETRY</Text>
              </Pressable>
            </View>
          )}
        </View>

        <View style={styles.sectionLabelRow}>
          <Text style={styles.sectionLabelText}>TOP CONTRIBUTORS</Text>
          <Text style={styles.sectionLabelAccent}> · THIS WEEK</Text>
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
          <Text style={styles.sectionLabelText}>ROSTER</Text>
          <Text style={styles.sectionLabelAccent}> · {roster.length} ACTIVE</Text>
          <View style={styles.sectionHairline} />
          <Text style={styles.sectionLabelRight}>RESETS MON 00:00</Text>
        </View>
        {roster.map((m, i) => {
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
              role={formatAllianceRole(m.role)}
              steps="—"
              showBorder={i < roster.length - 1}
              onPress={actions.length > 0 ? () => handleRosterRowTap(m) : undefined}
            />
          );
        })}

        <Pressable
          style={({ pressed }) => [styles.warRoomBtn, pressed && { opacity: 0.7 }]}
          onPress={() => navigation.navigate('WarRoom', {
            allianceId: myAlliance?.id,
            allianceName: myAlliance?.name,
            shortName: myAlliance?.short_name,
            currentPlayerId: playerId,
          })}
        >
          <Text style={styles.warRoomBtnText}>ENTER WAR ROOM →</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={openLeaveConfirm}
          style={({ pressed }) => [styles.leaveLink, pressed && { opacity: 0.6 }]}
        >
          <Text style={styles.leaveLinkText}>LEAVE ALLIANCE</Text>
        </Pressable>
      </ScrollView>
    </>
  );
}

export default function AllianceScreen() {
  const navigation = useNavigation();
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
          setFetchError('Could not load alliance');
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
          setFetchError('Could not load alliance');
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
          prev?.short_name === nextAlliance.short_name
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
    [userId, loadAllianceList],
  );

  useFocusEffect(
    useCallback(() => {
      fetchAllianceData({ silent: hasLoadedOnceRef.current });
    }, [fetchAllianceData]),
  );

  const isMember = Boolean(myAlliance?.id);

  if (loading) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator size="large" color={SLATE2} />
        <Text style={styles.loadingText}>LOADING…</Text>
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
          <Text style={styles.retryBtnText}>RETRY</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {isMember && (
        <View style={styles.header}>
          <View style={styles.headerTopRow}>
            <View style={{ flex: 1 }} />
            <View style={styles.shortNameBox}>
              <Text style={styles.shortNameText}>{myAlliance?.short_name ?? '—'}</Text>
            </View>
          </View>

          <Text style={styles.headerTitle}>{myAlliance?.name ?? 'Alliance'}</Text>

          <Text style={styles.headerCity}>
            {'OF ' + (myAlliance?.city ?? '—').toUpperCase() + ' · REALM 01'}
          </Text>

          <View style={styles.headerDivider} />

          <View style={styles.headerStatsRow}>
            <Text style={styles.headerStat}>
              <Text style={styles.headerStatLabel}>ROSTER </Text>
              <Text style={styles.headerStatValue}>{myAlliance?.memberCount ?? '—'} / 20</Text>
            </Text>
            <Text style={styles.headerStat}>
              <Text style={styles.headerStatLabel}>TERRITORIES </Text>
              <Text style={styles.headerStatValue}>
                {territoryCount !== null ? String(territoryCount) : '—'}
              </Text>
            </Text>
          </View>
        </View>
      )}
      {!isMember && !confirmAlliance && (
        <View style={styles.header}>
          <HeaderKicker>ALLIANCE</HeaderKicker>
          <Text style={styles.headerTitle}>NO ALLIANCE</Text>
          <Text style={styles.headerSubtitle}>You are unaffiliated</Text>
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
              <Text style={styles.retryBtnText}>RETRY</Text>
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
        />
      )}
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
