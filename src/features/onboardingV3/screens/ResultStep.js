import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, Platform } from 'react-native';
import Button from '../../../components/Button';
import Card from '../../../components/Card';
import Icon from '../../../components/Icon';
import { Entrance } from '../../../components/Motion';
import PrivacyAssurance from '../components/PrivacyAssurance';
import { COLORS, createThemedStyles, TYPOGRAPHY, WEB_FOCUS } from '../../../utils/constants';

/**
 * Screen 10 — Personalized Result & Recommended First Action
 * The emotional payoff: shows "Here's what Bloom understands about you" + ONE clear recommended action.
 */
export default function ResultStep({
  summary,
  fullResult,
  onPrimaryAction,
  onFinish,
  onReset,
}) {
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const action = summary.recommendedAction;

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Entrance distance={8} duration={220} style={styles.shell}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.badge}>
              <Icon name="sparkles" size={14} color={COLORS.brand} />
              <Text style={styles.badgeText}>YOUR PERSONALIZED BLOOM</Text>
            </View>
            <Text style={styles.title}>{summary.greeting}</Text>
            <Text style={styles.subtitle}>
              Here is what we’ve gathered from your answers so far:
            </Text>
          </View>

          {/* Cards summarizing the 3 key dimensions */}
          <View style={styles.cardsWrap}>
            {summary.cards.map((card, idx) => (
              <View
                key={card.id}
                style={[
                  styles.insightCard,
                  card.highlight && styles.insightCardHighlight,
                ]}
              >
                <View style={styles.cardHeader}>
                  <View style={[styles.cardIcon, card.highlight && styles.cardIconHighlight]}>
                    <Icon
                      name={card.icon}
                      size={18}
                      color={card.highlight ? COLORS.brand : COLORS.body}
                    />
                  </View>
                  <Text style={styles.cardHeadline}>{card.headline}</Text>
                </View>
                <Text style={styles.cardNarrative}>{card.narrative}</Text>
              </View>
            ))}
          </View>

          {/* Reassuring affirmation */}
          <View style={styles.affirmationBox}>
            <Icon name="heart-outline" size={18} color={COLORS.brand} />
            <Text style={styles.affirmationText}>{summary.affirmation}</Text>
          </View>

          {/* Recommended First Action Card */}
          <View style={styles.recommendedSection}>
            <View style={styles.recHeaderRow}>
              <Text style={styles.recEyebrow}>RECOMMENDED FIRST STEP</Text>
              <View style={styles.recBadge}>
                <Text style={styles.recBadgeText}>{action.badge}</Text>
              </View>
            </View>

            <Card elevated variant="default" style={styles.recCard}>
              <View style={styles.recCardContent}>
                <View style={styles.recIconWrap}>
                  <Icon name={action.icon} size={24} color={COLORS.brand} />
                </View>
                <View style={styles.recCopy}>
                  <Text style={styles.recTitle}>{action.title}</Text>
                  <Text style={styles.recDesc}>{action.description}</Text>
                </View>
              </View>
            </Card>
          </View>

          <PrivacyAssurance />

          {/* Development / Preview Technical Inspection Accordion */}
          <View style={styles.technicalSection}>
            <Pressable
              onPress={() => setShowTechnicalDetails((v) => !v)}
              style={({ pressed, hovered, focused }) => [
                styles.inspectToggle,
                hovered && styles.inspectHovered,
                focused && styles.inspectFocused,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Toggle developer payload details"
            >
              <Icon
                name={showTechnicalDetails ? 'chevron-down' : 'chevron-forward'}
                size={16}
                color={COLORS.muted}
              />
              <Text style={styles.inspectText}>
                {showTechnicalDetails ? 'Hide Onboarding & Meg Handoff Contracts' : 'Inspect Developer Payload & Handoff Contracts'}
              </Text>
            </Pressable>

            {showTechnicalDetails ? (
              <View style={styles.jsonBox}>
                <Text style={styles.jsonTitle}>1. Canonical Onboarding Record:</Text>
                <Text style={styles.jsonCode}>
                  {JSON.stringify(fullResult.onboardingRecord, null, 2)}
                </Text>

                <Text style={[styles.jsonTitle, { marginTop: 12 }]}>2. Meg AI Handoff Context:</Text>
                <Text style={styles.jsonCode}>
                  {JSON.stringify(fullResult.megHandoff, null, 2)}
                </Text>

                <Text style={[styles.jsonTitle, { marginTop: 12 }]}>3. Home Screen Personalization Contract:</Text>
                <Text style={styles.jsonCode}>
                  {JSON.stringify(fullResult.homePersonalizationHandoff, null, 2)}
                </Text>
              </View>
            ) : null}
          </View>
        </Entrance>

        {/* Footer CTAs */}
        <View style={styles.footer}>
          <Button
            title={action.actionLabel}
            onPress={() => onPrimaryAction?.(action)}
            accessibilityLabel={`${action.actionLabel}. ${action.title}`}
          />
          <Button
            title="Take me to Bloom Home"
            variant="ghost"
            onPress={onFinish}
            accessibilityLabel="Take me to Bloom Home"
          />
          {onReset ? (
            <Button
              title="Restart Onboarding Preview"
              variant="ghost"
              onPress={onReset}
              accessibilityLabel="Restart onboarding preview from beginning"
              style={styles.resetBtn}
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
    paddingHorizontal: 22,
    paddingTop: 16,
    paddingBottom: 36,
    maxWidth: 440,
    width: '100%',
    alignSelf: 'center',
  },
  shell: {
    width: '100%',
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    backgroundColor: COLORS.brandSoft,
    marginBottom: 10,
  },
  badgeText: {
    ...TYPOGRAPHY.eyebrow,
    color: COLORS.brand,
    letterSpacing: 0.8,
  },
  title: {
    ...TYPOGRAPHY.screenTitle,
    fontSize: 26,
    lineHeight: 33,
    color: COLORS.ink,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    ...TYPOGRAPHY.body,
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.muted,
    textAlign: 'center',
  },
  cardsWrap: {
    gap: 10,
    marginBottom: 16,
  },
  insightCard: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.hairline,
    padding: 14,
  },
  insightCardHighlight: {
    borderColor: COLORS.brandSoft,
    backgroundColor: COLORS.surfaceWarm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  cardIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIconHighlight: {
    backgroundColor: COLORS.white,
  },
  cardHeadline: {
    ...TYPOGRAPHY.componentTitle,
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.ink,
  },
  cardNarrative: {
    ...TYPOGRAPHY.supporting,
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.body,
  },
  affirmationBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.brandSoft,
    borderRadius: 14,
    padding: 14,
    gap: 10,
    marginBottom: 22,
  },
  affirmationText: {
    ...TYPOGRAPHY.supporting,
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.ink,
    flex: 1,
    fontWeight: '500',
  },
  recommendedSection: {
    width: '100%',
    marginBottom: 10,
  },
  recHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  recEyebrow: {
    ...TYPOGRAPHY.eyebrow,
    color: COLORS.brand,
    letterSpacing: 0.8,
  },
  recBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceSoft,
  },
  recBadgeText: {
    ...TYPOGRAPHY.caption,
    fontSize: 11,
    color: COLORS.body,
    fontWeight: '600',
  },
  recCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: COLORS.brand,
    backgroundColor: COLORS.white,
  },
  recCardContent: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
  },
  recIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recCopy: {
    flex: 1,
  },
  recTitle: {
    ...TYPOGRAPHY.componentTitle,
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.ink,
    marginBottom: 2,
  },
  recDesc: {
    ...TYPOGRAPHY.supporting,
    fontSize: 13,
    lineHeight: 18,
    color: COLORS.muted,
  },
  technicalSection: {
    marginTop: 20,
    marginBottom: 10,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.hairlineSoft,
  },
  inspectToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  inspectHovered: {
    opacity: 0.8,
  },
  inspectFocused: Platform.select({
    web: WEB_FOCUS,
    default: {},
  }),
  inspectText: {
    ...TYPOGRAPHY.caption,
    fontSize: 12,
    color: COLORS.muted,
    fontWeight: '600',
  },
  jsonBox: {
    marginTop: 10,
    padding: 12,
    borderRadius: 10,
    backgroundColor: COLORS.surfaceSoft,
    borderWidth: 1,
    borderColor: COLORS.hairline,
  },
  jsonTitle: {
    ...TYPOGRAPHY.caption,
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.body,
    marginBottom: 4,
  },
  jsonCode: {
    fontFamily: Platform.select({ ios: 'Courier', android: 'monospace', web: 'monospace' }),
    fontSize: 11,
    lineHeight: 15,
    color: COLORS.ink,
  },
  footer: {
    width: '100%',
    gap: 10,
    marginTop: 24,
  },
  resetBtn: {
    marginTop: 4,
  },
  pressed: {
    opacity: 0.8,
  },
});
