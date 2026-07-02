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

/**
 * Found an alliance via POST /alliances/found.
 *
 * @param {Object} opts
 * @param {Function} opts.clerkGetToken — async function returning Clerk JWT
 * @param {string} opts.fullName
 * @param {string} opts.shortName
 * @param {string} opts.hqTerritoryId
 * @param {string} [opts.emblem] — emblem key (lib/allianceEmblems.js); backend defaults when omitted
 *
 * @returns {Promise<{ok: true, data: { alliance: Object, members: Array }} | {ok: false, status: number, error: Object | string}>}
 *
 * Never throws — caller can rely on {ok} discriminant.
 */
export async function foundAlliance({ clerkGetToken, fullName, shortName, hqTerritoryId, emblem }) {
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
        hq_territory_id: hqTerritoryId,
        ...(emblem ? { emblem } : {}),
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
 * Spend morale from the alliance war chest (e.g. activate an ability) via
 * POST /alliances/:id/morale/spend. Replaces the direct `deduct_alliance_morale` RPC.
 *
 * @param {Object} opts
 * @param {Function} opts.clerkGetToken
 * @param {string} opts.allianceId
 * @param {number} opts.amount — positive integer
 *
 * @returns {Promise<{ok: true, data: { alliance_morale: number }} | {ok: false, status: number, error: Object | string}>}
 */
export async function spendAllianceMorale({ clerkGetToken, allianceId, amount }) {
  try {
    const token = await clerkGetToken();
    if (!token) {
      return { ok: false, status: 401, error: 'no_token' };
    }

    const res = await fetch(`${BACKEND_URL}/alliances/${allianceId}/morale/spend`, {
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
      console.log('[allianceApi] spendAllianceMorale non-2xx', res.status, errBody);
      return { ok: false, status: res.status, error: errBody || `http_${res.status}` };
    }

    const data = await res.json();
    return { ok: true, data };
  } catch (err) {
    console.log('[allianceApi] spendAllianceMorale network error', err?.message ?? err);
    return { ok: false, status: 0, error: 'network_error' };
  }
}
