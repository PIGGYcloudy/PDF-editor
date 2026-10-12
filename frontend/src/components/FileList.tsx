import { Button, IconButton, Paper, Stack, Tooltip, Typography } from '@mui/material';
import { Delete, PictureAsPdf } from '@mui/icons-material';
import type { WorkspaceFile } from '../state/workspace';
interface Props {
  files: WorkspaceFile[];
  currentKey: string | null;
  pendingFileKeys: string[];
  loading: boolean;
  onOpen: (key: string) => void;
  onRemove: (file: WorkspaceFile) => void;
}
export default function FileList({ files, currentKey, pendingFileKeys, loading, onOpen, onRemove }: Props) {
  return <Paper component="section" aria-label="文件列表" sx={{ p: 2, mb: 2, bgcolor: 'rgba(255,255,255,.8)' }}>
    <Typography variant="subtitle2" sx={{ mb: 1.5 }}>選擇要編輯的 PDF <Typography component="span" variant="caption" color="text.secondary">· {files.length} 份</Typography></Typography>
    <Stack direction="row" useFlexGap flexWrap="wrap" gap={1}>
      {files.map((file) => <Stack key={file.key} direction="row" alignItems="center" sx={{ maxWidth: '100%' }}>
        <Button startIcon={<PictureAsPdf />} variant={currentKey === file.key ? 'contained' : 'outlined'}
          aria-pressed={currentKey === file.key} disabled={loading} onClick={() => onOpen(file.key)}
          sx={{ textTransform: 'none', minWidth: 0 }}>
          <span style={{ overflowWrap: 'anywhere' }}>{file.name}</span>
        </Button>
        {pendingFileKeys.includes(file.key) && <Typography variant="caption" sx={{ ml: 1 }}>未套用</Typography>}
        <Tooltip title="刪除檔案"><span><IconButton color="error" aria-label={`刪除 ${file.name}`} disabled={loading}
          onClick={() => onRemove(file)}><Delete fontSize="small" /></IconButton></span></Tooltip>
      </Stack>)}
    </Stack>
  </Paper>;
}
