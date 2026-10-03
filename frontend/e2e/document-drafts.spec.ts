import { test, expect, type Page } from '@playwright/test';

const pages = [1, 2, 3].map((pageNumber) => ({ pageNumber, width: 595, height: 842 }));
const edits = { baseline: [1, 2, 3], pages: pages.map(({ pageNumber }) => ({ pageNumber, rotation: 0 })), history: [] };
const read = (page: Page) => page.evaluate(() => JSON.parse(sessionStorage.getItem('pdf-editor.workspace.v1')!));

test.beforeEach(async ({ page }) => {
  await page.addInitScript(({ pages, edits }) => {
    if (sessionStorage.getItem('pdf-editor.workspace.v1')) return;
    sessionStorage.setItem('pdf-editor.workspace.v1', JSON.stringify({
      version: 1,
      workspace: { files: ['a', 'b'].map((id) => ({
        key: id, id, name: id + '.pdf', size: 123, pageCount: 3, history: [],
      })), currentKey: 'a', mergeSelection: [] },
      pages, edits,
    }));
  }, { pages, edits });
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.includes('/pages/')) {
      await route.fulfill({ json: { pages, pageCount: 3 } });
    } else if (url.pathname.endsWith('/apply-edits')) {
      const body = route.request().postDataJSON();
      await route.fulfill({ json: { newPdfId: body.pdfId + '-applied', pageCount: body.pages.length } });
    } else if (url.pathname.endsWith('/merge')) {
      await route.fulfill({ json: { newPdfId: 'merged', name: 'merged.pdf', pageCount: 6 } });
    } else {
      await route.fulfill({ status: 200, body: '' });
    }
  });
  await page.goto('/');
  await expect(page.getByText(/已恢復此分頁的工作區/)).toBeVisible();
});

test('switch and refresh retain independent drafts and undo histories', async ({ page }) => {
  const dialogs: string[] = [];
  page.on('dialog', async (dialog) => {
    if (dialog.type() === 'beforeunload') { await dialog.accept(); return; }
    dialogs.push(dialog.message()); await dialog.dismiss();
  });
  await page.getByRole('button', { name: '向右旋轉第 1 頁', exact: true }).click();
  await page.getByRole('button', { name: '刪除第 2 頁', exact: true }).click();
  const a = (await read(page)).edits;
  await page.getByRole('button', { name: 'b.pdf', exact: true }).click();
  await expect(page.getByText('頁面預覽 (3 頁)', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '向左旋轉第 3 頁', exact: true }).click();
  const b = (await read(page)).edits;
  await page.getByRole('button', { name: 'a.pdf', exact: true }).click();
  await expect(page.getByText('頁面預覽 (2 頁)', { exact: true })).toBeVisible();
  expect((await read(page)).edits).toEqual(a);
  expect(dialogs).toEqual([]);
  await page.reload();
  await expect(page.getByText(/已恢復此分頁的工作區/)).toBeVisible();
  expect((await read(page)).edits).toEqual(a);
  await page.getByRole('button', { name: '復原頁面編輯', exact: true }).click();
  await expect(page.getByText('頁面預覽 (3 頁)', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'b.pdf', exact: true }).click();
  await expect.poll(async () => (await read(page)).workspace.currentKey).toBe('b');
  expect((await read(page)).edits).toEqual(b);
  await page.getByRole('button', { name: '復原頁面編輯', exact: true }).click();
  expect((await read(page)).edits.pages[2].rotation).toBe(0);
});

test('merge applies drafts of both current and background documents', async ({ page }) => {
  await page.getByRole('button', { name: '向右旋轉第 1 頁', exact: true }).click();
  await page.getByRole('button', { name: 'b.pdf', exact: true }).click();
  await expect.poll(async () => (await read(page)).workspace.currentKey).toBe('b');
  await page.getByRole('button', { name: '刪除第 2 頁', exact: true }).click();
  const applied: string[] = [];
  page.on('request', (request) => {
    if (request.url().endsWith('/apply-edits')) applied.push(request.postDataJSON().pdfId);
  });
  await page.getByRole('tab', { name: '合併 PDF', exact: true }).click();
  await page.getByRole('button', { name: '全選檔案', exact: true }).click();
  const merged = page.waitForRequest('**/api/pdf/merge');
  await page.getByRole('button', { name: '合併 PDF', exact: true }).click();
  const request = await merged;
  expect(applied).toEqual(['a', 'b']);
  expect(request.postData()).toContain('a-applied');
  expect(request.postData()).toContain('b-applied');
  await expect(page.getByText('PDF 合併成功！', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: '編輯 PDF', exact: true }).click();
  await page.getByRole('button', { name: 'a.pdf', exact: true }).click();
  await expect.poll(async () => (await read(page)).workspace.currentKey).toBe('a');
  await page.getByRole('button', { name: '復原上一步', exact: true }).click();
  await expect.poll(async () => (await read(page)).workspace.files[0].id).toBe('a');
  expect((await read(page)).edits).toEqual(edits);
});

test('failed background apply stops ZIP output and retains its draft', async ({ page }) => {
  await page.getByRole('button', { name: '向右旋轉第 1 頁', exact: true }).click();
  await page.getByRole('button', { name: 'b.pdf', exact: true }).click();
  await expect.poll(async () => (await read(page)).workspace.currentKey).toBe('b');
  await page.route('**/api/pdf/apply-edits', (route) => route.fulfill({
    status: 500, json: { detail: '模擬背景套用失敗' },
  }));
  let bundles = 0;
  page.on('request', (request) => {
    if (request.url().endsWith('/bundle')) bundles++;
  });
  await page.getByRole('tab', { name: '合併 PDF', exact: true }).click();
  await page.getByRole('button', { name: '全選檔案', exact: true }).click();
  await page.getByRole('button', { name: '下載選取 ZIP (2)', exact: true }).click();
  await expect(page.getByText('模擬背景套用失敗', { exact: true })).toBeVisible();
  expect(bundles).toBe(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('tab', { name: '編輯 PDF', exact: true }).click();
  await page.getByRole('button', { name: 'a.pdf', exact: true }).click();
  await expect.poll(async () => (await read(page)).workspace.currentKey).toBe('a');
  expect((await read(page)).edits.pages[0].rotation).toBe(90);
});

test('merge tab preserves editor state, validates ranges and sends the chosen order', async ({ page }) => {
  await page.getByRole('button', { name: '向右旋轉第 1 頁', exact: true }).click();
  const draft = (await read(page)).edits;
  await page.getByRole('tab', { name: '合併 PDF', exact: true }).click();
  await page.getByRole('button', { name: '全選檔案', exact: true }).click();
  await page.getByRole('button', { name: '上移 b.pdf', exact: true }).click();
  await page.getByRole('textbox', { name: 'b.pdf 的頁碼範圍', exact: true }).fill('4');
  await expect(page.getByRole('button', { name: '合併 PDF', exact: true })).toBeDisabled();
  await page.getByRole('textbox', { name: 'b.pdf 的頁碼範圍', exact: true }).fill('2-3');
  await page.getByRole('textbox', { name: '合併後的檔案名稱' }).fill('整理結果');
  await page.getByRole('tab', { name: '編輯 PDF', exact: true }).click();
  expect((await read(page)).edits).toEqual(draft);
  await expect(page.getByRole('button', { name: '全選檔案' })).toHaveCount(0);
  await page.getByRole('tab', { name: '合併 PDF', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'b.pdf 的頁碼範圍', exact: true })).toHaveValue('2-3');
  await expect(page.getByText('已選取 2 份 PDF，合併後 5 頁', { exact: true })).toBeVisible();
  await page.route('**/api/pdf/extract', async (route) => {
    expect(route.request().postDataJSON()).toEqual({ pdfId: 'b', pages: [{ pageNumber: 2, rotation: 0 }, { pageNumber: 3, rotation: 0 }] });
    await route.fulfill({ json: { files: [{ id: 'b-range', pageCount: 2, size: 100 }] } });
  });
  const merge = page.waitForRequest('**/api/pdf/merge');
  await page.getByRole('button', { name: '合併 PDF', exact: true }).click();
  const body = (await merge).postData()!;
  expect(body.indexOf('b-range')).toBeLessThan(body.indexOf('a-applied'));
  await expect(page.getByRole('button', { name: '編輯合併結果' })).toBeVisible();
  expect((await read(page)).workspace.currentKey).toBe('a');
  expect((await read(page)).workspace.files.at(-1).name).toBe('整理結果.pdf');
  await page.getByRole('button', { name: '編輯合併結果' }).click();
  await expect(page.getByRole('tab', { name: '編輯 PDF' })).toHaveAttribute('aria-selected', 'true');
  await expect.poll(async () => (await read(page)).workspace.currentKey).toBe('merged');
});
