import { useState } from 'react';
import { IconButton, ListItemIcon, ListItemText, Menu, MenuItem, Tooltip } from '@mui/material';
import { Check, DarkModeOutlined, LightModeOutlined, SettingsBrightnessOutlined } from '@mui/icons-material';
import type { ColorModePreference } from '../state/colorMode';

const OPTIONS: { value: ColorModePreference; label: string; icon: JSX.Element }[] = [
  { value: 'light', label: '淺色', icon: <LightModeOutlined fontSize="small" /> },
  { value: 'dark', label: '深色', icon: <DarkModeOutlined fontSize="small" /> },
  { value: 'system', label: '跟隨系統', icon: <SettingsBrightnessOutlined fontSize="small" /> },
];

export default function ColorModeMenu({ value, onChange }: {
  value: ColorModePreference;
  onChange: (value: ColorModePreference) => void;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const current = OPTIONS.find((option) => option.value === value) ?? OPTIONS[2];
  const label = `外觀：${current.label}`;

  return <>
    <Tooltip title={label}>
      <IconButton color="inherit" aria-label={label} aria-haspopup="menu" aria-controls={anchor ? 'color-mode-menu' : undefined}
        aria-expanded={anchor ? 'true' : undefined} onClick={(event) => setAnchor(event.currentTarget)}>
        {current.icon}
      </IconButton>
    </Tooltip>
    <Menu id="color-mode-menu" anchorEl={anchor} open={anchor !== null} onClose={() => setAnchor(null)}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
      {OPTIONS.map((option) => (
        <MenuItem key={option.value} selected={option.value === value} aria-checked={option.value === value} role="menuitemradio"
          onClick={() => { onChange(option.value); setAnchor(null); }}>
          <ListItemIcon>{option.icon}</ListItemIcon>
          <ListItemText>{option.label}</ListItemText>
          <Check fontSize="small" sx={{ ml: 2, visibility: option.value === value ? 'visible' : 'hidden' }} />
        </MenuItem>
      ))}
    </Menu>
  </>;
}
