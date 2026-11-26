/**
 * lib/allianceRoles.js
 *
 * Display labels for alliance roles (plan U12, Key Technical Decisions).
 * Stored roles are unchanged ('founder' | 'marshal' | 'officer' | 'sergeant'
 * | 'soldier' | 'recruit', see lib/alliancePermissions.js); only the label the
 * player sees changes:
 *
 *   founder → Captain
 *   marshal → Commander
 *   officer → Lieutenant
 *   anything else (member, sergeant, soldier, recruit, unknown) → Troop
 *
 * Pure CommonJS, no React; safe under jest's node environment.
 */

'use strict';

const DISPLAY_ROLES = Object.freeze({
  founder: 'captain',
  marshal: 'commander',
  officer: 'lieutenant',
});

/** 'captain' | 'commander' | 'lieutenant' | 'troop' for a stored role (any case). */
function displayRole(storedRole) {
  const key = String(storedRole ?? '').trim().toLowerCase();
  return DISPLAY_ROLES[key] ?? 'troop';
}

/** i18n key for the display label, e.g. 'allianceFigma.roleCaptain'. */
function roleLabelKey(storedRole) {
  const role = displayRole(storedRole);
  return `allianceFigma.role${role.charAt(0).toUpperCase()}${role.slice(1)}`;
}

/** English fallback label, used as the i18n defaultValue. */
function roleLabel(storedRole) {
  return displayRole(storedRole).toUpperCase();
}

/** Captain and Commander lead: they see and resolve join requests (U6). */
function isAllianceLeader(storedRole) {
  const role = displayRole(storedRole);
  return role === 'captain' || role === 'commander';
}

module.exports = { displayRole, roleLabelKey, roleLabel, isAllianceLeader };
