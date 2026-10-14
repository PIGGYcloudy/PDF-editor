import { createTheme } from '@mui/material/styles';
import type { PaletteMode } from '@mui/material';

/** 介面配色跟隨系統的淺色／深色外觀；其餘元件顏色由 index.css 的 CSS 變數提供。 */
export function createAppTheme(mode: PaletteMode) {
  const dark = mode === 'dark';
  const accent = dark ? '#0a84ff' : '#0067d9';
  const line = dark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(33, 52, 78, 0.09)';
  const control = dark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.5)';

  return createTheme({
    palette: {
      mode,
      primary: { main: accent, dark: dark ? '#0071e3' : '#0051ad', contrastText: '#ffffff' },
      background: dark
        ? { default: '#101317', paper: '#1a1e23' }
        : { default: '#eef2f6', paper: '#ffffff' },
      text: dark
        ? { primary: '#e9edf2', secondary: '#a1acba' }
        : { primary: '#182334', secondary: '#536174' },
      divider: dark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(33, 52, 78, 0.12)',
      error: { main: dark ? '#ff6961' : '#bd2f32' },
    },
    typography: {
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans TC", sans-serif',
      h1: { fontWeight: 700, letterSpacing: '-0.045em' },
      h4: { fontWeight: 700, letterSpacing: '-0.035em' },
      h5: { fontWeight: 650, letterSpacing: '-0.025em' },
      h6: { fontSize: '1.1rem', fontWeight: 650 },
      button: { textTransform: 'none', fontWeight: 600 },
    },
    shape: { borderRadius: 8 },
    components: {
      MuiPaper: { defaultProps: { elevation: 0 }, styleOverrides: {
        root: { borderRadius: 16, backgroundImage: 'none', border: `1px solid ${line}`, boxShadow: dark ? 'none' : '0 4px 24px rgba(34, 55, 82, 0.035)' },
      } },
      MuiButton: { defaultProps: { disableElevation: true }, styleOverrides: {
        root: { minHeight: 44, borderRadius: 999, paddingInline: 18, transition: 'background-color 160ms, box-shadow 160ms, transform 160ms', '&:active': { transform: 'scale(0.97)' }, '&.Mui-focusVisible': { outline: `3px solid ${accent}`, outlineOffset: 3 } },
        outlined: { borderColor: dark ? 'rgba(255, 255, 255, 0.18)' : 'rgba(33, 52, 78, 0.18)', background: control },
      } },
      MuiIconButton: { styleOverrides: { root: { minWidth: 44, minHeight: 44, '&.Mui-focusVisible': { outline: `3px solid ${accent}`, outlineOffset: 2 } } } },
      MuiCheckbox: { styleOverrides: { root: { minWidth: 44, minHeight: 44 } } },
      MuiToggleButton: { styleOverrides: { root: { minHeight: 44, paddingInline: 16, textTransform: 'none' } } },
      MuiOutlinedInput: { styleOverrides: { root: { borderRadius: 12, background: dark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(255, 255, 255, 0.85)', minHeight: 44 } } },
      MuiTabs: { styleOverrides: { root: { minHeight: 48 }, indicator: { display: 'none' } } },
      MuiTab: { styleOverrides: { root: { minHeight: 44, padding: '10px 24px', borderRadius: 999, textTransform: 'none', fontWeight: 600, zIndex: 1, '&.Mui-selected': { background: 'var(--glass-selected)', color: dark ? '#e9edf2' : '#182334', boxShadow: dark ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(32,52,80,0.1), inset 0 1px 0 #fff' }, '&.Mui-focusVisible': { outline: `3px solid ${accent}`, outlineOffset: -3 } } } },
      MuiAlert: { styleOverrides: { root: { borderRadius: 14, alignItems: 'center' }, message: { minWidth: 0, overflowWrap: 'anywhere' }, action: { alignItems: 'center' } } },
      MuiDialog: { styleOverrides: { paper: { borderRadius: 24, boxShadow: '0 24px 100px rgba(22,39,64,0.2)' } } },
      MuiDialogTitle: { styleOverrides: { root: { fontWeight: 650 } } },
      MuiDialogActions: { styleOverrides: { root: { padding: '16px 24px', gap: 8 } } },
      MuiTooltip: { styleOverrides: { tooltip: { borderRadius: 8, fontSize: 12 } } },
    },
  });
}
