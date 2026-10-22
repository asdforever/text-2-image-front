import { Archive, ArrowUpRight, ChevronLeft, ChevronRight, Images, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { projectApi, projectAssetPreviewUrl, type ApiProjectSummary } from "../api/client";
import { Button } from "../components/ui/button";
import { ProjectCreateDialog } from "../components/ProjectCreateDialog";
import { readCacheKeys, sharedReadCache } from "../lib/read-cache";
import "./reference-pages.css";

export function ProjectManagementPage() {
  const navigate = useNavigate();
  const cachedProjects = sharedReadCache.peek<ApiProjectSummary[]>(readCacheKeys.projectList(true));
  const [projects, setProjects] = useState<ApiProjectSummary[]>(() => cachedProjects ?? []);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
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
      const nextProjects = await projectApi.list(true);
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
  const filtered = useMemo(() => projects.filter((project) => (status === "all" || project.status === status) && project.name.toLowerCase().includes(query.trim().toLowerCase())).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [projects, query, status]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedProjects = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const refresh = () => { sharedReadCache.invalidate(readCacheKeys.projectList(true)); void loadProjects(true); };
  const activeCount = projects.filter(project => project.status === "active").length;
  const projectsWithImages = projects.filter(project => (project.assetCount ?? 0) > 0).length;
  const imageCount = projects.reduce((sum, project) => sum + (project.assetCount ?? 0), 0);
  return <div className="app-shell reference-projects reference-library">
    <main className="management-page">
      <div className="management-toolbar reference-library-heading"><div><h1>项目</h1><p>管理你的全部商品图创作项目</p></div><Button onClick={() => setDialogOpen(true)}><Plus size={15} />新建项目</Button></div>
      <div className="reference-project-stats">
        <div><small>全部项目</small><strong>{projects.length}</strong></div>
        <div className="is-active"><small>进行中</small><strong>{activeCount}</strong></div>
        <div><small>含图片项目</small><strong>{projectsWithImages}</strong></div>
        <div><small>图片资产</small><strong>{imageCount}</strong></div>
      </div>
      <div className="reference-library-filters">
        <div className="management-search"><Search size={14} /><input value={query} placeholder="搜索项目名称…" aria-label="搜索项目" onChange={event => { setQuery(event.target.value); setPage(1); }} /></div>
        <select className="reference-library-select" aria-label="项目状态" value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}><option value="all">全部状态</option><option value="active">进行中</option><option value="archived">已归档</option></select>
        <Button variant="ghost" size="icon" aria-label="刷新项目" disabled={loading} onClick={refresh}><RefreshCw size={14} className={loading ? "spin" : undefined} /></Button>
      </div>
      {message && <div className="upload-feedback" role="status">{message}</div>}
      {error && <div className="upload-feedback" role="alert">{error}<Button variant="ghost" size="sm" onClick={refresh}>重新加载</Button></div>}
      {loading && projects.length === 0 ? <div className="empty-state" role="status">正在加载项目…</div> : filtered.length === 0 ? <div className="empty-state">{projects.length ? "暂无匹配项目" : "还没有项目，创建第一个商品图项目吧"}</div> : <div className="management-grid">
        {pagedProjects.map(project => <article className="management-card reference-management-card" key={project.id}>
          <div className="reference-card-actions">
            <Button variant="ghost" size="icon" aria-label="归档" title="归档项目" disabled={pendingDeletes.has(project.id) || project.status === "archived"} onClick={() => void archive(project.id)}><Archive size={13} /></Button>
            <Button variant="ghost" size="icon" aria-label={pendingDeletes.has(project.id) ? "删除中…" : "删除"} title="删除项目" className="reference-card-danger" disabled={pendingDeletes.has(project.id)} onClick={() => void remove(project.id)}><Trash2 size={13} /></Button>
          </div>
          <button className="reference-management-open" aria-label="进入工作台" title={project.name} disabled={pendingDeletes.has(project.id)} type="button" onClick={() => void navigate({ to: "/projects/$projectId", params: { projectId: project.id }, search: { tab: "base" } })}>
            <div className="reference-management-thumb">{project.coverAssetId ? <img src={projectAssetPreviewUrl(project.id, project.coverAssetId)} alt="" loading="lazy" /> : <Images size={30} />}</div>
            <div className="reference-management-copy"><h2>{project.name}</h2><div><span className={`reference-status ${project.status}`}>{project.status === "active" ? "进行中" : "已归档"}</span><p>{project.assetCount ?? 0} 张图片</p><p>{new Date(project.updatedAt).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</p></div></div>
            <ArrowUpRight size={15} className="reference-management-arrow" />
          </button>
        </article>)}
      </div>}
      {filtered.length > 0 && <nav className="reference-library-pagination" aria-label="项目分页">
        <span>共 {filtered.length} 个项目</span>
        <label>每页<select className="reference-library-select" aria-label="每页项目数" value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(1); }}>{[12, 24, 48].map(size => <option key={size} value={size}>{size}</option>)}</select>个</label>
        <Button variant="secondary" size="sm" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}><ChevronLeft size={13} />上一页</Button>
        <span>第 {currentPage} / {totalPages} 页</span>
        <Button variant="secondary" size="sm" disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)}>下一页<ChevronRight size={13} /></Button>
      </nav>}
    </main>
    <ProjectCreateDialog open={dialogOpen} onOpenChange={setDialogOpen} onCreated={() => void loadProjects()} />
  </div>;
}
