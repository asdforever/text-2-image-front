import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { mockProjects } from "../api/fixtures";
import type { Asset, AssetVersion, LibraryProjectAssetInput, OutputTarget, Project, SuiteConfigDraft, SuiteTask } from "../api/contracts";
import { mockSuiteTasks } from "../api/fixtures";
import { toProjectAssetInput, validateProjectAssetBatch, validateProjectAssetInput, type ProjectAssetInput } from "../lib/project-assets";
import type { GenerationSnapshot } from "../lib/generation-config";
import {
  createGenerationRun,
  normalizeHeroConfig,
  normalizeSuiteConfig,
  updateGenerationModuleRun,
  type GenerationMode,
  type GenerationModuleParameter,
  type GenerationModuleRun,
  type GenerationRun,
  type GenerationStatus,
  type HeroGenerationConfig,
  type SuiteGenerationConfig,
} from "../lib/generation-workspace";

interface CreateProjectInput {
  name: string;
  productName: string;
  outputTargets: OutputTarget[];
  sourceCount: number;
  sourceFiles?: ProjectAssetInput[];
}

interface GeneratedAssetInput {
  type: "hero" | "suite";
  name: string;
  url: string;
  template: string;
  category: string;
  dimensions?: string;
  sequence?: number;
  generationSnapshot?: GenerationSnapshot;
}

export interface GenerationDraftRecord {
  config: HeroGenerationConfig | SuiteGenerationConfig;
  updatedAt: string;
}

export interface GenerationPlanItem {
  moduleId: string;
  title: string;
  count: number;
  copy: string;
  visual: string;
  moduleParameters: GenerationModuleParameter[];
  compositionBrief?: string;
  reason?: string;
}

export interface HeroGenerationSession {
  planningAppliedVersionId?: string;
  inputFingerprint: string;
  compileIdempotencyKey: string;
  confirmIdempotencyKey: string;
  batchId?: string;
  taskId?: string;
  taskPrompt?: string;
  moduleTaskPrompts?: Record<string, string>;
  promptBatchId?: string;
}

export interface SuiteGenerationSession {
  inputFingerprint?: string;
  planningAppliedVersionId?: string;
  compileIdempotencyKey: string;
  planId?: string;
}

interface ProjectStore {
  projects: Project[];
  currentProjectId: string | null;
  selectedAssetId: string | null;
  selectedTaskId: string | null;
  suiteTasks: SuiteTask[];
  suiteConfigDraft: SuiteConfigDraft;
  generationDrafts: Record<string, GenerationDraftRecord>;
  generationRuns: Record<string, GenerationRun>;
  generationPlans: Record<string, GenerationPlanItem[]>;
  generationSnapshots: Record<string, GenerationSnapshot[]>;
  heroGenerationSessions: Record<string, HeroGenerationSession>;
  suiteGenerationSessions: Record<string, SuiteGenerationSession>;
  saveSuiteGenerationSession: (projectId: string, session: SuiteGenerationSession) => void;
  createProject: (input: CreateProjectInput) => Project;
  addProjectAssets: (projectId: string, files: ProjectAssetInput[]) => { added: Asset[]; rejected: { file: ProjectAssetInput; reason: string }[] };
  addLibraryAssets: (projectId: string, assets: LibraryProjectAssetInput[]) => { added: Asset[]; skipped: LibraryProjectAssetInput[] };
  addGeneratedAsset: (projectId: string, input: GeneratedAssetInput) => Asset;
  removeAsset: (projectId: string, assetId: string) => void;
  removeProject: (projectId: string) => void;
  setCurrentProject: (id: string | null) => void;
  setSelectedAsset: (id: string | null) => void;
  setSelectedTask: (id: string | null) => void;
  updateSuiteConfig: (patch: Partial<SuiteConfigDraft>) => void;
  replaceSuiteTasks: (tasks: SuiteTask[]) => void;
  updateTask: (taskId: string, patch: Partial<SuiteTask>) => void;
  addAssetVersion: (assetId: string, version: AssetVersion) => void;
  updateGenerationDraft: (projectId: string, mode: GenerationMode, patch: Partial<HeroGenerationConfig | SuiteGenerationConfig>) => void;
  clearGenerationDraft: (projectId: string, mode: GenerationMode) => void;
  updateGenerationPlans: (projectId: string, mode: GenerationMode, plans: GenerationPlanItem[]) => void;
  clearGenerationPlans: (projectId: string, mode: GenerationMode) => void;
  saveGenerationSnapshot: (projectId: string, mode: GenerationMode, snapshot: GenerationSnapshot) => void;
  saveHeroGenerationSession: (projectId: string, session: HeroGenerationSession) => void;
  clearHeroGenerationSession: (projectId: string) => void;
  startGenerationRun: (projectId: string, mode: GenerationMode, moduleIds: string[], status?: GenerationStatus) => void;
  setGenerationRunStatus: (projectId: string, mode: GenerationMode, status: GenerationStatus) => void;
  updateGenerationRunModule: (projectId: string, mode: GenerationMode, moduleId: string, patch: Partial<Omit<GenerationModuleRun, "id">>) => void;
  resetDemoData: () => void;
  clearAllData: () => void;
}

const initialProject = mockProjects[0];
const storage = createJSONStorage(() => {
  if (typeof window !== "undefined" && window.localStorage) return window.localStorage;
  return {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
  };
});

export const useProjectStore = create<ProjectStore>()(
  persist(
    (set, get) => ({
      projects: mockProjects,
      currentProjectId: initialProject?.id ?? null,
      selectedAssetId: null,
      selectedTaskId: null,
      suiteTasks: mockSuiteTasks,
      generationDrafts: {},
      generationRuns: {},
      generationPlans: {},
      generationSnapshots: {},
      heroGenerationSessions: {},
      suiteGenerationSessions: {},
      saveSuiteGenerationSession: (projectId, session) => set((state) => ({
        suiteGenerationSessions: { ...state.suiteGenerationSessions, [projectId]: session },
      })),
      suiteConfigDraft: initialProject?.suiteConfigDraft ?? {
        platform: "Amazon 日本站",
        language: "中文",
        mainImageCount: 4,
        detailImageCount: 6,
        category: "3C 数码配件",
        facts: "",
        selectedChunkIds: [],
      },
      createProject: (input) => {
        const id = `proj-${Date.now()}`;
        const sourceInputs = input.sourceFiles
          ? input.sourceFiles.filter((source) => validateProjectAssetInput(source).ok).map(toProjectAssetInput)
          : Array.from({ length: input.sourceCount }, (_, index) => ({ name: `${input.productName || "商品"}-${index + 1}.jpg`, type: "image/jpeg", size: 1, url: index % 2 === 0 ? "/assets/gan65-product.jpg" : "/assets/gan65-product-tight.jpg" }));
        const sourceAssets = sourceInputs.map((source, index) => ({
          id: `${id}-source-${index + 1}`,
          projectId: id,
          type: "source" as const,
          name: source.name,
          dimensions: "3024x4032",
          url: source.url ?? (index % 2 === 0 ? "/assets/gan65-product.jpg" : "/assets/gan65-product-tight.jpg"),
          status: "ready" as const,
          version: 1,
          source: { kind: "upload" as const },
          versions: [{ id: `${id}-source-${index + 1}-v1`, version: 1, url: source.url ?? (index % 2 === 0 ? "/assets/gan65-product.jpg" : "/assets/gan65-product-tight.jpg"), createdAt: new Date().toISOString(), template: "原始上传", status: "ready" as const }],
        }));
        const project: Project = {
          id,
          name: input.name,
          productName: input.productName,
          outputTargets: input.outputTargets,
          sourceCount: sourceInputs.length,
          updatedAt: new Date().toISOString(),
          assets: sourceAssets,
          suiteConfigDraft: get().suiteConfigDraft,
        };
        set((state) => ({ projects: [project, ...state.projects], currentProjectId: id }));
        return project;
      },
      addProjectAssets: (projectId, files) => {
        const added: Asset[] = [];
        const rejected: { file: ProjectAssetInput; reason: string }[] = [];
        const validationResults = validateProjectAssetBatch(files);
        const validFiles = files.filter((file, index) => {
          const result = validationResults[index];
          if (!result.ok) rejected.push({ file, reason: result.reason ?? "文件无效" });
          return result.ok;
        });
        const now = new Date().toISOString();
        set((state) => {
          const projects = state.projects.map((project) => {
            if (project.id !== projectId) return project;
            const nextAssets = validFiles.flatMap((file, index) => {
              const id = `${projectId}-source-${Date.now()}-${index}`;
              const url = file.url ?? "/assets/gan65-product.jpg";
              const candidate: Asset = { id, projectId, type: "source", name: file.name, dimensions: "原始尺寸", url, status: "ready", version: 1, source: { kind: "upload" }, versions: [{ id: `${id}-v1`, version: 1, url, createdAt: now, template: "原始上传", status: "ready" }] };
              added.push(candidate);
              return [candidate];
            });
            return { ...project, sourceCount: project.sourceCount + nextAssets.length, updatedAt: now, assets: [...project.assets, ...nextAssets] };
          });
          return { projects };
        });
        return { added, rejected };
      },
      addLibraryAssets: (projectId, inputs) => {
        const added: Asset[] = [];
        const skipped: LibraryProjectAssetInput[] = [];
        const now = new Date().toISOString();
        set((state) => ({
          projects: state.projects.map((project) => {
            if (project.id !== projectId) return project;
            const existingKeys = new Set(project.assets.flatMap((asset) => asset.source?.kind === "asset-library" ? [`${asset.source.libraryId}:${asset.source.assetId}`] : []));
            const nextAssets = inputs.flatMap((input) => {
              const sourceKey = `${input.libraryId}:${input.assetId}`;
              if (existingKeys.has(sourceKey)) {
                skipped.push(input);
                return [];
              }
              existingKeys.add(sourceKey);
              const id = `${projectId}-library:${encodeURIComponent(input.libraryId)}:asset:${encodeURIComponent(input.assetId)}`;
              const dimensions = input.width && input.height ? `${input.width}x${input.height}` : "原始尺寸";
              const candidate: Asset = {
                id,
                projectId,
                type: "source",
                name: input.name,
                dimensions,
                url: input.url,
                status: "ready",
                version: 1,
                source: { kind: "asset-library", libraryId: input.libraryId, assetId: input.assetId },
                versions: [{ id: `${id}-v1`, version: 1, url: input.url, createdAt: now, template: "素材库导入", status: "ready" }],
              };
              added.push(candidate);
              return [candidate];
            });
            return nextAssets.length === 0 ? project : { ...project, sourceCount: project.sourceCount + nextAssets.length, updatedAt: now, assets: [...project.assets, ...nextAssets] };
          }),
        }));
        return { added, skipped };
      },
      addGeneratedAsset: (projectId, input) => {
        const stamp = Date.now();
        const id = `${projectId}-${input.type}-${stamp}-${Math.random().toString(36).slice(2, 8)}`;
        const createdAt = new Date().toISOString();
        const created: Asset = {
          id,
          projectId,
          type: input.type,
          name: input.name,
          dimensions: input.dimensions ?? "1024x1024",
          url: input.url,
          status: "ready",
          version: 1,
          category: input.category,
          ...(input.sequence ? { sequence: input.sequence } : {}),
          generationSnapshot: input.generationSnapshot ? JSON.parse(JSON.stringify(input.generationSnapshot)) as GenerationSnapshot : undefined,
          versions: [{ id: `${id}-v1`, version: 1, url: input.url, createdAt, template: input.template, status: "ready" }],
        };
        set((state) => ({
          projects: state.projects.map((project) => project.id === projectId
            ? { ...project, assets: [...project.assets, created], updatedAt: createdAt }
            : project),
        }));
        return created;
      },
      removeAsset: (projectId, assetId) => set((state) => ({
        projects: state.projects.map((project) => project.id === projectId
          ? { ...project, assets: project.assets.filter((asset) => asset.id !== assetId), updatedAt: new Date().toISOString() }
          : project),
        selectedAssetId: state.selectedAssetId === assetId ? null : state.selectedAssetId,
      })),
      removeProject: (projectId) => set((state) => ({ projects: state.projects.filter((project) => project.id !== projectId), currentProjectId: state.currentProjectId === projectId ? null : state.currentProjectId })),
      setCurrentProject: (id) => set({ currentProjectId: id }),
      setSelectedAsset: (id) => set({ selectedAssetId: id }),
      setSelectedTask: (id) => set({ selectedTaskId: id, selectedAssetId: id }),
      updateSuiteConfig: (patch) => set((state) => ({ suiteConfigDraft: { ...state.suiteConfigDraft, ...patch } })),
      replaceSuiteTasks: (tasks) => set({ suiteTasks: tasks }),
      updateTask: (taskId, patch) => set((state) => ({ suiteTasks: state.suiteTasks.map((task) => task.id === taskId ? { ...task, ...patch } : task) })),
      addAssetVersion: (assetId, nextVersion) => set((state) => ({ projects: state.projects.map((project) => ({ ...project, assets: project.assets.map((asset) => asset.id === assetId ? { ...asset, url: nextVersion.url, version: nextVersion.version, status: "ready", versions: [...asset.versions, nextVersion] } : asset) })) })),
      updateGenerationDraft: (projectId, mode, patch) => set((state) => {
        const key = `${projectId}:${mode}`;
        const currentRecord = state.generationDrafts[key];
        const current = currentRecord?.config;
        const normalized = mode === "hero" ? normalizeHeroConfig(current) : normalizeSuiteConfig(current);
        const previousCreation = normalized.creationMode ?? "regular";
        const creation = patch.creationMode ?? previousCreation;
        const drafts = { ...state.generationDrafts };
        if (currentRecord) drafts[`${key}:${previousCreation}`] = currentRecord;
        const saved = drafts[`${key}:${creation}`]?.config;
        const source = creation === previousCreation ? normalized : saved ?? {
          ...normalized, creationMode: creation, modulePlanId: undefined, modulePlanFingerprint: undefined,
          modulePlanBaseline: undefined, modulePlanningRequest: undefined, planningConversationId: undefined,
          planningAppliedVersionId: undefined, moduleTaskDetails: {}, moduleTaskOverrides: {},
          regularTasks: {}, regularTaskOverrides: {}, regularTaskOptions: {}, modulePlanReferences: {},
        };
        const config = mode === "hero"
          ? normalizeHeroConfig({ ...source, ...(patch as Partial<HeroGenerationConfig>) })
          : normalizeSuiteConfig({ ...source, ...(patch as Partial<SuiteGenerationConfig>) });
        const record = { config, updatedAt: new Date().toISOString() };
        drafts[key] = record;
        drafts[`${key}:${creation}`] = record;
        return { generationDrafts: drafts };
      }),
      clearGenerationDraft: (projectId, mode) => set((state) => {
        const next = { ...state.generationDrafts };
        delete next[`${projectId}:${mode}`];
        delete next[`${projectId}:${mode}:regular`];
        delete next[`${projectId}:${mode}:professional`];
        return { generationDrafts: next };
      }),
      updateGenerationPlans: (projectId, mode, plans) => set((state) => ({
        generationPlans: { ...state.generationPlans, [`${projectId}:${mode}`]: plans },
      })),
      clearGenerationPlans: (projectId, mode) => set((state) => {
        const next = { ...state.generationPlans };
        delete next[`${projectId}:${mode}`];
        return { generationPlans: next };
      }),
      saveGenerationSnapshot: (projectId, mode, snapshot) => set((state) => {
        const key = `${projectId}:${mode}`;
        const current = state.generationSnapshots[key] ?? [];
        return { generationSnapshots: { ...state.generationSnapshots, [key]: [...current, JSON.parse(JSON.stringify(snapshot)) as GenerationSnapshot] } };
      }),
      saveHeroGenerationSession: (projectId, session) => set((state) => ({
        heroGenerationSessions: {
          ...state.heroGenerationSessions,
          [projectId]: { ...session },
        },
      })),
      clearHeroGenerationSession: (projectId) => set((state) => {
        const heroGenerationSessions = { ...state.heroGenerationSessions };
        delete heroGenerationSessions[projectId];
        return { heroGenerationSessions };
      }),
      startGenerationRun: (projectId, mode, moduleIds, status = "generating") => set((state) => ({
        generationRuns: { ...state.generationRuns, [`${projectId}:${mode}`]: { ...createGenerationRun(mode, moduleIds), status } },
      })),
      setGenerationRunStatus: (projectId, mode, status) => set((state) => {
        const key = `${projectId}:${mode}`;
        const current = state.generationRuns[key];
        return current ? { generationRuns: { ...state.generationRuns, [key]: { ...current, status } } } : state;
      }),
      updateGenerationRunModule: (projectId, mode, moduleId, patch) => set((state) => {
        const key = `${projectId}:${mode}`;
        const current = state.generationRuns[key];
        if (!current) return state;
        return { generationRuns: { ...state.generationRuns, [key]: updateGenerationModuleRun(current, moduleId, patch) } };
      }),
      resetDemoData: () => set({ projects: mockProjects, currentProjectId: initialProject?.id ?? null, selectedAssetId: null, selectedTaskId: null, suiteTasks: mockSuiteTasks, generationDrafts: {}, generationRuns: {}, generationPlans: {}, generationSnapshots: {}, heroGenerationSessions: {}, suiteGenerationSessions: {} }),
      clearAllData: () => { void useProjectStore.persist.clearStorage(); set({ projects: [], currentProjectId: null, selectedAssetId: null, selectedTaskId: null, suiteTasks: [], generationDrafts: {}, generationRuns: {}, generationPlans: {}, generationSnapshots: {}, heroGenerationSessions: {}, suiteGenerationSessions: {} }); },
    }),
    { name: "picagent-project-store", storage },
  ),
);
