/**
 * Helpers for player profile pictures.
 *
 * Avatars are hosted on Clerk's CDN; we cache the full Clerk `imageUrl` into
 * players.avatar_url (backend migration 20260624-add-player-avatar-url) so
 * chat/roster lists can render thumbnails without a per-row Clerk lookup.
 * Clerk's CDN resizes on the fly via a `width` query param, so list views
 * never download the full-res image.
 */

/**
 * Build a thumbnail URL for a Clerk-hosted avatar at a given render size.
 * Requests 2x the CSS size for retina sharpness. Returns null for empty input
 * so callers can fall back to initials.
 *
 * @param {string|null|undefined} url full avatar URL (Clerk imageUrl)
 * @param {number} size target render size in px (CSS points)
 * @returns {string|null}
 */
export function avatarThumb(url, size) {
  if (!url || typeof url !== 'string') return null;
  const px = Math.max(1, Math.round((Number(size) || 1) * 2));
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}width=${px}`;
}

/** Two-letter uppercase initials for the no-avatar fallback. */
export function avatarInitials(name) {
  const n = (name ?? '').trim();
  if (!n) return '??';
  return n.slice(0, 2).toUpperCase();
}
