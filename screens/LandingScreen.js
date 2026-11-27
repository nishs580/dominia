// Figma landing (Updated UX A2): a still board map behind scrims, the
// left-aligned DOMINIA wordmark under a lime bar, the body line, then
// CONTINUE WITH APPLE / GOOGLE / EMAIL (Email is the blue primary), the terms
// line and "ALREADY PLAYING? SIGN IN". Shown in place of WelcomeScreen when
// Figma onboarding is on (legacy_tabs off; see App.js WelcomeRoute).
//
// Email and Sign in open the existing SignIn screen in 'signup' or 'signin'
// mode — it is restyled, not split. Apple and Google run the same Clerk SSO
// flow (oauth_apple / oauth_google) and share one success path, so an SSO
// sign-up skips the email form and code. Apple shows only when
// EXPO_PUBLIC_APPLE_SIGNIN=1 (lib/authProviders, plan U14).

import React, { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAuth, useSSO } from '@clerk/clerk-expo';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import StaticMapBackdrop from '../components/StaticMapBackdrop';
import { ensurePlayer } from '../lib/auth';
import { enabledProviders } from '../lib/authProviders';
import { logDebug } from '../lib/debug';
import { colors, fonts } from '../lib/theme';

WebBrowser.maybeCompleteAuthSession();

const SSO_STRATEGY = { apple: 'oauth_apple', google: 'oauth_google' };

// Ink fading in from the top of the map to solid behind the buttons.
function Scrim() {
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none" pointerEvents="none">
      <Defs>
        <LinearGradient id="landingScrim" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.ink} stopOpacity="0.35" />
          <Stop offset="0.38" stopColor={colors.ink} stopOpacity="0.25" />
          <Stop offset="0.58" stopColor={colors.ink} stopOpacity="0.85" />
          <Stop offset="0.66" stopColor={colors.ink} stopOpacity="1" />
          <Stop offset="1" stopColor={colors.ink} stopOpacity="1" />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#landingScrim)" />
    </Svg>
  );
}

export default function LandingScreen({ navigation }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { getToken } = useAuth();
  const { startSSOFlow } = useSSO();
  // Which SSO provider is mid-flow ('apple' | 'google'), or null.
  const [ssoLoading, setSsoLoading] = useState(null);
  const [error, setError] = useState('');
  // Direct member access so Metro inlines the EXPO_PUBLIC_ value.
  const providers = enabledProviders({ EXPO_PUBLIC_APPLE_SIGNIN: process.env.EXPO_PUBLIC_APPLE_SIGNIN }, Platform.OS);

  useEffect(() => {
    void WebBrowser.warmUpAsync();
    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);

  const handleSSO = async (provider) => {
    if (ssoLoading) return;
    setSsoLoading(provider);
    setError('');
    logDebug(getToken, 'onboarding_signup_started', { method: provider });
    try {
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: SSO_STRATEGY[provider],
        redirectUrl: AuthSession.makeRedirectUri(),
      });
      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
        logDebug(getToken, 'onboarding_auth_completed', { method: provider });
        const { needsUsername, player } = await ensurePlayer({ clerkGetToken: getToken });
        if (needsUsername) navigation.replace('Username', { playerId: player?.id });
        else navigation.replace('AuthGate');
      }
      // No session and no throw: the player closed the browser. Stay put.
    } catch (err) {
      const fallback =
        provider === 'apple'
          ? t('landing.appleFailed', { defaultValue: 'Apple sign-in failed. Try again.' })
          : t('signIn.googleFailed');
      setError(err?.errors?.[0]?.message ?? fallback);
    } finally {
      setSsoLoading(null);
    }
  };

  const buttons = {
    apple: (
      <Pressable
        key="apple"
        accessibilityRole="button"
        accessibilityLabel={t('landing.continueWithApple', { defaultValue: 'Continue with Apple' })}
        onPress={() => handleSSO('apple')}
        disabled={Boolean(ssoLoading)}
        style={({ pressed }) => [styles.secondary, ssoLoading === 'apple' && styles.dim, pressed && styles.pressedSecondary]}
      >
        <Text style={styles.secondaryText}>
          {ssoLoading === 'apple'
            ? t('signIn.connecting')
            : `${Platform.OS === 'ios' ? '  ' : ''}${t('landing.continueWithApple', { defaultValue: 'Continue with Apple' })}`}
        </Text>
      </Pressable>
    ),
    google: (
      <Pressable
        key="google"
        accessibilityRole="button"
        accessibilityLabel={t('landing.continueWithGoogle', { defaultValue: 'Continue with Google' })}
        onPress={() => handleSSO('google')}
        disabled={Boolean(ssoLoading)}
        style={({ pressed }) => [styles.secondary, ssoLoading === 'google' && styles.dim, pressed && styles.pressedSecondary]}
      >
        <Text style={styles.secondaryText}>
          {ssoLoading === 'google'
            ? t('signIn.connecting')
            : `G   ${t('landing.continueWithGoogle', { defaultValue: 'Continue with Google' })}`}
        </Text>
      </Pressable>
    ),
    email: (
      <Pressable
        key="email"
        accessibilityRole="button"
        onPress={() => navigation.navigate('SignIn', { mode: 'signup' })}
        disabled={Boolean(ssoLoading)}
        style={({ pressed }) => [styles.primary, pressed && styles.pressedPrimary]}
      >
        <Text style={styles.primaryText}>
          {t('landing.continueWithEmail', { defaultValue: 'Continue with Email' })}
        </Text>
      </Pressable>
    ),
  };

  return (
    <View style={styles.screen}>
      <StaticMapBackdrop />
      <Scrim />

      <View style={[styles.content, { paddingTop: Math.max(insets.top, 24), paddingBottom: Math.max(insets.bottom, 24) }]}>
        <View style={styles.spacer} />

        <View style={styles.bar} />
        <Text style={styles.wordmark} maxFontSizeMultiplier={1.2} accessibilityRole="header">
          DOMINIA
        </Text>
        <Text style={styles.body}>
          {t('landing.body', {
            defaultValue: 'Claim your city one walk at a time. Every block you loop is yours to hold.',
          })}
        </Text>

        <View style={styles.actions}>{providers.map((p) => buttons[p])}</View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Text style={styles.terms}>
          {t('landing.terms', {
            defaultValue: 'By continuing, you agree to our Terms of Service & Privacy Policy.',
          })}
        </Text>

        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.navigate('SignIn', { mode: 'signin' })}
          style={styles.signInRow}
          hitSlop={{ top: 8, bottom: 8 }}
        >
          <Text style={styles.signInText}>
            {t('landing.alreadyPlaying', { defaultValue: 'Already playing? ' })}
            {t('landing.signIn', { defaultValue: 'SIGN IN' })}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  content: { flex: 1, paddingHorizontal: 24 },
  spacer: { flex: 1 },
  bar: { width: 38, height: 4, backgroundColor: colors.lime, marginBottom: 10 },
  wordmark: {
    fontFamily: fonts.display,
    fontSize: 45,
    lineHeight: 46,
    color: colors.bone,
    letterSpacing: -1.4,
    textTransform: 'uppercase',
  },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: colors.slate2, marginTop: 12 },
  actions: { width: '100%', gap: 14, marginTop: 24 },
  primary: {
    backgroundColor: colors.action,
    minHeight: 52,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    fontFamily: fonts.monoMedium,
    fontSize: 13,
    letterSpacing: 1.8,
    color: colors.white,
    textTransform: 'uppercase',
  },
  secondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    minHeight: 52,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    fontFamily: fonts.monoMedium,
    fontSize: 13,
    letterSpacing: 1.8,
    color: colors.white,
    textTransform: 'uppercase',
  },
  dim: { opacity: 0.7 },
  pressedPrimary: { backgroundColor: colors.actionPressed },
  pressedSecondary: { backgroundColor: colors.raised },
  error: { fontFamily: fonts.body, fontSize: 13, color: colors.danger, marginTop: 12 },
  terms: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
    color: colors.muted,
    marginTop: 14,
  },
  signInRow: { marginTop: 14, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  signInText: {
    fontFamily: fonts.monoMedium,
    fontSize: 13,
    letterSpacing: 1.8,
    color: colors.white2,
    textTransform: 'uppercase',
  },
});
