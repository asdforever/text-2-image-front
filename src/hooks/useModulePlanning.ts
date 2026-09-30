import { useEffect, useRef, useState } from "react";
import { createIdempotencyKey, modulePlanningApi, type ApiModulePlan } from "../api/client";
import { normalizeHeroConfig, normalizeSuiteConfig, type GenerationMode } from "../lib/generation-workspace";
import { applyModulePlan, canRecoverModulePlan, hasPlanningInput, modulePlanInputFingerprint, modulePlanRequestInput, type PlanningConfig } from "../lib/planning-master";
import { useProjectStore } from "../store/useProjectStore";
import { useReverseBindings, type ReverseBindingControls } from "../features/reverse-projects/useReverseBindings";

export interface ModulePlanningControls {
  planning: boolean;
  error: string;
  summary?: string;
  warnings?: string[];
  references?: ReverseBindingControls;
  plan: () => Promise<PlanningConfig | null>;
}

/** A single controller shared by the explicit planning action and compile action. */
export function useModulePlanning(projectId: string, mode: GenerationMode): ModulePlanningControls {
  const creationMode = useProjectStore(state => {
    const config = state.generationDrafts[`${projectId}:${mode}`]?.config;
    return config ? config.creationMode ?? "professional" : "regular";
  });
  const references = useReverseBindings(projectId, mode, creationMode !== "regular");
  const [planning, setPlanning] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ApiModulePlan | null>(null);
  const epoch = useRef(0);
  const locked = useRef(false);
  const current = (): PlanningConfig => {
    const config = useProjectStore.getState().generationDrafts[`${projectId}:${mode}`]?.config;
    return mode === "hero" ? normalizeHeroConfig(config) : normalizeSuiteConfig(config);
  };
  const save = (patch: Partial<PlanningConfig>) => useProjectStore.getState().updateGenerationDraft(projectId, mode, patch);
  const finish = async (value: ApiModulePlan, fingerprint: string, operation: number): Promise<PlanningConfig | null> => {
    const valid = () => epoch.current === operation && modulePlanInputFingerprint(current()) === fingerprint;
    while (valid() && value.status === "planning") {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      if (!valid()) return null;
      value = await modulePlanningApi.get(projectId, value.id);
    }
    if (!valid() || !canRecoverModulePlan(value, mode, current())) return null;
    if (value.status === "failed") {
      save({ modulePlanningRequest: undefined });
      throw new Error(value.error?.message || "自动规划失败，请重试");
    }
    setResult(value);
    // A saved completed plan already includes manual selection, ordering and parameter edits.
    if (current().modulePlanId === value.id && current().modulePlanFingerprint === fingerprint) return current();
    const next = applyModulePlan(current(), value, { preserveEdits: true });
    save(next);
    useProjectStore.getState().updateGenerationPlans(projectId, mode, value.modules.map((item) => ({
      moduleId: item.taskId ?? item.moduleId, title: item.taskTitle, count: next.moduleCounts[item.taskId ?? item.moduleId], copy: item.reason,
      visual: item.compositionBrief, moduleParameters: next.moduleParameters[item.taskId ?? item.moduleId], compositionBrief: item.compositionBrief, reason: item.reason,
    })));
    return next;
  };

  useEffect(() => {
    const operation = ++epoch.current;
    let config = current();
    setResult(null); setError("");
    const recover = async () => {
      try {
        // A reference may have been bound from another page or browser.
        // Synchronize it before deciding whether a previous plan can be restored.
        config = await references.refresh();
        if (epoch.current !== operation || !hasPlanningInput(config)) return;
        const fingerprint = modulePlanInputFingerprint(config);
        const planId = config.modulePlanningRequest?.fingerprint === fingerprint ? config.modulePlanningRequest.planId : config.modulePlanId;
        const value = planId ? await modulePlanningApi.get(projectId, planId) : await modulePlanningApi.getLatest(projectId, mode);
        if (epoch.current !== operation || !canRecoverModulePlan(value, mode, current())) return;
        if (value.status === "planning") { locked.current = true; setPlanning(true); }
        await finish(value, fingerprint, operation);
      } catch (cause) {
        // An absent latest record is normal. Existing pending records must expose recovery failures.
        if (epoch.current === operation && (config.modulePlanningRequest?.planId || locked.current)) setError(cause instanceof Error ? cause.message : "规划恢复失败");
      } finally {
        if (epoch.current === operation) { locked.current = false; setPlanning(false); }
      }
    };
    void recover();
    return () => { epoch.current++; locked.current = false; };
  }, [projectId, mode, references.refresh, creationMode]);

  const plan = async (): Promise<PlanningConfig | null> => {
    if (locked.current) return null;
    let config: PlanningConfig;
    try { config = await references.refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "反推引用读取失败，请重试"); return null; }
    if (locked.current) return null;
    if (!hasPlanningInput(config) || !config.selectedAssetIds.length) return null;
    locked.current = true;
    const operation = ++epoch.current;
    const fingerprint = modulePlanInputFingerprint(config);
    const request = config.modulePlanningRequest?.fingerprint === fingerprint ? config.modulePlanningRequest : { fingerprint, idempotencyKey: createIdempotencyKey() };
    save({ modulePlanningRequest: request });
    setPlanning(true); setError(""); setResult(null);
    try {
      const value = request.planId ? await modulePlanningApi.get(projectId, request.planId)
        : await modulePlanningApi.plan(projectId, modulePlanRequestInput(mode, config), request.idempotencyKey);
      if (epoch.current !== operation || modulePlanInputFingerprint(current()) !== fingerprint) return null;
      save({ modulePlanningRequest: { ...request, planId: value.id } });
      return await finish(value, fingerprint, operation);
    } catch (cause) {
      if (epoch.current === operation && modulePlanInputFingerprint(current()) === fingerprint) {
        // Provider terminal failures were saved by the server; a retry is a new planning attempt.
        // Transport/unknown-result failures retain the key to avoid duplicate paid requests.
        const code = (cause as { code?: string })?.code;
        if (code && (/^(MODULE_PLANNER_|GENERATION_CONFIG_|MODEL_CONNECTION_|PROMPT_MODEL_)/.test(code) || ["MODULE_PLAN_INVALID_INPUT", "INVALID_SOURCE_ASSET"].includes(code))) save({ modulePlanningRequest: undefined });
        setError(cause instanceof Error ? cause.message : "自动规划失败");
      }
      return null;
    } finally {
      if (epoch.current === operation) { locked.current = false; setPlanning(false); }
    }
  };
  const resultIsCurrent = result && canRecoverModulePlan(result, mode, current());
  return { planning, error, plan, summary: resultIsCurrent ? result.summary : undefined, warnings: resultIsCurrent ? result.warnings : undefined, references: creationMode === "regular" ? undefined : references };
}
