import React, { useState, type ChangeEvent, type DragEvent } from "react";
import { ChevronDown, ImagePlus, Upload } from "lucide-react";
import type { Asset } from "../../api/contracts";
import { toggleBoundedSelection } from "../../lib/generation-workspace";

export function ProductAssetPicker({
  assets,
  selectedIds,
  max,
  onChange,
  onUpload,
  error,
}: {
  assets: Asset[];
  selectedIds: string[];
  max: number;
  onChange: (ids: string[]) => void;
  onUpload?: (files: File[]) => void;
  error?: string;
}) {
  const [dragging, setDragging] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const selected = assets.filter((asset) => selectedIds.includes(asset.id));
  const handleUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length) onUpload?.(files);
    event.target.value = "";
  };
  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragging(false);
    const files = Array.from(event.dataTransfer.files).filter((file) => file.type.startsWith("image/"));
    if (files.length) onUpload?.(files);
  };
  return (
    <div className="product-asset-picker" data-generation-invalid={error ? "true" : undefined}>
      <button type="button" className="studio-source-select" aria-label={expanded ? "收起素材选择" : "选择产品素材"} aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
        {selected[0] ? <img src={selected[0].url} alt="" /> : <span className="studio-source-placeholder"><ImagePlus size={20} /></span>}
        <span><strong title={selected[0]?.name}>{selected[0]?.name ?? "选择或上传产品素材"}</strong><small>已选 {selectedIds.length}/{max}{selected.length > 1 ? " · 多视角素材" : " · 点击更换"}</small></span>
        <ChevronDown size={16} />
      </button>
      {selectedIds.length >= max && <div className="generation-limit-note" role="status">已达到 {max} 张素材上限，请先移除一张再添加。</div>}
      <div className="studio-source-options" hidden={!expanded}>
      <label
        className={["asset-dropzone", dragging ? "is-dragging" : ""].filter(Boolean).join(" ")}
        onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <Upload size={19} />
        <strong>拖入图片或点击上传</strong>
        <span>也可以从项目中的白底图选择</span>
        <input type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={handleUpload} />
      </label>
      {assets.length > 0 ? (
        <div className="generation-asset-grid">
          {assets.map((asset) => (
            <button
              key={asset.id}
              type="button"
              className={["generation-asset", selectedIds.includes(asset.id) ? "selected" : ""].filter(Boolean).join(" ")}
              aria-label={`${asset.name} ${asset.status === "ready" ? "可用" : asset.status}`}
              aria-pressed={selectedIds.includes(asset.id)}
              onClick={() => onChange(toggleBoundedSelection(selectedIds, asset.id, max))}
            >
              <img src={asset.url} alt="" />
              <span>{asset.name}<small>{asset.status === "ready" ? "可用" : asset.status}</small></span>
            </button>
          ))}
        </div>
      ) : (
        <div className="generation-empty-inline"><ImagePlus size={16} />暂无可用产品素材</div>
      )}
      </div>
      {error && <div className="generation-field-error" role="alert">{error}</div>}
    </div>
  );
}
