// CutField — the Dominia-Temp text field (plan U2; Figma sign-in boards).
// 54pt-minimum rectangle with an 8pt diagonal cut on the bottom-right, a
// subtle dark gradient fill and a 1pt hairline border. Focus turns the border
// Dominia blue over a faint blue tint; an error turns it red over a faint red
// tint and shows the message underneath. Label above in Plex Sans Bold caps.
//
// Forwards its ref and every TextInput prop. `secureTextEntry` adds an eye
// toggle; `rightAccessory` puts any node (e.g. a RESEND CODE link) at the
// right edge inside the field.

import React, { forwardRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Polygon, Stop } from 'react-native-svg';
import { colors, fonts } from '../../lib/theme';
import { cutCornerPoints } from '../../lib/slantGeometry';
import { useLayoutSize, useSvgId, SHAPE_LAYER } from './shared';

const BORDER = 'rgba(253,253,253,0.12)';
const PLACEHOLDER = 'rgba(253,253,253,0.3)';

function EyeIcon({ off, size = 18, color = colors.muted2 }) {
  const p = { stroke: color, strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path {...p} d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
      <Circle {...p} cx="12" cy="12" r="3" />
      {off ? <Line {...p} x1="3" y1="3" x2="21" y2="21" /> : null}
    </Svg>
  );
}

const CutField = forwardRef(function CutField(
  {
    label,
    helper,
    error,
    secureTextEntry = false,
    rightAccessory = null,
    containerStyle,
    style,
    editable = true,
    onFocus,
    onBlur,
    accessibilityLabel,
    testID,
    ...inputProps
  },
  ref,
) {
  const { t } = useTranslation();
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [box, onLayout] = useLayoutSize();
  const gradId = useSvgId('cutfield');
  const hasError = typeof error === 'string' ? error.length > 0 : !!error;

  const border = hasError ? colors.danger : focused ? colors.action : BORDER;
  const tint = hasError ? 'rgba(227,66,52,0.12)' : focused ? 'rgba(7,49,209,0.14)' : null;

  return (
    <View style={[styles.wrap, containerStyle]}>
      {label ? (
        <Text style={styles.label} maxFontSizeMultiplier={1.3} importantForAccessibility="no">
          {label}
        </Text>
      ) : null}
      <View
        onLayout={onLayout}
        style={[styles.field, editable === false && styles.fieldDisabled]}
      >
        <Svg style={SHAPE_LAYER} width={box.w || 0} height={box.h || 0} pointerEvents="none">
          <Defs>
            <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#0E0E10" />
              <Stop offset="1" stopColor="#000000" />
            </LinearGradient>
          </Defs>
          <Polygon points={cutCornerPoints(box.w, box.h, 8, 'br', 0.5)} fill={`url(#${gradId})`} />
          <Polygon
            points={cutCornerPoints(box.w, box.h, 8, 'br', 0.5)}
            fill={tint ?? 'transparent'}
            stroke={border}
            strokeWidth={1}
          />
        </Svg>
        <TextInput
          ref={ref}
          {...inputProps}
          editable={editable}
          secureTextEntry={secureTextEntry && !revealed}
          placeholderTextColor={PLACEHOLDER}
          selectionColor={colors.action}
          cursorColor={colors.white}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          accessibilityLabel={accessibilityLabel ?? (typeof label === 'string' ? label : undefined)}
          accessibilityHint={hasError && typeof error === 'string' ? error : typeof helper === 'string' ? helper : undefined}
          accessibilityState={{ disabled: editable === false }}
          maxFontSizeMultiplier={1.4}
          testID={testID}
          style={[styles.input, style]}
        />
        {secureTextEntry ? (
          <Pressable
            onPress={() => setRevealed((v) => !v)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={revealed ? t('common.hidePassword') : t('common.showPassword')}
            accessibilityState={{ checked: revealed }}
            style={styles.accessory}
            testID={testID ? `${testID}-eye` : undefined}
          >
            <EyeIcon off={revealed} />
          </Pressable>
        ) : null}
        {rightAccessory ? <View style={styles.accessory}>{rightAccessory}</View> : null}
      </View>
      {hasError && typeof error === 'string' ? (
        <Text style={styles.error} accessibilityLiveRegion="polite" accessibilityRole="alert" maxFontSizeMultiplier={1.4}>
          {error}
        </Text>
      ) : helper ? (
        <Text style={styles.helper} maxFontSizeMultiplier={1.4}>
          {helper}
        </Text>
      ) : null}
    </View>
  );
});

export default CutField;

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'stretch',
  },
  label: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.54,
    textTransform: 'uppercase',
    color: colors.muted2,
    marginBottom: 8,
  },
  field: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
  },
  fieldDisabled: {
    opacity: 0.5,
  },
  input: {
    flex: 1,
    alignSelf: 'stretch',
    minHeight: 54,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: colors.white,
    fontFamily: fonts.body,
    fontSize: 16,
  },
  accessory: {
    paddingRight: 16,
    paddingLeft: 4,
    justifyContent: 'center',
  },
  error: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.danger,
    marginTop: 6,
  },
  helper: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.muted2,
    marginTop: 6,
  },
});
