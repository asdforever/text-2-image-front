import test from "node:test";
import assert from "node:assert/strict";
import { filterPromptTemplates, countPromptTemplatesByCategory, type PromptCategoryFilter } from "../src/lib/prompt-categories";

const items = [
  { id: "1", name: "主图卖点", code: "hero.sales", kind: "text_to_image", categoryId: "cat-hero" },
  { id: "2", name: "详情规划", code: "suite.detail", kind: "text_to_text", categoryId: "cat-detail" },
  { id: "3", name: "白底精修", code: "base.clean", kind: "image_to_image", categoryId: null },
];

test("filters prompt templates by category and query", () => {
  assert.deepEqual(filterPromptTemplates(items, "cat-hero", "卖点").map((item) => item.id), ["1"]);
  assert.deepEqual(filterPromptTemplates(items, "uncategorized", "").map((item) => item.id), ["3"]);
  assert.deepEqual(filterPromptTemplates(items, "all", "suite").map((item) => item.id), ["2"]);
});

test("counts categorized, uncategorized, and all prompt templates", () => {
  const filters: PromptCategoryFilter[] = ["all", "uncategorized", "cat-hero", "cat-detail"];
  assert.deepEqual(countPromptTemplatesByCategory(items, filters), {
    all: 3,
    uncategorized: 1,
    "cat-hero": 1,
    "cat-detail": 1,
  });
});
