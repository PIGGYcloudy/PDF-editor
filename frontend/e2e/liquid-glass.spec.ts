import { test, expect } from '@playwright/test';
import path from 'node:path';

const fixture = path.resolve('e2e/fixtures/three-pages.pdf');

test.afterEach(async ({ page, request }) => {
  const ids = await page.evaluate(() => {
    const state = JSON.parse(sessionStorage.getItem('pdf-editor.workspace.v1') ?? 'null');
    return (state?.workspace.files ?? []).flatMap((file: { id: string; history: { id: string }[] }) =>
      [file.id, ...file.history.map((version) => version.id)]) as string[];
  }).catch(() => [] as string[]);
  await Promise.all([...new Set(ids)].map((id) => request.delete(`/api/pdf/${id}`)));
});

test('optional help supports keyboard dismissal, focus return and persistent readability preference', async ({ page }, info) => {
  await page.goto('/');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('welcome-desktop.png'), fullPage: true });
  const help = page.getByRole('button', { name: '使用說明' });
  await help.click();
  const dialog = page.getByRole('dialog', { name: '使用說明' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('checkbox', { name: '降低透明度' }).check();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(help).toBeFocused();
  await expect(page.locator('header')).toHaveCSS('backdrop-filter', 'none');
  await page.reload();
  await expect(page.locator('header')).toHaveCSS('backdrop-filter', 'none');
  await help.click();
  await expect(dialog.getByRole('checkbox', { name: '降低透明度' })).toBeChecked();
  await page.screenshot({ path: info.outputPath('help-desktop.png'), fullPage: true });
});

test('upload is reachable from the keyboard without mandatory onboarding', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: '跳到工作區' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
  const upload = page.getByRole('button', { name: '選擇 PDF 或圖片' });
  await upload.focus();
  const chooserEvent = page.waitForEvent('filechooser');
  await page.keyboard.press('Enter');
  await (await chooserEvent).setFiles(fixture);
  await expect(page.getByText('頁面 (3)', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '另存 PDF', exact: true })).toBeEnabled();
});

test('small screens keep page actions and pending-edit controls within the viewport', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.screenshot({ path: info.outputPath('welcome-mobile.png'), fullPage: true });
  await page.locator('input[type=file]').first().setInputFiles(fixture);
  await expect(page.getByText('頁面 (3)', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '向右旋轉第 1 頁', exact: true }).click();
  await page.getByRole('button', { name: '全選', exact: true }).click();
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const rotate = await page.getByRole('button', { name: '向右旋轉第 1 頁', exact: true }).boundingBox();
    expect(rotate!.width).toBeGreaterThanOrEqual(44);
    expect(rotate!.height).toBeGreaterThanOrEqual(44);
    const thumbnail = await page.getByRole('img', { name: '第 1 頁縮圖', exact: true }).boundingBox();
    expect(rotate!.y + rotate!.height).toBeLessThanOrEqual(thumbnail!.y);
    const apply = await page.getByRole('button', { name: '套用變更', exact: true }).boundingBox();
    expect(apply!.x).toBeGreaterThanOrEqual(0);
    expect(apply!.x + apply!.width).toBeLessThanOrEqual(width);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: info.outputPath('editor-mobile.png'), fullPage: true });
  await page.getByRole('button', { name: '使用說明' }).click();
  await expect(page.getByRole('dialog', { name: '使用說明' })).toBeVisible();
  await page.keyboard.press('Delete');
  await page.keyboard.press('Escape');
  await expect(page.getByText('頁面 (3)', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '另存 PDF', exact: true })).toBeEnabled();
});

test('system contrast and reduced-motion preferences preserve a readable interface', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce', contrast: 'more' });
  await page.goto('/');
  await expect(page.locator('header')).toHaveCSS('backdrop-filter', 'none');
  await expect(page.getByRole('button', { name: '使用說明' })).toHaveCSS('transition-duration', '1e-05s');
  await page.getByRole('button', { name: '使用說明' }).click();
  await expect(page.getByRole('dialog', { name: '使用說明' })).toBeVisible();
  await page.getByRole('button', { name: '完成' }).click();
  await expect(page.getByRole('button', { name: '選擇 PDF 或圖片' })).toBeVisible();
});

test('blocked preference storage does not prevent upload or readability adjustments', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Blocked', 'SecurityError'); } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: '使用說明' }).click();
  await page.getByRole('checkbox', { name: '降低透明度' }).check();
  await page.getByRole('button', { name: '完成' }).click();
  await expect(page.locator('header')).toHaveCSS('backdrop-filter', 'none');
  await page.locator('input[type=file]').first().setInputFiles(fixture);
  await expect(page.getByText('頁面 (3)', { exact: true })).toBeVisible();
});
