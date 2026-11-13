import { createTheme } from '@mui/material/styles';

export const appTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#161615',
      light: '#2e2e2c',
      dark: '#000000',
      contrastText: '#f5f2eb',
    },
    secondary: {
      main: '#b91c1c',
      light: '#dc2626',
      dark: '#991b1b',
      contrastText: '#ffffff',
    },
    background: {
      default: '#f5f2eb',
      paper: '#ffffff',
    },
    text: {
      primary: '#161615',
      secondary: '#6b6860',
    },
    divider: 'rgba(22, 22, 21, 0.10)',
  },
  typography: {
    fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif",
    h1: { fontFamily: "'Instrument Serif', Georgia, serif", fontWeight: 400, letterSpacing: '-0.015em' },
    h2: { fontFamily: "'Instrument Serif', Georgia, serif", fontWeight: 400, letterSpacing: '-0.015em' },
    h3: { fontFamily: "'Instrument Serif', Georgia, serif", fontWeight: 400, letterSpacing: '-0.015em' },
    h4: { fontFamily: "'Instrument Serif', Georgia, serif", fontWeight: 400, letterSpacing: '-0.015em' },
    h5: { fontFamily: "'Instrument Serif', Georgia, serif", fontWeight: 400, letterSpacing: '-0.015em' },
    h6: { fontFamily: "'Instrument Serif', Georgia, serif", fontWeight: 400 },
    button: {
      textTransform: 'none',
      fontWeight: 600,
      letterSpacing: '0.01em',
    },
  },
  shape: {
    borderRadius: 10,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          padding: '6px 14px',
          boxShadow: 'none',
          transition: 'background-color 0.18s ease, border-color 0.18s ease, color 0.18s ease',
          '&:hover': {
            boxShadow: 'none',
          },
        },
        outlined: {
          borderColor: 'rgba(22, 22, 21, 0.16)',
          color: '#161615',
          '&:hover': {
            borderColor: '#161615',
            backgroundColor: 'rgba(22, 22, 21, 0.04)',
          },
        },
        contained: {
          backgroundColor: '#161615',
          color: '#f5f2eb',
          '&:hover': {
            backgroundColor: '#2c2c2a',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(22, 22, 21, 0.10)',
          borderRadius: 16,
          boxShadow: '0 18px 46px rgba(22, 22, 21, 0.12)',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          fontWeight: 600,
          border: '1px solid rgba(22, 22, 21, 0.10)',
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: '#161615',
          color: '#f5f2eb',
          border: 'none',
          borderRadius: 6,
          fontSize: '11.5px',
          boxShadow: '0 8px 24px rgba(22, 22, 21, 0.18)',
        },
      },
    },
  },
});
