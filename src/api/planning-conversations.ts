import { request, type ApiModulePlanInput } from "./client";
import type { EffectiveSnapshot } from "../lib/planning-conversation";
export interface ConversationMessage { id: string; turnId: string; role: "user" | "assistant"; text: string; status?: string }
export interface ConversationTurn { id: string; requestKey?: string; status: "generating" | "completed" | "preview" | "clarification" | "stale" | "failed"; result?: { kind?: "answer" | "clarification" | "revision"; input?: ApiModulePlanInput; message?: string; error?: { code: string; message: string } } }
export interface ConversationParameterChange { kind: "changed" | "added" | "deleted" | "renamed" | "moved" | "replaced"; key?: string; newKey?: string; before: unknown; after: unknown }
export interface ConversationDiff { parameterChanges?: ConversationParameterChange[]; kind: "added" | "deleted" | "moved" | "field"; taskId?: string; field?: string; before: unknown; after: unknown }
export interface ConversationVersion { id: string; versionNumber: number; planId: string; snapshot: EffectiveSnapshot; createdAt: string }
export interface PlanningConversation {
  id: string; mode: "hero" | "suite"; creationMode: "regular" | "professional"; revision: number;
  input?: ApiModulePlanInput;
  currentSnapshot: EffectiveSnapshot; appliedSnapshot: EffectiveSnapshot;
  currentPlanId: string; currentVersionId: string | null; previewSnapshot: EffectiveSnapshot | null;
  previewPlanId: string | null; activeTurnId: string | null;
  currentTurn: ConversationTurn | null; messages: ConversationMessage[]; diff: ConversationDiff[];
}
export interface ConversationSync { expectedRevision: number; input: ApiModulePlanInput; snapshot: EffectiveSnapshot }
export interface ConversationFeedback extends ConversationSync { text: string }
const base = (project: string) => `/api/projects/${encodeURIComponent(project)}/planning-conversations`;
const post = <T,>(path: string, body: unknown, key?: string) => request<T>(path, { method: "POST", headers: { "Content-Type": "application/json", ...(key ? { "Idempotency-Key": key } : {}) }, body: JSON.stringify(body) });
export const planningConversationsApi = {
  get: (p: string, mode: "hero" | "suite", creation: "regular" | "professional") => request<PlanningConversation | null>(`${base(p)}?mode=${mode}&creationMode=${creation}`),
  bootstrap: (p: string, body: { mode: "hero" | "suite"; creationMode: "regular" | "professional"; input: ApiModulePlanInput; snapshot: EffectiveSnapshot }) => post<PlanningConversation>(`${base(p)}/bootstrap`, body),
  sync: (p: string, s: string, body: ConversationSync) => post<PlanningConversation>(`${base(p)}/${encodeURIComponent(s)}/sync`, body),
  send: (p: string, s: string, body: ConversationFeedback, key: string) => post<{ session: PlanningConversation; turn: ConversationTurn }>(`${base(p)}/${encodeURIComponent(s)}/turns`, body, key),
  turn: (p: string, s: string, t: string) => request<ConversationTurn>(`${base(p)}/${encodeURIComponent(s)}/turns/${encodeURIComponent(t)}`),
  messages: (p: string, s: string, before?: string) => request<{ items: ConversationMessage[]; nextCursor: string | null }>(`${base(p)}/${encodeURIComponent(s)}/messages?limit=100${before ? `&before=${encodeURIComponent(before)}` : ""}`),
  versions: (p: string, s: string, before?: string) => request<{ items: ConversationVersion[]; nextCursor: string | null }>(`${base(p)}/${encodeURIComponent(s)}/versions?limit=100${before ? `&before=${encodeURIComponent(before)}` : ""}`),
  apply: (p: string, s: string, body: ConversationSync & { candidatePlanId: string }) => post<PlanningConversation>(`${base(p)}/${encodeURIComponent(s)}/apply`, body),
  discard: (p: string, s: string, expectedRevision: number) => post<PlanningConversation>(`${base(p)}/${encodeURIComponent(s)}/discard`, { expectedRevision }),
  restore: (p: string, s: string, body: ConversationSync & { versionId: string }) => post<PlanningConversation>(`${base(p)}/${encodeURIComponent(s)}/restore`, body),
};
