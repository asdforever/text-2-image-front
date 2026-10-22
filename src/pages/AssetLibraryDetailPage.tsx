import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { ArrowLeft, FileText, Image as ImageIcon, Plus, RefreshCw, Search, Trash2, Upload, ExternalLink } from "lucide-react";
import { Button } from "../components/ui/button";
import { Dialog } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import type { AssetLibrary, Asset } from "../types/asset";
import { getAssetLibrary, updateAssetLibrary, listAssets, createAsset, deleteAsset } from "../lib/api-asset";
import "./reference-pages.css";
import "./reference-library-details.css";

export function AssetLibraryDetailPage() {
  const navigate = useNavigate();
  const { libraryId } = useParams({ from: "/asset-libraries/$libraryId" });
  const [loadedLibrary, setLibrary] = useState<AssetLibrary | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Asset | null>(null);
  const [preview, setPreview] = useState<Asset | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);
  const operation = useRef(0);
  const sequence = useRef(0);
  const currentId = useRef(libraryId);
  currentId.current = libraryId;
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [uploadName, setUploadName] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadText, setUploadText] = useState("");
  const library = loadedLibrary?.id === libraryId ? loadedLibrary : null;

  useEffect(() => {
    operation.current++; pending.current = false; setSaving(false);
    setUploadOpen(false); setEditOpen(false); setDeleteTarget(null); setPreview(null); setQuery("");
    setUploadName(""); setUploadFile(null); setUploadText("");
    void loadData();
    return () => { sequence.current++; operation.current++; };
  }, [libraryId]);

  async function loadData() {
    const request = ++sequence.current;
    setLoading(true); setError("");
    try {
      const [lib, items] = await Promise.all([getAssetLibrary(libraryId), listAssets(libraryId)]);
      if (request !== sequence.current || currentId.current !== libraryId) return;
      setLibrary(lib); setAssets(items);
    } catch (value) {
      if (request === sequence.current && currentId.current === libraryId) setError(value instanceof Error ? value.message : "加载素材失败");
    } finally {
      if (request === sequence.current && currentId.current === libraryId) setLoading(false);
    }
  }

  async function mutate(action: () => Promise<unknown>, success: () => void, fallback: string) {
    if (pending.current) return;
    const token = ++operation.current;
    pending.current = true; setSaving(true); setError("");
    try {
      await action();
      if (token !== operation.current || currentId.current !== libraryId) return;
      success();
      await loadData();
    } catch (value) {
      if (token === operation.current && currentId.current === libraryId) setError(value instanceof Error ? value.message : fallback);
    } finally {
      if (token === operation.current) { pending.current = false; setSaving(false); }
    }
  }

  function handleEdit() {
    if (!library || !editName.trim()) { setError("请输入名称"); return; }
    void mutate(() => updateAssetLibrary(library.id, { name: editName.trim(), description: editDescription.trim() }), () => setEditOpen(false), "更新失败");
  }
  function handleUpload() {
    if (!library || !uploadName.trim()) { setError("请输入素材名称"); return; }
    if (library.assetType === "image" && !uploadFile) { setError("请选择图片文件"); return; }
    if (library.assetType === "text" && !uploadText.trim()) { setError("请输入文本内容"); return; }
    void mutate(() => createAsset(library.id, { name: uploadName.trim(), file: library.assetType === "image" ? uploadFile! : undefined, content: library.assetType === "text" ? uploadText.trim() : undefined }), () => {
      setUploadOpen(false); setUploadName(""); setUploadFile(null); setUploadText("");
    }, "上传失败");
  }
  function handleDelete() {
    if (!library || !deleteTarget) return;
    const target = deleteTarget;
    void mutate(() => deleteAsset(library.id, target.id), () => {
      setAssets(current => current.filter(asset => asset.id !== target.id)); setDeleteTarget(null);
    }, "删除失败");
  }
  const visible = assets.filter(asset => `${asset.name} ${asset.content ?? ""}`.toLowerCase().includes(query.trim().toLowerCase()));
  const modalOpen = uploadOpen || editOpen || !!deleteTarget;
  const feedback = error && <div className="upload-feedback" role="alert"><span>{error}</span>{!modalOpen && <Button variant="secondary" size="sm" disabled={loading} onClick={() => void loadData()}>重试</Button>}</div>;
  const closeModal = (close: () => void) => { if (!pending.current) { close(); setError(""); } };

  return <div className="app-shell reference-library reference-assets reference-detail">
    <header className="app-topbar"><div className="workspace-title"><strong>素材库</strong><span>{library?.name || "查看与整理素材"}</span></div></header>
    <main className="management-page">
      <Button className="reference-detail-back" variant="ghost" size="sm" onClick={() => void navigate({ to: "/asset-libraries" })}><ArrowLeft size={14} />返回素材库列表</Button>
      {!modalOpen && feedback}
      {library && <>
        <div className="reference-library-heading reference-detail-heading"><div><h1>{library.name}</h1><p>{library.description || "整理这个库中的素材，供项目使用"}</p></div><div className="reference-detail-actions">
          <Button variant="secondary" disabled={saving} onClick={() => { setError(""); setEditName(library.name); setEditDescription(library.description || ""); setEditOpen(true); }}>编辑信息</Button>
          <Button disabled={saving} onClick={() => { setError(""); setUploadName(""); setUploadFile(null); setUploadText(""); setUploadOpen(true); }}><Plus size={14} />添加素材</Button>
        </div></div>
        <div className="reference-library-filters"><label className="management-search"><Search size={15} /><input type="search" aria-label="搜索库内素材" placeholder="搜索素材名称或文本内容" value={query} onChange={event => setQuery(event.target.value)} /></label>
          <span className="reference-status active">{library.assetType === "image" ? "图片素材" : "文本素材"}</span>
          <Button variant="secondary" disabled={loading || saving} aria-label="刷新素材" onClick={() => void loadData()}><RefreshCw size={14} />刷新</Button><span className="reference-library-result">{visible.length} / {assets.length} 个素材</span>
        </div>
        {visible.length ? <div className="reference-media-grid">{visible.map(asset => <article className="reference-media-card" key={asset.id}>
          <button type="button" className="reference-media-open" aria-label={`预览素材 ${asset.name}`} onClick={() => setPreview(asset)}>
            <div className={`reference-media-preview ${asset.assetType === "text" ? "is-text" : ""}`}>
              {asset.assetType === "image" ? asset.url ? <img src={asset.url} alt={asset.name} loading="lazy" /> : <ImageIcon size={30} /> : <><FileText size={24} /><p>{asset.content || "暂无文本内容"}</p></>}
              <span className="reference-media-hint">{asset.assetType === "image" ? "查看大图" : "查看全文"}</span>
            </div>
            <div className="reference-media-meta"><h2 title={asset.name}>{asset.name}</h2><span>{asset.assetType === "image" && asset.width && asset.height ? `${asset.width} × ${asset.height}` : "文本素材"}{asset.fileSize ? ` · ${(asset.fileSize / 1024).toFixed(1)} KB` : ""}</span><small>创建于 {new Date(asset.createdAt).toLocaleDateString("zh-CN")}</small></div>
          </button>
          <div className="reference-media-actions"><Button variant="ghost" size="icon" disabled={saving} aria-label={`删除素材 ${asset.name}`} onClick={() => { setError(""); setDeleteTarget(asset); }}><Trash2 size={13} /></Button></div>
        </article>)}</div> : <div className="empty-state">{assets.length ? "没有匹配的素材，试试其他关键词" : "暂无素材，点击上方按钮添加"}</div>}
      </>}
      {!library && (loading ? <div className="page-loading" role="status" aria-label="正在加载素材"><div className="spinner" /></div> : !error && <div className="empty-state">素材库不存在</div>)}
    </main>
    <Dialog open={editOpen} onOpenChange={open => { if (!open) closeModal(() => setEditOpen(false)); }} title="编辑素材库" eyebrow="素材管理">
      <div className="dialog-body">{feedback}<div className="form-grid">
        <div className="form-field"><label htmlFor="edit-library-name">名称</label><Input id="edit-library-name" disabled={saving} value={editName} onChange={event => setEditName(event.target.value)} /></div>
        <div className="form-field"><label htmlFor="edit-library-description">描述</label><Textarea id="edit-library-description" disabled={saving} value={editDescription} onChange={event => setEditDescription(event.target.value)} /></div>
      </div></div><div className="dialog-footer"><Button variant="ghost" disabled={saving} onClick={() => closeModal(() => setEditOpen(false))}>取消</Button><Button disabled={saving} onClick={handleEdit}>{saving ? "保存中…" : "保存"}</Button></div>
    </Dialog>
    <Dialog open={uploadOpen} onOpenChange={open => { if (!open) closeModal(() => setUploadOpen(false)); }} title="添加素材" eyebrow="素材管理">
      <div className="dialog-body">{feedback}<div className="form-grid">
        <div className="form-field"><label htmlFor="upload-asset-name">素材名称</label><Input id="upload-asset-name" disabled={saving} value={uploadName} onChange={event => setUploadName(event.target.value)} placeholder="例如：商品正面白底图" /></div>
        {library?.assetType === "image" ? <div className="form-field"><label htmlFor="upload-asset-file">图片文件</label><Input id="upload-asset-file" type="file" accept="image/*" disabled={saving} onChange={event => setUploadFile(event.target.files?.[0] || null)} /></div>
          : <div className="form-field"><label htmlFor="upload-asset-text">文本内容</label><Textarea id="upload-asset-text" disabled={saving} value={uploadText} onChange={event => setUploadText(event.target.value)} placeholder="输入文本内容" rows={6} /></div>}
      </div></div><div className="dialog-footer"><Button variant="ghost" disabled={saving} onClick={() => closeModal(() => setUploadOpen(false))}>取消</Button><Button disabled={saving} onClick={handleUpload}><Upload size={14} />{saving ? "上传中…" : "上传"}</Button></div>
    </Dialog>
    {deleteTarget && <Dialog open onOpenChange={open => { if (!open) closeModal(() => setDeleteTarget(null)); }} title="确认删除" eyebrow="素材管理">
      <div className="dialog-body">{feedback}<p>确定删除素材「{deleteTarget.name}」？此操作无法恢复。</p></div><div className="dialog-footer"><Button variant="ghost" disabled={saving} onClick={() => closeModal(() => setDeleteTarget(null))}>取消</Button><Button variant="danger" disabled={saving} onClick={handleDelete}>{saving ? "删除中…" : "删除"}</Button></div>
    </Dialog>}
    {preview && <Dialog open onOpenChange={open => { if (!open) setPreview(null); }} title={preview.name} eyebrow={preview.assetType === "image" ? "图片预览" : "文本素材"}>
      <div className="dialog-body reference-preview-body">{preview.assetType === "image" ? preview.url ? <><img className="reference-preview-image" src={preview.url} alt={preview.name} /><a className="reference-preview-original" href={preview.url} target="_blank" rel="noreferrer"><ExternalLink size={13} />打开原尺寸图片</a></> : <div className="empty-state">这张素材暂无预览</div> : <pre className="reference-preview-text">{preview.content || "暂无文本内容"}</pre>}</div>
    </Dialog>}
  </div>;
}

export default AssetLibraryDetailPage;
