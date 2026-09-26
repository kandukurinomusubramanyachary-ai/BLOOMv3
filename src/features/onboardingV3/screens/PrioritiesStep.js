import React, { useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import Button from '../../../components/Button';
import { Entrance } from '../../../components/Motion';
import SelectionCard from '../components/SelectionCard';
import ReasonCallout from '../components/ReasonCallout';
import { PRIORITY_OPTIONS } from '../data/options';
import { COLORS, createThemedStyles, TYPOGRAPHY } from '../../../utils/constants';

/**
 * Screen 8 — What she wants from Bloom (Priorities)
 * Select up to 3. Directly dictates the personalized first action.
 */
export default function PrioritiesStep({ initialPriorities = [], onNext, onSkip }) {
  const [selected, setSelected] = useState(initialPriorities.slice(0, 1));

  function toggle(id) {
    setSelected(selected.includes(id) ? [] : [id]);
  }

  function handleContinue() {
    onNext({ priorities: selected });
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Entrance distance={8} duration={200} style={styles.shell}>
          <Text style={styles.title}>What would you most like Bloom to help you with?</Text>
          <Text style={styles.subtitle}>
            Choose the one that matters most right now. You can change it later.
          </Text>

          <View style={styles.optionsList}>
            {PRIORITY_OPTIONS.map((opt) => (
              <SelectionCard
                key={opt.id}
                label={opt.label}
                description={opt.description}
                tag={opt.tag}
                icon={opt.icon}
                selected={selected.includes(opt.id)}
                onPress={() => toggle(opt.id)}
              />
            ))}
          </View>

          <ReasonCallout text="This decides the primary recommendation you receive at the end of onboarding." />
        </Entrance>

        <View style={styles.footer}>
          <Button
            title={selected.length > 0 ? 'See what Bloom understood' : 'Continue'}
            onPress={handleContinue}
            accessibilityLabel="Complete onboarding questions and view summary"
          />
          {selected.length === 0 ? (
            <Button
              title="Skip this question"
              variant="ghost"
              onPress={onSkip}
              accessibilityLabel="Skip priorities question"
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
