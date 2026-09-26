import type { SuiteFixture } from "./contracts";
import type { Asset, Project, SuiteConfigDraft, SuiteTask } from "./contracts";
import type { GenerationModuleParameter } from "../lib/generation-workspace";
import type { GenerationSnapshot } from "../lib/generation-config";

export const suiteFixture: SuiteFixture = {
  id: "suite-demo-001",
  product: "GAN65-BK",
  site: "Amazon · 日本",
  status: "in_progress",
  cards: [
    { id: "card-1", title: "品牌首图", type: "主图 01", prompt: "保留 GAN65-BK 产品真实外观与接口结构，白色纯净背景，产品居中偏下构图，突出 65W 三口快充卖点，商业电商摄影，柔和棚拍光线，无额外文字。", image: "/assets/gan65-product-tight.jpg", ratio: "1:1", size: "1K", model: "三万蕉 2", template: "全平台主图 · v2" },
    { id: "card-2", title: "使用场景图", type: "主图 02", prompt: "以 GAN65-BK 为画面主体，放置在整洁的办公桌面，笔记本电脑、平板与手机同时充电，真实比例，浅灰背景，明亮自然光，保留产品颜色、轮廓和接口，不添加虚构品牌。", image: "/assets/tokyo-desk-v3.jpg", ratio: "4:3", size: "1K", model: "三万蕉 2", template: "全平台主图 · v2" },
    { id: "card-3", title: "核心卖点图", type: "主图 03", prompt: "产品主体保持真实，使用简洁的三分构图展示多设备快充关系，画面留出中文卖点安全区，光影干净，商业产品摄影，禁止改变产品结构与 Logo。", image: "/assets/gan65-product.jpg", ratio: "1:1", size: "1K", model: "三万蕉 2", template: "全平台主图 · v2" },
    { id: "card-4", title: "参数说明图", type: "主图 04", prompt: "以 GAN65-BK 产品为中心的参数说明场景，展示 USB-C x2、USB-A x1 和 65W 信息区域，排版克制，产品比例准确，背景留白，禁止编造产品参数。", image: "/assets/gan65-product-tight.jpg", ratio: "1:1", size: "1K", model: "三万蕉 2", template: "全平台主图 · v2" },
  ],
};

export const templates = {
  "digital-set": [
    ["目标站点", "Amazon 日本站"], ["目标人群", "需要多设备充电的商务与差旅用户"], ["核心卖点", "65W 三口快充，小体积便携"], ["视觉方向", "科技感、可信、克制的商业摄影"],
  ],
  "general-set": [["商品名称", "GAN65-BK 三口氮化镓充电器"], ["目标平台与地区", "Amazon 日本站"], ["主要购买理由", "一颗满足笔记本、平板与手机补能"], ["品牌调性", "专业、精密、简洁"]],
  "digital-main": [["目标站点", "Amazon 日本站"], ["主图数量", "4 张"], ["首要卖点", "65W 三口快充"], ["必须保留", "产品接口、Logo、颜色和真实比例"]],
} as const;

export const ragChunks = [
  { title: "65W 三口快充参数", meta: "商品事实 · B-018 · 接口与功率", text: "USB-C ×2、USB-A ×1；单口最高输出 65W。", search: "65W 三口 USB-C USB-A 功率参数", selected: true },
  { title: "办公桌多设备场景", meta: "场景资料 · B-024 · 日本站", text: "适用于笔记本、平板和手机同时补能的桌面场景。", search: "办公桌 笔记本 手机 平板 使用场景", selected: true },
  { title: "GaN 便携卖点", meta: "商品事实 · B-021 · 产品优势", text: "小体积设计，适合办公与旅行携带。", search: "GaN 轻巧 出差 便携 卖点", selected: false },
];

export const promptDemoInput: Record<string, string | number> = {
  platform: "Amazon 日本站",
  target_market_country: "日本",
  output_language: "中文",
  main_image_count: 4,
  detail_image_count: 6,
  main_image_ratio: "1:1",
  detail_image_ratio: "3:4",
  product_name: "GAN65-BK 三口氮化镓充电器",
  brand_name: "PicAgent Demo",
  product_category: "3C 数码配件",
  selling_points: "65W 三口快充，小体积便携",
  product_parameters: "USB-C x2、USB-A x1；单口最高 65W",
  target_audience: "需要多设备充电的商务与差旅用户",
  usage_scenarios: "办公桌、差旅、咖啡店移动办公",
  positioning: "专业便携，中高端",
  design_style: "科技感、可信、克制的商业摄影",
  forbidden_content: "不得改变接口、Logo、颜色和真实比例",
  other_requirements: "图中文字清晰，适配日本站",
  main_image_type: "全部",
  model_requirement: "自动判断",
  model_type: "亚洲商务人士",
  forbid_face: "否",
  allow_image_text: "允许",
  seafood_type: "冷冻",
  product_specification: "500g/袋",
  net_weight: "500g",
  origin: "以商品实物信息为准",
  storage_method: "冷冻保存",
  shipping_method: "冷链配送",
  serving_method: "充分加热后食用",
};

export const promptCards = [
  { id: "clean", title: "产品白底图精修", tags: ["白底", "系统预置"], text: "保留产品真实外观、颜色、材质、品牌标识和关键结构，清理杂乱背景并生成干净白底商品图。", body: "请基于上传的商品源图进行产品白底图精修：保持产品主体、外形、颜色、材质、品牌标识和关键文字一致；清理杂乱背景并生成纯白背景商品图，边缘自然，不添加虚构内容。" },
  { id: "main", title: "主图卖点强化", tags: ["主图", "卖点"], text: "突出一个核心卖点，保留产品真实结构，适用于电商主图首屏和卖点图。", body: "基于产品白底图生成电商主图：保持产品外观与品牌标识真实，围绕一个核心卖点组织画面，构图清晰，主体突出，保留文字安全区。" },
  { id: "detail", title: "详情页整套规划", tags: ["详情页", "套图"], text: "生成有顺序的详情页图片计划，覆盖场景、卖点、参数和购买理由。", body: "生成一套详情页图片计划：按首图、场景、核心卖点、细节参数、购买理由的顺序组织，每张图片输出独立的中文生图提示词，不编造产品信息。" },
];

export const styles = [
  { title: "极简商业摄影", text: "柔和棚拍光线、克制留白、清晰产品轮廓。", tags: ["电商", "通用"] },
  { title: "环保自然叙事", text: "自然材质、柔和日光、可持续生活方式场景。", tags: ["环保", "场景"] },
  { title: "科技精密感", text: "冷静中性背景、细节光、理性构图和参数秩序。", tags: ["3C", "卖点"] },
];

const now = "2026-09-08T10:00:00.000Z";
const defaultSuiteConfig: SuiteConfigDraft = {
  platform: "Amazon 日本站",
  language: "中文",
  mainImageCount: 4,
  detailImageCount: 6,
  category: "3C 数码配件",
  facts: "",
  selectedChunkIds: ["chunk-1", "chunk-2"],
};

function version(id: string, url: string, template = "通用白底精修") {
  return {
    id,
    version: 1,
    url,
    createdAt: now,
    template,
    status: "ready" as const,
  };
}

function asset(
  projectId: string,
  id: string,
  type: Asset["type"],
  name: string,
  url: string,
  category?: string,
): Asset {
  return {
    id,
    projectId,
    type,
    name,
    dimensions: "1024x1024",
    url,
    status: "ready",
    version: 1,
    category,
    versions: [version(`${id}-v1`, url)],
  };
}

export const mockProjects: Project[] = [
  {
    id: "proj-demo",
    name: "充电宝主图套图",
    productName: "GAN65-BK 三口氮化镓充电器",
    outputTargets: ["base", "suite"],
    sourceCount: 4,
    updatedAt: now,
    suiteConfigDraft: defaultSuiteConfig,
    assets: [
      asset("proj-demo", "source-1", "source", "充电宝-正面.jpg", "/assets/gan65-product.jpg"),
      asset("proj-demo", "source-2", "source", "充电宝-接口.jpg", "/assets/gan65-product-tight.jpg"),
      asset("proj-demo", "base-1", "base", "充电宝-白底.png", "/mock-assets/base-1.png"),
      asset("proj-demo", "base-2", "base", "充电宝-白底-v2.png", "/mock-assets/base-2.png"),
      asset("proj-demo", "suite-1", "suite", "主图 01", "/mock-assets/suite-1.png", "main"),
      asset("proj-demo", "suite-2", "suite", "使用场景", "/mock-assets/suite-2.png", "scene"),
    ],
  },
];

export const mockBaseImages: Record<string, Asset["versions"]> = {
  "source-1": [version("base-1-v1", "/mock-assets/base-1.png")],
  "source-2": [version("base-2-v1", "/mock-assets/base-2.png")],
};

export const mockSuiteTasks: SuiteTask[] = [
  { id: "task-1", projectId: "proj-demo", title: "品牌主图", category: "main", status: "ready", progress: 100, sourceAssetId: "base-1", resultAssetId: "suite-1", position: { x: 40, y: 80 } },
  { id: "task-2", projectId: "proj-demo", title: "办公桌场景", category: "scene", status: "ready", progress: 100, sourceAssetId: "base-1", resultAssetId: "suite-2", position: { x: 360, y: 80 } },
  { id: "task-3", projectId: "proj-demo", title: "核心卖点", category: "selling-point", status: "generating", progress: 60, sourceAssetId: "base-2", position: { x: 680, y: 80 } },
];

export const mockSearchChunks = [
  { id: "chunk-1", title: "65W 三口快充参数", meta: "商品事实 · B-018", text: "USB-C x2、USB-A x1，单口最高输出 65W。" },
  { id: "chunk-2", title: "办公桌多设备场景", meta: "场景资料 · B-024", text: "适用于笔记本、平板和手机同时补能的桌面场景。" },
  { id: "chunk-3", title: "GaN 便携卖点", meta: "商品事实 · B-021", text: "小体积设计，适合办公与旅行携带。" },
];

function wait<T>(value: T, delay = 2000): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), delay));
}

export async function mockGenerateBaseImage(imageId: string): Promise<Asset["versions"][number]> {
  return wait(version(`${imageId}-${Date.now()}`, "/mock-assets/base-new.png"));
}

export async function mockGenerateHeroImage(
  assetId: string,
  params: { ratio: string; sellingPoint?: string; template: string; stylePrompt?: string; moduleId: string; moduleParameters: GenerationModuleParameter[]; generationSnapshot?: GenerationSnapshot }
): Promise<Asset["versions"][number]> {
  console.log("mockGenerateHeroImage", { assetId, params });
  return wait(version(`${assetId}-${Date.now()}`, "/mock-assets/hero-new.png", params.template));
}

export async function mockGenerateSuite(taskId: string, params?: { template?: string; stylePrompt?: string; moduleId?: string; moduleParameters?: GenerationModuleParameter[]; generationSnapshot?: GenerationSnapshot }): Promise<{ taskId: string; url: string }> {
  console.log("mockGenerateSuite", { taskId, params });
  return wait({ taskId, url: "/mock-assets/suite-new.png" });
}

export async function mockGeneratePlan(config: SuiteConfigDraft) {
  return wait({
    mainAssignments: `${config.mainImageCount} 张主图分配`,
    detailAssignments: `${config.detailImageCount} 张详情图分配`,
    style: "冷静、可信、克制的商业产品摄影",
    missingFacts: config.facts ? [] : ["补充品牌色与包装信息"],
  });
}

export async function mockGenerateCategoryPrompts() {
  return wait({ generated: true });
}

export async function mockEditImage(assetId: string) {
  return wait(version(`${assetId}-edited-${Date.now()}`, "/mock-assets/suite-edited.png", "编辑版本"));
}
