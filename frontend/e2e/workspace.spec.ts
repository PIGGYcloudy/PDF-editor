import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import type { WorkspaceSnapshot } from '../src/state/recovery';

const fixture = path.resolve('e2e/fixtures/three-pages.pdf');

async function snapshot(page: Page): Promise<WorkspaceSnapshot> {
  return page.evaluate(() => JSON.parse(sessionStorage.getItem('pdf-editor.workspace.v1')!));
}

async function upload(page: Page) {
  await page.locator('input[type=file]').first().setInputFiles(fixture);
  await expect(page.getByText('頁面 (3)', { exact: true })).toBeVisible();
  await expect(page.getByText('處理中…', { exact: true })).toHaveCount(0);
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    // Use actual browser downloads without an OS file-picker dialog in automation.
    Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true });
  });
  page.on('dialog', (dialog) => dialog.accept());
  await page.goto('/');
});

test.afterEach(async ({ page, request }) => {
  const state = await snapshot(page).catch(() => null);
  const ids = state?.workspace.files.flatMap((file) => [file.id, ...file.history.map((v) => v.id)]) ?? [];
  await Promise.all([...new Set(ids)].map((id) => request.delete(`/api/pdf/${id}`)));
});

test('refresh restores pending edits and undo; save applies the recovered changes', async ({ page }, testInfo) => {
  await upload(page);
  await page.getByRole('button', { name: '向右旋轉第 1 頁', exact: true }).click();
  await page.getByRole('button', { name: '刪除第 2 頁', exact: true }).click();
  await expect(page.getByText('頁面 (2)', { exact: true })).toBeVisible();
  const before = await snapshot(page);
  await page.reload();
  await expect(page.getByText(/已恢復上次的工作區/)).toBeVisible();
  expect((await snapshot(page)).edits).toEqual(before.edits);
  await page.getByRole('button', { name: '復原刪除頁面', exact: true }).click();
  await expect(page.getByText('頁面 (3)', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '刪除第 2 頁', exact: true }).click();

  const applyRequest = page.waitForRequest((req) => req.url().endsWith('/api/pdf/apply-edits'));
  await page.getByRole('button', { name: '另存 PDF', exact: true }).click();
  expect((await applyRequest).postDataJSON().pages).toEqual([
    { pageNumber: 1, rotation: 90 }, { pageNumber: 3, rotation: 0 },
  ]);
  await expect(page.getByRole('dialog', { name: '另存檔案' })).toBeVisible();
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: '下載', exact: true }).click();
  const download = await downloadEvent;
  await download.saveAs(testInfo.outputPath('edited.pdf'));
  expect(await download.failure()).toBeNull();
  expect((await snapshot(page)).workspace.files[0].pageCount).toBe(2);
});

test('failed apply keeps edits and does not download the old PDF', async ({ page }) => {
  await upload(page);
  await page.getByRole('button', { name: '向右旋轉第 1 頁', exact: true }).click();
  await page.route('**/api/pdf/apply-edits', (route) => route.fulfill({
    status: 500, contentType: 'application/json', body: JSON.stringify({ detail: '模擬套用失敗' }),
  }));
  await page.getByRole('button', { name: '另存 PDF', exact: true }).click();
  await expect(page.getByText('模擬套用失敗', { exact: true })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect((await snapshot(page)).edits.pages[0].rotation).toBe(90);
});

test('preview retries after failure and shows staged rotation', async ({ page }) => {
  await page.route(/\/api\/pdf\/thumbnail\/.*\/page\/1\?size=medium$/, (route) => route.abort(), { times: 1 });
  await upload(page);
  await expect(page.getByText('縮圖載入失敗')).toBeVisible();
  await page.getByRole('button', { name: '重試', exact: true }).click();
  await expect(page.getByText('縮圖載入失敗')).toHaveCount(0);
  await page.getByRole('button', { name: '向右旋轉第 1 頁', exact: true }).click();
  await page.route('**/api/pdf/preview/**', (route) => route.abort(), { times: 1 });
  await page.getByRole('button', { name: '放大預覽第 1 頁', exact: true }).click();
  await expect(page.getByText(/無法載入預覽/)).toBeVisible();
  await page.getByRole('button', { name: '重試', exact: true }).click();
  const image = page.getByRole('img', { name: '第 1 頁預覽', exact: true });
  await expect(image).toBeVisible();
  await expect(image).toHaveCSS('transform', 'matrix(0, 1, -1, 0, 0, 0)');
  const bounds = await image.boundingBox();
  expect(bounds!.width).toBeGreaterThan(bounds!.height);
});

test('an expired PDF can still be removed from the workspace', async ({ page, request }) => {
  await upload(page);
  const id = (await snapshot(page)).workspace.files[0].id;
  expect((await request.delete(`/api/pdf/${id}`)).ok()).toBeTruthy();
  await page.getByRole('button', { name: '移除 three-pages.pdf', exact: true }).click();
  await page.getByRole('dialog', { name: /移除「three-pages.pdf」/ }).getByRole('button', { name: '移除', exact: true }).click();
  await expect(page.getByText('已移除「three-pages.pdf」。', { exact: true })).toBeVisible();
  expect((await snapshot(page)).workspace.files).toHaveLength(0);
});

test('split mode can turn every page into its own file', async ({ page }) => {
  await upload(page);
  await page.getByRole('button', { name: '拆分', exact: true }).click();
  const panel = page.getByRole('region', { name: '拆分設定' });
  await panel.getByRole('radio', { name: '每頁一個檔案', exact: true }).check();
  await expect(panel.getByText('自動拆成 3 個單頁檔案')).toBeVisible();
  await panel.getByRole('button', { name: '拆分', exact: true }).click();
  await expect(page.getByText(/已拆分為 3 個檔案/)).toBeVisible();
  const names = (await snapshot(page)).workspace.files.map((file: { name: string }) => file.name);
  expect(names).toEqual(expect.arrayContaining([
    'three-pages_p1.pdf',
    'three-pages_p2.pdf',
    'three-pages_p3.pdf',
  ]));
});

test('split files can be downloaded together as one ZIP', async ({ page }, testInfo) => {
  await upload(page);
  await page.getByRole('button', { name: '拆分', exact: true }).click();
  await page.getByRole('textbox', { name: '頁碼範圍', exact: true }).fill('1, 2-3');
  await page.getByRole('region', { name: '拆分設定' }).getByRole('button', { name: '拆分', exact: true }).click();
  await expect(page.getByText(/已拆分為 2 個檔案/)).toBeVisible();
  // The uploaded original is already selected; one action adds both generated files.
  await page.getByRole('tab', { name: '合併', exact: true }).click();
  await page.getByRole('button', { name: '全選檔案', exact: true }).click();
  await page.getByRole('tab', { name: '編輯', exact: true }).click();
  await page.getByRole('button', { name: '向右旋轉第 1 頁', exact: true }).click();
  await page.getByRole('tab', { name: '合併', exact: true }).click();
  const originalId = (await snapshot(page)).workspace.files[0].id;
  const bundleRequest = page.waitForRequest((req) => req.url().endsWith('/api/pdf/bundle'));
  await page.getByRole('button', { name: '另存為 ZIP（3 份）', exact: true }).click();
  expect((await bundleRequest).postDataJSON().files[0].id).not.toBe(originalId);
  await expect(page.getByRole('dialog', { name: '另存檔案' })).toBeVisible();
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: '下載', exact: true }).click();
  const download = await downloadEvent;
  await download.saveAs(testInfo.outputPath('bundle.zip'));
  expect(await download.failure()).toBeNull();
});

test('clear all removes every file after confirmation', async ({ page }) => {
  await upload(page);
  await page.locator('input[type=file]').first().setInputFiles(fixture);
  await expect(page.getByRole('button', { name: /^移除 / })).toHaveCount(2);
  await expect(page.getByText('處理中…', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '全部清除', exact: true }).click();
  await page.getByRole('dialog', { name: /清除全部 2 個檔案/ }).getByRole('button', { name: '全部清除', exact: true }).click();
  await expect(page.getByText('已移除全部 2 個檔案。', { exact: true })).toBeVisible();
  expect((await snapshot(page)).workspace.files).toHaveLength(0);
});
