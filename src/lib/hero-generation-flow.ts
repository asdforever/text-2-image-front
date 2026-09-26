import type {
  ApiBatchGeneration,
  ApiBatchGenerationDetail,
  ApiBatchHeroPromptCompileInput,
  ApiHeroGenerationTask,
  ApiHeroPromptCompileInput,
} from "../api/client";

export interface BatchHeroGenerationApiPort {
  compile(
    projectId: string,
    input: ApiBatchHeroPromptCompileInput,
    idempotencyKey?: string,
  ): Promise<ApiBatchGeneration>;
}

export interface BatchHeroGenerationConfirmationApiPort {
  confirm(
    projectId: string,
    batchId: string,
    moduleTaskPrompts: Record<string, string>,
    idempotencyKey?: string,
  ): Promise<ApiBatchGenerationDetail>;
}

export interface HeroGenerationApiPort {
  compile(projectId: string, input: ApiHeroPromptCompileInput, idempotencyKey?: string): Promise<ApiHeroGenerationTask>;
  confirm(projectId: string, taskId: string, taskPrompt?: string, idempotencyKey?: string): Promise<ApiHeroGenerationTask>;
  get?(projectId: string, taskId: string): Promise<ApiHeroGenerationTask>;
}

export function validateStage3AHeroSelection(
  selectedAssetIds: string[],
  selectedModuleIds: string[],
  moduleCounts: Record<string, number>,
): string[] {
  const errors: string[] = [];
  if (selectedAssetIds.length !== 1) errors.push("阶段 3A 每次只能选择 1 张产品素材");
  if (selectedModuleIds.length !== 1) errors.push("阶段 3A 每次只能选择 1 个主图模块");
  if (selectedModuleIds.some((moduleId) => (moduleCounts[moduleId] ?? 1) !== 1)) {
    errors.push("阶段 3A 每个模块只能生成 1 张图片");
  }
  return errors;
}

export function validateBatchHeroSelection(
  selectedAssetIds: string[],
  selectedModuleIds: string[],
  moduleCounts: Record<string, number>,
): string[] {
  const errors: string[] = [];
  if (selectedAssetIds.length !== 1) errors.push("批次主图每次只能选择 1 张产品素材");
  if (selectedModuleIds.length === 0) errors.push("请至少选择 1 个主图模块");
  if (selectedModuleIds.some((moduleId) => {
    const count = moduleCounts[moduleId] ?? 1;
    return !Number.isInteger(count) || count < 1 || count > 4;
  })) {
    errors.push("每个主图模块的生成张数需在 1-4 张之间");
  }
  return errors;
}

export async function compileBatchHeroGenerationFlow(
  api: BatchHeroGenerationApiPort,
  projectId: string,
  input: ApiBatchHeroPromptCompileInput,
  idempotencyKey?: string,
): Promise<ApiBatchGeneration> {
  return api.compile(projectId, input, idempotencyKey);
}

export async function confirmBatchHeroGenerationFlow(
  api: BatchHeroGenerationConfirmationApiPort,
  projectId: string,
  batchId: string,
  moduleTaskPrompts: Record<string, string>,
  idempotencyKey?: string,
): Promise<ApiBatchGenerationDetail> {
  const normalized = Object.fromEntries(
    Object.entries(moduleTaskPrompts).map(([moduleTaskId, prompt]) => [moduleTaskId, prompt.trim()]),
  );
  if (Object.keys(normalized).length === 0 || Object.values(normalized).some((prompt) => !prompt)) {
    throw new Error("每个模块的实时任务提示词均不能为空");
  }
  return api.confirm(projectId, batchId, normalized, idempotencyKey);
}

export async function compileHeroGenerationFlow(
  api: HeroGenerationApiPort,
  projectId: string,
  input: ApiHeroPromptCompileInput,
  idempotencyKey?: string,
): Promise<ApiHeroGenerationTask> {
  return api.compile(projectId, input, idempotencyKey);
}

export async function confirmHeroGenerationFlow(
  api: HeroGenerationApiPort,
  projectId: string,
  taskId: string,
  taskPrompt: string,
  idempotencyKey?: string,
): Promise<ApiHeroGenerationTask> {
  const normalized = taskPrompt.trim();
  if (!normalized) throw new Error("实时任务提示词不能为空");
  return api.confirm(projectId, taskId, normalized, idempotencyKey);
}
