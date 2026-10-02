import { Box, Paper, Typography } from '@mui/material';
import { UploadFile as UploadFileIcon } from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';
import type { FileRejection } from 'react-dropzone';
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_MB } from '../constants';

interface UploadZoneProps {
  disabled: boolean;
  /** 已有文件時縮成一列，把空間留給頁面預覽 */
  compact?: boolean;
  onFiles: (files: File[]) => void;
  onError: (message: string) => void;
}

function UploadZone({ disabled, compact = false, onFiles, onError }: UploadZoneProps) {
  const onDrop = (acceptedFiles: File[], rejections: FileRejection[]) => {
    if (rejections.length > 0) {
      const names = rejections.map((rejection) => rejection.file.name).join('、');
      onError(`只能上傳 PDF 檔案：${names}`);
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
    },
    multiple: true,
    disabled,
  });

  const dropzoneSx = {
    border: '2px dashed #ccc',
    borderRadius: 2,
    textAlign: 'center',
    cursor: disabled ? 'default' : 'pointer',
    bgcolor: isDragActive ? '#e3f2fd' : '#fafafa',
    transition: 'background-color 0.3s',
  } as const;

  if (compact) {
    return (
      <Box
        {...getRootProps()}
        sx={{
          ...dropzoneSx,
          mb: 2,
          px: 2,
          py: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 1,
        }}
      >
        <input {...getInputProps()} />
        <UploadFileIcon sx={{ color: '#1976d2' }} />
        <Typography variant="body2">
          {isDragActive ? '釋放以上傳檔案' : '拖曳或點擊加入更多 PDF'}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'none', sm: 'inline' } }}>
          合計最多 {MAX_UPLOAD_MB}MB
        </Typography>
      </Box>
    );
  }

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        上傳 PDF 檔案
      </Typography>
      <Box {...getRootProps()} sx={{ ...dropzoneSx, p: 4 }}>
        <input {...getInputProps()} />
        <UploadFileIcon sx={{ fontSize: 48, color: '#1976d2', mb: 1 }} />
        <Typography>
          {isDragActive ? '釋放以上傳檔案' : '拖曳 PDF 檔案到這裡，或點擊選擇檔案'}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          可一次選擇多個檔案，合計最多 {MAX_UPLOAD_MB}MB
        </Typography>
      </Box>
    </Paper>
  );
}

export default UploadZone;
