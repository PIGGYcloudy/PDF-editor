import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  MenuItem,
  Paper,
  Slider,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { Image as ImageIcon } from '@mui/icons-material';
import { WATERMARK_FONTS, WATERMARK_POSITIONS } from '../../constants';
import type {
  ImageWatermarkConfig,
  TextWatermarkConfig,
  WatermarkPosition,
} from '../../types';

type WatermarkMode = 'text' | 'image';

const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif'];

interface WatermarkPanelProps {
  selectedCount: number;
  loading: boolean;
  onAddText: (config: TextWatermarkConfig) => void;
  onAddImage: (image: File, config: ImageWatermarkConfig) => void;
}

function WatermarkPanel({
  selectedCount,
  loading,
  onAddText,
  onAddImage,
}: WatermarkPanelProps) {
  const [mode, setMode] = useState<WatermarkMode>('text');
  const [position, setPosition] = useState<WatermarkPosition>('center');
  const [opacity, setOpacity] = useState(0.3);

  const [text, setText] = useState('CONFIDENTIAL');
  const [fontFamily, setFontFamily] = useState('Helvetica');
  const [fontSize, setFontSize] = useState('48');
  const [color, setColor] = useState('#FF0000');
  const [rotation, setRotation] = useState(45);

  const [image, setImage] = useState<File | null>(null);
  const [imageWidth, setImageWidth] = useState('');

  const imageUrl = useMemo(
    () => (image ? URL.createObjectURL(image) : null),
    [image],
  );
  useEffect(() => () => {
    if (imageUrl) {
      URL.revokeObjectURL(imageUrl);
    }
  }, [imageUrl]);

  const fontSizeValue = Number(fontSize);
  const fontSizeValid = Number.isInteger(fontSizeValue)
    && fontSizeValue >= 8
    && fontSizeValue <= 200;
  const imageWidthValue = imageWidth.trim() === '' ? undefined : Number(imageWidth);
  const imageWidthValid = imageWidthValue === undefined
    || (Number.isInteger(imageWidthValue) && imageWidthValue >= 1);

  const canSubmit = mode === 'text'
    ? text.trim().length > 0 && fontSizeValid
    : image !== null && imageWidthValid;

  const handleSubmit = () => {
    if (mode === 'text') {
      onAddText({
        text,
        position,
        fontSize: fontSizeValue,
        fontFamily,
        color,
        opacity,
        rotation,
      });
    } else if (image) {
      onAddImage(image, { position, opacity, imageWidth: imageWidthValue });
    }
  };

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        添加浮水印
      </Typography>
      <ToggleButtonGroup
        exclusive
        color="primary"
        size="small"
        value={mode}
        onChange={(_, value: WatermarkMode | null) => value && setMode(value)}
        aria-label="浮水印類型"
        sx={{ mb: 2 }}
      >
        <ToggleButton value="text">文字</ToggleButton>
        <ToggleButton value="image">圖片</ToggleButton>
      </ToggleButtonGroup>

      <Stack spacing={2} sx={{ mb: 2, maxWidth: 520 }}>
        {mode === 'text' ? (
          <>
            <TextField
              label="浮水印文字"
              value={text}
              onChange={(event) => setText(event.target.value)}
              helperText="含中文時會自動使用內建中文字型"
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                select
                label="字型"
                value={fontFamily}
                onChange={(event) => setFontFamily(event.target.value)}
                sx={{ minWidth: 200 }}
              >
                {WATERMARK_FONTS.map((font) => (
                  <MenuItem key={font.value} value={font.value}>{font.label}</MenuItem>
                ))}
              </TextField>
              <TextField
                label="字級 (pt)"
                type="number"
                value={fontSize}
                onChange={(event) => setFontSize(event.target.value)}
                error={!fontSizeValid}
                helperText={fontSizeValid ? ' ' : '請輸入 8–200 的整數'}
                inputProps={{ min: 8, max: 200 }}
              />
              <TextField
                label="顏色"
                type="color"
                value={color}
                onChange={(event) => setColor(event.target.value.toUpperCase())}
                sx={{ minWidth: 96 }}
              />
            </Stack>
            <Box>
              <Typography id="watermark-rotation" variant="body2" gutterBottom>
                旋轉角度：{rotation}°
              </Typography>
              <Slider
                aria-labelledby="watermark-rotation"
                min={0}
                max={360}
                value={rotation}
                onChange={(_, value) => setRotation(value as number)}
              />
            </Box>
          </>
        ) : (
          <>
            <Stack direction="row" spacing={2} alignItems="center">
              <Button component="label" variant="outlined" startIcon={<ImageIcon />}>
                選擇圖片
                <input
                  hidden
                  type="file"
                  accept={ACCEPTED_IMAGE_TYPES.join(',')}
                  onChange={(event) => {
                    setImage(event.target.files?.[0] ?? null);
                    // 允許再次選擇同一個檔案
                    event.target.value = '';
                  }}
                />
              </Button>
              <Typography variant="body2" color="text.secondary" noWrap>
                {image ? image.name : 'PNG、JPG 或 GIF；透明背景的 PNG 效果最好'}
              </Typography>
            </Stack>
            {imageUrl && (
              <Box
                component="img"
                src={imageUrl}
                alt="浮水印圖片預覽"
                sx={{
                  maxWidth: 200,
                  maxHeight: 120,
                  objectFit: 'contain',
                  border: '1px solid #eee',
                  borderRadius: 1,
                  bgcolor: '#fafafa',
                }}
              />
            )}
            <TextField
              label="圖片寬度 (pt)"
              type="number"
              value={imageWidth}
              onChange={(event) => setImageWidth(event.target.value)}
              error={!imageWidthValid}
              helperText={
                imageWidthValid
                  ? '留空則依圖片原始尺寸；72 pt 約為 1 英吋，超出頁面時會自動縮小'
                  : '請輸入大於 0 的整數'
              }
              inputProps={{ min: 1 }}
            />
          </>
        )}

        <Box>
          <Typography variant="body2" gutterBottom>位置</Typography>
          <ToggleButtonGroup
            exclusive
            color="primary"
            size="small"
            value={position}
            onChange={(_, value: WatermarkPosition | null) => value && setPosition(value)}
            aria-label="浮水印位置"
            sx={{ flexWrap: 'wrap' }}
          >
            {WATERMARK_POSITIONS.map((option) => (
              <ToggleButton key={option.value} value={option.value}>
                {option.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>
        <Box>
          <Typography id="watermark-opacity" variant="body2" gutterBottom>
            不透明度：{Math.round(opacity * 100)}%
          </Typography>
          <Slider
            aria-labelledby="watermark-opacity"
            min={0.05}
            max={1}
            step={0.05}
            value={opacity}
            onChange={(_, value) => setOpacity(value as number)}
          />
        </Box>
      </Stack>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {selectedCount > 0 ? `將添加到 ${selectedCount} 個選取的頁面` : '將添加到所有頁面'}
      </Typography>
      <Button
        variant="contained"
        onClick={handleSubmit}
        disabled={loading || !canSubmit}
      >
        {loading ? <CircularProgress size={24} /> : '添加浮水印'}
      </Button>
    </Paper>
  );
}

export default WatermarkPanel;
