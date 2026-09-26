import { create } from "zustand";
import {
  cloneGenerationConfig,
  createDefaultGenerationConfig,
  DEFAULT_GENERATION_MARKETS,
  DEFAULT_PROMPT_VERSION_REFERENCES,
  LEGACY_GENERATION_MARKET_ID_MAP,
  validateGenerationConfig,
  type GenerationConfig,
  type GenerationMarketDefinition,
  type GenerationMarketScope,
  type GenerationModelDefinition,
  type PromptBinding,
  type PromptVersionReference,
} from "../lib/generation-config";
import { HERO_MODULES, SUITE_MODULES, type GenerationModuleDefinition, type StyleDefinition } from "../lib/generation-workspace";

interface GenerationConfigStore {
  published: GenerationConfig;
  draft: GenerationConfig;
  isDirty: boolean;
  lastSaveError: string[];
  promptVersions: PromptVersionReference[];
  draftBaseVersion: number;
  updateDraft: (updater: (value: GenerationConfig) => GenerationConfig) => void;
  saveDraft: () => string[];
  discardDraft: () => void;
  resetConfig: () => void;
  hydrateRemote: (published: GenerationConfig, draft: GenerationConfig, baseVersion: number) => void;
  acceptSavedDraft: (draft: GenerationConfig, baseVersion: number) => void;
  acceptPublished: (published: GenerationConfig) => void;
  replacePublished: (published: GenerationConfig) => void;
  setSaveErrors: (errors: string[]) => void;
  setPromptVersions: (versions: PromptVersionReference[]) => void;
  addMarket: (value: GenerationMarketDefinition) => boolean;
  updateMarket: (id: string, patch: Partial<GenerationMarketDefinition>) => boolean;
  removeMarket: (id: string) => boolean;
  addModel: (value: GenerationModelDefinition) => boolean;
  updateModel: (id: string, patch: Partial<GenerationModelDefinition>) => boolean;
  removeModel: (id: string) => boolean;
  setPromptModel: (value: GenerationConfig["promptModel"]) => void;
  addStyleCategory: (value: { id: string; label: string }) => boolean;
  updateStyleCategory: (id: string, patch: { id?: string; label?: string }) => boolean;
  removeStyleCategory: (id: string) => boolean;
  addStyle: (categoryId: string, value: StyleDefinition) => boolean;
  updateStyle: (categoryId: string, id: string, patch: Partial<StyleDefinition>) => boolean;
  removeStyle: (categoryId: string, id: string) => boolean;
  addModule: (mode: "hero" | "suite", value: GenerationModuleDefinition) => boolean;
  updateModule: (mode: "hero" | "suite", id: string, patch: Partial<GenerationModuleDefinition>) => boolean;
  removeModule: (mode: "hero" | "suite", id: string) => boolean;
  setBinding: (kind: "market" | "model" | "hero" | "suite", id: string, binding: PromptBinding | null) => boolean;
}

function createInitialState() {
  const initial = createDefaultGenerationConfig();
  return { published: initial, draft: cloneGenerationConfig(initial), draftBaseVersion: initial.version, isDirty: false, lastSaveError: [], promptVersions: DEFAULT_PROMPT_VERSION_REFERENCES.map((version) => ({ ...version })) };
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isMarketScope(value: unknown): value is GenerationMarketScope {
  return value === "domestic" || value === "overseas";
}

function normalizeMarketItem(item: Record<string, any>, fallback?: GenerationMarketDefinition): GenerationMarketDefinition {
  const id = String(item.id ?? fallback?.id ?? "");
  const mappedId = LEGACY_GENERATION_MARKET_ID_MAP[id] ?? id;
  const mappedFallback = fallback ?? DEFAULT_GENERATION_MARKETS.find((market) => market.id === mappedId);
  const marketScope = isMarketScope(item.marketScope)
    ? item.marketScope
    : mappedFallback?.marketScope ?? (id === "international" ? "overseas" : "domestic");
  return {
    id: mappedId,
    label: String(item.label ?? mappedFallback?.label ?? ""),
    marketScope,
    platforms: String(item.platforms ?? mappedFallback?.platforms ?? ""),
    guidance: String(item.guidance ?? mappedFallback?.guidance ?? ""),
    defaultLanguage: String(item.defaultLanguage ?? mappedFallback?.defaultLanguage ?? (marketScope === "overseas" ? "英文" : "中文")),
  };
}

function migrateMarkets(value: unknown, fallback: GenerationConfig["markets"]): { markets: GenerationMarketDefinition[]; legacyIds: Set<string> } {
  const rawMarkets = Array.isArray(value) ? value.filter(isRecord) : [];
  const legacyIds = new Set(rawMarkets.map((item) => String(item.id ?? "")).filter((id) => Object.prototype.hasOwnProperty.call(LEGACY_GENERATION_MARKET_ID_MAP, id)));
  const hasLegacy = legacyIds.size > 0;
  if (!hasLegacy) {
    return {
      markets: Array.isArray(value)
        ? rawMarkets.map((item) => normalizeMarketItem(item))
        : fallback.map((market) => ({ ...market })),
      legacyIds,
    };
  }

  // Legacy configs represented a whole scope as one market. Replace each
  // scope with the seeded concrete platforms and carry any custom legacy
  // guidance onto the canonical platform for that scope.
  const seeded = fallback.length > 0 ? fallback : DEFAULT_GENERATION_MARKETS;
  const migrated = seeded.map((market) => ({ ...market }));
  for (const item of rawMarkets) {
    const oldId = String(item.id ?? "");
    const targetId = LEGACY_GENERATION_MARKET_ID_MAP[oldId];
    if (targetId) {
      const index = migrated.findIndex((market) => market.id === targetId);
      if (index >= 0) {
        const target = migrated[index];
        migrated[index] = normalizeMarketItem({ ...item, id: target.id, marketScope: target.marketScope, label: target.label, platforms: target.platforms }, target);
      }
      continue;
    }
    const normalized = normalizeMarketItem(item);
    if (normalized.id && !migrated.some((market) => market.id === normalized.id)) migrated.push(normalized);
  }
  return { markets: migrated, legacyIds };
}

function migrateMarketBindings(source: unknown, markets: GenerationMarketDefinition[], fallback: Record<string, any>): Record<string, any> {
  const input = isRecord(source) ? source : {};
  const hasOwn = (id: string) => Object.prototype.hasOwnProperty.call(input, id);
  const bindings: Record<string, any> = Object.fromEntries(markets.map((market) => [market.id, hasOwn(market.id) ? input[market.id] : fallback[market.id] ?? null]));
  for (const [legacyId, targetId] of Object.entries(LEGACY_GENERATION_MARKET_ID_MAP)) {
    const legacyBinding = Object.prototype.hasOwnProperty.call(input, legacyId) ? input[legacyId] : fallback[legacyId];
    if (legacyBinding === undefined) continue;
    const legacyMarket = markets.find((market) => market.id === targetId);
    if (!legacyMarket) continue;
    for (const market of markets) {
      if (market.marketScope === legacyMarket.marketScope && input[market.id] === undefined) bindings[market.id] = legacyBinding;
    }
  }
  return bindings;
}

function normalizeConfigShape(value: unknown, fallback: GenerationConfig): GenerationConfig {
  const candidate = isRecord(value) ? value : {};
  const { markets } = migrateMarkets(candidate.markets, fallback.markets);
  const models = Array.isArray(candidate.models)
    ? candidate.models.filter(isRecord).map((item) => ({ id: String(item.id ?? ""), label: String(item.label ?? ""), provider: String(item.provider ?? ""), constraints: String(item.constraints ?? ""), resolutions: Array.isArray(item.resolutions) ? item.resolutions.map(String).filter(Boolean) : [], ...(typeof item.connectionId === "string" ? { connectionId: item.connectionId } : {}), ...(Array.isArray(item.aspectRatios) ? { aspectRatios: item.aspectRatios.map(String).filter(Boolean) } : {}) }))
    : fallback.models;
  const styleCategories = Array.isArray(candidate.styleCategories)
    ? candidate.styleCategories.filter(isRecord).map((item) => ({ id: String(item.id ?? ""), label: String(item.label ?? ""), styles: Array.isArray(item.styles) ? item.styles.filter(isRecord).map((style) => ({ id: String(style.id ?? ""), label: String(style.label ?? ""), description: String(style.description ?? "") })) : [] }))
    : fallback.styleCategories;
  const normalizeModules = (value: unknown, fallbackModules: GenerationModuleDefinition[], mode: "hero" | "suite") => Array.isArray(value)
    ? value.filter(isRecord).map((item) => ({ id: String(item.id ?? ""), label: String(item.label ?? ""), description: String(item.description ?? ""), mode }))
    : fallbackModules.map((item) => ({ ...item }));
  const heroModules = normalizeModules(candidate.heroModules, fallback.heroModules, "hero");
  const suiteModules = normalizeModules(candidate.suiteModules, fallback.suiteModules, "suite");
  const pickBindings = (source: unknown, allowed: string[], defaults: Record<string, any>) => {
    const input = isRecord(source) ? source : {};
    return Object.fromEntries(allowed.map((id) => [id, input[id] ?? defaults[id] ?? null]));
  };
  const marketIds = markets.map((item) => item.id);
  const modelIds = models.map((item) => item.id);
  const normalized = cloneGenerationConfig({
    ...fallback,
    ...candidate,
    markets,
    models,
    promptModel: isRecord(candidate.promptModel) && typeof candidate.promptModel.connectionId === "string"
      ? { connectionId: candidate.promptModel.connectionId } : null,
    styleCategories,
    heroModules,
    suiteModules,
    marketBindings: migrateMarketBindings(candidate.marketBindings, markets, fallback.marketBindings),
    modelBindings: pickBindings(candidate.modelBindings, modelIds, fallback.modelBindings),
    heroBindings: pickBindings(candidate.heroBindings, heroModules.map((item) => item.id), fallback.heroBindings),
    suiteBindings: pickBindings(candidate.suiteBindings, suiteModules.map((item) => item.id), fallback.suiteBindings),
  } as GenerationConfig);
  return normalized;
}

export function normalizePersistedGenerationConfigState(value: unknown) {
  const initial = createInitialState();
  const raw = isRecord(value) ? value : {};
  const published = normalizeConfigShape(raw.published, initial.published);
  const draft = normalizeConfigShape(raw.draft ?? published, published);
  return {
    published,
    draft,
    isDirty: Boolean(raw.isDirty) && JSON.stringify(published) !== JSON.stringify(draft),
    lastSaveError: Array.isArray(raw.lastSaveError) ? raw.lastSaveError.filter((item): item is string => typeof item === "string") : [],
    promptVersions: Array.isArray(raw.promptVersions) && raw.promptVersions.length > 0 ? raw.promptVersions.filter(isRecord).map((item) => ({ id: String(item.id ?? ""), templateId: String(item.templateId ?? ""), versionNo: Number(item.versionNo ?? 0), body: typeof item.body === "string" ? item.body : undefined, contentSha256: typeof item.contentSha256 === "string" ? item.contentSha256 : undefined, status: item.status === "draft" || item.status === "published" || item.status === "retired" || item.status === "archived" ? item.status : undefined })) : DEFAULT_PROMPT_VERSION_REFERENCES.map((version) => ({ ...version })),
  };
}

function hasLabel(items: Array<{ label: string }>, label: string, ignoreId?: string) {
  const normalized = label.trim().toLocaleLowerCase();
  return Boolean(normalized) && items.some((item: any) => item.id !== ignoreId && item.label.trim().toLocaleLowerCase() === normalized);
}

export const useGenerationConfigStore = create<GenerationConfigStore>()(
    (set, get) => ({
      ...createInitialState(),
      updateDraft: (updater) => set((state) => {
        const draft = cloneGenerationConfig(updater(cloneGenerationConfig(state.draft)));
        return { draft, isDirty: true, lastSaveError: [] };
      }),
      saveDraft: () => {
        const state = get();
        if (!state.isDirty) return [];
        const draft = cloneGenerationConfig(state.draft);
        const errors = validateGenerationConfig(draft, state.promptVersions);
        if (errors.length > 0) {
          set({ lastSaveError: errors });
          return errors;
        }
        set({ draft, isDirty: false, lastSaveError: [] });
        return [];
      },
      discardDraft: () => set((state) => ({ draft: cloneGenerationConfig(state.published), isDirty: false, lastSaveError: [] })),
      resetConfig: () => set(createInitialState()),
      hydrateRemote: (published, draft, baseVersion) => set({
        published: cloneGenerationConfig(published),
        draft: cloneGenerationConfig(draft),
        draftBaseVersion: baseVersion,
        isDirty: false,
        lastSaveError: [],
      }),
      acceptSavedDraft: (draft, baseVersion) => set({
        draft: cloneGenerationConfig(draft),
        draftBaseVersion: baseVersion,
        isDirty: false,
        lastSaveError: [],
      }),
      acceptPublished: (published) => set({
        published: cloneGenerationConfig(published),
        draft: cloneGenerationConfig(published),
        draftBaseVersion: published.version,
        isDirty: false,
        lastSaveError: [],
      }),
      replacePublished: (published) => set({
        published: cloneGenerationConfig(published),
      }),
      setSaveErrors: (lastSaveError) => set({ lastSaveError: [...lastSaveError] }),
      setPromptVersions: (versions) => set({ promptVersions: versions.map((version) => ({ ...version })) }),
      setPromptModel: (value) => get().updateDraft((draft) => ({
        ...draft, promptModel: value ? { connectionId: value.connectionId } : null,
      })),
      addMarket: (value) => {
        const state = get();
        const rawMarketScope = (value as Partial<GenerationMarketDefinition>).marketScope;
        if (rawMarketScope !== undefined && !isMarketScope(rawMarketScope)) return false;
        const marketScope = rawMarketScope ?? "domestic";
        if (!value.id.trim() || !value.label.trim() || !value.platforms.trim() || !value.guidance.trim() || !value.defaultLanguage.trim() || hasLabel(state.draft.markets, value.label) || state.draft.markets.some((item) => item.id === value.id)) return false;
        const draft = cloneGenerationConfig(state.draft);
        draft.markets.push({ ...value, marketScope, label: value.label.trim(), platforms: value.platforms.trim(), guidance: value.guidance.trim(), defaultLanguage: value.defaultLanguage.trim() });
        draft.marketBindings[value.id] = null;
        set({ draft, isDirty: true, lastSaveError: [] });
        return true;
      },
      updateMarket: (id, patch) => {
        const state = get();
        const current = state.draft.markets.find((item) => item.id === id);
        if (!current) return false;
        const next = { ...current, ...patch };
        if (!next.id.trim() || !next.label.trim() || !next.platforms.trim() || !next.guidance.trim() || !next.defaultLanguage.trim() || !isMarketScope(next.marketScope) || hasLabel(state.draft.markets, next.label, id) || (next.id !== id && state.draft.markets.some((item) => item.id === next.id))) return false;
        const draft = cloneGenerationConfig(state.draft);
        draft.markets = draft.markets.map((item) => item.id === id ? { ...item, ...patch, label: next.label.trim(), platforms: next.platforms.trim(), guidance: next.guidance.trim(), defaultLanguage: next.defaultLanguage.trim() } : item);
        if (next.id !== id) { draft.marketBindings[next.id] = draft.marketBindings[id] ?? null; delete draft.marketBindings[id]; }
        set({ draft, isDirty: true, lastSaveError: [] });
        return true;
      },
      removeMarket: (id) => {
        const state = get();
        if (!state.draft.markets.some((item) => item.id === id)) return false;
        const draft = cloneGenerationConfig(state.draft);
        draft.markets = draft.markets.filter((item) => item.id !== id);
        delete draft.marketBindings[id];
        set({ draft, isDirty: true, lastSaveError: [] });
        return true;
      },
      addModel: (value) => {
        const state = get();
        if (!value.id.trim() || !value.label.trim() || !value.constraints.trim() || hasLabel(state.draft.models, value.label) || state.draft.models.some((item) => item.id === value.id) || !value.resolutions.some((resolution) => resolution.trim())) return false;
        const draft = cloneGenerationConfig(state.draft);
        draft.models.push({ ...value, label: value.label.trim(), constraints: value.constraints.trim(), resolutions: value.resolutions.map((resolution) => resolution.trim()).filter(Boolean) });
        draft.modelBindings[value.id] = null;
        set({ draft, isDirty: true, lastSaveError: [] });
        return true;
      },
      updateModel: (id, patch) => {
        const state = get();
        const current = state.draft.models.find((item) => item.id === id);
        if (!current) return false;
        const next = { ...current, ...patch };
        if (!next.id.trim() || !next.label.trim() || !next.constraints.trim() || hasLabel(state.draft.models, next.label, id) || !next.resolutions.some((resolution) => resolution.trim()) || (next.id !== id && state.draft.models.some((item) => item.id === next.id))) return false;
        const draft = cloneGenerationConfig(state.draft);
        draft.models = draft.models.map((item) => item.id === id ? { ...item, ...patch, label: next.label.trim(), constraints: next.constraints.trim(), resolutions: next.resolutions.map((resolution) => resolution.trim()).filter(Boolean) } : item);
        if (next.id !== id) { draft.modelBindings[next.id] = draft.modelBindings[id] ?? null; delete draft.modelBindings[id]; }
        set({ draft, isDirty: true, lastSaveError: [] });
        return true;
      },
      removeModel: (id) => {
        const state = get();
        if (!state.draft.models.some((item) => item.id === id)) return false;
        const draft = cloneGenerationConfig(state.draft);
        draft.models = draft.models.filter((item) => item.id !== id);
        delete draft.modelBindings[id];
        set({ draft, isDirty: true, lastSaveError: [] });
        return true;
      },
      addStyleCategory: (value) => {
        const state = get();
        if (!value.id.trim() || hasLabel(state.draft.styleCategories, value.label) || state.draft.styleCategories.some((item) => item.id === value.id)) return false;
        const draft = cloneGenerationConfig(state.draft);
        draft.styleCategories.push({ id: value.id, label: value.label.trim(), styles: [] });
        set({ draft, isDirty: true, lastSaveError: [] });
        return true;
      },
      updateStyleCategory: (id, patch) => {
        const state = get();
        const current = state.draft.styleCategories.find((item) => item.id === id);
        const nextId = patch.id?.trim() ?? id;
        if (!current || !nextId || (patch.label !== undefined && (!patch.label.trim() || hasLabel(state.draft.styleCategories, patch.label, id))) || (nextId !== id && state.draft.styleCategories.some((item) => item.id === nextId))) return false;
        const draft = cloneGenerationConfig(state.draft);
        draft.styleCategories = draft.styleCategories.map((item) => item.id === id ? { ...item, ...patch, id: nextId, label: patch.label?.trim() ?? item.label } : item);
        set({ draft, isDirty: true, lastSaveError: [] });
        return true;
      },
      removeStyleCategory: (id) => {
        const state = get();
        const current = state.draft.styleCategories.find((item) => item.id === id);
        if (!current) return false;
        const draft = cloneGenerationConfig(state.draft);
        draft.styleCategories = draft.styleCategories.filter((item) => item.id !== id);
        set({ draft, isDirty: true, lastSaveError: [] });
        return true;
      },
      addStyle: (categoryId, value) => {
        const state = get();
        const category = state.draft.styleCategories.find((item) => item.id === categoryId);
        const allStyles = state.draft.styleCategories.flatMap((item) => item.styles);
        if (!category || category.styles.length >= 4 || !value.id.trim() || !value.label.trim() || !value.description.trim() || allStyles.some((item) => item.id === value.id) || hasLabel(category.styles, value.label)) return false;
        const draft = cloneGenerationConfig(state.draft);
        draft.styleCategories = draft.styleCategories.map((item) => item.id === categoryId ? { ...item, styles: [...item.styles, { ...value, label: value.label.trim(), description: value.description.trim() }] } : item);
        set({ draft, isDirty: true, lastSaveError: [] });
        return true;
      },
      updateStyle: (categoryId, id, patch) => {
        const state = get();
        const category = state.draft.styleCategories.find((item) => item.id === categoryId);
        const current = category?.styles.find((item) => item.id === id);
        if (!category || !current) return false;
        const next = { ...current, ...patch };
        if (!next.id.trim() || !next.label.trim() || !next.description.trim() || hasLabel(category.styles, next.label, id) || (next.id !== id && state.draft.styleCategories.some((item) => item.styles.some((style) => style.id === next.id)))) return false;
        const draft = cloneGenerationConfig(state.draft);
        draft.styleCategories = draft.styleCategories.map((item) => item.id === categoryId ? { ...item, styles: item.styles.map((style) => style.id === id ? { ...style, ...patch, label: next.label.trim(), description: next.description.trim() } : style) } : item);
        set({ draft, isDirty: true, lastSaveError: [] });
        return true;
      },
      removeStyle: (categoryId, id) => {
        const state = get();
        const category = state.draft.styleCategories.find((item) => item.id === categoryId);
        if (!category?.styles.some((item) => item.id === id)) return false;
        const draft = cloneGenerationConfig(state.draft);
        draft.styleCategories = draft.styleCategories.map((item) => item.id === categoryId ? { ...item, styles: item.styles.filter((style) => style.id !== id) } : item);
        set({ draft, isDirty: true, lastSaveError: [] });
        return true;
      },
      addModule: (mode, value) => {
        const state = get();
        const modules = mode === "hero" ? state.draft.heroModules : state.draft.suiteModules;
        if (!value.id.trim() || !value.label.trim() || !value.description.trim() || modules.some((item) => item.id === value.id) || hasLabel(modules, value.label)) return false;
        const draft = cloneGenerationConfig(state.draft);
        const next = { ...value, id: value.id.trim(), label: value.label.trim(), description: value.description.trim(), mode };
        if (mode === "hero") { draft.heroModules.push(next); draft.heroBindings[next.id] = null; }
        else { draft.suiteModules.push(next); draft.suiteBindings[next.id] = null; }
        set({ draft, isDirty: true, lastSaveError: [] });
        return true;
      },
      updateModule: (mode, id, patch) => {
        const state = get();
        const modules = mode === "hero" ? state.draft.heroModules : state.draft.suiteModules;
        const current = modules.find((item) => item.id === id);
        if (!current) return false;
        const next = { ...current, ...patch, mode };
        if (!next.id.trim() || !next.label.trim() || !next.description.trim() || hasLabel(modules, next.label, id) || (next.id !== id && modules.some((item) => item.id === next.id))) return false;
        const draft = cloneGenerationConfig(state.draft);
        const target = mode === "hero" ? draft.heroModules : draft.suiteModules;
        const bindings = mode === "hero" ? draft.heroBindings : draft.suiteBindings;
        const replacement = { ...next, id: next.id.trim(), label: next.label.trim(), description: next.description.trim(), mode };
        const index = target.findIndex((item) => item.id === id);
        target[index] = replacement;
        if (replacement.id !== id) { bindings[replacement.id] = bindings[id] ?? null; delete bindings[id]; }
        set({ draft, isDirty: true, lastSaveError: [] });
        return true;
      },
      removeModule: (mode, id) => {
        const state = get();
        const modules = mode === "hero" ? state.draft.heroModules : state.draft.suiteModules;
        if (modules.length <= 1 || !modules.some((item) => item.id === id)) return false;
        const draft = cloneGenerationConfig(state.draft);
        if (mode === "hero") { draft.heroModules = draft.heroModules.filter((item) => item.id !== id); delete draft.heroBindings[id]; }
        else { draft.suiteModules = draft.suiteModules.filter((item) => item.id !== id); delete draft.suiteBindings[id]; }
        set({ draft, isDirty: true, lastSaveError: [] });
        return true;
      },
      setBinding: (kind, id, binding) => {
        const state = get();
        const draft = cloneGenerationConfig(state.draft);
        const target = kind === "market" ? draft.marketBindings : kind === "model" ? draft.modelBindings : kind === "hero" ? draft.heroBindings : draft.suiteBindings;
        if (!Object.prototype.hasOwnProperty.call(target, id)) return false;
        target[id] = binding ? { ...binding } : null;
        set({ draft, isDirty: true, lastSaveError: [] });
        return true;
      },
    }),
);
