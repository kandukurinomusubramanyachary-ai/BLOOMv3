import React from 'react';
import { View, Text } from 'react-native';
import Button from '../../../components/Button';
import BrandMark from '../../../components/BrandMark';
import Icon from '../../../components/Icon';
import { Entrance } from '../../../components/Motion';
import { COLORS, createThemedStyles, TYPOGRAPHY } from '../../../utils/constants';

export default function WelcomeStep({ onNext }) {
  return (
    <View style={styles.container}>
      <Entrance distance={8} duration={220} style={styles.content}>
        <BrandMark size="large" style={styles.brand} accessibilityLabel="Bloom" />
        <Text accessibilityRole="header" style={styles.title}>Welcome to Bloom</Text>
        <Text style={styles.promise}>A space to understand your body a little better.</Text>
        <Text style={styles.subtitle}>
          Share only what feels useful. Bloom will listen for your patterns without judging them.
        </Text>
      </Entrance>

      <View style={styles.footer}>
        <Button title="Get started" onPress={onNext} accessibilityLabel="Get started with Bloom" />
        <View style={styles.reassurance} accessible accessibilityLabel="Private by default. Takes about two minutes.">
          <Icon name="lock-closed-outline" size={14} color={COLORS.muted} />
          <Text style={styles.reassuranceText}>Private by default · about two minutes</Text>
        </View>
      </View>
    </View>
  );
}

const styles = createThemedStyles({
  container: { flex: 1, justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 64, paddingBottom: 28 },
  content: { alignItems: 'center', maxWidth: 420, alignSelf: 'center', width: '100%' },
  brand: { marginBottom: 42 },
  title: { ...TYPOGRAPHY.screenTitle, fontSize: 30, lineHeight: 36, color: COLORS.ink, textAlign: 'center', fontWeight: '700', letterSpacing: -0.5, marginBottom: 14 },
  promise: { ...TYPOGRAPHY.sectionTitle, fontSize: 21, lineHeight: 28, color: COLORS.ink, textAlign: 'center', maxWidth: 330, marginBottom: 14 },
  subtitle: { ...TYPOGRAPHY.body, fontSize: 15, lineHeight: 23, color: COLORS.body, textAlign: 'center', maxWidth: 350 },
  footer: { width: '100%', maxWidth: 420, alignSelf: 'center', gap: 14 },
  reassurance: { minHeight: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  reassuranceText: { ...TYPOGRAPHY.caption, color: COLORS.muted, fontSize: 12 },
});
