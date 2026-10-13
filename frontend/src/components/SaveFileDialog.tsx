import { useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  TextField,
} from '@mui/material';
import { normalizeDownloadFilename } from '../utils/fileSave';

interface SaveFileDialogProps {
  open: boolean;
  suggestedName: string;
  extension: string;
  nativeSaveAvailable: boolean;
  error: string | null;
  loading: boolean;
  onCancel: () => void;
  onSave: (filename: string) => void;
}

type SaveFileFormProps = Omit<SaveFileDialogProps, 'open'>;

/**
 * Dialog 關閉動畫結束後會卸載內容，因此每次開啟都會以建議檔名重新開始。
 */
function SaveFileForm({
  suggestedName,
  extension,
  nativeSaveAvailable,
  error,
  loading,
  onCancel,
  onSave,
}: SaveFileFormProps) {
  const [filename, setFilename] = useState(suggestedName);

  const handleSave = () => {
    onSave(normalizeDownloadFilename(filename, extension, 'download'));
  };

  return (
    <>
      <DialogTitle>另存檔案</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <DialogContentText sx={{ mb: 2 }}>
          {nativeSaveAvailable
            ? '確認檔名後，可在下一步選擇儲存位置。'
            : '檔案會存到瀏覽器的預設下載位置。'}
        </DialogContentText>
        <TextField
          autoFocus
          fullWidth
          label="檔案名稱"
          value={filename}
          onChange={(event) => setFilename(event.target.value)}
          helperText={`會自動補上 ${extension}`}
          disabled={loading}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={loading}>
          取消
        </Button>
        <Button
          onClick={handleSave}
          disabled={loading || filename.trim().length === 0}
          variant="contained"
        >
          {nativeSaveAvailable ? '選擇位置並儲存' : '下載'}
        </Button>
      </DialogActions>
    </>
  );
}

function SaveFileDialog({ open, ...formProps }: SaveFileDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={formProps.loading ? undefined : formProps.onCancel}
      fullWidth
      maxWidth="xs"
    >
      <SaveFileForm key={formProps.suggestedName} {...formProps} />
    </Dialog>
  );
}

export default SaveFileDialog;
