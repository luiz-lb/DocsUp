import { CssBaseline, ThemeProvider } from '@mui/material';
import { muiTheme } from '../theme/muiTheme.js';
import ThemeVarsInjector from '../theme/ThemeVarsInjector.jsx';
import { AuthProvider } from '../contexts/AuthContext.jsx';

/** Composicao de todos os providers globais - um unico ponto para adicionar novos. */
export default function AppProviders({ children }) {
  return (
    <ThemeProvider theme={muiTheme}>
      <CssBaseline />
      <ThemeVarsInjector />
      <AuthProvider>{children}</AuthProvider>
    </ThemeProvider>
  );
}
