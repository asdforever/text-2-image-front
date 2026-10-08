import { useEffect, useRef, useState } from "react";
import { createIdempotencyKey, modulePlanningApi, type ApiModulePlan } from "../api/client";
import { planningConversationsApi as api, type PlanningConversation, type ConversationFeedback, type ConversationVersion, type ConversationMessage } from "../api/planning-conversations";
import { normalizeHeroConfig, normalizeSuiteConfig } from "../lib/generation-workspace";
import { applyConversationSnapshot, conversationInput, materializeEffectiveSnapshot } from "../lib/planning-conversation";
import type { PlanningConfig } from "../lib/planning-master";
import { useProjectStore } from "../store/useProjectStore";

interface Replay { sessionId: string; key: string; body: ConversationFeedback; turnId?: string }
const sameInput = (a: import("../api/client").ApiModulePlanInput, b: import("../api/client").ApiModulePlanInput) => JSON.stringify([a.mode, a.creationMode ?? "professional", a.sourceAssetIds, a.referenceAssetIds ?? [], a.reverseVersionId ?? null, a.marketId, a.styleId, a.customStyle, a.aspectRatio, a.outputLanguage, a.brief, a.selectedModules ?? [], a.userNotes ?? ""]) === JSON.stringify([b.mode, b.creationMode ?? "professional", b.sourceAssetIds, b.referenceAssetIds ?? [], b.reverseVersionId ?? null, b.marketId, b.styleId, b.customStyle, b.aspectRatio, b.outputLanguage, b.brief, b.selectedModules ?? [], b.userNotes ?? ""]);
const errorText = (cause: unknown) => cause instanceof Error ? cause.message : "规划请求失败，请重试";
export function usePlanningConversation(projectId: string, mode: "hero" | "suite", creationMode: "regular" | "professional") {
  const configRecord = useProjectStore(s => s.generationDrafts[`${projectId}:${mode}`]?.config);
  const scope = `${projectId}:${mode}:${creationMode}`;
  const storageKey = `planning-conversation-request:${scope}`;
  const acknowledgedKey = `planning-conversation-ack:${scope}`;
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState<PlanningConversation | null>(null);
  const [versions, setVersions] = useState<ConversationVersion[]>([]);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [outgoing, setOutgoing] = useState<string | null>(null);
  const sendLock = useRef(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState("");
  const [unknown, setUnknown] = useState(false);
  const ref = useRef<PlanningConversation | null>(null);
  const epoch = useRef(0);
  const planRef = useRef<ApiModulePlan | null>(null);
  const bootstrapAttempt = useRef("");
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const current = (): PlanningConfig => {
    const raw = useProjectStore.getState().generationDrafts[`${projectId}:${mode}`]?.config;
    return mode === "hero" ? normalizeHeroConfig(raw) : normalizeSuiteConfig(raw);
  };
  const scoped = async <T,>(promise: Promise<T>): Promise<T> => { const operation = epoch.current; const result = await promise; if (operation !== epoch.current || current().creationMode !== creationMode) throw new Error("规划作用域已切换"); return result; };
  const acknowledge = (config: PlanningConfig = current()) => localStorage.setItem(acknowledgedKey, JSON.stringify(config));
  const accept = (value: PlanningConversation) => { if (value.mode !== mode || value.creationMode !== creationMode) throw new Error("规划会话类型不匹配"); ref.current = value; setSession(value); setMessages(previous => { const incoming = value.messages ?? []; const ids = new Set(incoming.map(m => m.id)); return [...previous.filter(m => !ids.has(m.id)), ...incoming]; }); planRef.current = value.currentSnapshot.plan as ApiModulePlan; };
  const serial = <T,>(action: () => Promise<T>): Promise<T> => {
    const operation = epoch.current;
    const next = queue.current.catch(() => undefined).then(() => { if (epoch.current !== operation) throw new Error("规划作用域已切换"); return action(); }); queue.current = next; return next;
  };
  const publish = (value: PlanningConversation, submitted?: PlanningConfig) => {
    const snapshot = value.currentSnapshot;
    const next = applyConversationSnapshot(current(), snapshot, value.currentPlanId, value.currentVersionId ?? "");
    const official = { ...next, planningConversationId: value.id, planningAppliedVersionId: value.currentVersionId ?? undefined };
    if (submitted) {
      const latest = current();
      for (const field of Object.keys(latest) as (keyof PlanningConfig)[]) {
        if (["modulePlanId", "modulePlanFingerprint", "modulePlanBaseline", "planningConversationId", "planningAppliedVersionId", "modulePlanningRequest"].includes(field)) continue;
        if (JSON.stringify(latest[field]) !== JSON.stringify(submitted[field])) Object.assign(next, { [field]: latest[field] });
      }
    }
    next.planningConversationId = value.id;
    next.planningAppliedVersionId = value.currentVersionId ?? undefined;
    useProjectStore.getState().updateGenerationDraft(projectId, mode, next);
    useProjectStore.getState().updateGenerationPlans(projectId, mode, snapshot.plan.modules.map(m => ({
      moduleId: m.taskId ?? m.moduleId, title: m.taskTitle, count: 1, copy: m.reason,
      visual: m.compositionBrief, compositionBrief: m.compositionBrief, reason: m.reason,
      moduleParameters: next.moduleParameters[m.taskId ?? m.moduleId],
    })));
    acknowledge(official);
  };
  const snapshotBody = async (value: PlanningConversation) => {
    const config = current();
    if (config.creationMode !== creationMode) throw new Error("规划模式已切换，请重新打开规划大师");
    let plan = planRef.current;
    if (config.modulePlanId && config.modulePlanId !== plan?.id) plan = await scoped(modulePlanningApi.get(projectId, config.modulePlanId));
    if (!plan) plan = value.currentSnapshot.plan as ApiModulePlan;
    // Re-read after any network wait: every mutation carries the latest visible draft.
    const latest = current();
    return { expectedRevision: value.revision, input: conversationInput(mode, latest), snapshot: materializeEffectiveSnapshot(latest, plan) };
  };
  const ensure = async () => {
    if (ref.current) return ref.current;
    const existing = await scoped(api.get(projectId, mode, creationMode));
    if (existing) { accept(existing); return existing; }
    const config = current();
    if (!config.modulePlanId) throw new Error("请先点击初始规划");
    const plan = await scoped(modulePlanningApi.get(projectId, config.modulePlanId));
    if (plan.planningContractVersion !== (creationMode === "regular" ? "regular-design-v1" : "commerce-design-v1") || plan.status !== "completed") throw new Error("请先完成当前模式的初始规划");
    const value = await scoped(api.bootstrap(projectId, { mode, creationMode, input: conversationInput(mode, current()), snapshot: materializeEffectiveSnapshot(current(), plan) }));
    accept(value); useProjectStore.getState().updateGenerationDraft(projectId, mode, { planningConversationId: value.id }); acknowledge(); return value;
  };
  const syncInternal = async () => {
    const value = await ensure();
    const body = await snapshotBody(value);
    if (JSON.stringify(body.snapshot) === JSON.stringify(value.currentSnapshot) && sameInput(body.input, value.input ?? value.currentSnapshot.plan.input)) return value;
    const result = await scoped(api.sync(projectId, value.id, body)); accept(result); acknowledge(body.snapshot.generationSettings); return result;
  };
  const run = async (action: () => Promise<void>): Promise<boolean> => {
    const operation = epoch.current;
    setError(""); try { await serial(action); return true; } catch (cause) { if (epoch.current !== operation) return false; setError(errorText(cause));
      if ((cause as { status?: number }).status === 409) { const latest = await scoped(api.get(projectId, mode, creationMode)).catch(() => null); if (latest) accept(latest); }
      return false;
    }
  };
  useEffect(() => {
    const operation = ++epoch.current;
    ref.current = null; planRef.current = null; setSession(null); setMessages([]); setOutgoing(null); sendLock.current = false; setVersions([]); setError(""); setOpen(false); setUnknown(false); setSending(false); setApplying(false); bootstrapAttempt.current = "";
    const before = JSON.stringify(current());
    setLoading(true);
    void api.get(projectId, mode, creationMode).then(value => {
      if (epoch.current !== operation || !value) return;
      const draft = current();
      const acknowledged = localStorage.getItem(acknowledgedKey);
      if ((!useProjectStore.getState().generationDrafts[`${projectId}:${mode}`]) || (before === JSON.stringify(draft) && acknowledged === before)) publish(value);
      accept(value);
      const saved = localStorage.getItem(storageKey);
      if (saved) { const replay = JSON.parse(saved) as Replay; if (!replay.turnId) { setUnknown(true); setOutgoing(value.currentTurn?.requestKey === replay.key ? null : replay.body.text); } else if (!value.activeTurnId) localStorage.removeItem(storageKey); }
    }).catch(cause => { if (epoch.current === operation) setError(errorText(cause)); }).finally(() => { if (epoch.current === operation) setLoading(false); });
    return () => { epoch.current++; };
  }, [scope]);
  useEffect(() => {
    if (!open) { bootstrapAttempt.current = ""; return; }
    if (loading || session || !current().modulePlanId || bootstrapAttempt.current === current().modulePlanId) return;
    bootstrapAttempt.current = current().modulePlanId!;
    const operation = epoch.current;
    setLoading(true); void run(async () => { await ensure(); }).finally(() => { if (epoch.current === operation) setLoading(false); });
  }, [open, configRecord?.modulePlanId, session?.id, loading]);
  useEffect(() => {
    if (!ref.current || applying || unknown) return;
    const timer = setTimeout(() => { void run(async () => { await syncInternal(); }); }, 650);
    return () => clearTimeout(timer);
  }, [configRecord, scope]);
  useEffect(() => {
    if (!session?.activeTurnId) return;
    const operation = epoch.current;
    const timer = setInterval(() => { void serial(async () => {
      const value = await scoped(api.get(projectId, mode, creationMode));
      if (epoch.current !== operation || !value) return;
      accept(value);
      if (!value.activeTurnId) { localStorage.removeItem(storageKey); setUnknown(false); }
    }).catch(cause => { if (epoch.current === operation) setError(errorText(cause)); }); }, 1000);
    return () => clearInterval(timer);
  }, [session?.activeTurnId, scope]);
  const sendFeedback = async (text: string) => {
    if (sendLock.current || ref.current?.activeTurnId) return false;
    const operation = epoch.current;
    sendLock.current = true; setSending(true);
    if (text.trim()) setOutgoing(text);
    const success = await run(async () => {
      const saved = localStorage.getItem(storageKey);
      let replay = saved ? JSON.parse(saved) as Replay : null;
      // The turn request itself atomically saves the latest snapshot; no preceding sync is needed.
      if (!replay) { const value = await ensure(); replay = { sessionId: value.id, key: createIdempotencyKey(), body: { ...await snapshotBody(value), text } }; localStorage.setItem(storageKey, JSON.stringify(replay)); }
      try { const result = await scoped(api.send(projectId, replay.sessionId, replay.body, replay.key));
        replay.turnId = result.turn.id; localStorage.setItem(storageKey, JSON.stringify(replay)); accept(result.session); acknowledge(replay.body.snapshot.generationSettings); setOutgoing(null); setUnknown(false);
        if (result.turn.status !== "generating") localStorage.removeItem(storageKey);
      } catch (cause) { if (epoch.current !== operation) throw cause; if ((cause as { code?: string }).code) localStorage.removeItem(storageKey); else setUnknown(true); throw cause; }
    });
    if (epoch.current === operation) { sendLock.current = false; setSending(false); if (!success && !localStorage.getItem(storageKey)) setOutgoing(null); } return success;
  };
  const apply = async () => { const operation = epoch.current; setApplying(true); await run(async () => {
    const value = await syncInternal(); if (!value.previewPlanId) return;
    const body = await snapshotBody(value); const submitted = current();
    const result = await scoped(api.apply(projectId, value.id, { ...body, candidatePlanId: value.previewPlanId })); accept(result); publish(result, submitted);
  }); if (epoch.current === operation) setApplying(false); };
  const discard = () => run(async () => { const value = await ensure(); accept(await scoped(api.discard(projectId, value.id, value.revision))); });
  const restore = async (versionId: string) => { const operation = epoch.current; setApplying(true); await run(async () => { const value = await syncInternal(); const body = await snapshotBody(value); const submitted = current(); const result = await scoped(api.restore(projectId, value.id, { ...body, versionId })); accept(result); publish(result, submitted); }); if (epoch.current === operation) setApplying(false); };
  const loadHistory = () => run(async () => { const value = await ensure();
    const versionRows: ConversationVersion[] = []; let cursor: string | undefined;
    do { const page: { items: ConversationVersion[]; nextCursor: string | null } = await scoped(api.versions(projectId, value.id, cursor)); versionRows.push(...page.items); cursor = page.nextCursor ?? undefined; } while (cursor);
    const messageRows: ConversationMessage[] = []; cursor = undefined;
    do { const page: { items: ConversationMessage[]; nextCursor: string | null } = await scoped(api.messages(projectId, value.id, cursor)); messageRows.unshift(...page.items); cursor = page.nextCursor ?? undefined; } while (cursor);
    setVersions(versionRows); setMessages(messageRows);
  });
  const visibleMessages: ConversationMessage[] = outgoing === null ? messages : [...messages, { id: `outgoing:${scope}`, turnId: "outgoing", role: "user", text: outgoing, status: "sending" }];
  return { session, messages: visibleMessages, pending: session?.previewSnapshot, versions, loading, sending, generating: sending || !!session?.activeTurnId, applying, error, unknown,
    stale: !!session?.previewSnapshot && !sameInput(conversationInput(mode, current()), session.previewSnapshot?.plan.input ?? session.currentTurn?.result?.input ?? session.input ?? session.currentSnapshot.plan.input),
    open, setOpen, sendFeedback, apply, discard, restore, sync: () => run(async () => { await syncInternal(); }), loadHistory };
}
export type PlanningConversationControls = ReturnType<typeof usePlanningConversation>;
