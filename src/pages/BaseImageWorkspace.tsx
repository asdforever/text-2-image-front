import { useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import JSZip from "jszip";
import { Download, Library, Upload } from "lucide-react";
import type { Asset, Project } from "../api/contracts";
import { projectApi, type ApiProjectDetail } from "../api/client";
import { BaseImageCard } from "../components/BaseImageCard";
import { Button } from "../components/ui/button";
import { isImageEditTaskActive } from "../lib/image-editing-task";
import { useWhiteBackgroundTasks } from "../lib/use-white-background-tasks";
import { loadWhiteBackgroundLibrary, type WhiteBackgroundLibraryItem as LibraryItem } from "../lib/white-background-library";
import { validateProjectAssetBatch } from "../lib/project-assets";

interface BaseImageWorkspaceProps {
  project: Project;
  selectionMode: boolean;
  selectedIds: string[];
  onSelectedIdsChange: (ids: string[]) => void;
  onSelectAsset: (asset: Asset) => void;
  onToast: (message: string) => void;
  focusAssetId?: string | null;
  projectDetail: ApiProjectDetail;
  onRefresh: () => Promise<void>;
}

type UploadKind = "source" | "white_background";

export function BaseImageWorkspace({ project, selectionMode, selectedIds, onSelectedIdsChange, onSelectAsset, onToast, focusAssetId, projectDetail, onRefresh }: BaseImageWorkspaceProps) {
  const [assets, setAssets] = useState<Asset[]>(() => project.assets.filter((asset) => asset.type === "source" || asset.type === "base"));
  const [uploadFeedback, setUploadFeedback] = useState<string[]>([]);
  const [failedUploads, setFailedUploads] = useState<File[]>([]);
  const [failedUploadKind, setFailedUploadKind] = useState<UploadKind>("source");
  const [uploading, setUploading] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryErrors, setLibraryErrors] = useState<string[]>([]);
  const [libraryItems, setLibraryItems] = useState<LibraryItem[]>([]);
  const [generationSource, setGenerationSource] = useState<Asset | null>(null);
  const [background, setBackground] = useState<"white" | "transparent">("white");
  const outputLabel = background === "transparent" ? "透明图" : "白底图";
  const [generatingSourceId, setGeneratingSourceId] = useState<string | null>(null);
  const whiteTasks = useWhiteBackgroundTasks(project.id, onRefresh);
  const activeSourceIds = new Set(whiteTasks.tasks.filter(task => isImageEditTaskActive(task.status)).map(task => String(task.sourceSnapshot.assetId)));
  const scrollRef = useRef<HTMLDivElement>(null);
  const sourceInputRef = useRef<HTMLInputElement>(null);
  const whiteInputRef = useRef<HTMLInputElement>(null);
  const columns = 2;
  const rows = useMemo(() => Array.from({ length: Math.ceil(assets.length / columns) }, (_, index) => assets.slice(index * columns, index * columns + columns)), [assets]);
  const virtualizer = useVirtualizer({ count: rows.length, getScrollElement: () => scrollRef.current, estimateSize: () => 300, overscan: 2 });

  useEffect(() => {
    if (!focusAssetId) return;
    const index = assets.findIndex((asset) => asset.id === focusAssetId);
    if (index >= 0) virtualizer.scrollToIndex(Math.floor(index / columns), { align: "center" });
  }, [assets, focusAssetId, virtualizer]);
  useEffect(() => { setAssets(project.assets.filter((asset) => asset.type === "source" || asset.type === "base")); }, [project.id, project.assets]);

  const uploadFiles = async (files: File[], kind: UploadKind) => {
    const validation = validateProjectAssetBatch(files.map((file) => ({ name: file.name, type: file.type, size: file.size })));
    const invalid = files.filter((_, index) => !validation[index].ok);
    const valid = files.filter((_, index) => validation[index].ok);
    const selectedSource = selectedIds.find((id) => project.assets.some((asset) => asset.id === id && asset.type === "source"));
    setUploading(true);
    const messages = invalid.map((file) => `${file.name}：文件格式或大小不符合要求`);
    const failed: File[] = [...invalid];
    try {
      for (const file of valid) {
        try {
          await projectApi.uploadAsset(project.id, kind, file, kind === "white_background" ? selectedSource : undefined);
          messages.push(`已提交：${file.name}`);
        } catch (nextError) {
          failed.push(file);
          messages.push(`${file.name}：${nextError instanceof Error ? nextError.message : "上传失败"}`);
        }
      }
      if (messages.some((message) => message.startsWith("已提交："))) await onRefresh();
    } finally {
      setUploading(false); setUploadFeedback(messages); setFailedUploads(failed); setFailedUploadKind(kind);
      const successCount = messages.filter((message) => message.startsWith("已提交：")).length;
      if (successCount) onToast(`已提交 ${successCount} 个素材`);
    }
  };

  const loadLibraryItems = async () => {
    setLibraryLoading(true);
    setLibraryItems([]);
    setLibraryErrors([]);
    try {
      const result = await loadWhiteBackgroundLibrary();
      setLibraryItems(result.items);
      setLibraryErrors(result.errors);
    } catch { setLibraryErrors(["读取白底图库失败，请重试"]); }
    finally { setLibraryLoading(false); }
  };
  const importLibraryItem = async (item: LibraryItem) => {
    setUploading(true);
    try {
      const response = await fetch(item.previewUrl);
      if (!response.ok) throw new Error("图片读取失败");
      const file = new File([await response.blob()], `${item.name.replace(/\.[^.]+$/, "")}-${item.snapshot?.background === "transparent" ? "透明" : "白底"}.png`, { type: "image/png" });
      await projectApi.uploadAsset(project.id, "white_background", file, undefined, { sourceKind: item.sourceKind, sourceLibraryId: item.libraryId, sourceResourceId: item.resourceId, sourceResourceVersionId: item.resourceVersionId, sourceSnapshot: item.snapshot });
      await onRefresh(); setLibraryOpen(false); onToast(`已从${item.source}导入白底图`);
    } catch (error) { onToast(error instanceof Error ? error.message : "导入白底图失败"); }
    finally { setUploading(false); }
  };
  const openPrompts = (asset: Asset) => {
    if (asset.type !== "source" || activeSourceIds.has(asset.id)) return;
    setGenerationSource(asset); setBackground("white");
  };
  const submitWhiteBackgroundGeneration = async () => {
    const source = generationSource;
    if (!source || generatingSourceId) return;
    setGeneratingSourceId(source.id);
    try {
      const task = await projectApi.generateWhiteBackground(project.id, source.id, {
        background,
      });
      whiteTasks.track(task);
      setGenerationSource(null);
      onToast(`${outputLabel}任务已提交，完成后会自动显示，可离开后返回查看`);
    } catch (error) {
      onToast(error instanceof Error ? error.message : `${outputLabel}生成失败`);
    } finally {
      setGeneratingSourceId(null);
    }
  };

  const toggle = (id: string) => onSelectedIdsChange(selectedIds.includes(id) ? selectedIds.filter((item) => item !== id) : [...selectedIds, id]);
  const setCurrent = async (asset: Asset) => { const role = asset.type === "base" ? "white_background" : "source"; try { await projectApi.selectAsset(project.id, role, asset.id); await onRefresh(); onToast("已设为当前使用"); } catch (error) { onToast(error instanceof Error ? error.message : "设置当前图片失败"); } };
  const removeAsset = async (asset: Asset) => { if (!window.confirm(`确认删除“${asset.name}”吗？`)) return; try { await projectApi.removeAsset(project.id, asset.id); onSelectedIdsChange(selectedIds.filter((id) => id !== asset.id)); await onRefresh(); onToast("素材已删除"); } catch (error) { onToast(error instanceof Error ? error.message : "删除素材失败"); } };
  const exportAsset = (asset: Asset) => { const link = document.createElement("a"); link.href = asset.url; link.download = `${asset.name.replace(/\.[^.]+$/, "")}-${asset.background === "transparent" ? "透明" : "白底"}-v${asset.version}.png`; link.click(); };
  const exportSelected = async () => { const zip = new JSZip(); await Promise.all(selectedIds.map(async (id) => { const asset = assets.find((item) => item.id === id); if (!asset) return; const response = await fetch(asset.url); zip.file(`${asset.name.replace(/\.[^.]+$/, "")}-${asset.background === "transparent" ? "透明" : "白底"}-v${asset.version}.png`, await response.arrayBuffer()); })); const blob = await zip.generateAsync({ type: "blob" }); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `picagent-base-images-${selectedIds.length}.zip`; link.click(); URL.revokeObjectURL(link.href); onToast(`已导出 ${selectedIds.length} 张白底图`); };

  return <div className="workspace-page"><div className="c-base-layout">
    <aside className="c-base-tools"><h2>准备商品素材</h2><p>上传商品原图，生成干净的白底图；也可以直接使用已有白底图。</p><div className="toolbar-actions">
      <input ref={sourceInputRef} type="file" accept="image/*" multiple hidden onChange={(event) => { void uploadFiles(Array.from(event.target.files ?? []), "source"); event.currentTarget.value = ""; }} />
      <input ref={whiteInputRef} type="file" accept="image/*" multiple hidden onChange={(event) => { void uploadFiles(Array.from(event.target.files ?? []), "white_background"); event.currentTarget.value = ""; }} />
      <Button variant="secondary" size="sm" onClick={() => sourceInputRef.current?.click()} disabled={uploading}><Upload size={13} />上传原图</Button>
      <Button variant="secondary" size="sm" onClick={() => whiteInputRef.current?.click()} disabled={uploading}><Upload size={13} />上传已有白底图</Button>
      <Button variant="secondary" size="sm" onClick={() => { setLibraryOpen(true); void loadLibraryItems(); }} disabled={uploading}><Library size={13} />选择素材库</Button>
    </div></aside><section className="c-base-results"><header><h1>白底图工作区</h1><Button variant="secondary" size="sm" disabled={selectedIds.length === 0} onClick={() => void exportSelected()}><Download size={13} />导出 ZIP</Button></header>
    {uploadFeedback.length > 0 && <div className="upload-feedback" role="status">{uploadFeedback.map((message) => <div key={message}>{message}</div>)}{failedUploads.length > 0 && <Button variant="secondary" size="sm" onClick={() => void uploadFiles(failedUploads, failedUploadKind)} disabled={uploading}>重试失败项</Button>}</div>}
    {whiteTasks.error && <div className="upload-feedback" role="alert">{whiteTasks.error}</div>}
    {whiteTasks.tasks.filter(task => task.status === "failed").map(task => <div className="upload-feedback" role="alert" key={task.id}>{String(task.sourceSnapshot.filename ?? "白底图")}：{task.attempts[task.attempts.length - 1]?.error || "白底图生成失败，请检查后重试"}</div>)}
    {assets.length === 0 ? <div className="empty-workspace"><strong>暂无素材，请先上传商品原图或已有白底图</strong><span>已有白底图可以不关联原图，直接作为外部导入使用。</span><div className="empty-workspace-actions"><Button onClick={() => sourceInputRef.current?.click()} disabled={uploading}><Upload size={13} />上传第一张原图</Button><Button variant="secondary" onClick={() => whiteInputRef.current?.click()} disabled={uploading}>上传外部白底图</Button></div></div> : <div className="virtual-grid" ref={scrollRef}><div style={{ height: `${virtualizer.getTotalSize()}px`, position: "relative" }}>{virtualizer.getVirtualItems().map((row) => <div key={row.key} data-index={row.index} ref={virtualizer.measureElement} style={{ position: "absolute", top: 0, left: 0, width: "100%", transform: `translateY(${row.start}px)` }}><div className="base-grid">{rows[row.index].map((asset) => <BaseImageCard key={asset.id} asset={asset} selected={selectedIds.includes(asset.id)} selectionMode={selectionMode} onSelect={() => toggle(asset.id)} onPreview={() => onSelectAsset(asset)} onExport={() => exportAsset(asset)} onDelete={() => void removeAsset(asset)} onSetCurrent={() => void setCurrent(asset)} onGenerateWhiteBackground={() => void openPrompts(asset)} isCurrent={projectDetail.selections[asset.type === "base" ? "white_background" : "source"] === asset.id} generatingBackground={generatingSourceId === asset.id ? background : whiteTasks.tasks.find(task => String(task.sourceSnapshot.assetId) === asset.id && isImageEditTaskActive(task.status))?.configSnapshot.background === "transparent" ? "transparent" : "white"} isGeneratingWhiteBackground={generatingSourceId === asset.id || activeSourceIds.has(asset.id)} />)}</div></div>)}</div></div>}
    </section></div>
    {libraryOpen && <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setLibraryOpen(false); }}><div className="dialog-panel" role="dialog" aria-modal="true"><div className="dialog-header"><h2>选择素材库</h2><Button variant="ghost" onClick={() => setLibraryOpen(false)}>关闭</Button></div><p>从素材库选择已标记为白底图的商品素材。</p>{libraryErrors.length > 0 && <div role="alert">{libraryErrors.map(message => <p key={message}>{message}</p>)}<Button variant="secondary" onClick={() => void loadLibraryItems()} disabled={libraryLoading}>重新加载图库</Button></div>}{libraryLoading ? <div className="empty-workspace">正在读取素材库...</div> : libraryItems.length === 0 ? <div className="empty-workspace">素材库暂无可用白底图</div> : <div className="library-source-list">{libraryItems.map((item) => <button className="library-source-item" key={`${item.sourceKind}-${item.libraryId}-${item.id}`} disabled={uploading} onClick={() => void importLibraryItem(item)}><img src={item.previewUrl} alt="" /><span><strong>{item.name}</strong><small>{item.source}</small></span></button>)}</div>}</div></div>}
    {generationSource && <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !generatingSourceId) setGenerationSource(null); }}><div className="dialog-panel" role="dialog" aria-modal="true" aria-label="生成商品图"><div className="dialog-header"><h2>生成商品图</h2><Button variant="ghost" onClick={() => setGenerationSource(null)} disabled={!!generatingSourceId}>关闭</Button></div><p>为“{generationSource.name}”生成{outputLabel}，结果会自动保存到当前项目。</p><fieldset className="product-background-options" disabled={!!generatingSourceId}><legend>背景类型</legend><label><input type="radio" name="product-background" checked={background === "white"} onChange={() => setBackground("white")} />白底图</label><label><input type="radio" name="product-background" checked={background === "transparent"} onChange={() => setBackground("transparent")} />透明图</label></fieldset><p>{background === "transparent" ? "保留商品原貌，去除背景，输出可叠加使用的透明 PNG。" : "保留商品原貌，替换为纯白背景并进行白底图精修。"}</p><div className="dialog-footer"><span>使用商品{outputLabel}专用提示词</span><Button onClick={() => void submitWhiteBackgroundGeneration()} disabled={!!generatingSourceId}>{generatingSourceId ? "提交中…" : `生成${outputLabel}`}</Button></div></div></div>}
  </div>;
}
