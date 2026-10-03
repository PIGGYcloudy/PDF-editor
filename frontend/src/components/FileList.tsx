import {
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  Grid,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  CallMerge as MergeIcon,
  Delete as DeleteIcon,
  PictureAsPdf as PdfIcon,
} from '@mui/icons-material';
import type { WorkspaceFile } from '../state/workspace';

interface FileListProps {
  files: WorkspaceFile[];
  currentKey: string | null;
  /** 依勾選順序排列的文件 key */
  mergeSelection: string[];
  loading: boolean;
  onOpen: (key: string) => void;
  onRemove: (file: WorkspaceFile) => void;
  onToggleMerge: (key: string) => void;
  onMerge: () => void;
  onDownload: () => void;
}

function FileList({
  files,
  currentKey,
  mergeSelection,
  loading,
  onOpen,
  onRemove,
  onToggleMerge,
  onMerge,
  onDownload,
}: FileListProps) {
  const mergeNames = mergeSelection
    .map((key) => files.find((file) => file.key === key)?.name)
    .filter((name): name is string => name !== undefined);

  return (
    <Paper sx={{ p: 2, mb: 2 }}>
      {/* 只有一份文件時沒有合併可做，省下標題與合併列的空間 */}
      {files.length > 1 && (
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'stretch', sm: 'center' }}
          spacing={1}
          sx={{ mb: 1.5 }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h6">PDF 檔案</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
              {mergeNames.length > 0
                ? `合併順序：${mergeNames.join(' → ')}`
                : '勾選檔案可打包下載 ZIP，或依勾選順序合併。'}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            <Button variant="outlined" onClick={() => {
              const allSelected = files.every((file) => mergeSelection.includes(file.key));
              files.forEach((file) => {
                if (allSelected || !mergeSelection.includes(file.key)) onToggleMerge(file.key);
              });
            }} disabled={loading}>
              {mergeSelection.length === files.length ? '取消全選' : '全選檔案'}
            </Button>
            <Button variant="outlined" onClick={onDownload} disabled={loading || mergeSelection.length === 0}>
              下載選取 ZIP ({mergeSelection.length})
            </Button>
            <Button
              variant="contained"
              onClick={onMerge}
              disabled={loading || mergeSelection.length < 2}
              startIcon={<MergeIcon />}
            >
              合併選取的 PDF ({mergeSelection.length})
            </Button>
          </Stack>
        </Stack>
      )}
      <Grid container spacing={2}>
        {files.map((file) => {
          const mergeIndex = mergeSelection.indexOf(file.key);
          const isCurrent = currentKey === file.key;
          return (
            <Grid item key={file.key} xs={12} sm={6} md={4}>
              <Paper
                variant="outlined"
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  borderWidth: isCurrent ? 2 : 1,
                  borderColor: isCurrent ? 'primary.main' : 'divider',
                }}
              >
                <Stack direction="row" spacing={1} alignItems="center">
                  <Button
                    variant={isCurrent ? 'contained' : 'outlined'}
                    onClick={() => onOpen(file.key)}
                    disabled={loading}
                    startIcon={<PdfIcon />}
                    sx={{
                      flexGrow: 1,
                      minWidth: 0,
                      justifyContent: 'flex-start',
                      // 檔名需保留原本的大小寫
                      textTransform: 'none',
                    }}
                  >
                    <Box
                      component="span"
                      sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
                      {file.name}
                    </Box>
                  </Button>
                  <Tooltip title="刪除檔案">
                    <span>
                      <IconButton
                        size="small"
                        color="error"
                        aria-label={`刪除 ${file.name}`}
                        onClick={() => onRemove(file)}
                        disabled={loading}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Stack>
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                  sx={{ mt: 1 }}
                >
                  <Typography variant="caption" color="text.secondary">
                    {file.pageCount} 頁
                    {file.history.length > 0 && ` · 已編輯 ${file.history.length} 次`}
                  </Typography>
                  <FormControlLabel
                    sx={{ mr: 0 }}
                    control={(
                      <Checkbox
                        size="small"
                        checked={mergeIndex >= 0}
                        onChange={() => onToggleMerge(file.key)}
                        disabled={loading}
                      />
                    )}
                    label={(
                      <Typography variant="caption">
                        {mergeIndex >= 0 ? `已選取 · 順序 ${mergeIndex + 1}` : '選取檔案'}
                      </Typography>
                    )}
                  />
                </Stack>
              </Paper>
            </Grid>
          );
        })}
      </Grid>
    </Paper>
  );
}

export default FileList;
