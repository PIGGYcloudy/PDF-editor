export type ColorModePreference = 'light' | 'dark' | 'system';
export type ColorMode = 'light' | 'dark';

export const COLOR_MODE_STORAGE_KEY = 'pdf-editor.color-mode';

export function parseColorModePreference(value: string | null): ColorModePreference {
  return value === 'light' || value === 'dark' ? value : 'system';
}

export function resolveColorMode(preference: ColorModePreference, systemDark: boolean): ColorMode {
  if (preference === 'system') {
    return systemDark ? 'dark' : 'light';
  }
  return preference;
}

export function readColorModePreference(): ColorModePreference {
  try { return parseColorModePreference(localStorage.getItem(COLOR_MODE_STORAGE_KEY)); }
  catch { return 'system'; }
}

export function storeColorModePreference(preference: ColorModePreference) {
  try {
    if (preference === 'system') {
      localStorage.removeItem(COLOR_MODE_STORAGE_KEY);
    } else {
      localStorage.setItem(COLOR_MODE_STORAGE_KEY, preference);
    }
  } catch { /* 儲存不可用時仍套用到目前分頁。 */ }
}
