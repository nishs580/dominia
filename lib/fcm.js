import {
  getMessaging,
  requestPermission,
  getToken,
  onTokenRefresh,
  deleteToken,
} from '@react-native-firebase/messaging';
import { PermissionsAndroid, Platform } from 'react-native';
import { BACKEND_URL } from './api';

async function patchFcmToken(token, clerkGetToken) {
  try {
    const jwt = await clerkGetToken();
    const response = await fetch(`${BACKEND_URL}/me/fcm-token`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${jwt}`,
        Connection: 'close',
      },
      body: JSON.stringify({ fcm_token: token }),
    });
    if (!response.ok) {
      console.warn('[fcm] patch failed:', response.status);
    }
  } catch (err) {
    console.warn('[fcm] patch error:', err?.message);
  }
}

export async function registerFcmToken({ clerkGetToken }) {
  try {
    if (Platform.OS === 'android' && Platform.Version >= 33) {
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      );
      if (result !== PermissionsAndroid.RESULTS.GRANTED) {
        console.log('[fcm] notification permission denied');
        return () => {};
      }
    }

    await requestPermission(getMessaging());

    const fcmToken = await getToken(getMessaging());
    if (fcmToken) {
      await patchFcmToken(fcmToken, clerkGetToken);
    }

    return onTokenRefresh(getMessaging(), (newToken) => {
      patchFcmToken(newToken, clerkGetToken);
    });
  } catch (err) {
    console.warn('[fcm] register error:', err?.message);
    return () => {};
  }
}

export async function clearFcmToken({ clerkGetToken }) {
  const timeout = new Promise((resolve) => setTimeout(resolve, 3000));
  const cleanup = (async () => {
    try {
      await patchFcmToken(null, clerkGetToken);
    } catch (err) {
      console.warn('[fcm] clear patch error:', err?.message);
    }
    try {
      await deleteToken(getMessaging());
    } catch (err) {
      console.warn('[fcm] deleteToken error:', err?.message);
    }
  })();
  await Promise.race([cleanup, timeout]);
}
