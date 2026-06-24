import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

const INK = '#0E1014';
const BONE = '#F2EEE6';
const SLATE = '#5C6068';
const SLATE2 = '#8B8F98';
const CLAIM = '#D64525';
const HAIRLINE_STRONG = 'rgba(242,238,230,0.16)';

const INTRO_TAGLINE = 'Walk · Claim · Conquer · Defend';
const INTRO_BODY = 'Your city is the game board.';

function ProgressBar({ step }) {
  return (
    <View style={{ flexDirection: 'row', gap: 4, justifyContent: 'center', marginBottom: 12 }}>
      {Array.from({ length: 2 }).map((_, idx) => (
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

function PrimaryButton({ actionLabel, onPress, disabled }) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        { backgroundColor: CLAIM, paddingVertical: 14, width: '100%', alignItems: 'center' },
        disabled && { opacity: 0.5 },
        pressed && !disabled && { opacity: 0.9 },
      ]}
    >
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

/**
 * Pre-auth welcome: the value pitch shown before we ask for an account. Sells
 * what Dominia is, then routes into sign-up. A persistent "Sign in" shortcut
 * lets returning-but-logged-out players skip straight past the pitch.
 */
export default function WelcomeScreen({ navigation }) {
  const [step, setStep] = useState(0);
  const [displayedTagline, setDisplayedTagline] = useState('');
  const [displayedBody, setDisplayedBody] = useState('');

  const buttonTranslateY = useRef(new Animated.Value(60)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;
  const introTimers = useRef([]);

  const clearIntroTimers = () => {
    introTimers.current.forEach((t) => {
      clearTimeout(t);
      clearInterval(t);
    });
    introTimers.current = [];
  };

  const revealIntroButton = () => {
    Animated.parallel([
      Animated.timing(buttonTranslateY, { toValue: 0, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(buttonOpacity, { toValue: 1, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  };

  // Tap-to-skip: finish the typewriter and reveal the button immediately.
  const skipIntro = () => {
    if (step !== 0) return;
    clearIntroTimers();
    setDisplayedTagline(INTRO_TAGLINE);
    setDisplayedBody(INTRO_BODY);
    revealIntroButton();
  };

  useEffect(() => {
    if (step !== 0) return;
    setDisplayedTagline('');
    setDisplayedBody('');
    buttonOpacity.setValue(0);
    buttonTranslateY.setValue(60);

    let index = 0;
    const interval = setInterval(() => {
      index += 1;
      setDisplayedTagline(INTRO_TAGLINE.slice(0, index));
      if (index >= INTRO_TAGLINE.length) {
        clearInterval(interval);
        const gap = setTimeout(() => {
          let bodyIndex = 0;
          const bodyInterval = setInterval(() => {
            bodyIndex += 1;
            setDisplayedBody(INTRO_BODY.slice(0, bodyIndex));
            if (bodyIndex >= INTRO_BODY.length) {
              clearInterval(bodyInterval);
              revealIntroButton();
            }
          }, 55);
          introTimers.current.push(bodyInterval);
        }, 200);
        introTimers.current.push(gap);
      }
    }, 55);
    introTimers.current.push(interval);

    return () => clearIntroTimers();
  }, [step]);

  const onPrimary = () => {
    if (step === 0) {
      setStep(1);
      return;
    }
    navigation.replace('SignIn', { mode: 'signup' });
  };

  return (
    <View style={{ flex: 1, backgroundColor: INK, paddingHorizontal: 18, paddingTop: 48, paddingBottom: 24 }}>
      {step === 0 ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Skip intro" onPress={skipIntro} style={{ flex: 1, justifyContent: 'center' }}>
          <View style={{ paddingHorizontal: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
              <Text style={{ fontFamily: 'Archivo_900Black', fontSize: 34, color: BONE, letterSpacing: 0.7, textTransform: 'uppercase' }}>
                DOMINIA
              </Text>
              <Text style={{ fontFamily: 'Archivo_900Black', fontSize: 11, color: CLAIM, marginLeft: 4, marginBottom: 6 }}>▪</Text>
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
                {displayedTagline}
              </Text>
              <View style={{ flex: 1, height: 0.5, backgroundColor: HAIRLINE_STRONG }} />
            </View>
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 16, color: BONE, lineHeight: 24 }}>{displayedBody}</Text>
          </View>
        </Pressable>
      ) : (
        <View style={{ flex: 1, justifyContent: 'center' }}>
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
          <NumberedRow num="01" title="Claim territories" subtitle="Walk a territory's perimeter distance — from anywhere — to own it." />
          <NumberedRow num="02" title="Contest and defend" subtitle="Attack enemy ground. Hold your own when it comes under fire." />
          <NumberedRow num="03" title="Join an alliance" subtitle="Coordinate with 19 others to hold your city." last />
        </View>
      )}

      <View style={{ gap: 10 }}>
        {step === 1 ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => setStep(0)}>
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
            <PrimaryButton actionLabel="Begin →" onPress={onPrimary} disabled={false} />
          </Animated.View>
        ) : (
          <PrimaryButton actionLabel="Get started →" onPress={onPrimary} disabled={false} />
        )}
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.replace('SignIn', { mode: 'signin' })}
          style={{ paddingVertical: 6 }}
        >
          <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 13, color: SLATE2, textAlign: 'center' }}>
            Already have an account? <Text style={{ color: BONE }}>Sign in</Text>
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
