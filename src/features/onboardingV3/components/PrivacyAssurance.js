import React from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import Icon from '../../../components/Icon';
import { COLORS, createThemedStyles, TYPOGRAPHY, WEB_FOCUS } from '../../../utils/constants';

/**
 * Clean, lightweight privacy assurance card.
 * Non-clinical, non-legalistic.
 */
export default function PrivacyAssurance({ text, compact = false }) {
  return (
    <View style={[styles.card, compact && styles.cardCompact]}>
      <View style={styles.iconCircle}>
        <Icon name="lock-closed-outline" size={15} color={COLORS.sage} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.title}>Private & safe</Text>
        <Text style={styles.text}>
          {text || 'Your health information stays strictly private. Bloom never sells or trades personal health records.'}
        </Text>
      </View>
    </View>
  );
}

const styles = createThemedStyles({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.sageLight,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 18,
    gap: 12,
  },
  cardCompact: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 12,
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
  },
  title: {
    ...TYPOGRAPHY.caption,
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.sage,
  },
  text: {
    ...TYPOGRAPHY.microcopy,
    fontSize: 12,
    lineHeight: 16,
    color: COLORS.body,
    marginTop: 1,
  },
});
