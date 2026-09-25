import React from 'react';
import { View, Text, Platform } from 'react-native';
import { LotusMark } from '../../../components/BrandMark';
import Button from '../../../components/Button';
import { Entrance } from '../../../components/Motion';
import { COLORS, createThemedStyles, LAYOUT, TYPOGRAPHY } from '../../../utils/constants';

/**
 * Screen 1 — Welcome
 * Communicates Bloom's premise immediately with warmth, beauty, and quiet confidence.
 */
export default function WelcomeStep({ onNext }) {
  return (
    <View style={styles.container}>
      <Entrance distance={12} duration={260} style={styles.content}>
        <View style={styles.lotusBox}>
          <LotusMark size={64} decorative={false} accessibilityLabel="Bloom lotus flower" />
        </View>

        <View style={styles.badge}>
          <Text style={styles.badgeText}>GENTLE HEALTH INTELLIGENCE</Text>
        </View>

        <Text style={styles.title}>
          Your body doesn’t always follow a calendar.
        </Text>

        <Text style={styles.subtitle}>
          Bloom is a calm, supportive space for your cycle, symptoms, energy, and strength — especially when patterns feel unpredictable.
        </Text>

        <View style={styles.valueRow}>
          <View style={styles.valueItem}>
            <Text style={styles.valueBullet}>🌿</Text>
            <Text style={styles.valueText}>PCOS & irregular cycle aware</Text>
          </View>
          <View style={styles.valueItem}>
            <Text style={styles.valueBullet}>🔒</Text>
            <Text style={styles.valueText}>Private by default, zero judgment</Text>
          </View>
          <View style={styles.valueItem}>
            <Text style={styles.valueBullet}>💬</Text>
            <Text style={styles.valueText}>Compassionate Meg AI support</Text>
          </View>
        </View>
      </Entrance>

      <View style={styles.footer}>
        <Button
          title="Let’s get to know you"
          onPress={onNext}
          accessibilityLabel="Let’s get to know you. Begin onboarding"
        />
        <Text style={styles.privacyNote}>
          Takes less than two minutes · No medical questionnaires
        </Text>
      </View>
    </View>
  );
}

const styles = createThemedStyles({
  container: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 36,
    paddingBottom: 28,
  },
  content: {
    alignItems: 'center',
    maxWidth: 420,
    alignSelf: 'center',
    width: '100%',
  },
  lotusBox: {
    marginBottom: 20,
    marginTop: 8,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: COLORS.brandSoft,
    marginBottom: 16,
  },
  badgeText: {
    ...TYPOGRAPHY.eyebrow,
    color: COLORS.brand,
    letterSpacing: 0.8,
  },
  title: {
    ...TYPOGRAPHY.screenTitle,
    fontSize: 27,
    lineHeight: 34,
    color: COLORS.ink,
    textAlign: 'center',
    fontWeight: '700',
    letterSpacing: -0.4,
    marginBottom: 14,
  },
  subtitle: {
    ...TYPOGRAPHY.body,
    fontSize: 15,
    lineHeight: 23,
    color: COLORS.muted,
    textAlign: 'center',
    marginBottom: 28,
  },
  valueRow: {
    width: '100%',
    backgroundColor: COLORS.surfaceSoft,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 18,
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.hairlineSoft,
  },
  valueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  valueBullet: {
    fontSize: 16,
  },
  valueText: {
    ...TYPOGRAPHY.supporting,
    fontSize: 13,
    color: COLORS.body,
    fontWeight: '500',
  },
  footer: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    gap: 10,
  },
  privacyNote: {
    ...TYPOGRAPHY.caption,
    textAlign: 'center',
    color: COLORS.muted,
    fontSize: 12,
  },
});
