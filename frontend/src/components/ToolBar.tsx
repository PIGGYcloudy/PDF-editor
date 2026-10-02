import { Button, Grid, Paper, Typography } from '@mui/material';
import {
  CallSplit as SplitIcon,
  Compress as CompressIcon,
  Download as DownloadIcon,
  Photo as PhotoIcon,
  Undo as UndoIcon,
  WaterDrop as WatermarkIcon,
} from '@mui/icons-material';
import type { ReactNode } from 'react';

export type ToolPanel = 'split' | 'compress' | 'watermark' | 'convert';

interface ToolBarProps {
  activePanel: ToolPanel | null;
  canUndo: boolean;
  /** 有尚未套用的頁面變更時，需要伺服器版本的功能暫時停用 */
  hasPendingEdits: boolean;
  loading: boolean;
  onTogglePanel: (panel: ToolPanel) => void;
  onUndo: () => void;
  onSavePdf: () => void;
}

function ToolBar({
  activePanel,
  canUndo,
  hasPendingEdits,
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
        {panelButton('split', '拆分 PDF', <SplitIcon />, hasPendingEdits)}
        {panelButton('compress', '壓縮 PDF', <CompressIcon />, hasPendingEdits)}
        {panelButton('watermark', '添加浮水印', <WatermarkIcon />, hasPendingEdits)}
        {panelButton('convert', '轉換為圖片', <PhotoIcon />, hasPendingEdits)}
        <Grid item xs={12} sm={6} md={4}>
          <Button
            fullWidth
            variant="outlined"
            onClick={onUndo}
            startIcon={<UndoIcon />}
            disabled={!canUndo || loading}
          >
            {hasPendingEdits ? '復原頁面編輯' : '復原上一步'}
          </Button>
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <Button
            fullWidth
            variant="outlined"
            onClick={onSavePdf}
            startIcon={<DownloadIcon />}
            disabled={loading || hasPendingEdits}
          >
            另存 PDF
          </Button>
        </Grid>
      </Grid>
      {hasPendingEdits && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          頁面有尚未套用的變更。請先在下方「套用變更」或「還原變更」，
          才能使用拆分、壓縮、浮水印、轉換與另存。
        </Typography>
      )}
    </Paper>
  );
}

export default ToolBar;
