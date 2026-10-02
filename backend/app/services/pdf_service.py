"""
PDF 基本處理服務
"""
from pathlib import Path
from typing import List, Sequence, Tuple

from pypdf import PdfReader, PdfWriter

from app.utils.pdf_utils import (
    validate_page_numbers,
    save_output_pdf,
)


# 單次拆分最多產生的檔案數，避免一次寫出大量檔案
MAX_SPLIT_FILES = 100
VALID_ROTATIONS = (0, 90, 180, 270)


def parse_page_ranges(spec: str, total_pages: int) -> List[List[int]]:
    """
    解析頁碼範圍字串，例如 "1-3, 5, 8-10"

    以逗號分隔的每一段會成為一組頁面（拆分時各自成為一個檔案）。

    Raises:
        ValueError: 格式錯誤或頁碼超出範圍
    """
    normalized = spec.replace("，", ",").replace("–", "-").replace("—", "-")
    groups: List[List[int]] = []
    for token in normalized.split(","):
        token = token.strip()
        if not token:
            continue
        start_text, separator, end_text = token.partition("-")
        try:
            start = int(start_text)
            end = int(end_text) if separator else start
        except ValueError:
            raise ValueError(f"無法解析的頁碼範圍：{token}") from None
        if start < 1 or end > total_pages or start > end:
            raise ValueError(
                f"無效的頁碼範圍：{token} (有效範圍：1-{total_pages})"
            )
        groups.append(list(range(start, end + 1)))

    if not groups:
        raise ValueError("請輸入要拆分的頁碼範圍，例如 1-3, 5, 8-10")
    return groups


def describe_pages(pages: Sequence[int]) -> str:
    """把連續頁碼組成簡短標籤，例如 [1, 2, 3] 為 "1-3"。"""
    if len(pages) == 1:
        return str(pages[0])
    if list(pages) == list(range(pages[0], pages[0] + len(pages))):
        return f"{pages[0]}-{pages[-1]}"
    return f"{pages[0]}等{len(pages)}頁"


class PDFService:
    """PDF 基本操作服務"""

    @staticmethod
    def delete_pages(pdf_path: Path, page_numbers: List[int]) -> Path:
        """
        刪除指定的頁面

        Args:
            pdf_path: PDF 檔案路徑
            page_numbers: 要刪除的頁面號碼列表 (1-based)

        Returns:
            新 PDF 檔案路徑
        """
        reader = PdfReader(str(pdf_path))
        writer = PdfWriter()
        total_pages = len(reader.pages)

        validate_page_numbers(page_numbers, total_pages)

        # 將不刪除的頁面加入新 PDF
        pages_to_keep = [i + 1 for i in range(total_pages) if i + 1 not in page_numbers]

        if not pages_to_keep:
            raise ValueError("不能刪除所有頁面")

        for page_num in pages_to_keep:
            writer.add_page(reader.pages[page_num - 1])

        return save_output_pdf(writer, "deleted")

    @staticmethod
    def reorder_pages(pdf_path: Path, page_order: List[int]) -> Path:
        """
        重新排序頁面

        Args:
            pdf_path: PDF 檔案路徑
            page_order: 新的頁面順序 (1-based 頁面號碼)

        Returns:
            新 PDF 檔案路徑
        """
        reader = PdfReader(str(pdf_path))
        writer = PdfWriter()
        total_pages = len(reader.pages)

        # 驗證頁面順序
        if len(page_order) != total_pages:
            raise ValueError(f"頁面順序長度 ({len(page_order)}) 與總頁面數 ({total_pages}) 不符")

        validate_page_numbers(page_order, total_pages)
        expected_pages = set(range(1, total_pages + 1))
        if set(page_order) != expected_pages:
            raise ValueError("頁面順序必須包含每一頁且不得重複")

        # 按照新順序添加頁面
        for page_num in page_order:
            writer.add_page(reader.pages[page_num - 1])

        return save_output_pdf(writer, "reordered")

    @staticmethod
    def apply_page_edits(
        pdf_path: Path,
        edits: Sequence[Tuple[int, int]],
        prefix: str = "edited",
    ) -> Path:
        """
        一次套用刪除、排序與旋轉

        輸出的頁面就是 edits 的內容與順序；沒有出現在 edits 的頁面視為刪除。

        Args:
            pdf_path: PDF 檔案路徑
            edits: (原始頁碼 1-based, 順時針旋轉角度) 的列表
            prefix: 輸出檔名前綴

        Returns:
            新 PDF 檔案路徑
        """
        reader = PdfReader(str(pdf_path))
        total_pages = len(reader.pages)

        validate_page_numbers([page_number for page_number, _ in edits], total_pages)
        for _, rotation in edits:
            if rotation not in VALID_ROTATIONS:
                raise ValueError("旋轉角度必須是 0、90、180 或 270")

        writer = PdfWriter()
        for page_number, rotation in edits:
            page = writer.add_page(reader.pages[page_number - 1])
            if rotation:
                page.rotate(rotation)

        return save_output_pdf(writer, prefix)

    @staticmethod
    def split_pdf(
        pdf_path: Path,
        groups: Sequence[Sequence[int]],
    ) -> List[Tuple[Path, str, int]]:
        """
        依頁面分組拆成多個 PDF

        Returns:
            (檔案路徑, 頁碼標籤, 頁數) 的列表，順序與 groups 相同
        """
        if len(groups) > MAX_SPLIT_FILES:
            raise ValueError(f"一次最多拆分成 {MAX_SPLIT_FILES} 個檔案")

        total_pages = len(PdfReader(str(pdf_path)).pages)
        for group in groups:
            validate_page_numbers(list(group), total_pages)

        results = []
        for group in groups:
            path = PDFService.apply_page_edits(
                pdf_path, [(page_number, 0) for page_number in group], "split"
            )
            results.append((path, describe_pages(group), len(group)))
        return results

    @staticmethod
    def get_page_info(pdf_path: Path) -> List[dict]:
        """
        獲取所有頁面的資訊

        Args:
            pdf_path: PDF 檔案路徑

        Returns:
            頁面資訊列表
        """
        reader = PdfReader(str(pdf_path))
        pages_info = []

        for idx, page in enumerate(reader.pages):
            width = int(page.mediabox.width)
            height = int(page.mediabox.height)

            pages_info.append({
                "pageNumber": idx + 1,
                "width": width,
                "height": height,
            })

        return pages_info

    @staticmethod
    def merge_pdfs(pdf_paths: List[Path]) -> Path:
        """
        合併多個 PDF 檔案

        Args:
            pdf_paths: PDF 檔案路徑列表

        Returns:
            合併後的 PDF 檔案路徑
        """
        if len(pdf_paths) < 2:
            raise ValueError("至少需要兩個 PDF 檔案才能合併")

        writer = PdfWriter()

        for pdf_path in pdf_paths:
            reader = PdfReader(str(pdf_path))
            for page in reader.pages:
                writer.add_page(page)

        return save_output_pdf(writer, "merged")
