/**
 * Helpers for player profile pictures.
 *
 * Avatars are hosted on Clerk's CDN; we cache the full Clerk `imageUrl` into
 * players.avatar_url (backend migration 20260624-add-player-avatar-url) so
 * chat/roster lists can render thumbnails without a per-row Clerk lookup.
 * Clerk's CDN resizes on the fly via a `width` query param, so list views
 * never download the full-res image.
 *
 * React-free and CommonJS so jest (pure node) can load it.
 */

'use strict';

/**
 * Build a thumbnail URL for a Clerk-hosted avatar at a given render size.
 * Requests 2x the CSS size for retina sharpness. Returns null for empty input
 * so callers can fall back to initials.
 *
 * @param {string|null|undefined} url full avatar URL (Clerk imageUrl)
 * @param {number} size target render size in px (CSS points)
 * @returns {string|null}
 */
function avatarThumb(url, size) {
  if (!url || typeof url !== 'string') return null;
  const px = Math.max(1, Math.round((Number(size) || 1) * 2));
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}width=${px}`;
}

/** Two-letter uppercase initials for the no-avatar fallback. */
function avatarInitials(name) {
  const n = (name ?? '').trim();
  if (!n) return '??';
  return n.slice(0, 2).toUpperCase();
}

/**
 * What an avatar slot should draw: the cached photo when `avatar_url` is set,
 * otherwise the initials placeholder (the Dominia-Temp tiles draw a person
 * glyph there and keep the initials for screen readers).
 *
 * @param {{ avatar_url?: string|null, username?: string|null }|null} player
 * @param {number} size render size in points
 * @returns {{ kind: 'photo', uri: string } | { kind: 'initials', initials: string }}
 */
function avatarSource(player, size) {
  const uri = avatarThumb(player?.avatar_url ?? null, size);
  if (uri) return { kind: 'photo', uri };
  return { kind: 'initials', initials: avatarInitials(player?.username) };
}

/**
 * The URL Clerk holds for this user, or null when the user never uploaded one.
 * Clerk always returns an `imageUrl` (a generated default when there is no
 * upload), so `hasImage` decides.
 */
function clerkAvatarUrl(user) {
  if (!user || !user.hasImage) return null;
  return typeof user.imageUrl === 'string' && user.imageUrl ? user.imageUrl : null;
}

/**
 * Re-sync check for a failed earlier PATCH (plan U10): Clerk is the source of
 * truth for the photo; players.avatar_url is a cache. Returns the value to
 * PATCH (a URL, or null to clear), or `undefined` when they already agree or
 * the Clerk user is not loaded.
 */
function avatarSyncValue(cachedUrl, user) {
  if (!user) return undefined;
  const clerkUrl = clerkAvatarUrl(user);
  const cached = cachedUrl || null;
  return clerkUrl === cached ? undefined : clerkUrl;
}

/**
 * Change (`file` = data URI) or remove (`file` = null) the player's photo:
 * Clerk `setProfileImage`, reload, then cache the new URL with
 * PATCH /me { avatar_url }. A removal patches null.
 *
 * - Clerk failure: nothing changes; returns { ok: false, stage: 'upload',
 *   avatarUrl: previousUrl } so the caller keeps showing the old photo.
 * - PATCH failure: Clerk already holds the new image, so the photo still
 *   changes; returns { ok: true, synced: false } and the next profile load
 *   re-syncs via avatarSyncValue.
 *
 * @param {object} opts
 * @param {object} opts.user Clerk user (setProfileImage, reload, imageUrl)
 * @param {string|null} opts.file data URI, or null to remove
 * @param {(fields: object) => Promise<{ok: boolean}>} opts.patch PATCH /me
 * @param {string|null} [opts.previousUrl] the photo shown before the change
 */
async function updateAvatar({ user, file, patch, previousUrl = null }) {
  if (!user) return { ok: false, stage: 'no_user', avatarUrl: previousUrl };
  let avatarUrl;
  try {
    await user.setProfileImage({ file });
    if (typeof user.reload === 'function') await user.reload();
    avatarUrl = file === null ? null : (user.imageUrl ?? null);
  } catch (error) {
    return { ok: false, stage: 'upload', avatarUrl: previousUrl, error };
  }
  let synced = false;
  try {
    const res = await patch({ avatar_url: avatarUrl });
    synced = !!res?.ok;
  } catch (_) {
    synced = false;
  }
  return { ok: true, avatarUrl, synced };
}

module.exports = {
  avatarThumb,
  avatarInitials,
  avatarSource,
  clerkAvatarUrl,
  avatarSyncValue,
  updateAvatar,
};
