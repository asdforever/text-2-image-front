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
  status: "draft" | "compiled" | "generating" | "succeeded" | "failed";
  generatedAssetId?: string | null;
  generatedPreviewUrl?: string | null;
  generatedAt?: string | null;
  error?: string | null;
}

export interface ReverseExecutionPlan {
  id: string;
  projectId: string;
  reverseVersionId: string;
  versionId: string;
  referenceCount: number;
  sourceAssetId?: string | null;
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
  get: (projectId: string) => request<ReverseExecutionPlan | null>(path(projectId)),
  generate: (projectId: string, versionId: string, inputs: { sourceAssetId?: string | null; productFacts?: Record<string, string>; parameterBrief?: string; outputSettings?: ReverseExecutionPlan["outputSettings"] } = {}) => request<ReverseExecutionPlan>(path(projectId), json("POST", { versionId, ...inputs })),
  save: (projectId: string, expectedRevision: number, document: { versionId: string; referenceCount: number; tasks: ReverseExecutionTask[]; sourceAssetId?: string | null; productFacts?: Record<string, string>; parameterBrief?: string; parametersAssigned?: boolean; parameterSummary?: string; parameterWarnings?: string[]; outputSettings?: ReverseExecutionPlan["outputSettings"] }) => request<ReverseExecutionPlan>(path(projectId), json("PATCH", { expectedRevision, document })),
  compile: (projectId: string, expectedRevision: number, productFacts: Record<string, unknown> = {}) => request<ReverseExecutionPlan>(path(projectId) + "/compile", json("POST", { expectedRevision, productFacts })),
  assignParameters: (projectId: string, expectedRevision: number) => request<ReverseExecutionPlan>(path(projectId) + "/parameters", json("POST", { expectedRevision })),
  generateImages: (projectId: string, expectedRevision: number, options: { taskIds?: string[]; sourceAssetId?: string; aspectRatio?: string; resolution?: string } = {}) => request<ReverseExecutionPlan>(path(projectId) + "/generate", json("POST", { expectedRevision, ...options })),
};
