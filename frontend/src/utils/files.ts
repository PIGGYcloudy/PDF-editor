/** 瀏覽器有時不回報檔案類型，所以也看副檔名。 */
export function isPdfFile(file: File): boolean {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
}

/** 依檔名排序，數字以數值比較（IMG_2 在 IMG_10 之前）。 */
export function sortByNameNatural(files: File[]): File[] {
  return [...files].sort((first, second) => (
    first.name.localeCompare(second.name, undefined, { numeric: true })
  ));
}
