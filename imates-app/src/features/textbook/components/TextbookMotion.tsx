import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Platform,
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const USE_NATIVE_DRIVER = Platform.OS !== 'web';

interface MotionPressableProps
  extends Omit<PressableProps, 'style' | 'onPressIn' | 'onPressOut'> {
  style?: StyleProp<ViewStyle>;
  reduceMotion?: boolean;
  pressedScale?: number;
  pressedOpacity?: number;
}

export const MotionPressable = memo(function MotionPressable({
  style,
  reduceMotion = false,
  pressedScale = 0.97,
  pressedOpacity = 0.84,
  disabled,
  ...props
}: MotionPressableProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  const animatePressState = useCallback(
    (pressed: boolean) => {
      scale.stopAnimation();
      opacity.stopAnimation();

      if (reduceMotion) {
        scale.setValue(1);
        opacity.setValue(pressed ? pressedOpacity : 1);
        return;
      }

      Animated.parallel([
        Animated.spring(scale, {
          toValue: pressed ? pressedScale : 1,
          damping: 24,
          stiffness: 420,
          mass: 0.55,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(opacity, {
          toValue: pressed ? pressedOpacity : 1,
          duration: pressed ? 90 : 150,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]).start();
    },
    [opacity, pressedOpacity, pressedScale, reduceMotion, scale]
  );

  useEffect(
    () => () => {
      scale.stopAnimation();
      opacity.stopAnimation();
    },
    [opacity, scale]
  );

  return (
    <AnimatedPressable
      {...props}
      disabled={disabled}
      onPressIn={() => animatePressState(true)}
      onPressOut={() => animatePressState(false)}
      style={[
        style,
        { opacity, transform: [{ scale }] },
        disabled && { opacity: 0.45 },
      ]}
    />
  );
});

export function useReducedMotion() {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion
    );

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return reduceMotion;
}

export const textbookMotionConfig = {
  useNativeDriver: USE_NATIVE_DRIVER,
};
