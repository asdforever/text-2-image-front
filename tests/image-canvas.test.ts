import test from "node:test";
import assert from "node:assert/strict";
import { canvasImages, restoreCanvas, serializeCanvas, type CanvasImage } from "../src/components/image-canvas/model";
import type { ApiProjectAsset, ApiWorkbench } from "../src/api/client";
import * as model from "../src/components/image-canvas/model";

const image: CanvasImage = { id: "asset:a", title: "商品", category: "source", url: "/a.png", width: 800, height: 600, versions: [] };
test("风格统一恢复真实来源和提示词时沿用旧占位卡片的位置", () => {
  const step = { id: "style-harmonization:task", kind: "style-harmonization", title: "局部风格统一", sourceAssetIds: ["source", "reference"], outputAssetIds: ["candidate"], outputVersionIds: [], taskPrompt: "暖色柔光", finalPrompt: "保留商品与文字，暖色柔光", constraints: {}, parameters: {}, canRegenerate: false };
  const wb = { suite: { id: "p" }, tasks: [], inputImages: [], generationSteps: [step] } as unknown as ApiWorkbench;
  const assets = ["source", "reference", "candidate"].map((id) => ({ id, filename: id, kind: id === "candidate" ? "generated" : "source", state: "available", width: 800, height: 800 })) as ApiProjectAsset[];
  const images = canvasImages(wb, assets);
  const graph = model.canvasGraph(images, wb, assets);
  assert.equal(graph.steps.length, 1);
  assert.deepEqual(graph.steps[0].sourceNodeIds, ["asset:source", "asset:reference"]);
  assert.equal(model.imagePrompt(images.find((i) => i.assetId === "candidate")!), "保留商品与文字，暖色柔光");
  const nodes = restoreCanvas(images, { nodes: [{ nodeId: "generation:unknown:asset:candidate", x: 1250, y: 320 }], groups: [] }, graph);
  assert.deepEqual(nodes.find((n) => n.id === "generation:style-harmonization:task")?.position, { x: 1250, y: 320 });
});
test("移出和分组坐标跨刷新保持原位，新图不移动旧图", () => {
  const layout = { nodes: [{ nodeId: "asset:a", x: 130, y: 250, groupKey: "g", hidden: true }], groups: [{ groupKey: "g", title: "候选", x: 100, y: 200, width: 500, height: 500 }] };
  const nodes = restoreCanvas([image, { ...image, id: "asset:b" }], layout);
  assert.deepEqual(nodes.find((n) => n.id === image.id)?.position, { x: 30, y: 50 });
  assert.equal(nodes.find((n) => n.id === image.id)?.hidden, true);
  const serialized = serializeCanvas(nodes);
  assert.deepEqual(serialized.nodes[0], layout.nodes[0]);
  assert.equal((serialized.groups[0] as { title?: string }).title, "候选");
});
test("项目资产接入不依赖旧任务，清理中的资产不可见", () => {
  const wb = { suite: { id: "p" }, tasks: [], inputImages: [], layout: null } as unknown as ApiWorkbench;
  const assets = [{ id: "a", kind: "generated", state: "available", filename: "主图.png", width: 800, height: 600 }, { id: "b", kind: "source", state: "deleted" }] as ApiProjectAsset[];
  const result = canvasImages(wb, assets);
  assert.equal(result.length, 1);
  assert.equal(result[0].assetId, "a");
  assert.equal(result[0].url, "/api/projects/p/assets/a/preview");
  assert.equal(result[0].category, "generated");
});
test("编辑结果和对应项目资产只展示一次", () => {
  const wb = { suite: { id: "p" }, tasks: [], inputImages: [], imageEditChildren: [{ task: { id: "edit", status: "succeeded", summary: "编辑结果" }, versions: [{ id: "v", versionNumber: 1, previewUrl: "/api/projects/p/assets/a/preview" }], attempts: [], snapshot: null }] } as unknown as ApiWorkbench;
  const assets = [{ id: "a", kind: "generated", state: "available", filename: "结果.png", width: 800, height: 600 }] as ApiProjectAsset[];
  const result = canvasImages(wb, assets);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, "edit-child:edit");
  assert.equal(result[0].assetId, "a");
});

test("真实来源组成两级生成链、同一步骤分叉，缺失来源不猜测", () => {
  const steps = [
    { id: "white-step", kind: "white", title: "白底", sourceAssetIds: ["s"], outputAssetIds: ["w"], outputVersionIds: [], finalPrompt: "白底快照", taskPrompt: "", constraints: {}, parameters: {} },
    { id: "hero-step", kind: "hero", title: "主图", sourceAssetIds: ["w"], outputAssetIds: ["h1", "h2"], outputVersionIds: [], finalPrompt: "完整快照", taskPrompt: "场景提示词", constraints: { style: { content: "原始风格" } }, parameters: { resolution: "2K" } },
  ];
  const wb = { suite: { id: "p" }, tasks: [], inputImages: [], generationSteps: steps } as unknown as ApiWorkbench;
  const assets = ["s", "w", "h1", "h2", "orphan"].map((id) => ({ id, kind: id === "s" ? "source" : id === "w" ? "white_background" : "generated", state: "available", filename: id, width: 800, height: 800 })) as ApiProjectAsset[];
  assert.equal(typeof model.canvasGraph, "function", "需要生成真实连线的投影");
  const images = canvasImages(wb, assets);
  const graph = model.canvasGraph(images, wb, assets);
  assert.deepEqual(graph.edges.map((e) => [e.source, e.target]), [["asset:s", "generation:white-step"], ["generation:white-step", "asset:w"], ["asset:w", "generation:hero-step"], ["generation:hero-step", "asset:h1"], ["generation:hero-step", "asset:h2"], ["generation:unknown:asset:orphan", "asset:orphan"]]);
  assert.equal(graph.steps.find((s) => s.id === "unknown:asset:orphan")?.missingSource, true);
  assert.equal(images.find((i) => i.assetId === "h1")?.category, "hero");
  const nodes = restoreCanvas(images, null, graph);
  assert.ok(nodes.find((n) => n.id === "asset:s")!.position.x < nodes.find((n) => n.id === "asset:w")!.position.x);
  const saved = serializeCanvas(nodes);
  assert.ok(saved.nodes.some((n) => n.nodeId === "generation:hero-step"));
  assert.deepEqual(serializeCanvas(restoreCanvas(images, saved, graph)), saved);
});

test("白底图编辑版本与资产合并，历史版本仍有自己的生成节点，草稿不冒充快照", () => {
  const versions = [{ id: "v1", versionNumber: 1, previewUrl: "/old-signed.png" }, { id: "v2", versionNumber: 2, previewUrl: "/new.png" }];
  const steps = versions.map((v, i) => ({ id: v.id, kind: "white", title: "白底图", sourceAssetIds: ["s"], outputAssetIds: [i ? "w2" : "w1"], outputVersionIds: [v.id], finalPrompt: `快照${i}`, taskPrompt: "", constraints: {}, parameters: {} }));
  const wb = { suite: { id: "p" }, tasks: [], inputImages: [], generationSteps: steps, imageEditChildren: [{ task: { id: "t", status: "succeeded", currentVersionId: "v2" }, versions, attempts: [] }] } as unknown as ApiWorkbench;
  const assets = ["s", "w1", "w2"].map((id) => ({ id, kind: id === "s" ? "source" : "white_background", state: "available", filename: id, width: 800, height: 800 })) as ApiProjectAsset[];
  const images = canvasImages(wb, assets);
  assert.equal(images.filter((i) => i.category === "white").length, 1);
  assert.equal(images.find((i) => i.editTask)?.assetId, "w2");
  const history = model.canvasGraph(images, wb, assets, true);
  assert.equal(history.steps.length, 2);
  const withDownstream = { ...wb, generationSteps: [...steps, { ...steps[0], id: "hero", kind: "hero", sourceAssetIds: ["w1"], outputAssetIds: ["h"], outputVersionIds: [] }] };
  const withOutput = [...assets, { ...assets[0], id: "h", kind: "generated" } as ApiProjectAsset];
  const retained = canvasImages(withDownstream, withOutput);
  assert.ok(retained.some((i) => i.id === "asset:w1"), "下游引用的旧版本仍作为真实输入图保留");
  assert.deepEqual(model.canvasGraph(retained, withDownstream, withOutput).steps.find((s) => s.id === "hero")?.sourceNodeIds, ["asset:w1"]);
  const draft = { ...image, id: "task:draft", category: "hero", task: { promptDraft: "尚未生成的新草稿" }, versions: [] } as CanvasImage;
  assert.equal(model.canvasGraph([draft], wb, []).steps[0].finalPrompt, "");
});

test("迭代版本保持图片节点不变，切换图同步提示词和来源，失败保留旧图", () => {
  const steps = [{ id: "step", kind: "hero", title: "主图", sourceAssetIds: ["white"], outputAssetIds: ["old"], outputVersionIds: [], taskPrompt: "原提示词", finalPrompt: "原完整提示词", constraints: {}, parameters: {} }];
  const track = { stepId: "step", title: "主图", kind: "hero", originalAssetIds: ["old"], currentAssetIds: ["new"], revisions: [
    { ...steps[0], id: "original", number: 1, status: "succeeded", outputs: [{ index: 0, assetId: "old" }] },
    { ...steps[0], id: "r2", number: 2, status: "succeeded", taskPrompt: "新版提示词", finalPrompt: "新版完整提示词", outputs: [{ index: 0, assetId: "new" }] },
    { ...steps[0], id: "r3", number: 3, status: "failed", outputs: [] },
  ] };
  const wb = { suite: { id: "p" }, tasks: [], inputImages: [], generationSteps: steps, generationTracks: [track] } as unknown as ApiWorkbench;
  const assets = ["white", "old", "new"].map((id) => ({ id, filename: id, kind: id === "white" ? "white_background" : "generated", state: "available", width: 800, height: 800 })) as ApiProjectAsset[];
  const images = canvasImages(wb, assets);
  const current = images.find((i) => i.id === "asset:old")!;
  assert.equal(current.assetId, "new");
  assert.equal(current.version?.versionNumber, 2);
  assert.equal(current.versions.length, 2);
  assert.equal(model.imagePrompt(current), "新版完整提示词");
  assert.equal(images.some((i) => i.id === "asset:new"), false);
  const graph = model.canvasGraph(images, wb, assets);
  assert.equal(graph.steps.find((s) => s.outputNodeIds.includes("asset:old"))?.taskPrompt, "新版提示词");
  const layout = { nodes: [{ nodeId: "asset:old", x: 1550, y: 52 }, { nodeId: "generation:step", x: 1143, y: 36 }, { nodeId: "generation:step:revision:r2", x: 48, y: 1820 }], groups: [] };
  const updatedNodes = restoreCanvas(images, layout, graph);
  const promptNode = updatedNodes.find((n) => n.data.step?.outputNodeIds.includes("asset:old"));
  assert.equal(promptNode?.id, "generation:step", "切换图片版本应复用原提示词节点");
  assert.deepEqual(promptNode?.position, { x: 1143, y: 36 }, "V2 不应跑到之前误存的画布底部");
  track.currentAssetIds = ["old"];
  const previous = canvasImages(wb, assets).find((i) => i.id === "asset:old")!;
  assert.equal(previous.assetId, "old");
  assert.equal(model.imagePrompt(previous), "原完整提示词");
  // 原批次后续重试补出的图仍保留原提示词与来源，不变成未知来源。
  steps[0].outputAssetIds.push("late");
  const withLate = [...assets, { ...assets[1], id: "late", filename: "late" }];
  const lateImages = canvasImages(wb, withLate);
  assert.equal(model.canvasGraph(lateImages, wb, withLate).steps.find((s) => s.outputNodeIds.includes("asset:late"))?.taskPrompt, "原提示词");
});

test("当前提示词原位切换，同时保留被下游引用的旧图及独立历史提示词", () => {
  const white = { id: "white-step", kind: "white", title: "白底图", sourceAssetIds: ["source"], outputAssetIds: ["white-old"], outputVersionIds: [], taskPrompt: "白底原版", finalPrompt: "白底原版", constraints: {}, parameters: {} };
  const hero = { ...white, id: "hero-step", kind: "hero", sourceAssetIds: ["white-old"], outputAssetIds: ["hero"], taskPrompt: "使用旧白底生成", finalPrompt: "使用旧白底生成" };
  const track = { stepId: white.id, title: "白底图", kind: "white", originalAssetIds: ["white-old"], currentAssetIds: ["white-new"], revisions: [
    { ...white, id: "original", number: 1, status: "succeeded", outputs: [{ index: 0, assetId: "white-old" }] },
    { ...white, id: "r2", number: 2, status: "succeeded", taskPrompt: "白底新版", finalPrompt: "白底新版", outputs: [{ index: 0, assetId: "white-new" }] },
  ] };
  const wb = { suite: { id: "p" }, tasks: [], inputImages: [], generationSteps: [white, hero], generationTracks: [track] } as unknown as ApiWorkbench;
  const assets = ["source", "white-old", "white-new", "hero"].map((id) => ({ id, state: "available", kind: id === "source" ? "source" : id.startsWith("white") ? "white_background" : "generated", filename: id, width: 800, height: 800 })) as ApiProjectAsset[];
  const images = canvasImages(wb, assets);
  const graph = model.canvasGraph(images, wb, assets);
  assert.equal(graph.steps.find((s) => s.id === "white-step")?.taskPrompt, "白底新版");
  assert.equal(graph.steps.find((s) => s.id === "white-step:revision:original")?.taskPrompt, "白底原版");
  assert.deepEqual(graph.steps.find((s) => s.id === "hero-step")?.sourceNodeIds, ["history:white-old"]);
  assert.equal(new Set(graph.steps.map((s) => s.id)).size, graph.steps.length);
  assert.ok(graph.edges.some((e) => e.source === "generation:white-step" && e.target === "asset:white-old"));
  assert.ok(graph.edges.some((e) => e.source === "generation:white-step:revision:original" && e.target === "history:white-old"));
});
