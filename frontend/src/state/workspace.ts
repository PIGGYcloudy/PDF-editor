import type { PDFFile } from '../types';

/** 伺服器上的一個 PDF 版本；每次編輯都會產生新的 ID。 */
export interface PdfVersion {
  id: string;
  size: number;
  pageCount: number;
  /** 存在 history／future 時：從這個版本切換到下一個版本的動作名稱 */
  label?: string;
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
  /** 復原後可重做的版本，最後一筆是下一個要重做的版本 */
  future?: PdfVersion[];
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
  /** selectForMerge：上傳的文件預設加入合併選取 */
  | { type: 'filesAdded'; files: PDFFile[]; selectForMerge?: boolean }
  | { type: 'currentChanged'; key: string | null }
  | {
      type: 'versionReplaced';
      key: string;
      version: Pick<PdfVersion, 'id'> & Partial<PdfVersion>;
      /** 產生新版本的動作，例如「壓縮」 */
      label: string;
    }
  | { type: 'versionRestored'; key: string }
  | { type: 'versionRedone'; key: string }
  | { type: 'fileRemoved'; key: string }
  | { type: 'filesRemoved'; keys: string[] }
  | { type: 'mergeToggled'; key: string }
  | { type: 'mergeReordered'; keys: string[] }
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
        mergeSelection: action.selectForMerge
          ? [...state.mergeSelection, ...action.files.map((file) => file.id)
            .filter((key) => !state.mergeSelection.includes(key))]
          : state.mergeSelection,
      };

    case 'currentChanged':
      return { ...state, currentKey: action.key };

    case 'versionReplaced':
      return updateFile(state, action.key, (file) => ({
        ...file,
        ...action.version,
        history: [
          ...file.history,
          { id: file.id, size: file.size, pageCount: file.pageCount, label: action.label },
        ].slice(-MAX_HISTORY),
        future: [],
      }));

    case 'versionRestored':
      return updateFile(state, action.key, (file) => {
        const previous = file.history[file.history.length - 1];
        if (!previous) {
          return file;
        }
        const { label, ...version } = previous;
        return {
          ...file,
          ...version,
          history: file.history.slice(0, -1),
          future: [
            ...(file.future ?? []),
            { id: file.id, size: file.size, pageCount: file.pageCount, label },
          ],
        };
      });

    case 'versionRedone':
      return updateFile(state, action.key, (file) => {
        const next = file.future?.[file.future.length - 1];
        if (!next) {
          return file;
        }
        const { label, ...version } = next;
        return {
          ...file,
          ...version,
          history: [
            ...file.history,
            { id: file.id, size: file.size, pageCount: file.pageCount, label },
          ].slice(-MAX_HISTORY),
          future: file.future!.slice(0, -1),
        };
      });

    case 'fileRemoved':
      return workspaceReducer(state, { type: 'filesRemoved', keys: [action.key] });

    case 'filesRemoved':
      return {
        files: state.files.filter((file) => !action.keys.includes(file.key)),
        currentKey: state.currentKey !== null && action.keys.includes(state.currentKey)
          ? null : state.currentKey,
        mergeSelection: state.mergeSelection.filter((key) => !action.keys.includes(key)),
      };

    case 'mergeToggled':
      return {
        ...state,
        mergeSelection: state.mergeSelection.includes(action.key)
          ? state.mergeSelection.filter((key) => key !== action.key)
          : [...state.mergeSelection, action.key],
      };

    case 'mergeReordered':
      return { ...state, mergeSelection: action.keys.filter((key, index) =>
        state.mergeSelection.includes(key) && action.keys.indexOf(key) === index) };

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
