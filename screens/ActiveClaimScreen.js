import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as Location from 'expo-location';
import { supabase } from '../lib/supabase';

const DEV_MODE = true;

const BG = '#0f0f14';
const CARD = '#1a1a24';
const RING_BG = '#1e1e2a';
const ORANGE = '#ff6e3c';
const WHITE = '#ffffff';
const MUTED = '#8b8b9a';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function formatMeters(m) {
  const v = Math.max(0, Math.round(m));
  return `${v}m`;
}

function formatKm(km) {
  if (!Number.isFinite(km)) return '0km';
  const v = km >= 10 ? km.toFixed(0) : km.toFixed(2);
  return `${v}km`;
}

export default function ActiveClaimScreen() {
  const navigation = useNavigation();
  const route = useRoute();

  const { territoryName = 'Territory', perimeterDistance = 0, territoryId, playerId, mode = 'claim' } = route?.params ?? {};
  const perimeterM = Math.max(0, Number(perimeterDistance) || 0);

  const [pct, setPct] = useState(0);
  const progress = useRef(new Animated.Value(0)).current; // 0..1
  const intervalRef = useRef(null);
  const navigatingRef = useRef(false);
  const walkedMetresRef = useRef(0);
  const lastCoordRef = useRef(null);
  const locationWatchRef = useRef(null);
  const opponentNameRef = useRef('opponent');

  useEffect(() => {
    navigation.setOptions?.({
      headerShown: false,
      tabBarStyle: { display: 'none' },
    });
  }, [navigation]);

  useEffect(() => {
    if (mode !== 'contest' || !territoryId) return;
    supabase
      .from('territories')
      .select('players(username)')
      .eq('id', territoryId)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.players?.username) opponentNameRef.current = data.players.username;
      });
  }, []);

  const ring = useMemo(() => {
    const size = 230;
    const strokeWidth = 16;
    const radius = (size - strokeWidth) / 2;
    const cx = size / 2;
    const cy = size / 2;
    const circumference = 2 * Math.PI * radius;
    return { size, strokeWidth, radius, cx, cy, circumference };
  }, []);

  const strokeDashoffset = useMemo(() => {
    return progress.interpolate({
      inputRange: [0, 1],
      outputRange: [ring.circumference, 0],
    });
  }, [progress, ring.circumference]);

  const walkedM = useMemo(() => Math.round((perimeterM * pct) / 100), [perimeterM, pct]);
  const totalKm = useMemo(() => perimeterM / 1000, [perimeterM]);

  const estTotalMin = useMemo(() => {
    // Assumption: ~75m/min walking pace for a smooth UX.
    return Math.max(1, Math.ceil(perimeterM / 75));
  }, [perimeterM]);

  const estRemainingMin = useMemo(() => {
    const remainingM = Math.max(0, perimeterM - walkedM);
    const mins = Math.ceil(remainingM / 75);
    return clamp(mins, 0, estTotalMin);
  }, [perimeterM, walkedM, estTotalMin]);

  useEffect(() => {
    if (!DEV_MODE) return;

    const tick = () => {
      setPct((prev) => {
        const inc = 2 + Math.floor(Math.random() * 4); // 2..5
        const next = clamp(prev + inc, 0, 100);

        Animated.timing(progress, {
          toValue: next / 100,
          duration: 900,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();

        if (next >= 100 && !navigatingRef.current) {
          navigatingRef.current = true;
          if (intervalRef.current) clearInterval(intervalRef.current);
          setTimeout(() => {
            if (mode === 'contest') {
              navigation.navigate('ContestResultScreen', {
                contestState: 'attack_won',
                territoryName,
                territoryId,
                playerId,
                myDistance: perimeterM,
                opponentDistance: 0,
                opponentName: opponentNameRef.current,
              });
            } else {
              navigation.navigate('ClaimSuccessScreen', {
                territoryName,
                perimeterDistance: perimeterM,
                territoryId,
                playerId,
              });
            }
          }, 1000);
        }

        return next;
      });
    };

    intervalRef.current = setInterval(tick, 3000);
    tick();

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [navigation, perimeterM, perimeterDistance, progress, territoryId, territoryName]);

  useEffect(() => {
    if (DEV_MODE) return;

    walkedMetresRef.current = 0;
    lastCoordRef.current = null;

    let cancelled = false;

    (async () => {
      try {
        locationWatchRef.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            distanceInterval: 5,
          },
          (loc) => {
            const { latitude, longitude } = loc.coords ?? {};
            if (latitude == null || longitude == null) return;

            const prev = lastCoordRef.current;
            if (prev) {
              walkedMetresRef.current += haversineMeters(prev.latitude, prev.longitude, latitude, longitude);
            }
            lastCoordRef.current = { latitude, longitude };

            const walked = walkedMetresRef.current;
            const nextPct = perimeterM > 0 ? clamp((walked / perimeterM) * 100, 0, 100) : 0;

            setPct(nextPct);
            Animated.timing(progress, {
              toValue: nextPct / 100,
              duration: 900,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }).start();

            if (nextPct >= 100 && !navigatingRef.current) {
              navigatingRef.current = true;
              locationWatchRef.current?.remove();
              locationWatchRef.current = null;
              setTimeout(() => {
                if (mode === 'contest') {
                  navigation.navigate('ContestResultScreen', {
                    contestState: 'attack_won',
                    territoryName,
                    territoryId,
                    playerId,
                    myDistance: Math.round(walkedMetresRef.current),
                    opponentDistance: 0,
                    opponentName: opponentNameRef.current,
                  });
                } else {
                  navigation.navigate('ClaimSuccessScreen', {
                    territoryName,
                    perimeterDistance: perimeterM,
                    territoryId,
                    playerId,
                  });
                }
              }, 1000);
            }
          },
        );
        if (cancelled) {
          locationWatchRef.current?.remove();
          locationWatchRef.current = null;
        }
      } catch (err) {
        console.error('ActiveClaim location watch failed:', err);
      }
    })();

    return () => {
      cancelled = true;
      locationWatchRef.current?.remove();
      locationWatchRef.current = null;
    };
  }, [navigation, perimeterM, progress, territoryId, territoryName]);

  return (
    <View style={styles.screen}>
      <View style={styles.topRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.claimingLabel, { marginTop: 32 }]}>{mode === 'contest' ? 'CONTESTING' : 'CLAIMING'}</Text>
          <Text style={styles.territoryName}>{territoryName}</Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>In Progress</Text>
        </View>
      </View>

      <View style={styles.ringWrap}>
        <View style={styles.ringStack}>
          <Svg width={ring.size} height={ring.size}>
            <Circle
              cx={ring.cx}
              cy={ring.cy}
              r={ring.radius}
              stroke={RING_BG}
              strokeWidth={ring.strokeWidth}
              fill="none"
            />
            <AnimatedCircle
              cx={ring.cx}
              cy={ring.cy}
              r={ring.radius}
              stroke={ORANGE}
              strokeWidth={ring.strokeWidth}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${ring.circumference} ${ring.circumference}`}
              strokeDashoffset={strokeDashoffset}
              rotation="-90"
              originX={ring.cx}
              originY={ring.cy}
            />
          </Svg>

          <View style={styles.ringCenter}>
            <Text style={styles.pctText}>{pct}%</Text>
            <Text style={styles.completeText}>complete</Text>
          </View>
        </View>
      </View>

      <View style={styles.cardsRow}>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>WALKED</Text>
          <Text style={styles.cardValue}>{formatMeters(walkedM)}</Text>
          <Text style={styles.cardSub}>{`of ${formatKm(totalKm)}`}</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>EST. TIME</Text>
          <Text style={styles.cardValue}>{`${estRemainingMin} min`}</Text>
          <Text style={styles.cardSub}>remaining</Text>
        </View>
      </View>

      <Text style={styles.helper}>Keep walking the perimeter to claim this territory</Text>

      <View style={{ flex: 1 }} />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Cancel claim"
        onPress={() => navigation.goBack()}
        style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.85 }]}
      >
        <Text style={styles.cancelText}>Cancel claim</Text>
      </Pressable>
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
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  claimingLabel: {
    color: MUTED,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  territoryName: {
    marginTop: 6,
    color: WHITE,
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  badge: {
    marginTop: 2,
    backgroundColor: 'rgba(255,110,60,0.14)',
    borderColor: 'rgba(255,110,60,0.35)',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  badgeText: {
    color: ORANGE,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: -0.1,
  },
  ringWrap: {
    marginTop: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringStack: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pctText: {
    color: WHITE,
    fontSize: 44,
    fontWeight: '900',
    letterSpacing: -0.6,
  },
  completeText: {
    marginTop: 6,
    color: MUTED,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.1,
  },
  cardsRow: {
    marginTop: 24,
    flexDirection: 'row',
    gap: 12,
  },
  card: {
    flex: 1,
    backgroundColor: CARD,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  cardLabel: {
    color: MUTED,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  cardValue: {
    marginTop: 10,
    color: WHITE,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  cardSub: {
    marginTop: 6,
    color: MUTED,
    fontSize: 12,
    fontWeight: '800',
  },
  helper: {
    marginTop: 18,
    color: MUTED,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  cancelBtn: {
    backgroundColor: CARD,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#333',
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    color: '#ff4d4d',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: -0.1,
  },
});

