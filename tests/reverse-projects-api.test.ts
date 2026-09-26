import assert from "node:assert/strict";
import { test } from "node:test";
import { reverseProjectsApi } from "../src/api/reverse-projects";

test("binding a module preserves exact version, target workbench and task slot", async () => {
  const original = globalThis.fetch;
  let received: { url: string; method?: string; body: unknown } | undefined;
  globalThis.fetch = (async (url, init) => {
    received = { url: String(url), method: init?.method, body: JSON.parse(String(init?.body)) };
    return new Response(JSON.stringify({ data: { id: "binding-1", versionId: "fixed-v1" } }));
  }) as typeof fetch;
  try {
    const result = await reverseProjectsApi.bind("business/project", { target: "suite", scope: "module", versionId: "fixed-v1", targetModuleId: "detail-2", sourceModuleId: "reference-layout" });
    assert.deepEqual(received, { url: "/api/projects/business%2Fproject/reverse-bindings", method: "PUT", body: { target: "suite", scope: "module", versionId: "fixed-v1", targetModuleId: "detail-2", sourceModuleId: "reference-layout" } });
    assert.equal(result.versionId, "fixed-v1");
  } finally { globalThis.fetch = original; }
});

test("reordering references sends the expected revision and complete order", async () => {
  const original = globalThis.fetch;
  let received: unknown;
  globalThis.fetch = (async (_url, init) => {
    received = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ data: { id: "reverse-1", revision: 4 } }));
  }) as typeof fetch;
  try {
    const result = await reverseProjectsApi.reorder("reverse-1", 3, ["image-b", "image-a"]);
    assert.deepEqual(received, { expectedRevision: 3, referenceIds: ["image-b", "image-a"] });
    assert.equal(result.revision, 4);
  } finally { globalThis.fetch = original; }
});

test("server conflicts stay visible and cannot be mistaken for a saved edit", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify({ error: { code: "REVERSE_CONFLICT", message: "项目已更新，请刷新后再保存" } }), { status: 409 })) as typeof fetch;
  try {
    await assert.rejects(reverseProjectsApi.update("r1", { expectedRevision: 1, name: "new" }), (e: Error & { status?: number; code?: string }) => e.status === 409 && e.code === "REVERSE_CONFLICT" && e.message.includes("刷新"));
  } finally { globalThis.fetch = original; }
});

test("binding list is scoped to the requested business workbench", async () => {
  const original = globalThis.fetch;
  let url = "";
  globalThis.fetch = (async (input) => { url = String(input); return new Response(JSON.stringify({ data: [] })); }) as typeof fetch;
  try {
    assert.deepEqual(await reverseProjectsApi.projectBindings("p1", "hero"), []);
    assert.equal(url, "/api/projects/p1/reverse-bindings?target=hero");
  } finally { globalThis.fetch = original; }
});
