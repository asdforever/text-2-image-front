import { test, expect, type Page } from "playwright/test";
const now = "2026-09-25T08:00:00Z";
const reference = { id: "ref-one", ordinal: 1, filename: "充电器参考.jpg", width: 900, height: 1200, mimeType: "image/jpeg", previewUrl: "/assets/gan65-product.jpg" };
const module = { id: "mod-one", title: "首屏主视觉", referenceImageId: "ref-one", goal: "建立商品识别", layout: "左侧商品，右侧留白", informationHierarchy: "商品 → 标题 → 卖点", typography: "简洁无衬线", colorAndLighting: "灰白与柔光", adaptationNotes: "替换为当前商品，不沿用竞品数值" };
const overall = { contentFlow: "商品识别 → 细节 → 场景", visualSystem: "灰白背景与侧光", moduleStrategy: "首屏与细节互补", adaptationRules: "只迁移设计方法，不复制竞品参数" };
const draft = { id: "reverse-one", name: "数码配件参考", category: "数码", summary: "用清晰细节解释产品价值", suitableFor: "数码配件", goal: "降低购买疑虑", requiredMaterials: "清晰商品图与已确认规格", notSuitableFor: "人物叙事", references: [reference], overall, modules: [module], revision: 3, analysis: { status: "completed" }, versions: [], latestVersionId: null, createdAt: now, updatedAt: now };

async function setup(page: Page, options: { conflict?: boolean; published?: boolean; analysisFailure?: boolean } = {}) {
  let project = structuredClone(draft) as typeof draft & { versions: { id: string; versionNo: number; createdAt: string; revision: number }[]; latestVersionId: string | null };
  const versions: Record<string, unknown> = {};
  const bindings: Record<string, unknown>[] = [];
  const calls: { bindings: unknown[]; analyzes: number } = { bindings: [], analyzes: 0 };
  function publish() {
    const version = { id: "version-one", versionNo: 1, createdAt: now, revision: project.revision, reverseProjectId: project.id, document: structuredClone(project) };
    project.versions = [{ id: version.id, versionNo: 1, createdAt: now, revision: project.revision }]; project.latestVersionId = version.id; versions[version.id] = version; return version;
  }
  if (options.published) publish();
  await page.route("**/api/**", async route => {
    const request = route.request(); const path = new URL(request.url()).pathname; const method = request.method();
    if (!path.startsWith("/api/")) return route.continue();
    const send = (data: unknown) => route.fulfill({ json: { data } });
    if (path === "/api/reverse-projects") {
      if (method === "POST") { project = { ...project, ...request.postDataJSON(), references: [], modules: [], overall: { contentFlow: "", visualSystem: "", moduleStrategy: "", adaptationRules: "" } }; return send(project); }
      return send([project]);
    }
    if (path === "/api/reverse-projects/reverse-one") {
      if (method === "PATCH") {
        if (options.conflict) return route.fulfill({ status: 409, json: { error: { message: "项目已更新，请刷新后再保存" } } });
        const { expectedRevision, ...patch } = request.postDataJSON(); expect(expectedRevision).toBe(project.revision); project = { ...project, ...patch, revision: project.revision + 1 };
      }
      return send(project);
    }
    if (path.endsWith("/references") && method === "POST") { project = { ...project, references: [reference], revision: project.revision + 1 }; return send(project); }
    if (path.endsWith("/analyze")) {
      calls.analyzes++;
      if (options.analysisFailure && calls.analyzes === 1) return route.fulfill({ status: 503, json: { error: { message: "模型暂时不可用，草稿已保留" } } });
      project = { ...project, overall, modules: [module], revision: project.revision + 1 }; return send(project);
    }
    if (path.endsWith("/versions") && method === "POST") return send(publish());
    if (path.endsWith("/versions/version-one")) return send(versions["version-one"]);
    if (path.endsWith("/bindings")) return send(bindings);
    if (path === "/api/projects") return send([{ id: "business-one", name: "65W 充电器", status: "active", createdAt: now, updatedAt: now }]);
    if (path === "/api/projects/business-one/reverse-bindings") {
      if (method === "PUT") {
        const input = request.postDataJSON(); calls.bindings.push(input);
        const binding = { ...input, id: "binding-one", projectId: "business-one", projectName: "65W 充电器", reverseProjectId: project.id, reverseProjectName: project.name, versionNo: 1, sourceModuleId: null, sourceModuleTitle: null, targetModuleId: null, createdAt: now };
        bindings.push(binding); return send(binding);
      }
      return send(bindings);
    }
    return route.fulfill({ status: 404, json: { error: { message: "没有此测试资源" } } });
  });
  return calls;
}

test("反推项目列表可搜索并进入整套参考工作台", async ({ page }) => {
  await setup(page);
  await page.goto("/reverse-projects");
  await expect(page.getByRole("heading", { name: "反推项目", exact: true })).toBeVisible();
  await page.getByPlaceholder("搜索名称、品类或适用商品").fill("没有的项目");
  await expect(page.getByText("没有匹配的反推项目")).toBeVisible();
  await page.getByPlaceholder("搜索名称、品类或适用商品").fill("数码");
  await page.getByRole("link", { name: /数码配件参考.*查看反推项目/ }).click();
  await expect(page.getByRole("tab", { name: "参考套图" })).toBeVisible();
  await expect(page.getByRole("img", { name: "充电器参考.jpg" })).toBeVisible();
});

test("发布后将固定版本绑定到详情套图并保留绑定记录", async ({ page }) => {
  const calls = await setup(page);
  await page.goto("/reverse-projects/reverse-one");
  await page.getByRole("button", { name: "发布版本", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("v1");
  await page.getByRole("button", { name: "绑定到业务项目", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "绑定到业务项目" });
  await dialog.getByLabel("业务项目", { exact: true }).selectOption("business-one");
  await dialog.getByLabel("详情套图工作台").check();
  await dialog.getByRole("button", { name: "确认绑定" }).click();
  await expect(page.getByRole("tab", { name: "绑定记录" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByLabel("绑定记录列表")).toContainText("65W 充电器");
  await expect(page.getByLabel("绑定记录列表")).toContainText("详情套图");
  expect(calls.bindings).toEqual([{ target: "suite", scope: "overall", versionId: "version-one" }]);
  await page.reload();
  await page.getByRole("tab", { name: "绑定记录" }).click();
  await expect(page.getByLabel("绑定记录列表")).toContainText("v1");
});

test("保存冲突保留未保存内容，不显示保存成功", async ({ page }) => {
  await setup(page, { conflict: true });
  await page.goto("/reverse-projects/reverse-one");
  await page.getByRole("button", { name: "编辑项目", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "编辑反推项目" });
  await dialog.getByLabel("项目简介").fill("保留我的修改");
  await dialog.getByRole("button", { name: "保存项目" }).click();
  await expect(dialog.getByRole("alert")).toContainText("刷新");
  await expect(dialog.getByLabel("项目简介")).toHaveValue("保留我的修改");
});

test("新建上传后反推失败保留原图，重试成功后可发布", async ({ page }) => {
  const calls = await setup(page, { analysisFailure: true });
  await page.goto("/reverse-projects");
  await page.getByRole("button", { name: "新建反推项目", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("项目名称").fill("新建数码参考");
  await dialog.getByRole("button", { name: "创建并上传参考图" }).click();
  await page.getByLabel("上传参考套图").setInputFiles("public/assets/gan65-product.jpg");
  await expect(page.getByLabel("参考图上传状态")).toContainText("已保存");
  await page.getByRole("button", { name: "开始整套反推", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("草稿已保留");
  await expect(page.getByRole("img", { name: "充电器参考.jpg", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "开始整套反推", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("整套反推已完成");
  expect(calls.analyzes).toBe(2);
  await page.getByRole("button", { name: "发布版本", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("已发布 v1");
});

test("切换模块绑定工作台后可选择已有任务，不被旧请求锁住", async ({ page }) => {
  await setup(page, { published: true });
  await page.addInitScript(() => localStorage.setItem("picagent-project-store", JSON.stringify({ state: { generationDrafts: {
    "business-one:suite": { config: { selectedModuleIds: ["suite-hero"], moduleTypes: {} }, updatedAt: "2026-09-25" },
  } }, version: 0 })));
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/projects/business-one/module-plans/latest?mode=hero", async route => {
    await pending;
    await route.fulfill({ status: 404, json: { error: { code: "MODULE_PLAN_NOT_FOUND", message: "还没有规划" } } });
  });
  await page.goto("/reverse-projects/reverse-one?tab=modules");
  await page.getByRole("button", { name: "绑定这个模块", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "绑定到业务项目" });
  try {
    await dialog.getByLabel("业务项目", { exact: true }).selectOption("business-one");
    await expect(dialog.getByLabel("目标图片任务")).toBeDisabled();
    await dialog.getByLabel("详情套图工作台").check();
    await expect(dialog.getByLabel("目标图片任务")).toBeEnabled();
    await dialog.getByLabel("目标图片任务").selectOption("suite-hero");
    await expect(dialog.getByRole("button", { name: "确认绑定" })).toBeEnabled();
  } finally { release(); }
});
