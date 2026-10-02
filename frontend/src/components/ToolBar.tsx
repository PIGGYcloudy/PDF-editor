import { Button, Paper, Stack, Typography } from '@mui/material';
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
    <Button
      variant={activePanel === panel ? 'contained' : 'outlined'}
      onClick={() => onTogglePanel(panel)}
      startIcon={icon}
      disabled={disabled || loading}
    >
      {label}
    </Button>
  );

  return (
    <Paper sx={{ p: 1.5, mb: 2 }}>
      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
        {panelButton('split', '拆分 PDF', <SplitIcon />, hasPendingEdits)}
        {panelButton('compress', '壓縮 PDF', <CompressIcon />, hasPendingEdits)}
        {panelButton('watermark', '添加浮水印', <WatermarkIcon />, hasPendingEdits)}
        {panelButton('convert', '轉換為圖片', <PhotoIcon />, hasPendingEdits)}
        <Button
          variant="outlined"
          onClick={onUndo}
          startIcon={<UndoIcon />}
          disabled={!canUndo || loading}
        >
          {hasPendingEdits ? '復原頁面編輯' : '復原上一步'}
        </Button>
        <Button
          variant="outlined"
          onClick={onSavePdf}
          startIcon={<DownloadIcon />}
          disabled={loading || hasPendingEdits}
        >
          另存 PDF
        </Button>
      </Stack>
      {hasPendingEdits && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          頁面有尚未套用的變更。請先在下方「套用變更」或「還原變更」，
          才能使用拆分、壓縮、浮水印、轉換與另存。
        </Typography>
      )}
    </Paper>
  );
}

export default ToolBar;
