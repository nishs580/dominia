// Figma sign-up chooser (Dominia-Temp "Sign up", plan U3): the DOMINIA.
// wordmark and tagline over the blue glow, CONTINUE WITH GOOGLE (outline),
// OR, CONTINUE WITH EMAIL » (blue), the terms line and "Already playing?
// SIGN IN »". Shown in place of WelcomeScreen when Figma onboarding is on
// (legacy_tabs off; see App.js WelcomeRoute).
//
// Email and Sign in open the existing SignIn screen in 'signup' or 'signin'
// mode. Apple and Google run the same Clerk SSO flow (oauth_apple /
// oauth_google) and share one success path, so an SSO sign-up skips the
// email form and code. Apple shows only when EXPO_PUBLIC_APPLE_SIGNIN=1
// (lib/authProviders); it is not on the board, so it sits above Google in
// the same outline style.

import React, { useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAuth, useSSO } from '@clerk/clerk-expo';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { AuthBackdrop, FormError, GoogleGlyph, OrDivider } from '../components/AuthParts';
import Wordmark from '../components/Wordmark';
import { LinkText, SlantButton } from '../components/ui';
import { ensurePlayer } from '../lib/auth';
import { mapAuthError } from '../lib/authErrors';
import { enabledProviders } from '../lib/authProviders';
import { logDebug } from '../lib/debug';
import { colors, fonts } from '../lib/theme';

WebBrowser.maybeCompleteAuthSession();

const SSO_STRATEGY = { apple: 'oauth_apple', google: 'oauth_google' };

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
          ? { key: 'landing.appleFailed', defaultValue: 'Apple sign-in failed. Try again.' }
          : { key: 'signIn.googleFailed', defaultValue: 'Google sign-in failed. Try again.' };
      const mapped = mapAuthError(err, { fallback });
      setError(t(mapped.key, { defaultValue: mapped.defaultValue }));
    } finally {
      setSsoLoading(null);
    }
  };

  const busy = Boolean(ssoLoading);
  const ssoButton = (provider) => {
    const label =
      provider === 'apple'
        ? t('landing.continueWithApple', { defaultValue: 'Continue with Apple' })
        : t('landing.continueWithGoogle', { defaultValue: 'Continue with Google' });
    return (
      <SlantButton
        key={provider}
        variant="outline"
        size="md"
        label={label}
        leading={provider === 'google' ? <GoogleGlyph /> : null}
        trailingChevron={false}
        loading={ssoLoading === provider}
        disabled={busy && ssoLoading !== provider}
        onPress={() => handleSSO(provider)}
        testID={`landing-${provider}`}
      />
    );
  };
  const ssoProviders = providers.filter((p) => p !== 'email');

  return (
    <View style={styles.screen}>
      <AuthBackdrop />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: Math.max(insets.top, 24) + 24, paddingBottom: Math.max(insets.bottom, 24) + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        <Wordmark size={40} style={styles.wordmark} />

        <View style={styles.actions}>{ssoProviders.map(ssoButton)}</View>

        {providers.includes('email') ? (
          <>
            <OrDivider style={styles.or} />
            <FormError>{error}</FormError>
            <SlantButton
              size="md"
              label={t('landing.continueWithEmail', { defaultValue: 'Continue with Email' })}
              onPress={() => navigation.navigate('SignIn', { mode: 'signup' })}
              disabled={busy}
              testID="landing-email"
            />
          </>
        ) : (
          <FormError>{error}</FormError>
        )}

        <Text style={styles.terms} maxFontSizeMultiplier={1.4}>
          {t('auth.termsLead', { defaultValue: 'By continuing, you are agreeing to our ' })}
          <Text style={styles.termsBold}>{t('auth.termsOfService', { defaultValue: 'Terms of Service' })}</Text>
          {t('auth.termsAnd', { defaultValue: ' & ' })}
          <Text style={styles.termsBold}>{t('auth.privacyPolicy', { defaultValue: 'Privacy Policy' })}</Text>
          {t('auth.termsTail', { defaultValue: '.' })}
        </Text>

        <View style={styles.signInRow}>
          <Text style={styles.prompt} maxFontSizeMultiplier={1.4}>
            {t('auth.alreadyPlaying', { defaultValue: 'Already playing?' })}
          </Text>
          <LinkText
            chevron="right"
            size={13}
            onPress={() => navigation.navigate('SignIn', { mode: 'signin' })}
            testID="landing-signin"
          >
            {t('landing.signIn', { defaultValue: 'SIGN IN' })}
          </LinkText>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.obsidian },
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24 },
  wordmark: { marginBottom: 36 },
  actions: { alignSelf: 'stretch', gap: 14 },
  or: { marginVertical: 14 },
  terms: {
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 17,
    color: colors.muted2,
    textAlign: 'center',
    marginTop: 22,
    paddingHorizontal: 24,
  },
  termsBold: { fontFamily: fonts.mono, color: colors.white },
  signInRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 22,
    minHeight: 44,
  },
  prompt: { fontFamily: fonts.body, fontSize: 12, color: colors.muted2 },
});
