import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const router = readFileSync(new URL("../src/routes/router.tsx", import.meta.url), "utf8");
const createDialog = readFileSync(new URL("../src/components/ProjectCreateDialog.tsx", import.meta.url), "utf8");
const sidebar = readFileSync(new URL("../src/components/GlobalSidebar.tsx", import.meta.url), "utf8");
const taskCenter = readFileSync(new URL("../src/pages/TaskCenterPage.tsx", import.meta.url), "utf8");

test("v2 router exposes global navigation branches", () => {
  for (const path of ["/workspace", "/projects", "/prompts", "/tasks"]) assert.match(router, new RegExp(path.replace("/", "\\/")));
});

test("project creation supports an optional product image", () => {
  assert.match(createDialog, /type="file"/);
  assert.doesNotMatch(createDialog, /上传素材/);
});

test("global sidebar labels and task actions are present", () => {
  for (const label of ["工作台", "项目管理", "提示词商城", "任务中心"]) assert.match(sidebar, new RegExp(label));
  assert.match(taskCenter, /重试/);
  assert.match(taskCenter, /进入项目/);
});
