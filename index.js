import { getMessaging, setBackgroundMessageHandler } from '@react-native-firebase/messaging';

// No-op background message handler. The OS displays the notification (from the
// payload's `notification` field). The purpose of registering here is to satisfy
// Firebase's requirement on Android, which preserves `data` extras through
// killed-state cold-launch so getInitialNotification() returns the full payload
// (including data.kind) when the user taps the notification.
setBackgroundMessageHandler(getMessaging(), async (_remoteMessage) => {
  // Headless context — no React, no UI access. Intentionally no-op.
  return;
});

import { registerRootComponent } from 'expo';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
