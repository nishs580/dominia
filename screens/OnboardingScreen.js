import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View, Alert } from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { useNavigation } from '@react-navigation/native';
import { MapView, Camera, MarkerView, setAccessToken, StyleURL } from '@rnmapbox/maps';
import * as Location from 'expo-location';
import { Pedometer } from 'expo-sensors';
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
  const { userId: clerkUserId } = useAuth();
  const [resolvedPlayerId, setResolvedPlayerId] = useState(route.params?.playerId ?? null);
  const [step, setStep] = useState(0);
  const [requesting, setRequesting] = useState(false);
  const [savingPin, setSavingPin] = useState(false);
  const [finishingOnboarding, setFinishingOnboarding] = useState(false);
  const [homePin, setHomePin] = useState(null);
  const [username, setUsername] = useState('');
  const [displayedTagline, setDisplayedTagline] = useState('');
  const [displayedBody, setDisplayedBody] = useState('');

  useEffect(() => {
    if (resolvedPlayerId) return;
    if (!clerkUserId) return;
    supabase
      .from('players')
      .select('id')
      .eq('clerk_id', clerkUserId)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.id) setResolvedPlayerId(data.id);
      });
  }, [clerkUserId, resolvedPlayerId]);

  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const bodyOpacity = useRef(new Animated.Value(0)).current;
  const buttonTranslateY = useRef(new Animated.Value(60)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (step !== 0) return;
    const fullTagline = 'Walk · Claim · Conquer · Defend';
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
          const fullBody = 'Your city is the game board.';
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
  }, [step]);

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
            <Text style={{ fontFamily: 'Archivo_900Black', fontSize: 34, color: BONE, letterSpacing: 0.7, textTransform: 'uppercase' }}>
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
          <SectionLabel label="HOW IT WORKS" />
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
            WALK TO OWN THE CITY
          </Text>
          <NumberedRow
            num="01"
            title="Claim territories"
            subtitle="Walk a territory's perimeter distance — from anywhere — to own it."
          />
          <NumberedRow
            num="02"
            title="Contest and defend"
            subtitle="Attack enemy ground. Hold your own when it comes under fire."
          />
          <NumberedRow num="03" title="Join an alliance" subtitle="Coordinate with 19 others to hold your city." last />
        </View>
      );
    }

    if (step === 2) {
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

    if (step === 3) {
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
              <Camera zoomLevel={12} centerCoordinate={[4.9041, 52.3676]} />
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
          <Text style={{ fontFamily: 'GeistMono_400Regular', fontSize: 9, color: SLATE, textTransform: 'uppercase', letterSpacing: 1.4 }}>
            #0004
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
        <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 14, color: BONE, lineHeight: 22, marginBottom: 8 }}>Amsterdam is yours to take.</Text>
        <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 14, color: SLATE2, lineHeight: 22, marginBottom: 6 }}>
          Three territories nearby are unclaimed.
        </Text>
        <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 14, color: SLATE2, lineHeight: 22 }}>Claim them on your next walk.</Text>
      </View>
    );
  }, [step, homePin, taglineOpacity, bodyOpacity, username, displayedTagline, displayedBody]);

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
        Alert.alert('Session error', 'Player ID missing. Please restart the app.');
        return;
      }
      setSavingPin(true);
      try {
        const { error } = await supabase
          .from('players')
          .update({ home_pin_lat: homePin[1], home_pin_lng: homePin[0] })
          .eq('id', resolvedPlayerId);
        if (error) throw error;
        setStep(4);
      } catch (err) {
        console.error('Home pin save failed:', err);
        Alert.alert('Could not save', err?.message ?? 'Please check your connection and try again.');
      } finally {
        setSavingPin(false);
      }
      return;
    }

    if (step === 4) {
      if (finishingOnboarding) return;
      if (!resolvedPlayerId) {
        Alert.alert('Session error', 'Player ID missing. Please restart the app.');
        return;
      }
      setFinishingOnboarding(true);
      try {
        const { error } = await supabase.from('players').update({ has_onboarded: true }).eq('id', resolvedPlayerId);
        if (error) throw error;
        navigation.replace('MainTabs');
      } catch (err) {
        console.error('Onboarding finish failed:', err);
        Alert.alert('Could not save', 'Please check your connection and try again.');
      } finally {
        setFinishingOnboarding(false);
      }
      return;
    }

    setStep((s) => s + 1);
  };

  return (
    <View style={{ flex: 1, backgroundColor: INK, paddingHorizontal: 18, paddingTop: 48, paddingBottom: 24 }}>
      <View style={{ flex: 1, justifyContent: step === 0 || step === 1 || step === 2 ? 'center' : 'flex-start' }}>{content}</View>
      <View style={{ gap: 10 }}>
        {step >= 1 && step <= 3 ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => setStep((s) => s - 1)}>
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
        {step === 0 ? (
          <Animated.View style={{ opacity: buttonOpacity, transform: [{ translateY: buttonTranslateY }] }}>
            <PrimaryButton stepLabel="Step 1 of 5" actionLabel="Begin →" onPress={onNext} disabled={false} />
          </Animated.View>
        ) : null}
        {step === 1 ? (
          <PrimaryButton stepLabel="Step 2 of 5" actionLabel="Continue →" onPress={onNext} disabled={false} />
        ) : null}
        {step === 2 ? (
          <PrimaryButton stepLabel="Step 3 of 5" actionLabel="Grant access →" onPress={onNext} disabled={requesting} />
        ) : null}
        {step === 3 ? (
          <PrimaryButton
            stepLabel="Step 4 of 5"
            actionLabel="Confirm pin →"
            onPress={onNext}
            disabled={!homePin || savingPin || !resolvedPlayerId}
          />
        ) : null}
        {step === 4 ? (
          <PrimaryButton stepLabel="Last step" actionLabel="Enter the map →" onPress={onNext} disabled={finishingOnboarding} />
        ) : null}
      </View>
    </View>
  );
}
