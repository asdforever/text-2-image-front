import { useEffect, useState } from "react";
import { X, Minus, Plus } from "lucide-react";
import { imagePrompt, type CanvasImage } from "./model";

export function CanvasCompare({ images, close }: { images: CanvasImage[]; close: () => void }) {
  const [zoom, setZoom] = useState(1);
  useEffect(() => { const key = (event: KeyboardEvent) => { if (event.key === "Escape") close(); }; window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key); }, [close]);
  const comparing = images.length === 2;
  return <div className="ic-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
    <section className="ic-compare" role="dialog" aria-modal="true" aria-label={comparing ? "图片对比" : "图片预览"}>
      <header><div><strong>{comparing ? "并排对比" : images[0].title}</strong><span>{comparing ? "同步放大，检查画面细节" : "原始比例 · 完整画面"}</span></div><div className="ic-actions"><button aria-label="缩小图片" onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}><Minus size={15} /></button><button onClick={() => setZoom(1)}>{Math.round(zoom * 100)}%</button><button aria-label="放大图片" onClick={() => setZoom((z) => Math.min(4, z + 0.25))}><Plus size={15} /></button><button autoFocus aria-label={comparing ? "关闭图片对比" : "关闭图片预览"} onClick={close}><X size={18} /></button></div></header>
      <div className={`ic-compare-grid ${comparing ? "is-pair" : ""}`}>{images.map((image, index) => <figure key={`${image.id}-${index}`}><figcaption><span>{comparing ? index === 0 ? "A" : "B" : ""}</span><strong title={image.title}>{image.title}</strong>{image.version && <small>v{image.version.versionNumber}</small>}</figcaption><div className="ic-compare-image"><img src={image.url} alt={image.title} style={{ width: `${zoom * 100}%`, maxWidth: "none", height: zoom > 1 ? "auto" : "100%" }} /></div><details className="ic-compare-prompt" open><summary>生成提示词</summary><pre>{imagePrompt(image) || "此图片未记录生成提示词"}</pre></details></figure>)}</div>
    </section>
  </div>;
}
