import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { mockProjects } from "../src/api/fixtures";

test("normalization defaults selected modules to one image and clamps counts to one through four", async () => {
  const generation = await import("../src/lib/generation-workspace");
  const hero = generation.normalizeHeroConfig({
    selectedModuleIds: ["hero-kv", "hero-detail"],
    moduleCounts: { "hero-kv": 3, "hero-detail": 9, stale: 2 },
  });
  const suite = generation.normalizeSuiteConfig({
    selectedModuleIds: ["suite-hero", "suite-scene"],
    moduleCounts: { "suite-hero": 0 },
  });

  assert.deepEqual(hero.moduleCounts, { "hero-kv": 3, "hero-detail": 4 });
  assert.deepEqual(suite.moduleCounts, { "suite-hero": 1, "suite-scene": 1 });
});

test("module count validation rejects values outside the one through four range", async () => {
  const generation = await import("../src/lib/generation-workspace");
  const base = generation.normalizeHeroConfig({ selectedAssetIds: ["asset-1"], selectedModuleIds: ["hero-kv"] });
  assert.deepEqual(
    generation.validateHeroConfig({ ...base, moduleCounts: { "hero-kv": 5 } }),
    ["模块“hero-kv”生成张数需在 1-4 张之间"],
  );
});

test("generation snapshots preserve per-module image counts", async () => {
  const generation = await import("../src/lib/generation-config");
  const workspace = await import("../src/lib/generation-workspace");
  const config = generation.createDefaultGenerationConfig();
  const snapshot = generation.createGenerationSnapshot(config, {
    marketId: "domestic",
    modelId: "gpt-image-2-5",
    moduleIds: ["hero-kv"],
    moduleCounts: { "hero-kv": 3 },
  });

  assert.deepEqual(snapshot.moduleCounts, { "hero-kv": 3 });
  assert.equal(snapshot.modules[0].count, 3);
  assert.equal(workspace.HERO_MODULES[0].id, "hero-kv");
});

test("module selector exposes an image count control for selected modules", async () => {
  const components = await import("../src/components/generation-workspace/ModuleSelector");
  const workspace = await import("../src/lib/generation-workspace");
  const html = renderToStaticMarkup(
    React.createElement(components.ModuleSelector, {
      modules: workspace.HERO_MODULES,
      selectedIds: ["hero-kv"],
      max: 8,
      moduleCounts: { "hero-kv": 3 },
      onChange: () => undefined,
      onModuleCountChange: () => undefined,
    }),
  );

  assert.match(html, /生成张数/);
  assert.match(html, /value="3"/);
  assert.match(html, /value="4"/);
});

test("suite config panel no longer renders the standalone advanced settings section", async () => {
  const components = await import("../src/components/SuiteConfigPanel");
  const workspace = await import("../src/lib/generation-workspace");
  const html = renderToStaticMarkup(
    React.createElement(components.SuiteConfigPanel, {
      project: mockProjects[0],
      config: workspace.normalizeSuiteConfig(),
      onChange: () => undefined,
      onUpload: () => undefined,
    }),
  );

  assert.doesNotMatch(html, /高级设置/);
});
