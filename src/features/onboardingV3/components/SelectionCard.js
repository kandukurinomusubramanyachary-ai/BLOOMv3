import React from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import Icon from '../../../components/Icon';
import { COLORS, createThemedStyles, TYPOGRAPHY, WEB_FOCUS } from '../../../utils/constants';

/**
 * Reusable, responsive selection card for single/multi select options.
 * Matches Bloom's clean organic aesthetic, generous tap targets, and accessibility.
 */
export default function SelectionCard({
  label,
  description,
  tag,
  icon,
  selected = false,
  onPress,
  multiple = false,
  disabled = false,
  badgeColor,
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole={multiple ? 'checkbox' : 'button'}
      accessibilityState={{ selected, checked: selected, disabled }}
      accessibilityLabel={label}
      accessibilityHint={description}
      style={({ pressed, hovered, focused }) => [
        styles.card,
        selected && styles.cardSelected,
        hovered && !disabled && styles.cardHovered,
        focused && !disabled && styles.cardFocused,
        pressed && !disabled && styles.cardPressed,
      ]}
    >
      <View style={styles.contentRow}>
        {icon ? (
          <View style={[styles.iconWrap, selected && styles.iconWrapSelected]}>
            <Icon
              name={icon}
              size={20}
              color={selected ? COLORS.brand : COLORS.body}
            />
          </View>
        ) : null}

        <View style={styles.textWrap}>
          <View style={styles.titleRow}>
            <Text style={[styles.label, selected && styles.labelSelected]}>
              {label}
            </Text>
            {tag ? (
              <View style={[styles.badge, badgeColor ? { backgroundColor: badgeColor } : null]}>
                <Text style={styles.badgeText}>{tag}</Text>
              </View>
            ) : null}
          </View>
          {description ? (
            <Text style={[styles.description, selected && styles.descriptionSelected]}>
              {description}
            </Text>
          ) : null}
        </View>

        <View style={[styles.checkCircle, selected && styles.checkCircleSelected]}>
          {selected ? (
            <Icon name="checkmark" size={14} color={COLORS.onBrand} />
          ) : (
            <View style={styles.unselectedDot} />
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = createThemedStyles({
  card: {
    width: '100%',
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderColor: COLORS.hairline,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
    ...Platform.select({
      web: { cursor: 'pointer', transition: 'all 0.15s ease' },
      default: {},
    }),
  },
  cardSelected: {
    backgroundColor: COLORS.brandSoft,
    borderColor: COLORS.brand,
  },
  cardHovered: {
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.surfaceSoft,
  },
  cardFocused: Platform.select({
    web: WEB_FOCUS,
    default: {},
  }),
  cardPressed: {
    transform: [{ scale: 0.99 }],
    opacity: 0.95,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapSelected: {
    backgroundColor: COLORS.white,
  },
  textWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  label: {
    ...TYPOGRAPHY.componentTitle,
    color: COLORS.ink,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
  },
  labelSelected: {
    color: COLORS.ink,
  },
  description: {
    ...TYPOGRAPHY.supporting,
    color: COLORS.muted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  descriptionSelected: {
    color: COLORS.body,
  },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: COLORS.surfaceStrong,
  },
  badgeText: {
    ...TYPOGRAPHY.caption,
    fontSize: 11,
    color: COLORS.body,
    fontWeight: '500',
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.hairline,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
  },
  checkCircleSelected: {
    backgroundColor: COLORS.brand,
    borderColor: COLORS.brand,
  },
  unselectedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'transparent',
  },
});
