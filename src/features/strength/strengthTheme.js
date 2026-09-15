import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import {
  DARK_COLORS,
  getActiveTheme,
  LIGHT_COLORS,
  TYPOGRAPHY,
} from '../../utils/constants';

function createStrengthColors(palette) {
  return Object.freeze({
    canvas: palette.canvas,
    surface: palette.surfaceSoft,
    raised: palette.surfaceStrong,
    ink: palette.ink,
    body: palette.body,
    muted: palette.muted,
    line: palette.hairline,
    accent: palette.accent || palette.brand,
    accentSoft: palette.accentSoft || palette.brandSoft,
    onAccent: palette.onBrand,
    focus: palette.focus,
    sage: palette.sage,
    sageSoft: palette.sageLight,
    amber: palette.warning,
    amberSoft: palette.warningSoft,
    danger: palette.danger,
    dangerSoft: palette.dangerSoft,
  });
}

const light = createStrengthColors(LIGHT_COLORS);
const dark = createStrengthColors(DARK_COLORS);

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
