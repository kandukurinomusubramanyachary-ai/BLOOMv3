import React from 'react';
import { ActivityIndicator, Platform, Pressable, Text, View } from 'react-native';
import Icon from './Icon';
import {
  COLORS, createThemedStyles, RADIUS, TYPOGRAPHY, WEB_FOCUS,
} from '../utils/constants';

/**
 * EmptyState, LoadingState, ErrorState — one calm, coherent set for the three
 * non-content states every list/panel can be in. Replaces per-screen one-offs.
 */

export function EmptyState({
  title,
  description,
  icon,
  action,
  tone = 'neutral',
}) {
  const iconColor = tone === 'brand' ? COLORS.brand : COLORS.muted;
  return (
    <View style={styles.wrapper}>
      {icon ? (
        <View style={[styles.iconCircle, tone === 'brand' && styles.iconCircleBrand]}>
          <Icon name={icon} size={26} color={iconColor} />
        </View>
      ) : null}
      <Text style={styles.emptyTitle}>{title}</Text>
      {description ? <Text style={styles.emptyDesc}>{description}</Text> : null}
      {action ? <View style={{ marginTop: 4 }}>{action}</View> : null}
    </View>
  );
}

export function LoadingState({ label = 'Loading…' }) {
  return (
    <View style={styles.wrapper} accessibilityRole="progressbar" accessibilityLabel={label}>
      <ActivityIndicator color={COLORS.brand} />
      <Text style={styles.loadingLabel}>{label}</Text>
    </View>
  );
}

export function ErrorState({
  title = 'Something went wrong',
  description,
  onRetry,
  icon = 'alert-circle-outline',
}) {
  return (
    <View style={styles.wrapper} accessibilityRole="alert">
      <View style={[styles.iconCircle, styles.iconCircleError]}>
        <Icon name={icon} size={26} color={COLORS.error} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {description ? <Text style={styles.emptyDesc}>{description}</Text> : null}
      {onRetry ? (
        <Pressable
          accessibilityRole="button"
          onPress={onRetry}
          style={({ pressed, focused }) => [styles.retry, { minHeight: 48, justifyContent: 'center' }, pressed && { opacity: 0.7 }, focused && Platform.select({ web: WEB_FOCUS, default: {} })]}
        >
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = createThemedStyles({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
    gap: 8,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  iconCircleBrand: { backgroundColor: COLORS.brandSoft },
  iconCircleError: { backgroundColor: COLORS.errorSoft },
  emptyTitle: {
    ...TYPOGRAPHY.componentTitle,
    color: COLORS.ink,
    textAlign: 'center',
  },
  emptyDesc: {
    ...TYPOGRAPHY.supporting,
    color: COLORS.muted,
    textAlign: 'center',
    maxWidth: 360,
  },
  loadingLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.muted,
  },
  retry: {
    marginTop: 6,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.brand,
    cursor: 'pointer',
  },
  retryText: {
    ...TYPOGRAPHY.button,
    color: COLORS.onBrand,
  },
});
