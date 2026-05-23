import messaging from '@react-native-firebase/messaging';
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

    await messaging().requestPermission();

    const fcmToken = await messaging().getToken();
    if (fcmToken) {
      await patchFcmToken(fcmToken, clerkGetToken);
    }

    return messaging().onTokenRefresh((newToken) => {
      patchFcmToken(newToken, clerkGetToken);
    });
  } catch (err) {
    console.warn('[fcm] register error:', err?.message);
    return () => {};
  }
}

export async function clearFcmToken({ clerkGetToken }) {
  await patchFcmToken(null, clerkGetToken);
  try {
    await messaging().deleteToken();
  } catch (err) {
    console.warn('[fcm] deleteToken error:', err?.message);
  }
}
