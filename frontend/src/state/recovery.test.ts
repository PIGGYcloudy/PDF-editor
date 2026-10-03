import { describe, expect, it } from 'vitest';
import { parseSnapshot } from './recovery';
import type { WorkspaceSnapshot } from './recovery';
import { pageEditsReducer } from './pageEdits';

function snapshot(): WorkspaceSnapshot {
  return {
    version: 1,
    workspace: {
      files: [{ key: 'a', id: 'version2', name: 'report.pdf', size: 1234, pageCount: 3,
        history: [{ id: 'original', size: 1500, pageCount: 3 }] }],
      currentKey: 'a', mergeSelection: ['a'],
    },
    pages: [1, 2, 3].map((pageNumber) => ({ pageNumber, width: 595, height: 842 })),
    edits: {
      baseline: [1, 2, 3],
      pages: [{ pageNumber: 3, rotation: 90 }, { pageNumber: 1, rotation: 0 }],
      history: [[1, 2, 3].map((pageNumber) => ({ pageNumber, rotation: 0 }))],
    },
  };
}

describe('workspace recovery', () => {
  it('restores the current version, pending order/rotation/deletion and undo history', () => {
    const restored = parseSnapshot(JSON.stringify(snapshot()))!;
    expect(restored.workspace).toEqual(snapshot().workspace);
    expect(restored.edits).toEqual(snapshot().edits);
    expect(pageEditsReducer(restored.edits, { type: 'undo' }).pages.map((p) => p.pageNumber))
      .toEqual([1, 2, 3]);
    expect(restored.pages[0].thumbnailUrl).toBe('/api/pdf/thumbnail/version2/page/1?size=medium');
  });

  it.each([null, '', '{}', '{broken', '{"version":2}'])('ignores invalid storage: %s', (raw) => {
    expect(parseSnapshot(raw)).toBeNull();
  });

  it('rejects edits referring to a missing page or duplicate pages', () => {
    const value = snapshot();
    value.edits.pages[0].pageNumber = 99;
    expect(parseSnapshot(JSON.stringify(value))).toBeNull();
    value.edits.pages[0].pageNumber = 1;
    expect(parseSnapshot(JSON.stringify(value))).toBeNull();
  });

  it('rejects a missing current file and ignores persisted image URLs', () => {
    const value = snapshot();
    value.workspace.currentKey = 'missing';
    expect(parseSnapshot(JSON.stringify(value))).toBeNull();
    value.workspace.currentKey = 'a';
    value.pages[0].thumbnailUrl = 'https://untrusted.invalid/image';
    expect(parseSnapshot(JSON.stringify(value))?.pages[0].thumbnailUrl)
      .toBe('/api/pdf/thumbnail/version2/page/1?size=medium');
  });
});

describe('multiple document recovery', () => {
  it('validates background drafts and reconstructs their own image URLs', () => {
    const value = snapshot();
    value.workspace.files.push({ key: 'b', id: 'other', name: 'other.pdf',
      size: 100, pageCount: 3, history: [] });
    value.drafts = {
      version2: { pages: value.pages, edits: value.edits },
      other: { pages: value.pages, edits: value.edits },
    };
    const restored = parseSnapshot(JSON.stringify(value))!;
    expect(restored.drafts?.other.pages[0].thumbnailUrl)
      .toBe('/api/pdf/thumbnail/other/page/1?size=medium');
    expect(restored.drafts?.other.edits.history).toEqual(value.edits.history);
    value.drafts.other.edits = { ...value.edits, pages: [{ pageNumber: 99, rotation: 0 }] };
    expect(parseSnapshot(JSON.stringify(value))).toBeNull();
  });
});
