import React, { useEffect } from 'react';
import { View, Text, Animated, Easing, Platform } from 'react-native';
import { LotusMark } from '../../../components/BrandMark';
import { Entrance, useReducedMotion } from '../../../components/Motion';
import { COLORS, createThemedStyles, TYPOGRAPHY } from '../../../utils/constants';

/**
 * Screen 9 — Transitional Processing State
 * "Putting your Bloom together…"
 * Subtle, calming 1.5s transition that makes the user feel their answers are being thoughtfully synthesized.
 */
export default function ProcessingStep({ onComplete }) {
  const reduceMotion = useReducedMotion();
  const pulseAnim = React.useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!reduceMotion) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.08,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: Platform.OS !== 'web',
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: Platform.OS !== 'web',
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [pulseAnim, reduceMotion]);

  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete?.();
    }, reduceMotion ? 250 : 800);

    return () => clearTimeout(timer);
  }, [onComplete, reduceMotion]);

  return (
    <View style={styles.container}>
      <Entrance distance={10} duration={240} style={styles.content}>
        <Animated.View style={[styles.lotusWrap, !reduceMotion && { transform: [{ scale: pulseAnim }] }]}>
          <LotusMark size={68} decorative={false} accessibilityLabel="Bloom lotus" />
        </Animated.View>

        <Text style={styles.title}>Putting your Bloom together…</Text>
        <Text style={styles.subtitle}>
          Turning what you shared into one useful place to begin.
        </Text>
      </Entrance>
    </View>
  );
}

const styles = createThemedStyles({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    backgroundColor: COLORS.canvas,
  },
  content: {
    alignItems: 'center',
    maxWidth: 380,
  },
  lotusWrap: {
    marginBottom: 24,
  },
  title: {
    ...TYPOGRAPHY.screenTitle,
    fontSize: 24,
    lineHeight: 30,
    color: COLORS.ink,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    ...TYPOGRAPHY.body,
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.muted,
    textAlign: 'center',
  },
});
