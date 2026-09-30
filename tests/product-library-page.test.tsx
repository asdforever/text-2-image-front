import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("正式产品库页面按项目资产浏览且没有手工发布入口", () => {
  const listPage = readFileSync(new URL("../src/pages/ProductLibrariesPage.tsx", import.meta.url), "utf8");
  const detailPage = readFileSync(new URL("../src/pages/ProductLibraryDetailPage.tsx", import.meta.url), "utf8");
  const projectArchive = readFileSync(new URL("../src/components/product-library/ProjectArchive.tsx", import.meta.url), "utf8");
  assert.match(listPage, /listProductionLibraries/);
  assert.match(listPage, /listProductionProducts/);
  assert.match(listPage, /workflow-project-card/);
  assert.match(listPage, /expandedProductId/);
  assert.match(listPage, /ImageBatchFilter/);
  assert.match(listPage, /ImageModuleFilter/);
  assert.match(listPage, /matchesProductionImageFilters/);
  assert.match(detailPage, /listProductionProducts/);
  assert.match(projectArchive, /product\.assets/);
  assert.match(projectArchive, /打开项目/);
  assert.doesNotMatch(detailPage, /publishProductionVersion/);
  assert.doesNotMatch(detailPage, /发布成功版本/);
  assert.doesNotMatch(detailPage, /成功版本标识/);
  assert.doesNotMatch(detailPage, /来源快照（JSON）/);
});
