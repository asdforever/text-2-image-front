import React, { useEffect, useMemo, useRef, useState } from "react";
import { Check, FileImage, Plus, Save, Sparkles, Trash2, Upload } from "lucide-react";
import { projectApi, type ApiProjectAsset, type ApiProjectDetail } from "../api/client";
import { reverseProjectsApi } from "../api/reverse-projects";
import { reverseExecutionApi, type ReverseExecutionBatch, type ReverseExecutionPlan, type ReverseExecutionStructure, type ReverseExecutionTask } from "../api/reverse-execution";
import { ReverseExecutionHistory } from "./ReverseExecutionHistory";
import { Button } from "../components/ui/button";
import { OutputSettings, type OutputSettingsValue } from "../components/generation-workspace";
import { usePublishedGenerationConfig } from "../hooks/usePublishedGenerationConfig";

type ProjectPreview = { id: string; name: string };
type VersionOption = { id: string; projectName: string; versionNo: number };

const STRUCTURE_FIELDS: Array<[keyof ReverseExecutionStructure, string]> = [
  ["goal", "图片目标"],
  ["layout", "场景与构图"],
  ["informationHierarchy", "信息层级"],
  ["typography", "字体与文字区域"],
  ["colorAndLighting", "色彩与光影"],
  ["adaptationNotes", "适配要求"],
];

function versionLabel(version: VersionOption) {
  return `${version.projectName} · v${version.versionNo}`;
}

function TaskParameterEditor({ parameters, onChange }: { parameters: Array<{ key: string; value: string }>; onChange: (parameters: Array<{ key: string; value: string }>) => void }) {
  const update = (index: number, patch: Partial<{ key: string; value: string }>) => onChange(parameters.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  return <section className="module-parameter-editor project-reverse-task-parameters" aria-label="补充参数">
    <div className="module-parameter-heading"><div><strong>补充参数</strong><span>只会写入这一张图的提示词</span></div><small>{parameters.length}/20</small></div>
    <div className="module-parameter-rows">{parameters.map((parameter, index) => <div className="module-parameter-row" key={index}>
      <label><span>参数名</span><input value={parameter.key} maxLength={60} placeholder="例如：场景地点" onChange={(event) => update(index, { key: event.target.value })} /></label>
      <label className="module-parameter-value"><span>参数值</span><textarea value={parameter.value} maxLength={500} rows={2} placeholder="填写具体要求" onChange={(event) => update(index, { value: event.target.value })} /></label>
      <button type="button" className="module-parameter-remove" title="删除参数" aria-label={`删除${parameter.key || "此参数"}`} onClick={() => onChange(parameters.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={13} /></button>
    </div>)}</div>
    <button type="button" className="module-parameter-add" disabled={parameters.length >= 20} onClick={() => onChange([...parameters, { key: "", value: "" }])}><Plus size={13} />添加参数</button>
  </section>;
}

export function ProjectReverseWorkspace({ project, projectDetail, onRefresh, onToast }: { project: ProjectPreview; projectDetail?: ApiProjectDetail; onRefresh?: () => Promise<void>; onToast?: (message: string) => void }) {
  const [plan, setPlan] = useState<ReverseExecutionPlan | null>(null);
  const [plans, setPlans] = useState<ReverseExecutionPlan[]>([]);
  const [planName, setPlanName] = useState("");
  const [showNewPlan, setShowNewPlan] = useState(false);
  const [newPlanName, setNewPlanName] = useState("");
  const [batches, setBatches] = useState<ReverseExecutionBatch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [versions, setVersions] = useState<VersionOption[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState("");
  const [tasks, setTasks] = useState<ReverseExecutionTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [generatingTaskId, setGeneratingTaskId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [sourceAssetId, setSourceAssetId] = useState("");
  const [auxiliarySourceAssetIds, setAuxiliarySourceAssetIds] = useState<string[]>([]);
  const [productFacts, setProductFacts] = useState<Record<string, string>>({ 商品名称: project.name });
  const [parameterBrief, setParameterBrief] = useState("");
  const { publishedConfig } = usePublishedGenerationConfig();
  const models = publishedConfig.models;
  const defaultModel = models[0];
  const [outputSettings, setOutputSettings] = useState<OutputSettingsValue>(() => ({ outputLanguage: "中文", model: defaultModel?.id ?? "", aspectRatio: "3:4", resolution: defaultModel?.resolutions?.[0] ?? "标准 1K" }));
  const [assigning, setAssigning] = useState(false);
  const [uploadedAssets, setUploadedAssets] = useState<ApiProjectAsset[]>([]);
  const [uploading, setUploading] = useState(false);
  const uploadInput = useRef<HTMLInputElement>(null);
  const auxiliaryUploadInput = useRef<HTMLInputElement>(null);
  const sourceAssets = useMemo(() => [...(projectDetail?.assets ?? []), ...uploadedAssets]
    .filter((asset, index, all) => asset.state === "available" && (asset.kind === "white_background" || asset.kind === "source") && all.findIndex((candidate) => candidate.id === asset.id) === index), [projectDetail?.assets, uploadedAssets]);
  const defaultSourceId = [projectDetail?.selections.white_background, projectDetail?.selections.source,
    sourceAssets.find((asset) => asset.kind === "white_background")?.id, sourceAssets[0]?.id]
    .find((id) => sourceAssets.some((asset) => asset.id === id)) ?? "";
  const hasSource = sourceAssets.some((asset) => asset.id === sourceAssetId);
  const runningBatch = batches.some(batch => batch.status === "running");
  const busy = working || uploading || assigning || runningBatch;
  const confirmedFacts = () => Object.fromEntries(Object.entries(productFacts).map(([key, value]) => [key, value.trim()]).filter(([, value]) => value));

  const load = async () => {
    setLoading(true); setError("");
    try {
      const [savedPlans, reverseProjects] = await Promise.all([
        reverseExecutionApi.list(project.id),
        reverseProjectsApi.list(),
      ]);
      const remembered = localStorage.getItem(`reverse-plan:${project.id}`);
      const existing = savedPlans.find(item => item.id === remembered) ?? savedPlans[0] ?? null;
      const publishedVersions = reverseProjects.flatMap((reverseProject) =>
        [...reverseProject.versions].sort((left, right) => right.versionNo - left.versionNo)
          .map((version) => ({ id: version.id, projectName: reverseProject.name, versionNo: version.versionNo })),
      );
      setVersions(publishedVersions);
      setPlans(savedPlans);
      applyPlan(existing);
      setSelectedVersionId(existing?.versionId ?? publishedVersions[0]?.id ?? "");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "项目反推方案加载失败");
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, [project.id]);

  const applyPlan = (next: ReverseExecutionPlan | null) => {
    setPlan(next); setTasks(next?.tasks ?? []); setPlanName(next?.name ?? "反推方案");
    setSelectedVersionId(next?.versionId ?? ""); setDirty(false); setShowNewPlan(false);
    setSourceAssetId(next?.sourceAssetId ?? defaultSourceId);
    setAuxiliarySourceAssetIds(next?.auxiliarySourceAssetIds ?? []);
    setProductFacts({ 商品名称: project.name, ...next?.productFacts });
    setParameterBrief(next?.parameterBrief ?? "");
    setOutputSettings({ outputLanguage: "中文", model: defaultModel?.id ?? "", aspectRatio: "3:4", resolution: defaultModel?.resolutions?.[0] ?? "标准 1K", ...(next?.outputSettings ?? {}) });
    setBatches([]); setSelectedBatchId("");
    if (next) localStorage.setItem(`reverse-plan:${project.id}`, next.id);
  };

  useEffect(() => {
    if (!plan) return;
    let cancelled = false;
    const refresh = async () => {
      try {
        const next = await reverseExecutionApi.batches(project.id, plan.id);
        if (!cancelled) setBatches(next);
      } catch (nextError) { if (!cancelled) setError(nextError instanceof Error ? nextError.message : "批次加载失败"); }
    };
    void refresh();
    const timer = working || runningBatch ? window.setInterval(() => void refresh(), 5000) : undefined;
    return () => { cancelled = true; if (timer) window.clearInterval(timer); };
  }, [project.id, plan?.id, working, runningBatch]);

  const switchPlan = async (id: string) => {
    if (!id || id === plan?.id) return;
    setWorking(true); setError("");
    try {
      if (dirty && plan) {
        const saved = await reverseExecutionApi.save(project.id, plan.revision, document(), plan.id);
        setPlan(saved); setTasks(saved.tasks); setDirty(false);
      }
      const next = await reverseExecutionApi.get(project.id, id);
      if (!next) throw new Error("所选方案不存在，请刷新");
      applyPlan(next); setPlans(await reverseExecutionApi.list(project.id));
    } catch (nextError) { setError(nextError instanceof Error ? nextError.message : "方案切换失败"); }
    finally { setWorking(false); }
  };

  const startNewPlan = async () => {
    setWorking(true); setError("");
    try {
      if (dirty && plan) {
        const saved = await reverseExecutionApi.save(project.id, plan.revision, document(), plan.id);
        setPlan(saved); setDirty(false);
      }
      setSelectedVersionId(versions[0]?.id ?? "");
      setNewPlanName(`${project.name} · 方案 ${plans.length + 1}`); setShowNewPlan(true);
    } catch (nextError) { setError(nextError instanceof Error ? nextError.message : "当前方案保存失败"); }
    finally { setWorking(false); }
  };

  const selectedVersion = useMemo(() => versions.find((item) => item.id === selectedVersionId), [versions, selectedVersionId]);
  const document = () => ({ name: planName, versionId: plan?.versionId ?? selectedVersionId, referenceCount: tasks.length, tasks: tasks.map(task => ({ ...task, promptDraft: "" })), sourceAssetId: sourceAssetId || null, auxiliarySourceAssetIds, productFacts: confirmedFacts(), parameterBrief: parameterBrief.trim(), parametersAssigned: plan?.parametersAssigned ?? false, parameterSummary: plan?.parameterSummary ?? "", parameterWarnings: plan?.parameterWarnings ?? [], outputSettings });
  const invalidatePreview = () => {
    setTasks(current => current.map(task => ({ ...task, promptDraft: "" })));
    setDirty(true);
  };
  const uploadWhiteImages = async (files: File[], auxiliary = false) => {
    if (!files.length) return;
    const limit = (auxiliary ? 0 : 1) + 4 - auxiliarySourceAssetIds.length;
    if (files.length > limit) { onToast?.(`最多还能上传 ${limit} 张，请保留一张主图和最多四张辅助图`); return; }
    setUploading(true); setError("");
    const uploaded: ApiProjectAsset[] = [];
    try {
      for (const file of files) {
        const asset = await projectApi.uploadAsset(project.id, "white_background", file);
        uploaded.push(asset);
        setUploadedAssets(current => [...current, asset]);
      }
    } catch (nextError) { setError(nextError instanceof Error ? nextError.message : "商品图上传失败，已上传的图片保留"); }
    finally {
      if (uploaded.length) {
        const primary = auxiliary ? sourceAssetId : uploaded[0].id;
        const added = auxiliary ? uploaded : uploaded.slice(1);
        setSourceAssetId(primary);
        setAuxiliarySourceAssetIds(current => [...new Set([...current, ...added.map(asset => asset.id)])].filter(id => id !== primary));
        invalidatePreview();
        try { await onRefresh?.(); } catch { onToast?.("图片已上传，刷新素材列表失败，可稍后重新进入"); }
        onToast?.(`已上传 ${uploaded.length} 张商品素材`);
      }
      setUploading(false);
    }
  };
  const toggleAuxiliary = (id: string) => {
    if (auxiliarySourceAssetIds.includes(id)) setAuxiliarySourceAssetIds(current => current.filter(item => item !== id));
    else {
      if (auxiliarySourceAssetIds.length >= 4) { onToast?.("最多选择四张辅助商品图"); return; }
      setAuxiliarySourceAssetIds(current => [...current, id]);
    }
    invalidatePreview();
  };
  const mutateTask = (taskId: string, patch: Partial<ReverseExecutionTask>) => {
    setTasks((current) => current.map((task) => task.id === taskId ? { ...task, ...patch, promptDraft: "" } : task));
    setDirty(true);
  };
  const mutateStructure = (task: ReverseExecutionTask, key: keyof ReverseExecutionStructure, value: string) => mutateTask(task.id, { structure: { ...task.structure, [key]: value } });
  const mutateParameters = (task: ReverseExecutionTask, moduleParameters: Array<{ key: string; value: string }>) => mutateTask(task.id, { moduleParameters, parametersAssigned: true });

  const generate = async () => {
    if (!selectedVersionId) { onToast?.("请选择已发布的反推版本"); return; }
    setWorking(true); setError("");
    try {
      const created = await reverseExecutionApi.generate(project.id, selectedVersionId, { ...(newPlanName.trim() ? { name: newPlanName.trim() } : {}), sourceAssetId: sourceAssetId || null, auxiliarySourceAssetIds, productFacts: confirmedFacts(), parameterBrief: parameterBrief.trim(), outputSettings });
      applyPlan(created); setPlans(await reverseExecutionApi.list(project.id)); onToast?.("项目反推方案已生成");
    } catch (nextError) { setError(nextError instanceof Error ? nextError.message : "项目反推方案生成失败"); }
    finally { setWorking(false); }
  };
  const autoFillParameters = async () => {
    if (!plan) return;
    setAssigning(true); setError("");
    try {
      const saved = dirty ? await reverseExecutionApi.save(project.id, plan.revision, document(), plan.id) : plan;
      setPlan(saved); setTasks(saved.tasks); setDirty(false);
      const assigned = await reverseExecutionApi.assignParameters(project.id, saved.revision, plan.id);
      setPlan(assigned); setTasks(assigned.tasks); setDirty(false); onToast?.("已按每张图的模块分配补充参数");
    } catch (nextError) { setError(nextError instanceof Error ? nextError.message : "自动填写失败"); }
    finally { setAssigning(false); }
  };
  const save = async () => {
    if (!plan || !dirty) return;
    setWorking(true); setError("");
    try {
      const saved = await reverseExecutionApi.save(project.id, plan.revision, document(), plan.id);
      setPlan(saved); setTasks(saved.tasks); setDirty(false); onToast?.("项目反推方案已保存");
      setPlans(await reverseExecutionApi.list(project.id));
    } catch (nextError) { setError(nextError instanceof Error ? nextError.message : "保存项目反推方案失败"); }
    finally { setWorking(false); }
  };
  const compile = async () => {
    if (!plan) return;
    setWorking(true); setError("");
    try {
      const saved = dirty ? await reverseExecutionApi.save(project.id, plan.revision, document(), plan.id) : plan;
      setPlan(saved); setTasks(saved.tasks); setDirty(false);
      const compiled = await reverseExecutionApi.compile(project.id, saved.revision, confirmedFacts(), plan.id);
      setPlan(compiled); setTasks(compiled.tasks); setDirty(false); onToast?.("提示词预览已生成，出图时会按当前输入重新编译");
    } catch (nextError) { setError(nextError instanceof Error ? nextError.message : "提示词编译失败"); }
    finally { setWorking(false); }
  };
  const generateImages = async (taskId?: string) => {
    if (!plan) return;
    if (!hasSource) { onToast?.("请先选择商品原图或上传白底图"); return; }
    setWorking(true); setError("");
    let generationSubmitted = false;
    try {
      const current = dirty ? await reverseExecutionApi.save(project.id, plan.revision, document(), plan.id) : plan;
      if (dirty) { setPlan(current); setTasks(current.tasks); setDirty(false); }
      setGeneratingTaskId(taskId ?? null);
      generationSubmitted = true;
      const generated = await reverseExecutionApi.generateImages(project.id, current.revision, { planId: plan.id, ...(taskId ? { taskIds: [taskId] } : {}), sourceAssetId, auxiliarySourceAssetIds, aspectRatio: outputSettings.aspectRatio, resolution: outputSettings.resolution });
      setPlan(generated); setTasks(generated.tasks); setDirty(false);
      const history = await reverseExecutionApi.batches(project.id, plan.id);
      setBatches(history); setSelectedBatchId(history[0]?.id ?? "");
      const failed = history[0]?.progress.failed ?? generated.tasks.filter(task => task.status === "failed").length;
      await onRefresh?.();
      onToast?.(taskId ? (failed ? "这张反推图生成失败，可重试" : "这张反推图已生成并归档") : (failed ? `套图生成完成，${failed} 张失败，可单独重试` : "项目反推套图已生成并归档"));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "项目反推图片生成失败");
      // Parameter assignment may have saved a newer revision before generation failed.
      if (generationSubmitted) {
        try {
          const latest = await reverseExecutionApi.get(project.id, plan.id);
          if (latest) { setPlan(latest); setTasks(latest.tasks); setDirty(false); }
        } catch { /* Keep the original error when refresh is unavailable. */ }
      }
    }
    finally { setGeneratingTaskId(null); setWorking(false); }
  };

  const retryBatch = async (batch: ReverseExecutionBatch, taskId: string) => {
    if (!plan) return;
    setWorking(true); setGeneratingTaskId(taskId); setError("");
    try {
      const current = dirty ? await reverseExecutionApi.save(project.id, plan.revision, document(), plan.id) : plan;
      setPlan(current); setTasks(current.tasks); setDirty(false);
      const next = await reverseExecutionApi.generateImages(project.id, current.revision, { planId: plan.id, batchId: batch.id, taskIds: [taskId] });
      setPlan(next); setTasks(next.tasks); setDirty(false);
      setBatches(await reverseExecutionApi.batches(project.id, plan.id)); setSelectedBatchId(batch.id);
      await onRefresh?.(); onToast?.("本次尝试已保存在原批次，历史结果已保留");
    } catch (nextError) { setError(nextError instanceof Error ? nextError.message : "批次重试失败"); }
    finally { setGeneratingTaskId(null); setWorking(false); }
  };

  return <section className="project-reverse-workspace" aria-label="项目反推">
    <header className="project-reverse-header">
      <div><span className="project-reverse-eyebrow">项目反推</span><h1>{project.name} · 模板执行方案</h1><p>按参考套图顺序逐张生成，每次按当前商品信息与模块拆解重新编译提示词。参考图仅供对照。</p></div>
      {plan && <div className="project-reverse-actions"><span className={dirty ? "project-reverse-dirty" : "project-reverse-saved"}>{dirty ? "有未保存修改" : <><Check size={13} />已保存</>}</span><Button variant="secondary" disabled={!dirty || busy} onClick={() => void save()}><Save size={14} />保存方案</Button><Button variant="secondary" disabled={busy} onClick={() => void compile()}><Sparkles size={14} />编译提示词</Button><Button disabled={busy || !tasks.length || !hasSource} onClick={() => void generateImages()}><Sparkles size={14} />{working && !generatingTaskId ? "生成中…" : "整套生成"}</Button></div>}
    </header>
    {error && <div className="project-reverse-error" role="alert">{error}</div>}
    {!loading && plan && <div className="project-reverse-plan-controls">
      <label><span>反推方案</span><select aria-label="反推方案" disabled={busy} value={plan.id} onChange={event => void switchPlan(event.target.value)}>{plans.map(item => <option key={item.id} value={item.id}>{item.id === plan.id ? planName : item.name ?? "反推方案"}</option>)}</select></label>
      <label><span>方案名称</span><input aria-label="方案名称" maxLength={100} disabled={busy} value={planName} onChange={event => { setPlanName(event.target.value); setDirty(true); }} /></label>
      <Button variant="secondary" disabled={busy || !versions.length} onClick={() => void startNewPlan()}><Plus size={14} />新增方案</Button>
    </div>}
    {showNewPlan && <section className="project-reverse-new-plan" aria-label="新增反推方案"><h2>新增反推方案</h2>
      <label><span>新方案名称</span><input aria-label="新方案名称" maxLength={100} value={newPlanName} disabled={busy} onChange={event => setNewPlanName(event.target.value)} /></label>
      <label><span>参考版本</span><select aria-label="新方案反推版本" value={selectedVersionId} disabled={busy} onChange={event => setSelectedVersionId(event.target.value)}>{versions.map(version => <option key={version.id} value={version.id}>{versionLabel(version)}</option>)}</select></label>
      <div className="project-reverse-actions"><Button disabled={busy || !selectedVersionId || !newPlanName.trim()} onClick={() => void generate()}>创建方案</Button><Button variant="secondary" disabled={busy} onClick={() => { setShowNewPlan(false); setSelectedVersionId(plan?.versionId ?? ""); }}>取消</Button></div>
    </section>}
    {!loading && <fieldset className="project-reverse-inputs" disabled={busy}>
      <legend>商品素材与补充参数</legend>
      <div className="project-reverse-product-image">
        <div className="project-reverse-product-preview">{hasSource ? <img src={`/api/projects/${project.id}/assets/${sourceAssetId}/preview`} alt="当前商品图" /> : <><FileImage size={28} /><span>请准备商品原图或白底图</span></>}</div>
        <label><span>主图</span><select aria-label="商品图" value={hasSource ? sourceAssetId : ""} onChange={(event) => { setSourceAssetId(event.target.value); setAuxiliarySourceAssetIds(current => current.filter(id => id !== event.target.value)); invalidatePreview(); }}><option value="">请选择商品图</option>{sourceAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.kind === "white_background" ? "白底图" : "原图"} · {asset.filename}</option>)}</select></label>
        <input ref={uploadInput} type="file" accept="image/*" multiple aria-label="上传白底图" hidden onChange={(event) => { void uploadWhiteImages(Array.from(event.target.files ?? [])); event.currentTarget.value = ""; }} />
        <Button variant="secondary" onClick={() => uploadInput.current?.click()}><Upload size={14} />{uploading ? "上传中…" : "上传白底图"}</Button>
        <section className="project-reverse-auxiliary-images" aria-label="辅助商品图"><strong>辅助图 · {auxiliarySourceAssetIds.length}/4</strong><p>勾选同一商品的其他角度或细节，生成时与主图一起使用。</p><div className="project-reverse-view-list">{sourceAssets.filter(asset => asset.id !== sourceAssetId).map(asset => <label className="project-reverse-view-option" key={asset.id}><input type="checkbox" aria-label={`辅助图：${asset.filename}`} checked={auxiliarySourceAssetIds.includes(asset.id)} disabled={!hasSource || (!auxiliarySourceAssetIds.includes(asset.id) && auxiliarySourceAssetIds.length >= 4)} onChange={() => toggleAuxiliary(asset.id)} /><img src={`/api/projects/${project.id}/assets/${asset.id}/preview`} alt="" /><span>{asset.filename}</span></label>)}</div><input ref={auxiliaryUploadInput} type="file" accept="image/*" multiple aria-label="上传辅助图" hidden onChange={event => { void uploadWhiteImages(Array.from(event.target.files ?? []), true); event.currentTarget.value = ""; }} /><Button variant="secondary" disabled={!hasSource || auxiliarySourceAssetIds.length >= 4} onClick={() => auxiliaryUploadInput.current?.click()}><Upload size={14} />上传辅助图</Button></section><p>主图确定商品外观，辅助图补充真实结构。请使用同一款、同一颜色商品；不要混入其他型号或对标图。</p>
      </div>
      <div className="project-reverse-product-facts">
        <label className="project-reverse-parameter-brief"><span>参数填写<small>用于自动分配到各张图</small></span><textarea aria-label="参数填写" value={parameterBrief} onChange={(event) => { setParameterBrief(event.target.value); invalidatePreview(); }} rows={3} placeholder="例如：商品名称、规格尺寸、材质成分、核心卖点" /></label>
        <div className="project-reverse-auto-fill"><Button variant="secondary" disabled={!plan || busy || assigning} onClick={() => void autoFillParameters()}><Sparkles size={14} />{assigning ? "分配中…" : "自动填写"}</Button>{plan?.parametersAssigned && <span>已按模块分配</span>}</div>
        <p>当前项目名称会作为商品名称。已有白底图会自动优先选中；生成时自动分配尚未分配的参数，并按当前输入重新编译提示词。</p>
        <div className="project-reverse-output-settings"><h3>输出设置</h3><OutputSettings value={outputSettings} onChange={(next) => { setOutputSettings(next); invalidatePreview(); }} /></div>
      </div>
    </fieldset>}
    {loading ? <div className="project-reverse-empty">正在加载项目反推方案…</div> : !plan ? <div className="project-reverse-empty project-reverse-start"><FileImage size={30} /><h2>还没有项目反推方案</h2><p>选择已发布的反推版本，系统会按模板图数量生成对应任务。</p>{versions.length ? <><label htmlFor={`reverse-version-${project.id}`}>反推版本</label><select id={`reverse-version-${project.id}`} aria-label="反推版本" disabled={working} value={selectedVersionId} onChange={(event) => setSelectedVersionId(event.target.value)}>{versions.map((version) => <option key={version.id} value={version.id}>{versionLabel(version)}</option>)}</select><Button disabled={working || !selectedVersionId} onClick={() => void generate()}><Sparkles size={14} />{working ? "生成中…" : "生成项目方案"}</Button></> : <><p className="project-reverse-hint">暂无已发布的反推版本，请先在“爆品图反推”中完成分析并发布。</p><a href="/reverse-projects">前往爆品图反推</a></>}</div> : <>
      <div className="project-reverse-summary"><strong>{tasks.length} 张模板图 · 每次生成重新编译</strong><span>来源：{selectedVersion ? versionLabel(selectedVersion) : `反推版本 ${plan.versionId}`}</span></div>
      <div className="project-reverse-list">{tasks.map((task) => <article className="project-reverse-card" key={task.id}>
        <div className="project-reverse-card-head"><span>图 {task.ordinal}</span><h2>{task.title}</h2><em>{task.referenceModuleId ?? "未匹配模块"}</em><Button size="sm" variant="secondary" disabled={busy || !hasSource} onClick={() => void generateImages(task.id)}>{generatingTaskId === task.id ? "生成中…" : "生成此张"}</Button></div>
        <div className="project-reverse-card-grid"><div className="project-reverse-reference"><img src={task.referencePreviewUrl ?? ""} alt={task.referenceFilename} /><small>{task.referenceFilename}</small>{task.generatedPreviewUrl ? <div className="project-reverse-result"><img src={task.generatedPreviewUrl} alt={`图 ${task.ordinal} 生成结果`} /><small>生成结果 · 已归档</small></div> : <div className="project-reverse-result-placeholder">{task.status === "failed" ? task.error : "尚未生成结果"}</div>}</div><div className="project-reverse-fields">{STRUCTURE_FIELDS.map(([key, label]) => <label key={key}><span>{label}</span><textarea value={task.structure[key]} onChange={(event) => mutateStructure(task, key, event.target.value)} rows={2} /></label>)}<TaskParameterEditor parameters={task.moduleParameters ?? []} onChange={(parameters) => mutateParameters(task, parameters)} /><label className="project-reverse-prompt"><span>提示词预览</span><textarea value={task.promptDraft} readOnly rows={7} placeholder="可点击“编译提示词”预览；预览不保存，生成时会重新编译。需要调整内容请修改模块拆解或补充参数。" /></label></div></div>
      </article>)}</div>
      <ReverseExecutionHistory projectId={project.id} batches={batches} selectedId={selectedBatchId} busy={busy} onSelect={setSelectedBatchId} onRetry={(batch, id) => void retryBatch(batch, id)} />
    </>}
  </section>;
}
