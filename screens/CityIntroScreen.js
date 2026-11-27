// City intro (Dominia-Temp core-loop board): "<CITY> MAP", a lime-tinted
// "Let's start your journey from <City>", a still map preview with a red pin
// and a slanted city label, and NEXT ». A step inside FigmaOnboardingScreen.
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
import Svg, { Circle, Path, Polygon } from 'react-native-svg';
import { SlantButton } from '../components/ui';

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

const LIME_TINT = 'rgba(132,255,68,0.7)';

// Red drop pin with a white dot, tip at the bottom centre.
function MapPin() {
  return (
    <Svg width={30} height={40} viewBox="0 0 30 40">
      <Path d="M15 39C15 39 2 23.5 2 14a13 13 0 0 1 26 0c0 9.5-13 25-13 25z" fill={colors.danger} />
      <Circle cx={15} cy={14} r={5} fill={colors.white} />
    </Svg>
  );
}

// White slanted chip under the pin with the city name in black caps.
function CityChip({ label }) {
  const [w, setW] = useState(0);
  const h = 26;
  const slant = 6;
  return (
    <View style={styles.chip} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {w > 0 ? (
        <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
          <Polygon points={`${slant},0 ${w},0 ${w - slant},${h} 0,${h}`} fill={colors.white} />
        </Svg>
      ) : null}
      <Text style={styles.chipText} numberOfLines={1} maxFontSizeMultiplier={1.2}>
        {label}
      </Text>
    </View>
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
    <View style={[styles.screen, styles.centred, padding]}>
      <Text style={styles.cityTitle} accessibilityRole="header" maxFontSizeMultiplier={1.2} numberOfLines={2}>
        {saving
          ? t('cityIntro.locating', { defaultValue: 'Locating…' })
          : t('cityIntro.title', { city, defaultValue: '{{city}} Map' })}
      </Text>
      <Text style={styles.journey} maxFontSizeMultiplier={1.4}>
        {t('cityIntro.journey', { city, defaultValue: 'Let’s start your journey from {{city}}' })}
      </Text>

      <View style={styles.preview} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {pin ? <StaticMapBackdrop centre={pin} zoom={13} /> : <View style={styles.mapPlaceholder} />}
        {pin ? (
          <View style={styles.pinWrap} pointerEvents="none">
            <MapPin />
            <CityChip label={city} />
          </View>
        ) : (
          <ActivityIndicator color={colors.white} style={styles.mapLoading} />
        )}
      </View>

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

      <SlantButton
        label={t('cityIntro.next', { defaultValue: 'NEXT' })}
        onPress={onNext}
        disabled={saving}
        loading={finishing}
        style={styles.nextSlant}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.obsidian, paddingHorizontal: 20 },
  centred: { justifyContent: 'center' },
  cityTitle: {
    fontFamily: fonts.display,
    fontSize: 32,
    lineHeight: 36,
    color: colors.white,
    textTransform: 'uppercase',
  },
  journey: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: LIME_TINT, marginTop: 8, marginBottom: 20 },
  preview: {
    height: 270,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceLine,
    overflow: 'hidden',
    marginBottom: 20,
  },
  mapPlaceholder: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.surface },
  pinWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', paddingBottom: 10 },
  chip: { minHeight: 26, paddingHorizontal: 14, justifyContent: 'center', marginTop: 4 },
  chipText: {
    fontFamily: fonts.action,
    fontSize: 12,
    letterSpacing: 0.6,
    color: colors.obsidian,
    textTransform: 'uppercase',
  },
  nextSlant: { marginTop: 4 },
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
    fontSize: 26,
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
    backgroundColor: 'rgba(0,0,0,0.75)',
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
