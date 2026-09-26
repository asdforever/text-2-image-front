export type ReverseTarget = "hero" | "suite";
export interface ReverseReferenceImage {
  id: string; ordinal: number; filename: string; width: number; height: number;
  mimeType: string; previewUrl: string;
}
export interface ReverseOverall {
  contentFlow: string; visualSystem: string; moduleStrategy: string; adaptationRules: string;
}
export interface ReverseModule {
  id: string; title: string; referenceImageId: string; goal: string; layout: string;
  informationHierarchy: string; typography: string; colorAndLighting: string; adaptationNotes: string;
}
export interface ReverseDocument {
  name: string; category: string; summary: string; suitableFor: string; goal: string;
  requiredMaterials: string; notSuitableFor: string;
  references: ReverseReferenceImage[]; overall: ReverseOverall; modules: ReverseModule[];
}
export interface ReverseVersionSummary { id: string; versionNo: number; createdAt: string; revision: number }
export interface ReverseProject extends ReverseDocument {
  id: string; createdAt: string; updatedAt: string; revision: number;
  analysis: { status: "idle" | "running" | "completed" | "failed"; error?: string | null };
  versions: ReverseVersionSummary[]; latestVersionId: string | null;
}
export interface ReverseVersion extends ReverseVersionSummary { reverseProjectId: string; document: ReverseDocument }
export interface ReverseBinding {
  id: string; projectId: string; projectName: string; target: ReverseTarget; scope: "overall" | "module";
  targetModuleId: string | null; reverseProjectId: string; reverseProjectName: string;
  versionId: string; versionNo: number; sourceModuleId: string | null; sourceModuleTitle: string | null; createdAt: string;
}
export interface ReverseBindingInput {
  target: ReverseTarget; scope: "overall" | "module"; versionId: string;
  targetModuleId?: string; sourceModuleId?: string;
}
export interface ReverseModuleReference { versionId: string; moduleId: string }
export type ReverseUpdate = Partial<Omit<ReverseDocument, "references">> & { expectedRevision: number };

const path = (id: string) => "/api/reverse-projects/" + encodeURIComponent(id);
async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init });
  const payload = await response.json().catch(() => null) as { data?: T; error?: { code?: string; message?: string } } | null;
  if (!response.ok) {
    throw Object.assign(new Error(payload?.error?.message || "请求失败（" + response.status + "），请重试"), { code: payload?.error?.code, status: response.status });
  }
  if (!payload || !("data" in payload)) throw new Error("服务返回的数据不完整，请重试");
  return payload.data as T;
}
const json = (method: string, body: unknown): RequestInit => ({ method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

export const reverseProjectsApi = {
  list: (signal?: AbortSignal) => request<ReverseProject[]>("/api/reverse-projects", { signal }),
  get: (id: string, signal?: AbortSignal) => request<ReverseProject>(path(id), { signal }),
  create: (input: { name: string; category?: string }) => request<ReverseProject>("/api/reverse-projects", json("POST", input)),
  update: (id: string, input: ReverseUpdate) => request<ReverseProject>(path(id), json("PATCH", input)),
  upload: (id: string, file: File) => { const body = new FormData(); body.append("file", file, file.name); return request<ReverseProject>(path(id) + "/references", { method: "POST", body }); },
  removeReference: (id: string, referenceId: string) => request<ReverseProject>(path(id) + "/references/" + encodeURIComponent(referenceId), { method: "DELETE" }),
  reorder: (id: string, expectedRevision: number, referenceIds: string[]) => request<ReverseProject>(path(id) + "/reference-order", json("PUT", { expectedRevision, referenceIds })),
  analyze: (id: string, expectedRevision: number) => request<ReverseProject>(path(id) + "/analyze", json("POST", { expectedRevision })),
  publish: (id: string, expectedRevision: number) => request<ReverseVersion>(path(id) + "/versions", json("POST", { expectedRevision })),
  version: (id: string, versionId: string, signal?: AbortSignal) => request<ReverseVersion>(path(id) + "/versions/" + encodeURIComponent(versionId), { signal }),
  bindings: (id: string) => request<ReverseBinding[]>(path(id) + "/bindings"),
  projectBindings: (projectId: string, target: ReverseTarget, signal?: AbortSignal) => request<ReverseBinding[]>("/api/projects/" + encodeURIComponent(projectId) + "/reverse-bindings?target=" + target, { signal }),
  bind: (projectId: string, input: ReverseBindingInput) => request<ReverseBinding>("/api/projects/" + encodeURIComponent(projectId) + "/reverse-bindings", json("PUT", input)),
  unbind: (projectId: string, bindingId: string) => request<unknown>("/api/projects/" + encodeURIComponent(projectId) + "/reverse-bindings/" + encodeURIComponent(bindingId), { method: "DELETE" }),
};
