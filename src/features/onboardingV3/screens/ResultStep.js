import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import Button from '../../../components/Button';
import Icon from '../../../components/Icon';
import { LotusMark } from '../../../components/BrandMark';
import { Entrance } from '../../../components/Motion';
import { COLORS, createThemedStyles, TYPOGRAPHY } from '../../../utils/constants';

export default function ResultStep({ summary, onPrimaryAction, onFinish }) {
  const action = summary.recommendedAction;
  const primaryInsight = summary.cards.find(card => card.highlight) || summary.cards[0];

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Entrance distance={8} duration={220} style={styles.shell}>
          <View style={styles.header}>
            <LotusMark size={42} decorative />
            <Text accessibilityRole="header" style={styles.title}>{summary.greeting}</Text>
            <Text style={styles.subtitle}>{primaryInsight.narrative}</Text>
          </View>

          <View style={styles.recommendedSection}>
            <Text style={styles.sectionLabel}>Your first step</Text>
            <View style={styles.recommendation}>
              <View style={styles.recIconWrap}>
                <Icon name={action.icon} size={23} color={COLORS.brand} />
              </View>
              <View style={styles.recCopy}>
                <Text style={styles.recTitle}>{action.title}</Text>
                <Text style={styles.recDesc}>{action.description}</Text>
              </View>
            </View>
            <Button
              title={action.actionLabel}
              onPress={() => onPrimaryAction?.(action)}
              accessibilityLabel={`${action.actionLabel}. ${action.title}`}
            />
          </View>

          <View style={styles.understoodSection}>
            <Text style={styles.sectionTitle}>What Bloom heard</Text>
            {summary.cards.map(card => (
              <View key={card.id} style={styles.insightRow}>
                <View style={styles.insightIcon}>
                  <Icon name={card.icon} size={17} color={card.highlight ? COLORS.brand : COLORS.body} />
                </View>
                <View style={styles.insightCopy}>
                  <Text style={styles.insightTitle}>{card.headline}</Text>
                  <Text style={styles.insightText}>{card.narrative}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.affirmation}>
            <Icon name="heart-outline" size={18} color={COLORS.brand} />
            <Text style={styles.affirmationText}>{summary.affirmation}</Text>
          </View>

          <Button title="Explore Bloom" variant="ghost" onPress={onFinish} accessibilityLabel="Continue to Bloom home" />
        </Entrance>
      </ScrollView>
    </View>
  );
}

const styles = createThemedStyles({
  container: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 22, paddingTop: 20, paddingBottom: 36, maxWidth: 440, width: '100%', alignSelf: 'center' },
  shell: { width: '100%' },
  header: { alignItems: 'center', marginBottom: 22, gap: 10 },
  title: { ...TYPOGRAPHY.screenTitle, fontSize: 27, lineHeight: 34, color: COLORS.ink, fontWeight: '700', textAlign: 'center' },
  subtitle: { ...TYPOGRAPHY.body, fontSize: 14, lineHeight: 21, color: COLORS.body, textAlign: 'center', maxWidth: 360 },
  recommendedSection: { width: '100%', marginBottom: 30 },
  sectionLabel: { ...TYPOGRAPHY.caption, color: COLORS.brand, fontWeight: '700', marginBottom: 9, textTransform: 'uppercase', letterSpacing: 0.6 },
  recommendation: { flexDirection: 'row', alignItems: 'center', gap: 13, padding: 16, marginBottom: 12, borderRadius: 16, backgroundColor: COLORS.brandSoft },
  recIconWrap: { width: 42, height: 42, borderRadius: 21, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center' },
  recCopy: { flex: 1, minWidth: 0 },
  recTitle: { ...TYPOGRAPHY.componentTitle, fontSize: 16, lineHeight: 21, color: COLORS.ink, fontWeight: '700', marginBottom: 3 },
  recDesc: { ...TYPOGRAPHY.supporting, fontSize: 13, lineHeight: 18, color: COLORS.body },
  understoodSection: { borderTopWidth: 1, borderTopColor: COLORS.hairline, paddingTop: 22, gap: 18 },
  sectionTitle: { ...TYPOGRAPHY.sectionTitle, color: COLORS.ink, fontSize: 19, lineHeight: 25 },
  insightRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  insightIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.surfaceSoft, alignItems: 'center', justifyContent: 'center' },
  insightCopy: { flex: 1, minWidth: 0 },
  insightTitle: { ...TYPOGRAPHY.componentTitle, color: COLORS.ink, fontSize: 15, lineHeight: 20, fontWeight: '600', marginBottom: 3 },
  insightText: { ...TYPOGRAPHY.supporting, color: COLORS.body, fontSize: 13, lineHeight: 19 },
  affirmation: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 26, marginBottom: 18, padding: 14, borderRadius: 14, backgroundColor: COLORS.surfaceWarm },
  affirmationText: { ...TYPOGRAPHY.supporting, color: COLORS.ink, fontSize: 13, lineHeight: 19, flex: 1 },
});
