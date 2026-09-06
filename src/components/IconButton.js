import React from 'react';
import { Platform, Pressable } from 'react-native';
import Icon from './Icon';
import { useReducedMotion } from './Motion';
import { COLORS, createThemedStyles, SIZES, RADIUS, WEB_FOCUS } from '../utils/constants';

/**
 * IconButton — single unified "icon as control" tap target.
 * Consistent 44+pt hit target, pressed/hover/focus-visible/disabled states,
 * and optional visible background. Replaces ad-hoc Pressable+Icon pairs.
 */
export default function IconButton({
  icon,
  onPress,
  size = 22,
  color,
  accessibilityLabel,
  accessibilityHint,
  disabled = false,
  variant = 'quiet', // quiet | filled | outline
  containerSize = SIZES.xxl, // default 48pt hit target
  style,
  ...pressableProps
}) {
  const reduceMotion = useReducedMotion();
  const isDisabled = disabled;
  return (
    <Pressable
      {...pressableProps}
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole='button'
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isDisabled }}
      style={(state) => [
        styles.base,
        styles[variant],
        state.hovered && !isDisabled && (variant === 'filled' ? styles.filledHover : styles.hover),
        state.focused && !isDisabled && styles.focused,
        state.pressed && !isDisabled && styles.pressed,
        state.pressed && !isDisabled && !reduceMotion && styles.pressedScale,
        isDisabled && styles.disabled,
        { width: Math.max(48, containerSize), height: Math.max(48, containerSize), borderRadius: RADIUS.pill },
        typeof style === 'function' ? style(state) : style,
      ]}
    >
      <Icon
        name={icon}
        size={size}
        color={isDisabled ? COLORS.muted : color || (variant === 'filled' ? COLORS.onBrand : COLORS.ink)}
      />
    </Pressable>
  );
}

const styles = createThemedStyles({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: { cursor: 'pointer' },
      default: {},
    }),
  },
  quiet: { backgroundColor: 'transparent' },
  outline: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.hairline,
  },
  filled: { backgroundColor: COLORS.brand },
  filledHover: { backgroundColor: COLORS.brandHover },
  hover: { backgroundColor: COLORS.surfaceSoft },
  pressed: { opacity: 0.75 },
  pressedScale: { transform: [{ scale: 0.96 }] },
  focused: Platform.select({ web: WEB_FOCUS, default: {} }),
  disabled: { opacity: 0.5 },
});
