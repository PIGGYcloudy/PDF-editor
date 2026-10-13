import { useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  MenuItem,
  Paper,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import type { PageFitMode, PageOrientation, PageSizeOptions, PaperSize } from '../../types';

interface PageSizePanelProps {
  /** 目前文件頁面尺寸的說明，例如「目前 5 頁共有 3 種尺寸」 */
  sizeSummary: string;
  selectedCount: number;
  loading: boolean;
  onNormalize: (options: PageSizeOptions) => void;
}

const PAPER_SIZES: { value: PaperSize; label: string }[] = [
  { value: 'A4', label: 'A4 (210 × 297 mm)' },
  { value: 'A3', label: 'A3 (297 × 420 mm)' },
  { value: 'A5', label: 'A5 (148 × 210 mm)' },
  { value: 'B4', label: 'B4 (250 × 353 mm)' },
  { value: 'B5', label: 'B5 (176 × 250 mm)' },
  { value: 'Letter', label: 'Letter (8.5 × 11 in)' },
  { value: 'Legal', label: 'Legal (8.5 × 14 in)' },
];

const MODE_HINTS: Record<PageFitMode, string> = {
  fit: '內容完整保留並置中，比例不同時多出的地方留白。',
  fill: '內容填滿整頁，比例不同時裁掉超出的邊緣，適合去除掃描的黑邊。',
};

function PageSizePanel({ sizeSummary, selectedCount, loading, onNormalize }: PageSizePanelProps) {
  const [size, setSize] = useState<PaperSize>('A4');
  const [orientation, setOrientation] = useState<PageOrientation>('auto');
  const [mode, setMode] = useState<PageFitMode>('fit');

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        統一頁面尺寸
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        把手機掃描或不同來源的頁面等比縮放到同一種紙張，文字、向量與連結都會保留。
        {sizeSummary && `${sizeSummary}。`}
      </Typography>
      <Box sx={{ mb: 2, maxWidth: 480 }}>
        <TextField
          select
          label="紙張尺寸"
          size="small"
          value={size}
          onChange={(event) => setSize(event.target.value as PaperSize)}
          sx={{ minWidth: 240, mb: 2 }}
        >
          {PAPER_SIZES.map((option) => (
            <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
          ))}
        </TextField>

        <Typography variant="body2" gutterBottom>方向</Typography>
        <ToggleButtonGroup
          exclusive
          color="primary"
          size="small"
          value={orientation}
          onChange={(_, value: PageOrientation | null) => value && setOrientation(value)}
          aria-label="頁面方向"
          sx={{ mb: 2 }}
        >
          <ToggleButton value="auto">依原頁面</ToggleButton>
          <ToggleButton value="portrait">直式</ToggleButton>
          <ToggleButton value="landscape">橫式</ToggleButton>
        </ToggleButtonGroup>

        <Typography variant="body2" gutterBottom>縮放方式</Typography>
        <ToggleButtonGroup
          exclusive
          color="primary"
          size="small"
          value={mode}
          onChange={(_, value: PageFitMode | null) => value && setMode(value)}
          aria-label="縮放方式"
        >
          <ToggleButton value="fit">完整放入</ToggleButton>
          <ToggleButton value="fill">填滿裁切</ToggleButton>
        </ToggleButtonGroup>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {MODE_HINTS[mode]}
        </Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {selectedCount > 0 ? `將調整 ${selectedCount} 個選取的頁面` : '將調整所有頁面'}
      </Typography>
      <Button
        variant="contained"
        onClick={() => onNormalize({ size, orientation, mode })}
        disabled={loading}
      >
        {loading ? <CircularProgress size={24} /> : `統一為 ${size}`}
      </Button>
    </Paper>
  );
}

export default PageSizePanel;
