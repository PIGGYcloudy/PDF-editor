import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Divider, FormControlLabel, Stack, Switch, Typography } from '@mui/material';
import { CallMergeOutlined, DownloadOutlined, TouchAppOutlined, UploadFileOutlined } from '@mui/icons-material';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
const MOD = isMac ? '⌘' : 'Ctrl';

export default function HelpDialog({ open, onClose, reduceTransparency, onTransparencyChange }: {
  open: boolean;
  onClose: () => void;
  reduceTransparency: boolean;
  onTransparencyChange: (value: boolean) => void;
}) {
  return <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" aria-labelledby="help-title">
    <DialogTitle id="help-title">使用說明</DialogTitle>
    <DialogContent>
      <Stack spacing={2.5}>
        {[
          { icon: <UploadFileOutlined />, title: '加入檔案', text: '支援 PDF、PNG、JPG、WebP。一次加入多張圖片時，會依檔名順序合成一份 PDF。' },
          { icon: <TouchAppOutlined />, title: '編輯頁面', text: '選取頁面後可旋轉、刪除或抽出成新檔案，拖曳可調整順序。頁面變更會先暫存，按「套用變更」或使用其他工具時才會寫入文件。手機掃描的頁面大小不一時，可用「統一尺寸」對齊成 A4 等紙張。' },
          { icon: <CallMergeOutlined />, title: '合併文件', text: '在「合併」分頁勾選文件、安排順序，也可只取部分頁碼。' },
          { icon: <DownloadOutlined />, title: '另存', text: '檔案只在伺服器暫存一段時間，完成後請按「另存 PDF」存到裝置。' },
        ].map((step) => <Stack key={step.title} direction="row" spacing={2}>
          <Box sx={{ color: 'primary.main', bgcolor: 'var(--surface-tint)', borderRadius: 3, p: 1, height: 40, flexShrink: 0 }}>{step.icon}</Box>
          <Box><Typography fontWeight={650} sx={{ mb: 0.25 }}>{step.title}</Typography><Typography variant="body2" color="text.secondary">{step.text}</Typography></Box>
        </Stack>)}
      </Stack>
      <Divider sx={{ my: 3 }} />
      <Typography variant="subtitle2" sx={{ mb: 1 }}>鍵盤快速鍵</Typography>
      <Box component="dl" sx={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 20px', fontSize: 14, '& dt': { fontWeight: 600 }, '& dd': { color: 'text.secondary' } }}>
        <dt>{MOD} + A</dt><dd>全選頁面</dd>
        <dt>{MOD} + Z</dt><dd>復原</dd>
        <dt>{isMac ? '⇧ ⌘ Z' : 'Ctrl + Y'}</dt><dd>重做</dd>
        <dt>Delete</dt><dd>刪除選取的頁面</dd>
        <dt>Esc</dt><dd>取消選取</dd>
        <dt>Shift + 點一下</dt><dd>選取連續範圍</dd>
        <dt>空白鍵 + 方向鍵</dt><dd>拿起頁面並移動，再按空白鍵放下</dd>
      </Box>
      <Divider sx={{ my: 3 }} />
      <FormControlLabel control={<Switch checked={reduceTransparency} onChange={(_, checked) => onTransparencyChange(checked)} />} label="降低透明度" />
      <Typography variant="body2" color="text.secondary">工具列改用不透明的背景，文字較容易辨識。</Typography>
    </DialogContent>
    <DialogActions><Button variant="contained" onClick={onClose}>完成</Button></DialogActions>
  </Dialog>;
}
