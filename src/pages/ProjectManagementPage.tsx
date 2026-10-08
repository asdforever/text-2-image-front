import { Plus, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { projectApi, type ApiProject } from "../api/client";
import { Button } from "../components/ui/button";
import { ProjectCreateDialog } from "../components/ProjectCreateDialog";
import { readCacheKeys, sharedReadCache } from "../lib/read-cache";

export function ProjectManagementPage() {
  const navigate = useNavigate();
  const cachedProjects = sharedReadCache.peek<ApiProject[]>(readCacheKeys.projectList());
  const [projects, setProjects] = useState<ApiProject[]>(() => cachedProjects ?? []);
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(cachedProjects === undefined);
  const [error, setError] = useState("");
  const deletingIds = useRef(new Set<string>());
  const deletedIds = useRef(new Set<string>());
  const [pendingDeletes, setPendingDeletes] = useState<Set<string>>(() => new Set());
  const loadProjects = useCallback(async (initial = false) => {
    if (initial) setLoading(true);
    setError("");
    try {
      const nextProjects = await projectApi.list();
      setProjects(nextProjects.filter((project) => !deletedIds.current.has(project.id)));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "项目列表加载失败");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void loadProjects(cachedProjects === undefined); }, [loadProjects]);
  const archive = async (projectId: string) => {
    try { await projectApi.archive(projectId); setMessage("项目已归档"); await loadProjects(); }
    catch (nextError) { setError(nextError instanceof Error ? nextError.message : "归档失败"); }
  };
  const remove = async (projectId: string) => {
    if (deletingIds.current.has(projectId) || deletedIds.current.has(projectId)) return;
    if (!window.confirm("确认永久删除这个项目及其项目素材吗？")) return;
    deletingIds.current.add(projectId);
    setPendingDeletes(new Set(deletingIds.current));
    setError("");
    setMessage("");
    try {
      await projectApi.remove(projectId);
      deletedIds.current.add(projectId);
      setProjects((current) => current.filter((project) => project.id !== projectId));
      setMessage("项目已删除");
      await loadProjects();
    }
    catch (nextError) { setError(nextError instanceof Error ? nextError.message : "删除失败"); }
    finally {
      deletingIds.current.delete(projectId);
      setPendingDeletes(new Set(deletingIds.current));
    }
  };
  const filtered = useMemo(() => projects.filter((project) => project.name.toLowerCase().includes(query.toLowerCase())).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [projects, query]);
  return <div className="app-shell"><header className="app-topbar"><div className="workspace-title"><strong>项目管理</strong><span>集中管理项目和工作台入口</span></div><div className="topbar-meta"><span>{projects.length} 个项目</span></div></header><main className="management-page"><div className="management-toolbar"><div><h1>项目管理</h1><p>按最近更新时间查看项目，进入工作台继续处理。</p></div><Button onClick={() => setDialogOpen(true)}><Plus size={15} />新建项目</Button></div><div className="management-search"><Search size={15} /><input value={query} placeholder="搜索项目" onChange={(event) => setQuery(event.target.value)} /></div>{message && <div className="upload-feedback" role="status">{message}</div>}{error && <div className="upload-feedback" role="alert">{error}</div>}{loading && projects.length === 0 ? <div className="empty-state">正在加载项目...</div> : filtered.length === 0 ? <div className="empty-state">暂无匹配项目</div> : <div className="management-grid">{filtered.map((project) => <article className="management-card" key={project.id}><div><h2>{project.name}</h2><p>更新于 {new Date(project.updatedAt).toLocaleString("zh-CN")}</p></div><span>{project.status === "active" ? "进行中" : "已归档"}</span><div className="task-actions"><Button variant="secondary" size="sm" disabled={pendingDeletes.has(project.id)} onClick={() => void navigate({ to: "/projects/$projectId", params: { projectId: project.id }, search: { tab: "base" } })}>进入工作台</Button><Button variant="ghost" size="sm" disabled={pendingDeletes.has(project.id)} onClick={() => void archive(project.id)}>归档</Button><Button variant="ghost" size="sm" disabled={pendingDeletes.has(project.id)} onClick={() => void remove(project.id)}>{pendingDeletes.has(project.id) ? "删除中…" : "删除"}</Button></div></article>)}</div>}</main><ProjectCreateDialog open={dialogOpen} onOpenChange={setDialogOpen} onCreated={() => void loadProjects()} /></div>;
}
