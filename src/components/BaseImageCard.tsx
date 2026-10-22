import React from "react";
import { Check, Download, Eye, Sparkles, Trash2 } from "lucide-react";
import type { Asset } from "../api/contracts";
import { Button } from "./ui/button";

interface BaseImageCardProps {
  asset: Asset;
  selected: boolean;
  selectionMode: boolean;
  onSelect: () => void;
  onPreview: () => void;
  onExport: () => void;
  onDelete: () => void;
  onSetCurrent: () => void;
  onGenerateWhiteBackground: () => void;
  isCurrent: boolean;
  isGeneratingWhiteBackground: boolean;
  generatingBackground?: "white" | "transparent";
}

export function BaseImageCard({ asset, selected, selectionMode, onSelect, onPreview, onExport, onDelete, onSetCurrent, onGenerateWhiteBackground, isCurrent, isGeneratingWhiteBackground, generatingBackground }: BaseImageCardProps) {
  const label = (isGeneratingWhiteBackground ? generatingBackground : asset.background) === "transparent" ? "透明图" : "白底图";
  return <article className={`base-card ${selected ? "selected" : ""}`}>
    <div className={`base-card-image ${asset.background === "transparent" ? "is-transparent" : ""}`}>
      <button type="button" className="base-card-preview" aria-label={`查看素材 ${asset.name}`} onClick={onPreview}><img src={asset.url} alt={asset.name} loading="lazy" /></button>
      {selectionMode && <input className="base-card-check" type="checkbox" checked={selected} onChange={onSelect} aria-label={`选择 ${asset.name}`} />}
      <div className="base-card-hover">{asset.type === "source" && <Button size="sm" variant="secondary" title={isGeneratingWhiteBackground ? `正在生成${label}` : "生成白底图"} onClick={onGenerateWhiteBackground} disabled={isGeneratingWhiteBackground}><Sparkles size={12} /></Button>}<Button size="sm" variant="secondary" title={isCurrent ? "当前使用的图片" : "设为当前使用"} onClick={onSetCurrent} disabled={isCurrent}><Check size={12} /></Button><Button size="sm" variant="secondary" title="查看大图" onClick={onPreview}><Eye size={12} /></Button><Button size="sm" variant="secondary" title="导出" onClick={onExport}><Download size={12} /></Button><Button size="sm" variant="danger" title="删除" onClick={onDelete}><Trash2 size={12} /></Button></div>
    </div>
    <div className="base-card-meta"><strong>{asset.name}</strong><span>{asset.dimensions} · v{asset.version}</span><div className={`status-label ${asset.status}`}>{isCurrent ? "当前使用" : isGeneratingWhiteBackground ? `${label}生成中` : asset.type === "source" ? "原图" : label}</div>{(asset.status === "generating" || isGeneratingWhiteBackground) && <div className="progress-bar"><i style={{ width: `${asset.progress ?? 60}%` }} /></div>}</div>
  </article>;
}
