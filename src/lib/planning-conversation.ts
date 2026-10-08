import type { ApiModulePlan, ApiModulePlanInput } from "../api/client";
import { getModuleParameterPresets, type GenerationModuleParameter, type RegularTaskOptions, type GenerationTaskDesign } from "./generation-workspace";
import { applyModulePlan, modulePlanInputFingerprint, modulePlanRequestInput, type ModulePlan, type PlanningConfig } from "./planning-master";

export interface EffectiveSnapshot {
  plan: ModulePlan & { input: ApiModulePlanInput; snapshot?: Record<string, unknown> };
  parameterOverrides: Record<string, GenerationModuleParameter[]>;
  regularOptions: Record<string, RegularTaskOptions>;
  taskDesignOverrides?: Record<string, GenerationTaskDesign>;
  generationSettings?: PlanningConfig;
}

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

/** Materialize what is visible now, preserving server-only planning metadata. */
export function materializeEffectiveSnapshot(config: PlanningConfig, plan: ApiModulePlan): EffectiveSnapshot {
  const result = clone(plan) as EffectiveSnapshot["plan"];
  const byTask = new Map(result.modules.map(m => [m.taskId ?? m.moduleId, m]));
  result.modules = config.selectedModuleIds.map(taskId => {
    const moduleId = config.moduleTypes?.[taskId] ?? taskId;
    const original = byTask.get(taskId);
    const detail = config.moduleTaskDetails?.[taskId];
    const overrides = config.moduleTaskOverrides?.[taskId];
    const regular = config.regularTaskOverrides?.[taskId] ?? config.regularTasks?.[taskId];
    const module = original?.moduleId === moduleId ? clone(original) : {
      moduleId, taskId, taskTitle: detail?.title || moduleId, resultCount: 1,
      reason: regular?.goal || "展示当前商品信息", suggestedCopy: regular?.copy || "",
      informationQuestion: detail?.informationQuestion || "展示什么商品信息？",
      productPresence: detail?.productPresence || "detail", designGuideIds: ["visual-hierarchy"],
      compositionBrief: detail?.compositionAdvice || "根据当前模块和商品信息安排画面",
      moduleParameters: [], styleTemplateId: "product-commerce-visual",
      bigIdea: "表达已提供的商品信息", visualMechanism: "当前模块的真实商品信息与视觉表达对应",
    };
    module.taskId = taskId;
    module.resultCount = 1;
    if (config.creationMode === "regular") {
      if (regular) { module.reason = regular.goal; module.suggestedCopy = regular.copy; }
    } else {
      if (detail) {
        module.taskTitle = detail.title;
        module.informationQuestion = detail.informationQuestion;
        module.productPresence = detail.productPresence;
        module.visualMechanism = detail.visualMechanism;
        module.compositionBrief = detail.compositionAdvice;
      }
      if (overrides?.taskTitle !== undefined) module.taskTitle = overrides.taskTitle;
      if (overrides?.informationQuestion !== undefined) module.informationQuestion = overrides.informationQuestion;
      if (overrides?.visualMechanism !== undefined) module.visualMechanism = overrides.visualMechanism;
      if (overrides?.productPresence && overrides.productPresence !== "auto") module.productPresence = overrides.productPresence;
    }
    return module;
  });
  return {
    plan: result,
    parameterOverrides: Object.fromEntries(config.selectedModuleIds.map(taskId => [taskId,
      clone(config.moduleParameters[taskId] ?? getModuleParameterPresets(config.moduleTypes?.[taskId] ?? taskId))])),
    regularOptions: Object.fromEntries(config.selectedModuleIds.filter(taskId => config.creationMode === "regular" && config.regularTaskOptions?.[taskId])
      .map(taskId => [taskId, clone(config.regularTaskOptions![taskId])])),
    taskDesignOverrides: Object.fromEntries(config.selectedModuleIds.filter(taskId => config.creationMode !== "regular" && config.moduleTaskOverrides?.[taskId]?.productPresence === "auto")
      .map(taskId => [taskId, { productPresence: "auto" as const }])),
    generationSettings: clone(config),
  };
}

/** The server has already merged and validated; never reapply stale overrides. */
export function applyConversationSnapshot<T extends PlanningConfig>(config: T, snapshot: EffectiveSnapshot,
  planId: string, appliedVersionId: string): T {
  const expected = config.creationMode === "regular" ? "regular-design-v1" : "commerce-design-v1";
  if (snapshot.plan.planningContractVersion !== expected) throw new Error("规划模式不匹配，请切换至对应模式");
  const plan = { ...clone(snapshot.plan), id: planId };
  const source = { ...config, ...snapshot.generationSettings, moduleTaskOverrides: {}, regularTaskOverrides: {} } as T;
  const next = applyModulePlan(source, plan);
  next.moduleParameters = Object.fromEntries(plan.modules.map(m => {
    const task = m.taskId ?? m.moduleId;
    return [task, clone(snapshot.parameterOverrides[task] ?? m.moduleParameters)];
  }));
  next.modulePlanBaseline = { moduleCounts: { ...next.moduleCounts }, moduleParameters: clone(next.moduleParameters) };
  next.regularTaskOptions = clone(snapshot.regularOptions);
  next.moduleTaskOverrides = clone(snapshot.taskDesignOverrides ?? {});
  next.planningAppliedVersionId = appliedVersionId;
  next.modulePlanningRequest = undefined;
  next.modulePlanFingerprint = modulePlanInputFingerprint(next);
  return next;
}

export function conversationInput(mode: "hero" | "suite", config: PlanningConfig): ApiModulePlanInput {
  return modulePlanRequestInput(mode, config);
}
