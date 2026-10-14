import { describe, expect, it } from 'vitest';
import { describePageSizes } from './pageSizes';

describe('describePageSizes', () => {
  it('treats portrait and landscape of the same paper as one size', () => {
    expect(describePageSizes([
      { width: 595, height: 842 },
      { width: 842, height: 595 },
    ])).toBe('所有頁面都是 210 × 297 mm');
  });

  it('counts distinct sizes from scans', () => {
    expect(describePageSizes([
      { width: 595, height: 842 },
      { width: 1000, height: 1400 },
      { width: 580, height: 860 },
    ])).toBe('目前 3 頁共有 3 種尺寸');
  });

  it('returns nothing without pages', () => {
    expect(describePageSizes([])).toBe('');
  });
});
