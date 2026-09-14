import React from 'react';
import { Text, View } from 'react-native';
import Icon from '../../../components/Icon';
import { STRENGTH_TYPE as T, useStrengthStyles } from '../strengthTheme';

const ICONS = { neutral: 'scan-outline', good: 'checkmark-circle-outline', adjust: 'scan-outline', important: 'alert-circle-outline' };

// Status comes from actual session state, never image brightness or cue wording.
export default function FramingGuide({ instruction, good = false, tone = good ? 'good' : 'neutral', icon }) {
  const { colors: c, styles: s } = useStrengthStyles(sheet);
  const foreground = tone === 'good' ? c.sage : tone === 'adjust' ? c.amber : tone === 'important' ? c.danger : c.body;
  const backgroundColor = tone === 'good' ? c.sageSoft : tone === 'adjust' ? c.amberSoft : tone === 'important' ? c.dangerSoft : c.surface;
  return <View style={[s.guide, { backgroundColor }]} accessibilityLiveRegion="polite">
    <Icon name={icon || ICONS[tone] || ICONS.neutral} size={20} color={foreground} />
    <Text style={[s.text, { color: foreground }]}>{instruction}</Text>
  </View>;
}
const sheet = () => ({
  guide: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 12 },
  text: { ...T.body, flex: 1, minWidth: 0 },
});
