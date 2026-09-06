import React, { useEffect } from 'react';
import { Animated, Easing, Platform, Pressable, Text, View } from 'react-native';
import Icon from './Icon';
import { useReducedMotion } from './Motion';
import { COLORS, createThemedStyles, TYPOGRAPHY, WEB_FOCUS, RADIUS } from '../utils/constants';

// Small inline spinner so a button's busy state is visible, not just a label swap.
function ButtonSpinner({ color }) {
  const reduceMotion = useReducedMotion();
  const spin = React.useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduceMotion) return undefined;
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 850,
        easing: Easing.linear,
        useNativeDriver: Platform.OS !== 'web',
      })
    );
    loop.start();
    return () => loop.stop();
  }, [spin, reduceMotion]);
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return (
    <View
      style={{ width: 18, height: 18 }}
      accessibilityLiveRegion="polite"
    >
      <Animated.View style={{ transform: [{ rotate }] }}>
        <Icon name="sync-outline" size={18} color={color} />
      </Animated.View>
    </View>
  );
}

export default function Button({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  success = false,
  icon,
  style,
  accessibilityLabel,
  accessibilityHint,
  onPressIn,
  onPressOut,
  loadingLabel = 'Saving…',
  successLabel = 'Done',
  ...pressableProps
}) {
  const reduceMotion = useReducedMotion();
  const isDisabled = disabled || loading || success;
  const isUnavailable = disabled && !loading && !success;
  const label = loading ? loadingLabel : success ? successLabel : title;

  return (
    <Pressable
      {...pressableProps}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={isDisabled}
      accessibilityRole='button'
      accessibilityLabel={accessibilityLabel || label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={(state) => {
        const { pressed, hovered, focused } = state;
        return [
          styles.button,
          success && styles.success,
          variant !== 'primary' && !success && (styles[variant] || styles.primary),
          variant === 'primary' && !success && styles.primary,
          hovered && !isDisabled && styles[`${variant}Hover`],
          focused && !isDisabled && styles.focused,
          pressed && !isDisabled && styles[`${variant}Pressed`],
          pressed && !isDisabled && !reduceMotion && styles.pressed,
          isUnavailable && styles.disabled,
          isDisabled && styles.disabledWeb,
          typeof style === 'function' ? style(state) : style,
        ];
      }}
    >
      <View style={styles.content}>
        {success ? (
          <Icon name="checkmark-circle" size={19} color={COLORS.onBrand} />
        ) : loading ? (
          <ButtonSpinner
            color={variant === 'primary' ? COLORS.onBrand : COLORS.ink}
          />
        ) : icon ? (
          <Icon
            name={icon}
            size={19}
            color={
              isUnavailable
                ? COLORS.muted
                : variant === 'primary'
                  ? COLORS.onBrand
                  : variant === 'danger'
                    ? COLORS.error
                    : COLORS.ink
            }
          />
        ) : null}
        <Text
          maxFontSizeMultiplier={1.4}
          style={[
            styles.text,
            variant === 'primary' && styles.primaryText,
            variant === 'danger' && styles.dangerText,
            success && styles.successText,
            variant !== 'primary' && variant !== 'danger' && !success && styles.secondaryText,
            isUnavailable && styles.disabledText,
          ]}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = createThemedStyles({
  button: {
    minHeight: 52,
    minWidth: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: RADIUS.md,
    ...Platform.select({
      web: { cursor: 'pointer' },
      default: {},
    }),
  },
  success: {
    backgroundColor: COLORS.success,
    borderColor: COLORS.success,
  },
  content: {
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primary: {
    backgroundColor: COLORS.brand,
  },
  primaryHover: {
    backgroundColor: COLORS.brandHover,
  },
  primaryPressed: {
    backgroundColor: COLORS.brandActive,
  },
  secondary: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.hairline,
  },
  secondaryHover: {
    backgroundColor: COLORS.surfaceSoft,
    borderColor: COLORS.borderStrong,
  },
  secondaryPressed: {
    backgroundColor: COLORS.surfaceStrong,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  ghostHover: {
    backgroundColor: COLORS.surfaceSoft,
  },
  ghostPressed: {
    backgroundColor: COLORS.surfaceStrong,
  },
  danger: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: '#E8C8C4',
  },
  dangerHover: {
    backgroundColor: '#FDF4F2',
    borderColor: '#DDAEA7',
  },
  dangerPressed: {
    backgroundColor: '#FBEAE7',
  },
  focused: Platform.select({
    web: WEB_FOCUS,
    default: {},
  }),
  disabled: {
    backgroundColor: COLORS.surfaceSoft,
    borderColor: COLORS.hairline,
  },
  disabledWeb: Platform.select({
    web: { cursor: 'not-allowed' },
    default: {},
  }),
  pressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.96,
  },
  text: {
    ...TYPOGRAPHY.button,
    flexShrink: 1,
    textAlign: 'center',
  },
  primaryText: {
    color: COLORS.onBrand,
  },
  successText: {
    color: COLORS.onBrand,
  },
  secondaryText: {
    color: COLORS.ink,
  },
  dangerText: {
    color: COLORS.error,
  },
  disabledText: {
    color: COLORS.muted,
  },
});
