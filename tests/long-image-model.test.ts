import test from "node:test";
import assert from "node:assert/strict";
import { longImageSources, longImageLayout, newLongImageItem } from "../src/components/image-canvas/long-image-model";
import type { ApiLongImageRecipe, ApiProjectAsset, ApiWorkbench } from "../src/api/client";

const assets = [
  { id: "old", width: 101, height: 51, state: "available", filename: "旧图", kind: "generated" },
  { id: "new", width: 80, height: 120, state: "available", filename: "新图", kind: "generated" },
  { id: "deleted", width: 10, height: 10, state: "deleted", filename: "失效图" },
] as ApiProjectAsset[];
const recipe = (overrides: Partial<ApiLongImageRecipe> = {}): ApiLongImageRecipe => ({ title: "详情", width: 320, gap: 7, background: "#ffffff", items: [newLongImageItem("old"), newLongImageItem("new")], ...overrides });

test("先舍入四边裁剪像素再等比缩放，间距只在图片之间且留白独立累计", () => {
  const value = recipe();
  value.items[0] = { ...value.items[0], crop: { left: 5, right: 10, top: 10, bottom: 0 }, paddingTop: 11, paddingBottom: 13 };
  const result = longImageLayout(value, assets);
  assert.deepEqual(result.errors, []);
  assert.equal(result.height, 682); // cropped 86×46 => 171, +24+7+480
  assert.deepEqual(result.segments[0], { assetId: "old", x: 5, y: 5, cropWidth: 86, cropHeight: 46, height: 171, top: 11 });
  assert.equal(result.segments[1].top, 202);
});

test("缺失来源和超限输出不可保存，小图放大明确提示", () => {
  assert.match(longImageLayout(recipe({ items: [newLongImageItem("deleted")] }), assets).errors.join(), /不可用/);
  assert.match(longImageLayout(recipe({ width: 1600, items: Array.from({ length: 20 }, () => newLongImageItem("new")) }), assets).errors.join(), /30000|3200/);
  assert.match(longImageLayout(recipe({ width: 319 }), assets).errors.join(), /320/);
  assert.match(longImageLayout(recipe(), assets).warnings.join(), /放大/);
  assert.match(longImageLayout(recipe({ items: [] }), assets).errors.join(), /选择/);
});

test("选图显示模块和固定历史版本，同模块不同版本均保留", () => {
  const workbench = { suite: { id: "p" }, tasks: [], generationTracks: [{ stepId: "hero", title: "场景主图", currentAssetIds: ["new"], revisions: [{ number: 1, outputs: [{ index: 0, assetId: "old" }] }, { number: 2, outputs: [{ index: 0, assetId: "new" }] }] }] } as unknown as ApiWorkbench;
  const sources = longImageSources(workbench, assets);
  assert.deepEqual(sources.map((source) => [source.asset.id, source.title]), [["old", "场景主图 · 图 1 · V1"], ["new", "场景主图 · 图 1 · V2"]]);
  workbench.generationTracks![0].currentAssetIds[0] = "old";
  assert.deepEqual(longImageSources(workbench, assets).map((source) => source.asset.id), ["old", "new"]);
});

test("极小图四边舍入后保留至少一像素，标题超过80字符拒绝保存", () => {
  const tiny = { ...assets[0], width: 2, height: 2 };
  const value = recipe({ items: [{ ...newLongImageItem("old"), crop: { top: 45, bottom: 45, left: 45, right: 45 } }] });
  const layout = longImageLayout(value, [tiny]);
  assert.deepEqual(layout.errors, []);
  assert.deepEqual(layout.segments[0], { assetId: "old", x: 1, y: 1, cropWidth: 1, cropHeight: 1, height: 320, top: 0 });
  assert.match(longImageLayout({ ...value, title: "长".repeat(81) }, [tiny]).errors.join(), /80/);
});
