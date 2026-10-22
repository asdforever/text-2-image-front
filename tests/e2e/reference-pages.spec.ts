import { expect, test } from "playwright/test";

const now = "2026-10-14T00:00:00Z";
const projects = Array.from({ length: 14 }, (_, i) => ({ id: `p-${i}`, name: `鼠标项目 ${i + 1}`, status: i === 13 ? "archived" : "active", createdAt: now, updatedAt: now, assetCount: i + 1, coverAssetId: null }));

test("项目筛选与分页组合使用，切换条件重置页码，手机操作可见", async ({ page }, testInfo) => {
  await page.route(url => url.pathname === "/api/projects", route => route.fulfill({ json: { data: projects } }));
  await page.goto("/projects");
  await expect(page.locator('.reference-management-card')).toHaveCount(12);
  await page.getByRole("button", { name: "下一页", exact: true }).click();
  await expect(page.locator('.reference-management-card')).toHaveCount(2);
  await page.getByRole("combobox", { name: "项目状态", exact: true }).selectOption('archived');
  await expect(page.locator('.reference-management-card')).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "鼠标项目 14", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "归档", exact: true })).toBeDisabled();
  await page.getByRole("combobox", { name: "项目状态", exact: true }).selectOption('all');
  await page.getByRole("textbox", { name: "搜索项目", exact: true }).fill('鼠标项目 2');
  await expect(page.locator('.reference-management-card')).toHaveCount(1);
  await expect(page.getByRole("button", { name: "上一页", exact: true })).toBeDisabled();
  await page.getByRole("textbox", { name: "搜索项目", exact: true }).fill('');
  await page.screenshot({ path: testInfo.outputPath('projects-desktop.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("button", { name: "删除", exact: true }).first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: testInfo.outputPath('projects-mobile.png') });
});

test("任务搜索保留真实进度和错误，进入对应模块，手机无溢出", async ({ page }, testInfo) => {
  await page.route('**/api/task-center', route => route.fulfill({ json: { data: { projects: [
    { projectId: 'p-0', projectName: '无线鼠标', projectStatus: 'active', updatedAt: now, tasks: [{ id: 't-0', projectId: 'p-0', projectName: '无线鼠标', type: 'hero', status: 'running', phase: 'running', source: 'generation_batch', workbenchTab: 'hero', createdAt: now, updatedAt: now, progress: { total: 5, succeeded: 2, failed: 1, cancelled: 0 }, error: null }] },
    { projectId: 'p-1', projectName: '键盘详情', projectStatus: 'active', updatedAt: now, tasks: [{ id: 't-1', projectId: 'p-1', projectName: '键盘详情', type: 'suite', status: 'failed', phase: 'failed', source: 'generation_batch', workbenchTab: 'suite', createdAt: now, updatedAt: now, progress: { total: 3, succeeded: 0, failed: 3, cancelled: 0 }, error: { code: 'PROVIDER_ERROR', message: '服务暂时不可用，请稍后重试' } }] },
  ] } } }));
  await page.goto('/tasks');
  await expect(page.getByRole('progressbar', { name: '主图生成进度' })).toHaveAttribute('aria-valuenow', '2');
  await expect(page.getByText('失败 1 张', { exact: true })).toBeVisible();
  await page.getByRole('searchbox', { name: '搜索任务项目' }).fill('键盘');
  await expect(page.getByRole('region', { name: '项目 无线鼠标' })).toHaveCount(0);
  await expect(page.getByText('服务暂时不可用，请稍后重试', { exact: true })).toBeVisible();
  await page.getByRole('searchbox', { name: '搜索任务项目' }).fill('');
  await page.screenshot({ path: testInfo.outputPath('tasks-desktop.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: testInfo.outputPath('tasks-mobile.png') });
  await page.getByRole('region', { name: '项目 键盘详情' }).getByRole('button', { name: '进入项目' }).click();
  await expect(page).toHaveURL(/projects\/p-1\?tab=suite$/);
});
