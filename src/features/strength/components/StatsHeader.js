import React from 'react';
import { Text, View } from 'react-native';
import Icon from '../../../components/Icon';
import { useStrengthStyles, STRENGTH_TYPE as T } from '../strengthTheme';
export default function StatsHeader({ stats }) {
  const { colors: c, styles: s } = useStrengthStyles(sheet);
  return <View style={s.section}>
    <View style={s.heading}><Text style={s.title}>Your week, at your pace</Text><Text style={s.subtitle}>{stats.activeDays ? stats.activeDays + ' active days in the last 7 days' : 'There is room to begin, whenever you are ready.'}</Text></View>
    <View style={s.week}>{stats.days.map(day => <View key={day.key} accessible accessibilityLabel={day.label + ': ' + day.count + ' saved sessions'} style={s.day}>
      <View style={[s.marker, day.count > 0 && s.filled]}>{day.count > 0 ? <Icon name="checkmark" size={19} color={c.sage} /> : <View style={s.dot} />}</View><Text style={s.dayName}>{day.label}</Text>
    </View>)}</View>
    {stats.weekSessions > 0 ? <Text style={s.subtitle}>{stats.weekSessions} movement sessions · {stats.weekMinutes} minutes including rests</Text> : null}
  </View>;
}
const sheet = c => ({
  section: { gap: 20, paddingVertical: 8 }, heading: { gap: 8 }, title: { ...T.heading, color: c.ink }, subtitle: { ...T.supporting, color: c.muted },
  week: { flexDirection: 'row', gap: 4, justifyContent: 'space-between' }, day: { flex: 1, minWidth: 0, alignItems: 'center', gap: 8 },
  marker: { width: 32, height: 32, borderRadius: 16, backgroundColor: c.surface, justifyContent: 'center', alignItems: 'center' }, filled: { backgroundColor: c.sageSoft }, dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: c.muted }, dayName: { fontSize: 12, lineHeight: 18, color: c.muted },
});
