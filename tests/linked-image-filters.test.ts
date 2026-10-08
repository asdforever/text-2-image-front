import assert from "node:assert/strict";
import test from "node:test";
import { resolveImageFilters } from "../src/components/image-canvas/linked-image-filters";
import type { ImageBatchIndex } from "../src/components/image-canvas/image-batches";

const index: ImageBatchIndex = {
  batches: ["a", "b", "missing"].map(id => ({ id, label: id })),
  modules: ["detail", "scene", "missing"].map(id => ({ id, label: id })),
  membership: new Map([["a-detail", new Set(["a"])], ["a-scene", new Set(["a"])], ["b-detail", new Set(["b"])], ["untyped", new Set(["b"])], ["gone", new Set(["missing"])]]),
  moduleMembership: new Map([["a-detail", new Set(["detail"])], ["a-scene", new Set(["scene"])], ["b-detail", new Set(["detail"])], ["gone", new Set(["missing"])]]),
};
const ids = ["a-detail", "a-scene", "b-detail", "untyped", "source"];

test("menus only offer combinations with available images, in both directions", () => {
  const batch = resolveImageFilters(index, ids, "b", "all");
  assert.deepEqual(batch.modules.map(item => item.id), ["detail"]);
  assert.equal(batch.hasUnassignedModule, true);
  const module = resolveImageFilters(index, ids, "all", "scene", "module");
  assert.deepEqual(module.batches.map(item => item.id), ["a"]);
  assert.equal(module.hasUnassignedBatch, false);
  assert.deepEqual(resolveImageFilters(index, ids, "all", "all").batches.map(item => item.id), ["a", "b"]);
});

test("incompatible restored filters reset the other choice, preserving the user's latest intent", () => {
  const batch = resolveImageFilters(index, ids, "b", "scene");
  assert.equal(batch.batchId, "b"); assert.equal(batch.moduleId, "all");
  const module = resolveImageFilters(index, ids, "b", "scene", "module");
  assert.equal(module.batchId, "all"); assert.equal(module.moduleId, "scene");
  const gone = resolveImageFilters(index, ids, "missing", "missing");
  assert.equal(gone.batchId, "all"); assert.equal(gone.moduleId, "all");
});

test("unassigned options respect the other filter and empty projects recover to all", () => {
  const source = resolveImageFilters(index, ids, "unassigned", "detail");
  assert.equal(source.moduleId, "all");
  assert.deepEqual(source.modules, []); assert.equal(source.hasUnassignedModule, true);
  const untyped = resolveImageFilters(index, ids, "all", "unassigned", "module");
  assert.deepEqual(untyped.batches.map(item => item.id), ["b"]); assert.equal(untyped.hasUnassignedBatch, true);
  const empty = resolveImageFilters(index, [], "b", "scene");
  assert.equal(empty.batchId, "all"); assert.equal(empty.moduleId, "all");
  assert.deepEqual(empty.batches, []); assert.deepEqual(empty.modules, []);
});
