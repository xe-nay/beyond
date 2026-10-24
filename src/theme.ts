// Midnight palette: black canvas, navy surfaces, cyan for interaction, lime for achievement.
export const colors = {
  black: '#000000',
  bg: '#03060D',
  surface: '#0A1120',
  surface2: '#101A2C',
  surface3: '#162237',
  hairline: 'rgba(140, 170, 220, 0.12)',
  hairlineStrong: 'rgba(140, 170, 220, 0.24)',
  text: '#F5F8FC',
  dim: 'rgba(200, 214, 235, 0.62)',
  faint: 'rgba(200, 214, 235, 0.36)',
  cyan: '#37E5F3',
  cyanSoft: 'rgba(55, 229, 243, 0.14)',
  lime: '#BEF85A',
  limeSoft: 'rgba(190, 248, 90, 0.14)',
  amber: '#FFB547',
  red: '#FF5A6E',
  blue: '#3D7BFF',
  protein: '#37E5F3',
  carbs: '#BEF85A',
  fat: '#FFB547',
  steel: '#9AA6B8',
};

export const radius = { sm: 10, md: 16, lg: 22, xl: 28, pill: 999 };
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

// System font throughout; tabular digits keep timers and weights from jittering.
export const type = {
  hero: { fontSize: 56, fontWeight: '700' as const, letterSpacing: -1.5, fontVariant: ['tabular-nums' as const] },
  big: { fontSize: 34, fontWeight: '700' as const, letterSpacing: -0.6, fontVariant: ['tabular-nums' as const] },
  title: { fontSize: 22, fontWeight: '700' as const, letterSpacing: -0.3 },
  headline: { fontSize: 17, fontWeight: '600' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  label: { fontSize: 13, fontWeight: '500' as const },
  caption: { fontSize: 11, fontWeight: '600' as const, letterSpacing: 0.6, textTransform: 'uppercase' as const },
  num: { fontVariant: ['tabular-nums' as const] },
};

// Motion tokens (Emil Kowalski's curves, as used in the animate-expo guidance).
export const ease = {
  out: [0.23, 1, 0.32, 1] as const,
  inOut: [0.77, 0, 0.175, 1] as const,
  sheet: [0.32, 0.72, 0, 1] as const,
};

export function alpha(hex: string, a: number) {
  const v = hex.replace('#', '');
  return `rgba(${parseInt(v.slice(0, 2), 16)}, ${parseInt(v.slice(2, 4), 16)}, ${parseInt(v.slice(4, 6), 16)}, ${a})`;
}
