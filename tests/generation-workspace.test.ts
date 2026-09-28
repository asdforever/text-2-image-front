import assert from "node:assert/strict";
import test from "node:test";

async function loadGenerationModule() {
  return import("../src/lib/generation-workspace").catch(() => ({}));
}

test("generation catalog exposes the complete hero and suite module choices", async () => {
  const generation = await loadGenerationModule() as Record<string, unknown>;
  const heroModules = generation.HERO_MODULES as Array<{ id: string; label: string }> | undefined;
  const suiteModules = generation.SUITE_MODULES as Array<{ id: string; label: string }> | undefined;

  assert.equal(heroModules?.length, 8);
  assert.deepEqual(heroModules?.map((item) => item.label), [
    "首屏 KV", "整体展示", "细节特写", "使用场景", "多色套装", "功能对比", "包装展示", "权益保障",
  ]);
  assert.equal(suiteModules?.length, 18);
  assert.deepEqual(suiteModules?.slice(-4).map((item) => item.label), ["售后保障图", "使用建议图", "买家秀", "博主推荐图"]);

  const ids = [...(heroModules ?? []), ...(suiteModules ?? [])].map((item) => item.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("style catalog covers every required category with usable descriptions", async () => {
  const generation = await loadGenerationModule() as Record<string, unknown>;
  const categories = generation.STYLE_CATEGORIES as Array<{ id: string; label: string; styles: Array<{ id: string; label: string; description: string }> }> | undefined;

  assert.deepEqual(categories?.map((item) => item.label), [
    "基础风格", "科技数码", "居家生活", "自然清新", "品质奢华", "潮流文化", "人群主题",
  ]);
  assert.ok(categories?.every((category) => category.styles.length >= 3));
  assert.ok(categories?.flatMap((category) => category.styles).every((style) => style.description.length >= 6));
});

test("configuration normalization fills mode defaults without overwriting a legacy draft", async () => {
  const generation = await loadGenerationModule() as Record<string, unknown>;
  const normalizeHeroConfig = generation.normalizeHeroConfig as ((value?: Record<string, unknown>) => Record<string, unknown>) | undefined;
  const normalizeSuiteConfig = generation.normalizeSuiteConfig as ((value?: Record<string, unknown>) => Record<string, unknown>) | undefined;

  assert.deepEqual(normalizeHeroConfig?.({ designBrief: "保留产品真实结构" }), {
    selectedAssetIds: [], outputLanguage: "中文", market: "taobao", model: "GPT Image 2.5",
    aspectRatio: "1:1", resolution: "标准 1K", styleId: null, customStyle: "", selectedModuleIds: [],
    moduleParameters: {}, moduleCounts: {}, designBrief: "保留产品真实结构", planningBrief: "保留产品真实结构",
  });
  assert.deepEqual(normalizeSuiteConfig?.({ creativePrompt: "第 1 张展示核心卖点" }), {
    selectedAssetIds: [], outputLanguage: "中文", market: "taobao", model: "GPT Image 2.5",
    aspectRatio: "3:4", resolution: "标准 1K", styleId: null, customStyle: "", selectedModuleIds: [],
    moduleParameters: {}, moduleCounts: {}, creativePrompt: "第 1 张展示核心卖点", planningBrief: "第 1 张展示核心卖点",
  });
});

test("module parameter presets cover scene modules and compact blank rows", async () => {
  const generation = await loadGenerationModule() as Record<string, unknown>;
  const getModuleParameterPresets = generation.getModuleParameterPresets as ((moduleId: string) => Array<{ key: string; value: string }>) | undefined;
  const compactModuleParameters = generation.compactModuleParameters as ((parameters: Array<{ key: string; value: string }>) => Array<{ key: string; value: string }>) | undefined;

  assert.ok(getModuleParameterPresets?.("suite-scene")?.some((item) => item.key === "场景地点"));
  assert.deepEqual(compactModuleParameters?.([{ key: " ", value: "x" }, { key: "DPI ", value: " 1600 " }]), [{ key: "DPI", value: "1600" }]);
});

test("module parameter lookup returns only the current module's non-empty rows", async () => {
  const generation = await loadGenerationModule() as Record<string, unknown>;
  const getCompactModuleParameters = generation.getCompactModuleParameters as ((parameters: Record<string, Array<{ key: string; value: string }>>, moduleId: string) => Array<{ key: string; value: string }>) | undefined;

  assert.deepEqual(getCompactModuleParameters?.({ "suite-scene": [{ key: "场景地点", value: "办公桌" }, { key: "", value: "忽略" }], "suite-hero": [{ key: "首要信息", value: "快充" }] }, "suite-scene"), [{ key: "场景地点", value: "办公桌" }]);
});

test("configuration normalization preserves a custom style description", async () => {
  const generation = await loadGenerationModule() as Record<string, unknown>;
  const normalizeHeroConfig = generation.normalizeHeroConfig as ((value?: Record<string, unknown>) => Record<string, unknown>) | undefined;
  const normalizeSuiteConfig = generation.normalizeSuiteConfig as ((value?: Record<string, unknown>) => Record<string, unknown>) | undefined;

  assert.equal(normalizeHeroConfig?.({ styleId: "style-custom", customStyle: "电影感硬光" }).customStyle, "电影感硬光");
  assert.equal(normalizeSuiteConfig?.({ styleId: "style-custom", customStyle: "电影感硬光" }).customStyle, "电影感硬光");
});

test("style resolution keeps custom text separate from the display label", async () => {
  const generation = await loadGenerationModule() as Record<string, unknown>;
  const getStyleLabel = generation.getStyleLabel as ((styleId: string | null, customStyle?: string) => string) | undefined;
  const getStylePrompt = generation.getStylePrompt as ((styleId: string | null, customStyle?: string) => string) | undefined;

  assert.equal(getStyleLabel?.("style-custom", "电影感硬光"), "自定义");
  assert.equal(getStylePrompt?.("style-custom", " 电影感硬光 "), "电影感硬光");
  assert.equal(getStylePrompt?.("precision"), "冷静背景与理性参数秩序");
});

test("hero validation enforces asset and module boundaries", async () => {
  const generation = await loadGenerationModule() as Record<string, unknown>;
  const normalizeHeroConfig = generation.normalizeHeroConfig as (() => Record<string, unknown>) | undefined;
  const validateHeroConfig = generation.validateHeroConfig as ((value: Record<string, unknown>) => string[]) | undefined;
  const base = normalizeHeroConfig?.() ?? {};

  assert.deepEqual(validateHeroConfig?.(base), ["请至少选择 1 张产品素材", "请至少选择 1 个主图模块"]);
  assert.deepEqual(validateHeroConfig?.({ ...base, selectedAssetIds: Array.from({ length: 9 }, (_, index) => `a-${index}`), selectedModuleIds: ["hero-kv"] }), ["主图最多选择 8 张产品素材"]);
});

test("suite validation permits the complete published module catalog", async () => {
  const generation = await loadGenerationModule() as Record<string, unknown>;
  const normalizeSuiteConfig = generation.normalizeSuiteConfig as (() => Record<string, unknown>) | undefined;
  const validateSuiteConfig = generation.validateSuiteConfig as ((value: Record<string, unknown>) => string[]) | undefined;
  const base = normalizeSuiteConfig?.() ?? {};

  assert.deepEqual(validateSuiteConfig?.({ ...base, selectedAssetIds: ["asset-1"], selectedModuleIds: ["suite-hero", "suite-benefit", "suite-scene", "suite-angle", "suite-mood"] }), []);
  assert.deepEqual(validateSuiteConfig?.({ ...base, selectedAssetIds: ["asset-1"], selectedModuleIds: ["suite-hero", "suite-benefit", "suite-scene", "suite-angle", "suite-mood", "suite-detail"] }), []);
});

test("product material picker excludes generated result assets", async () => {
  const generation = await loadGenerationModule() as Record<string, unknown>;
  const selectableProductAssets = generation.selectableProductAssets as ((assets: Array<{ id: string; type: string }>) => Array<{ id: string }>) | undefined;
  const assets = [
    { id: "source", type: "source" },
    { id: "base", type: "base" },
    { id: "hero", type: "hero" },
    { id: "suite", type: "suite" },
  ];

  assert.deepEqual(selectableProductAssets?.(assets), [{ id: "source", type: "source" }, { id: "base", type: "base" }]);
});

test("bounded selection toggles existing values and refuses values beyond the limit", async () => {
  const generation = await loadGenerationModule() as Record<string, unknown>;
  const toggleBoundedSelection = generation.toggleBoundedSelection as ((current: string[], id: string, max: number) => string[]) | undefined;

  assert.deepEqual(toggleBoundedSelection?.(["a"], "b", 2), ["a", "b"]);
  assert.deepEqual(toggleBoundedSelection?.(["a", "b"], "c", 2), ["a", "b"]);
  assert.deepEqual(toggleBoundedSelection?.(["a", "b"], "a", 2), ["b"]);
});

test("suite plans must only contain currently selected modules", async () => {
  const generation = await loadGenerationModule() as Record<string, unknown>;
  const validateGenerationPlans = generation.validateGenerationPlans as ((selectedModuleIds: string[], plans: Array<{ moduleId: string }>) => string[]) | undefined;

  assert.deepEqual(validateGenerationPlans?.(["suite-hero"], [{ moduleId: "suite-scene" }]), ["当前详情页规划包含已取消选择的模块，请重新生成规划"]);
  assert.deepEqual(validateGenerationPlans?.(["suite-hero", "suite-scene"], [{ moduleId: "suite-hero" }, { moduleId: "suite-scene" }]), []);
});

test("suite plans must cover every currently selected module", async () => {
  const generation = await loadGenerationModule() as Record<string, unknown>;
  const validateGenerationPlans = generation.validateGenerationPlans as ((selectedModuleIds: string[], plans: Array<{ moduleId: string }>) => string[]) | undefined;

  assert.deepEqual(validateGenerationPlans?.(["suite-hero", "suite-scene"], [{ moduleId: "suite-hero" }]), ["当前详情页规划缺少已选择的模块，请重新生成规划"]);
});
