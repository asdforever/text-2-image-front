import { useEffect, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { ArrowRight, Clock, Image, ListTodo, RefreshCw, Search } from "lucide-react";
import { projectApi, projectAssetPreviewUrl, taskCenterApi, toWorkbenchProject, type ApiProjectSummary } from "../api/client";
import type { Project } from "../api/contracts";
import { ProjectCreateDialog } from "../components/ProjectCreateDialog";
import { sharedReadCache } from "../lib/read-cache";
import { hasActiveTaskCenterTasks, isTaskCenterTaskActive, taskCenterStatusLabel, type TaskCenterProject } from "../lib/task-center";
import { WorkspaceUiPrototype } from "./WorkspaceUiPrototype";
import { AutoStage } from "./ReferenceHomeStages";

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
          const cover = available
            .filter(asset => asset.kind === "generated" || asset.kind === "white_background")
            .sort((a, b) => Number(b.kind === "generated") - Number(a.kind === "generated")
              || (b.createdAt ?? "").localeCompare(a.createdAt ?? "")
              || b.id.localeCompare(a.id))[0];
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
  const progress = recentTask?.progress;
  const filtered = projects.filter(project => project.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const openProject = (projectId: string, tab: "base" | "hero" | "suite" = "base") => void navigate({ to: "/projects/$projectId", params: { projectId }, search: { tab } });
  const refresh = () => { sharedReadCache.invalidatePrefix("projects:list:"); setReload(value => value + 1); };

  return <div className="app-shell reference-home">
    <main className="reference-home-content">
      <section className="reference-hero" aria-label="图片工作室介绍">
        <div className="reference-hero-features left"><span>智能生成</span><span>高效创作</span><span>专业品质</span></div>
        <span className="reference-hero-line left" aria-hidden="true" />
        <div className="reference-hero-copy"><h1>图片工作室</h1><p>把想法直接变成商品图</p><small>AI 电商图片创作平台</small></div>
        <span className="reference-hero-line right" aria-hidden="true" />
        <div className="reference-hero-features right"><span>白底图</span><span>主图设计</span><span>详情套图</span></div>
      </section>
      <section className="reference-create-modes" aria-label="开始创作">
        <button className="reference-mode-card" type="button" aria-label="商品图创作" onClick={() => setDialogOpen(true)}><AutoStage className="reference-mode-stage" /><div className="reference-mode-shade" /><div className="reference-stage-info"><div><strong>商品图创作</strong><small>从一张产品图开始，快速生成电商素材</small></div><span><i className="reference-stage-bar" />进入</span></div></button>
        <section className="reference-mode-card reference-next-card" aria-label="下一步推荐">
          <span className="reference-next-label">下一步推荐</span>
          {recent ? <>
            <h2>继续处理「{recent.name}」</h2>
            <p>{recentTask
              ? `${recentTask.type === "suite" ? "详情套图" : "主图生成"} · ${taskCenterStatusLabel(recentTask.status)}，进入项目查看结果与下一步操作。`
              : "从商品素材开始，继续完善白底图、主图与详情套图。"}</p>
            {progress && progress.total > 0 ? <div className="reference-next-progress">
              <div role="progressbar" aria-label="图片完成进度" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.succeeded}>
                <i style={{ width: `${Math.min(100, Math.max(0, progress.succeeded / progress.total * 100))}%` }} />
              </div>
              <small>{progress.succeeded} / {progress.total} 张已完成</small>
            </div> : <small className="reference-next-meta">{recent.assetCount ?? 0} 张图片 · 最近更新 {new Date(recent.updatedAt).toLocaleDateString("zh-CN")}</small>}
            <button className="reference-next-action" onClick={() => openProject(recent.id, recentTask?.workbenchTab)}>进入项目<ArrowRight size={16} /></button>
          </> : loading ? <p role="status">正在加载最近项目…</p> : error ? <>
            <h2>暂时无法读取项目</h2><p>重新加载后，继续你的创作。</p>
            <button className="reference-next-action" onClick={refresh}>重新加载<RefreshCw size={16} /></button>
          </> : <>
            <h2>开启你的第一个商品项目</h2><p>上传商品图片，制作白底图、主图和详情套图。</p>
            <button className="reference-next-action" onClick={() => setDialogOpen(true)}>创建项目<ArrowRight size={16} /></button>
          </>}
        </section>
      </section>
      <section className="reference-recent" aria-label="最近项目">
        <div className="reference-section-head"><h2><Clock size={16} />最近项目</h2><div><label><Search size={14} /><input type="search" aria-label="搜索项目" placeholder="搜索项目" value={query} onChange={event => setQuery(event.target.value)} /></label><button type="button" onClick={refresh} disabled={loading} aria-label="刷新项目"><RefreshCw size={14} /></button><button className="reference-view-more" onClick={() => void navigate({ to: "/projects" })}>查看更多<ArrowRight size={14} /></button></div></div>
        {error && <p className="reference-error" role="alert">{error}</p>}
        {loading && projects.length === 0 ? <p className="reference-empty" role="status">正在加载项目…</p> : filtered.length === 0 ? <p className="reference-empty">{query ? "没有匹配的项目" : "还没有项目，点击上方入口创建第一个商品项目"}</p> : <div className="reference-project-grid">{filtered.slice(0, 6).map(project => { const coverUrl = project.coverAssetId ? projectAssetPreviewUrl(project.id, project.coverAssetId) : null; return <button className="reference-project-card" key={project.id} onClick={() => openProject(project.id)}><div className="reference-project-thumb project-thumb">{coverUrl ? <img src={coverUrl} alt="" loading="lazy" /> : <Image size={23} />}</div><div><strong>{project.name}</strong><small>{project.assetCount ?? 0} 张图片 · {new Date(project.updatedAt).toLocaleDateString("zh-CN")}</small></div><ArrowRight size={15} /></button>; })}</div>}
      </section>
      <section className="reference-activity" aria-label="任务动态"><div className="reference-section-head"><h2><ListTodo size={16} />最近动态</h2><span>{tasks.length ? `${tasks.length} 个任务` : "暂无生成任务"}</span></div>{tasksError ? <p className="reference-empty">任务动态暂时不可用</p> : tasksLoading ? <p className="reference-empty">正在加载任务动态…</p> : tasks.length === 0 ? <p className="reference-empty">开始生成后，这里会显示图片处理进度</p> : <div className="reference-task-list">{tasks.slice(0, 4).map(task => <button key={task.id} onClick={() => openProject(task.projectId, task.workbenchTab)}><i className={isTaskCenterTaskActive(task.status) ? "active" : ""} /><span><b>{task.projectName}</b><small>{task.type === "suite" ? "详情套图" : "主图生成"} · {taskCenterStatusLabel(task.status)}</small></span><em>{task.progress ? `${task.progress.succeeded}/${task.progress.total}` : "查看"}</em></button>)}</div>}</section>
    </main>
    <ProjectCreateDialog open={dialogOpen} onOpenChange={setDialogOpen} onCreated={refresh} />
  </div>;
}
