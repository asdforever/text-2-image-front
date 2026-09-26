import { createIdempotencyKey } from "../api/client";

export interface SuitePromptDraft {
  planId?: string;
  prompts: Record<string, string>;
  confirmKey?: string;
  confirmFingerprint?: string;
}

const key = (projectId: string, planId: string) => `suite-prompt-draft:${projectId}:${planId}`;

export function readSuitePromptDraft(projectId: string, planId: string): SuitePromptDraft {
  try {
    const saved = JSON.parse(localStorage.getItem(key(projectId, planId)) ?? "null");
    if (saved?.planId === planId && saved.prompts && typeof saved.prompts === "object") {
      return { planId, prompts: Object.fromEntries(Object.entries(saved.prompts).filter((item): item is [string, string] => typeof item[1] === "string")),
        confirmKey: typeof saved.confirmKey === "string" ? saved.confirmKey : undefined,
        confirmFingerprint: typeof saved.confirmFingerprint === "string" ? saved.confirmFingerprint : undefined };
    }
  } catch { /* 浏览器存储不可用时仍允许编辑与确认。 */ }
  return { planId, prompts: {} };
}

export function saveSuitePromptDraft(projectId: string, draft: SuitePromptDraft): boolean {
  if (!draft.planId) return false;
  try {
    localStorage.setItem(key(projectId, draft.planId), JSON.stringify(draft));
    return true;
  } catch { return false; }
}

export function suiteConfirmationKey(draft: SuitePromptDraft, planId: string, prompts: Record<string, string>): SuitePromptDraft {
  const fingerprint = JSON.stringify([planId, Object.entries(prompts).sort(([a], [b]) => a.localeCompare(b)).map(([id, prompt]) => [id, prompt.trim()])]);
  return { planId, prompts, confirmFingerprint: fingerprint,
    confirmKey: draft.confirmKey && draft.confirmFingerprint === fingerprint ? draft.confirmKey : createIdempotencyKey() };
}
