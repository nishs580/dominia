import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@clerk/clerk-expo';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { MapView, Camera, MarkerView, setAccessToken, StyleURL } from '@rnmapbox/maps';
import * as Location from 'expo-location';
import { Pedometer } from 'expo-sensors';
import { setHomePin as saveHomePin } from '../lib/homePinApi';
import { patchMe } from '../lib/meApi';
import { supabase } from '../lib/supabase';
import { colors, duration } from '../lib/theme';

setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '');

const INK = colors.ink;
const INK2 = colors.ink2;
const BONE = colors.bone;
const SLATE = colors.slate;
const SLATE2 = colors.slate2;
const CLAIM = colors.claim;
const HAIRLINE_STRONG = colors.hairlineStrong;

// Fallback map centres for the two beta cities when no location fix is available.
// The ru locale cohort plays in Saint Petersburg; everyone else starts in Bengaluru.
const FALLBACK_CENTRE_BENGALURU = [77.5946, 12.9716];
const FALLBACK_CENTRE_SAINT_PETERSBURG = [30.3158, 59.9343];

function coordsFromMapPress(payload) {
  if (!payload) return null;
  const fromGeometry = payload.geometry?.coordinates ?? payload?.features?.[0]?.geometry?.coordinates;
  if (Array.isArray(fromGeometry) && fromGeometry.length >= 2) {
    return [Number(fromGeometry[0]), Number(fromGeometry[1])];
  }
  return null;
}

function ProgressBar({ step }) {
  return (
    <View style={{ flexDirection: 'row', gap: 4, justifyContent: 'center', marginBottom: 16 }}>
      {Array.from({ length: 5 }).map((_, idx) => (
        <View
          key={idx}
          style={{
            width: 28,
            height: 2,
            backgroundColor: idx === step ? BONE : HAIRLINE_STRONG,
          }}
        />
      ))}
    </View>
  );
}

function PrimaryButton({ stepLabel, actionLabel, onPress, disabled }) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        {
          backgroundColor: CLAIM,
          paddingVertical: 14,
          width: '100%',
          alignItems: 'center',
        },
        disabled && { opacity: 0.5 },
        pressed && !disabled && { opacity: 0.9 },
      ]}
    >
      <Text
        style={{
          fontFamily: 'GeistMono_400Regular',
          fontSize: 9,
          letterSpacing: 1.6,
          color: 'rgba(242,238,230,0.75)',
          textTransform: 'uppercase',
        }}
      >
        {stepLabel}
      </Text>
      <Text
        style={{
          fontFamily: 'GeistMono_500Medium',
          fontSize: 14,
          letterSpacing: 2.4,
          color: BONE,
          textTransform: 'uppercase',
        }}
      >
        {actionLabel}
      </Text>
    </Pressable>
  );
}

function SectionLabel({ label }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
      <Text
        style={{
          fontFamily: 'GeistMono_400Regular',
          fontSize: 9,
          letterSpacing: 1.6,
          color: SLATE2,
          textTransform: 'uppercase',
          flexShrink: 0,
        }}
      >
        {label}
      </Text>
      <View style={{ flex: 1, height: 0.5, backgroundColor: HAIRLINE_STRONG }} />
    </View>
  );
}

function NumberedRow({ num, title, subtitle, last = false }) {
  return (
    <View
      style={{
        borderTopWidth: 0.5,
        borderTopColor: HAIRLINE_STRONG,
        paddingVertical: 10,
        flexDirection: 'row',
        gap: 12,
        ...(last ? { borderBottomWidth: 0.5, borderBottomColor: HAIRLINE_STRONG } : {}),
      }}
    >
      <Text style={{ fontFamily: 'GeistMono_500Medium', fontSize: 11, color: SLATE2, paddingTop: 2, minWidth: 16 }}>
        {num}
      </Text>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 15, color: BONE, marginBottom: 3, textAlign: 'left' }}>
          {title}
        </Text>
        <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 13, color: SLATE2, lineHeight: 19, textAlign: 'left' }}>
          {subtitle}
        </Text>
      </View>
    </View>
  );
}

export default function OnboardingScreen({ route }) {
  const navigation = useNavigation();
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { userId: clerkUserId, getToken } = useAuth();
  const [resolvedPlayerId, setResolvedPlayerId] = useState(route.params?.playerId ?? null);
  const [resolveError, setResolveError] = useState(null);
  const [resolveRetryNonce, setResolveRetryNonce] = useState(0);
  const [step, setStep] = useState(0);
  const [requesting, setRequesting] = useState(false);
  const [savingPin, setSavingPin] = useState(false);
  const [finishingOnboarding, setFinishingOnboarding] = useState(false);
  const [homePin, setHomePin] = useState(null);
  const [locationDenied, setLocationDenied] = useState(false);
  const [saveError, setSaveError] = useState(null);
  // City resolved server-side from the dropped pin (e.g. "Saint Petersburg").
  // Drives the step-4 copy so it names the player's actual city, not a default.
  const [homeCity, setHomeCity] = useState(null);
  const [userCoord, setUserCoord] = useState(null);
  const homeCameraRef = useRef(null);
  const didCenterOnUserRef = useRef(false);
  const [username, setUsername] = useState('');

  useEffect(() => {
    if (resolvedPlayerId) return;
    if (!clerkUserId) return;
    let cancelled = false;
    setResolveError(null);
    supabase
      .from('players')
      .select('id')
      .eq('clerk_id', clerkUserId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error('OnboardingScreen resolvedPlayerId lookup failed:', error);
          setResolveError(error);
          return;
        }
        if (!data) {
          setResolveError(new Error('NO_PLAYER_ROW'));
          return;
        }
        setResolvedPlayerId(data.id);
      });
    return () => {
      cancelled = true;
    };
  }, [clerkUserId, resolvedPlayerId, resolveRetryNonce]);

  // When the player reaches the home-pin step, drop them on their actual current
  // location (location permission is requested on the previous step) so they place
  // the pin where they are rather than hunting from Amsterdam. Runs once; if the
  // fix is unavailable or permission was denied, the map stays on its default center.
  useEffect(() => {
    if (step !== 3) return;
    if (didCenterOnUserRef.current) return;
    let cancelled = false;
    (async () => {
      try {
        const perm = await Location.getForegroundPermissionsAsync();
        if (!perm.granted) {
          if (!cancelled) setLocationDenied(true);
          return;
        }
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const lat = pos?.coords?.latitude;
        const lng = pos?.coords?.longitude;
        if (cancelled || lat == null || lng == null) return;
        didCenterOnUserRef.current = true;
        setUserCoord([lng, lat]);
        homeCameraRef.current?.setCamera({
          centerCoordinate: [lng, lat],
          zoomLevel: 14,
          animationDuration: 0,
        });
      } catch (err) {
        console.log('[onboarding] current location unavailable', err?.message ?? err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [step]);

  // Single container fade on the brand curve — text renders statically (type is
  // never animated). Honours the system reduce-motion setting with an instant cut.
  const introOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (step !== 0) return;
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (cancelled) return;
      if (reduced) {
        introOpacity.setValue(1);
        return;
      }
      Animated.timing(introOpacity, {
        toValue: 1,
        duration: duration.normal,
        easing: Easing.bezier(0.2, 0, 0, 1),
        useNativeDriver: true,
      }).start();
    });
    return () => {
      cancelled = true;
    };
  }, [step, introOpacity]);

  useEffect(() => {
    if (step !== 4 || !resolvedPlayerId) return;
    supabase
      .from('players')
      .select('username')
      .eq('id', resolvedPlayerId)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.username) setUsername(data.username);
      });
  }, [step, resolvedPlayerId]);

  const content = useMemo(() => {
    if (step === 0) {
      return (
        <Animated.View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 4, opacity: introOpacity }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginBottom: 0 }}>
            <Text maxFontSizeMultiplier={1.2} style={{ fontFamily: 'Archivo_900Black', fontSize: 34, color: BONE, letterSpacing: 0.7, textTransform: 'uppercase' }}>
              DOMINIA
            </Text>
            <Text style={{ fontFamily: 'Archivo_900Black', fontSize: 11, color: BONE, marginLeft: 4, marginBottom: 6 }}>
              ▪
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, marginBottom: 20 }}>
            <Text
              style={{
                fontFamily: 'GeistMono_400Regular',
                fontSize: 9,
                letterSpacing: 1.6,
                color: SLATE2,
                textTransform: 'uppercase',
                flexShrink: 0,
              }}
            >
              {t('onboarding.tagline')}
            </Text>
            <View style={{ flex: 1, height: 0.5, backgroundColor: HAIRLINE_STRONG }} />
          </View>
          <View>
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 16, color: BONE, lineHeight: 24 }}>{t('onboarding.introBody')}</Text>
          </View>
        </Animated.View>
      );
    }

    if (step === 1) {
      return (
        <View style={{ width: '100%' }}>
          <SectionLabel label={t('onboarding.sectionHowItWorks')} />
          <Text
            style={{
              fontFamily: 'Archivo_900Black',
              fontSize: 24,
              color: BONE,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              marginBottom: 22,
              lineHeight: 30,
              textAlign: 'left',
            }}
          >
            {t('onboarding.heading1')}
          </Text>
          <NumberedRow
            num="01"
            title={t('onboarding.row1Title')}
            subtitle={t('onboarding.row1Sub')}
          />
          <NumberedRow
            num="02"
            title={t('onboarding.row2Title')}
            subtitle={t('onboarding.row2Sub')}
          />
          <NumberedRow num="03" title={t('onboarding.row3Title')} subtitle={t('onboarding.row3Sub')} last />
        </View>
      );
    }

    if (step === 2) {
      return (
        <View style={{ width: '100%', flex: 1, justifyContent: 'center' }}>
          <SectionLabel label={t('onboarding.sectionBeforeStart')} />
          <Text
            style={{
              fontFamily: 'Archivo_900Black',
              fontSize: 24,
              color: BONE,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              marginBottom: 22,
              lineHeight: 30,
              textAlign: 'left',
            }}
          >
            {t('onboarding.heading2')}
          </Text>
          <NumberedRow num="01" title={t('onboarding.locationTitle')} subtitle={t('onboarding.locationSub')} />
          <NumberedRow num="02" title={t('onboarding.stepCounterTitle')} subtitle={t('onboarding.stepCounterSub')} last />
          <View
            style={{
              marginTop: 14,
              padding: 10,
              backgroundColor: INK2,
              borderWidth: 0.5,
              borderColor: HAIRLINE_STRONG,
            }}
          >
            <Text
              style={{
                fontFamily: 'GeistMono_400Regular',
                fontSize: 8,
                letterSpacing: 2,
                color: SLATE2,
                textTransform: 'uppercase',
                marginBottom: 4,
                textAlign: 'left',
              }}
            >
              {t('onboarding.privacyLabel')}
            </Text>
            <Text style={{ fontFamily: 'GeistMono_400Regular', fontSize: 11, color: BONE, lineHeight: 17, textAlign: 'left' }}>
              {t('onboarding.privacyBody')}
            </Text>
          </View>
        </View>
      );
    }

    if (step === 3) {
      return (
        <View style={{ width: '100%', flex: 1 }}>
          <SectionLabel label={t('onboarding.sectionSetBase')} />
          <Text
            style={{
              fontFamily: 'Archivo_900Black',
              fontSize: 19,
              color: BONE,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              marginBottom: 8,
              lineHeight: 25,
              textAlign: 'left',
            }}
          >
            {t('onboarding.heading3')}
          </Text>
          <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11, color: SLATE2, marginBottom: 12, textAlign: 'left' }}>
            {t('onboarding.setCitySub')}
          </Text>
          <View
            style={{
              flex: 1,
              minHeight: 240,
              marginTop: 4,
              overflow: 'hidden',
              borderWidth: 0.5,
              borderColor: HAIRLINE_STRONG,
            }}
          >
            <MapView
              style={StyleSheet.absoluteFillObject}
              styleURL="mapbox://styles/mapbox/dark-v11"
              onPress={(payload) => {
                const c = coordsFromMapPress(payload);
                if (c) setHomePin(c);
              }}
            >
              <Camera
                ref={homeCameraRef}
                defaultSettings={{
                  centerCoordinate:
                    userCoord ??
                    (i18n.language?.startsWith('ru') ? FALLBACK_CENTRE_SAINT_PETERSBURG : FALLBACK_CENTRE_BENGALURU),
                  zoomLevel: userCoord ? 14 : 11,
                }}
              />
              {homePin ? (
                <MarkerView coordinate={homePin} anchor={{ x: 0.5, y: 1 }}>
                  <View style={{ alignItems: 'center' }}>
                    <View
                      style={{
                        width: 28,
                        height: 28,
                        backgroundColor: BONE,
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 2,
                      }}
                    >
                      <View style={{ width: 9, height: 9, backgroundColor: CLAIM }} />
                    </View>
                    <View
                      style={{
                        width: 12,
                        height: 12,
                        backgroundColor: BONE,
                        transform: [{ rotate: '45deg' }],
                        marginTop: -7,
                        zIndex: 1,
                      }}
                    />
                  </View>
                </MarkerView>
              ) : null}
            </MapView>
            {!homePin ? (
              <View style={{ position: 'absolute', bottom: 12, alignSelf: 'center', maxWidth: '92%' }} pointerEvents="none">
                <Text
                  style={{
                    fontFamily: 'GeistMono_400Regular',
                    fontSize: 9,
                    letterSpacing: 1.4,
                    color: SLATE2,
                    textTransform: 'uppercase',
                    backgroundColor: 'rgba(14,16,20,0.75)',
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                    textAlign: 'center',
                  }}
                >
                  {locationDenied ? t('onboarding.locationUnavailable') : t('onboarding.tapToPlace')}
                </Text>
              </View>
            ) : null}
          </View>
          {!resolvedPlayerId ? (
            resolveError ? (
              <View style={{ marginTop: 8, alignItems: 'center' }}>
                <Text
                  style={{
                    fontFamily: 'Inter_400Regular',
                    fontSize: 13,
                    color: BONE,
                    marginBottom: 8,
                    textAlign: 'center',
                  }}
                >
                  {t('onboarding.couldNotLoadSession')}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setResolveRetryNonce((n) => n + 1)}
                  style={{ paddingVertical: 12, paddingHorizontal: 24, alignSelf: 'center' }}
                  hitSlop={{ top: 6, bottom: 6, left: 12, right: 12 }}
                >
                  <Text
                    style={{
                      fontFamily: 'GeistMono_500Medium',
                      fontSize: 11,
                      color: BONE,
                      textTransform: 'uppercase',
                      letterSpacing: 1.4,
                      textDecorationLine: 'underline',
                    }}
                  >
                    {t('common.retry')}
                  </Text>
                </Pressable>
              </View>
            ) : (
              <Text
                style={{
                  fontFamily: 'GeistMono_400Regular',
                  fontSize: 9,
                  color: SLATE2,
                  textTransform: 'uppercase',
                  letterSpacing: 1.4,
                  textAlign: 'center',
                  marginTop: 8,
                }}
              >
                {t('onboarding.loadingSession')}
              </Text>
            )
          ) : null}
        </View>
      );
    }

    return (
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <Text style={{ fontFamily: 'GeistMono_400Regular', fontSize: 9, color: SLATE2, textTransform: 'uppercase', letterSpacing: 1.6 }}>
            {t('onboarding.commanderLabel')}
          </Text>
        </View>
        <Text
          maxFontSizeMultiplier={1.2}
          style={{
            fontFamily: 'Archivo_900Black',
            fontSize: 32,
            color: BONE,
            textTransform: 'uppercase',
            letterSpacing: 0.7,
            lineHeight: 36,
          }}
        >
          {username || t('onboarding.defaultCommander')}
        </Text>
        <View style={{ height: 0.5, backgroundColor: HAIRLINE_STRONG, marginBottom: 18 }} />
        <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 14, color: BONE, lineHeight: 22, marginBottom: 8 }}>{t('onboarding.cityYours', { city: homeCity || t('onboarding.cityFallback') })}</Text>
        <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 14, color: SLATE2, lineHeight: 22, marginBottom: 6 }}>
          {t('onboarding.threeNearby')}
        </Text>
        <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 14, color: SLATE2, lineHeight: 22 }}>{t('onboarding.claimNext')}</Text>
      </View>
    );
  }, [step, homePin, homeCity, userCoord, introOpacity, username, resolvedPlayerId, resolveError, locationDenied, i18n.language, t]);

  const onNext = async () => {
    if (step === 2) {
      if (requesting) return;
      setRequesting(true);
      try {
        // Sequential requests so the OS dialogs arrive one at a time, in the same
        // order as the rationale rows above; a location denial feeds the map's
        // explicit fallback state instead of failing silently.
        const loc = await Location.requestForegroundPermissionsAsync().catch(() => null);
        if (!loc?.granted) setLocationDenied(true);
        await Pedometer.requestPermissionsAsync().catch(() => null);
      } finally {
        setRequesting(false);
        setStep(3);
      }
      return;
    }

    if (step === 3) {
      if (!homePin || savingPin || !resolvedPlayerId) return;
      setSavingPin(true);
      setSaveError(null);
      try {
        const result = await saveHomePin({
          clerkGetToken: getToken,
          lat: homePin[1],
          lng: homePin[0],
        });
        if (!result.ok) {
          console.error('Home pin save failed:', result.status, result.error);
          setSaveError(result.error || t('onboarding.saveFailedBody'));
          return;
        }
        if (result.data?.home_city) setHomeCity(result.data.home_city);
        setStep(4);
      } catch (err) {
        console.error('Home pin save threw:', err);
        setSaveError(t('onboarding.saveFailedBody'));
      } finally {
        setSavingPin(false);
      }
      return;
    }

    if (step === 4) {
      if (finishingOnboarding || !resolvedPlayerId) return;
      setFinishingOnboarding(true);
      setSaveError(null);
      try {
        const res = await patchMe({ clerkGetToken: getToken, fields: { has_onboarded: true } });
        if (!res.ok) throw new Error('update_failed');
        navigation.replace('MainTabs');
      } catch (err) {
        console.error('Onboarding finish failed:', err);
        setSaveError(t('onboarding.saveFailedBody'));
      } finally {
        setFinishingOnboarding(false);
      }
      return;
    }

    setStep((s) => s + 1);
  };

  return (
    <View style={{ flex: 1, backgroundColor: INK, paddingHorizontal: 18, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }}>
      <ProgressBar step={step} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1, justifyContent: step === 0 || step === 1 || step === 2 ? 'center' : 'flex-start' }}
        showsVerticalScrollIndicator={false}
        scrollEnabled={step !== 3}
      >
        {content}
      </ScrollView>
      <View style={{ gap: 10 }}>
        {saveError ? (
          <Text
            style={{
              fontFamily: 'Inter_400Regular',
              fontSize: 13,
              color: BONE,
              textAlign: 'center',
            }}
          >
            {saveError}
          </Text>
        ) : null}
        {step >= 1 && step <= 3 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('onboarding.back')}
            onPress={() => {
              setSaveError(null);
              setStep((s) => s - 1);
            }}
            style={{ paddingVertical: 12, paddingHorizontal: 24, alignSelf: 'center' }}
            hitSlop={{ top: 6, bottom: 6, left: 12, right: 12 }}
          >
            <Text
              style={{
                fontFamily: 'GeistMono_400Regular',
                fontSize: 11,
                color: SLATE,
                textTransform: 'uppercase',
                letterSpacing: 1.4,
                textAlign: 'center',
              }}
            >
              {t('onboarding.back')}
            </Text>
          </Pressable>
        ) : null}
        {step === 0 ? (
          <PrimaryButton stepLabel={t('onboarding.stepCount', { current: 1, total: 5 })} actionLabel={t('onboarding.actionBegin')} onPress={onNext} disabled={false} />
        ) : null}
        {step === 1 ? (
          <PrimaryButton stepLabel={t('onboarding.stepCount', { current: 2, total: 5 })} actionLabel={t('onboarding.actionContinue')} onPress={onNext} disabled={false} />
        ) : null}
        {step === 2 ? (
          <PrimaryButton stepLabel={t('onboarding.stepCount', { current: 3, total: 5 })} actionLabel={t('onboarding.actionGrantAccess')} onPress={onNext} disabled={requesting} />
        ) : null}
        {step === 3 ? (
          <PrimaryButton
            stepLabel={t('onboarding.stepCount', { current: 4, total: 5 })}
            actionLabel={t('onboarding.actionConfirmPin')}
            onPress={onNext}
            disabled={!homePin || savingPin || !resolvedPlayerId}
          />
        ) : null}
        {step === 4 ? (
          <PrimaryButton
            stepLabel={t('onboarding.lastStep')}
            actionLabel={t('onboarding.actionEnterMap')}
            onPress={onNext}
            disabled={finishingOnboarding || !resolvedPlayerId}
          />
        ) : null}
      </View>
    </View>
  );
}
