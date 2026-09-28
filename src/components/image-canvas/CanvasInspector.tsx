import { useEffect, useState } from "react";
import { ArrowUpRight, Download, Expand, Sparkles, X } from "lucide-react";
import type { ApiTaskVersion } from "../../api/client";
import { categoryNames, imagePrompt, type CanvasImage } from "./model";
import { DesignBrief } from "./DesignBrief";

export function CanvasInspector({ image, close, preview, edit, generate, savePrompt, selectVersion, showVersion, download, compareVersion, busy }: {
  image: CanvasImage; close: () => void; preview: () => void; edit: () => void; generate: () => void;
  savePrompt: (prompt: string, params: Record<string, unknown>) => Promise<void>;
  selectVersion: (version: ApiTaskVersion, selection: "current" | "final") => void;
  showVersion: (version: ApiTaskVersion) => void; download: () => void; compareVersion: (version: ApiTaskVersion) => void; busy: boolean;
}) {
  const [prompt, setPrompt] = useState(image.task?.promptDraft ?? imagePrompt(image));
  const [ratio, setRatio] = useState(String(image.task?.generationParams.ratio ?? "1:1"));
  const [size, setSize] = useState(String(image.task?.generationParams.size ?? "1K"));
  useEffect(() => { setPrompt(image.task?.promptDraft ?? imagePrompt(image)); setRatio(String(image.task?.generationParams.ratio ?? "1:1")); setSize(String(image.task?.generationParams.size ?? "1K")); }, [image.id, image.task?.promptDraft, image.version?.id]);
  const canSave = !!image.task && !image.editTask;
  return <aside className="ic-inspector" aria-label="图片属性">
    <header><strong>图片详情</strong><button aria-label="关闭图片属性" onClick={close}><X size={16} /></button></header>
    <div className="ic-inspector-scroll">
      <button className="ic-detail-preview" onClick={preview} disabled={!image.url}>{image.url ? <img src={image.url} alt={image.title} /> : <span>尚未生成图片</span>}<Expand size={16} /></button>
      <div className="ic-detail-title"><span>{categoryNames[image.category]}</span><h2 title={image.title}>{image.title}</h2><small>{image.width > 1 && image.height > 1 ? `${image.width} × ${image.height}` : "原始尺寸"}{image.version ? ` · v${image.version.versionNumber}` : ""}</small></div>
      <div className="ic-detail-actions"><button className="ic-primary" title={!image.assetId ? "此历史图片尚未关联可编辑的项目资产" : "基于此图片创建修改版本"} onClick={edit} disabled={!image.url || !image.assetId || busy}><Sparkles size={15} />编辑图片</button><button aria-label="下载图片" disabled={!image.url || busy} onClick={download}><Download size={16} /></button></div>
      {!image.assetId && <p className="ic-note">这张历史图片尚未关联项目资产，目前可预览、对比与下载。</p>}
      <DesignBrief parameters={image.generation?.parameters} />
      <section><h3>提示词{image.version ? "与生成参数" : ""}</h3><label><span>{canSave ? "提示词草稿" : "图片提示词"}</span><textarea aria-label={canSave ? "提示词草稿" : "图片提示词"} value={prompt} readOnly={!canSave} onChange={(event) => setPrompt(event.target.value)} placeholder="此图片未记录提示词，请在前置提示词节点中修改" /></label>
        {canSave && <><div className="ic-param-row"><label>比例<select value={ratio} onChange={(event) => setRatio(event.target.value)}>{["1:1", "3:4", "4:3", "9:16", "16:9"].map((value) => <option key={value}>{value}</option>)}</select></label><label>分辨率<select value={size} onChange={(event) => setSize(event.target.value)}>{["1K", "2K", "4K"].map((value) => <option key={value}>{value}</option>)}</select></label></div><button className="ic-full-button" disabled={busy} onClick={() => void savePrompt(prompt, { ratio, size })}>保存提示词</button></>}
        {image.task && <button className="ic-full-button" disabled={busy || ["generating", "pending"].includes(image.task.status)} onClick={generate}><Sparkles size={14} />{image.url ? "再次生成" : "生成图片"}<ArrowUpRight size={14} /></button>}
      </section>
      {!!image.versions.length && <section><h3>历史版本 <small>{image.versions.length}</small></h3><select aria-label={`选择${image.title}版本`} value={image.version?.id ?? ""} onChange={(event) => { const v = image.versions.find((v) => v.id === event.target.value); if (v) showVersion(v); }}>{image.versions.map((v) => <option key={v.id} value={v.id}>v{v.versionNumber}{v.isCurrent ? " · 当前" : ""}{v.isFinal ? " · 终版" : ""}</option>)}</select>
        <div className="ic-version-list">{image.versions.slice().reverse().map((version) => <button className={image.version?.id === version.id ? "is-active" : ""} key={version.id} onClick={() => showVersion(version)}><img src={version.previewUrl} alt={`版本 ${version.versionNumber}`} /><span>版本 {version.versionNumber}<small>{version.isFinal ? "终版" : version.isCurrent ? "当前使用" : "历史记录"}</small></span></button>)}</div>
        {image.version && <div className="ic-version-actions"><button disabled={busy || image.version.isCurrent} onClick={() => selectVersion(image.version!, "current")}>{image.version.isCurrent ? "当前版本" : "设为当前"}</button>{!image.canvasVersion && <button disabled={busy || image.version.isFinal} onClick={() => selectVersion(image.version!, "final")}>{image.version.isFinal ? "已是终版" : "设为终版"}</button>}{image.versions.some((v) => v.id !== image.version?.id) && <button onClick={() => compareVersion(image.versions.find((v) => v.id !== image.version?.id)!)}>对比其他版本</button>}</div>}
      </section>}
      <p className="ic-note">编辑会保留原图。移出画布不会删除项目中的图片。</p>
    </div>
  </aside>;
}
