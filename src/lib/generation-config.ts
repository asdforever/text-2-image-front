import { CUSTOM_STYLE_ID, HERO_MODULES, STYLE_CATEGORIES, SUITE_MODULES, normalizeModuleCounts, validateModuleCounts, type GenerationModuleDefinition, type GenerationModuleParameters, type StyleCategory } from "./generation-workspace";

export interface GenerationMarketDefinition {
  id: string;
  label: string;
  /** The top-level market group used by generation selectors. */
  marketScope: GenerationMarketScope;
  platforms: string;
  guidance: string;
  defaultLanguage: string;
}

export type GenerationMarketScope = "domestic" | "overseas";

/** IDs used by the first version of the workbench, kept for draft migration. */
export const LEGACY_GENERATION_MARKET_ID_MAP: Record<string, string> = {
  domestic: "taobao",
  international: "amazon",
};

/**
 * Seeded concrete platforms. The IDs are stable references used by project
 * drafts, prompt bindings, and generation snapshots; labels may be edited.
 */
export const DEFAULT_GENERATION_MARKETS: GenerationMarketDefinition[] = [
  { id: "taobao", label: "淘宝", marketScope: "domestic", platforms: "淘宝", guidance: "主图优先白底，突出商品主体，避免夸大功效描述。", defaultLanguage: "中文" },
  { id: "tmall", label: "天猫", marketScope: "domestic", platforms: "天猫", guidance: "保持品牌视觉统一，使用清晰的卖点和规范化商品信息。", defaultLanguage: "中文" },
  { id: "jd", label: "京东", marketScope: "domestic", platforms: "京东", guidance: "主图使用干净背景，准确呈现产品颜色、结构与规格。", defaultLanguage: "中文" },
  { id: "pdd", label: "拼多多", marketScope: "domestic", platforms: "拼多多", guidance: "画面信息直接易读，突出核心商品与性价比事实。", defaultLanguage: "中文" },
  { id: "douyin", label: "抖音小店", marketScope: "domestic", platforms: "抖音小店", guidance: "适合移动端浏览，使用真实场景和简洁卖点表达。", defaultLanguage: "中文" },
  { id: "kuaishou", label: "快手小店", marketScope: "domestic", platforms: "快手小店", guidance: "保持真实生活化的场景表达，避免过度修饰。", defaultLanguage: "中文" },
  { id: "amazon", label: "亚马逊", marketScope: "overseas", platforms: "Amazon", guidance: "主图采用纯白背景，避免文字、道具和水印，准确展示产品。", defaultLanguage: "英文" },
  { id: "shopify", label: "Shopify", marketScope: "overseas", platforms: "Shopify", guidance: "按品牌视觉规范组织商品图，适配目标国家语言和法规。", defaultLanguage: "英文" },
  { id: "ebay", label: "eBay", marketScope: "overseas", platforms: "eBay", guidance: "清晰展示商品状态、配件和关键规格，避免误导性表达。", defaultLanguage: "英文" },
  { id: "walmart", label: "Walmart", marketScope: "overseas", platforms: "Walmart", guidance: "优先真实、清晰的产品展示，保持目录信息一致。", defaultLanguage: "英文" },
];

export function groupGenerationMarkets(markets: GenerationMarketDefinition[]): Record<GenerationMarketScope, GenerationMarketDefinition[]> {
  return {
    domestic: markets.filter((market) => market.marketScope === "domestic"),
    overseas: markets.filter((market) => market.marketScope === "overseas"),
  };
}

export function resolveGenerationMarketId(value: string): string {
  return LEGACY_GENERATION_MARKET_ID_MAP[value] ?? value;
}

export function findGenerationMarket(markets: GenerationMarketDefinition[], value: string): GenerationMarketDefinition | undefined {
  const resolvedId = resolveGenerationMarketId(value);
  return markets.find((market) => market.id === resolvedId || market.label === value);
}

export interface GenerationModelDefinition {
  id: string;
  label: string;
  provider: string;
  constraints: string;
  resolutions: string[];
  connectionId?: string;
  aspectRatios?: string[];
}

export interface PromptBinding {
  promptTemplateId: string;
  promptVersionId: string;
  templateName?: string;
  versionNo?: number;
  body?: string;
  contentSha256?: string;
  slot?: GenerationPromptSlot;
  targetId?: string;
}

export interface PromptVersionReference {
  id: string;
  templateId: string;
  versionNo: number;
  body?: string;
  contentSha256?: string;
  status?: "draft" | "published" | "retired" | "archived";
}

/** Local fallback references used when the prompt service is unavailable. */
export const DEFAULT_PROMPT_VERSION_REFERENCES: PromptVersionReference[] = [
  { id: "ver-market-v1", templateId: "tpl-market", versionNo: 1, status: "published" },
  { id: "ver-style-v2", templateId: "tpl-style", versionNo: 2, status: "published" },
  { id: "ver-module-v3", templateId: "tpl-module", versionNo: 3, status: "published" },
  { id: "ver-model-v1", templateId: "tpl-model", versionNo: 1, status: "published" },
];

export type GenerationPromptSlot = "market" | "model" | "style" | "hero-module" | "suite-module";

export type PromptBindingMap = Record<string, PromptBinding | null>;

export interface GenerationConfig {
  version: number;
  savedAt: string;
  markets: GenerationMarketDefinition[];
  models: GenerationModelDefinition[];
  promptModel?: { connectionId: string } | null;
  styleCategories: StyleCategory[];
  heroModules: GenerationModuleDefinition[];
  suiteModules: GenerationModuleDefinition[];
  marketBindings: PromptBindingMap;
  modelBindings: PromptBindingMap;
  heroBindings: PromptBindingMap;
  suiteBindings: PromptBindingMap;
}

export interface GenerationSelection {
  marketId: string;
  modelId: string;
  styleId?: string | null;
  moduleIds: string[];
  /** Maps a UI task id to its published catalog module id when a module is reused. */
  moduleTypes?: Record<string, string>;
  outputLanguage?: string;
  aspectRatio?: string;
  resolution?: string;
  customStyle?: string;
  moduleParameters?: GenerationModuleParameters;
  moduleCounts?: Record<string, number>;
}

export interface GenerationSnapshot {
  configVersion: number;
  createdAt: string;
  market: GenerationMarketDefinition | null;
  model: GenerationModelDefinition | null;
  style: { id: string | null; label: string; description: string; customText?: string } | null;
  moduleIds: string[];
  modules: Array<GenerationModuleDefinition & { taskId?: string; count: number; parameters: Array<{ key: string; value: string }> }>;
  moduleCounts: Record<string, number>;
  outputLanguage: string;
  aspectRatio: string;
  resolution: string;
  customStyle: string;
  moduleParameters: GenerationModuleParameters;
  promptBindings: Array<PromptBinding & { slot: GenerationPromptSlot; targetId: string }>;
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function seedBindings(items: GenerationModuleDefinition[]): PromptBindingMap {
  return Object.fromEntries(items.map((item) => [item.id, null]));
}

export function createDefaultGenerationConfig(): GenerationConfig {
  const styleCategories = clone(STYLE_CATEGORIES);
  const heroModules = clone(HERO_MODULES);
  const suiteModules = clone(SUITE_MODULES);
  return {
    version: 1,
    savedAt: new Date(0).toISOString(),
    markets: clone(DEFAULT_GENERATION_MARKETS),
    models: [
      { id: "gpt-image-2-5", label: "GPT Image 2.5", provider: "OpenAI", constraints: "支持超清 4K 输出", resolutions: ["标准 1K", "高清 2K", "超清 4K"] },
      { id: "flux-pro", label: "Flux Pro", provider: "Black Forest Labs", constraints: "当前最高支持高清 2K", resolutions: ["标准 1K", "高清 2K"] },
    ],
    styleCategories,
    heroModules,
    suiteModules,
    marketBindings: Object.fromEntries(DEFAULT_GENERATION_MARKETS.map((market) => [market.id, null])),
    modelBindings: { "gpt-image-2-5": null, "flux-pro": null },
    heroBindings: seedBindings(heroModules),
    suiteBindings: seedBindings(suiteModules),
  };
}

export function validateGenerationConfig(config: GenerationConfig, availablePromptVersions: PromptVersionReference[] = []): string[] {
  const errors: string[] = [];
  if (config.promptModel && !config.promptModel.connectionId?.trim()) errors.push("请选择有效的提示词模型连接");
  const checkNames = (items: Array<{ label: string }>, message: string) => {
    const labels = items.map((item) => item.label.trim()).filter(Boolean);
    if (labels.length !== items.length) errors.push(`${message}不能为空`);
    if (new Set(labels).size !== labels.length) errors.push(`${message}不能重复`);
  };
  const checkIds = (items: Array<{ id: string }>, message: string) => {
    const ids = items.map((item) => item.id.trim());
    if (ids.some((id) => !id)) errors.push(`${message}不能为空`);
    if (new Set(ids.filter(Boolean)).size !== ids.filter(Boolean).length) errors.push(`${message}不能重复`);
  };

  checkNames(config.markets, "市场名称");
  checkIds(config.markets, "市场标识");
  if (config.markets.some((market) => market.marketScope !== "domestic" && market.marketScope !== "overseas")) {
    errors.push("市场范围必须为国内或国外");
  }
  config.markets.forEach((market) => {
    if (!market.platforms.trim()) errors.push(`市场“${market.label}”的适用平台不能为空`);
    if (!market.guidance.trim()) errors.push(`市场“${market.label}”的平台规范不能为空`);
    if (!market.defaultLanguage.trim()) errors.push(`市场“${market.label}”的默认语言不能为空`);
  });
  checkNames(config.models, "模型名称");
  checkIds(config.models, "模型标识");
  checkNames(config.styleCategories, "风格大类名称");
  checkIds(config.styleCategories, "风格大类标识");
  config.styleCategories.forEach((category) => {
    checkNames(category.styles, `风格大类“${category.label}”中的风格名称`);
    checkIds(category.styles, `风格大类“${category.label}”中的风格标识`);
    if (category.styles.length > 4) errors.push(`风格大类“${category.label}”最多 4 个风格`);
    category.styles.forEach((style) => {
      if (!style.description.trim()) errors.push(`风格“${style.label}”的风格描述不能为空`);
    });
  });
  config.models.forEach((model) => {
    if (model.resolutions.length === 0) errors.push(`模型“${model.label}”至少支持一种分辨率`);
  });
  const validateModules = (modules: GenerationModuleDefinition[], mode: "hero" | "suite", label: string) => {
    if (modules.length === 0) errors.push(`至少需要一个${label}`);
    checkNames(modules, `${label}名称`);
    checkIds(modules, `${label}标识`);
    modules.forEach((item) => {
      if (!item.description.trim()) errors.push(`${label}“${item.label}”的模块说明不能为空`);
      if (item.mode !== mode) errors.push(`${label}类型必须为 ${mode}`);
    });
  };
  validateModules(config.heroModules, "hero", "主图模块");
  validateModules(config.suiteModules, "suite", "详情页模块");
  const bindingMaps = [config.marketBindings, config.heroBindings, config.suiteBindings];
  bindingMaps.forEach((bindings) => Object.entries(bindings).forEach(([id, binding]) => {
    if (binding && (!binding.promptTemplateId.trim() || !binding.promptVersionId.trim())) errors.push(`条目“${id}”的提示词绑定不完整`);
    if (binding) {
      const version = availablePromptVersions.find((item) => item.id === binding.promptVersionId && item.templateId === binding.promptTemplateId);
      if (!version || version.status === "retired" || version.status === "archived") errors.push(`条目“${id}”的提示词版本不可用`);
    }
  }));
  return errors;
}

export function validateGenerationSelection(config: GenerationConfig, selection: GenerationSelection): string[] {
  const errors: string[] = [];
  const marketId = resolveGenerationMarketId(selection.marketId);
  if (!config.markets.some((item) => item.id === marketId)) errors.push("当前电商市场已失效，请重新选择");
  const model = config.models.find((item) => item.id === selection.modelId);
  if (!model) errors.push("当前生图模型已失效，请重新选择");
  else if (selection.resolution && !model.resolutions.includes(selection.resolution)) errors.push("当前分辨率不受所选模型支持，请重新选择");
  if (model?.aspectRatios?.length && selection.aspectRatio && !model.aspectRatios.includes(selection.aspectRatio)) errors.push("当前比例不受所选模型支持，请重新选择");
  if (!selection.styleId) errors.push("请选择图片风格后再编译提示词");
  else if (selection.styleId === CUSTOM_STYLE_ID && !selection.customStyle?.trim()) errors.push("请填写自定义风格描述");
  else if (selection.styleId !== CUSTOM_STYLE_ID && !config.styleCategories.some((category) => category.styles.some((style) => style.id === selection.styleId))) {
    errors.push("当前图片风格已失效，请重新选择");
  }
  const allModules = [...config.heroModules, ...config.suiteModules];
  if (selection.moduleIds.some((taskId) => !allModules.some((module) => module.id === (selection.moduleTypes?.[taskId] ?? taskId)))) errors.push("当前生成模块已失效，请重新选择");
  errors.push(...validateModuleCounts(selection.moduleIds, selection.moduleCounts));
  return errors;
}

export function createGenerationSnapshot(config: GenerationConfig, selection: GenerationSelection): GenerationSnapshot {
  const marketId = resolveGenerationMarketId(selection.marketId);
  const market = config.markets.find((item) => item.id === marketId) ?? null;
  const model = config.models.find((item) => item.id === selection.modelId) ?? null;
  const style = config.styleCategories.flatMap((category) => category.styles).find((item) => item.id === selection.styleId) ?? null;
  const moduleDefinitions = [...config.heroModules, ...config.suiteModules];
  const moduleParameters = clone(selection.moduleParameters ?? {});
  const moduleCounts = normalizeModuleCounts(selection.moduleIds, selection.moduleCounts);
  const bindings: Array<PromptBinding & { slot: GenerationPromptSlot; targetId: string }> = [];
  const addBinding = (slot: GenerationPromptSlot, targetId: string, binding: PromptBinding | null | undefined) => {
    if (binding) bindings.push({ ...clone(binding), slot, targetId });
  };
  addBinding("market", marketId, config.marketBindings[marketId] ?? config.marketBindings[selection.marketId]);
  selection.moduleIds.forEach((taskId) => {
    const moduleId = selection.moduleTypes?.[taskId] ?? taskId;
    const definition = moduleDefinitions.find((item) => item.id === moduleId);
    const slot: GenerationPromptSlot = definition?.mode === "hero" ? "hero-module" : "suite-module";
    addBinding(slot, moduleId, config.heroBindings[moduleId] ?? config.suiteBindings[moduleId]);
  });
  const modules = selection.moduleIds.flatMap((taskId) => {
    const moduleId = selection.moduleTypes?.[taskId] ?? taskId;
    const definition = moduleDefinitions.find((item) => item.id === moduleId);
    return definition ? [{ ...clone(definition), taskId, count: moduleCounts[taskId] ?? 1, parameters: clone(moduleParameters[taskId] ?? []) }] : [];
  });
  const styleSnapshot = style
    ? { ...clone(style), customText: "" }
    : selection.styleId === CUSTOM_STYLE_ID
      ? { id: CUSTOM_STYLE_ID, label: "自定义", description: "", customText: selection.customStyle?.trim() ?? "" }
    : selection.styleId || selection.customStyle?.trim()
      ? { id: selection.styleId ?? null, label: selection.styleId ? "已失效风格" : "自定义", description: "", customText: selection.customStyle?.trim() ?? "" }
      : null;
  return clone({
    configVersion: config.version,
    createdAt: new Date().toISOString(),
    market,
    model,
    style: styleSnapshot,
    moduleIds: [...selection.moduleIds],
    moduleCounts,
    modules,
    outputLanguage: selection.outputLanguage ?? market?.defaultLanguage ?? "",
    aspectRatio: selection.aspectRatio ?? "",
    resolution: selection.resolution ?? "",
    customStyle: selection.customStyle ?? "",
    moduleParameters,
    promptBindings: bindings,
  });
}

export function cloneGenerationConfig(config: GenerationConfig): GenerationConfig {
  const copy = clone(config) as GenerationConfig & { plannerBindings?: unknown };
  // Legacy bindings are ignored; planning instructions are owned by the backend.
  delete copy.plannerBindings;
  return copy;
}
