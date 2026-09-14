import React, { useState } from 'react';
import { Text, View } from 'react-native';
import Icon from '../../../components/Icon';
import { STRENGTH_TYPE as T, useStrengthStyles } from '../strengthTheme';
import { StrengthButton } from './StrengthUI';

// A readable step-by-step guide, never a placeholder for an unavailable video.
export default function MovementGuide({ exercise, compact = false }) {
  const { colors: c, styles: s } = useStrengthStyles(sheet);
  const [step, setStep] = useState(0);
  const steps = exercise.steps || [];
  const index = Math.min(step, Math.max(0, steps.length - 1));
  return <View style={[s.guide, compact && s.compact]}>
    <View style={s.top}><Icon name={exercise.icon || 'body-outline'} size={24} color={c.accent} /><Text style={s.label}>Movement guide</Text><Text style={s.count}>{index + 1} / {steps.length}</Text></View>
    <Text style={s.instruction} accessibilityLiveRegion="polite">{steps[index] || exercise.intro}</Text>
    <View style={s.actions}>
      <StrengthButton title="Previous" variant="ghost" disabled={index === 0} onPress={() => setStep(index - 1)} style={s.action} />
      <StrengthButton title={index === steps.length - 1 ? 'Read again' : 'Next step'} variant="secondary" onPress={() => setStep((index + 1) % Math.max(1, steps.length))} style={s.action} />
    </View>
  </View>;
}
const sheet = c => ({
  guide: { backgroundColor: c.surface, borderRadius: 16, padding: 20, gap: 24 }, compact: { gap: 16 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8 }, label: { ...T.supporting, fontWeight: '600', color: c.body, flex: 1 }, count: { ...T.supporting, color: c.muted, fontVariant: ['tabular-nums'] },
  instruction: { ...T.heading, color: c.ink, minHeight: 78 }, actions: { flexDirection: 'row', gap: 8 }, action: { flex: 1, paddingHorizontal: 12 },
});
