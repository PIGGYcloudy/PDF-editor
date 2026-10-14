import { useEffect, useMemo, useState } from 'react';
import { CssBaseline, useMediaQuery } from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import App from './App';
import { createAppTheme } from './theme';
import type { ColorModePreference } from './state/colorMode';
import { readColorModePreference, resolveColorMode, storeColorModePreference } from './state/colorMode';

/** 依使用者選擇的外觀套用配色；選「跟隨系統」時依系統的淺色／深色外觀。 */
export default function ThemedApp() {
  const systemDark = useMediaQuery('(prefers-color-scheme: dark)', { noSsr: true });
  const [colorMode, setColorMode] = useState<ColorModePreference>(readColorModePreference);
  const mode = resolveColorMode(colorMode, systemDark);
  const theme = useMemo(() => createAppTheme(mode), [mode]);

  // index.css 的顏色變數與瀏覽器原生控制項都依這個屬性切換
  useEffect(() => {
    document.documentElement.dataset.colorMode = mode;
  }, [mode]);

  const changeColorMode = (value: ColorModePreference) => {
    setColorMode(value);
    storeColorModePreference(value);
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline enableColorScheme />
      <App colorMode={colorMode} onColorModeChange={changeColorMode} />
    </ThemeProvider>
  );
}
