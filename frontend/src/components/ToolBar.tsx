import { Button, Grid, Paper, Typography } from '@mui/material';
import {
  Compress as CompressIcon,
  Delete as DeleteIcon,
  Download as DownloadIcon,
  Photo as PhotoIcon,
  Undo as UndoIcon,
  WaterDrop as WatermarkIcon,
} from '@mui/icons-material';
import type { ReactNode } from 'react';

export type ToolPanel = 'delete' | 'compress' | 'watermark' | 'convert';

interface ToolBarProps {
  activePanel: ToolPanel | null;
  selectedCount: number;
  canUndo: boolean;
  loading: boolean;
  onTogglePanel: (panel: ToolPanel) => void;
  onUndo: () => void;
  onSavePdf: () => void;
}

function ToolBar({
  activePanel,
  selectedCount,
  canUndo,
  loading,
  onTogglePanel,
  onUndo,
  onSavePdf,
}: ToolBarProps) {
  const panelButton = (
    panel: ToolPanel,
    label: string,
    icon: ReactNode,
    disabled = false,
  ) => (
    <Grid item xs={12} sm={6} md={4}>
      <Button
        fullWidth
        variant={activePanel === panel ? 'contained' : 'outlined'}
        onClick={() => onTogglePanel(panel)}
        startIcon={icon}
        disabled={disabled || loading}
      >
        {label}
      </Button>
    </Grid>
  );

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        功能
      </Typography>
      <Grid container spacing={2}>
        {panelButton('delete', `刪除頁面 (${selectedCount})`, <DeleteIcon />, selectedCount === 0)}
        {panelButton('compress', '壓縮 PDF', <CompressIcon />)}
        {panelButton('watermark', '添加浮水印', <WatermarkIcon />)}
        {panelButton('convert', '轉換為圖片', <PhotoIcon />)}
        <Grid item xs={12} sm={6} md={4}>
          <Button
            fullWidth
            variant="outlined"
            onClick={onUndo}
            startIcon={<UndoIcon />}
            disabled={!canUndo || loading}
          >
            復原上一步
          </Button>
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <Button
            fullWidth
            variant="outlined"
            onClick={onSavePdf}
            startIcon={<DownloadIcon />}
            disabled={loading}
          >
            另存 PDF
          </Button>
        </Grid>
      </Grid>
    </Paper>
  );
}

export default ToolBar;
