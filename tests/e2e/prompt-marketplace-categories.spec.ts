import { expect, test } from "playwright/test";

test("browses and renames custom prompt categories", async ({ page }) => {
  const category = { id: "cat-hero", name: "主图", sortOrder: 0, templateCount: 1, createdAt: "2026-09-13T00:00:00Z", updatedAt: "2026-09-13T00:00:00Z" };
  const categories = [category];
  const templates = [
    { id: "prompt-hero", code: "hero.sales", name: "主图卖点", kind: "text_to_image", kindName: "文生图", categoryId: "cat-hero", categoryName: "主图", defaultVersionId: null, defaultVersion: null, versionCount: 0, createdAt: category.createdAt, updatedAt: category.updatedAt, templateId: "prompt-hero", templateVersionId: "", versionNo: 0, inputSchema: [], applicability: {} },
    { id: "prompt-detail", code: "suite.detail", name: "详情规划", kind: "text_to_text", kindName: "文生文", categoryId: null, categoryName: null, defaultVersionId: null, defaultVersion: null, versionCount: 0, createdAt: category.createdAt, updatedAt: category.updatedAt, templateId: "prompt-detail", templateVersionId: "", versionNo: 0, inputSchema: [], applicability: {} },
  ];

  await page.route("**/api/prompt-categories**", async (route) => {
    if (route.request().method() === "GET") return route.fulfill({ json: { data: categories } });
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON() as { name: string };
      const created = { ...category, id: "cat-new", name: body.name, templateCount: 0 };
      categories.push(created);
      return route.fulfill({ status: 201, json: { data: created } });
    }
    if (route.request().method() === "PATCH") {
      const body = route.request().postDataJSON() as { name: string };
      category.name = body.name;
      return route.fulfill({ json: { data: category } });
    }
    return route.fulfill({ json: { data: { id: category.id, affectedTemplateCount: 1 } } });
  });
  await page.route("**/api/prompt-templates", (route) => route.fulfill({ json: { data: templates } }));

  await page.goto("/prompts");
  await expect(page.getByText("提示词商城").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "详情规划" })).toBeVisible();
  await expect(page.getByText(/^(图生图|文生图|文生文|图生文)$/)).toHaveCount(0);
  await page.getByRole("button", { name: "新建提示词", exact: true }).click();
  const createDialog = page.getByRole("dialog", { name: "新建提示词" });
  await expect(createDialog.getByRole("combobox", { name: "业务分类", exact: true })).toBeVisible();
  await expect(createDialog.getByRole("combobox", { name: "类型", exact: true })).toHaveCount(0);
  await createDialog.getByRole("button", { name: "取消", exact: true }).click();
  await page.getByRole("button", { name: /主图/ }).first().click();
  await expect(page.getByRole("heading", { name: "主图卖点" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "详情规划" })).toHaveCount(0);

  await page.getByRole("button", { name: "分类管理" }).click();
  await expect(page.getByRole("dialog", { name: "分类管理" })).toBeVisible();
  const nameInput = page.getByRole("textbox", { name: "编辑分类 主图" });
  await nameInput.fill("主图新版");
  await page.getByRole("button", { name: "保存重命名" }).click();
  await expect(page.getByText("主图新版")).toBeVisible();
});

test("detail selection shows pending state, ignores stale responses, and retries locally", async ({ page }) => {
  const createdAt = "2026-09-24T00:00:00Z";
  const makeTemplate = (id: string, name: string) => ({ id, code: `prompt.${id}`, name, kind: "text_to_text", kindName: "文生文", categoryId: null, categoryName: null, defaultVersionId: `${id}-v1`, defaultVersion: { id: `${id}-v1`, templateId: id, versionNo: 1, name, kind: "text_to_text", executionTarget: "llm", body: `${name} body`, userPromptTemplate: "", inputSchema: [], outputSchema: {}, applicability: {}, generationParams: {}, contentSha256: "a".repeat(64), source: "marketplace", createdBy: "test", createdAt }, versionCount: 1, createdAt, updatedAt: createdAt, templateId: id, templateVersionId: `${id}-v1`, versionNo: 1, inputSchema: [], applicability: {} });
  const slow = makeTemplate("slow", "慢响应模板");
  const fast = makeTemplate("fast", "快速模板");
  const retry = makeTemplate("retry", "重试模板");
  let releaseSlow!: () => void;
  const slowGate = new Promise<void>((resolve) => { releaseSlow = resolve; });
  let retryCalls = 0;
  const detailReads = new Map<string, number>();

  await page.route("**/api/prompt-categories", (route) => route.fulfill({ json: { data: [] } }));
  await page.route("**/api/prompt-templates", (route) => route.fulfill({ json: { data: [slow, fast, retry] } }));
  await page.route("**/api/prompt-templates/*", async (route) => {
    const id = new URL(route.request().url()).pathname.split("/").at(-1)!;
    const template = id === slow.id ? slow : id === fast.id ? fast : retry;
    if (route.request().method() === "PATCH") {
      Object.assign(template, route.request().postDataJSON());
      return route.fulfill({ json: { data: { data: { ...template, versions: [template.defaultVersion] } } } });
    }
    detailReads.set(id, (detailReads.get(id) ?? 0) + 1);
    if (id === slow.id) await slowGate;
    if (id === retry.id && retryCalls++ === 0) return route.fulfill({ status: 503, json: { error: { message: "详情暂时不可用" } } });
    await route.fulfill({ json: { data: { ...template, versions: [template.defaultVersion] } } });
  });

  try {
    await page.goto("/prompts");
    await page.locator(".prompt-card", { hasText: slow.name }).getByRole("heading", { name: slow.name }).click();
    await expect(page.getByText("正在加载提示词详情...", { exact: true })).toBeVisible();
    await page.locator(".prompt-card", { hasText: fast.name }).getByRole("heading", { name: fast.name }).click();
    await expect(page.locator(".prompt-detail-panel").getByText(`${fast.code}`).first()).toBeVisible();
    releaseSlow();
    await expect(page.locator(".prompt-detail-panel").getByText(`${fast.code}`).first()).toBeVisible();
    await expect(page.locator(".prompt-detail-panel").getByText(`${slow.code}`)).toHaveCount(0);

    await page.locator(".prompt-card", { hasText: retry.name }).getByRole("heading", { name: retry.name }).click();
    await expect(page.locator(".prompt-detail-panel").getByRole("alert")).toContainText("详情暂时不可用");
    await page.locator(".prompt-detail-panel").getByRole("button", { name: "重试", exact: true }).click();
    await expect(page.locator(".prompt-detail-panel").getByText(`${retry.code}`).first()).toBeVisible();

    await page.locator(".prompt-detail-panel").getByRole("button", { name: "编辑基本信息", exact: true }).click();
    await page.locator(".prompt-detail-panel .prompt-info-section", { hasText: "名称" }).getByRole("textbox").fill("重试模板新版");
    await page.locator(".prompt-detail-panel").getByRole("button", { name: "保存", exact: true }).click();
    await expect.poll(() => detailReads.get(retry.id)).toBe(3);
    await expect(page.locator(".prompt-detail-panel").getByText("重试模板新版", { exact: true }).first()).toBeVisible();
  } finally {
    releaseSlow();
  }
});
