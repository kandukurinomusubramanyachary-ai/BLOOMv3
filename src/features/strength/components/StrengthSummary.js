import React from 'react';
import { Text, View } from 'react-native';
import { EXERCISE_COPY } from '../constants';
import { STRENGTH_TYPE as T, useStrengthStyles } from '../strengthTheme';
import SessionCompletion from './SessionCompletion';
import { StrengthNote } from './StrengthUI';

function formatDuration(seconds) {
  const safe = Math.max(0, Math.floor(Number(seconds) || 0));
  return Math.floor(safe / 60) + ':' + String(safe % 60).padStart(2, '0');
}

export default function StrengthSummary({
  summary, observation, focus, synced, onDone, onAgain, doneLabel = 'Done',
  localSaveError, onRetryLocal, savingLocal = false,
}) {
  const { styles: s } = useStrengthStyles(sheet);
  const completed = summary.completionState === 'completed';
  const exerciseName = EXERCISE_COPY[summary.exerciseId]?.name || 'Your movement';
  return <SessionCompletion
    title={completed ? 'Beautiful work.' : 'You made time to move.'}
    subtitle={exerciseName + (completed ? ' complete' : ' · session ended')}
    stats={[
      { value: summary.acceptedReps, label: 'Tracked reps' },
      { value: formatDuration(summary.durationSeconds), label: 'Session time' },
    ]}
    saving={savingLocal} saveError={localSaveError} onRetrySave={onRetryLocal}
    savedMessage={synced ? 'Saved to your Bloom account.' : 'Saved on this device. Account sync is pending.'}
    onDone={onDone} doneLabel={doneLabel} onAgain={onAgain}
    details={observation ? <View style={s.detail}>
      <Text style={s.detailTitle}>What Bloom noticed</Text><Text style={s.detailBody}>{observation}</Text>
      <Text style={s.disclaimer}>Camera guidance is an estimate, not a professional form assessment.</Text>
    </View> : null}
  >
    {focus ? <StrengthNote tone="neutral" icon="bulb-outline" title="For your next set">{focus}</StrengthNote> : null}
  </SessionCompletion>;
}

const sheet = c => ({
  detail: { gap: 8 }, detailTitle: { ...T.heading, color: c.ink },
  detailBody: { ...T.body, color: c.body }, disclaimer: { ...T.supporting, color: c.muted, marginTop: 8 },
});
