// lib/chatSender.js
// Dominia-Temp Chat (board 41, plan 2026-11-28 U11; first built as G9/G10 in
// plan 2026-11-27 U13): the sender name and role/tag above each message, the
// @mention check that tints a row lime, the relative time ("4D ago") and the
// tab the screen opens on.
//
// The role display mapping is a local copy of the plan's decision so this
// module stays independent of lib/allianceRoles.js.
//
// CJS, no React: jest-testable via plain require().

'use strict';

// Stored alliance role → display label. The four Figma roles plus the older
// stored ranks, which all read as Troop.
const ROLE_LABELS = Object.freeze({
  founder: Object.freeze({ key: 'chat.roleCaptain', defaultValue: 'Captain' }),
  marshal: Object.freeze({ key: 'chat.roleCommander', defaultValue: 'Commander' }),
  officer: Object.freeze({ key: 'chat.roleLieutenant', defaultValue: 'Lieutenant' }),
  member: Object.freeze({ key: 'chat.roleTroop', defaultValue: 'Troop' }),
  sergeant: Object.freeze({ key: 'chat.roleTroop', defaultValue: 'Troop' }),
  soldier: Object.freeze({ key: 'chat.roleTroop', defaultValue: 'Troop' }),
  recruit: Object.freeze({ key: 'chat.roleTroop', defaultValue: 'Troop' }),
});

/** Display copy for a stored role (any case), or null for none / unknown. */
function roleCopy(role) {
  if (typeof role !== 'string') return null;
  return ROLE_LABELS[role.trim().toLowerCase()] || null;
}

function defaultT(_key, opts) {
  return (opts && opts.defaultValue) || '';
}

function clean(s) {
  return typeof s === 'string' && s.trim() !== '' ? s.trim() : null;
}

/**
 * The sender block above a message (board 41): the name in Plex SemiBold and
 * a small muted detail beside it.
 *
 *   Global:   "Rakesh"  "JCI - Troop"   (tag - role)
 *             "Ritika"  "GP"            (tag, older backend with no role)
 *             "Moksh"   "Solo Player"   (no alliance)
 *   Alliance: "Nishan"  "Commander"     (everyone shares the tag)
 *   You:      "You", plus your role in Alliance
 *
 * @param {object} row  chat message ({ sender_id, sender_name,
 *                      sender_alliance_short_name, role, _optimistic })
 * @param {object} [opts]
 * @param {'global'|'city'|'alliance'} [opts.channel='global']
 * @param {string|null} [opts.selfPlayerId]  the viewer's player id
 * @param {string|null} [opts.selfTag]       the viewer's alliance short name
 * @param {string|null} [opts.selfRole]      the viewer's stored role (for
 *                                           their own optimistic echo)
 * @param {function} [opts.t]                i18next t; defaults to English
 * @returns {{ name: string, detail: string|null, tone: 'self'|'ally'|'other', isSelf: boolean }}
 */
function chatSenderParts(row, { channel = 'global', selfPlayerId = null, selfTag = null, selfRole = null, t = defaultT } = {}) {
  const r = row || {};
  const isSelf = !!r._optimistic
    || r.sender_id === 'self'
    || (selfPlayerId != null && r.sender_id != null && String(r.sender_id) === String(selfPlayerId));
  const tag = clean(r.sender_alliance_short_name);
  const role = roleCopy(r.role != null ? r.role : r.sender_role != null ? r.sender_role : (isSelf ? selfRole : null));
  const roleText = role ? t(role.key, { defaultValue: role.defaultValue }) : null;
  const inAlliance = channel === 'alliance';

  let name;
  let detail = null;
  if (isSelf) {
    name = t('chat.you', { defaultValue: 'You' });
    if (inAlliance && roleText) detail = roleText;
  } else {
    name = clean(r.sender_name) || t('chat.unknownSender', { defaultValue: 'Player' });
    if (inAlliance) {
      detail = roleText;
    } else if (tag) {
      detail = roleText ? `${tag} - ${roleText}` : tag;
    } else {
      detail = t('chat.soloPlayerTag', { defaultValue: 'Solo Player' });
    }
  }

  let tone = 'other';
  if (isSelf) tone = 'self';
  else if (inAlliance) tone = 'ally';
  else if (tag && clean(selfTag) && tag.toLowerCase() === clean(selfTag).toLowerCase()) tone = 'ally';
  return { name, detail, tone, isSelf };
}

// Letters (any script), digits and underscore continue a username.
function isNameChar(ch) {
  if (ch == null) return false;
  return /[A-Za-z0-9_]/.test(ch) || ch.toLowerCase() !== ch.toUpperCase();
}

/**
 * True when `content` mentions `@name` as a whole word, case-insensitively:
 * "@Moksh, hi" mentions Moksh but not Moksha, and "a@Moksh" (an email) does
 * not count. Written without lookbehind so it runs on every JS engine.
 */
function mentionsName(content, name) {
  const who = clean(name);
  if (typeof content !== 'string' || !who) return false;
  const hay = content.toLowerCase();
  const needle = `@${who.toLowerCase()}`;
  let from = 0;
  for (;;) {
    const i = hay.indexOf(needle, from);
    if (i === -1) return false;
    const before = i > 0 ? content[i - 1] : null;
    const after = content[i + needle.length];
    if (!isNameChar(before) && !isNameChar(after)) return true;
    from = i + 1;
  }
}

/**
 * Relative time on the right of a message: "now", "12M ago", "3H ago",
 * "4D ago". Returns { key, defaultValue, params } for t(); null for a
 * missing timestamp.
 */
function chatAgo(createdAt, now) {
  const at = createdAt instanceof Date ? createdAt : new Date(createdAt);
  const n = now instanceof Date ? now : now != null ? new Date(now) : new Date();
  if (createdAt == null || Number.isNaN(at.getTime())) return null;
  const secs = Math.max(0, Math.floor((n.getTime() - at.getTime()) / 1000));
  if (secs < 60) return { key: 'chat.agoNow', defaultValue: 'now', params: {} };
  if (secs < 3600) return { key: 'chat.agoMinutes', defaultValue: '{{n}}M ago', params: { n: Math.floor(secs / 60) } };
  if (secs < 86400) return { key: 'chat.agoHours', defaultValue: '{{n}}H ago', params: { n: Math.floor(secs / 3600) } };
  return { key: 'chat.agoDays', defaultValue: '{{n}}D ago', params: { n: Math.floor(secs / 86400) } };
}

/**
 * Tab the chat opens on: an explicit request ('alliance' / 'global'; the
 * older 'city' reads as global), else ALLIANCE for a player in an alliance
 * and GLOBAL otherwise.
 */
function defaultChatTab({ requested, hasAlliance } = {}) {
  if (requested === 'alliance') return 'alliance';
  if (requested === 'global' || requested === 'city') return 'global';
  return hasAlliance ? 'alliance' : 'global';
}

module.exports = {
  ROLE_LABELS,
  roleCopy,
  chatSenderParts,
  mentionsName,
  chatAgo,
  defaultChatTab,
};
