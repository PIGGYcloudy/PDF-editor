import { Box, Button, Paper, Stack, Tooltip } from '@mui/material';
import {
  AspectRatio as PageSizeIcon,
  CallSplit as SplitIcon,
  Compress as CompressIcon,
  Download as DownloadIcon,
  Photo as PhotoIcon,
  Redo as RedoIcon,
  Undo as UndoIcon,
  WaterDrop as WatermarkIcon,
} from '@mui/icons-material';
import type { ReactNode } from 'react';

export type ToolPanel = 'split' | 'pageSize' | 'compress' | 'watermark' | 'convert';

interface ToolBarProps {
  activePanel: ToolPanel | null;
  /** 下一次復原／重做的動作名稱；沒有可復原的步驟時為 null */
  undoLabel: string | null;
  redoLabel: string | null;
  loading: boolean;
  onTogglePanel: (panel: ToolPanel) => void;
  onUndo: () => void;
  onRedo: () => void;
  onSavePdf: () => void;
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
const MOD = isMac ? '⌘' : 'Ctrl+';

/** 手機上只顯示圖示，按鈕名稱仍由 aria-label 提供。 */
const compactLabel = { display: { xs: 'none', md: 'inline' } } as const;
const compactButton = {
  flexShrink: 0,
  minWidth: 44,
  px: { xs: 1.25, md: 2.25 },
  '& .MuiButton-startIcon': { mr: { xs: 0, md: 1 }, ml: { xs: 0, md: -0.5 } },
} as const;

function ToolBar({
  activePanel,
  undoLabel,
  redoLabel,
  loading,
  onTogglePanel,
  onUndo,
  onRedo,
  onSavePdf,
}: ToolBarProps) {
  const panelButton = (panel: ToolPanel, label: string, icon: ReactNode) => (
    <Button
      variant={activePanel === panel ? 'contained' : 'outlined'}
      aria-expanded={activePanel === panel}
      aria-controls={`tool-panel-${panel}`}
      onClick={() => onTogglePanel(panel)}
      startIcon={icon}
      disabled={loading}
      sx={{ flexShrink: 0 }}
    >
      {label}
    </Button>
  );

  const undoText = undoLabel ? `復原${undoLabel}` : '復原';
  const redoText = redoLabel ? `重做${redoLabel}` : '重做';

  return (
    <Paper
      className="glass-surface"
      component="section"
      aria-label="文件工具"
      sx={{ p: 1, mb: 2, borderRadius: 4 }}
    >
      <Stack direction="row" alignItems="center" gap={{ xs: 0.5, sm: 1 }} flexWrap={{ xs: 'wrap', sm: 'nowrap' }}>
        {/* 手機上復原與另存在第一列，工具在第二列橫向捲動，不換成多列 */}
        <Stack
          direction="row"
          gap={1}
          sx={{ order: { xs: 2, sm: 0 }, flex: { xs: '1 1 100%', sm: 1 }, minWidth: 0, overflowX: 'auto', scrollbarWidth: 'none', p: 0.5, '&::-webkit-scrollbar': { display: 'none' } }}
        >
          {panelButton('split', '拆分', <SplitIcon />)}
          {panelButton('pageSize', '統一尺寸', <PageSizeIcon />)}
          {panelButton('compress', '壓縮', <CompressIcon />)}
          {panelButton('watermark', '浮水印', <WatermarkIcon />)}
          {panelButton('convert', '轉成圖片', <PhotoIcon />)}
        </Stack>
        <Stack direction="row" gap={0.5} sx={{ flexShrink: 0, ml: 'auto', pr: 0.5 }}>
          <Tooltip title={`${undoText}（${MOD}Z）`}>
            <span>
              <Button
                variant="text"
                color="inherit"
                aria-label={undoText}
                onClick={onUndo}
                startIcon={<UndoIcon />}
                disabled={!undoLabel || loading}
                sx={compactButton}
              >
                <Box component="span" sx={compactLabel}>{undoText}</Box>
              </Button>
            </span>
          </Tooltip>
          <Tooltip title={`${redoText}（${isMac ? '⇧⌘Z' : 'Ctrl+Y'}）`}>
            <span>
              <Button
                variant="text"
                color="inherit"
                aria-label={redoText}
                onClick={onRedo}
                startIcon={<RedoIcon />}
                disabled={!redoLabel || loading}
                sx={compactButton}
              >
                <Box component="span" sx={compactLabel}>{redoText}</Box>
              </Button>
            </span>
          </Tooltip>
          <Button
            variant="contained"
            aria-label="另存 PDF"
            onClick={onSavePdf}
            startIcon={<DownloadIcon />}
            disabled={loading}
            sx={{ ...compactButton, '& .MuiButton-startIcon': { mr: { xs: 0, sm: 1 }, ml: { xs: 0, sm: -0.5 } }, px: { xs: 1.25, sm: 2.25 } }}
          >
            <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>另存 PDF</Box>
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
}

export default ToolBar;
