import React, { useEffect, useMemo, useRef, useState } from "react";
import { Check, FileImage, Plus, Save, Sparkles, Trash2, Upload } from "lucide-react";
import { projectApi, type ApiProjectAsset, type ApiProjectDetail } from "../api/client";
import { reverseProjectsApi } from "../api/reverse-projects";
import { reverseExecutionApi, type ReverseExecutionPlan, type ReverseExecutionStructure, type ReverseExecutionTask } from "../api/reverse-execution";
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
    <div className="module-parameter-rows">{parameters.map((parameter, index) => <div className="module-parameter-row" key={`${index}-${parameter.key}`}>
      <label><span>参数名</span><input value={parameter.key} maxLength={60} placeholder="例如：场景地点" onChange={(event) => update(index, { key: event.target.value })} /></label>
      <label className="module-parameter-value"><span>参数值</span><textarea value={parameter.value} maxLength={500} rows={2} placeholder="填写具体要求" onChange={(event) => update(index, { value: event.target.value })} /></label>
      <button type="button" className="module-parameter-remove" title="删除参数" aria-label={`删除${parameter.key || "此参数"}`} onClick={() => onChange(parameters.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={13} /></button>
    </div>)}</div>
    <button type="button" className="module-parameter-add" disabled={parameters.length >= 20} onClick={() => onChange([...parameters, { key: "", value: "" }])}><Plus size={13} />添加参数</button>
  </section>;
}

export function ProjectReverseWorkspace({ project, projectDetail, onRefresh, onToast }: { project: ProjectPreview; projectDetail?: ApiProjectDetail; onRefresh?: () => Promise<void>; onToast?: (message: string) => void }) {
  const [plan, setPlan] = useState<ReverseExecutionPlan | null>(null);
  const [versions, setVersions] = useState<VersionOption[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState("");
  const [tasks, setTasks] = useState<ReverseExecutionTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [generatingTaskId, setGeneratingTaskId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [sourceAssetId, setSourceAssetId] = useState("");
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
  const sourceAssets = useMemo(() => [...(projectDetail?.assets ?? []), ...uploadedAssets]
    .filter((asset, index, all) => asset.state === "available" && (asset.kind === "white_background" || asset.kind === "source") && all.findIndex((candidate) => candidate.id === asset.id) === index), [projectDetail?.assets, uploadedAssets]);
  const defaultSourceId = [projectDetail?.selections.white_background, projectDetail?.selections.source,
    sourceAssets.find((asset) => asset.kind === "white_background")?.id, sourceAssets[0]?.id]
    .find((id) => sourceAssets.some((asset) => asset.id === id)) ?? "";
  const hasSource = sourceAssets.some((asset) => asset.id === sourceAssetId);
  const busy = working || uploading || assigning;
  const confirmedFacts = () => Object.fromEntries(Object.entries(productFacts).map(([key, value]) => [key, value.trim()]).filter(([, value]) => value));

  const load = async () => {
    setLoading(true); setError("");
    try {
      const [existing, reverseProjects] = await Promise.all([
        reverseExecutionApi.get(project.id),
        reverseProjectsApi.list(),
      ]);
      const publishedVersions = reverseProjects.flatMap((reverseProject) =>
        [...reverseProject.versions].sort((left, right) => right.versionNo - left.versionNo)
          .map((version) => ({ id: version.id, projectName: reverseProject.name, versionNo: version.versionNo })),
      );
      setVersions(publishedVersions);
      setPlan(existing);
      setTasks(existing?.tasks ?? []);
      setSelectedVersionId(existing?.versionId ?? publishedVersions[0]?.id ?? "");
      setSourceAssetId(existing?.sourceAssetId ?? defaultSourceId);
      setProductFacts({ 商品名称: project.name, ...existing?.productFacts });
      setParameterBrief(existing?.parameterBrief ?? "");
      setOutputSettings({ outputLanguage: "中文", model: defaultModel?.id ?? "", aspectRatio: "3:4", resolution: defaultModel?.resolutions?.[0] ?? "标准 1K", ...(existing?.outputSettings ?? {}) });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "项目反推方案加载失败");
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, [project.id]);

  const selectedVersion = useMemo(() => versions.find((item) => item.id === selectedVersionId), [versions, selectedVersionId]);
  const document = () => ({ versionId: plan?.versionId ?? selectedVersionId, referenceCount: tasks.length, tasks, sourceAssetId: sourceAssetId || null, productFacts: confirmedFacts(), parameterBrief: parameterBrief.trim(), parametersAssigned: plan?.parametersAssigned ?? false, parameterSummary: plan?.parameterSummary ?? "", parameterWarnings: plan?.parameterWarnings ?? [], outputSettings });
  const uploadWhiteImage = async (file: File) => {
    setUploading(true); setError("");
    try {
      const asset = await projectApi.uploadAsset(project.id, "white_background", file);
      setUploadedAssets((current) => [...current, asset]);
      setSourceAssetId(asset.id); setDirty(true);
      await onRefresh?.();
      onToast?.("白底图已上传并选为当前商品图");
    } catch (nextError) { setError(nextError instanceof Error ? nextError.message : "白底图上传失败"); }
    finally { setUploading(false); }
  };
  const mutateTask = (taskId: string, patch: Partial<ReverseExecutionTask>) => {
    setTasks((current) => current.map((task) => task.id === taskId ? { ...task, ...patch } : task));
    setDirty(true);
  };
  const mutateStructure = (task: ReverseExecutionTask, key: keyof ReverseExecutionStructure, value: string) => mutateTask(task.id, { structure: { ...task.structure, [key]: value } });
  const mutateParameters = (task: ReverseExecutionTask, moduleParameters: Array<{ key: string; value: string }>) => mutateTask(task.id, { moduleParameters, parametersAssigned: true });

  const generate = async () => {
    if (!selectedVersionId) { onToast?.("请选择已发布的反推版本"); return; }
    setWorking(true); setError("");
    try {
      const created = await reverseExecutionApi.generate(project.id, selectedVersionId, { sourceAssetId: sourceAssetId || null, productFacts: confirmedFacts(), parameterBrief: parameterBrief.trim(), outputSettings });
      setPlan(created); setTasks(created.tasks); setDirty(false); onToast?.("项目反推方案已生成");
    } catch (nextError) { setError(nextError instanceof Error ? nextError.message : "项目反推方案生成失败"); }
    finally { setWorking(false); }
  };
  const autoFillParameters = async () => {
    if (!plan) return;
    setAssigning(true); setError("");
    try {
      const saved = dirty ? await reverseExecutionApi.save(project.id, plan.revision, document()) : plan;
      const assigned = await reverseExecutionApi.assignParameters(project.id, saved.revision);
      setPlan(assigned); setTasks(assigned.tasks); setDirty(false); onToast?.("已按每张图的模块分配补充参数");
    } catch (nextError) { setError(nextError instanceof Error ? nextError.message : "自动填写失败"); }
    finally { setAssigning(false); }
  };
  const save = async () => {
    if (!plan || !dirty) return;
    setWorking(true); setError("");
    try {
      const saved = await reverseExecutionApi.save(project.id, plan.revision, document());
      setPlan(saved); setTasks(saved.tasks); setDirty(false); onToast?.("项目反推方案已保存");
    } catch (nextError) { setError(nextError instanceof Error ? nextError.message : "保存项目反推方案失败"); }
    finally { setWorking(false); }
  };
  const compile = async () => {
    if (!plan) return;
    setWorking(true); setError("");
    try {
      const saved = dirty ? await reverseExecutionApi.save(project.id, plan.revision, document()) : plan;
      setPlan(saved); setTasks(saved.tasks); setDirty(false);
      const compiled = await reverseExecutionApi.compile(project.id, saved.revision, confirmedFacts());
      setPlan(compiled); setTasks(compiled.tasks); setDirty(false); onToast?.("每张图的提示词已编译");
    } catch (nextError) { setError(nextError instanceof Error ? nextError.message : "提示词编译失败"); }
    finally { setWorking(false); }
  };
  const generateImages = async (taskId?: string) => {
    if (!plan) return;
    if (!hasSource) { onToast?.("请先选择商品原图或上传白底图"); return; }
    setWorking(true); setError("");
    try {
      let current = dirty ? await reverseExecutionApi.save(project.id, plan.revision, document()) : plan;
      if (dirty) { setPlan(current); setTasks(current.tasks); setDirty(false); }
      const queue = taskId ? current.tasks.filter((task) => task.id === taskId) : current.tasks;
      if (queue.some((task) => !task.promptDraft.trim())) {
        current = await reverseExecutionApi.compile(project.id, current.revision, confirmedFacts());
        setPlan(current); setTasks(current.tasks); setDirty(false);
      }
      let failed = 0;
      for (const task of queue) {
        setGeneratingTaskId(task.id);
        const generated = await reverseExecutionApi.generateImages(project.id, current.revision, { taskIds: [task.id], sourceAssetId, aspectRatio: outputSettings.aspectRatio, resolution: outputSettings.resolution });
        current = generated;
        setPlan(generated); setTasks(generated.tasks); setDirty(false);
        if (generated.tasks.find((item) => item.id === task.id)?.status === "failed") failed += 1;
      }
      onToast?.(taskId ? (failed ? "这张反推图生成失败，可重试" : "这张反推图已生成并归档") : (failed ? `套图生成完成，${failed} 张失败，可单独重试` : "项目反推套图已生成并归档"));
    } catch (nextError) { setError(nextError instanceof Error ? nextError.message : "项目反推图片生成失败"); }
    finally { setGeneratingTaskId(null); setWorking(false); }
  };

  return <section className="project-reverse-workspace" aria-label="项目反推">
    <header className="project-reverse-header">
      <div><span className="project-reverse-eyebrow">项目反推</span><h1>{project.name} · 模板执行方案</h1><p>按参考套图顺序逐张生成，使用商品图和模块拆解提示词。参考图仅供对照。</p></div>
      {plan && <div className="project-reverse-actions"><span className={dirty ? "project-reverse-dirty" : "project-reverse-saved"}>{dirty ? "有未保存修改" : <><Check size={13} />已保存</>}</span><Button variant="secondary" disabled={!dirty || busy} onClick={() => void save()}><Save size={14} />保存方案</Button><Button variant="secondary" disabled={busy} onClick={() => void compile()}><Sparkles size={14} />编译提示词</Button><Button disabled={busy || !tasks.length || !hasSource} onClick={() => void generateImages()}><Sparkles size={14} />{working && !generatingTaskId ? "生成中…" : "整套生成"}</Button></div>}
    </header>
    {error && <div className="project-reverse-error" role="alert">{error}</div>}
    {!loading && <fieldset className="project-reverse-inputs" disabled={busy}>
      <legend>商品素材与补充参数</legend>
      <div className="project-reverse-product-image">
        <div className="project-reverse-product-preview">{hasSource ? <img src={`/api/projects/${project.id}/assets/${sourceAssetId}/preview`} alt="当前商品图" /> : <><FileImage size={28} /><span>请准备商品原图或白底图</span></>}</div>
        <label><span>商品图</span><select aria-label="商品图" value={hasSource ? sourceAssetId : ""} onChange={(event) => { setSourceAssetId(event.target.value); setDirty(true); }}><option value="">请选择商品图</option>{sourceAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.kind === "white_background" ? "白底图" : "原图"} · {asset.filename}</option>)}</select></label>
        <input ref={uploadInput} type="file" accept="image/*" aria-label="上传白底图" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadWhiteImage(file); event.currentTarget.value = ""; }} />
        <Button variant="secondary" onClick={() => uploadInput.current?.click()}><Upload size={14} />{uploading ? "上传中…" : "上传白底图"}</Button>
        <p>优先使用白底图，也可以选择商品原图。生成图片时使用这里选中的商品。</p>
      </div>
      <div className="project-reverse-product-facts">
        <label className="project-reverse-parameter-brief"><span>参数填写<small>用于自动分配到各张图</small></span><textarea aria-label="参数填写" value={parameterBrief} onChange={(event) => { setParameterBrief(event.target.value); setDirty(true); }} rows={3} placeholder="例如：商品名称、规格尺寸、材质成分、核心卖点" /></label>
        <div className="project-reverse-auto-fill"><Button variant="secondary" disabled={!plan || busy || assigning} onClick={() => void autoFillParameters()}><Sparkles size={14} />{assigning ? "分配中…" : "自动填写"}</Button>{plan?.parametersAssigned && <span>已按模块分配</span>}</div>
        <p>当前项目名称会作为商品名称。已有白底图会自动优先选中；参数会由模型按每张图的模块职责分配，修改后重新自动填写并编译。</p>
        <div className="project-reverse-output-settings"><h3>输出设置</h3><OutputSettings value={outputSettings} onChange={(next) => { setOutputSettings(next); setDirty(true); }} /></div>
      </div>
    </fieldset>}
    {loading ? <div className="project-reverse-empty">正在加载项目反推方案…</div> : !plan ? <div className="project-reverse-empty project-reverse-start"><FileImage size={30} /><h2>还没有项目反推方案</h2><p>选择已发布的反推版本，系统会按模板图数量生成对应任务。</p>{versions.length ? <><label htmlFor={`reverse-version-${project.id}`}>反推版本</label><select id={`reverse-version-${project.id}`} aria-label="反推版本" disabled={working} value={selectedVersionId} onChange={(event) => setSelectedVersionId(event.target.value)}>{versions.map((version) => <option key={version.id} value={version.id}>{versionLabel(version)}</option>)}</select><Button disabled={working || !selectedVersionId} onClick={() => void generate()}><Sparkles size={14} />{working ? "生成中…" : "生成项目方案"}</Button></> : <><p className="project-reverse-hint">暂无已发布的反推版本，请先在“爆品图反推”中完成分析并发布。</p><a href="/reverse-projects">前往爆品图反推</a></>}</div> : <>
      <div className="project-reverse-summary"><strong>{tasks.length} 张模板图 · {tasks.filter((task) => task.promptDraft.trim()).length} 条已编译提示词</strong><span>来源：{selectedVersion ? versionLabel(selectedVersion) : `反推版本 ${plan.versionId}`}</span></div>
      <div className="project-reverse-list">{tasks.map((task) => <article className="project-reverse-card" key={task.id}>
        <div className="project-reverse-card-head"><span>图 {task.ordinal}</span><h2>{task.title}</h2><em>{task.referenceModuleId ?? "未匹配模块"}</em><Button size="sm" variant="secondary" disabled={busy || !hasSource} onClick={() => void generateImages(task.id)}>{generatingTaskId === task.id ? "生成中…" : task.status === "failed" ? "重试此张" : "生成此张"}</Button></div>
        <div className="project-reverse-card-grid"><div className="project-reverse-reference"><img src={task.referencePreviewUrl ?? ""} alt={task.referenceFilename} /><small>{task.referenceFilename}</small>{task.generatedPreviewUrl ? <div className="project-reverse-result"><img src={task.generatedPreviewUrl} alt={`图 ${task.ordinal} 生成结果`} /><small>生成结果 · 已归档</small></div> : <div className="project-reverse-result-placeholder">{task.status === "failed" ? task.error : "尚未生成结果"}</div>}</div><div className="project-reverse-fields">{STRUCTURE_FIELDS.map(([key, label]) => <label key={key}><span>{label}</span><textarea value={task.structure[key]} onChange={(event) => mutateStructure(task, key, event.target.value)} rows={2} /></label>)}<TaskParameterEditor parameters={task.moduleParameters ?? []} onChange={(parameters) => mutateParameters(task, parameters)} /><label className="project-reverse-prompt"><span>编译后的提示词</span><textarea value={task.promptDraft} onChange={(event) => mutateTask(task.id, { promptDraft: event.target.value })} rows={7} placeholder="点击右上角“编译提示词”生成" /></label></div></div>
      </article>)}</div>
    </>}
  </section>;
}
