import React from 'react';
import { Text, View } from 'react-native';
import { COLORS, createThemedStyles, RADIUS, TYPOGRAPHY } from '../utils/constants';

const TONES = {
  neutral: { bg: COLORS.surfaceSoft, fg: COLORS.body },
  brand: { bg: COLORS.brandSoft, fg: COLORS.brand },
  cycle: { bg: COLORS.surfaceWarm, fg: COLORS.cycle },
  sage: { bg: COLORS.sageLight, fg: COLORS.sage },
  warning: { bg: COLORS.warningSoft, fg: COLORS.warning },
  danger: { bg: COLORS.errorSoft, fg: COLORS.error },
};

/**
 * StateChip — small compact label for status/phase/tag. Restrained, pill only
 * where it genuinely reads as a tag; otherwise uses a soft square.
 */
export default function StateChip({ label, tone = 'neutral', icon, style, pill = false }) {
  const palette = TONES[tone] || TONES.neutral;
  return (
    <View
      accessibilityRole="text"
      style={[styles.chip, { backgroundColor: palette.bg }, pill && styles.pill, style]}
    >
      {icon ? (
        <Text style={styles.icon} aria-hidden="true">{icon}</Text>
      ) : null}
      <Text style={[styles.text, { color: palette.fg }]}>{label}</Text>
    </View>
  );
}

const styles = createThemedStyles({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.md,
  },
  pill: { borderRadius: RADIUS.pill, paddingHorizontal: 12 },
  text: {
    ...TYPOGRAPHY.caption,
    fontWeight: '700',
  },
  icon: { fontSize: 12 },
});
