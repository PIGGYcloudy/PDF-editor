import { Box, ToggleButton, ToggleButtonGroup, Tooltip } from '@mui/material';
import { DarkModeOutlined, LightModeOutlined, SettingsBrightnessOutlined } from '@mui/icons-material';
import type { ColorModePreference } from '../state/colorMode';

const OPTIONS: { value: ColorModePreference; label: string; icon: JSX.Element }[] = [
  { value: 'light', label: '淺色', icon: <LightModeOutlined fontSize="small" /> },
  { value: 'dark', label: '深色', icon: <DarkModeOutlined fontSize="small" /> },
  { value: 'system', label: '自動', icon: <SettingsBrightnessOutlined fontSize="small" /> },
];

/** 外觀切換沿用「編輯／合併」的玻璃分段控制；手機上只顯示圖示。 */
export default function ColorModeSwitch({ value, onChange }: {
  value: ColorModePreference;
  onChange: (value: ColorModePreference) => void;
}) {
  return (
    <ToggleButtonGroup
      className="glass-surface"
      exclusive
      value={value}
      onChange={(_, next: ColorModePreference | null) => { if (next) onChange(next); }}
      aria-label="外觀"
      sx={(theme) => ({
        p: 0.5,
        gap: 0.5,
        borderRadius: 999,
        flexShrink: 0,
        '& .MuiToggleButtonGroup-grouped': {
          border: 0,
          borderRadius: '999px !important',
          m: 0,
          minHeight: 36,
          minWidth: 44,
          px: { xs: 1, sm: 1.5 },
          gap: 0.75,
          fontWeight: 600,
          color: 'text.secondary',
          transition: 'background-color 160ms, box-shadow 160ms, color 160ms',
          '&.Mui-selected, &.Mui-selected:hover': {
            background: 'var(--glass-selected)',
            color: 'text.primary',
            boxShadow: theme.palette.mode === 'dark'
              ? '0 2px 8px rgba(0,0,0,0.3)'
              : '0 2px 8px rgba(32,52,80,0.1), inset 0 1px 0 #fff',
          },
          '&.Mui-focusVisible': { outline: `3px solid ${theme.palette.primary.main}`, outlineOffset: -3 },
        },
      })}
    >
      {OPTIONS.map((option) => (
        <Tooltip key={option.value} title={option.value === 'system' ? '跟隨系統的淺色／深色外觀' : ''}>
          <ToggleButton value={option.value} aria-label={option.value === 'system' ? '跟隨系統' : option.label}>
            {option.icon}
            <Box component="span" sx={{ display: { xs: 'none', md: 'inline' } }}>{option.label}</Box>
          </ToggleButton>
        </Tooltip>
      ))}
    </ToggleButtonGroup>
  );
}
