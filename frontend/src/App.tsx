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
import DeletePanel from './components/panels/DeletePanel';
import WatermarkPanel from './components/panels/WatermarkPanel';
import { getSaveExtension, useFileSave } from './hooks/useFileSave';
import { usePdfWorkspace } from './hooks/usePdfWorkspace';
import { useStatus } from './hooks/useStatus';
import type { WorkspaceFile } from './state/workspace';
import type { ConvertDpi, ConvertFormat } from './types';
import {
  canUseNativeSaveFilePicker,
  normalizeDownloadFilename,
} from './utils/fileSave';

function App() {
  const status = useStatus();
  const workspace = usePdfWorkspace(status);
  const [activePanel, setActivePanel] = useState<ToolPanel | null>(null);
  const [previewPage, setPreviewPage] = useState<number | null>(null);
  const saver = useFileSave(status, (request) => {
    if (request.kind === 'images') {
      setActivePanel(null);
    }
  });

  const { loading, error, success } = status;
  const { currentFile, selectedPages } = workspace;

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
    setActivePanel(null);
    void workspace.upload(files);
  };

  const handleOpen = (key: string) => {
    setActivePanel(null);
    void workspace.openFile(key);
  };

  const handleRemove = (file: WorkspaceFile) => {
    if (!window.confirm(`確定要刪除「${file.name}」嗎？`)) {
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

  const panelVisible = (panel: ToolPanel) => ({
    // 面板收起時保留輸入的設定
    display: activePanel === panel ? 'block' : 'none',
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
          onNavigate={setPreviewPage}
          onClose={() => setPreviewPage(null)}
        />
      )}
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom align="center" sx={{ mb: 4, color: '#000000' }}>
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
              setActivePanel(null);
              void workspace.mergeSelectedFiles();
            }}
          />
        )}

        {currentFile && (
          <>
            <ToolBar
              activePanel={activePanel}
              selectedCount={selectedPages.size}
              canUndo={currentFile.history.length > 0}
              loading={loading}
              onTogglePanel={(panel) => setActivePanel(activePanel === panel ? null : panel)}
              onUndo={() => void workspace.undo()}
              onSavePdf={handleSavePdf}
            />

            <Box sx={panelVisible('delete')}>
              <DeletePanel
                selectedCount={selectedPages.size}
                loading={loading}
                onDelete={() => void closePanelOnSuccess(workspace.deleteSelectedPages())}
              />
            </Box>
            <Box sx={panelVisible('compress')}>
              <CompressPanel
                loading={loading}
                onCompress={(options) => void closePanelOnSuccess(workspace.compress(options))}
              />
            </Box>
            <Box sx={panelVisible('watermark')}>
              <WatermarkPanel
                selectedCount={selectedPages.size}
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
                selected={selectedPages}
                loading={loading}
                onToggle={workspace.togglePage}
                onOrderChange={workspace.setPageOrder}
                onApplyOrder={() => void workspace.applyPageOrder()}
                onResetOrder={workspace.resetPageOrder}
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
