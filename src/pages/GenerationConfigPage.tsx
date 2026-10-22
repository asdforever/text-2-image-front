import { Pencil, Plus, RotateCcw, Save, Send, Trash2 } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../components/ui/button";
import { generationConfigApi, modelConnectionsApi, suiteApi, toDraftGenerationConfig, toPublishedGenerationConfig, type ApiModelConnection, type ApiPromptTemplate, type ApiPromptVersion } from "../api/client";
import { ModelConnectionForm } from "../components/ModelConnectionForm";
import { PromptModelConfig } from "../components/PromptModelConfig";
import { type GenerationModuleDefinition, type StyleDefinition } from "../lib/generation-workspace";
import { groupGenerationMarkets, validateGenerationConfig, type GenerationMarketDefinition, type GenerationMarketScope, type GenerationModelDefinition, type PromptBinding, type PromptVersionReference } from "../lib/generation-config";
import { useGenerationConfigStore } from "../store/useGenerationConfigStore";
import "./reference-pages.css";
import "./reference-settings.css";

interface PromptOption {
  templateId: string;
  versionId: string;
  label: string;
  versionNo: number;
  body?: string;
  contentSha256?: string;
  status?: "draft" | "published" | "retired" | "archived";
  executionTarget?: "llm" | "image_model";
}

type PromptLoadState = "loading" | "history" | "ready" | "partial" | "failed";

function toPromptOption(template: ApiPromptTemplate, version: ApiPromptVersion): PromptOption {
  return { templateId: template.id, versionId: version.id, label: template.name, versionNo: version.versionNo, body: version.body, contentSha256: version.contentSha256, status: version.status, executionTarget: version.executionTarget };
}

function slugify(value: string) {
  return value.trim().toLocaleLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-").replace(/^-|-$/g, "") || `item-${Date.now()}`;
}

function confirmRemoval(label: string) {
  return typeof window === "undefined" || window.confirm(`确定删除“${label}”吗？删除后只影响后续生成。`);
}

function PromptBindingPicker({ binding, options, loadState, onChange }: { binding: PromptBinding | null | undefined; options: PromptOption[]; loadState: PromptLoadState; onChange: (value: PromptBinding | null) => void }) {
  const hasCurrentOption = Boolean(binding && options.some((option) => option.versionId === binding.promptVersionId && option.templateId === binding.promptTemplateId));
  const unavailable = options.length === 0 && (loadState !== "ready" || !binding);
  const savedLabel = binding ? `${binding.templateName || "已保存的提示词"}${binding.versionNo ? ` · v${binding.versionNo}` : ""}` : "";
  return <label className="generation-binding-picker"><span>提示词绑定</span><select className="ui-select" aria-label="提示词绑定" disabled={unavailable} value={binding?.promptVersionId ?? ""} onChange={(event) => {
    const option = options.find((item) => item.versionId === event.target.value);
    onChange(option ? { promptTemplateId: option.templateId, promptVersionId: option.versionId, templateName: option.label, versionNo: option.versionNo, body: option.body, contentSha256: option.contentSha256 } : null);
  }}><option value="">{loadState === "ready" && options.length === 0 && !binding ? "暂无可绑定的提示词" : "未绑定"}</option>{binding && !hasCurrentOption && <option value={binding.promptVersionId}>{savedLabel}{loadState === "ready" ? "（版本不可用）" : ""}</option>}{options.map((option) => <option key={option.versionId} value={option.versionId}>{option.label} · v{option.versionNo}{option.status === "retired" || option.status === "archived" ? "（已归档）" : ""}</option>)}</select></label>;
}

function MarketForm({ initial, onSubmit, onCancel }: { initial?: GenerationMarketDefinition; onSubmit: (value: GenerationMarketDefinition) => void; onCancel: () => void }) {
  const [value, setValue] = useState<GenerationMarketDefinition>(initial ?? { id: "", label: "", marketScope: "domestic", platforms: "", guidance: "", defaultLanguage: "中文" });
  return <form className="generation-config-inline-form" onSubmit={(event) => { event.preventDefault(); onSubmit({ ...value, id: value.id || slugify(value.label) }); }}>
    <input className="ui-input" aria-label="市场名称" placeholder="市场名称" value={value.label} onChange={(event) => setValue({ ...value, label: event.target.value })} />
    <label className="generation-config-field"><span>市场范围</span><select className="ui-select" aria-label="市场范围" value={value.marketScope} onChange={(event) => { const marketScope = event.target.value as GenerationMarketScope; setValue({ ...value, marketScope, defaultLanguage: marketScope === "overseas" ? "英文" : "中文" }); }}><option value="domestic">国内</option><option value="overseas">国外</option></select></label>
    <input className="ui-input" aria-label="适用平台" placeholder="适用平台" value={value.platforms} onChange={(event) => setValue({ ...value, platforms: event.target.value })} />
    <input className="ui-input" aria-label="默认语言" placeholder="默认语言" value={value.defaultLanguage} onChange={(event) => setValue({ ...value, defaultLanguage: event.target.value })} />
    <textarea className="ui-textarea" aria-label="平台规范" placeholder="平台规范说明" value={value.guidance} onChange={(event) => setValue({ ...value, guidance: event.target.value })} />
    <div className="generation-config-form-actions"><Button size="sm" type="submit"><Save size={13} />保存</Button><Button size="sm" variant="ghost" type="button" onClick={onCancel}>取消</Button></div>
  </form>;
}

function StyleForm({ initial, onSubmit, onCancel }: { initial?: StyleDefinition; onSubmit: (value: StyleDefinition) => void; onCancel: () => void }) {
  const [value, setValue] = useState<StyleDefinition>(initial ?? { id: "", label: "", description: "" });
  return <form className="generation-config-inline-form" onSubmit={(event) => { event.preventDefault(); onSubmit({ ...value, id: value.id || slugify(value.label) }); }}>
    <input className="ui-input" aria-label="风格名称" placeholder="风格名称" value={value.label} onChange={(event) => setValue({ ...value, label: event.target.value })} />
    <textarea className="ui-textarea" aria-label="风格描述" placeholder="风格描述" value={value.description} onChange={(event) => setValue({ ...value, description: event.target.value })} />
    <div className="generation-config-form-actions"><Button size="sm" type="submit"><Save size={13} />保存</Button><Button size="sm" variant="ghost" type="button" onClick={onCancel}>取消</Button></div>
  </form>;
}

function ModuleForm({ mode, initial, onSubmit, onCancel }: { mode: "hero" | "suite"; initial?: GenerationModuleDefinition; onSubmit: (value: GenerationModuleDefinition) => void; onCancel: () => void }) {
  const [value, setValue] = useState<GenerationModuleDefinition>(initial ?? { id: "", label: "", description: "", mode });
  return <form className="generation-config-inline-form" onSubmit={(event) => { event.preventDefault(); onSubmit({ ...value, id: value.id || slugify(value.label), mode }); }}>
    <input className="ui-input" aria-label="模块名称" placeholder="模块名称" value={value.label} onChange={(event) => setValue({ ...value, label: event.target.value })} />
    <textarea className="ui-textarea" aria-label="模块说明" placeholder="模块说明" value={value.description} onChange={(event) => setValue({ ...value, description: event.target.value })} />
    <div className="generation-config-form-actions"><Button size="sm" type="submit"><Save size={13} />保存</Button><Button size="sm" variant="ghost" type="button" onClick={onCancel}>取消</Button></div>
  </form>;
}

type ConfigSection = "market" | "style" | "hero" | "suite" | "model" | "prompt-model";
const sectionNames: Record<ConfigSection, string> = { market: "电商市场", style: "图片风格", hero: "主图模块", suite: "详情页模块", model: "生图模型", "prompt-model": "提示词模型" };

function ConfigSelect({ label, value, disabled, onChange, children }: { label: string; value: string; disabled?: boolean; onChange: (value: string) => void; children: React.ReactNode }) {
  return <label className="generation-config-select"><span>{label}</span><select className="ui-select" aria-label={label} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>{children}</select></label>;
}

function ConfigDetail({ label, description, meta, editLabel, deleteLabel, onEdit, onDelete, disabled, deleteDisabled, children }: { label: string; description: string; meta?: string; editLabel: string; deleteLabel: string; onEdit: () => void; onDelete: () => void; disabled?: boolean; deleteDisabled?: boolean; children: React.ReactNode }) {
  return <article className="generation-config-card">
    <div className="generation-config-card-head"><div><strong>{label}</strong>{meta && <span>{meta}</span>}</div><div className="generation-config-card-actions"><button type="button" title={editLabel} aria-label={editLabel} disabled={disabled} onClick={onEdit}><Pencil size={15} /></button><button type="button" title={deleteLabel} aria-label={deleteLabel} disabled={disabled || deleteDisabled} onClick={onDelete}><Trash2 size={15} /></button></div></div>
    <p>{description || "暂未填写说明"}</p>{children}
  </article>;
}

export function GenerationConfigPage() {
  const published = useGenerationConfigStore((state) => state.published);
  const draft = useGenerationConfigStore((state) => state.draft);
  const isDirty = useGenerationConfigStore((state) => state.isDirty);
  const errors = useGenerationConfigStore((state) => state.lastSaveError);
  const draftBaseVersion = useGenerationConfigStore((state) => state.draftBaseVersion);
  const promptVersions = useGenerationConfigStore((state) => state.promptVersions);
  const hydrateRemote = useGenerationConfigStore((state) => state.hydrateRemote);
  const acceptSavedDraft = useGenerationConfigStore((state) => state.acceptSavedDraft);
  const acceptPublished = useGenerationConfigStore((state) => state.acceptPublished);
  const setSaveErrors = useGenerationConfigStore((state) => state.setSaveErrors);
  const addMarket = useGenerationConfigStore((state) => state.addMarket);
  const updateMarket = useGenerationConfigStore((state) => state.updateMarket);
  const removeMarket = useGenerationConfigStore((state) => state.removeMarket);
  const addModel = useGenerationConfigStore((state) => state.addModel);
  const updateModel = useGenerationConfigStore((state) => state.updateModel);
  const removeModel = useGenerationConfigStore((state) => state.removeModel);
  const setPromptModel = useGenerationConfigStore((state) => state.setPromptModel);
  const addStyleCategory = useGenerationConfigStore((state) => state.addStyleCategory);
  const updateStyleCategory = useGenerationConfigStore((state) => state.updateStyleCategory);
  const removeStyleCategory = useGenerationConfigStore((state) => state.removeStyleCategory);
  const addStyle = useGenerationConfigStore((state) => state.addStyle);
  const updateStyle = useGenerationConfigStore((state) => state.updateStyle);
  const removeStyle = useGenerationConfigStore((state) => state.removeStyle);
  const addModule = useGenerationConfigStore((state) => state.addModule);
  const updateModule = useGenerationConfigStore((state) => state.updateModule);
  const removeModule = useGenerationConfigStore((state) => state.removeModule);
  const setBinding = useGenerationConfigStore((state) => state.setBinding);
  const setPromptVersions = useGenerationConfigStore((state) => state.setPromptVersions);
  const [promptOptions, setPromptOptions] = useState<PromptOption[]>([]);
  const [promptLoadState, setPromptLoadState] = useState<PromptLoadState>("loading");
  const promptLoadRequest = useRef(0);
  const [marketForm, setMarketForm] = useState<GenerationMarketDefinition | null>(null);
  const [modelForm, setModelForm] = useState<GenerationModelDefinition | null>(null);
  const [promptModelEditing, setPromptModelEditing] = useState(false);
  const [connections, setConnections] = useState<ApiModelConnection[]>([]);
  const [connectionLoadState, setConnectionLoadState] = useState<"loading" | "ready" | "failed">("loading");
  const [styleForm, setStyleForm] = useState<{ categoryId: string; value?: StyleDefinition } | null>(null);
  const [moduleForm, setModuleForm] = useState<{ mode: "hero" | "suite"; value?: GenerationModuleDefinition } | null>(null);
  const [newCategory, setNewCategory] = useState("");
  const [loadState, setLoadState] = useState<"loading" | "ready" | "failed">("loading");
  const [isSaving, setIsSaving] = useState(false);
  const [section, setSection] = useState<ConfigSection>("market");
  const [selectedIds, setSelectedIds] = useState<Partial<Record<ConfigSection, string>>>({});
  const [categoryId, setCategoryId] = useState("");
  const marketGroups = groupGenerationMarkets(draft.markets);
  const category = draft.styleCategories.find((item) => item.id === categoryId) ?? draft.styleCategories[0];
  const market = draft.markets.find((item) => item.id === selectedIds.market) ?? draft.markets[0];
  const model = draft.models.find((item) => item.id === selectedIds.model) ?? draft.models[0];
  const findConnection = (item: GenerationModelDefinition | null | undefined) => item?.id ? connections.find((connection) => connection.id === (item.connectionId ?? "environment")) : undefined;
  const modelConnection = findConnection(model);
  const style = category?.styles.find((item) => item.id === selectedIds.style) ?? category?.styles[0];
  const moduleMode = section === "suite" ? "suite" : "hero";
  const modules = moduleMode === "hero" ? draft.heroModules : draft.suiteModules;
  const selectedModule = modules.find((item) => item.id === selectedIds[moduleMode]) ?? modules[0];
  const formOpen = Boolean(marketForm || modelForm || styleForm || moduleForm || promptModelEditing);
  const choose = (type: ConfigSection, id: string) => setSelectedIds((current) => ({ ...current, [type]: id }));

  const loadPrompts = () => {
    const requestId = ++promptLoadRequest.current;
    const isActive = () => requestId === promptLoadRequest.current;
    const updateOptions = (options: PromptOption[]) => {
      if (!isActive()) return;
      setPromptOptions(options);
      setPromptVersions(options.map((option): PromptVersionReference => ({ id: option.versionId, templateId: option.templateId, versionNo: option.versionNo, body: option.body, contentSha256: option.contentSha256, status: option.status })));
    };
    setPromptLoadState("loading");
    updateOptions([]);
    void suiteApi.listPromptTemplates().then(async (templates) => {
      if (!isActive()) return;
      const options = new Map<string, PromptOption>();
      templates.forEach((template) => {
        if (template.defaultVersion) options.set(template.defaultVersion.id, toPromptOption(template, template.defaultVersion));
      });
      updateOptions([...options.values()]);
      // The catalog already includes default versions; only fetch missing history.
      const historyTemplates = templates.filter((template) => template.versionCount !== 0 && (!template.defaultVersion || template.versionCount !== 1));
      setPromptLoadState(historyTemplates.length ? "history" : "ready");
      let hasFailure = false;
      await Promise.all(historyTemplates.map(async (template) => {
        try {
          const versions = await suiteApi.listPromptTemplateVersions(template.id);
          if (!isActive()) return;
          versions.forEach((version) => options.set(version.id, toPromptOption(template, version)));
          updateOptions([...options.values()]);
        } catch {
          hasFailure = true;
        }
      }));
      if (isActive()) setPromptLoadState(hasFailure ? "partial" : "ready");
    }).catch(() => {
      if (isActive()) setPromptLoadState("failed");
    });
  };

  const loadConnections = (isActive: () => boolean = () => true) => {
    setConnectionLoadState("loading");
    void modelConnectionsApi.list().then((items) => {
      if (isActive()) { setConnections(items); setConnectionLoadState("ready"); }
    }).catch(() => {
      if (isActive()) { setConnections([]); setConnectionLoadState("failed"); }
    });
  };

  const loadConfiguration = () => {
    let active = true;
    setLoadState("loading");
    loadConnections(() => active);
    void Promise.all([generationConfigApi.getPublished(), generationConfigApi.getDraft()])
      .then(([publishedRecord, draftRecord]) => {
        if (!active) return;
        hydrateRemote(
          toPublishedGenerationConfig(publishedRecord),
          toDraftGenerationConfig(draftRecord),
          draftRecord.baseVersion,
        );
        setSaveErrors([]);
        setLoadState("ready");
      })
      .catch((error: unknown) => {
        if (active) {
          setSaveErrors([error instanceof Error ? error.message : "生成配置加载失败"]);
          setLoadState("failed");
        }
      })
      .finally(() => undefined);
    return () => { active = false; };
  };

  useEffect(() => {
    const cleanup = loadConfiguration();
    return cleanup;
  }, []);

  useEffect(() => {
    loadPrompts();
    return () => { promptLoadRequest.current += 1; };
  }, []);

  const awaitingBindingVersions = promptLoadState !== "ready" && [draft.marketBindings, draft.heroBindings, draft.suiteBindings].some((bindings) => Object.values(bindings).some((binding) => binding && !promptOptions.some((option) => option.versionId === binding.promptVersionId && option.templateId === binding.promptTemplateId)));

  const save = async () => {
    if (awaitingBindingVersions) return;
    const validationErrors = validateGenerationConfig(draft, promptVersions);
    if (validationErrors.length > 0) {
      setSaveErrors(validationErrors);
      return;
    }
    setIsSaving(true);
    try {
      const record = await generationConfigApi.replaceDraft(draftBaseVersion, draft);
      acceptSavedDraft(toDraftGenerationConfig(record), record.baseVersion);
    } catch (error) {
      setSaveErrors([error instanceof Error ? error.message : "草稿保存失败"]);
    } finally {
      setIsSaving(false);
    }
  };
  const publish = async () => {
    setIsSaving(true);
    try {
      const record = await generationConfigApi.publish();
      acceptPublished(toPublishedGenerationConfig(record));
    } catch (error) {
      setSaveErrors([error instanceof Error ? error.message : "配置发布失败"]);
    } finally {
      setIsSaving(false);
    }
  };
  const discard = async () => {
    setIsSaving(true);
    try {
      const record = await generationConfigApi.discardDraft();
      acceptSavedDraft(toDraftGenerationConfig(record), record.baseVersion);
    } catch (error) {
      setSaveErrors([error instanceof Error ? error.message : "放弃草稿失败"]);
    } finally {
      setIsSaving(false);
    }
  };
  const selectedPublishedVersion = useMemo(() => published.version, [published.version]);
  const isReady = loadState === "ready";

  return <div className="app-shell reference-library reference-config generation-config-page generation-config-compact">
    <header className="app-topbar"><div className="workspace-title"><strong>生成配置</strong><span>主图与套图的生成规则</span></div><div className="topbar-meta"><span>已发布 v{selectedPublishedVersion}</span>{isDirty && <span className="generation-config-unsaved">有未保存修改</span>}</div></header>
    <main className="generation-config-content">
      <div className="generation-config-heading">
        <div><h1>生成配置</h1><p>管理平台、风格与模型，保存草稿后发布生效。</p></div>
        <div className="generation-config-actions">
          <Button variant="ghost" onClick={() => void discard()} disabled={!isReady || isSaving || formOpen}><RotateCcw size={14} />放弃草稿</Button>
          <Button variant="secondary" onClick={() => void save()} disabled={!isReady || isSaving || !isDirty || formOpen || awaitingBindingVersions}><Save size={14} />保存草稿</Button>
          <Button onClick={() => void publish()} disabled={!isReady || isSaving || isDirty || formOpen}><Send size={14} />发布配置</Button>
          {loadState === "failed" && <Button variant="ghost" onClick={() => { loadConfiguration(); }} disabled={isSaving}>重新加载</Button>}
        </div>
      </div>
      {errors.length > 0 && <div className="generation-config-errors" role="alert">{errors.map((error) => <span key={error}>{error}</span>)}</div>}
      {(promptLoadState === "loading" || promptLoadState === "history") && <p className="generation-config-edit-note" role="status">{promptLoadState === "loading" ? "正在加载提示词版本…" : "正在加载历史版本，已加载的提示词可先选择。"}</p>}
      {(promptLoadState === "failed" || promptLoadState === "partial") && <div className="generation-config-errors" role="alert"><span>{promptLoadState === "failed" ? "提示词加载失败，已保留当前绑定。" : "部分历史版本加载失败，已保留当前绑定。"}</span><Button size="sm" variant="ghost" onClick={loadPrompts} disabled={isSaving}>重试加载提示词</Button></div>}
      <fieldset className="generation-config-editor" disabled={!isReady || isSaving}>
        <div className="generation-config-selection">
          <ConfigSelect label="配置类型" value={section} disabled={formOpen} onChange={(value) => setSection(value as ConfigSection)}>
            {Object.entries(sectionNames).map(([key, name]) => <option key={key} value={key}>{name}</option>)}
          </ConfigSelect>
          {section === "market" && <ConfigSelect label="选择电商平台" value={market?.id ?? ""} disabled={formOpen} onChange={(id) => choose("market", id)}>
            {!draft.markets.length && <option value="">暂无平台</option>}
            {(["domestic", "overseas"] as const).map((scope) => <optgroup key={scope} label={scope === "domestic" ? "国内" : "国外"}>{marketGroups[scope].map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</optgroup>)}
          </ConfigSelect>}
          {section === "model" && <ConfigSelect label="选择生图模型" value={model?.id ?? ""} disabled={formOpen} onChange={(id) => choose("model", id)}>
            {!draft.models.length && <option value="">暂无模型</option>}{draft.models.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </ConfigSelect>}
          {section === "style" && <>
            <ConfigSelect label="选择风格大类" value={category?.id ?? ""} disabled={formOpen} onChange={(id) => { setCategoryId(id); choose("style", ""); }}>
              {!draft.styleCategories.length && <option value="">暂无大类</option>}{draft.styleCategories.map((item) => <option key={item.id} value={item.id}>{item.label}（{item.styles.length}/4）</option>)}
            </ConfigSelect>
            <ConfigSelect label="选择图片风格" value={style?.id ?? ""} disabled={formOpen || !category?.styles.length} onChange={(id) => choose("style", id)}>
              {!category?.styles.length && <option value="">暂无风格</option>}{category?.styles.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </ConfigSelect>
          </>}
          {(section === "hero" || section === "suite") && <ConfigSelect label={`选择${sectionNames[section]}`} value={selectedModule?.id ?? ""} disabled={formOpen} onChange={(id) => choose(moduleMode, id)}>
            {!modules.length && <option value="">暂无模块</option>}{modules.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </ConfigSelect>}
        </div>
        {formOpen && <p className="generation-config-edit-note" role="status">正在编辑，请先保存或取消本项，再切换配置。</p>}

        {section === "prompt-model" && <PromptModelConfig connectionId={draft.promptModel?.connectionId} connections={connections} loadState={connectionLoadState} onReload={() => loadConnections()} onSelect={(id) => setPromptModel(id ? { connectionId: id } : null)} onCreated={(connection) => setConnections((current) => [...current, connection])} onEditingChange={setPromptModelEditing} />}

        {section === "market" && <section className="generation-config-section">
          <div className="generation-config-section-head"><div><h2>电商市场</h2><p>平台规范、输出语言和提示词绑定 · 共 {draft.markets.length} 个平台</p></div><Button size="sm" disabled={formOpen} onClick={() => setMarketForm({ id: "", label: "", marketScope: market?.marketScope ?? "domestic", platforms: "", guidance: "", defaultLanguage: market?.marketScope === "overseas" ? "英文" : "中文" })}><Plus size={14} />新增市场</Button></div>
          {marketForm ? <MarketForm key={marketForm.id || "new"} initial={marketForm} onSubmit={(value) => { const ok = marketForm.id ? updateMarket(marketForm.id, value) : addMarket(value); if (ok) { choose("market", value.id); setMarketForm(null); } }} onCancel={() => setMarketForm(null)} /> :
            market ? <ConfigDetail label={market.label} description={market.guidance} meta={`${market.marketScope === "overseas" ? "国外" : "国内"} · ${market.platforms} · 默认语言：${market.defaultLanguage}`} editLabel="编辑市场" deleteLabel="删除市场" onEdit={() => setMarketForm(market)} onDelete={() => confirmRemoval(market.label) && removeMarket(market.id)}>
              <PromptBindingPicker binding={draft.marketBindings[market.id]} options={promptOptions} loadState={promptLoadState} onChange={(binding) => setBinding("market", market.id, binding)} />
            </ConfigDetail> : <p className="generation-config-empty">暂无电商平台，点击新增市场开始配置。</p>}
        </section>}

        {section === "model" && <section className="generation-config-section">
          <div className="generation-config-section-head"><div><h2>生图模型</h2><p>接口连接、实际模型名与输出能力 · 共 {draft.models.length} 个模型</p></div><Button size="sm" disabled={formOpen || connectionLoadState !== "ready"} onClick={() => setModelForm({ id: "", label: "", provider: "", constraints: "", resolutions: ["标准 1K"] })}><Plus size={14} />新增模型</Button></div>
          {connectionLoadState === "failed" && <div className="generation-config-errors" role="alert"><span>模型连接加载失败，请重新加载后编辑。</span><Button size="sm" variant="ghost" onClick={() => loadConnections()}>重新加载</Button></div>}
          {modelForm ? <ModelConnectionForm key={modelForm.id || "new"} initial={modelForm} connection={findConnection(modelForm)} models={draft.models} onSubmit={(value, connection) => { const ok = modelForm.id ? updateModel(modelForm.id, value) : addModel(value); if (ok) { setConnections((current) => [...current, connection]); choose("model", value.id); setModelForm(null); } return ok; }} onCancel={() => setModelForm(null)} /> :
            model ? <ConfigDetail label={model.label} description={model.constraints} meta={`${model.provider} · ${model.resolutions.join(" / ")}`} editLabel="编辑模型" deleteLabel="删除模型" disabled={connectionLoadState !== "ready"} onEdit={() => setModelForm(model)} onDelete={() => confirmRemoval(model.label) && removeModel(model.id)}>
              {connectionLoadState === "loading" ? <p>正在加载模型连接…</p> : modelConnection ? <><p>接口地址：{modelConnection.baseUrl}</p><p>实际模型名：{modelConnection.modelName}</p><p>接口类型：OpenAI 兼容图片接口</p><p>API Key：{modelConnection.hasApiKey ? "已配置" : "未配置"}{modelConnection.id === "environment" ? "（现有环境连接）" : ""}</p></> : <p>未配置连接，请编辑模型填写接口信息。</p>}
              <p>支持比例：{model.aspectRatios?.length ? model.aspectRatios.join(" / ") : "未限制"}</p>
            </ConfigDetail> : <p className="generation-config-empty">暂无生图模型，点击新增模型开始配置。</p>}
        </section>}

        {section === "style" && <section className="generation-config-section">
          <div className="generation-config-section-head"><div><h2>图片风格</h2><p>选择风格后，每张图片任务会依据固定风格种子进行细化。每个大类最多 4 个风格。</p></div><Button size="sm" disabled={formOpen || !category || category.styles.length >= 4} onClick={() => category && setStyleForm({ categoryId: category.id })}><Plus size={14} />新增风格</Button></div>
          {category && <div className="generation-config-category-toolbar"><span>{category.label} · {category.styles.length}/4 个风格</span><div className="generation-config-card-actions"><button type="button" title="重命名大类" aria-label="重命名大类" disabled={formOpen} onClick={() => { const next = window.prompt("风格大类名称", category.label); if (next) updateStyleCategory(category.id, { label: next }); }}><Pencil size={14} /></button><button type="button" title="删除大类" aria-label="删除大类" disabled={formOpen} onClick={() => confirmRemoval(category.label) && removeStyleCategory(category.id)}><Trash2 size={14} /></button></div></div>}
          {styleForm ? <StyleForm key={styleForm.value?.id ?? "new"} initial={styleForm.value} onSubmit={(value) => { const ok = styleForm.value ? updateStyle(styleForm.categoryId, styleForm.value.id, value) : addStyle(styleForm.categoryId, value); if (ok) { choose("style", value.id); setStyleForm(null); } }} onCancel={() => setStyleForm(null)} /> :
            style && category ? <ConfigDetail label={style.label} description={style.description} editLabel="编辑风格" deleteLabel="删除风格" onEdit={() => setStyleForm({ categoryId: category.id, value: style })} onDelete={() => confirmRemoval(style.label) && removeStyle(category.id, style.id)}>
              <p>风格种子将在规划时自动应用。</p>
            </ConfigDetail> : <p className="generation-config-empty">{category ? "此大类还没有风格，点击新增风格开始配置。" : "暂无风格大类，请先新建大类。"}</p>}
          <form className="generation-config-category-add" onSubmit={(event) => { event.preventDefault(); const id = slugify(newCategory); if (newCategory.trim() && addStyleCategory({ id, label: newCategory.trim() })) { setCategoryId(id); choose("style", ""); setNewCategory(""); } }}>
            <input className="ui-input" aria-label="新风格大类" placeholder="输入新的风格大类名称" value={newCategory} disabled={formOpen} onChange={(event) => setNewCategory(event.target.value)} /><Button size="sm" type="submit" disabled={formOpen || !newCategory.trim()}><Plus size={14} />新增大类</Button>
          </form>
        </section>}

        {(section === "hero" || section === "suite") && <section className="generation-config-section">
          <div className="generation-config-section-head"><div><h2>{sectionNames[section]}</h2><p>维护模块说明与提示词绑定 · 共 {modules.length} 个模块</p></div><Button size="sm" disabled={formOpen} onClick={() => setModuleForm({ mode: moduleMode })}><Plus size={14} />新增模块</Button></div>
          {moduleForm ? <ModuleForm key={`${moduleForm.mode}-${moduleForm.value?.id ?? "new"}`} mode={moduleForm.mode} initial={moduleForm.value} onSubmit={(value) => { const ok = moduleForm.value ? updateModule(moduleForm.mode, moduleForm.value.id, value) : addModule(moduleForm.mode, value); if (ok) { choose(moduleForm.mode, value.id); setModuleForm(null); } }} onCancel={() => setModuleForm(null)} /> :
            selectedModule ? <ConfigDetail label={selectedModule.label} description={selectedModule.description} editLabel={`编辑${sectionNames[section]}`} deleteLabel={`删除${sectionNames[section]}`} deleteDisabled={modules.length <= 1} onEdit={() => setModuleForm({ mode: moduleMode, value: selectedModule })} onDelete={() => confirmRemoval(selectedModule.label) && removeModule(moduleMode, selectedModule.id)}>
              <PromptBindingPicker binding={(moduleMode === "hero" ? draft.heroBindings : draft.suiteBindings)[selectedModule.id]} options={promptOptions} loadState={promptLoadState} onChange={(binding) => setBinding(moduleMode, selectedModule.id, binding)} />
            </ConfigDetail> : <p className="generation-config-empty">暂无模块，点击新增模块开始配置。</p>}
        </section>}
      </fieldset>
      <p className="generation-config-footnote">修改完成后保存草稿，再发布配置。历史任务保留生成时的快照。</p>
    </main>
  </div>;
}
