import assert from "node:assert/strict";
import test from "node:test";

import { projectApi, toWorkbenchProject } from "../src/api/client";

test("项目客户端以幂等 JSON 请求创建项目，并读取活跃项目", async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ path: string; init?: RequestInit }> = [];
  globalThis.fetch = (async (path: string | URL | Request, init?: RequestInit) => {
    calls.push({ path: String(path), init });
    const project = { id: "project-1", name: "键盘项目", status: "active", archivedAt: null, createdAt: "2026-09-14T00:00:00Z", updatedAt: "2026-09-14T00:00:00Z" };
    const data = init?.method === "POST" ? project : [project];
    return new Response(JSON.stringify({ data }), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;

  try {
    const created = await projectApi.create("键盘项目");
    const projects = await projectApi.list();

    assert.equal(created.id, "project-1");
    assert.deepEqual(projects.map((project) => project.id), ["project-1"]);
    assert.equal(calls[0].path, "/api/projects");
    assert.equal(calls[0].init?.method, "POST");
    assert.match(String((calls[0].init?.headers as Record<string, string>)["idempotency-key"]), /\S/);
    assert.deepEqual(JSON.parse(String(calls[0].init?.body)), { name: "键盘项目" });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("项目详情映射为现有工作台资产视图且预览走受控接口", () => {
  const project = toWorkbenchProject({
    id: "project-1",
    name: "键盘项目",
    status: "active",
    archivedAt: null,
    createdAt: "2026-09-14T00:00:00Z",
    updatedAt: "2026-09-14T00:00:00Z",
    selections: { source: "asset-1" },
    assets: [{ id: "asset-1", kind: "source", sourceAssetId: null, generationSnapshotId: null, state: "active", filename: "keyboard.png", mimeType: "image/png", byteSize: 2048, width: 1200, height: 800, sha256: "a".repeat(64), createdAt: "2026-09-14T00:00:00Z" }],
  });

  assert.equal(project.sourceCount, 1);
  assert.deepEqual(project.assets[0], {
    id: "asset-1",
    projectId: "project-1",
    type: "source",
    name: "keyboard.png",
    dimensions: "1200x800",
    url: "/api/projects/project-1/assets/asset-1/preview",
    status: "ready",
    version: 1,
    source: { kind: "upload" },
    versions: [{ id: "asset-1-v1", version: 1, url: "/api/projects/project-1/assets/asset-1/preview", createdAt: "2026-09-14T00:00:00Z", template: "原始上传", status: "ready" }],
  });
});
