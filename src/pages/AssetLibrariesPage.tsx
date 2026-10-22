import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowUpRight, Plus, RefreshCw, Search, Trash2, Image as ImageIcon, FileText, FolderOpen } from "lucide-react";
import { Button } from "../components/ui/button";
import { Dialog } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { Textarea } from "../components/ui/textarea";
import type { AssetLibrary, CreateAssetLibraryInput } from "../types/asset";
import { listAssetLibraries, createAssetLibrary, deleteAssetLibrary } from "../lib/api-asset";
import "./reference-pages.css";

export function AssetLibrariesPage() {
  const navigate = useNavigate();
  const [libraries, setLibraries] = useState<AssetLibrary[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AssetLibrary | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);
  const loadSequence = useRef(0);
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formAssetType, setFormAssetType] = useState<"image" | "text">("image");

  useEffect(() => {
    void loadLibraries();
    return () => { loadSequence.current++; };
  }, []);

  async function loadLibraries() {
    const sequence = ++loadSequence.current;
    setLoading(true);
    setError("");
    try {
      const data = await listAssetLibraries();
      if (sequence === loadSequence.current) setLibraries(data);
    } catch (err) {
      if (sequence === loadSequence.current) setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      if (sequence === loadSequence.current) setLoading(false);
    }
  }

  async function handleCreate() {
    if (pending.current) return;
    if (!formName.trim()) { setError("请输入名称"); return; }
    pending.current = true;
    setSaving(true);
    setError("");
    try {
      const input: CreateAssetLibraryInput = { name: formName.trim(), description: formDescription.trim() || undefined, assetType: formAssetType };
      await createAssetLibrary(input);
      setCreateOpen(false);
      setFormName(""); setFormDescription(""); setFormAssetType("image");
      await loadLibraries();
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建失败");
    } finally { pending.current = false; setSaving(false); }
  }

  async function handleDelete() {
    if (!deleteTarget || pending.current) return;
    pending.current = true;
    setSaving(true);
    setError("");
    try {
      await deleteAssetLibrary(deleteTarget.id);
      setLibraries(current => current.filter(item => item.id !== deleteTarget.id));
      setDeleteTarget(null);
      await loadLibraries();
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败");
    } finally { pending.current = false; setSaving(false); }
  }

  const visible = libraries.filter(item => (type === "all" || item.assetType === type)
    && `${item.name} ${item.description ?? ""}`.toLowerCase().includes(query.trim().toLowerCase()));
  const feedback = error && <div className="upload-feedback" role="alert"><span>{error}</span>
    {!createOpen && !deleteTarget && <Button variant="secondary" size="sm" disabled={loading} onClick={() => void loadLibraries()}>重试</Button>}
  </div>;

  return <div className="app-shell reference-library reference-assets">
    <header className="app-topbar"><div className="workspace-title"><strong>素材库</strong><span>商品原图、参考图与文案，随时取用</span></div></header>
    <main className="management-page">
      <div className="reference-library-heading"><div><h1>素材库</h1><p>集中整理可以重复使用的素材</p></div>
        <Button disabled={saving} onClick={() => { setError(""); setCreateOpen(true); }}><Plus size={14} />新建素材库</Button>
      </div>
      <div className="reference-project-stats reference-three-stats" aria-label="素材库概况">
        <div><small><FolderOpen size={13} />全部素材库</small><strong>{libraries.length}</strong></div>
        <div className="is-active"><small><ImageIcon size={13} />图片素材库</small><strong>{libraries.filter(item => item.assetType === "image").length}</strong></div>
        <div><small><FileText size={13} />文本素材库</small><strong>{libraries.filter(item => item.assetType === "text").length}</strong></div>
      </div>
      <div className="reference-library-filters">
        <label className="management-search"><Search size={15} /><input type="search" aria-label="搜索素材库" placeholder="搜索素材库名称或描述" value={query} onChange={event => setQuery(event.target.value)} /></label>
        <select className="reference-library-select" aria-label="素材类型筛选" value={type} onChange={event => setType(event.target.value)}><option value="all">全部类型</option><option value="image">图片素材</option><option value="text">文本素材</option></select>
        <Button variant="secondary" disabled={loading || saving} aria-label="刷新素材库" onClick={() => void loadLibraries()}><RefreshCw size={14} className={loading ? "spin" : ""} />刷新</Button>
        <span className="reference-library-result">{visible.length} 个素材库</span>
      </div>
      {!createOpen && !deleteTarget && feedback}
      {loading && !libraries.length ? <div className="page-loading" role="status" aria-label="正在加载素材库"><div className="spinner" /></div>
        : visible.length ? <div className="management-grid">{visible.map(item => <article key={item.id} className="management-card reference-management-card reference-asset-card">
          <button type="button" className="reference-management-open" aria-label={`打开素材库 ${item.name}`} onClick={() => void navigate({ to: "/asset-libraries/$libraryId", params: { libraryId: item.id } })}>
            <div className={`reference-management-thumb reference-asset-symbol ${item.assetType}`}>
              {item.assetType === "image" ? <ImageIcon size={32} strokeWidth={1.3} /> : <FileText size={32} strokeWidth={1.3} />}
            </div>
            <div className="reference-management-copy"><h2 title={item.name}>{item.name}</h2><div>
              <span className={`reference-status ${item.assetType === "image" ? "active" : ""}`}>{item.assetType === "image" ? "图片素材" : "文本素材"}</span>
              <p className="reference-card-description">{item.description || "添加素材，供各个项目使用"}</p>
              <p>创建于 {new Date(item.createdAt).toLocaleDateString("zh-CN")}</p>
            </div></div><ArrowUpRight size={15} className="reference-management-arrow" />
          </button>
          <div className="reference-card-actions"><Button className="reference-card-danger" variant="ghost" size="icon" disabled={saving} aria-label={`删除素材库 ${item.name}`} onClick={() => { setError(""); setDeleteTarget(item); }}><Trash2 size={13} /></Button></div>
        </article>)}</div>
        : !error && <div className="empty-state">{libraries.length ? "没有匹配的素材库，试试其他关键词或类型" : "暂无素材库，点击上方按钮创建第一个"}</div>}
    </main>
    <Dialog open={createOpen} onOpenChange={open => { if (!pending.current) { setCreateOpen(open); setError(""); } }} title="新建素材库" eyebrow="素材管理">
      <div className="dialog-body">{feedback}<div className="form-grid">
        <div className="form-field"><label htmlFor="library-name">名称</label><Input id="library-name" disabled={saving} value={formName} onChange={event => setFormName(event.target.value)} placeholder="例如：鼠标商品原图" /></div>
        <div className="form-field"><label htmlFor="library-description">描述（可选）</label><Textarea id="library-description" disabled={saving} value={formDescription} onChange={event => setFormDescription(event.target.value)} placeholder="记录素材内容和用途" /></div>
        <div className="form-field"><label htmlFor="library-type">素材类型</label><Select id="library-type" disabled={saving} value={formAssetType} onChange={event => setFormAssetType(event.target.value as "image" | "text")}><option value="image">图片</option><option value="text">文本</option></Select></div>
      </div></div>
      <div className="dialog-footer"><Button variant="ghost" disabled={saving} onClick={() => { setCreateOpen(false); setError(""); }}>取消</Button><Button disabled={saving} onClick={() => void handleCreate()}>{saving ? "创建中…" : "创建"}</Button></div>
    </Dialog>
    {deleteTarget && <Dialog open onOpenChange={open => { if (!open && !pending.current) { setDeleteTarget(null); setError(""); } }} title="确认删除" eyebrow="素材管理">
      <div className="dialog-body">{feedback}<p>确定删除素材库「{deleteTarget.name}」？此操作会同时删除库内所有素材，无法恢复。</p></div>
      <div className="dialog-footer"><Button variant="ghost" disabled={saving} onClick={() => { setDeleteTarget(null); setError(""); }}>取消</Button><Button variant="danger" disabled={saving} onClick={() => void handleDelete()}>{saving ? "删除中…" : "删除"}</Button></div>
    </Dialog>}
  </div>;
}

export default AssetLibrariesPage;
