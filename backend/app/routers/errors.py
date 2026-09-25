"""
路由共用的錯誤處理
"""
import logging
from contextlib import contextmanager
from typing import Iterator

from fastapi import HTTPException
from pypdf.errors import PyPdfError

logger = logging.getLogger(__name__)


@contextmanager
def processing_errors(action: str) -> Iterator[None]:
    """
    把處理過程中的例外轉為 HTTP 錯誤

    ValueError 是服務層寫給使用者看的驗證訊息，直接回傳；其他例外的訊息
    可能含有伺服器路徑或內部細節，只記錄在日誌，回應則使用一般訊息。

    Args:
        action: 顯示給使用者的動作名稱，例如「壓縮 PDF」
    """
    try:
        yield
    except HTTPException:
        raise
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except (OSError, PyPdfError) as error:
        logger.warning("%s失敗", action, exc_info=True)
        raise HTTPException(
            status_code=400,
            detail=f"{action}失敗：檔案無法讀取或格式不正確",
        ) from error
    except Exception as error:
        logger.exception("%s失敗", action)
        raise HTTPException(
            status_code=500,
            detail=f"{action}失敗，請稍後再試",
        ) from error
