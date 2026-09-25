import { describe, expect, it } from 'vitest';
import {
  MAX_HISTORY,
  getCurrentFile,
  getMergeFiles,
  initialWorkspace,
  workspaceReducer,
} from './workspace';
import type { WorkspaceAction, WorkspaceState } from './workspace';
import type { PDFFile } from '../types';

function pdf(id: string, pageCount = 3): PDFFile {
  return {
    id,
    name: `${id}.pdf`,
    size: 1000,
    pageCount,
    uploadedAt: '2026-01-01T00:00:00Z',
  };
}

function reduce(...actions: WorkspaceAction[]): WorkspaceState {
  return actions.reduce(workspaceReducer, initialWorkspace);
}

describe('workspaceReducer', () => {
  it('keeps the file key stable while versions change', () => {
    const state = reduce(
      { type: 'filesAdded', files: [pdf('a')] },
      { type: 'currentChanged', key: 'a' },
      { type: 'versionReplaced', key: 'a', version: { id: 'a2', pageCount: 2 } },
    );

    const file = getCurrentFile(state);
    expect(file).toMatchObject({ key: 'a', id: 'a2', pageCount: 2, size: 1000 });
    expect(file?.history).toEqual([{ id: 'a', size: 1000, pageCount: 3 }]);
  });

  it('restores the previous version on undo', () => {
    const state = reduce(
      { type: 'filesAdded', files: [pdf('a')] },
      { type: 'versionReplaced', key: 'a', version: { id: 'a2', pageCount: 2 } },
      { type: 'versionReplaced', key: 'a', version: { id: 'a3', size: 500 } },
      { type: 'versionRestored', key: 'a' },
    );

    expect(state.files[0]).toMatchObject({ id: 'a2', pageCount: 2, size: 1000 });
    expect(state.files[0].history).toEqual([{ id: 'a', size: 1000, pageCount: 3 }]);
  });

  it('ignores undo without history', () => {
    const before = reduce({ type: 'filesAdded', files: [pdf('a')] });
    const after = workspaceReducer(before, { type: 'versionRestored', key: 'a' });

    expect(after.files[0]).toEqual(before.files[0]);
  });

  it(`keeps at most ${MAX_HISTORY} undo steps`, () => {
    const actions: WorkspaceAction[] = [{ type: 'filesAdded', files: [pdf('v0')] }];
    for (let index = 1; index <= MAX_HISTORY + 5; index += 1) {
      actions.push({ type: 'versionReplaced', key: 'v0', version: { id: `v${index}` } });
    }

    const { history } = reduce(...actions).files[0];

    expect(history).toHaveLength(MAX_HISTORY);
    expect(history[0].id).toBe('v5');
    expect(history[history.length - 1].id).toBe(`v${MAX_HISTORY + 4}`);
  });

  it('merges in the order files were ticked', () => {
    const state = reduce(
      { type: 'filesAdded', files: [pdf('a'), pdf('b'), pdf('c')] },
      { type: 'mergeToggled', key: 'c' },
      { type: 'mergeToggled', key: 'a' },
      { type: 'mergeToggled', key: 'b' },
      { type: 'mergeToggled', key: 'a' },
      // 編輯後合併使用新版本的 ID
      { type: 'versionReplaced', key: 'c', version: { id: 'c2' } },
    );

    expect(getMergeFiles(state).map((file) => file.id)).toEqual(['c2', 'b']);
  });

  it('clears current file and merge selection when a file is removed', () => {
    const state = reduce(
      { type: 'filesAdded', files: [pdf('a'), pdf('b')] },
      { type: 'currentChanged', key: 'a' },
      { type: 'mergeToggled', key: 'a' },
      { type: 'mergeToggled', key: 'b' },
      { type: 'fileRemoved', key: 'a' },
    );

    expect(state.files.map((file) => file.key)).toEqual(['b']);
    expect(state.currentKey).toBeNull();
    expect(state.mergeSelection).toEqual(['b']);
  });

  it('keeps the current file when another file is removed', () => {
    const state = reduce(
      { type: 'filesAdded', files: [pdf('a'), pdf('b')] },
      { type: 'currentChanged', key: 'a' },
      { type: 'fileRemoved', key: 'b' },
    );

    expect(getCurrentFile(state)?.key).toBe('a');
  });
});
