import { Edit3, History, Search, Store, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { suiteApi, ApiResultUnknownError, createIdempotencyKey, type ApiPromptTemplate, type ApiPromptTemplateDetail, type ApiPromptVersion } from "../api/client";
import { Button } from "../components/ui/button";

export function PromptMarketplacePage() {
  const [items, setItems] = useState<ApiPromptTemplate[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<ApiPromptTemplateDetail | null>(null);
  const [editing, setEditing] = useState<ApiPromptVersion | null>(null);
  const [draft, setDraft] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [creating, setCreating] = useState(false);
  const [creatingPrompt, setCreatingPrompt] = useState(false);
  const [createError, setCreateError] = useState("");
  const emptyPrompt = { code: "", name: "", kind: "image_to_image", kindName: "图生图", executionTarget: "llm", body: "", userPromptTemplate: "" };
  const [newPrompt, setNewPrompt] = useState(emptyPrompt);
  const [idempotencyKey, setIdempotencyKey] = useState(() => createIdempotencyKey());

  const isDirty = newPrompt.code !== "" || newPrompt.name !== "" || newPrompt.body !== "" || newPrompt.userPromptTemplate !== "";
  const confirmClose = () => {
    if (!isDirty) { setCreating(false); return; }
    if (confirm("确定放弃已填写的内容？")) { setCreating(false); setNewPrompt(emptyPrompt); setCreateError(""); setIdempotencyKey(createIdempotencyKey()); }
  };

  const refresh = () => suiteApi.listPromptTemplates().then(setItems).catch(() => setItems([]));
  useEffect(() => { void refresh(); }, []);
  const filtered = useMemo(() => items.filter((item) => `${item.name} ${item.code} ${item.kind}`.toLowerCase().includes(query.toLowerCase())), [items, query]);

  const open = async (item: ApiPromptTemplate) => { try { setSelected(await suiteApi.getPromptTemplate(item.id)); } catch { setMessage("加载提示词失败"); } };
  const beginEdit = (version: ApiPromptVersion) => { setEditing(version); setDraft(version.body); setNote(""); };
  const save = async () => {
    if (!selected || !editing || !draft.trim()) return;
    try {
      await suiteApi.createPromptVersion(selected.id, { baseVersionId: editing.id, body: draft, changeNote: note || undefined });
      setMessage("已保存为新版本");
      setSelected(await suiteApi.getPromptTemplate(selected.id));
      setEditing(null);
      await refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "保存失败"); }
  };
  const retry = async (version: ApiPromptVersion) => { try { await suiteApi.retryPromptSync(version.id); if (selected) setSelected(await suiteApi.getPromptTemplate(selected.id)); setMessage("文件已同步"); } catch { setMessage("同步重试失败"); } };
  const create = async () => {
    setCreateError("");
    if (!newPrompt.code.trim() || !newPrompt.name.trim() || !newPrompt.body.trim()) { setCreateError("请填写 code、名称和 System Prompt"); return; }
    if (!/^[a-z0-9][a-z0-9._-]*$/i.test(newPrompt.code.trim())) { setCreateError("code 只能包含字母、数字、点、下划线和短横线"); return; }
    setCreatingPrompt(true);
    try {
      const result = await suiteApi.createPromptTemplate({ ...newPrompt, code: newPrompt.code.trim(), name: newPrompt.name.trim(), body: newPrompt.body.trim() }, idempotencyKey);
      setMessage(`已创建 v${result.version.versionNo}`);
      setCreating(false);
      setNewPrompt(emptyPrompt);
      setIdempotencyKey(createIdempotencyKey());
      await refresh();
    } catch (error) {
      if (error instanceof ApiResultUnknownError) {
        setCreateError("创建结果未确认，请刷新列表核对");
        void refresh();
      } else {
        setCreateError(error instanceof Error ? `创建失败：${error.message}` : "创建失败，请检查后端服务和数据库连接");
      }
    } finally {
      setCreatingPrompt(false);
    }
  };

  const openCreate = () => { setCreateError(""); setCreating(true); setIdempotencyKey(createIdempotencyKey()); };

  return <div className="app-shell">
    <header className="app-topbar"><div className="workspace-title"><Store size={16} /><div><strong>提示词商城</strong><span>按模板浏览版本，默认使用最新版本</span></div></div></header>
    <main className="marketplace-page">
      <div className="marketplace-toolbar"><div><h1>提示词商城</h1><p>一个提示词一个卡片，历史版本在详情中管理。</p></div><div className="marketplace-actions"><label className="marketplace-search"><Search size={15} /><input className="marketplace-search-field" value={query} placeholder="搜索提示词" onChange={(event) => setQuery(event.target.value)} /></label><Button className="marketplace-create-button" size="sm" onClick={openCreate}>新建提示词</Button></div></div>
      {message && <div className="upload-feedback" role="status">{message}</div>}
      {filtered.length === 0 ? <div className="empty-state"><p>暂无提示词模板</p><Button onClick={openCreate}>新建提示词</Button></div> : <div className="prompt-grid">{filtered.map((item) => <article className="prompt-card" key={item.id} onClick={() => void open(item)}><span className="target-pill">{item.stage}</span><h2>{item.name}</h2><p>{item.code} · 默认 v{item.defaultVersion?.versionNo ?? "-"} · {item.versionCount} 个版本</p><Button variant="secondary" size="sm"><History size={13} />查看版本</Button></article>)}</div>}
      {creating && <div className="prompt-detail-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) confirmClose(); }}><section className="prompt-detail prompt-create-form" role="dialog" aria-modal="true" aria-labelledby="prompt-create-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="prompt-create-header"><div><strong id="prompt-create-title">新建提示词</strong><span>首次保存将创建 v1</span></div><button type="button" className="prompt-create-close" aria-label="关闭新建提示词" onClick={() => confirmClose()}>×</button></header>
        <div className="prompt-create-fields">
          <label className="prompt-form-field"><span>Code <em>必填</em></span><input value={newPrompt.code} placeholder="例如 product.white-background" onChange={(event) => setNewPrompt({ ...newPrompt, code: event.target.value })} /></label>
          <label className="prompt-form-field"><span>名称 <em>必填</em></span><input value={newPrompt.name} placeholder="例如：商品白底图生成" onChange={(event) => setNewPrompt({ ...newPrompt, name: event.target.value })} /></label>
          <div className="prompt-create-meta">
            <label className="prompt-form-field"><span>类型</span><select value={newPrompt.kind} onChange={(event) => { const kind = event.target.value; const kindNameMap: Record<string, string> = { "image_to_image": "图生图", "text_to_image": "文生图", "text_to_text": "文生文", "image_to_text": "图生文" }; setNewPrompt({ ...newPrompt, kind, kindName: kindNameMap[kind] || "" }); }}><option value="image_to_image">图生图</option><option value="text_to_image">文生图</option><option value="text_to_text">文生文</option><option value="image_to_text">图生文</option></select></label>
          </div>
          <label className="prompt-form-field prompt-system-field"><span>System Prompt <em>必填</em></span><textarea rows={8} value={newPrompt.body} placeholder="描述模型应遵循的系统行为和输出要求" onChange={(event) => setNewPrompt({ ...newPrompt, body: event.target.value })} /></label>
          <label className="prompt-form-field"><span>User Prompt Template <small>可选</small></span><textarea rows={4} value={newPrompt.userPromptTemplate} placeholder="可选：定义传给模型的用户提示词模板" onChange={(event) => setNewPrompt({ ...newPrompt, userPromptTemplate: event.target.value })} /></label>
        </div>
        {createError && <div className="prompt-create-error" role="alert">{createError}</div>}
        <div className="prompt-create-actions"><Button variant="secondary" disabled={creatingPrompt} onClick={() => confirmClose()}>取消</Button><Button disabled={creatingPrompt} onClick={() => void create()}>{creatingPrompt ? "创建中…" : "创建 v1"}</Button></div>
      </section></div>}
      {selected && <div className="prompt-detail-backdrop" role="presentation" onClick={() => setSelected(null)}><section className="prompt-detail" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <div className="workspace-title"><strong>{selected.name}</strong><span>{selected.code} · 默认 v{selected.defaultVersion?.versionNo ?? "-"}</span></div>
        <div className="prompt-version-list">{selected.versions.map((version) => <div className="review-card" key={version.id}><div><strong>v{version.versionNo} {version.id === selected.defaultVersionId && "· 默认"}</strong><p>{version.source} · {new Date(version.createdAt).toLocaleString()} · {version.changeNote || "无修改说明"}</p><p>文件：{version.fileSyncStatus}{version.fileSyncError ? ` · ${version.fileSyncError}` : ""}</p></div><div className="dialog-footer"><Button size="sm" variant="secondary" onClick={() => beginEdit(version)}><Edit3 size={13} />基于此版本编辑</Button>{version.fileSyncStatus === "failed" && <Button size="sm" variant="secondary" onClick={() => void retry(version)}><RefreshCw size={13} />重试同步</Button>}</div></div>)}</div>
        {editing && <div className="review-card"><strong>编辑 v{editing.versionNo}，保存后生成新版本</strong><textarea value={draft} onChange={(event) => setDraft(event.target.value)} rows={10} /><input value={note} placeholder="修改说明（可选）" onChange={(event) => setNote(event.target.value)} /><div className="dialog-footer"><Button variant="secondary" onClick={() => setEditing(null)}>取消</Button><Button onClick={() => void save()}>保存为新版本</Button></div></div>}
        {!editing && <div className="dialog-footer"><Button variant="secondary" onClick={() => setSelected(null)}>关闭</Button></div>}
      </section></div>}
    </main>
  </div>;
}
