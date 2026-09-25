import React from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import Icon from '../../../components/Icon';
import { COLORS, createThemedStyles, TYPOGRAPHY, WEB_FOCUS } from '../../../utils/constants';

/**
 * Clean, subtle progress indicator for steps 1 through 7.
 * Replaces clinical "Question 3 of 7" with a modern, calm dot & bar progression.
 */
export default function ProgressBar({ currentStep, totalSteps = 7, onBack, onSkip, showSkip = false, onReset }) {
  // currentStep is 1-indexed for interactive questions (1 to 7)
  const activeIndex = Math.max(0, Math.min(totalSteps, currentStep - 1));

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Go back to previous step"
            style={({ pressed, hovered, focused }) => [
              styles.navButton,
              hovered && styles.navButtonHovered,
              focused && styles.navButtonFocused,
              pressed && styles.pressed,
            ]}
          >
            <Icon name="chevron-back" size={20} color={COLORS.ink} />
            <Text style={styles.navButtonText}>Back</Text>
          </Pressable>
        ) : (
          <View style={styles.navSpacer} />
        )}

        {/* Subtle pill dots */}
        <View style={styles.dotsTrack} accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: totalSteps, now: currentStep }}>
          {Array.from({ length: totalSteps }).map((_, index) => {
            const isCompleted = index < activeIndex;
            const isCurrent = index === activeIndex;
            return (
              <View
                key={index}
                style={[
                  styles.dot,
                  isCurrent && styles.dotCurrent,
                  isCompleted && styles.dotCompleted,
                ]}
              />
            );
          })}
        </View>

        {showSkip && onSkip ? (
          <Pressable
            onPress={onSkip}
            accessibilityRole="button"
            accessibilityLabel="Skip this question"
            style={({ pressed, hovered, focused }) => [
              styles.navButton,
              hovered && styles.navButtonHovered,
              focused && styles.navButtonFocused,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.skipButtonText}>Skip</Text>
            <Icon name="chevron-forward" size={16} color={COLORS.muted} />
          </Pressable>
        ) : onReset ? (
          <Pressable
            onPress={onReset}
            accessibilityRole="button"
            accessibilityLabel="Reset onboarding draft"
            style={({ pressed, hovered, focused }) => [
              styles.navButton,
              hovered && styles.navButtonHovered,
              focused && styles.navButtonFocused,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.resetButtonText}>Reset</Text>
          </Pressable>
        ) : (
          <View style={styles.navSpacer} />
        )}
      </View>
    </View>
  );
}

const styles = createThemedStyles({
  container: {
    width: '100%',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 14,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 38,
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    gap: 4,
  },
  navButtonHovered: {
    backgroundColor: COLORS.surfaceSoft,
  },
  navButtonFocused: Platform.select({
    web: WEB_FOCUS,
    default: {},
  }),
  navButtonText: {
    ...TYPOGRAPHY.supporting,
    color: COLORS.ink,
    fontWeight: '500',
  },
  skipButtonText: {
    ...TYPOGRAPHY.supporting,
    color: COLORS.muted,
    fontWeight: '500',
  },
  resetButtonText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.muted,
  },
  navSpacer: {
    width: 60,
  },
  dotsTrack: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.hairline,
  },
  dotCurrent: {
    width: 20,
    backgroundColor: COLORS.brand,
    borderRadius: 3,
  },
  dotCompleted: {
    backgroundColor: COLORS.brandSoft,
    borderColor: COLORS.brand,
  },
  pressed: {
    opacity: 0.7,
  },
});
