export const colors = {
  bg: '#0B1220',
  bgElevated: '#101A2D',
  card: '#131C2E',
  cardAlt: '#1A2438',
  border: '#24304A',
  text: '#E6EDF7',
  textSub: '#93A3BF',
  textFaint: '#5C6B85',
  primary: '#3B82F6',
  primaryDeep: '#2563EB',
  primarySoft: 'rgba(59, 130, 246, 0.14)',
  success: '#22C55E',
  successSoft: 'rgba(34, 197, 94, 0.14)',
  warn: '#F59E0B',
  warnSoft: 'rgba(245, 158, 11, 0.14)',
  danger: '#EF4444',
  dangerSoft: 'rgba(239, 68, 68, 0.14)',
  accent: '#8B5CF6',
  accentSoft: 'rgba(139, 92, 246, 0.14)',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  pill: 999,
};

export const typography = {
  title: { fontSize: 26, fontWeight: '800', color: colors.text, letterSpacing: 0.2 },
  h2: { fontSize: 20, fontWeight: '700', color: colors.text },
  h3: { fontSize: 16, fontWeight: '700', color: colors.text },
  body: { fontSize: 15, fontWeight: '400', color: colors.text, lineHeight: 22 },
  sub: { fontSize: 13, fontWeight: '500', color: colors.textSub, lineHeight: 19 },
  caption: { fontSize: 11.5, fontWeight: '600', color: colors.textFaint, letterSpacing: 0.6, textTransform: 'uppercase' },
};

export function gradeForScore(score) {
  if (score >= 85) return { label: 'Outstanding', letter: 'A', color: colors.success };
  if (score >= 75) return { label: 'Strong', letter: 'B', color: colors.success };
  if (score >= 60) return { label: 'Good', letter: 'C', color: colors.warn };
  if (score >= 45) return { label: 'Needs work', letter: 'D', color: colors.warn };
  return { label: 'Weak', letter: 'F', color: colors.danger };
}
