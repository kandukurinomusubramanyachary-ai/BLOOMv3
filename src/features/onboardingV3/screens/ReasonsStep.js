import React, { useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import Button from '../../../components/Button';
import { Entrance } from '../../../components/Motion';
import SelectionCard from '../components/SelectionCard';
import ReasonCallout from '../components/ReasonCallout';
import { REASONS_OPTIONS } from '../data/options';
import { COLORS, createThemedStyles, TYPOGRAPHY } from '../../../utils/constants';

/**
 * Screen 3 — Reasons for joining
 * Multi-select with supportive options, including non-diagnostic PCOS choices.
 */
export default function ReasonsStep({ initialSelections = [], onNext, onSkip }) {
  const [selected, setSelected] = useState(initialSelections);

  function toggle(id) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  function handleContinue() {
    onNext({ reasonsForJoining: selected });
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Entrance distance={8} duration={200} style={styles.shell}>
          <Text style={styles.title}>What brought you to Bloom?</Text>
          <Text style={styles.subtitle}>
            Select all that apply. There are no right or wrong answers.
          </Text>

          <View style={styles.optionsList}>
            {REASONS_OPTIONS.map((opt) => (
              <SelectionCard
                key={opt.id}
                label={opt.label}
                description={opt.description}
                icon={opt.icon}
                multiple
                selected={selected.includes(opt.id)}
                onPress={() => toggle(opt.id)}
              />
            ))}
          </View>

          <ReasonCallout text="What you choose helps Bloom keep the most relevant parts close at hand." />
        </Entrance>

        <View style={styles.footer}>
          <Button
            title={selected.length > 0 ? `Continue (${selected.length} selected)` : 'Continue'}
            onPress={handleContinue}
            accessibilityLabel="Continue to cycle context"
          />
          {selected.length === 0 ? (
            <Button
              title="Skip this question"
              variant="ghost"
              onPress={onSkip}
              accessibilityLabel="Skip reasons question"
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
  optionsList: {
    width: '100%',
  },
  footer: {
    width: '100%',
    gap: 8,
    marginTop: 20,
  },
});
