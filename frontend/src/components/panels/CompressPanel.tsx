import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  Paper,
  Slider,
  TextField,
  Typography,
} from '@mui/material';
import type { CompressionResult } from '../../hooks/usePdfWorkspace';
import type { CompressOptions } from '../../types';
import { formatBytes } from '../../utils/format';

interface CompressPanelProps {
  loading: boolean;
  /** 目前版本是壓縮的結果時，顯示壓縮前後的大小 */
  result: CompressionResult | null;
  onCompress: (options: CompressOptions) => void;
}

const MIN_IMAGE_WIDTH = 100;
const MAX_IMAGE_WIDTH = 10000;

function CompressPanel({ loading, result, onCompress }: CompressPanelProps) {
  const [quality, setQuality] = useState(75);
  const [maxImageWidth, setMaxImageWidth] = useState('1200');
  const [removeEmbeddedFiles, setRemoveEmbeddedFiles] = useState(true);

  const width = Number(maxImageWidth);
  const widthValid = Number.isInteger(width)
    && width >= MIN_IMAGE_WIDTH
    && width <= MAX_IMAGE_WIDTH;

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        壓縮 PDF
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        只重新壓縮內嵌圖片，文字、向量與連結都會保留。
      </Typography>
      <Box sx={{ mb: 2, maxWidth: 480 }}>
        <Typography id="compress-quality" variant="body2" gutterBottom>
          圖片品質：{quality}%
        </Typography>
        <Slider
          aria-labelledby="compress-quality"
          min={1}
          max={100}
          value={quality}
          onChange={(_, value) => setQuality(value as number)}
        />
        <TextField
          label="圖片最大寬度 (px)"
          type="number"
          size="small"
          value={maxImageWidth}
          onChange={(event) => setMaxImageWidth(event.target.value)}
          error={!widthValid}
          helperText={
            widthValid
              ? '較寬的圖片會縮小到這個寬度'
              : `請輸入 ${MIN_IMAGE_WIDTH}–${MAX_IMAGE_WIDTH} 的整數`
          }
          inputProps={{ min: MIN_IMAGE_WIDTH, max: MAX_IMAGE_WIDTH, step: 100 }}
          sx={{ mt: 1, mb: 1 }}
        />
        <FormControlLabel
          sx={{ display: 'flex' }}
          control={(
            <Checkbox
              checked={removeEmbeddedFiles}
              onChange={(event) => setRemoveEmbeddedFiles(event.target.checked)}
            />
          )}
          label="移除 PDF 內嵌的附件"
        />
      </Box>
      {result && (
        <Alert
          severity={result.ratio > 0 ? 'success' : 'warning'}
          sx={{ mb: 2, maxWidth: 480 }}
        >
          <strong>
            {formatBytes(result.originalSize)} → {formatBytes(result.compressedSize)}
          </strong>
          {result.ratio > 0
            ? `（縮小 ${result.ratio}%）`
            : '（沒有變小，這份文件的圖片可能已經很精簡。可降低品質再試，或按「復原上一步」還原）'}
        </Alert>
      )}
      <Button
        variant="contained"
        onClick={() => onCompress({ quality, maxImageWidth: width, removeEmbeddedFiles })}
        disabled={loading || !widthValid}
      >
        {loading ? <CircularProgress size={24} /> : '壓縮 PDF'}
      </Button>
    </Paper>
  );
}

export default CompressPanel;
