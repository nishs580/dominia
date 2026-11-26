// lib/chatSender.js
// Figma Chat (G9/G10, plan 2026-11-27 U13, R-F5): the sender line above each
// message and the colour of the name.
//
//   Global:   "IRONWOLF_22 · JIC TROOP"   (tag + role)
//             "NEHA_P · SOLO PLAYER"      (no alliance)
//             "YOU"                       (your own message)
//   Alliance: "RAVI_K · CAPTAIN"          (everyone shares the tag)
//             "YOU · TROOP"
//
// Your own name is lime, allies' names (same alliance) blue, others neutral.
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
 * @param {object} row  chat message ({ sender_id, sender_name,
 *                      sender_alliance_short_name, role, _optimistic })
 * @param {object} [opts]
 * @param {'city'|'alliance'} [opts.channel='city']
 * @param {string|null} [opts.selfPlayerId]  the viewer's player id
 * @param {string|null} [opts.selfTag]       the viewer's alliance short name
 * @param {string|null} [opts.selfRole]      the viewer's stored role (for
 *                                           their own optimistic echo)
 * @param {function} [opts.t]                i18next t; defaults to English
 * @returns {{ text: string, tone: 'self'|'ally'|'other', isSelf: boolean }}
 */
function chatSenderLine(row, { channel = 'city', selfPlayerId = null, selfTag = null, selfRole = null, t = defaultT } = {}) {
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
    // Global shows your own line as YOU alone; Alliance adds your role.
    if (inAlliance && roleText) detail = roleText;
  } else {
    name = clean(r.sender_name) || t('chat.unknownSender', { defaultValue: 'Player' });
    if (inAlliance) {
      detail = roleText;
    } else if (tag) {
      detail = roleText ? `${tag} ${roleText}` : tag;
    } else {
      detail = t('chat.soloPlayer', { defaultValue: 'Solo player' });
    }
  }

  const text = (detail ? `${name} · ${detail}` : name).toUpperCase();
  let tone = 'other';
  if (isSelf) tone = 'self';
  else if (inAlliance) tone = 'ally';
  else if (tag && clean(selfTag) && tag.toLowerCase() === clean(selfTag).toLowerCase()) tone = 'ally';
  return { text, tone, isSelf };
}

/**
 * "BENGALURU · 312 ONLINE" / "JALAHALLI CULT · 9 ONLINE"; the name alone when
 * the room carries no online count; null when there is no name either.
 */
function chatSubheader(room, { t = defaultT } = {}) {
  if (!room) return null;
  const name = clean(room.display_name) || clean(room.name);
  const raw = room.online_count != null ? room.online_count : room.online;
  const n = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : raw;
  const online = typeof n === 'number' && Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
  if (!name) return null;
  if (online == null) return name.toUpperCase();
  return `${name} · ${t('chat.online', { defaultValue: '{{count}} online', count: online }).replace('{{count}}', String(online))}`.toUpperCase();
}

module.exports = {
  ROLE_LABELS,
  roleCopy,
  chatSenderLine,
  chatSubheader,
};
