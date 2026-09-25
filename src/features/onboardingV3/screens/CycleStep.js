import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, Platform } from 'react-native';
import Button from '../../../components/Button';
import { Entrance } from '../../../components/Motion';
import SelectionCard from '../components/SelectionCard';
import ReasonCallout from '../components/ReasonCallout';
import { CYCLE_PATTERN_OPTIONS, CYCLE_LENGTH_OPTIONS } from '../data/options';
import { COLORS, createThemedStyles, TYPOGRAPHY, WEB_FOCUS } from '../../../utils/constants';

/**
 * Screen 4 — Cycle context
 * Non-clinical, respectful of irregular (21–90+ day) patterns.
 */
export default function CycleStep({
  initialPattern = null,
  initialLength = null,
  onNext,
  onSkip,
}) {
  const [pattern, setPattern] = useState(initialPattern);
  const [length, setLength] = useState(initialLength);

  function handleContinue() {
    onNext({
      cyclePattern: pattern || 'not_sure',
      cycleLengthEstimate: length || 'not_sure',
    });
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Entrance distance={8} duration={200} style={styles.shell}>
          <Text style={styles.eyebrow}>STEP 3 OF 7</Text>
          <Text style={styles.title}>How would you describe your cycle?</Text>
          <Text style={styles.subtitle}>
            Cycles don’t have to follow a standard 28-day schedule. Choose whatever feels closest.
          </Text>

          <View style={styles.patternSection}>
            {CYCLE_PATTERN_OPTIONS.map((opt) => (
              <SelectionCard
                key={opt.id}
                label={opt.label}
                description={opt.description}
                tag={opt.tag}
                selected={pattern === opt.id}
                onPress={() => setPattern(opt.id)}
              />
            ))}
          </View>

          {/* Progressive disclosure: Ask cycle length if she has cycles */}
          {pattern && pattern !== 'no_recent_period' && (
            <View style={styles.subQuestionSection}>
              <Text style={styles.subQuestionTitle}>
                About how long does your cycle usually feel?
              </Text>
              <Text style={styles.subQuestionSubtitle}>
                From the start of one period to the start of the next.
              </Text>

              <View style={styles.chipGrid}>
                {CYCLE_LENGTH_OPTIONS.map((item) => {
                  const isSelected = length === item.id;
                  return (
                    <Pressable
                      key={item.id}
                      onPress={() => setLength(item.id)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: isSelected }}
                      style={({ pressed, hovered, focused }) => [
                        styles.lengthChip,
                        isSelected && styles.lengthChipSelected,
                        hovered && styles.lengthChipHovered,
                        focused && styles.lengthChipFocused,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={[styles.lengthChipText, isSelected && styles.lengthChipTextSelected]}>
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          <ReasonCallout text="Your cycle does not need to be regular for Bloom to help. This adapts our estimation algorithms so they never rush you." />
        </Entrance>

        <View style={styles.footer}>
          <Button
            title="Continue"
            onPress={handleContinue}
            accessibilityLabel="Continue to symptoms question"
          />
          {!pattern ? (
            <Button
              title="I'm not sure / Skip"
              variant="ghost"
              onPress={onSkip}
              accessibilityLabel="Skip cycle details"
            />
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = createThemedStyles({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 28,
    maxWidth: 440,
    width: '100%',
    alignSelf: 'center',
  },
  shell: {
    width: '100%',
  },
  eyebrow: {
    ...TYPOGRAPHY.eyebrow,
    color: COLORS.brand,
    letterSpacing: 1,
    marginBottom: 8,
  },
  title: {
    ...TYPOGRAPHY.screenTitle,
    fontSize: 25,
    lineHeight: 32,
    color: COLORS.ink,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    ...TYPOGRAPHY.body,
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.muted,
    marginBottom: 20,
  },
  patternSection: {
    width: '100%',
  },
  subQuestionSection: {
    marginTop: 14,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.hairlineSoft,
  },
  subQuestionTitle: {
    ...TYPOGRAPHY.componentTitle,
    fontSize: 16,
    lineHeight: 22,
    color: COLORS.ink,
    marginBottom: 4,
  },
  subQuestionSubtitle: {
    ...TYPOGRAPHY.supporting,
    fontSize: 13,
    lineHeight: 18,
    color: COLORS.muted,
    marginBottom: 14,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  lengthChip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.hairline,
    backgroundColor: COLORS.white,
    ...Platform.select({
      web: { cursor: 'pointer', transition: 'all 0.15s ease' },
      default: {},
    }),
  },
  lengthChipSelected: {
    backgroundColor: COLORS.brandSoft,
    borderColor: COLORS.brand,
  },
  lengthChipHovered: {
    borderColor: COLORS.borderStrong,
  },
  lengthChipFocused: Platform.select({
    web: WEB_FOCUS,
    default: {},
  }),
  lengthChipText: {
    ...TYPOGRAPHY.supporting,
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.ink,
  },
  lengthChipTextSelected: {
    fontWeight: '600',
    color: COLORS.ink,
  },
  pressed: {
    opacity: 0.8,
  },
  footer: {
    width: '100%',
    gap: 8,
    marginTop: 20,
  },
});
