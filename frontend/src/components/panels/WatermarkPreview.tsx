import { useEffect, useMemo, useState } from 'react';
import { Box, Typography } from '@mui/material';
import type { WatermarkPosition } from '../../types';
import {
  fontMetrics,
  imageWatermarkSize,
  rotatedSize,
  watermarkCenter,
} from '../../utils/watermarkLayout';

export type WatermarkPreviewContent =
  | {
    kind: 'text';
    text: string;
    position: WatermarkPosition;
    fontSize: number;
    fontFamily: string;
    color: string;
    opacity: number;
    rotation: number;
  }
  | {
    kind: 'image';
    url: string | null;
    position: WatermarkPosition;
    opacity: number;
    imageWidth?: number;
  };

export interface WatermarkPreviewPage {
  /** 目前顯示的順序位置（從 1 開始） */
  position: number;
  url: string;
  /** 頁面尺寸 (pt) */
  width: number;
  height: number;
}

interface WatermarkPreviewProps {
  page: WatermarkPreviewPage;
  content: WatermarkPreviewContent;
}

const CSS_FONTS: Record<string, string> = {
  Helvetica: 'Helvetica, Arial, sans-serif',
  'Times-Roman': '"Times New Roman", Times, serif',
  Courier: '"Courier New", Courier, monospace',
};

function measureTextWidth(text: string, fontFamily: string, fontSize: number): number {
  const context = document.createElement('canvas').getContext('2d');
  if (!context) {
    return text.length * fontSize * 0.6;
  }
  context.font = `${fontSize}px ${fontFamily}`;
  return context.measureText(text).width;
}

/**
 * 在頁面縮圖上疊出浮水印的樣子。SVG 的座標單位就是 pt，與後端輸出使用同一套版面計算。
 */
function WatermarkPreview({ page, content }: WatermarkPreviewProps) {
  const [thumbAspect, setThumbAspect] = useState<number | null>(null);
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);
  const imageUrl = content.kind === 'image' ? content.url : null;

  useEffect(() => {
    if (!imageUrl) {
      return undefined;
    }
    let cancelled = false;
    const probe = new Image();
    probe.onload = () => {
      if (!cancelled) {
        setImageSize({ width: probe.naturalWidth, height: probe.naturalHeight });
      }
    };
    probe.src = imageUrl;
    return () => {
      cancelled = true;
      setImageSize(null);
    };
  }, [imageUrl]);

  // 頁面本身帶有旋轉屬性時，渲染出的縮圖方向和 MediaBox 相反
  const mediaAspect = page.width / page.height;
  const swapped = thumbAspect !== null
    && Math.abs(thumbAspect / mediaAspect - 1) > Math.abs(thumbAspect * mediaAspect - 1);
  const pageWidth = swapped ? page.height : page.width;
  const pageHeight = swapped ? page.width : page.height;

  const overlay = useMemo(() => {
    if (content.kind === 'text') {
      if (content.text.trim() === '' || !(content.fontSize > 0)) {
        return null;
      }
      const family = CSS_FONTS[content.fontFamily] ?? CSS_FONTS.Helvetica;
      const metrics = fontMetrics(content.fontFamily, content.text);
      const textWidth = measureTextWidth(content.text, family, content.fontSize);
      const textHeight = (metrics.ascent + metrics.descent) * content.fontSize;
      const box = rotatedSize(textWidth, textHeight, content.rotation);
      const center = watermarkCenter(pageWidth, pageHeight, box.width, box.height, content.position);
      return {
        kind: 'text' as const,
        center,
        family,
        baseline: ((metrics.ascent - metrics.descent) / 2) * content.fontSize,
      };
    }
    if (!imageSize || !imageUrl) {
      return null;
    }
    const size = imageWatermarkSize(
      imageSize.width,
      imageSize.height,
      content.imageWidth,
      pageWidth,
      pageHeight,
    );
    return {
      kind: 'image' as const,
      size,
      center: watermarkCenter(pageWidth, pageHeight, size.width, size.height, content.position),
    };
  }, [content, imageSize, imageUrl, pageWidth, pageHeight]);

  return (
    <Box sx={{ width: '100%', maxWidth: 280 }}>
      <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 0.5 }}>
        預覽（第 {page.position} 頁）
      </Typography>
      <Box
        sx={{
          position: 'relative',
          width: '100%',
          aspectRatio: `${pageWidth} / ${pageHeight}`,
          bgcolor: '#fff',
          border: '1px solid #ddd',
          boxShadow: 1,
          overflow: 'hidden',
        }}
      >
        <img
          src={page.url}
          alt={`第 ${page.position} 頁`}
          draggable={false}
          onLoad={(event) => {
            const { naturalWidth, naturalHeight } = event.currentTarget;
            if (naturalWidth > 0 && naturalHeight > 0) {
              setThumbAspect(naturalWidth / naturalHeight);
            }
          }}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        />
        <svg
          viewBox={`0 0 ${pageWidth} ${pageHeight}`}
          preserveAspectRatio="none"
          aria-hidden="true"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        >
          {overlay?.kind === 'text' && content.kind === 'text' && (
            <g
              transform={`translate(${overlay.center.x} ${overlay.center.y}) rotate(${-content.rotation})`}
            >
              <text
                y={overlay.baseline}
                textAnchor="middle"
                fontSize={content.fontSize}
                fontFamily={overlay.family}
                fill={content.color}
                fillOpacity={content.opacity}
              >
                {content.text}
              </text>
            </g>
          )}
          {overlay?.kind === 'image' && content.kind === 'image' && imageUrl && (
            <image
              href={imageUrl}
              x={overlay.center.x - overlay.size.width / 2}
              y={overlay.center.y - overlay.size.height / 2}
              width={overlay.size.width}
              height={overlay.size.height}
              opacity={content.opacity}
              preserveAspectRatio="none"
            />
          )}
        </svg>
      </Box>
    </Box>
  );
}

export default WatermarkPreview;
