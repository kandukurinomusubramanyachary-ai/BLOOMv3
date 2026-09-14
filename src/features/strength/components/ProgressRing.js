import React, { useEffect, useRef } from 'react';
import { Animated, Platform, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { COLORS } from '../../../utils/constants';
import { useReducedMotion } from '../../../components/Motion';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// A smooth circular progress ring. `progress` is 0..1. Animates toward each new
// value so rep tempo and countdowns read as continuous motion, not steps.
export default function ProgressRing({
  progress = 0,
  size = 240,
  strokeWidth = 14,
  color = COLORS.brand,
  trackColor = COLORS.hairline,
  children,
  animated = true,
  pulseKey = null,
}) {
  const reduceMotion = useReducedMotion();
  const boundedProgress = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const anim = useRef(new Animated.Value(boundedProgress)).current;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!animated || reduceMotion) {
      anim.setValue(boundedProgress);
      return undefined;
    }
    const animation = Animated.timing(anim, {
      toValue: boundedProgress,
      duration: 140,
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [boundedProgress, animated, reduceMotion, anim]);

  // A gentle scale pop whenever pulseKey changes (e.g. a completed rep).
  useEffect(() => {
    if (pulseKey === null || !animated || reduceMotion) {
      pulse.setValue(1);
      return undefined;
    }
    pulse.setValue(0.98);
    const animation = Animated.timing(pulse, {
      toValue: 1,
      duration: 180,
      useNativeDriver: Platform.OS !== 'web',
    });
    animation.start();
    return () => animation.stop();
  }, [pulseKey, pulse, animated, reduceMotion]);

  const strokeDashoffset = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  });

  return (
    <Animated.View style={{ width: size, height: size, transform: [{ scale: pulse }] }}>
      <Svg width={size} height={size}>
        <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={trackColor}
            strokeWidth={strokeWidth}
            fill="none"
          />
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${circumference}, ${circumference}`}
            strokeDashoffset={strokeDashoffset}
          />
        </G>
      </Svg>
      <View
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}
      >
        {children}
      </View>
    </Animated.View>
  );
}
