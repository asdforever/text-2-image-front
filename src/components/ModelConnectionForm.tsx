import React, { useState } from "react";
import { Save } from "lucide-react";
import { modelConnectionsApi, type ApiModelConnection } from "../api/client";
import type { GenerationModelDefinition } from "../lib/generation-config";
import { Button } from "./ui/button";

export function ModelConnectionForm({ initial, connection, models, onSubmit, onCancel }: {
  initial: GenerationModelDefinition;
  connection?: ApiModelConnection;
  models: GenerationModelDefinition[];
  onSubmit: (value: GenerationModelDefinition, connection: ApiModelConnection) => boolean;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  const [baseUrl, setBaseUrl] = useState(connection?.baseUrl ?? "");
  const [modelName, setModelName] = useState(connection?.modelName ?? "");
  // Credentials belong only to this short-lived form, never to the model draft.
  const [apiKey, setApiKey] = useState("");
  const [resolutions, setResolutions] = useState(initial.resolutions.join(", "));
  const [aspectRatios, setAspectRatios] = useState(initial.aspectRatios?.join(", ") ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const splitList = (text: string) => [...new Set(text.split(/[,，]/).map((item) => item.trim()).filter(Boolean))];
  const canReuseKey = Boolean(connection?.hasApiKey);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const label = value.label.trim();
    const id = value.id || label.toLocaleLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-").replace(/^-|-$/g, "") || `model-${Date.now()}`;
    if (models.some((model) => model.id !== initial.id && (model.id === id || model.label.trim().toLocaleLowerCase() === label.toLocaleLowerCase()))) {
      setError("模型名称或标识已存在，请更换名称");
      return;
    }
    const ratios = splitList(aspectRatios);
    const resolutionAliases: Record<string, string> = { "1K": "标准 1K", "2K": "高清 2K", "4K": "超清 4K" };
    const supportedResolutions = [...new Set(splitList(resolutions).map((item) => resolutionAliases[item] ?? item))];
    if (supportedResolutions.some((item) => !["标准 1K", "高清 2K", "超清 4K"].includes(item))) {
      setError("当前支持 1K、2K、4K，请以逗号分隔");
      return;
    }
    if (ratios.some((ratio) => !["1:1", "3:4", "4:3", "16:9"].includes(ratio))) {
      setError("当前支持 1:1、3:4、4:3、16:9，请以逗号分隔");
      return;
    }
    if (!label || !modelName.trim() || !splitList(resolutions).length || (!apiKey.trim() && !canReuseKey)) {
      setError("请填写模型名称、实际模型名、API Key 和分辨率");
      return;
    }
    try {
      const url = new URL(baseUrl.trim());
      if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error();
    } catch {
      setError("接口地址须为 HTTP 或 HTTPS 地址，不能包含凭据、查询参数或片段");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const saved = await modelConnectionsApi.create({
        baseUrl: baseUrl.trim(), modelName: modelName.trim(), protocol: "openai_images",
        ...(apiKey.trim() ? { apiKey: apiKey.trim() } : { reuseConnectionId: connection!.id }),
      });
      setApiKey("");
      const accepted = onSubmit({ id, label, provider: value.provider.trim(), constraints: value.constraints.trim(), resolutions: supportedResolutions, aspectRatios: ratios, connectionId: saved.id }, saved);
      if (!accepted) setError("模型配置未保存，请检查名称和必填信息后重试");
    } catch {
      // Do not display upstream error bodies: they can contain submitted credentials.
      setError("连接保存失败，请检查接口配置或稍后重试");
    } finally {
      setSaving(false);
    }
  };

  return <form className="generation-config-inline-form" onSubmit={(event) => void save(event)}>
    <label className="generation-config-field"><span>模型名称</span><input className="ui-input" aria-label="模型名称" required disabled={saving} value={value.label} onChange={(event) => setValue({ ...value, label: event.target.value })} /></label>
    <label className="generation-config-field"><span>模型厂商</span><input className="ui-input" aria-label="模型厂商" disabled={saving} value={value.provider} onChange={(event) => setValue({ ...value, provider: event.target.value })} /></label>
    <label className="generation-config-field"><span>接口地址</span><input className="ui-input" aria-label="接口地址" type="url" placeholder="https://api.example.com/v1" required disabled={saving} value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} /></label>
    <label className="generation-config-field"><span>实际模型名</span><input className="ui-input" aria-label="实际模型名" placeholder="接口服务商提供的模型标识" required disabled={saving} value={modelName} onChange={(event) => setModelName(event.target.value)} /></label>
    <label className="generation-config-field"><span>接口类型</span><select className="ui-select" aria-label="接口类型" value="openai_images" disabled={saving} onChange={() => undefined}><option value="openai_images">OpenAI 兼容图片接口</option></select></label>
    <label className="generation-config-field"><span>API Key · {canReuseKey ? "已配置，留空保留" : "未配置"}</span><input className="ui-input" aria-label="API Key" type="password" autoComplete="new-password" required={!canReuseKey} disabled={saving} placeholder={canReuseKey ? "留空保留已有 API Key" : "填写 API Key"} value={apiKey} onChange={(event) => setApiKey(event.target.value)} /></label>
    <label className="generation-config-field"><span>支持分辨率</span><input className="ui-input" aria-label="支持分辨率" placeholder="标准 1K, 高清 2K, 超清 4K" required disabled={saving} value={resolutions} onChange={(event) => setResolutions(event.target.value)} /></label>
    <label className="generation-config-field"><span>支持比例</span><input className="ui-input" aria-label="支持比例" placeholder="1:1, 4:3, 3:4；留空不限制" disabled={saving} value={aspectRatios} onChange={(event) => setAspectRatios(event.target.value)} /></label>
    <label className="generation-config-field"><span>模型说明（选填）</span><textarea className="ui-textarea" aria-label="模型约束" disabled={saving} value={value.constraints} onChange={(event) => setValue({ ...value, constraints: event.target.value })} /></label>
    {error && <p className="generation-config-errors" role="alert">{error}</p>}
    <p className="generation-config-edit-note">保存连接后，请保存草稿并发布配置，后续生成才会使用新连接。</p>
    <div className="generation-config-form-actions"><Button size="sm" type="submit" disabled={saving}><Save size={13} />{saving ? "保存中…" : "保存"}</Button><Button size="sm" variant="ghost" type="button" disabled={saving} onClick={onCancel}>取消</Button></div>
  </form>;
}
