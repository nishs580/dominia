// Notification routing per S53 D1.
// Maps an FCM push `kind` to the surface (card / toast / banner-route),
// tap target (Stack.Navigator screen or MainTabs tab name), and pass-through kind.
//
// LIVE entries match backend FCM dispatch (PROJECT_STATE).
// DEFERRED entries are placeholders for triggers wired in Step 3 of S53;
// their kind names may shift when the backend trigger ships.

export const SURFACES = {
  CARD: 'card',
  TOAST: 'toast',
  BANNER_ROUTE: 'banner-route',
};

export const ROUTE_TABLE = {
  // --- LIVE (backend dispatching today) ---
  defender_notify: {
    surface: SURFACES.BANNER_ROUTE,
    target: 'DefenderAccept',
    extractParams: (data) => ({ contestId: data?.contestId }),
  },
  contest_won:            { surface: SURFACES.CARD,         target: 'ContestResultScreen' },
  contest_lost:           { surface: SURFACES.CARD,         target: 'ContestResultScreen' },

  // --- STREAK LIFECYCLE (S31d streak_break_warning + S58 streak_milestone, S58 streak_broken handled detection-only) ---
  streak_break_warning:   { surface: SURFACES.CARD,         target: 'Activity' },
  streak_milestone:       { surface: SURFACES.CARD,         target: 'Activity' },
  // --- ALLIANCE LIFECYCLE (S57 — H2 convention: broadcasts always carry _broadcast suffix) ---
  alliance_kicked:            { surface: SURFACES.CARD,  target: 'Alliance' },
  alliance_kicked_broadcast:  { surface: SURFACES.TOAST, target: 'Alliance' },
  alliance_left:              { surface: SURFACES.TOAST, target: 'Alliance' },
  alliance_left_broadcast:    { surface: SURFACES.TOAST, target: 'Alliance' },
  alliance_joined_broadcast:  { surface: SURFACES.TOAST, target: 'Alliance' },
  alliance_promoted:          { surface: SURFACES.TOAST, target: 'Alliance' },
  alliance_demoted:           { surface: SURFACES.CARD,  target: 'Alliance' },
  // --- LEVEL-UP (S59) ---
  level_up_5:             { surface: SURFACES.CARD,         target: 'Profile' },
  level_up_6:             { surface: SURFACES.TOAST,        target: 'Alliance' },
  level_up_10:            { surface: SURFACES.CARD,         target: 'Profile' },
  first_claim: {
    surface: SURFACES.CARD,
    target: 'Map',
  },
  first_contest_win: {
    surface: SURFACES.CARD,
    target: 'Map',
  },
  first_reconquest: {
    surface: SURFACES.CARD,
    target: 'Map',
  },
  first_alliance_mission: {
    surface: SURFACES.CARD,
    target: 'Alliance',
  },
  // --- HONOR / LEGACY MEDALS (LM-M3) ---
  legacy_medal_tier_up: {
    surface: SURFACES.CARD,
    target: 'Profile',
    extractParams: (data) => ({ medalKey: data?.medalKey }),
  },
  legacy_medal_count: {
    surface: SURFACES.CARD,
    target: 'Profile',
    extractParams: (data) => ({ medalKey: data?.medalKey }),
  },
  legacy_medal_one_off: {
    surface: SURFACES.CARD,
    target: 'Profile',
    extractParams: (data) => ({ medalKey: data?.medalKey }),
  },
  // --- CHAT (S82 M2) ---
  chat_alliance_message: {
    surface: SURFACES.TOAST,
    target: 'Chat',
    extractParams: (data) => ({
      initialTab: 'alliance',
      roomId: data?.room_id ?? null,
    }),
  },
};

export const DEFAULT_ROUTE = { surface: SURFACES.TOAST, target: 'ActivityLog' };

export function routeForPush(kind, data) {
  if (typeof kind !== 'string' || !kind) {
    return { ...DEFAULT_ROUTE, kind: null, params: {} };
  }
  const entry = ROUTE_TABLE[kind];
  if (!entry) {
    return { ...DEFAULT_ROUTE, kind, params: {} };
  }
  const params = typeof entry.extractParams === 'function'
    ? entry.extractParams(data)
    : {};
  return { ...entry, kind, params };
}
