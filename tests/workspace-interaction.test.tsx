import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { normalizeHeroConfig, normalizeSuiteConfig } from "../src/lib/generation-workspace";
import { GenerationImageStage } from "../src/components/generation-workspace/GenerationImageStage";
import { generationResultImages } from "../src/lib/generation-results";
import { GenerationTaskStatus } from "../src/components/generation-workspace/GenerationTaskStatus";
import type { Asset } from "../src/api/contracts";
import type { ApiCanvasGenerationStep } from "../src/api/client";

test("legacy reference selections cannot silently affect newly normalized generation drafts", () => {
  for (const normalize of [normalizeHeroConfig, normalizeSuiteConfig]) {
    const config = normalize({ referenceAssetIds: ["old-reference"], modulePlanId: "old-plan", modulePlanFingerprint: "old-fingerprint", planningBrief: "真实商品资料" });
    assert.deepEqual(config.referenceAssetIds, []);
    assert.equal(config.modulePlanId, undefined);
    assert.equal(config.planningBrief, "真实商品资料");
  }
});

test("results use actual lineage instead of classifying every generated asset as a hero", () => {
  const assets = ["old-hero", "old-suite", "unknown"].map(id => ({ id, type: "hero", name: `${id}.png`, url: `/${id}`, dimensions: "1086x1448" } as Asset));
  const steps = [
    { id: "m1", kind: "hero", title: "产品细节", outputAssetIds: ["old-hero"], batchId: "batch-old", parameters: { aspectRatio: "3:4", style: { label: "冷调精密" } } },
    { id: "m2", kind: "suite", title: "规格表", outputAssetIds: ["old-suite"], batchId: "batch-suite", parameters: {} },
  ] as ApiCanvasGenerationStep[];
  const hero = generationResultImages(assets, "hero", steps);
  assert.deepEqual(hero.map(item => item.id), ["old-hero", "unknown"]);
  assert.equal(hero[0].batchId, "batch-old");
  assert.match(hero[0].subtitle!, /实际尺寸 1086x1448.*生成比例 3:4.*冷调精密/);
  assert.equal(hero[1].groupLabel, "批次信息未记录");
  assert.deepEqual(generationResultImages(assets, "suite", steps).map(item => item.id), ["old-suite"]);
});

test("gallery presents readable captions before opening image details", () => {
  const html = renderToStaticMarkup(<GenerationImageStage images={[{ id: "a", name: "batch-internal-identifier.png", url: "/a.png" }]} emptyTitle="暂无图片" />);
  assert.match(html, /第 1 张/);
  assert.match(html, /生成图片 1/);
  assert.doesNotMatch(html, /<strong>batch-internal/);
  assert.match(html, /批次信息未记录/);
});

test("preparing a new task never displays previous batch completion", () => {
  const batch = { progress: { total: 6, succeeded: 6 }, modules: [] } as any;
  for (const status of ["planning", "compiling", "compiling_prompt"]) {
    const html = renderToStaticMarkup(<GenerationTaskStatus batch={batch} status={status} moduleCount={2} />);
    assert.doesNotMatch(html, /<progress|已完成|计划 6 张/);
  }
});

test("legacy single hero tasks retain frozen metadata and their own group without inventing a batch", () => {
  const asset = { id: "legacy", type: "hero", name: "legacy.png", url: "/legacy.png" } as Asset;
  const step = { id: "hero-task:old-task", kind: "hero", title: "旧主图", outputAssetIds: [asset.id], parameters: { style: { label: "原始风格" }, modelPreset: { label: "历史模型" }, aspectRatio: "1:1" } } as ApiCanvasGenerationStep;
  const [image] = generationResultImages([asset], "hero", [step]);
  assert.equal(image.groupId, "hero-task:old-task");
  assert.equal(image.batchId, undefined);
  assert.match(image.subtitle!, /1:1.*历史模型.*原始风格/);
});


test("批次标签读取冻结模式，不受当前页面模式影响", () => {
  const asset = { id: "result", type: "hero", name: "result.png", url: "/result.png" } as Asset;
  for (const [creationMode, label] of [["regular", "常规版"], ["professional", "专业版"], [undefined, "版本未记录"]] as const) {
    const step = { id: "step", kind: "hero", title: "细节图", outputAssetIds: [asset.id], batchId: "batch", creationMode, parameters: {} } as ApiCanvasGenerationStep;
    assert.match(generationResultImages([asset], "hero", [step])[0].groupLabel!, new RegExp(label));
  }
  const step = { id: "step", kind: "hero", outputAssetIds: [asset.id], batchId: "batch", creationMode: "professional", parameters: {} } as ApiCanvasGenerationStep;
  const batch = { id: "batch", creationMode: "regular", modules: [], slots: [{ generatedAssetId: asset.id }] } as any;
  assert.match(generationResultImages([asset], "hero", [step], batch)[0].groupLabel!, /常规版/);
});


test("版本隔离不会把未知归属的图片默认展示为常规版", () => {
  const assets = ["r", "p", "unknown"].map(id => ({ id, type: "hero", name: id, url: `/${id}` } as Asset));
  const steps = [
    { id: "r", kind: "hero", creationMode: "regular", outputAssetIds: ["r"], batchId: "r", parameters: {} },
    { id: "p", kind: "hero", creationMode: "professional", outputAssetIds: ["p"], batchId: "p", parameters: {} },
  ] as ApiCanvasGenerationStep[];
  assert.deepEqual(generationResultImages(assets, "hero", steps, null, "regular").map(image => image.id), ["r"]);
  assert.deepEqual(generationResultImages(assets, "hero", steps, null, "professional").map(image => image.id), ["p"]);
  assert.deepEqual(generationResultImages(assets, "hero", [], null, "regular"), []);
});
