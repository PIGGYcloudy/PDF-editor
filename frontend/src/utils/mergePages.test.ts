import { expect, it } from 'vitest';
import { parseMergePages } from './mergePages';
it('defaults to every page and supports ordered ranges without duplicates', () => {
  expect(parseMergePages('', 3)).toEqual([1, 2, 3]);
  expect(parseMergePages('3, 1-2，2', 3)).toEqual([3, 1, 2]);
});
it.each(['0', '4', '3-1', '1-', '1,,2', '1.5', '1-999999999'])('rejects invalid range %s', (value) => {
  expect(() => parseMergePages(value, 3)).toThrow();
});
