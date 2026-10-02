import { describe, expect, it } from 'vitest';
import { isPdfFile, sortByNameNatural } from './files';

const file = (name: string, type = '') => new File(['x'], name, { type });

describe('isPdfFile', () => {
  it('accepts a PDF by type or extension', () => {
    expect(isPdfFile(file('a.bin', 'application/pdf'))).toBe(true);
    expect(isPdfFile(file('SCAN.PDF'))).toBe(true);
    expect(isPdfFile(file('photo.jpg', 'image/jpeg'))).toBe(false);
  });
});

describe('sortByNameNatural', () => {
  it('orders numbers by value without changing the input', () => {
    const input = [file('IMG_10.jpg'), file('IMG_2.jpg'), file('IMG_1.jpg')];
    expect(sortByNameNatural(input).map((item) => item.name)).toEqual([
      'IMG_1.jpg',
      'IMG_2.jpg',
      'IMG_10.jpg',
    ]);
    expect(input[0].name).toBe('IMG_10.jpg');
  });
});
