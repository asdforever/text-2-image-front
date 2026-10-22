import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { applyNodeChanges, Background, MarkerType, ReactFlow, ReactFlowProvider, SelectionMode, useReactFlow, type Connection, type FinalConnectionState, type NodeProps, type OnNodesChange, type Viewport } from "@xyflow/react";
import { ArrowLeft, Check, ChevronDown, Download, Expand, FolderPlus, GitBranch, ImagePlus, Images, LayoutGrid, Loader2, Maximize2, Minimize2, Minus, Plus, RotateCcw, Search, SlidersHorizontal, Sparkles, SplitSquareHorizontal, X } from "lucide-react";
import JSZip from "jszip";
import { createPortal } from "react-dom";
import { createIdempotencyKey, projectApi, suiteApi, type ApiProjectAsset, type ApiSuiteTask, type ApiTaskVersion, type ApiWorkbench } from "../../api/client";
import { arrangeResultGrid, isResultImage, resultViewNodes } from "./result-view";
import { CanvasPorts } from "./CanvasPorts";
import { connectionProblem, readConnections, serializeConnections, type CanvasConnection } from "./connections";
import { ImageEditorModal } from "./ImageEditorModal";
import { CanvasCompare } from "./CanvasCompare";
import { CanvasInspector } from "./CanvasInspector";
import { arrangeGraph, canvasGraph, canvasImages, categoryNames, imagePrompt, restoreCanvas, serializeCanvas, type CanvasImage, type CanvasNode, type GenerationStep, type ImageCategory } from "./model";
import { GenerationDetails, GenerationNode } from "./GenerationNode";
import { CanvasRegenerateDialog } from "./CanvasRegenerateDialog";
import { ALL_BATCHES, ALL_MODULES, filterCanvasByBatch, imageBatchIndex, matchesCanvasImageBatch } from "./image-batches";
import { ImageBatchFilter, ImageModuleFilter } from "./ImageBatchFilter";
import { resolveImageFilters } from "./linked-image-filters";
import { LongImageComposer } from "./LongImageComposer";
import "@xyflow/react/dist/style.css";
import "./canvas.css";
import "./reference-canvas.css";

function PictureNode({ id, data, selected }: NodeProps<CanvasNode>) {
  const image = data.image!;
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [image.url]);
  const versionUrls = image.versions.map((version) => version.previewUrl).filter(Boolean).join("\n");
  useEffect(() => {
    // 浏览历史版本时直接命中浏览器缓存，避免每次切换再开始下载。
    for (const url of versionUrls.split("\n").filter(Boolean)) { const preview = new Image(); preview.src = url; }
  }, [versionUrls]);
  const running = ["generating", "pending"].includes(image.task?.status ?? "");
  return <article className={`ic-image-node ${selected ? "is-selected" : ""}`}>
    <CanvasPorts id={id} data={data} />
    <div className="ic-node-picture" style={{ aspectRatio: `${Math.max(0.62, Math.min(1.6, image.width / Math.max(image.height, 1)))}` }}>
      {image.url && !failed ? <img src={image.url} alt={image.title} draggable={false} onError={() => setFailed(true)} /> : <div className="ic-image-empty">{running ? <Loader2 className="ic-spin" size={28} /> : <Images size={28} />}<span>{failed ? "图片暂时无法加载" : running ? "正在生成图片" : "尚未生成图片"}</span></div>}
      {image.version?.isFinal && <span className="ic-final"><Check size={11} />终版</span>}
      {selected && <span className="ic-selected-mark"><Check size={12} /></span>}
    </div>
    <footer><h3 title={image.title}>{image.title}</h3><span>{running ? "生成中" : image.task?.status === "failed" ? "生成失败" : categoryNames[image.category]}{image.version ? ` · v${image.version.versionNumber}` : ""}</span>{image.canvasVersion && <div className="nodrag nopan" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}><select className="ic-picture-versions" aria-label="图片版本" value={image.version?.id ?? ""} onChange={(e) => data.selectImageVersion?.(image, e.target.value)}>{image.versions.map((v) => <option key={v.id} value={v.id}>V{v.versionNumber}{v.isCurrent ? " · 当前" : ""}</option>)}</select><small className="ic-version-save-status" aria-live="polite">{data.versionSaving ? "保存版本中…" : ""}</small></div>}</footer>
  </article>;
}
function GroupNode({ data }: NodeProps<CanvasNode>) { return <div className="ic-group-node"><div className="ic-group-heading"><LayoutGrid size={14} /><strong>{data.title}</strong></div></div>; }
const nodeTypes = { image: PictureNode, imageGroup: GroupNode, generation: GenerationNode };
const initialViewport = { x: 0, y: 0, zoom: 1 };
const messageOf = (error: unknown) => error instanceof Error ? error.message : "操作未完成，请重试";

export function CanvasStudio({ suiteId, navigate, embedded = false, active = true }: { suiteId: string; embedded?: boolean; active?: boolean; navigate: (to: string) => void }) {
  return <ReactFlowProvider><CanvasStudioInner key={suiteId} suiteId={suiteId} navigate={navigate} embedded={embedded} active={active} /></ReactFlowProvider>;
}

function CanvasStudioInner({ suiteId, navigate, embedded, active }: { suiteId: string; embedded: boolean; active: boolean; navigate: (to: string) => void }) {
  const [workbench, setWorkbench] = useState<ApiWorkbench | null>(null);
  const [images, setImages] = useState<CanvasImage[]>([]);
  const [nodes, setNodes] = useState<CanvasNode[]>([]);
  const nodesRef = useRef<CanvasNode[]>([]);
  const [connections, setConnections] = useState<CanvasConnection[]>([]);
  const connectionsRef = useRef<CanvasConnection[]>([]);
  const [selectedConnection, setSelectedConnection] = useState("");
  const [loadError, setLoadError] = useState("");
  const [assetError, setAssetError] = useState("");
  const assetsRef = useRef<ApiProjectAsset[]>([]);
  const [saveState, setSaveState] = useState("已保存");
  const [recoverSave, setRecoverSave] = useState(false);
  const [toast, setToast] = useState("");
  const [leftOpen, setLeftOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [query, setQuery] = useState("");
  const [storedBatchSelection, setBatchSelection] = useState(() => {
    try { return localStorage.getItem(`canvas-batch:${suiteId}`) ?? ALL_BATCHES; } catch { return ALL_BATCHES; }
  });
  const [storedModuleSelection, setModuleSelection] = useState(() => {
    try { return localStorage.getItem(`canvas-module:${suiteId}`) ?? ALL_MODULES; } catch { return ALL_MODULES; }
  });
  const [viewMode, setViewMode] = useState<"lineage" | "results">(() => {
    try { return localStorage.getItem(`canvas-view:${suiteId}`) === "results" ? "results" : "lineage"; } catch { return "lineage"; }
  });
  const changeView = (value: "lineage" | "results") => {
    setViewMode(value);
    try { localStorage.setItem(`canvas-view:${suiteId}`, value); } catch { /* The current view still works without storage. */ }
  };
  const batchFitRequested = useRef(false);
  const [category, setCategory] = useState<ImageCategory | "all">("all");
  const [zoom, setZoom] = useState(1);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<CanvasImage[] | null>(null);
  const [stepDetails, setStepDetails] = useState<GenerationStep | null>(null);
  const [regenerateStep, setRegenerateStep] = useState<GenerationStep | null>(null);
  const [groupDialog, setGroupDialog] = useState(false);
  const [longImageOpen, setLongImageOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [groupTitle, setGroupTitle] = useState("候选方案");
  const [confirmGeneration, setConfirmGeneration] = useState<CanvasImage | null>(null);
  const [editor, setEditor] = useState<{ task: ApiSuiteTask; version: ApiTaskVersion } | null>(null);
  const [versionChoices, setVersionChoices] = useState<Record<string, string>>({});
  const loaded = useRef(false);
  const versionRef = useRef(0);
  const viewportRef = useRef<Viewport>(initialViewport);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const lastSave = useRef(0);
  const suppressViewportSave = useRef(false);
  const viewportEpoch = useRef(0);
  const rightPan = useRef<{ pointerId: number; x: number; y: number; viewport: Viewport } | null>(null);
  const loadSequence = useRef(0);
  const pendingRead = useRef<Promise<[PromiseSettledResult<ApiWorkbench>, PromiseSettledResult<ApiProjectAsset[]>]> | null>(null);
  const confirmedWorkbench = useRef<ApiWorkbench | null>(null);
  const pendingVersions = useRef(new Map<string, { stepId: string; outputIndex: number; assetId: string }>());
  const versionQueue = useRef<Promise<void>>(Promise.resolve());
  const { fitView, setViewport, getViewport, screenToFlowPosition, zoomIn, zoomOut } = useReactFlow<CanvasNode>();
  const notify = useCallback((message: string) => setToast(message), []);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(""), 4500); return () => window.clearTimeout(timer); }, [toast]);
  useEffect(() => { const media = window.matchMedia("(max-width: 760px)"); const resize = () => { if (media.matches) { setLeftOpen(false); setInspectorOpen(false); } }; media.addEventListener("change", resize); return () => media.removeEventListener("change", resize); }, []);
  useEffect(() => {
    if (!fullscreen) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setFullscreen(false); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [fullscreen]);
  const commitNodes = useCallback((next: CanvasNode[]) => { nodesRef.current = next; setNodes(next); }, []);
  const persist = useCallback((next = nodesRef.current, viewport = viewportRef.current) => {
    const serialized = serializeCanvas(next);
    const snapshot = { ...serialized, nodes: serializeConnections(serialized.nodes, connectionsRef.current) };
    const request = ++lastSave.current;
    setSaveState("保存中…");
    queue.current = queue.current.catch(() => undefined).then(async () => {
      try {
        const saved = await suiteApi.saveLayout(suiteId, { ...snapshot, viewport, layoutVersion: versionRef.current });
        versionRef.current = saved.layoutVersion;
        if (request === lastSave.current) setSaveState("已保存");
      } catch (error) { setSaveState("保存失败"); notify(`布局未保存：${messageOf(error)}`); throw error; }
    });
    void queue.current.catch(() => undefined);
    return queue.current;
  }, [notify, suiteId]);
  // 程序调整视野后显式保存；XYFlow 延迟发出的无来源事件不再重复触发保存。
  const changeViewport = (action: () => Promise<boolean>, delay = 0) => {
    const epoch = viewportEpoch.current;
    const apply = async () => {
      if (epoch !== viewportEpoch.current) return;
      await action();
      if (epoch !== viewportEpoch.current || suppressViewportSave.current) return;
      viewportRef.current = getViewport();
      await persist();
    };
    if (delay) window.setTimeout(() => void apply().catch(() => undefined), delay);
    else void apply().catch(() => undefined);
  };
  const startRightPan = (event: ReactPointerEvent<HTMLElement>) => {
    // 可拖动节点带有 nopan，右键从节点出发时在捕获阶段接管，左键仍交给 XYFlow。
    if (event.button !== 2 || !(event.target instanceof Element) || !event.target.closest(".react-flow__node, .react-flow__nodesselection")) return;
    event.preventDefault(); event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    rightPan.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, viewport: getViewport() };
  };
  const moveRightPan = (event: ReactPointerEvent<HTMLElement>) => {
    const pan = rightPan.current;
    if (!pan || pan.pointerId !== event.pointerId) return;
    event.preventDefault(); event.stopPropagation();
    viewportRef.current = { ...pan.viewport, x: pan.viewport.x + event.clientX - pan.x, y: pan.viewport.y + event.clientY - pan.y };
    void setViewport(viewportRef.current);
  };
  const endRightPan = (event: ReactPointerEvent<HTMLElement>) => {
    if (rightPan.current?.pointerId !== event.pointerId) return;
    event.preventDefault(); event.stopPropagation();
    rightPan.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    viewportRef.current = getViewport();
    void persist().catch(() => undefined);
  };
  const applyWorkbench = useCallback((confirmed: ApiWorkbench) => {
    const wb = { ...confirmed, generationTracks: confirmed.generationTracks?.map((track) => {
      const currentAssetIds = [...track.currentAssetIds];
      for (const pending of pendingVersions.current.values()) if (pending.stepId === track.stepId) currentAssetIds[pending.outputIndex] = pending.assetId;
      return { ...track, currentAssetIds };
    }) };
    setWorkbench(wb);
    const nextImages = canvasImages(wb, assetsRef.current);
    const graph = canvasGraph(nextImages, wb, assetsRef.current, true);
    setImages(nextImages);
    if (!loaded.current) {
      connectionsRef.current = readConnections(wb.layout);
      setConnections(connectionsRef.current);
      versionRef.current = wb.layout?.layoutVersion ?? 0;
      viewportRef.current = wb.layout?.viewport ?? initialViewport;
      commitNodes(restoreCanvas(nextImages, wb.layout, graph));
      loaded.current = true;
      suppressViewportSave.current = true;
      window.setTimeout(async () => { try { if (wb.layout) await setViewport(viewportRef.current); else await fitView({ padding: 0.16, maxZoom: 1 }); } finally { viewportRef.current = getViewport(); suppressViewportSave.current = false; } }, 100);
    } else {
      const current = nodesRef.current;
      const restored = restoreCanvas(nextImages, serializeCanvas(current), graph);
      commitNodes(restored.map((n) => { const old = current.find((old) => old.id === n.id); return { ...n, measured: old?.measured, selected: old?.selected ?? false }; }));
    }
  }, [commitNodes, fitView, getViewport, setViewport]);
  const reload = useCallback(async () => {
    if (pendingVersions.current.size) return;
    const sequence = ++loadSequence.current;
    // Reuse slow reads: polling must not keep invalidating a response before it arrives.
    // Each consumer retains its sequence so StrictMode cleanup and version edits still win.
    if (!pendingRead.current) {
      pendingRead.current = Promise.allSettled([suiteApi.getWorkbench(suiteId), projectApi.listAssets(suiteId)])
        .finally(() => { pendingRead.current = null; });
    }
    const [wbResult, assetResult] = await pendingRead.current;
    if (sequence !== loadSequence.current || pendingVersions.current.size) return;
    if (wbResult.status === "rejected") { setLoadError(messageOf(wbResult.reason)); return; }
    if (assetResult.status === "rejected" && !loaded.current) { setLoadError(messageOf(assetResult.reason)); return; }
    if (assetResult.status === "fulfilled") { assetsRef.current = assetResult.value; setAssetError(""); } else setAssetError("项目图片暂时无法加载，已保留当前画布");
    setLoadError("");
    confirmedWorkbench.current = wbResult.value;
    applyWorkbench(wbResult.value);
  }, [suiteId, applyWorkbench]);
  useEffect(() => { void reload(); return () => { loadSequence.current++; }; }, [reload]);
  // Poll read-only project state so images created in another workspace appear here too.
  useEffect(() => { if (!active) return; const timer = window.setInterval(() => { if (document.visibilityState === "visible" && !pendingRead.current) void reload(); }, 8000); return () => window.clearInterval(timer); }, [reload, active]);
  useEffect(() => { const warn = (event: BeforeUnloadEvent) => { if (saveState !== "已保存") { event.preventDefault(); event.returnValue = ""; } }; window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn); }, [saveState]);

  const presentImage = (image: CanvasImage): CanvasImage => {
    if (image.canvasVersion) return image;
    const version = image.versions.find((v) => v.id === versionChoices[image.id]) ?? image.version;
    if (!version) return image;
    const generation = workbench?.generationSteps?.find((s) => s.outputVersionIds.includes(version.id));
    const asset = assetsRef.current.find((a) => a.id === version.id || a.generationSnapshotId === version.id || generation?.outputAssetIds.includes(a.id) || version.previewUrl === `/api/projects/${suiteId}/assets/${a.id}/preview`);
    return { ...image, version, generation: generation ?? image.generation, url: asset ? `/api/projects/${suiteId}/assets/${asset.id}/preview` : version.previewUrl, assetId: asset?.id, width: asset?.width ?? version.width, height: asset?.height ?? version.height };
  };
  const batchIndex = useMemo(() => workbench ? imageBatchIndex(workbench, assetsRef.current) : { batches: [], membership: new Map<string, Set<string>>(), modules: [], moduleMembership: new Map<string, Set<string>>() }, [workbench]);
  const filterImageIds = useMemo(() => [...assetsRef.current.filter(asset => asset.state === "available").map(asset => asset.id), ...images.flatMap(image => [image.assetId ?? image.version?.id ?? image.id, ...image.versions.map(version => version.id)])], [workbench, images]);
  const filterOptions = useMemo(() => resolveImageFilters(batchIndex, filterImageIds, storedBatchSelection, storedModuleSelection), [batchIndex, filterImageIds, storedBatchSelection, storedModuleSelection]);
  const { batchId: batchSelection, moduleId: moduleSelection } = filterOptions;
  const changeFilters = (batch: string, module: string, preferred: "batch" | "module") => {
    const next = resolveImageFilters(batchIndex, filterImageIds, batch, module, preferred);
    batchFitRequested.current = true;
    setBatchSelection(next.batchId);
    setModuleSelection(next.moduleId);
    commitNodes(nodesRef.current.map(node => ({ ...node, selected: false })));
    try { localStorage.setItem(`canvas-batch:${suiteId}`, next.batchId); localStorage.setItem(`canvas-module:${suiteId}`, next.moduleId); } catch { /* Session-only filtering remains available. */ }
  };
  const changeBatch = (value: string) => changeFilters(value, moduleSelection, "batch");
  const changeModule = (value: string) => changeFilters(batchSelection, value, "module");
  useEffect(() => {
    if (!workbench || (storedBatchSelection === batchSelection && storedModuleSelection === moduleSelection)) return;
    setBatchSelection(batchSelection); setModuleSelection(moduleSelection);
    try { localStorage.setItem(`canvas-batch:${suiteId}`, batchSelection); localStorage.setItem(`canvas-module:${suiteId}`, moduleSelection); } catch { /* Session-only filtering remains available. */ }
  }, [workbench, suiteId, storedBatchSelection, storedModuleSelection, batchSelection, moduleSelection]);
  useEffect(() => {
    if (!active || !batchFitRequested.current) return;
    const timer = window.setTimeout(() => {
      batchFitRequested.current = false;
      void fitView({ padding: 0.2, maxZoom: 1, duration: 200 }).then(() => { viewportRef.current = getViewport(); });
    }, 60);
    return () => window.clearTimeout(timer);
  }, [active, batchSelection, moduleSelection, fitView, getViewport]);
  const presentedImages = images.map(presentImage);
  const graph = workbench ? canvasGraph(presentedImages, workbench, assetsRef.current) : { steps: [], edges: [] };
  const showImageVersion = (image: CanvasImage, versionId: string) => {
    if (!image.canvasVersion) { setVersionChoices((current) => ({ ...current, [image.id]: versionId })); return; }
    if (!confirmedWorkbench.current || image.version?.id === versionId || !image.versions.some((version) => version.id === versionId)) return;
    const selection = { ...image.canvasVersion, assetId: versionId };
    pendingVersions.current.set(image.id, selection);
    loadSequence.current++;
    applyWorkbench(confirmedWorkbench.current);
    // 顺序保存防止快速点选时旧请求最后完成，显示始终跟随用户最新选择。
    versionQueue.current = versionQueue.current.catch(() => undefined).then(async () => {
      try {
        const track = await suiteApi.selectCanvasVersion(suiteId, selection.stepId, selection.outputIndex, selection.assetId);
        const confirmed = confirmedWorkbench.current!;
        confirmedWorkbench.current = { ...confirmed, generationTracks: confirmed.generationTracks?.map((item) => item.stepId === track.stepId ? track : item) };
      } catch (error) {
        notify(`版本保存失败：${messageOf(error)}${pendingVersions.current.get(image.id) === selection ? "，已恢复已保存版本" : ""}`);
      } finally {
        if (pendingVersions.current.get(image.id) === selection) pendingVersions.current.delete(image.id);
        loadSequence.current++;
        applyWorkbench(confirmedWorkbench.current!);
      }
    });
  };
  const baseDisplayNodes = nodes.map((node) => {
    if (node.data.image) return { ...node, data: { ...node.data, image: presentImage(node.data.image), selectImageVersion: showImageVersion, versionSaving: pendingVersions.current.has(node.data.image.id) } };
    if (node.type !== "generation") return node;
    const step = graph.steps.find((s) => `generation:${s.id}` === node.id) ?? node.data.step!;
    const track = workbench?.generationTracks?.find((t) => t.stepId === (step.trackId ?? step.id));
    const latest = track?.revisions[track.revisions.length - 1];
    return { ...node, hidden: !graph.steps.some((s) => `generation:${s.id}` === node.id && s.outputNodeIds.some((id) => nodes.some((n) => n.id === id && !n.hidden))), data: { ...node.data, step, openStep: setStepDetails, regenerateStep: setRegenerateStep, generationStatus: latest?.status, latestRevisionNumber: latest?.number } };
  });
  const lineageNodes = filterCanvasByBatch(baseDisplayNodes, graph, batchIndex, batchSelection, moduleSelection);
  const resultNodes = resultViewNodes(baseDisplayNodes, batchIndex, batchSelection, moduleSelection);
  const visibleNodes = viewMode === "results" ? resultNodes : lineageNodes;
  const visibleIds = new Set(visibleNodes.filter((n) => !n.hidden).map((n) => n.id));
  const allConnections = [...graph.edges, ...connections];
  const connectNodes = (source: string, target: string) => {
    const connection = { source, target };
    const problem = connectionProblem(visibleNodes, [...graph.edges, ...connectionsRef.current], connection);
    if (problem) { notify(problem); return; }
    connectionsRef.current = [...connectionsRef.current, connection];
    setConnections(connectionsRef.current);
    setSelectedConnection("");
    void persist().catch(() => undefined);
  };
  const displayNodes = visibleNodes.map(node => ({ ...node, data: { ...node.data, connectNodes,
    connectionCandidates: () => visibleNodes.filter(other => !other.hidden && other.id !== node.id && other.type !== "imageGroup").map(other => ({ id: other.id, title: other.data.image?.title ?? other.data.step?.title ?? other.id,
      upstream: !connectionProblem(visibleNodes, allConnections, { source: other.id, target: node.id }),
      downstream: !connectionProblem(visibleNodes, allConnections, { source: node.id, target: other.id }),
    })),
  } }));
  const edges = [
    ...graph.edges,
    ...connections.map(connection => ({ ...connection, id: `manual:${connection.source}->${connection.target}`, type: "default", markerEnd: { type: MarkerType.ArrowClosed, color: "#3b4658" }, style: { stroke: "#3b4658", strokeWidth: 2 }, selectable: true, selected: selectedConnection === `manual:${connection.source}->${connection.target}`, data: { manual: true } })),
  ].filter(edge => visibleIds.has(edge.source) && visibleIds.has(edge.target));
  const disconnect = () => {
    connectionsRef.current = connectionsRef.current.filter(edge => `manual:${edge.source}->${edge.target}` !== selectedConnection);
    setConnections(connectionsRef.current); setSelectedConnection("");
    void persist().catch(() => undefined);
  };
  const connectEnd = (event: MouseEvent | TouchEvent, state: FinalConnectionState) => {
    if (state.isValid || !state.fromNode) return;
    const point = "changedTouches" in event ? event.changedTouches[0] : event;
    if (!point) return;
    const id = document.elementFromPoint(point.clientX, point.clientY)?.closest<HTMLElement>(".react-flow__node")?.dataset.id;
    if (!id || id === state.fromNode.id) return;
    if (state.fromHandle?.type === "target") connectNodes(id, state.fromNode.id);
    else connectNodes(state.fromNode.id, id);
  };
  const selectedNodes = displayNodes.filter((n) => n.selected && !n.hidden);
  const selectedPictures = selectedNodes.filter((n) => n.data.image).map((n) => n.data.image!);
  const selectedImage = selectedPictures.length === 1 ? selectedPictures[0] : null;
  const latestCanvasEdit = [...(workbench?.imageEditChildren ?? [])].reverse().find((child) => child.task.sourceCardId && child.task.status !== "archived");
  const latestEditImage = latestCanvasEdit ? images.find((image) => image.id === `edit-child:${latestCanvasEdit.task.id}` && image.url) : undefined;
  const editInProgress = latestCanvasEdit && ["queued", "generating"].includes(String(latestCanvasEdit.task.status));
  const batchImages = presentedImages.filter(image => matchesCanvasImageBatch(batchIndex, batchSelection, image, moduleSelection));
  const filteredImages = batchImages.filter(image => viewMode !== "results" || isResultImage(image)).filter((image) => (category === "all" || image.category === category) && image.title.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const onNodesChange: OnNodesChange<CanvasNode> = useCallback((changes) => {
    const next = applyNodeChanges(changes.filter((c) => c.type !== "remove"), nodesRef.current);
    commitNodes(next);
    if (changes.some((c) => c.type === "position" && c.dragging === false)) void persist(next).catch(() => undefined);
  }, [commitNodes, persist]);
  const focus = (id: string) => { commitNodes(nodesRef.current.map((n) => ({ ...n, selected: n.id === id }))); setInspectorOpen(true); changeViewport(() => fitView({ nodes: [{ id }], padding: 0.6, maxZoom: 1.1, duration: 250 })); if (window.innerWidth <= 760) setLeftOpen(false); };
  const add = (id: string, position?: { x: number; y: number }) => {
    const node = nodesRef.current.find((n) => n.id === id);
    if (!node) return;
    if (node.data.image && !isResultImage(node.data.image)) changeView("lineage");
    if (node.data.image && !matchesCanvasImageBatch(batchIndex, batchSelection, presentImage(node.data.image), moduleSelection)) {
      setBatchSelection(ALL_BATCHES);
      setModuleSelection(ALL_MODULES);
      try { localStorage.setItem(`canvas-batch:${suiteId}`, ALL_BATCHES); localStorage.setItem(`canvas-module:${suiteId}`, ALL_MODULES); } catch { /* Keep the selected image accessible. */ }
    }
    if (!node.hidden && !position) { focus(id); return; }
    const next = nodesRef.current.map((n) => n.id === id ? { ...n, parentId: undefined, hidden: false, selected: true, position: position ?? screenToFlowPosition({ x: innerWidth / 2, y: innerHeight / 2 }) } : { ...n, selected: false });
    commitNodes(next); void persist(next).catch(() => undefined); setInspectorOpen(true);
    if (!position) changeViewport(() => fitView({ nodes: [{ id }], padding: 0.7, maxZoom: 1 }), 30);
    if (window.innerWidth <= 760) setLeftOpen(false);
  };
  const remove = () => {
    const selectedIds = new Set(selectedNodes.map((n) => n.id));
    const next = nodesRef.current.map((n) => n.type === "image" && (selectedIds.has(n.id) || (selectedIds.has(n.parentId ?? "") && visibleIds.has(n.id))) ? { ...n, hidden: true, selected: false } : { ...n, selected: false });
    commitNodes(next); void persist(next).catch(() => undefined); notify("已移出画布，图片仍保留在项目中");
  };
  const arrange = () => {
    changeView("results");
    const next = arrangeResultGrid(nodesRef.current, resultNodes);
    commitNodes(next); void persist(next).catch(() => undefined);
    changeViewport(() => fitView({ padding: 0.15, maxZoom: 1, duration: 250 }), 20);
  };
  const arrangeLineage = () => {
    changeView("lineage");
    const lineageVisibleIds = new Set(lineageNodes.filter(node => !node.hidden).map(node => node.id));
    const arranged = arrangeGraph(lineageNodes, graph.edges.filter(edge => lineageVisibleIds.has(edge.source) && lineageVisibleIds.has(edge.target)));
    const moved = new Map(arranged.filter(node => lineageVisibleIds.has(node.id)).map(node => [node.id, node]));
    const next = nodesRef.current.map(node => {
      const placed = moved.get(node.id);
      return placed ? { ...node, position: placed.position, parentId: undefined, extent: undefined, expandParent: undefined } : node;
    }).filter(node => node.type !== "imageGroup" || nodesRef.current.some(child => child.parentId === node.id && !moved.has(child.id)));
    commitNodes(next); void persist(next).catch(() => undefined);
    changeViewport(() => fitView({ padding: 0.15, maxZoom: 1, duration: 250 }), 20);
  };
  const createGroup = () => {
    const chosen = displayNodes.filter((n) => n.selected && n.type === "image" && !n.hidden);
    if (chosen.length < 2 || !groupTitle.trim()) return;
    const positions = serializeCanvas(nodesRef.current).nodes;
    const points = chosen.map((n) => positions.find((p) => p.nodeId === n.id)!);
    const x = Math.min(...points.map((p) => p.x)) - 24, y = Math.min(...points.map((p) => p.y)) - 48;
    const width = Math.max(...points.map((p) => p.x + 248)) - x + 24;
    const height = Math.max(...chosen.map((n, i) => points[i].y + (n.measured?.height ?? 370))) - y + 24;
    const id = `group:${createIdempotencyKey()}`;
    const group: CanvasNode = { id, type: "imageGroup", position: { x, y }, data: { title: groupTitle.trim() }, style: { width, height }, zIndex: -1, dragHandle: ".ic-group-heading" };
    const next = [group, ...nodesRef.current.map((n) => { const point = points.find((p) => p.nodeId === n.id); return point ? { ...n, parentId: id, position: { x: point.x - x, y: point.y - y }, selected: false } : { ...n, selected: false }; })];
    commitNodes(next); void persist(next).catch(() => undefined); setGroupDialog(false);
  };
  const ungroup = () => {
    const ids = new Set(selectedNodes.filter((n) => n.type === "imageGroup").map((n) => n.id));
    const absolute = serializeCanvas(nodesRef.current).nodes;
    const next = nodesRef.current.filter((n) => !ids.has(n.id)).map((n) => { if (!n.parentId || !ids.has(n.parentId)) return n; const pos = absolute.find((p) => p.nodeId === n.id)!; return { ...n, parentId: undefined, position: { x: pos.x, y: pos.y } }; });
    commitNodes(next); void persist(next).catch(() => undefined);
  };
  const run = async (action: () => Promise<void>) => { if (busy) return; setBusy(true); try { await action(); } catch (error) { notify(messageOf(error)); } finally { setBusy(false); } };
  const download = (items: CanvasImage[]) => void run(async () => {
    const blobs = await Promise.all(items.map(async (image) => { const response = await fetch(image.url); if (!response.ok) throw new Error(`下载失败：${image.title}`); return { image, blob: await response.blob() }; }));
    const zip = new JSZip();
    blobs.forEach(({ image, blob }, i) => zip.file(`${i + 1}-${image.title.replace(/[<>:"/\\|?*]/g, "-")}${/\.[a-z0-9]+$/i.test(image.title) ? "" : ".png"}`, blob));
    const blob = blobs.length === 1 ? blobs[0].blob : await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = blobs.length === 1 ? blobs[0].image.title : "画布选中图片.zip"; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 5000);
  });
  const openEditor = (image: CanvasImage) => {
    const v = image.version;
    const sourceId = image.assetId;
    if (!sourceId) { notify("此图片暂未关联可编辑的项目资产"); return; }
    const version: ApiTaskVersion = { id: sourceId, taskId: image.task?.id ?? image.id, slotId: "", attemptId: "", versionNumber: v?.versionNumber ?? 1, objectKey: "", processObjectKeys: [], sha256: "", width: image.width, height: image.height, mimeType: "image/png", promptSnapshot: v?.promptSnapshot ?? {}, contextSnapshot: {}, isCurrent: true, isFinal: false, createdAt: "", previewUrl: image.url };
    const task = image.task ?? { id: image.id, suiteId, planSnapshotId: null, planItemId: null, ordinal: 0, imageType: "main", title: image.title, purpose: "", promptDraft: imagePrompt(image), promptRevision: 0, sourceInputImageId: null, generationParams: {}, status: "generated", archivedAt: null, createdAt: "", updatedAt: "", versions: [], attempts: [], slots: [] } satisfies ApiSuiteTask;
    setEditor({ task, version });
  };
  const generate = async (image: CanvasImage) => {
    const task = image.task; if (!task) return;
    if (image.editTask) {
      const child = workbench?.imageEditChildren?.find((c) => c.task.id === task.id);
      const failed = child?.attempts[child.attempts.length - 1];
      if (failed?.status === "failed") await suiteApi.retryImageEdit(String(failed.id));
      else await suiteApi.regenerateImageEditTask(task.id, task.promptDraft);
    } else await suiteApi.generateTask(task.id, task.promptDraft, task.promptRevision);
    setConfirmGeneration(null); await reload(); notify("生成任务已提交，结果会自动更新");
  };
  const submitEdit = async (spec: Record<string, unknown>, instruction: string) => {
    if (!editor) return;
    await suiteApi.submitImageEdit(String(spec.sessionId), { promptSnapshot: { schemaVersion: "image-edit-v1", sourceVersionId: editor.version.id, operations: spec.operations, summary: instruction }, configSnapshot: { outputKind: "canvas_edit", sourceCardId: editor.task.id, sourceVersionId: editor.version.id, parentVersionId: editor.version.id, generationParams: editor.task.generationParams }, summary: instruction });
    setEditor(null); await reload(); notify("编辑任务已提交，原图已保留");
  };
  const restoreSavedLayout = async () => {
    viewportEpoch.current++;
    await queue.current.catch(() => undefined);
    const wb = await suiteApi.getWorkbench(suiteId);
    connectionsRef.current = readConnections(wb.layout);
    setConnections(connectionsRef.current); setSelectedConnection("");
    versionRef.current = wb.layout?.layoutVersion ?? 0;
    viewportRef.current = wb.layout?.viewport ?? initialViewport;
    suppressViewportSave.current = true;
    commitNodes(restoreCanvas(images, wb.layout, canvasGraph(images, wb, assetsRef.current, true)));
    await setViewport(viewportRef.current);
    suppressViewportSave.current = false;
    setSaveState("已保存"); setRecoverSave(false);
  };
  if (!workbench) return <main className="ic-loading" role={loadError ? "alert" : "status"}>{loadError ? <><h2>画布加载失败</h2><p>{loadError}</p><button onClick={() => void reload()}>重新加载</button><button onClick={() => navigate(`/suites/${suiteId}`)}>返回项目</button></> : <><Loader2 className="ic-spin" /><p>正在打开项目画布…</p></>}</main>;

  const headerTarget = embedded && !fullscreen ? document.getElementById(`canvas-actions-${suiteId}`) : null;
  const header = <header className="ic-topbar ic-reference"><div className="ic-project">{!embedded && <button aria-label="返回项目" onClick={() => navigate(`/suites/${suiteId}`)}><ArrowLeft size={18} /></button>}<div><strong>{workbench.suite.name}</strong><span>图片画布 <ChevronDown size={12} /></span></div></div><div className="ic-top-center"><span className="ic-live-dot" />自由创作空间</div><div className="ic-top-actions">{editInProgress ? <span className="ic-edit-progress" role="status"><Loader2 className="ic-spin" size={14} />修改图生成中</span> : latestEditImage ? <button type="button" className="ic-edit-result-action" onClick={() => add(latestEditImage.id)}><Sparkles size={15} />查看最新修改图</button> : null}<button aria-label="制作长图" onClick={() => setLongImageOpen(true)}><Images size={15} /><span>制作长图</span></button><span className={`ic-save-state ${saveState === "保存失败" ? "is-error" : ""}`}>{saveState === "已保存" ? <Check size={13} /> : <Loader2 size={13} />}{saveState}</span>{saveState === "保存失败" && <button onClick={() => setRecoverSave(true)}>重试保存</button>}<button aria-label="刷新项目图片" onClick={() => void reload()}><RotateCcw size={15} /></button><button aria-label={fullscreen ? "退出画布全屏" : "进入画布全屏"} title={fullscreen ? "退出画布全屏（Esc）" : "进入画布全屏"} onClick={() => setFullscreen((value) => !value)}>{fullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}<span>{fullscreen ? "退出全屏" : "全屏"}</span></button><button className="ic-primary" disabled={!selectedPictures.some((i) => i.url) || busy} onClick={() => download(selectedPictures.filter((i) => i.url))}><Download size={14} /><span>导出选中</span></button></div></header>;

  return <div className={`ic-studio ic-reference ${embedded ? "ic-embedded" : ""} ${fullscreen ? "is-fullscreen" : ""} ${leftOpen ? "has-library" : ""} ${selectedImage && inspectorOpen ? "has-inspector" : ""}`}>
    {headerTarget ? createPortal(header, headerTarget) : header}
    <div className="ic-filterbar"><ImageBatchFilter label="画布批次" batches={filterOptions.batches} includeUnassigned={filterOptions.hasUnassignedBatch} value={batchSelection} onChange={changeBatch} /><ImageModuleFilter label="画布模块类型" modules={filterOptions.modules} includeUnassigned={filterOptions.hasUnassignedModule} value={moduleSelection} onChange={changeModule} /><span className="ic-canvas-count">{displayNodes.filter((n) => n.type === "image" && !n.hidden).length} 张图片</span></div>
    <div className="ic-body">
      {leftOpen && <aside className="ic-library" aria-label="项目图片"><header><div><strong>项目图片</strong><span>{filteredImages.length} / {images.length} 张</span></div><button aria-label="关闭项目图片" onClick={() => setLeftOpen(false)}><X size={15} /></button></header><div className="ic-library-search"><Search size={14} /><input aria-label="搜索项目图片" placeholder="搜索图片" value={query} onChange={(event) => setQuery(event.target.value)} /></div><div className="ic-category"><button className={category === "all" ? "is-active" : ""} onClick={() => setCategory("all")}>全部</button>{(Object.keys(categoryNames) as ImageCategory[]).filter((c) => images.some((i) => i.category === c)).map((c) => <button key={c} className={category === c ? "is-active" : ""} onClick={() => setCategory(c)}>{categoryNames[c]}</button>)}</div><div className="ic-library-list">{assetError && <div className="ic-error" role="alert">{assetError}<button onClick={() => void reload()}>重试</button></div>}{filteredImages.map((image) => { const onCanvas = displayNodes.some((n) => n.id === image.id && !n.hidden); return <button className="ic-library-item" key={image.id} aria-label={`${onCanvas ? "定位图片" : "加入画布"} ${image.title}`} draggable onDragStart={(event) => { event.dataTransfer.setData("application/x-canvas-image", image.id); event.dataTransfer.effectAllowed = "copyMove"; }} onClick={() => add(image.id)}><div>{image.url ? <img src={image.url} alt="" loading="lazy" draggable={false} /> : <Images size={22} />}<span>{onCanvas ? <Check size={11} /> : <Plus size={11} />}</span></div><strong title={image.title}>{image.title}</strong><small>{categoryNames[image.category]}</small></button>; })}{!filteredImages.length && <p className="ic-library-empty">{query ? "没有找到匹配的图片" : "项目图片会显示在这里"}</p>}</div><footer><ImagePlus size={14} /><span>拖入画布，自由排列与对比</span></footer></aside>}
      <main className="ic-canvas" aria-label="图片画布"
        onPointerDownCapture={startRightPan} onPointerMoveCapture={moveRightPan} onPointerUpCapture={endRightPan} onPointerCancelCapture={endRightPan} onLostPointerCapture={endRightPan}
        onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; }} onDrop={(event) => { event.preventDefault(); const id = event.dataTransfer.getData("application/x-canvas-image"); if (id) add(id, screenToFlowPosition({ x: event.clientX, y: event.clientY })); }}>

        {(loadError || assetError) && <div className="ic-load-warning" role="alert">{loadError || assetError}<button onClick={() => void reload()}>重新加载</button></div>}
        <ReactFlow<CanvasNode> nodes={displayNodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onNodeClick={() => { setSelectedConnection(""); setInspectorOpen(true); setLeftOpen(false); }} onNodeDoubleClick={(_, node) => { if (node.data.image?.url) setPreview([node.data.image]); else if (node.data.step) setStepDetails(node.data.step); }} onPaneClick={() => { setSelectedConnection(""); commitNodes(nodesRef.current.map((n) => ({ ...n, selected: false }))); }} onMove={(_, viewport) => setZoom(viewport.zoom)} onMoveEnd={(event, viewport) => { if (!event || rightPan.current) return; viewportRef.current = viewport; if (loaded.current && !suppressViewportSave.current) void persist(nodesRef.current, viewport).catch(() => undefined); }} nodeDragThreshold={1} paneClickDistance={3} nodesConnectable onConnect={(connection: Connection) => connectNodes(connection.source, connection.target)} onConnectEnd={connectEnd} isValidConnection={connection => !connectionProblem(visibleNodes, allConnections, connection)} onEdgeClick={(_, edge) => { if (!edge.data?.manual) return; setSelectedConnection(edge.id); commitNodes(nodesRef.current.map(n => ({ ...n, selected: false }))); }} nodesDraggable elementsSelectable selectionOnDrag selectionMode={SelectionMode.Partial} panOnDrag={[0, 1, 2]} panOnScroll={false} zoomOnScroll zoomOnPinch zoomOnDoubleClick={false} onContextMenu={(event) => event.preventDefault()} multiSelectionKeyCode="Shift" deleteKeyCode={null} minZoom={0.12} maxZoom={2.5} fitView={false}><Background gap={16} size={1} color="#474747" /></ReactFlow>
        {!displayNodes.some((n) => n.type === "image" && !n.hidden) && <div className="ic-empty-canvas"><div><Images size={34} /></div><h2>{viewMode === "results" ? "当前筛选下暂无成品图片" : "让想法在这里展开"}</h2><p>{viewMode === "results" ? "可调整批次、模块类型，或切回生成脉络查看素材。" : "从项目图片加入图片，摆放、比较，继续创作。"}</p><button onClick={() => setLeftOpen(true)}>打开项目图片</button></div>}
        {!!selectedNodes.length && <div className="ic-selection-bar"><span>{selectedPictures.length ? `已选 ${selectedPictures.length} 张` : "图片分组"}</span>{selectedImage?.url && <><button aria-label="预览图片" onClick={() => setPreview([selectedImage])}><Expand size={15} /></button><button disabled={!selectedImage.assetId} title={!selectedImage.assetId ? "历史图片未关联项目资产" : "编辑图片"} onClick={() => openEditor(selectedImage)}><Sparkles size={14} />AI 编辑</button></>}{selectedPictures.length === 2 && selectedPictures.every((i) => i.url) && <button aria-label="对比图片" onClick={() => setPreview(selectedPictures)}><SplitSquareHorizontal size={15} />对比</button>}{selectedPictures.length > 1 && <button aria-label="创建分组" onClick={() => { setGroupTitle("候选方案"); setGroupDialog(true); }}><FolderPlus size={15} />分组</button>}{selectedNodes.some((n) => n.type === "imageGroup") && <button onClick={ungroup}>解散分组</button>}{selectedImage && <button aria-label="图片属性" onClick={() => setInspectorOpen(!inspectorOpen)}><SlidersHorizontal size={15} /></button>}<i /><button aria-label="移出画布" title="移出画布，保留项目图片" onClick={remove}><X size={15} /></button></div>}
        <div className="ic-reference-dock" role="toolbar" aria-label="画布工具">
          <button className="ic-dock-add" aria-label="添加项目图片" title="添加项目图片" onClick={() => { setLeftOpen(true); setInspectorOpen(false); }}><Plus size={22} /></button><i />
          <button aria-label="项目图片" title="项目图片" aria-expanded={leftOpen} className={leftOpen ? "is-active" : ""} onClick={() => { setLeftOpen(!leftOpen); setInspectorOpen(false); }}><Images size={20} /></button>
          <button aria-label="自动排列" title="自动排列：生成结果和修改图" aria-pressed={viewMode === "results"} className={viewMode === "results" ? "is-active" : ""} onClick={arrange}><LayoutGrid size={20} /></button>
          {(!!graph.steps.length || viewMode === "results") && <button aria-label="按生成脉络排列" title="按生成脉络排列：来源与提示词" aria-pressed={viewMode === "lineage"} className={viewMode === "lineage" ? "is-active" : ""} onClick={arrangeLineage}><GitBranch size={20} /></button>}<i />
          <button aria-label="缩小画布" title="缩小画布" onClick={() => changeViewport(() => zoomOut())}><Minus size={18} /></button>
          <button className="ic-dock-percent" aria-label="重置画布缩放" title="重置到 100%" onClick={() => changeViewport(() => setViewport({ ...getViewport(), zoom: 1 }))}>{Math.round(zoom * 100)}%</button>
          <button aria-label="放大画布" title="放大画布" onClick={() => changeViewport(() => zoomIn())}><Plus size={18} /></button>
          <button aria-label="适应画布" title="适应画布" onClick={() => changeViewport(() => fitView({ padding: 0.15, maxZoom: 1, duration: 250 }))}><Expand size={18} /></button>
        </div>
        {selectedConnection && edges.some(edge => edge.id === selectedConnection) && <div className="ic-selection-bar"><span>手动连接</span><button aria-label="断开连接" onClick={disconnect}><X size={14} />断开连接</button></div>}
        <span className="ic-reference-help">拖动空白处移动画布 · 拖动图片调整位置 · 圆点拖线连接 · Shift 多选 · 滚轮缩放</span>
      </main>
    {selectedImage && inspectorOpen && <CanvasInspector image={selectedImage} close={() => setInspectorOpen(false)} preview={() => setPreview([selectedImage])} edit={() => openEditor(selectedImage)} generate={() => setConfirmGeneration(selectedImage)} busy={busy} download={() => download([selectedImage])} showVersion={(version) => showImageVersion(selectedImage, version.id)} compareVersion={(version) => setPreview([selectedImage, { ...selectedImage, version, url: version.previewUrl }])} savePrompt={(prompt, params) => run(async () => { if (!selectedImage.task) return; await suiteApi.updateTask(selectedImage.task.id, { expectedRevision: selectedImage.task.promptRevision, promptDraft: prompt, generationParams: { ...selectedImage.task.generationParams, ...params } }); await reload(); notify("提示词与参数已保存"); })} selectVersion={(version, selection) => { if (selectedImage.canvasVersion) { showImageVersion(selectedImage, version.id); return; } void run(async () => { if (!selectedImage.task) return; if (selectedImage.editTask) await suiteApi.selectImageEditVersion(selectedImage.task.id, version.id, selection); else await suiteApi.selectTaskVersion(selectedImage.task.id, version.id, selection); await reload(); notify(selection === "final" ? "已设为终版" : "已切换当前版本"); }); }} />}
    </div>
    {longImageOpen && <LongImageComposer initialModuleId={moduleSelection} initialBatchId={batchSelection} projectId={suiteId} assets={assetsRef.current} workbench={workbench} close={() => setLongImageOpen(false)} saved={reload} />}
    {preview && <CanvasCompare images={preview} close={() => setPreview(null)} />}
    {stepDetails && <GenerationDetails step={stepDetails} close={() => setStepDetails(null)} />}
    {regenerateStep && <CanvasRegenerateDialog projectId={suiteId} step={regenerateStep} tracks={workbench.generationTracks ?? []} assets={assetsRef.current} close={() => setRegenerateStep(null)} submitted={async () => { await reload(); notify("新版本已提交，生成结果会自动更新，旧版本已保留"); }} />}
    {recoverSave && <div className="ic-overlay"><section className="ic-dialog" role="dialog" aria-modal="true" aria-label="恢复布局保存"><h2>布局尚未保存</h2><p>可再次尝试保存。如果其他窗口已修改画布，请重新加载已保存布局；这会放弃当前未保存的摆放。</p><footer><button onClick={() => setRecoverSave(false)}>取消</button><button disabled={busy} onClick={() => void run(async () => { await persist(); setRecoverSave(false); })}>再次尝试保存</button><button className="ic-primary" disabled={busy} onClick={() => void run(restoreSavedLayout)}>重新加载已保存布局</button></footer></section></div>}
    {groupDialog && <div className="ic-overlay"><form className="ic-dialog" role="dialog" aria-modal="true" aria-label="创建图片分组" onSubmit={(event) => { event.preventDefault(); createGroup(); }}><h2>把这些图片放在一起</h2><p>给这组方案取个名字，方便后续对比。</p><label>分组名称<input autoFocus aria-label="分组名称" value={groupTitle} maxLength={60} onChange={(event) => setGroupTitle(event.target.value)} /></label><footer><button type="button" onClick={() => setGroupDialog(false)}>取消</button><button className="ic-primary" disabled={!groupTitle.trim()}>确认分组</button></footer></form></div>}
    {confirmGeneration && <div className="ic-overlay"><section className="ic-dialog" role="dialog" aria-modal="true" aria-label="确认生成"><h2>生成新的图片版本</h2><p>将使用「{confirmGeneration.title}」已保存的提示词和参数提交生成。原版本会保留，此操作会调用生图服务。</p><footer><button autoFocus disabled={busy} onClick={() => setConfirmGeneration(null)}>取消</button><button className="ic-primary" disabled={busy} onClick={() => void run(() => generate(confirmGeneration))}>{busy ? "提交中…" : "确认生成"}</button></footer></section></div>}
    {editor && <ImageEditorModal task={editor.task} version={editor.version} onClose={() => setEditor(null)} onSubmit={submitEdit} onRegenerate={async () => { const item = images.find((i) => i.task?.id === editor.task.id); if (!item) throw new Error("请使用重新编辑，为这张素材生成新结果"); await generate(item); }} />}
    {toast && <div className="ic-toast" role="status">{toast}</div>}
  </div>;
}
