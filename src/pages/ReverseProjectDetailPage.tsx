import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { ArrowDown, ArrowLeft, ArrowUp, Edit3, Link2, Plus, Sparkles, Trash2, Upload } from "lucide-react";
import { reverseProjectsApi, type ReverseBinding, type ReverseModule, type ReverseProject, type ReverseReferenceImage, type ReverseVersion } from "../api/reverse-projects";
import { Button } from "../components/ui/button";
import { Dialog } from "../components/ui/dialog";
import { AnalysisEditDialog } from "../features/reverse-projects/AnalysisEditDialog";
import { BindingDialog } from "../features/reverse-projects/BindingDialog";
import { ProjectEditDialog } from "../features/reverse-projects/ProjectEditDialog";
import { EmptyReverse, errorMessage, introductionFields, moduleFields, overallFields, ProjectStatus, ReverseError, ReverseShell } from "../features/reverse-projects/shared";

type UploadRow = { id: string; file: File; status: "waiting" | "uploading" | "done" | "failed"; error?: string };
type DetailTab = "references" | "overall" | "modules" | "bindings";
const tabs: [DetailTab, string][] = [["references", "参考套图"], ["overall", "整体反推"], ["modules", "模块拆解"], ["bindings", "绑定记录"]];

export function ReverseProjectDetailPage() {
  const { reverseProjectId = "" } = useParams({ strict: false });
  const search = useSearch({ strict: false }) as { tab?: DetailTab };
  const tab = search.tab ?? "references";
  const navigate = useNavigate();
  const [project, setProject] = useState<ReverseProject | null>(null);
  const [viewVersion, setViewVersion] = useState<ReverseVersion | null>(null);
  const [error, setError] = useState(""); const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState("");
  const [editingProject, setEditingProject] = useState(false);
  const [editingAnalysis, setEditingAnalysis] = useState<{ kind: "overall" | "module"; module?: ReverseModule } | null>(null);
  const [confirmAnalysis, setConfirmAnalysis] = useState(false);
  const [binding, setBinding] = useState<{ version: ReverseVersion; sourceModuleId?: string } | null>(null);
  const [bindings, setBindings] = useState<ReverseBinding[]>([]); const [bindingLoad, setBindingLoad] = useState(false);
  const [bindingError, setBindingError] = useState(""); const [bindingsEpoch, setBindingsEpoch] = useState(0);
  const [selectedModuleId, setSelectedModuleId] = useState("");
  const [preview, setPreview] = useState<ReverseReferenceImage | null>(null);
  const [uploads, setUploads] = useState<UploadRow[]>([]);
  const locked = useRef(false);
  const data = viewVersion?.document ?? project;
  const currentModule = data?.modules.find(m => m.id === selectedModuleId) ?? data?.modules[0];
  const working = !!busy || project?.analysis.status === "running";
  const setTab = (next: DetailTab) => { void navigate({ to: "/reverse-projects/$reverseProjectId", params: { reverseProjectId }, search: { tab: next }, replace: true }); };
  const refresh = useCallback(async () => { setError(""); try { setProject(await reverseProjectsApi.get(reverseProjectId)); } catch (e) { setError(errorMessage(e)); } }, [reverseProjectId]);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setProject(null); setViewVersion(null); setError("");
    reverseProjectsApi.get(reverseProjectId, controller.signal).then(setProject).catch(e => { if (!controller.signal.aborted) setError(errorMessage(e)); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [reverseProjectId]);
  useEffect(() => {
    if (project?.analysis.status !== "running" || busy === "analyze") return;
    const controller = new AbortController(); let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try { const next = await reverseProjectsApi.get(reverseProjectId, controller.signal); if (!controller.signal.aborted) { setProject(next); if (next.analysis.status === "running") timer = setTimeout(poll, 3000); } }
      catch (e) { if (!controller.signal.aborted) { setError(errorMessage(e)); timer = setTimeout(poll, 6000); } }
    };
    timer = setTimeout(poll, 3000);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [reverseProjectId, project?.analysis.status, busy]);
  useEffect(() => {
    if (tab !== "bindings") return;
    let active = true; setBindingLoad(true); setBindingError("");
    reverseProjectsApi.bindings(reverseProjectId).then(rows => { if (active) setBindings(rows); }).catch(e => { if (active) setBindingError(errorMessage(e)); }).finally(() => { if (active) setBindingLoad(false); });
    return () => { active = false; };
  }, [reverseProjectId, tab, bindingsEpoch]);
  async function action(name: string, task: () => Promise<void>) {
    if (locked.current) return;
    locked.current = true; setBusy(name); setError(""); setMessage("");
    try { await task(); } catch (cause) { setError(errorMessage(cause)); } finally { locked.current = false; setBusy(""); }
  }
  function saved(next: ReverseProject) { setProject(next); setEditingProject(false); setEditingAnalysis(null); setMessage("草稿已保存，已绑定版本保持不变"); }
  async function uploadRows(rows: UploadRow[]) {
    if (!project) return;
    await action("upload", async () => {
      for (const row of rows) {
        setUploads(current => current.map(r => r.id === row.id ? { ...r, status: "uploading", error: undefined } : r));
        try { setProject(await reverseProjectsApi.upload(project.id, row.file)); setUploads(current => current.map(r => r.id === row.id ? { ...r, status: "done" } : r)); }
        catch (cause) { setUploads(current => current.map(r => r.id === row.id ? { ...r, status: "failed", error: errorMessage(cause) } : r)); }
      }
    });
  }
  function upload(files: File[]) {
    if (!project || working || !files.length) return;
    if (files.length + project.references.length > 16) { setError("一个反推项目最多保存 16 张参考图，请减少上传数量。"); return; }
    const rows = files.map(file => ({ id: crypto.randomUUID(), file, status: "waiting" as const }));
    setUploads(current => [...current.filter(r => r.status !== "done"), ...rows]); void uploadRows(rows);
  }
  async function moveReference(id: string, delta: number) {
    if (!project) return;
    const ids = project.references.map(r => r.id); const i = ids.indexOf(id); const j = i + delta;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    await action("order", async () => { setProject(await reverseProjectsApi.reorder(project.id, project.revision, ids)); });
  }
  async function analyze() {
    if (!project) return; setConfirmAnalysis(false);
    await action("analyze", async () => {
      try { setProject(await reverseProjectsApi.analyze(project.id, project.revision)); setMessage("整套反推已完成，请检查介绍、整体策略与模块拆解，再发布版本。"); }
      catch (cause) { setProject(await reverseProjectsApi.get(project.id).catch(() => project)); throw cause; }
    });
  }
  async function publish() {
    if (!project) return;
    await action("publish", async () => { const version = await reverseProjectsApi.publish(project.id, project.revision); setProject(await reverseProjectsApi.get(project.id)); setMessage("已发布 v" + version.versionNo + "，现在可以绑定到业务项目。"); });
  }
  async function openBinding(sourceModuleId?: string) {
    if (!project?.latestVersionId) return;
    await action("binding", async () => {
      const version = viewVersion ?? await reverseProjectsApi.version(project.id, project.latestVersionId!);
      if (sourceModuleId && !version.document.modules.some(m => m.id === sourceModuleId)) throw new Error("这个模块尚未发布，请先发布当前草稿。");
      setBinding({ version, sourceModuleId });
    });
  }
  const tabKeyboard = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft") next = (index + tabs.length - 1) % tabs.length;
    else if (event.key === "Home") next = 0; else if (event.key === "End") next = tabs.length - 1; else return;
    event.preventDefault(); setTab(tabs[next][0]); document.getElementById("rp-tab-" + tabs[next][0])?.focus();
  };
  if (!project || !data) return <ReverseShell title="反推项目"><Link className="rp-back" to="/reverse-projects">返回项目列表</Link>{loading ? <div className="rp-empty" role="status">正在读取反推项目…</div> : <ReverseError error={error || "未找到反推项目"} retry={() => void refresh()} />}</ReverseShell>;
  return <ReverseShell title={project.name}>
    <div className="rp-page-head"><div><Link className="rp-back" to="/reverse-projects"><ArrowLeft size={13} />反推项目</Link><div className="rp-actions"><h1>{data.name}</h1><ProjectStatus project={project} /></div><p>{data.summary || "保存一套参考图，逐步完善整体策略和模块细节。"}</p></div><div className="rp-actions">
      {!viewVersion && <Button variant="secondary" disabled={working} onClick={() => setEditingProject(true)}><Edit3 size={14} />编辑项目</Button>}
      {!viewVersion && <Button variant="secondary" disabled={working || !project.references.length} onClick={() => project.modules.length ? setConfirmAnalysis(true) : void analyze()}><Sparkles size={14} />{busy === "analyze" ? "反推中…" : project.modules.length ? "重新反推" : "开始整套反推"}</Button>}
      {!viewVersion && <Button variant="secondary" disabled={working || !project.modules.length} onClick={() => void publish()}>{busy === "publish" ? "发布中…" : "发布版本"}</Button>}
      <Button disabled={working || !project.latestVersionId} title={!project.latestVersionId ? "先发布一个版本，再绑定到业务项目" : undefined} onClick={() => void openBinding()}><Link2 size={14} />绑定到业务项目</Button>
    </div></div>
    <ReverseError error={error} />{message && <div className="rp-notice" role="status">{message}<button type="button" aria-label="关闭提示" onClick={() => setMessage("")}>×</button></div>}
    {working && (busy === "analyze" || project.analysis.status === "running") && <div className="rp-notice" role="status">正在分析整套图片的内容顺序、视觉规则和局部构图，结果返回后会更新。可以稍后回来查看。</div>}
    {!error && project.analysis.status === "failed" && <ReverseError error={project.analysis.error || "反推没有完成，已有草稿已保留。请重试。"} />}
    {viewVersion && <div className="rp-notice">正在查看固定版本 v{viewVersion.versionNo}，内容只读。<Button variant="secondary" size="sm" onClick={() => setViewVersion(null)}>返回当前草稿</Button></div>}
    <div className="rp-tabs" role="tablist" aria-label="反推项目内容">{tabs.map(([key, label], index) => <button key={key} id={"rp-tab-" + key} role="tab" aria-selected={tab === key} aria-controls={"rp-panel-" + key} tabIndex={tab === key ? 0 : -1} type="button" onKeyDown={e => tabKeyboard(e, index)} onClick={() => setTab(key)}>{label}</button>)}</div>
    <div role="tabpanel" id={"rp-panel-" + tab} aria-labelledby={"rp-tab-" + tab}>
    {tab === "references" && <div className="rp-two-col"><section className="rp-panel"><div className="rp-panel-head"><div><h2>参考套图</h2><p>按原始顺序保存，整体规划沿着这套图片学习内容节奏。</p></div><span className="rp-badge">{data.references.length} 张参考图</span></div>
      {data.references.length > 0 && <div className="rp-thumbnail-grid">{data.references.map((image, index) => <article className="rp-image-card" key={image.id}><button className="rp-image-preview" aria-label={"查看原图 " + image.filename} onClick={() => setPreview(image)}><img src={image.previewUrl} alt={image.filename} loading="lazy" /></button><div className="rp-image-caption"><strong>{index + 1}. {image.filename}</strong><small>{image.width} × {image.height}</small>{!viewVersion && <div className="rp-mini-actions"><button type="button" disabled={working || index === 0} aria-label={"上移 " + image.filename} onClick={() => void moveReference(image.id, -1)}><ArrowUp size={12} /></button><button type="button" disabled={working || index === data.references.length - 1} aria-label={"下移 " + image.filename} onClick={() => void moveReference(image.id, 1)}><ArrowDown size={12} /></button><button type="button" disabled={working} aria-label={"删除 " + image.filename} onClick={() => { if (window.confirm("从当前草稿移除这张参考图及其模块拆解？已发布版本中的原图会保留。")) void action("remove", async () => { setProject(await reverseProjectsApi.removeReference(project.id, image.id)); }); }}><Trash2 size={12} /></button></div>}</div></article>)}</div>}
      {!viewVersion && <label className="rp-upload" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); upload(Array.from(e.dataTransfer.files)); }}><Upload size={23} /><strong>{busy === "upload" ? "正在保存参考图片…" : "拖入整套参考图，或点击上传"}</strong><span>JPG、PNG、WebP · 最多 16 张 · 支持完整长图</span><input type="file" aria-label="上传参考套图" multiple accept="image/jpeg,image/png,image/webp" disabled={working} onChange={e => { upload(Array.from(e.target.files ?? [])); e.target.value = ""; }} /></label>}
      {uploads.length > 0 && <div className="rp-upload-log" aria-label="参考图上传状态">{uploads.map(row => <div key={row.id}><span>{row.file.name}</span><span>{row.status === "done" ? "已保存" : row.status === "uploading" ? "上传处理中" : row.status === "waiting" ? "等待上传" : row.error}</span>{row.status === "failed" && <Button size="sm" variant="secondary" disabled={working} onClick={() => void uploadRows([row])}>重试上传</Button>}</div>)}</div>}
    </section><aside className="rp-panel"><h2>反推项目介绍</h2><p>这些信息帮助判断方案是否适合当前商品。</p><dl className="rp-definition">{introductionFields.filter(([key]) => key !== "summary").map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{data[key] || "尚未填写，可在编辑项目中补充，或完成整套反推。"}</dd></div>)}</dl></aside></div>}
    {tab === "overall" && <div className="rp-two-col"><section className="rp-panel"><div className="rp-panel-head"><div><h2>整体反推</h2><p>规划大师读取这些内容，学习整套表达方法。</p></div>{!viewVersion && <Button variant="secondary" size="sm" disabled={working} onClick={() => setEditingAnalysis({ kind: "overall" })}>编辑整体反推</Button>}</div><dl className="rp-definition">{overallFields.map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{data.overall[key] || "尚未分析。可以运行整套反推，也可以手动填写。"}</dd></div>)}</dl><div className="rp-list-note">参考只提供设计方法；竞品参数、价格、认证和功效不作为当前商品事实。</div></section><aside className="rp-panel"><h2>版本记录</h2><p>发布后固定保存当前内容，后续编辑留在草稿。</p><div className="rp-version-list"><button type="button" aria-pressed={!viewVersion} onClick={() => setViewVersion(null)}><span>当前草稿</span><small>修订 {project.revision}</small></button>{project.versions.slice().reverse().map(v => <button key={v.id} type="button" disabled={!!busy} aria-pressed={viewVersion?.id === v.id} onClick={() => void action("version", async () => { setViewVersion(await reverseProjectsApi.version(project.id, v.id)); })}><span>v{v.versionNo} · 已发布</span><small>{new Date(v.createdAt).toLocaleDateString("zh-CN")}</small></button>)}</div></aside></div>}
    {tab === "modules" && <section className="rp-panel"><div className="rp-panel-head"><div><h2>模块拆解</h2><p>模块规划器读取局部构图和对应原图，同时继承整体视觉规则。</p></div>{!viewVersion && <Button variant="secondary" size="sm" disabled={working || !project.references.length} onClick={() => setEditingAnalysis({ kind: "module" })}><Plus size={13} />添加模块</Button>}</div>{!currentModule ? <EmptyReverse title="还没有模块拆解" description="上传参考套图后开始整套反推，或手动添加模块。" /> : <div className="rp-module-layout"><div className="rp-module-list" aria-label="反推模块列表">{data.modules.map(m => <button key={m.id} type="button" aria-pressed={m.id === currentModule.id} onClick={() => setSelectedModuleId(m.id)}>{data.references.find(r => r.id === m.referenceImageId) && <img src={data.references.find(r => r.id === m.referenceImageId)!.previewUrl} alt="" />}<span>{m.title}</span></button>)}</div><div><div className="rp-panel-head"><h3>{currentModule.title}</h3><div className="rp-actions">{!viewVersion && <Button size="sm" variant="secondary" disabled={working} onClick={() => setEditingAnalysis({ kind: "module", module: currentModule })}>编辑拆解</Button>}<Button size="sm" disabled={working || !project.latestVersionId} onClick={() => void openBinding(currentModule.id)}>绑定这个模块</Button></div></div><dl className="rp-definition">{moduleFields.map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{currentModule[key] || "未填写"}</dd></div>)}</dl></div></div>}</section>}
    {tab === "bindings" && <section className="rp-panel"><div className="rp-panel-head"><div><h2>绑定记录</h2><p>每个工作台固定使用绑定时的版本；发布新版本不会自动替换。</p></div><Button size="sm" disabled={working || !project.latestVersionId} onClick={() => void openBinding()}>新增绑定</Button></div><ReverseError error={bindingError} retry={() => setBindingsEpoch(n => n + 1)} />{bindingLoad ? <p role="status">正在读取绑定记录…</p> : <div className="rp-binding-list" aria-label="绑定记录列表">{bindings.length ? bindings.map(b => <article key={b.id} className="rp-binding-item"><div><strong>{b.projectName}</strong><p>{b.target === "hero" ? "主图" : "详情套图"} · {b.scope === "overall" ? "整体策略与模块摘要" : b.sourceModuleTitle || "模块参考"} · v{b.versionNo}</p></div><div className="rp-actions"><Button size="sm" variant="ghost" disabled={working} onClick={() => void action("unbind", async () => { await reverseProjectsApi.unbind(b.projectId, b.id); setBindingsEpoch(n => n + 1); setMessage("已解除绑定"); })}>解除绑定</Button><Button size="sm" variant="secondary" onClick={() => void navigate({ to: "/projects/$projectId", params: { projectId: b.projectId }, search: { tab: b.target } })}>打开对应工作台</Button></div></article>) : !bindingError && <EmptyReverse title="暂未绑定到业务项目" description="先发布一个版本，再选择业务项目的主图或详情套图。" />}</div>}</section>}
    </div>
    {editingProject && <ProjectEditDialog project={project} onClose={() => setEditingProject(false)} onSaved={saved} />}
    {editingAnalysis && <AnalysisEditDialog project={project} {...editingAnalysis} onClose={() => setEditingAnalysis(null)} onSaved={saved} />}
    {binding && <BindingDialog {...binding} onClose={() => setBinding(null)} onBound={b => { setBinding(null); setMessage("已绑定到「" + b.projectName + "」的" + (b.target === "hero" ? "主图" : "详情套图") + "，固定使用 v" + b.versionNo); setBindingsEpoch(n => n + 1); setTab("bindings"); }} />}
    {confirmAnalysis && <Dialog open title="重新分析整套图片" eyebrow="更新反推草稿" onOpenChange={setConfirmAnalysis}><div className="rp-dialog-form"><p>模型会重新提炼项目介绍、整体策略与模块拆解，并替换当前草稿中的分析内容。已发布的版本和绑定记录不变。</p><div className="rp-dialog-actions"><Button variant="secondary" onClick={() => setConfirmAnalysis(false)}>保留当前草稿</Button><Button onClick={() => void analyze()}>确认重新反推</Button></div></div></Dialog>}
    {preview && <Dialog open title={preview.filename} eyebrow={preview.width + " × " + preview.height} onOpenChange={open => { if (!open) setPreview(null); }}><img className="rp-preview" src={preview.previewUrl} alt={preview.filename} /></Dialog>}
  </ReverseShell>;
}
