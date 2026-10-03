import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';

const fixture = path.resolve('e2e/fixtures/three-pages.pdf');
const read = (page: Page) => page.evaluate(() => JSON.parse(sessionStorage.getItem('pdf-editor.workspace.v1')!));
const red = 'iVBORw0KGgoAAAANSUhEUgAAAHgAAABQCAIAAABd+SbeAAAAxklEQVR4nO3QQREAIAzAMMC/5+GiPEgU9LpnUTivA35hdMToiNERoyNGR4yOGB0xOmJ0xOiI0RGjI0ZHjI4YHTE6YnTE6IjREaMjRkeMjhgdMTpidMToiNERoyNGR4yOGB0xOmJ0xOiI0RGjI0ZHjI4YHTE6YnTE6IjREaMjRkeMjhgdMTpidMToiNERoyNGR4yOGB0xOmJ0xOiI0RGjI0ZHjI4YHTE6YnTE6IjREaMjRkeMjhgdMTpidMToiNERoyNGR4yOXBitAZ9Q1fboAAAAAElFTkSuQmCC';
const blue = 'iVBORw0KGgoAAAANSUhEUgAAAHgAAABQCAIAAABd+SbeAAAAyUlEQVR4nO3QQREAIRDAsAX/nu9UUB4kCjpdM99w3r4d8AqjI0ZHjI4YHTE6YnTE6IjREaMjRkeMjhgdMTpidMToiNERoyNGR4yOGB0xOmJ0xOiI0RGjI0ZHjI4YHTE6YnTE6IjREaMjRkeMjhgdMTpidMToiNERoyNGR4yOGB0xOmJ0xOiI0RGjI0ZHjI4YHTE6YnTE6IjREaMjRkeMjhgdMTpidMToiNERoyNGR4yOGB0xOmJ0xOiI0RGjI0ZHjI4YHTE6YnTkBxavAZ/Sos9KAAAAAElFTkSuQmCC';
const image = (name: string, base64: string) => ({ name, mimeType: 'image/png', buffer: Buffer.from(base64, 'base64') });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true }));
  page.on('dialog', (dialog) => dialog.accept());
  await page.goto('/');
});

test.afterEach(async ({ page, request }) => {
  const state = await read(page).catch(() => null);
  const ids: string[] = state?.workspace.files.flatMap((file: { id: string; history: { id: string }[] }) =>
    [file.id, ...file.history.map((version) => version.id)]) ?? [];
  await Promise.all([...new Set(ids)].map((id) => request.delete('/api/pdf/' + id)));
});

async function open(page: Page, name: string) {
  await page.getByRole('button', { name, exact: true }).click();
  await expect(page.getByText('正在處理文件，請稍候…', { exact: true })).toHaveCount(0);
}

test('real documents retain reordered drafts across upload, switching and reload; ZIP includes both edits', async ({ page }, info) => {
  await page.locator('input[type=file]').first().setInputFiles(fixture);
  await expect(page.getByText('頁面預覽 (3 頁)', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '向右旋轉第 1 頁', exact: true }).click();
  const card = page.getByRole('button', { name: '第 1 頁，已旋轉 90 度', exact: true });
  await card.focus();
  await page.keyboard.press('Space');
  await expect(card).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('ArrowRight');
  await expect(page.getByText('第 1 頁移到第 2 頁的位置。', { exact: true })).toBeAttached();
  await page.keyboard.press('Space');
  await expect.poll(async () => (await read(page)).edits.pages.map((p: { pageNumber: number }) => p.pageNumber)).toEqual([2, 1, 3]);
  await page.getByRole('button', { name: '刪除第 3 頁', exact: true }).click();
  const draftA = (await read(page)).edits;
  const pdf = await import('node:fs/promises');
  await page.locator('input[type=file]').first().setInputFiles({
    name: 'second.pdf', mimeType: 'application/pdf', buffer: await pdf.readFile(fixture),
  });
  await expect(page.getByText('頁面預覽 (3 頁)', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '向左旋轉第 2 頁', exact: true }).click();
  const draftB = (await read(page)).edits;
  await open(page, 'three-pages.pdf');
  expect((await read(page)).edits).toEqual(draftA);
  await page.reload();
  await expect(page.getByText(/已恢復此分頁的工作區/)).toBeVisible();
  expect((await read(page)).edits).toEqual(draftA);
  await open(page, 'second.pdf');
  expect((await read(page)).edits).toEqual(draftB);
  await page.getByRole('tab', { name: '合併 PDF', exact: true }).click();
  await page.getByRole('button', { name: '全選檔案', exact: true }).click();
  await page.getByRole('button', { name: '下載選取 ZIP (2)', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '儲存檔案' })).toBeVisible();
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: '下載', exact: true }).click();
  const download = await downloadEvent;
  await download.saveAs(info.outputPath('two-drafts.zip'));
  expect(await download.failure()).toBeNull();
  const state = await read(page);
  expect(state.workspace.files.map((file: { pageCount: number }) => file.pageCount)).toEqual([2, 3]);
  await page.screenshot({ path: info.outputPath('two-documents.png'), fullPage: true });
});

test('image upload uses natural filename order and A4 output', async ({ page }, info) => {
  const responseEvent = page.waitForResponse('**/api/convert/images-to-pdf');
  await page.locator('input[type=file]').first().setInputFiles([
    image('IMG_10.png', red), image('IMG_2.png', blue),
  ]);
  const response = await responseEvent;
  expect(response.ok()).toBeTruthy();
  expect((await response.json()).name).toBe('IMG_2_等2張.pdf');
  await expect(page.getByText('頁面預覽 (2 頁)', { exact: true })).toBeVisible();
  const state = await read(page);
  expect(state.pages.every((p: { width: number; height: number }) => p.width > 840 && p.height > 590)).toBeTruthy();
  await page.getByRole('button', { name: '另存 PDF', exact: true }).click();
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: '下載', exact: true }).click();
  const download = await downloadEvent;
  await download.saveAs(info.outputPath('images-a4.pdf'));
  expect(await download.failure()).toBeNull();
});

test('mixed PDF and image upload supports fit-to-image output', async ({ page }, info) => {
  const fs = await import('node:fs/promises');
  await page.getByRole('button', { name: '依圖片大小', exact: true }).click();
  await page.locator('input[type=file]').first().setInputFiles([
    { name: 'mixed.pdf', mimeType: 'application/pdf', buffer: await fs.readFile(fixture) },
    image('photo.png', red),
  ]);
  await expect(page.getByText(/已上傳 1 份 PDF/)).toBeVisible();
  expect((await read(page)).workspace.files).toHaveLength(2);
  await open(page, 'photo.pdf');
  const state = await read(page);
  expect(state.pages).toHaveLength(1);
  expect(state.pages[0].width).toBe(Math.floor(120 * 72 / 150));
  expect(state.pages[0].height).toBe(Math.floor(80 * 72 / 150));
  await page.screenshot({ path: info.outputPath('image-fit.png'), fullPage: true });
});

test('merge separate ranges in chosen order and download the named result', async ({ page, request }, info) => {
  await page.locator('input[type=file]').first().setInputFiles(fixture);
  await expect(page.getByText('頁面預覽 (3 頁)', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '向右旋轉第 1 頁', exact: true }).click();
  await page.getByRole('tab', { name: '合併 PDF' }).click();
  const { readFile } = await import('node:fs/promises');
  await page.locator('input[type=file]').first().setInputFiles({ name: 'second.pdf', mimeType: 'application/pdf', buffer: await readFile(fixture) });
  await expect(page.getByRole('checkbox', { name: /second.pdf/ })).toBeVisible();
  await expect(page.getByText('正在處理文件，請稍候…')).toHaveCount(0);
  const before = await read(page);
  expect(before.workspace.files.find((file: { key: string }) => file.key === before.workspace.currentKey).name).toBe('three-pages.pdf');
  expect(before.edits.pages[0].rotation).toBe(90);
  await page.getByRole('button', { name: '全選檔案', exact: true }).click();
  // Keyboard sorting is available in addition to drag and arrow buttons.
  const handle = page.getByRole('button', { name: '拖曳排序 second.pdf', exact: true });
  await handle.focus();
  await page.keyboard.press('Space');
  await expect(handle).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('ArrowUp');
  await expect(page.getByText(/was moved over droppable area/)).toBeAttached();
  await page.keyboard.press('Space');
  await expect.poll(async () => (await read(page)).workspace.mergeSelection[0]).toBe(before.workspace.files[1].key);
  await page.getByRole('textbox', { name: 'second.pdf 的頁碼範圍', exact: true }).fill('2');
  await page.getByRole('textbox', { name: 'three-pages.pdf 的頁碼範圍', exact: true }).fill('1, 3');
  await page.getByRole('textbox', { name: '合併後的檔案名稱' }).fill('review-merged.pdf');
  await expect(page.getByText('已選取 2 份 PDF，合併後 3 頁', { exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath('merge-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('merge-mobile.png'), fullPage: true });
  await page.getByRole('button', { name: '合併 PDF', exact: true }).click();
  await expect(page.getByRole('button', { name: '下載 PDF', exact: true })).toBeVisible();
  const state = await read(page);
  const merged = state.workspace.files.at(-1);
  expect(merged.pageCount).toBe(3);
  expect(merged.name).toBe('review-merged.pdf');
  expect(state.workspace.currentKey).toBe(before.workspace.currentKey);
  const response = await request.get(`/api/pdf/pages/${merged.id}`);
  expect((await response.json()).pageCount).toBe(3);
  await page.getByRole('button', { name: '下載 PDF', exact: true }).click();
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: '下載', exact: true }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe('review-merged.pdf');
  await download.saveAs(info.outputPath('review-merged.pdf'));
  expect(await download.failure()).toBeNull();
  await page.getByRole('button', { name: '編輯合併結果' }).click();
  await expect(page.getByText('頁面預覽 (3 頁)', { exact: true })).toBeVisible();
});
