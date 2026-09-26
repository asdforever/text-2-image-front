import React, { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { reverseProjectsApi, type ReverseProject, type ReverseTarget, type ReverseVersion } from "../../api/reverse-projects";
import { Button } from "../../components/ui/button";
import { Dialog } from "../../components/ui/dialog";
import { EmptyReverse, errorMessage, introductionFields, ReverseError } from "./shared";

export function ReferencePickerDialog({ projectId, target, taskId, onClose, onSelected }: { projectId: string; target: ReverseTarget; taskId?: string; onClose: () => void; onSelected: () => Promise<unknown> }) {
  const [projects, setProjects] = useState<ReverseProject[]>([]); const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState(""); const [chosen, setChosen] = useState<ReverseProject | null>(null);
  const [versionId, setVersionId] = useState(""); const [version, setVersion] = useState<ReverseVersion | null>(null);
  const [moduleId, setModuleId] = useState(""); const [versionLoading, setVersionLoading] = useState(false);
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false); const [epoch, setEpoch] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError("");
    reverseProjectsApi.list(controller.signal).then(rows => setProjects(rows.filter(p => !!p.latestVersionId))).catch(e => { if (!controller.signal.aborted) setError(errorMessage(e)); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [epoch]);
  useEffect(() => {
    if (!chosen || !versionId) return;
    const controller = new AbortController(); setVersionLoading(true); setVersion(null); setModuleId(""); setError("");
    reverseProjectsApi.version(chosen.id, versionId, controller.signal).then(setVersion).catch(e => { if (!controller.signal.aborted) setError(errorMessage(e)); }).finally(() => { if (!controller.signal.aborted) setVersionLoading(false); });
    return () => controller.abort();
  }, [chosen?.id, versionId, epoch]);
  const visible = useMemo(() => projects.filter(p => [p.name, p.category, p.summary, p.suitableFor].join(" ").toLowerCase().includes(query.trim().toLowerCase())), [projects, query]);
  async function select() {
    if (!version || busy || (taskId && !moduleId)) return;
    setBusy(true); setError("");
    try {
      await reverseProjectsApi.bind(projectId, { target, scope: taskId ? "module" : "overall", versionId: version.id, ...(taskId ? { targetModuleId: taskId, sourceModuleId: moduleId } : {}) });
      await onSelected(); onClose();
    } catch (cause) { setError(errorMessage(cause)); } finally { setBusy(false); }
  }
  return <Dialog open title={taskId ? "选择模块参考" : "选择反推项目"} eyebrow={target === "hero" ? "主图工作台" : "详情套图工作台"} onOpenChange={open => { if (!open && !busy) onClose(); }}><div className="rp-picker"><div className="rp-picker-list"><label className="rp-search"><Search size={14} /><input placeholder="搜索已发布方案" value={query} onChange={e => setQuery(e.target.value)} /></label>{loading ? <p role="status">正在读取反推项目…</p> : visible.length ? visible.map(p => <button key={p.id} type="button" className="rp-picker-project" aria-pressed={chosen?.id === p.id} onClick={() => { setChosen(p); setVersionId(p.latestVersionId!); }}><strong>{p.name}</strong><span>{p.category || "未分类"}</span><p>{p.summary || p.suitableFor || "查看已发布介绍"}</p></button>) : <p className="rp-picker-help">暂无匹配的已发布方案。请先到“爆品图反推”完成反推并发布版本。</p>}</div>
    <section className="rp-picker-detail">{chosen ? <><label className="rp-field">引用版本<select aria-label="引用版本" value={versionId} disabled={busy} onChange={e => setVersionId(e.target.value)}>{chosen.versions.slice().reverse().map(v => <option key={v.id} value={v.id}>v{v.versionNo} · {new Date(v.createdAt).toLocaleDateString("zh-CN")}</option>)}</select></label>{versionLoading ? <p role="status">正在读取固定版本…</p> : version && <><h3>{version.document.name}</h3><p>{version.document.summary}</p><dl className="rp-definition">{introductionFields.filter(([key]) => key !== "summary").map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{version.document[key] || "未填写"}</dd></div>)}</dl>{taskId ? <label className="rp-field rp-picker-module">参考模块<select aria-label="参考模块" required value={moduleId} onChange={e => setModuleId(e.target.value)}><option value="">请选择一个模块</option>{version.document.modules.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}</select>{moduleId && <p>{version.document.modules.find(m => m.id === moduleId)?.layout}</p>}</label> : <div className="rp-version-note"><strong>整体内容顺序</strong>{version.document.overall.contentFlow}</div>}</>}</> : <EmptyReverse title="选择一套适合当前商品的方案" description="先查看适用介绍，再固定引用某个版本。" />}</section></div>
    <ReverseError error={error} retry={() => setEpoch(n => n + 1)} /><footer className="rp-dialog-actions"><Button variant="secondary" disabled={busy} onClick={onClose}>取消</Button><Button disabled={busy || !version || versionLoading || !!taskId && !moduleId} onClick={() => void select()}>{busy ? "保存引用中…" : "使用这个版本"}</Button></footer>
  </Dialog>;
}
