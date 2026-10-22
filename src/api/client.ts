import type { ApiTaskCenterResponse } from "../lib/task-center";
import { readCacheKeys, sharedReadCache } from "../lib/read-cache";

export interface ApiImage {
  id: string; suiteId: string; ordinal: number; originalObjectKey: string; thumbnailObjectKey: string;
  sha256: string; width: number; height: number; mimeType: string; originalFilename: string;
  currentBaseVersionId: string | null; createdAt: string; originalPreviewUrl: string; thumbnailPreviewUrl: string;
}
export type ApiProjectAssetKind = "source" | "white_background" | "generated";
export type ApiProjectAssetRole = ApiProjectAssetKind;
export interface ApiProjectAsset {
  id: string;
  kind: ApiProjectAssetKind;
  sourceAssetId: string | null;
  generationSnapshotId: string | null;
  state: "available" | "cleanup_pending" | "deleted";
  filename: string;
  mimeType: string;
  byteSize: number;
  width: number;
  height: number;
  sha256: string;
  createdAt: string;
  sourceKind?: "upload" | "project" | "production_library" | "asset_library" | "test_library" | "generated" | "long_image";
  sourceLibraryId?: string | null;
  sourceResourceId?: string | null;
  sourceResourceVersionId?: string | null;
  sourceSnapshot?: Record<string, unknown>;
}
export interface ApiLongImageItem {
  assetId: string;
  crop: { top: number; right: number; bottom: number; left: number };
  paddingTop: number;
  paddingBottom: number;
}
export interface ApiLongImageRecipe {
  title: string; width: number; gap: number; background: string; items: ApiLongImageItem[];
}
export interface ApiLongImage {
  assetId: string; title: string; width: number; height: number; previewUrl: string; recipe: ApiLongImageRecipe;
}
export interface ApiStyleHarmonizationInput {
  assetIds: string[]; mode: "reference" | "prompt" | "custom"; referenceAssetId?: string; promptVersionId?: string; prompt?: string; expectedPreviewHash?: string;
}
export interface ApiStyleHarmonizationTask {
  id: string; sourceAssetId: string; status: "queued" | "generating" | "succeeded" | "failed"; outputAssetId: string | null; error: string | null;
  sourceAsset: { assetId: string; width: number; height: number; filename: string; mimeType: string };
  archiveStatus?: "pending" | "succeeded" | "failed"; archiveError?: string | null;
}
export interface ApiStyleHarmonization {
  id: string; status: "queued" | "generating" | "succeeded" | "partial" | "failed"; mode: ApiStyleHarmonizationInput["mode"];
  assetIds: string[]; finalPrompt: string; tasks: ApiStyleHarmonizationTask[]; createdAt: string;
}
export interface ApiProject {
  id: string;
  name: string;
  status: "active" | "archived";
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface ApiProjectDetail extends ApiProject {
  assets: ApiProjectAsset[];
  selections: Partial<Record<ApiProjectAssetRole, string>>;
}
export interface ApiProjectSummary extends ApiProject {
  assetCount: number;
  coverAssetId: string | null;
}
export interface ApiGenerationConfigVersion {
  id: string;
  version: number;
  content: GenerationConfig;
  contentSha256: string;
  createdAt: string;
}
export interface ApiGenerationConfigDraft {
  baseVersion: number;
  content: GenerationConfig;
  updatedAt: string;
}
export interface ApiModelConnection {
  id: string;
  baseUrl: string;
  modelName: string;
  protocol: "openai_images" | "openai_chat";
  hasApiKey: boolean;
  createdAt: string | null;
}
export interface ApiModelConnectionInput {
  baseUrl: string;
  modelName: string;
  protocol: "openai_images" | "openai_chat";
  apiKey?: string;
  reuseConnectionId?: string;
}
export interface ApiResolvedGenerationConfig {
  runtimeModules: { version: string; contentSha256: string; heroModules: GenerationConfig["heroModules"]; suiteModules: GenerationConfig["suiteModules"] };
  configVersion: number;
  contentSha256: string;
  config: GenerationConfig;
  promptBindings: NonNullable<GenerationConfig["marketBindings"][string]>[];
}
export type ApiHeroGenerationStatus =
  | "compiling_prompt"
  | "awaiting_confirmation"
  | "generating"
  | "succeeded"
  | "failed";
export interface ApiHeroConstraintCard {
  content: string;
  source: string;
  contentSha256: string;
  promptTemplateId?: string | null;
  promptVersionId?: string | null;
  promptVersionSha256?: string | null;
}
export interface ApiHeroGenerationTask {
  id: string;
  plannerVersion?: "v2";
  projectId: string;
  sourceAssetId: string;
  status: ApiHeroGenerationStatus;
  snapshot: Record<string, unknown>;
  constraints: {
    authenticity: ApiHeroConstraintCard;
    market: ApiHeroConstraintCard;
    style: ApiHeroConstraintCard;
  };
  compiledTaskPrompt: string | null;
  visibleFacts: string[];
  unconfirmedItems: string[];
  confirmedTaskPrompt: string | null;
  finalPrompt: string | null;
  finalPromptSha256: string | null;
  providerRequest: Record<string, unknown> | null;
  generatedAssetId: string | null;
  generatedAssetPreviewUrl: string | null;
  error: { code: string; message: string } | null;
  createdAt: string;
  updatedAt: string;
  confirmedAt: string | null;
  completedAt: string | null;
}
export interface ApiHeroPromptCompileInput {
  sourceAssetId: string;
  marketId: string;
  modelId: string;
  styleId: string;
  moduleId: string;
  aspectRatio: string;
  resolution: string;
  outputLanguage: string;
  customStyle?: string;
  moduleParameters: Array<{ key: string; value: string }>;
  resultCount: 1;
}
export type ApiBatchGenerationStatus =
  | "compiling_prompt"
  | "awaiting_confirmation"
  | "queued"
  | "running"
  | "succeeded"
  | "partially_failed"
  | "failed"
  | "cancel_requested"
  | "cancelled";
export type ApiBatchGenerationSlotStatus =
  | "queued"
  | "leased"
  | "dispatching"
  | "succeeded"
  | "failed"
  | "cancel_requested"
  | "cancelled"
  | "needs_retry";
export interface ApiBatchHeroModuleInput {
  regularTask?: import("../lib/generation-workspace").RegularTask;
  regularOptions?: import("../lib/generation-workspace").RegularTaskOptions;
  taskDesign?: import("../lib/generation-workspace").GenerationTaskDesign;
  moduleId: string;
  reverseReference?: { versionId: string; moduleId: string };
  taskId?: string;
  resultCount: number;
  moduleParameters: Array<{ key: string; value: string }>;
}
export interface ApiBatchHeroPromptCompileInput {
  planningAppliedVersionId?: string;
  creationMode?: import("../lib/generation-workspace").CreationMode;
  userNotes?: string;
  sourceAssetId: string;
  reverseVersionId?: string;
  marketId: string;
  modelId: string;
  styleId: string;
  aspectRatio: string;
  resolution: string;
  outputLanguage: string;
  customStyle?: string;
  modulePlanId?: string;
  modules: ApiBatchHeroModuleInput[];
}
export interface ApiBatchGeneration {
  id: string;
  creationMode?: "regular" | "professional";
  plannerVersion?: "v2";
  projectId: string;
  sourceAssetId: string;
  kind?: "hero" | "suite";
  sourcePlanId?: string | null;
  status: ApiBatchGenerationStatus;
  createdAt: string;
  updatedAt: string;
  confirmedAt: string | null;
  completedAt: string | null;
  error?: { code: string; message: string } | null;
}
export interface ApiBatchGenerationModule {
  id: string;
  moduleKey: string;
  moduleId?: string;
  taskId?: string;
  moduleLabel?: string;
  position?: number;
  resultCount: number;
  constraints: Record<string, ApiHeroConstraintCard>;
  compiledTaskPrompt: string | null;
  visibleFacts: string[];
  unconfirmedItems: string[];
  confirmedTaskPrompt: string | null;
  finalPromptSha256: string | null;
}
export interface ApiBatchGenerationSlot {
  id: string;
  moduleTaskId: string;
  moduleKey: string;
  ordinal: number;
  status: ApiBatchGenerationSlotStatus;
  generatedAssetId: string | null;
  generatedAssetPreviewUrl: string | null;
  error: { code: string | null; message: string | null } | null;
}
export interface ApiBatchGenerationProgress {
  total: number;
  queued: number;
  leased: number;
  dispatching: number;
  succeeded: number;
  failed: number;
  cancelled: number;
  needsRetry: number;
  completed: number;
}
export interface ApiBatchGenerationDetail extends ApiBatchGeneration {
  modules: ApiBatchGenerationModule[];
  slots: ApiBatchGenerationSlot[];
  progress: ApiBatchGenerationProgress;
}
export type ApiSuitePlanStatus = "compiling" | "awaiting_confirmation" | "confirmed" | "failed";
export interface ApiSuitePlanReferenceInput { referenceId: string; version: string }
export interface ApiSuitePlanModuleCompileInput { moduleId: string; taskId?: string; resultCount: number; moduleParameters: Array<{ key: string; value: string }>; reverseReference?: { versionId: string; moduleId: string }; taskDesign?: import("../lib/generation-workspace").GenerationTaskDesign; regularTask?: import("../lib/generation-workspace").RegularTask; regularOptions?: import("../lib/generation-workspace").RegularTaskOptions }
export interface ApiSuitePlanCompileInput {
  planningAppliedVersionId?: string;
  creationMode?: import("../lib/generation-workspace").CreationMode;
  reverseVersionId?: string;
  sourceAssetIds: string[]; marketId: string; modelId: string; styleId: string;
  aspectRatio: string; resolution: string; outputLanguage: string;
  modules: ApiSuitePlanModuleCompileInput[]; userNotes?: string; customStyle?: string; modulePlanId?: string;
  references?: ApiSuitePlanReferenceInput[];
}
export interface ApiSuitePlanModule {
  moduleId?: string; taskId?: string; moduleLabel?: string;
  id: string; moduleKey: string; position: number; resultCount: number; revision: number;
  title: string; copySummary: string; visualDirection: string;
  moduleParameters: Array<{ key: string; value: string }>;
  promptSnapshot: Record<string, unknown>; compiledTaskPrompt: string | null;
  currentTaskPrompt: string | null; visibleFacts: string[]; unconfirmedItems: string[];
}
export interface ApiSuitePlan {
  id: string; projectId: string; status: ApiSuitePlanStatus; revision: number;
  plannerVersion?: "v2";
  snapshot: Record<string, unknown>; sourceAssets: Array<Record<string, unknown>>;
  constraints: Record<string, ApiHeroConstraintCard>; references: Array<Record<string, unknown>>;
  generationBatchId: string | null; modules: ApiSuitePlanModule[];
  error: { code: string; message: string } | null;
  createdAt: string; updatedAt: string; confirmedAt: string | null;
}
export interface ApiSuitePlanModulePatchInput {
  expectedPlanRevision: number; expectedModuleRevision: number; title?: string;
  copySummary?: string; visualDirection?: string; currentTaskPrompt?: string;
  resultCount?: number; moduleParameters?: Array<{ key: string; value: string }>;
}
export interface ApiSuitePlanConfirmation extends ApiSuitePlan { batchId: string }
export interface ApiModulePlanInput {
  creationMode?: import("../lib/generation-workspace").CreationMode;
  selectedModules?: Array<{ taskId: string; moduleId: string }>;
  userNotes?: string;
  styleId: string | null;
  customStyle: string;
  mode: "hero" | "suite";
  reverseVersionId?: string;
  sourceAssetIds: string[];
  referenceAssetIds?: string[];
  marketId: string;
  aspectRatio: string;
  outputLanguage: string;
  brief: string;
}
export interface ApiModulePlanModule {
  suggestedCopy?: string;
  taskTitle: string;
  informationQuestion: string;
  productPresence: "full" | "partial" | "detail" | "context" | "none";
  visualMechanism: string;
  designGuideIds: string[];
  moduleId: string;
  referenceModuleId?: string;
  taskId?: string;
  resultCount: number;
  moduleParameters: Array<{ key: string; value: string }>;
  compositionBrief: string;
  reason: string;
}
export interface ApiModulePlan {
  planningContractVersion?: "commerce-design-v1" | "regular-design-v1";
  sharedVisualDirection?: string;
  id: string;
  mode: "hero" | "suite";
  status: "planning" | "completed" | "failed";
  input: ApiModulePlanInput;
  summary: string;
  modules: ApiModulePlanModule[];
  warnings: string[];
  error?: { code: string; message: string };
  createdAt: string;
}
export interface ApiSuite { id: string; name: string; status: "draft" | "in_progress"; createdAt: string; updatedAt: string; inputImages: ApiImage[] }
export interface ApiBaseVersion {
  id: string; versionNumber: number; width: number; height: number; mimeType: "image/png"; sha256: string; createdAt: string; previewUrl: string;
}
export interface ApiGenerationAttempt {
  id: string; versionNumber: number; status: "running" | "succeeded" | "failed"; model: "gpt-image-2";
  templateVersionId: string;
  errorCode: string | null; errorMessage: string | null; createdAt: string; completedAt: string | null;
}
export interface ApiBaseHistory { currentVersionId: string | null; versions: ApiBaseVersion[]; attempts: ApiGenerationAttempt[] }
export interface ApiPromptInputField {
  key: string; label: string; type: "text" | "textarea" | "number" | "select"; required: boolean; order: number;
  defaultValue?: string | number; options?: string[];
}
export interface ApiPromptTemplate {
  id: string; code: string; name: string; kind: string; kindName?: string;
  categoryId: string | null; categoryName?: string | null;
  stage: "base_refine" | "plan" | "structure_plan" | "category_prompt" | "task_image" | "reverse_prompt"; executionTarget: "llm" | "image_model";
  defaultVersionId: string | null; defaultVersion: ApiPromptVersion | null; versionCount: number; createdAt: string; updatedAt: string;
  // Compatibility fields used by workbench consumers while they migrate to aggregate templates.
  templateId: string; templateVersionId: string; versionNo: number; inputSchema: ApiPromptInputField[]; applicability: Record<string, unknown>;
}
export interface ApiPromptCategory {
  id: string; name: string; sortOrder: number; templateCount: number; createdAt: string; updatedAt: string;
}
export interface ApiPromptVersion {
  id: string; templateId: string; templateVersionId: string; versionNo: number; name: string; kind: string; stage: ApiPromptTemplate["stage"];
  executionTarget: "llm" | "image_model"; body: string; userPromptTemplate: string; inputSchema: ApiPromptInputField[];
  outputSchema: Record<string, unknown>; applicability: Record<string, unknown>; generationParams?: Record<string, unknown>; contentSha256: string; source: "marketplace" | "file_import";
  changeNote: string | null; createdBy: string; filePath: string; fileSyncStatus: "pending" | "synced" | "failed";
  fileSyncError: string | null; createdAt: string; syncedAt: string | null; status?: "draft" | "published" | "retired";
}
export interface ApiPromptTemplateDetail extends ApiPromptTemplate { versions: ApiPromptVersion[] }
export interface ApiPromptSaveResult extends ApiPromptVersion { template: ApiPromptTemplate; version: ApiPromptVersion }
export type ApiPromptTemplateCopy = ApiPromptVersion;
export interface ApiPlatformProfile {
  code: string; name: string; marketScope: "overseas" | "domestic";
  mainImageStrategy: string; galleryStrategy: string; textStrategy: string; modelStrategy: string;
  sourceNote: string; sortOrder: number;
}
export interface ApiRagChunk { id:string;version:string;title:string;summary:string;sourceKind:string;sourceAssetPaths:string[];contentSha256:string;fieldValues?:Record<string,unknown> }
export interface ApiPlanItem { id:string;ordinal:number;imageType:"main"|"detail";title:string;purpose:string;prompt:string }
export interface ApiStructureAllocation { category:string; requirement:"required"|"optional"; count:number; reason:string; sourceImageIds:string[]; factRefs:string[]; missingFacts:string[] }
export interface ApiMainAllocation { category:"main"; count:number; reason:string; sourceImageIds:string[]; factRefs:string[]; missingFacts:string[] }
export interface ApiStructurePlan {
  schemaVersion?:"suite-structure-plan-v1"|"suite-structure-plan-v2";
  status?:"READY"|"READY_FOR_REVIEW"|"NEEDS_HUMAN_INPUT";
  mainAllocation?:ApiMainAllocation;
  mainImageCount?:number;
  detailImageCount:number;
  categoryAllocations:ApiStructureAllocation[];
  globalStyleCard:Record<string,unknown>;
  canProceed?:boolean;
}
export interface ApiCategoryPromptItem { stableId:string; category:string; title:string; purpose:string; referenceImageIds:string[]; factRefs:string[]; prompt:string; allowsTextOverlay:"platform_default"|"yes"|"no"; textContent:Array<{text:string;source:string}>; aspectRatio:string; suggestedParams:Record<string,unknown> }
export interface ApiCategoryPromptRequest { id:string; suiteId:string; planSnapshotId:string; categoryCode:string; requestedCount:number; status:"running"|"succeeded"|"failed"; idempotencyKey:string; retryOfRequestId:string|null; templateVersionId:string; provider:{name:string;model:string;isFake:boolean}; requestSummary:Record<string,unknown>; responseSummary:Record<string,unknown>|null; items:ApiCategoryPromptItem[]; errorCode:string|null; errorMessage:string|null; createdAt:string; completedAt:string|null }
export interface ApiCategoryPromptState { planSnapshotId:string|null; status:"not_ready"|"pending"|"running"|"partial"|"succeeded"; expectedRequestCount?:number; requests:ApiCategoryPromptRequest[] }
export interface ApiPlanSnapshot { id:string;revisionNumber:number;revisionKind:"llm"|"human";templateVersionId:string;dynamicInput:Record<string,unknown>;humanInput:Record<string,unknown>;chunks:Array<{sourceChunkId:string;sourceVersion:string;title:string;fieldValues:Record<string,unknown>;sourceKind:string}>;inputImageIds?:string[];provider:{name:string;model:string;isFake:boolean};items:ApiPlanItem[];phase?:"legacy_plan"|"structure_plan";confirmationStatus?:"draft"|"confirmed";confirmedAt?:string|null;structure?:ApiStructurePlan|null;categoryOutputs?:Record<string,{status:string;requestedCount:number;items:ApiCategoryPromptItem[];errorCode?:string|null;errorMessage?:string|null}>;createdAt:string }
export interface ApiPlanAttempt { id:string;status:"running"|"succeeded"|"failed";provider:{name:string;model:string;isFake:boolean};errorCode:string|null;errorMessage:string|null;snapshot:ApiPlanSnapshot|null }
export interface ApiPlanState { attempt:ApiPlanAttempt|null;snapshot:ApiPlanSnapshot|null }
export type ApiTaskStatus = "incomplete"|"pending"|"generating"|"generated"|"refining"|"failed"|"archived";
export interface ApiTaskVersion { id:string;taskId:string;slotId:string;attemptId:string;versionNumber:number;objectKey:string;processObjectKeys:string[];sha256:string;width:number;height:number;mimeType:string;promptSnapshot:Record<string,unknown>;contextSnapshot:Record<string,unknown>;isCurrent:boolean;isFinal:boolean;createdAt:string;previewUrl:string }
export interface ApiTaskAttempt { id:string;slotId:string;attemptNo:number;provider:string;model:string;endpoint:string;requestSummary:Record<string,unknown>;promptSnapshot:Record<string,unknown>;promptSha256:string;contextSnapshot:Record<string,unknown>;sourceKind:"base"|"original"|"library";sourceObjectKey:string;sourceInputImageId:string|null;sourceBaseVersionId:string|null;sourceLibraryReferenceId?:string|null;sourceResourceVersionId?:string|null;status:"running"|"succeeded"|"failed";errorCode:string|null;errorMessage:string|null;externalRequestId:string|null;startedAt:string;finishedAt:string|null }
export interface ApiTaskSlot { id:string;batchId:string;taskId:string;slotOrdinal:number;retryOfSlotId:string|null;status:"pending"|"generating"|"succeeded"|"failed";selectedVersionId:string|null;createdAt:string;completedAt:string|null }
export interface ApiProductMaterialRef { libraryReferenceId:string; resourceId:string; resourceVersionId:string; order:number; title?:string; previewUrl?:string }
export interface ApiSuiteTask { id:string;suiteId:string;planSnapshotId:string|null;planItemId:string|null;ordinal:number;imageType:"main"|"detail";title:string;purpose:string;promptDraft:string;promptRevision:number;sourceInputImageId:string|null;generationParams:Record<string,unknown>;status:ApiTaskStatus;archivedAt:string|null;createdAt:string;updatedAt:string;originKind?:"suite_plan"|"reverse_import";reversePlanId?:string|null;reverseReferenceId?:string|null;reversePromptVersionId?:string|null;reverseTaskGroupId?:string|null;sourceLibraryReferenceId?:string|null;sourceResourceVersionId?:string|null;sourceRevision?:number;versions:ApiTaskVersion[];attempts:ApiTaskAttempt[];slots:ApiTaskSlot[] }
export type ApiWorkbenchTaskPatch = { expectedRevision: number; title?: string; purpose?: string; promptDraft?: string; sourceInputImageId?: string | null; generationParams?: Record<string, unknown> };
export interface ApiTaskBatch { id:string;suiteId:string;kind:"batch"|"single"|"retry";requestedCount:number;taskIds:string[];status:"running"|"completed"|"partial"|"failed";idempotencyKey:string;createdAt:string;startedAt:string|null;finishedAt:string|null }
export interface ApiCanvasLayout { id:string;suiteId:string;layoutVersion:number;viewport:{x:number;y:number;zoom:number};nodes:Array<{nodeId:string;x:number;y:number;width?:number;height?:number;groupKey?:string;hidden?:boolean;connections?:string[]}>;groups:Array<{groupKey:string;x:number;y:number;width:number;height:number;collapsed?:boolean}>;updatedAt:string }
export interface ApiCanvasGenerationStep {
  id: string; kind: string; title: string; sourceAssetIds: string[]; outputAssetIds: string[]; outputVersionIds: string[];
  finalPrompt: string; taskPrompt: string; constraints: Record<string, { content?: string; source?: string; contentSha256?: string; promptTemplateId?: string | null; promptVersionId?: string | null; promptVersionSha256?: string | null }>;
  parameters: Record<string, unknown>;
  creationMode?: "regular" | "professional";
  trackId?: string; revisionId?: string; revisionNumber?: number; batchId?: string; batchCreatedAt?: string; batchStatus?: string;
  canRegenerate?: boolean;
  reversePlanId?: string; reversePlanName?: string; reverseBatchNo?: number;
}
export interface ApiCanvasRevision extends Omit<ApiCanvasGenerationStep, "outputAssetIds" | "outputVersionIds"> {
  number: number; status: "queued" | "generating" | "succeeded" | "partial" | "failed"; createdAt: string;
  outputs: Array<{ assetId: string; index: number }>; errors?: Array<{ index: number; message: string }>;
}
export interface ApiCanvasTrack { stepId: string; title: string; kind: string; originalAssetIds: string[]; currentAssetIds: string[]; revisions: ApiCanvasRevision[] }
export interface ApiWorkbench { generationTracks?: ApiCanvasTrack[] }
export interface ApiWorkbench { suite:ApiSuite;inputImages:ApiImage[];planSnapshot:ApiPlanSnapshot|null;tasks:ApiSuiteTask[];batches:ApiTaskBatch[];references?:ApiLibraryReference[];generationSteps?:ApiCanvasGenerationStep[];imageEditChildren?:Array<{task:Record<string,unknown>;snapshot:Record<string,unknown>|null;attempts:Record<string,unknown>[];versions:Array<{id:string;previewUrl?:string;versionNumber:number;width?:number;height?:number;mimeType?:string;attemptId?:string;promptSnapshot?:Record<string,unknown>}>}>;layout:ApiCanvasLayout|null }
export type ApiLibraryResourceType = "prompt_template"|"input_image"|"base_image"|"task_image_version"|"process_image"|"reverse_reference_asset";
export interface ApiLibraryResource { id:string;resourceType:ApiLibraryResourceType;title:string;summary:string;mimeType:string|null;previewUrl:string|null;suiteId:string|null;taskId:string|null;imageVersionId:string|null;baseVersionId:string|null;templateVersionId:string|null;resourceVersionId:string;stage:ApiPromptTemplate["stage"]|null;source:Record<string,unknown>;status?:"draft"|"published"|"archived";promptSnapshot?:Record<string,unknown>|null;createdAt:string;updatedAt:string }
export interface ApiLibraryReference { id:string;suiteId:string;resourceId:string;resourceType:ApiLibraryResourceType;targetType:"plan"|"task";targetId:string;resourceVersionId:string;snapshot:Record<string,unknown>;createdAt:string;createdBy:string|null;archivedAt:string|null }
export interface ApiImageEditOperation { operationId:string; type:string; summary?:string; sourceVersionId?:string; payload?:Record<string,unknown>; [key:string]:unknown }
export interface ApiImageEditSession {
  id:string;
  workspaceId?:string;
  projectId:string;
  sourceVersionId:string;
  sourceSnapshot:Record<string,unknown>;
  operations:ApiImageEditOperation[];
  revision:number;
  status:string;
  archivedAt?:string|null;
  createdAt?:string;
  updatedAt?:string;
}
export interface ApiImageEditTask {
  id:string;
  sessionId:string;
  projectId?:string;
  revision:number;
  status:string;
  operations:ApiImageEditOperation[];
  sourceSnapshot:Record<string,unknown>;
  promptSnapshot:Record<string,unknown>;
  configSnapshot:Record<string,unknown>;
  attempts:Array<{id:string;attemptNumber:number;status:string;error?:string|null}>;
  currentVersionId:string|null;
  finalVersionId:string|null;
  createdAt?:string;
}
export type ApiProductionProductType = "hero" | "detail" | "white_background" | "scene" | "edit";
export interface ApiProductionLibrary { id:string; name:string; description:string; archivedAt:string|null; createdAt?:string; updatedAt?:string }
export interface ApiProductionVersion { id:string; productType:ApiProductionProductType|string; sourceSnapshot:Record<string,unknown>; previewUrl:string|null; status:string }
export interface ApiProductionAsset { id:string; kind:"source"|"white_background"|"generated"|string; sourceKind:string; originalFilename:string; mimeType:string; fileSize:number; width:number; height:number; previewUrl:string; sourceSnapshot:Record<string,unknown>; versions:ApiProductionVersion[] }
export interface ApiProductionProduct { id:string; libraryId:string; name:string; projectId:string|null; archivedAt:string|null; versions:ApiProductionVersion[]; assets:ApiProductionAsset[] }
export interface ApiTestProductLibrary { id:string; name:string; description:string; libraryType:"test_result"|"manual"; createdAt:string; updatedAt:string }
export interface ApiTestProduct { id:string; libraryId:string; name:string; productType:string; minioBucket:string; minioKey:string; fileType:string|null; fileSize:number; testRunId?:string|null; projectId?:string|null; metadata?:Record<string,unknown>; url?:string; createdAt:string; updatedAt:string }

type CryptoSource = {
  randomUUID?: () => string;
  getRandomValues?: Crypto["getRandomValues"];
};

let fallbackId = 0;

export function createIdempotencyKey(cryptoApi: CryptoSource | undefined = globalThis.crypto) {
  if (typeof cryptoApi?.randomUUID === "function") return cryptoApi.randomUUID();
  if (typeof cryptoApi?.getRandomValues === "function") {
    const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const value = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
  }
  fallbackId += 1;
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${fallbackId.toString(36)}`;
}

export class ApiResultUnknownError extends Error {
  status: number;
  method: string;
  path: string;
  constructor(status: number, method: string, path: string) {
    super("请求已发出，但无法确认服务端结果，请刷新核对");
    this.name = "ApiResultUnknownError";
    this.status = status;
    this.method = method;
    this.path = path;
  }
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...init, cache: "no-store" });
  const payload = await response.json().catch(() => null) as { data?: T; error?: { message?: string; code?: string } } | null;
  if (!response.ok) throw Object.assign(new Error(payload?.error?.message ?? "请求失败"), { status: response.status, code: payload?.error?.code });
  if (payload === null || !("data" in payload)) {
    throw new ApiResultUnknownError(response.status, init?.method ?? "GET", path);
  }
  return payload.data as T;
}

async function requestEmpty(path: string, init: RequestInit): Promise<void> {
  const response = await fetch(path, { ...init, cache: "no-store" });
  if (response.ok) return;
  const payload = await response.json().catch(() => null) as { error?: { message?: string } } | null;
  throw new Error(payload?.error?.message ?? "请求失败");
}

const defaultSuiteConfigDraft: SuiteConfigDraft = {
  platform: "Amazon 日本站",
  language: "中文",
  mainImageCount: 4,
  detailImageCount: 6,
  category: "",
  facts: "",
  selectedChunkIds: [],
};

export function projectAssetPreviewUrl(projectId: string, assetId: string) {
  return `/api/projects/${encodeURIComponent(projectId)}/assets/${encodeURIComponent(assetId)}/preview`;
}

export function toWorkbenchProject(project: ApiProjectDetail): Project {
  const assets: Asset[] = project.assets
    .filter((asset) => asset.state !== "deleted")
    .map((asset) => {
      const url = projectAssetPreviewUrl(project.id, asset.id);
      const type = asset.kind === "white_background" ? "base" : asset.kind === "generated" ? "hero" : "source";
      return {
        id: asset.id,
        projectId: project.id,
        type,
        ...(asset.sourceSnapshot?.background === "transparent" ? { background: "transparent" as const } : {}),
        name: asset.filename,
        dimensions: `${asset.width}x${asset.height}`,
        url,
        status: "ready",
        version: 1,
        ...(asset.sourceAssetId ? { sourceAssetId: asset.sourceAssetId } : {}),
        ...(asset.generationSnapshotId ? { generationSnapshotId: asset.generationSnapshotId } : {}),
        source: asset.sourceKind === "asset_library" && asset.sourceLibraryId && asset.sourceResourceId
          ? { kind: "asset-library", libraryId: asset.sourceLibraryId, assetId: asset.sourceResourceId, ...(asset.sourceResourceVersionId ? { resourceVersionId: asset.sourceResourceVersionId } : {}) }
          : asset.sourceKind === "production_library" && asset.sourceLibraryId && asset.sourceResourceId
            ? { kind: "production-library", libraryId: asset.sourceLibraryId, productId: asset.sourceResourceId, ...(asset.sourceResourceVersionId ? { versionId: asset.sourceResourceVersionId } : {}) }
            : asset.sourceKind === "test_library" && asset.sourceLibraryId && asset.sourceResourceId
              ? { kind: "test-library", libraryId: asset.sourceLibraryId, productId: asset.sourceResourceId }
              : { kind: "upload" },
        versions: [{
          id: `${asset.id}-v1`,
          version: 1,
          url,
          createdAt: asset.createdAt,
          template: asset.kind === "white_background" ? "白底图上传" : "原始上传",
          status: "ready",
        }],
      };
    });
  return {
    id: project.id,
    name: project.name,
    productName: "",
    outputTargets: ["base", "hero", "suite", "video"],
    sourceCount: assets.filter((asset) => asset.type === "source").length,
    updatedAt: project.updatedAt,
    assets,
    suiteConfigDraft: defaultSuiteConfigDraft,
  };
}

function invalidateProjectReads(projectId: string) {
  sharedReadCache.invalidatePrefix("projects:list:");
  sharedReadCache.invalidate(readCacheKeys.projectDetail(projectId));
}

export const styleHarmonizationApi = {
  preview(projectId: string, input: ApiStyleHarmonizationInput) {
    return request<{ finalPrompt: string; assetIds: string[]; mode: ApiStyleHarmonizationInput["mode"]; previewHash: string }>(`/api/projects/${encodeURIComponent(projectId)}/style-harmonizations/preview`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input),
    });
  },
  list(projectId: string) { return request<ApiStyleHarmonization[]>(`/api/projects/${encodeURIComponent(projectId)}/style-harmonizations`); },
  submit(projectId: string, input: ApiStyleHarmonizationInput, idempotencyKey: string) {
    return request<ApiStyleHarmonization>(`/api/projects/${encodeURIComponent(projectId)}/style-harmonizations`, {
      method: "POST", headers: { "content-type": "application/json", "idempotency-key": idempotencyKey }, body: JSON.stringify(input),
    });
  },
};

export const longImageApi = {
  list(projectId: string) {
    return request<ApiLongImage[]>(`/api/projects/${encodeURIComponent(projectId)}/long-images`);
  },
  save(projectId: string, recipe: ApiLongImageRecipe, idempotencyKey: string) {
    return request<ApiLongImage>(`/api/projects/${encodeURIComponent(projectId)}/long-images`, {
      method: "POST", headers: { "content-type": "application/json", "idempotency-key": idempotencyKey }, body: JSON.stringify(recipe),
    });
  },
  async download(projectId: string, assetId: string, sliceHeight?: number) {
    const path = `/api/projects/${encodeURIComponent(projectId)}/long-images/${encodeURIComponent(assetId)}/download${sliceHeight === undefined ? "" : `?sliceHeight=${sliceHeight}`}`;
    const response = await fetch(path, { cache: "no-store" });
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(payload?.error?.message ?? "下载失败，请重试");
    }
    return response.blob();
  },
};

export const projectApi = {
  async create(name: string) {
    const project = await request<ApiProject>("/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": createIdempotencyKey() },
      body: JSON.stringify({ name }),
    });
    sharedReadCache.invalidatePrefix("projects:");
    return project;
  },
  list(includeArchived = false) {
    return sharedReadCache.read(readCacheKeys.projectList(includeArchived), () => request<ApiProjectSummary[]>(`/api/projects${includeArchived ? "?includeArchived=true" : ""}`));
  },
  get(projectId: string, options?: { force?: boolean }) {
    return sharedReadCache.read(
      readCacheKeys.projectDetail(projectId),
      () => request<ApiProjectDetail>(`/api/projects/${encodeURIComponent(projectId)}`),
      undefined,
      options?.force,
    );
  },
  async archive(projectId: string) {
    const project = await request<ApiProject>(`/api/projects/${encodeURIComponent(projectId)}/archive`, {
      method: "POST",
      headers: { "idempotency-key": createIdempotencyKey() },
    });
    sharedReadCache.invalidatePrefix("projects:");
    return project;
  },
  async remove(projectId: string) {
    await requestEmpty(`/api/projects/${encodeURIComponent(projectId)}`, {
      method: "DELETE",
      headers: { "idempotency-key": createIdempotencyKey() },
    });
    sharedReadCache.invalidatePrefix("projects:");
  },
  listAssets(projectId: string) {
    return request<ApiProjectAsset[]>(`/api/projects/${encodeURIComponent(projectId)}/assets`);
  },
  async uploadAsset(projectId: string, kind: "source" | "white_background", file: File, sourceAssetId?: string, origin?: { sourceKind?: string; sourceLibraryId?: string; sourceResourceId?: string; sourceResourceVersionId?: string; sourceSnapshot?: Record<string, unknown> }) {
    const form = new FormData();
    form.append("kind", kind);
    form.append("file", file, file.name);
    if (sourceAssetId) form.append("sourceAssetId", sourceAssetId);
    if (origin?.sourceKind) form.append("sourceKind", origin.sourceKind);
    if (origin?.sourceLibraryId) form.append("sourceLibraryId", origin.sourceLibraryId);
    if (origin?.sourceResourceId) form.append("sourceResourceId", origin.sourceResourceId);
    if (origin?.sourceResourceVersionId) form.append("sourceResourceVersionId", origin.sourceResourceVersionId);
    if (origin?.sourceSnapshot) form.append("sourceSnapshot", JSON.stringify(origin.sourceSnapshot));
    const asset = await request<ApiProjectAsset>(`/api/projects/${encodeURIComponent(projectId)}/assets`, {
      method: "POST",
      headers: { "idempotency-key": createIdempotencyKey() },
      body: form,
    });
    invalidateProjectReads(projectId);
    return asset;
  },
  listWhiteBackgroundGenerations(projectId: string) {
    return request<ApiImageEditTask[]>(`/api/projects/${encodeURIComponent(projectId)}/white-background-generations`);
  },
  generateWhiteBackground(projectId: string, assetId: string, payload: { background: "white" | "transparent" }) {
    return request<ApiImageEditTask>(`/api/projects/${encodeURIComponent(projectId)}/assets/${encodeURIComponent(assetId)}/white-background-generations`, {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": createIdempotencyKey() },
      body: JSON.stringify(payload),
    });
  },
  async selectAsset(projectId: string, role: ApiProjectAssetRole, assetId: string) {
    const asset = await request<ApiProjectAsset>(`/api/projects/${encodeURIComponent(projectId)}/selections/${encodeURIComponent(role)}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ assetId }),
    });
    invalidateProjectReads(projectId);
    return asset;
  },
  async clearSelection(projectId: string, role: ApiProjectAssetRole) {
    await requestEmpty(`/api/projects/${encodeURIComponent(projectId)}/selections/${encodeURIComponent(role)}`, { method: "DELETE" });
    invalidateProjectReads(projectId);
  },
  async removeAsset(projectId: string, assetId: string) {
    await requestEmpty(`/api/projects/${encodeURIComponent(projectId)}/assets/${encodeURIComponent(assetId)}`, { method: "DELETE" });
    invalidateProjectReads(projectId);
  },
};

export const taskCenterApi = {
  list() {
    return request<ApiTaskCenterResponse>("/api/task-center");
  },
};

export const heroGenerationApi = {
  compile(projectId: string, input: ApiHeroPromptCompileInput, idempotencyKey = createIdempotencyKey()) {
    return request<ApiHeroGenerationTask>(
      `/api/projects/${encodeURIComponent(projectId)}/hero-generations/compile`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": idempotencyKey,
        },
        body: JSON.stringify(input),
      },
    );
  },
  get(projectId: string, taskId: string) {
    return request<ApiHeroGenerationTask>(
      `/api/projects/${encodeURIComponent(projectId)}/hero-generations/${encodeURIComponent(taskId)}`,
    );
  },
  confirm(projectId: string, taskId: string, taskPrompt?: string, idempotencyKey = createIdempotencyKey()) {
    return request<ApiHeroGenerationTask>(
      `/api/projects/${encodeURIComponent(projectId)}/hero-generations/${encodeURIComponent(taskId)}/confirm`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": idempotencyKey,
        },
        body: JSON.stringify(taskPrompt === undefined ? {} : { taskPrompt }),
      },
    );
  },
};

export const batchGenerationApi = {
  recover(projectId: string, key: string) {
    return request<ApiBatchGenerationDetail | null>(`/api/projects/${encodeURIComponent(projectId)}/generation-batches/by-request?${new URLSearchParams({ key })}`);
  },
  workerStatus() {
    return request<{ status: "online" | "offline" | "unknown"; lastSeenAt: string | null }>("/api/generation-worker/status");
  },
  compile(projectId: string, input: ApiBatchHeroPromptCompileInput, idempotencyKey = createIdempotencyKey()) {
    return request<ApiBatchGeneration>(
      `/api/projects/${encodeURIComponent(projectId)}/generation-batches/compile`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": idempotencyKey,
        },
        body: JSON.stringify(input),
      },
    );
  },
  get(projectId: string, batchId: string) {
    return request<ApiBatchGenerationDetail>(
      `/api/projects/${encodeURIComponent(projectId)}/generation-batches/${encodeURIComponent(batchId)}`,
    );
  },
  confirm(
    projectId: string,
    batchId: string,
    moduleTaskPrompts: Record<string, string>,
    idempotencyKey = createIdempotencyKey(),
  ) {
    return request<ApiBatchGenerationDetail>(
      `/api/projects/${encodeURIComponent(projectId)}/generation-batches/${encodeURIComponent(batchId)}/confirm`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": idempotencyKey,
        },
        body: JSON.stringify({ moduleTaskPrompts }),
      },
    );
  },
  cancel(projectId: string, batchId: string) {
    return request<ApiBatchGenerationDetail>(
      `/api/projects/${encodeURIComponent(projectId)}/generation-batches/${encodeURIComponent(batchId)}/cancel`,
      { method: "POST" },
    );
  },
  retrySlot(projectId: string, batchId: string, slotId: string) {
    return request<{ slot: ApiBatchGenerationSlot }>(
      `/api/projects/${encodeURIComponent(projectId)}/generation-batches/${encodeURIComponent(batchId)}/slots/${encodeURIComponent(slotId)}/retry`,
      { method: "POST" },
    );
  },
};

export const suitePlanningApi = {
  recover(projectId: string, key: string) {
    return request<ApiSuitePlan | null>(`/api/projects/${encodeURIComponent(projectId)}/suite-plans/by-request?${new URLSearchParams({ key })}`);
  },
  compile(projectId: string, input: ApiSuitePlanCompileInput, idempotencyKey = createIdempotencyKey()) {
    return request<ApiSuitePlan>(`/api/projects/${encodeURIComponent(projectId)}/suite-plans/compile`, {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": idempotencyKey },
      body: JSON.stringify(input),
    });
  },
  get(projectId: string, planId: string) {
    return request<ApiSuitePlan>(`/api/projects/${encodeURIComponent(projectId)}/suite-plans/${encodeURIComponent(planId)}`);
  },
  getLatest(projectId: string) {
    return request<ApiSuitePlan>(`/api/projects/${encodeURIComponent(projectId)}/suite-plans/latest`);
  },
  updateModule(
    projectId: string, planId: string, moduleId: string, input: ApiSuitePlanModulePatchInput,
  ) {
    return request<ApiSuitePlan>(
      `/api/projects/${encodeURIComponent(projectId)}/suite-plans/${encodeURIComponent(planId)}/modules/${encodeURIComponent(moduleId)}`,
      { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(input) },
    );
  },
  reorder(projectId: string, planId: string, expectedPlanRevision: number, moduleIds: string[]) {
    return request<ApiSuitePlan>(
      `/api/projects/${encodeURIComponent(projectId)}/suite-plans/${encodeURIComponent(planId)}/order`,
      { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ expectedPlanRevision, moduleIds }) },
    );
  },
  confirm(
    projectId: string, planId: string, expectedPlanRevision: number,
    moduleTaskPrompts: Record<string, string>, idempotencyKey = createIdempotencyKey(),
  ) {
    return request<ApiSuitePlanConfirmation>(
      `/api/projects/${encodeURIComponent(projectId)}/suite-plans/${encodeURIComponent(planId)}/confirm`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": idempotencyKey },
        body: JSON.stringify({ expectedPlanRevision, moduleTaskPrompts }),
      },
    );
  },
};

export const modulePlanningApi = {
  plan(projectId: string, input: ApiModulePlanInput, idempotencyKey = createIdempotencyKey()) {
    return request<ApiModulePlan>(`/api/projects/${encodeURIComponent(projectId)}/module-plans`, {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": idempotencyKey },
      body: JSON.stringify(input),
    });
  },
  getLatest(projectId: string, mode: "hero" | "suite") {
    return request<ApiModulePlan>(`/api/projects/${encodeURIComponent(projectId)}/module-plans/latest?mode=${encodeURIComponent(mode)}`);
  },
  get(projectId: string, planId: string) {
    return request<ApiModulePlan>(`/api/projects/${encodeURIComponent(projectId)}/module-plans/${encodeURIComponent(planId)}`);
  },
};

export function toPublishedGenerationConfig(record: ApiGenerationConfigVersion): GenerationConfig {
  return JSON.parse(JSON.stringify({
    ...record.content,
    version: record.version,
    savedAt: record.createdAt,
  })) as GenerationConfig;
}

export function toDraftGenerationConfig(record: ApiGenerationConfigDraft): GenerationConfig {
  return JSON.parse(JSON.stringify({
    ...record.content,
    version: record.baseVersion,
    savedAt: record.updatedAt,
  })) as GenerationConfig;
}

const generationConfigWriteHeaders = (includeJson = false) => ({
  ...(includeJson ? { "content-type": "application/json" } : {}),
  "idempotency-key": createIdempotencyKey(),
});

export const modelConnectionsApi = {
  list() {
    return request<ApiModelConnection[]>("/api/model-connections");
  },
  create(input: ApiModelConnectionInput) {
    return request<ApiModelConnection>("/api/model-connections", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
  },
};

export const generationConfigApi = {
  getPublished() {
    return sharedReadCache.read(readCacheKeys.publishedGenerationConfig, () => request<ApiGenerationConfigVersion>("/api/generation-config"));
  },
  getDraft() {
    return request<ApiGenerationConfigDraft>("/api/generation-config/draft");
  },
  replaceDraft(baseVersion: number, content: GenerationConfig) {
    return request<ApiGenerationConfigDraft>("/api/generation-config/draft", {
      method: "PUT",
      headers: generationConfigWriteHeaders(true),
      body: JSON.stringify({ baseVersion, content }),
    });
  },
  discardDraft() {
    return request<ApiGenerationConfigDraft>("/api/generation-config/draft", {
      method: "DELETE",
      headers: generationConfigWriteHeaders(),
    });
  },
  async publish() {
    const published = await request<ApiGenerationConfigVersion>("/api/generation-config/publish", {
      method: "POST",
      headers: generationConfigWriteHeaders(),
    });
    sharedReadCache.invalidate(readCacheKeys.publishedGenerationConfig);
    return published;
  },
  getVersion(version: number) {
    return request<ApiGenerationConfigVersion>(`/api/generation-config/versions/${version}`);
  },
  resolvePublished() {
    return request<ApiResolvedGenerationConfig>("/api/generation-config/resolve");
  },
};

export const suiteApi = {
  create(name: string) { return request<{ id: string; name: string }>("/api/suites", { method: "POST", headers: { "content-type": "application/json", "idempotency-key": createIdempotencyKey() }, body: JSON.stringify({ name }) }); },
  list() { return request<ApiSuite[]>("/api/suites"); },
  get(id: string) { return request<ApiSuite>(`/api/suites/${encodeURIComponent(id)}`); },
  upload(id: string, file: File, ordinal: number, onProgress?: (value: number) => void) {
    return new Promise<ApiImage>((resolve, reject) => {
      const xhr = new XMLHttpRequest(); xhr.open("POST", `/api/suites/${encodeURIComponent(id)}/input-images`); xhr.setRequestHeader("idempotency-key", createIdempotencyKey());
      xhr.upload.onprogress = (event) => { if (event.lengthComputable) onProgress?.(Math.round(event.loaded / event.total * 100)); };
      xhr.onerror = () => reject(new Error("上传失败，请检查网络连接"));
      xhr.onload = () => { try { const payload = JSON.parse(xhr.responseText) as { data?: ApiImage; error?: { message?: string } }; if (xhr.status >= 200 && xhr.status < 300 && payload.data) resolve(payload.data); else reject(new Error(payload.error?.message ?? "上传失败")); } catch { reject(new Error("上传响应无效")); } };
      const form = new FormData(); form.append("ordinal", String(ordinal)); form.append("file", file, file.name); xhr.send(form);
    });
  },
  listPromptTemplates(stage?: ApiPromptTemplate["stage"]) {
    const query = stage ? `?stage=${encodeURIComponent(stage)}` : "";
    return sharedReadCache.read(readCacheKeys.promptTemplates(stage), () => request<ApiPromptTemplate[]>(`/api/prompt-templates${query}`));
  },
  listPromptCategories() { return sharedReadCache.read(readCacheKeys.promptCategories, () => request<ApiPromptCategory[]>("/api/prompt-categories")); },
  async createPromptCategory(name: string) { const result = await request<ApiPromptCategory>("/api/prompt-categories", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name }) }); sharedReadCache.invalidatePrefix("prompts:"); return result; },
  async updatePromptCategory(categoryId: string, name: string) { const result = await request<ApiPromptCategory>(`/api/prompt-categories/${encodeURIComponent(categoryId)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ name }) }); sharedReadCache.invalidatePrefix("prompts:"); return result; },
  async deletePromptCategory(categoryId: string) { const result = await request<{ id: string; affectedTemplateCount: number }>(`/api/prompt-categories/${encodeURIComponent(categoryId)}`, { method: "DELETE" }); sharedReadCache.invalidatePrefix("prompts:"); return result; },
  getPromptTemplate(templateId: string) { return sharedReadCache.read(readCacheKeys.promptDetail(templateId), () => request<ApiPromptTemplateDetail>(`/api/prompt-templates/${encodeURIComponent(templateId)}`)); },
  listPromptTemplateVersions(templateId: string) { return sharedReadCache.read(readCacheKeys.promptVersions(templateId), () => request<ApiPromptVersion[]>(`/api/prompt-templates/${encodeURIComponent(templateId)}/versions`)); },
  async createPromptTemplate(body: Record<string, unknown>, idempotencyKey?: string) { const result = await request<ApiPromptSaveResult>("/api/prompt-templates", { method: "POST", headers: { "content-type": "application/json", ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {}) }, body: JSON.stringify(body) }); sharedReadCache.invalidatePrefix("prompts:"); return result; },
  async createPromptVersion(templateId: string, body: Record<string, unknown>, idempotencyKey?: string) { const result = await request<ApiPromptSaveResult>(`/api/prompt-templates/${encodeURIComponent(templateId)}/versions`, { method: "POST", headers: { "content-type": "application/json", ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {}) }, body: JSON.stringify(body) }); sharedReadCache.invalidatePrefix("prompts:"); return result; },
  async deletePromptTemplate(templateId: string) { const result = await request<{ id: string }>(`/api/prompt-templates/${encodeURIComponent(templateId)}`, { method: "DELETE" }); sharedReadCache.invalidatePrefix("prompts:"); return result; },
  async deletePromptTemplates(templateIds: string[]) { const result = await request<{ deletedIds: string[] }>(`/api/prompt-templates/batch-delete`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ templateIds }) }); sharedReadCache.invalidatePrefix("prompts:"); return result; },
  async updatePromptTemplateInfo(templateId: string, data: { name?: string; kindName?: string; categoryId?: string | null }) { const result = await request<{ data: ApiPromptTemplateDetail }>(`/api/prompt-templates/${encodeURIComponent(templateId)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(data) }); sharedReadCache.invalidatePrefix("prompts:"); return result.data; },
  async setDefaultPromptVersion(templateId: string, versionId: string) { const result = await request<{ data: ApiPromptTemplateDetail }>(`/api/prompt-templates/${encodeURIComponent(templateId)}/versions/${encodeURIComponent(versionId)}/set-default`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({}) }); sharedReadCache.invalidatePrefix("prompts:"); return result.data; },
  getPromptVersion(versionId: string) { return request<ApiPromptVersion>(`/api/prompt-versions/${encodeURIComponent(versionId)}`); },
  resolvePromptVersion(templateId: string, versionId?: string) { return request<ApiPromptVersion>(`/api/prompt-templates/${encodeURIComponent(templateId)}/resolve${versionId ? `?versionId=${encodeURIComponent(versionId)}` : ""}`); },
  async retryPromptSync(versionId: string) { const result = await request<ApiPromptVersion>(`/api/prompt-versions/${encodeURIComponent(versionId)}/sync-retry`, { method: "POST", headers: { "content-type": "application/json" } }); sharedReadCache.invalidatePrefix("prompts:"); return result; },
  // Transitional aliases retain the client surface while remaining routed through FastAPI.
  copyPromptTemplate(templateVersionId: string, _stage?: ApiPromptTemplate["stage"]) { return this.getPromptVersion(templateVersionId); },
  updatePromptTemplate(versionId: string, body: Partial<Pick<ApiPromptVersion, "body" | "userPromptTemplate" | "inputSchema" | "outputSchema" | "applicability">>) { return this.getPromptVersion(versionId).then((version) => this.createPromptVersion(version.templateId, { baseVersionId: version.id, ...body })); },
  copyPromptTemplateVersion(versionId: string) { return this.getPromptVersion(versionId); },
  publishPromptTemplate(versionId: string) { return this.getPromptVersion(versionId); },
  retirePromptTemplate(versionId: string) { return this.getPromptVersion(versionId); },
  getWorkbench(suiteId:string){return request<ApiWorkbench>(`/api/suites/${encodeURIComponent(suiteId)}/workbench`);},
  previewCanvasConstraints(projectId: string, stepId: string, baseRevisionId: string) { return request<{ constraints: ApiCanvasGenerationStep["constraints"]; constraintsHash: string }>(`/api/projects/${encodeURIComponent(projectId)}/canvas/constraint-preview?${new URLSearchParams({ stepId, baseRevisionId })}`); },
  regenerateCanvas(projectId: string, body: { stepId: string; baseRevisionId: string; taskPrompt: string; sourceAssetIds: string[]; restoredConstraintsHash?: string }, requestKey: string) { return request<ApiCanvasRevision>(`/api/projects/${encodeURIComponent(projectId)}/canvas/generations`, { method: "POST", headers: { "content-type": "application/json", "idempotency-key": requestKey }, body: JSON.stringify(body) }); },
  selectCanvasVersion(projectId: string, stepId: string, outputIndex: number, assetId: string) { return request<ApiCanvasTrack>(`/api/projects/${encodeURIComponent(projectId)}/canvas/version-selection`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ stepId, outputIndex, assetId }) }); },
  createTasks(suiteId:string,planSnapshotId?:string){return request<{planSnapshotId:string;tasks:ApiSuiteTask[];createdTaskIds:string[]}>(`/api/suites/${encodeURIComponent(suiteId)}/tasks`,{method:"POST",headers:{"content-type":"application/json","idempotency-key":createIdempotencyKey()},body:JSON.stringify(planSnapshotId?{planSnapshotId}:{})});},
  updateTask(taskId:string,body:ApiWorkbenchTaskPatch){return request<ApiSuiteTask>(`/api/suite-tasks/${encodeURIComponent(taskId)}`,{method:"PATCH",headers:{"content-type":"application/json","idempotency-key":createIdempotencyKey()},body:JSON.stringify(body)});},
  generateBatch(suiteId:string,taskIds?:string[]){return request<{batchId:string;status:string;requestedCount?:number}>(`/api/suites/${encodeURIComponent(suiteId)}/generation`,{method:"POST",headers:{"content-type":"application/json","idempotency-key":createIdempotencyKey()},body:JSON.stringify(taskIds?{taskIds}:{})});},
  generateTask(taskId:string,promptDraft?:string,expectedRevision?:number){const body={...(promptDraft===undefined?{}:{promptDraft}),...(expectedRevision===undefined?{}:{expectedRevision})};return request<{batchId:string;status:string}>(`/api/suite-tasks/${encodeURIComponent(taskId)}/generation`,{method:"POST",headers:{"content-type":"application/json","idempotency-key":createIdempotencyKey()},body:JSON.stringify(body)});},
  getTaskVersions(taskId:string){return request<{versions:ApiTaskVersion[];attempts:ApiTaskAttempt[]}>(`/api/suite-tasks/${encodeURIComponent(taskId)}/versions`);},
  selectTaskVersion(taskId:string,versionId:string,selection:"current"|"final"){return request<ApiTaskVersion>(`/api/suite-tasks/${encodeURIComponent(taskId)}/versions/${encodeURIComponent(versionId)}/select`,{method:"POST",headers:{"content-type":"application/json","idempotency-key":createIdempotencyKey()},body:JSON.stringify({selection})});},
  imageEditorCapabilities(){return request<{provider:{name:string;version:string;capabilitiesVersion:string};capabilities:Record<string,boolean> }>("/api/image-editor/capabilities");},
  createImageEditSession(projectId:string, sourceVersionId:string){return request<ApiImageEditSession>("/api/image-editor/sessions",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({projectId,sourceVersionId})});},
  listImageEditSessions(projectId:string){return request<ApiImageEditSession[]>(`/api/image-editor/sessions?projectId=${encodeURIComponent(projectId)}`);},
  getImageEditDraft(sessionId:string){return request<ApiImageEditSession>(`/api/image-editor/sessions/${encodeURIComponent(sessionId)}`);},
  upsertImageEditOperation(sessionId:string, operation:Record<string,unknown>, summary?:string, expectedRevision?:number){return request<ApiImageEditSession>(`/api/image-editor/sessions/${encodeURIComponent(sessionId)}/operations`,{method:"POST",headers:{"content-type":"application/json","idempotency-key":createIdempotencyKey()},body:JSON.stringify({operation,summary,...(expectedRevision===undefined?{}:{expectedRevision})})});},
  removeImageEditOperation(sessionId:string, operationId:string, expectedRevision?:number){const query=expectedRevision===undefined?"":`?expectedRevision=${encodeURIComponent(String(expectedRevision))}`;return request<ApiImageEditSession>(`/api/image-editor/sessions/${encodeURIComponent(sessionId)}/operations/${encodeURIComponent(operationId)}${query}`,{method:"DELETE"});},
  submitImageEdit(sessionId:string,body:{promptSnapshot?:Record<string,unknown>;configSnapshot?:Record<string,unknown>;sourceCardId?:string;sourceVersionId?:string;parentVersionId?:string;summary?:string;generationParams?:Record<string,unknown>}){return request<ApiImageEditTask>(`/api/image-editor/sessions/${encodeURIComponent(sessionId)}/submit`,{method:"POST",headers:{"content-type":"application/json","idempotency-key":createIdempotencyKey()},body:JSON.stringify(body)});},
  getImageEditTask(taskId:string){return request<ApiImageEditTask>(`/api/image-editor/tasks/${encodeURIComponent(taskId)}`);},
  retryImageEdit(attemptId:string){return request<Record<string,unknown>>(`/api/image-editor/attempts/${encodeURIComponent(attemptId)}/retry`,{method:"POST",headers:{"content-type":"application/json","idempotency-key":createIdempotencyKey()},body:JSON.stringify({})});},
  regenerateImageEditTask(taskId:string,summary?:string){return request<Record<string,unknown>>(`/api/image-editor/tasks/${encodeURIComponent(taskId)}/regenerate`,{method:"POST",headers:{"content-type":"application/json","idempotency-key":createIdempotencyKey()},body:JSON.stringify(summary===undefined?{}:{summary})});},
  recognizeImageEditText(sessionId:string,sourceVersionId:string){return request<{sourceVersionId:string;status:"succeeded"|"failed";blocks:Array<{id:string;text:string;confidence:number;bounds:{x:number;y:number;width:number;height:number};rotation:number}>;error?:string}>(`/api/image-editor/sessions/${encodeURIComponent(sessionId)}/ocr`,{method:"POST",headers:{"content-type":"application/json","idempotency-key":createIdempotencyKey()},body:JSON.stringify({sourceVersionId})});},
  selectImageEditVersion(taskId:string,versionId:string,selection:"current"|"final"){return request<Record<string,unknown>>(`/api/image-editor/tasks/${encodeURIComponent(taskId)}/versions/${encodeURIComponent(versionId)}/select`,{method:"POST",headers:{"content-type":"application/json","idempotency-key":createIdempotencyKey()},body:JSON.stringify({selection})});},
  getLayout(suiteId:string){return request<ApiCanvasLayout|null>(`/api/suites/${encodeURIComponent(suiteId)}/workbench/layout`);},
  saveLayout(suiteId:string,layout:Pick<ApiCanvasLayout,"layoutVersion"|"viewport"|"nodes"|"groups">){return request<ApiCanvasLayout>(`/api/suites/${encodeURIComponent(suiteId)}/workbench/layout`,{method:"PATCH",headers:{"content-type":"application/json","idempotency-key":createIdempotencyKey()},body:JSON.stringify(layout)});},
  listLibraryReferences(suiteId:string,targetType?:"plan"|"task",targetId?:string){const search=new URLSearchParams();if(targetType)search.set("targetType",targetType);if(targetId)search.set("targetId",targetId);return request<ApiLibraryReference[]>(`/api/suites/${encodeURIComponent(suiteId)}/library/references?${search.toString()}`);},
  createLibraryReference(suiteId:string,body:{resourceId:string;targetType:"plan"|"task";targetId:string}){return request<ApiLibraryReference>(`/api/suites/${encodeURIComponent(suiteId)}/library/references`,{method:"POST",headers:{"content-type":"application/json","idempotency-key":createIdempotencyKey()},body:JSON.stringify(body)});},
  archiveLibraryReference(suiteId:string,referenceId:string){return request<ApiLibraryReference>(`/api/suites/${encodeURIComponent(suiteId)}/library/references/${encodeURIComponent(referenceId)}`,{method:"DELETE"});},
  listProductLibraries(){return request<ApiTestProductLibrary[]>("/api/test-product-libraries");},
  listProductionLibraries(includeArchived = false){return request<ApiProductionLibrary[]>(`/api/product-libraries?includeArchived=${includeArchived ? "true" : "false"}`);},
  createProductionLibrary(body:{name:string;description?:string}){return request<ApiProductionLibrary>("/api/product-libraries",{method:"POST",headers:{"content-type":"application/json","idempotency-key":createIdempotencyKey()},body:JSON.stringify(body)});},
  getProductionLibrary(libraryId:string){return request<ApiProductionLibrary>(`/api/product-libraries/${encodeURIComponent(libraryId)}`);},
  archiveProductionLibrary(libraryId:string){return request<ApiProductionLibrary>(`/api/product-libraries/${encodeURIComponent(libraryId)}/archive`,{method:"POST",headers:{"content-type":"application/json"}});},
  listProductionProducts(libraryId:string, includeArchived = false){return request<ApiProductionProduct[]>(`/api/product-libraries/${encodeURIComponent(libraryId)}/products?includeArchived=${includeArchived ? "true" : "false"}`);},
  countProductionProducts(libraryId:string, includeArchived = false){return request<{count:number}>(`/api/product-libraries/${encodeURIComponent(libraryId)}/products/count?includeArchived=${includeArchived ? "true" : "false"}`);},
  createProductionProduct(libraryId:string,body:{name:string;projectId?:string|null}){return request<ApiProductionProduct>(`/api/product-libraries/${encodeURIComponent(libraryId)}/products`,{method:"POST",headers:{"content-type":"application/json","idempotency-key":createIdempotencyKey()},body:JSON.stringify(body)});},
  getProductionProduct(productId:string){return request<ApiProductionProduct>(`/api/products/${encodeURIComponent(productId)}`);},
  listProductionVersions(productId:string,params:{productType?:ApiProductionProductType;status?:string}={}){const search=new URLSearchParams();Object.entries(params).forEach(([key,value])=>{if(value)search.set(key,value);});return request<ApiProductionVersion[]>(`/api/products/${encodeURIComponent(productId)}/versions?${search.toString()}`);},
  publishProductionVersion(libraryId:string,productId:string,body:{productType:ApiProductionProductType;sourceVersion:Record<string,unknown>}){return request<ApiProductionVersion & {productId:string}>(`/api/product-libraries/${encodeURIComponent(libraryId)}/products/${encodeURIComponent(productId)}/versions/publish`,{method:"POST",headers:{"content-type":"application/json","idempotency-key":createIdempotencyKey()},body:JSON.stringify(body)});},
  archiveProductionProduct(productId:string){return request<ApiProductionProduct>(`/api/products/${encodeURIComponent(productId)}/archive`,{method:"POST",headers:{"content-type":"application/json"}});},
  archiveProductionVersion(productId:string,versionId:string){return request<{id:string;status:string}>(`/api/products/${encodeURIComponent(productId)}/versions/${encodeURIComponent(versionId)}/archive`,{method:"POST",headers:{"content-type":"application/json"}});},
  createProductLibrary(body:{name:string;description?:string;libraryType:"test_result"|"manual"}){return request<ApiTestProductLibrary>("/api/test-product-libraries",{method:"POST",headers:{"content-type":"application/json","idempotency-key":createIdempotencyKey()},body:JSON.stringify(body)});},
  getProductLibrary(libraryId:string){return request<ApiTestProductLibrary>(`/api/test-product-libraries/${encodeURIComponent(libraryId)}`);},
  listProducts(libraryId:string){return request<ApiTestProduct[]>(`/api/test-product-libraries/${encodeURIComponent(libraryId)}/products`);},
  async saveTestResultToProductLibrary(testRunId:string,libraryId:string,name:string,file:Blob,filename:string){const formData=new FormData();formData.append("name",name);formData.append("productType","image");formData.append("testRunId",testRunId);formData.append("file",file,filename);return request<ApiTestProduct>(`/api/test-product-libraries/${encodeURIComponent(libraryId)}/products`,{method:"POST",body:formData});},
};
import type { Asset, Project, SuiteConfigDraft } from "./contracts";
import type { GenerationConfig } from "../lib/generation-config";
