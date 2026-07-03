import { BACKEND_URL } from './api';

/**
 * GET /me/challenges/today — server-authoritative daily menu state.
 *
 * Response shape (backend challenges-today.routes.ts):
 *   {
 *     date: 'YYYY-MM-DD',                  // player home-tz calendar date
 *     is_challenge_day: boolean,           // false Sat/Sun (Attack Days)
 *     next_attack_day: 'YYYY-MM-DD',
 *     theme: { key, boosted_axes, boost_mult } | null,
 *     locked_axis: 'steps'|'distance'|'calories'|'tempo'|null,
 *     off_axis_slot: { eligible: boolean, used: boolean },  // Iron Guard perk
 *     completed: [{ challenge_key, axis }],
 *     aggregates: {
 *       daily_steps, daily_calories, daily_distance_m,
 *       daily_tempo_tier, longest_session_min,
 *     },
 *     streak: { current, grace_days_banked },
 *   }
 *
 * Replaces the direct Supabase player_challenges read on the Activity screen
 * (RLS migration path — server reads over client table access).
 *
 * Never throws — {ok} discriminant.
 */
export async function fetchChallengesToday({ clerkGetToken }) {
  try {
    const token = await clerkGetToken();
    if (!token) {
      return { ok: false, status: 401, error: 'no_token' };
    }

    const res = await fetch(`${BACKEND_URL}/me/challenges/today`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Connection: 'close', // matches lib/supabase.js dead-TCP fix
      },
    });

    if (!res.ok) {
      let errBody = '';
      try { errBody = await res.text(); } catch (_) { /* ignore */ }
      console.log('[challengesTodayApi] non-2xx', res.status, errBody);
      return { ok: false, status: res.status, error: errBody || `http_${res.status}` };
    }

    const data = await res.json();
    return { ok: true, data };
  } catch (err) {
    console.log('[challengesTodayApi] network error', err?.message ?? err);
    return { ok: false, status: 0, error: 'network_error' };
  }
}
