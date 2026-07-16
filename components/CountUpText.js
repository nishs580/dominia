// Component: CountUpText — a numeral that counts to its value over 280ms
// (sanctioned UI-transition duration, cubic-bezier(0.2,0,0,1)). A changing
// numeral is data updating, not type animation — the "never animate type"
// brand rule does not apply.

import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Text } from 'react-native';

export default function CountUpText({
  value,
  style,
  prefix = '',
  suffix = '',
  duration = 280,
  countOnMount = false,
  maxFontSizeMultiplier,
}) {
  const target = Math.round(Number(value) || 0);
  const anim = useRef(new Animated.Value(countOnMount ? 0 : target)).current;
  const displayedRef = useRef(countOnMount ? 0 : target);
  const [displayed, setDisplayed] = useState(displayedRef.current);

  useEffect(() => {
    const id = anim.addListener(({ value: v }) => {
      const rounded = Math.round(v);
      if (rounded !== displayedRef.current) {
        displayedRef.current = rounded;
        setDisplayed(rounded);
      }
    });
    return () => anim.removeListener(id);
  }, [anim]);

  useEffect(() => {
    if (target === displayedRef.current) return;
    Animated.timing(anim, {
      toValue: target,
      duration,
      easing: Easing.bezier(0.2, 0, 0, 1),
      useNativeDriver: false, // listener-driven text — no native node to drive
    }).start(({ finished }) => {
      if (finished && displayedRef.current !== target) {
        displayedRef.current = target;
        setDisplayed(target);
      }
    });
  }, [target, duration, anim]);

  return (
    <Text style={style} maxFontSizeMultiplier={maxFontSizeMultiplier}>
      {prefix}
      {displayed.toLocaleString()}
      {suffix}
    </Text>
  );
}
