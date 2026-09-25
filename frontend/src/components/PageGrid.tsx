import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Grid,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { DragIndicator, ZoomIn as ZoomInIcon } from '@mui/icons-material';
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
import type { Page } from '../types';

const announcements: Announcements = {
  onDragStart: ({ active }) => `已拿起第 ${active.id} 頁。`,
  onDragOver: ({ active, over }) => (
    over ? `第 ${active.id} 頁移到第 ${over.id} 頁的位置。` : `第 ${active.id} 頁不在可放置的位置。`
  ),
  onDragEnd: ({ active, over }) => (
    over ? `第 ${active.id} 頁已放到第 ${over.id} 頁的位置。` : `已放下第 ${active.id} 頁。`
  ),
  onDragCancel: ({ active }) => `已取消移動第 ${active.id} 頁。`,
};

const screenReaderInstructions = {
  draggable: '按空白鍵或 Enter 拿起頁面，用方向鍵移動，再按一次放下；按 Esc 取消。',
};

interface SortablePageProps {
  page: Page;
  selected: boolean;
  disabled: boolean;
  onToggle: (pageNumber: number) => void;
  onPreview: (pageNumber: number) => void;
}

function SortablePage({
  page,
  selected,
  disabled,
  onToggle,
  onPreview,
}: SortablePageProps) {
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
      aria-label={`第 ${page.pageNumber} 頁${selected ? '，已選取' : ''}`}
      onClick={() => onToggle(page.pageNumber)}
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
        '&:focus-visible': { outline: '3px solid #90caf9', outlineOffset: 2 },
      }}
    >
      <Box
        sx={{
          mb: 1,
          height: 150,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        {page.thumbnailUrl && (
          <img
            src={page.thumbnailUrl}
            alt={`第 ${page.pageNumber} 頁縮圖`}
            loading="lazy"
            decoding="async"
            draggable={false}
            style={{
              maxWidth: '100%',
              maxHeight: '150px',
              objectFit: 'contain',
              border: '1px solid #eee',
              borderRadius: 4,
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
          inputProps={{ 'aria-label': `選取第 ${page.pageNumber} 頁` }}
          onClick={(event) => event.stopPropagation()}
          onChange={() => onToggle(page.pageNumber)}
          sx={{ p: 0.5 }}
        />
        <Stack direction="row" alignItems="center" spacing={0.5}>
          <DragIndicator fontSize="small" color="action" />
          <Typography variant="body2" fontWeight="bold">
            第 {page.pageNumber} 頁
          </Typography>
        </Stack>
        <Tooltip title="放大預覽">
          <IconButton
            size="small"
            aria-label={`放大預覽第 ${page.pageNumber} 頁`}
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
        {page.width} x {page.height} pt
      </Typography>
    </Box>
  );
}

interface PageGridProps {
  pages: Page[];
  /** 目前顯示的頁面順序（原始頁碼） */
  order: number[];
  selected: Set<number>;
  loading: boolean;
  onToggle: (pageNumber: number) => void;
  onOrderChange: (order: number[]) => void;
  onApplyOrder: () => void;
  onResetOrder: () => void;
  onPreview: (pageNumber: number) => void;
}

function PageGrid({
  pages,
  order,
  selected,
  loading,
  onToggle,
  onOrderChange,
  onApplyOrder,
  onResetOrder,
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
  const orderChanged = order.some((pageNumber, index) => pageNumber !== index + 1);

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const oldIndex = order.indexOf(Number(active.id));
    const newIndex = order.indexOf(Number(over.id));
    onOrderChange(arrayMove(order, oldIndex, newIndex));
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        spacing={1}
        sx={{ mb: 2 }}
      >
        <Box>
          <Typography variant="h6">頁面預覽 ({pages.length} 頁)</Typography>
          <Typography variant="body2" color="text.secondary">
            點擊頁面以選取，拖曳頁面可調整順序（觸控裝置請長按後拖曳）。
          </Typography>
        </Box>
        {orderChanged && (
          <Stack direction="row" spacing={1}>
            <Button onClick={onResetOrder} disabled={loading}>
              還原順序
            </Button>
            <Button variant="contained" onClick={onApplyOrder} disabled={loading}>
              {loading ? <CircularProgress size={24} /> : '套用新順序'}
            </Button>
          </Stack>
        )}
      </Stack>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
        accessibility={{ announcements, screenReaderInstructions }}
      >
        <SortableContext items={order} strategy={rectSortingStrategy}>
          <Grid container spacing={2}>
            {order.map((pageNumber) => {
              const page = pagesByNumber.get(pageNumber);
              if (!page) return null;
              return (
                <Grid item xs={6} sm={4} md={3} lg={2} key={pageNumber}>
                  <SortablePage
                    page={page}
                    selected={selected.has(pageNumber)}
                    disabled={loading}
                    onToggle={onToggle}
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
