import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

test("default generation config seeds concrete domestic and overseas platforms", async () => {
  const config = await import("../src/lib/generation-config");
  const value = config.createDefaultGenerationConfig();

  assert.ok(value.markets.length >= 3);
  assert.ok(value.markets.some((market) => market.id === "taobao" && market.marketScope === "domestic"));
  assert.ok(value.markets.some((market) => market.id === "jd" && market.marketScope === "domestic"));
  assert.ok(value.markets.some((market) => market.id === "amazon" && market.marketScope === "overseas"));
  assert.equal(value.markets.some((market) => market.id === "domestic" || market.id === "international"), false);
  assert.equal(value.marketBindings.domestic, undefined);
  assert.equal(value.marketBindings.taobao, null);
});

test("persisted legacy domestic and international markets migrate to concrete platforms and bindings", async () => {
  const store = await import("../src/store/useGenerationConfigStore");
  const legacyMarket = { id: "domestic", label: "国内电商", platforms: "淘宝、天猫", guidance: "旧国内规范", defaultLanguage: "中文" };
  const legacyOverseas = { id: "international", label: "国外电商", platforms: "Amazon、Shopify", guidance: "旧国外规范", defaultLanguage: "英文" };
  const domesticBinding = { promptTemplateId: "tpl-market", promptVersionId: "ver-domestic" };
  const overseasBinding = { promptTemplateId: "tpl-market", promptVersionId: "ver-overseas" };

  const migrated = store.normalizePersistedGenerationConfigState({
    published: { version: 4, markets: [legacyMarket, legacyOverseas], marketBindings: { domestic: domesticBinding, international: overseasBinding } },
    draft: { markets: [legacyMarket, legacyOverseas], marketBindings: { domestic: domesticBinding, international: overseasBinding } },
  });

  assert.equal(migrated.published.markets.some((market) => market.id === "domestic" || market.id === "international"), false);
  assert.ok(migrated.published.markets.some((market) => market.id === "taobao" && market.marketScope === "domestic"));
  assert.ok(migrated.published.markets.some((market) => market.id === "amazon" && market.marketScope === "overseas"));
  assert.deepEqual(migrated.published.marketBindings.taobao, domesticBinding);
  assert.deepEqual(migrated.published.marketBindings.amazon, overseasBinding);
  assert.deepEqual(migrated.draft.marketBindings.taobao, domesticBinding);
  assert.deepEqual(migrated.draft.marketBindings.amazon, overseasBinding);
  assert.equal(migrated.published.marketBindings.domestic, undefined);
});

test("legacy project generation drafts normalize aggregate market ids to concrete platforms", async () => {
  const workspace = await import("../src/lib/generation-workspace");
  assert.equal(workspace.normalizeHeroConfig({ market: "domestic" }).market, "taobao");
  assert.equal(workspace.normalizeSuiteConfig({ market: "international" }).market, "amazon");
});

test("market selector renders domestic and overseas groups with concrete platform options", async () => {
  const store = await import("../src/store/useGenerationConfigStore");
  const components = await import("../src/components/generation-workspace/MarketSelector");
  store.useGenerationConfigStore.getState().resetConfig();
  const html = renderToStaticMarkup(<components.MarketSelector value="taobao" onChange={() => undefined} />);

  assert.match(html, /国内/);
  assert.match(html, /国外/);
  assert.match(html, /淘宝/);
  assert.match(html, /亚马逊/);
  assert.doesNotMatch(html, /<option[^>]*value="domestic"/);
  assert.match(html, /<option value="taobao" selected="">淘宝<\/option>/);
});

test("generation configuration page groups concrete market CRUD cards by scope", async () => {
  const store = await import("../src/store/useGenerationConfigStore");
  const page = await import("../src/pages/GenerationConfigPage");
  store.useGenerationConfigStore.getState().resetConfig();
  const html = renderToStaticMarkup(<page.GenerationConfigPage />);

  assert.match(html, /data-market-scope="domestic"/);
  assert.match(html, /data-market-scope="overseas"/);
  assert.match(html, /国内/);
  assert.match(html, /国外/);
  assert.match(html, /淘宝/);
  assert.match(html, /亚马逊/);
});

test("market CRUD keeps the selected domestic or overseas scope", async () => {
  const store = await import("../src/store/useGenerationConfigStore");
  store.useGenerationConfigStore.getState().resetConfig();
  assert.equal(store.useGenerationConfigStore.getState().addMarket({
    id: "market-overseas-custom",
    label: "独立站",
    marketScope: "overseas",
    platforms: "自建站",
    guidance: "按品牌规范展示",
    defaultLanguage: "英文",
  }), true);
  const added = store.useGenerationConfigStore.getState().draft.markets.find((market) => market.id === "market-overseas-custom");
  assert.equal(added?.marketScope, "overseas");
});
