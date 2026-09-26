import React, { useRef, useState } from "react";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import type { Asset } from "../../api/contracts";
import { projectApi } from "../../api/client";
import { useProjectStore } from "../../store/useProjectStore";
import { ConfigSectionCard } from "./ConfigSectionCard";
import { Button } from "../ui/button";

/** References are ordered planning inputs, separate from product evidence. */
export function ReferenceAssetPicker(props: {
  projectId: string;
  mode: "hero" | "suite";
  assets: Asset[];
  selectedIds: string[];
  productIds: string[];
  onChange: (ids: string[]) => void;
  onRefresh?: () => Promise<void> | void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const uploadLock = useRef(false);
  const selected = props.selectedIds;
  const available = props.assets.filter((asset) => asset.status === "ready" && asset.type !== "video" && !props.productIds.includes(asset.id));
  const move = (index: number, direction: number) => {
    const next = [...selected];
    [next[index], next[index + direction]] = [next[index + direction], next[index]];
    props.onChange(next);
  };
  const upload = async (files: File[]) => {
    if (uploadLock.current) return;
    uploadLock.current = true; setUploading(true); setError("");
    const currentIds = () => useProjectStore.getState().generationDrafts[`${props.projectId}:${props.mode}`]?.config.referenceAssetIds ?? [];
    try {
      const capacity = Math.max(0, 12 - currentIds().length);
      if (files.length > capacity) setError("参考套图最多 12 张，超出部分未上传。");
      for (const file of files.slice(0, capacity)) {
        try {
          const asset = await projectApi.uploadAsset(props.projectId, "source", file);
          // Read the latest draft after each upload; navigating away must not lose IDs.
          useProjectStore.getState().updateGenerationDraft(props.projectId, props.mode, { referenceAssetIds: [...currentIds(), asset.id] });
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : `参考图 ${file.name} 上传失败`);
        }
      }
      await props.onRefresh?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "参考图刷新失败，请刷新页面查看已上传素材");
    } finally { uploadLock.current = false; setUploading(false); }
  };
  return <ConfigSectionCard title="参考套图" description="选填：借鉴整套顺序和构图，按当前商品资料自动调整。最多 12 张。">
    <p className="generation-config-footnote">参考中的品牌、参数和卖点不会作为当前商品资料；图片风格沿用下方设置。</p>
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" size="sm" variant="secondary" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>选择参考套图</Button>
      <label className="cursor-pointer text-sm">{uploading ? "上传中…" : "上传参考套图"}<input aria-label="上传参考套图" className="block max-w-full text-xs" type="file" accept="image/png,image/jpeg,image/webp" multiple disabled={uploading || selected.length >= 12} onChange={(event) => { const files = Array.from(event.target.files ?? []); event.target.value = ""; void upload(files); }} /></label>
      <small>已选 {selected.length}/12</small>
    </div>
    {selected.length > 0 && <ol className="mt-2 space-y-2" aria-label="参考套图顺序">{selected.map((id, index) => {
      const asset = props.assets.find((item) => item.id === id);
      return <li key={id} className="flex items-center gap-2 text-sm">
        <span>{index + 1}</span>{asset && <img className="h-12 w-12 rounded object-contain" src={asset.url} alt={asset.name} />}
        <span className="min-w-0 flex-1 truncate">{asset?.name ?? "参考图待刷新"}</span>
        <button type="button" aria-label={`上移参考图 ${index + 1}`} disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp size={15} /></button>
        <button type="button" aria-label={`下移参考图 ${index + 1}`} disabled={index === selected.length - 1} onClick={() => move(index, 1)}><ArrowDown size={15} /></button>
        <button type="button" aria-label={`移除参考图 ${index + 1}`} onClick={() => props.onChange(selected.filter((item) => item !== id))}><Trash2 size={15} /></button>
      </li>;
    })}</ol>}
    {expanded && <div className="generation-asset-grid">{available.map((asset) => <button type="button" key={asset.id} aria-label={`参考图 ${asset.name}`} aria-pressed={selected.includes(asset.id)} disabled={!selected.includes(asset.id) && selected.length >= 12} className={`generation-asset${selected.includes(asset.id) ? " selected" : ""}`} onClick={() => props.onChange(selected.includes(asset.id) ? selected.filter((id) => id !== asset.id) : [...selected, asset.id])}>
      <img src={asset.url} alt="" /><span>{asset.name}</span>
    </button>)}{available.length === 0 && <p>暂无可选参考图，可以上传一套参考图片。</p>}</div>}
    {error && <p role="alert" className="generation-field-error">{error}</p>}
  </ConfigSectionCard>;
}
