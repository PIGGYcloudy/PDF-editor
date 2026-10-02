import { useEffect, useRef } from 'react';

interface EditorShortcuts {
  enabled: boolean;
  onDelete: () => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onUndo: () => void;
}

/** 在輸入文字、對話框或選單中時，不攔截鍵盤快速鍵。 */
function shouldIgnore(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false;
  }
  return target.matches(
    'textarea, select, [contenteditable="true"], '
    + 'input:not([type="checkbox"]):not([type="radio"]):not([type="button"])',
  ) || target.closest('[role="dialog"], [role="menu"], [role="listbox"]') !== null;
}

/**
 * 頁面編輯的鍵盤快速鍵：Delete 刪除選取的頁面、Ctrl/⌘+A 全選、
 * Ctrl/⌘+Z 復原、Esc 取消選取。
 */
export function useEditorShortcuts(shortcuts: EditorShortcuts) {
  const latest = useRef(shortcuts);
  useEffect(() => {
    latest.current = shortcuts;
  });

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const current = latest.current;
      if (!current.enabled || event.defaultPrevented || shouldIgnore(event.target)) {
        return;
      }

      const modifier = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      let handler: (() => void) | null = null;

      if (modifier && !event.shiftKey && key === 'z') {
        handler = current.onUndo;
      } else if (modifier && key === 'a') {
        handler = current.onSelectAll;
      } else if (!modifier && (key === 'delete' || key === 'backspace')) {
        handler = current.onDelete;
      } else if (!modifier && key === 'escape') {
        handler = current.onClearSelection;
      }

      if (handler) {
        event.preventDefault();
        handler();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}
