import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View, Alert } from 'react-native';
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

setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '');

const INK = '#0E1014';
const INK2 = '#1A1D24';
const BONE = '#F2EEE6';
const SLATE = '#5C6068';
const SLATE2 = '#8B8F98';
const CLAIM = '#D64525';
const HAIRLINE = 'rgba(242,238,230,0.08)';
const HAIRLINE_STRONG = 'rgba(242,238,230,0.16)';
const CLAIM_SOFT = 'rgba(214,69,37,0.14)';

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
    <View style={{ flexDirection: 'row', gap: 4, justifyContent: 'center', marginBottom: 12 }}>
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
  const { t } = useTranslation();
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
  // City resolved server-side from the dropped pin (e.g. "Saint Petersburg").
  // Drives the step-4 copy so it names the player's actual city, not a default.
  const [homeCity, setHomeCity] = useState(null);
  const [userCoord, setUserCoord] = useState(null);
  const homeCameraRef = useRef(null);
  const didCenterOnUserRef = useRef(false);
  const [username, setUsername] = useState('');
  const [displayedTagline, setDisplayedTagline] = useState('');
  const [displayedBody, setDisplayedBody] = useState('');

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
        if (!perm.granted) return;
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

  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const bodyOpacity = useRef(new Animated.Value(0)).current;
  const buttonTranslateY = useRef(new Animated.Value(60)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (step !== 0) return;
    const fullTagline = t('onboarding.typewriterTagline');
    setDisplayedTagline('');
    setDisplayedBody('');
    taglineOpacity.setValue(1);
    bodyOpacity.setValue(0);
    buttonOpacity.setValue(0);
    buttonTranslateY.setValue(60);

    let index = 0;
    const interval = setInterval(() => {
      index += 1;
      setDisplayedTagline(fullTagline.slice(0, index));
      if (index >= fullTagline.length) {
        clearInterval(interval);
        setTimeout(() => {
          const fullBody = t('onboarding.typewriterBody');
          let bodyIndex = 0;
          const bodyInterval = setInterval(() => {
            bodyIndex += 1;
            setDisplayedBody(fullBody.slice(0, bodyIndex));
            if (bodyIndex >= fullBody.length) {
              clearInterval(bodyInterval);
              Animated.parallel([
                Animated.timing(buttonTranslateY, {
                  toValue: 0,
                  duration: 280,
                  easing: Easing.out(Easing.cubic),
                  useNativeDriver: true,
                }),
                Animated.timing(buttonOpacity, {
                  toValue: 1,
                  duration: 280,
                  easing: Easing.out(Easing.cubic),
                  useNativeDriver: true,
                }),
              ]).start();
            }
          }, 55);
        }, 200);
      }
    }, 55);

    return () => clearInterval(interval);
  }, [step, t]);

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
        <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginBottom: 0 }}>
            <Text maxFontSizeMultiplier={1.2} style={{ fontFamily: 'Archivo_900Black', fontSize: 34, color: BONE, letterSpacing: 0.7, textTransform: 'uppercase' }}>
              DOMINIA
            </Text>
            <Text style={{ fontFamily: 'Archivo_900Black', fontSize: 11, color: CLAIM, marginLeft: 4, marginBottom: 6 }}>
              ▪
            </Text>
          </View>
          <Animated.View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, marginBottom: 20 }}>
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
              {displayedTagline}
            </Text>
            <View style={{ flex: 1, height: 0.5, backgroundColor: HAIRLINE_STRONG }} />
          </Animated.View>
          <View>
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 16, color: BONE, lineHeight: 24 }}>{displayedBody}</Text>
          </View>
        </View>
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
              backgroundColor: CLAIM_SOFT,
              borderLeftWidth: 2,
              borderLeftColor: CLAIM,
            }}
          >
            <Text
              style={{
                fontFamily: 'GeistMono_400Regular',
                fontSize: 8,
                letterSpacing: 2,
                color: CLAIM,
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
                  centerCoordinate: userCoord ?? [4.9041, 52.3676],
                  zoomLevel: userCoord ? 14 : 12,
                }}
              />
              {homePin ? (
                <MarkerView coordinate={homePin} anchor={{ x: 0.5, y: 1 }}>
                  <View style={{ alignItems: 'center' }}>
                    <View
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 14,
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
              <View style={{ position: 'absolute', bottom: 12, alignSelf: 'center' }} pointerEvents="none">
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
                    textAlign: 'left',
                  }}
                >
                  {t('onboarding.tapToPlace')}
                </Text>
              </View>
            ) : null}
          </View>
          {!resolvedPlayerId ? (
            resolveError ? (
              <View style={{ marginTop: 8, alignItems: 'center' }}>
                <Text
                  style={{
                    fontFamily: 'GeistMono_400Regular',
                    fontSize: 9,
                    color: CLAIM,
                    textTransform: 'uppercase',
                    letterSpacing: 1.4,
                    marginBottom: 8,
                    textAlign: 'center',
                  }}
                >
                  {t('onboarding.couldNotLoadSession')}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setResolveRetryNonce((n) => n + 1)}
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
          <Text style={{ fontFamily: 'GeistMono_400Regular', fontSize: 9, color: SLATE, textTransform: 'uppercase', letterSpacing: 1.4 }}>
            #0004
          </Text>
        </View>
        <Text
          maxFontSizeMultiplier={1.2}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
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
  }, [step, homePin, homeCity, userCoord, taglineOpacity, bodyOpacity, username, displayedTagline, displayedBody, t]);

  const onNext = async () => {
    if (step === 2) {
      if (requesting) return;
      setRequesting(true);
      try {
        await Promise.allSettled([Location.requestForegroundPermissionsAsync(), Pedometer.requestPermissionsAsync()]);
      } finally {
        setRequesting(false);
        setStep(3);
      }
      return;
    }

    if (step === 3) {
      if (!homePin || savingPin) return;
      if (!resolvedPlayerId) {
        Alert.alert(t('onboarding.alertSessionErrorTitle'), t('onboarding.alertSessionErrorBody'));
        return;
      }
      setSavingPin(true);
      try {
        const result = await saveHomePin({
          clerkGetToken: getToken,
          lat: homePin[1],
          lng: homePin[0],
        });
        if (!result.ok) {
          console.error('Home pin save failed:', result.status, result.error);
          Alert.alert(t('onboarding.alertCouldNotSaveTitle'), result.error || t('onboarding.alertCouldNotSaveBody'));
          return;
        }
        if (result.data?.home_city) setHomeCity(result.data.home_city);
        setStep(4);
      } finally {
        setSavingPin(false);
      }
      return;
    }

    if (step === 4) {
      if (finishingOnboarding) return;
      if (!resolvedPlayerId) {
        Alert.alert(t('onboarding.alertSessionErrorTitle'), t('onboarding.alertSessionErrorBody'));
        return;
      }
      setFinishingOnboarding(true);
      try {
        const res = await patchMe({ clerkGetToken: getToken, fields: { has_onboarded: true } });
        if (!res.ok) throw new Error('update_failed');
        navigation.replace('MainTabs');
      } catch (err) {
        console.error('Onboarding finish failed:', err);
        Alert.alert(t('onboarding.alertCouldNotSaveTitle'), t('onboarding.alertCouldNotSaveBody'));
      } finally {
        setFinishingOnboarding(false);
      }
      return;
    }

    setStep((s) => s + 1);
  };

  return (
    <View style={{ flex: 1, backgroundColor: INK, paddingHorizontal: 18, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1, justifyContent: step === 0 || step === 1 || step === 2 ? 'center' : 'flex-start' }}
        showsVerticalScrollIndicator={false}
        scrollEnabled={step !== 3}
      >
        {content}
      </ScrollView>
      <View style={{ gap: 10 }}>
        {step >= 1 && step <= 3 ? (
          <Pressable accessibilityRole="button" accessibilityLabel={t('onboarding.back')} onPress={() => setStep((s) => s - 1)}>
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
        <ProgressBar step={step} />
        {step === 0 ? (
          <Animated.View style={{ opacity: buttonOpacity, transform: [{ translateY: buttonTranslateY }] }}>
            <PrimaryButton stepLabel={t('onboarding.stepCount', { current: 1, total: 5 })} actionLabel={t('onboarding.actionBegin')} onPress={onNext} disabled={false} />
          </Animated.View>
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
          <PrimaryButton stepLabel={t('onboarding.lastStep')} actionLabel={t('onboarding.actionEnterMap')} onPress={onNext} disabled={finishingOnboarding} />
        ) : null}
      </View>
    </View>
  );
}
