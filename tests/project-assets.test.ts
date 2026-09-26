import assert from "node:assert/strict";
import test from "node:test";
import { validateProjectAssetBatch, validateProjectAssetInput, toProjectAssetInput, type ProjectAssetInput } from "../src/lib/project-assets";
import { useProjectStore } from "../src/store/useProjectStore";

test("validates supported image uploads and reports invalid files", () => {
  const valid: ProjectAssetInput = { name: "front.png", type: "image/png", size: 1024 };
  const invalid: ProjectAssetInput = { name: "notes.pdf", type: "application/pdf", size: 1024 };
  assert.deepEqual(validateProjectAssetInput(valid), { ok: true });
  assert.equal(validateProjectAssetInput(invalid).ok, false);
  assert.equal(validateProjectAssetBatch(Array.from({ length: 51 }, (_, index) => ({ name: `${index}.jpg`, type: "image/jpeg", size: 1 }))).at(-1)?.ok, false);
});

test("materializes browser file metadata without persisting File objects", () => {
  const input = toProjectAssetInput({ name: "front.jpg", type: "image/jpeg", size: 2048 });
  assert.deepEqual(input, { name: "front.jpg", type: "image/jpeg", size: 2048 });
  assert.equal("file" in input, false);
});

test("adds only valid assets to the requested project", () => {
  const store = useProjectStore.getState();
  store.resetDemoData();
  const first = store.createProject({ name: "空项目", productName: "产品", outputTargets: ["base"], sourceCount: 0 });
  const second = store.createProject({ name: "另一个项目", productName: "产品", outputTargets: ["base"], sourceCount: 0 });
  const result = useProjectStore.getState().addProjectAssets(first.id, [
    { name: "ok.png", type: "image/png", size: 20 },
    { name: "bad.pdf", type: "application/pdf", size: 20 },
  ]);
  assert.equal(result.added.length, 1);
  assert.equal(result.rejected.length, 1);
  assert.equal(useProjectStore.getState().projects.find((p) => p.id === first.id)?.assets.length, 1);
  assert.equal(useProjectStore.getState().projects.find((p) => p.id === second.id)?.assets.length, 0);
});

test("creates an empty project or materializes selected source metadata", () => {
  const store = useProjectStore.getState();
  store.resetDemoData();
  const empty = store.createProject({ name: "无素材项目", productName: "产品", outputTargets: ["base"], sourceCount: 0, sourceFiles: [] });
  assert.equal(empty.assets.length, 0);
  const withFiles = useProjectStore.getState().createProject({ name: "有素材项目", productName: "产品", outputTargets: ["base"], sourceCount: 0, sourceFiles: [{ name: "a.png", type: "image/png", size: 10, url: "/assets/gan65-product.jpg" }, { name: "b.jpg", type: "image/jpeg", size: 10, url: "/assets/gan65-product-tight.jpg" }] });
  assert.deepEqual(withFiles.assets.map((asset) => asset.name), ["a.png", "b.jpg"]);
  assert.equal(JSON.stringify(withFiles).includes("File"), false);
});

test("imports library images as project sources and preserves stable origin ids", () => {
  const store = useProjectStore.getState();
  store.resetDemoData();
  const project = store.createProject({ name: "素材库项目", productName: "产品", outputTargets: ["base"], sourceCount: 0 });

  const result = useProjectStore.getState().addLibraryAssets(project.id, [
    { libraryId: "library-a", assetId: "asset-1", name: "front.png", url: "https://example.test/front.png", width: 1200, height: 1200 },
    { libraryId: "library-a", assetId: "asset-2", name: "side.png", url: "https://example.test/side.png", width: 900, height: 1200 },
  ]);

  assert.deepEqual({ added: result.added.length, skipped: result.skipped.length }, { added: 2, skipped: 0 });
  const assets = useProjectStore.getState().projects.find((item) => item.id === project.id)?.assets ?? [];
  assert.deepEqual(assets.map((asset) => ({ type: asset.type, dimensions: asset.dimensions, source: asset.source })), [
    { type: "source", dimensions: "1200x1200", source: { kind: "asset-library", libraryId: "library-a", assetId: "asset-1" } },
    { type: "source", dimensions: "900x1200", source: { kind: "asset-library", libraryId: "library-a", assetId: "asset-2" } },
  ]);
});

test("skips a library image already imported into the same project", () => {
  const store = useProjectStore.getState();
  store.resetDemoData();
  const project = store.createProject({ name: "去重项目", productName: "产品", outputTargets: ["base"], sourceCount: 0 });
  const input = { libraryId: "library-a", assetId: "asset-1", name: "front.png", url: "https://example.test/front.png" };

  useProjectStore.getState().addLibraryAssets(project.id, [input]);
  const duplicate = useProjectStore.getState().addLibraryAssets(project.id, [input]);

  assert.deepEqual({ added: duplicate.added.length, skipped: duplicate.skipped.length }, { added: 0, skipped: 1 });
  assert.equal(useProjectStore.getState().projects.find((item) => item.id === project.id)?.assets.length, 1);
});

test("imports only new library images from a mixed batch", () => {
  const store = useProjectStore.getState();
  store.resetDemoData();
  const project = store.createProject({ name: "混合项目", productName: "产品", outputTargets: ["base"], sourceCount: 0 });
  const existing = { libraryId: "library-a", assetId: "asset-1", name: "front.png", url: "https://example.test/front.png" };
  const fresh = { libraryId: "library-a", assetId: "asset-2", name: "side.png", url: "https://example.test/side.png" };

  useProjectStore.getState().addLibraryAssets(project.id, [existing]);
  const mixed = useProjectStore.getState().addLibraryAssets(project.id, [existing, fresh]);

  assert.deepEqual(mixed.added.map((asset) => asset.source?.assetId), ["asset-2"]);
  assert.deepEqual(mixed.skipped.map((asset) => asset.assetId), ["asset-1"]);
});

test("creates collision-free ids for separate imports in the same millisecond", () => {
  const store = useProjectStore.getState();
  store.resetDemoData();
  const project = store.createProject({ name: "标识项目", productName: "产品", outputTargets: ["base"], sourceCount: 0 });
  const originalNow = Date.now;
  Date.now = () => 1234;
  try {
    const first = useProjectStore.getState().addLibraryAssets(project.id, [{ libraryId: "library-a", assetId: "asset-1", name: "front.png", url: "https://example.test/front.png" }]);
    const second = useProjectStore.getState().addLibraryAssets(project.id, [{ libraryId: "library-a", assetId: "asset-2", name: "side.png", url: "https://example.test/side.png" }]);
    assert.notEqual(first.added[0].id, second.added[0].id);
  } finally {
    Date.now = originalNow;
  }
});

test("allows the same library image to be imported into different projects", () => {
  const store = useProjectStore.getState();
  store.resetDemoData();
  const originalNow = Date.now;
  let nextTimestamp = 2000;
  Date.now = () => nextTimestamp++;
  let firstProject;
  let secondProject;
  try {
    firstProject = store.createProject({ name: "项目 A", productName: "产品", outputTargets: ["base"], sourceCount: 0 });
    secondProject = store.createProject({ name: "项目 B", productName: "产品", outputTargets: ["base"], sourceCount: 0 });
  } finally {
    Date.now = originalNow;
  }
  const input = { libraryId: "library-a", assetId: "asset-1", name: "front.png", url: "https://example.test/front.png" };

  const first = useProjectStore.getState().addLibraryAssets(firstProject.id, [input]);
  const second = useProjectStore.getState().addLibraryAssets(secondProject.id, [input]);

  assert.deepEqual([first.added.length, second.added.length], [1, 1]);
});
