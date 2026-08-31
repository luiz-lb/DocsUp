// Fonte unica de verdade das cores da marca.
// Consumida pelo MUI theme (muiTheme.js) e injetada como CSS vars (ThemeVarsInjector)
// para que CSS Modules usem exatamente a mesma paleta via var(--color-*).
export const palette = {
  cream: '#faf0ca',
  creamText: '#fffae4',
  teal: '#004643',
  tealDark: '#082720',
  indigo: '#4f46e5',
  indigoDark: '#3730a3',

  success: '#2f9e44',
  successBg: '#e8f7ec',
  warning: '#f5a524',
  warningBg: '#fef3dd',
  danger: '#e5484d',
  dangerBg: '#fbe9e9',
  info: '#3b82f6',
  infoBg: '#e8f1fe',
  neutral: '#6b7280',
  neutralBg: '#eef0f2',

  white: '#ffffff',
  border: '#d1d5db',
  textDark: '#111827',
  textMuted: '#6b7280',
};

export const radii = {
  sm: '8px',
  md: '10px',
  lg: '16px',
  pill: '999px',
};

export const shadows = {
  sm: '0 2px 8px rgba(15, 23, 42, 0.06)',
  md: '0 8px 24px rgba(15, 23, 42, 0.08)',
  lg: '0 16px 40px rgba(15, 23, 42, 0.12)',
};
