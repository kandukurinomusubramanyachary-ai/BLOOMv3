import React from 'react';
import { Pressable, Text, View } from 'react-native';
import Icon from '../../../components/Icon';
import { LEVELS, FOCUS_AREAS } from '../data/exerciseLibrary';
import { equipmentFor, exerciseSeconds } from '../data/workoutPlans';
import { useStrengthStyles, STRENGTH_TYPE as T } from '../strengthTheme';
export default function ExerciseCard({ exercise, onPress, testID, index, sets = exercise.defaultSets }) {
  const { colors: c, styles: s } = useStrengthStyles(sheet);
  const target = exercise.mode === 'hold' ? exercise.holdSec + 's hold' : exercise.defaultReps + ' reps';
  return <Pressable testID={testID} onPress={() => onPress(exercise)} accessibilityRole="button"
    accessibilityLabel={exercise.name + ', ' + target + ', ' + sets + ' sets, ' + LEVELS[exercise.level].label}
    style={({ pressed, focused, hovered }) => [s.row, hovered && { backgroundColor: c.surface }, focused && { borderColor: c.accent }, pressed && { opacity: 0.65 }]}>
    <View style={s.symbol}>{index != null ? <Text style={s.number}>{index + 1}</Text> : <Icon name={exercise.icon} size={24} color={c.accent} />}</View>
    <View style={s.copy}><Text style={s.name}>{exercise.name}</Text><Text style={s.meta}>{sets} sets · {target} · ~{Math.ceil(exerciseSeconds(exercise, sets) / 60)} min</Text><Text style={s.meta}>{FOCUS_AREAS.find(item => item.id === exercise.focus)?.label} · {equipmentFor(exercise)}</Text></View>
    <Icon name="chevron-forward" size={18} color={c.muted} />
  </Pressable>;
}
const sheet = c => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 20, borderBottomWidth: 1, borderColor: c.line, minHeight: 96 },
  symbol: { width: 40, alignItems: 'center', justifyContent: 'center' }, number: { ...T.heading, color: c.accent, fontVariant: ['tabular-nums'] },
  copy: { flex: 1, minWidth: 0, gap: 4 }, name: { ...T.body, fontWeight: '600', color: c.ink }, meta: { ...T.supporting, color: c.muted },
});
