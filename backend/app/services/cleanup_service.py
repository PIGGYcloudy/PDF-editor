"""
過期檔案清理服務
"""
import logging
import shutil
import time
from pathlib import Path
from typing import Iterable, Optional

logger = logging.getLogger(__name__)


class CleanupService:
    """刪除超過保留時間的上傳檔與處理結果。"""

    @staticmethod
    def remove_expired(
        directories: Iterable[Path],
        max_age_seconds: float,
        now: Optional[float] = None,
    ) -> int:
        """
        刪除修改時間早於保留期限的檔案與目錄

        仍在使用中的 PDF 每次被存取都會更新修改時間（見 resolve_pdf_path），
        因此只有閒置超過保留時間的檔案會被刪除。

        Args:
            directories: 要清理的目錄
            max_age_seconds: 保留秒數
            now: 目前時間 (epoch 秒)，預設為 time.time()

        Returns:
            刪除的項目數量
        """
        cutoff = (time.time() if now is None else now) - max_age_seconds
        removed = 0

        for directory in directories:
            if not directory.is_dir():
                continue

            for entry in directory.iterdir():
                # 保留 .gitkeep 等隱藏檔。
                if entry.name.startswith("."):
                    continue
                try:
                    if entry.stat().st_mtime >= cutoff:
                        continue
                    if entry.is_dir():
                        shutil.rmtree(entry)
                    else:
                        entry.unlink()
                    removed += 1
                except FileNotFoundError:
                    # 已被其他請求或 worker 刪除。
                    continue
                except OSError:
                    logger.warning("無法刪除過期檔案：%s", entry, exc_info=True)

        return removed
