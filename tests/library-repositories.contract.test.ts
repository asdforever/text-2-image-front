import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const sidebar = readFileSync("src/components/GlobalSidebar.tsx", "utf8");
const router = readFileSync("src/routes/router.tsx", "utf8");
const testList = readFileSync("src/pages/TestProductLibrariesPage.tsx", "utf8");
const testDetail = readFileSync("src/pages/TestProductLibraryDetailPage.tsx", "utf8");
const client = readFileSync("src/api/client.ts", "utf8");

test("仓库导航展示素材库和正式成品库，移除测试库入口", () => {
  assert.match(sidebar, /素材库/);
  assert.doesNotMatch(sidebar, /测试库/);
  assert.match(sidebar, /成品库/);
  assert.match(router, /\/test-product-libraries/);
});

test("测试库页面使用测试产品库接口并明确测试来源", () => {
  assert.match(testList, /listProductLibraries/);
  assert.match(testList, /测试库/);
  assert.doesNotMatch(testList, /publishProductionVersion/);
  assert.match(testDetail, /listProducts/);
  assert.match(testDetail, /deleteProduct/);
});

test("测试库详情可以按提示词来源识别和筛选测试成品", () => {
  assert.match(testDetail, /筛选提示词或版本/);
  assert.match(testDetail, /promptTemplateName/);
  assert.match(testDetail, /promptVersionNo/);
  assert.match(testDetail, /未记录提示词来源/);
});

test("测试库客户端按统一响应封装读取已解包的数据", () => {
  assert.match(client, /listProductLibraries\(\)\{return request<ApiTestProductLibrary\[\]>\("\/api\/test-product-libraries"\)/);
  assert.doesNotMatch(client, /listProductLibraries\(\).*then\(r=>r\.data\)/);
});
