import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { mockProjects } from "../src/api/fixtures";

const project = mockProjects[0];

test("hero workspace renders the complete inline configuration instead of a dialog prompt", async () => {
  const module = await import("../src/pages/HeroImageWorkspace").catch(() => ({}));
  const Component = (module as any).HeroImageWorkspace as React.ComponentType<any>;
  assert.ok(Component);
  const html = renderToStaticMarkup(
    <Component
      project={project}
      selectionMode={false}
      selectedIds={[]}
      onSelectedIdsChange={() => undefined}
      onSelectAsset={() => undefined}
      onToast={() => undefined}
      focusAssetId={null}
      generationConfig={null}
    />,
  );
  assert.match(html, /generation-workspace/);
  assert.doesNotMatch(html, /设计简报/);
  assert.doesNotMatch(html, /促销信息/);
  assert.match(html, /自定义/);
  assert.match(html, /首屏 KV/);
  assert.match(html, /权益保障/);
  assert.doesNotMatch(html, /点击左侧工具栏的&quot;配置&quot;按钮/);
});

test("suite workspace renders all long-form planning controls without the lineage canvas", async () => {
  const module = await import("../src/pages/SuiteWorkspace").catch(() => ({}));
  const Component = (module as any).SuiteWorkspace as React.ComponentType<any>;
  assert.ok(Component);
  const html = renderToStaticMarkup(<Component project={project} onToast={() => undefined} />);
  assert.match(html, /generation-workspace/);
  assert.doesNotMatch(html, /创作指令/);
  assert.match(html, /自定义/);
  assert.match(html, /详细规格\/参数表/);
  assert.match(html, /博主推荐图/);
  assert.match(html, /根据商品资料规划每张图要讲什么/);
  assert.doesNotMatch(html, /套图血缘画布/);
});

test("project route accepts hero as a first-class workspace tab", () => {
  const routerSource = readFileSync(new URL("../src/routes/router.tsx", import.meta.url), "utf8");
  assert.match(routerSource, /search\.tab === "hero"/);
});
