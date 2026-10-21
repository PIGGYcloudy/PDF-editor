import { Button, IconButton, Paper, Stack, Tooltip, Typography } from '@mui/material';
import { Close, Download, PictureAsPdf } from '@mui/icons-material';
import type { WorkspaceFile } from '../state/workspace';
interface Props {
  files: WorkspaceFile[];
  currentKey: string | null;
  pendingFileKeys: string[];
  loading: boolean;
  onOpen: (key: string) => void;
  onRemove: (file: WorkspaceFile) => void;
  /** 把列表中的所有文件打包成 ZIP 另存 */
  onSaveAll: () => void;
}
export default function FileList({ files, currentKey, pendingFileKeys, loading, onOpen, onRemove, onSaveAll }: Props) {
  return <Paper component="section" aria-label="文件" sx={{ p: { xs: 1.5, sm: 2 }, mb: 2 }}>
    <Stack direction="row" useFlexGap flexWrap="wrap" gap={1}>
      {files.map((file) => {
        const pending = pendingFileKeys.includes(file.key);
        return <Stack key={file.key} direction="row" alignItems="center" sx={{ maxWidth: '100%' }}>
          <Button startIcon={<PictureAsPdf />} variant={currentKey === file.key ? 'contained' : 'outlined'}
            aria-pressed={currentKey === file.key} disabled={loading} onClick={() => onOpen(file.key)}
            aria-label={pending ? `${file.name}（有未套用的變更）` : file.name}
            sx={{ textTransform: 'none', minWidth: 0 }}>
            <span style={{ overflowWrap: 'anywhere' }}>{file.name}</span>
            {/* 有未套用變更的文件以圓點標示，與 macOS 未儲存文件的慣例一致 */}
            {pending && <span aria-hidden style={{ width: 7, height: 7, marginLeft: 8, borderRadius: '50%', background: 'currentColor', flexShrink: 0 }} />}
          </Button>
          <Tooltip title="移除檔案"><span><IconButton aria-label={`移除 ${file.name}`} disabled={loading}
            onClick={() => onRemove(file)}><Close fontSize="small" /></IconButton></span></Tooltip>
        </Stack>;
      })}
    </Stack>
    <Stack direction="row" alignItems="center" justifyContent="space-between" useFlexGap flexWrap="wrap" gap={1} sx={{ mt: 1 }}>
      <Typography variant="caption" color="text.secondary" component="p">
        檔案只在伺服器暫存一段時間，完成後請另存到裝置。
      </Typography>
      {/* 只有一份時用工具列的「另存 PDF」即可 */}
      {files.length > 1 && <Button size="small" startIcon={<Download />} disabled={loading} onClick={onSaveAll}>
        全部另存（ZIP，{files.length} 份）
      </Button>}
    </Stack>
  </Paper>;
}
