/** Page ranges refer to positions in the current edited document. */
export function parseMergePages(value: string, count: number): number[] {
  if (!value.trim()) return Array.from({ length: count }, (_, i) => i + 1);
  const result: number[] = [];
  for (const part of value.split(/[,，]/)) {
    const match = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!match) throw new Error('請輸入頁碼，例如 1-3, 5');
    const start = Number(match[1]);
    const end = Number(match[2] ?? match[1]);
    if (start < 1 || end < start || end > count) throw new Error(`頁碼須介於 1–${count}，範圍由小到大`);
    for (let page = start; page <= end; page++) {
      if (!result.includes(page)) result.push(page);
    }
  }
  return result;
}
