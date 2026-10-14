import { describe, expect, it } from 'vitest';
import { parseColorModePreference, resolveColorMode } from './colorMode';

describe('parseColorModePreference', () => {
  it('keeps explicit choices and falls back to the system setting', () => {
    expect(parseColorModePreference('light')).toBe('light');
    expect(parseColorModePreference('dark')).toBe('dark');
    expect(parseColorModePreference(null)).toBe('system');
    expect(parseColorModePreference('sepia')).toBe('system');
  });
});

describe('resolveColorMode', () => {
  it('follows the system only when asked to', () => {
    expect(resolveColorMode('system', true)).toBe('dark');
    expect(resolveColorMode('system', false)).toBe('light');
    expect(resolveColorMode('light', true)).toBe('light');
    expect(resolveColorMode('dark', false)).toBe('dark');
  });
});
