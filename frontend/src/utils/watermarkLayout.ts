import type { WatermarkPosition } from '../types';

/** 與後端 WatermarkService 的版面計算保持一致，讓預覽和實際輸出相符。 */

/** 浮水印與頁面邊緣的距離 (pt) */
export const WATERMARK_MARGIN = 10;

export interface Point {
  x: number;
  y: number;
}

/**
 * 浮水印中心點的位置，座標以頁面左上角為原點、向下為正，單位 pt。
 * objectWidth/objectHeight 是浮水印（旋轉後）佔用的寬高。
 */
export function watermarkCenter(
  pageWidth: number,
  pageHeight: number,
  objectWidth: number,
  objectHeight: number,
  position: WatermarkPosition,
  margin = WATERMARK_MARGIN,
): Point {
  const left = margin + objectWidth / 2;
  const right = pageWidth - margin - objectWidth / 2;
  const top = margin + objectHeight / 2;
  const bottom = pageHeight - margin - objectHeight / 2;
  switch (position) {
    case 'center':
      return { x: pageWidth / 2, y: pageHeight / 2 };
    case 'top-left':
      return { x: left, y: top };
    case 'top-right':
      return { x: right, y: top };
    case 'bottom-left':
      return { x: left, y: bottom };
    case 'bottom-right':
      return { x: right, y: bottom };
  }
}

/** 矩形旋轉後的外框尺寸。 */
export function rotatedSize(
  width: number,
  height: number,
  degrees: number,
): { width: number; height: number } {
  const radians = (degrees * Math.PI) / 180;
  const cos = Math.abs(Math.cos(radians));
  const sin = Math.abs(Math.sin(radians));
  return {
    width: width * cos + height * sin,
    height: width * sin + height * cos,
  };
}

/** 圖片浮水印的實際大小 (pt)：預設依 150 DPI，並縮小到放得進頁面。 */
export function imageWatermarkSize(
  naturalWidth: number,
  naturalHeight: number,
  requestedWidth: number | undefined,
  pageWidth: number,
  pageHeight: number,
  margin = WATERMARK_MARGIN,
): { width: number; height: number } {
  const width = requestedWidth ?? (naturalWidth * 72) / 150;
  const height = (width * naturalHeight) / naturalWidth;
  const maxWidth = Math.max(1, pageWidth - margin * 2);
  const maxHeight = Math.max(1, pageHeight - margin * 2);
  const fit = Math.min(1, maxWidth / width, maxHeight / height);
  return { width: width * fit, height: height * fit };
}

/** 內建 PDF 字型的上緣／下緣高度（佔字級的比例），用來估算文字的外框高度。 */
const FONT_METRICS: Record<string, { ascent: number; descent: number }> = {
  Helvetica: { ascent: 0.718, descent: 0.207 },
  'Times-Roman': { ascent: 0.683, descent: 0.217 },
  Courier: { ascent: 0.629, descent: 0.157 },
};
const CJK_METRICS = { ascent: 0.88, descent: 0.12 };

export function containsCjk(text: string): boolean {
  return /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/.test(text);
}

export function fontMetrics(fontFamily: string, text: string) {
  if (containsCjk(text)) {
    return CJK_METRICS;
  }
  return FONT_METRICS[fontFamily] ?? FONT_METRICS.Helvetica;
}
