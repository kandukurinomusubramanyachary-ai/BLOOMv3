import React, { useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import Button from '../../../components/Button';
import { Entrance } from '../../../components/Motion';
import SymptomChip from '../components/SymptomChip';
import ReasonCallout from '../components/ReasonCallout';
import { SYMPTOM_OPTIONS } from '../data/options';
import { COLORS, createThemedStyles, TYPOGRAPHY } from '../../../utils/constants';

/**
 * Screen 5 — Symptoms
 * Clean, grouped interactive chips. Easy to scan and tap.
 */
export default function SymptomsStep({ initialSymptoms = [], onNext, onSkip }) {
  const [selected, setSelected] = useState(initialSymptoms);

  function toggle(id) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  function handleContinue() {
    onNext({ symptoms: selected });
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Entrance distance={8} duration={200} style={styles.shell}>
          <Text style={styles.eyebrow}>STEP 4 OF 7</Text>
          <Text style={styles.title}>What has your body been dealing with lately?</Text>
          <Text style={styles.subtitle}>
            Tap any that feel familiar recently. Bloom helps you find relief patterns without pressure.
          </Text>

          <View style={styles.chipsContainer}>
            {SYMPTOM_OPTIONS.map((item) => (
              <SymptomChip
                key={item.id}
                label={item.label}
                icon={item.icon}
                selected={selected.includes(item.id)}
                onPress={() => toggle(item.id)}
              />
            ))}
          </View>

          <ReasonCallout text="Bloom pre-populates your daily check-in with these choices so logging takes just seconds." />
        </Entrance>

        <View style={styles.footer}>
          <Button
            title={selected.length > 0 ? `Continue (${selected.length} selected)` : 'None of these / Continue'}
            onPress={handleContinue}
            accessibilityLabel="Continue to emotional state question"
          />
          {selected.length === 0 ? (
            <Button
              title="Skip"
              variant="ghost"
              onPress={onSkip}
              accessibilityLabel="Skip symptoms question"
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
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
    marginBottom: 6,
  },
  footer: {
    width: '100%',
    gap: 8,
    marginTop: 20,
  },
});
