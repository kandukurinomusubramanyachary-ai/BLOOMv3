import React, { useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import Icon from '../../components/Icon';
import { EXERCISE_COPY, STRENGTH_DEFAULTS } from './constants';
import { STRENGTH_TYPE as T, useStrengthStyles } from './strengthTheme';
import MovementGuide from './components/MovementGuide';
import { StrengthButton, StrengthHeader, StrengthNote, StrengthScreenFrame } from './components/StrengthUI';

// Legacy manual-count mode remains honest and usable without camera permission.
export default function StrengthUnsupportedScreen({ onBack, embedded = false, initialExerciseId = 'bodyweight-squat-v1' }) {
  const { colors: c, styles: s } = useStrengthStyles(sheet);
  const initial = EXERCISE_COPY[initialExerciseId] ? initialExerciseId : 'bodyweight-squat-v1';
  const [exerciseId, setExerciseId] = useState(initial);
  const [phase, setPhase] = useState(embedded ? 'ready' : 'select');
  const [count, setCount] = useState(0);
  const exercise = EXERCISE_COPY[exerciseId];
  const target = STRENGTH_DEFAULTS.targetReps;
  const choose = id => { setExerciseId(id); setCount(0); setPhase('ready'); };
  const returnToList = () => { setCount(0); setPhase('select'); };
  const back = phase === 'select' ? onBack : phase === 'active' ? () => setPhase('summary') : returnToList;

  const content = phase === 'select' ? <View style={s.section}>
    <Text accessibilityRole="header" style={s.title}>Move at home.</Text>
    <Text style={s.body}>Choose a movement, follow the instructions and count each repetition yourself.</Text>
    <View style={s.list}>
      {Object.entries(EXERCISE_COPY).map(([id, item]) => <Pressable key={id} onPress={() => choose(id)}
        accessibilityRole="button" accessibilityLabel={`${item.name}, ${target} repetitions, manual count`}
        style={({ pressed, focused }) => [s.option, focused && s.focused, pressed && { opacity: 0.7 }]}>
        <Icon name={item.icon} size={24} color={c.accent} />
        <View style={s.flex}><Text style={s.heading}>{item.name}</Text><Text style={s.supporting}>{target} reps · No camera needed</Text></View>
        <Icon name="chevron-forward" size={20} color={c.muted} />
      </Pressable>)}
    </View>
    <StrengthNote icon="videocam-off-outline">This version does not measure your movement or assess your form.</StrengthNote>
  </View> : phase === 'ready' ? <View style={s.section}>
    <Text accessibilityRole="header" style={s.title}>Ready for your set?</Text>
    <Text style={s.body}>{exercise.name} · {target} reps</Text>
    <MovementGuide key={exerciseId} exercise={exercise} />
    <Text style={s.supporting}>Tap “Count one rep” after each repetition. Move at a pace that feels comfortable.</Text>
    <StrengthButton title="Start guided set" icon="play-outline" onPress={() => setPhase('active')} />
    <StrengthButton title="Choose another exercise" variant="secondary" onPress={returnToList} />
  </View> : phase === 'active' ? <View style={s.section}>
    <Text accessibilityRole="header" style={s.title}>{exercise.name}</Text>
    <Text style={s.body}>Your pace. One repetition at a time.</Text>
    <MovementGuide key={exerciseId} exercise={exercise} compact />
    <View style={s.countWrap} accessible accessibilityLabel={`${count} of ${target} manually counted repetitions`}>
      <Text style={s.count}>{String(count).padStart(2, '0')}<Text style={s.target}> / {target}</Text></Text>
      <Text style={s.supporting}>Manually counted reps</Text>
    </View>
    <StrengthButton title={count >= target ? 'All reps counted' : 'Count one rep'} icon="add" disabled={count >= target} onPress={() => setCount(value => Math.min(target, value + 1))} />
    <StrengthButton title="Finish set" variant="secondary" onPress={() => setPhase('summary')} />
    <StrengthButton title="Undo last rep" variant="ghost" disabled={count === 0} onPress={() => setCount(value => Math.max(0, value - 1))} />
  </View> : <View style={s.section}>
    <Icon name="checkmark-circle-outline" size={32} color={c.sage} />
    <Text accessibilityRole="header" style={s.title}>{count >= target ? 'Beautiful work.' : 'Your movement still counts.'}</Text>
    <Text style={s.body}>{exercise.name} · {count} manually counted {count === 1 ? 'rep' : 'reps'}</Text>
    <StrengthNote icon="information-circle-outline">This manual practice set is not added to your workout history.</StrengthNote>
    <StrengthButton title="Choose another exercise" onPress={returnToList} />
    {onBack ? <StrengthButton title="Done" variant="secondary" onPress={onBack} /> : null}
  </View>;

  if (embedded) return <View style={s.embedded}>{content}</View>;
  return <StrengthScreenFrame header={<StrengthHeader title="Strength" subtitle="Manual guided practice" onBack={back} backLabel={phase === 'active' ? 'Finish guided set' : 'Back'} />}>{content}</StrengthScreenFrame>;
}

const sheet = c => ({
  section: { gap: 24 }, embedded: { width: '100%', paddingVertical: 20 }, flex: { flex: 1, minWidth: 0, gap: 4 },
  title: { ...T.title, color: c.ink }, heading: { ...T.heading, color: c.ink }, body: { ...T.body, color: c.body }, supporting: { ...T.supporting, color: c.muted },
  list: { width: '100%' }, option: { minHeight: 88, flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: c.line },
  countWrap: { alignItems: 'center', gap: 8, paddingVertical: 8 }, count: { color: c.ink, fontSize: 48, lineHeight: 56, fontWeight: '600', fontVariant: ['tabular-nums'] }, target: { ...T.heading, color: c.muted },
  focused: Platform.select({ web: { outlineStyle: 'solid', outlineColor: c.focus, outlineWidth: 2, outlineOffset: 3 }, default: { borderWidth: 2, borderColor: c.focus } }),
});
