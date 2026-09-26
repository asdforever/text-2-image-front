import assert from "node:assert/strict";
import test from "node:test";
import type { Asset, AssetLibrary } from "../src/types/asset";
import {
  fetchImageLibraries,
  fetchUsableLibraryImages,
  toggleLibraryAssetSelection,
  toLibraryProjectAssetInputs,
} from "../src/lib/base-image-library-selection";

const libraries: AssetLibrary[] = [
  { id: "images", name: "产品原图", description: "", assetType: "image", createdAt: "2026-09-10", updatedAt: "2026-09-10" },
  { id: "texts", name: "文案", description: "", assetType: "text", createdAt: "2026-09-10", updatedAt: "2026-09-10" },
];

const assets: Asset[] = [
  { id: "front", libraryId: "images", name: "front.png", assetType: "image", url: "https://example.test/front.png", width: 1200, height: 1200, createdAt: "2026-09-10", updatedAt: "2026-09-10" },
  { id: "missing-preview", libraryId: "images", name: "broken.png", assetType: "image", createdAt: "2026-09-10", updatedAt: "2026-09-10" },
  { id: "copy", libraryId: "images", name: "copy", assetType: "text", content: "hello", createdAt: "2026-09-10", updatedAt: "2026-09-10" },
];

test("loads only image libraries from the existing library API boundary", async () => {
  const result = await fetchImageLibraries(async () => libraries);
  assert.deepEqual(result.map((library) => library.id), ["images"]);
});

test("loads only image assets with usable previews", async () => {
  const result = await fetchUsableLibraryImages("images", async (libraryId) => {
    assert.equal(libraryId, "images");
    return assets;
  });
  assert.deepEqual(result.map((asset) => asset.id), ["front"]);
});

test("propagates a library loading failure for the picker error state", async () => {
  await assert.rejects(
    fetchImageLibraries(async () => { throw new Error("database unavailable"); }),
    /database unavailable/,
  );
});

test("toggles multiple selected assets and maps them to stable project origins", () => {
  const first = toggleLibraryAssetSelection([], assets[0]);
  const second = toggleLibraryAssetSelection(first, { ...assets[0], id: "side", name: "side.png", url: "https://example.test/side.png" });
  const removed = toggleLibraryAssetSelection(second, assets[0]);

  assert.deepEqual(second.map((asset) => asset.id), ["front", "side"]);
  assert.deepEqual(removed.map((asset) => asset.id), ["side"]);
  assert.deepEqual(toLibraryProjectAssetInputs(second), [
    { libraryId: "images", assetId: "front", name: "front.png", url: "https://example.test/front.png", width: 1200, height: 1200 },
    { libraryId: "images", assetId: "side", name: "side.png", url: "https://example.test/side.png", width: 1200, height: 1200 },
  ]);
});
