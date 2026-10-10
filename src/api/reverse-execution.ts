export interface ReverseExecutionStructure {
  goal: string;
  layout: string;
  informationHierarchy: string;
  typography: string;
  colorAndLighting: string;
  adaptationNotes: string;
}

export interface ReverseExecutionTask {
  id: string;
  ordinal: number;
  referenceImageId: string;
  referenceFilename: string;
  referencePreviewUrl?: string | null;
  referenceModuleId: string | null;
  title: string;
  structure: ReverseExecutionStructure;
  moduleParameters?: Array<{ key: string; value: string }>;
  parametersAssigned?: boolean;
  promptDraft: string;
  status: "draft" | "compiled" | "queued" | "not_requested" | "generating" | "succeeded" | "failed";
  generatedAssetId?: string | null;
  generatedPreviewUrl?: string | null;
  generatedAt?: string | null;
  error?: string | null;
}

export interface ReverseExecutionPlan {
  id: string;
  name?: string;
  projectId: string;
  reverseVersionId: string;
  versionId: string;
  referenceCount: number;
  sourceAssetId?: string | null;
  auxiliarySourceAssetIds?: string[];
  productFacts?: Record<string, string>;
  parameterBrief?: string;
  parametersAssigned?: boolean;
  parameterSummary?: string;
  parameterWarnings?: string[];
  outputSettings?: {
    outputLanguage?: string;
    model?: string;
    aspectRatio?: string;
    resolution?: string;
  };
  tasks: ReverseExecutionTask[];
  revision: number;
  createdAt: string;
  updatedAt: string;
}

export interface ReverseExecutionAttempt {
  id: string; number: number; status: string; createdAt: string;
  generatedAssetId?: string; generatedPreviewUrl?: string; error?: string; archiveError?: string;
}
export interface ReverseExecutionBatch {
  id: string; planId: string; projectId: string; batchNo: number; planName: string;
  status: "running" | "completed" | "partial" | "failed"; createdAt: string; updatedAt: string; revision: number;
  document: { sourceAssetId?: string; auxiliarySourceAssetIds?: string[]; versionId: string; outputSettings?: ReverseExecutionPlan["outputSettings"] };
  tasks: Array<ReverseExecutionTask & { attempts: ReverseExecutionAttempt[] }>;
  progress: { total: number; succeeded: number; failed: number };
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init });
  const payload = await response.json().catch(() => null) as { data?: T; error?: { code?: string; message?: string } } | null;
  if (!response.ok) throw Object.assign(new Error(payload?.error?.message || "请求失败，请重试"), { code: payload?.error?.code, status: response.status });
  if (!payload || !("data" in payload)) throw new Error("服务返回的数据不完整，请重试");
  return payload.data as T;
}

const json = (method: string, body: unknown): RequestInit => ({ method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const path = (projectId: string) => `/api/projects/${encodeURIComponent(projectId)}/reverse-execution`;

export const reverseExecutionApi = {
  get: (projectId: string, planId?: string) => request<ReverseExecutionPlan | null>(path(projectId) + (planId ? `?planId=${encodeURIComponent(planId)}` : "")),
  list: (projectId: string) => request<ReverseExecutionPlan[]>(path(projectId) + "/plans"),
  batches: (projectId: string, planId: string) => request<ReverseExecutionBatch[]>(path(projectId) + `/batches?planId=${encodeURIComponent(planId)}`),
  generate: (projectId: string, versionId: string, inputs: { name?: string; sourceAssetId?: string | null; auxiliarySourceAssetIds?: string[]; productFacts?: Record<string, string>; parameterBrief?: string; outputSettings?: ReverseExecutionPlan["outputSettings"] } = {}) => request<ReverseExecutionPlan>(path(projectId), json("POST", { versionId, ...inputs })),
  save: (projectId: string, expectedRevision: number, document: { name?: string; versionId: string; referenceCount: number; tasks: ReverseExecutionTask[]; sourceAssetId?: string | null; auxiliarySourceAssetIds?: string[]; productFacts?: Record<string, string>; parameterBrief?: string; parametersAssigned?: boolean; parameterSummary?: string; parameterWarnings?: string[]; outputSettings?: ReverseExecutionPlan["outputSettings"] }, planId?: string) => request<ReverseExecutionPlan>(path(projectId), json("PATCH", { expectedRevision, document, ...(planId ? { planId } : {}) })),
  compile: (projectId: string, expectedRevision: number, productFacts: Record<string, unknown> = {}, planId?: string) => request<ReverseExecutionPlan>(path(projectId) + "/compile", json("POST", { expectedRevision, productFacts, ...(planId ? { planId } : {}) })),
  assignParameters: (projectId: string, expectedRevision: number, planId?: string) => request<ReverseExecutionPlan>(path(projectId) + "/parameters", json("POST", { expectedRevision, ...(planId ? { planId } : {}) })),
  generateImages: (projectId: string, expectedRevision: number, options: { planId?: string; batchId?: string; taskIds?: string[]; promptOverrides?: Record<string, string>; sourceAssetId?: string; auxiliarySourceAssetIds?: string[]; aspectRatio?: string; resolution?: string } = {}) => request<ReverseExecutionPlan>(path(projectId) + "/generate", json("POST", { expectedRevision, ...options })),
};
