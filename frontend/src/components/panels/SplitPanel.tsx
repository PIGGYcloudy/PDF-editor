import { useState } from 'react';
import {
  Button,
  CircularProgress,
  FormControl,
  FormControlLabel,
  Paper,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type { SplitOptions } from '../../types';

interface SplitPanelProps {
  pageCount: number;
  loading: boolean;
  onSplit: (options: SplitOptions) => void;
}

type SplitMode = SplitOptions['mode'];

function SplitPanel({ pageCount, loading, onSplit }: SplitPanelProps) {
  const [mode, setMode] = useState<SplitMode>('ranges');
  const [ranges, setRanges] = useState('');
  const [every, setEvery] = useState('1');

  const everyNumber = Number(every);
  const everyValid = Number.isInteger(everyNumber)
    && everyNumber >= 1
    && everyNumber < pageCount;
  const canSplit = pageCount > 1 && (
    mode === 'ranges' ? ranges.trim().length > 0 : everyValid
  );

  const submit = () => onSplit(
    mode === 'ranges'
      ? { mode, ranges: ranges.trim() }
      : { mode, every: everyNumber },
  );

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        拆分 PDF
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        拆出的檔案會加入檔案列表，目前的文件不會改變。只想取出幾頁時，
        也可以在頁面預覽選取後按「抽出為新檔案」。
      </Typography>
      <FormControl sx={{ width: '100%', maxWidth: 480 }}>
        <RadioGroup
          value={mode}
          onChange={(event) => setMode(event.target.value as SplitMode)}
        >
          <FormControlLabel value="ranges" control={<Radio />} label="依頁碼範圍" />
          <TextField
            size="small"
            label="頁碼範圍"
            placeholder="例如 1-3, 5, 8-10"
            value={ranges}
            disabled={mode !== 'ranges'}
            onChange={(event) => setRanges(event.target.value)}
            helperText={`以逗號分隔，每一段成為一個檔案（共 ${pageCount} 頁）`}
            sx={{ ml: 4, mb: 1 }}
          />
          <FormControlLabel value="every" control={<Radio />} label="每 N 頁一個檔案" />
          <TextField
            size="small"
            type="number"
            label="每個檔案的頁數"
            value={every}
            disabled={mode !== 'every'}
            onChange={(event) => setEvery(event.target.value)}
            error={mode === 'every' && !everyValid}
            helperText={
              mode === 'every' && !everyValid
                ? `請輸入 1–${Math.max(pageCount - 1, 1)} 的整數`
                : '最後一個檔案可能不足 N 頁'
            }
            inputProps={{ min: 1, max: Math.max(pageCount - 1, 1), step: 1 }}
            sx={{ ml: 4, mb: 1 }}
          />
        </RadioGroup>
      </FormControl>
      <Stack direction="row" sx={{ mt: 1 }}>
        <Button
          variant="contained"
          onClick={submit}
          disabled={loading || !canSplit}
        >
          {loading ? <CircularProgress size={24} /> : '拆分 PDF'}
        </Button>
      </Stack>
    </Paper>
  );
}

export default SplitPanel;
