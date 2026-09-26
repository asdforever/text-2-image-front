import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowUpRight, Plus, RefreshCw, Search } from "lucide-react";
import { reverseProjectsApi, type ReverseProject } from "../api/reverse-projects";
import { Button } from "../components/ui/button";
import { ProjectEditDialog } from "../features/reverse-projects/ProjectEditDialog";
import { EmptyReverse, errorMessage, ProjectStatus, ReferenceCover, ReverseError, ReverseShell } from "../features/reverse-projects/shared";

export function ReverseProjectsPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ReverseProject[]>([]);
  const [query, setQuery] = useState(""); const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const [create, setCreate] = useState(false); const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError("");
    reverseProjectsApi.list(controller.signal).then(setProjects).catch(e => { if (!controller.signal.aborted) setError(errorMessage(e)); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [reload]);
  const visible = useMemo(() => projects.filter(p => (filter === "all" || (filter === "published" ? !!p.latestVersionId : !p.latestVersionId)) && [p.name, p.category, p.summary, p.suitableFor].join(" ").toLowerCase().includes(query.trim().toLowerCase())), [projects, query, filter]);
  return <ReverseShell title="把好的图片表达，沉淀成可复用的设计方法"><div className="rp-page-head"><div><h1>反推项目</h1><p>从一整套爆品图中，提炼整体策略与模块细节。</p></div><Button onClick={() => setCreate(true)}><Plus size={16} />新建反推项目</Button></div>
    <div className="rp-toolbar"><div className="rp-filters" aria-label="反推项目筛选">{[["all", "全部项目"], ["published", "已发布"], ["draft", "草稿"]].map(([value, label]) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</div><label className="rp-search"><Search size={16} /><input aria-label="搜索反推项目" placeholder="搜索名称、品类或适用商品" value={query} onChange={e => setQuery(e.target.value)} /></label><Button variant="ghost" size="icon" title="刷新项目" aria-label="刷新反推项目" disabled={loading} onClick={() => setReload(value => value + 1)}><RefreshCw size={16} /></Button></div>
    <ReverseError error={error} retry={() => setReload(value => value + 1)} />
    {loading && !projects.length ? <div className="rp-skeleton" role="status" aria-label="正在加载反推项目">{[1, 2, 3].map(i => <div key={i} />)}</div> : visible.length ? <div className="rp-project-grid">{visible.map(p => <Link className="rp-project-card" key={p.id} to="/reverse-projects/$reverseProjectId" params={{ reverseProjectId: p.id }} search={{ tab: "references" }}><ReferenceCover images={p.references} /><div className="rp-project-card-body"><div className="rp-card-meta"><span>{p.category || "未分类"}</span><ProjectStatus project={p} /></div><h2>{p.name}</h2><p>{p.summary || "上传套图，记录值得复用的设计方法。"}</p><footer><span>{p.references.length} 张参考图 · {p.modules.length} 个模块</span><span className="rp-card-open">查看反推项目<ArrowUpRight size={15} /></span></footer></div></Link>)}</div> : !error && <EmptyReverse title={projects.length ? "没有匹配的反推项目" : "把第一套参考图沉淀下来"} description={projects.length ? "试试其他关键词，或切换项目筛选。" : "上传一套主图、详情图或完整长图，分析后发布，供业务项目引用。"} action={!projects.length && <Button onClick={() => setCreate(true)}>新建反推项目</Button>} />}
    <div className="rp-list-note"><strong>一个项目，一套设计方法</strong><span>规划大师学习整体，模块规划器学习细节；发布的版本可以绑定到主图或详情套图。</span></div>
    {create && <ProjectEditDialog onClose={() => setCreate(false)} onSaved={p => { setCreate(false); void navigate({ to: "/reverse-projects/$reverseProjectId", params: { reverseProjectId: p.id }, search: { tab: "references" } }); }} />}
  </ReverseShell>;
}
