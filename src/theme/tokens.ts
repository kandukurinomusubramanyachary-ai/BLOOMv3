/** Native adaptation of the supplied Airbnb reference and Bloom's warm palette. */
export const tokens = {
  colors: {
    canvas: '#FFFFFF', ink: '#222222', body: '#3F3F3F', muted: '#6A6A6A',
    primary: '#FF385C', primaryActive: '#E00B41', primaryDisabled: '#FFD1DA',
    soft: '#F7F7F7', line: '#EBEBEB', border: '#DDDDDD',
    rose: '#FFF0F2', peach: '#F5E7DC', sage: '#536D57', sageSoft: '#EDF3EE',
    error: '#C13515', camera: '#252923', white: '#FFFFFF',
  },
  space: {xs: 4, sm: 8, md: 12, base: 16, lg: 24, xl: 32, xxl: 48, section: 64},
  radius: {sm: 8, md: 14, lg: 20, xl: 32, pill: 999},
} as const;
