import { useState } from 'react';
import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react';
import type { CSSProperties } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Divider,
  IconButton,
  Menu,
  MenuItem,
  Paper,
  Stack,
  Tooltip,
  Typography,
  useMediaQuery,
} from '@mui/material';
import type { Theme } from '@mui/material';
import {
  Close as CloseIcon,
  Delete as DeleteIcon,
  DragIndicator,
  ExpandMore as ExpandMoreIcon,
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
    border: '1px solid var(--line-subtle)',
    borderRadius: 4,
    background: '#fff',
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
  const [failedThumbnail, setFailedThumbnail] = useState<string | null>(null);
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
      className="page-card"
      // 以整張卡片作為拖曳觸發點；卡片內的核取方塊與按鈕按鍵不會誤觸拖曳
      ref={(node: HTMLElement | null) => {
        setNodeRef(node);
        setActivatorNodeRef(node);
      }}
      {...attributes}
      {...listeners}
      aria-label={`第 ${position} 頁${rotation ? `，已旋轉 ${rotation} 度` : ''}${selected ? '，已選取' : ''}`}
      onClick={(event) => !disabled && onToggle(page.pageNumber, event.shiftKey)}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 1 : undefined,
        position: 'relative',
      }}
      sx={{
        border: selected ? '2px solid var(--accent)' : '2px solid var(--line-subtle)',
        borderRadius: 3,
        p: { xs: 0.5, sm: 1 },
        textAlign: 'center',
        bgcolor: selected ? 'var(--surface-selected)' : 'var(--surface-muted)',
        cursor: disabled ? 'default' : isDragging ? 'grabbing' : 'grab',
        opacity: isDragging ? 0.8 : 1,
        boxShadow: isDragging ? 4 : 0,
        userSelect: 'none',
        '&:hover': { boxShadow: isDragging ? 4 : 2 },
        '&:focus-visible': { outline: '3px solid var(--accent)', outlineOffset: 2 },
      }}
    >
      <Stack
        direction="row"
        spacing={0.25}
        className="page-actions"
        sx={{
          width: 'fit-content',
          ml: 'auto',
          mb: 1,
          p: 0.25,
          borderRadius: 3,
          bgcolor: 'background.paper',
          boxShadow: 1,
          // 操作保持可見並放在縮圖上方，避免遮住文件內容。
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
        {page.thumbnailUrl && failedThumbnail === page.thumbnailUrl && (
          <Stack alignItems="center" spacing={1}>
            <Typography variant="caption" color="text.secondary">縮圖載入失敗</Typography>
            <Button size="small" onClick={(event) => {
              event.stopPropagation();
              setFailedThumbnail(null);
            }}>重試</Button>
          </Stack>
        )}
        {page.thumbnailUrl && failedThumbnail !== page.thumbnailUrl && (
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
            onError={() => setFailedThumbnail(page.thumbnailUrl ?? null)}
          />
        )}
      </Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ minWidth: 0 }}>
        <Checkbox
          size="small"
          checked={selected}
          disabled={disabled}
          inputProps={{ 'aria-label': `選取第 ${position} 頁` }}
          // 點擊會冒泡到卡片處理（含 Shift 範圍選取），這裡不重複切換
          onChange={() => undefined}
          sx={{ p: 0.5 }}
        />
        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ minWidth: 0 }}>
          <DragIndicator fontSize="small" color="action" sx={{ display: { xs: 'none', sm: 'block' } }} />
          <Typography variant="body2" fontWeight="bold" noWrap>
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
      <Typography variant="caption" color="text.secondary" component="p" sx={{ minHeight: '1.66em' }}>
        {page.pageNumber !== position && `原第 ${page.pageNumber} 頁`}
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

  const [selectMenu, setSelectMenu] = useState<HTMLElement | null>(null);
  const coarsePointer = useMediaQuery('(pointer: coarse)');
  // 只有圖示的按鈕才需要提示名稱
  const iconOnly = useMediaQuery((theme: Theme) => theme.breakpoints.down('md'));
  const closeMenuAnd = (action: () => void) => () => {
    setSelectMenu(null);
    action();
  };
  /** 手機上只顯示圖示的按鈕；名稱仍由 aria-label 提供。 */
  const selectionAction = (
    label: string,
    icon: ReactNode,
    onClick: () => void,
    color: 'primary' | 'error' = 'primary',
  ) => (
    <Tooltip title={iconOnly ? label : ''}>
      <Button
        size="small"
        color={color}
        aria-label={label}
        startIcon={icon}
        onClick={onClick}
        disabled={loading}
        sx={{ minWidth: 44, px: { xs: 1, md: 1.5 }, '& .MuiButton-startIcon': { mr: { xs: 0, md: 1 }, ml: { xs: 0, md: -0.5 } } }}
      >
        <Box component="span" sx={{ display: { xs: 'none', md: 'inline' } }}>{label}</Box>
      </Button>
    </Tooltip>
  );

  return (
    <Paper sx={{ p: { xs: 1.5, sm: 3 } }}>
      <Box sx={{ mb: 1.5, px: { xs: 0.5, sm: 0 } }}>
        <Typography component="h2" variant="h6">頁面 ({order.length})</Typography>
        <Typography variant="body2" color="text.secondary">
          {coarsePointer
            ? '點一下選取頁面，長按後拖曳可調整順序。'
            : '點一下選取頁面，Shift＋點一下選取範圍，拖曳可調整順序。'}
        </Typography>
      </Box>

      {/* 未套用的變更與選取工具固定在視線內，頁面很多時也不必捲回頂端 */}
      <Box
        className="glass-surface"
        sx={{ position: 'sticky', top: 8, zIndex: 3, mb: 2, mx: { xs: -0.5, sm: 0 }, p: 0.75, borderRadius: 3 }}
      >
        {pendingSummary !== null && (
          <Alert
            severity="info"
            sx={{ mb: 0.75, py: 0, flexWrap: 'wrap', '& .MuiAlert-action': { ml: 'auto', pl: 1, py: 0.5, mr: 0 } }}
            action={(
              <Stack direction="row" spacing={1}>
                <Button color="inherit" size="small" onClick={onDiscard} disabled={loading}>
                  還原
                </Button>
                <Button variant="contained" size="small" onClick={onApply} disabled={loading}>
                  {loading ? <CircularProgress size={20} color="inherit" /> : '套用變更'}
                </Button>
              </Stack>
            )}
          >
            未套用：{pendingSummary}
          </Alert>
        )}
        <Stack direction="row" alignItems="center" gap={{ xs: 0, sm: 0.5 }} useFlexGap flexWrap="wrap">
          {selectedCount === 0 ? (
            <>
              <Button size="small" onClick={onSelectAll} disabled={loading}>全選</Button>
              <Button
                size="small"
                endIcon={<ExpandMoreIcon />}
                aria-haspopup="menu"
                aria-expanded={selectMenu !== null}
                onClick={(event: ReactMouseEvent<HTMLElement>) => setSelectMenu(event.currentTarget)}
                disabled={loading}
              >
                更多選取方式
              </Button>
            </>
          ) : (
            <>
              <Typography variant="body2" fontWeight="bold" role="status" sx={{ px: 1 }}>
                已選取 {selectedCount} 頁
              </Typography>
              {selectionAction('取消選取', <CloseIcon />, onClearSelection)}
              <Divider orientation="vertical" flexItem sx={{ mx: 0.5, display: { xs: 'none', sm: 'block' } }} />
              {selectionAction('向左旋轉', <RotateLeftIcon />, () => onRotate(selectedPageNumbers, -90))}
              {selectionAction('向右旋轉', <RotateRightIcon />, () => onRotate(selectedPageNumbers, 90))}
              {selectionAction('抽出為新檔案', <ExtractIcon />, onExtract)}
              {selectionAction('刪除', <DeleteIcon />, () => onDelete(selectedPageNumbers), 'error')}
            </>
          )}
        </Stack>
        <Menu anchorEl={selectMenu} open={selectMenu !== null} onClose={() => setSelectMenu(null)}>
          <MenuItem onClick={closeMenuAnd(() => onSelectParity('odd'))}>奇數頁</MenuItem>
          <MenuItem onClick={closeMenuAnd(() => onSelectParity('even'))}>偶數頁</MenuItem>
          <MenuItem onClick={closeMenuAnd(onInvertSelection)}>反向選取</MenuItem>
        </Menu>
      </Box>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
        accessibility={{ announcements: createAnnouncements(order), screenReaderInstructions }}
      >
        <SortableContext items={order} strategy={rectSortingStrategy}>
          {/* 依可用寬度排欄：手機兩欄，320px 時一欄，桌面依螢幕放更多欄 */}
          <Box
            sx={{
              display: 'grid',
              gap: { xs: 1, sm: 2 },
              gridTemplateColumns: {
                xs: 'repeat(auto-fill, minmax(150px, 1fr))',
                sm: 'repeat(auto-fill, minmax(200px, 1fr))',
              },
            }}
          >
            {order.map((pageNumber, index) => {
              const page = pagesByNumber.get(pageNumber);
              if (!page) return null;
              return (
                <SortablePage
                  key={pageNumber}
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
              );
            })}
          </Box>
        </SortableContext>
      </DndContext>
    </Paper>
  );
}

export default PageGrid;
