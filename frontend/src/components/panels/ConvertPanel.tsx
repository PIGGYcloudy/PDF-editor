import { useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Paper,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import type { ConvertDpi, ConvertFormat } from '../../types';

interface ConvertPanelProps {
  selectedCount: number;
  loading: boolean;
  onConvert: (format: ConvertFormat, dpi: ConvertDpi) => void;
}

const DPI_OPTIONS: ConvertDpi[] = [72, 150, 300];

function ConvertPanel({ selectedCount, loading, onConvert }: ConvertPanelProps) {
  const [format, setFormat] = useState<ConvertFormat>('jpg');
  const [dpi, setDpi] = useState<ConvertDpi>(150);

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        轉換為圖片
      </Typography>
      <Box sx={{ mb: 2 }}>
        <Typography variant="body2" gutterBottom>輸出格式</Typography>
        <ToggleButtonGroup
          exclusive
          color="primary"
          value={format}
          onChange={(_, value: ConvertFormat | null) => value && setFormat(value)}
          aria-label="輸出格式"
        >
          <ToggleButton value="jpg">JPG</ToggleButton>
          <ToggleButton value="png">PNG</ToggleButton>
        </ToggleButtonGroup>

        <Typography variant="body2" gutterBottom sx={{ mt: 2 }}>解析度 (DPI)</Typography>
        <ToggleButtonGroup
          exclusive
          color="primary"
          value={dpi}
          onChange={(_, value: ConvertDpi | null) => value && setDpi(value)}
          aria-label="解析度"
        >
          {DPI_OPTIONS.map((option) => (
            <ToggleButton key={option} value={option}>{option}</ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {selectedCount > 0 ? `將轉換 ${selectedCount} 個選取的頁面` : '將轉換所有頁面'}
      </Typography>
      <Button
        variant="contained"
        onClick={() => onConvert(format, dpi)}
        disabled={loading}
      >
        {loading ? <CircularProgress size={24} /> : `轉換並另存為 ${format.toUpperCase()}`}
      </Button>
    </Paper>
  );
}

export default ConvertPanel;
