import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { mockProjects } from "../src/api/fixtures";
import { HERO_MODULES, STYLE_CATEGORIES, SUITE_MODULES } from "../src/lib/generation-workspace";
import { useGenerationConfigStore } from "../src/store/useGenerationConfigStore";

async function loadComponents() {
  return import("../src/components/generation-workspace").catch(() => ({}));
}

test("workspace layout renders independent config and result regions with a sticky footer", async () => {
  const components = await loadComponents() as Record<string, React.ComponentType<any>>;
  const Layout = components.GenerationWorkspaceLayout;
  assert.ok(Layout);
  const html = renderToStaticMarkup(
    <Layout
      config={<div>配置内容</div>}
      footer={<button>开始生成</button>}
      result={<div>结果内容</div>}
      collapsed={false}
      onCollapsedChange={() => undefined}
    />,
  );
  assert.match(html, /generation-workspace/);
  assert.match(html, /generation-config-scroll/);
  assert.match(html, /generation-config-footer/);
  assert.match(html, /generation-result/);
  assert.match(html, /开始生成/);
});

test("asset picker exposes selected source assets and the current mode limit", async () => {
  const components = await loadComponents() as Record<string, React.ComponentType<any>>;
  const ProductAssetPicker = components.ProductAssetPicker;
  assert.ok(ProductAssetPicker);
  const assets = mockProjects[0].assets.filter((asset) => asset.type === "base");
  const html = renderToStaticMarkup(
    <ProductAssetPicker assets={assets} selectedIds={[assets[0].id]} max={8} onChange={() => undefined} onUpload={() => undefined} />,
  );
  assert.match(html, /产品素材/);
  assert.ok(html.includes("已选 1/8"));
  assert.match(html, new RegExp(assets[0].name));
  assert.match(html, /aria-pressed="true"/);
});

test("prompt, settings, style, and module controls render their live summaries", async () => {
  const components = await loadComponents() as Record<string, React.ComponentType<any>>;
  const CountedPromptField = components.CountedPromptField;
  const OutputSettings = components.OutputSettings;
  const StyleLibrary = components.StyleLibrary;
  const ModuleSelector = components.ModuleSelector;
  assert.ok(CountedPromptField && OutputSettings && StyleLibrary && ModuleSelector);

  const html = renderToStaticMarkup(<>
    <CountedPromptField label="设计简报" value="科技感" maxLength={300} onChange={() => undefined} pro />
    <OutputSettings value={{ outputLanguage: "中文", model: "GPT Image 2.5", aspectRatio: "1:1", resolution: "标准 1K" }} onChange={() => undefined} />
    <StyleLibrary categories={STYLE_CATEGORIES} selectedId="precision" onChange={() => undefined} />
    <ModuleSelector modules={HERO_MODULES} selectedIds={["hero-kv"]} max={8} onChange={() => undefined} />
  </>);
  assert.match(html, /科技感/);
  assert.match(html, /3\/300/);
  assert.match(html, /专业版/);
  assert.match(html, /GPT Image 2.5/);
  assert.match(html, /冷调精密/);
  assert.match(html, /已选 1\/8/);
});

test("style library puts a custom style editor before preset categories", async () => {
  const components = await loadComponents() as Record<string, React.ComponentType<any>>;
  const StyleLibrary = components.StyleLibrary;
  assert.ok(StyleLibrary);
  const html = renderToStaticMarkup(
    <StyleLibrary
      categories={STYLE_CATEGORIES}
      selectedId="style-custom"
      customStyle="产品置于暖色木质桌面，保持真实材质"
      onChange={() => undefined}
      onCustomStyleChange={() => undefined}
    />,
  );
  assert.ok(html.indexOf("自定义") < html.indexOf("基础风格"));
  assert.match(html, /产品置于暖色木质桌面，保持真实材质/);
  assert.match(html, /placeholder="描述你希望的图片风格/);
});

test("selected modules render editable parameter rows without opening editors for other modules", async () => {
  const components = await loadComponents() as Record<string, React.ComponentType<any>>;
  const ModuleSelector = components.ModuleSelector;
  assert.ok(ModuleSelector);
  const html = renderToStaticMarkup(
    <ModuleSelector
      modules={SUITE_MODULES}
      selectedIds={["suite-scene"]}
      max={5}
      moduleParameters={{ "suite-scene": [{ key: "场景地点", value: "办公桌" }] }}
      onChange={() => undefined}
      onModuleParametersChange={() => undefined}
    />,
  );
  assert.match(html, /使用场景图/);
  assert.match(html, /场景地点/);
  assert.match(html, /办公桌/);
  assert.match(html, /添加参数/);
  assert.doesNotMatch(html, /首屏主视觉.*补充说明/);
});

test("generation footer keeps validation errors adjacent to the primary action", async () => {
  const components = await loadComponents() as Record<string, React.ComponentType<any>>;
  const GenerationFooter = components.GenerationFooter;
  assert.ok(GenerationFooter);
  const html = renderToStaticMarkup(
    <GenerationFooter label="生成主图" countLabel="已选 0/8" errors={["请至少选择 1 张产品素材"]} busy={false} onSubmit={() => undefined} />,
  );
  assert.match(html, /role="alert"/);
  assert.match(html, /请至少选择 1 张产品素材/);
  assert.match(html, /生成主图/);
});

test("recent configuration and market controls expose a concise recoverable summary", async () => {
  const components = await loadComponents() as Record<string, React.ComponentType<any>>;
  const RecentConfigCard = components.RecentConfigCard;
  const MarketSelector = components.MarketSelector;
  assert.ok(RecentConfigCard && MarketSelector);
  const html = renderToStaticMarkup(<>
    <RecentConfigCard updatedAt="2026-09-13T10:00:00.000Z" summary="1:1 方图 · 已选 3 个模块" onRestore={() => undefined} onDismiss={() => undefined} />
    <MarketSelector value="taobao" onChange={() => undefined} />
  </>);
  assert.match(html, /继续上次的配置/);
  assert.match(html, /1:1 方图 · 已选 3 个模块/);
  assert.match(html, /国内/);
  assert.match(html, /国外/);
  assert.match(html, /淘宝/);
  assert.match(html, /亚马逊/);
});

test("output settings keep model ids", async () => {
  const components = await loadComponents() as Record<string, React.ComponentType<any>>;
  const OutputSettings = components.OutputSettings;
  useGenerationConfigStore.getState().resetConfig();
  const html = renderToStaticMarkup(<OutputSettings value={{ outputLanguage: "中文", model: "gpt-image-2-5", aspectRatio: "1:1", resolution: "标准 1K" }} onChange={() => undefined} />);
  assert.match(html, /value="gpt-image-2-5"/);
});

test("output settings keep a custom market language selectable", async () => {
  const components = await loadComponents() as Record<string, React.ComponentType<any>>;
  const OutputSettings = components.OutputSettings;
  useGenerationConfigStore.getState().resetConfig();
  const html = renderToStaticMarkup(<OutputSettings value={{ outputLanguage: "Español", model: "gpt-image-2-5", aspectRatio: "1:1", resolution: "标准 1K" }} onChange={() => undefined} />);
  assert.match(html, /Español/);
});
