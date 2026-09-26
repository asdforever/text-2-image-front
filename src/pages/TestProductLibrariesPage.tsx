import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Database, Plus, Trash2 } from "lucide-react";
import { Button } from "../components/ui/button";
import { Dialog } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { Textarea } from "../components/ui/textarea";
import { createProductLibrary, deleteProductLibrary, listProductLibraries } from "../lib/api-asset";
import type { CreateProductLibraryInput, ProductLibrary } from "../types/asset";

export function TestProductLibrariesPage() {
  const navigate = useNavigate();
  const [libraries, setLibraries] = useState<ProductLibrary[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ProductLibrary | null>(null);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [libraryType, setLibraryType] = useState<CreateProductLibraryInput["libraryType"]>("test_result");

  const load = async () => {
    try { setLoading(true); setLibraries(await listProductLibraries()); }
    catch (value) { setError(value instanceof Error ? value.message : "加载测试库失败"); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);
  const create = async () => {
    if (!name.trim()) { setError("请输入测试库名称"); return; }
    try { await createProductLibrary({ name: name.trim(), description: description.trim() || undefined, libraryType }); setCreateOpen(false); setName(""); setDescription(""); setLibraryType("test_result"); await load(); }
    catch (value) { setError(value instanceof Error ? value.message : "创建测试库失败"); }
  };
  const remove = async () => {
    if (!deleteTarget) return;
    try { await deleteProductLibrary(deleteTarget.id); setDeleteTarget(null); await load(); }
    catch (value) { setError(value instanceof Error ? value.message : "删除测试库失败"); }
  };

  return <div className="app-shell">
    <header className="app-topbar"><div className="workspace-title"><strong>测试库</strong><span>只保存测试运行产物，不代表正式发布</span></div></header>
    <main className="management-page"><div className="management-toolbar"><div><h1>测试库</h1><p>集中查看测试生成结果；这里的内容不会自动进入正式成品库。</p></div><Button variant="secondary" onClick={() => setCreateOpen(true)}><Plus size={14} />新建测试库</Button></div>
      {loading ? <div className="page-loading"><div className="spinner" /></div> : libraries.length === 0 ? <div className="empty-state">暂无测试库，先创建一个用于接收测试结果</div> : <div className="management-grid">{libraries.map((library) => <article className="management-card" key={library.id}><div style={{ display: "flex", alignItems: "start", justifyContent: "space-between" }}><div style={{ display: "flex", alignItems: "center", gap: 8 }}><Database size={16} /><button className="text-button" onClick={() => void navigate({ to: "/test-product-libraries/$libraryId", params: { libraryId: library.id } })}>{library.name}</button></div><Button variant="ghost" size="icon" title="删除测试库" onClick={() => setDeleteTarget(library)}><Trash2 size={13} /></Button></div>{library.description && <p>{library.description}</p>}<span>{library.libraryType === "test_result" ? "测试运行结果" : "手动测试库"} · {new Date(library.createdAt).toLocaleDateString("zh-CN")}</span></article>)}</div>}
    </main>
    <Dialog open={createOpen} onOpenChange={setCreateOpen} title="新建测试库"><div className="dialog-body"><div className="form-grid"><div className="form-field"><label>名称</label><Input value={name} onChange={(event) => setName(event.target.value)} placeholder="白底图测试结果" /></div><div className="form-field"><label>描述</label><Textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="用于验证提示词版本的输出" /></div><div className="form-field"><label>库类型</label><Select value={libraryType} onChange={(event) => setLibraryType(event.target.value as CreateProductLibraryInput["libraryType"])}><option value="test_result">测试运行结果</option><option value="manual">手动测试</option></Select></div></div></div><div className="dialog-footer"><Button variant="ghost" onClick={() => setCreateOpen(false)}>取消</Button><Button variant="secondary" onClick={() => void create()}>创建</Button></div></Dialog>
    <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)} title="删除测试库"><div className="dialog-body"><p>确认删除测试库“{deleteTarget?.name}”？库内测试产物也会被删除。</p></div><div className="dialog-footer"><Button variant="ghost" onClick={() => setDeleteTarget(null)}>取消</Button><Button variant="danger" onClick={() => void remove()}>删除</Button></div></Dialog>
    {error && <div className="toast" role="alert" onClick={() => setError("")}>{error}</div>}
  </div>;
}

export default TestProductLibrariesPage;
