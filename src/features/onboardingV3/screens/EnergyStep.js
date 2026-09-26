import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, Platform } from 'react-native';
import Button from '../../../components/Button';
import Icon from '../../../components/Icon';
import { Entrance } from '../../../components/Motion';
import ReasonCallout from '../components/ReasonCallout';
import { ENERGY_LEVEL_OPTIONS } from '../data/options';
import { COLORS, createThemedStyles, TYPOGRAPHY, WEB_FOCUS } from '../../../utils/constants';

/**
 * Screen 7 — Energy scale
 * Quick visual scale (1 to 5) with descriptive cards. Fast, intuitive, and calm.
 */
export default function EnergyStep({ initialEnergy = null, onNext, onSkip }) {
  const [selectedLevel, setSelectedLevel] = useState(initialEnergy);

  function handleContinue() {
    onNext({ energyLevel: selectedLevel });
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Entrance distance={8} duration={200} style={styles.shell}>
          <Text style={styles.title}>How has your energy been lately?</Text>
          <Text style={styles.subtitle}>
            Notice your reserve without judging yourself for needing more rest.
          </Text>

          <View style={styles.levelsList}>
            {ENERGY_LEVEL_OPTIONS.map((opt) => {
              const isSelected = selectedLevel === opt.level;
              return (
                <Pressable
                  key={opt.level}
                  onPress={() => setSelectedLevel(opt.level)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={`${opt.label}: ${opt.description}`}
                  style={({ pressed, hovered, focused }) => [
                    styles.levelCard,
                    isSelected && styles.levelCardSelected,
                    hovered && styles.levelCardHovered,
                    focused && styles.levelCardFocused,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={[styles.levelIndicator, { backgroundColor: isSelected ? opt.color : COLORS.surfaceStrong }]}>
                    <Text style={[styles.levelNumber, isSelected && styles.levelNumberSelected]}>
                      {opt.level}
                    </Text>
                  </View>

                  <View style={styles.copyWrap}>
                    <View style={styles.titleRow}>
                      <Text style={[styles.levelTitle, isSelected && styles.levelTitleSelected]}>
                        {opt.label}
                      </Text>
                      <Text style={styles.sublabel}>· {opt.sublabel}</Text>
                    </View>
                    <Text style={[styles.levelDesc, isSelected && styles.levelDescSelected]}>
                      {opt.description}
                    </Text>
                  </View>

                  <Icon
                    name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                    size={20}
                    color={isSelected ? opt.color : COLORS.hairline}
                  />
                </Pressable>
              );
            })}
          </View>

          <ReasonCallout text="Bloom can use this to keep movement and daily suggestions realistic." />
        </Entrance>

        <View style={styles.footer}>
          <Button
            title="Continue"
            onPress={handleContinue}
            accessibilityLabel="Continue to priorities question"
          />
          {!selectedLevel ? (
            <Button
              title="Skip this question"
              variant="ghost"
              onPress={onSkip}
              accessibilityLabel="Skip energy question"
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
  levelsList: {
    width: '100%',
    gap: 8,
  },
  levelCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.hairline,
    backgroundColor: COLORS.white,
    gap: 12,
    ...Platform.select({
      web: { cursor: 'pointer', transition: 'all 0.15s ease' },
      default: {},
    }),
  },
  levelCardSelected: {
    backgroundColor: COLORS.surfaceWarm,
    borderColor: COLORS.brand,
  },
  levelCardHovered: {
    borderColor: COLORS.borderStrong,
  },
  levelCardFocused: Platform.select({
    web: WEB_FOCUS,
    default: {},
  }),
  levelIndicator: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelNumber: {
    ...TYPOGRAPHY.button,
    fontSize: 14,
    color: COLORS.body,
    fontWeight: '700',
  },
  levelNumberSelected: {
    color: COLORS.white,
  },
  copyWrap: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  levelTitle: {
    ...TYPOGRAPHY.componentTitle,
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.ink,
  },
  levelTitleSelected: {
    color: COLORS.ink,
  },
  sublabel: {
    ...TYPOGRAPHY.caption,
    fontSize: 12,
    color: COLORS.muted,
  },
  levelDesc: {
    ...TYPOGRAPHY.supporting,
    fontSize: 12,
    lineHeight: 16,
    color: COLORS.muted,
    marginTop: 1,
  },
  levelDescSelected: {
    color: COLORS.body,
  },
  pressed: {
    transform: [{ scale: 0.99 }],
    opacity: 0.95,
  },
  footer: {
    width: '100%',
    gap: 8,
    marginTop: 20,
  },
});
