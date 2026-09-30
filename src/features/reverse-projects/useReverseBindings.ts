import { useCallback, useEffect, useRef, useState } from "react";
import { reverseProjectsApi, type ReverseBinding, type ReverseTarget } from "../../api/reverse-projects";
import { normalizeHeroConfig, normalizeSuiteConfig } from "../../lib/generation-workspace";
import type { PlanningConfig } from "../../lib/planning-master";
import { useProjectStore } from "../../store/useProjectStore";
import { reverseBindingConfigPatch } from "./planning";

export interface ReverseBindingControls {
  bindings: ReverseBinding[]; loading: boolean; error: string;
  refresh: () => Promise<PlanningConfig>;
}
export function useReverseBindings(projectId: string, target: ReverseTarget, enabled = true): ReverseBindingControls {
  const [bindings, setBindings] = useState<ReverseBinding[]>([]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const scope = projectId + ":" + target;
  const active = useRef(scope); active.current = scope;
  const pending = useRef<{ scope: string; promise: Promise<PlanningConfig> } | null>(null);
  const refresh = useCallback(() => {
    if (pending.current?.scope === scope) return pending.current.promise;
    const current = () => {
      const config = useProjectStore.getState().generationDrafts[scope]?.config;
      return target === "hero" ? normalizeHeroConfig(config) : normalizeSuiteConfig(config);
    };
    if (!enabled) return Promise.resolve(current());
    if (active.current === scope) { setLoading(true); setError(""); }
    const promise = reverseProjectsApi.projectBindings(projectId, target).then(rows => {
      if (!Array.isArray(rows)) throw new Error("反推引用数据不完整，请重新加载");
      if (current().creationMode === "regular") return current();
      const patch = reverseBindingConfigPatch(current(), rows, projectId, target);
      if (Object.keys(patch).length) useProjectStore.getState().updateGenerationDraft(projectId, target, patch);
      if (active.current === scope) setBindings(rows);
      return current();
    }).catch(cause => {
      const message = cause instanceof Error ? cause.message : "反推引用读取失败";
      if (active.current === scope) setError(message);
      // During an older-server rollout, existing unreferenced workflows remain usable.
      // A saved reference is never discarded or silently replaced with no reference.
      if ((cause as { status?: number }).status === 404 && !current().reverseVersionId && !Object.keys(current().reverseModuleReferences ?? {}).length) return current();
      throw cause;
    }).finally(() => { if (pending.current?.promise === promise) pending.current = null; if (active.current === scope) setLoading(false); });
    pending.current = { scope, promise };
    return promise;
  }, [projectId, target, scope, enabled]);
  useEffect(() => {
    if (!enabled) { setLoading(false); setError(""); return; }
    active.current = scope; setBindings([]);
    const update = () => { void refresh().catch(() => undefined); };
    update(); window.addEventListener("focus", update); window.addEventListener("reverse-bindings-changed", update);
    return () => { active.current = ""; window.removeEventListener("focus", update); window.removeEventListener("reverse-bindings-changed", update); };
  }, [refresh, scope, enabled]);
  return { bindings, loading, error, refresh };
}
