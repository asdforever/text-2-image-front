import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { ChevronLeft, PanelRight, CheckSquare, Trash2, X } from "lucide-react";
import { Group, Panel, Separator } from "react-resizable-panels";
import type { Asset, OutputTarget } from "../api/contracts";
import { projectApi, toWorkbenchProject, type ApiProjectDetail } from "../api/client";
import { useProjectStore } from "../store/useProjectStore";
import { AssetLibraryPanel } from "../components/AssetLibraryPanel";
import { HistoryVersionPanel } from "../components/HistoryVersionPanel";
import { Button } from "../components/ui/button";
import { BaseImageWorkspace } from "./BaseImageWorkspace";
import { HeroImageWorkspace } from "./HeroImageWorkspace";
import { SuiteWorkspace } from "./SuiteWorkspace";
import { ProjectReverseWorkspace } from "./ProjectReverseWorkspace";
import "./reference-workspaces.css";
import "./reference-generation.css";
const EmbeddedBoard = lazy(() => import("./BoardPage").then(module => ({ default: module.BoardPage })));

type ImageTab = Exclude<OutputTarget, "video"> | "canvas" | "reverse";

const TAB_LABELS: Record<ImageTab, string> = {
  base: "白底图",
  hero: "主图",
  suite: "详情套图",
  reverse: "项目反推",
  canvas: "画布",
};

export function ProjectWorkbench() {
  const { projectId } = useParams({ from: "/projects/$projectId" });
  return <ProjectWorkbenchContent key={projectId} />;
}

function ProjectWorkbenchContent() {
  const { projectId } = useParams({ from: "/projects/$projectId" });
  const search = useSearch({ from: "/projects/$projectId" });
  const navigate = useNavigate({ from: "/projects/$projectId" });
  const selectedAssetId = useProjectStore((state) => state.selectedAssetId);
  const setSelectedAsset = useProjectStore((state) => state.setSelectedAsset);
  const [projectDetail, setProjectDetail] = useState<ApiProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [panelTab, setPanelTab] = useState<"assets" | "history">("assets");
  const [panelOpen, setPanelOpen] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const activeTab: ImageTab = search.tab === "hero" || search.tab === "suite" || search.tab === "reverse" || search.tab === "canvas" ? search.tab : "base";
  const [visited, setVisited] = useState<ImageTab[]>([activeTab]);
  const project = useMemo(() => projectDetail ? toWorkbenchProject(projectDetail) : null, [projectDetail]);
  const selectedAsset = useMemo(() => project?.assets.find((asset) => asset.id === selectedAssetId), [project, selectedAssetId]);
  const loadProject = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try { setProjectDetail(await projectApi.get(projectId)); }
    catch (nextError) { setLoadError(nextError instanceof Error ? nextError.message : "项目加载失败"); setProjectDetail(null); }
    finally { setLoading(false); }
  }, [projectId]);
  const refreshProject = useCallback(async () => {
    try { setProjectDetail(await projectApi.get(projectId, { force: true })); }
    catch (nextError) { setToast(nextError instanceof Error ? nextError.message : "项目刷新失败"); }
  }, [projectId]);
  const refreshBaseProject = useCallback(async () => {
    setProjectDetail(await projectApi.get(projectId, { force: true }));
  }, [projectId]);

  useEffect(() => { setVisited(current => current.includes(activeTab) ? current : [...current, activeTab]); }, [activeTab]);
  useEffect(() => { void loadProject(); }, [loadProject]);
  useEffect(() => {
    if (activeTab !== "base") setPanelOpen(false);
  }, [activeTab]);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(null), 2400); return () => window.clearTimeout(timer); }, [toast]);
  useHotkeys("ctrl+tab", (event) => { event.preventDefault(); const tabs: ImageTab[] = ["base", "hero", "suite", "reverse", "canvas"]; void navigate({ search: { tab: tabs[(tabs.indexOf(activeTab) + 1) % tabs.length] } }); });
  useHotkeys("escape", () => setSelectionMode(false));

  if (loading) return <div className="app-shell"><main className="page-loading" role="status"><span>正在加载项目...</span></main></div>;
  if (!project || !projectDetail) return <div className="app-shell"><main className="page-loading"><div><p>{loadError || "项目不存在"}</p><Button variant="secondary" onClick={() => void navigate({ to: "/" })}>返回项目管理</Button></div></main></div>;
  const changeTab = (tab: ImageTab) => void navigate({ search: { tab } });
  const inspectAsset = (asset: Asset) => { setSelectedAsset(asset.id); setPanelTab("history"); setPanelOpen(true); };
  const locate = (asset: Asset, tab: OutputTarget) => { inspectAsset(asset); void navigate({ search: { tab } }); setToast(`已定位 ${asset.name}`); };
  const onClearData = async () => {
    if (!window.confirm("确认永久删除这个项目及其项目素材吗？")) return;
    try { await projectApi.remove(project.id); setToast("项目已删除"); void navigate({ to: "/" }); }
    catch (nextError) { setToast(nextError instanceof Error ? nextError.message : "删除项目失败"); }
  };
  const generateSelected = async () => {
    setToast("请在详情套图工作台中确认规划后重新生成");
  };
  const renderWorkspace = (tab: ImageTab) => tab === "base"
    ? <BaseImageWorkspace key={project.id + ":base"} project={project} projectDetail={projectDetail} onRefresh={refreshBaseProject} selectionMode={selectionMode} selectedIds={selectedIds} onSelectedIdsChange={setSelectedIds} onSelectAsset={inspectAsset} onToast={setToast} focusAssetId={selectedAssetId} />
    : tab === "hero"
      ? <HeroImageWorkspace key={project.id + ":hero"} project={project} selectionMode={selectionMode} selectedIds={selectedIds} onSelectedIdsChange={setSelectedIds} onSelectAsset={inspectAsset} onToast={setToast} onRefresh={refreshProject} focusAssetId={selectedAssetId} />
      : tab === "reverse" ? <ProjectReverseWorkspace key={project.id + ":reverse"} project={project} projectDetail={projectDetail} onRefresh={refreshProject} onToast={setToast} />
      : tab === "canvas" ? <EmbeddedBoard suiteId={project.id} active={activeTab === "canvas"} embedded navigate={() => changeTab("suite")} />
      : <SuiteWorkspace key={project.id + ":suite"} project={project} onToast={setToast} onSelectAsset={inspectAsset} onRefresh={refreshProject} />;

  return (
    <div className={`app-shell studio-workbench c-workbench ${activeTab === "canvas" ? "reference-canvas-workbench" : "reference-project-workbench"}`}>
      <header className="app-topbar">
        <span className="studio-breadcrumb">个人工作区 / {project.name}</span>
        <div className="topbar-meta"><span>个人工作区</span><Button variant="ghost" size="icon" title="删除项目" aria-label="删除项目" onClick={() => void onClearData()}><Trash2 size={15} /></Button></div>
      </header>
      <div className="workbench">
        <div className="workspace-shell">
          <section className="c-project-heading">
            <div><Button variant="ghost" size="sm" onClick={() => void navigate({ to: "/workspace", search: { variant: undefined } })}><ChevronLeft size={14} />返回工作台</Button><h1>{project.name}</h1><p>商品素材、生成结果与编排，都在这个项目里。</p></div>
            <Button variant="secondary" aria-expanded={panelOpen} onClick={() => setPanelOpen(value => !value)}><PanelRight size={16} />素材与历史</Button>
          </section>
          <div className="workspace-header">
            {activeTab === "canvas" && <div className="reference-canvas-project"><Button variant="ghost" size="sm" aria-label="返回工作台" onClick={() => void navigate({ to: "/workspace", search: { variant: undefined } })}><ChevronLeft size={16} /></Button><strong title={project.name}>{project.name}</strong></div>}
            <nav className="workspace-tabs" aria-label="输出类型">
              {(Object.keys(TAB_LABELS) as ImageTab[]).map((tab) => (
                <button key={tab} className={["workspace-tab", activeTab === tab ? "active" : ""].filter(Boolean).join(" ")} aria-pressed={activeTab === tab} onClick={() => changeTab(tab)}>
                  {TAB_LABELS[tab]}
                </button>
              ))}

            </nav>
            <div id={`canvas-actions-${project.id}`} className="reference-canvas-actions" hidden={activeTab !== "canvas"} />
            <div className="topbar-meta" hidden={activeTab === "canvas"}>
              {activeTab === "base" && <Button variant="ghost" size="icon" title="批量选择" aria-label="批量选择" aria-pressed={selectionMode} onClick={() => setSelectionMode((value) => !value)}><CheckSquare size={16} /></Button>}
              <Button variant="ghost" size="icon" title={panelOpen ? "收起素材面板" : "展开素材面板"} onClick={() => setPanelOpen((value) => !value)}>
                <PanelRight size={15} />
              </Button>
            </div>
          </div>
          <div className="workspace-content">
            <Group orientation="horizontal" className="resizable-workspace" defaultLayout={{ center: 76, right: 24 }}>
              <Panel id="center" defaultSize="76" minSize="50">
                {Array.from(new Set([...visited, activeTab])).map(tab => <div className="workspace-tab-content" key={tab} hidden={tab !== activeTab}>
                  <Suspense fallback={<div className="page-loading" role="status">正在打开{TAB_LABELS[tab]}…</div>}>{renderWorkspace(tab)}</Suspense>
                </div>)}
              </Panel>
              {panelOpen && activeTab !== "canvas" && <><Separator className="resizer" /><Panel id="right" className="studio-asset-panel" defaultSize="24" minSize="15" maxSize="34" collapsible collapsedSize={0}><aside className="right-panel" aria-label="素材与历史"><div className="panel-tabs"><button className={`panel-tab ${panelTab === "assets" ? "active" : ""}`} aria-pressed={panelTab === "assets"} onClick={() => setPanelTab("assets")}>项目素材</button><button className={`panel-tab ${panelTab === "history" ? "active" : ""}`} aria-pressed={panelTab === "history"} onClick={() => setPanelTab("history")}>版本记录</button><Button variant="ghost" size="icon" aria-label="关闭素材面板" title="关闭素材面板" onClick={() => setPanelOpen(false)}><X size={15} /></Button></div><div className="panel-body">{panelTab === "assets" ? <AssetLibraryPanel project={project} selectedAssetId={selectedAssetId} onLocate={locate} /> : <HistoryVersionPanel asset={selectedAsset} onGenerate={generateSelected} />}</div></aside></Panel></>}
            </Group>
          </div>
        </div>
      </div>
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
