import { useEffect } from 'react';
import { palette, radii, shadows } from './palette.js';

const toCssVars = (obj, prefix) =>
  Object.fromEntries(Object.entries(obj).map(([key, value]) => [`--${prefix}-${key}`, value]));

const cssVars = {
  ...toCssVars(palette, 'color'),
  ...toCssVars(radii, 'radius'),
  ...toCssVars(shadows, 'shadow'),
};

// Injeta a paleta (theme/palette.js) como custom properties no :root,
// permitindo que qualquer CSS Module consuma var(--color-teal) etc.,
// mantendo uma unica fonte de verdade compartilhada com o tema MUI.
export default function ThemeVarsInjector() {
  useEffect(() => {
    const root = document.documentElement;
    Object.entries(cssVars).forEach(([key, value]) => root.style.setProperty(key, value));
  }, []);

  return null;
}
