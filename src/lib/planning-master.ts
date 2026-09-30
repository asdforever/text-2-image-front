import type { HeroGenerationConfig, SuiteGenerationConfig, GenerationModuleParameter, GenerationMode } from "./generation-workspace";
import type { ApiModulePlanInput } from "../api/client";

export interface ModulePlanModule {
  suggestedCopy?: string;
  taskTitle: string;
  informationQuestion: string;
  productPresence: string;
  designGuideIds: string[];
  moduleId: string;
  referenceModuleId?: string;
  taskId?: string;
  resultCount: number;
  moduleParameters: GenerationModuleParameter[];
  compositionBrief: string;
  reason: string;
  styleTemplateId?: string;
  visualStyleTags?: string[];
  sceneTags?: string[];
  referenceCaseIds?: number[];
  bigIdea?: string;
  visualMechanism?: string;
}

export interface ModulePlan {
  planningContractVersion?: "commerce-design-v1" | "regular-design-v1";
  sharedVisualDirection?: string;
  id: string;
  mode: GenerationMode;
  status: "planning" | "completed" | "failed";
  input?: ApiModulePlanInput;
  summary: string;
  modules: ModulePlanModule[];
  warnings: string[];
  error?: { code: string; message: string };
  createdAt: string;
}

export type PlanningConfig = HeroGenerationConfig | SuiteGenerationConfig;

type PlanningInputConfig = Pick<PlanningConfig, "selectedAssetIds" | "referenceAssetIds" | "market" | "aspectRatio" | "outputLanguage" | "planningBrief" | "reverseVersionId" | "styleId" | "customStyle"> & Partial<Pick<PlanningConfig, "creationMode" | "selectedModuleIds" | "moduleTypes" | "userNotes">>;

function selectedModules(config: PlanningInputConfig) {
  return (config.selectedModuleIds ?? []).map(taskId => ({ taskId, moduleId: config.moduleTypes?.[taskId] ?? taskId }));
}

export function hasPlanningInput(config: Pick<PlanningConfig, "planningBrief" | "referenceAssetIds" | "reverseVersionId">): boolean {
  return !!config.planningBrief?.trim() || !!config.referenceAssetIds?.length || !!config.reverseVersionId;
}

export function modulePlanInputFingerprint(config: PlanningInputConfig): string {
  if (config.creationMode === "regular") return JSON.stringify({ contract: "regular-design-v1", styleId: config.styleId, customStyle: config.customStyle.trim(), assets: config.selectedAssetIds, market: config.market, aspectRatio: config.aspectRatio, outputLanguage: config.outputLanguage, brief: (config.planningBrief ?? "").trim(), userNotes: (config.userNotes ?? "").trim(), selectedModules: selectedModules(config) });
  return JSON.stringify({ contract: "commerce-design-v1", styleId: config.styleId, customStyle: config.customStyle.trim(), assets: config.selectedAssetIds, market: config.market, aspectRatio: config.aspectRatio, outputLanguage: config.outputLanguage, brief: (config.planningBrief ?? "").trim(), ...(config.referenceAssetIds?.length ? { references: config.referenceAssetIds } : {}), ...(config.reverseVersionId ? { reverseVersionId: config.reverseVersionId } : {}) });
}

export function modulePlanMatchesInput(fingerprint: string, config: PlanningInputConfig): boolean {
  return fingerprint === modulePlanInputFingerprint(config);
}

export function modulePlanRequestInput(mode: GenerationMode, config: PlanningConfig): ApiModulePlanInput {
  if (config.creationMode === "regular") return { mode, creationMode: "regular", styleId: config.styleId, customStyle: config.customStyle.trim(), sourceAssetIds: config.selectedAssetIds, marketId: config.market, aspectRatio: config.aspectRatio, outputLanguage: config.outputLanguage, brief: (config.planningBrief ?? "").trim(), selectedModules: selectedModules(config), userNotes: (config.userNotes ?? "").trim() };
  return { mode, styleId: config.styleId, customStyle: config.customStyle.trim(), sourceAssetIds: config.selectedAssetIds, ...(config.referenceAssetIds?.length ? { referenceAssetIds: config.referenceAssetIds } : {}), ...(config.reverseVersionId ? { reverseVersionId: config.reverseVersionId } : {}), marketId: config.market, aspectRatio: config.aspectRatio, outputLanguage: config.outputLanguage, brief: (config.planningBrief ?? "").trim() };
}

export function canRecoverModulePlan(plan: ModulePlan, mode: GenerationMode, config: PlanningConfig): boolean {
  if (config.creationMode === "regular") {
    if (plan.planningContractVersion !== "regular-design-v1" || plan.mode !== mode || plan.input?.mode !== mode || plan.input.creationMode !== "regular") return false;
    const selection = plan.id === config.modulePlanId && config.modulePlanFingerprint === modulePlanInputFingerprint(config)
      ? plan.modules.map(item => ({ taskId: item.taskId ?? item.moduleId, moduleId: item.moduleId })) : plan.input.selectedModules ?? [];
    return modulePlanMatchesInput(modulePlanInputFingerprint({
      creationMode: "regular", styleId: plan.input.styleId, customStyle: plan.input.customStyle,
      selectedAssetIds: plan.input.sourceAssetIds, market: plan.input.marketId, aspectRatio: plan.input.aspectRatio,
      outputLanguage: plan.input.outputLanguage, planningBrief: plan.input.brief, userNotes: plan.input.userNotes,
      selectedModuleIds: selection.map(item => item.taskId), moduleTypes: Object.fromEntries(selection.map(item => [item.taskId, item.moduleId])),
    }), config);
  }
  return plan.planningContractVersion === "commerce-design-v1" && plan.mode === mode && plan.input?.mode === mode && modulePlanMatchesInput(modulePlanInputFingerprint({
    styleId: plan.input.styleId, customStyle: plan.input.customStyle,
    selectedAssetIds: plan.input.sourceAssetIds, market: plan.input.marketId, aspectRatio: plan.input.aspectRatio,
    outputLanguage: plan.input.outputLanguage, planningBrief: plan.input.brief, referenceAssetIds: plan.input.referenceAssetIds, reverseVersionId: plan.input.reverseVersionId,
  }), config);
}

export function needsModulePlan(config: PlanningConfig): boolean {
  if (config.creationMode === "regular") return !!config.planningBrief?.trim() && (!config.modulePlanId || !modulePlanMatchesInput(config.modulePlanFingerprint ?? "", config));
  return hasPlanningInput(config) && (!config.modulePlanId || !modulePlanMatchesInput(config.modulePlanFingerprint ?? "", config));
}

/** Regular mode can compile from the selected product and modules alone.
 * The planning brief is optional; when it is blank, the backend uses the
 * selected module parameters and its built-in module direction.
 */
export function canCompileRegular(config: Pick<PlanningConfig, "selectedAssetIds" | "selectedModuleIds">): boolean {
  return config.selectedAssetIds.length > 0 && config.selectedModuleIds.length > 0;
}

function mergeParameters(current: GenerationModuleParameter[] | undefined, planned: GenerationModuleParameter[], preserveEdits: boolean, baseline?: GenerationModuleParameter[]): GenerationModuleParameter[] {
  const values = planned.map((item) => ({ key: item.key, value: item.value }));
  if (!preserveEdits || !current) return values;
  const edited = current.filter((item) => baseline ? baseline.find((prior) => prior.key === item.key)?.value !== item.value : !!item.value.trim());
  const removed = new Set(baseline?.filter((prior) => !current.some((item) => item.key === prior.key)).map((item) => item.key));
  return [...values.filter((item) => !removed.has(item.key)).map((item) => edited.find((change) => change.key === item.key) ?? item), ...edited.filter((item) => !values.some((value) => value.key === item.key))];
}

export function applyModulePlan<T extends PlanningConfig>(config: T, plan: ModulePlan, options: { preserveEdits?: boolean } = {}): T {
  if (!["commerce-design-v1", "regular-design-v1"].includes(plan.planningContractVersion ?? "")) throw new Error("请重新规划后生成图片");
  const preserveEdits = options.preserveEdits ?? false;
  const taskKey = (item: ModulePlanModule) => item.taskId ?? item.moduleId;
  const sameTask = (item: ModulePlanModule) => (config.moduleTypes?.[taskKey(item)] ?? taskKey(item)) === item.moduleId;
  const selectedModuleIds = plan.modules.map(taskKey);
  const moduleTypes = Object.fromEntries(plan.modules.map((item) => [taskKey(item), item.moduleId]));
  const plannedCounts = Object.fromEntries(plan.modules.map((item) => [taskKey(item), 1]));
  const plannedParameters = Object.fromEntries(plan.modules.map((item) => [taskKey(item), mergeParameters(undefined, item.moduleParameters, false)]));
  const moduleTaskDetails = Object.fromEntries(plan.modules.map(item => [taskKey(item), {
    title: item.taskTitle, informationQuestion: item.informationQuestion, productPresence: item.productPresence,
    visualMechanism: item.visualMechanism ?? "", compositionAdvice: item.compositionBrief,
  }]));
  const moduleCounts = plannedCounts;
  const moduleTaskOverrides = Object.fromEntries(plan.modules.filter(item => preserveEdits && sameTask(item) && config.moduleTaskOverrides?.[taskKey(item)]).map(item => [taskKey(item), config.moduleTaskOverrides![taskKey(item)]]));
  const moduleParameters = Object.fromEntries(plan.modules.map((item) => {
    const key = taskKey(item);
    return [key, mergeParameters(config.moduleParameters[key], item.moduleParameters, preserveEdits && sameTask(item), config.modulePlanBaseline?.moduleParameters[key])];
  }));
  const modulePlanReferences = Object.fromEntries(plan.modules.filter(item => item.referenceModuleId && config.reverseVersionId).map(item => [taskKey(item), { versionId: config.reverseVersionId!, moduleId: item.referenceModuleId! }]));
  const regularTasks = Object.fromEntries(plan.modules.map(item => [taskKey(item), { goal: item.reason, copy: item.suggestedCopy ?? "" }]));
  const regularTaskOverrides = Object.fromEntries(plan.modules.filter(item => preserveEdits && sameTask(item) && config.regularTaskOverrides?.[taskKey(item)]).map(item => [taskKey(item), config.regularTaskOverrides![taskKey(item)]]));
  const next = { ...config, selectedModuleIds, moduleTypes, moduleCounts, moduleParameters, moduleTaskDetails, moduleTaskOverrides, regularTasks, regularTaskOverrides, modulePlanReferences, modulePlanId: plan.id, modulePlanningRequest: undefined, modulePlanBaseline: { moduleCounts: plannedCounts, moduleParameters: plannedParameters } } as T;
  return { ...next, modulePlanFingerprint: modulePlanInputFingerprint(next) };
}
