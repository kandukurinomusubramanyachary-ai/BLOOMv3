import React from 'react';
import { Text, View } from 'react-native';
import { STRENGTH_TYPE as T, useStrengthStyles } from './strengthTheme';
import { StrengthButton, StrengthHeader, StrengthNote, StrengthScreenFrame } from './components/StrengthUI';

// No native pose-landmarker module exists in this build. Choosing guided is explicit.
export default function TrackedStrengthScreen({ exercise, onFallback, onExit }) {
  const { styles: s } = useStrengthStyles(sheet);
  return <StrengthScreenFrame header={<StrengthHeader title={exercise?.name || 'Strength'} onBack={onExit} />}>
    <View style={s.content}>
      <Text accessibilityRole="header" style={s.title}>Your movement, without a camera.</Text>
      <Text style={s.body}>Camera tracking isn’t supported in this app build. You can still follow a paced, camera-free workout.</Text>
      <StrengthNote icon="videocam-off-outline">Guided reps follow a timer. They are not measured from your movement.</StrengthNote>
      <StrengthButton title="Continue guided" onPress={onFallback} />
    </View>
  </StrengthScreenFrame>;
}
const sheet = c => ({ content: { gap: 24, paddingVertical: 24 }, title: { ...T.title, color: c.ink }, body: { ...T.body, color: c.body } });
