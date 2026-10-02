import { describe, expect, it } from 'vitest';
import {
  MAX_EDIT_HISTORY,
  describeEdits,
  hasPendingEdits,
  initialPageEdits,
  invertSelection,
  normalizeRotation,
  pageEditsReducer,
  pagesBetween,
  pagesByParity,
  summarizeEdits,
} from './pageEdits';
import type { PageEditsAction, PageEditsState } from './pageEdits';

function reduce(...actions: PageEditsAction[]): PageEditsState {
  return actions.reduce(pageEditsReducer, initialPageEdits);
}

const load: PageEditsAction = { type: 'reset', pageNumbers: [1, 2, 3, 4] };
const order = (state: PageEditsState) => state.pages.map((page) => page.pageNumber);

describe('pageEditsReducer', () => {
  it('starts clean after loading pages', () => {
    const state = reduce(load);
    expect(order(state)).toEqual([1, 2, 3, 4]);
    expect(hasPendingEdits(state)).toBe(false);
  });

  it('rotates relative to the current rotation and wraps around', () => {
    const state = reduce(
      load,
      { type: 'rotate', pageNumbers: [2], delta: 90 },
      { type: 'rotate', pageNumbers: [2, 3], delta: -90 },
      { type: 'rotate', pageNumbers: [3], delta: -90 },
    );
    expect(state.pages.map((page) => page.rotation)).toEqual([0, 0, 180, 0]);
    expect(normalizeRotation(450)).toBe(90);
    expect(normalizeRotation(-180)).toBe(180);
  });

  it('is clean again once rotations cancel out', () => {
    const state = reduce(
      load,
      { type: 'rotate', pageNumbers: [1], delta: 90 },
      { type: 'rotate', pageNumbers: [1], delta: -90 },
    );
    expect(hasPendingEdits(state)).toBe(false);
  });

  it('removes pages but never the last remaining one', () => {
    const removed = reduce(load, { type: 'remove', pageNumbers: [1, 3] });
    expect(order(removed)).toEqual([2, 4]);

    const all = pageEditsReducer(removed, { type: 'remove', pageNumbers: [2, 4] });
    expect(all).toBe(removed);
  });

  it('ignores edits that change nothing', () => {
    const state = reduce(load);
    expect(pageEditsReducer(state, { type: 'remove', pageNumbers: [9] })).toBe(state);
    expect(pageEditsReducer(state, { type: 'rotate', pageNumbers: [9], delta: 90 })).toBe(state);
    expect(pageEditsReducer(state, { type: 'reorder', order: [1, 2, 3, 4] })).toBe(state);
  });

  it('reorders pages and keeps their rotation', () => {
    const state = reduce(
      load,
      { type: 'rotate', pageNumbers: [3], delta: 90 },
      { type: 'reorder', order: [3, 1, 2, 4] },
    );
    expect(order(state)).toEqual([3, 1, 2, 4]);
    expect(state.pages[0]).toEqual({ pageNumber: 3, rotation: 90 });
  });

  it('rejects an order that is not a permutation of the current pages', () => {
    const state = reduce(load);
    expect(pageEditsReducer(state, { type: 'reorder', order: [1, 2] })).toBe(state);
    expect(pageEditsReducer(state, { type: 'reorder', order: [1, 2, 3, 9] })).toBe(state);
  });

  it('undoes staged edits one at a time', () => {
    const edited = reduce(
      load,
      { type: 'remove', pageNumbers: [1] },
      { type: 'rotate', pageNumbers: [2], delta: 180 },
    );
    const undoneOnce = pageEditsReducer(edited, { type: 'undo' });
    expect(undoneOnce.pages.map((page) => page.rotation)).toEqual([0, 0, 0]);
    expect(order(undoneOnce)).toEqual([2, 3, 4]);

    const undoneTwice = pageEditsReducer(undoneOnce, { type: 'undo' });
    expect(order(undoneTwice)).toEqual([1, 2, 3, 4]);
    expect(pageEditsReducer(undoneTwice, { type: 'undo' })).toBe(undoneTwice);
  });

  it('discards all staged edits', () => {
    const state = reduce(
      load,
      { type: 'remove', pageNumbers: [1] },
      { type: 'rotate', pageNumbers: [2], delta: 90 },
      { type: 'discard' },
    );
    expect(hasPendingEdits(state)).toBe(false);
    expect(order(state)).toEqual([1, 2, 3, 4]);
    expect(state.history).toEqual([]);
  });

  it('limits the undo history', () => {
    const rotations: PageEditsAction[] = Array.from(
      { length: MAX_EDIT_HISTORY + 10 },
      () => ({ type: 'rotate', pageNumbers: [1], delta: 90 }),
    );
    expect(reduce(load, ...rotations).history).toHaveLength(MAX_EDIT_HISTORY);
  });
});

describe('summarizeEdits', () => {
  it('counts deleted, rotated and moved pages separately', () => {
    const state = reduce(
      load,
      { type: 'remove', pageNumbers: [2] },
      { type: 'rotate', pageNumbers: [1, 4], delta: 90 },
      { type: 'reorder', order: [4, 1, 3] },
    );
    const summary = summarizeEdits(state);
    expect(summary).toEqual({ deleted: 1, rotated: 2, moved: true });
    expect(describeEdits(summary)).toBe('刪除 1 頁、旋轉 2 頁、調整順序');
  });

  it('does not count a plain deletion as a reorder', () => {
    const state = reduce(load, { type: 'remove', pageNumbers: [2] });
    expect(summarizeEdits(state).moved).toBe(false);
  });
});

describe('selection helpers', () => {
  const visible = [5, 3, 1, 4, 2];

  it('selects the range between two pages in display order', () => {
    expect(pagesBetween(visible, 3, 4)).toEqual([3, 1, 4]);
    expect(pagesBetween(visible, 4, 3)).toEqual([3, 1, 4]);
    expect(pagesBetween(visible, 9, 4)).toEqual([4]);
    expect(pagesBetween(visible, 4, 9)).toEqual([]);
  });

  it('picks odd and even positions rather than page numbers', () => {
    expect(pagesByParity(visible, 'odd')).toEqual([5, 1, 2]);
    expect(pagesByParity(visible, 'even')).toEqual([3, 4]);
  });

  it('inverts the selection', () => {
    expect(invertSelection(visible, new Set([5, 1]))).toEqual([3, 4, 2]);
  });
});
