import { describe, expect, it } from 'vitest';
import {
  containsCjk,
  fontMetrics,
  imageWatermarkSize,
  rotatedSize,
  watermarkCenter,
} from './watermarkLayout';

describe('watermarkCenter', () => {
  const page = [600, 800] as const;

  it('centers on the page', () => {
    expect(watermarkCenter(...page, 100, 40, 'center')).toEqual({ x: 300, y: 400 });
  });

  it('keeps a 10pt margin from the corners (y grows downward)', () => {
    expect(watermarkCenter(...page, 100, 40, 'top-left')).toEqual({ x: 60, y: 30 });
    expect(watermarkCenter(...page, 100, 40, 'top-right')).toEqual({ x: 540, y: 30 });
    expect(watermarkCenter(...page, 100, 40, 'bottom-left')).toEqual({ x: 60, y: 770 });
    expect(watermarkCenter(...page, 100, 40, 'bottom-right')).toEqual({ x: 540, y: 770 });
  });
});

describe('rotatedSize', () => {
  it('swaps width and height at 90 degrees', () => {
    const size = rotatedSize(100, 20, 90);
    expect(size.width).toBeCloseTo(20);
    expect(size.height).toBeCloseTo(100);
  });

  it('is unchanged at 0 and 180 degrees', () => {
    expect(rotatedSize(100, 20, 0)).toEqual({ width: 100, height: 20 });
    expect(rotatedSize(100, 20, 180).width).toBeCloseTo(100);
  });
});

describe('imageWatermarkSize', () => {
  it('defaults to the width at 150 DPI', () => {
    const size = imageWatermarkSize(300, 150, undefined, 600, 800);
    expect(size).toEqual({ width: 144, height: 72 });
  });

  it('uses the requested width and keeps the aspect ratio', () => {
    expect(imageWatermarkSize(200, 100, 100, 600, 800)).toEqual({ width: 100, height: 50 });
  });

  it('shrinks to fit inside the page margins', () => {
    const size = imageWatermarkSize(200, 100, 1000, 600, 800);
    expect(size.width).toBeCloseTo(580);
    expect(size.height).toBeCloseTo(290);
  });
});

describe('fonts', () => {
  it('detects CJK text and picks metrics accordingly', () => {
    expect(containsCjk('機密')).toBe(true);
    expect(containsCjk('CONFIDENTIAL')).toBe(false);
    expect(fontMetrics('Courier', '機密').ascent).toBeGreaterThan(0.8);
    expect(fontMetrics('Courier', 'abc').ascent).toBe(0.629);
    expect(fontMetrics('Unknown', 'abc').ascent).toBe(0.718);
  });
});
