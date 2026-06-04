import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();

const TAB_TARGETS = new Set(['Map', 'Activity', 'Alliance', 'Profile']);

let pendingTarget = null;
let stateListener = null;

function doNavigate(target) {
  if (TAB_TARGETS.has(target)) {
    navigationRef.navigate('MainTabs', { screen: target });
  } else {
    navigationRef.navigate(target);
  }
}

function clearStateListener() {
  if (stateListener) {
    try { navigationRef.removeListener('state', stateListener); } catch (e) {}
    stateListener = null;
  }
}

export function navigateTo(target) {
  if (!target) return;
  if (!navigationRef.isReady()) {
    pendingTarget = target;
    return;
  }
  doNavigate(target);
}

export function onNavigationReady() {
  // onNavigationReady fires when NavigationContainer is ready, but AuthGate's
  // navigation.replace('MainTabs') happens AFTER that. Dispatching pendingTarget
  // here directly would get clobbered by AuthGate. Instead, wait for current route
  // to become MainTabs (post-AuthGate), then dispatch.
  if (!pendingTarget) return;

  function tryDispatch() {
    if (!pendingTarget) return;
    if (!navigationRef.isReady()) return;
    const state = navigationRef.getRootState();
    const currentRoute = state?.routes?.[state.index];
    if (currentRoute?.name === 'MainTabs') {
      const t = pendingTarget;
      pendingTarget = null;
      clearStateListener();
      doNavigate(t);
    }
  }

  // Immediate check (in case MainTabs is somehow already current).
  tryDispatch();
  if (!pendingTarget) return;

  // Subscribe to state changes; dispatch when AuthGate's nav.replace('MainTabs') lands.
  stateListener = () => tryDispatch();
  navigationRef.addListener('state', stateListener);
}
