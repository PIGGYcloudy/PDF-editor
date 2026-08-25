import { useEffect, useState } from 'react';
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

function SaveFileDialog({
  open,
  suggestedName,
  extension,
  nativeSaveAvailable,
  error,
  loading,
  onCancel,
  onSave,
}: SaveFileDialogProps) {
  const [filename, setFilename] = useState(suggestedName);

  useEffect(() => {
    if (open) {
      setFilename(suggestedName);
    }
  }, [open, suggestedName]);

  const handleSave = () => {
    onSave(normalizeDownloadFilename(filename, extension, 'download'));
  };

  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : onCancel}
      fullWidth
      maxWidth="xs"
    >
      <DialogTitle>儲存檔案</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <DialogContentText sx={{ mb: 2 }}>
          {nativeSaveAvailable
            ? '確認檔案名稱後，可在下一個視窗選擇儲存資料夾。'
            : '這個瀏覽器無法由網頁直接選擇資料夾；實際儲存位置會依瀏覽器的下載設定決定。'}
        </DialogContentText>
        <TextField
          autoFocus
          fullWidth
          label="檔案名稱"
          value={filename}
          onChange={(event) => setFilename(event.target.value)}
          helperText={`若未輸入 ${extension}，系統會自動補上。`}
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
    </Dialog>
  );
}

export default SaveFileDialog;
