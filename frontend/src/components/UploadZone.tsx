import { Box, Paper, Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { AddRounded, ArrowUpwardRounded } from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';
import type { FileRejection } from 'react-dropzone';
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_MB } from '../constants';
import type { ImagePageSize } from '../types';

interface UploadZoneProps {
  disabled: boolean;
  /** 已有文件時縮成一列，把空間留給頁面預覽 */
  compact?: boolean;
  /** 圖片轉成 PDF 時的頁面大小 */
  imagePageSize: ImagePageSize;
  onImagePageSizeChange: (size: ImagePageSize) => void;
  onFiles: (files: File[]) => void;
  onError: (message: string) => void;
}

function UploadZone({
  disabled,
  compact = false,
  imagePageSize,
  onImagePageSizeChange,
  onFiles,
  onError,
}: UploadZoneProps) {
  const onDrop = (acceptedFiles: File[], rejections: FileRejection[]) => {
    if (rejections.length > 0) {
      const names = rejections.map((rejection) => rejection.file.name).join('、');
      onError(`只能上傳 PDF 或圖片（PNG、JPG、WebP）：${names}`);
      return;
    }
    if (acceptedFiles.length === 0) {
      return;
    }

    // 與後端相同，以單次上傳的合計大小判斷，避免上傳完才被拒絕。
    const totalSize = acceptedFiles.reduce((sum, file) => sum + file.size, 0);
    if (totalSize > MAX_UPLOAD_BYTES) {
      onError(`檔案太大：單次上傳合計最多 ${MAX_UPLOAD_MB}MB，請分次上傳後再合併。`);
      return;
    }
    onFiles(acceptedFiles);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/webp': ['.webp'],
    },
    multiple: true,
    disabled,
  });

  const pageSizeToggle = (
    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center">
      <Typography variant="caption" color="text.secondary">
        圖片轉 PDF 的頁面：
      </Typography>
      <ToggleButtonGroup
        exclusive
        size="small"
        color="primary"
        value={imagePageSize}
        onChange={(_, value: ImagePageSize | null) => value && onImagePageSizeChange(value)}
        aria-label="圖片轉 PDF 的頁面大小"
      >
        <ToggleButton value="a4" sx={{ py: 0.25 }}>A4</ToggleButton>
        <ToggleButton value="fit" sx={{ py: 0.25 }}>依圖片大小</ToggleButton>
      </ToggleButtonGroup>
    </Stack>
  );

  const dropzoneSx = {
    border: isDragActive ? '2px dashed #0067d9' : '1px dashed #9cacbf',
    borderRadius: 4,
    textAlign: 'center',
    cursor: disabled ? 'default' : 'pointer',
    bgcolor: isDragActive ? '#e6f1ff' : 'rgba(255,255,255,0.65)',
    opacity: disabled ? 0.6 : 1,
    transition: 'background-color 160ms, border-color 160ms',
    '&:hover': { bgcolor: disabled ? undefined : '#f2f7fe', borderColor: '#0067d9' },
  } as const;

  if (compact) {
    return (
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={1}
        alignItems={{ xs: 'stretch', md: 'center' }}
        sx={{ mb: 2 }}
      >
        <Box
          {...getRootProps({ role: 'button', 'aria-label': '加入更多 PDF 或圖片', 'aria-disabled': disabled, className: 'upload-target' })}
          sx={{
            ...dropzoneSx,
            flexGrow: 1,
            px: 2,
            py: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1,
          }}
        >
          <input {...getInputProps()} />
          <AddRounded sx={{ color: 'primary.main' }} />
          <Typography variant="body2">
            {isDragActive ? '釋放以上傳檔案' : '拖曳或點擊加入更多 PDF 或圖片'}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'none', sm: 'inline' } }}>
            合計最多 {MAX_UPLOAD_MB}MB
          </Typography>
        </Box>
        {pageSizeToggle}
      </Stack>
    );
  }

  return (
    <Paper sx={{ p: { xs: 2, md: 3 }, mb: 3, maxWidth: 900, mx: 'auto', borderRadius: 5 }}>
      <Box {...getRootProps({ role: 'button', 'aria-label': '選擇 PDF 或圖片', 'aria-disabled': disabled, className: 'upload-target' })} sx={{ ...dropzoneSx, p: { xs: 3, md: 5 } }}>
        <input {...getInputProps()} />
        <Box sx={{ width: 64, height: 64, mx: 'auto', mb: 2.5, display: 'grid', placeItems: 'center', bgcolor: '#e5effc', border: '1px solid #fff', color: 'primary.main', borderRadius: 4 }}><ArrowUpwardRounded sx={{ fontSize: 30 }} /></Box>
        <Typography variant="h6" sx={{ mb: 1 }}>
          {isDragActive ? '放開，就能加入文件' : '拖曳 PDF 或圖片到這裡'}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>或從你的裝置選擇檔案</Typography>
        <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, px: 3, py: 1.5, borderRadius: 999, bgcolor: 'primary.main', color: 'white', fontWeight: 600, fontSize: 14 }}><AddRounded fontSize="small" />選擇檔案</Box>
        <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 2.5 }}>
          PDF、PNG、JPG、WebP · 可一次選擇多份 · 合計最多 {MAX_UPLOAD_MB} MB
        </Typography>
      </Box>
      <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ xs: 'flex-start', md: 'center' }} justifyContent="space-between" gap={1} sx={{ mt: 2 }}>
        <Typography variant="caption" color="text.secondary">多張圖片會依檔名排序，每張成為一頁。</Typography>
        {pageSizeToggle}
      </Stack>
    </Paper>
  );
}

export default UploadZone;
