import { useEffect, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { ArrowRight, Image, Plus, RefreshCw, Search } from "lucide-react";
import { projectApi, projectAssetPreviewUrl, taskCenterApi, toWorkbenchProject, type ApiProjectSummary } from "../api/client";
import type { Project } from "../api/contracts";
import { Button } from "../components/ui/button";
import { ProjectCreateDialog } from "../components/ProjectCreateDialog";
import { sharedReadCache } from "../lib/read-cache";
import { hasActiveTaskCenterTasks, isTaskCenterTaskActive, taskCenterStatusLabel, type TaskCenterProject } from "../lib/task-center";
import { WorkspaceUiPrototype } from "./WorkspaceUiPrototype";
import "./workflow-home.css";

export function WelcomePage() {
  const navigate = useNavigate();
  const { variant } = useSearch({ from: "/workspace" });
  const [projects, setProjects] = useState<ApiProjectSummary[]>([]);
  const [prototypeProjects, setPrototypeProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [reload, setReload] = useState(0);
  const [taskProjects, setTaskProjects] = useState<TaskCenterProject[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [tasksError, setTasksError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true); setError("");
      try {
        const listed = await projectApi.list();
        // Support a frontend hot update while an older API process is still running.
        const summaries = await Promise.all(listed.map(async project => {
          if (typeof project.assetCount === "number") return project;
          const detail = await projectApi.get(project.id, { force: reload > 0 });
          const assets = detail.assets.filter(asset => asset.state !== "deleted");
          const available = assets.filter(asset => asset.state === "available");
          const cover = available.find(asset => asset.kind === "source") ?? available[0];
          return { ...project, assetCount: assets.length, coverAssetId: cover?.id ?? null };
        }));
        if (cancelled) return;
        setProjects([...summaries].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
        // Only the developer prototype needs full asset lists before opening a project.
        if (import.meta.env.DEV && variant) {
          const details = await Promise.all(summaries.map(project => projectApi.get(project.id, { force: reload > 0 })));
          if (!cancelled) setPrototypeProjects(details.map(toWorkbenchProject));
        }
      } catch (nextError) {
        if (!cancelled) setError(nextError instanceof Error ? nextError.message : "最近项目加载失败");
      } finally { if (!cancelled) setLoading(false); }
    };
    void load();
    return () => { cancelled = true; };
  }, [reload, variant]);

  useEffect(() => {
    let cancelled = false, inFlight = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      if (cancelled || inFlight) return;
      clearTimeout(timer); inFlight = true;
      let pollAgain = false;
      try {
        const result = await taskCenterApi.list();
        if (!cancelled) { setTaskProjects(result.projects); setTasksError(""); pollAgain = hasActiveTaskCenterTasks(result.projects); }
      } catch (nextError) {
        if (!cancelled) setTasksError(nextError instanceof Error ? nextError.message : "任务动态暂时不可用");
        pollAgain = true;
      } finally {
        inFlight = false;
        if (!cancelled) { setTasksLoading(false); if (pollAgain) timer = setTimeout(() => { if (!document.hidden) void load(); }, 5000); }
      }
    };
    const resume = () => { if (!document.hidden) void load(); };
    void load(); window.addEventListener("focus", resume); document.addEventListener("visibilitychange", resume);
    return () => { cancelled = true; clearTimeout(timer); window.removeEventListener("focus", resume); document.removeEventListener("visibilitychange", resume); };
  }, []);

  if (import.meta.env.DEV && variant) return <WorkspaceUiPrototype variant={variant} projects={prototypeProjects} />;
  const tasks = taskProjects.flatMap(project => project.tasks).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const recent = projects[0];
  const recentTask = recent ? tasks.find(task => task.projectId === recent.id) : undefined;
  const filtered = projects.filter(project => project.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const openProject = (projectId: string, tab: "base" | "hero" | "suite" = "base") => void navigate({ to: "/projects/$projectId", params: { projectId }, search: { tab } });
  const refresh = () => { sharedReadCache.invalidatePrefix("projects:list:"); setReload(value => value + 1); };

  return <div className="app-shell workflow-home">
    <header className="app-topbar"><span className="studio-breadcrumb">个人工作区 / 工作台</span><span className="topbar-meta">{projects.length} 个项目</span></header>
    <main className="workflow-home-content">
      <section className="workflow-home-heading"><div><h1>今天继续做什么？</h1><p>把需要判断的事情放在前面，把等待交给系统。</p></div><Button onClick={() => setDialogOpen(true)}><Plus size={16} />新建项目</Button></section>
      <div className="workflow-dashboard">
        <section className="workflow-next" aria-label="继续处理">
          {recent ? <><span className="workflow-next-label">下一步推荐</span><h2>继续处理「{recent.name}」</h2><p>{recentTask ? `${recentTask.type === "suite" ? "详情套图" : "主图生成"} · ${taskCenterStatusLabel(recentTask.status)}，进入项目查看结果与下一步操作。` : "从商品素材开始，继续完善白底图、主图与详情套图。"}</p>
            {recentTask?.progress && recentTask.progress.total > 0 ? <><div className="workflow-progress" role="progressbar" aria-label="图片完成进度" aria-valuenow={recentTask.progress.succeeded} aria-valuemin={0} aria-valuemax={recentTask.progress.total}><i style={{ width: `${Math.min(100, Math.max(0, recentTask.progress.succeeded / recentTask.progress.total * 100))}%` }} /></div><small>{recentTask.progress.succeeded} / {recentTask.progress.total} 张已完成</small></> : <small>{recent.assetCount ?? 0} 张图片 · 最近更新 {new Date(recent.updatedAt).toLocaleDateString("zh-CN")}</small>}
            <Button className="workflow-continue" onClick={() => openProject(recent.id, recentTask?.workbenchTab)}>进入项目<ArrowRight size={16} /></Button></> : loading ? <div role="status">正在加载最近项目…</div> : error ? <><h2>暂时无法读取项目</h2><p>重新加载后，继续你的创作。</p><Button className="workflow-continue" onClick={refresh}>重新加载</Button></> : <><span className="workflow-next-label">从一张商品图开始</span><h2>开启你的第一个商品项目</h2><p>上传商品图片，进入工作台制作白底图、主图和详情套图。</p><Button className="workflow-continue" onClick={() => setDialogOpen(true)}>上传商品图<Plus size={16} /></Button></>}
        </section>
        <section className="workflow-activity" aria-label="最近任务动态"><h2>正在发生</h2>
          {tasksError && <p className="workflow-inline-error" role="status">任务动态暂时不可用，项目仍可继续使用。</p>}
          {tasksLoading ? <p className="workflow-muted" role="status">正在加载任务动态…</p> : tasks.length === 0 ? <div className="workflow-no-tasks"><span className="workflow-status-dot" /><p>{tasksError ? "稍后会自动重新连接" : "目前没有生成任务"}<small>开始生成后，可在这里查看进度。</small></p></div> : tasks.slice(0, 3).map(task => <button key={task.id} className="workflow-activity-row" onClick={() => openProject(task.projectId, task.workbenchTab)}><i className={`workflow-status-dot ${isTaskCenterTaskActive(task.status) ? "active" : ["failed", "partially_failed", "needs_retry"].includes(task.status) ? "failed" : ""}`} /><span><b>{task.projectName}</b><small>{task.type === "suite" ? "详情套图" : "主图生成"} · {taskCenterStatusLabel(task.status)}</small></span><small>{task.progress ? `${task.progress.succeeded} / ${task.progress.total}` : "查看"}</small></button>)}
        </section>
      </div>
      <section className="workflow-recent" aria-label="最近项目"><div className="workflow-section-heading"><h2>最近项目</h2><div className="workflow-project-tools"><label><Search size={15} /><input type="search" aria-label="搜索项目" placeholder="搜索项目" value={query} onChange={event => setQuery(event.target.value)} /></label><Button variant="ghost" size="icon" title="刷新项目" aria-label="刷新项目" disabled={loading} onClick={refresh}><RefreshCw size={15} /></Button></div></div>
        {error && <div className="workflow-inline-error" role="alert">{error}<button onClick={refresh}>重新加载</button></div>}
        {loading && projects.length === 0 ? <div className="workflow-empty" role="status">正在加载最近项目…</div> : filtered.length === 0 ? <div className="workflow-empty">{query ? "没有匹配的项目" : "创建项目后，你的商品与图片会保存在这里。"}</div> : <div className="workflow-project-grid">{filtered.map(project => {
          const coverUrl = project.coverAssetId ? projectAssetPreviewUrl(project.id, project.coverAssetId) : null;
          return <button className="workflow-project-card" key={project.id} onClick={() => openProject(project.id)}><div className="project-thumb">{coverUrl ? <img src={coverUrl} alt="" loading="lazy" /> : <Image size={28} strokeWidth={1} />}</div><div className="workflow-project-body"><h3>{project.name}</h3><p>{project.assetCount ?? 0} 张图片 · {new Date(project.updatedAt).toLocaleDateString("zh-CN")}</p><span>继续处理</span></div><ArrowRight size={16} /></button>;
        })}</div>}
      </section>
    </main>
    <ProjectCreateDialog open={dialogOpen} onOpenChange={setDialogOpen} onCreated={refresh} />
  </div>;
}
