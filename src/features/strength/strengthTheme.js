import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { getActiveTheme, TYPOGRAPHY } from '../../utils/constants';

// Strength is a warm, task-focused room within Bloom, not a global rebrand.
const light = Object.freeze({
  canvas: '#FBF8F4', surface: '#F1EBE3', raised: '#FFFFFF',
  ink: '#302923', body: '#574D45', muted: '#72665C', line: '#DED5CA',
  accent: '#9F4D36', accentSoft: '#F5E3D9', onAccent: '#FFFFFF',
  sage: '#526B50', sageSoft: '#E7EDE2', amber: '#885B19', amberSoft: '#F5EACF',
  danger: '#A13D31', dangerSoft: '#F7E2DC', focus: '#9F4D36',
});
const dark = Object.freeze({
  canvas: '#191614', surface: '#27221E', raised: '#302923',
  ink: '#F7F0E8', body: '#DDD0C4', muted: '#BCAE9F', line: '#4A4037',
  accent: '#EFAB8F', accentSoft: '#422B23', onAccent: '#2C1B14',
  sage: '#AEC6A1', sageSoft: '#273023', amber: '#E6C084', amberSoft: '#382F20',
  danger: '#F4A79A', dangerSoft: '#432723', focus: '#EFAB8F',
});

export const STRENGTH_TYPE = Object.freeze({
  title: { ...TYPOGRAPHY.screenTitle, fontSize: 30, lineHeight: 36, letterSpacing: -0.6 },
  heading: { ...TYPOGRAPHY.sectionTitle, fontSize: 20, lineHeight: 26 },
  body: { ...TYPOGRAPHY.body, fontSize: 16, lineHeight: 24 },
  supporting: { ...TYPOGRAPHY.supporting, fontSize: 14, lineHeight: 20 },
  button: { ...TYPOGRAPHY.button, fontSize: 16, lineHeight: 22 },
});

export function useStrengthStyles(factory) {
  const colors = getActiveTheme() === 'dark' ? dark : light;
  const styles = useMemo(() => StyleSheet.create(factory(colors)), [factory, colors]);
  return { colors, styles };
}
