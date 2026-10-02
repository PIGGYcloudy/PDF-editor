import { useState } from 'react';
import type { CSSProperties } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Divider,
  Grid,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  DragIndicator,
  FileCopy as ExtractIcon,
  RotateLeft as RotateLeftIcon,
  RotateRight as RotateRightIcon,
  ZoomIn as ZoomInIcon,
} from '@mui/icons-material';
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { Announcements, DragEndEvent } from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Rotation } from '../state/pageEdits';
import type { Page } from '../types';

const THUMBNAIL_HEIGHT = 150;

/** 朗讀的是目前的位置，而不是原始頁碼（拖曳後兩者會不同）。 */
function createAnnouncements(order: number[]): Announcements {
  const position = (id: string | number) => order.indexOf(Number(id)) + 1;
  return {
    onDragStart: ({ active }) => `已拿起第 ${position(active.id)} 頁。`,
    onDragOver: ({ active, over }) => (
      over
        ? `第 ${position(active.id)} 頁移到第 ${position(over.id)} 頁的位置。`
        : `第 ${position(active.id)} 頁不在可放置的位置。`
    ),
    onDragEnd: ({ active, over }) => (
      over
        ? `第 ${position(active.id)} 頁已放到第 ${position(over.id)} 頁的位置。`
        : `已放下第 ${position(active.id)} 頁。`
    ),
    onDragCancel: ({ active }) => `已取消移動第 ${position(active.id)} 頁。`,
  };
}

const screenReaderInstructions = {
  draggable: '按空白鍵或 Enter 拿起頁面，用方向鍵移動，再按一次放下；按 Esc 取消。',
};

/**
 * 縮圖的樣式。旋轉 90/270 度時，圖片的版面寬高會對調：版面高度要不超過
 * 卡片寬度（100cqw）、版面寬度要不超過縮圖區高度，旋轉後才放得進格子。
 */
function thumbnailStyle(rotation: Rotation, aspect: number): CSSProperties {
  const base: CSSProperties = {
    border: '1px solid #eee',
    borderRadius: 4,
    transition: 'transform 0.2s',
  };
  if (rotation === 90 || rotation === 270) {
    return {
      ...base,
      '--thumb-length': `min(100cqw, ${THUMBNAIL_HEIGHT / aspect}px)`,
      height: 'var(--thumb-length)',
      width: `calc(var(--thumb-length) * ${aspect})`,
      maxWidth: 'none',
      flexShrink: 0,
      transform: `rotate(${rotation}deg)`,
    } as CSSProperties;
  }
  return {
    ...base,
    maxWidth: '100%',
    maxHeight: THUMBNAIL_HEIGHT,
    objectFit: 'contain',
    transform: rotation === 180 ? 'rotate(180deg)' : undefined,
  };
}

interface SortablePageProps {
  page: Page;
  /** 目前顯示的位置（從 1 開始） */
  position: number;
  rotation: Rotation;
  selected: boolean;
  disabled: boolean;
  onToggle: (pageNumber: number, extend: boolean) => void;
  onRotate: (pageNumber: number, delta: number) => void;
  onDelete: (pageNumber: number) => void;
  onPreview: (pageNumber: number) => void;
}

function SortablePage({
  page,
  position,
  rotation,
  selected,
  disabled,
  onToggle,
  onRotate,
  onDelete,
  onPreview,
}: SortablePageProps) {
  // 以實際渲染的縮圖計算長寬比；頁面本身帶有旋轉屬性時，與 MediaBox 不同
  const [naturalAspect, setNaturalAspect] = useState<number | null>(null);
  const aspect = naturalAspect
    ?? (page.width > 0 && page.height > 0 ? page.width / page.height : 0.707);

  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: page.pageNumber, disabled });

  return (
    <Box
      // 以整張卡片作為拖曳觸發點；卡片內的核取方塊與按鈕按鍵不會誤觸拖曳
      ref={(node: HTMLElement | null) => {
        setNodeRef(node);
        setActivatorNodeRef(node);
      }}
      {...attributes}
      {...listeners}
      aria-label={`第 ${position} 頁${rotation ? `，已旋轉 ${rotation} 度` : ''}${selected ? '，已選取' : ''}`}
      onClick={(event) => onToggle(page.pageNumber, event.shiftKey)}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 1 : undefined,
        position: 'relative',
      }}
      sx={{
        border: selected ? '3px solid #1976d2' : '2px solid #ddd',
        borderRadius: 2,
        p: 1,
        textAlign: 'center',
        bgcolor: selected ? '#e3f2fd' : '#fff',
        cursor: disabled ? 'default' : isDragging ? 'grabbing' : 'grab',
        opacity: isDragging ? 0.8 : 1,
        boxShadow: isDragging ? 4 : 0,
        userSelect: 'none',
        '&:hover': { boxShadow: isDragging ? 4 : 2 },
        '&:hover .page-actions, &:focus-within .page-actions': { opacity: 1 },
        '&:focus-visible': { outline: '3px solid #90caf9', outlineOffset: 2 },
      }}
    >
      <Stack
        direction="row"
        spacing={0.25}
        className="page-actions"
        sx={{
          position: 'absolute',
          top: 8,
          right: 8,
          zIndex: 1,
          p: 0.25,
          borderRadius: 1,
          bgcolor: 'rgba(255, 255, 255, 0.92)',
          boxShadow: 1,
          // 觸控裝置沒有 hover，工具列一律顯示
          opacity: 0,
          transition: 'opacity 0.15s',
          '@media (hover: none)': { opacity: 1 },
        }}
      >
        <Tooltip title="向左旋轉">
          <span>
            <IconButton
              size="small"
              aria-label={`向左旋轉第 ${position} 頁`}
              disabled={disabled}
              onClick={(event) => {
                event.stopPropagation();
                onRotate(page.pageNumber, -90);
              }}
            >
              <RotateLeftIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="向右旋轉">
          <span>
            <IconButton
              size="small"
              aria-label={`向右旋轉第 ${position} 頁`}
              disabled={disabled}
              onClick={(event) => {
                event.stopPropagation();
                onRotate(page.pageNumber, 90);
              }}
            >
              <RotateRightIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="刪除此頁">
          <span>
            <IconButton
              size="small"
              color="error"
              aria-label={`刪除第 ${position} 頁`}
              disabled={disabled}
              onClick={(event) => {
                event.stopPropagation();
                onDelete(page.pageNumber);
              }}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>
      <Box
        sx={{
          mb: 1,
          height: THUMBNAIL_HEIGHT,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          overflow: 'hidden',
          containerType: 'inline-size',
        }}
      >
        {page.thumbnailUrl && (
          <img
            src={page.thumbnailUrl}
            alt={`第 ${position} 頁縮圖`}
            loading="lazy"
            decoding="async"
            draggable={false}
            style={thumbnailStyle(rotation, aspect)}
            onLoad={(event) => {
              const { naturalWidth, naturalHeight } = event.currentTarget;
              if (naturalWidth > 0 && naturalHeight > 0) {
                setNaturalAspect(naturalWidth / naturalHeight);
              }
            }}
            onError={(event) => {
              event.currentTarget.style.visibility = 'hidden';
            }}
          />
        )}
      </Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Checkbox
          size="small"
          checked={selected}
          disabled={disabled}
          inputProps={{ 'aria-label': `選取第 ${position} 頁` }}
          // 點擊會冒泡到卡片處理（含 Shift 範圍選取），這裡不重複切換
          onChange={() => undefined}
          sx={{ p: 0.5 }}
        />
        <Stack direction="row" alignItems="center" spacing={0.5}>
          <DragIndicator fontSize="small" color="action" />
          <Typography variant="body2" fontWeight="bold">
            第 {position} 頁
          </Typography>
        </Stack>
        <Tooltip title="放大預覽">
          <IconButton
            size="small"
            aria-label={`放大預覽第 ${position} 頁`}
            onClick={(event) => {
              event.stopPropagation();
              onPreview(page.pageNumber);
            }}
            sx={{ p: 0.5 }}
          >
            <ZoomInIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>
      <Typography variant="caption" color="text.secondary">
        {page.pageNumber !== position && `原第 ${page.pageNumber} 頁 · `}
        {page.width} x {page.height} pt
      </Typography>
    </Box>
  );
}

interface PageGridProps {
  pages: Page[];
  /** 目前顯示的頁面順序（原始頁碼） */
  order: number[];
  rotations: Map<number, Rotation>;
  selected: Set<number>;
  loading: boolean;
  /** 尚未套用的變更說明；沒有變更時為 null */
  pendingSummary: string | null;
  onToggle: (pageNumber: number, extend: boolean) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onInvertSelection: () => void;
  onSelectParity: (parity: 'odd' | 'even') => void;
  onRotate: (pageNumbers: number[], delta: number) => void;
  onDelete: (pageNumbers: number[]) => void;
  onExtract: () => void;
  onOrderChange: (order: number[]) => void;
  onApply: () => void;
  onDiscard: () => void;
  onPreview: (pageNumber: number) => void;
}

function PageGrid({
  pages,
  order,
  rotations,
  selected,
  loading,
  pendingSummary,
  onToggle,
  onSelectAll,
  onClearSelection,
  onInvertSelection,
  onSelectParity,
  onRotate,
  onDelete,
  onExtract,
  onOrderChange,
  onApply,
  onDiscard,
  onPreview,
}: PageGridProps) {
  const sensors = useSensors(
    // 移動一小段距離才開始拖曳，單純點擊仍是選取頁面
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // 觸控需長按才拖曳，避免影響捲動
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const pagesByNumber = new Map(pages.map((page) => [page.pageNumber, page]));
  const selectedCount = selected.size;
  const selectedPageNumbers = Array.from(selected);

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const oldIndex = order.indexOf(Number(active.id));
    const newIndex = order.indexOf(Number(over.id));
    onOrderChange(arrayMove(order, oldIndex, newIndex));
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Box sx={{ mb: 2 }}>
        <Typography variant="h6">頁面預覽 ({order.length} 頁)</Typography>
        <Typography variant="body2" color="text.secondary">
          點擊選取（Shift+點擊選取範圍），拖曳調整順序（觸控裝置請長按後拖曳），
          滑過頁面可旋轉或刪除。變更會先暫存，按「套用變更」才會產生新版本。
        </Typography>
      </Box>

      {pendingSummary !== null && (
        <Alert
          severity="info"
          // 頁面很多時，套用按鈕仍留在視線內
          sx={{ mb: 2, position: 'sticky', top: 8, zIndex: 3, alignItems: 'center' }}
          action={(
            <Stack direction="row" spacing={1}>
              <Button color="inherit" size="small" onClick={onDiscard} disabled={loading}>
                還原變更
              </Button>
              <Button variant="contained" size="small" onClick={onApply} disabled={loading}>
                {loading ? <CircularProgress size={20} /> : '套用變更'}
              </Button>
            </Stack>
          )}
        >
          尚未套用：{pendingSummary}
        </Alert>
      )}

      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        useFlexGap
        flexWrap="wrap"
        sx={{ mb: 2 }}
      >
        <Typography variant="body2" color="text.secondary">選取：</Typography>
        <Button size="small" onClick={onSelectAll} disabled={loading}>全選</Button>
        <Button size="small" onClick={() => onSelectParity('odd')} disabled={loading}>
          奇數頁
        </Button>
        <Button size="small" onClick={() => onSelectParity('even')} disabled={loading}>
          偶數頁
        </Button>
        <Button size="small" onClick={onInvertSelection} disabled={loading}>反選</Button>
        <Button
          size="small"
          onClick={onClearSelection}
          disabled={loading || selectedCount === 0}
        >
          取消選取
        </Button>
        {selectedCount > 0 && (
          <>
            <Divider orientation="vertical" flexItem />
            <Typography variant="body2" fontWeight="bold">
              已選取 {selectedCount} 頁
            </Typography>
            <Button
              size="small"
              startIcon={<RotateLeftIcon />}
              onClick={() => onRotate(selectedPageNumbers, -90)}
              disabled={loading}
            >
              向左旋轉
            </Button>
            <Button
              size="small"
              startIcon={<RotateRightIcon />}
              onClick={() => onRotate(selectedPageNumbers, 90)}
              disabled={loading}
            >
              向右旋轉
            </Button>
            <Button
              size="small"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={() => onDelete(selectedPageNumbers)}
              disabled={loading}
            >
              刪除
            </Button>
            <Button
              size="small"
              startIcon={<ExtractIcon />}
              onClick={onExtract}
              disabled={loading}
            >
              抽出為新檔案
            </Button>
          </>
        )}
      </Stack>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
        accessibility={{ announcements: createAnnouncements(order), screenReaderInstructions }}
      >
        <SortableContext items={order} strategy={rectSortingStrategy}>
          <Grid container spacing={2}>
            {order.map((pageNumber, index) => {
              const page = pagesByNumber.get(pageNumber);
              if (!page) return null;
              return (
                <Grid item xs={6} sm={4} md={3} lg={2} key={pageNumber}>
                  <SortablePage
                    page={page}
                    position={index + 1}
                    rotation={rotations.get(pageNumber) ?? 0}
                    selected={selected.has(pageNumber)}
                    disabled={loading}
                    onToggle={onToggle}
                    onRotate={(number, delta) => onRotate([number], delta)}
                    onDelete={(number) => onDelete([number])}
                    onPreview={onPreview}
                  />
                </Grid>
              );
            })}
          </Grid>
        </SortableContext>
      </DndContext>
    </Paper>
  );
}

export default PageGrid;
