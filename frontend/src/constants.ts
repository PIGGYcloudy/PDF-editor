import type { WatermarkPosition } from './types';

/** 單次上傳合計大小上限，需與後端 MAX_UPLOAD_MB 及 nginx client_max_body_size 一致 */
export const MAX_UPLOAD_MB = 100;
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

export const WATERMARK_POSITIONS: ReadonlyArray<{
  value: WatermarkPosition;
  label: string;
}> = [
  { value: 'top-left', label: '左上' },
  { value: 'top-right', label: '右上' },
  { value: 'center', label: '置中' },
  { value: 'bottom-left', label: '左下' },
  { value: 'bottom-right', label: '右下' },
];

/** 後端支援的拉丁字型；含中文的文字會自動改用內建中文字型 */
export const WATERMARK_FONTS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'Helvetica', label: 'Helvetica（無襯線）' },
  { value: 'Times-Roman', label: 'Times（襯線）' },
  { value: 'Courier', label: 'Courier（等寬）' },
];
