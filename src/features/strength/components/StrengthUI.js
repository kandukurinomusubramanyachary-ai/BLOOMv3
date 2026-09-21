import React from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '../../../components/Icon';
import { useReducedMotion } from '../../../components/Motion';
import { STRENGTH_TYPE as T, useStrengthStyles } from '../strengthTheme';

export function StrengthButton({ title, onPress, variant = 'primary', icon, disabled = false, loading = false, style, testID, accessibilityLabel, ...props }) {
  const { colors: c, styles: s } = useStrengthStyles(sheet);
  const reduced = useReducedMotion();
  const unavailable = disabled || loading;
  const color = disabled ? c.muted : variant === 'primary' ? c.onAccent : variant === 'danger' ? c.danger : c.ink;
  return <Pressable {...props} testID={testID} onPress={onPress} disabled={unavailable}
    accessibilityRole="button" accessibilityLabel={accessibilityLabel || title}
    accessibilityState={{ ...props.accessibilityState, disabled: unavailable, busy: loading }}
    style={({ pressed, focused, hovered }) => [s.button, s[variant], disabled && s.disabled,
      hovered && !unavailable && { opacity: 0.88 }, focused && s.focused,
      pressed && !unavailable && { opacity: 0.82, ...(!reduced ? { transform: [{ scale: 0.98 }] } : {}) }, style]}>
    {loading ? <ActivityIndicator size="small" color={color} /> : icon ? <Icon name={icon} size={20} color={color} /> : null}
    <Text style={[s.buttonText, { color }]}>{title}</Text>
  </Pressable>;
}

export function StrengthHeader({ title, subtitle, icon, onBack, backLabel = 'Back', right, progress }) {
  const { colors: c, styles: s } = useStrengthStyles(sheet);
  return <View style={s.headerWrap}>
    <View style={s.header}>
      {onBack ? <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel={backLabel}
        style={({ pressed, focused }) => [s.iconButton, focused && s.focused, pressed && { opacity: 0.6 }]}>
        <Icon name="chevron-back" size={22} color={c.ink} />
      </Pressable> : null}
      <View style={s.headerCopy}>
        <View style={s.headerTitleRow}>
          {icon ? <Icon name={icon} size={24} color={c.accent} /> : null}
          <Text accessibilityRole="header" style={s.headerTitle}>{title}</Text>
        </View>
        {subtitle ? <Text style={s.supporting}>{subtitle}</Text> : null}
      </View>
      {right || null}
    </View>
    {progress != null ? <View accessible accessibilityRole="progressbar" accessibilityLabel="Workout progress" accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }} style={s.progressTrack}><View style={[s.progressFill, { width: `${Math.max(0, Math.min(1, progress)) * 100}%` }]} /></View> : null}
  </View>;
}

export function StrengthScreenFrame({ children, header, footer, contentStyle, testID, fitViewport = false, onViewportLayout }) {
  const { styles: s } = useStrengthStyles(sheet);
  const insets = useSafeAreaInsets();
  return <SafeAreaView testID={testID} style={[s.safe, fitViewport && Platform.OS === 'web' && { maxHeight: '100dvh' }]} edges={['top', 'left', 'right']}>
    {header}
    <ScrollView style={s.scroll} onLayout={onViewportLayout} contentContainerStyle={[s.content, contentStyle]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">{children}</ScrollView>
    {footer ? <View style={[s.footer, { paddingBottom: Math.max(20, insets.bottom + 8) }]}><View style={s.footerInner}>{footer}</View></View> : null}
  </SafeAreaView>;
}

export function StrengthNote({ children, tone = 'neutral', icon, title, style }) {
  const { colors: c, styles: s } = useStrengthStyles(sheet);
  const foreground = tone === 'good' ? c.sage : tone === 'adjust' ? c.amber : tone === 'important' ? c.danger : c.body;
  const background = tone === 'good' ? c.sageSoft : tone === 'adjust' ? c.amberSoft : tone === 'important' ? c.dangerSoft : c.surface;
  return <View style={[s.note, { backgroundColor: background }, style]} accessibilityLiveRegion={tone === 'important' ? 'polite' : 'none'}>
    {icon ? <Icon name={icon} size={20} color={foreground} /> : null}
    <View style={s.flex}>{title ? <Text style={[s.noteTitle, { color: foreground }]}>{title}</Text> : null}<Text style={[s.supporting, { color: foreground }]}>{children}</Text></View>
  </View>;
}

export function StrengthEmpty({ title, body, action, onAction, icon = 'barbell-outline' }) {
  const { colors: c, styles: s } = useStrengthStyles(sheet);
  return <View style={s.empty}><Icon name={icon} size={30} color={c.accent} /><Text style={s.emptyTitle}>{title}</Text><Text style={s.emptyBody}>{body}</Text>{action ? <StrengthButton title={action} variant="secondary" onPress={onAction} /> : null}</View>;
}

export function SetProgress({ current, total }) {
  const { styles: s } = useStrengthStyles(sheet);
  return <View style={s.setProgress} accessible accessibilityLabel={`Set ${current} of ${total}`}>
    {Array.from({ length: Math.min(5, total) }, (_, i) => <View key={i} style={[s.setSegment, i < current && s.setFilled]} />)}
  </View>;
}

export function StrengthSkeleton() {
  const { styles: s } = useStrengthStyles(sheet);
  return <View accessibilityLabel="Loading your strength history" accessibilityState={{ busy: true }} style={s.skeleton}>
    <View style={[s.skeletonLine, { width: '48%' }]} /><View style={[s.skeletonLine, { width: '75%' }]} /><View style={[s.skeletonLine, { height: 52, width: '100%' }]} />
  </View>;
}

const sheet = c => ({
  safe: { flex: 1, minHeight: 0, backgroundColor: c.canvas }, scroll: { flex: 1, minHeight: 0 },
  content: { flexGrow: 1, width: '100%', maxWidth: 680, alignSelf: 'center', padding: 20, paddingTop: 24, paddingBottom: 32, gap: 24 },
  headerWrap: { width: '100%', maxWidth: 720, alignSelf: 'center' },
  header: { paddingHorizontal: 20, paddingVertical: 12, minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerCopy: { flex: 1, minWidth: 0, gap: 4 }, headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 }, headerTitle: { ...T.heading, color: c.ink, flexShrink: 1 },
  supporting: { ...T.supporting, color: c.muted }, flex: { flex: 1, minWidth: 0 },
  iconButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  button: { minHeight: 52, minWidth: 48, paddingHorizontal: 20, paddingVertical: 14, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, ...Platform.select({ web: { cursor: 'pointer' } }) },
  buttonText: { ...T.button, fontWeight: '600', flexShrink: 1, textAlign: 'center' },
  primary: { backgroundColor: c.accent }, secondary: { backgroundColor: c.surface },
  ghost: { backgroundColor: 'transparent' }, danger: { backgroundColor: c.dangerSoft }, disabled: { backgroundColor: c.surface },
  focused: Platform.select({ web: { outlineStyle: 'solid', outlineColor: c.focus, outlineWidth: 2, outlineOffset: 3 }, default: { borderWidth: 2, borderColor: c.focus } }),
  footer: { backgroundColor: c.canvas, padding: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: c.line },
  footerInner: { width: '100%', maxWidth: 640, alignSelf: 'center', gap: 8 },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 16, borderRadius: 12 }, noteTitle: { ...T.supporting, fontWeight: '600', marginBottom: 4 },
  empty: { alignItems: 'flex-start', gap: 12, paddingVertical: 24 }, emptyTitle: { ...T.heading, color: c.ink }, emptyBody: { ...T.body, color: c.body },
  progressTrack: { height: 4, backgroundColor: c.surface, marginHorizontal: 20, borderRadius: 2, overflow: 'hidden' }, progressFill: { height: '100%', backgroundColor: c.accent },
  setProgress: { flexDirection: 'row', gap: 8, alignSelf: 'center', width: '100%', maxWidth: 240 }, setSegment: { flex: 1, height: 4, borderRadius: 2, backgroundColor: c.line }, setFilled: { backgroundColor: c.accent },
  skeleton: { gap: 12, paddingVertical: 8 }, skeletonLine: { height: 16, borderRadius: 4, backgroundColor: c.surface },
});
