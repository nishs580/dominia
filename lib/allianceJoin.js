/**
 * lib/allianceJoin.js
 *
 * Pure view-model helpers for the Figma alliance detail and member view
 * (plan U12): join type, the join button, the join outcome, pending join
 * requests and the member-row formats. Backend fields from U6 are read
 * defensively; when they are missing the alliance behaves as Open, as today.
 *
 * No React, no network; safe under jest's node environment.
 */

'use strict';

/** 'invite_only' or 'open'. Anything else (missing, unknown) is Open. */
function normalizeJoinType(value) {
  return String(value ?? '').trim().toLowerCase() === 'invite_only' ? 'invite_only' : 'open';
}

/**
 * True when the server says the caller already has a pending request for this
 * alliance. Optional fields; absent means no.
 */
function hasPendingRequest(alliance) {
  if (!alliance) return false;
  if (alliance.has_pending_request === true || alliance.request_pending === true) return true;
  const status = alliance.my_request_status ?? alliance.join_request_status ?? null;
  return status === 'pending' || status === 'requested';
}

/**
 * The detail pop-up's join button.
 *
 * @returns {{ labelKey: string, defaultValue: string, disabled: boolean, state: string }}
 *   state: 'full' | 'requested' | 'request' | 'join'
 */
function joinButtonState({ joinType, requested = false, full = false, joining = false } = {}) {
  if (requested) {
    return { state: 'requested', labelKey: 'allianceFigma.requestSent', defaultValue: 'Request sent', disabled: true };
  }
  if (full) {
    return { state: 'full', labelKey: 'allianceFigma.full', defaultValue: 'Alliance full', disabled: true };
  }
  if (normalizeJoinType(joinType) === 'invite_only') {
    return { state: 'request', labelKey: 'allianceFigma.requestToJoin', defaultValue: 'Request to join', disabled: joining };
  }
  return { state: 'join', labelKey: 'alliance.join', defaultValue: 'Join', disabled: joining };
}

/**
 * What a successful POST /alliances/:id/join did: 'requested' for an
 * invite-only alliance ({ status: 'requested' }), otherwise 'joined'.
 */
function joinOutcome(data) {
  const status = String(data?.status ?? '').toLowerCase();
  return status === 'requested' || status === 'pending' ? 'requested' : 'joined';
}

/** i18n key for the TYPE cell. */
function joinTypeLabelKey(joinType) {
  return normalizeJoinType(joinType) === 'invite_only' ? 'allianceFigma.typeInviteOnly' : 'allianceFigma.typeOpen';
}

/** "01", "02" … for member ranks. */
function padRank(n) {
  const v = Math.max(0, Math.floor(Number(n) || 0));
  return v < 10 ? `0${v}` : String(v);
}

/**
 * Normalise GET /alliances/:id/requests. Accepts { requests: [...] } or a
 * bare array; each row may carry the player inline or nested under
 * `player`. Rows without an id are dropped.
 */
function normalizeJoinRequests(body) {
  const rows = Array.isArray(body) ? body : Array.isArray(body?.requests) ? body.requests : [];
  return rows
    .map((r) => {
      const player = r?.player ?? {};
      const id = r?.id ?? r?.request_id ?? null;
      if (id == null) return null;
      return {
        id: String(id),
        player_id: r?.player_id ?? player.id ?? null,
        username: r?.username ?? player.username ?? null,
        avatar_url: r?.avatar_url ?? player.avatar_url ?? null,
        territories_held: Number.isFinite(Number(r?.territories_held ?? player.territories_held))
          ? Number(r?.territories_held ?? player.territories_held)
          : null,
        created_at: r?.created_at ?? null,
      };
    })
    .filter(Boolean);
}

/** Two-letter initials for the member tile. */
function memberInitials(username) {
  const s = String(username ?? '').replace(/[^\p{L}\p{N}]/gu, '');
  return s ? s.slice(0, 2).toUpperCase() : '??';
}

module.exports = {
  normalizeJoinType, hasPendingRequest, joinButtonState, joinOutcome,
  joinTypeLabelKey, padRank, normalizeJoinRequests, memberInitials,
};
