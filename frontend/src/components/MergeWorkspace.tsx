import { useState } from 'react';
import { Alert, Box, Button, Checkbox, Divider, FormControlLabel, IconButton, Paper, Stack, TextField, Typography } from '@mui/material';
import { ArrowUpward, ArrowDownward, DragIndicator } from '@mui/icons-material';
import { DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core';
import { SortableContext, useSortable, arrayMove, verticalListSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { PdfWorkspace } from '../hooks/usePdfWorkspace';
import type { WorkspaceFile } from '../state/workspace';
import { parseMergePages } from '../utils/mergePages';

function MergeRow({ file, index, total, count, value, disabled, onChange, onMove }: {
  file: WorkspaceFile; index: number; total: number; count: number; value: string; disabled: boolean;
  onChange: (value: string) => void; onMove: (delta: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: file.key, disabled });
  let error = '';
  try { parseMergePages(value, count); } catch (e) { error = (e as Error).message; }
  return <Paper ref={setNodeRef} variant="outlined" style={{ transform: CSS.Transform.toString(transform), transition }} sx={{ p: 2 }}>
    <Stack direction="row" alignItems="center" gap={1}>
      <IconButton {...attributes} {...listeners} disabled={disabled} aria-label={`拖曳排序 ${file.name}`} sx={{ touchAction: 'none' }}><DragIndicator /></IconButton>
      <Typography sx={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{index + 1}. {file.name}</Typography>
      <IconButton disabled={disabled || index === 0} aria-label={`上移 ${file.name}`} onClick={() => onMove(-1)}><ArrowUpward /></IconButton>
      <IconButton disabled={disabled || index === total - 1} aria-label={`下移 ${file.name}`} onClick={() => onMove(1)}><ArrowDownward /></IconButton>
    </Stack>
    <TextField fullWidth size="small" label={`${file.name} 的頁碼範圍`} value={value} disabled={disabled}
      onChange={(event) => onChange(event.target.value)} placeholder="全部頁面，或輸入如 1-3, 5"
      error={!!error} helperText={error || `共 ${count} 頁。留白表示全部頁面。`} sx={{ mt: 1.5 }} />
  </Paper>;
}

export default function MergeWorkspace({ workspace, loading, onEdit, onSave, onBundle }: {
  workspace: PdfWorkspace; loading: boolean; onEdit: (key: string) => void;
  onSave: (file: WorkspaceFile) => void; onBundle: () => void;
}) {
  const [ranges, setRanges] = useState<Record<string, string>>({});
  const [name, setName] = useState('合併文件.pdf');
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const { files, mergeFiles, mergeSelection, mergePageCounts, mergeResult } = workspace;
  let total = 0;
  let valid = true;
  for (const file of mergeFiles) {
    try { total += parseMergePages(ranges[file.key] ?? '', mergePageCounts[file.key]).length; } catch { valid = false; }
  }
  const blocker = mergeFiles.length < 2
    ? (files.length < 2 ? '至少需要兩份文件，請先加入檔案。' : `再勾選 ${2 - mergeFiles.length} 份即可合併。`)
    : !valid ? '請修正頁碼範圍。'
      : !name.trim() ? '請輸入檔案名稱。' : null;
  const move = (index: number, delta: number) => workspace.reorderMerge(arrayMove(mergeSelection, index, index + delta));
  return <Stack spacing={2}>
    {mergeResult && <Alert severity="success">
      <Typography sx={{ overflowWrap: 'anywhere' }}>已建立「{mergeResult.name}」，共 {mergeResult.pageCount} 頁。原始檔案不受影響。</Typography>
      <Stack direction="row" gap={1} useFlexGap flexWrap="wrap" sx={{ mt: 1 }}>
        <Button disabled={loading} onClick={() => onEdit(mergeResult.key)}>編輯合併結果</Button>
        <Button variant="contained" disabled={loading} onClick={() => onSave(mergeResult)}>另存 PDF</Button>
      </Stack>
    </Alert>}
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(240px, 1fr) minmax(0, 2fr)' }, gap: 2, alignItems: 'start' }}>
      <Paper sx={{ p: 2 }}>
        <Typography variant="h6">1. 選擇檔案</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>勾選要合併的文件。</Typography>
        <Button disabled={loading || !files.length} onClick={() => {
          const all = files.every((file) => mergeSelection.includes(file.key));
          files.forEach((file) => { if (all || !mergeSelection.includes(file.key)) workspace.toggleMerge(file.key); });
        }}>{files.length > 0 && mergeSelection.length === files.length ? '取消全選' : '全選檔案'}</Button>
        <Stack>{files.map((file) => <FormControlLabel key={file.key} sx={{ m: 0, py: 0.5, overflowWrap: 'anywhere' }}
          control={<Checkbox disabled={loading} checked={mergeSelection.includes(file.key)} onChange={() => workspace.toggleMerge(file.key)} />}
          label={<Box>{file.name}<Typography variant="caption" color="text.secondary" component="div">{mergePageCounts[file.key]} 頁{workspace.pendingFileKeys.includes(file.key) ? ' · 合併時會套用編輯' : ''}</Typography></Box>} />)}</Stack>
        {!files.length && <Typography sx={{ py: 2 }}>請先加入 PDF 或圖片。</Typography>}
        <Divider sx={{ my: 1.5 }} />
        <Button disabled={loading || !mergeFiles.length} onClick={onBundle}>另存為 ZIP（{mergeFiles.length} 份）</Button>
        <Typography variant="caption" color="text.secondary" component="p">不合併，把勾選的文件各自完整放進一個 ZIP。</Typography>
      </Paper>
      <Stack spacing={2}>
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6">2. 設定內容與順序</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>文件會依下列順序接成一份。拖曳把手或用箭頭調整順序。</Typography>
          {!mergeFiles.length && <Typography color="text.secondary" sx={{ py: 3 }}>勾選文件後，會出現在這裡。</Typography>}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={({ active, over }) => {
            if (over && active.id !== over.id) workspace.reorderMerge(arrayMove(mergeSelection, mergeSelection.indexOf(String(active.id)), mergeSelection.indexOf(String(over.id))));
          }}>
            <SortableContext items={mergeSelection} strategy={verticalListSortingStrategy}>
              <Stack spacing={1.5}>{mergeFiles.map((file, index) => <MergeRow key={file.key} file={file} index={index} total={mergeFiles.length}
                count={mergePageCounts[file.key]} value={ranges[file.key] ?? ''} disabled={loading}
                onChange={(value) => setRanges((previous) => ({ ...previous, [file.key]: value }))} onMove={(delta) => move(index, delta)} />)}</Stack>
            </SortableContext>
          </DndContext>
        </Paper>
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>3. 確認輸出</Typography>
          <TextField fullWidth size="small" label="合併後的檔案名稱" value={name} disabled={loading} onChange={(event) => setName(event.target.value)} />
          <Typography sx={{ my: 2 }} role="status">已選取 {mergeFiles.length} 份 PDF{valid ? `，合併後 ${total} 頁` : '，請修正頁碼範圍'}</Typography>
          <Stack direction="row" alignItems="center" gap={1.5} useFlexGap flexWrap="wrap">
            <Button variant="contained" disabled={loading || blocker !== null} aria-describedby={blocker ? 'merge-blocker' : undefined}
              onClick={() => void workspace.mergeSelectedFiles(name, ranges)}>合併 PDF</Button>
            {/* 按鈕無法使用時，就近說明原因 */}
            {blocker && <Typography id="merge-blocker" variant="body2" color="text.secondary">{blocker}</Typography>}
          </Stack>
        </Paper>
      </Stack>
    </Box>
  </Stack>;
}
