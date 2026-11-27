// Component: TerritorySearch — full-width territory search bar under the map
// top bar (Figma parity plan U11). Queries GET /territories/search (backend
// U7) after a short debounce and lists results below the field; picking one
// hands it to onSelect, which flies the camera to its bbox.
// Surface: input per DESIGN.md — Ink 2 fill, hairline border, 0 radius,
// Geist Mono text; focus shifts the border to hairline-strong. States: idle,
// loading, results, empty, error with retry. Updated UX C3 (plan U8): a
// magnifier, lime focus, and rows with an ownership chip (owner_scope) and
// the distance from the home pin (distance_m); either hides when absent.
// Dominia-Temp (plan U5): a glass field with a cut bottom-right corner and
// the "Search places, runners, alliances" placeholder (search is still by
// territory name); result rows are CutCards.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';
import { useAuth } from '@clerk/clerk-expo';
import { useTranslation } from 'react-i18next';
import { SEARCH_MAX_LEN, searchTerritories } from '../lib/territorySearchApi';
import { formatKm } from '../lib/relocate';
import { colors, fonts } from '../lib/theme';
import { SearchIcon } from './MapIcons';
import TagChip from './TagChip';
import { CutCard } from './ui';
import { useLayoutSize } from './ui/shared';
import { cutCornerPoints } from '../lib/slantGeometry';
import { SHAPE_LAYER } from './ui/shared';

const DEBOUNCE_MS = 300;
const MIN_QUERY = 2;
const MAX_ROWS = 6;

// Ownership chip per result (Updated UX C3, plan U4 owner_scope).
const SCOPE_TAGS = {
  own: { kind: 'yours', key: 'map.card.tagYours', defaultValue: 'YOURS' },
  alliance: { kind: 'alliance', key: 'map.card.tagAlliance', defaultValue: 'ALLIANCE' },
  enemy: { kind: 'enemy', key: 'map.card.tagEnemy', defaultValue: 'ENEMY' },
  unclaimed: { kind: 'neutral', key: 'map.card.tagUnclaimed', defaultValue: 'UNCLAIMED' },
};

// onActiveChange(bool): true while the field is focused or holds a query, so
// MapTopBar can dim the map behind it. A change of dismissKey (the scrim was
// tapped) clears the search and drops focus.
export default function TerritorySearch({ onSelect, onActiveChange, dismissKey = 0 }) {
  const { t } = useTranslation();
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  // 'idle' | 'loading' | 'done' | 'error'
  const [status, setStatus] = useState('idle');
  const [results, setResults] = useState([]);
  const requestSeq = useRef(0);
  const inputRef = useRef(null);

  const active = focused || query.length > 0;
  useEffect(() => {
    onActiveChange?.(active);
  }, [active, onActiveChange]);

  useEffect(() => {
    if (!dismissKey) return;
    requestSeq.current += 1;
    setQuery('');
    setResults([]);
    setStatus('idle');
    Keyboard.dismiss();
    inputRef.current?.blur();
  }, [dismissKey]);

  const runSearch = useCallback(async (q) => {
    const seq = ++requestSeq.current;
    setStatus('loading');
    const res = await searchTerritories({ clerkGetToken: () => getTokenRef.current(), query: q });
    if (seq !== requestSeq.current) return; // a newer query superseded this one
    if (res.ok) {
      setResults(res.data.results.slice(0, MAX_ROWS));
      setStatus('done');
    } else {
      setResults([]);
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < MIN_QUERY) {
      requestSeq.current += 1;
      setStatus('idle');
      setResults([]);
      return undefined;
    }
    const id = setTimeout(() => runSearch(q), DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [query, runSearch]);

  const clear = () => {
    requestSeq.current += 1;
    setQuery('');
    setResults([]);
    setStatus('idle');
  };

  const pick = (result) => {
    clear();
    Keyboard.dismiss();
    inputRef.current?.blur();
    onSelect?.(result);
  };

  const showPanel = status !== 'idle';
  const [fieldBox, onFieldLayout] = useLayoutSize();

  return (
    <View>
      <View style={styles.field} onLayout={onFieldLayout}>
        <Svg style={SHAPE_LAYER} width={fieldBox.w || 0} height={fieldBox.h || 0} pointerEvents="none">
          <Polygon
            points={cutCornerPoints(fieldBox.w, fieldBox.h, 10, 'br', 0.5)}
            fill={focused ? 'rgba(7,49,209,0.16)' : 'rgba(20,24,40,0.72)'}
            stroke={focused ? colors.action : 'rgba(253,253,253,0.14)'}
            strokeWidth={1}
          />
        </Svg>
        <SearchIcon size={16} color={focused ? colors.white : colors.muted2} />
        <TextInput
          ref={inputRef}
          value={query}
          onChangeText={setQuery}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={t('map.search.placeholderAll', { defaultValue: 'Search places, runners, alliances' })}
          placeholderTextColor={colors.muted2}
          accessibilityLabel={t('map.search.a11y', { defaultValue: 'Search territories by name' })}
          maxLength={SEARCH_MAX_LEN}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
          onSubmitEditing={() => {
            const q = query.trim();
            if (q.length >= MIN_QUERY) runSearch(q);
          }}
          style={styles.input}
          maxFontSizeMultiplier={1.3}
        />
        {status === 'loading' ? <ActivityIndicator size="small" color={colors.bone} /> : null}
        {query.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('map.search.clearA11y', { defaultValue: 'Clear search' })}
            onPress={clear}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.clearButton}
          >
            <Text style={styles.clearText}>×</Text>
          </Pressable>
        ) : null}
      </View>

      {showPanel ? (
        <View style={styles.panel}>
          {status === 'loading' && results.length === 0 ? (
            <Text style={styles.stateText} accessibilityLiveRegion="polite">
              {t('map.search.searching', { defaultValue: 'Searching…' })}
            </Text>
          ) : null}
          {status === 'done' && results.length === 0 ? (
            <Text style={styles.stateText} accessibilityLiveRegion="polite">
              {t('map.search.empty', { defaultValue: 'No territories match that name' })}
            </Text>
          ) : null}
          {status === 'error' ? (
            <View style={styles.errorRow}>
              <Text style={[styles.stateText, styles.errorText]} accessibilityLiveRegion="polite">
                {t('map.search.error', { defaultValue: "Couldn't search right now" })}
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => runSearch(query.trim())}
                style={({ pressed }) => [styles.retryButton, pressed && styles.rowPressed]}
              >
                <Text style={styles.retryText}>{t('common.retry')}</Text>
              </Pressable>
            </View>
          ) : null}
          {(status === 'done' || status === 'loading') && results.map((r) => {
            const tag = r.ownerScope ? SCOPE_TAGS[r.ownerScope] : null;
            const km = r.distanceM != null ? formatKm(r.distanceM) : null;
            return (
              <CutCard
                key={String(r.id)}
                padding={0}
                accessibilityLabel={t('map.search.resultA11y', { defaultValue: 'Show {{name}} on the map', name: r.name })}
                onPress={() => pick(r)}
                style={styles.rowCard}
              >
                <View style={styles.row}>
                  <Text style={styles.rowText} numberOfLines={1} maxFontSizeMultiplier={1.3}>{r.name}</Text>
                  {tag ? (
                    <TagChip kind={tag.kind}>{t(tag.key, { defaultValue: tag.defaultValue })}</TagChip>
                  ) : null}
                  {km ? (
                    <Text style={styles.rowDistance} maxFontSizeMultiplier={1.3}>
                      {t('map.search.distanceKm', { defaultValue: '{{km}} KM', km })}
                    </Text>
                  ) : null}
                </View>
              </CutCard>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.white,
  },
  clearButton: {
    minWidth: 24,
    alignItems: 'center',
  },
  clearText: {
    fontFamily: fonts.mono,
    fontSize: 16,
    color: colors.slate2,
  },
  panel: {
    marginTop: 6,
    gap: 6,
  },
  rowCard: {
    overflow: 'hidden',
  },
  stateText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.slate2,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: 'rgba(14,14,16,0.94)',
  },
  errorRow: {
    backgroundColor: 'rgba(14,14,16,0.94)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  errorText: {
    flex: 1,
    color: colors.bone2,
  },
  retryButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  retryText: {
    fontFamily: fonts.monoMedium,
    fontSize: 11,
    letterSpacing: 1.76,
    textTransform: 'uppercase',
    color: colors.bone,
  },
  row: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
  },
  rowDistance: {
    minWidth: 48,
    textAlign: 'right',
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.1,
    color: colors.slate2,
  },
  rowPressed: {
    backgroundColor: colors.ink3,
  },
  rowText: {
    flex: 1,
    fontFamily: fonts.displayBold,
    fontSize: 17,
    textTransform: 'uppercase',
    color: colors.bone,
  },
});
