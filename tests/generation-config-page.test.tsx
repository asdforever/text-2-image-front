import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";

test("generation configuration page exposes directory management and save state", async () => {
  const module = await import("../src/pages/GenerationConfigPage").catch(() => ({}));
  const Component = (module as any).GenerationConfigPage as React.ComponentType<any>;
  assert.ok(Component);
  const html = renderToStaticMarkup(<Component />);
  assert.match(html, /生成配置/);
  assert.match(html, /电商市场/);
  assert.match(html, /生图模型/);
  assert.match(html, /图片风格/);
  assert.match(html, /主图模块/);
  assert.match(html, /详情页模块/);
  assert.match(html, /保存草稿/);
  assert.match(html, /发布配置/);
  assert.match(html, /新增市场/);
  assert.match(html, /配置类型/);
});

test("generation configuration route and sidebar entry are registered", () => {
  const router = readFileSync(new URL("../src/routes/router.tsx", import.meta.url), "utf8");
  const sidebar = readFileSync(new URL("../src/components/GlobalSidebar.tsx", import.meta.url), "utf8");
  assert.match(router, /generation-config/);
  assert.match(sidebar, /生成配置/);
});
