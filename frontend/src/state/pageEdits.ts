/**
 * 尚未套用到伺服器的頁面編輯（刪除、排序、旋轉）。
 *
 * 編輯只改變這份暫存狀態，使用者按下「套用變更」才會一次送到後端，
 * 產生一個新版本。頁面一律以原始頁碼（目前版本中的頁碼）識別。
 */

export type Rotation = 0 | 90 | 180 | 270;

/** 暫存狀態中保留的頁面；未列出的原始頁面視為已刪除。 */
export interface StagedPage {
  pageNumber: number;
  /** 相對於目前版本頁面方向的順時針旋轉角度 */
  rotation: Rotation;
}

export interface PageEditsState {
  /** 目前版本的頁碼，依原始順序排列；用來判斷是否有未套用的變更 */
  baseline: number[];
  pages: StagedPage[];
  /** 每次編輯前的 pages，最後一筆是最近一次編輯前的狀態 */
  history: StagedPage[][];
}

/** 暫存編輯的復原步數上限。 */
export const MAX_EDIT_HISTORY = 50;

export type PageEditsAction =
  | { type: 'reset'; pageNumbers: number[] }
  | { type: 'rotate'; pageNumbers: number[]; delta: number }
  | { type: 'remove'; pageNumbers: number[] }
  | { type: 'reorder'; order: number[] }
  | { type: 'undo' }
  | { type: 'discard' };

export const initialPageEdits: PageEditsState = {
  baseline: [],
  pages: [],
  history: [],
};

function initialPages(pageNumbers: number[]): StagedPage[] {
  return pageNumbers.map((pageNumber) => ({ pageNumber, rotation: 0 }));
}

export function normalizeRotation(degrees: number): Rotation {
  return ((((degrees % 360) + 360) % 360) as Rotation);
}

function pushEdit(state: PageEditsState, pages: StagedPage[]): PageEditsState {
  return {
    ...state,
    pages,
    history: [...state.history, state.pages].slice(-MAX_EDIT_HISTORY),
  };
}

export function pageEditsReducer(
  state: PageEditsState,
  action: PageEditsAction,
): PageEditsState {
  switch (action.type) {
    case 'reset':
      return {
        baseline: action.pageNumbers,
        pages: initialPages(action.pageNumbers),
        history: [],
      };

    case 'discard':
      return {
        ...state,
        pages: initialPages(state.baseline),
        history: [],
      };

    case 'rotate': {
      const targets = new Set(action.pageNumbers);
      if (!state.pages.some((page) => targets.has(page.pageNumber))) {
        return state;
      }
      return pushEdit(
        state,
        state.pages.map((page) => (
          targets.has(page.pageNumber)
            ? { ...page, rotation: normalizeRotation(page.rotation + action.delta) }
            : page
        )),
      );
    }

    case 'remove': {
      const targets = new Set(action.pageNumbers);
      const remaining = state.pages.filter((page) => !targets.has(page.pageNumber));
      // 至少要保留一頁，且沒有實際移除任何頁面時不留下復原紀錄
      if (remaining.length === 0 || remaining.length === state.pages.length) {
        return state;
      }
      return pushEdit(state, remaining);
    }

    case 'reorder': {
      const byNumber = new Map(state.pages.map((page) => [page.pageNumber, page]));
      const reordered = action.order
        .map((pageNumber) => byNumber.get(pageNumber))
        .filter((page): page is StagedPage => page !== undefined);
      const unchanged = reordered.length === state.pages.length
        && reordered.every((page, index) => page === state.pages[index]);
      // 順序必須是目前頁面的排列，否則忽略
      if (reordered.length !== state.pages.length || unchanged) {
        return state;
      }
      return pushEdit(state, reordered);
    }

    case 'undo': {
      const previous = state.history[state.history.length - 1];
      if (!previous) {
        return state;
      }
      return {
        ...state,
        pages: previous,
        history: state.history.slice(0, -1),
      };
    }
  }
}

export interface EditSummary {
  deleted: number;
  rotated: number;
  moved: boolean;
}

export function summarizeEdits(state: PageEditsState): EditSummary {
  const kept = new Set(state.pages.map((page) => page.pageNumber));
  const expectedOrder = state.baseline.filter((pageNumber) => kept.has(pageNumber));
  return {
    deleted: state.baseline.length - state.pages.length,
    rotated: state.pages.filter((page) => page.rotation !== 0).length,
    moved: state.pages.some((page, index) => page.pageNumber !== expectedOrder[index]),
  };
}

export function hasPendingEdits(state: PageEditsState): boolean {
  const { deleted, rotated, moved } = summarizeEdits(state);
  return deleted > 0 || rotated > 0 || moved;
}

/** 把未套用的變更組成一句話，例如「刪除 2 頁、旋轉 1 頁」。 */
export function describeEdits(summary: EditSummary): string {
  const parts: string[] = [];
  if (summary.deleted > 0) parts.push(`刪除 ${summary.deleted} 頁`);
  if (summary.rotated > 0) parts.push(`旋轉 ${summary.rotated} 頁`);
  if (summary.moved) parts.push('調整順序');
  return parts.join('、');
}

/** 目前顯示順序中，anchor 與 target 之間（含兩端）的頁碼。 */
export function pagesBetween(
  order: number[],
  anchor: number,
  target: number,
): number[] {
  const from = order.indexOf(anchor);
  const to = order.indexOf(target);
  if (from === -1 || to === -1) {
    return order.includes(target) ? [target] : [];
  }
  const [start, end] = from <= to ? [from, to] : [to, from];
  return order.slice(start, end + 1);
}

/** 依目前顯示位置挑出奇數（第 1、3、5…頁）或偶數頁。 */
export function pagesByParity(order: number[], parity: 'odd' | 'even'): number[] {
  return order.filter((_, index) => (index % 2 === 0) === (parity === 'odd'));
}

export function invertSelection(order: number[], selected: Set<number>): number[] {
  return order.filter((pageNumber) => !selected.has(pageNumber));
}
