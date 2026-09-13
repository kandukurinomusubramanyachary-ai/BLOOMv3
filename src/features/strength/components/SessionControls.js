import React from 'react';
import { View } from 'react-native';
import { useStrengthStyles } from '../strengthTheme';
import { StrengthButton } from './StrengthUI';

export default function SessionControls({ paused, muted, onPause, onMute, onStop, voiceAvailable = true, disabled = false }) {
  const { styles: s } = useStrengthStyles(sheet);
  return <View style={s.row} accessibilityLabel="Session controls">
    {voiceAvailable ? <StrengthButton title={muted ? 'Unmute' : 'Mute'} icon={muted ? 'volume-mute-outline' : 'volume-high-outline'} variant="secondary" onPress={onMute} disabled={disabled} style={s.control} /> : null}
    <StrengthButton title={paused ? 'Resume' : 'Pause'} icon={paused ? 'play-outline' : 'pause-outline'} onPress={onPause} disabled={disabled} style={s.control} />
    <StrengthButton title="Finish" accessibilityLabel="Finish and save session" variant="secondary" onPress={onStop} disabled={disabled} style={s.control} />
  </View>;
}
const sheet = () => ({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'stretch', gap: 8, width: '100%' },
  control: { flex: 1, minWidth: 84, paddingHorizontal: 8, gap: 6, paddingVertical: 14 },
});
