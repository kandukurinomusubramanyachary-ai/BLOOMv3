import React, { useState } from 'react';
import { Platform, Text, View } from 'react-native';
import Icon from '../../../components/Icon';
import { LEVELS, FOCUS_AREAS } from '../data/exerciseLibrary';
import { exerciseSeconds, equipmentFor } from '../data/workoutPlans';
import { supportsPoseTracking } from '../poseCapability';
import { STRENGTH_TYPE as T, useStrengthStyles } from '../strengthTheme';
import { StrengthButton, StrengthHeader, StrengthScreenFrame, StrengthNote } from './StrengthUI';
import MovementGuide from './MovementGuide';
export default function ExerciseDetail({ exercise, onBack, onStart, initialSets, inspectOnly = false, onChangeSets }) {
  const { colors: c, styles: s } = useStrengthStyles(sheet);
  const [sets, setSets] = useState(initialSets || exercise.defaultSets || 3);
  const trackable = Platform.OS === 'web' && supportsPoseTracking(exercise.id);
  const chooseSets = n => { setSets(n); onChangeSets?.(n); };
  return <StrengthScreenFrame header={<StrengthHeader title={inspectOnly ? 'Movement details' : 'Your session'} onBack={onBack} backLabel="Back to exercises" />}
    footer={<StrengthButton title={inspectOnly ? 'Back to workout' : 'Start workout'} icon={inspectOnly ? undefined : 'play'} onPress={() => inspectOnly ? onBack() : onStart(exercise, sets)} testID="strength-start-session" />}>
    <View style={s.heading}><Text accessibilityRole="header" style={s.title}>{exercise.name}</Text><Text style={s.body}>{exercise.intro}</Text></View>
    <View style={s.metadata}><Text style={s.meta}>~{Math.ceil(exerciseSeconds(exercise, sets) / 60)} min</Text><Text style={s.meta}>{LEVELS[exercise.level].label}</Text><Text style={s.meta}>{FOCUS_AREAS.find(item => item.id === exercise.focus)?.label}</Text></View>
    <View style={s.equipment}><Icon name="fitness-outline" size={20} color={c.accent} /><Text style={[s.body, s.flex]}>{equipmentFor(exercise)} · No weights needed</Text></View>
    <View style={s.section}><Text style={s.sectionTitle}>Make it your own</Text><Text style={s.body}>{exercise.mode === 'hold' ? exercise.holdSec + '-second hold' : exercise.defaultReps + ' reps'} per set · {exercise.restSec}s rest between sets</Text>
      <View style={s.sets}>{[1, 2, 3, 4, 5].map(n => <StrengthButton key={n} title={String(n)} accessibilityLabel={n + ' sets'} accessibilityState={{ selected: n === sets }} variant={n === sets ? 'primary' : 'secondary'} onPress={() => chooseSets(n)} style={s.set} />)}</View><Text style={s.supporting}>{sets} set{sets === 1 ? '' : 's'} selected. A shorter session counts, too.</Text>
    </View>
    <MovementGuide exercise={exercise} />
    <StrengthNote icon={trackable ? 'videocam-outline' : 'time-outline'} title={trackable ? 'Camera guidance available' : 'Camera-free guidance'}>{trackable ? 'Choose camera guidance or a paced session before you begin. Your camera is off until you enable it.' : 'Follow the timer at a comfortable pace. Guided reps are paced, not measured, and no camera is used.'}</StrengthNote>
    <Text style={s.supporting}>Move through a comfortable range. Stop if anything hurts or you feel unwell.</Text>
  </StrengthScreenFrame>;
}
const sheet = c => ({
  heading: { gap: 12 }, title: { ...T.title, color: c.ink }, body: { ...T.body, color: c.body }, supporting: { ...T.supporting, color: c.muted }, flex: { flex: 1, minWidth: 0 },
  metadata: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, meta: { ...T.supporting, color: c.body, backgroundColor: c.surface, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  equipment: { flexDirection: 'row', gap: 8, alignItems: 'center' }, section: { gap: 12 }, sectionTitle: { ...T.heading, color: c.ink },
  sets: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, set: { flex: 1, paddingHorizontal: 8, minWidth: 48 },
});
