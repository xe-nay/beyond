import { Platform, type TextStyle } from 'react-native';

// iOS dark system palette with a faint navy tint, cyan for interaction and lime for achievement.
export const colors = {
  black: '#000000',
  bg: '#000000',
  surface: '#14171D', // secondarySystemGroupedBackground, tinted
  surface2: '#1E222A', // tertiary
  surface3: '#2B303A', // quaternary / fills
  hairline: 'rgba(120, 128, 150, 0.22)', // separator
  hairlineStrong: 'rgba(150, 160, 185, 0.32)',
  text: '#FFFFFF',
  dim: 'rgba(235, 238, 245, 0.62)', // secondaryLabel
  faint: 'rgba(235, 238, 245, 0.32)', // tertiaryLabel
  cyan: '#40E0F0',
  cyanSoft: 'rgba(64, 224, 240, 0.16)',
  lime: '#C2F95C',
  limeSoft: 'rgba(194, 249, 92, 0.16)',
  amber: '#FFB340',
  red: '#FF453A', // systemRed (dark)
  blue: '#0A84FF', // systemBlue (dark)
  protein: '#40E0F0',
  carbs: '#C2F95C',
  fat: '#FFB340',
  steel: '#8E96A8',
};

export const radius = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 };
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 32 };

/**
 * San Francisco on the iPhone (the system font), SF Pro Rounded for numbers as in Fitness and
 * Activity. The browser preview substitutes Inter, the closest open face.
 */
export const fonts = {
  text: Platform.select({ ios: undefined, default: 'Inter, -apple-system, system-ui, sans-serif' }),
  rounded: Platform.select({ ios: 'ui-rounded', default: 'Inter, -apple-system, system-ui, sans-serif' }),
};

const sf = (size: number, weight: TextStyle['fontWeight'], tracking: number, rounded = false): TextStyle => ({
  fontSize: size,
  fontWeight: weight,
  letterSpacing: tracking,
  fontFamily: rounded ? fonts.rounded : fonts.text,
});

// The iOS Dynamic Type scale (Large) with Apple's own tracking values.
export const type = {
  hero: { ...sf(64, '700', -1.2, true), fontVariant: ['tabular-nums' as const] },
  big: { ...sf(34, '700', 0.2, true), fontVariant: ['tabular-nums' as const] },
  largeTitle: sf(34, '700', 0.37),
  title: sf(22, '700', 0.35),
  title3: sf(20, '600', 0.38),
  headline: sf(17, '600', -0.41),
  body: sf(17, '400', -0.41),
  callout: sf(16, '400', -0.32),
  label: sf(15, '400', -0.24),
  footnote: sf(13, '400', -0.08),
  caption: { ...sf(13, '500', -0.08), textTransform: 'uppercase' as const },
  num: { fontFamily: fonts.rounded, fontVariant: ['tabular-nums' as const] },
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

/** "1 set", "3 sets". */
export const plural = (n: number, word: string, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;
