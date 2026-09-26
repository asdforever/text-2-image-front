import React, { useEffect, useState } from "react";
import { modulePlanningApi, projectApi, type ApiProject } from "../../api/client";
import { reverseProjectsApi, type ReverseBinding, type ReverseTarget, type ReverseVersion } from "../../api/reverse-projects";
import { Button } from "../../components/ui/button";
import { Dialog } from "../../components/ui/dialog";
import { useProjectStore } from "../../store/useProjectStore";
import { useGenerationConfigStore } from "../../store/useGenerationConfigStore";
import { errorMessage, ReverseError } from "./shared";

export function BindingDialog({ version, sourceModuleId, onClose, onBound }: { version: ReverseVersion; sourceModuleId?: string; onClose: () => void; onBound: (binding: ReverseBinding) => void }) {
  const [projects, setProjects] = useState<ApiProject[]>([]); const [projectId, setProjectId] = useState("");
  const [target, setTarget] = useState<ReverseTarget>("hero"); const [targetModuleId, setTargetModuleId] = useState("");
  const [tasks, setTasks] = useState<{ id: string; label: string }[]>([]);
  const [loading, setLoading] = useState(true); const [tasksLoading, setTasksLoading] = useState(false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [loadEpoch, setLoadEpoch] = useState(0);
  const module = version.document.modules.find(m => m.id === sourceModuleId);
  useEffect(() => {
    let active = true; setLoading(true); setError("");
    projectApi.list().then(items => { if (active) setProjects(items.filter(p => p.status === "active")); }).catch(e => { if (active) setError(errorMessage(e)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [loadEpoch]);
  useEffect(() => {
    let active = true; setTargetModuleId(""); setTasks([]); setTasksLoading(false);
    if (!projectId || !sourceModuleId) return;
    const config = useProjectStore.getState().generationDrafts[projectId + ":" + target]?.config;
    const catalog = useGenerationConfigStore.getState().published[target === "hero" ? "heroModules" : "suiteModules"];
    const label = (id: string) => catalog.find(m => m.id === id)?.label ?? id;
    const local = config?.selectedModuleIds.map((id, i) => ({ id, label: "图 " + (i + 1) + " · " + label(config.moduleTypes?.[id] ?? id) })) ?? [];
    if (local.length) { setTasks(local); return; }
    setTasksLoading(true);
    modulePlanningApi.getLatest(projectId, target).then(plan => { if (active && plan.status === "completed") setTasks(plan.modules.map((m, i) => ({ id: m.taskId ?? m.moduleId, label: "图 " + (i + 1) + " · " + label(m.moduleId) }))); }).catch(e => { if (active && (e as { status?: number }).status !== 404 && (e as { code?: string }).code !== "MODULE_PLAN_NOT_FOUND") setError(errorMessage(e)); }).finally(() => { if (active) setTasksLoading(false); });
    return () => { active = false; };
  }, [projectId, target, sourceModuleId]);
  async function bind() {
    if (busy || !projectId || (sourceModuleId && (!module || !targetModuleId))) return;
    setBusy(true); setError("");
    try { onBound(await reverseProjectsApi.bind(projectId, { target, scope: sourceModuleId ? "module" : "overall", versionId: version.id, ...(sourceModuleId ? { sourceModuleId, targetModuleId } : {}) })); }
    catch (cause) { setError(errorMessage(cause)); } finally { setBusy(false); }
  }
  return <Dialog open title="绑定到业务项目" eyebrow="固定版本引用" onOpenChange={open => { if (!open && !busy) onClose(); }}><form className="rp-dialog-form" onSubmit={e => { e.preventDefault(); void bind(); }}>
    <p>选择使用位置。绑定后，该工作台会读取这里选定的版本。</p>
    <div className="rp-version-note"><strong>{version.document.name} · v{version.versionNo}</strong>{module ? "局部参考：" + module.title : "引用整体策略和模块摘要"}</div>
    <label className="rp-field">业务项目<select aria-label="业务项目" required value={projectId} onChange={e => setProjectId(e.target.value)} disabled={loading || busy}><option value="">{loading ? "加载项目中…" : "请选择业务项目"}</option>{projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
    {!loading && !projects.length && !error && <p>暂无业务项目。请先在项目管理中新建项目。</p>}
    <fieldset className="rp-destination" disabled={busy}><legend className="sr-only">使用位置</legend><label><input type="radio" name="reverse-target" checked={target === "hero"} onChange={() => setTarget("hero")} />主图工作台</label><label><input type="radio" name="reverse-target" checked={target === "suite"} onChange={() => setTarget("suite")} />详情套图工作台</label></fieldset>
    {sourceModuleId && <label className="rp-field">目标图片任务<select required value={targetModuleId} disabled={tasksLoading || busy} onChange={e => setTargetModuleId(e.target.value)}><option value="">{tasksLoading ? "读取图片任务中…" : "请选择具体图片任务"}</option>{tasks.map(task => <option key={task.id} value={task.id}>{task.label}</option>)}</select>{projectId && !tasksLoading && !tasks.length && <small>这个工作台还没有图片任务，请先进入主图或套图完成模块规划。</small>}</label>}
    <p>替换同一位置的引用不会重新生成图片。下次规划时生效，其他工作台和模块保持原来的引用。</p>
    <ReverseError error={error} retry={!busy ? () => setLoadEpoch(n => n + 1) : undefined} /><footer className="rp-dialog-actions"><Button type="button" variant="secondary" disabled={busy} onClick={onClose}>取消</Button><Button type="submit" disabled={busy || !projectId || !!sourceModuleId && (!targetModuleId || !module)}>{busy ? "绑定中…" : "确认绑定"}</Button></footer>
  </form></Dialog>;
}
