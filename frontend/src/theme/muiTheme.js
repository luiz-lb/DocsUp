import { createTheme } from '@mui/material/styles';
import { palette, radii } from './palette.js';

export const muiTheme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: palette.teal, contrastText: palette.creamText },
    secondary: { main: palette.indigo, contrastText: palette.white },
    success: { main: palette.success },
    warning: { main: palette.warning },
    error: { main: palette.danger },
    info: { main: palette.info },
    background: { default: palette.cream, paper: palette.white },
    text: { primary: palette.textDark, secondary: palette.textMuted },
  },
  shape: {
    borderRadius: 10,
  },
  typography: {
    fontFamily: "'Inter', system-ui, sans-serif",
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: { borderRadius: radii.md },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: { textTransform: 'none', fontWeight: 700, borderRadius: radii.sm },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: { backgroundColor: palette.teal, color: palette.creamText },
      },
    },
  },
});
