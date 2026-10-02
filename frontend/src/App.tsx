import { useState } from 'react';
import { Alert, Box, Container, Typography } from '@mui/material';
import FileList from './components/FileList';
import PageGrid from './components/PageGrid';
import PagePreviewDialog from './components/PagePreviewDialog';
import SaveFileDialog from './components/SaveFileDialog';
import ToolBar from './components/ToolBar';
import type { ToolPanel } from './components/ToolBar';
import UploadZone from './components/UploadZone';
import CompressPanel from './components/panels/CompressPanel';
import ConvertPanel from './components/panels/ConvertPanel';
import SplitPanel from './components/panels/SplitPanel';
import WatermarkPanel from './components/panels/WatermarkPanel';
import { useEditorShortcuts } from './hooks/useEditorShortcuts';
import { getSaveExtension, useFileSave } from './hooks/useFileSave';
import { usePdfWorkspace } from './hooks/usePdfWorkspace';
import { useStatus } from './hooks/useStatus';
import type { WorkspaceFile } from './state/workspace';
import type { ConvertDpi, ConvertFormat, ImagePageSize } from './types';
import {
  canUseNativeSaveFilePicker,
  normalizeDownloadFilename,
} from './utils/fileSave';

function App() {
  const status = useStatus();
  const workspace = usePdfWorkspace(status);
  const [activePanel, setActivePanel] = useState<ToolPanel | null>(null);
  const [previewPage, setPreviewPage] = useState<number | null>(null);
  const [imagePageSize, setImagePageSize] = useState<ImagePageSize>('a4');
  const saver = useFileSave(status, (request) => {
    if (request.kind === 'images') {
      setActivePanel(null);
    }
  });

  const { loading, error, success } = status;
  const { currentFile, selectedPages, hasEdits } = workspace;

  useEditorShortcuts({
    enabled: currentFile !== null
      && previewPage === null
      && saver.pendingRequest === null,
    onDelete: () => {
      if (!loading) workspace.removeSelectedPages();
    },
    onSelectAll: () => {
      if (!loading) workspace.selectAllPages();
    },
    onClearSelection: workspace.clearSelection,
    onUndo: () => {
      if (!loading && workspace.canUndo) void workspace.undo();
    },
  });

  /** 切換到其他文件前，確認使用者願意放棄尚未套用的頁面變更。 */
  const confirmDiscardEdits = () => (
    !hasEdits
    || window.confirm('目前文件有尚未套用的頁面變更，離開後會遺失。確定要繼續嗎？')
  );

  /** 操作成功後收起功能面板 */
  const closePanelOnSuccess = async (operation: Promise<boolean>) => {
    if (await operation) {
      setActivePanel(null);
    }
  };

  const suggestedPdfName = (file: WorkspaceFile) => (
    normalizeDownloadFilename(file.name, '.pdf', 'document')
  );

  const handleUpload = (files: File[]) => {
    if (!confirmDiscardEdits()) return;
    setActivePanel(null);
    void workspace.upload(files, imagePageSize);
  };

  const handleOpen = (key: string) => {
    if (!confirmDiscardEdits()) return;
    setActivePanel(null);
    void workspace.openFile(key);
  };

  const handleRemove = (file: WorkspaceFile) => {
    const message = currentFile?.key === file.key && hasEdits
      ? `確定要刪除「${file.name}」嗎？尚未套用的頁面變更也會一併遺失。`
      : `確定要刪除「${file.name}」嗎？`;
    if (!window.confirm(message)) {
      return;
    }
    if (currentFile?.key === file.key) {
      setActivePanel(null);
    }
    void workspace.removeFile(file.key);
  };

  const handleConvert = (format: ConvertFormat, dpi: ConvertDpi) => {
    if (!currentFile) return;
    const baseName = suggestedPdfName(currentFile).slice(0, -'.pdf'.length);
    void saver.beginSave({
      kind: 'images',
      pdfId: currentFile.id,
      suggestedName: normalizeDownloadFilename(
        `${baseName}_images_${format}`,
        '.zip',
        `pdf_images_${format}`,
      ),
      format,
      dpi,
      selectedPageNumbers: selectedPages.size > 0
        ? Array.from(selectedPages).sort((first, second) => first - second)
        : undefined,
    });
  };

  const handleSavePdf = () => {
    if (!currentFile) return;
    void saver.beginSave({
      kind: 'pdf',
      pdfId: currentFile.id,
      suggestedName: suggestedPdfName(currentFile),
    });
  };

  /** 浮水印預覽用第一個選取的頁面，沒有選取時用第一頁。 */
  const watermarkPreviewPage = (() => {
    const order = workspace.pageOrder;
    const pageNumber = order.find((number) => selectedPages.has(number)) ?? order[0];
    const page = workspace.pages.find((item) => item.pageNumber === pageNumber);
    if (!page?.thumbnailUrl) {
      return null;
    }
    return {
      position: order.indexOf(pageNumber) + 1,
      // 預覽需要比清單縮圖更清楚的圖片；縮圖網址以 size 參數結尾
      url: page.thumbnailUrl.replace(/size=\w+$/, 'size=large'),
      width: page.width,
      height: page.height,
    };
  })();

  const panelVisible = (panel: ToolPanel) => ({
    // 面板收起時保留輸入的設定；有未套用的頁面變更時，需要伺服器版本的面板一律收起
    display: activePanel === panel && !hasEdits ? 'block' : 'none',
  });

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f5f5f5' }}>
      <SaveFileDialog
        open={saver.pendingRequest !== null}
        suggestedName={saver.pendingRequest?.suggestedName ?? ''}
        extension={saver.pendingRequest ? getSaveExtension(saver.pendingRequest) : '.pdf'}
        nativeSaveAvailable={canUseNativeSaveFilePicker()}
        error={error}
        loading={loading}
        onCancel={saver.cancelSave}
        onSave={(filename) => void saver.completeSave(filename)}
      />
      {currentFile && (
        <PagePreviewDialog
          pdfId={currentFile.id}
          pageNumbers={workspace.pageOrder}
          pageNumber={previewPage}
          rotations={workspace.rotations}
          onNavigate={setPreviewPage}
          onClose={() => setPreviewPage(null)}
        />
      )}
      <Container maxWidth="xl" sx={{ py: 3 }}>
        <Typography
          variant={currentFile ? 'h5' : 'h4'}
          component="h1"
          align="center"
          sx={{ mb: currentFile ? 2 : 4, color: '#000000' }}
        >
          PDF 編輯器
        </Typography>

        {/* 錯誤和成功訊息 */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => status.setError(null)}>
            {error}
          </Alert>
        )}
        {success && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => status.setSuccess(null)}>
            {success}
          </Alert>
        )}

        <UploadZone
          compact={workspace.files.length > 0}
          imagePageSize={imagePageSize}
          onImagePageSizeChange={setImagePageSize}
          disabled={loading}
          onFiles={handleUpload}
          onError={status.setError}
        />

        {workspace.files.length > 0 && (
          <FileList
            files={workspace.files}
            currentKey={currentFile?.key ?? null}
            mergeSelection={workspace.mergeSelection}
            loading={loading}
            onOpen={handleOpen}
            onRemove={handleRemove}
            onToggleMerge={workspace.toggleMerge}
            onMerge={() => {
              if (!confirmDiscardEdits()) return;
              setActivePanel(null);
              void workspace.mergeSelectedFiles();
            }}
          />
        )}

        {currentFile && (
          <>
            <ToolBar
              activePanel={activePanel}
              canUndo={workspace.canUndo}
              hasPendingEdits={hasEdits}
              loading={loading}
              onTogglePanel={(panel) => setActivePanel(activePanel === panel ? null : panel)}
              onUndo={() => void workspace.undo()}
              onSavePdf={handleSavePdf}
            />

            <Box sx={panelVisible('split')}>
              <SplitPanel
                pageCount={currentFile.pageCount}
                loading={loading}
                onSplit={(options) => void closePanelOnSuccess(workspace.split(options))}
              />
            </Box>
            <Box sx={panelVisible('compress')}>
              <CompressPanel
                loading={loading}
                result={workspace.compression}
                // 面板保持開啟，讓使用者看到壓縮結果並可調整後再試
                onCompress={(options) => void workspace.compress(options)}
              />
            </Box>
            <Box sx={panelVisible('watermark')}>
              <WatermarkPanel
                selectedCount={selectedPages.size}
                previewPage={watermarkPreviewPage}
                loading={loading}
                onAddText={(config) => void closePanelOnSuccess(workspace.addTextWatermark(config))}
                onAddImage={(image, config) => void closePanelOnSuccess(
                  workspace.addImageWatermark(image, config),
                )}
              />
            </Box>
            <Box sx={panelVisible('convert')}>
              <ConvertPanel
                selectedCount={selectedPages.size}
                loading={loading}
                onConvert={handleConvert}
              />
            </Box>

            {workspace.pages.length > 0 && (
              <PageGrid
                pages={workspace.pages}
                order={workspace.pageOrder}
                rotations={workspace.rotations}
                selected={selectedPages}
                loading={loading}
                pendingSummary={hasEdits ? workspace.editSummary : null}
                onToggle={workspace.togglePage}
                onSelectAll={workspace.selectAllPages}
                onClearSelection={workspace.clearSelection}
                onInvertSelection={workspace.invertPageSelection}
                onSelectParity={workspace.selectPagesByParity}
                onRotate={workspace.rotatePages}
                onDelete={workspace.removePages}
                onExtract={() => void workspace.extractSelectedPages()}
                onOrderChange={workspace.setPageOrder}
                onApply={() => void workspace.applyPageEdits()}
                onDiscard={workspace.discardPageEdits}
                onPreview={setPreviewPage}
              />
            )}
          </>
        )}
      </Container>
    </Box>
  );
}

export default App;
