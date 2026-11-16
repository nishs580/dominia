// Figma landing (plan U10): DOMINIA · Walk . Claim . Conquer, then
// CONTINUE WITH GOOGLE / Or / CONTINUE WITH EMAIL, the terms line and
// "Already Playing? SIGN IN". Shown in place of WelcomeScreen when Figma
// onboarding is on (legacy_tabs off; see App.js WelcomeRoute).
//
// Email and Sign in open the existing SignIn screen in 'signup' or 'signin'
// mode — it is restyled, not split. Google runs the same Clerk SSO flow
// SignInScreen uses, so a Google sign-up skips the email form and code.

import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAuth, useSSO } from '@clerk/clerk-expo';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { ensurePlayer } from '../lib/auth';
import { logDebug } from '../lib/debug';
import { colors, fonts } from '../lib/theme';

WebBrowser.maybeCompleteAuthSession();

export default function LandingScreen({ navigation }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { getToken } = useAuth();
  const { startSSOFlow } = useSSO();
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void WebBrowser.warmUpAsync();
    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);

  const handleGoogle = async () => {
    if (googleLoading) return;
    setGoogleLoading(true);
    setError('');
    logDebug(getToken, 'onboarding_signup_started', { method: 'google' });
    try {
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: 'oauth_google',
        redirectUrl: AuthSession.makeRedirectUri(),
      });
      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
        logDebug(getToken, 'onboarding_auth_completed', { method: 'google' });
        const { needsUsername, player } = await ensurePlayer({ clerkGetToken: getToken });
        if (needsUsername) navigation.replace('Username', { playerId: player?.id });
        else navigation.replace('AuthGate');
      }
      // No session and no throw: the player closed the browser. Stay put.
    } catch (err) {
      setError(err?.errors?.[0]?.message ?? t('signIn.googleFailed'));
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: Math.max(insets.top, 48), paddingBottom: Math.max(insets.bottom, 24) }]}>
      <View style={styles.hero}>
        <Text style={styles.wordmark} maxFontSizeMultiplier={1.2} accessibilityRole="header">
          DOMINIA
        </Text>
        <Text style={styles.tagline}>{t('landing.tagline', { defaultValue: 'Walk . Claim . Conquer' })}</Text>
      </View>

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          onPress={handleGoogle}
          disabled={googleLoading}
          style={({ pressed }) => [styles.primary, googleLoading && styles.dim, pressed && styles.pressed]}
        >
          <Text style={styles.primaryText}>
            {googleLoading
              ? t('signIn.connecting')
              : t('landing.continueWithGoogle', { defaultValue: 'Continue with Google' })}
          </Text>
        </Pressable>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>{t('signIn.or')}</Text>
          <View style={styles.dividerLine} />
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.navigate('SignIn', { mode: 'signup' })}
          disabled={googleLoading}
          style={({ pressed }) => [styles.secondary, pressed && styles.pressedSecondary]}
        >
          <Text style={styles.secondaryText}>
            {t('landing.continueWithEmail', { defaultValue: 'Continue with Email' })}
          </Text>
        </Pressable>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Text style={styles.terms}>
          {t('landing.terms', {
            defaultValue: 'By continuing, you are agreeing to the Terms of Service & Privacy Policy',
          })}
        </Text>

        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.navigate('SignIn', { mode: 'signin' })}
          style={styles.signInRow}
          hitSlop={{ top: 8, bottom: 8 }}
        >
          <Text style={styles.signInText}>
            {t('landing.alreadyPlaying', { defaultValue: 'Already Playing? ' })}
            <Text style={styles.signInLink}>{t('landing.signIn', { defaultValue: 'SIGN IN' })}</Text>
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink, paddingHorizontal: 24 },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  wordmark: {
    fontFamily: fonts.display,
    fontSize: 48,
    color: colors.bone,
    letterSpacing: -1.4,
    textTransform: 'uppercase',
  },
  tagline: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.8,
    color: colors.slate2,
    textTransform: 'uppercase',
    marginTop: 8,
  },
  actions: { width: '100%' },
  primary: {
    backgroundColor: colors.claimButton,
    minHeight: 48,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    fontFamily: fonts.monoMedium,
    fontSize: 14,
    letterSpacing: 2,
    color: colors.bone,
    textTransform: 'uppercase',
  },
  secondary: {
    backgroundColor: colors.ink2,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    minHeight: 48,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    fontFamily: fonts.monoMedium,
    fontSize: 14,
    letterSpacing: 2,
    color: colors.bone,
    textTransform: 'uppercase',
  },
  dim: { opacity: 0.7 },
  pressed: { opacity: 0.9 },
  pressedSecondary: { backgroundColor: colors.ink3 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 16 },
  dividerLine: { flex: 1, height: 0.5, backgroundColor: colors.hairlineStrong },
  dividerText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.6,
    color: colors.slate2,
    textTransform: 'uppercase',
  },
  error: { fontFamily: fonts.body, fontSize: 13, color: colors.bone, textAlign: 'center', marginTop: 12 },
  terms: {
    fontFamily: fonts.body,
    fontSize: 11,
    lineHeight: 16,
    color: colors.slate2,
    textAlign: 'center',
    marginTop: 20,
  },
  signInRow: { marginTop: 16, alignItems: 'center', paddingVertical: 8 },
  signInText: { fontFamily: fonts.body, fontSize: 13, color: colors.slate2 },
  signInLink: { fontFamily: fonts.monoMedium, color: colors.bone, letterSpacing: 1.4 },
});
