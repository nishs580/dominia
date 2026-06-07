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
  defender_notify:        { surface: SURFACES.BANNER_ROUTE, target: 'WarRoom' },
  contest_won:            { surface: SURFACES.CARD,         target: 'ContestResultScreen' },
  contest_lost:           { surface: SURFACES.CARD,         target: 'ContestResultScreen' },
  streak_break_warning:   { surface: SURFACES.CARD,         target: 'Activity' },

  // --- DEFERRED (wire in Step 3 of S53; names tentative) ---
  streak_milestone:       { surface: SURFACES.CARD,         target: 'ActivityLog' },
  // --- ALLIANCE LIFECYCLE (S57 — H2 convention: broadcasts always carry _broadcast suffix) ---
  alliance_kicked:            { surface: SURFACES.CARD,  target: 'Alliance' },
  alliance_kicked_broadcast:  { surface: SURFACES.TOAST, target: 'Alliance' },
  alliance_left:              { surface: SURFACES.TOAST, target: 'Alliance' },
  alliance_left_broadcast:    { surface: SURFACES.TOAST, target: 'Alliance' },
  alliance_joined_broadcast:  { surface: SURFACES.TOAST, target: 'Alliance' },
  alliance_promoted:          { surface: SURFACES.TOAST, target: 'Alliance' },
  alliance_demoted:           { surface: SURFACES.CARD,  target: 'Alliance' },
  first_earn:             { surface: SURFACES.CARD,         target: 'Wallet' },
};

export const DEFAULT_ROUTE = { surface: SURFACES.TOAST, target: 'ActivityLog' };

export function routeForPush(kind) {
  if (typeof kind !== 'string' || !kind) {
    return { ...DEFAULT_ROUTE, kind: null };
  }
  const entry = ROUTE_TABLE[kind];
  if (!entry) {
    return { ...DEFAULT_ROUTE, kind };
  }
  return { ...entry, kind };
}
