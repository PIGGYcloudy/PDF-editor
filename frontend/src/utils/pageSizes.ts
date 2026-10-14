import type { Page } from '../types';

const PT_TO_MM = 25.4 / 72;

/**
 * 描述頁面的尺寸分布，例如「210 × 297 mm」或「共 3 種尺寸」。
 * 直式與橫式視為同一種尺寸，以公釐取整數比較，忽略掃描產生的細小差異。
 */
export function describePageSizes(pages: Pick<Page, 'width' | 'height'>[]): string {
  const sizes = new Set(pages.map(({ width, height }) => {
    const [short, long] = [width, height]
      .map((value) => Math.round(value * PT_TO_MM))
      .sort((first, second) => first - second);
    return `${short} × ${long} mm`;
  }));
  if (sizes.size === 0) return '';
  if (sizes.size === 1) return `所有頁面都是 ${[...sizes][0]}`;
  return `目前 ${pages.length} 頁共有 ${sizes.size} 種尺寸`;
}
