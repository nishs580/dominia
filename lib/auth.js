import { bootstrapPlayer } from './meApi';

/**
 * Ensure the authenticated player exists, creating the row server-side if not.
 * Backed by POST /me/bootstrap (the player row is no longer inserted directly
 * from the client now that RLS is enabled).
 *
 * @param {Object} opts
 * @param {Function} opts.clerkGetToken — async () => Clerk JWT
 * @param {string} [opts.email]
 * @returns {Promise<{ player: Object|null, needsUsername: boolean }>}
 */
export async function ensurePlayer({ clerkGetToken, email }) {
  const res = await bootstrapPlayer({ clerkGetToken, email });
  if (!res.ok) {
    console.error('Error bootstrapping player:', res.status, res.error);
    return { player: null, needsUsername: false };
  }
  return { player: res.data.player, needsUsername: res.data.needsUsername };
}
