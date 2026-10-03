import type { Page } from '../types';
import type { PageEditsState, StagedPage } from './pageEdits';
import type { PdfVersion, WorkspaceState } from './workspace';

const STORAGE_KEY = 'pdf-editor.workspace.v1';
export interface DocumentDraft {
  pages: Page[];
  edits: PageEditsState;
}

export interface WorkspaceSnapshot {
  version: 1;
  drafts?: Record<string, DocumentDraft>;
  workspace: WorkspaceState;
  pages: Page[];
  edits: PageEditsState;
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}
function isVersion(value: unknown): value is PdfVersion {
  return record(value) && typeof value.id === 'string'
    && typeof value.size === 'number' && Number.isFinite(value.size)
    && Number.isInteger(value.pageCount) && Number(value.pageCount) > 0;
}

/** Browser storage can be unavailable or contain an older/corrupt snapshot. */
export function parseSnapshot(raw: string | null): WorkspaceSnapshot | null {
  try {
    const value: unknown = JSON.parse(raw ?? 'null');
    if (!record(value) || value.version !== 1 || !record(value.workspace)
      || !record(value.edits) || !Array.isArray(value.pages)) return null;
    const { workspace, edits, pages } = value;
    if (!Array.isArray(workspace.files) || !workspace.files.every((file: unknown) => (
      isVersion(file) && record(file) && typeof file.key === 'string'
      && typeof file.name === 'string' && Array.isArray(file.history)
      && file.history.every(isVersion)
    ))) return null;
    const keys = workspace.files.map((file: { key: string }) => file.key);
    if (new Set(keys).size !== keys.length
      || (workspace.currentKey !== null && (typeof workspace.currentKey !== 'string' || !keys.includes(workspace.currentKey)))
      || !Array.isArray(workspace.mergeSelection)
      || !workspace.mergeSelection.every((key: unknown) => typeof key === 'string' && keys.includes(key))) return null;
    if (!pages.every((page: unknown) => record(page)
      && Number.isInteger(page.pageNumber) && Number(page.pageNumber) > 0
      && typeof page.width === 'number' && typeof page.height === 'number')) return null;
    const numbers = pages.map((page: Page) => page.pageNumber);
    if (!Array.isArray(edits.baseline)
      || JSON.stringify(edits.baseline) !== JSON.stringify(numbers)) return null;
    const validStage = (stage: unknown): stage is StagedPage[] => Array.isArray(stage)
      && (numbers.length === 0 ? stage.length === 0 : stage.length > 0)
      && stage.every((page: unknown) => record(page)
        && numbers.includes(Number(page.pageNumber)) && typeof page.pageNumber === 'number'
        && [0, 90, 180, 270].includes(Number(page.rotation)) && typeof page.rotation === 'number')
      && new Set(stage.map((page: StagedPage) => page.pageNumber)).size === stage.length;
    if (!validStage(edits.pages) || !Array.isArray(edits.history)
      || !edits.history.every(validStage)) return null;
    const snapshot = value as unknown as WorkspaceSnapshot;
    const current = snapshot.workspace.files.find((file) => file.key === workspace.currentKey);
    // Never trust persisted URLs; derive them from the restored current PDF.
    snapshot.pages = snapshot.pages.map((page) => ({ ...page,
      thumbnailUrl: current
        ? `/api/pdf/thumbnail/${encodeURIComponent(current.id)}/page/${page.pageNumber}?size=medium`
        : undefined,
    }));
    if (value.drafts !== undefined) {
      if (!record(value.drafts)) return null;
      const drafts: Record<string, DocumentDraft> = {};
      for (const [id, draft] of Object.entries(value.drafts)) {
        const file = snapshot.workspace.files.find((item) => item.id === id);
        if (!file || !record(draft)) return null;
        const validated = parseSnapshot(JSON.stringify({ version: 1,
          workspace: { ...workspace, currentKey: file.key },
          pages: draft.pages, edits: draft.edits,
        }));
        if (!validated) return null;
        drafts[id] = { pages: validated.pages, edits: validated.edits };
      }
      snapshot.drafts = drafts;
    }
    return snapshot;
  } catch {
    return null;
  }
}

/** Each tab keeps its own workspace so parallel sessions cannot overwrite each other. */
export function readSnapshot(): WorkspaceSnapshot | null {
  try {
    return parseSnapshot(sessionStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

export function writeSnapshot(snapshot: WorkspaceSnapshot): boolean {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    return true;
  } catch {
    return false;
  }
}
