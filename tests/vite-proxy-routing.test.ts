import assert from "node:assert/strict";
import test from "node:test";

import createViteConfig, { selectApiProxyTarget } from "../vite.config";

const viteConfig = createViteConfig({ command: "serve", mode: "test" });

test("suite 与 input-image 已切换路径进入 FastAPI", () => {
  const env = {
    VITE_FASTAPI_PROXY_TARGET: "http://127.0.0.1:8000",
  };

  assert.equal(selectApiProxyTarget("/api/suites", env), env.VITE_FASTAPI_PROXY_TARGET);
  assert.equal(selectApiProxyTarget("/api/suites/abc", env), env.VITE_FASTAPI_PROXY_TARGET);
  assert.equal(selectApiProxyTarget("/api/suites/abc/input-images?ordinal=2", env), env.VITE_FASTAPI_PROXY_TARGET);
  assert.equal(
    selectApiProxyTarget("/api/suites/abc/input-images/image-1/preview/original", env),
    env.VITE_FASTAPI_PROXY_TARGET,
  );
  assert.equal(selectApiProxyTarget("/api/projects", env), env.VITE_FASTAPI_PROXY_TARGET);
  assert.equal(selectApiProxyTarget("/api/projects/project-1/assets/asset-1/preview", env), env.VITE_FASTAPI_PROXY_TARGET);
  assert.equal(selectApiProxyTarget("/api/generation-config", env), env.VITE_FASTAPI_PROXY_TARGET);
  assert.equal(selectApiProxyTarget("/api/generation-config/draft", env), env.VITE_FASTAPI_PROXY_TARGET);
  assert.equal(selectApiProxyTarget("/api/generation-config/versions/2", env), env.VITE_FASTAPI_PROXY_TARGET);
  assert.equal(selectApiProxyTarget("/api/prompt-categories", env), env.VITE_FASTAPI_PROXY_TARGET);
  assert.equal(selectApiProxyTarget("/api/prompt-categories/category-1", env), env.VITE_FASTAPI_PROXY_TARGET);
  assert.equal(selectApiProxyTarget("/api/prompt-templates", env), env.VITE_FASTAPI_PROXY_TARGET);
  assert.equal(selectApiProxyTarget("/api/prompt-templates/template-1/versions", env), env.VITE_FASTAPI_PROXY_TARGET);
  assert.equal(selectApiProxyTarget("/api/prompt-versions/version-1", env), env.VITE_FASTAPI_PROXY_TARGET);
});


test("画布读取、布局、任务与引用使用实际 Vite 代理进入 FastAPI", () => {
  const env = { VITE_FASTAPI_PROXY_TARGET: "http://127.0.0.1:8000" };
  const paths = [
    "/api/generation-worker/status",
    "/api/suites/abc/workbench", "/api/suites/abc/workbench/layout",
    "/api/model-connections", "/api/model-connections?scope=current",
    "/api/suites/abc/tasks", "/api/suites/abc/generation",
    "/api/suites/abc/library/references?targetType=task", "/api/suites/abc/library/references/ref-1",
    "/api/suite-tasks/task-1", "/api/suite-tasks/task-1/generation",
    "/api/suite-tasks/task-1/versions", "/api/suite-tasks/task-1/versions/version-1/select",
    "/api/suite-tasks/task-1/archive",
  ];
  for (const path of paths) {
    assert.equal(selectApiProxyTarget(path, env), env.VITE_FASTAPI_PROXY_TARGET, path);
    const route = Object.entries(viteConfig.server!.proxy!).find(([pattern]) => pattern.startsWith("^") ? new RegExp(pattern).test(path) : path.startsWith(pattern));
    assert.equal(route?.[1], process.env.VITE_FASTAPI_PROXY_TARGET ?? env.VITE_FASTAPI_PROXY_TARGET, `实际代理 ${path}`);
  }
});

test("测试库、健康检查及所有 API 路径统一进入 FastAPI", () => {
  const env = {
    VITE_FASTAPI_PROXY_TARGET: "http://127.0.0.1:8000",
  };

  for (const path of ["/api/test-product-libraries", "/api/test-product-libraries/library-1/products", "/api/health", "/api/ready", "/api/suites/abc/plan"]) {
    assert.equal(selectApiProxyTarget(path, env), env.VITE_FASTAPI_PROXY_TARGET);
    const route = Object.entries(viteConfig.server!.proxy!).find(([pattern]) => pattern.startsWith("^") ? new RegExp(pattern).test(path) : path.startsWith(pattern));
    assert.equal(route?.[1], process.env.VITE_FASTAPI_PROXY_TARGET ?? env.VITE_FASTAPI_PROXY_TARGET);
  }
});
