import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as Location from 'expo-location';
import { supabase } from '../lib/supabase';

const DEV_MODE = true;

const INK = '#0E1014';
const INK2 = '#1A1D24';
const INK3 = '#252932';
const BONE = '#F2EEE6';
const SLATE = '#5C6068';
const SLATE2 = '#8B8F98';
const CLAIM = '#D64525';
const CLAIM_SOFT = 'rgba(214,69,37,0.14)';
const HAIRLINE_STRONG = 'rgba(242,238,230,0.16)';

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
  const attackerAllianceRef = useRef(null);

  useEffect(() => {
    navigation.setOptions?.({
      headerShown: false,
      tabBarStyle: { display: 'none' },
    });
  }, [navigation]);

  useEffect(() => {
    if (mode !== 'contest' || !territoryId || !playerId) return;

    // fetch opponent name from territory
    supabase
      .from('territories')
      .select('players(username)')
      .eq('id', territoryId)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.players?.username) opponentNameRef.current = data.players.username;
      });

    // fetch attacker's alliance_id
    supabase
      .from('players')
      .select('alliance_id')
      .eq('id', playerId)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.alliance_id) attackerAllianceRef.current = data.alliance_id;
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
                attackerAlliance: attackerAllianceRef.current,
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
                    attackerAlliance: attackerAllianceRef.current,
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
              stroke={INK3}
              strokeWidth={ring.strokeWidth}
              fill="none"
            />
            <AnimatedCircle
              cx={ring.cx}
              cy={ring.cy}
              r={ring.radius}
              stroke={CLAIM}
              strokeWidth={ring.strokeWidth}
              fill="none"
              strokeLinecap="butt"
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
    backgroundColor: INK,
    paddingHorizontal: 18,
    paddingTop: 48,
    paddingBottom: 24,
  },

  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },

  claimingLabel: {
    fontFamily: 'GeistMono_400Regular',
    color: SLATE2,
    fontSize: 9,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    marginBottom: 6,
  },

  territoryName: {
    fontFamily: 'Archivo_900Black',
    color: BONE,
    fontSize: 24,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    lineHeight: 28,
  },

  badge: {
    marginTop: 4,
    backgroundColor: CLAIM_SOFT,
    borderColor: HAIRLINE_STRONG,
    borderWidth: 1,
    borderRadius: 0,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },

  badgeText: {
    fontFamily: 'GeistMono_500Medium',
    color: CLAIM,
    fontSize: 9,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },

  ringWrap: {
    marginTop: 32,
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
    fontFamily: 'Archivo_700Bold',
    color: BONE,
    fontSize: 48,
    letterSpacing: -1,
  },

  completeText: {
    fontFamily: 'GeistMono_400Regular',
    color: SLATE2,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    marginTop: 4,
  },

  cardsRow: {
    marginTop: 28,
    flexDirection: 'row',
    gap: 12,
  },

  card: {
    flex: 1,
    backgroundColor: INK2,
    borderWidth: 1,
    borderColor: HAIRLINE_STRONG,
    borderRadius: 0,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },

  cardLabel: {
    fontFamily: 'GeistMono_400Regular',
    color: SLATE2,
    fontSize: 9,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },

  cardValue: {
    fontFamily: 'GeistMono_500Medium',
    color: BONE,
    fontSize: 22,
    letterSpacing: -0.2,
    marginTop: 8,
  },

  cardSub: {
    fontFamily: 'GeistMono_400Regular',
    color: SLATE2,
    fontSize: 10,
    letterSpacing: 0.5,
    marginTop: 4,
  },

  helper: {
    fontFamily: 'Inter_400Regular',
    marginTop: 20,
    color: SLATE2,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    paddingHorizontal: 16,
  },

  cancelBtn: {
    backgroundColor: INK2,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: HAIRLINE_STRONG,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  cancelText: {
    fontFamily: 'GeistMono_400Regular',
    color: SLATE2,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
});

