import React, { useState } from 'react';
import { Text, View, useWindowDimensions } from 'react-native';
import Icon from '../../../components/Icon';
import { Entrance } from '../../../components/Motion';
import { STRENGTH_TYPE as T, useStrengthStyles } from '../strengthTheme';
import { StrengthButton, StrengthNote } from './StrengthUI';

// Content only: the parent owns scrolling, including the camera screen.
export default function SessionCompletion({
  title = 'Beautiful work.', subtitle, stats = [], children, details,
  saving = false, saveError, savedMessage = 'Saved on this device.',
  onRetrySave, onDone, doneLabel = 'Done', onAgain, onLeave,
}) {
  const { colors: c, styles: s } = useStrengthStyles(sheet);
  const { fontScale } = useWindowDimensions();
  const [showDetails, setShowDetails] = useState(false);
  const canContinue = !saving && !saveError;

  return <View style={s.wrap} testID="strength-session-completion">
    <Entrance distance={8} scaleFrom={0.97} style={s.celebration}>
      <View style={s.mark}><Icon name="checkmark" size={32} color={c.sage} /></View>
      <Text accessibilityRole="header" style={s.title}>{title}</Text>
      <Text style={s.subtitle}>{subtitle}</Text>
    </Entrance>
    <Text style={s.encouragement}>You made room for yourself today. That counts.</Text>
    <View style={[s.stats, fontScale > 1.2 && s.statsLarge]}>
      {stats.map(({ label, value }) => <View key={label} style={s.stat}>
        <Text style={s.value}>{value}</Text><Text style={s.label}>{label}</Text>
      </View>)}
    </View>
    {children}
    {details ? <View style={s.details}>
      <StrengthButton title={showDetails ? 'Hide session summary' : 'View session summary'} variant="ghost"
        icon={showDetails ? 'chevron-up' : 'chevron-down'} onPress={() => setShowDetails(value => !value)}
        accessibilityState={{ expanded: showDetails }} />
      {showDetails ? details : null}
    </View> : null}
    <View style={s.actions}>
      {saveError ? <StrengthNote tone="important" icon="alert-circle-outline" title="Your result is still here">
        {saveError}
      </StrengthNote> : <Text style={s.saveStatus} accessibilityLiveRegion="polite">
        {saving ? 'Saving your session…' : savedMessage}
      </Text>}
      {saveError ? <StrengthButton title="Try saving again" onPress={onRetrySave} loading={saving} testID="strength-retry-save" /> : null}
      <StrengthButton title={saving ? 'Saving your session…' : doneLabel} onPress={onDone}
        variant={saveError ? 'secondary' : 'primary'} disabled={!canContinue} loading={saving} testID="strength-done" />
      {onAgain && canContinue ? <StrengthButton title="Move again" variant="ghost" icon="refresh-outline" onPress={onAgain} /> : null}
      {onLeave && saveError ? <StrengthButton title="Leave without saving" variant="ghost" onPress={onLeave} /> : null}
    </View>
  </View>;
}

const sheet = c => ({
  wrap: { width: '100%', gap: 24, paddingTop: 16, paddingBottom: 8 },
  celebration: { alignItems: 'center', gap: 12 },
  mark: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: c.sageSoft, marginBottom: 8 },
  title: { ...T.title, textAlign: 'center', color: c.ink }, subtitle: { ...T.body, textAlign: 'center', color: c.body },
  encouragement: { ...T.body, textAlign: 'center', color: c.body, maxWidth: 400, alignSelf: 'center' },
  stats: { flexDirection: 'row', flexWrap: 'wrap', borderTopWidth: 1, borderBottomWidth: 1, borderColor: c.line, paddingVertical: 20, gap: 16 },
  statsLarge: { flexDirection: 'column' },
  stat: { flex: 1, minWidth: 80, alignItems: 'center', gap: 4 },
  value: { ...T.title, fontSize: 28, lineHeight: 34, fontVariant: ['tabular-nums'], color: c.ink },
  label: { ...T.supporting, textAlign: 'center', color: c.body, maxWidth: '100%' },
  details: { gap: 12 }, actions: { gap: 12, paddingTop: 8 },
  saveStatus: { ...T.supporting, color: c.muted, textAlign: 'center' },
});
