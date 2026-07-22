import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { fetchLegacyMedals } from '../../lib/legacyMedalsApi';
import {
  CATEGORY_ORDER,
  MEDAL_UNIT,
  TIER_ORDER,
  medalsForCategory,
  categoryEarnedCount,
  earnedCount,
  isMedalEarned,
} from '../../lib/legacyMedals';
import MedalIcon from './MedalIcon';
import TierBars from './TierBars';

const INK = '#0E1014';
const INK2 = '#1A1D24';
const BONE = '#F2EEE6';
const BONE_DIM = 'rgba(242,238,230,0.45)';
const HAIRLINE = 'rgba(242,238,230,0.16)'; // hairline-strong token (tile/cell borders)

function fmtNum(n) {
  if (n == null) return '';
  const v = Number(n);
  return Number.isInteger(v) ? String(v) : v.toFixed(v < 100 ? 1 : 0);
}
function fmtDate(iso) {
  return iso ? String(iso).slice(0, 10) : null;
}

function CurrentLine({ medal }) {
  const { t } = useTranslation();
  // Only medals that actually carry a unit have a medalUnit.* translation;
  // gate on the catalog so unitless medals (e.g. combat.conqueror) render no
  // suffix. (A bare defaultValue:'' would leak the raw key here because the
  // i18n config sets returnEmptyString:false.)
  const unit = MEDAL_UNIT[medal.key] ? t(`medalUnit.${medal.key}`) : '';
  if (medal.type === 'tiered') {
    const next =
      medal.nextTierThreshold != null
        ? `${fmtNum(medal.currentValue)}${unit} / ${fmtNum(medal.nextTierThreshold)}${unit}`
        : t('medalsSection.maxLine', { current: `${fmtNum(medal.currentValue)}${unit}` });
    return <Text style={styles.detailValue}>{next}</Text>;
  }
  if (medal.type === 'singular_count') {
    return <Text style={styles.detailValue}>{t('medal.countX', { count: medal.count ?? 0 })}</Text>;
  }
  return (
    <Text style={styles.detailValue}>
      {medal.earned ? t('medal.earnedYear', { year: medal.earnedYear }) : t('medalsSection.notYetEarned')}
    </Text>
  );
}

function MedalDetailModal({ medal, onClose }) {
  const { t } = useTranslation();
  if (!medal) return null;
  const earned = isMedalEarned(medal);
  const tierLabel =
    medal.type === 'tiered' && medal.currentTier
      ? t(`tierLabel.${medal.currentTier}`)
      : null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={() => {}}>
          <View style={styles.detailIconWrap}>
            <MedalIcon medal={medal} size={120} earned={earned} />
          </View>
          <Text style={styles.detailName}>{t(`medalName.${medal.key}`)}</Text>
          {tierLabel ? <Text style={styles.detailTier}>{tierLabel}</Text> : null}
          <View style={{ marginTop: 10 }}>
            <TierBars medal={medal} height={8} />
          </View>
          <CurrentLine medal={medal} />
          <Text style={styles.detailCondition}>{t(`medalCondition.${medal.key}`)}</Text>

          {medal.type === 'tiered' && medal.tierEarnedAt ? (
            <View style={styles.tierDates}>
              {TIER_ORDER.map((tier) => {
                const at = fmtDate(medal.tierEarnedAt[tier]);
                if (!at) return null;
                return (
                  <Text key={tier} style={styles.tierDateRow}>
                    {`${t(`tierLabel.${tier}`)}  ✓  ${at}`}
                  </Text>
                );
              })}
            </View>
          ) : null}

          <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={8}>
            <Text style={styles.closeText}>{t('medalsSection.close')}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function CategoryTile({ category, medals, active, onPress }) {
  const { t } = useTranslation();
  const items = medalsForCategory(medals, category);
  const earned = categoryEarnedCount(medals, category);
  return (
    <Pressable
      style={[styles.tile, active ? styles.tileActive : null]}
      onPress={onPress}
    >
      <View style={styles.tileHeader}>
        <Text style={styles.tileLabel}>{t(`categoryLabel.${category}`)}</Text>
        <Text style={styles.tileCount}>{`${earned}/4`}</Text>
      </View>
      <View style={styles.tileIcons}>
        {items.map((m) => (
          <MedalIcon key={m.key} medal={m} size={30} earned={isMedalEarned(m)} />
        ))}
      </View>
    </Pressable>
  );
}

function MedalCell({ medal, onPress }) {
  const { t } = useTranslation();
  const earned = isMedalEarned(medal);
  return (
    <Pressable style={styles.cell} onPress={onPress}>
      <MedalIcon medal={medal} size={62} earned={earned} />
      <Text style={[styles.cellName, !earned && styles.cellNameDim]} numberOfLines={1}>
        {t(`medalName.${medal.key}`)}
      </Text>
      <View style={{ marginTop: 4 }}>
        <TierBars medal={medal} />
      </View>
    </Pressable>
  );
}

/**
 * Legacy Medals profile section: category summary row -> tap a category to see
 * its 2x2 medal grid -> tap a medal for its detail card. Fetches the player's
 * medal state from the backend (self by default; pass playerId to view another).
 *
 * focusMedalKey (deep-link from a medal push): once the state loads, open that
 * medal's category and detail modal, then report consumption via
 * onFocusConsumed so re-renders and later visits never replay it.
 */
export default function LegacyMedalsSection({ clerkGetToken, playerId, focusMedalKey = null, onFocusConsumed }) {
  const { t } = useTranslation();
  const [state, setState] = useState({ loading: true, error: null, medals: null });
  const [activeCategory, setActiveCategory] = useState(null);
  const [detailMedal, setDetailMedal] = useState(null);
  const focusConsumedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetchLegacyMedals({ clerkGetToken, playerId });
      if (cancelled) return;
      if (res.ok) {
        setState({ loading: false, error: null, medals: res.data.medals });
      } else {
        setState({ loading: false, error: res.error, medals: null });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clerkGetToken, playerId]);

  const { loading, error, medals } = state;

  useEffect(() => {
    if (!focusMedalKey) {
      // Param cleared by the parent — re-arm for the next deep-link.
      focusConsumedRef.current = false;
      return;
    }
    if (!medals || focusConsumedRef.current) return;
    focusConsumedRef.current = true;
    const medal = medals.find((m) => m.key === focusMedalKey);
    if (medal) {
      setActiveCategory(medal.category);
      setDetailMedal(medal);
    }
    onFocusConsumed?.();
  }, [focusMedalKey, medals, onFocusConsumed]);

  return (
    <View>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('medalsSection.title')}</Text>
        <Text style={styles.headerCount}>
          {medals ? `${earnedCount(medals)}/16` : '—'}
        </Text>
      </View>
      <Text style={styles.headerSub}>{t('medalsSection.subtitle')}</Text>

      {loading ? (
        <View style={styles.stateBox}>
          <ActivityIndicator color={BONE_DIM} />
        </View>
      ) : error ? (
        <View style={styles.stateBox}>
          <Text style={styles.stateText}>{t('medalsSection.couldNotLoad')}</Text>
        </View>
      ) : (
        <>
          <View style={styles.tileGrid}>
            {CATEGORY_ORDER.map((cat) => (
              <CategoryTile
                key={cat}
                category={cat}
                medals={medals}
                active={activeCategory === cat}
                onPress={() =>
                  setActiveCategory((c) => (c === cat ? null : cat))
                }
              />
            ))}
          </View>

          {activeCategory ? (
            <View style={styles.grid}>
              {medalsForCategory(medals, activeCategory).map((m) => (
                <MedalCell key={m.key} medal={m} onPress={() => setDetailMedal(m)} />
              ))}
            </View>
          ) : null}
        </>
      )}

      <MedalDetailModal medal={detailMedal} onClose={() => setDetailMedal(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  headerTitle: {
    fontFamily: 'Archivo_900Black',
    fontSize: 18,
    color: BONE,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  headerCount: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 14,
    color: BONE,
  },
  headerSub: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 9,
    color: BONE_DIM,
    letterSpacing: 1,
    marginTop: 2,
  },
  stateBox: { paddingVertical: 24, alignItems: 'center' },
  stateText: { fontFamily: 'GeistMono_400Regular', fontSize: 12, color: BONE_DIM },
  tileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  tile: {
    width: '48.5%',
    backgroundColor: INK2,
    borderRadius: 0,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: HAIRLINE,
    padding: 12,
    marginBottom: 10,
  },
  tileActive: { borderColor: 'rgba(242,238,230,0.4)' },
  tileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tileLabel: {
    fontFamily: 'Archivo_700Bold',
    fontSize: 11,
    color: BONE,
    letterSpacing: 0.5,
  },
  tileCount: { fontFamily: 'GeistMono_400Regular', fontSize: 10, color: BONE_DIM },
  tileIcons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 4,
    marginBottom: 4,
  },
  cell: {
    width: '48.5%',
    backgroundColor: INK2,
    borderRadius: 0,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: HAIRLINE,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  cellName: {
    fontFamily: 'Archivo_700Bold',
    fontSize: 11,
    color: BONE,
    letterSpacing: 0.3,
    marginTop: 8,
  },
  cellNameDim: { color: BONE_DIM },
  modalBackdrop: {
    flex: 1,
    // Ink scrim, never pure black (Flat Doctrine / no pure #000).
    backgroundColor: 'rgba(14,16,20,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: INK,
    borderRadius: 0,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(242,238,230,0.16)',
    padding: 24,
    alignItems: 'center',
  },
  detailIconWrap: { marginBottom: 12 },
  detailName: {
    fontFamily: 'Archivo_900Black',
    fontSize: 22,
    color: BONE,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  detailTier: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 12,
    color: BONE_DIM,
    letterSpacing: 1,
    marginTop: 2,
  },
  detailValue: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 14,
    color: BONE,
    marginTop: 12,
  },
  detailCondition: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: BONE_DIM,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 17,
  },
  tierDates: {
    alignSelf: 'stretch',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: HAIRLINE,
  },
  tierDateRow: {
    fontFamily: 'GeistMono_400Regular',
    fontSize: 11,
    color: BONE_DIM,
    marginBottom: 4,
  },
  closeBtn: { marginTop: 18, paddingVertical: 8, paddingHorizontal: 24 },
  closeText: {
    fontFamily: 'GeistMono_500Medium',
    fontSize: 12,
    color: BONE,
    letterSpacing: 1.5,
  },
});
