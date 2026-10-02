import { useState } from 'react';
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Tooltip,
} from '@mui/material';
import {
  ChevronLeft as PreviousIcon,
  ChevronRight as NextIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { getPagePreviewUrl } from '../services/api';

interface PagePreviewDialogProps {
  pdfId: string;
  /** 依目前顯示順序排列的頁碼 */
  pageNumbers: number[];
  pageNumber: number | null;
  /** 尚未套用的旋轉角度；預覽顯示的是目前版本，這裡只用來提示 */
  rotations?: Map<number, number>;
  onNavigate: (pageNumber: number) => void;
  onClose: () => void;
}

function PagePreviewDialog({
  pdfId,
  pageNumbers,
  pageNumber,
  rotations,
  onNavigate,
  onClose,
}: PagePreviewDialogProps) {
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  const open = pageNumber !== null;
  const url = pageNumber !== null ? getPagePreviewUrl(pdfId, pageNumber) : null;
  const index = pageNumber !== null ? pageNumbers.indexOf(pageNumber) : -1;
  const previous = index > 0 ? pageNumbers[index - 1] : undefined;
  const pendingRotation = pageNumber !== null ? rotations?.get(pageNumber) ?? 0 : 0;
  const next = index >= 0 && index < pageNumbers.length - 1
    ? pageNumbers[index + 1]
    : undefined;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      onKeyDown={(event) => {
        if (event.key === 'ArrowLeft' && previous !== undefined) onNavigate(previous);
        if (event.key === 'ArrowRight' && next !== undefined) onNavigate(next);
      }}
    >
      <DialogTitle sx={{ pr: 7 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <span>第 {index + 1} 頁</span>
          <Tooltip title="上一頁">
            <span>
              <IconButton
                aria-label="上一頁"
                disabled={previous === undefined}
                onClick={() => previous !== undefined && onNavigate(previous)}
              >
                <PreviousIcon />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="下一頁">
            <span>
              <IconButton
                aria-label="下一頁"
                disabled={next === undefined}
                onClick={() => next !== undefined && onNavigate(next)}
              >
                <NextIcon />
              </IconButton>
            </span>
          </Tooltip>
          {pendingRotation !== 0 && (
            <Chip size="small" label={`已設定旋轉 ${pendingRotation}°（套用後生效）`} />
          )}
        </Stack>
        <IconButton
          aria-label="關閉"
          onClick={onClose}
          sx={{ position: 'absolute', right: 8, top: 8 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ textAlign: 'center', bgcolor: '#f5f5f5' }}>
        {url && failedUrl === url && (
          <Alert severity="error">無法載入預覽，檔案可能已過期。</Alert>
        )}
        {url && loadedUrl !== url && failedUrl !== url && (
          <Box sx={{ py: 6 }}>
            <CircularProgress />
          </Box>
        )}
        {url && failedUrl !== url && (
          <img
            key={url}
            src={url}
            alt={`第 ${index + 1} 頁預覽`}
            onLoad={() => setLoadedUrl(url)}
            onError={() => setFailedUrl(url)}
            style={{
              display: loadedUrl === url ? 'inline-block' : 'none',
              maxWidth: '100%',
              height: 'auto',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
              background: '#fff',
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

export default PagePreviewDialog;
