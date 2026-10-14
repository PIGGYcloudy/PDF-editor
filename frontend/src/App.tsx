import MergeWorkspace from './components/MergeWorkspace';
import { useState } from 'react';
import { Alert, Box, Button, Container, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, LinearProgress, Paper, Snackbar, Stack, Tab, Tabs, Typography } from '@mui/material';
import { CallMergeOutlined, EditOutlined, HelpOutline, PictureAsPdfOutlined } from '@mui/icons-material';
import HelpDialog from './components/HelpDialog';
import FileList from './components/FileList';
import PageGrid from './components/PageGrid';
import PagePreviewDialog from './components/PagePreviewDialog';
import SaveFileDialog from './components/SaveFileDialog';
import ToolBar from './components/ToolBar';
import type { ToolPanel } from './components/ToolBar';
import UploadZone from './components/UploadZone';
import CompressPanel from './components/panels/CompressPanel';
import PageSizePanel from './components/panels/PageSizePanel';
import ConvertPanel from './components/panels/ConvertPanel';
import SplitPanel from './components/panels/SplitPanel';
import WatermarkPanel from './components/panels/WatermarkPanel';
import { useEditorShortcuts } from './hooks/useEditorShortcuts';
import { getSaveExtension, useFileSave } from './hooks/useFileSave';
import { usePdfWorkspace } from './hooks/usePdfWorkspace';
import { useStatus } from './hooks/useStatus';
import type { WorkspaceFile } from './state/workspace';
import type { ConvertDpi, ConvertFormat, ImagePageSize } from './types';
import { describePageSizes } from './utils/pageSizes';
import {
  canUseNativeSaveFilePicker,
  normalizeDownloadFilename,
} from './utils/fileSave';

function App() {
  const [view, setView] = useState<'edit' | 'merge'>('edit');
  const status = useStatus();
  const workspace = usePdfWorkspace(status);
  const [activePanel, setActivePanel] = useState<ToolPanel | null>(null);
  const [previewPage, setPreviewPage] = useState<number | null>(null);
  const [imagePageSize, setImagePageSize] = useState<ImagePageSize>('a4');
  const [helpOpen, setHelpOpen] = useState(false);
  const [pendingRemoval, setPendingRemoval] = useState<WorkspaceFile | null>(null);
  const [reduceTransparency, setReduceTransparency] = useState(() => {
    try { return localStorage.getItem('pdf-editor.reduce-transparency') === 'true'; }
    catch { return false; }
  });
  const saver = useFileSave(status, (request) => {
    if (request.kind === 'images') {
      setActivePanel(null);
    }
  });

  const { loading, error, success } = status;
  const { currentFile, selectedPages, hasEdits } = workspace;

  useEditorShortcuts({
    enabled: view === 'edit' && currentFile !== null
      && !helpOpen
      && previewPage === null
      && pendingRemoval === null
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
    onRedo: () => {
      if (!loading && workspace.canRedo) void workspace.redo();
    },
  });

  /** 換到另一個情境時，上一個操作的訊息不再適用。 */
  const clearMessages = () => {
    status.setError(null);
    status.setSuccess(null);
  };

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
    if (view === 'edit') setActivePanel(null);
    void workspace.upload(files, imagePageSize, view === 'merge');
  };

  const handleOpen = (key: string) => {
    setActivePanel(null);
    clearMessages();
    void workspace.openFile(key);
  };

  const confirmRemove = () => {
    const file = pendingRemoval;
    setPendingRemoval(null);
    if (!file) return;
    if (currentFile?.key === file.key) {
      setActivePanel(null);
    }
    void workspace.removeFile(file.key);
  };

  /** 打開工具前先套用頁面變更，工具與預覽都以套用後的頁面為準。 */
  const handleTogglePanel = async (panel: ToolPanel) => {
    if (activePanel === panel) {
      setActivePanel(null);
      return;
    }
    if (hasEdits && !(await workspace.applyPageEdits())) return;
    setActivePanel(panel);
  };

  const handleConvert = async (format: ConvertFormat, dpi: ConvertDpi) => {
    if (!currentFile) return;
    const positions = workspace.selectedPositions();
    const pdfId = hasEdits ? await workspace.applyPageEdits() : currentFile.id;
    if (!pdfId) return;
    const baseName = suggestedPdfName(currentFile).slice(0, -'.pdf'.length);
    void saver.beginSave({
      kind: 'images',
      pdfId,
      suggestedName: normalizeDownloadFilename(
        `${baseName}_images_${format}`,
        '.zip',
        `pdf_images_${format}`,
      ),
      format,
      dpi,
      selectedPageNumbers: positions.length > 0 ? positions : undefined,
    });
  };

  const handleSavePdf = async () => {
    if (!currentFile) return;
    const pdfId = hasEdits ? await workspace.applyPageEdits() : currentFile.id;
    if (!pdfId) return;
    await saver.beginSave({
      kind: 'pdf',
      pdfId,
      suggestedName: suggestedPdfName(currentFile),
    });
  };

  const handleSaveBundle = async () => {
    const files = workspace.mergeFiles;
    if (!files.length) return;
    if (files.length > 100) {
      status.setError('每次最多打包 100 份 PDF，請減少選取的檔案。');
      return;
    }
    const prepared = await workspace.prepareBundle();
    if (!prepared) return;
    await saver.beginSave({ kind: 'bundle', suggestedName: 'pdf_files.zip',
      files: prepared.map((file) => ({ id: file.id, name: suggestedPdfName(file) })),
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
    // 面板收起時保留輸入的設定
    display: activePanel === panel ? 'block' : 'none',
  });

  return (
    <Box className="app-shell" data-reduce-transparency={reduceTransparency}>
      <a href="#workspace" className="skip-link">跳到工作區</a>
      <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)}
        reduceTransparency={reduceTransparency} onTransparencyChange={(value) => {
          setReduceTransparency(value);
          try { localStorage.setItem('pdf-editor.reduce-transparency', String(value)); }
          catch { /* 儲存不可用時仍套用到目前工作區。 */ }
        }} />
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
      <Dialog open={pendingRemoval !== null} onClose={() => setPendingRemoval(null)} maxWidth="xs" fullWidth>
        <DialogTitle>移除「{pendingRemoval?.name}」？</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {pendingRemoval && workspace.pendingFileKeys.includes(pendingRemoval.key)
              ? '檔案和尚未套用的頁面變更都會刪除，且無法復原。'
              : '檔案會從伺服器刪除，且無法復原。'}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingRemoval(null)} autoFocus>取消</Button>
          <Button color="error" variant="contained" onClick={confirmRemove}>移除</Button>
        </DialogActions>
      </Dialog>

      {/* 處理中的提示浮在畫面上方，不推動版面 */}
      {loading && (
        <Box
          role="status"
          className="glass-surface"
          sx={{ position: 'fixed', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 1400, width: 'min(320px, calc(100% - 32px))', px: 2, py: 1.25, borderRadius: 3 }}
        >
          <Typography variant="body2" sx={{ mb: 0.75 }}>處理中…</Typography>
          <LinearProgress />
        </Box>
      )}
      {/* 操作結果顯示在畫面底部：成功訊息自動消失，錯誤需要使用者關閉 */}
      <Snackbar
        open={error !== null && saver.pendingRequest === null}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        sx={{ maxWidth: { sm: 560 } }}
      >
        <Alert severity="error" variant="filled" onClose={() => status.setError(null)} sx={{ width: '100%' }}>
          {error}
        </Alert>
      </Snackbar>
      <Snackbar
        open={success !== null && error === null}
        autoHideDuration={5000}
        onClose={(_, reason) => reason !== 'clickaway' && status.setSuccess(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        sx={{ maxWidth: { sm: 560 } }}
      >
        <Alert severity="success" role="status" onClose={() => status.setSuccess(null)} sx={{ width: '100%', boxShadow: 6 }}>
          {success}
        </Alert>
      </Snackbar>

      <Container maxWidth="xl" sx={{ py: { xs: 2, md: 3 }, px: { xs: 2, sm: 3, lg: 5 } }}>
        <Paper component="header" className="glass-surface" sx={{ p: { xs: 1, sm: 1.5 }, pl: { xs: 1.5, sm: 2 }, mb: { xs: 2, md: 3 }, borderRadius: 5 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
            <Stack direction="row" alignItems="center" spacing={1.5} sx={{ minWidth: 0 }}>
              <Box sx={{ width: 36, height: 36, flexShrink: 0, display: 'grid', placeItems: 'center', bgcolor: 'primary.main', color: 'primary.contrastText', borderRadius: 2.5 }}><PictureAsPdfOutlined fontSize="small" /></Box>
              <Typography component="h1" variant="h6">PDF 編輯器</Typography>
            </Stack>
            <Stack direction="row" alignItems="center" gap={1}>
              <Button startIcon={<HelpOutline />} onClick={() => setHelpOpen(true)} color="inherit" aria-label="使用說明" sx={{ flexShrink: 0, minWidth: 44, px: { xs: 1.25, sm: 2.25 }, '& .MuiButton-startIcon': { mr: { xs: 0, sm: 1 }, ml: { xs: 0, sm: -0.5 } } }}>
                <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>使用說明</Box>
              </Button>
            </Stack>
          </Stack>
        </Paper>

        <Box component="main" id="workspace" tabIndex={-1} sx={{ outline: 'none' }}>

        {/* 編輯與合併是兩個主要模式，以置中的分段控制切換 */}
        {workspace.files.length > 0 && (
          <Tabs className="glass-surface" value={view} onChange={(_, value) => { setView(value); clearMessages(); }} aria-label="工作區" variant="fullWidth"
            sx={{ p: 0.5, mb: { xs: 2, md: 3 }, mx: 'auto', width: { xs: '100%', sm: 420 }, borderRadius: 999, '& .MuiTab-root': { minHeight: { xs: 44, sm: 48 }, fontSize: { sm: '1rem' } } }}>
            <Tab value="edit" label="編輯" icon={<EditOutlined fontSize="small" />} iconPosition="start" id="edit-tab" aria-controls="edit-panel" disabled={loading} />
            <Tab value="merge" label="合併" icon={<CallMergeOutlined fontSize="small" />} iconPosition="start" id="merge-tab" aria-controls="merge-panel" disabled={loading} />
          </Tabs>
        )}

        {!workspace.files.length && (
          <Typography component="h2" variant="h5" align="center" sx={{ mt: { xs: 2, md: 6 }, mb: { xs: 2, md: 3 } }}>
            開啟 PDF 或圖片
          </Typography>
        )}

        <UploadZone
          compact={workspace.files.length > 0}
          imagePageSize={imagePageSize}
          onImagePageSizeChange={setImagePageSize}
          disabled={loading}
          onFiles={handleUpload}
          onError={status.setError}
        />

        {!workspace.files.length && (
          <Box component="ul" aria-label="可以做的事" sx={{ listStyle: 'none', display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: { xs: 2, sm: 3 }, maxWidth: 900, mx: 'auto', mt: 4, mb: 4, px: { xs: 1, sm: 0 } }}>
            {[
              ['整理頁面', '調整順序、旋轉、刪除，或把幾頁抽出成新檔案。'],
              ['合併與拆分', '把多份文件接成一份，或依頁碼拆成數份。'],
              ['壓縮與轉換', '縮小檔案、加上浮水印，或把頁面轉成圖片。'],
            ].map(([title, description]) => (
              <Box component="li" key={title}>
                <Typography variant="subtitle2" sx={{ mb: 0.5 }}>{title}</Typography>
                <Typography variant="body2" color="text.secondary">{description}</Typography>
              </Box>
            ))}
          </Box>
        )}

        <Box role="tabpanel" id="merge-panel" aria-labelledby="merge-tab" hidden={view !== 'merge'}>
          <MergeWorkspace workspace={workspace} loading={loading}
            onEdit={(key) => { handleOpen(key); setView('edit'); }}
            onSave={(file) => void saver.beginSave({ kind: 'pdf', pdfId: file.id, suggestedName: suggestedPdfName(file) })}
            onBundle={() => void handleSaveBundle()} />
        </Box>
        <Box role="tabpanel" id="edit-panel" aria-labelledby="edit-tab" hidden={view !== 'edit'}>
        {workspace.files.length > 0 && (
          <FileList files={workspace.files} pendingFileKeys={workspace.pendingFileKeys}
            currentKey={currentFile?.key ?? null} loading={loading} onOpen={handleOpen} onRemove={setPendingRemoval} />
        )}

        {currentFile && (
          <>
            <ToolBar
              activePanel={activePanel}
              undoLabel={workspace.undoLabel}
              redoLabel={workspace.redoLabel}
              loading={loading}
              onTogglePanel={(panel) => void handleTogglePanel(panel)}
              onUndo={() => void workspace.undo()}
              onRedo={() => void workspace.redo()}
              onSavePdf={() => void handleSavePdf()}
            />

            <Box id="tool-panel-split" role="region" aria-label="拆分設定" sx={panelVisible('split')}>
              <SplitPanel
                pageCount={currentFile.pageCount}
                loading={loading}
                onSplit={(options) => void closePanelOnSuccess(workspace.split(options))}
              />
            </Box>
            <Box id="tool-panel-pageSize" role="region" aria-label="頁面尺寸設定" sx={panelVisible('pageSize')}>
              <PageSizePanel
                sizeSummary={describePageSizes(workspace.pages)}
                selectedCount={selectedPages.size}
                loading={loading}
                onNormalize={(options) => void closePanelOnSuccess(workspace.normalizeSize(options))}
              />
            </Box>
            <Box id="tool-panel-compress" role="region" aria-label="壓縮設定" sx={panelVisible('compress')}>
              <CompressPanel
                loading={loading}
                result={workspace.compression}
                // 面板保持開啟，讓使用者看到壓縮結果並可調整後再試
                onCompress={(options) => void workspace.compress(options)}
              />
            </Box>
            <Box id="tool-panel-watermark" role="region" aria-label="浮水印設定" sx={panelVisible('watermark')}>
              <WatermarkPanel
                selectedCount={selectedPages.size}
                previewPage={activePanel === 'watermark' ? watermarkPreviewPage : null}
                loading={loading}
                onAddText={(config) => void closePanelOnSuccess(workspace.addTextWatermark(config))}
                onAddImage={(image, config) => void closePanelOnSuccess(
                  workspace.addImageWatermark(image, config),
                )}
              />
            </Box>
            <Box id="tool-panel-convert" role="region" aria-label="圖片轉換設定" sx={panelVisible('convert')}>
              <ConvertPanel
                selectedCount={selectedPages.size}
                loading={loading}
                onConvert={(format, dpi) => void handleConvert(format, dpi)}
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
        </Box>
        </Box>
      </Container>
    </Box>
  );
}

export default App;
