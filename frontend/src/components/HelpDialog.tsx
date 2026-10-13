import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Divider, FormControlLabel, Stack, Switch, Typography } from '@mui/material';
import { DownloadOutlined, TouchAppOutlined, UploadFileOutlined } from '@mui/icons-material';

export default function HelpDialog({ open, onClose, reduceTransparency, onTransparencyChange }: {
  open: boolean;
  onClose: () => void;
  reduceTransparency: boolean;
  onTransparencyChange: (value: boolean) => void;
}) {
  return <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" aria-labelledby="help-title">
    <DialogTitle id="help-title">快速上手</DialogTitle>
    <DialogContent>
      <Typography color="text.secondary" sx={{ mb: 3 }}>從加入文件到儲存成果，三步就能完成。</Typography>
      <Stack spacing={3}>
        {[
          { icon: <UploadFileOutlined />, title: '1. 加入文件', text: '拖曳或選擇 PDF、PNG、JPG、WebP。多張圖片會依檔名順序合成一份 PDF；合併文件時，切換到「合併 PDF」。' },
          { icon: <TouchAppOutlined />, title: '2. 整理與編輯', text: '選取頁面後旋轉、刪除或抽出，也可以拖曳調整順序。頁面變更可復原；先套用變更，再使用拆分、統一頁面尺寸、壓縮、浮水印或轉圖片；手機掃描的頁面大小不一時，可用「統一頁面尺寸」對齊成 A4 等紙張。' },
          { icon: <DownloadOutlined />, title: '3. 另存成果', text: '按「另存 PDF」下載。若還有頁面變更，「套用並另存 PDF」會一起完成。工作區暫存不能取代下載，伺服器上的文件會過期。' },
        ].map((step) => <Stack key={step.title} direction="row" spacing={2}>
          <Box sx={{ color: 'primary.main', bgcolor: '#edf4fc', borderRadius: 3, p: 1.25, height: 48 }}>{step.icon}</Box>
          <Box><Typography fontWeight={650} sx={{ mb: 0.5 }}>{step.title}</Typography><Typography variant="body2" color="text.secondary">{step.text}</Typography></Box>
        </Stack>)}
      </Stack>
      <Divider sx={{ my: 3 }} />
      <Typography variant="subtitle2" sx={{ mb: 1 }}>鍵盤操作</Typography>
      <Box component="dl" sx={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 20px', fontSize: 14, '& dt': { fontWeight: 600 }, '& dd': { color: 'text.secondary' } }}>
        <dt>Ctrl / ⌘ + A</dt><dd>全選頁面</dd>
        <dt>Ctrl / ⌘ + Z</dt><dd>復原上一步</dd>
        <dt>Delete / Backspace</dt><dd>刪除選取的頁面</dd>
        <dt>Esc</dt><dd>取消選取或關閉對話框</dd>
        <dt>Shift + 選取</dt><dd>選取連續範圍</dd>
        <dt>空白鍵 + 方向鍵</dt><dd>拿起頁面、移動，再按空白鍵放下</dd>
      </Box>
      <Divider sx={{ my: 3 }} />
      <FormControlLabel control={<Switch checked={reduceTransparency} onChange={(_, checked) => onTransparencyChange(checked)} />} label="降低透明度" />
      <Typography variant="body2" color="text.secondary">使用實色控制區，讓文字與按鈕更容易辨識。介面也會配合系統的減少動態效果設定。</Typography>
    </DialogContent>
    <DialogActions><Button variant="contained" onClick={onClose}>開始使用</Button></DialogActions>
  </Dialog>;
}
