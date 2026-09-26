import React, { useState } from "react";
import { Pencil, Plus, Save } from "lucide-react";
import { modelConnectionsApi, type ApiModelConnection } from "../api/client";
import { Button } from "./ui/button";

function PromptModelForm({ connection, onSave, onCancel }: {
  connection?: ApiModelConnection;
  onSave: (connection: ApiModelConnection) => void;
  onCancel: () => void;
}) {
  const [baseUrl, setBaseUrl] = useState(connection?.baseUrl ?? "");
  const [modelName, setModelName] = useState(connection?.modelName ?? "");
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!modelName.trim() || (!apiKey.trim() && !connection?.hasApiKey)) {
      setError("请填写实际模型名和 API Key");
      return;
    }
    try {
      const url = new URL(baseUrl.trim());
      if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error();
    } catch {
      setError("接口地址须为 HTTP 或 HTTPS 地址，不能包含凭据、查询参数或片段");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const saved = await modelConnectionsApi.create({
        baseUrl: baseUrl.trim(), modelName: modelName.trim(), protocol: "openai_chat",
        ...(apiKey.trim() ? { apiKey: apiKey.trim() } : { reuseConnectionId: connection!.id }),
      });
      setApiKey("");
      onSave(saved);
    } catch {
      setError("连接保存失败，请检查接口配置或稍后重试");
    } finally {
      setSaving(false);
    }
  };
  return <form className="generation-config-inline-form" onSubmit={(event) => void save(event)}>
    <label className="generation-config-field"><span>接口地址</span><input className="ui-input" aria-label="接口地址" required disabled={saving} placeholder="https://api.example.com/v1" value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} /></label>
    <label className="generation-config-field"><span>实际模型名</span><input className="ui-input" aria-label="实际模型名" required maxLength={200} disabled={saving} placeholder="填写服务商提供的模型名称" value={modelName} onChange={(event) => setModelName(event.target.value)} /></label>
    <label className="generation-config-field"><span>API Key</span><input className="ui-input" aria-label="API Key" type="password" autoComplete="new-password" required={!connection?.hasApiKey} disabled={saving} placeholder={connection?.hasApiKey ? "已配置，留空保留原密钥" : "输入 API Key"} value={apiKey} onChange={(event) => setApiKey(event.target.value)} /></label>
    <p className="generation-config-edit-note">支持 OpenAI 兼容的 Chat Completions 接口。请选择支持图片输入和 JSON 输出的模型，用于理解商品并生成提示词。</p>
    {error && <div className="generation-config-errors" role="alert">{error}</div>}
    <div className="generation-config-form-actions"><Button size="sm" type="submit" disabled={saving}><Save size={13} />{saving ? "保存中…" : "保存"}</Button><Button size="sm" variant="ghost" type="button" disabled={saving} onClick={onCancel}>取消</Button></div>
  </form>;
}

export function PromptModelConfig({ connectionId, connections, loadState, onReload, onSelect, onCreated, onEditingChange }: {
  connectionId?: string;
  connections: ApiModelConnection[];
  loadState: "loading" | "ready" | "failed";
  onReload: () => void;
  onSelect: (connectionId: string | null) => void;
  onCreated: (connection: ApiModelConnection) => void;
  onEditingChange: (editing: boolean) => void;
}) {
  const [editing, setEditing] = useState<"new" | "edit" | null>(null);
  const chatConnections = connections.filter((item) => item.protocol === "openai_chat");
  const selectedId = connectionId === "environment-context" ? "" : connectionId ?? "";
  const current = chatConnections.find((item) => item.id === (selectedId || "environment-context"));
  const changeEditing = (value: typeof editing) => { setEditing(value); onEditingChange(Boolean(value)); };
  return <section className="generation-config-section">
    <div className="generation-config-section-head"><div><h2>提示词模型</h2><p>大语言模型 · 用于共享风格规划和各模块提示词生成</p></div><Button size="sm" disabled={Boolean(editing) || loadState !== "ready"} onClick={() => changeEditing("new")}><Plus size={14} />新增提示词模型</Button></div>
    {loadState === "failed" && <div className="generation-config-errors" role="alert"><span>模型连接加载失败，已保留当前选择。</span><Button size="sm" variant="ghost" onClick={onReload}>重新加载</Button></div>}
    {editing ? <PromptModelForm key={editing} connection={editing === "edit" ? current : undefined} onCancel={() => changeEditing(null)} onSave={(saved) => { onCreated(saved); onSelect(saved.id); changeEditing(null); }} /> : <>
      <label className="generation-config-field"><span>选择提示词模型</span><select className="ui-select" aria-label="选择提示词模型" value={selectedId} disabled={loadState !== "ready"} onChange={(event) => onSelect(event.target.value || null)}>
        <option value="">沿用后端配置{chatConnections.some((item) => item.id === "environment-context") ? "" : "（尚未配置）"}</option>
        {selectedId && !current && <option value={selectedId}>已保存的模型{loadState === "ready" ? "（连接不可用）" : ""}</option>}
        {chatConnections.filter((item) => item.id !== "environment-context").map((item) => <option key={item.id} value={item.id}>{item.modelName} · {item.baseUrl}</option>)}
      </select></label>
      {current && <article className="generation-config-card"><div className="generation-config-card-head"><strong>{current.modelName}</strong><Button size="sm" variant="ghost" disabled={loadState !== "ready"} onClick={() => changeEditing("edit")}><Pencil size={14} />编辑提示词模型</Button></div><p>{current.baseUrl}</p><p>API Key：{current.hasApiKey ? "已配置" : "未配置"}</p></article>}
      <p className="generation-config-edit-note">选择或编辑后，保存草稿并发布配置，对后续新规划生效。已有任务继续使用原方案。</p>
    </>}
  </section>;
}
