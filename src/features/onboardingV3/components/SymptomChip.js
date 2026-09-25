import React from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import Icon from '../../../components/Icon';
import { COLORS, createThemedStyles, TYPOGRAPHY, WEB_FOCUS } from '../../../utils/constants';

/**
 * Clean compact chip for symptom selections.
 */
export default function SymptomChip({
  label,
  icon,
  selected = false,
  onPress,
  disabled = false,
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityState={{ selected, checked: selected, disabled }}
      accessibilityLabel={label}
      style={({ pressed, hovered, focused }) => [
        styles.chip,
        selected && styles.chipSelected,
        hovered && !disabled && styles.chipHovered,
        focused && !disabled && styles.chipFocused,
        pressed && !disabled && styles.chipPressed,
      ]}
    >
      {icon ? (
        <Icon
          name={icon}
          size={16}
          color={selected ? COLORS.brand : COLORS.muted}
        />
      ) : null}
      <Text style={[styles.label, selected && styles.labelSelected]}>
        {label}
      </Text>
      {selected ? (
        <Icon name="checkmark" size={13} color={COLORS.brand} />
      ) : null}
    </Pressable>
  );
}

const styles = createThemedStyles({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: COLORS.hairline,
    backgroundColor: COLORS.white,
    gap: 7,
    marginRight: 8,
    marginBottom: 10,
    ...Platform.select({
      web: { cursor: 'pointer', transition: 'all 0.15s ease' },
      default: {},
    }),
  },
  chipSelected: {
    backgroundColor: COLORS.brandSoft,
    borderColor: COLORS.brand,
  },
  chipHovered: {
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.surfaceSoft,
  },
  chipFocused: Platform.select({
    web: WEB_FOCUS,
    default: {},
  }),
  chipPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
  label: {
    ...TYPOGRAPHY.supporting,
    fontSize: 14,
    lineHeight: 18,
    color: COLORS.ink,
    fontWeight: '500',
  },
  labelSelected: {
    color: COLORS.ink,
    fontWeight: '600',
  },
});
