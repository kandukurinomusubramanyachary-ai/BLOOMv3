import React, { useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import Button from '../../../components/Button';
import { Entrance } from '../../../components/Motion';
import SelectionCard from '../components/SelectionCard';
import ReasonCallout from '../components/ReasonCallout';
import PrivacyAssurance from '../components/PrivacyAssurance';
import { EMOTIONAL_STATE_OPTIONS } from '../data/options';
import { COLORS, createThemedStyles, TYPOGRAPHY } from '../../../utils/constants';

/**
 * Screen 6 — Emotional state
 * Gentle, supportive, and safe. Critical for Meg AI tone matching.
 */
export default function EmotionsStep({ initialEmotion = null, onNext, onSkip }) {
  const [selected, setSelected] = useState(initialEmotion);

  function handleContinue() {
    onNext({ emotionalState: selected });
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Entrance distance={8} duration={200} style={styles.shell}>
          <Text style={styles.eyebrow}>STEP 5 OF 7</Text>
          <Text style={styles.title}>Emotionally, how have things felt lately?</Text>
          <Text style={styles.subtitle}>
            Your feelings aren’t separate from your cycle. Bloom gives you space to be honest without being graded.
          </Text>

          <View style={styles.optionsList}>
            {EMOTIONAL_STATE_OPTIONS.map((opt) => (
              <SelectionCard
                key={opt.id}
                label={opt.label}
                description={opt.description}
                icon={opt.icon}
                selected={selected === opt.id}
                onPress={() => setSelected(opt.id)}
              />
            ))}
          </View>

          <ReasonCallout text="Meg tunes her tone to your emotional space — offering gentle validation rather than unsolicited advice." />
          <PrivacyAssurance compact text="Your emotional logs are strictly private and never shared." />
        </Entrance>

        <View style={styles.footer}>
          <Button
            title="Continue"
            onPress={handleContinue}
            accessibilityLabel="Continue to energy question"
          />
          {!selected ? (
            <Button
              title="Skip this question"
              variant="ghost"
              onPress={onSkip}
              accessibilityLabel="Skip emotions question"
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
  optionsList: {
    width: '100%',
  },
  footer: {
    width: '100%',
    gap: 8,
    marginTop: 20,
  },
});
