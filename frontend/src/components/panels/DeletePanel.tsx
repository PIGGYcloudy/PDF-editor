import { Button, CircularProgress, Paper, Typography } from '@mui/material';

interface DeletePanelProps {
  selectedCount: number;
  loading: boolean;
  onDelete: () => void;
}

function DeletePanel({ selectedCount, loading, onDelete }: DeletePanelProps) {
  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        刪除頁面
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        已選取 {selectedCount} 個頁面；刪除後可用「復原上一步」還原。
      </Typography>
      <Button
        variant="contained"
        color="error"
        onClick={onDelete}
        disabled={selectedCount === 0 || loading}
      >
        {loading ? <CircularProgress size={24} /> : '刪除選取的頁面'}
      </Button>
    </Paper>
  );
}

export default DeletePanel;
