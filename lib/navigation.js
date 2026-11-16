import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();

const TAB_TARGETS = new Set(['Map', 'Activity', 'Alliance', 'Profile']);

let pendingNav = null;
let stateListener = null;

function doNavigate(target, params) {
  if (TAB_TARGETS.has(target)) {
    navigationRef.navigate('MainTabs', { screen: target, params });
  } else {
    navigationRef.navigate(target, params);
  }
}

function clearStateListener() {
  if (stateListener) {
    try { navigationRef.removeListener('state', stateListener); } catch (e) {}
    stateListener = null;
  }
}

function tryDispatch() {
  if (!pendingNav) return;
  if (!navigationRef.isReady()) return;
  const state = navigationRef.getRootState();
  const currentRoute = state?.routes?.[state.index];
  if (currentRoute?.name === 'MainTabs') {
    const { target, params } = pendingNav;
    pendingNav = null;
    clearStateListener();
    doNavigate(target, params);
  }
}

function armStateListener() {
  if (stateListener) return;
  stateListener = () => tryDispatch();
  navigationRef.addListener('state', stateListener);
}

export function navigateTo(target, params = {}) {
  if (!target) return;
  if (!navigationRef.isReady()) {
    pendingNav = { target, params };
    return;
  }
  doNavigate(target, params);
}

export function navigateToAfterAuthGate(target, params = {}) {
  if (!target) return;
  pendingNav = { target, params };
  armStateListener();
  if (navigationRef.isReady()) tryDispatch();
}

// Used when the `legacy_tabs` flag flips: the current tab may not exist in the
// new layout, so drop back to Map. Only acts once the player is past AuthGate
// (MainTabs is in the root stack); onboarding and sign-in are left alone.
export function resetToMap() {
  if (!navigationRef.isReady()) return;
  const state = navigationRef.getRootState();
  if (!state?.routes?.some((r) => r.name === 'MainTabs')) return;
  navigationRef.reset({
    index: 0,
    routes: [{ name: 'MainTabs', params: { screen: 'Map' } }],
  });
}

export function onNavigationReady() {
  // onNavigationReady fires when NavigationContainer is ready, but AuthGate's
  // navigation.replace('MainTabs') happens AFTER that. Dispatching pendingNav
  // here directly would get clobbered by AuthGate. Instead, wait for current route
  // to become MainTabs (post-AuthGate), then dispatch.
  if (!pendingNav) return;
  tryDispatch();
  if (pendingNav) armStateListener();
}
