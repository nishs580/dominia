import { BACKEND_URL } from './api';

/**
 * Complete a daily challenge via backend POST /me/challenge-complete.
 *
 * Single source of truth for challenge completion. Backend owns:
 *   - player_challenges idempotent insert
 *   - players.xp + level update
 *   - players.iron/stone/gold/morale update
 *   - players.current_streak / longest_streak / last_active_date / grace_days_banked
 *   - activity_log challenge_completed row
 *
 * @param {Object} opts
 * @param {Function} opts.clerkGetToken — async function returning Clerk JWT
 * @param {string} opts.challengeKey — unique key per (player, day, challenge)
 * @param {'easy'|'medium'|'hard'} opts.tier
 * @param {string} opts.earnKey — RESOURCE_EARN key (e.g. 'easy_step_challenge')
 *
 * @returns {Promise<{ok: true, data: Object} | {ok: false, status: number, error: string}>}
 *   On success, data matches CompleteChallengeResult from backend:
 *     {
 *       already_completed: boolean,
 *       streak: { current, longest, tier_name, multiplier },
 *       grace_days_banked: number,
 *       grace_day_granted: boolean,
 *       xp_awarded: number,
 *       total_xp: number,
 *       resources_awarded: { iron, stone, gold, morale },
 *       player_resources: { iron, stone, gold, morale },
 *       level_before: number,
 *       level_after: number,
 *       leveled_up: boolean
 *     }
 *
 * Never throws — caller can rely on {ok} discriminant.
 */
export async function completeChallenge({ clerkGetToken, challengeKey, tier, earnKey }) {
  try {
    const token = await clerkGetToken();
    if (!token) {
      return { ok: false, status: 401, error: 'no_token' };
    }

    const res = await fetch(`${BACKEND_URL}/me/challenge-complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        Connection: 'close', // matches lib/supabase.js dead-TCP fix
      },
      body: JSON.stringify({
        challenge_key: challengeKey,
        tier,
        earn_key: earnKey,
      }),
    });

    if (!res.ok) {
      let errBody = '';
      try { errBody = await res.text(); } catch (_) { /* ignore */ }
      console.log('[challengeApi] non-2xx', res.status, errBody);
      return { ok: false, status: res.status, error: errBody || `http_${res.status}` };
    }

    const data = await res.json();
    return { ok: true, data };
  } catch (err) {
    console.log('[challengeApi] network error', err?.message ?? err);
    return { ok: false, status: 0, error: 'network_error' };
  }
}
