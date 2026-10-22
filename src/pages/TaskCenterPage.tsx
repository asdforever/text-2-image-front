import { ArrowUpRight, CheckCircle2, Clock3, Image, Layers3, Loader2, RefreshCw, Search, TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { taskCenterApi } from "../api/client";
import { Button } from "../components/ui/button";
import { filterTaskCenterProjects, groupTaskCenterProjects, hasActiveTaskCenterTasks, isTaskCenterTaskActive, taskCenterStatusLabel, type TaskCenterProject, type TaskCenterTask } from "../lib/task-center";
import { useProjectStore } from "../store/useProjectStore";
import "./reference-pages.css";

const STATUS_OPTIONS = [["all", "全部状态"], ["compiling_prompt", "提示词编译中"], ["compiling", "提示词编译中"], ["awaiting_confirmation", "待确认"], ["queued", "排队中"], ["leased", "已分配"], ["dispatching", "派发中"], ["running", "生成中"], ["generating", "生成中"], ["succeeded", "已完成"], ["completed", "已完成"], ["partially_failed", "部分失败"], ["failed", "失败"], ["cancelled", "已取消"], ["needs_retry", "待重试"]] as const;
const TASK_POLL_INTERVAL_MS = 3_000;

function taskTitle(task: TaskCenterTask) { return task.type === "hero" ? "主图生成" : "详情套图"; }
function progressLabel(task: TaskCenterTask) { return task.progress ? `${task.progress.succeeded} / ${task.progress.total}` : null; }

export function TaskCenterPage() {
  const navigate = useNavigate();
  const currentProjectId = useProjectStore((state) => state.currentProjectId);
  const [projects, setProjects] = useState<TaskCenterProject[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [projectId, setProjectId] = useState("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [pollCycle, setPollCycle] = useState(0);
  const inFlight = useRef<Promise<void> | null>(null);

  const load = useCallback((background = false) => {
    if (inFlight.current) return inFlight.current;
    const pending = (async () => {
      if (background) setRefreshing(true); else setLoading(true);
      setError("");
      try { setProjects((await taskCenterApi.list()).projects); }
      catch (cause) { setError(cause instanceof Error ? cause.message : "任务列表加载失败"); }
      finally { setLoading(false); setRefreshing(false); setPollCycle((current) => current + 1); }
    })();
    inFlight.current = pending;
    void pending.finally(() => { if (inFlight.current === pending) inFlight.current = null; });
    return pending;
  }, []);
  useEffect(() => { void load(); }, [load]);
  const hasActiveTasks = useMemo(() => hasActiveTaskCenterTasks(projects), [projects]);
  useEffect(() => {
    if (!hasActiveTasks) return;
    const timer = window.setTimeout(() => { if (document.visibilityState === "visible") void load(true); }, TASK_POLL_INTERVAL_MS);
    return () => window.clearTimeout(timer);
  }, [hasActiveTasks, load, pollCycle, projects]);
  useEffect(() => {
    const resume = () => { if (document.visibilityState === "visible") void load(true); };
    window.addEventListener("focus", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      window.removeEventListener("focus", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [load]);

  const visibleProjects = useMemo(() => {
    const filtered = filterTaskCenterProjects(projects, status);
    const byProject = projectId === "all" ? filtered : filtered.filter((project) => project.projectId === projectId);
    return groupTaskCenterProjects(byProject.filter(project => project.projectName.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())), currentProjectId);
  }, [currentProjectId, projectId, projects, status, query]);
  const allTasks = projects.flatMap(project => project.tasks);
  const activeCount = allTasks.filter(task => isTaskCenterTaskActive(task.status)).length;
  const completedCount = allTasks.filter(task => ["succeeded", "completed"].includes(task.status)).length;
  const attentionCount = allTasks.filter(task => ["awaiting_confirmation", "failed", "partially_failed", "needs_retry"].includes(task.status)).length;
  const openTask = (task: TaskCenterTask) => { void navigate({ to: "/projects/$projectId", params: { projectId: task.projectId }, search: { tab: task.workbenchTab } }); };

  return <div className="app-shell reference-tasks reference-library">
    <main className="task-center-page">
      <div className="management-toolbar reference-library-heading"><div><h1>任务中心</h1><p>查看主图与详情套图进度，继续处理你的创作</p></div><Button variant="secondary" size="sm" aria-label="刷新任务" disabled={refreshing || loading} onClick={() => void load(true)}><RefreshCw size={14} className={refreshing ? "spin" : undefined} />刷新任务</Button></div>
      <div className="reference-project-stats reference-task-stats">
        <div><small><Layers3 size={13} />全部任务</small><strong>{allTasks.length}</strong></div>
        <div className="is-active"><small><Clock3 size={13} />处理中</small><strong>{activeCount}</strong></div>
        <div className="is-complete"><small><CheckCircle2 size={13} />已完成</small><strong>{completedCount}</strong></div>
        <div className="is-attention"><small><TriangleAlert size={13} />需处理</small><strong>{attentionCount}</strong></div>
      </div>
      <div className="reference-library-filters reference-task-filters">
        <div className="management-search"><Search size={14} /><input type="search" placeholder="搜索项目名称…" aria-label="搜索任务项目" value={query} onChange={event => setQuery(event.target.value)} /></div>
        <select aria-label="任务项目" className="reference-library-select task-filter" value={projectId} onChange={event => setProjectId(event.target.value)}><option value="all">全部项目</option>{projects.map(project => <option key={project.projectId} value={project.projectId}>{project.projectName}</option>)}</select>
        <select aria-label="任务状态" className="reference-library-select task-filter" value={status} onChange={event => setStatus(event.target.value)}>{STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <span className="reference-task-sync" role="status"><i className={hasActiveTasks ? "is-live" : ""} />{refreshing ? "正在更新…" : hasActiveTasks ? "自动更新中" : "已同步"}</span>
      </div>
      {error && <div className="upload-feedback" role="alert">{projects.length > 0 ? `自动更新暂时失败，已保留当前任务：${error}` : error}<Button variant="ghost" size="sm" onClick={() => void load()}>重新加载</Button></div>}
      {loading && projects.length === 0 ? <div className="empty-state" role="status">正在加载任务…</div> : visibleProjects.length === 0 ? <div className="empty-state">暂无匹配任务</div> : <div className="task-project-list">{visibleProjects.map(project => <section className="task-project-group" aria-label={`项目 ${project.projectName}`} key={project.projectId}>
        <header className="task-project-header"><div><h2>{project.projectName}</h2><span>{project.projectStatus === "active" ? "进行中" : "已归档"} · 最近更新 {new Date(project.updatedAt).toLocaleString("zh-CN")}</span></div><span>{project.tasks.length} 个任务</span></header>
        <div className="task-list">{project.tasks.map(task => <article className="task-row" key={`${task.type}:${task.id}`}>
          <div className={`reference-task-icon ${task.type}`} aria-hidden="true">{task.type === "hero" ? <Image size={20} /> : <Layers3 size={20} />}</div>
          <div className="task-row-main"><strong>{taskTitle(task)}</strong><span>{new Date(task.updatedAt).toLocaleString("zh-CN")}</span></div>
          <div className={`task-status ${task.status}`}>
            <strong>{isTaskCenterTaskActive(task.status) && <Loader2 size={12} className="spin" />}{taskCenterStatusLabel(task.status)}</strong>
            {task.progress && task.progress.total > 0 && <div className="reference-task-progress" role="progressbar" aria-label={`${taskTitle(task)}进度`} aria-valuemin={0} aria-valuemax={task.progress.total} aria-valuenow={task.progress.succeeded}><i style={{ width: `${Math.max(0, Math.min(100, task.progress.succeeded / task.progress.total * 100))}%` }} /></div>}
            {progressLabel(task) && <span>{progressLabel(task)}</span>}
            {task.progress && task.progress.failed > 0 && <small className="reference-task-failures">失败 {task.progress.failed} 张</small>}
            {task.error && <small className="reference-task-error">{task.error.message}</small>}
          </div>
          <Button variant="secondary" size="sm" onClick={() => openTask(task)}>进入项目<ArrowUpRight size={13} /></Button>
        </article>)}</div>
      </section>)}</div>}
    </main>
  </div>;
}
