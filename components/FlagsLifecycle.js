import { useEffect } from 'react';
import { AppState } from 'react-native';
import { refreshFlags, onLegacyTabsChange } from '../lib/flags';
import { resetToMap } from '../lib/navigation';

// Fetches and activates Remote Config in the background. App.js has already
// applied the last activated values before the first render; this picks up
// console changes on launch and on every return to the foreground (Remote
// Config throttles real fetches to once an hour outside __DEV__).
export default function FlagsLifecycle() {
  useEffect(() => {
    // A `legacy_tabs` change swaps the tab set, so the open tab may vanish.
    const unsubscribe = onLegacyTabsChange(() => resetToMap());

    refreshFlags();
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') refreshFlags();
    });

    return () => {
      unsubscribe();
      sub.remove();
    };
  }, []);

  return null;
}
