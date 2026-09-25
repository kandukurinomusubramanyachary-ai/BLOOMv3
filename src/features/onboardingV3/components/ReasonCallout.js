import React from 'react';
import { View, Text } from 'react-native';
import Icon from '../../../components/Icon';
import { COLORS, createThemedStyles, TYPOGRAPHY } from '../../../utils/constants';

/**
 * Reusable microcopy callout with discreet icon.
 * Used to explain "Why we ask this" in 1 concise sentence.
 */
export default function ReasonCallout({ text, title = 'Why Bloom asks this' }) {
  if (!text) return null;

  return (
    <View style={styles.container}>
      <Icon name="information-circle-outline" size={16} color={COLORS.sage} />
      <View style={styles.textWrap}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.text}>{text}</Text>
      </View>
    </View>
  );
}

const styles = createThemedStyles({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.surfaceWarm,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 14,
    marginBottom: 8,
    gap: 8,
  },
  textWrap: {
    flex: 1,
  },
  title: {
    ...TYPOGRAPHY.caption,
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.sage,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  text: {
    ...TYPOGRAPHY.microcopy,
    fontSize: 12,
    lineHeight: 16,
    color: COLORS.body,
  },
});
