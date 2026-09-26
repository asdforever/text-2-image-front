import { strict as assert } from "node:assert";
import { test } from "node:test";
import { projectApi, suiteApi } from "../src/api/client";

test("图片编辑会话创建请求携带项目和源版本", async () => {
  const previousFetch = globalThis.fetch;
  let request: { path: string; body: unknown } | undefined;
  globalThis.fetch = (async (input, init) => {
    request = { path: String(input), body: JSON.parse(String(init?.body ?? "{}")) };
    return new Response(JSON.stringify({ data: { id: "session-1", revision: 0, operations: [] } }), {
      status: 201,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
  try {
    await suiteApi.createImageEditSession("project-1", "asset-1");
  } finally {
    globalThis.fetch = previousFetch;
  }
  assert.equal(request?.path, "/api/image-editor/sessions");
  assert.deepEqual(request?.body, { projectId: "project-1", sourceVersionId: "asset-1" });
});

test("图片编辑操作保存请求携带服务端修订号", async () => {
  const previousFetch = globalThis.fetch;
  let request: { path: string; body: unknown } | undefined;
  globalThis.fetch = (async (input, init) => {
    request = { path: String(input), body: JSON.parse(String(init?.body ?? "{}")) };
    return new Response(JSON.stringify({ data: { id: "session-1", revision: 3, operations: [] } }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
  try {
    await suiteApi.upsertImageEditOperation("session-1", { operationId: "op-1", type: "erase" }, "移除背景", 2);
  } finally {
    globalThis.fetch = previousFetch;
  }
  assert.deepEqual(request?.body, {
    operation: { operationId: "op-1", type: "erase" },
    summary: "移除背景",
    expectedRevision: 2,
  });
});

test("白底图生成请求绑定原图与选定的提示词版本", async () => {
  const previousFetch = globalThis.fetch;
  let request: { path: string; body: unknown } | undefined;
  globalThis.fetch = (async (input, init) => {
    request = { path: String(input), body: JSON.parse(String(init?.body ?? "{}")) };
    return new Response(JSON.stringify({ data: { id: "task-1", status: "queued" } }), {
      status: 202,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
  try {
    await projectApi.generateWhiteBackground("project-1", "asset-1", {
      promptTemplateId: "template-1",
      promptVersionId: "version-1",
      promptBody: "保留商品主体，生成纯白背景商品图",
    });
  } finally {
    globalThis.fetch = previousFetch;
  }
  assert.equal(request?.path, "/api/projects/project-1/assets/asset-1/white-background-generations");
  assert.deepEqual(request?.body, {
    promptTemplateId: "template-1",
    promptVersionId: "version-1",
    promptBody: "保留商品主体，生成纯白背景商品图",
  });
});

test("正式产品库客户端创建产品并发布版本", async () => {
  const previousFetch = globalThis.fetch;
  const requests: Array<{ path: string; body: unknown }> = [];
  globalThis.fetch = (async (input, init) => {
    requests.push({ path: String(input), body: init?.body ? JSON.parse(String(init.body)) : null });
    return new Response(JSON.stringify({ data: { id: "product-1", versions: [] } }), { status: 201, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  try {
    await suiteApi.createProductionLibrary({ name: "正式成品库", description: "主图" });
    await suiteApi.createProductionProduct("library-1", { name: "鼠标主图", projectId: "project-1" });
    await suiteApi.publishProductionVersion("library-1", "product-1", { productType: "hero", sourceVersion: { id: "version-1", status: "succeeded" } });
  } finally {
    globalThis.fetch = previousFetch;
  }
  assert.deepEqual(requests.map((item) => [item.path, item.body]), [
    ["/api/product-libraries", { name: "正式成品库", description: "主图" }],
    ["/api/product-libraries/library-1/products", { name: "鼠标主图", projectId: "project-1" }],
    ["/api/product-libraries/library-1/products/product-1/versions/publish", { productType: "hero", sourceVersion: { id: "version-1", status: "succeeded" } }],
  ]);
});
