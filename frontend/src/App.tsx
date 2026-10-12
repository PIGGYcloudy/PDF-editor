import MergeWorkspace from './components/MergeWorkspace';
import { useState } from 'react';
import { Alert, Box, Button, Chip, Container, LinearProgress, Paper, Stack, Tab, Tabs, Typography } from '@mui/material';
import { CheckCircleOutline, HelpOutline, PictureAsPdfOutlined } from '@mui/icons-material';
import HelpDialog from './components/HelpDialog';
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
  const [view, setView] = useState<'edit' | 'merge'>('edit');
  const status = useStatus();
  const workspace = usePdfWorkspace(status);
  const [activePanel, setActivePanel] = useState<ToolPanel | null>(null);
  const [previewPage, setPreviewPage] = useState<number | null>(null);
  const [imagePageSize, setImagePageSize] = useState<ImagePageSize>('a4');
  const [helpOpen, setHelpOpen] = useState(false);
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
    void workspace.openFile(key);
  };

  const handleRemove = (file: WorkspaceFile) => {
    const message = workspace.pendingFileKeys.includes(file.key)
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
    // 面板收起時保留輸入的設定；有未套用的頁面變更時，需要伺服器版本的面板一律收起
    display: activePanel === panel && !hasEdits ? 'block' : 'none',
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
      <Container maxWidth="xl" sx={{ py: { xs: 2, md: 3 }, px: { xs: 2, sm: 3, lg: 5 } }}>
        <Paper component="header" className="glass-surface" sx={{ p: { xs: 1.5, sm: 2 }, mb: 3, borderRadius: 5 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
            <Stack direction="row" alignItems="center" spacing={1.5} sx={{ minWidth: 0 }}>
              <Box sx={{ width: 44, height: 44, flexShrink: 0, display: 'grid', placeItems: 'center', bgcolor: 'primary.main', color: 'white', borderRadius: 3, boxShadow: 'inset 0 1px 0 rgba(255,255,255,.4), 0 4px 10px rgba(0,103,217,.15)' }}><PictureAsPdfOutlined /></Box>
              <Box><Typography component="h1" variant="h6">PDF 編輯器</Typography><Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>讓每一份文件，井然有序。</Typography></Box>
            </Stack>
            <Button startIcon={<HelpOutline />} onClick={() => setHelpOpen(true)} color="inherit" sx={{ flexShrink: 0 }}>使用說明</Button>
          </Stack>
        </Paper>

        <Box component="main" id="workspace" tabIndex={-1} sx={{ outline: 'none' }}>

        {loading && (
          <Box role="status" className="glass-surface" sx={{ position: 'sticky', top: 8, zIndex: 10, p: 2, mb: 2, borderRadius: 3 }}>
            <Typography variant="body2" sx={{ mb: 0.5 }}>正在處理文件，請稍候…</Typography>
            <LinearProgress />
          </Box>
        )}
        {/* 錯誤和成功訊息 */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => status.setError(null)}>
            {error}
          </Alert>
        )}
        {success && (
          <Alert severity="success" role="status" sx={{ mb: 2 }} onClose={() => status.setSuccess(null)}>
            {success}
          </Alert>
        )}

        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} gap={1.5} sx={{ mb: 3 }}>
        <Tabs className="glass-surface" value={view} onChange={(_, value) => setView(value)} aria-label="PDF 工作區" sx={{ p: 0.5, borderRadius: 999 }}>
          <Tab value="edit" label="編輯 PDF" id="edit-tab" aria-controls="edit-panel" disabled={loading} />
          <Tab value="merge" label="合併 PDF" id="merge-tab" aria-controls="merge-panel" disabled={loading} />
        </Tabs>
        <Typography variant="body2" color="text.secondary">{workspace.files.length ? `${workspace.files.length} 份文件 · ${view === 'edit' ? '整理頁面與編輯內容' : '選擇文件並安排合併順序'}` : '你的文件工作區'}</Typography>
        </Stack>

        {!workspace.files.length && <Box sx={{ textAlign: 'center', mt: { xs: 3, md: 5 }, mb: 3 }}>
          <Typography component="h2" variant="h4" sx={{ fontSize: { xs: 28, md: 38 }, mb: 1.5 }}>把文件交給這裡，<br />把心力留給重要的事。</Typography>
          <Typography color="text.secondary">整理、合併、壓縮與轉換。從加入第一份文件開始。</Typography>
        </Box>}

        <UploadZone
          compact={workspace.files.length > 0}
          imagePageSize={imagePageSize}
          onImagePageSizeChange={setImagePageSize}
          disabled={loading}
          onFiles={handleUpload}
          onError={status.setError}
        />

        {!workspace.files.length && <>
          <Box component="ol" aria-label="開始使用的三個步驟" sx={{ listStyle: 'none', display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 3, maxWidth: 900, mx: 'auto', mt: 4, mb: 3 }}>
            {[
              ['加入文件', '選擇 PDF 或圖片，也可以一次拖入多份。'],
              ['依你需要整理', '編輯頁面，或切換到合併工作區安排順序。'],
              ['另存你的成果', '完成後下載 PDF，保留一份屬於你的副本。'],
            ].map(([title, description], index) => <Stack component="li" direction="row" spacing={1.5} key={title}>
              <Box sx={{ width: 30, height: 30, flexShrink: 0, display: 'grid', placeItems: 'center', border: '1px solid #b5c4d6', borderRadius: '50%', fontSize: 13, fontWeight: 650 }}>{index + 1}</Box>
              <Box><Typography variant="subtitle2" sx={{ mb: 0.5 }}>{title}</Typography><Typography variant="body2" color="text.secondary">{description}</Typography></Box>
            </Stack>)}
          </Box>
          <Typography variant="caption" color="text.secondary" component="p" align="center" sx={{ maxWidth: 640, mx: 'auto', mb: 4 }}>文件會上傳到此服務的伺服器處理並暫存，完成後請下載。可以隨時從「使用說明」查看操作方式。</Typography>
        </>}

        {workspace.files.length > 0 && (
          <Typography variant="caption" color="text.secondary" component="p" sx={{ mb: 1 }}>
            此分頁會暫存工作區供重新整理後恢復；PDF 存放在伺服器且會過期，完成後請另存下載。
          </Typography>
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
            currentKey={currentFile?.key ?? null} loading={loading} onOpen={handleOpen} onRemove={handleRemove} />
        )}

        {currentFile && (
          <>
            <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'flex-start', sm: 'center' }} justifyContent="space-between" gap={1} sx={{ mt: 3, mb: 1.5 }}>
              <Box sx={{ minWidth: 0 }}><Typography variant="caption" color="text.secondary">目前文件</Typography><Typography component="h2" variant="h6" sx={{ overflowWrap: 'anywhere' }}>{currentFile.name}</Typography></Box>
              <Chip icon={hasEdits ? undefined : <CheckCircleOutline />} label={hasEdits ? '有未套用的頁面變更' : '編輯完成後，請另存下載'} color={hasEdits ? 'warning' : 'default'} variant="outlined" sx={{ flexShrink: 0 }} />
            </Stack>
            <ToolBar
              activePanel={activePanel}
              canUndo={workspace.canUndo}
              hasPendingEdits={hasEdits}
              loading={loading}
              onTogglePanel={(panel) => setActivePanel(activePanel === panel ? null : panel)}
              onUndo={() => void workspace.undo()}
              onSavePdf={() => void handleSavePdf()}
            />

            <Box id="tool-panel-split" role="region" aria-label="拆分設定" sx={panelVisible('split')}>
              <SplitPanel
                pageCount={currentFile.pageCount}
                loading={loading}
                onSplit={(options) => void closePanelOnSuccess(workspace.split(options))}
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
                previewPage={activePanel === 'watermark' && !hasEdits ? watermarkPreviewPage : null}
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
        </Box>
        </Box>
      </Container>
    </Box>
  );
}

export default App;
