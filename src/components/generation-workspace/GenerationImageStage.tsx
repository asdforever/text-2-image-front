import React, { useEffect, useState } from "react";
import { Download, Image, Info, Maximize, Minus, Plus, Trash2 } from "lucide-react";
import type { Asset } from "../../api/contracts";
import { Dialog } from "../ui/dialog";


import type { ResultImage } from "../../lib/generation-results";
export type StageImage = ResultImage;

export function GenerationImageStage({ images, source, emptyTitle, onInspect, onDelete, activeBatchId, taskPending = false }: {
  images: StageImage[];
  activeBatchId?: string;
  taskPending?: boolean;
  source?: Asset;
  emptyTitle: string;
  onInspect?: (asset: Asset) => void;
  onDelete?: (asset: Asset) => void;
}) {
  const [selectedId, setSelectedId] = useState<string>();
  const [zoom, setZoom] = useState(100);
  const [failedUrl, setFailedUrl] = useState<string>();
  const [previewOpen, setPreviewOpen] = useState(false);
  const selected = images.find((image) => image.id === selectedId) ?? images[images.length - 1];
  const current = selected ?? source;
  const groupId = selected?.groupId ?? "unassigned";
  const groups = Array.from(new Map(images.map(image => [image.groupId ?? "unassigned", image.groupLabel ?? "批次信息未记录"])).entries());
  const visibleImages = images.filter(image => (image.groupId ?? "unassigned") === groupId);
  const readableName = selected ? `第 ${visibleImages.findIndex(image => image.id === selected.id) + 1} 张${selected.moduleLabel ? ` · ${selected.moduleLabel}` : ""}` : "素材预览";
  useEffect(() => {
    if (selected && selected.id !== selectedId) setSelectedId(selected.id);
  }, [selected?.id, selectedId]);
  useEffect(() => { setZoom(100); setFailedUrl(undefined); }, [current?.id, current?.url]);

  const preview = <section className="studio-stage" aria-label="图片预览">
      <div className="studio-stage-toolbar">
        <span>{selected ? readableName : source ? "素材预览" : "图片预览"}</span>
        {current && <div className="studio-image-actions">
          <button title="缩小图片" aria-label="缩小图片" disabled={zoom <= 50} onClick={() => setZoom((value) => Math.max(50, value - 25))}><Minus size={15} /></button>
          <output>{zoom}%</output>
          <button title="放大图片" aria-label="放大图片" disabled={zoom >= 200} onClick={() => setZoom((value) => Math.min(200, value + 25))}><Plus size={15} /></button>
          <button title="适应画面" aria-label="适应画面" onClick={() => setZoom(100)}><Maximize size={15} /></button>
        </div>}
      </div>
      <div className="studio-stage-viewport">
        {current && failedUrl !== current.url ? <div className="studio-stage-image-wrap" style={{ width: `${zoom}%`, height: `${zoom}%` }}>
          <img className="studio-stage-image" src={current.url} alt={selected ? readableName : current.name} decoding="async" onError={() => setFailedUrl(current.url)} />
        </div> : <div className="studio-stage-empty">
          <Image size={36} strokeWidth={1} />
          <strong>{current ? "图片加载失败" : emptyTitle}</strong>
          {current && <button onClick={() => setFailedUrl(undefined)}>重试加载</button>}
        </div>}
      </div>
      <div className="studio-stage-caption">
        <div className="studio-image-metadata"><span>{selected?.subtitle || (selected ? "图片信息未记录" : source?.dimensions ? `素材尺寸 ${source.dimensions}` : "尚无生成结果")}</span>
          {current && <details><summary>文件信息</summary><span>{current.name}</span></details>}
          {selected && <details className="studio-image-prompt" open><summary>生成提示词</summary><pre>{selected.prompt || "此图片未记录生成提示词"}</pre></details>}
        </div>
        {current && <div className="studio-image-actions">
          {selected?.asset && onInspect && <button title="查看图片详情" aria-label="查看图片详情" onClick={() => { setPreviewOpen(false); onInspect(selected.asset!); }}><Info size={16} /></button>}
          <a href={current.url} download={current.name} title="下载当前图片" aria-label="下载当前图片"><Download size={16} /></a>
          {selected?.asset && onDelete && <button title="删除当前图片" aria-label="删除当前图片" onClick={() => { setPreviewOpen(false); onDelete(selected.asset!); }}><Trash2 size={16} /></button>}
        </div>}
      </div>
    </section>;

  return <div className="studio-gallery c-result-gallery">
    <div className="studio-result-context">
      <label>查看结果<select aria-label="查看生成批次" value={groupId} disabled={!images.length} onChange={event => {
        const candidates = images.filter(image => (image.groupId ?? "unassigned") === event.target.value);
        const next = candidates[candidates.length - 1];
        if (next) setSelectedId(next.id);
      }}>{groups.length ? groups.map(([id, name]) => <option key={id} value={id}>{id === activeBatchId ? "本次任务 · " : ""}{name}</option>) : <option value="unassigned">暂无生成结果</option>}</select></label>
      {selected && <span className="studio-result-origin">{selected.batchId === activeBatchId && activeBatchId ? "正在查看本次任务结果" : selected.batchId ? "正在查看历史批次" : "批次信息未记录"}</span>}
    </div>
    {taskPending && selected && (!activeBatchId || selected.batchId !== activeBatchId) && <p className="studio-history-notice" role="status">新任务正在处理，当前展示已有结果；图片数量不代表新任务进度。</p>}
    {images.length > 0 ? <section className="c-result-collection" aria-label="生成结果">
      <div className="c-result-collection-heading"><strong>当前批次图片</strong><span>{visibleImages.length} 张</span></div>
      <div className="c-result-grid">
        {visibleImages.map((image, index) => <article className="c-result-card" key={image.id}>
          <button className="c-result-art" aria-label={`查看 ${image.name}`} onClick={() => { setSelectedId(image.id); setPreviewOpen(true); }}>
            <img src={image.url} alt={image.moduleLabel ?? `生成图片 ${index + 1}`} loading="lazy" decoding="async" />
            <span className="c-result-open"><Maximize size={15} />查看大图</span>
          </button>
          <div className="c-result-card-caption"><strong>{image.moduleLabel || `生成图片 ${index + 1}`}</strong><span>第 {index + 1} 张</span></div>
          <p className="c-result-card-detail">{image.subtitle || "图片信息未记录"}</p>
        </article>)}
      </div>
      <p className="c-result-guidance">选择图片可查看大图和对应提示词</p>
    </section> : preview}
    <div className="c-result-preview">
      <Dialog open={previewOpen && images.length > 0} onOpenChange={setPreviewOpen} title={selected?.moduleLabel || "图片预览"} eyebrow="">{preview}</Dialog>
    </div>
  </div>;
}
