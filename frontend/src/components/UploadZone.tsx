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
        圖片頁面大小
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
        <ToggleButton value="fit" sx={{ py: 0.25 }}>與圖片相同</ToggleButton>
      </ToggleButtonGroup>
    </Stack>
  );

  const dropzoneSx = {
    border: isDragActive ? '2px dashed var(--accent)' : '1px dashed var(--line-dashed)',
    borderRadius: 4,
    textAlign: 'center',
    cursor: disabled ? 'default' : 'pointer',
    bgcolor: isDragActive ? 'var(--upload-active)' : 'var(--upload-background)',
    opacity: disabled ? 0.6 : 1,
    transition: 'background-color 160ms, border-color 160ms',
    '&:hover': { bgcolor: disabled ? undefined : 'var(--upload-hover)', borderColor: 'var(--accent)' },
  } as const;

  if (compact) {
    return (
      <Stack
        direction="row"
        gap={1}
        useFlexGap
        flexWrap="wrap"
        alignItems="center"
        sx={{ mb: 2 }}
      >
        <Box
          {...getRootProps({ role: 'button', 'aria-label': '加入更多 PDF 或圖片', 'aria-disabled': disabled, className: 'upload-target' })}
          sx={{
            ...dropzoneSx,
            flex: '1 1 260px',
            minHeight: 44,
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
            {isDragActive ? '放開以加入' : '加入 PDF 或圖片'}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'none', sm: 'inline' } }}>
            可拖曳到這裡 · 最多 {MAX_UPLOAD_MB} MB
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
        <Box sx={{ width: 56, height: 56, mx: 'auto', mb: 2, display: 'grid', placeItems: 'center', bgcolor: 'var(--surface-tint)', color: 'primary.main', borderRadius: 4 }}><ArrowUpwardRounded sx={{ fontSize: 28 }} /></Box>
        <Typography variant="body1" fontWeight={600} sx={{ mb: 2 }}>
          {isDragActive ? '放開以加入' : '拖曳檔案到這裡，或'}
        </Typography>
        <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, px: 3, py: 1.5, borderRadius: 999, bgcolor: 'primary.main', color: 'primary.contrastText', fontWeight: 600, fontSize: 14 }}><AddRounded fontSize="small" />選擇檔案</Box>
        <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 2 }}>
          PDF、PNG、JPG、WebP · 可一次選擇多份 · 合計最多 {MAX_UPLOAD_MB} MB
        </Typography>
      </Box>
      <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ xs: 'flex-start', md: 'center' }} justifyContent="space-between" gap={1} sx={{ mt: 2 }}>
        <Typography variant="caption" color="text.secondary">多張圖片會依檔名排序合成一份 PDF，每張一頁。</Typography>
        {pageSizeToggle}
      </Stack>
    </Paper>
  );
}

export default UploadZone;
