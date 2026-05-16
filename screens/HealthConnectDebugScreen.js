import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '@clerk/clerk-expo';
import {
  initialize,
  getSdkStatus,
  requestPermission,
  getGrantedPermissions,
  readRecords,
  SdkAvailabilityStatus,
} from 'react-native-health-connect';
import { supabase } from '../lib/supabase';
import { logDebug } from '../lib/debug';
import { colors, spacing, text } from '../lib/theme';

const CLAIM = colors.claim;
const INK = colors.ink;
const BONE = colors.bone;
const SLATE2 = colors.slate2;
const HAIRLINE = colors.hairline;
const HAIRLINE_STRONG = colors.hairlineStrong;
const ERROR_RED = '#E05A5A';

const STEPS_READ_PERM = { accessType: 'read', recordType: 'Steps' };

const SDK_STATUS_NAMES = {
  [SdkAvailabilityStatus.SDK_AVAILABLE]: 'SDK_AVAILABLE',
  [SdkAvailabilityStatus.SDK_UNAVAILABLE]: 'SDK_UNAVAILABLE',
  [SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED]:
    'SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED',
};

function sdkStatusLabel(status) {
  if (status == null) return '—';
  return SDK_STATUS_NAMES[status] ?? String(status);
}

function isBackgroundPermission(p) {
  return p?.background === true || p?.backgroundRead === true || p?.isBackground === true;
}

function hasStepsRead(granted) {
  return (granted ?? []).some(
    (p) => p.recordType === 'Steps' && p.accessType === 'read' && !isBackgroundPermission(p),
  );
}

function hasStepsBackgroundRead(granted) {
  return (granted ?? []).some(
    (p) => p.recordType === 'Steps' && p.accessType === 'read' && isBackgroundPermission(p),
  );
}

function startOfLocalDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function formatDayRow(date) {
  return date.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

function localDayKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function sumRecordCounts(records) {
  return (records ?? []).reduce((sum, r) => sum + (Number(r?.count) || 0), 0);
}

function sourceNamesFromRecords(records) {
  const names = new Set();
  for (const r of records ?? []) {
    const pkg =
      r?.metadata?.dataOrigin?.packageName ??
      r?.metadata?.clientRecordId ??
      r?.metadata?.device?.manufacturer;
    if (pkg) names.add(String(pkg));
  }
  return [...names];
}

function groupStepsByLocalDay(records) {
  const buckets = {};
  for (const r of records ?? []) {
    const t = r?.startTime ?? r?.endTime;
    if (!t) continue;
    const key = localDayKey(new Date(t));
    buckets[key] = (buckets[key] || 0) + (Number(r?.count) || 0);
  }
  return buckets;
}

function SectionLabel({ label }) {
  return (
    <View style={styles.sectionLabelRow}>
      <Text style={styles.sectionLabelText}>{label}</Text>
      <View style={styles.sectionLabelLine} />
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
        styles.primaryBtn,
        disabled && styles.primaryBtnDisabled,
        pressed && !disabled && { opacity: 0.9 },
      ]}
    >
      {stepLabel ? <Text style={styles.primaryBtnStep}>{stepLabel}</Text> : null}
      <Text style={styles.primaryBtnAction}>{actionLabel}</Text>
    </Pressable>
  );
}

function ErrorBlock({ message }) {
  if (!message) return null;
  return (
    <View style={styles.errorBlock}>
      <Text style={styles.errorBlockText}>{message}</Text>
    </View>
  );
}

export default function HealthConnectDebugScreen() {
  const navigation = useNavigation();
  const { userId } = useAuth();

  const [playerId, setPlayerId] = useState(null);
  const [hcReady, setHcReady] = useState(false);
  const [initMessage, setInitMessage] = useState(null);

  const [sdkStatus, setSdkStatus] = useState(null);
  const [sdkError, setSdkError] = useState(null);

  const [granted, setGranted] = useState([]);
  const [permError, setPermError] = useState(null);
  const [requestingPerm, setRequestingPerm] = useState(false);

  const [todaySteps, setTodaySteps] = useState(0);
  const [todaySources, setTodaySources] = useState([]);
  const [rawResponse, setRawResponse] = useState(null);
  const [todayError, setTodayError] = useState(null);
  const [refreshingToday, setRefreshingToday] = useState(false);

  const [sevenDayRows, setSevenDayRows] = useState([]);
  const [sevenDayError, setSevenDayError] = useState(null);

  const [logConfirm, setLogConfirm] = useState(null);
  const [logging, setLogging] = useState(false);

  const buttonsDisabled = !hcReady;

  const reportError = useCallback(
    async (where, err) => {
      const msg = err?.message ?? String(err);
      if (playerId) {
        await logDebug(playerId, 'error', { where, msg });
      }
      return msg;
    },
    [playerId],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadPlayer() {
      if (!userId) {
        setPlayerId(null);
        return;
      }
      const { data: player } = await supabase
        .from('players')
        .select('id')
        .eq('clerk_id', userId)
        .maybeSingle();
      if (!cancelled) setPlayerId(player?.id ?? null);
    }

    loadPlayer();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const refreshGranted = useCallback(async () => {
    if (!hcReady) return;
    setPermError(null);
    try {
      const list = await getGrantedPermissions();
      setGranted(Array.isArray(list) ? list : []);
    } catch (e) {
      const msg = await reportError('HealthConnectDebug.permissions', e);
      setPermError(msg);
    }
  }, [hcReady, reportError]);

  const loadTodaySteps = useCallback(async () => {
    if (!hcReady) return;
    setRefreshingToday(true);
    setTodayError(null);
    try {
      const start = startOfLocalDay();
      const end = new Date();
      const result = await readRecords('Steps', {
        timeRangeFilter: {
          operator: 'between',
          startTime: start.toISOString(),
          endTime: end.toISOString(),
        },
      });
      const records = result?.records ?? [];
      setTodaySteps(sumRecordCounts(records));
      setTodaySources(sourceNamesFromRecords(records));
      setRawResponse(result);
    } catch (e) {
      const msg = await reportError('HealthConnectDebug.todaySteps', e);
      setTodayError(msg);
    } finally {
      setRefreshingToday(false);
    }
  }, [hcReady, reportError]);

  const loadSevenDays = useCallback(async () => {
    if (!hcReady) return;
    setSevenDayError(null);
    try {
      const end = new Date();
      const start = startOfLocalDay();
      start.setDate(start.getDate() - 6);

      const result = await readRecords('Steps', {
        timeRangeFilter: {
          operator: 'between',
          startTime: start.toISOString(),
          endTime: end.toISOString(),
        },
      });
      const buckets = groupStepsByLocalDay(result?.records ?? []);
      const rows = [];
      for (let i = 6; i >= 0; i -= 1) {
        const day = startOfLocalDay();
        day.setDate(day.getDate() - i);
        const key = localDayKey(day);
        const count = buckets[key] ?? 0;
        rows.push({
          key,
          label: formatDayRow(day),
          count,
        });
      }
      setSevenDayRows(rows);
    } catch (e) {
      const msg = await reportError('HealthConnectDebug.sevenDays', e);
      setSevenDayError(msg);
    }
  }, [hcReady, reportError]);

  const refreshSdkStatus = useCallback(async () => {
    if (!hcReady) return;
    setSdkError(null);
    try {
      const status = await getSdkStatus();
      setSdkStatus(status);
    } catch (e) {
      const msg = await reportError('HealthConnectDebug.sdkStatus', e);
      setSdkError(msg);
    }
  }, [hcReady, reportError]);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      setInitMessage(null);
      setHcReady(false);
      try {
        const ok = await initialize();
        if (cancelled) return;
        if (!ok) {
          setInitMessage('Health Connect not available on this device');
          return;
        }
        setHcReady(true);
      } catch (e) {
        if (cancelled) return;
        const msg = await reportError('HealthConnectDebug.initialize', e);
        setInitMessage(msg || 'Health Connect not available on this device');
      }
    }

    boot();
    return () => {
      cancelled = true;
    };
  }, [reportError]);

  useEffect(() => {
    if (!hcReady) return;
    refreshSdkStatus();
    refreshGranted();
    loadTodaySteps();
    loadSevenDays();
  }, [hcReady, refreshSdkStatus, refreshGranted, loadTodaySteps, loadSevenDays]);

  async function handleRequestPermissions() {
    if (buttonsDisabled) return;
    setRequestingPerm(true);
    setPermError(null);
    try {
      await requestPermission([STEPS_READ_PERM]);
      await refreshGranted();
    } catch (e) {
      const msg = await reportError('HealthConnectDebug.requestPermission', e);
      setPermError(msg);
    } finally {
      setRequestingPerm(false);
    }
  }

  async function handleLogToSupabase() {
    if (!playerId) {
      setLogConfirm('No player_id — sign in first');
      return;
    }
    setLogging(true);
    setLogConfirm(null);
    try {
      const records = rawResponse?.records ?? [];
      await logDebug(playerId, 'health_connect_snapshot', {
        sdkStatus: sdkStatusLabel(sdkStatus),
        permissionsGranted: granted,
        todaySteps,
        sevenDayBreakdown: sevenDayRows.map((row) => ({
          day: row.label,
          steps: row.count,
        })),
        rawResponseSample: records[0] ?? null,
      });
      setLogConfirm('Logged to debug_events');
    } catch (e) {
      const msg = await reportError('HealthConnectDebug.logSnapshot', e);
      setLogConfirm(msg);
    } finally {
      setLogging(false);
    }
  }

  const sdkAvailable = sdkStatus === SdkAvailabilityStatus.SDK_AVAILABLE;
  const statusColor = sdkAvailable ? colors.alliance : ERROR_RED;

  return (
    <View style={styles.screen}>
      <View style={styles.headerBlock}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← BACK</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Health Connect Debug</Text>
        <View style={styles.hairlineStrong} />
      </View>

      {initMessage ? (
        <View style={styles.unavailableBanner}>
          <Text style={styles.unavailableText}>{initMessage}</Text>
        </View>
      ) : null}

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
        {!hcReady && !initMessage ? (
          <View style={styles.loadingBlock}>
            <ActivityIndicator size="large" color={SLATE2} />
            <Text style={styles.loadingText}>Initializing Health Connect…</Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <SectionLabel label="SDK STATUS" />
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={styles.monoLine}>
              SDK Status: {sdkStatusLabel(sdkStatus)}
            </Text>
          </View>
          <ErrorBlock message={sdkError} />
        </View>

        <View style={styles.section}>
          <SectionLabel label="PERMISSIONS" />
          <Text style={styles.permLine}>
            Steps (read){' '}
            {hasStepsRead(granted) ? (
              <Text style={styles.granted}>✓ granted</Text>
            ) : (
              <Text style={styles.denied}>✗ not granted</Text>
            )}
          </Text>
          <Text style={styles.permLine}>
            Steps (background read){' '}
            {hasStepsBackgroundRead(granted) ? (
              <Text style={styles.granted}>✓ granted</Text>
            ) : (
              <Text style={styles.denied}>✗ not granted</Text>
            )}
          </Text>
          <ErrorBlock message={permError} />
          <PrimaryButton
            stepLabel="HEALTH CONNECT"
            actionLabel={requestingPerm ? 'Requesting…' : 'Request Permissions'}
            onPress={handleRequestPermissions}
            disabled={buttonsDisabled || requestingPerm}
          />
        </View>

        <View style={styles.section}>
          <SectionLabel label="TODAY'S STEPS" />
          <Text style={styles.bigSteps}>{todaySteps.toLocaleString()}</Text>
          <Text style={styles.subtext}>
            from {todaySources.length} source{todaySources.length === 1 ? '' : 's'}
            {todaySources.length > 0 ? `: ${todaySources.join(', ')}` : ''}
          </Text>
          <ErrorBlock message={todayError} />
          <PrimaryButton
            stepLabel="STEPS"
            actionLabel={refreshingToday ? 'Refreshing…' : 'Refresh'}
            onPress={loadTodaySteps}
            disabled={buttonsDisabled || refreshingToday}
          />
          <ScrollView style={styles.rawBox} nestedScrollEnabled>
            <Text style={styles.rawText}>
              {rawResponse != null ? JSON.stringify(rawResponse, null, 2) : '—'}
            </Text>
          </ScrollView>
        </View>

        <View style={styles.section}>
          <SectionLabel label="LAST 7 DAYS" />
          {sevenDayRows.map((row) => (
            <Text key={row.key} style={styles.dayRow}>
              {row.label} — {row.count.toLocaleString()} steps
            </Text>
          ))}
          <ErrorBlock message={sevenDayError} />
        </View>

        <View style={styles.section}>
          <PrimaryButton
            stepLabel="DEBUG"
            actionLabel={logging ? 'Logging…' : 'Log to Supabase'}
            onPress={handleLogToSupabase}
            disabled={buttonsDisabled || logging}
          />
          {logConfirm ? <Text style={styles.logConfirm}>{logConfirm}</Text> : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: INK,
  },
  headerBlock: {
    paddingTop: (StatusBar.currentHeight ?? 0) + 12,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  backBtn: {
    marginBottom: spacing.sm,
  },
  backBtnText: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 9,
    letterSpacing: 1.6,
    color: SLATE2,
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontFamily: 'Archivo_900Black',
    fontSize: 28,
    color: BONE,
    textTransform: 'uppercase',
    letterSpacing: -0.02,
  },
  hairlineStrong: {
    marginTop: spacing.md,
    height: 1,
    backgroundColor: HAIRLINE_STRONG,
  },
  unavailableBanner: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: HAIRLINE_STRONG,
  },
  unavailableText: {
    ...text.body,
    fontSize: 13,
    color: ERROR_RED,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl3,
    gap: spacing.xl,
  },
  loadingBlock: {
    alignItems: 'center',
    paddingVertical: spacing.xl2,
    gap: spacing.md,
  },
  loadingText: {
    ...text.mono,
    fontSize: 11,
    color: SLATE2,
  },
  section: {
    gap: spacing.sm,
  },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  sectionLabelText: {
    ...text.sectionLabel,
    fontSize: 9,
    letterSpacing: 1.6,
    flexShrink: 0,
  },
  sectionLabelLine: {
    flex: 1,
    height: 0.5,
    backgroundColor: HAIRLINE_STRONG,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 0,
  },
  monoLine: {
    ...text.mono,
    fontSize: 12,
  },
  permLine: {
    ...text.body,
    fontSize: 13,
  },
  granted: {
    color: colors.alliance,
  },
  denied: {
    color: ERROR_RED,
  },
  bigSteps: {
    fontFamily: 'Archivo_700Bold',
    fontSize: 48,
    color: BONE,
    letterSpacing: -0.02,
  },
  subtext: {
    ...text.mono,
    fontSize: 10,
    color: SLATE2,
  },
  rawBox: {
    marginTop: spacing.sm,
    maxHeight: 160,
    borderWidth: 1,
    borderColor: HAIRLINE,
    padding: spacing.sm,
  },
  rawText: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 9,
    color: SLATE2,
  },
  dayRow: {
    ...text.mono,
    fontSize: 12,
    paddingVertical: spacing.xs,
    borderBottomWidth: 0.5,
    borderBottomColor: HAIRLINE,
  },
  primaryBtn: {
    marginTop: spacing.sm,
    backgroundColor: CLAIM,
    paddingVertical: 14,
    width: '100%',
    alignItems: 'center',
  },
  primaryBtnDisabled: {
    opacity: 0.5,
  },
  primaryBtnStep: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 9,
    letterSpacing: 1.6,
    color: 'rgba(242,238,230,0.75)',
    textTransform: 'uppercase',
  },
  primaryBtnAction: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 14,
    letterSpacing: 2.4,
    color: BONE,
    textTransform: 'uppercase',
  },
  errorBlock: {
    marginTop: spacing.xs,
    padding: spacing.sm,
    borderWidth: 0.5,
    borderColor: ERROR_RED,
  },
  errorBlockText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: ERROR_RED,
  },
  logConfirm: {
    ...text.mono,
    fontSize: 11,
    color: colors.alliance,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
});
