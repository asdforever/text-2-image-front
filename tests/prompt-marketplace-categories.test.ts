import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync("src/components/PromptMarketplace/PromptMarketplacePageNew.tsx", "utf8");
const sidebar = readFileSync("src/components/PromptMarketplace/PromptSidebar.tsx", "utf8");
const client = readFileSync("src/api/client.ts", "utf8");

test("prompt marketplace exposes category lifecycle APIs and filtering", () => {
  assert.match(client, /listPromptCategories/);
  assert.match(client, /createPromptCategory/);
  assert.match(client, /updatePromptCategory/);
  assert.match(client, /deletePromptCategory/);
  assert.match(page, /activeCategory/);
  assert.match(page, /filterPromptTemplates/);
  assert.match(page, /categoryId/);
  assert.match(sidebar, /未分类/);
  assert.match(sidebar, /分类管理/);
});
