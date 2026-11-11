"""
PDF Editor 桌面版啟動程式

在本機 127.0.0.1 的隨機 port 啟動 FastAPI 後端，由後端同時提供前端網頁，
再以 WebView2 視窗（pywebview）開啟；系統沒有 WebView2 時改用預設瀏覽器。
關閉視窗即結束後端。

開發時可直接執行（需先 `npm run build` 產生 frontend/dist）：

    python desktop/launcher.py [--browser]
"""
import argparse
import os
import socket
import sys
import threading
import time
import webbrowser
from pathlib import Path

APP_NAME = "PDF Editor"
FROZEN = getattr(sys, "frozen", False)

# PyInstaller 打包後，資源位於 sys._MEIPASS（onedir 為 exe 旁的 _internal）
RESOURCE_DIR = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent.parent))
APP_DIR = Path(sys.executable).parent if FROZEN else Path(__file__).resolve().parent


def get_data_dir() -> Path:
    """portable 版（exe 旁有 portable.txt）把資料放在 exe 旁，安裝版放在 AppData"""
    if (APP_DIR / "portable.txt").exists():
        return APP_DIR / "data"
    local_app_data = os.getenv("LOCALAPPDATA")
    if local_app_data:
        return Path(local_app_data) / APP_NAME
    return Path.home() / ".pdf-editor"


def configure_environment(data_dir: Path) -> None:
    """在匯入後端前設定環境變數，app.config 會在匯入時讀取"""
    os.environ.setdefault("PDF_EDITOR_DATA_DIR", str(data_dir))

    if FROZEN:
        static_dir = RESOURCE_DIR / "frontend"
        poppler_dir = RESOURCE_DIR / "poppler" / "Library" / "bin"
    else:
        static_dir = RESOURCE_DIR / "frontend" / "dist"
        poppler_dir = None
        sys.path.insert(0, str(RESOURCE_DIR / "backend"))

    if not (static_dir / "index.html").exists():
        raise SystemExit(f"找不到前端網頁：{static_dir}，請先執行 npm run build")
    os.environ.setdefault("PDF_EDITOR_STATIC_DIR", str(static_dir))
    if poppler_dir is not None and poppler_dir.is_dir():
        os.environ.setdefault("POPPLER_PATH", str(poppler_dir))


def redirect_output(data_dir: Path) -> None:
    """無主控台的 exe 沒有 stdout/stderr，uvicorn 與 logging 寫入時會失敗"""
    if sys.stdout is not None and sys.stderr is not None:
        return
    log_dir = data_dir / "logs"
    log_dir.mkdir(parents=True, exist_ok=True)
    log_file = open(log_dir / "pdf-editor.log", "a", encoding="utf-8", buffering=1)
    sys.stdout = log_file
    sys.stderr = log_file


def find_free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def start_server(port: int):
    import uvicorn

    from app.main import app

    server = uvicorn.Server(
        uvicorn.Config(app, host="127.0.0.1", port=port, log_config=None)
    )
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()

    deadline = time.monotonic() + 30
    while not server.started:
        if not thread.is_alive() or time.monotonic() > deadline:
            raise SystemExit("後端啟動失敗，詳細原因請查看日誌")
        time.sleep(0.05)
    return server, thread


def self_test(url: str) -> None:
    """供 CI 檢查打包結果：前端、API 與 Poppler 渲染都能運作"""
    import urllib.request
    from io import BytesIO

    from reportlab.pdfgen import canvas

    from app.utils.pdf_utils import UPLOADS_DIR, render_page

    for path in ("", "health"):
        with urllib.request.urlopen(url + path, timeout=10) as response:
            if response.status != 200:
                raise SystemExit(f"自我測試失敗：/{path} 回應 {response.status}")

    buffer = BytesIO()
    pdf = canvas.Canvas(buffer)
    pdf.drawString(72, 720, "PDF Editor self test")
    pdf.save()
    test_pdf = UPLOADS_DIR / "self-test.pdf"
    test_pdf.write_bytes(buffer.getvalue())
    try:
        render_page(test_pdf, 1, dpi=72)
    finally:
        test_pdf.unlink(missing_ok=True)
    print("自我測試通過")


def open_window(url: str) -> bool:
    """以 WebView2 視窗開啟，關閉視窗後返回；無法建立視窗時回傳 False"""
    try:
        import webview
    except ImportError:
        return False

    # 允許 <a download> 的備援下載；支援時前端會優先使用系統的另存新檔對話框
    webview.settings["ALLOW_DOWNLOADS"] = True
    try:
        webview.create_window(
            APP_NAME, url, width=1280, height=860, min_size=(960, 640)
        )
        webview.start(private_mode=False, storage_path=str(get_data_dir() / "webview"))
    except Exception:
        return False
    return True


def wait_in_browser(url: str) -> None:
    webbrowser.open(url)
    if sys.platform == "win32":
        import ctypes

        # MB_OK | MB_ICONINFORMATION | MB_TOPMOST
        ctypes.windll.user32.MessageBoxW(
            None,
            f"PDF Editor 已在瀏覽器開啟：\n{url}\n\n按「確定」結束程式。",
            APP_NAME,
            0x00 | 0x40 | 0x40000,
        )
    else:
        print(f"PDF Editor 已啟動：{url}，按 Ctrl+C 結束")
        try:
            threading.Event().wait()
        except KeyboardInterrupt:
            pass


def main() -> None:
    parser = argparse.ArgumentParser(description=APP_NAME)
    parser.add_argument("--browser", action="store_true", help="改用預設瀏覽器開啟")
    parser.add_argument("--port", type=int, default=0, help="指定 port，預設隨機")
    parser.add_argument("--self-test", action="store_true", help="檢查後端與 Poppler 後結束")
    args = parser.parse_args()

    data_dir = get_data_dir()
    data_dir.mkdir(parents=True, exist_ok=True)
    redirect_output(data_dir)
    configure_environment(data_dir)

    port = args.port or find_free_port()
    server, thread = start_server(port)
    url = f"http://127.0.0.1:{port}/"

    try:
        if args.self_test:
            self_test(url)
        elif args.browser or not open_window(url):
            wait_in_browser(url)
    finally:
        server.should_exit = True
        thread.join(timeout=10)


if __name__ == "__main__":
    main()
