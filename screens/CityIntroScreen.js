// City intro (Updated UX A7): the city on a full-bleed still map, and a bottom
// panel with "YOUR CITY · {CITY} MAP", the city as the title, "Let’s start
// your journey from {City}." and CONTINUE. A step inside FigmaOnboardingScreen.
//
// With home_bases off the home pin was already saved silently (rounded to
// about 1 km) when this step opened; the city name comes from the server's
// home_city. With home_bases on, the visible set-your-base step comes first
// (mode 'setBase'): the player taps the map to place the pin, as in today's
// OnboardingScreen.

import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Camera, MapView, MarkerView, setAccessToken } from '@rnmapbox/maps';
import { colors, fonts } from '../lib/theme';
import StaticMapBackdrop from '../components/StaticMapBackdrop';

setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '');

function coordsFromMapPress(payload) {
  const c = payload?.geometry?.coordinates ?? payload?.features?.[0]?.geometry?.coordinates;
  if (Array.isArray(c) && c.length >= 2) return { lng: Number(c[0]), lat: Number(c[1]) };
  return null;
}

function PinMarker() {
  return (
    <View style={styles.marker}>
      <View style={styles.markerDot} />
    </View>
  );
}

function PrimaryButton({ label, onPress, disabled }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.next, disabled && styles.dim, pressed && !disabled && styles.pressed]}
    >
      <Text style={styles.nextText}>{label}</Text>
    </Pressable>
  );
}

function SetBase({ suggestedCentre, saving, failed, onConfirm }) {
  const { t } = useTranslation();
  const [pin, setPin] = useState(null);
  const centre = suggestedCentre ? [suggestedCentre.lng, suggestedCentre.lat] : undefined;
  return (
    <>
      <Text style={styles.title} accessibilityRole="header" maxFontSizeMultiplier={1.2}>
        {t('onboarding.heading3')}
      </Text>
      <Text style={styles.body}>{t('onboarding.setCitySub')}</Text>
      <View style={styles.mapBox}>
        <MapView
          style={StyleSheet.absoluteFill}
          styleURL="mapbox://styles/mapbox/dark-v11"
          onPress={(payload) => {
            const c = coordsFromMapPress(payload);
            if (c) setPin(c);
          }}
        >
          <Camera defaultSettings={{ centerCoordinate: centre, zoomLevel: 14 }} />
          {pin ? (
            <MarkerView coordinate={[pin.lng, pin.lat]} anchor={{ x: 0.5, y: 0.5 }}>
              <PinMarker />
            </MarkerView>
          ) : null}
        </MapView>
        {!pin ? (
          <View style={styles.mapHint} pointerEvents="none">
            <Text style={styles.mapHintText}>{t('onboarding.tapToPlace')}</Text>
          </View>
        ) : null}
      </View>
      {failed ? <Text style={styles.note}>{t('onboarding.saveFailedBody')}</Text> : null}
      <PrimaryButton
        label={t('onboarding.actionConfirmPin')}
        onPress={() => pin && onConfirm?.(pin)}
        disabled={!pin || saving}
      />
    </>
  );
}

export default function CityIntroScreen({
  mode = 'cityIntro',
  pin,
  pinStatus,
  homeCity,
  usedFallback,
  claimNote,
  finishing,
  finishError,
  suggestedCentre,
  onConfirmBase,
  onRetryPin,
  onNext,
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const padding = { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 24 };

  if (mode === 'setBase') {
    return (
      <View style={[styles.screen, padding]}>
        <SetBase
          suggestedCentre={suggestedCentre}
          saving={pinStatus === 'saving'}
          failed={pinStatus === 'failed'}
          onConfirm={onConfirmBase}
        />
      </View>
    );
  }

  const saving = pinStatus === 'saving';
  const city = homeCity || t('cityIntro.yourCity', { defaultValue: 'Your city' });

  return (
    <View style={styles.full}>
      {pin ? <StaticMapBackdrop centre={pin} zoom={12} /> : <View style={styles.mapPlaceholder} />}
      <View style={styles.mapScrim} pointerEvents="none" />
      {!pin ? <ActivityIndicator color={colors.white} style={styles.mapLoading} /> : null}

      <View style={[styles.panel, { paddingBottom: insets.bottom + 24 }]}>
        <Text style={styles.eyebrow}>
          {saving
            ? t('cityIntro.locating', { defaultValue: 'Locating…' })
            : t('cityIntro.eyebrow', { city, defaultValue: 'Your city · {{city}} map' })}
        </Text>
        <Text style={styles.cityTitle} accessibilityRole="header" maxFontSizeMultiplier={1.2} numberOfLines={2}>
          {city}
        </Text>
        <Text style={styles.panelBody}>
          {t('cityIntro.body', { city, defaultValue: 'Let’s start your journey from {{city}}.' })}
        </Text>

        {usedFallback ? (
          <Text style={styles.note}>
            {t('cityIntro.locationOff', {
              defaultValue: 'Location is off, so you start from the city centre. You can play from anywhere.',
            })}
          </Text>
        ) : null}
        {pinStatus === 'failed' ? (
          <View style={styles.failRow}>
            <Text style={[styles.note, styles.failText]}>
              {t('cityIntro.saveFailed', { defaultValue: "Couldn't save your home city." })}
            </Text>
            <Pressable accessibilityRole="button" onPress={onRetryPin} hitSlop={8} style={styles.retry}>
              <Text style={styles.retryText}>{t('common.retry')}</Text>
            </Pressable>
          </View>
        ) : null}
        {claimNote ? <Text style={styles.note}>{claimNote}</Text> : null}
        {finishError ? <Text style={styles.note}>{t('onboarding.saveFailedBody')}</Text> : null}

        <PrimaryButton
          label={t('cityIntro.continue', { defaultValue: 'Continue' })}
          onPress={onNext}
          disabled={saving || finishing}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink, paddingHorizontal: 24 },
  // Updated UX A7: full-bleed map + bottom panel.
  full: { flex: 1, backgroundColor: colors.obsidian, justifyContent: 'flex-end' },
  mapPlaceholder: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.surface },
  mapScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(16,16,16,0.25)' },
  panel: {
    backgroundColor: colors.obsidian,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
    paddingHorizontal: 24,
    paddingTop: 28,
  },
  eyebrow: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.8,
    color: colors.lime,
    textTransform: 'uppercase',
  },
  cityTitle: {
    fontFamily: fonts.display,
    fontSize: 52,
    lineHeight: 54,
    letterSpacing: -1,
    color: colors.white,
    textTransform: 'uppercase',
    marginTop: 12,
  },
  panelBody: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: colors.muted2, marginTop: 12, marginBottom: 16 },
  kicker: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.8,
    color: colors.slate2,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 32,
    letterSpacing: -0.9,
    color: colors.bone,
    textTransform: 'uppercase',
  },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.bone, marginTop: 8, marginBottom: 16 },
  mapBox: {
    flex: 1,
    minHeight: 240,
    borderWidth: 0.5,
    borderColor: colors.hairlineStrong,
    backgroundColor: colors.ink2,
    overflow: 'hidden',
    marginBottom: 16,
    justifyContent: 'center',
  },
  mapLoading: { position: 'absolute', top: '40%', alignSelf: 'center' },
  mapHint: { position: 'absolute', bottom: 12, alignSelf: 'center' },
  mapHintText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.slate2,
    textTransform: 'uppercase',
    backgroundColor: 'rgba(16,16,16,0.75)',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  marker: { width: 22, height: 22, backgroundColor: colors.bone, alignItems: 'center', justifyContent: 'center' },
  markerDot: { width: 8, height: 8, backgroundColor: colors.lime },
  note: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.slate2, marginBottom: 12 },
  failRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  failText: { flex: 1, marginBottom: 0, color: colors.bone },
  retry: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 12 },
  retryText: {
    fontFamily: fonts.monoMedium,
    fontSize: 11,
    letterSpacing: 1.6,
    color: colors.bone,
    textTransform: 'uppercase',
    textDecorationLine: 'underline',
  },
  next: {
    backgroundColor: colors.claimButton,
    minHeight: 48,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextText: { fontFamily: fonts.monoMedium, fontSize: 14, letterSpacing: 2, color: colors.bone, textTransform: 'uppercase' },
  dim: { opacity: 0.5 },
  pressed: { opacity: 0.9 },
});
