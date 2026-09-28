import type { Asset, AssetType } from "../api/contracts";

export type GenerationMode = "hero" | "suite";
export type GenerationMarket = string;
const LEGACY_MARKET_SELECTIONS: Record<string, string> = { domestic: "taobao", international: "amazon" };
export function normalizeGenerationMarket(value: string | undefined): GenerationMarket {
  return value ? LEGACY_MARKET_SELECTIONS[value] ?? value : "taobao";
}
export type GenerationStatus = "idle" | "validating" | "planning" | "planned" | "generating" | "completed" | "partial" | "failed";

/**
 * 可以作为生成输入的项目素材类型。
 *
 * 只允许原始输入和白底输入，和后端 `project_assets.kind` 一一对应：
 * - `source`（原图）
 * - `base`（白底图，主图/套图的推荐输入）
 */
export const SELECTABLE_PRODUCT_ASSET_TYPES: readonly AssetType[] = ["source", "base"];

export function selectableProductAssets(assets: Asset[]): Asset[] {
  return assets.filter((asset) => SELECTABLE_PRODUCT_ASSET_TYPES.includes(asset.type));
}

export interface GenerationModuleDefinition {
  id: string;
  label: string;
  description: string;
  mode: GenerationMode;
}

export interface StyleDefinition {
  id: string;
  label: string;
  description: string;
}

export interface StyleCategory {
  id: string;
  label: string;
  styles: StyleDefinition[];
}

export interface GenerationModuleParameter {
  key: string;
  value: string;
}

export type GenerationModuleParameters = Record<string, GenerationModuleParameter[]>;

export interface CommonGenerationConfig {
  moduleTaskDetails?: Record<string, { title: string; informationQuestion: string; productPresence: string; visualMechanism: string; compositionAdvice: string }>;
  selectedAssetIds: string[];
  reverseVersionId?: string;
  reverseModuleReferences?: Record<string, { versionId: string; moduleId: string }>;
  modulePlanReferences?: Record<string, { versionId: string; moduleId: string }>;
  referenceAssetIds?: string[];
  moduleTypes?: Record<string, string>;
  outputLanguage: string;
  market: GenerationMarket;
  model: string;
  aspectRatio: string;
  resolution: string;
  styleId: string | null;
  customStyle: string;
  moduleParameters: GenerationModuleParameters;
  selectedModuleIds: string[];
  moduleCounts: Record<string, number>;
  planningBrief?: string;
  modulePlanId?: string;
  modulePlanFingerprint?: string;
  modulePlanningRequest?: { fingerprint: string; idempotencyKey: string; planId?: string };
  modulePlanBaseline?: { moduleCounts: Record<string, number>; moduleParameters: GenerationModuleParameters };
}

export interface HeroGenerationConfig extends CommonGenerationConfig {
  designBrief: string;
}

export interface SuiteGenerationConfig extends CommonGenerationConfig {
  creativePrompt: string;
}

export type GenerationModuleStatus = "pending" | "generating" | "completed" | "failed";

export interface GenerationModuleRun {
  id: string;
  status: GenerationModuleStatus;
  progress: number;
  error?: string;
}

export interface GenerationRun {
  mode: GenerationMode;
  status: GenerationStatus;
  modules: Record<string, GenerationModuleRun>;
}

export const HERO_MODULES: GenerationModuleDefinition[] = [
  { id: "hero-kv", label: "首屏 KV", description: "建立第一眼识别与主卖点", mode: "hero" },
  { id: "hero-overview", label: "整体展示", description: "完整呈现产品形态与质感", mode: "hero" },
  { id: "hero-detail", label: "细节特写", description: "放大关键材质与工艺细节", mode: "hero" },
  { id: "hero-scene", label: "使用场景", description: "呈现产品在真实环境中的状态", mode: "hero" },
  { id: "hero-colors", label: "多色套装", description: "展示不同颜色或组合规格", mode: "hero" },
  { id: "hero-compare", label: "功能对比", description: "清晰说明功能与差异优势", mode: "hero" },
  { id: "hero-package", label: "包装展示", description: "呈现包装、配件与开箱内容", mode: "hero" },
  { id: "hero-benefit", label: "权益保障", description: "展示服务承诺与购买保障", mode: "hero" },
];

export const SUITE_MODULES: GenerationModuleDefinition[] = [
  { id: "suite-hero", label: "首屏主视觉", description: "传递核心价值并建立视觉基调", mode: "suite" },
  { id: "suite-benefit", label: "核心卖点图", description: "突出最具说服力的购买理由", mode: "suite" },
  { id: "suite-scene", label: "使用场景图", description: "呈现真实使用环境与状态", mode: "suite" },
  { id: "suite-angle", label: "多角度图", description: "从多个角度完整展示外观", mode: "suite" },
  { id: "suite-mood", label: "场景氛围图", description: "营造品牌与产品使用氛围", mode: "suite" },
  { id: "suite-detail", label: "商品细节图", description: "放大材质结构与关键工艺", mode: "suite" },
  { id: "suite-story", label: "品牌故事图", description: "传达品牌理念与产品缘起", mode: "suite" },
  { id: "suite-size", label: "尺寸/容量/尺码图", description: "展示规格尺寸与容量信息", mode: "suite" },
  { id: "suite-effect", label: "效果对比图", description: "直观呈现使用前后的差异", mode: "suite" },
  { id: "suite-spec", label: "详细规格/参数表", description: "集中展示详细产品参数", mode: "suite" },
  { id: "suite-craft", label: "工艺制作图", description: "展示生产过程与制作工艺", mode: "suite" },
  { id: "suite-accessory", label: "配件/赠品图", description: "明确包装内配件与赠品内容", mode: "suite" },
  { id: "suite-series", label: "系列展示图", description: "展示同系列型号与差异", mode: "suite" },
  { id: "suite-ingredient", label: "商品成分图", description: "清晰说明材料或成分构成", mode: "suite" },
  { id: "suite-support", label: "售后保障图", description: "说明质保退换与服务政策", mode: "suite" },
  { id: "suite-guide", label: "使用建议图", description: "讲清使用步骤与注意事项", mode: "suite" },
  { id: "suite-buyer", label: "买家秀", description: "呈现真实用户使用体验", mode: "suite" },
  { id: "suite-creator", label: "博主推荐图", description: "以达人视角传递推荐理由", mode: "suite" },
];

export const STYLE_CATEGORIES: StyleCategory[] = [
  { id: "basic", label: "基础风格", styles: [
    { id: "minimal", label: "极简商业", description: "克制留白与清晰产品轮廓" },
    { id: "studio", label: "高级棚拍", description: "柔和棚拍光线与真实质感" },
    { id: "editorial", label: "杂志编辑", description: "精致排版与品牌叙事感" },
  ] },
  { id: "digital", label: "科技数码", styles: [
    { id: "precision", label: "冷调精密", description: "冷静背景与理性参数秩序" },
    { id: "future", label: "未来霓虹", description: "光带层次与未来科技氛围" },
    { id: "industrial", label: "极简工业", description: "金属结构与硬朗造型表达" },
  ] },
  { id: "home", label: "居家生活", styles: [
    { id: "warm-home", label: "温暖居家", description: "自然日光与舒适家庭氛围" },
    { id: "nordic", label: "北欧清爽", description: "浅色木质与干净生活空间" },
    { id: "urban-desk", label: "都市办公", description: "现代桌面与高效工作状态" },
  ] },
  { id: "nature", label: "自然清新", styles: [
    { id: "botanical", label: "清新植感", description: "植物光影与清透自然色彩" },
    { id: "outdoor", label: "户外轻盈", description: "户外环境与自在使用体验" },
    { id: "eco", label: "环保叙事", description: "再生材质与可持续生活表达" },
  ] },
  { id: "premium", label: "品质奢华", styles: [
    { id: "dark-luxury", label: "深色奢华", description: "深色材质与精致高光层次" },
    { id: "jewelry", label: "珠宝质感", description: "细腻反射与珍贵材质氛围" },
    { id: "gallery", label: "艺术展陈", description: "雕塑构图与高级陈列空间" },
  ] },
  { id: "fashion", label: "潮流文化", styles: [
    { id: "street", label: "街头潮流", description: "大胆色彩与年轻街头语境" },
    { id: "pop", label: "波普撞色", description: "高饱和撞色与活力图形语言" },
    { id: "retro", label: "复古潮玩", description: "复古色调与趣味潮玩表达" },
  ] },
  { id: "people", label: "人群主题", styles: [
    { id: "business", label: "商务精英", description: "专业环境与可靠效率表达" },
    { id: "family", label: "家庭亲子", description: "亲密互动与安心使用氛围" },
    { id: "creator", label: "达人推荐", description: "真实体验与内容创作语境" },
  ] },
];

export const CUSTOM_STYLE_ID = "style-custom";

const MIN_MODULE_COUNT = 1;
const MAX_MODULE_COUNT = 4;

export function normalizeModuleCounts(selectedModuleIds: string[], counts?: Record<string, number>): Record<string, number> {
  return Object.fromEntries(selectedModuleIds.map((moduleId) => {
    const raw = counts?.[moduleId];
    const value = Number.isFinite(raw) ? Math.trunc(raw as number) : MIN_MODULE_COUNT;
    return [moduleId, Math.min(MAX_MODULE_COUNT, Math.max(MIN_MODULE_COUNT, value))];
  }));
}

export function validateModuleCounts(selectedModuleIds: string[], counts?: Record<string, number>): string[] {
  return selectedModuleIds.flatMap((moduleId) => {
    const count = counts?.[moduleId] ?? MIN_MODULE_COUNT;
    return Number.isInteger(count) && count >= MIN_MODULE_COUNT && count <= MAX_MODULE_COUNT
      ? []
      : [`模块“${moduleId}”生成张数需在 ${MIN_MODULE_COUNT}-${MAX_MODULE_COUNT} 张之间`];
  });
}

export function validateGenerationPlans(selectedModuleIds: string[], plans: Array<{ moduleId: string }>): string[] {
  const selected = new Set(selectedModuleIds);
  const planned = new Set(plans.map((plan) => plan.moduleId));
  if (plans.some((plan) => !selected.has(plan.moduleId))) {
    return ["当前详情页规划包含已取消选择的模块，请重新生成规划"];
  }
  return selectedModuleIds.some((moduleId) => !planned.has(moduleId))
    ? ["当前详情页规划缺少已选择的模块，请重新生成规划"]
    : [];
}

const parameterPreset = (...keys: string[]): GenerationModuleParameter[] => keys.map((key) => ({ key, value: "" }));

export const MODULE_PARAMETER_PRESETS: Record<string, GenerationModuleParameter[]> = {
  "hero-freeform": parameterPreset("主信息", "事实依据", "构图要求"),
  "suite-freeform": parameterPreset("主信息", "事实依据", "构图要求"),
  "hero-kv": parameterPreset("核心卖点", "画面文案", "文字安全区"),
  "hero-overview": parameterPreset("展示角度", "背景环境", "构图重点"),
  "hero-detail": parameterPreset("细节主体", "材质/工艺", "光线要求"),
  "hero-scene": parameterPreset("场景地点", "环境元素", "人物/动作", "时间与光线"),
  "hero-colors": parameterPreset("颜色/规格", "排列方式", "背景要求"),
  "hero-compare": parameterPreset("对比维度", "对比对象", "必须展示的事实"),
  "hero-package": parameterPreset("包装内容", "摆放方式", "背景要求"),
  "hero-benefit": parameterPreset("服务承诺", "保障信息", "文字安全区"),
  "suite-hero": parameterPreset("首要信息", "场景基调", "构图重点"),
  "suite-benefit": parameterPreset("核心卖点", "事实依据", "表达重点"),
  "suite-scene": parameterPreset("场景地点", "环境元素", "人物/动作", "时间与光线"),
  "suite-angle": parameterPreset("展示角度", "排列方式", "背景要求"),
  "suite-mood": parameterPreset("氛围关键词", "色彩倾向", "道具元素", "光线要求"),
  "suite-detail": parameterPreset("细节主体", "材质/工艺", "镜头要求"),
  "suite-story": parameterPreset("故事背景", "场景道具", "品牌表达"),
  "suite-size": parameterPreset("尺寸/容量/尺码", "单位", "版式要求"),
  "suite-effect": parameterPreset("对比维度", "前后状态", "标注要求"),
  "suite-spec": parameterPreset("参数列表", "单位", "表格版式"),
  "suite-craft": parameterPreset("工艺阶段", "材料/工具", "制作环境"),
  "suite-accessory": parameterPreset("配件/赠品", "摆放方式", "标注要求"),
  "suite-series": parameterPreset("系列型号", "差异点", "排列方式"),
  "suite-ingredient": parameterPreset("成分/材质", "含量/比例", "说明重点"),
  "suite-support": parameterPreset("售后政策", "保障期限", "联系信息"),
  "suite-guide": parameterPreset("使用步骤", "注意事项", "使用环境"),
  "suite-buyer": parameterPreset("人物设定", "使用时刻", "体验重点"),
  "suite-creator": parameterPreset("人物设定", "发布平台", "推荐重点"),
};

export function getModuleParameterPresets(moduleId: string): GenerationModuleParameter[] {
  const preset = MODULE_PARAMETER_PRESETS[moduleId] ?? parameterPreset("补充说明");
  return preset.map((item) => ({ ...item }));
}

export function compactModuleParameters(parameters: GenerationModuleParameter[]): GenerationModuleParameter[] {
  return parameters
    .slice(0, 20)
    .map((item) => ({ key: item.key.trim().slice(0, 60), value: item.value.trim().slice(0, 500) }))
    .filter((item) => item.key && item.value);
}

export function getCompactModuleParameters(parameters: GenerationModuleParameters | undefined, moduleId: string): GenerationModuleParameter[] {
  return compactModuleParameters(parameters?.[moduleId] ?? []);
}

export function getStyleLabel(styleId: string | null, customStyle = ""): string {
  if (styleId === CUSTOM_STYLE_ID) return "自定义";
  return STYLE_CATEGORIES.flatMap((category) => category.styles).find((style) => style.id === styleId)?.label ?? "智能匹配";
}

export function getStylePrompt(styleId: string | null, customStyle = ""): string {
  if (styleId === CUSTOM_STYLE_ID) return customStyle.trim();
  return STYLE_CATEGORIES.flatMap((category) => category.styles).find((style) => style.id === styleId)?.description ?? "";
}

const commonDefaults: CommonGenerationConfig = {
  selectedAssetIds: [],
  outputLanguage: "中文",
  market: "taobao",
  model: "GPT Image 2.5",
  aspectRatio: "1:1",
  resolution: "标准 1K",
  styleId: null,
  customStyle: "",
  moduleParameters: {},
  selectedModuleIds: [],
  moduleCounts: {},
};

function withoutReferenceSelection<T extends Partial<CommonGenerationConfig>>(value: T): T {
  if (!value.referenceAssetIds?.length) return value;
  return { ...value, referenceAssetIds: [], ...(value.referenceAssetIds?.length ? {
    modulePlanId: undefined, modulePlanFingerprint: undefined, modulePlanningRequest: undefined,
  } : {}) };
}

export function normalizeHeroConfig(value: Partial<HeroGenerationConfig> = {}): HeroGenerationConfig {
  value = withoutReferenceSelection(value);
  const selectedModuleIds = value.selectedModuleIds ?? [];
  const planningBrief = value.planningBrief ?? value.designBrief ?? "";
  return { ...commonDefaults, designBrief: "", ...value, ...(planningBrief ? { planningBrief } : {}), selectedModuleIds, market: normalizeGenerationMarket(value.market), moduleParameters: value.moduleParameters ?? {}, moduleCounts: Object.fromEntries(selectedModuleIds.map((id) => [id, 1])) };
}

export function normalizeSuiteConfig(value: Partial<SuiteGenerationConfig> = {}): SuiteGenerationConfig {
  value = withoutReferenceSelection(value);
  const selectedModuleIds = value.selectedModuleIds ?? [];
  const planningBrief = value.planningBrief ?? value.creativePrompt ?? "";
  return { ...commonDefaults, aspectRatio: "3:4", resolution: "标准 1K", creativePrompt: "", ...value, ...(planningBrief ? { planningBrief } : {}), selectedModuleIds, market: normalizeGenerationMarket(value.market), moduleParameters: value.moduleParameters ?? {}, moduleCounts: Object.fromEntries(selectedModuleIds.map((id) => [id, 1])) };
}

export function validateHeroConfig(config: HeroGenerationConfig): string[] {
  const errors: string[] = [];
  if (config.selectedAssetIds.length === 0) errors.push("请至少选择 1 张产品素材");
  if (config.selectedAssetIds.length > 8) errors.push("主图最多选择 8 张产品素材");
  if (config.selectedModuleIds.length === 0) errors.push("请至少选择 1 个主图模块");
  if (config.selectedModuleIds.length > 8) errors.push("主图最多选择 8 个模块");
  errors.push(...validateModuleCounts(config.selectedModuleIds, config.moduleCounts));
  return errors;
}

export function validateSuiteConfig(config: SuiteGenerationConfig, catalogCount = SUITE_MODULES.length): string[] {
  const errors: string[] = [];
  if (config.selectedAssetIds.length === 0) errors.push("请至少选择 1 张产品素材");
  if (config.selectedAssetIds.length > 4) errors.push("详情图最多选择 4 张产品素材");
  if (config.selectedModuleIds.length === 0) errors.push("请至少选择 1 个详情页模块");
  errors.push(...validateModuleCounts(config.selectedModuleIds, config.moduleCounts));
  return errors;
}

export function toggleBoundedSelection(current: string[], id: string, max: number, min = 0): string[] {
  if (current.includes(id)) return current.length <= min ? current : current.filter((item) => item !== id);
  if (current.length >= max) return current;
  return [...current, id];
}

const allowedTransitions: Record<GenerationStatus, GenerationStatus[]> = {
  idle: ["validating"],
  validating: ["planning", "generating", "failed"],
  planning: ["planned", "partial", "failed"],
  planned: ["generating"],
  generating: ["completed", "partial", "failed"],
  completed: [],
  partial: ["generating", "completed", "failed"],
  failed: ["validating", "planning", "generating"],
};

export function canTransitionGenerationStatus(from: GenerationStatus, to: GenerationStatus): boolean {
  return allowedTransitions[from].includes(to);
}

export function createGenerationRun(mode: GenerationMode, moduleIds: string[]): GenerationRun {
  return {
    mode,
    status: "generating",
    modules: Object.fromEntries(moduleIds.map((id) => [id, { id, status: "pending" as const, progress: 0 }])),
  };
}

export function updateGenerationModuleRun(
  run: GenerationRun,
  moduleId: string,
  patch: Partial<Omit<GenerationModuleRun, "id">>,
): GenerationRun {
  const current = run.modules[moduleId];
  if (!current) return run;
  const modules = { ...run.modules, [moduleId]: { ...current, ...patch } };
  const values = Object.values(modules);
  const terminal = values.every((item) => item.status === "completed" || item.status === "failed");
  const completed = values.filter((item) => item.status === "completed").length;
  const failed = values.filter((item) => item.status === "failed").length;
  let status: GenerationStatus = "generating";
  if (terminal && failed === 0) status = "completed";
  else if (terminal && completed === 0) status = "failed";
  else if (terminal) status = "partial";
  return { ...run, modules, status };
}

export function failedGenerationModuleIds(run: GenerationRun): string[] {
  return Object.values(run.modules).filter((item) => item.status === "failed").map((item) => item.id);
}
