import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
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
  /** 尚未套用的旋轉角度，同步呈現在預覽上 */
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
  const [aspect, setAspect] = useState(0.707);
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
        <Stack direction="row" alignItems="center" spacing={1} useFlexGap flexWrap="wrap">
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
            <Chip size="small" label={`已設定旋轉 ${pendingRotation}°（尚未套用）`} />
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
          <Alert severity="error" action={<Button color="inherit" onClick={() => {
            setLoadedUrl(null);
            setFailedUrl(null);
          }}>重試</Button>}>無法載入預覽，請檢查連線或確認檔案是否已過期。</Alert>
        )}
        {url && loadedUrl !== url && failedUrl !== url && (
          <Box sx={{ py: 6 }}>
            <CircularProgress />
          </Box>
        )}
        {url && failedUrl !== url && (
          <Box sx={{ height: '70vh', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', containerType: 'size' }}>
            <img
              key={url}
              src={url}
              alt={`第 ${index + 1} 頁預覽`}
              onLoad={(event) => {
                setAspect(event.currentTarget.naturalWidth / event.currentTarget.naturalHeight);
                setLoadedUrl(url);
              }}
              onError={() => setFailedUrl(url)}
              style={{
                display: loadedUrl === url ? 'inline-block' : 'none',
                width: pendingRotation % 180 === 0
                  ? `min(100cqw, ${aspect * 100}cqh)`
                  : `min(100cqh, ${aspect * 100}cqw)`,
                maxWidth: 'none',
                flexShrink: 0,
                transform: `rotate(${pendingRotation}deg)`,
                height: 'auto',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                background: '#fff',
              }}
            />
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default PagePreviewDialog;
