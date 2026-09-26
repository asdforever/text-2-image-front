import assert from "node:assert/strict";
import test from "node:test";

import { ApiResultUnknownError, generationConfigApi, projectApi, suiteApi } from "../src/api/client";
import { sharedReadCache } from "../src/lib/read-cache";

const project = {
  id: "project-1",
  name: "缓存项目",
  status: "active" as const,
  archivedAt: null,
  createdAt: "2026-09-24T00:00:00Z",
  updatedAt: "2026-09-24T00:00:00Z",
};

test("project reads deduplicate and a successful mutation invalidates list and detail", async () => {
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const path = String(input);
    calls.push(`${init?.method ?? "GET"} ${path}`);
    const data = path === "/api/projects/project-1" ? { ...project, assets: [], selections: {} } : path === "/api/projects/project-1/archive" ? project : [project];
    return new Response(JSON.stringify({ data }), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;

  try {
    sharedReadCache.clear();
    await Promise.all([projectApi.list(), projectApi.list(), projectApi.get(project.id), projectApi.get(project.id)]);
    assert.deepEqual(calls, ["GET /api/projects", "GET /api/projects/project-1"]);

    await projectApi.archive(project.id);
    await Promise.all([projectApi.list(), projectApi.get(project.id)]);
    assert.deepEqual(calls, [
      "GET /api/projects",
      "GET /api/projects/project-1",
      "POST /api/projects/project-1/archive",
      "GET /api/projects",
      "GET /api/projects/project-1",
    ]);
  } finally {
    sharedReadCache.clear();
    globalThis.fetch = originalFetch;
  }
});

test("an unknown mutation result preserves cached reads for explicit reconciliation", async () => {
  const originalFetch = globalThis.fetch;
  let listCalls = 0;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    if ((init?.method ?? "GET") === "GET") {
      listCalls += 1;
      return new Response(JSON.stringify({ data: [project] }), { status: 200, headers: { "content-type": "application/json" } });
    }
    return new Response("", { status: 200 });
  }) as typeof fetch;

  try {
    sharedReadCache.clear();
    await projectApi.list();
    await assert.rejects(projectApi.archive(project.id), ApiResultUnknownError);
    await projectApi.list();
    assert.equal(listCalls, 1);
  } finally {
    sharedReadCache.clear();
    globalThis.fetch = originalFetch;
  }
});

test("successful project asset writes invalidate the cached project detail", async () => {
  const originalFetch = globalThis.fetch;
  let detailReads = 0;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    if ((init?.method ?? "GET") === "GET") {
      detailReads += 1;
      return new Response(JSON.stringify({ data: { ...project, assets: [], selections: {} } }), { status: 200, headers: { "content-type": "application/json" } });
    }
    return new Response(null, { status: 204 });
  }) as typeof fetch;

  try {
    sharedReadCache.clear();
    await projectApi.get(project.id);
    await projectApi.removeAsset(project.id, "asset-1");
    await projectApi.get(project.id);
    assert.equal(detailReads, 2);
  } finally {
    sharedReadCache.clear();
    globalThis.fetch = originalFetch;
  }
});

test("prompt catalog reads share cache and category writes invalidate every prompt view", async () => {
  const originalFetch = globalThis.fetch;
  const reads = new Map<string, number>();
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const path = String(input);
    if ((init?.method ?? "GET") !== "GET") {
      return new Response(JSON.stringify({ data: { id: "cat-1", name: "新版分类", sortOrder: 0, templateCount: 1, createdAt: "", updatedAt: "" } }), { status: 200, headers: { "content-type": "application/json" } });
    }
    reads.set(path, (reads.get(path) ?? 0) + 1);
    const data = path === "/api/prompt-categories" ? [] : path === "/api/prompt-templates/template-1" ? { id: "template-1", versions: [] } : [];
    return new Response(JSON.stringify({ data }), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;

  try {
    sharedReadCache.clear();
    await Promise.all([suiteApi.listPromptTemplates(), suiteApi.listPromptTemplates(), suiteApi.listPromptCategories(), suiteApi.listPromptCategories(), suiteApi.getPromptTemplate("template-1"), suiteApi.getPromptTemplate("template-1")]);
    await suiteApi.updatePromptCategory("cat-1", "新版分类");
    await Promise.all([suiteApi.listPromptTemplates(), suiteApi.listPromptCategories(), suiteApi.getPromptTemplate("template-1")]);
    assert.deepEqual(Object.fromEntries(reads), {
      "/api/prompt-templates": 2,
      "/api/prompt-categories": 2,
      "/api/prompt-templates/template-1": 2,
    });
  } finally {
    sharedReadCache.clear();
    globalThis.fetch = originalFetch;
  }
});

test("published generation config is cached and invalidated after publish", async () => {
  const originalFetch = globalThis.fetch;
  let publishedReads = 0;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    if ((init?.method ?? "GET") === "GET") publishedReads += 1;
    return new Response(JSON.stringify({ data: { id: "config-1", version: publishedReads || 2, content: {}, contentSha256: "a", createdAt: "2026-09-24T00:00:00Z" } }), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;

  try {
    sharedReadCache.clear();
    await Promise.all([generationConfigApi.getPublished(), generationConfigApi.getPublished()]);
    await generationConfigApi.publish();
    await generationConfigApi.getPublished();
    assert.equal(publishedReads, 2);
  } finally {
    sharedReadCache.clear();
    globalThis.fetch = originalFetch;
  }
});
