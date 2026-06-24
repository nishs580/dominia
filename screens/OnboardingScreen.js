import React, { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View, Alert } from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { useNavigation } from '@react-navigation/native';
import { MapView, Camera, MarkerView, setAccessToken } from '@rnmapbox/maps';
import * as Location from 'expo-location';
import { Pedometer } from 'expo-sensors';
import { setHomePin as saveHomePin } from '../lib/homePinApi';
import { patchMe } from '../lib/meApi';
import { supabase } from '../lib/supabase';
import { logDebug } from '../lib/debug';

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

// Onboarding is account-bound setup only — the value pitch (intro + how-it-works)
// now lives in the pre-auth WelcomeScreen. Three steps: permissions, home pin,
// payoff.
const TOTAL_STEPS = 3;
const STEP_PERMISSIONS = 0;
const STEP_HOME_PIN = 1;
const STEP_PAYOFF = 2;

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
      {Array.from({ length: TOTAL_STEPS }).map((_, idx) => (
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
  const { userId: clerkUserId, getToken } = useAuth();
  const [resolvedPlayerId, setResolvedPlayerId] = useState(route.params?.playerId ?? null);
  const [resolveError, setResolveError] = useState(null);
  const [resolveRetryNonce, setResolveRetryNonce] = useState(0);
  const [step, setStep] = useState(STEP_PERMISSIONS);
  const [requesting, setRequesting] = useState(false);
  const [locationDenied, setLocationDenied] = useState(false);
  const [savingPin, setSavingPin] = useState(false);
  const [finishingOnboarding, setFinishingOnboarding] = useState(false);
  const [homePin, setHomePin] = useState(null);
  const [mapCenter, setMapCenter] = useState([4.9041, 52.3676]);
  const [mapZoom, setMapZoom] = useState(12);
  const [username, setUsername] = useState('');
  const [resolvedCity, setResolvedCity] = useState(null);
  const [unclaimedNearby, setUnclaimedNearby] = useState(0);

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

  useEffect(() => {
    if (step !== STEP_PAYOFF || !resolvedPlayerId) return;
    supabase
      .from('players')
      .select('username')
      .eq('id', resolvedPlayerId)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.username) setUsername(data.username);
      });
  }, [step, resolvedPlayerId]);

  // On reaching the home-pin step, center the map on the device's actual
  // location (permission was requested on the previous step) and pre-drop the
  // pin there so the player only has to confirm or nudge — not hunt across a
  // city-level map that used to open hardcoded on Amsterdam. Falls back to the
  // default center silently if location is unavailable or denied.
  useEffect(() => {
    if (step !== STEP_HOME_PIN) return;
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (cancelled) return;
        const coord = [pos.coords.longitude, pos.coords.latitude];
        setMapCenter(coord);
        setMapZoom(14);
        setHomePin((prev) => prev ?? coord);
      } catch (err) {
        if (__DEV__) console.log('Onboarding location center failed:', err?.message ?? err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [step]);

  // Funnel instrumentation: one event per step the player reaches, so drop-off
  // within the setup flow is measurable. Depends on `step` only to avoid a
  // duplicate emit when the player id resolves a beat later.
  useEffect(() => {
    logDebug(resolvedPlayerId, 'onboarding_step_viewed', { step });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const content = useMemo(() => {
    if (step === STEP_PERMISSIONS) {
      return (
        <View style={{ width: '100%', flex: 1, justifyContent: 'center' }}>
          <SectionLabel label="BEFORE WE START" />
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
            TWO THINGS WE NEED
          </Text>
          <NumberedRow num="01" title="Location" subtitle="To show you the map and count your walks." />
          <NumberedRow num="02" title="Step counter" subtitle="Steps convert directly into claimed ground." last />
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
              Privacy
            </Text>
            <Text style={{ fontFamily: 'GeistMono_400Regular', fontSize: 11, color: BONE, lineHeight: 17, textAlign: 'left' }}>
              Your location is never visible to other players.
            </Text>
          </View>
        </View>
      );
    }

    if (step === STEP_HOME_PIN) {
      return (
        <View style={{ width: '100%', flex: 1 }}>
          <SectionLabel label="SET YOUR BASE" />
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
            {'PLACE YOUR HOME PIN '}
          </Text>
          <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11, color: SLATE2, marginBottom: 12, textAlign: 'left' }}>
            This sets the city you play for.
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
              <Camera zoomLevel={mapZoom} centerCoordinate={mapCenter} />
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
                  Tap to place your pin
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
                  Could not load session
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
                    Retry
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
                Loading session...
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
            Commander
          </Text>
        </View>
        <Text
          style={{
            fontFamily: 'Archivo_900Black',
            fontSize: 32,
            color: BONE,
            textTransform: 'uppercase',
            letterSpacing: 0.7,
            lineHeight: 36,
          }}
        >
          {username || 'COMMANDER'}
        </Text>
        <View style={{ height: 0.5, backgroundColor: HAIRLINE_STRONG, marginBottom: 18 }} />
        <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 14, color: BONE, lineHeight: 22, marginBottom: 8 }}>
          {resolvedCity || 'Your city'} is yours to take.
        </Text>
        <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 14, color: SLATE2, lineHeight: 22, marginBottom: 6 }}>
          {unclaimedNearby > 0
            ? `${unclaimedNearby} ${unclaimedNearby === 1 ? 'territory' : 'territories'} nearby ${unclaimedNearby === 1 ? 'is' : 'are'} unclaimed.`
            : 'Unclaimed ground is waiting nearby.'}
        </Text>
        <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 14, color: SLATE2, lineHeight: 22 }}>
          {unclaimedNearby > 1 ? 'Claim them on your next walk.' : 'Claim it on your next walk.'}
        </Text>
      </View>
    );
  }, [step, homePin, mapCenter, mapZoom, resolvedCity, unclaimedNearby, resolvedPlayerId, resolveError, username]);

  const onNext = async () => {
    if (step === STEP_PERMISSIONS) {
      if (requesting) return;
      setRequesting(true);
      try {
        const [locRes, pedRes] = await Promise.allSettled([
          Location.requestForegroundPermissionsAsync(),
          Pedometer.requestPermissionsAsync(),
        ]);
        const locationGranted = locRes.status === 'fulfilled' && locRes.value?.status === 'granted';
        const pedometerGranted = pedRes.status === 'fulfilled' && pedRes.value?.status === 'granted';
        logDebug(resolvedPlayerId, 'onboarding_permissions_result', {
          location: locationGranted,
          pedometer: pedometerGranted,
        });
        // Location is the hard requirement (map + walk tracking). If it's denied,
        // don't silently push on into a degraded home-pin step — surface a
        // recovery path. The step counter can still be granted later.
        if (!locationGranted) {
          setLocationDenied(true);
          return;
        }
        setLocationDenied(false);
        setStep(STEP_HOME_PIN);
      } finally {
        setRequesting(false);
      }
      return;
    }

    if (step === STEP_HOME_PIN) {
      if (!homePin || savingPin) return;
      if (!resolvedPlayerId) {
        Alert.alert('Session error', 'Player ID missing. Please restart the app.');
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
          Alert.alert('Could not save', result.error || 'Please check your connection and try again.');
          return;
        }
        // The backend resolves the pin to a live city; null means the pin isn't
        // in (or near) any realm with territories. Block here rather than drop
        // the player into an empty map with nothing to claim.
        if (!result.data?.home_city) {
          logDebug(resolvedPlayerId, 'onboarding_home_pin_rejected', { reason: 'city_not_live' });
          Alert.alert(
            'Not live here yet',
            'Dominia hasn’t launched in your area. Drop your pin inside a live city to play, or check back soon.',
          );
          return;
        }
        const nearby = Number(result.data.unclaimed_nearby ?? 0);
        setResolvedCity(result.data.home_city);
        setUnclaimedNearby(nearby);
        logDebug(resolvedPlayerId, 'onboarding_home_pin_set', {
          home_city: result.data.home_city,
          unclaimed_nearby: nearby,
        });
        setStep(STEP_PAYOFF);
      } finally {
        setSavingPin(false);
      }
      return;
    }

    if (step === STEP_PAYOFF) {
      if (finishingOnboarding) return;
      if (!resolvedPlayerId) {
        Alert.alert('Session error', 'Player ID missing. Please restart the app.');
        return;
      }
      setFinishingOnboarding(true);
      try {
        const res = await patchMe({ clerkGetToken: getToken, fields: { has_onboarded: true } });
        if (!res.ok) throw new Error('update_failed');
        logDebug(resolvedPlayerId, 'onboarding_completed', {});
        navigation.replace('MainTabs');
      } catch (err) {
        console.error('Onboarding finish failed:', err);
        Alert.alert('Could not save', 'Please check your connection and try again.');
      } finally {
        setFinishingOnboarding(false);
      }
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: INK, paddingHorizontal: 18, paddingTop: 48, paddingBottom: 24 }}>
      <View style={{ flex: 1 }}>{content}</View>
      <View style={{ gap: 10 }}>
        {step === STEP_HOME_PIN ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => setStep(STEP_PERMISSIONS)}>
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
              Back
            </Text>
          </Pressable>
        ) : null}
        <ProgressBar step={step} />
        {step === STEP_PERMISSIONS && locationDenied ? (
          <View style={{ marginBottom: 4 }}>
            <Text style={{ fontFamily: 'GeistMono_400Regular', fontSize: 9, color: CLAIM, textTransform: 'uppercase', letterSpacing: 1.6, textAlign: 'center', marginBottom: 8 }}>
              Location is required to play
            </Text>
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 13, color: SLATE2, textAlign: 'center', lineHeight: 19, marginBottom: 10 }}>
              Dominia needs location to show the map and count your walks. Enable it in Settings, then try again.
            </Text>
            <Pressable accessibilityRole="button" onPress={() => Linking.openSettings()}>
              <Text style={{ fontFamily: 'GeistMono_500Medium', fontSize: 11, color: BONE, textTransform: 'uppercase', letterSpacing: 1.4, textAlign: 'center', textDecorationLine: 'underline' }}>
                Open settings
              </Text>
            </Pressable>
          </View>
        ) : null}
        {step === STEP_PERMISSIONS ? (
          <PrimaryButton
            stepLabel="Step 1 of 3"
            actionLabel={locationDenied ? 'Try again →' : 'Grant access →'}
            onPress={onNext}
            disabled={requesting}
          />
        ) : null}
        {step === STEP_HOME_PIN ? (
          <PrimaryButton
            stepLabel="Step 2 of 3"
            actionLabel="Confirm pin →"
            onPress={onNext}
            disabled={!homePin || savingPin || !resolvedPlayerId}
          />
        ) : null}
        {step === STEP_PAYOFF ? (
          <PrimaryButton stepLabel="Last step" actionLabel="Enter the map →" onPress={onNext} disabled={finishingOnboarding} />
        ) : null}
      </View>
    </View>
  );
}
