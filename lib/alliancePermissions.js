// Mirrors backend src/modules/alliance/alliance.formulas.ts (ROLE_RANK + ROLE_SLOTS)
// and src/modules/alliance/membership.helpers.ts (canKick / canPromote / canDemote).
// Keep this in sync with backend changes.

export const ALLIANCE_ROLES = ['founder', 'marshal', 'officer', 'sergeant', 'soldier', 'recruit'];

export const ROLE_RANK = Object.freeze({
  founder: 5,
  marshal: 4,
  officer: 3,
  sergeant: 2,
  soldier: 1,
  recruit: 0,
});

export const ROLE_SLOTS = Object.freeze({
  founder: 1,
  marshal: 2,
  officer: 4,
  sergeant: 6,
  soldier: null,
  recruit: null,
});

// Valid target roles for promote/demote (founder + recruit excluded).
export const ASSIGNABLE_ROLES = ['marshal', 'officer', 'sergeant', 'soldier'];

/**
 * Returns true if `actor` may kick a member with `target` role.
 * Does NOT check identity (self-kick) — caller handles that.
 */
export function canKick(actorRole, targetRole) {
  if (!ROLE_RANK[actorRole] || ROLE_RANK[targetRole] == null) return false;
  if (targetRole === 'founder') return false;
  if (ROLE_RANK[actorRole] <= ROLE_RANK[targetRole]) return false;

  if (actorRole === 'founder') return true;
  if (actorRole === 'marshal') return ROLE_RANK[targetRole] <= ROLE_RANK.sergeant;
  if (actorRole === 'officer') return targetRole === 'soldier' || targetRole === 'recruit';
  return false;
}

/**
 * Returns true if `actor` may promote a member from `targetCurrent` to `targetNew`.
 */
export function canPromote(actorRole, targetCurrentRole, targetNewRole) {
  if (targetCurrentRole === 'founder') return false;
  if (targetNewRole === 'founder' || targetNewRole === 'recruit') return false;
  if (ROLE_RANK[targetNewRole] == null || ROLE_RANK[targetCurrentRole] == null) return false;
  if (ROLE_RANK[targetNewRole] <= ROLE_RANK[targetCurrentRole]) return false;

  if (actorRole === 'founder') return true;
  if (actorRole === 'marshal') return ROLE_RANK[targetNewRole] <= ROLE_RANK.officer;
  return false;
}

/**
 * Returns true if `actor` may demote a member from `targetCurrent` to `targetNew`.
 * Founder-only per spec sec 3.3.
 */
export function canDemote(actorRole, targetCurrentRole, targetNewRole) {
  if (actorRole !== 'founder') return false;
  if (targetCurrentRole === 'founder') return false;
  if (targetNewRole === 'founder' || targetNewRole === 'recruit') return false;
  if (ROLE_RANK[targetNewRole] == null || ROLE_RANK[targetCurrentRole] == null) return false;
  if (ROLE_RANK[targetNewRole] >= ROLE_RANK[targetCurrentRole]) return false;
  return true;
}

/**
 * Returns all valid actions an actor can take on a target member.
 * Each action is one of:
 *   { type: 'promote', toRole }
 *   { type: 'demote', toRole }
 *   { type: 'kick' }
 *
 * `actorPlayerId === targetPlayerId` returns [] (self-actions handled elsewhere).
 */
export function getAvailableActions({ actorRole, actorPlayerId, targetRole, targetPlayerId }) {
  if (actorPlayerId === targetPlayerId) return [];
  const actions = [];

  for (const newRole of ASSIGNABLE_ROLES) {
    if (canPromote(actorRole, targetRole, newRole)) {
      actions.push({ type: 'promote', toRole: newRole });
    }
  }

  for (const newRole of ASSIGNABLE_ROLES) {
    if (canDemote(actorRole, targetRole, newRole)) {
      actions.push({ type: 'demote', toRole: newRole });
    }
  }

  if (canKick(actorRole, targetRole)) {
    actions.push({ type: 'kick' });
  }

  return actions;
}
