import assert from "node:assert/strict";
import test from "node:test";
import type { ApiCanvasGenerationStep, ApiProjectAsset, ApiWorkbench } from "../src/api/client";
import { imageBatchIndex, matchesImageBatch, matchesImageFilters, filterCanvasByBatch } from "../src/components/image-canvas/image-batches";
import { canvasImages, canvasGraph, restoreCanvas, serializeCanvas } from "../src/components/image-canvas/model";

const asset = (id: string, sourceAssetId: string | null = null): ApiProjectAsset => ({ id, sourceAssetId, generationSnapshotId: null, kind: id === "source" ? "source" : "generated", sourceKind: "generated", filename: id, state: "available", mimeType: "image/png", byteSize: 100, width: 800, height: 800, sha256: id, createdAt: "2026-09-29T00:00:00Z" });
const step = (id: string, outputs: string[], sources: string[], batchId?: string): ApiCanvasGenerationStep => ({ id, kind: "hero", title: id, sourceAssetIds: sources, outputAssetIds: outputs, outputVersionIds: [], finalPrompt: "", taskPrompt: "", constraints: {}, parameters: {}, batchId, batchCreatedAt: batchId === "b" ? "2026-09-29T02:00:00Z" : "2026-09-29T01:00:00Z" });
const wb = (steps: ApiCanvasGenerationStep[]) => ({ suite: { id: "p" }, inputImages: [], tasks: [], generationSteps: steps, layout: null } as unknown as ApiWorkbench);

test("batch ownership follows edits and aliases but never absorbs an explicitly different batch", () => {
  const assets = [asset("source"), asset("a"), asset("b", "a"), asset("edit-2", "edit-1"), asset("edit-1", "b"), { ...asset("edit-3"), generationSnapshotId: "edit-v3" }];
  const workbench = wb([step("a-step", ["a"], ["source"], "a"), step("b-step", ["b"], ["a"], "b")]);
  workbench.imageEditChildren = [{ task: { id: "edit-task" }, snapshot: { sourceVersionId: "edit-2" }, attempts: [], versions: [{ id: "edit-v3", versionNumber: 1 }] }];
  const index = imageBatchIndex(workbench, assets);
  assert.deepEqual(index.batches.map(batch => batch.id), ["b", "a"]);
  assert.equal(matchesImageBatch(index, "b", "edit-3"), true);
  assert.equal(matchesImageBatch(index, "a", "edit-3"), false);
  assert.equal(matchesImageBatch(index, "unassigned", "source"), true);
  assert.equal(matchesImageBatch(index, "all", "unknown"), true);
});

test("all track versions retain original batch membership unless a revision records its own batch", () => {
  const base = step("track", ["v1"], ["source"], "a");
  const workbench = wb([base]);
  workbench.generationTracks = [{ stepId: "track", kind: "hero", title: "任务", originalAssetIds: ["v1"], currentAssetIds: ["v3"], revisions: [1, 2, 3].map(number => ({ ...base, batchId: number === 3 ? "b" : undefined, id: `r${number}`, number, status: "succeeded", createdAt: "2026-09-29T00:00:00Z", outputs: [{ assetId: `v${number}`, index: 0 }] })) }];
  const index = imageBatchIndex(workbench, [asset("v1"), asset("v2"), asset("v3")]);
  assert.equal(matchesImageBatch(index, "a", "v2"), true);
  assert.equal(matchesImageBatch(index, "a", "v3"), false);
  assert.equal(matchesImageBatch(index, "b", "v3"), true);
});

test("canvas filtering retains upstream context, excludes siblings, and leaves the canonical saved layout untouched", () => {
  const assets = [asset("source"), asset("a1"), asset("a2"), asset("b")];
  const workbench = wb([step("a-step", ["a1", "a2"], ["source"], "a"), step("b-step", ["b"], ["source"], "b")]);
  const images = canvasImages(workbench, assets), graph = canvasGraph(images, workbench, assets);
  const nodes = restoreCanvas(images, { groups: [], nodes: [{ nodeId: "asset:a2", x: 30, y: 20, hidden: true }] }, graph);
  const saved = serializeCanvas(nodes);
  const filtered = filterCanvasByBatch(nodes, graph, imageBatchIndex(workbench, assets), "a");
  assert.deepEqual(filtered.filter(node => !node.hidden).map(node => node.id).sort(), ["asset:a1", "asset:source", "generation:a-step"]);
  assert.equal(filtered.find(node => node.id === "asset:a2")!.hidden, true);
  assert.deepEqual(serializeCanvas(nodes), saved);
  assert.equal(filterCanvasByBatch(nodes, graph, imageBatchIndex(workbench, assets), "all"), nodes);
});

test("cyclic missing lineage stays unassigned, and mixed groups cannot move hidden batches", () => {
  const assets = [asset("a"), asset("b"), asset("x", "y"), asset("y", "x")];
  const workbench = wb([step("a-step", ["a"], [], "a"), step("b-step", ["b"], [], "b")]);
  const index = imageBatchIndex(workbench, assets);
  assert.equal(matchesImageBatch(index, "unassigned", "x"), true);
  const images = canvasImages(workbench, assets), graph = canvasGraph(images, workbench, assets);
  const nodes = restoreCanvas(images, { groups: [{ groupKey: "g", x: 0, y: 0, width: 600, height: 500 }], nodes: [{ nodeId: "asset:a", x: 0, y: 0, groupKey: "g" }, { nodeId: "asset:b", x: 300, y: 0, groupKey: "g" }] }, graph);
  const group = filterCanvasByBatch(nodes, graph, index, "a").find(node => node.id === "g")!;
  assert.equal(group.hidden, false);
  assert.equal(group.draggable, false);
  assert.equal(group.selectable, false);
});


test("batch and module filters intersect; module identity spans batches and edits without guessing from task titles", () => {
  const detail = { id: "hero-detail", label: "细节特写", mode: "hero" };
  const scene = { id: "hero-scene", label: "使用场景", mode: "hero" };
  const workbench = wb([
    { ...step("first custom title", ["a-detail"], ["source"], "a"), parameters: { module: detail } },
    { ...step("second custom title", ["b-detail"], ["source"], "b"), parameters: { module: detail } },
    { ...step("another scene", ["b-scene"], ["source"], "b"), parameters: { module: scene } },
    step("细节特写", ["unknown"], ["a-detail"], "c"),
  ]);
  const assets = [asset("source"), asset("a-detail"), asset("b-detail"), asset("b-scene"), asset("edited-detail", "b-detail"), asset("unknown")];
  const index = imageBatchIndex(workbench, assets);
  const select = (batch: string, module: string) => assets.filter(asset => matchesImageFilters(index, batch, module, asset.id)).map(asset => asset.id);
  assert.deepEqual(select("all", "hero-detail"), ["a-detail", "b-detail", "edited-detail"]);
  assert.deepEqual(select("b", "hero-detail"), ["b-detail", "edited-detail"]);
  assert.deepEqual(select("a", "hero-scene"), []);
  assert.deepEqual(select("all", "hero-scene"), ["b-scene"]);
  assert.deepEqual(select("all", "unassigned"), ["source", "unknown"]);
  assert.equal(index.modules.length, 2);
  const images = canvasImages(workbench, assets), graph = canvasGraph(images, workbench, assets);
  const nodes = restoreCanvas(images, null, graph);
  const visible = filterCanvasByBatch(nodes, graph, index, "b", "hero-detail").filter(node => !node.hidden).map(node => node.id);
  assert.ok(visible.includes("asset:source"));
  assert.ok(visible.includes("asset:b-detail"));
  assert.ok(visible.includes("asset:edited-detail"));
  assert.ok(!visible.includes("asset:a-detail"));
  assert.ok(!visible.includes("asset:b-scene"));
});


test("画布与长图的批次选项标注常规版、专业版，未记录时不猜测", () => {
  const workbench = wb([
    { ...step("regular", ["r"], [], "r"), creationMode: "regular" },
    { ...step("professional", ["p"], [], "p"), creationMode: "professional" },
    step("unknown", ["u"], [], "u"),
  ]);
  const index = imageBatchIndex(workbench, [asset("r"), asset("p"), asset("u")]);
  assert.match(index.batches.find(item => item.id === "r")!.label, /常规版/);
  assert.match(index.batches.find(item => item.id === "p")!.label, /专业版/);
  assert.match(index.batches.find(item => item.id === "u")!.label, /版本未记录/);
});
