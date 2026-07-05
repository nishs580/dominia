// Password bounds. Min 8 follows NIST 800-63B; max 72 is the bcrypt byte
// ceiling and matches Clerk's own limit (Clerk is the source of truth and
// also runs breach detection — these are client-side guards for fast,
// localized feedback before the network round-trip).
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72;
