import React, { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '@clerk/clerk-expo';
import { MapView, Camera, MarkerView, setAccessToken, StyleURL } from '@rnmapbox/maps';
import * as Location from 'expo-location';
import { Pedometer } from 'expo-sensors';
import { supabase } from '../lib/supabase';

setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '');

const AMSTERDAM_CENTER = [4.9041, 52.3676];
const HOME_PIN_ZOOM = 12;

function coordsFromMapPress(payload) {
  if (!payload) return null;
  const fromGeometry = payload.geometry?.coordinates ?? payload?.features?.[0]?.geometry?.coordinates;
  if (Array.isArray(fromGeometry) && fromGeometry.length >= 2) {
    return [Number(fromGeometry[0]), Number(fromGeometry[1])];
  }
  return null;
}

const BG = '#0f0f14';
const ORANGE = '#ED9332';
const WHITE = '#ffffff';
const MUTED = '#666';

function Dots({ step }) {
  return (
    <View style={styles.dotsRow}>
      {Array.from({ length: 5 }).map((_, idx) => {
        const active = idx === step;
        return <View key={idx} style={[styles.dot, active ? styles.dotActive : styles.dotInactive]} />;
      })}
    </View>
  );
}

function PrimaryButton({ label, onPress, disabled }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.primaryBtn, pressed && !disabled && { opacity: 0.9 }, disabled && { opacity: 0.6 }]}
    >
      <Text style={styles.primaryBtnText}>{label}</Text>
    </Pressable>
  );
}

function CardRow({ icon, title, subtitle, tone = 'how' }) {
  const cardStyle = tone === 'perm' ? styles.cardPerm : styles.cardHow;
  return (
    <View style={[styles.cardBase, cardStyle]}>
      <Text style={styles.cardIcon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardSubtitle}>{subtitle}</Text>
      </View>
    </View>
  );
}

export default function OnboardingScreen() {
  const navigation = useNavigation();
  const { userId } = useAuth();
  const [step, setStep] = useState(0);
  const [requesting, setRequesting] = useState(false);
  const [finishingOnboarding, setFinishingOnboarding] = useState(false);
  const [homePin, setHomePin] = useState(null);
  const [savingPin, setSavingPin] = useState(false);

  const content = useMemo(() => {
    if (step === 0) {
      return (
        <>
          <View style={styles.glow} />
          <View style={styles.centerBlock}>
            <Text style={styles.brand}>DOMINIA</Text>
            <Text style={styles.tagline}>WALK · CLAIM · CONQUER · DEFEND</Text>
            <View style={{ marginTop: 16 }}>
              <Text style={styles.body}>Your city is the game board.</Text>
              <Text style={styles.body}>Your body is your army.</Text>
            </View>
          </View>
        </>
      );
    }

    if (step === 1) {
      return (
        <View style={styles.stepWrap}>
          <Text style={styles.kicker}>HOW IT WORKS</Text>
          <Text style={styles.heading}>Walk to own the city</Text>

          <View style={{ marginTop: 16, width: '100%', gap: 10 }}>
            <CardRow
              icon="🗺️"
              title="Claim territories"
              subtitle="Walk anywhere to cover the territory's perimeter distance to own it"
            />
            <CardRow
              icon="⚔️"
              title="Contest and defend"
              subtitle="Attack enemy territories or defend your own"
            />
            <CardRow icon="🤝" title="Join an alliance" subtitle="Coordinate with others to dominate the map" />
          </View>
        </View>
      );
    }

    if (step === 2) {
      return (
        <View style={styles.stepWrap}>
          <Text style={styles.kicker}>BEFORE WE START</Text>
          <Text style={styles.heading}>We need two things</Text>

          <View style={{ marginTop: 16, width: '100%', gap: 10 }}>
            <CardRow icon="📍" title="Location" subtitle="To show you the map and track your walks" tone="perm" />
            <CardRow icon="👟" title="Step counter" subtitle="To convert your steps into game power" tone="perm" />
          </View>

          <Text style={styles.privacy}>No data is shared. Your location is never visible to other players.</Text>
        </View>
      );
    }

    if (step === 3) {
      return (
        <View style={styles.stepWrap}>
          <Text style={styles.kicker}>ONE MORE STEP</Text>
          <Text style={styles.heading}>Place your home pin</Text>
          <Text style={styles.subheading}>This sets your city.</Text>

          <View style={styles.mapPlaceholder}>
            <MapView
              style={StyleSheet.absoluteFillObject}
              styleURL={StyleURL.Street}
              onPress={(payload) => {
                const c = coordsFromMapPress(payload);
                if (c) setHomePin(c);
              }}
            >
              <Camera zoomLevel={HOME_PIN_ZOOM} centerCoordinate={AMSTERDAM_CENTER} />
              {homePin ? (
                <MarkerView coordinate={homePin} anchor={{ x: 0.5, y: 1 }}>
                  <Text style={styles.pinEmoji}>📍</Text>
                </MarkerView>
              ) : null}
            </MapView>
            {!homePin ? (
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  bottom: 16,
                  alignItems: 'center',
                }}
              >
                <Text style={styles.pinHint}>Tap to place your pin</Text>
              </View>
            ) : null}
          </View>
        </View>
      );
    }

    return (
      <View style={styles.stepWrapCentered}>
        <Text style={styles.flagEmoji}>🏴</Text>
        <Text style={styles.headingCentered}>You're in, Commander</Text>
        <Text style={styles.subCentered}>Amsterdam is waiting. Your first territory won't claim itself.</Text>
      </View>
    );
  }, [step, homePin]);

  const buttonLabel =
    step === 0
      ? 'Get started'
      : step === 1
        ? 'Next'
        : step === 2
          ? 'Grant access'
          : step === 3
            ? 'Confirm pin'
            : 'Enter the map';

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
      if (!userId) {
        Alert.alert('Session error', 'You need to be signed in to continue.');
        return;
      }
      setSavingPin(true);
      try {
        const { error } = await supabase
          .from('players')
          .update({ home_pin_lat: homePin[1], home_pin_lng: homePin[0] })
          .eq('clerk_id', userId);
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
      if (!userId) {
        Alert.alert('Session error', 'You need to be signed in to continue.');
        return;
      }
      setFinishingOnboarding(true);
      try {
        const { error } = await supabase
          .from('players')
          .update({ has_onboarded: true })
          .eq('clerk_id', userId);
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

    setStep((s) => Math.min(4, s + 1));
  };

  return (
    <View style={styles.screen}>
      <View style={styles.contentWrap}>{content}</View>

      <View style={styles.bottom}>
        {step >= 1 && step <= 3 ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => setStep((s) => s - 1)}>
            <Text style={{ color: MUTED, fontSize: 14, fontWeight: '700', textAlign: 'center' }}>← Back</Text>
          </Pressable>
        ) : null}
        <Dots step={step} />
        <PrimaryButton
          label={buttonLabel}
          onPress={onNext}
          disabled={
            (step === 2 && requesting) ||
            (step === 3 && (!homePin || savingPin)) ||
            (step === 4 && finishingOnboarding)
          }
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BG,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 18,
  },
  contentWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    alignSelf: 'center',
    top: 120,
    width: 320,
    height: 320,
    borderRadius: 999,
    backgroundColor: 'rgba(237,147,50,0.08)',
  },
  centerBlock: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  brand: {
    color: WHITE,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 1.6,
  },
  tagline: {
    marginTop: 10,
    color: ORANGE,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.4,
    textAlign: 'center',
  },
  body: {
    color: MUTED,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 20,
  },

  stepWrap: {
    width: '100%',
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  stepWrapCentered: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  kicker: {
    color: ORANGE,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  heading: {
    marginTop: 10,
    color: WHITE,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  headingCentered: {
    marginTop: 14,
    color: WHITE,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  subheading: {
    marginTop: 10,
    color: MUTED,
    fontSize: 13,
    fontWeight: '700',
  },
  subCentered: {
    marginTop: 12,
    color: MUTED,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    textAlign: 'center',
  },

  cardBase: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 8,
    padding: 10,
  },
  cardHow: {
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  cardPerm: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  cardIcon: {
    fontSize: 18,
    marginTop: 1,
  },
  cardTitle: {
    color: WHITE,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.1,
  },
  cardSubtitle: {
    marginTop: 6,
    color: MUTED,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
  privacy: {
    marginTop: 12,
    color: '#555',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },

  mapPlaceholder: {
    marginTop: 16,
    width: '100%',
    flex: 1,
    minHeight: 240,
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinEmoji: {
    fontSize: 28,
  },
  pinHint: {
    marginTop: 10,
    color: '#555',
    fontSize: 12,
    fontWeight: '700',
  },

  flagEmoji: {
    fontSize: 44,
  },

  bottom: {
    gap: 12,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  dotActive: {
    backgroundColor: ORANGE,
  },
  dotInactive: {
    backgroundColor: '#333',
  },

  primaryBtn: {
    width: '100%',
    backgroundColor: ORANGE,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: WHITE,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: -0.1,
  },
});

