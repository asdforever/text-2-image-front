import assert from "node:assert/strict";
import test from "node:test";
import {
  ALL_BATCHES,
  ALL_MODULES,
  buildProductionImageFilterIndex,
  matchesProductionImageFilters,
} from "../src/components/product-library/product-image-filters";

test("成品库筛选索引读取批次和模块快照", () => {
  const product = {
    id: "product-1",
    libraryId: "library-1",
    name: "鼠标项目",
    projectId: "project-1",
    archivedAt: null,
    versions: [],
    assets: [
      {
        id: "source-1", kind: "source", sourceKind: "upload", originalFilename: "mouse.png",
        mimeType: "image/png", fileSize: 1, width: 1, height: 1, previewUrl: "/source", sourceSnapshot: {}, versions: [],
      },
      {
        id: "hero-1", kind: "generated", sourceKind: "generated", originalFilename: "hero.png",
        mimeType: "image/png", fileSize: 1, width: 1, height: 1, previewUrl: "/hero", sourceSnapshot: {}, versions: [
          { id: "version-hero", productType: "hero", sourceSnapshot: {
            batchId: "batch-a", batchCreatedAt: "2026-09-29T10:00:00Z",
            configSnapshot: { selection: { module: { id: "module-kv", label: "首屏 KV", mode: "hero" } } },
          }, previewUrl: null, status: "published" },
        ],
      },
      {
        id: "long-1", kind: "generated", sourceKind: "long_image", originalFilename: "详情长图.png",
        mimeType: "image/png", fileSize: 1, width: 1, height: 1, previewUrl: "/long", sourceSnapshot: { kind: "long_image" }, versions: [
          { id: "version-long", productType: "detail", sourceSnapshot: {
            batchId: "batch-b", batchCreatedAt: "2026-09-28T10:00:00Z",
          }, previewUrl: null, status: "published" },
        ],
      },
    ],
  } as const;

  const index = buildProductionImageFilterIndex(product);
  assert.equal(index.batches.length, 2);
  assert.deepEqual(index.modules.map(item => item.id), ["module-kv", "source", "long_image"]);
  assert.equal(matchesProductionImageFilters(index, "batch-a", "module-kv", "hero-1", "version-hero"), true);
  assert.equal(matchesProductionImageFilters(index, "batch-a", "long_image", "hero-1", "version-hero"), false);
  assert.equal(matchesProductionImageFilters(index, ALL_BATCHES, "module-kv", "hero-1", "version-hero"), true);
  assert.equal(matchesProductionImageFilters(index, "batch-b", ALL_MODULES, "long-1", "version-long"), true);
  assert.equal(matchesProductionImageFilters(index, "batch-b", "module-kv", "long-1", "version-long"), false);
});

test("没有批次或模块快照的素材落入未分组筛选", () => {
  const product = {
    id: "product-1", libraryId: "library-1", name: "项目", projectId: null, archivedAt: null, versions: [],
    assets: [{ id: "source-1", kind: "source", sourceKind: "upload", originalFilename: "a.png", mimeType: "image/png", fileSize: 1, width: 1, height: 1, previewUrl: "/a", sourceSnapshot: {}, versions: [] }],
  } as const;
  const index = buildProductionImageFilterIndex(product);
  assert.equal(matchesProductionImageFilters(index, "unassigned", "source", "source-1"), true);
  assert.equal(matchesProductionImageFilters(index, ALL_BATCHES, "source", "source-1"), true);
});
