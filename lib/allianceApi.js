import { BACKEND_URL } from './api';

/**
 * Fetch the authenticated player's alliance membership via GET /me/alliance.
 *
 * @param {Object} opts
 * @param {Function} opts.clerkGetToken — async function returning Clerk JWT
 *
 * @returns {Promise<{ok: true, data: { alliance_id: string, role: string } | null} | {ok: false, status: number, error: string}>}
 *
 * Never throws — caller can rely on {ok} discriminant.
 * 404 and null alliance_id both resolve to { ok: true, data: null } ("no alliance").
 */
export async function getMyAlliance({ clerkGetToken }) {
  try {
    const token = await clerkGetToken();
    if (!token) {
      return { ok: false, status: 401, error: 'no_token' };
    }

    const res = await fetch(`${BACKEND_URL}/me/alliance`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Connection: 'close', // matches lib/supabase.js dead-TCP fix
      },
    });

    if (res.status === 404) {
      return { ok: true, data: null };
    }

    if (!res.ok) {
      let errBody = '';
      try { errBody = await res.text(); } catch (_) { /* ignore */ }
      console.log('[allianceApi] getMyAlliance non-2xx', res.status, errBody);
      return { ok: false, status: res.status, error: errBody || `http_${res.status}` };
    }

    const body = await res.json();
    if (!body?.alliance_id) {
      return { ok: true, data: null };
    }

    return { ok: true, data: { alliance_id: body.alliance_id, role: body.role ?? null } };
  } catch (err) {
    console.log('[allianceApi] getMyAlliance network error', err?.message ?? err);
    return { ok: false, status: 0, error: 'network_error' };
  }
}

/**
 * Fetch alliance details and roster via GET /alliances/:id.
 *
 * @param {Object} opts
 * @param {Function} opts.clerkGetToken — async function returning Clerk JWT
 * @param {string} opts.allianceId — alliance UUID
 *
 * @returns {Promise<{ok: true, data: { alliance: Object, members: Array }} | {ok: false, status: number, error: string}>}
 *
 * The U7 backend adds alliance.description, alliance.rules and
 * members[].territories_held; pass the body through normalizeAllianceDetail
 * when reading those.
 *
 * Never throws — caller can rely on {ok} discriminant.
 */
export async function getAllianceById({ clerkGetToken, allianceId }) {
  try {
    const token = await clerkGetToken();
    if (!token) {
      return { ok: false, status: 401, error: 'no_token' };
    }

    const res = await fetch(`${BACKEND_URL}/alliances/${allianceId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Connection: 'close', // matches lib/supabase.js dead-TCP fix
      },
    });

    if (!res.ok) {
      let errBody = '';
      try { errBody = await res.text(); } catch (_) { /* ignore */ }
      console.log('[allianceApi] getAllianceById non-2xx', res.status, errBody);
      return { ok: false, status: res.status, error: errBody || `http_${res.status}` };
    }

    const data = await res.json();
    return { ok: true, data };
  } catch (err) {
    console.log('[allianceApi] getAllianceById network error', err?.message ?? err);
    return { ok: false, status: 0, error: 'network_error' };
  }
}

const ALLIANCE_SEARCH_MAX = 50; // backend trims and caps at 50 too (U7)

function toCount(v) {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/**
 * Normalise one GET /alliances row. Missing counts become 0 so the list can
 * render "0 / 20" rather than "undefined / 20".
 */
export function normalizeAllianceListItem(row) {
  return {
    id: row?.id ?? null,
    name: row?.name ?? '',
    short_name: row?.short_name ?? '',
    emblem: row?.emblem ?? null,
    member_count: toCount(row?.member_count),
    territory_count: toCount(row?.territory_count),
  };
}

/**
 * Normalise a GET /alliances/:id body for the Figma detail pop-up and member
 * header: description/rules default to '' and every member gets a numeric
 * territories_held (0 when absent). Members are ranked by territories held,
 * ties keeping the server order.
 */
export function normalizeAllianceDetail(body) {
  const alliance = body?.alliance ?? {};
  const rawMembers = Array.isArray(body?.members) ? body.members : [];
  const members = rawMembers
    .map((m, i) => ({ ...m, territories_held: toCount(m?.territories_held), _i: i }))
    .sort((a, b) => b.territories_held - a.territories_held || a._i - b._i)
    .map(({ _i, ...m }) => m);
  return {
    alliance: {
      ...alliance,
      description: typeof alliance.description === 'string' ? alliance.description : '',
      rules: typeof alliance.rules === 'string' ? alliance.rules : '',
    },
    members,
  };
}

/**
 * List or search alliances in the caller's own city via GET /alliances?q=.
 * The backend scopes to the caller's city from the token; there is no city
 * parameter. An empty or whitespace query lists everything.
 *
 * @param {Object} opts
 * @param {Function} opts.clerkGetToken
 * @param {string} [opts.query] — alliance name or tag; trimmed and capped at 50
 *
 * @returns {Promise<{ok: true, data: { alliances: Array }} | {ok: false, status: number, error: string}>}
 *
 * Never throws — caller can rely on {ok} discriminant.
 */
export async function listAlliances({ clerkGetToken, query }) {
  try {
    const token = await clerkGetToken();
    if (!token) {
      return { ok: false, status: 401, error: 'no_token' };
    }

    const q = String(query ?? '').trim().slice(0, ALLIANCE_SEARCH_MAX);
    const url = q ? `${BACKEND_URL}/alliances?q=${encodeURIComponent(q)}` : `${BACKEND_URL}/alliances`;

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Connection: 'close', // matches lib/supabase.js dead-TCP fix
      },
    });

    if (!res.ok) {
      let errBody = '';
      try { errBody = await res.text(); } catch (_) { /* ignore */ }
      console.log('[allianceApi] listAlliances non-2xx', res.status, errBody);
      return { ok: false, status: res.status, error: errBody || `http_${res.status}` };
    }

    const body = await res.json();
    const rows = Array.isArray(body?.alliances) ? body.alliances : [];
    return { ok: true, data: { alliances: rows.map(normalizeAllianceListItem) } };
  } catch (err) {
    console.log('[allianceApi] listAlliances network error', err?.message ?? err);
    return { ok: false, status: 0, error: 'network_error' };
  }
}

/**
 * Found an alliance via POST /alliances/found.
 *
 * @param {Object} opts
 * @param {Function} opts.clerkGetToken — async function returning Clerk JWT
 * @param {string} opts.fullName
 * @param {string} opts.shortName
 * @param {string} [opts.hqTerritoryId] — required by the 3-step create (alliance_hq_create on);
 *   the single-page create omits it
 * @param {string} [opts.emblem] — emblem key (lib/allianceEmblems.js); backend defaults when omitted
 * @param {string} [opts.description] — optional, ≤500 chars, plain text
 * @param {string} [opts.rules] — optional, ≤500 chars, plain text
 *
 * @returns {Promise<{ok: true, data: { alliance: Object, members: Array }} | {ok: false, status: number, error: Object | string}>}
 *
 * Never throws — caller can rely on {ok} discriminant.
 */
export async function foundAlliance({ clerkGetToken, fullName, shortName, hqTerritoryId, emblem, description, rules }) {
  try {
    const token = await clerkGetToken();
    if (!token) {
      return { ok: false, status: 401, error: 'no_token' };
    }

    const res = await fetch(`${BACKEND_URL}/alliances/found`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        Connection: 'close', // matches lib/supabase.js dead-TCP fix
      },
      body: JSON.stringify({
        full_name: fullName,
        short_name: shortName,
        ...(hqTerritoryId ? { hq_territory_id: hqTerritoryId } : {}),
        ...(emblem ? { emblem } : {}),
        ...(description ? { description } : {}),
        ...(rules ? { rules } : {}),
      }),
    });

    if (!res.ok) {
      let errBody = null;
      try {
        errBody = await res.json();
      } catch (_) {
        try {
          const text = await res.text();
          errBody = text ? { message: text } : null;
        } catch (_) { /* ignore */ }
      }
      console.log('[allianceApi] foundAlliance non-2xx', res.status, errBody);
      return { ok: false, status: res.status, error: errBody || `http_${res.status}` };
    }

    const data = await res.json();
    return { ok: true, data };
  } catch (err) {
    console.log('[allianceApi] foundAlliance network error', err?.message ?? err);
    return { ok: false, status: 0, error: 'network_error' };
  }
}

/**
 * Join an alliance via POST /alliances/:id/join.
 *
 * @param {Object} opts
 * @param {Function} opts.clerkGetToken — async function returning Clerk JWT
 * @param {string} opts.allianceId — alliance UUID
 *
 * @returns {Promise<{ok: true, data: Object} | {ok: false, status: number, error: Object | string}>}
 *
 * Never throws — caller can rely on {ok} discriminant.
 */
export async function joinAlliance({ clerkGetToken, allianceId }) {
  try {
    const token = await clerkGetToken();
    if (!token) {
      return { ok: false, status: 401, error: 'no_token' };
    }

    const res = await fetch(`${BACKEND_URL}/alliances/${allianceId}/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        Connection: 'close', // matches lib/supabase.js dead-TCP fix
      },
      body: JSON.stringify({}),
    });

    if (!res.ok) {
      let errBody = null;
      try {
        errBody = await res.json();
      } catch (_) {
        try {
          const text = await res.text();
          errBody = text ? { message: text } : null;
        } catch (_) { /* ignore */ }
      }
      console.log('[allianceApi] joinAlliance non-2xx', res.status, errBody);
      return { ok: false, status: res.status, error: errBody || `http_${res.status}` };
    }

    let data = null;
    try {
      data = await res.json();
    } catch (_) {
      data = {};
    }
    return { ok: true, data };
  } catch (err) {
    console.log('[allianceApi] joinAlliance network error', err?.message ?? err);
    return { ok: false, status: 0, error: 'network_error' };
  }
}

/**
 * Leave (or disband) the current alliance via POST /alliances/leave.
 *
 * @param {Object} opts
 * @param {Function} opts.clerkGetToken — async function returning Clerk JWT
 *
 * @returns {Promise<{ok: true, data: Object} | {ok: false, status: number, error: Object | string}>}
 *
 * Never throws — caller can rely on {ok} discriminant.
 */
export async function leaveAlliance({ clerkGetToken }) {
  try {
    const token = await clerkGetToken();
    if (!token) {
      return { ok: false, status: 401, error: 'no_token' };
    }

    const res = await fetch(`${BACKEND_URL}/alliances/leave`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        Connection: 'close', // matches lib/supabase.js dead-TCP fix
      },
      body: JSON.stringify({}),
    });

    if (!res.ok) {
      let errBody = null;
      try {
        errBody = await res.json();
      } catch (_) {
        try {
          const text = await res.text();
          errBody = text ? { message: text } : null;
        } catch (_) { /* ignore */ }
      }
      console.log('[allianceApi] leaveAlliance non-2xx', res.status, errBody);
      return { ok: false, status: res.status, error: errBody || `http_${res.status}` };
    }

    let data = null;
    try {
      data = await res.json();
    } catch (_) {
      data = {};
    }
    return { ok: true, data };
  } catch (err) {
    console.log('[allianceApi] leaveAlliance network error', err?.message ?? err);
    return { ok: false, status: 0, error: 'network_error' };
  }
}

/**
 * Kick a member via POST /alliances/:id/members/:playerId/kick.
 *
 * @param {Object} opts
 * @param {Function} opts.clerkGetToken
 * @param {string} opts.allianceId
 * @param {string} opts.playerId — target player UUID
 *
 * @returns {Promise<{ok: true, data: Object} | {ok: false, status: number, error: Object | string}>}
 */
export async function kickMember({ clerkGetToken, allianceId, playerId }) {
  try {
    const token = await clerkGetToken();
    if (!token) {
      return { ok: false, status: 401, error: 'no_token' };
    }

    const res = await fetch(`${BACKEND_URL}/alliances/${allianceId}/members/${playerId}/kick`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        Connection: 'close',
      },
      body: JSON.stringify({}),
    });

    if (!res.ok) {
      let errBody = null;
      try {
        errBody = await res.json();
      } catch (_) {
        try {
          const text = await res.text();
          errBody = text ? { message: text } : null;
        } catch (_) { /* ignore */ }
      }
      console.log('[allianceApi] kickMember non-2xx', res.status, errBody);
      return { ok: false, status: res.status, error: errBody || `http_${res.status}` };
    }

    let data = null;
    try {
      data = await res.json();
    } catch (_) {
      data = {};
    }
    return { ok: true, data };
  } catch (err) {
    console.log('[allianceApi] kickMember network error', err?.message ?? err);
    return { ok: false, status: 0, error: 'network_error' };
  }
}

/**
 * Promote a member via POST /alliances/:id/members/:playerId/promote.
 *
 * @param {Object} opts
 * @param {Function} opts.clerkGetToken
 * @param {string} opts.allianceId
 * @param {string} opts.playerId — target player UUID
 * @param {string} opts.toRole — one of 'marshal' | 'officer' | 'sergeant' | 'soldier'
 *
 * @returns {Promise<{ok: true, data: Object} | {ok: false, status: number, error: Object | string}>}
 */
export async function promoteMember({ clerkGetToken, allianceId, playerId, toRole }) {
  try {
    const token = await clerkGetToken();
    if (!token) {
      return { ok: false, status: 401, error: 'no_token' };
    }

    const res = await fetch(`${BACKEND_URL}/alliances/${allianceId}/members/${playerId}/promote`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        Connection: 'close',
      },
      body: JSON.stringify({ to_role: toRole }),
    });

    if (!res.ok) {
      let errBody = null;
      try {
        errBody = await res.json();
      } catch (_) {
        try {
          const text = await res.text();
          errBody = text ? { message: text } : null;
        } catch (_) { /* ignore */ }
      }
      console.log('[allianceApi] promoteMember non-2xx', res.status, errBody);
      return { ok: false, status: res.status, error: errBody || `http_${res.status}` };
    }

    let data = null;
    try {
      data = await res.json();
    } catch (_) {
      data = {};
    }
    return { ok: true, data };
  } catch (err) {
    console.log('[allianceApi] promoteMember network error', err?.message ?? err);
    return { ok: false, status: 0, error: 'network_error' };
  }
}

/**
 * Demote a member via POST /alliances/:id/members/:playerId/demote.
 *
 * @param {Object} opts
 * @param {Function} opts.clerkGetToken
 * @param {string} opts.allianceId
 * @param {string} opts.playerId — target player UUID
 * @param {string} opts.toRole — one of 'marshal' | 'officer' | 'sergeant' | 'soldier'
 *
 * @returns {Promise<{ok: true, data: Object} | {ok: false, status: number, error: Object | string}>}
 */
export async function demoteMember({ clerkGetToken, allianceId, playerId, toRole }) {
  try {
    const token = await clerkGetToken();
    if (!token) {
      return { ok: false, status: 401, error: 'no_token' };
    }

    const res = await fetch(`${BACKEND_URL}/alliances/${allianceId}/members/${playerId}/demote`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        Connection: 'close',
      },
      body: JSON.stringify({ to_role: toRole }),
    });

    if (!res.ok) {
      let errBody = null;
      try {
        errBody = await res.json();
      } catch (_) {
        try {
          const text = await res.text();
          errBody = text ? { message: text } : null;
        } catch (_) { /* ignore */ }
      }
      console.log('[allianceApi] demoteMember non-2xx', res.status, errBody);
      return { ok: false, status: res.status, error: errBody || `http_${res.status}` };
    }

    let data = null;
    try {
      data = await res.json();
    } catch (_) {
      data = {};
    }
    return { ok: true, data };
  } catch (err) {
    console.log('[allianceApi] demoteMember network error', err?.message ?? err);
    return { ok: false, status: 0, error: 'network_error' };
  }
}

/**
 * Transfer founder role via POST /alliances/:id/members/:playerId/transfer.
 *
 * @param {Object} opts
 * @param {Function} opts.clerkGetToken
 * @param {string} opts.allianceId
 * @param {string} opts.targetPlayerId — incoming founder player UUID
 *
 * @returns {Promise<{ok: true, data: Object} | {ok: false, status: number, error: Object | string}>}
 */
export async function transferFounder({ clerkGetToken, allianceId, targetPlayerId }) {
  try {
    const token = await clerkGetToken();
    if (!token) {
      return { ok: false, status: 401, error: 'no_token' };
    }

    const res = await fetch(`${BACKEND_URL}/alliances/${allianceId}/members/${targetPlayerId}/transfer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        Connection: 'close',
      },
      body: JSON.stringify({}),
    });

    if (!res.ok) {
      let errBody = null;
      try {
        errBody = await res.json();
      } catch (_) {
        try {
          const text = await res.text();
          errBody = text ? { message: text } : null;
        } catch (_) { /* ignore */ }
      }
      console.log('[allianceApi] transferFounder non-2xx', res.status, errBody);
      return { ok: false, status: res.status, error: errBody || `http_${res.status}` };
    }

    let data = null;
    try {
      data = await res.json();
    } catch (_) {
      data = {};
    }
    return { ok: true, data };
  } catch (err) {
    console.log('[allianceApi] transferFounder network error', err?.message ?? err);
    return { ok: false, status: 0, error: 'network_error' };
  }
}

/**
 * Donate personal morale to the alliance war chest via
 * POST /alliances/:id/morale/donate. Replaces the direct `donate_morale` RPC.
 *
 * @param {Object} opts
 * @param {Function} opts.clerkGetToken
 * @param {string} opts.allianceId
 * @param {number} opts.amount — positive integer
 *
 * @returns {Promise<{ok: true, data: { player_morale: number, alliance_morale: number }} | {ok: false, status: number, error: Object | string}>}
 */
export async function donateMorale({ clerkGetToken, allianceId, amount }) {
  try {
    const token = await clerkGetToken();
    if (!token) {
      return { ok: false, status: 401, error: 'no_token' };
    }

    const res = await fetch(`${BACKEND_URL}/alliances/${allianceId}/morale/donate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        Connection: 'close',
      },
      body: JSON.stringify({ amount }),
    });

    if (!res.ok) {
      let errBody = null;
      try {
        errBody = await res.json();
      } catch (_) {
        try {
          const text = await res.text();
          errBody = text ? { message: text } : null;
        } catch (_) { /* ignore */ }
      }
      console.log('[allianceApi] donateMorale non-2xx', res.status, errBody);
      return { ok: false, status: res.status, error: errBody || `http_${res.status}` };
    }

    const data = await res.json();
    return { ok: true, data };
  } catch (err) {
    console.log('[allianceApi] donateMorale network error', err?.message ?? err);
    return { ok: false, status: 0, error: 'network_error' };
  }
}

/**
 * Fetch War Room ability states via GET /alliances/:id/abilities.
 * Server-authoritative: costs, active buffs, cooldowns, week limits and
 * whether the caller may activate (founder/marshal).
 *
 * @param {Object} opts
 * @param {Function} opts.clerkGetToken
 * @param {string} opts.allianceId
 *
 * @returns {Promise<{ok: true, data: { alliance_morale: number, can_manage: boolean, server_time: string, abilities: Array }} | {ok: false, status: number, error: Object | string}>}
 */
export async function getAllianceAbilities({ clerkGetToken, allianceId }) {
  try {
    const token = await clerkGetToken();
    if (!token) {
      return { ok: false, status: 401, error: 'no_token' };
    }

    const res = await fetch(`${BACKEND_URL}/alliances/${allianceId}/abilities`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Connection: 'close', // matches lib/supabase.js dead-TCP fix
      },
    });

    if (!res.ok) {
      let errBody = null;
      try {
        errBody = await res.json();
      } catch (_) {
        try {
          const text = await res.text();
          errBody = text ? { message: text } : null;
        } catch (_) { /* ignore */ }
      }
      console.log('[allianceApi] getAllianceAbilities non-2xx', res.status, errBody);
      return { ok: false, status: res.status, error: errBody || `http_${res.status}` };
    }

    const data = await res.json();
    return { ok: true, data };
  } catch (err) {
    console.log('[allianceApi] getAllianceAbilities network error', err?.message ?? err);
    return { ok: false, status: 0, error: 'network_error' };
  }
}

/**
 * Activate a War Room ability via POST /alliances/:id/abilities/:ability/activate.
 * The server prices the ability and deducts morale — no amount is sent.
 * Replaces the old client-priced POST /alliances/:id/morale/spend.
 *
 * @param {Object} opts
 * @param {Function} opts.clerkGetToken
 * @param {string} opts.allianceId
 * @param {string} opts.ability — 'war_surge' | 'iron_bulwark' | 'rally_cry' | 'steadfast' | 'supply_line'
 *
 * @returns {Promise<{ok: true, data: { alliance_morale: number, abilities: Array }} | {ok: false, status: number, error: Object | string}>}
 */
export async function activateAllianceAbility({ clerkGetToken, allianceId, ability }) {
  try {
    const token = await clerkGetToken();
    if (!token) {
      return { ok: false, status: 401, error: 'no_token' };
    }

    const res = await fetch(`${BACKEND_URL}/alliances/${allianceId}/abilities/${ability}/activate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        Connection: 'close',
      },
      body: JSON.stringify({}),
    });

    if (!res.ok) {
      let errBody = null;
      try {
        errBody = await res.json();
      } catch (_) {
        try {
          const text = await res.text();
          errBody = text ? { message: text } : null;
        } catch (_) { /* ignore */ }
      }
      console.log('[allianceApi] activateAllianceAbility non-2xx', res.status, errBody);
      return { ok: false, status: res.status, error: errBody || `http_${res.status}` };
    }

    const data = await res.json();
    return { ok: true, data };
  } catch (err) {
    console.log('[allianceApi] activateAllianceAbility network error', err?.message ?? err);
    return { ok: false, status: 0, error: 'network_error' };
  }
}
