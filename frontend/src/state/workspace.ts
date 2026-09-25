import type { PDFFile } from '../types';

/** 伺服器上的一個 PDF 版本；每次編輯都會產生新的 ID。 */
export interface PdfVersion {
  id: string;
  size: number;
  pageCount: number;
}

/**
 * 工作區中的文件。
 *
 * `key` 在整個編輯過程中固定不變，`id` 則指向目前的版本；`history` 保存
 * 先前的版本（最舊的在前），用於復原。
 */
export interface WorkspaceFile extends PdfVersion {
  key: string;
  name: string;
  history: PdfVersion[];
}

export interface WorkspaceState {
  files: WorkspaceFile[];
  currentKey: string | null;
  /** 勾選合併的文件，依勾選順序排列，也就是合併後的頁面順序。 */
  mergeSelection: string[];
}

/** 每份文件保留的復原步數。 */
export const MAX_HISTORY = 20;

export type WorkspaceAction =
  | { type: 'filesAdded'; files: PDFFile[] }
  | { type: 'currentChanged'; key: string | null }
  | {
      type: 'versionReplaced';
      key: string;
      version: Pick<PdfVersion, 'id'> & Partial<PdfVersion>;
    }
  | { type: 'versionRestored'; key: string }
  | { type: 'fileRemoved'; key: string }
  | { type: 'mergeToggled'; key: string }
  | { type: 'mergeCleared' };

export const initialWorkspace: WorkspaceState = {
  files: [],
  currentKey: null,
  mergeSelection: [],
};

function updateFile(
  state: WorkspaceState,
  key: string,
  update: (file: WorkspaceFile) => WorkspaceFile,
): WorkspaceState {
  return {
    ...state,
    files: state.files.map((file) => (file.key === key ? update(file) : file)),
  };
}

export function workspaceReducer(
  state: WorkspaceState,
  action: WorkspaceAction,
): WorkspaceState {
  switch (action.type) {
    case 'filesAdded':
      return {
        ...state,
        files: [
          ...state.files,
          ...action.files.map((file) => ({
            key: file.id,
            id: file.id,
            name: file.name,
            size: file.size,
            pageCount: file.pageCount,
            history: [],
          })),
        ],
      };

    case 'currentChanged':
      return { ...state, currentKey: action.key };

    case 'versionReplaced':
      return updateFile(state, action.key, (file) => ({
        ...file,
        ...action.version,
        history: [
          ...file.history,
          { id: file.id, size: file.size, pageCount: file.pageCount },
        ].slice(-MAX_HISTORY),
      }));

    case 'versionRestored':
      return updateFile(state, action.key, (file) => {
        const previous = file.history[file.history.length - 1];
        if (!previous) {
          return file;
        }
        return {
          ...file,
          ...previous,
          history: file.history.slice(0, -1),
        };
      });

    case 'fileRemoved':
      return {
        files: state.files.filter((file) => file.key !== action.key),
        currentKey: state.currentKey === action.key ? null : state.currentKey,
        mergeSelection: state.mergeSelection.filter((key) => key !== action.key),
      };

    case 'mergeToggled':
      return {
        ...state,
        mergeSelection: state.mergeSelection.includes(action.key)
          ? state.mergeSelection.filter((key) => key !== action.key)
          : [...state.mergeSelection, action.key],
      };

    case 'mergeCleared':
      return { ...state, mergeSelection: [] };
  }
}

export function getCurrentFile(state: WorkspaceState): WorkspaceFile | null {
  return state.files.find((file) => file.key === state.currentKey) ?? null;
}

/** 依合併順序回傳勾選的文件。 */
export function getMergeFiles(state: WorkspaceState): WorkspaceFile[] {
  return state.mergeSelection
    .map((key) => state.files.find((file) => file.key === key))
    .filter((file): file is WorkspaceFile => file !== undefined);
}
